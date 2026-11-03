import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  FileWarning,
  Globe,
  Home,
  Link2,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import { API_URL } from "../services/api";
import { buildPublicDocumentUrl } from "../utils/publicUrl";

export default function PublicDocument() {
  const { directory, "*": filePath = "", token, shareType } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const isTokenShare = Boolean(token);
  const rawPath = (filePath || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const cleanPath = !rawPath && !isTokenShare && directory ? "index.html" : rawPath;

  const documentName = isTokenShare
    ? "Shared document"
    : cleanPath.split("/").filter(Boolean).pop() || "index.html";

  const isIndexHtml =
    cleanPath.toLowerCase() === "index.html" ||
    cleanPath.toLowerCase().endsWith("/index.html");

  const ext = documentName.includes(".")
    ? documentName.split(".").pop().toLowerCase()
    : "";

  const isImage = ["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp"].includes(ext);
  const isPdf = ext === "pdf";

  const cleanWebUrl = isTokenShare
    ? `${window.location.origin}/share/${shareType}/${token}`
    : buildPublicDocumentUrl(directory, cleanPath);

  const indexWebUrl = !isTokenShare && directory
    ? `/${encodeURIComponent(directory)}/index.html`
    : "";

  const publicFileUrl = useMemo(() => {
    if (isTokenShare) {
      if (!token) return "";
      const endpoint = shareType === "document"
        ? `/documents/public/${encodeURIComponent(token)}`
        : `/admin-documents/public/${encodeURIComponent(token)}`;
      return `${API_URL.replace(/\/$/, "")}${endpoint}`;
    }

    if (!directory || !cleanPath) return "";

    const encodedPath = cleanPath
      .split("/")
      .filter(Boolean)
      .map(encodeURIComponent)
      .join("/");

    return `${API_URL.replace(/\/$/, "")}/documents/public-path/${encodeURIComponent(directory)}/${encodedPath}`;
  }, [directory, cleanPath, isTokenShare, token, shareType]);

  useEffect(() => {
    if (!publicFileUrl) {
      setLoading(false);
      setError("Invalid shared document URL.");
      return undefined;
    }

    setLoading(true);
    setError("");
    return undefined;
  }, [publicFileUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanWebUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // ignore
    }
  };

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

          {!isTokenShare && directory && (
            <div className="mt-6 flex justify-center">
              <Link
                to={indexWebUrl}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700"
              >
                <Home size={15} />
                Try navigating to index.html
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur shadow-xs">
        <div className="mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 max-w-7xl">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <ShieldCheck size={19} />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-bold text-slate-900" title={documentName}>
                  {documentName}
                </h1>

                {isIndexHtml && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    index.html
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Globe size={11} className="text-slate-400 shrink-0" />
                <span className="truncate max-w-[280px] sm:max-w-md">
                  {isTokenShare ? "Secure shared token" : `${directory}/${cleanPath}`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isTokenShare && directory && (
              <>
                {isIndexHtml ? (
                  <span
                    title="Currently viewing primary home page"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50/80 px-2.5 text-xs font-semibold text-emerald-800"
                  >
                    <Home size={13} className="text-emerald-600" />
                    Home (index.html)
                  </span>
                ) : (
                  <Link
                    to={indexWebUrl}
                    title="Navigate back to index.html"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 hover:border-indigo-300"
                  >
                    <ArrowLeft size={13} />
                    Back to index.html
                  </Link>
                )}
              </>
            )}

            <a
              href={publicFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              title="Open direct file stream"
            >
              <ExternalLink size={13} />
              <span className="hidden sm:inline">Open</span> Direct
            </a>

            <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
              View only
            </span>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-slate-50/90 px-4 py-2 sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="inline-flex items-center gap-1 font-semibold text-slate-500 shrink-0">
                <Link2 size={13} className="text-indigo-600" />
                <span>Web Link:</span>
              </span>

              <a
                href={cleanWebUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open this link in new tab"
                className="font-mono text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline truncate max-w-xl sm:max-w-2xl"
              >
                {cleanWebUrl}
              </a>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopy}
                className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition ${
                  copied
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs"
                }`}
                title="Copy full webpage URL to clipboard"
              >
                {copied ? (
                  <>
                    <Check size={12} className="text-emerald-600" />
                    Link Copied!
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    Copy Link
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl w-full flex-1 px-3 py-3 sm:px-5 sm:py-5 flex flex-col">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm flex-1 min-h-[520px] flex items-center justify-center">
          {loading && (
            <div className="flex flex-col items-center justify-center p-8 text-center max-w-md z-10">
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-sm mb-4">
                <ShieldCheck size={28} className="animate-pulse" />
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                  <Loader2 size={12} className="animate-spin" />
                </div>
              </div>

              <h2 className="text-sm font-bold text-slate-800">
                Opening Document
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Connecting to document service...
              </p>
            </div>
          )}

          <>
              {isImage ? (
                <div className={`flex items-center justify-center p-4 w-full h-full min-h-[520px] ${loading ? "hidden" : ""}`}>
                  <img
                    src={publicFileUrl}
                    alt={documentName}
                    className="max-h-[calc(100vh-190px)] max-w-full object-contain rounded-lg"
                    onLoad={() => setLoading(false)}
                    onError={() => {
                      setLoading(false);
                      setError("This image could not be loaded.");
                    }}
                  />
                </div>
              ) : isPdf ? (
                <object
                  data={publicFileUrl}
                  type="application/pdf"
                  className={`block h-[calc(100vh-180px)] min-h-[520px] sm:h-[calc(100vh-140px)] sm:min-h-[660px] w-full border-0 ${loading ? "hidden" : ""}`}
                  onLoad={() => setLoading(false)}
                >
                  <iframe
                    title={documentName}
                    src={publicFileUrl}
                    className="block h-full w-full border-0"
                    referrerPolicy="no-referrer"
                    onLoad={() => setLoading(false)}
                    onError={() => {
                      setLoading(false);
                      setError("This document could not be opened.");
                    }}
                  />
                </object>
              ) : (
                <iframe
                  title={documentName}
                  src={publicFileUrl}
                  className={`block h-[calc(100vh-180px)] min-h-[520px] sm:h-[calc(100vh-140px)] sm:min-h-[660px] w-full border-0 ${loading ? "hidden" : ""}`}
                  referrerPolicy="no-referrer"
                  onLoad={() => setLoading(false)}
                  onError={() => {
                    setLoading(false);
                    setError("This document could not be opened.");
                  }}
                />
              )}
            </>
        </div>

        <div className="flex items-center justify-between px-2 py-2.5 text-[11px] text-slate-400">
          <span>This shared link provides view-only access to this document.</span>
          {!isTokenShare && (
            <Link
              to={indexWebUrl}
              className="text-indigo-600 hover:underline font-semibold"
            >
              Go to index.html →
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
