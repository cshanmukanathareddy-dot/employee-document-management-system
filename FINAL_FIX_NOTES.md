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
- ZIP integrity is checked before any extracted file is uploaded.
- Damaged, encrypted, or unsupported ZIPs now return a clear extraction error.
- Extraction is intentionally sequential instead of concurrent to reduce intermittent Supabase Storage failures on archives containing many website assets.
- Errors now include the exact ZIP member that failed, making Render logs much easier to diagnose.
- The existing arbitrary-file-type support, folder naming, cross-user extraction, retry logic, and 100 MB limits are preserved.
