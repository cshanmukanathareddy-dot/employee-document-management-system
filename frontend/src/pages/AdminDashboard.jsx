import {
  Activity,
  ArrowUpRight,
  BriefcaseBusiness,
  Clock3,
  Download,
  Eye,
  FolderOpen,
  Loader2,
  FileText,
  FileX2,
  FileSpreadsheet,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserRound,
  UserX,
  Users,
  X,
} from "lucide-react";

import { useEffect, useMemo, useState } from "react";

import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import api from "../services/api";

export default function AdminDashboard() {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeDocuments, setEmployeeDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [extractingDocumentId, setExtractingDocumentId] = useState(null);

  const loadEmployees = async (showRefresh = false) => {
    try {
      setError("");

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await api.get("/admin/employees");
      setEmployees(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setError(
        error.response?.data?.detail ||
          "Unable to load employees. Please try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const response = await api.get("/admin/employees");

        if (mounted) {
          setEmployees(Array.isArray(response.data) ? response.data : []);
        }
      } catch (error) {
        if (mounted) {
          setError(
            error.response?.data?.detail ||
              "Unable to load employees. Please try again."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

  return () => {
      mounted = false;
    };
  }, []);

  const extractEmployeeDocument = async (document) => {
    if (!document?.is_archive || extractingDocumentId === document.id) return;

    try {
      setError("");
      setExtractingDocumentId(document.id);
      await api.post(`/documents/${document.id}/extract`);
      await viewDocuments(selectedEmployee);
    } catch (error) {
      console.error("Admin employee ZIP extraction error:", error);
      setError(
        error.response?.data?.detail ||
          "Unable to extract employee ZIP file."
      );
    } finally {
      setExtractingDocumentId(null);
    }
  };

  const exportEmployees = async () => {
    try {
      setExporting(true);
      setError("");

      const response = await api.get(
        "/admin/employees/export",
        {
          responseType: "blob",
        }
      );

      const blob = new Blob(
        [response.data],
        {
          type:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
      );

      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement("a");

      link.href = url;
      link.download = "employees.xlsx";

      window.document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      setError(
        error.response?.data?.detail ||
          "Unable to export employee information."
      );
    } finally {
      setExporting(false);
    }
  };

  const changeStatus = async (id, status) => {
    try {
      setError("");

      await api.put(`/admin/employees/${id}/status?status=${status}`);

      await loadEmployees(true);
    } catch (error) {
      setError(
        error.response?.data?.detail ||
          "Unable to update employee status."
      );
    }
  };

  const viewDocuments = async (employee) => {
    try {
      setError("");
      setSelectedEmployee(employee);
      setEmployeeDocuments([]);
      setDocumentsLoading(true);

      const response = await api.get(
        `/admin/employees/${employee.id}/documents`
      );

      setEmployeeDocuments(
        Array.isArray(response.data) ? response.data : []
      );
    } catch (error) {
      setError(
        error.response?.data?.detail ||
          "Unable to load employee documents."
      );
      setSelectedEmployee(null);
    } finally {
      setDocumentsLoading(false);
    }
  };

  const viewFile = (document) => {
    if (document?.is_archive) {
      setError(
        "ZIP archives cannot be previewed directly. Extract the ZIP first to view its files."
      );
      return;
    }

    const previewableTypes = [
      "application/pdf",
      "text/plain",
      "text/html",
      "text/css",
      "text/csv",
      "application/json",
      "image/",
      "audio/",
      "video/",
    ];

    const fileType = String(document?.file_type || "").toLowerCase();
    const canPreview = previewableTypes.some((type) =>
      type.endsWith("/")
        ? fileType.startsWith(type)
        : fileType === type
    );

    if (!canPreview) {
      setError(
        "This file type cannot be previewed directly in the browser. Use Download to open the original file."
      );
      return;
    }

    if (!document?.share_token) {
      setError(
        "This document does not have a share link yet. Refresh and try again."
      );
      return;
    }

    const publicUrl =
      `${window.location.origin}/share/document/${encodeURIComponent(document.share_token)}`;

    const previewWindow = window.open(
      publicUrl,
      "_blank",
      "noopener,noreferrer"
    );

    if (!previewWindow) {
      setError(
        "Please allow pop-ups in your browser to view documents."
      );
    }
  };

  const downloadDocument = async (document) => {
    try {
      setError("");

      const response = await api.get(
        `/documents/${document.id}/download`,
        {
          responseType: "blob",
        }
      );

      const blob = new Blob([response.data], {
        type:
          response.headers["content-type"] ||
          document.file_type ||
          "application/octet-stream",
      });

      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement("a");

      link.href = url;
      link.download = document.document_name || "document";

      window.document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      console.error("Download document error:", error);

      setError(
        error.response?.data?.detail ||
          "Unable to download document."
      );
    }
  };

  const closeDocuments = () => {
    setSelectedEmployee(null);
    setEmployeeDocuments([]);
  };

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return employees;
    }

    return employees.filter((employee) => {
      const name = String(employee.full_name || "").toLowerCase();
      const employeeId = String(
        employee.employee_id || ""
      ).toLowerCase();
      const email = String(employee.email || "").toLowerCase();
      const department = String(
        employee.department || ""
      ).toLowerCase();
      const designation = String(
        employee.designation || ""
      ).toLowerCase();

      return (
        name.includes(query) ||
        employeeId.includes(query) ||
        email.includes(query) ||
        department.includes(query) ||
        designation.includes(query)
      );
    });
  }, [employees, search]);

  const statistics = useMemo(() => {
    const active = employees.filter(
      (employee) => employee.status === "active"
    ).length;

    const inactive = employees.filter(
      (employee) => employee.status === "inactive"
    ).length;

    const terminated = employees.filter(
      (employee) => employee.status === "terminated"
    ).length;

    return {
      total: employees.length,
      active,
      inactive,
      terminated,
    };
  }, [employees]);

  const activePercentage =
    statistics.total > 0
      ? Math.round(
          (statistics.active / statistics.total) * 100
        )
      : 0;

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900">
      <Sidebar />

      <main className="ml-0 min-h-screen lg:ml-64">
        <Navbar title="Admin Dashboard" />

        <div className="px-6 py-7 lg:px-8">
          <div className="mx-auto max-w-[1600px]">
            {/* ==================================================
                ERROR
                ================================================== */}

            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700 shadow-sm">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-100">
                  <FileX2 size={15} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    Something went wrong
                  </p>
                  <p className="mt-0.5 text-red-600">
                    {error}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setError("")}
                  className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-100 hover:text-red-700"
                  aria-label="Dismiss error"
                >
                  <X size={17} />
                </button>
              </div>
            )}

            {/* ==================================================
                HERO
                ================================================== */}

            <section className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
              <div className="absolute -right-24 -top-32 h-72 w-72 rounded-full bg-indigo-100/70 blur-3xl" />
              <div className="absolute -bottom-32 right-48 h-56 w-56 rounded-full bg-blue-100/50 blur-3xl" />

              <div className="relative flex flex-col gap-6 px-7 py-7 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-8">
                <div className="max-w-2xl">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                    <ShieldCheck size={14} />
                    Workspace administration
                  </div>

                  <h1 className="text-[28px] font-bold tracking-[-0.035em] text-slate-950 sm:text-[32px]">
                    Good to see you, Admin.
                  </h1>

                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 sm:text-[15px]">
                    Manage your workforce, monitor employee
                    activity, and keep organizational documents
                    moving through the right workflow.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => loadEmployees(true)}
                    disabled={refreshing}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw
                      size={16}
                      className={
                        refreshing
                          ? "animate-spin"
                          : ""
                      }
                    />
                    Refresh
                  </button>

                  <button
                    type="button"
                    onClick={exportEmployees}
                    disabled={exporting}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FileSpreadsheet size={16} />
                    {exporting ? "Exporting..." : "Export Excel"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById("employee-directory")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        })
                    }
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(79,70,229,0.22)] transition hover:bg-indigo-700"
                  >
                    Manage employees
                    <ArrowUpRight size={16} />
                  </button>
                </div>
              </div>
            </section>

            {/* ==================================================
                KPI GRID
                ================================================== */}

            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <AdminStat
                icon={<Users size={19} />}
                label="Total employees"
                value={statistics.total}
                description="Registered workforce"
                accent="indigo"
              />

              <AdminStat
                icon={<UserCheck size={19} />}
                label="Active employees"
                value={statistics.active}
                description={`${activePercentage}% of workforce`}
                accent="emerald"
                progress={activePercentage}
              />

              <AdminStat
                icon={<Clock3 size={19} />}
                label="Inactive"
                value={statistics.inactive}
                description="Currently unavailable"
                accent="amber"
              />

              <AdminStat
                icon={<UserX size={19} />}
                label="Terminated"
                value={statistics.terminated}
                description="No longer active"
                accent="rose"
              />
            </section>

            {/* ==================================================
                WORKSPACE CONTENT
                ================================================== */}

            <section
              id="employee-directory"
              className="mt-6 scroll-mt-6 overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm"
            >
              {/* Header */}

              <div className="border-b border-slate-100 px-6 py-5 lg:px-7">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <BriefcaseBusiness size={19} />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold tracking-[-0.015em] text-slate-950">
                          Employee directory
                        </h2>

                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          {filteredEmployees.length}{" "}
                          shown
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        Manage employee access and review
                        their organizational documents.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative min-w-0 sm:w-[320px]">
                      <Search
                        size={17}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        type="text"
                        value={search}
                        onChange={(event) =>
                          setSearch(event.target.value)
                        }
                        placeholder="Search name, ID, department..."
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-9 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                      />

                      {search && (
                        <button
                          type="button"
                          onClick={() => setSearch("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                          aria-label="Clear search"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    <div className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-semibold text-slate-600">
                      <Users size={15} />
                      {employees.length} total
                    </div>
                  </div>
                </div>
              </div>

              {/* Table */}

              {loading ? (
                <EmployeeTableSkeleton />
              ) : filteredEmployees.length === 0 ? (
                <EmptyEmployees
                  hasSearch={Boolean(search)}
                  onClear={() => setSearch("")}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px]">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-left">
                        <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                          Employee
                        </th>

                        <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                          Department
                        </th>

                        <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                          Directory
                        </th>

                        <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                          Status
                        </th>

                        <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredEmployees.map(
                        (employee) => (
                          <EmployeeRow
                            key={employee.id}
                            employee={employee}
                            onChangeStatus={changeStatus}
                            onViewDocuments={
                              viewDocuments
                            }
                          />
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {!loading &&
                filteredEmployees.length > 0 && (
                  <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/40 px-6 py-3.5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      Showing{" "}
                      <strong className="font-semibold text-slate-700">
                        {filteredEmployees.length}
                      </strong>{" "}
                      of{" "}
                      <strong className="font-semibold text-slate-700">
                        {employees.length}
                      </strong>{" "}
                      employees
                    </span>

                    <span className="inline-flex items-center gap-1.5">
                      <Activity size={13} />
                      Directory is up to date
                    </span>
                  </div>
                )}
            </section>
          </div>
        </div>
      </main>

      {/* ==================================================
          EMPLOYEE DOCUMENT MODAL
          ================================================== */}

      {selectedEmployee && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[3px] sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDocuments();
            }
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-[24px] border border-white/50 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.22)]">
            {/* Modal header */}

            <div className="border-b border-slate-100 px-6 py-5 sm:px-7">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-700">
                    {String(
                      selectedEmployee.full_name ||
                        "Employee"
                    )
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-bold tracking-[-0.02em] text-slate-950">
                        Employee documents
                      </h2>

                      <StatusBadge
                        status={
                          selectedEmployee.status
                        }
                      />
                    </div>

                    <p className="mt-1 truncate text-sm text-slate-500">
                      {selectedEmployee.full_name ||
                        "Employee"}{" "}
                      ·{" "}
                      {selectedEmployee.employee_id ||
                        "—"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeDocuments}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close documents"
                >
                  <X size={19} />
                </button>
              </div>

              {!documentsLoading &&
                employeeDocuments.length > 0 && (
                   <div className="mt-5 grid grid-cols-1 gap-3 sm:max-w-[220px]">
                     <MiniDocumentStat
                       icon={<FileText size={15} />}
                       label="Total documents"
                       value={employeeDocuments.length}
                     />
                   </div>
                 )}
            </div>

            {/* Modal content */}

            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
              {documentsLoading ? (
                <DocumentTableSkeleton />
              ) : employeeDocuments.length === 0 ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
                    <FileText size={25} />
                  </div>

                  <p className="mt-4 text-sm font-semibold text-slate-800">
                    No documents found
                  </p>

                  <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
                    This employee has not uploaded any
                    documents yet.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1150px]">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                          <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                            Document
                          </th>

                          <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                            Category
                          </th>

                          <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                            Type
                          </th>

                          <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                            Size
                          </th>

                          <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                            Version
                          </th>

                          <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                            Uploaded
                          </th>

                          <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                            Actions
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {employeeDocuments.map(
                          (document) => (
                            <DocumentRow
                              key={document.id}
                              document={document}
                              onView={viewFile}
                              onDownload={
                                downloadDocument
                              }
                              onExtract={extractEmployeeDocument}
                              extractingId={extractingDocumentId}
                            />
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}

            <div className="flex items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:px-7">
              <p className="hidden text-xs text-slate-500 sm:block">
                View or download employee documents.
              </p>

              <button
                type="button"
                onClick={closeDocuments}
                className="ml-auto inline-flex h-9 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   ADMIN STAT
   ========================================================= */

function AdminStat({
  icon,
  label,
  value,
  description,
  accent,
  progress,
}) {
  const accentStyles = {
    indigo: {
      icon: "bg-indigo-50 text-indigo-600",
      value: "text-slate-950",
      progress: "bg-indigo-500",
    },
    emerald: {
      icon: "bg-emerald-50 text-emerald-600",
      value: "text-slate-950",
      progress: "bg-emerald-500",
    },
    amber: {
      icon: "bg-amber-50 text-amber-600",
      value: "text-slate-950",
      progress: "bg-amber-500",
    },
    rose: {
      icon: "bg-rose-50 text-rose-600",
      value: "text-slate-950",
      progress: "bg-rose-500",
    },
  };

  const styles =
    accentStyles[accent] || accentStyles.indigo;

  return (
    <div className="group rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles.icon}`}
        >
          {icon}
        </div>

        <span className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition group-hover:text-slate-500">
          <ArrowUpRight size={15} />
        </span>
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
          {label}
        </p>

        <p
          className={`mt-1 text-[28px] font-bold tracking-[-0.04em] ${styles.value}`}
        >
          {value}
        </p>

        <p className="mt-1 text-xs text-slate-500">
          {description}
        </p>
      </div>

      {typeof progress === "number" && (
        <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ${styles.progress}`}
              style={{
                width: `${Math.min(
                  100,
                  Math.max(0, progress)
                )}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   EMPLOYEE ROW
   ========================================================= */

function EmployeeRow({
  employee,
  onChangeStatus,
  onViewDocuments,
}) {
  const name =
    employee.full_name || "Unnamed employee";

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <tr className="group border-b border-slate-100 last:border-0 transition hover:bg-slate-50/70">
      <td className="px-6 py-4.5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 text-xs font-bold text-indigo-700 ring-1 ring-indigo-100">
            {initials || "U"}
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">
              {name}
            </p>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="truncate text-xs text-slate-400">
                {employee.employee_id || "No employee ID"}
              </p>
              <span
                className={
                  employee.role === "readonlyemployee"
                    ? "rounded-md bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold text-violet-700"
                    : "rounded-md bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700"
                }
              >
                {employee.role === "readonlyemployee"
                  ? "Read Only"
                  : "Employee"}
              </span>
            </div>
          </div>
        </div>
      </td>

      <td className="px-5 py-4.5">
        <div className="max-w-[220px]">
          <p className="truncate text-sm font-medium text-slate-700">
            {employee.department || "—"}
          </p>

          <p className="mt-0.5 truncate text-xs text-slate-400">
            {employee.designation || "—"}
          </p>
        </div>
      </td>

      <td className="px-5 py-4.5">
        <span className="inline-flex max-w-[180px] items-center gap-1.5 truncate rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600">
          <UserRound
            size={12}
            className="shrink-0 text-slate-400"
          />
          <span className="truncate">
            {employee.directory_name || "—"}
          </span>
        </span>
      </td>

      <td className="px-5 py-4.5">
        <StatusBadge status={employee.status} />
      </td>

      <td className="px-5 py-4.5">
        <div className="flex justify-end gap-1">
          {employee.status !== "active" && (
            <IconAction
              label="Activate employee"
              tone="emerald"
              onClick={() =>
                onChangeStatus(employee.id, "active")
              }
            >
              <UserCheck size={16} />
            </IconAction>
          )}

          {employee.status === "active" && (
            <IconAction
              label="Deactivate employee"
              tone="amber"
              onClick={() =>
                onChangeStatus(
                  employee.id,
                  "inactive"
                )
              }
            >
              <UserX size={16} />
            </IconAction>
          )}

          <IconAction
            label="View employee documents"
            tone="indigo"
            onClick={() =>
              onViewDocuments(employee)
            }
          >
            <Eye size={16} />
          </IconAction>
        </div>
      </td>
    </tr>
  );
}

/* =========================================================
   DOCUMENT ROW
   ========================================================= */

function DocumentRow({
  document,
  onView,
  onDownload,
  onExtract,
  extractingId,
}) {
  const extension = getFileExtension(
    document.document_name
  );

  return (
    <tr className="border-b border-slate-100 last:border-0 transition hover:bg-slate-50/60">
      <td className="px-5 py-4">
        <div className="flex min-w-[220px] items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <FileText size={17} />
          </div>

          <div className="min-w-0">
            <p
              className="max-w-[250px] truncate text-sm font-semibold text-slate-800"
              title={document.document_name}
            >
              {document.document_name ||
                "Untitled document"}
            </p>

            <p className="mt-0.5 text-xs text-slate-400">
              Document #{document.id}
            </p>
          </div>
        </div>
      </td>

      <td className="px-4 py-4 text-sm text-slate-600">
        {document.category || "—"}
      </td>

      <td className="px-4 py-4">
        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
          {extension}
        </span>
      </td>

      <td className="px-4 py-4 text-sm text-slate-600">
        {formatFileSize(document.file_size)}
      </td>

      <td className="px-4 py-4">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          v{document.version || 1}
        </span>
      </td>

      <td className="px-4 py-4 text-sm text-slate-500">
        {formatDate(document.uploaded_at)}
      </td>

      <td className="px-5 py-4">
        <div className="flex justify-end gap-1">
          {document.is_archive && !document.extracted && (
            <IconAction
              label="Extract ZIP into administrator directory"
              tone="amber"
              onClick={() => onExtract(document)}
            >
              {extractingId === document.id ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <FolderOpen size={15} />
              )}
            </IconAction>
          )}

          <IconAction
            label="View document"
            tone="indigo"
            onClick={() => onView(document)}
          >
            <Eye size={15} />
          </IconAction>

          <IconAction
            label="Download document"
            tone="emerald"
            onClick={() => onDownload(document)}
          >
            <Download size={15} />
          </IconAction>
         </div>
       </td>
    </tr>
  );
}

/* =========================================================
   ICON ACTION
   ========================================================= */

function IconAction({
  children,
  label,
  tone,
  onClick,
}) {
  const tones = {
    indigo:
      "text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700",
    emerald:
      "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700",
    amber:
      "text-amber-600 hover:bg-amber-50 hover:text-amber-700",
    rose:
      "text-rose-600 hover:bg-rose-50 hover:text-rose-700",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${tones[tone] || tones.indigo}`}
    >
      {children}
    </button>
  );
}

/* =========================================================
   EMPLOYEE STATUS
   ========================================================= */

function StatusBadge({ status }) {
  const normalized = String(
    status || "unknown"
  ).toLowerCase();

  const styles = {
    active:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
    inactive:
      "border-amber-200 bg-amber-50 text-amber-700",
    terminated:
      "border-red-200 bg-red-50 text-red-700",
  };

  const labels = {
    active: "Active",
    inactive: "Inactive",
    terminated: "Terminated",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
        styles[normalized] ||
        "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          normalized === "active"
            ? "bg-emerald-500"
            : normalized === "inactive"
              ? "bg-amber-500"
              : normalized === "terminated"
                ? "bg-red-500"
                : "bg-slate-400"
        }`}
      />

      {labels[normalized] ||
        normalized.charAt(0).toUpperCase() +
          normalized.slice(1)}
    </span>
  );
}

/* =========================================================
   MINI DOCUMENT STAT
   ========================================================= */

function MiniDocumentStat({
  icon,
  label,
  value,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-[0.08em]">
          {label}
        </span>
      </div>

      <p className="mt-1 text-lg font-bold tracking-[-0.02em] text-slate-900">
        {value}
      </p>
    </div>
  );
}

/* =========================================================
   EMPTY EMPLOYEES
   ========================================================= */

function EmptyEmployees({
  hasSearch,
  onClear,
}) {
  return (
    <div className="flex min-h-[340px] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        {hasSearch ? (
          <Search size={23} />
        ) : (
          <Users size={23} />
        )}
      </div>

      <h3 className="mt-4 text-sm font-bold text-slate-800">
        {hasSearch
          ? "No matching employees"
          : "No employees found"}
      </h3>

      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
        {hasSearch
          ? "Try a different name, employee ID, department, or designation."
          : "There are currently no employees available in the directory."}
      </p>

      {hasSearch && (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Clear search
        </button>
      )}
    </div>
  );
}

/* =========================================================
   TABLE SKELETON
   ========================================================= */

function EmployeeTableSkeleton() {
  return (
    <div className="overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4">
        <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
      </div>

      <div className="divide-y divide-slate-100">
        {Array.from({ length: 5 }).map(
          (_, index) => (
            <div
              key={index}
              className="flex items-center gap-5 px-6 py-5"
            >
              <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />

              <div className="flex-1 space-y-2">
                <div className="h-3 w-36 animate-pulse rounded bg-slate-100" />
                <div className="h-2.5 w-24 animate-pulse rounded bg-slate-100" />
              </div>

              <div className="hidden h-3 w-24 animate-pulse rounded bg-slate-100 sm:block" />
              <div className="hidden h-6 w-20 animate-pulse rounded-full bg-slate-100 sm:block" />
              <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-100" />
            </div>
          )
        )}
      </div>
    </div>
  );
}

/* =========================================================
   DOCUMENT TABLE SKELETON
   ========================================================= */

function DocumentTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4">
        <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
      </div>

      <div className="divide-y divide-slate-100">
        {Array.from({ length: 4 }).map(
          (_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 px-5 py-5"
            >
              <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-100" />

              <div className="flex-1 space-y-2">
                <div className="h-3 w-40 animate-pulse rounded bg-slate-100" />
                <div className="h-2.5 w-24 animate-pulse rounded bg-slate-100" />
              </div>

              <div className="hidden h-6 w-16 animate-pulse rounded-full bg-slate-100 md:block" />
              <div className="hidden h-3 w-16 animate-pulse rounded bg-slate-100 lg:block" />
              <div className="h-8 w-28 animate-pulse rounded-lg bg-slate-100" />
            </div>
          )
        )}
      </div>
    </div>
  );
}

/* =========================================================
   HELPERS
   ========================================================= */

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) {
    return "—";
  }

  const units = ["B", "KB", "MB", "GB"];

  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  const size = bytes / Math.pow(1024, index);

  return `${size.toFixed(1)} ${units[index]}`;
}

function formatDate(dateString) {
  if (!dateString) {
    return "—";
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getFileExtension(filename) {
  if (!filename) {
    return "FILE";
  }

  const parts = String(filename).split(".");

  if (parts.length < 2) {
    return "FILE";
  }

  return parts[parts.length - 1].toUpperCase();
}