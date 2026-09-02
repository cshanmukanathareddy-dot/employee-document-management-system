import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  FolderOpen,
  HardDrive,
  ShieldCheck,
  Sparkles,
  Upload,
  User,
} from "lucide-react";

import { useEffect, useState } from "react";

import { Link } from "react-router-dom";

import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

import { useAuth } from "../context/AuthContext";
import api from "../services/api";

export default function Dashboard() {
  const { user } = useAuth();

  const firstName =
    user?.full_name?.split(" ")[0] || "there";

  const accountStatus =
    user?.status
      ? user.status.charAt(0).toUpperCase() +
        user.status.slice(1)
      : "Active";

  const isReadOnlyEmployee =
    user?.role === "readonlyemployee";

  const [storage, setStorage] = useState(null);
  const [storageRequest, setStorageRequest] = useState("");
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageSubmitting, setStorageSubmitting] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const [storageError, setStorageError] = useState("");

  const loadStorage = async () => {
    if (isReadOnlyEmployee) {
      setStorage(null);
      return;
    }

    try {
      setStorageLoading(true);
      const response = await api.get("/storage/me");
      setStorage(response.data);
    } catch (error) {
      setStorageError(
        error.response?.data?.detail ||
          "Unable to load storage information."
      );
    } finally {
      setStorageLoading(false);
    }
  };

  useEffect(() => {
    loadStorage();
  }, [isReadOnlyEmployee]);

  const submitStorageRequest = async () => {
    const amount = Number(storageRequest);

    if (!Number.isFinite(amount) || amount <= 0) {
      setStorageError("Enter a valid storage amount greater than 0 GB.");
      return;
    }

    try {
      setStorageSubmitting(true);
      setStorageMessage("");
      setStorageError("");

      const response = await api.post("/storage/request", {
        additional_gb: amount,
      });

      setStorageMessage(response.data.message);
      setStorageRequest("");
      await loadStorage();
    } catch (error) {
      setStorageError(
        error.response?.data?.detail ||
          "Unable to submit storage request."
      );
    } finally {
      setStorageSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900">
      <Sidebar />

      <main className="ml-0 min-h-screen lg:ml-64">
        <Navbar title="Dashboard" />

        <div className="px-6 py-7 lg:px-8">
          <div className="mx-auto max-w-[1500px]">
            {/* ==================================================
                HERO
                ================================================== */}

            <section className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-slate-950 via-slate-950 to-indigo-950 shadow-[0_18px_45px_rgba(15,23,42,0.14)]">
              <div className="absolute -right-20 -top-32 h-80 w-80 rounded-full bg-indigo-500/25 blur-3xl" />

              <div className="absolute -bottom-36 right-56 h-72 w-72 rounded-full bg-violet-500/15 blur-3xl" />

              <div className="absolute left-1/2 top-0 h-full w-px bg-white/[0.03]" />

              <div className="relative z-10 flex flex-col gap-8 px-7 py-8 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-9 lg:py-9">
                <div className="max-w-2xl">
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] !text-indigo-100">
                    <Sparkles size={12} />
                    {isReadOnlyEmployee
                      ? "Read-only workspace"
                      : "Employee workspace"}
                  </div>

                  <h1 className="text-[30px] font-bold tracking-[-0.04em] !text-white sm:text-[36px]">
                    Hello, {firstName}.
                  </h1>

                  <p className="mt-3 max-w-xl text-sm leading-6 !text-slate-200 sm:text-[15px]">
                    {isReadOnlyEmployee
                      ? "View and download administrator-shared documents from your secure read-only workspace."
                      : "Keep your official employee documents organized, accessible, and up to date from one secure workspace."}
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      to="/documents"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-slate-900 shadow-lg transition hover:bg-slate-100"
                    >
                      <FileText size={16} />
                      View documents
                      <ArrowRight size={15} />
                    </Link>

                    <Link
                      to="/profile"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.08] px-4 text-sm font-semibold !text-white shadow-sm transition hover:border-white/30 hover:bg-white/[0.14]"
                    >
                      <User size={16} />
                      My profile
                    </Link>
                  </div>
                </div>

                <div className="relative shrink-0">
                  <div className="flex h-32 w-32 items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur sm:h-36 sm:w-36">
                    <div className="flex h-20 w-20 items-center justify-center rounded-[22px] bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-400/20">
                      <ShieldCheck
                        size={42}
                        strokeWidth={1.7}
                      />
                    </div>
                  </div>

                  <div className="absolute -bottom-3 -left-5 flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-xl">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <CheckCircle2 size={15} />
                    </div>

                    <div>
                      <p className="text-[10px] font-bold text-slate-800">
                        Account secure
                      </p>

                      <p className="text-[9px] text-slate-400">
                        Workspace protected
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ==================================================
                OVERVIEW
                ================================================== */}

            <section className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Overview
                  </p>

                  <h2 className="mt-1 text-base font-bold tracking-[-0.02em] text-slate-900">
                    Your workspace
                  </h2>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <OverviewCard
                  icon={<FileText size={19} />}
                  iconStyle="bg-indigo-50 text-indigo-600"
                  title="My Documents"
                  value="Manage"
                  description="View and manage your official documents"
                  href="/documents"
                />

                <OverviewCard
                  icon={<FolderOpen size={19} />}
                  iconStyle="bg-violet-50 text-violet-600"
                  title="Directory"
                  value={
                    user?.directory_name || "Not assigned"
                  }
                  description="Your assigned employee directory"
                  href="/documents"
                />

                <OverviewCard
                  icon={<CheckCircle2 size={19} />}
                  iconStyle="bg-emerald-50 text-emerald-600"
                  title="Account Status"
                  value={accountStatus}
                  description="Current employee account status"
                  href="/profile"
                  status
                />
              </div>
            </section>

            {!isReadOnlyEmployee && (
              <section className="mt-6 overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-5 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <HardDrive size={19} />
                    </div>

                    <div>
                      <h2 className="text-base font-bold tracking-[-0.015em] text-slate-950">
                        Document storage
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Your employee document storage allocation and usage.
                      </p>
                    </div>
                  </div>

                  {storageLoading ? (
                    <div className="text-sm text-slate-400">
                      Loading storage...
                    </div>
                  ) : storage ? (
                    <div className="w-full max-w-xl">
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-600">
                          {storage.storage_used_gb} GB used
                        </span>
                        <span className="font-bold text-slate-800">
                          {storage.storage_limit_gb} GB allocated
                        </span>
                      </div>

                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-indigo-600 transition-all"
                          style={{
                            width: `${Math.min(
                              storage.storage_limit_bytes > 0
                                ? (storage.storage_used_bytes /
                                    storage.storage_limit_bytes) *
                                    100
                                : 0,
                              100
                            )}%`,
                          }}
                        />
                      </div>

                      <p className="mt-2 text-xs text-slate-400">
                        {storage.storage_remaining_gb} GB remaining
                      </p>
                    </div>
                  ) : null}
                </div>

                {storageMessage && (
                  <div className="border-t border-emerald-100 bg-emerald-50 px-6 py-3 text-sm text-emerald-700">
                    {storageMessage}
                  </div>
                )}

                {storageError && (
                  <div className="border-t border-red-100 bg-red-50 px-6 py-3 text-sm text-red-700">
                    <span className="inline-flex items-center gap-2">
                      <AlertCircle size={15} />
                      {storageError}
                    </span>
                  </div>
                )}

                <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-5">
                  {storage?.pending_request ? (
                    <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-semibold">
                        Pending request: {storage.pending_request.additional_gb} GB additional storage
                      </span>
                      <span className="text-xs text-amber-600">
                        Waiting for administrator approval
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                      <div className="flex-1">
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.08em] text-slate-400">
                          Request additional storage
                        </label>

                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={storageRequest}
                          onChange={(event) =>
                            setStorageRequest(event.target.value)
                          }
                          placeholder="e.g. 1"
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={submitStorageRequest}
                        disabled={storageSubmitting}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <HardDrive size={16} />
                        {storageSubmitting
                          ? "Submitting..."
                          : "Request Storage"}
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ==================================================
                MAIN GRID
                ================================================== */}

            <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              {/* QUICK ACTIONS */}

              <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                  <div>
                    <h2 className="text-base font-bold tracking-[-0.015em] text-slate-950">
                      Quick actions
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                      Frequently used workspace actions
                    </p>
                  </div>

                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                    <Sparkles size={16} />
                  </div>
                </div>

                <div className="grid gap-3 p-5 sm:grid-cols-2">
                  {!isReadOnlyEmployee && (
                    <ActionCard
                      href="/documents"
                      icon={<Upload size={19} />}
                      iconStyle="bg-indigo-50 text-indigo-600"
                      title="Upload document"
                      description="Add a new official employee document"
                    />
                  )}

                  <ActionCard
                    href="/documents"
                    icon={<FileText size={19} />}
                    iconStyle="bg-violet-50 text-violet-600"
                    title="View documents"
                    description="Browse your complete document library"
                  />

                  <ActionCard
                    href="/profile"
                    icon={<User size={19} />}
                    iconStyle="bg-slate-100 text-slate-600"
                    title="View profile"
                    description="Review your employee information"
                  />

                  <ActionCard
                    href="/profile"
                    icon={<BriefcaseBusiness size={19} />}
                    iconStyle="bg-emerald-50 text-emerald-600"
                    title="Employee details"
                    description="Check your role and department details"
                  />
                </div>
              </section>

              {/* ACCOUNT INFORMATION */}

              <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                      <User size={17} />
                    </div>

                    <div>
                      <h2 className="text-base font-bold tracking-[-0.015em] text-slate-950">
                        Account information
                      </h2>

                      <p className="mt-1 text-xs text-slate-500">
                        Your current employee details
                      </p>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 px-6">
                  <Info
                    label="Employee ID"
                    value={user?.employee_id}
                  />

                  <Info
                    label="Department"
                    value={user?.department}
                  />

                  <Info
                    label="Designation"
                    value={user?.designation}
                  />

                  <Info
                    label="Directory"
                    value={user?.directory_name}
                  />

                  <Info
                    label="Account status"
                    value={accountStatus}
                    status={user?.status}
                  />
                </div>

                <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4">
                  <Link
                    to="/profile"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 transition hover:text-indigo-700"
                  >
                    View complete profile
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </section>
            </div>

            {/* ==================================================
                SECURITY FOOTER
                ================================================== */}

            <section className="mt-5 flex flex-col gap-4 rounded-[20px] border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <ShieldCheck size={17} />
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-700">
                    Secure employee workspace
                  </p>

                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Keep your information accurate and your
                    documents up to date.
                  </p>
                </div>
              </div>

              <Link
                to="/profile"
                className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-slate-500 transition hover:text-indigo-600"
              >
                Account settings
                <ArrowRight size={13} />
              </Link>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

/* =========================================================
   OVERVIEW CARD
   ========================================================= */

function OverviewCard({
  icon,
  iconStyle,
  title,
  value,
  description,
  href,
  status = false,
}) {
  return (
    <Link
      to={href}
      className="group relative overflow-hidden rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconStyle}`}
        >
          {icon}
        </div>

        <div className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition group-hover:bg-slate-50 group-hover:text-slate-500">
          <ArrowRight size={14} />
        </div>
      </div>

      <div className="mt-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
          {title}
        </p>

        <div className="mt-1.5 flex items-center gap-2">
          {status && (
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          )}

          <p className="max-w-full truncate text-lg font-bold tracking-[-0.025em] text-slate-900">
            {value || "—"}
          </p>
        </div>

        <p className="mt-1.5 truncate text-xs text-slate-500">
          {description}
        </p>
      </div>
    </Link>
  );
}

/* =========================================================
   ACTION CARD
   ========================================================= */

function ActionCard({
  href,
  icon,
  iconStyle,
  title,
  description,
}) {
  return (
    <Link
      to={href}
      className="group flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-3.5 transition duration-200 hover:border-indigo-200 hover:bg-indigo-50/40 hover:shadow-sm"
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconStyle}`}
      >
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-800 transition group-hover:text-indigo-700">
          {title}
        </p>

        <p className="mt-0.5 truncate text-[11px] text-slate-400">
          {description}
        </p>
      </div>

      <ArrowRight
        size={15}
        className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500"
      />
    </Link>
  );
}

/* =========================================================
   INFO
   ========================================================= */

function Info({
  label,
  value,
  status,
}) {
  const displayValue = value || "—";

  return (
    <div className="flex min-h-[58px] items-center justify-between gap-5">
      <span className="shrink-0 text-xs font-medium text-slate-400">
        {label}
      </span>

      <div className="flex min-w-0 items-center justify-end gap-2">
        {status && (
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              status === "active"
                ? "bg-emerald-500"
                : status === "inactive"
                  ? "bg-amber-500"
                  : status === "terminated"
                    ? "bg-red-500"
                    : "bg-slate-400"
            }`}
          />
        )}

        <span
          title={displayValue}
          className="max-w-[220px] truncate text-right text-xs font-bold text-slate-700"
        >
          {displayValue}
        </span>
      </div>
    </div>
  );
}