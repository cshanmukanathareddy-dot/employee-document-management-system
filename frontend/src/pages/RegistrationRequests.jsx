import {
  Check,
  Clock3,
  Mail,
  RefreshCw,
  User,
  UserCheck,
  UserRoundCheck,
  UserX,
  X,
} from "lucide-react";

import { useEffect, useState } from "react";

import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import api from "../services/api";

export default function RegistrationRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadRequests = async (refresh = false) => {
    try {
      setError("");
      if (refresh) setRefreshing(true);
      else setLoading(true);

      const response = await api.get("/admin/registration-requests");
      setRequests(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load registration requests."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const processRequest = async (request, decision) => {
    const labels = {
      employee: "approve this user as an Employee",
      readonlyemployee: "approve this user as a Read Only Employee",
      reject: "reject this registration request",
    };

    if (!window.confirm(`Are you sure you want to ${labels[decision]}?`)) {
      return;
    }

    try {
      setProcessingId(request.id);
      setError("");
      setSuccess("");

      const response = await api.put(
        `/admin/registration-requests/${request.id}`,
        { decision }
      );

      setSuccess(response.data.message || "Request processed successfully.");
      await loadRequests(true);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to process registration request."
      );
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900">
      <Sidebar />

      <main className="ml-0 min-h-screen lg:ml-64">
        <Navbar title="Registration Requests" />

        <div className="px-6 py-7 lg:px-8">
          <div className="mx-auto max-w-[1500px]">
            <section className="mb-6 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
              <div className="relative px-7 py-7">
                <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-indigo-100/60 blur-3xl" />

                <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
                      <Clock3 size={14} />
                      Pending approval
                    </div>

                    <h1 className="mt-4 text-[28px] font-bold tracking-[-0.035em] text-slate-950">
                      Registration requests
                    </h1>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                      Review new account requests and decide whether each user
                      receives Employee, Read Only Employee, or no portal access.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => loadRequests(true)}
                    disabled={refreshing}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RefreshCw
                      size={15}
                      className={refreshing ? "animate-spin" : ""}
                    />
                    Refresh
                  </button>
                </div>
              </div>
            </section>

            {error && (
              <div className="mb-5 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <X size={17} />
                {error}
              </div>
            )}

            {success && (
              <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <Check size={17} />
                {success}
              </div>
            )}

            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              <Stat
                icon={<Clock3 size={18} />}
                label="Pending requests"
                value={requests.length}
                style="bg-amber-50 text-amber-600"
              />

              <Stat
                icon={<UserCheck size={18} />}
                label="Approval options"
                value="2"
                style="bg-indigo-50 text-indigo-600"
              />

              <Stat
                icon={<UserX size={18} />}
                label="Decision"
                value="Required"
                style="bg-rose-50 text-rose-600"
              />
            </div>

            <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
              {loading ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  Loading registration requests...
                </div>
              ) : requests.length === 0 ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <UserRoundCheck size={25} />
                  </div>
                  <h2 className="mt-4 text-sm font-bold text-slate-800">
                    No pending requests
                  </h2>
                  <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
                    New registrations will appear here until an administrator
                    makes an access decision.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {requests.map((request) => (
                    <RequestRow
                      key={request.id}
                      request={request}
                      processing={processingId === request.id}
                      onDecision={processRequest}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function RequestRow({ request, processing, onDecision }) {
  const name = request.full_name || "Unnamed user";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-700">
            {initials || <User size={20} />}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                {name}
              </h3>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-amber-700">
                Pending
              </span>
            </div>

            <div className="mt-2 grid gap-x-6 gap-y-1.5 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-3">
              <span>
                Employee ID: {" "}
                <strong className="text-slate-700">
                  {request.employee_id || "—"}
                </strong>
              </span>

              <span className="inline-flex items-center gap-1.5">
                <Mail size={12} />
                {request.email || "—"}
              </span>

              <span>
                Department: {" "}
                <strong className="text-slate-700">
                  {request.department || "—"}
                </strong>
              </span>

              <span>
                Designation: {" "}
                <strong className="text-slate-700">
                  {request.designation || "—"}
                </strong>
              </span>

              <span>
                Directory: {" "}
                <strong className="text-slate-700">
                  {request.directory_name || "—"}
                </strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          <DecisionButton
            disabled={processing}
            onClick={() => onDecision(request, "employee")}
            icon={<UserCheck size={15} />}
            className="bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Employee
          </DecisionButton>

          <DecisionButton
            disabled={processing}
            onClick={() => onDecision(request, "readonlyemployee")}
            icon={<UserRoundCheck size={15} />}
            className="border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
          >
            Read Only
          </DecisionButton>

          <DecisionButton
            disabled={processing}
            onClick={() => onDecision(request, "reject")}
            icon={<UserX size={15} />}
            className="border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
          >
            Reject
          </DecisionButton>
        </div>
      </div>
    </div>
  );
}

function DecisionButton({
  disabled,
  onClick,
  icon,
  className,
  children,
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

function Stat({ icon, label, value, style }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${style}`}>
          {icon}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
            {label}
          </p>
          <p className="mt-1 text-xl font-bold text-slate-950">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}
