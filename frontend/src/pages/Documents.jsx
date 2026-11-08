import {
  ArrowDownToLine,
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  FolderOpen,
  Info,
  Link2,
  Loader2,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import api, { API_URL } from "../services/api";
import { triggerBlobDownload } from "../utils/downloadHelper";
import { buildPublicDocumentUrl } from "../utils/publicUrl";

export default function Documents() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const userRole = String(user?.role || "").toLowerCase().trim();
  const isAdmin = userRole === "admin" || userRole === "administrator";
  const isReadOnlyEmployee = userRole === "readonlyemployee";
  const canModify = userRole === "employee" && String(user?.status || "").toLowerCase() === "active";

  const [employeeFile, setEmployeeFile] = useState(null);
  const [employeeCategory, setEmployeeCategory] = useState("Other");
  const [employeeUploading, setEmployeeUploading] = useState(false);
  const employeeInputRef = useRef(null);
  const [employeeDragActive, setEmployeeDragActive] = useState(false);

  const [adminFile, setAdminFile] = useState(null);
  const [documentName, setDocumentName] = useState("");
  const [adminCategory, setAdminCategory] = useState("ID Proof");
  const [shareWith, setShareWith] = useState("all");
  const [department, setDepartment] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [adminUploading, setAdminUploading] = useState(false);
  const adminInputRef = useRef(null);
  const [adminDragActive, setAdminDragActive] = useState(false);

  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  const [extractingId, setExtractingId] = useState(null);
  const [openedFolder, setOpenedFolder] = useState(null);

  const normalizeDocument = (document, source) => {
    return {
      ...document,
      source,
      can_view: source === "admin" ? document.can_view !== false : true,
      can_download: source === "admin" ? document.can_download !== false : true,
      can_delete: source === "own" ? true : Boolean(document.can_delete),
      document_name:
        document.document_name ||
        document.name ||
        document.filename ||
        document.file_name ||
        "Document",
      file_size: document.file_size || document.size || 0,
      category: document.category || "Other",
      extracted:
        source === "admin" && !isAdmin
          ? Boolean(document.extracted_for_current_user)
          : Boolean(document.extracted),
    };
  };

  const loadDocuments = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");

      if (isAdmin) {
        const response = await api.get("/admin-documents");
        const rawData = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data?.documents)
          ? response.data.documents
          : [];

        const adminDocs = rawData.map((d) => normalizeDocument(d, "admin"));
        adminDocs.sort((a, b) => new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime());
        setDocuments(adminDocs);
        return;
      }

      if (isReadOnlyEmployee) {
        const response = await api.get("/admin-documents/employee/available");
        const rawData = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data?.documents)
          ? response.data.documents
          : [];

        const adminDocs = rawData.map((d) => normalizeDocument(d, "admin"));
        adminDocs.sort((a, b) => new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime());
        setDocuments(adminDocs);
        return;
      }

      const ownResponse = await api.get("/documents");
      const ownRawData = Array.isArray(ownResponse.data)
        ? ownResponse.data
        : Array.isArray(ownResponse.data?.documents)
        ? ownResponse.data.documents
        : [];
      const ownDocs = ownRawData.map((d) => normalizeDocument(d, "own"));

      let adminDocs = [];
      try {
        const adminResponse = await api.get("/admin-documents/employee/available");
        const adminRawData = Array.isArray(adminResponse.data)
          ? adminResponse.data
          : Array.isArray(adminResponse.data?.documents)
          ? adminResponse.data.documents
          : [];
        adminDocs = adminRawData.map((d) => normalizeDocument(d, "admin"));
      } catch (adminError) {
        console.error("Unable to load admin shared documents:", adminError);
      }

      const combined = [...ownDocs, ...adminDocs];
      combined.sort((a, b) => new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime());
      setDocuments(combined);
    } catch (err) {
      console.error("Load documents error:", err);
      setError(err.response?.data?.detail || "Unable to load documents.");
      setDocuments([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadEmployees = async () => {
    if (!isAdmin) return;
    try {
      setEmployeesLoading(true);
      const response = await api.get("/admin/employees");
      const data = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.employees)
        ? response.data.employees
        : [];
      setEmployees(data);
    } catch (err) {
      console.error("Load employees error:", err);
      setError(err.response?.data?.detail || "Unable to load employees.");
    } finally {
      setEmployeesLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadDocuments();
    if (isAdmin) {
      loadEmployees();
    }
  }, [user, isAdmin, isReadOnlyEmployee]);

  useEffect(() => {
    const query = searchParams.get("search") || "";
    setSearchQuery(query);
  }, [searchParams]);

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    const nextParams = new URLSearchParams(searchParams);
    if (value.trim()) {
      nextParams.set("search", value);
    } else {
      nextParams.delete("search");
    }
    setSearchParams(nextParams, { replace: true });
  };

  const clearSearch = () => {
    handleSearchChange("");
  };

  const filteredDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return documents.filter((doc) => {
      const matchesSearch =
        !query ||
        [doc.document_name, doc.category, doc.file_type, doc.employee_name, doc.department, doc.access_type]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(query));

      const matchesCategory =
        categoryFilter === "all" || String(doc.category || "").toLowerCase() === categoryFilter.toLowerCase();
      const matchesSource = sourceFilter === "all" || doc.source === sourceFilter;

      return matchesSearch && matchesCategory && matchesSource;
    });
  }, [documents, searchQuery, categoryFilter, sourceFilter]);

  const categories = useMemo(() => {
    return [...new Set(documents.map((d) => d.category).filter(Boolean))].sort();
  }, [documents]);

  const documentStats = useMemo(() => ({ total: documents.length }), [documents]);
  const activeFilterCount = [categoryFilter !== "all", sourceFilter !== "all"].filter(Boolean).length;

  const resetFilters = () => {
    setCategoryFilter("all");
    setSourceFilter("all");
  };

  const folderContents = openedFolder
    ? filteredDocuments.filter(
        (doc) => doc.parent_document_id === openedFolder.id && doc.source === openedFolder.source
      )
    : [];

  const libraryDocuments = openedFolder
    ? folderContents
    : filteredDocuments.filter((doc) => !doc.parent_document_id);

  const openedFolderDoc = useMemo(() => {
    if (!openedFolder) return null;
    return (
      documents.find((d) => d.id === openedFolder.id && d.source === openedFolder.source) ||
      openedFolder.document ||
      null
    );
  }, [openedFolder, documents]);

  const canDeleteOpenedFolder = Boolean(
    openedFolderDoc && (isAdmin || (openedFolderDoc.source !== "admin" && !isReadOnlyEmployee && canModify))
  );

  const setAdminSelectedFile = (selectedFile) => {
    if (!selectedFile) return;
    setAdminFile(selectedFile);
    setError("");
    setSuccess("");
    if (!documentName.trim()) {
      setDocumentName(selectedFile.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleAdminFileChange = (event) => {
    setAdminSelectedFile(event.target.files?.[0]);
  };

  const setEmployeeSelectedFile = (selectedFile) => {
    if (!selectedFile) return;
    setEmployeeFile(selectedFile);
    setError("");
    setSuccess("");
  };

  const handleEmployeeFileChange = (event) => {
    setEmployeeSelectedFile(event.target.files?.[0]);
  };

  const handleAdminDrop = (event) => {
    event.preventDefault();
    setAdminDragActive(false);
    setAdminSelectedFile(event.dataTransfer.files?.[0]);
  };

  const handleEmployeeDrop = (event) => {
    event.preventDefault();
    setEmployeeDragActive(false);
    setEmployeeSelectedFile(event.dataTransfer.files?.[0]);
  };

  const handleShareChange = (event) => {
    setShareWith(event.target.value);
    setDepartment("");
    setEmployeeId("");
    setError("");
    setSuccess("");
  };

  const handleAdminUpload = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!adminFile) {
      setError("Please choose a document.");
      return;
    }
    if (!documentName.trim()) {
      setError("Please enter a document name.");
      return;
    }
    if (shareWith === "department" && !department) {
      setError("Please select a department.");
      return;
    }
    if (shareWith === "employee" && !employeeId) {
      setError("Please select an employee.");
      return;
    }

    const formData = new FormData();
    formData.append("file", adminFile);
    formData.append("document_name", documentName.trim());
    formData.append("category", adminCategory);
    formData.append("access_type", shareWith);
    formData.append("can_view", "true");
    formData.append("can_download", "true");

    if (shareWith === "department") formData.append("department", department);
    if (shareWith === "employee") formData.append("employee_id", employeeId);

    try {
      setAdminUploading(true);
      const response = await api.post("/admin-documents", formData);

      setSuccess(response.data?.message || "Document uploaded successfully.");
      setAdminFile(null);
      setDocumentName("");
      setAdminCategory("ID Proof");
      setShareWith("all");
      setDepartment("");
      setEmployeeId("");

      if (adminInputRef.current) adminInputRef.current.value = "";

      if (Array.isArray(response.data?.documents) && response.data.documents.length > 0) {
        const newDocs = response.data.documents.map((d) => normalizeDocument(d, "admin"));
        setDocuments((prev) => {
          const existingIds = new Set(newDocs.map((d) => d.id));
          return [...newDocs, ...prev.filter((d) => !existingIds.has(d.id))];
        });
      }

    } catch (err) {
      console.error("Admin upload error:", err);
      setError(err.response?.data?.detail || "Unable to upload document.");
    } finally {
      setAdminUploading(false);
    }
  };

  const handleEmployeeUpload = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!employeeFile) {
      setError("Please select a file.");
      return;
    }
    if (!canModify) {
      setError("Your account is not allowed to upload documents.");
      return;
    }

    const uploadedFileObj = employeeFile;

    try {
      setEmployeeUploading(true);
      const formData = new FormData();
      formData.append("file", uploadedFileObj);
      formData.append("category", employeeCategory);

      const response = await api.post("/documents", formData);

      setSuccess(response.data?.message || "Document uploaded successfully.");
      setEmployeeFile(null);
      setEmployeeCategory("Other");
      if (employeeInputRef.current) employeeInputRef.current.value = "";

      if (Array.isArray(response.data?.documents) && response.data.documents.length > 0) {
        const newDocs = response.data.documents.map((d) => normalizeDocument(d, "own"));
        setDocuments((prev) => {
          const existingIds = new Set(newDocs.map((d) => d.id));
          return [...newDocs, ...prev.filter((d) => !existingIds.has(d.id))];
        });
      }

    } catch (err) {
      console.error("Employee upload error:", err);
      setError(err.response?.data?.detail || "Upload failed.");
    } finally {
      setEmployeeUploading(false);
    }
  };

  const getDocumentEndpoint = (document, action) => {
    if (document.source === "admin") {
      return isAdmin ? `/admin-documents/${document.id}/${action}` : `/admin-documents/employee/${document.id}/${action}`;
    }
    return `/documents/${document.id}/${action}`;
  };

  const handleExtract = async (document) => {
    if (!document?.is_archive || document.extracted || extractingId === document.id) {
      return;
    }

    try {
      setExtractingId(document.id);
      setError("");
      setSuccess("Extracting ZIP contents… this may take a moment for larger archives.");

      const endpoint =
        document.source === "admin"
          ? isAdmin
            ? `/admin-documents/${document.id}/extract`
            : `/admin-documents/employee/${document.id}/extract`
          : `/documents/${document.id}/extract`;

      const response = await api.post(endpoint);
      setSuccess(response.data?.message || "ZIP extracted successfully.");

      setDocuments((current) =>
        current.map((item) =>
          item.id === document.id && item.source === document.source ? { ...item, extracted: true } : item
        )
      );

      await loadDocuments();
    } catch (err) {
      console.error("ZIP extraction error:", err);
      setError(err.response?.data?.detail || "Unable to extract ZIP file.");
    } finally {
      setExtractingId(null);
    }
  };

  const handleOpenFolder = (document) => {
    if (!document?.is_archive || !document.extracted) return;
    setOpenedFolder({
      id: document.id,
      source: document.source,
      name: document.document_name,
      document: document,
    });
    setError("");
    setSuccess("");
  };

  const closeFolder = () => {
    setOpenedFolder(null);
  };

  const handleDownload = async (document) => {
    try {
      setError("");
      const endpoint = getDocumentEndpoint(document, "download");
      const response = await api.get(endpoint, { responseType: "blob" });
      triggerBlobDownload(
        response,
        document.document_name || "document",
        document.file_type || "application/octet-stream"
      );
    } catch (err) {
      console.error("Download error:", err);
      setError(err.response?.data?.detail || "Unable to download document.");
    }
  };

  const handleView = (document) => {
    if (document?.is_archive) {
      setError("ZIP archives cannot be previewed directly. Use Extract to create and open the folder contents.");
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
      setError("This file type cannot be previewed directly in the browser. Use Download if you need to open the original file.");
      return;
    }

    const directory = document?.directory_name || document?.storage_directory;
    const publicUrl = buildPublicDocumentUrl(directory, document?.document_name);

    if (!publicUrl) {
      setError("This document does not have a public view link available.");
      return;
    }

    const previewWindow = window.open(publicUrl, "_blank");
    if (!previewWindow) {
      setError("Please allow pop-ups in your browser to view documents.");
    }
  };

  const handleDelete = (document) => {
    if (!document) return;
    if (document.source === "admin" && !isAdmin) {
      setError("Admin-shared documents cannot be deleted.");
      return;
    }
    setDocumentToDelete(document);
  };

  const confirmDelete = async () => {
    if (!documentToDelete) return;
    const isFolder = Boolean(documentToDelete.is_archive && documentToDelete.extracted);
    const folderDisplayName = documentToDelete.document_name.replace(/\.zip$/i, "");

    try {
      setIsDeleting(true);
      setError("");
      setSuccess("");

      const endpoint =
        documentToDelete.source === "admin"
          ? `/admin-documents/${documentToDelete.id}`
          : `/documents/${documentToDelete.id}`;

      await api.delete(endpoint);

      if (
        openedFolder &&
        openedFolder.id === documentToDelete.id &&
        openedFolder.source === documentToDelete.source
      ) {
        closeFolder();
      }

      setSuccess(
        isFolder
          ? `Folder "${folderDisplayName}" and its contents deleted successfully.`
          : `Document "${documentToDelete.document_name}" deleted successfully.`
      );
      setDocumentToDelete(null);
      await loadDocuments();
    } catch (err) {
      if (err.response?.status === 404) {
        if (
          openedFolder &&
          openedFolder.id === documentToDelete.id &&
          openedFolder.source === documentToDelete.source
        ) {
          closeFolder();
        }
        setSuccess("Item deleted successfully.");
        setDocumentToDelete(null);
        await loadDocuments();
        return;
      }
      console.error("Delete error:", err);
      setError(
        err.response?.data?.detail || (isFolder ? "Unable to delete folder." : "Unable to delete document.")
      );
      setDocumentToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes || bytes <= 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const clearAdminFile = () => {
    setAdminFile(null);
    if (adminInputRef.current) adminInputRef.current.value = "";
  };

  const clearEmployeeFile = () => {
    setEmployeeFile(null);
    if (employeeInputRef.current) employeeInputRef.current.value = "";
  };

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900">
      <Sidebar />

      <main className="ml-0 min-h-screen lg:ml-64">
        <Navbar title="Documents" />

        <div className="px-6 py-7 lg:px-8">
          <div className="mx-auto max-w-[1500px]">
            {/* Page Header */}
            <div className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-500">
                    Document workspace
                  </span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span className="text-[10px] font-medium text-slate-400">
                    {isAdmin ? "Administration" : "Employee portal"}
                  </span>
                </div>

                <h1 className="text-[28px] font-bold tracking-[-0.04em] text-slate-950">
                  {isAdmin ? "Document management" : isReadOnlyEmployee ? "Shared documents" : "My documents"}
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
                  {isAdmin
                    ? "Upload, organize, and securely share employee documents from one centralized workspace."
                    : isReadOnlyEmployee
                    ? "View and download documents shared with you by the administrator."
                    : "Manage your official documents and keep your employee records organized."}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm sm:flex">
                  <FolderOpen size={16} className="text-indigo-500" />
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">Workspace</p>
                    <p className="text-xs font-bold text-slate-700">
                      {user?.directory_name || "Employee directory"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Alerts */}
            {error && <Alert type="error" message={error} onClose={() => setError("")} />}
            {success && (
              <Alert
                type={extractingId ? "info" : "success"}
                message={success}
                onClose={() => setSuccess("")}
              />
            )}

            {/* Stats */}
            <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DocumentStat
                icon={<FileText size={17} />}
                label="Total documents"
                value={documentStats.total}
                iconClass="bg-indigo-50 text-indigo-600"
              />
            </div>

            {/* Upload Area */}
            {isAdmin ? (
              <AdminUploadPanel
                adminFile={adminFile}
                documentName={documentName}
                adminCategory={adminCategory}
                shareWith={shareWith}
                department={department}
                employeeId={employeeId}
                employees={employees}
                employeesLoading={employeesLoading}
                adminUploading={adminUploading}
                adminDragActive={adminDragActive}
                adminInputRef={adminInputRef}
                setDocumentName={setDocumentName}
                setAdminCategory={setAdminCategory}
                setDepartment={setDepartment}
                setEmployeeId={setEmployeeId}
                handleShareChange={handleShareChange}
                handleAdminFileChange={handleAdminFileChange}
                handleAdminDrop={handleAdminDrop}
                setAdminDragActive={setAdminDragActive}
                handleAdminUpload={handleAdminUpload}
                clearAdminFile={clearAdminFile}
              />
            ) : isReadOnlyEmployee ? (
              <section className="rounded-[22px] border border-violet-200 dark:border-violet-900/50 bg-violet-50/60 dark:bg-violet-950/30 p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-violet-900 dark:text-violet-200">Read-only access</p>
                    <p className="mt-1 text-xs leading-5 text-violet-700 dark:text-violet-300">
                      You can view and download administrator-uploaded documents. Uploading and deletion are disabled for this account.
                    </p>
                  </div>
                </div>
              </section>
            ) : (
              <EmployeeUploadPanel
                employeeFile={employeeFile}
                employeeCategory={employeeCategory}
                employeeUploading={employeeUploading}
                employeeDragActive={employeeDragActive}
                employeeInputRef={employeeInputRef}
                canModify={canModify}
                setEmployeeCategory={setEmployeeCategory}
                handleEmployeeFileChange={handleEmployeeFileChange}
                handleEmployeeDrop={handleEmployeeDrop}
                setEmployeeDragActive={setEmployeeDragActive}
                handleEmployeeUpload={handleEmployeeUpload}
                clearEmployeeFile={clearEmployeeFile}
              />
            )}

            {/* Document Library Section */}
            <section className="mt-6 overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-5 lg:px-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      {openedFolder ? (
                        <>
                          <button
                            type="button"
                            onClick={closeFolder}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50"
                          >
                            <ArrowLeft size={14} />
                            Back
                          </button>
                          <span className="text-slate-300">/</span>
                          <h2 className="flex min-w-0 items-center gap-2 text-base font-bold tracking-[-0.02em] text-slate-950">
                            <FolderOpen size={17} className="text-amber-600" />
                            <span className="max-w-[420px] truncate">
                              {openedFolder.name.replace(/\.zip$/i, "")}
                            </span>
                          </h2>
                        </>
                      ) : (
                        <>
                          <h2 className="text-base font-bold tracking-[-0.02em] text-slate-950">
                            {isAdmin
                              ? "Managed documents"
                              : isReadOnlyEmployee
                              ? "Administrator documents"
                              : "Document library"}
                          </h2>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                            {filteredDocuments.filter((d) => !d.parent_document_id).length}
                          </span>
                        </>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-slate-400">
                      {openedFolder
                        ? `${folderContents.length} file${folderContents.length === 1 ? "" : "s"} inside this folder.`
                        : searchQuery || activeFilterCount
                        ? "Showing documents matching your current filters."
                        : isAdmin
                        ? "All documents uploaded and managed by the administrator."
                        : "Documents available in your employee workspace."}
                    </p>
                  </div>

                  {openedFolder ? (
                    <div className="flex items-center gap-2">
                      {openedFolderDoc && openedFolderDoc.can_download !== false && (
                        <button
                          type="button"
                          onClick={() => handleDownload(openedFolderDoc)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/40 px-3.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 transition hover:border-indigo-300 hover:bg-indigo-100 shadow-sm"
                          title="Download this entire folder as a ZIP archive"
                        >
                          <Download size={14} />
                          Download Folder (.zip)
                        </button>
                      )}

                      {canDeleteOpenedFolder && (
                        <button
                          type="button"
                          onClick={() => handleDelete(openedFolderDoc)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 text-xs font-bold text-red-600 transition hover:border-red-300 hover:bg-red-100 shadow-sm"
                          title="Delete this entire folder and all its contents"
                        >
                          <Trash2 size={14} />
                          Delete Folder
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="flex h-10 w-full min-w-0 items-center rounded-xl sm:min-w-[260px] border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 px-3 transition focus-within:border-indigo-300 dark:focus-within:border-indigo-500 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:ring-4 focus-within:ring-indigo-50 dark:focus-within:ring-indigo-950/40">
                        <Search size={16} className="shrink-0 text-slate-400 dark:text-slate-500" />
                        <input
                          value={searchQuery}
                          onChange={(e) => handleSearchChange(e.target.value)}
                          placeholder="Search documents..."
                          className="ml-2 min-w-0 flex-1 bg-transparent text-xs font-medium text-slate-700 dark:text-slate-200 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={clearSearch}
                            className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowFilters((prev) => !prev)}
                        className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition ${
                          showFilters || activeFilterCount > 0
                            ? "border-indigo-200 bg-indigo-50 text-indigo-600"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <Filter size={15} />
                        Filters
                        {activeFilterCount > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] text-white">
                            {activeFilterCount}
                          </span>
                        )}
                        <ChevronDown size={13} className={`transition-transform ${showFilters ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                  )}
                </div>

                {!openedFolder && showFilters && (
                  <div className="mt-4 grid gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 p-3 sm:grid-cols-3">
                    <FilterSelect
                      label="Category"
                      value={categoryFilter}
                      onChange={setCategoryFilter}
                      options={[
                        { value: "all", label: "All categories" },
                        ...categories.map((c) => ({ value: c, label: c })),
                      ]}
                    />

                    <FilterSelect
                      label="Source"
                      value={sourceFilter}
                      onChange={setSourceFilter}
                      options={[
                        { value: "all", label: "All sources" },
                        { value: "own", label: "My uploads" },
                        { value: "admin", label: "Admin shared" },
                      ]}
                    />

                    {activeFilterCount > 0 && (
                      <div className="sm:col-span-3">
                        <button
                          type="button"
                          onClick={resetFilters}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700"
                        >
                          Clear all filters
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <DocumentList
                documents={libraryDocuments}
                loading={loading}
                isAdmin={isAdmin}
                isReadOnlyEmployee={isReadOnlyEmployee}
                extractingId={extractingId}
                searchQuery={searchQuery}
                onView={handleView}
                onDownload={handleDownload}
                onDelete={handleDelete}
                onExtract={handleExtract}
                onOpenFolder={handleOpenFolder}
                formatSize={formatSize}
              />
            </section>
          </div>
        </div>
      </main>

      {documentToDelete && (
        <DeleteConfirmModal
          document={documentToDelete}
          loading={isDeleting}
          onConfirm={confirmDelete}
          onCancel={() => setDocumentToDelete(null)}
        />
      )}
    </div>
  );
}

function AdminUploadPanel({
  adminFile,
  documentName,
  adminCategory,
  shareWith,
  department,
  employeeId,
  employees,
  employeesLoading,
  adminUploading,
  adminDragActive,
  adminInputRef,
  setDocumentName,
  setAdminCategory,
  setDepartment,
  setEmployeeId,
  handleShareChange,
  handleAdminFileChange,
  handleAdminDrop,
  setAdminDragActive,
  handleAdminUpload,
  clearAdminFile,
}) {
  return (
    <section className="overflow-hidden rounded-[22px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <div className="border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-white to-indigo-50/40 dark:from-slate-900 dark:to-indigo-950/40 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
            <Upload size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-[-0.02em] text-slate-950 dark:text-slate-100">
              Upload and share
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Add a document and control who can access it.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleAdminUpload} className="p-5 lg:p-6">
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <FieldLabel>Document file</FieldLabel>
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                setAdminDragActive(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setAdminDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setAdminDragActive(false);
              }}
              onDrop={handleAdminDrop}
              onClick={() => adminInputRef.current?.click()}
              className={`group flex min-h-[174px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition ${
                adminDragActive
                  ? "border-indigo-400 bg-indigo-50"
                  : adminFile
                  ? "border-emerald-200 bg-emerald-50/40"
                  : "border-slate-200 bg-slate-50/70 hover:border-indigo-300 hover:bg-indigo-50/40"
              }`}
            >
              <input
                ref={adminInputRef}
                id="admin-document-file"
                type="file"
                accept="*/*"
                onChange={handleAdminFileChange}
                className="hidden"
              />

              {adminFile ? (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                    <FileCheck2 size={22} />
                  </div>
                  <p className="mt-3 max-w-full truncate px-4 text-sm font-bold text-slate-800">
                    {adminFile.name}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {formatBytes(adminFile.size)} · Ready to upload
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearAdminFile();
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-500 shadow-sm ring-1 ring-slate-200 hover:text-red-600"
                  >
                    <X size={12} />
                    Remove
                  </button>
                </>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 transition group-hover:scale-105 group-hover:bg-indigo-100">
                    <Upload size={21} />
                  </div>
                  <p className="mt-3 text-sm font-bold text-slate-700">Drop your document here</p>
                  <p className="mt-1 text-[11px] text-slate-400">or click to browse from your computer</p>
                  <span className="mt-3 rounded-lg bg-white px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400 ring-1 ring-slate-200">
                    PDF · DOC · DOCX · Images
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <FieldLabel>Document name</FieldLabel>
              <input
                type="text"
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                placeholder="e.g. Employee Handbook 2026"
                className="input"
              />
            </div>

            <div>
              <FieldLabel>Category</FieldLabel>
              <select
                value={adminCategory}
                onChange={(e) => setAdminCategory(e.target.value)}
                className="input"
              >
                <option value="ID Proof">ID Proof</option>
                <option value="Address Proof">Address Proof</option>
                <option value="Employment">Employment</option>
                <option value="HR">HR</option>
                <option value="Policy">Policy</option>
                <option value="Notice">Notice</option>
                <option value="General">General</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <FieldLabel>Share with</FieldLabel>
              <select value={shareWith} onChange={handleShareChange} className="input">
                <option value="all">All Employees</option>
                <option value="department">Department</option>
                <option value="employee">Specific Employee</option>
              </select>
            </div>
          </div>
        </div>

        {shareWith === "department" && (
          <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Building2 size={16} className="text-indigo-600" />
              <p className="text-xs font-bold text-slate-700">Select department</p>
            </div>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="input bg-white"
            >
              <option value="">Select Department</option>
              <option value="Production">Production</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Quality">Quality</option>
              <option value="Engineering">Engineering</option>
              <option value="HR">HR</option>
              <option value="Administration">Administration</option>
            </select>
          </div>
        )}

        {shareWith === "employee" && (
          <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <User size={16} className="text-indigo-600" />
              <p className="text-xs font-bold text-slate-700">Select employee</p>
            </div>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={employeesLoading}
              className="input bg-white disabled:bg-slate-100"
            >
              <option value="">{employeesLoading ? "Loading employees..." : "Select Employee"}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employee_id} - {emp.full_name}
                </option>
              ))}
            </select>
            {!employeesLoading && employees.length === 0 && (
              <p className="mt-2 text-[11px] font-medium text-red-600">No employees available.</p>
            )}
          </div>
        )}

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
            <ShieldCheck size={16} />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-800">Secure employee access</p>
            <p className="mt-1 text-[11px] leading-5 text-emerald-700">
              Employees who receive this document can automatically view and download it. No additional permissions are required.
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={adminUploading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-xs font-bold text-white shadow-lg shadow-slate-200 transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {adminUploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={16} />
                Upload document
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}

function EmployeeUploadPanel({
  employeeFile,
  employeeCategory,
  employeeUploading,
  employeeDragActive,
  employeeInputRef,
  canModify,
  setEmployeeCategory,
  handleEmployeeFileChange,
  handleEmployeeDrop,
  setEmployeeDragActive,
  handleEmployeeUpload,
  clearEmployeeFile,
}) {
  if (!canModify) {
    return (
      <section className="rounded-[22px] border border-amber-200 bg-amber-50/70 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <Info size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-900">Document modifications are disabled</p>
            <p className="mt-1 text-xs leading-5 text-amber-700">
              Your account is currently <strong>inactive</strong>. Contact an administrator if you need document upload access.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[22px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <div className="border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-white to-indigo-50/40 dark:from-slate-900 dark:to-indigo-950/40 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
            <Upload size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-[-0.02em] text-slate-950 dark:text-slate-100">
              Add a document
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Upload a file to your employee document directory.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleEmployeeUpload} className="p-5 lg:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
          <div>
            <FieldLabel>Document file</FieldLabel>
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                setEmployeeDragActive(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setEmployeeDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setEmployeeDragActive(false);
              }}
              onDrop={handleEmployeeDrop}
              onClick={() => employeeInputRef.current?.click()}
              className={`group flex min-h-[145px] cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed p-5 transition ${
                employeeDragActive
                  ? "border-indigo-400 bg-indigo-50"
                  : employeeFile
                  ? "border-emerald-200 bg-emerald-50/40"
                  : "border-slate-200 bg-slate-50/70 hover:border-indigo-300 hover:bg-indigo-50/40"
              }`}
            >
              <input
                ref={employeeInputRef}
                id="employee-document-file"
                type="file"
                accept="*/*"
                onChange={handleEmployeeFileChange}
                className="hidden"
              />

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                {employeeFile ? <FileCheck2 size={21} /> : <Upload size={21} />}
              </div>

              <div className="min-w-0 flex-1">
                {employeeFile ? (
                  <>
                    <p className="truncate text-sm font-bold text-slate-800">{employeeFile.name}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {formatBytes(employeeFile.size)} · Ready to upload
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearEmployeeFile();
                      }}
                      className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-red-500 hover:text-red-600"
                    >
                      <X size={11} />
                      Remove file
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-slate-700">Drop a file here or browse</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Select the official document you want to store.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div>
            <FieldLabel>Category</FieldLabel>
            <select
              value={employeeCategory}
              onChange={(e) => setEmployeeCategory(e.target.value)}
              className="input"
            >
              <option value="Other">Other</option>
              <option value="Identity">Identity</option>
              <option value="Education">Education</option>
              <option value="Employment">Employment</option>
              <option value="Financial">Financial</option>
              <option value="Personal">Personal</option>
              <option value="Compliance">Compliance</option>
            </select>

            <button
              type="submit"
              disabled={employeeUploading || !employeeFile}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-xs font-bold text-white shadow-lg shadow-slate-200 transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {employeeUploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Upload document
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

function DocumentList({
  documents,
  loading,
  isAdmin,
  searchQuery,
  extractingId,
  isReadOnlyEmployee,
  onView,
  onDownload,
  onDelete,
  onExtract,
  onOpenFolder,
  formatSize,
}) {
  if (loading) {
    return (
      <div className="divide-y divide-slate-100">
        {Array.from({ length: 4 }).map((_, index) => (
          <DocumentSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (!documents.length) {
    return (
      <div className="px-6 py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <FileText size={25} />
        </div>
        <h3 className="mt-4 text-sm font-bold text-slate-800">
          {searchQuery ? "No matching documents" : "No documents yet"}
        </h3>
        <p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-slate-400">
          {searchQuery
            ? "Try a different document name, category, employee, or status."
            : "Upload a document to start building your secure document library."}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {documents.map((document) => {
        const adminDocument = document.source === "admin";
        return (
          <DocumentRow
            key={`${document.source}-${document.id}`}
            document={document}
            directoryName={document.directory_name || document.storage_directory}
            adminDocument={adminDocument}
            isAdmin={isAdmin}
            isReadOnlyEmployee={isReadOnlyEmployee}
            extractingId={extractingId}
            onView={onView}
            onDownload={onDownload}
            onDelete={onDelete}
            onExtract={onExtract}
            onOpenFolder={onOpenFolder}
            formatSize={formatSize}
          />
        );
      })}
    </div>
  );
}

function DocumentRow({
  document,
  directoryName,
  adminDocument,
  isAdmin,
  isReadOnlyEmployee,
  extractingId,
  onView,
  onDownload,
  onDelete,
  onExtract,
  onOpenFolder,
  formatSize,
}) {
  const [copied, setCopied] = useState(false);

  const targetDir = directoryName || document.directory_name || document.storage_directory;
  const isIndexDoc =
    document.document_name &&
    (document.document_name.toLowerCase() === "index.html" ||
      document.document_name.toLowerCase().endsWith("/index.html"));

  const fullCleanWebUrl = buildPublicDocumentUrl(targetDir, document.document_name);
  const cleanWebPath = fullCleanWebUrl
    ? fullCleanWebUrl.replace(window.location.origin, "")
    : null;

  const handleCopyLink = async () => {
    if (!fullCleanWebUrl) return;
    try {
      await navigator.clipboard.writeText(fullCleanWebUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // ignore
    }
  };

  return (
    <div className="group px-5 py-5 transition hover:bg-slate-50/70 lg:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              isIndexDoc
                ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                : adminDocument
                ? "bg-violet-50 text-violet-600"
                : "bg-indigo-50 text-indigo-600"
            }`}
          >
            {adminDocument ? <ShieldCheck size={19} /> : <FileText size={19} />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p title={document.document_name} className="max-w-[520px] truncate text-sm font-bold text-slate-800">
                {document.document_name}
              </p>

              {isIndexDoc && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  index.html
                </span>
              )}

              {document.is_archive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.05em] text-amber-700">
                  <FolderOpen size={10} />
                  {document.extracted ? "ZIP + Folder ready" : "ZIP archive"}
                </span>
              )}

              {document.parent_document_id && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.05em] text-slate-600">
                  <FolderOpen size={10} />
                  Folder content
                </span>
              )}

              {adminDocument && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.05em] text-violet-600">
                  <ShieldCheck size={10} />
                  Admin shared
                </span>
              )}
            </div>

            {/* VISIBLE CORRESPONDING LINK ON WEBPAGE */}
            {cleanWebPath && (
              <div className="mt-1 flex items-center gap-2">
                <a
                  href={cleanWebPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open link: ${cleanWebPath}`}
                  className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-indigo-600 hover:text-indigo-800 hover:underline max-w-[320px] truncate"
                >
                  <ExternalLink size={10} className="shrink-0" />
                  <span>{cleanWebPath}</span>
                </a>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  title="Copy link"
                  className="text-slate-400 hover:text-indigo-600 transition"
                >
                  {copied ? (
                    <span className="text-[10px] font-bold text-emerald-600">Copied!</span>
                  ) : (
                    <Copy size={11} />
                  )}
                </button>
              </div>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[10px] text-slate-400">
              <span className="font-semibold text-slate-500">{document.category || "Other"}</span>
              <span className="text-slate-300">•</span>
              <span>{formatSize(document.file_size)}</span>

              {document.file_type && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="uppercase">
                    {String(document.file_type)
                      .replace("application/", "")
                      .replace("image/", "")
                      .slice(0, 12)}
                  </span>
                </>
              )}

              {!adminDocument && document.version && (
                <>
                  <span className="text-slate-300">•</span>
                  <span>v{document.version}</span>
                </>
              )}

              {document.uploaded_at && (
                <>
                  <span className="text-slate-300">•</span>
                  <span>{formatDate(document.uploaded_at)}</span>
                </>
              )}
            </div>

            {isAdmin && adminDocument && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-[9px] font-bold text-slate-500">
                  {document.access_type === "all" ? (
                    <>
                      <User size={10} />
                      All employees
                    </>
                  ) : document.access_type === "department" ? (
                    <>
                      <Building2 size={10} />
                      {document.department}
                    </>
                  ) : (
                    <>
                      <User size={10} />
                      {document.employee_name || "Selected employee"}
                    </>
                  )}
                </span>

                {document.employee_name && (
                  <span className="text-[10px] text-slate-400">
                    Assigned to <strong className="text-slate-600">{document.employee_name}</strong>
                  </span>
                )}
              </div>
            )}

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.05em] text-emerald-700">
                <Check size={11} />
                Uploaded
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-slate-100 pt-3 xl:border-0 xl:pt-0">
          {document.is_archive && !document.extracted && !isReadOnlyEmployee && document.can_view !== false && (
            <button
              type="button"
              onClick={() => onExtract(document)}
              disabled={extractingId === document.id}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 text-[11px] font-bold text-amber-700 transition hover:border-amber-300 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {extractingId === document.id ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FolderOpen size={14} />
              )}
              {extractingId === document.id ? "Extracting…" : "Extract"}
            </button>
          )}

          {document.is_archive && document.extracted && (
            <button
              type="button"
              onClick={() => onOpenFolder(document)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-bold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
            >
              <FolderOpen size={14} />
              Open Folder
            </button>
          )}

          {cleanWebPath && (
            <button
              type="button"
              onClick={handleCopyLink}
              title="Copy link"
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-bold transition ${
                copied
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              {copied ? <Check size={13} className="text-emerald-600" /> : <Link2 size={13} />}
              {copied ? "Copied!" : "Copy Link"}
            </button>
          )}

          <button
            type="button"
            onClick={() => onView(document)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 text-[11px] font-bold text-indigo-600 transition hover:border-indigo-300 hover:bg-indigo-50"
          >
            <Eye size={14} />
            View
          </button>

          {document.can_download !== false && (
            <button
              type="button"
              onClick={() => onDownload(document)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 transition hover:bg-slate-100"
            >
              <ArrowDownToLine size={14} />
              Download
            </button>
          )}

          {(isAdmin || (!adminDocument && !isReadOnlyEmployee)) && (
            <button
              type="button"
              onClick={() => onDelete(document)}
              title={document.is_archive && document.extracted ? "Delete folder" : "Delete document"}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-white text-red-500 transition hover:border-red-200 hover:bg-red-50"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DocumentSkeleton() {
  return (
    <div className="flex items-center gap-3.5 px-5 py-5 lg:px-6">
      <div className="h-11 w-11 animate-pulse rounded-xl bg-slate-100" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-56 animate-pulse rounded bg-slate-100" />
        <div className="h-2.5 w-72 animate-pulse rounded bg-slate-100" />
        <div className="h-2.5 w-24 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="hidden gap-2 sm:flex">
        <div className="h-9 w-16 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-9 w-24 animate-pulse rounded-lg bg-slate-100" />
      </div>
    </div>
  );
}

function DocumentStat({ icon, label, value, iconClass }) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.09em] text-slate-400">{label}</p>
        <p className="mt-0.5 text-lg font-bold tracking-[-0.03em] text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
      {children}
    </label>
  );
}

function Alert({ type, message, onClose }) {
  const isError = type === "error";
  const isInfo = type === "info";

  return (
    <div
      className={`mb-5 flex items-start justify-between gap-4 rounded-2xl border px-4 py-3.5 ${
        isError
          ? "border-red-200 bg-red-50 text-red-700"
          : isInfo
          ? "border-indigo-200 bg-indigo-50 text-indigo-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      <div className="flex items-start gap-2.5">
        {isError ? (
          <XCircle size={16} className="mt-0.5 shrink-0" />
        ) : isInfo ? (
          <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" />
        ) : (
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
        )}
        <span className="text-xs font-semibold leading-5">{message}</span>
      </div>
      <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-1 transition hover:bg-black/5">
        <X size={15} />
      </button>
    </div>
  );
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function DeleteConfirmModal({ document, loading, onConfirm, onCancel }) {
  if (!document) return null;
  const isFolder = Boolean(document.is_archive && document.extracted);
  const displayName = document.document_name.replace(/\.zip$/i, "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600">
            <Trash2 size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isFolder ? "Delete folder" : "Delete document"}
            </h3>
            <p className="text-xs text-slate-500">This action cannot be undone.</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200/80 p-3.5">
          <p className="text-xs font-bold text-slate-800 truncate">
            {isFolder ? `📁 ${displayName}` : `📄 ${document.document_name}`}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {isFolder
              ? "All files extracted inside this folder will also be permanently deleted from physical storage and your document library."
              : "This document will be permanently removed from your storage."}
          </p>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-xs font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 size={14} />
                {isFolder ? "Delete folder" : "Delete document"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}