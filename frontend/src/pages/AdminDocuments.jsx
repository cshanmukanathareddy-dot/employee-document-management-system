import { useEffect, useRef, useState } from "react";

import {
  Upload,
  FileText,
  Users,
  Building2,
  User,
  Check,
  Download,
  Eye,
  ShieldCheck,
  FileCheck2,
  X,
  FolderOpen,
  Loader2,
} from "lucide-react";

import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import api from "../services/api";

export default function AdminDocuments() {
  // ==================================================
  // FORM STATE
  // ==================================================

  const [file, setFile] = useState(null);

  const [documentName, setDocumentName] =
    useState("");

  const [category, setCategory] =
    useState("ID Proof");

  const [shareWith, setShareWith] =
    useState("all");

  const [department, setDepartment] =
    useState("");

  const [employeeId, setEmployeeId] =
    useState("");

  const [canView, setCanView] =
    useState(true);

  const [canDownload, setCanDownload] =
    useState(true);

  // ==================================================
  // EMPLOYEES
  // ==================================================

  const [employees, setEmployees] =
    useState([]);

  const [employeesLoading, setEmployeesLoading] =
    useState(false);

  // ==================================================
  // STATUS
  // ==================================================

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  // Uploaded admin documents are listed here so ZIP archives can also
  // be extracted directly from the Admin Document Management page.
  const [adminDocuments, setAdminDocuments] =
    useState([]);

  const [extractingId, setExtractingId] =
    useState(null);

  const [documentsLoading, setDocumentsLoading] =
    useState(true);

  const fileInputRef = useRef(null);

  // ==================================================
  // LOAD EMPLOYEES
  // ==================================================

  useEffect(() => {
    loadEmployees();
    loadAdminDocuments();
  }, []);

  async function loadEmployees() {
    try {
      setEmployeesLoading(true);
      setError("");

      const response =
        await api.get("/admin/employees");

      console.log(
        "Employees loaded:",
        response.data
      );

      setEmployees(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (err) {
      console.error(
        "Load employees error:",
        err
      );

      setError(
        err.response?.data?.detail ||
          "Unable to load employees."
      );
    } finally {
      setEmployeesLoading(false);
    }
  }



  async function loadAdminDocuments() {
    try {
      setDocumentsLoading(true);
      const response = await api.get("/admin-documents");
      setAdminDocuments(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (err) {
      console.error(
        "Load admin documents error:",
        err
      );
    } finally {
      setDocumentsLoading(false);
    }
  }

  async function handleAdminExtract(document) {
    if (
      !document?.is_archive ||
      document.extracted ||
      extractingId === document.id
    ) {
      return;
    }

    try {
      setExtractingId(document.id);
      setError("");
      setMessage("Extracting ZIP contents… please keep this page open.");

      const response = await api.post(
        `/admin-documents/${document.id}/extract`
      );

      setMessage(
        response.data?.message ||
          "ZIP extracted successfully into the administrator directory."
      );

      await loadAdminDocuments();
    } catch (err) {
      console.error(
        "Admin ZIP extraction error:",
        err
      );

      setError(
        err.response?.data?.detail ||
          "Unable to extract ZIP file."
      );
    } finally {
      setExtractingId(null);
    }
  }

  // ==================================================
  // FILE SELECT
  // ==================================================

  function handleFileChange(event) {
    const selectedFile =
      event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    setFile(selectedFile);

    setMessage("");
    setError("");

    // Automatically generate document name
    if (!documentName.trim()) {
      const name =
        selectedFile.name.replace(
          /\.[^/.]+$/,
          ""
        );

      setDocumentName(name);
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function removeSelectedFile() {
    setFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setMessage("");
    setError("");
  }

  // ==================================================
  // SHARE TYPE
  // ==================================================

  function handleShareChange(event) {
    const value =
      event.target.value;

    setShareWith(value);

    // Clear previous selections
    setDepartment("");
    setEmployeeId("");

    setMessage("");
    setError("");
  }

  // ==================================================
  // UPLOAD DOCUMENT
  // ==================================================

  async function handleUpload(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    // -----------------------------------------------
    // VALIDATION
    // -----------------------------------------------

    if (!file) {
      setError(
        "Please choose a document."
      );
      return;
    }

    if (!documentName.trim()) {
      setError(
        "Please enter a document name."
      );
      return;
    }

    if (
      !canView &&
      !canDownload
    ) {
      setError(
        "Enable at least View or Download permission."
      );
      return;
    }

    if (
      shareWith === "department" &&
      !department
    ) {
      setError(
        "Please select a department."
      );
      return;
    }

    if (
      shareWith === "employee" &&
      !employeeId
    ) {
      setError(
        "Please select an employee."
      );
      return;
    }

    // -----------------------------------------------
    // FORM DATA
    // -----------------------------------------------

    const formData =
      new FormData();

    formData.append(
      "file",
      file
    );

    formData.append(
      "document_name",
      documentName.trim()
    );

    formData.append(
      "category",
      category
    );

    formData.append(
      "access_type",
      shareWith
    );

    formData.append(
      "can_view",
      String(canView)
    );

    formData.append(
      "can_download",
      String(canDownload)
    );

    if (
      shareWith ===
      "department"
    ) {
      formData.append(
        "department",
        department
      );
    }

    if (
      shareWith ===
      "employee"
    ) {
      formData.append(
        "employee_id",
        employeeId
      );
    }

    // -----------------------------------------------
    // SEND REQUEST
    // -----------------------------------------------

    try {
      setLoading(true);

      const response =
        await api.post(
          "/admin-documents",
          formData
        );

      console.log(
        "Upload response:",
        response.data
      );

      const uploadedCount =
        Number(
          response.data?.document_count || 1
        );

      setMessage(
        uploadedCount > 1
          ? `ZIP extracted successfully. ${uploadedCount} files added to the administrator document library.`
          : "Document uploaded successfully."
      );

      await loadAdminDocuments();

      // -------------------------------------------
      // RESET FORM
      // -------------------------------------------

      setFile(null);

      setDocumentName("");

      setCategory(
        "ID Proof"
      );

      setShareWith("all");

      setDepartment("");

      setEmployeeId("");

      setCanView(true);

      setCanDownload(true);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error(
        "Upload document error:",
        err
      );

      setError(
        err.response?.data?.detail ||
          "Unable to upload document."
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedEmployee =
    employees.find(
      (employee) =>
        String(employee.id) ===
        String(employeeId)
    );

  const sharingLabel =
    shareWith === "all"
      ? "All employees"
      : shareWith === "department"
        ? department || "Select department"
        : selectedEmployee
          ? selectedEmployee.full_name
          : "Select employee";

  // ==================================================
  // RENDER
  // ==================================================

  return (
    <div className="min-h-screen bg-slate-50">

      <Sidebar />

      <main className="ml-0 lg:ml-64">

        <Navbar
          title="Document Management"
        />

        <div className="p-4 sm:p-6 lg:p-8">

          {/* =================================================
              PAGE HEADER
              ================================================= */}

          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

            <div>

              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-indigo-600">
                <ShieldCheck
                  size={14}
                />

                Admin workspace
              </div>

              <h1 className="text-3xl font-bold tracking-[-0.04em] text-slate-950">
                Upload & share documents
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Publish an official document and control exactly
                who can access it and what they can do with it.
              </p>

            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-700">

              <span className="h-2 w-2 rounded-full bg-emerald-500" />

              Secure document workspace

            </div>

          </div>

          {/* =================================================
              SUCCESS / ERROR
              ================================================= */}

          {message && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm">
                <Check
                  size={17}
                />
              </div>

              <div className="pt-0.5">
                <p className="font-bold">
                  Upload complete
                </p>

                <p className="mt-0.5 text-xs text-emerald-700">
                  {message}
                </p>
              </div>

            </div>
          )}

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-red-600 shadow-sm">
                <X
                  size={17}
                />
              </div>

              <div className="pt-0.5">
                <p className="font-bold">
                  Upload could not be completed
                </p>

                <p className="mt-0.5 text-xs text-red-700">
                  {error}
                </p>
              </div>

            </div>
          )}

          {/* =================================================
              MAIN GRID
              ================================================= */}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">

            {/* =================================================
                FORM
                ================================================= */}

            <form
              onSubmit={handleUpload}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >

              {/* FORM HEADER */}

              <div className="border-b border-slate-100 px-7 py-6">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Upload
                      size={19}
                    />
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Document details
                    </h2>

                    <p className="mt-0.5 text-xs text-slate-500">
                      Add the document and configure its access.
                    </p>
                  </div>

                </div>

              </div>

              <div className="p-7">

                {/* =================================================
                    FILE
                    ================================================= */}

                <div className="mb-7">

                  <label className="mb-2.5 block text-xs font-bold uppercase tracking-[0.08em] text-slate-600">
                    Document file
                  </label>

                  <input
                    ref={fileInputRef}
                    id="document-file"
                    type="file"
                    accept="*/*"
                    onChange={handleFileChange}
                    className="sr-only"
                  />

                  {!file ? (
                    <button
                      type="button"
                      onClick={openFilePicker}
                      className="group flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 px-6 py-9 text-center transition hover:border-indigo-300 hover:bg-indigo-50/30"
                    >

                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-100 transition group-hover:scale-105">
                        <Upload
                          size={21}
                        />
                      </div>

                      <p className="mt-4 text-sm font-bold text-slate-800">
                        Choose a document to upload
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Click to browse files from your computer
                      </p>

                      <span className="mt-4 rounded-lg bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 shadow-sm ring-1 ring-slate-200">
                        Select file
                      </span>

                    </button>
                  ) : (
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">

                      <div className="flex items-center gap-4">

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
                          <FileText
                            size={20}
                          />
                        </div>

                        <div className="min-w-0 flex-1">

                          <p className="truncate text-sm font-bold text-slate-800">
                            {file.name}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {formatFileSize(file.size)}
                          </p>

                        </div>

                        <button
                          type="button"
                          onClick={removeSelectedFile}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-red-600"
                          aria-label="Remove selected file"
                        >
                          <X
                            size={17}
                          />
                        </button>

                      </div>

                      <button
                        type="button"
                        onClick={openFilePicker}
                        className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                      >
                        Choose a different file
                      </button>

                    </div>
                  )}

                </div>

                {/* =================================================
                    NAME + CATEGORY
                    ================================================= */}

                <div className="grid gap-5 md:grid-cols-2">

                  <Field
                    label="Document name"
                    htmlFor="document-name"
                    hint="A clear name employees will recognize."
                  >
                    <input
                      id="document-name"
                      type="text"
                      placeholder="e.g. Employee Handbook 2026"
                      value={documentName}
                      onChange={(e) =>
                        setDocumentName(
                          e.target.value
                        )
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field
                    label="Category"
                    htmlFor="category"
                    hint="Choose the closest document category."
                  >
                    <select
                      id="category"
                      value={category}
                      onChange={(e) =>
                        setCategory(
                          e.target.value
                        )
                      }
                      className={inputClass}
                    >
                      <option value="ID Proof">
                        ID Proof
                      </option>

                      <option value="Address Proof">
                        Address Proof
                      </option>

                      <option value="Employment">
                        Employment
                      </option>

                      <option value="HR">
                        HR
                      </option>

                      <option value="Policy">
                        Policy
                      </option>

                      <option value="Notice">
                        Notice
                      </option>

                      <option value="General">
                        General
                      </option>

                      <option value="Other">
                        Other
                      </option>
                    </select>
                  </Field>

                </div>

                {/* =================================================
                    ACCESS
                    ================================================= */}

                <div className="mt-7 border-t border-slate-100 pt-7">

                  <div className="mb-4">

                    <h3 className="text-sm font-bold text-slate-900">
                      Access & visibility
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      Decide who receives access to this document.
                    </p>

                  </div>

                  <Field
                    label="Share with"
                    htmlFor="share-with"
                  >
                    <select
                      id="share-with"
                      value={shareWith}
                      onChange={handleShareChange}
                      className={inputClass}
                    >
                      <option value="all">
                        All Employees
                      </option>

                      <option value="department">
                        Department
                      </option>

                      <option value="employee">
                        Specific Employee
                      </option>
                    </select>
                  </Field>

                  {shareWith ===
                    "department" && (
                    <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">

                      <div className="mb-3 flex items-center gap-2">

                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm">
                          <Building2
                            size={16}
                          />
                        </div>

                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            Department access
                          </p>

                          <p className="text-[10px] text-slate-500">
                            Everyone in the selected department.
                          </p>
                        </div>

                      </div>

                      <select
                        id="department"
                        value={department}
                        onChange={(e) =>
                          setDepartment(
                            e.target.value
                          )
                        }
                        className={inputClass}
                      >
                        <option value="">
                          Select Department
                        </option>

                        <option value="Production">
                          Production
                        </option>

                        <option value="Maintenance">
                          Maintenance
                        </option>

                        <option value="Quality">
                          Quality
                        </option>

                        <option value="Engineering">
                          Engineering
                        </option>

                        <option value="HR">
                          HR
                        </option>

                        <option value="Administration">
                          Administration
                        </option>
                      </select>

                    </div>
                  )}

                  {shareWith ===
                    "employee" && (
                    <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">

                      <div className="mb-3 flex items-center gap-2">

                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm">
                          <User
                            size={16}
                          />
                        </div>

                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            Individual access
                          </p>

                          <p className="text-[10px] text-slate-500">
                            Grant access to one employee.
                          </p>
                        </div>

                      </div>

                      <select
                        id="employee"
                        value={employeeId}
                        onChange={(e) =>
                          setEmployeeId(
                            e.target.value
                          )
                        }
                        disabled={
                          employeesLoading
                        }
                        className={`${inputClass} disabled:cursor-not-allowed disabled:bg-slate-100`}
                      >
                        <option value="">
                          {employeesLoading
                            ? "Loading employees..."
                            : "Select Employee"}
                        </option>

                        {employees.map(
                          (employee) => (
                            <option
                              key={
                                employee.id
                              }
                              value={
                                employee.id
                              }
                            >
                              {employee.employee_id}
                              {" - "}
                              {employee.full_name}
                            </option>
                          )
                        )}
                      </select>

                      {!employeesLoading &&
                        employees.length ===
                          0 && (
                          <p className="mt-2 text-xs font-medium text-red-600">
                            No employees available.
                          </p>
                        )}

                    </div>
                  )}

                </div>

                {/* =================================================
                    PERMISSIONS
                    ================================================= */}

                <div className="mt-7 border-t border-slate-100 pt-7">

                  <div className="mb-4">

                    <h3 className="text-sm font-bold text-slate-900">
                      Permissions
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      Choose what the recipient can do with the file.
                    </p>

                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">

                    <PermissionCard
                      checked={canView}
                      onChange={
                        setCanView
                      }
                      icon={
                        <Eye
                          size={17}
                        />
                      }
                      title="Can view"
                      description="Employee can open and view the document."
                    />

                    <PermissionCard
                      checked={canDownload}
                      onChange={
                        setCanDownload
                      }
                      icon={
                        <Download
                          size={17}
                        />
                      }
                      title="Can download"
                      description="Employee can save a copy of the document."
                    />

                  </div>

                </div>

                {/* =================================================
                    SUBMIT
                    ================================================= */}

                <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">

                  <p className="text-xs text-slate-400">
                    At least one permission must be enabled.
                  </p>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-600 hover:shadow-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />

                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload
                          size={17}
                        />

                        Upload document
                      </>
                    )}
                  </button>

                </div>

              </div>

            </form>

            {/* =================================================
                SUMMARY PANEL
                ================================================= */}

            <aside className="space-y-5">

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <FileCheck2
                      size={19}
                    />
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Upload summary
                    </h2>

                    <p className="text-xs text-slate-500">
                      Review before publishing.
                    </p>
                  </div>

                </div>

                <div className="mt-6 space-y-4">

                  <SummaryRow
                    label="File"
                    value={
                      file?.name ||
                      "No file selected"
                    }
                  />

                  <SummaryRow
                    label="Category"
                    value={category}
                  />

                  <SummaryRow
                    label="Audience"
                    value={sharingLabel}
                  />

                  <SummaryRow
                    label="View access"
                    value={
                      canView
                        ? "Enabled"
                        : "Disabled"
                    }
                    positive={
                      canView
                    }
                  />

                  <SummaryRow
                    label="Download"
                    value={
                      canDownload
                        ? "Enabled"
                        : "Disabled"
                    }
                    positive={
                      canDownload
                    }
                  />

                </div>

              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-indigo-300">
                  <ShieldCheck
                    size={19}
                  />
                </div>

                <h3 className="mt-4 text-sm font-bold">
                  Controlled access
                </h3>

                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Documents are shared according to the access
                  scope and permissions you configure here.
                </p>

                <div className="mt-5 space-y-2">

                  <SecurityPoint
                    text="Role-aware workspace"
                  />

                  <SecurityPoint
                    text="View permission"
                  />

                  <SecurityPoint
                    text="Download permission"
                  />

                </div>

              </div>

              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5">

                <div className="flex items-center gap-3">

                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm">
                    <Users
                      size={17}
                    />
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      Employee directory
                    </p>

                    <p className="text-[10px] text-slate-500">
                      {employeesLoading
                        ? "Loading employees..."
                        : `${employees.length} employees available`}
                    </p>
                  </div>

                </div>

              </div>

            </aside>

          </div>

          {/* =================================================
              ADMIN DOCUMENT LIBRARY
              ================================================= */}

          <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-5">
              <h2 className="text-base font-bold text-slate-900">
                Administrator document library
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                ZIP archives stay intact until you explicitly extract them.
                Extraction is stored in the administrator's own directory.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {documentsLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="animate-pulse px-4 py-5 sm:px-6">
                    <div className="h-4 w-2/3 rounded bg-slate-100" />
                    <div className="mt-2 h-3 w-1/3 rounded bg-slate-100" />
                  </div>
                ))
              ) : adminDocuments.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-slate-400">
                  No administrator documents uploaded yet.
                </div>
              ) : (
                adminDocuments
                  .filter((document) => !document.parent_document_id)
                  .map((document) => (
                    <div
                      key={document.id}
                      className="flex flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-800">
                          {document.document_name}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {document.file_type} · {formatFileSize(document.file_size)}
                        </p>
                      </div>

                      {document.is_archive && !document.extracted ? (
                        <button
                          type="button"
                          onClick={() => handleAdminExtract(document)}
                          disabled={extractingId === document.id}
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-xs font-bold text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {extractingId === document.id ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <FolderOpen size={15} />
                          )}
                          {extractingId === document.id
                            ? "Extracting…"
                            : "Extract"}
                        </button>
                      ) : document.is_archive && document.extracted ? (
                        <span className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-700">
                          <FolderOpen size={15} />
                          Folder ready
                        </span>
                      ) : null}
                    </div>
                  ))
              )}
            </div>
          </section>

        </div>

      </main>

    </div>
  );
}

// =========================================================
// FIELD
// =========================================================

function Field({
  label,
  htmlFor,
  hint,
  children,
}) {
  return (
    <div>

      <label
        htmlFor={htmlFor}
        className="mb-2 block text-xs font-bold uppercase tracking-[0.07em] text-slate-600"
      >
        {label}
      </label>

      {children}

      {hint && (
        <p className="mt-1.5 text-[10px] leading-4 text-slate-400">
          {hint}
        </p>
      )}

    </div>
  );
}

// =========================================================
// PERMISSION CARD
// =========================================================

function PermissionCard({
  checked,
  onChange,
  icon,
  title,
  description,
}) {
  return (
    <label
      className={`group flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
        checked
          ? "border-indigo-200 bg-indigo-50/50"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >

      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(
            event.target.checked
          )
        }
        className="sr-only"
      />

      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
          checked
            ? "bg-indigo-600 text-white"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">

        <span className="flex items-center justify-between gap-2">

          <span className="text-sm font-bold text-slate-800">
            {title}
          </span>

          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
              checked
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-slate-300 bg-white text-transparent"
            }`}
          >
            <Check
              size={12}
              strokeWidth={3}
            />
          </span>

        </span>

        <span className="mt-1 block text-[10px] leading-4 text-slate-500">
          {description}
        </span>

      </span>

    </label>
  );
}

// =========================================================
// SUMMARY ROW
// =========================================================

function SummaryRow({
  label,
  value,
  positive = false,
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">

      <span className="text-xs font-medium text-slate-400">
        {label}
      </span>

      <span
        className={`max-w-[60%] break-words text-right text-xs font-bold ${
          positive
            ? "text-emerald-600"
            : "text-slate-700"
        }`}
      >
        {value}
      </span>

    </div>
  );
}

// =========================================================
// SECURITY POINT
// =========================================================

function SecurityPoint({
  text,
}) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-medium text-slate-300">

      <Check
        size={13}
        className="text-emerald-400"
      />

      {text}

    </div>
  );
}

// =========================================================
// INPUT CLASS
// =========================================================

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50";

// =========================================================
// FILE SIZE
// =========================================================

function formatFileSize(bytes) {
  if (!bytes) {
    return "0 Bytes";
  }

  const units = [
    "Bytes",
    "KB",
    "MB",
    "GB",
  ];

  const index = Math.floor(
    Math.log(bytes) /
      Math.log(1024)
  );

  return `${(
    bytes /
    Math.pow(1024, index)
  ).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}