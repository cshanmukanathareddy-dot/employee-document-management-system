import {
  Check,
  Clock3,
  HardDrive,
  X,
} from "lucide-react";

import { useEffect, useState } from "react";

import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import api from "../services/api";


export default function StorageRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        "/admin/storage-requests"
      );

      setRequests(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (error) {
      setError(
        error.response?.data?.detail ||
          "Unable to load storage requests."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const decide = async (request, decision) => {
    const label =
      decision === "approve"
        ? `approve ${request.requested_gb} GB for ${request.employee_name}`
        : `decline the storage request from ${request.employee_name}`;

    if (!window.confirm(`Are you sure you want to ${label}?`)) {
      return;
    }

    try {
      setProcessingId(request.id);
      setError("");
      setSuccess("");

      const response = await api.put(
        `/admin/storage-requests/${request.id}`,
        {
          decision,
        }
      );

      setSuccess(response.data.message);
      await loadRequests();
    } catch (error) {
      setError(
        error.response?.data?.detail ||
          "Unable to process storage request."
      );
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900">
      <Sidebar />

      <main className="ml-0 min-h-screen lg:ml-64">
        <Navbar title="Storage Requests" />

        <div className="px-6 py-7 lg:px-8">
          <div className="mx-auto max-w-[1500px]">
            <section className="mb-6 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
              <div className="relative px-7 py-7">
                <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-indigo-100/60 blur-3xl" />

                <div className="relative">
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
                    <Clock3 size={14} />
                    Pending storage approvals
                  </div>

                  <h1 className="mt-4 text-[28px] font-bold tracking-[-0.035em] text-slate-950">
                    Storage requests
                  </h1>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    Review employee requests for additional document
                    storage and approve or decline them.
                  </p>
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

            <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
              {loading ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  Loading storage requests...
                </div>
              ) : requests.length === 0 ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <HardDrive size={25} />
                  </div>

                  <h2 className="mt-4 text-sm font-bold text-slate-800">
                    No pending storage requests
                  </h2>

                  <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
                    Employee requests for additional storage will
                    appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {requests.map((request) => (
                    <div
                      key={request.id}
                      className="p-6"
                    >
                      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900">
                              {request.employee_name}
                            </h3>

                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-amber-700">
                              Pending
                            </span>
                          </div>

                          <div className="mt-2 grid gap-x-7 gap-y-1.5 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
                            <span>
                              Employee ID:{" "}
                              <strong className="text-slate-700">
                                {request.employee_code}
                              </strong>
                            </span>

                            <span>
                              Department:{" "}
                              <strong className="text-slate-700">
                                {request.department}
                              </strong>
                            </span>

                            <span>
                              Current:{" "}
                              <strong className="text-slate-700">
                                {request.current_storage_gb} GB
                              </strong>
                            </span>

                            <span>
                              Requested:{" "}
                              <strong className="text-indigo-700">
                                +{request.requested_gb} GB
                              </strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={
                              processingId === request.id
                            }
                            onClick={() =>
                              decide(
                                request,
                                "approve"
                              )
                            }
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Check size={15} />
                            Approve
                          </button>

                          <button
                            type="button"
                            disabled={
                              processingId === request.id
                            }
                            onClick={() =>
                              decide(
                                request,
                                "decline"
                              )
                            }
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <X size={15} />
                            Decline
                          </button>
                        </div>
                      </div>
                    </div>
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
