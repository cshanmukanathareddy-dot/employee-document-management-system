import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FolderOpen,
  HardDrive,
  Key,
  Link2,
  Loader2,
  Lock,
  FileText,
  FileX2,
  FileSpreadsheet,
  FileUp,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Table,
  Trash2,
  Upload,
  UserCheck,
  UserRound,
  UserX,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import api, { API_URL, getErrorMessage } from "../services/api";
import { triggerBlobDownload } from "../utils/downloadHelper";
import { buildPublicDocumentUrl } from "../utils/publicUrl";
import {
  formatStorageBytes,
  formatStorageGb,
  convertToGb,
} from "../utils/storageHelper";

export default function AdminDashboard() {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportingPasswords, setExportingPasswords] = useState(false);
  const [excelManagementOpen, setExcelManagementOpen] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [storageModalEmployee, setStorageModalEmployee] = useState(null);
  const [storageSuccess, setStorageSuccess] = useState("");
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [deletingEmployee, setDeletingEmployee] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [deletingDocument, setDeletingDocument] = useState(false);
  const [actionSuccess, setActionSuccess] = useState("");
  const [employeeDocuments, setEmployeeDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [extractingDocumentId, setExtractingDocumentId] = useState(null);
  const [copiedDocId, setCopiedDocId] = useState(null);

  const confirmDeleteEmployee = async () => {
    if (!employeeToDelete) return;
    try {
      setDeletingEmployee(true);
      setError("");
      const response = await api.delete(`/admin/employees/${employeeToDelete.id}`);
      setActionSuccess(
        response.data?.message || `Employee ${employeeToDelete.full_name} and storage folder deleted.`
      );
      setEmployeeToDelete(null);
      await loadEmployees(true);
      setTimeout(() => setActionSuccess(""), 5000);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete employee and storage folder."));
    } finally {
      setDeletingEmployee(false);
    }
  };

  const confirmDeleteDocument = async () => {
    if (!documentToDelete) return;
    try {
      setDeletingDocument(true);
      setError("");
      await api.delete(`/documents/${documentToDelete.id}`);
      setActionSuccess(`Document "${documentToDelete.document_name}" deleted successfully.`);
      setDocumentToDelete(null);
      if (selectedEmployee) {
        await viewDocuments(selectedEmployee);
      }
      await loadEmployees(true);
      setTimeout(() => setActionSuccess(""), 5000);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete document."));
    } finally {
      setDeletingDocument(false);
    }
  };

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
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to load employees. Please try again.");
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
      } catch (err) {
        if (mounted) {
          setError(err.response?.data?.detail || "Unable to load employees. Please try again.");
        }
      } finally {
        if (mounted) setLoading(false);
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
    } catch (err) {
      console.error("Admin employee ZIP extraction error:", err);
      setError(err.response?.data?.detail || "Unable to extract employee ZIP file.");
    } finally {
      setExtractingDocumentId(null);
    }
  };

  const exportEmployees = async () => {
    try {
      setExporting(true);
      setError("");
      const response = await api.get("/admin/employees/export", { responseType: "blob" });
      triggerBlobDownload(
        response,
        `employees_${new Date().toISOString().slice(0, 10)}.xlsx`,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to export employee information.");
    } finally {
      setExporting(false);
    }
  };

  const exportPasswords = async () => {
    try {
      setExportingPasswords(true);
      setError("");
      const response = await api.get("/admin/employees/export-passwords", { responseType: "blob" });
      triggerBlobDownload(
        response,
        `employee_passwords_documentation_${new Date().toISOString().slice(0, 10)}.xlsx`,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to export password documentation Excel sheet.");
    } finally {
      setExportingPasswords(false);
    }
  };

  const changeStatus = async (id, status) => {
    try {
      setError("");
      await api.put(`/admin/employees/${id}/status?status=${status}`);
      await loadEmployees(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to update employee status.");
    }
  };

  const viewDocuments = async (employee) => {
    try {
      setError("");
      setSelectedEmployee(employee);
      setEmployeeDocuments([]);
      setDocumentsLoading(true);
      const response = await api.get(`/admin/employees/${employee.id}/documents`);
      setEmployeeDocuments(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to load employee documents.");
      setSelectedEmployee(null);
    } finally {
      setDocumentsLoading(false);
    }
  };

  const viewFile = (document) => {
    if (document?.is_archive) {
      setError("ZIP archives cannot be previewed directly. Extract the ZIP first to view its files.");
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
      type.endsWith("/") ? fileType.startsWith(type) : fileType === type
    );

    if (!canPreview) {
      setError("This file type cannot be previewed directly in the browser. Use Download to open the original file.");
      return;
    }

    const directory =
      document?.directory_name || document?.storage_directory || selectedEmployee?.directory_name;
    const directViewUrl = buildPublicDocumentUrl(directory, document?.document_name);

    if (directViewUrl) {
      const previewWindow = window.open(directViewUrl, "_blank");
      if (!previewWindow) {
        setError("Please allow pop-ups in your browser to view documents.");
      }
      return;
    }

    setError("This document does not have a view link available.");
  };

  const copyDocumentUrl = async (document) => {
    if (!document) return;
    const directory =
      document?.directory_name || document?.storage_directory || selectedEmployee?.directory_name;

    if (!directory || !document?.document_name) {
      setError("Cannot copy URL: document details are missing.");
      return;
    }

    const encodedDirectory = encodeURIComponent(directory);
    const filePath = String(document.document_name)
      .split("/")
      .filter(Boolean)
      .map((part) => encodeURIComponent(part))
      .join("/");
    const url = `${window.location.origin}/${encodedDirectory}/${filePath}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopiedDocId(document.id);
      setTimeout(() => setCopiedDocId(null), 2500);
    } catch {
      setError("Could not copy document URL to clipboard.");
    }
  };

  const downloadDocument = async (document) => {
    try {
      setError("");
      const response = await api.get(`/documents/${document.id}/download`, { responseType: "blob" });
      triggerBlobDownload(
        response,
        document.document_name || "document",
        document.file_type || "application/octet-stream"
      );
    } catch (err) {
      console.error("Download document error:", err);
      setError(err.response?.data?.detail || "Unable to download document.");
    }
  };

  const closeDocuments = () => {
    setSelectedEmployee(null);
    setEmployeeDocuments([]);
  };

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return employees;

    return employees.filter((employee) => {
      const name = String(employee.full_name || "").toLowerCase();
      const employeeId = String(employee.employee_id || "").toLowerCase();
      const email = String(employee.email || "").toLowerCase();
      const department = String(employee.department || "").toLowerCase();
      const designation = String(employee.designation || "").toLowerCase();

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
    const active = employees.filter((e) => e.status === "active").length;
    const inactive = employees.filter((e) => e.status === "inactive").length;
    const terminated = employees.filter((e) => e.status === "terminated").length;
    return {
      total: employees.length,
      active,
      inactive,
      terminated,
    };
  }, [employees]);

  const activePercentage =
    statistics.total > 0 ? Math.round((statistics.active / statistics.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900">
      <Sidebar />

      <main className="ml-0 min-h-screen lg:ml-64">
        <Navbar title="Admin Dashboard" />

        <div className="px-6 py-7 lg:px-8">
          <div className="mx-auto max-w-[1600px]">
            {/* Alerts */}
            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700 shadow-sm">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-100">
                  <FileX2 size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Something went wrong</p>
                  <p className="mt-0.5 text-red-600">{error}</p>
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

            {storageSuccess && (
              <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-700 shadow-sm">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <Check size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{storageSuccess}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStorageSuccess("")}
                  className="rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-100 hover:text-emerald-800"
                  aria-label="Dismiss message"
                >
                  <X size={17} />
                </button>
              </div>
            )}

            {actionSuccess && (
              <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-700 shadow-sm">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <Check size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{actionSuccess}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActionSuccess("")}
                  className="rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-100 hover:text-emerald-800"
                  aria-label="Dismiss message"
                >
                  <X size={17} />
                </button>
              </div>
            )}

            {/* Hero Section */}
            <section className="relative overflow-hidden rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <div className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-indigo-100/70 dark:bg-indigo-900/15 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-32 right-48 h-56 w-56 rounded-full bg-blue-100/50 dark:bg-blue-900/10 blur-3xl" />

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
                    Manage your workforce, monitor employee activity, and keep organizational documents moving through the right workflow.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => loadEmployees(true)}
                    disabled={refreshing}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm transition hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                    Refresh
                  </button>

                  <button
                    type="button"
                    onClick={exportEmployees}
                    disabled={exporting}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 px-4 text-sm font-semibold text-emerald-700 dark:text-emerald-400 shadow-sm transition hover:bg-emerald-100 dark:hover:bg-emerald-950/70 disabled:cursor-not-allowed disabled:opacity-60"
                    title="Export employee directory to Excel"
                  >
                    <FileSpreadsheet size={16} />
                    {exporting ? "Exporting..." : "Export Excel"}
                  </button>

                  <button
                    type="button"
                    onClick={exportPasswords}
                    disabled={exportingPasswords}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-950/40 px-4 text-sm font-semibold text-indigo-700 dark:text-indigo-300 shadow-sm transition hover:bg-indigo-100 dark:hover:bg-indigo-950/70 disabled:cursor-not-allowed disabled:opacity-60"
                    title="Maintain & download employee passwords in Excel sheet"
                  >
                    <Key size={16} />
                    {exportingPasswords ? "Exporting..." : "Export Passwords (.xlsx)"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setExcelManagementOpen(true)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 px-4 text-sm font-semibold text-indigo-700 dark:text-indigo-300 shadow-sm transition hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:border-indigo-400"
                    title="Manage, Edit, Upload, and Delete Excel sheets"
                  >
                    <FileSpreadsheet size={16} className="text-indigo-600 dark:text-indigo-400" />
                    Manage Excel Sheet
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      document.getElementById("employee-directory")?.scrollIntoView({
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

            {/* KPI Stat Cards */}
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

            {/* Employee Directory Section */}
            <section
              id="employee-directory"
              className="mt-6 scroll-mt-6 overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm"
            >
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
                          {filteredEmployees.length} shown
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        Manage employee access and review their organizational documents.
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
                        onChange={(e) => setSearch(e.target.value)}
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

              {loading ? (
                <EmployeeTableSkeleton />
              ) : filteredEmployees.length === 0 ? (
                <EmptyEmployees hasSearch={Boolean(search)} onClear={() => setSearch("")} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px]">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 text-left">
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
                          Storage Quota
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
                      {filteredEmployees.map((employee) => (
                        <EmployeeRow
                          key={employee.id}
                          employee={employee}
                          onChangeStatus={changeStatus}
                          onViewDocuments={viewDocuments}
                          onManageStorage={setStorageModalEmployee}
                          onDeleteEmployee={setEmployeeToDelete}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!loading && filteredEmployees.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/40 px-6 py-3.5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Showing <strong className="font-semibold text-slate-700">{filteredEmployees.length}</strong> of{" "}
                    <strong className="font-semibold text-slate-700">{employees.length}</strong> employees
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

      {/* Employee Documents Modal */}
      {selectedEmployee && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[3px] sm:p-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDocuments();
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-[24px] border border-white/50 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.22)]">
            <div className="border-b border-slate-100 px-6 py-5 sm:px-7">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-700">
                    {String(selectedEmployee.full_name || "Employee").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-bold tracking-[-0.02em] text-slate-950">
                        Employee documents
                      </h2>
                      <StatusBadge status={selectedEmployee.status} />
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-500">
                      {selectedEmployee.full_name || "Employee"} · {selectedEmployee.employee_id || "—"}
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

              {!documentsLoading && employeeDocuments.length > 0 && (
                <div className="mt-5 grid grid-cols-1 gap-3 sm:max-w-[220px]">
                  <MiniDocumentStat
                    icon={<FileText size={15} />}
                    label="Total documents"
                    value={employeeDocuments.length}
                  />
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
              {documentsLoading ? (
                <DocumentTableSkeleton />
              ) : employeeDocuments.length === 0 ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
                    <FileText size={25} />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-slate-800">No documents found</p>
                  <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
                    This employee has not uploaded any documents yet.
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
                        {employeeDocuments.map((doc) => (
                          <DocumentRow
                            key={doc.id}
                            document={doc}
                            directoryName={selectedEmployee?.directory_name}
                            onView={viewFile}
                            onCopyUrl={copyDocumentUrl}
                            copiedId={copiedDocId}
                            onDownload={downloadDocument}
                            onExtract={extractEmployeeDocument}
                            extractingId={extractingDocumentId}
                            onDelete={setDocumentToDelete}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 px-6 py-4 sm:px-7">
              <p className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
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

      {storageModalEmployee && (
        <ManageStorageModal
          employee={storageModalEmployee}
          onClose={() => setStorageModalEmployee(null)}
          onSuccess={(msg) => {
            setStorageSuccess(msg);
            loadEmployees(true);
            setTimeout(() => setStorageSuccess(""), 4000);
          }}
        />
      )}

      {employeeToDelete && (
        <DeleteEmployeeModal
          employee={employeeToDelete}
          submitting={deletingEmployee}
          onClose={() => setEmployeeToDelete(null)}
          onConfirm={confirmDeleteEmployee}
        />
      )}

      {documentToDelete && (
        <DeleteDocumentModal
          document={documentToDelete}
          employeeName={selectedEmployee?.full_name}
          submitting={deletingDocument}
          onClose={() => setDocumentToDelete(null)}
          onConfirm={confirmDeleteDocument}
        />
      )}

      {excelManagementOpen && (
        <ExcelManagementModal
          onClose={() => setExcelManagementOpen(false)}
          onDataChanged={() => {
            loadEmployees(true);
          }}
        />
      )}
    </div>
  );
}

function AdminStat({ icon, label, value, description, accent, progress }) {
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

  const styles = accentStyles[accent] || accentStyles.indigo;

  return (
    <div className="group rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles.icon}`}>
          {icon}
        </div>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition group-hover:text-slate-500">
          <ArrowUpRight size={15} />
        </span>
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
        <p className={`mt-1 text-[28px] font-bold tracking-[-0.04em] ${styles.value}`}>{value}</p>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>

      {typeof progress === "number" && (
        <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ${styles.progress}`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EmployeeRow({
  employee,
  onChangeStatus,
  onViewDocuments,
  onManageStorage,
  onDeleteEmployee,
}) {
  const name = employee.full_name || "Unnamed employee";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <tr className="group border-b border-slate-100 dark:border-slate-800 last:border-0 transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
      <td className="px-6 py-4.5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 text-xs font-bold text-indigo-700 ring-1 ring-indigo-100">
            {initials || "U"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
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
                {employee.role === "readonlyemployee" ? "Read Only" : "Employee"}
              </span>
            </div>
          </div>
        </div>
      </td>

      <td className="px-5 py-4.5">
        <div className="max-w-[220px]">
          <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">
            {employee.department || "—"}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {employee.designation || "—"}
          </p>
        </div>
      </td>

      <td className="px-5 py-4.5">
        <span className="inline-flex max-w-[180px] items-center gap-1.5 truncate rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
          <UserRound size={12} className="shrink-0 text-slate-400" />
          <span className="truncate">{employee.directory_name || "—"}</span>
        </span>
      </td>

      <td className="px-5 py-4.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <HardDrive size={13} className="text-slate-400 shrink-0" />
          <span>{formatStorageBytes(employee.storage_limit_bytes)}</span>
        </div>
      </td>

      <td className="px-5 py-4.5">
        <StatusBadge status={employee.status} />
      </td>

      <td className="px-5 py-4.5">
        <div className="flex justify-end gap-1">
          <IconAction
            label="Manage storage quota"
            tone="purple"
            onClick={() => onManageStorage && onManageStorage(employee)}
          >
            <HardDrive size={16} />
          </IconAction>

          {employee.status !== "active" && (
            <IconAction
              label="Activate employee"
              tone="emerald"
              onClick={() => onChangeStatus(employee.id, "active")}
            >
              <UserCheck size={16} />
            </IconAction>
          )}

          {employee.status === "active" && (
            <IconAction
              label="Deactivate employee"
              tone="amber"
              onClick={() => onChangeStatus(employee.id, "inactive")}
            >
              <UserX size={16} />
            </IconAction>
          )}

          <IconAction
            label="View employee documents"
            tone="indigo"
            onClick={() => onViewDocuments(employee)}
          >
            <Eye size={16} />
          </IconAction>

          <IconAction
            label="Delete employee & storage folder"
            tone="rose"
            onClick={() => onDeleteEmployee && onDeleteEmployee(employee)}
          >
            <Trash2 size={16} />
          </IconAction>
        </div>
      </td>
    </tr>
  );
}

function DocumentRow({
  document,
  directoryName,
  onView,
  onCopyUrl,
  copiedId,
  onDownload,
  onExtract,
  extractingId,
  onDelete,
}) {
  const extension = getFileExtension(document.document_name);
  const targetDir = directoryName || document.directory_name || document.storage_directory;

  const isIndexDoc =
    document.document_name &&
    (document.document_name.toLowerCase() === "index.html" ||
      document.document_name.toLowerCase().endsWith("/index.html"));

  const cleanWebPath = targetDir && document.document_name
    ? `/${encodeURIComponent(targetDir)}/${document.document_name.replace(/\\/g, "/").replace(/^\/+/, "")}`
    : null;

  return (
    <tr className="border-b border-slate-100 last:border-0 transition hover:bg-slate-50/60">
      <td className="px-5 py-4">
        <div className="flex min-w-[220px] items-center gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              isIndexDoc ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"
            }`}
          >
            <FileText size={17} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p
                className="max-w-[250px] truncate text-sm font-semibold text-slate-800"
                title={document.document_name}
              >
                {document.document_name || "Untitled document"}
              </p>

              {isIndexDoc && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  index.html
                </span>
              )}
            </div>

            {cleanWebPath ? (
              <div className="mt-1 flex items-center gap-1.5">
                <a
                  href={cleanWebPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open link: ${cleanWebPath}`}
                  className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-indigo-600 hover:text-indigo-800 hover:underline max-w-[230px] truncate"
                >
                  <ExternalLink size={10} className="shrink-0" />
                  <span>{cleanWebPath}</span>
                </a>

                <button
                  type="button"
                  onClick={() => onCopyUrl && onCopyUrl(document)}
                  title="Copy clean link"
                  className="text-slate-400 hover:text-indigo-600 transition"
                >
                  {copiedId === document.id ? (
                    <span className="text-[10px] font-bold text-emerald-600">Copied!</span>
                  ) : (
                    <Copy size={11} />
                  )}
                </button>
              </div>
            ) : (
              <p className="mt-0.5 text-xs text-slate-400">Document #{document.id}</p>
            )}
          </div>
        </div>
      </td>

      <td className="px-4 py-4 text-sm text-slate-600">{document.category || "—"}</td>

      <td className="px-4 py-4">
        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
          {extension}
        </span>
      </td>

      <td className="px-4 py-4 text-sm text-slate-600">{formatFileSize(document.file_size)}</td>

      <td className="px-4 py-4">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          v{document.version || 1}
        </span>
      </td>

      <td className="px-4 py-4 text-sm text-slate-500">{formatDate(document.uploaded_at)}</td>

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
            label={copiedId === document.id ? "URL copied!" : "Copy document URL"}
            tone={copiedId === document.id ? "emerald" : "indigo"}
            onClick={() => onCopyUrl && onCopyUrl(document)}
          >
            {copiedId === document.id ? <Check size={15} /> : <Link2 size={15} />}
          </IconAction>

          <IconAction label="View document" tone="indigo" onClick={() => onView(document)}>
            <Eye size={15} />
          </IconAction>

          <IconAction label="Download document" tone="emerald" onClick={() => onDownload(document)}>
            <Download size={15} />
          </IconAction>

          <IconAction
            label="Delete document"
            tone="rose"
            onClick={() => onDelete && onDelete(document)}
          >
            <Trash2 size={15} />
          </IconAction>
        </div>
      </td>
    </tr>
  );
}

function IconAction({ children, label, tone, onClick }) {
  const tones = {
    indigo:
      "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-700 dark:hover:text-indigo-300",
    emerald:
      "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700 dark:hover:text-emerald-300",
    amber:
      "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-700 dark:hover:text-amber-300",
    rose:
      "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-700 dark:hover:text-rose-300",
    purple:
      "text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/50 hover:text-purple-700 dark:hover:text-purple-300",
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

function StatusBadge({ status }) {
  const normalized = String(status || "unknown").toLowerCase();
  const styles = {
    active:
      "border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
    inactive:
      "border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
    terminated:
      "border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
  };

  const labels = {
    active: "Active",
    inactive: "Inactive",
    terminated: "Terminated",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
        styles[normalized] || "border-slate-200 bg-slate-50 text-slate-600"
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
      {labels[normalized] || normalized.charAt(0).toUpperCase() + normalized.slice(1)}
    </span>
  );
}

function MiniDocumentStat({ icon, label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 px-3.5 py-3">
      <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-[0.08em]">{label}</span>
      </div>
      <p className="mt-1 text-lg font-bold tracking-[-0.02em] text-slate-900 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}

function EmptyEmployees({ hasSearch, onClear }) {
  return (
    <div className="flex min-h-[340px] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        {hasSearch ? <Search size={23} /> : <Users size={23} />}
      </div>
      <h3 className="mt-4 text-sm font-bold text-slate-800">
        {hasSearch ? "No matching employees" : "No employees found"}
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

function EmployeeTableSkeleton() {
  return (
    <div className="overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4">
        <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-5 px-6 py-5">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-36 animate-pulse rounded bg-slate-100" />
              <div className="h-2.5 w-24 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="hidden h-3 w-24 animate-pulse rounded bg-slate-100 sm:block" />
            <div className="hidden h-6 w-20 animate-pulse rounded-full bg-slate-100 sm:block" />
            <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DocumentTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4">
        <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 px-5 py-5">
            <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-40 animate-pulse rounded bg-slate-100" />
              <div className="h-2.5 w-24 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="hidden h-6 w-16 animate-pulse rounded-full bg-slate-100 md:block" />
            <div className="hidden h-3 w-16 animate-pulse rounded bg-slate-100 lg:block" />
            <div className="h-8 w-28 animate-pulse rounded-lg bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, index);
  return `${size.toFixed(1)} ${units[index]}`;
}

function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getFileExtension(filename) {
  if (!filename) return "FILE";
  const parts = String(filename).split(".");
  if (parts.length < 2) return "FILE";
  return parts[parts.length - 1].toUpperCase();
}

function ManageStorageModal({ employee, onClose, onSuccess }) {
  const ADMIN_STORAGE_PRESETS = [
    {
      id: "500mb",
      label: "500 MB",
      sublabel: "Basic / Intern",
      gb: 0.5,
      description: "Lightweight documents & IDs",
    },
    {
      id: "1gb",
      label: "1 GB",
      sublabel: "Standard",
      gb: 1.0,
      description: "Standard employee quota",
    },
    {
      id: "2gb",
      label: "2 GB",
      sublabel: "Pro Tier",
      gb: 2.0,
      description: "High-volume uploads",
    },
    {
      id: "5gb",
      label: "5 GB",
      sublabel: "Department",
      gb: 5.0,
      description: "Large projects & archives",
    },
    {
      id: "10gb",
      label: "10 GB",
      sublabel: "Power User",
      gb: 10.0,
      description: "Extensive organizational assets",
    },
  ];

  const currentGb = employee.storage_limit_bytes
    ? Number((employee.storage_limit_bytes / (1024 * 1024 * 1024)).toFixed(2))
    : Number(employee.storage_gb || 2);

  const matchingPreset = ADMIN_STORAGE_PRESETS.find((p) => Math.abs(p.gb - currentGb) < 0.05);

  const [selectedPreset, setSelectedPreset] = useState(matchingPreset ? matchingPreset.id : "custom");
  const [customValue, setCustomValue] = useState(
    matchingPreset ? "" : (currentGb < 1 ? Math.round(currentGb * 1024) : currentGb).toString()
  );
  const [customUnit, setCustomUnit] = useState(currentGb < 1 ? "MB" : "GB");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const calculateTargetGb = () => {
    if (selectedPreset !== "custom") {
      const found = ADMIN_STORAGE_PRESETS.find((p) => p.id === selectedPreset);
      return found ? found.gb : 2.0;
    }
    return convertToGb(customValue, customUnit);
  };

  const targetGb = calculateTargetGb();

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");

    if (!targetGb || targetGb <= 0) {
      setError("Please enter a valid storage quota greater than 0.");
      return;
    }
    if (targetGb < 0.1) {
      setError("Minimum storage allocation is 100 MB (0.1 GB).");
      return;
    }
    if (targetGb > 1024) {
      setError("Maximum storage allocation is 1024 GB (1 TB).");
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.put(`/admin/employees/${employee.id}/storage`, {
        storage_gb: targetGb,
      });
      onSuccess(
        response.data?.message ||
          `Storage quota for ${employee.full_name} updated to ${formatStorageGb(targetGb)}.`
      );
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.detail || "Failed to update employee storage quota. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[3px] sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-5 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <HardDrive size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Manage Storage Quota
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {employee.full_name} ({employee.employee_id || "Employee"})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 py-6 sm:px-7 space-y-5">
          {error && (
            <div className="flex items-center gap-2.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-xs text-red-700 dark:text-red-300">
              <X size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 px-4 py-3 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Current Storage Quota:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {formatStorageBytes(employee.storage_limit_bytes)}
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Select Preset Allocation
            </label>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {ADMIN_STORAGE_PRESETS.map((preset) => {
                const isSelected = selectedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setSelectedPreset(preset.id);
                      setError("");
                    }}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/50 dark:border-indigo-500 ring-2 ring-indigo-500/20"
                        : "border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`text-sm font-bold ${
                          isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {preset.label}
                      </span>
                      {isSelected && (
                        <div className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                      )}
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
                      {preset.sublabel}
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setSelectedPreset("custom");
                  setError("");
                }}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition ${
                  selectedPreset === "custom"
                    ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/50 dark:border-indigo-500 ring-2 ring-indigo-500/20"
                    : "border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-sm font-bold ${
                      selectedPreset === "custom" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    Custom
                  </span>
                  {selectedPreset === "custom" && (
                    <div className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                  )}
                </div>
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
                  Specify MB or GB
                </span>
              </button>
            </div>
          </div>

          {selectedPreset === "custom" && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700/70 bg-slate-50/60 dark:bg-slate-800/30 p-3.5 space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Custom Storage Amount
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  min={customUnit === "MB" ? "100" : "0.1"}
                  max={customUnit === "MB" ? "1048576" : "1024"}
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  placeholder={customUnit === "MB" ? "e.g. 500" : "e.g. 2.5"}
                  className="flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-sm text-slate-800 dark:text-slate-100 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />

                <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
                  <button
                    type="button"
                    onClick={() => setCustomUnit("MB")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                      customUnit === "MB"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    MB
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomUnit("GB")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                      customUnit === "GB"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    GB
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Sub-1 GB values like 500 MB (0.5 GB) are fully supported. Min: 100 MB.
              </p>
            </div>
          )}

          <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/30 p-3.5 flex items-center justify-between">
            <span className="text-xs text-indigo-900 dark:text-indigo-300 font-medium">
              New Storage Quota:
            </span>
            <span className="text-sm font-bold text-indigo-700 dark:text-indigo-400">
              {targetGb > 0 ? formatStorageGb(targetGb) : "—"}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || !targetGb}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-md shadow-indigo-600/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check size={14} />
                  Update Quota
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteEmployeeModal({ employee, submitting, onClose, onConfirm }) {
  const [confirmInput, setConfirmInput] = useState("");
  const requiredMatch = employee.employee_id || employee.full_name;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[3px] sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-[24px] border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900 shadow-2xl">
        <div className="flex items-start justify-between border-b border-rose-100 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-950/30 px-6 py-5 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-rose-950 dark:text-rose-200">
                Delete User & Storage Folder
              </h2>
              <p className="text-xs text-rose-600 dark:text-rose-400">
                Permanent and irreversible action
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-6 sm:px-7 space-y-4 text-xs text-slate-600 dark:text-slate-300">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Are you sure you want to completely delete {employee.full_name}?
          </p>

          <div className="rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 p-3.5 space-y-2 text-rose-800 dark:text-rose-300">
            <div className="font-semibold text-xs text-rose-900 dark:text-rose-200">
              The following will be permanently removed:
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-rose-700 dark:text-rose-300/90">
              <li>
                Employee account credentials & profile (<strong>{employee.email}</strong>)
              </li>
              <li>
                User storage directory: <strong>storage/{employee.directory_name}</strong>
              </li>
              <li>All personal documents, uploads, and extracted archive files</li>
              <li>Pending storage requests & notifications</li>
              <li>Auto-synced and removed from maintained Excel documentation</li>
            </ul>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Type <strong className="font-bold text-slate-900 dark:text-slate-100">{requiredMatch}</strong> to confirm:
            </label>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={requiredMatch}
              className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-xs text-slate-800 dark:text-slate-100 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={submitting || confirmInput.trim() !== String(requiredMatch).trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-md shadow-rose-600/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 size={14} />
                  Delete User & Wipe Folder
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteDocumentModal({ document, employeeName, submitting, onClose, onConfirm }) {
  const isFolder = Boolean(document?.is_archive && document?.extracted);
  const displayName = document?.document_name || "Untitled";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[3px] sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-5 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <Trash2 size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {isFolder ? "Delete Folder" : "Delete Document"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {employeeName ? `From ${employeeName}'s storage` : "Permanent Removal"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-6 sm:px-7 space-y-4 text-xs text-slate-600 dark:text-slate-300">
          <p>
            Are you sure you want to permanently delete{" "}
            <strong className="font-semibold text-slate-900 dark:text-slate-100">
              "{displayName}"
            </strong>
            {isFolder && " and all files extracted within it"}?
          </p>

          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            This will remove the file from physical storage and the database permanently.
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-md shadow-rose-600/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 size={14} />
                  Delete
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExcelManagementModal({ onClose, onDataChanged }) {
  const [activeTab, setActiveTab] = useState("edit");
  const [loading, setLoading] = useState(true);
  const [sheetInfo, setSheetInfo] = useState(null);
  const [rows, setRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [showPasswordMap, setShowPasswordMap] = useState({});
  const [showAllPasswords, setShowAllPasswords] = useState(false);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const response = await api.get("/admin/excel/data");
      setSheetInfo(response.data);
      const fetchedRows = response.data.rows || [];
      setRows(fetchedRows);
      setOriginalRows(JSON.parse(JSON.stringify(fetchedRows)));
    } catch (err) {
      setErrorMsg(getErrorMessage(err, "Failed to load Excel sheet records."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCellChange = (rowIndex, field, value) => {
    setRows((prev) => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [field]: value };
      return next;
    });
  };

  const handleSaveEdits = async () => {
    try {
      setSaving(true);
      setErrorMsg("");
      setSuccessMsg("");
      const response = await api.put("/admin/excel/edit", { rows });
      setSuccessMsg(response.data?.message || "Excel sheet updated and synchronized successfully.");
      if (response.data?.sheet) {
        setSheetInfo(response.data.sheet);
        setRows(response.data.sheet.rows || []);
        setOriginalRows(JSON.parse(JSON.stringify(response.data.sheet.rows || [])));
      }
      onDataChanged?.();
    } catch (err) {
      setErrorMsg(getErrorMessage(err, "Failed to save Excel changes."));
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    setRows(JSON.parse(JSON.stringify(originalRows)));
    setSuccessMsg("");
    setErrorMsg("");
  };

  const handleUploadFile = async () => {
    if (!selectedFile) {
      setErrorMsg("Please select an Excel file (.xlsx or .xls) to upload.");
      return;
    }
    try {
      setUploading(true);
      setErrorMsg("");
      setSuccessMsg("");
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await api.post("/admin/excel/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSuccessMsg(response.data?.message || "Excel sheet uploaded and processed successfully.");
      setSelectedFile(null);
      if (response.data?.sheet) {
        setSheetInfo(response.data.sheet);
        setRows(response.data.sheet.rows || []);
        setOriginalRows(JSON.parse(JSON.stringify(response.data.sheet.rows || [])));
      }
      onDataChanged?.();
    } catch (err) {
      setErrorMsg(getErrorMessage(err, "Failed to upload Excel sheet."));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteSheet = async () => {
    try {
      setDeleting(true);
      setErrorMsg("");
      setSuccessMsg("");
      const response = await api.delete("/admin/excel");
      setSuccessMsg(response.data?.message || "Excel sheet deleted from server storage.");
      setConfirmDelete(false);
      if (response.data?.sheet) {
        setSheetInfo(response.data.sheet);
      }
    } catch (err) {
      setErrorMsg(getErrorMessage(err, "Failed to delete Excel sheet."));
    } finally {
      setDeleting(false);
    }
  };

  const handleRegenerateSheet = async () => {
    try {
      setRegenerating(true);
      setErrorMsg("");
      setSuccessMsg("");
      const response = await api.post("/admin/excel/regenerate");
      setSuccessMsg(response.data?.message || "Excel sheet regenerated successfully.");
      if (response.data?.sheet) {
        setSheetInfo(response.data.sheet);
        setRows(response.data.sheet.rows || []);
        setOriginalRows(JSON.parse(JSON.stringify(response.data.sheet.rows || [])));
      }
    } catch (err) {
      setErrorMsg(getErrorMessage(err, "Failed to regenerate Excel sheet."));
    } finally {
      setRegenerating(false);
    }
  };

  const handleDownloadSheet = async () => {
    try {
      setDownloading(true);
      setErrorMsg("");
      const response = await api.get("/admin/employees/export-passwords", { responseType: "blob" });
      triggerBlobDownload(
        response,
        `employee_passwords_documentation_${new Date().toISOString().slice(0, 10)}.xlsx`,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    } catch (err) {
      setErrorMsg(getErrorMessage(err, "Unable to download Excel sheet."));
    } finally {
      setDownloading(false);
    }
  };

  const toggleRowPassword = (id) => {
    setShowPasswordMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredRows = useMemo(() => {
    if (!searchFilter.trim()) return rows;
    const q = searchFilter.toLowerCase();
    return rows.filter(
      (r) =>
        r.full_name?.toLowerCase().includes(q) ||
        r.employee_id?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.department?.toLowerCase().includes(q) ||
        r.designation?.toLowerCase().includes(q)
    );
  }, [rows, searchFilter]);

  const hasModifications = useMemo(() => {
    return JSON.stringify(rows) !== JSON.stringify(originalRows);
  }, [rows, originalRows]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-5 backdrop-blur-[4px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving && !uploading && !deleting && !regenerating) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4.5 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Excel Sheet Management
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Delete, edit, upload, and synchronize system Excel documentation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving || uploading || deleting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 px-6 pt-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab("edit");
              setErrorMsg("");
              setSuccessMsg("");
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === "edit"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Table size={15} />
            Edit Spreadsheet Data
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("upload");
              setErrorMsg("");
              setSuccessMsg("");
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === "upload"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Upload size={15} />
            Upload Excel (.xlsx)
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("file");
              setErrorMsg("");
              setSuccessMsg("");
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === "file"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Trash2 size={15} />
            Delete & File Status
          </button>
        </div>

        {successMsg && (
          <div className="mx-6 mt-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{successMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMsg("")}
              className="rounded p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="mx-6 mt-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg("")}
              className="rounded p-1 hover:bg-rose-100 dark:hover:bg-rose-900"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 sm:p-7">
          {loading ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
              <Loader2 size={28} className="animate-spin text-indigo-600 dark:text-indigo-400" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Loading Excel spreadsheet records...
              </p>
            </div>
          ) : activeTab === "edit" ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 max-w-sm">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search by name, ID, email, department..."
                    className="w-full h-9 pl-9 pr-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAllPasswords((prev) => !prev)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    {showAllPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
                    {showAllPasswords ? "Hide Passwords" : "Show All Passwords"}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadSheet}
                    disabled={downloading}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 shadow-sm transition hover:bg-emerald-100 dark:hover:bg-emerald-950/70"
                  >
                    <Download size={14} />
                    {downloading ? "Downloading..." : "Download (.xlsx)"}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3.5">Employee</th>
                      <th className="py-3 px-3.5 min-w-[170px]">Password Reference</th>
                      <th className="py-3 px-3.5 min-w-[140px]">Role</th>
                      <th className="py-3 px-3.5 min-w-[130px]">Department</th>
                      <th className="py-3 px-3.5 min-w-[130px]">Designation</th>
                      <th className="py-3 px-3.5 min-w-[110px]">Status</th>
                      <th className="py-3 px-3.5 min-w-[110px]">Storage</th>
                      <th className="py-3 px-3.5 min-w-[130px]">Mobile</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-400">
                          No matching records found.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row) => {
                        const originalIndex = rows.findIndex((r) => r.id === row.id);
                        const isRevealed = showAllPasswords || Boolean(showPasswordMap[row.id]);

                        return (
                          <tr
                            key={row.id}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                          >
                            <td className="py-2.5 px-3.5">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {row.full_name}
                              </div>
                              <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                                <span className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 font-mono text-[10px]">
                                  {row.employee_id}
                                </span>
                                <span>•</span>
                                <span className="truncate max-w-[140px]">{row.email}</span>
                              </div>
                            </td>

                            <td className="py-2.5 px-3.5">
                              <div className="relative flex items-center">
                                <input
                                  type={isRevealed ? "text" : "password"}
                                  value={row.password_reference === "(hash secured)" ? "" : row.password_reference || ""}
                                  placeholder={row.password_reference === "(hash secured)" ? "(hash secured)" : "Enter password"}
                                  onChange={(e) =>
                                    handleCellChange(originalIndex, "password_reference", e.target.value)
                                  }
                                  className="w-full h-8 pl-2.5 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => toggleRowPassword(row.id)}
                                  className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                  title={isRevealed ? "Hide password" : "Show password"}
                                >
                                  {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                              </div>
                            </td>

                            <td className="py-2.5 px-3.5">
                              <select
                                value={row.role}
                                onChange={(e) =>
                                  handleCellChange(originalIndex, "role", e.target.value)
                                }
                                className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 outline-none transition focus:border-indigo-500"
                              >
                                <option value="employee">Employee</option>
                                <option value="readonlyemployee">Read-Only Employee</option>
                                <option value="admin">Administrator</option>
                              </select>
                            </td>

                            <td className="py-2.5 px-3.5">
                              <input
                                type="text"
                                value={row.department || ""}
                                onChange={(e) =>
                                  handleCellChange(originalIndex, "department", e.target.value)
                                }
                                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 outline-none transition focus:border-indigo-500"
                              />
                            </td>

                            <td className="py-2.5 px-3.5">
                              <input
                                type="text"
                                value={row.designation || ""}
                                onChange={(e) =>
                                  handleCellChange(originalIndex, "designation", e.target.value)
                                }
                                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 outline-none transition focus:border-indigo-500"
                              />
                            </td>

                            <td className="py-2.5 px-3.5">
                              <select
                                value={row.status || "active"}
                                onChange={(e) =>
                                  handleCellChange(originalIndex, "status", e.target.value)
                                }
                                className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 outline-none transition focus:border-indigo-500"
                              >
                                <option value="active">Active</option>
                                <option value="suspended">Suspended</option>
                                <option value="inactive">Inactive</option>
                              </select>
                            </td>

                            <td className="py-2.5 px-3.5">
                              <select
                                value={row.storage_gb}
                                onChange={(e) =>
                                  handleCellChange(originalIndex, "storage_gb", parseFloat(e.target.value))
                                }
                                className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 outline-none transition focus:border-indigo-500 font-mono"
                              >
                                <option value={0.5}>500 MB</option>
                                <option value={1}>1 GB</option>
                                <option value={2}>2 GB</option>
                                <option value={5}>5 GB</option>
                                <option value={10}>10 GB</option>
                              </select>
                            </td>

                            <td className="py-2.5 px-3.5">
                              <input
                                type="text"
                                value={row.mobile_number || ""}
                                onChange={(e) =>
                                  handleCellChange(originalIndex, "mobile_number", e.target.value)
                                }
                                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 outline-none transition focus:border-indigo-500 font-mono"
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  <span>Showing {filteredRows.length} employee row(s)</span>
                  {hasModifications && (
                    <span className="ml-2 font-semibold text-indigo-600 dark:text-indigo-400">
                      • Unsaved changes detected
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDiscardChanges}
                    disabled={!hasModifications || saving}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Discard Changes
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveEdits}
                    disabled={!hasModifications || saving}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-md shadow-indigo-600/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Saving & Syncing...
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        Save & Sync Excel Sheet
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : activeTab === "upload" ? (
            <div className="max-w-2xl mx-auto space-y-6 py-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) {
                    setSelectedFile(e.dataTransfer.files[0]);
                  }
                }}
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 p-8 text-center transition hover:border-indigo-400 dark:hover:border-indigo-700"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 mb-3">
                  <FileUp size={28} />
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Select or drag an Excel spreadsheet here
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Accepts .xlsx or .xls workbooks up to 25MB
                </p>
                <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition">
                  <Upload size={14} />
                  Choose File
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                  />
                </label>
              </div>

              {selectedFile && (
                <div className="flex items-center justify-between rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet size={24} className="text-emerald-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  How Excel Sheet Upload Works:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <li>The sheet must contain header columns including <strong>Employee ID</strong> or <strong>Email</strong>.</li>
                  <li>Updating <strong>Password Reference</strong> will automatically hash and update the employee's login password.</li>
                  <li>Columns for <strong>Role</strong>, <strong>Department</strong>, <strong>Designation</strong>, <strong>Status</strong>, and <strong>Storage</strong> will update active user settings.</li>
                  <li>The maintained confidential spreadsheet on the server will be immediately regenerated with your new entries.</li>
                </ul>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleUploadFile}
                  disabled={!selectedFile || uploading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-md shadow-indigo-600/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Uploading & Processing...
                    </>
                  ) : (
                    <>
                      <Upload size={15} />
                      Upload & Apply Updates
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6 py-3">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                      <FileSpreadsheet size={24} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {sheetInfo?.file_name || "employee_passwords_documentation.xlsx"}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Maintained Server Spreadsheet
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                      sheetInfo?.exists
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        sheetInfo?.exists ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                    />
                    {sheetInfo?.exists ? "Active on Server" : "Deleted / Not on Disk"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">File Size</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {sheetInfo?.exists ? formatFileSize(sheetInfo?.file_size_bytes) : "0 B"}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Total Documented Users</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {sheetInfo?.total_records || rows.length} accounts
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Last Synchronized</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {sheetInfo?.last_synchronized ? formatDate(sheetInfo.last_synchronized) : "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col justify-between rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 p-5 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-xs">
                      <Trash2 size={16} />
                      Delete Excel Sheet
                    </div>
                    <p className="mt-1.5 text-xs text-rose-600/90 dark:text-rose-300/80 leading-relaxed">
                      Delete the maintained Excel file from disk. You can regenerate it anytime.
                    </p>
                  </div>

                  {confirmDelete ? (
                    <div className="space-y-2 pt-2 border-t border-rose-200 dark:border-rose-900/60">
                      <p className="text-[11px] font-semibold text-rose-900 dark:text-rose-200">
                        Confirm deletion?
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="flex-1 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold bg-white dark:bg-slate-900"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteSheet}
                          disabled={deleting}
                          className="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-sm"
                        >
                          {deleting ? "Deleting..." : "Confirm"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      disabled={!sheetInfo?.exists || deleting}
                      className="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Delete File
                    </button>
                  )}
                </div>

                <div className="flex flex-col justify-between rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 p-5 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-bold text-xs">
                      <RotateCcw size={16} />
                      Regenerate Sheet
                    </div>
                    <p className="mt-1.5 text-xs text-indigo-600/90 dark:text-indigo-300/80 leading-relaxed">
                      Recreate and format the complete Excel workbook using live database records.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleRegenerateSheet}
                    disabled={regenerating}
                    className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {regenerating ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 size={13} className="animate-spin" />
                        Regenerating...
                      </span>
                    ) : (
                      "Regenerate Now"
                    )}
                  </button>
                </div>

                <div className="flex flex-col justify-between rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-5 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                      <Download size={16} />
                      Download Sheet
                    </div>
                    <p className="mt-1.5 text-xs text-emerald-600/90 dark:text-emerald-300/80 leading-relaxed">
                      Download the formatted .xlsx workbook directly to your local machine.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadSheet}
                    disabled={downloading}
                    className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {downloading ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 size={13} className="animate-spin" />
                        Downloading...
                      </span>
                    ) : (
                      "Download (.xlsx)"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 px-6 py-3.5 sm:px-7">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Excel sheet changes are synchronized directly with database credentials.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center rounded-xl bg-slate-900 dark:bg-slate-100 px-4 text-xs font-semibold text-white dark:text-slate-900 transition hover:bg-slate-800 dark:hover:bg-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}