# EDMS ZIP 20K + Password-Protected ZIP Update

This update is based on the supplied EDMS project ZIP and keeps the existing Render PostgreSQL driver correction and 500 MiB application upload limit.

## ZIP limits

- Maximum ZIP contents: **20,000 actual files**. Directory entries do not count.
- Maximum total uncompressed content: **2 GiB** (unchanged).
- Maximum individual upload configured by the application: **500 MiB** (unchanged).
- ZIPs remain stored as ZIP files until a user explicitly chooses **Extract**.
- ZIP extraction remains sequential and streams each extracted file. It does not add concurrent Supabase uploads or extra whole-file memory copies.

## Password-protected ZIP files

- Plain ZIP files continue to use Python's built-in `zipfile` path.
- Password-protected ZIPs, including WinZip AES archives (compression method 99), use `pyzipper==0.4.0`.
- When a user selects **Extract**, EDMS first checks whether the ZIP is encrypted. Only then does it display the masked password dialog.
- The password is sent in the HTTPS extraction request body only. It is not written into the database, document metadata, or application logs.
- A wrong password leaves the dialog open so the user can retry. Cancelling does not extract files.

## Render environment change required

For an existing Render service, update this variable manually because the Render dashboard value overrides the repository default:

```text
ZIP_MAX_FILES=20000
```

Keep the existing values:

```text
UPLOAD_MAX_SIZE=524288000
ZIP_MAX_UNCOMPRESSED_SIZE=2147483648
```

The new `pyzipper==0.4.0` package is in `backend/requirements.txt`; Render installs it during the next build using the existing build command:

```text
pip install -r requirements.txt
```

Commit and push the entire corrected project, then wait for Render's new build and deploy to complete before testing extraction.

## Test after deployment

1. Confirm Render build logs show `pyzipper-0.4.0` installed.
2. Confirm Render has `ZIP_MAX_FILES=20000`.
3. Upload a password-protected ZIP.
4. Select **Extract**.
5. Enter the ZIP password in the masked dialog.
6. Verify files and nested folders appear under the folder named after the ZIP.
7. Try a wrong password once; EDMS should show an inline error and allow a retry.
8. Test an ordinary unencrypted ZIP to confirm it extracts without showing the password dialog.

## Supabase Storage size requirement

Supabase Free has a 50 MB per-file cap. The sample archive is about 70 MB, so it cannot be uploaded to the current Free project while that cap remains in place. Upgrade the Supabase plan and raise both the global and `edms-files` bucket size limits to at least the archive size (or 500 MiB to match the application setting).
