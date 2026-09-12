// Public document delivery: Vercel Edge -> Supabase Storage.
// Render is intentionally NOT used for clean public document URLs.
// The Vercel rewrite keeps the browser URL as /<directory>/<path>.
export const config = {
  runtime: "edge",
};

const DEFAULT_BUCKET = "edms-files";
const CACHE_CONTROL =
  "public, max-age=60, s-maxage=600, stale-while-revalidate=3600";

function jsonError(status, message) {
  return new Response(JSON.stringify({ detail: message }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function safeDirectory(value) {
  const directory = String(value || "").trim();
  return /^[A-Za-z0-9_]+$/.test(directory) ? directory : "";
}

function safeFilePath(value) {
  const normalized = String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");

  if (!normalized || normalized.length > 2048) return "";

  const parts = normalized.split("/");
  if (
    parts.some(
      (part) => !part || part === "." || part === ".." || part.includes("\\")
    )
  ) {
    return "";
  }

  return parts.join("/");
}

function encodePath(path) {
  return path
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

async function supabaseQuery(path) {
  const supabaseUrl = String(process.env.SUPABASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase public document service is not configured.");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Supabase database request failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`
    );
  }

  return response.json();
}

async function findDocument(directory, filePath) {
  const encodedName = encodeURIComponent(filePath);
  const encodedDirectory = encodeURIComponent(directory);

  // Run the independent lookups together. This keeps the cold path to one
  // network round-trip window instead of waiting for each table sequentially.
  const [users, documents, adminDocuments] = await Promise.all([
    supabaseQuery(
      `users?select=id,directory_name&directory_name=eq.${encodedDirectory}&limit=1`
    ),
    supabaseQuery(
      `documents?select=stored_name,file_type,document_name,owner_id,status&document_name=eq.${encodedName}&limit=20`
    ),
    supabaseQuery(
      `admin_documents?select=stored_name,file_type,document_name,can_view,storage_directory,uploaded_by&document_name=eq.${encodedName}&can_view=eq.true&limit=50`
    ),
  ]);

  const owner = Array.isArray(users) ? users[0] : null;

  // Prefer the employee-owned document in the requested directory.
  if (owner) {
    const own = (Array.isArray(documents) ? documents : []).find(
      (doc) => Number(doc.owner_id) === Number(owner.id)
    );

    if (own) {
      return {
        storedName: own.stored_name,
        fileType: own.file_type,
        documentName: own.document_name,
      };
    }
  }

  // Admin documents may be stored in an employee directory or in the
  // administrator's directory. Preserve the existing public-path behavior.
  const matchingAdmin = (Array.isArray(adminDocuments) ? adminDocuments : []).find(
    (doc) =>
      String(doc.storage_directory || "") === directory ||
      (owner && Number(doc.uploaded_by) === Number(owner.id))
  );

  if (matchingAdmin) {
    return {
      storedName: matchingAdmin.stored_name,
      fileType: matchingAdmin.file_type,
      documentName: matchingAdmin.document_name,
    };
  }

  // Legacy fallback retained for existing public admin links whose
  // storage_directory was not populated in older records.
  const legacyAdmin = (Array.isArray(adminDocuments) ? adminDocuments : [])[0];
  if (legacyAdmin) {
    return {
      storedName: legacyAdmin.stored_name,
      fileType: legacyAdmin.file_type,
      documentName: legacyAdmin.document_name,
    };
  }

  // Keep the historical index.html fallback for ZIP websites where the
  // stored database name may contain a wrapper folder.
  if (filePath.toLowerCase() === "index.html") {
    const [indexDocs, indexAdminDocs] = await Promise.all([
      supabaseQuery(
        `documents?select=stored_name,file_type,document_name,owner_id,status&document_name=like.*index.html&limit=100`
      ),
      supabaseQuery(
        `admin_documents?select=stored_name,file_type,document_name,can_view,storage_directory,uploaded_by&document_name=like.*index.html&can_view=eq.true&limit=100`
      ),
    ]);

    if (owner) {
      const ownIndex = (Array.isArray(indexDocs) ? indexDocs : []).find(
        (doc) =>
          Number(doc.owner_id) === Number(owner.id) &&
          String(doc.status || "").toLowerCase() === "approved"
      );
      if (ownIndex) {
        return {
          storedName: ownIndex.stored_name,
          fileType: ownIndex.file_type,
          documentName: ownIndex.document_name,
        };
      }
    }

    const adminIndex = (Array.isArray(indexAdminDocs) ? indexAdminDocs : []).find(
      (doc) =>
        String(doc.storage_directory || "") === directory ||
        (owner && Number(doc.uploaded_by) === Number(owner.id))
    );
    if (adminIndex) {
      return {
        storedName: adminIndex.stored_name,
        fileType: adminIndex.file_type,
        documentName: adminIndex.document_name,
      };
    }
  }

  return null;
}

function contentTypeFor(fileType, filePath) {
  const supplied = String(fileType || "").trim();
  if (supplied && supplied !== "application/octet-stream") return supplied;

  const ext = filePath.toLowerCase().split(".").pop();
  const types = {
    html: "text/html; charset=utf-8",
    htm: "text/html; charset=utf-8",
    css: "text/css; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    json: "application/json; charset=utf-8",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    ico: "image/x-icon",
    pdf: "application/pdf",
    txt: "text/plain; charset=utf-8",
    xml: "application/xml; charset=utf-8",
    csv: "text/csv; charset=utf-8",
    wasm: "application/wasm",
  };

  return types[ext] || "application/octet-stream";
}

export default async function handler(request) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return jsonError(405, "Method not allowed.");
  }

  const url = new URL(request.url);
  const directory = safeDirectory(url.searchParams.get("directory"));

  // Vercel rewrite supplies filePath. Direct API calls are also supported.
  const filePath = safeFilePath(url.searchParams.get("filePath"));

  if (!directory || !filePath) {
    return jsonError(404, "Document not found.");
  }

  try {
    const document = await findDocument(directory, filePath);

    if (!document) {
      return jsonError(404, "Document not found.");
    }

    const bucket = String(process.env.SUPABASE_BUCKET || DEFAULT_BUCKET).trim();
    const supabaseUrl = String(process.env.SUPABASE_URL || "")
      .trim()
      .replace(/\/+$/, "");
    const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

    if (!supabaseUrl || !serviceKey || !bucket) {
      return jsonError(500, "Public document storage is not configured.");
    }

    const storagePath = `${directory}/${document.storedName}`;
    const storageUrl =
      `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodePath(storagePath)}`;

    const storageResponse = await fetch(storageUrl, {
      method: request.method,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });

    if (!storageResponse.ok) {
      return jsonError(
        storageResponse.status === 404 ? 404 : 502,
        storageResponse.status === 404
          ? "Document file is no longer available."
          : "Unable to load document from storage."
      );
    }

    const headers = new Headers();
    headers.set("Content-Type", contentTypeFor(document.fileType, filePath));
    headers.set("Cache-Control", CACHE_CONTROL);
    headers.set("CDN-Cache-Control", CACHE_CONTROL);
    headers.set("Vercel-CDN-Cache-Control", CACHE_CONTROL);
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Accept-Ranges", "bytes");
    headers.set(
      "Content-Disposition",
      `inline; filename="${String(filePath.split("/").pop() || "document").replace(/["\r\n]/g, "_")}"`
    );

    const contentLength = storageResponse.headers.get("content-length");
    const etag = storageResponse.headers.get("etag");
    const lastModified = storageResponse.headers.get("last-modified");
    if (contentLength) headers.set("Content-Length", contentLength);
    if (etag) headers.set("ETag", etag);
    if (lastModified) headers.set("Last-Modified", lastModified);

    // Uploaded HTML is intentionally isolated. This keeps arbitrary uploaded
    // pages from gaining access to EDMS cookies/localStorage on web-a2z.com.
    // It is top-level now, so there is no iframe sandbox warning.
    if (contentTypeFor(document.fileType, filePath).toLowerCase().startsWith("text/html")) {
      headers.set(
        "Content-Security-Policy",
        "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
      );
    }

    return new Response(request.method === "HEAD" ? null : storageResponse.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Public document delivery error:", error);
    return jsonError(500, "Unable to load document.");
  }
}
