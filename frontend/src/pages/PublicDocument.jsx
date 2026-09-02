import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { FileWarning, Loader2, ShieldCheck } from "lucide-react";

import { API_URL } from "../services/api";

export default function PublicDocument() {
  const { directory, "*": filePath = "", token, shareType } = useParams();

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const cleanPath = useMemo(() => {
    return (filePath || "")
      .replace(/\\/g, "/")
      .replace(/^\/+|\/+$/g, "");
  }, [filePath]);

  const isTokenShare = Boolean(token);

  const documentName = useMemo(() => {
    if (isTokenShare) return "Shared document";
    const parts = cleanPath.split("/").filter(Boolean);
    return parts[parts.length - 1] || "Shared document";
  }, [cleanPath, isTokenShare]);

  const publicFileUrl = useMemo(() => {
    if (isTokenShare) {
      if (!token) return "";
      const endpoint =
        shareType === "document"
          ? `/documents/public/${encodeURIComponent(token)}`
          : `/admin-documents/public/${encodeURIComponent(token)}`;
      return `${API_URL.replace(/\/$/, "")}${endpoint}`;
    }

    if (!directory || !cleanPath) {
      return "";
    }

    const encodedDirectory = encodeURIComponent(directory);
    const encodedPath = cleanPath
      .split("/")
      .filter(Boolean)
      .map((part) => encodeURIComponent(part))
      .join("/");

    return `${API_URL.replace(/\/$/, "")}/documents/public-path/${encodedDirectory}/${encodedPath}`;
  }, [directory, cleanPath, isTokenShare, token, shareType]);

  useEffect(() => {
    if (!publicFileUrl) {
      setLoading(false);
      setError("Invalid shared document URL.");
      return;
    }

    setLoading(true);
    setError("");
  }, [publicFileUrl]);

  if (error || !publicFileUrl) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-5 text-center sm:p-8 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
            <FileWarning size={26} />
          </div>

          <h1 className="mt-5 text-xl font-bold text-slate-900">
            Document unavailable
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {error || "This shared document link is invalid."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <ShieldCheck size={19} />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                {documentName}
              </p>
              <p className="truncate text-[11px] text-slate-400">
                {isTokenShare ? "Secure shared link" : `${directory}/${cleanPath}`}
              </p>
            </div>
          </div>

          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
            View only
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-3 sm:px-5 sm:py-5">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm">
                <Loader2 size={16} className="animate-spin" />
                Opening document...
              </div>
            </div>
          )}

          <iframe
            title={documentName}
            src={publicFileUrl}
            className="block h-[calc(100vh-132px)] min-h-[420px] sm:h-[calc(100vh-105px)] sm:min-h-[620px] w-full border-0"
            referrerPolicy="no-referrer"
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError("This document could not be opened.");
            }}
          />
        </div>

        <p className="px-1 py-3 text-center text-[11px] text-slate-400">
          This shared link provides view-only access to this document.
        </p>
      </main>
    </div>
  );
}
