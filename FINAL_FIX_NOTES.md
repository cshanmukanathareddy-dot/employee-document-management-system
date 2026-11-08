# EDMS Deep Fix v7

## Root cause confirmed from Render logs
The ZIP extraction 500 was caused by:
`TypeError: Header value must be str or bytes, not <class 'bool'>`

The storage upload options were passing `upsert=True` as a Python boolean into a storage3/httpx request. This version uses the correct string HTTP header:
`x-upsert: "true"`.

## Fixes
- Employee-owned ZIP extraction now reaches Supabase Storage correctly.
- Admin ZIP extraction preserved.
- Admin extraction of employee ZIPs preserved to admin directory.
- Employee extraction of admin-shared ZIPs preserved to employee directory.
- Retry/duplicate handling remains idempotent.
- `.keep` directory creation uses the same correct string upsert header.
- Admin document preview/download storage lookup now has a legacy-safe fallback to the uploader directory when old metadata points at a stale directory.
- Existing view endpoints remain `inline`; download endpoints remain `attachment`.
- No file extension/MIME whitelist was reintroduced.
- ZIP member types remain unrestricted.
- The browser Web Vitals `startTime` error in the supplied log is unrelated third-party/runtime instrumentation and is not the cause of the extraction 500.

## Deployment
Redeploy the backend after pushing this version. Test the employee's own ZIP first. The previous Render 500 should no longer contain the `Header value must be str or bytes, not <class 'bool'>` error.


## Extraction reliability improvements
- ZIP metadata, file paths and safety limits are validated before extraction. Each member is CRC-checked while it is streamed to a temporary file before that member is uploaded. If a member fails, files already uploaded by that extraction are cleaned up.
- Damaged, encrypted, or unsupported ZIPs now return a clear extraction error.
- Extraction is intentionally sequential instead of concurrent to reduce intermittent Supabase Storage failures on archives containing many website assets.
- Errors now include the exact ZIP member that failed, making Render logs much easier to diagnose.
- The existing arbitrary-file-type support, folder naming, cross-user extraction, retry logic, and the existing upload safeguards are preserved; the application file ceiling is now 500 MiB.


# Low-latency clean public URL update
- View and Copy Link now use the exact same canonical custom-domain URL.
- Vercel transparently proxies file-like public paths to the existing Render public-path endpoint.
- Edge rewrite caching is enabled for public read-only files/assets.
- PublicDocument no longer waits for a separate /health polling loop before loading a file.
- Upload handlers no longer perform a redundant document-list refresh after a successful upload; the upload response already contains the new document records.
- Authenticated users render a cached profile immediately while /employees/me refreshes in the background.
- Logged-out public visitors no longer trigger the global Render keep-alive request.


## Render deployment hardening and large uploads

- Pinned Render to Python 3.12.8 with `PYTHON_VERSION` and `backend/.python-version` so it does not silently select a newer default runtime.
- The Supabase PostgreSQL engine now enforces TLS for remote connections, uses a bounded SQLAlchemy pool, and has a finite connection timeout.
- Supabase uploads and downloads now use seekable file streams / chunked writes. Large ZIP members are staged on disk, not loaded fully into Render memory.
- ZIP integrity is checked during the one extraction pass instead of decompressing every file in a separate `testzip()` pass. This avoids doubling ZIP decompression work.
- The ZIP limit counts actual files (not directory entries) and is 10,000. Total uncompressed size remains 2 GiB.
- The application file limit is 500 MiB. Supabase Free projects enforce a 50 MB per-file maximum; larger files require an eligible paid plan and corresponding Storage global and bucket limits.
