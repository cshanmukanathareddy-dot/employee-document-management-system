import { useCallback, useRef, useState } from "react";
import { Loader2, Lock, X } from "lucide-react";
import api from "../services/api";

function getDetail(error) {
  return String(error?.response?.data?.detail || error?.message || "");
}

function isPasswordError(error) {
  return /password-protected|password is incorrect|encrypted file is damaged/i.test(
    getDetail(error)
  );
}

function makeCancelledError() {
  const error = new Error("ZIP extraction cancelled.");
  error.code = "ZIP_PASSWORD_CANCELLED";
  return error;
}

/**
 * Extract a ZIP normally first. Password-protected archives open a masked
 * in-app password dialog only after the backend confirms a password is needed.
 * The password is sent only in the extraction request and is never persisted.
 */
export function useZipExtraction() {
  const [dialog, setDialog] = useState(null);
  const pendingRequest = useRef(null);

  const extractZip = useCallback(async (endpoint) => {
    try {
      return await api.post(endpoint);
    } catch (error) {
      if (!isPasswordError(error)) throw error;

      return new Promise((resolve, reject) => {
        pendingRequest.current = { resolve, reject };
        setDialog({
          endpoint,
          password: "",
          error: "",
          submitting: false,
        });
      });
    }
  }, []);

  const cancelDialog = () => {
    const pending = pendingRequest.current;
    pendingRequest.current = null;
    setDialog(null);
    pending?.reject(makeCancelledError());
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    if (!dialog || dialog.submitting) return;

    const password = dialog.password;
    if (!password.length) {
      setDialog((current) => ({
        ...current,
        error: "Enter the ZIP password to continue.",
      }));
      return;
    }

    setDialog((current) => ({ ...current, submitting: true, error: "" }));

    try {
      const response = await api.post(dialog.endpoint, { password });
      const pending = pendingRequest.current;
      pendingRequest.current = null;
      setDialog(null);
      pending?.resolve(response);
    } catch (error) {
      if (isPasswordError(error)) {
        setDialog((current) => ({
          ...current,
          submitting: false,
          error: "The password was not accepted, or the encrypted archive is damaged. Check the password and try again.",
        }));
        return;
      }

      const pending = pendingRequest.current;
      pendingRequest.current = null;
      setDialog(null);
      pending?.reject(error);
    }
  };

  const passwordDialog = dialog ? (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="zip-password-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Lock size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="zip-password-title" className="text-base font-bold text-slate-900">
              Password-protected ZIP
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Enter the archive password to extract its files. The password is used only for this extraction and is not saved.
            </p>
          </div>
          <button
            type="button"
            onClick={cancelDialog}
            disabled={dialog.submitting}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
            aria-label="Close password dialog"
          >
            <X size={17} />
          </button>
        </div>

        <form onSubmit={submitPassword} className="space-y-4 px-5 py-5">
          <div>
            <label htmlFor="zip-extraction-password" className="mb-1.5 block text-xs font-semibold text-slate-700">
              ZIP password
            </label>
            <input
              id="zip-extraction-password"
              type="password"
              maxLength={512}
              autoComplete="off"
              autoFocus
              value={dialog.password}
              onChange={(event) =>
                setDialog((current) => ({
                  ...current,
                  password: event.target.value,
                  error: "",
                }))
              }
              disabled={dialog.submitting}
              placeholder="Enter password"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:bg-slate-50"
            />
            {dialog.error && (
              <p className="mt-2 text-xs font-medium text-rose-600" role="alert">
                {dialog.error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={cancelDialog}
              disabled={dialog.submitting}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={dialog.submitting || !dialog.password.length}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {dialog.submitting && <Loader2 size={14} className="animate-spin" />}
              {dialog.submitting ? "Checking…" : "Extract ZIP"}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  return { extractZip, passwordDialog };
}
