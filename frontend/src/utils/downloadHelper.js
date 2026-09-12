/**
 * Robust Browser Download Helper
 * 
 * Solves Chromium issue where immediate URL.revokeObjectURL() or immediate DOM element removal
 * causes the browser's download manager to discard the download attribute and save the file
 * as an extensionless UUID (e.g., "87af5099-ac21-4d00-99c0-4edd9d66b087").
 * Also sanitizes path separators to prevent Chromium security sanitization.
 */

const MIME_EXTENSION_MAP = {
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-excel": ".xls",
  "application/pdf": ".pdf",
  "application/zip": ".zip",
  "application/x-zip-compressed": ".zip",
  "application/x-zip": ".zip",
  "multipart/x-zip": ".zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "application/vnd.ms-powerpoint": ".ppt",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "text/html": ".html",
  "text/css": ".css",
  "text/javascript": ".js",
  "application/json": ".json",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};

/**
 * Extract filename from HTTP Content-Disposition header
 */
export function extractFilenameFromHeader(headerValue) {
  if (!headerValue || typeof headerValue !== "string") return null;

  try {
    // 1. Try RFC 5987 filename*=UTF-8''filename.ext
    const utf8Match = headerValue.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
    if (utf8Match && utf8Match[1]) {
      return decodeURIComponent(utf8Match[1].trim());
    }

    // 2. Try standard filename="filename.ext"
    const quotedMatch = headerValue.match(/filename\s*=\s*"([^"]+)"/i);
    if (quotedMatch && quotedMatch[1]) {
      return quotedMatch[1].trim();
    }

    // 3. Try unquoted filename=filename.ext
    const unquotedMatch = headerValue.match(/filename\s*=\s*([^;]+)/i);
    if (unquotedMatch && unquotedMatch[1]) {
      return unquotedMatch[1].trim();
    }
  } catch (err) {
    console.warn("Error parsing Content-Disposition header:", err);
  }

  return null;
}

/**
 * Ensure the filename is safe for Chromium download attribute (no paths)
 * and has a valid file extension matching its MIME type.
 */
export function sanitizeDownloadFilename(filename, contentType = "") {
  let name = String(filename || "document").trim();

  // Strip directory paths (e.g., "folder/file.pdf" -> "file.pdf")
  // Chromium rejects or strips the download attribute if it contains slashes!
  name = name.split(/[\\/]/).filter(Boolean).pop() || "document";

  // Remove dangerous or invalid characters
  name = name.replace(/[/\\?%*:|"<>]/g, "_").trim();
  if (!name) name = "document";

  // Check if filename already has a recognized extension
  const hasExtension = /\.[a-zA-Z0-9]{1,8}$/.test(name);

  if (!hasExtension && contentType) {
    const cleanMime = String(contentType).split(";")[0].trim().toLowerCase();
    const extension = MIME_EXTENSION_MAP[cleanMime];
    if (extension) {
      name = `${name}${extension}`;
    }
  }

  return name;
}

/**
 * Trigger browser download for a Blob or Axios response
 * 
 * @param {Blob|ArrayBuffer|any} data - The raw blob/buffer from server
 * @param {string} fallbackFilename - Filename to use if header not present
 * @param {string} [contentType] - Optional MIME type override
 * @param {object} [headers] - Axios response headers to parse Content-Disposition
 */
export function triggerBlobDownload(data, fallbackFilename = "document", contentType = "", headers = null) {
  // If user passed Axios response directly: triggerBlobDownload(response, fallbackFilename)
  if (data && data.data !== undefined && data.headers !== undefined) {
    headers = data.headers;
    contentType = contentType || data.headers?.["content-type"] || "";
    data = data.data;
  }

  // 1. Try to read filename from response headers
  let resolvedFilename = "";
  if (headers) {
    const disposition = headers["content-disposition"] || headers["Content-Disposition"];
    resolvedFilename = extractFilenameFromHeader(disposition);
  }

  if (!resolvedFilename) {
    resolvedFilename = fallbackFilename;
  }

  // 2. Sanitize and ensure extension
  const cleanMime = String(contentType || (data instanceof Blob ? data.type : "")).split(";")[0].trim();
  const safeFilename = sanitizeDownloadFilename(resolvedFilename, cleanMime);

  // 3. Construct Blob with proper MIME type
  const blob = data instanceof Blob
    ? data
    : new Blob([data], { type: cleanMime || "application/octet-stream" });

  // 4. Create object URL
  const url = window.URL.createObjectURL(blob);

  // 5. Create anchor and mount off-screen
  const link = window.document.createElement("a");
  link.style.position = "fixed";
  link.style.left = "-9999px";
  link.style.top = "-9999px";
  link.style.opacity = "0";
  link.href = url;
  link.download = safeFilename;
  link.setAttribute("download", safeFilename);

  window.document.body.appendChild(link);

  // 6. Programmatically trigger click
  try {
    link.click();
  } catch (err) {
    console.error("Link click trigger failed:", err);
    // Fallback: direct window.location for blob
    window.location.href = url;
  }

  // 7. CRITICAL FIX: Do NOT remove anchor or revoke URL synchronously!
  // In Chromium, revoking the blob URL immediately aborts the download initiation,
  // causing Chrome to save the file as the raw blob UUID ("87af5099-...") with no extension.
  // Keeping the anchor and URL active for 60 seconds guarantees clean file saving.
  setTimeout(() => {
    try {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
      window.URL.revokeObjectURL(url);
    } catch {
      // Ignored if already cleaned up
    }
  }, 60000);

  return safeFilename;
}

export default triggerBlobDownload;
