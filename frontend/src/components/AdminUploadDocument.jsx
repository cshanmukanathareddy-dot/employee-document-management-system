import {
  Upload,
  X,
  FileText,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import api from "../services/api";


export default function AdminUploadDocument({
  onClose,
  onUploaded,
}) {

  const [file, setFile] =
    useState(null);

  const [documentName, setDocumentName] =
    useState("");

  const [category, setCategory] =
    useState("Other");

  const [access, setAccess] =
    useState("all");

  const [department, setDepartment] =
    useState("");

  const [employeeId, setEmployeeId] =
    useState("");

  const [permissions, setPermissions] =
    useState({
      view: true,
      download: true,
    });

  const [employees, setEmployees] =
    useState([]);

  const [loadingEmployees, setLoadingEmployees] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");


  // ==================================================
  // LOAD EMPLOYEES
  // ==================================================

  useEffect(() => {

    const loadEmployees = async () => {

      try {

        setLoadingEmployees(true);

        const response =
          await api.get(
            "/admin/employees"
          );

        setEmployees(
          response.data
        );

      } catch (error) {

        setError(
          error.response?.data?.detail ||
          "Unable to load employees."
        );

      } finally {

        setLoadingEmployees(false);

      }

    };

    loadEmployees();

  }, []);


  // ==================================================
  // FILE SELECT
  // ==================================================

  const handleFileChange = (
    event
  ) => {

    const selectedFile =
      event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    setFile(selectedFile);

    setDocumentName(
      selectedFile.name
    );

    setError("");
    setSuccess("");

  };


  // ==================================================
  // PERMISSION CHANGE
  // ==================================================

  const togglePermission = (
    permission
  ) => {

    setPermissions(
      (previous) => ({
        ...previous,
        [permission]:
          !previous[permission],
      })
    );

  };


  // ==================================================
  // UPLOAD
  // ==================================================

  const handleUpload = async (
    event
  ) => {

    event.preventDefault();

    setError("");
    setSuccess("");


    if (!file) {

      setError(
        "Please select a document."
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
      access === "department" &&
      !department
    ) {

      setError(
        "Please select a department."
      );

      return;

    }


    if (
      access === "employee" &&
      !employeeId
    ) {

      setError(
        "Please select an employee."
      );

      return;

    }


    if (
      !permissions.view &&
      !permissions.download
    ) {

      setError(
        "At least one permission must be enabled."
      );

      return;

    }


    try {

      setUploading(true);


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
        "access",
        access
      );

      formData.append(
        "department",
        department
      );

      formData.append(
        "employee_id",
        employeeId
      );

      formData.append(
        "can_view",
        permissions.view
      );

      formData.append(
        "can_download",
        permissions.download
      );


      await api.post(
        "/admin/documents/upload",
        formData,
        {}
      );


      setSuccess(
        "Document uploaded successfully."
      );


      setFile(null);

      setDocumentName("");

      setCategory("Other");

      setAccess("all");

      setDepartment("");

      setEmployeeId("");

      setPermissions({
        view: true,
        download: true,
      });


      if (onUploaded) {
        onUploaded();
      }


    } catch (error) {

      setError(
        error.response?.data?.detail ||
        "Unable to upload document."
      );

    } finally {

      setUploading(false);

    }

  };


  return (

    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-6">

      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* HEADER */}

        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">

          <div>

            <h2 className="text-lg font-bold text-slate-900">
              Upload Document
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Upload and control document access.
            </p>

          </div>


          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >

            <X size={20} />

          </button>

        </div>


        {/* FORM */}

        <form
          onSubmit={handleUpload}
          className="max-h-[75vh] overflow-y-auto p-6"
        >

          {/* ERROR */}

          {error && (

            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>

          )}


          {/* SUCCESS */}

          {success && (

            <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>

          )}


          {/* FILE */}

          <div>

            <label className="mb-2 block text-sm font-semibold text-slate-700">
              File
            </label>


            <label className="flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 transition hover:border-indigo-400 hover:bg-indigo-50">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">

                <Upload size={21} />

              </div>


              <div className="min-w-0">

                <p className="text-sm font-semibold text-slate-800">

                  {file
                    ? file.name
                    : "Choose a document"}

                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Click to browse files
                </p>

              </div>


              <input
                type="file"
                accept="*/*"
                onChange={
                  handleFileChange
                }
                className="hidden"
              />

            </label>

          </div>


          {/* DOCUMENT NAME */}

          <div className="mt-5">

            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Document Name
            </label>

            <input
              type="text"
              value={documentName}
              onChange={(e) =>
                setDocumentName(
                  e.target.value
                )
              }
              placeholder="Enter document name"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />

          </div>


          {/* CATEGORY */}

          <div className="mt-5">

            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Category
            </label>

            <select
              value={category}
              onChange={(e) =>
                setCategory(
                  e.target.value
                )
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >

              <option value="Other">
                Other
              </option>

              <option value="Resume">
                Resume
              </option>

              <option value="Identity">
                Identity
              </option>

              <option value="Education">
                Education
              </option>

              <option value="Certificate">
                Certificate
              </option>

              <option value="Employment">
                Employment
              </option>

              <option value="Finance">
                Finance
              </option>

              <option value="HR">
                HR
              </option>

            </select>

          </div>


          {/* ACCESS */}

          <div className="mt-6">

            <label className="mb-3 block text-sm font-semibold text-slate-700">
              Access
            </label>


            <div className="space-y-3">

              {/* ALL */}

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50">

                <input
                  type="radio"
                  name="access"
                  value="all"
                  checked={
                    access === "all"
                  }
                  onChange={() =>
                    setAccess("all")
                  }
                  className="h-4 w-4 accent-indigo-600"
                />

                <div>

                  <p className="text-sm font-semibold text-slate-800">
                    All Employees
                  </p>

                  <p className="text-xs text-slate-500">
                    Make this document available to all employees.
                  </p>

                </div>

              </label>


              {/* DEPARTMENT */}

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50">

                <input
                  type="radio"
                  name="access"
                  value="department"
                  checked={
                    access ===
                    "department"
                  }
                  onChange={() =>
                    setAccess(
                      "department"
                    )
                  }
                  className="h-4 w-4 accent-indigo-600"
                />

                <div>

                  <p className="text-sm font-semibold text-slate-800">
                    Department
                  </p>

                  <p className="text-xs text-slate-500">
                    Make this document available to one department.
                  </p>

                </div>

              </label>


              {/* EMPLOYEE */}

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50">

                <input
                  type="radio"
                  name="access"
                  value="employee"
                  checked={
                    access ===
                    "employee"
                  }
                  onChange={() =>
                    setAccess(
                      "employee"
                    )
                  }
                  className="h-4 w-4 accent-indigo-600"
                />

                <div>

                  <p className="text-sm font-semibold text-slate-800">
                    Specific Employee
                  </p>

                  <p className="text-xs text-slate-500">
                    Make this document available to one employee.
                  </p>

                </div>

              </label>

            </div>

          </div>


          {/* DEPARTMENT */}

          {access ===
            "department" && (

            <div className="mt-5">

              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Department
              </label>

              <select
                value={department}
                onChange={(e) =>
                  setDepartment(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >

                <option value="">
                  Select department
                </option>

                {[
                  ...new Set(
                    employees
                      .map(
                        (employee) =>
                          employee.department
                      )
                      .filter(Boolean)
                  ),
                ].map(
                  (item) => (

                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>

                  )
                )}

              </select>

            </div>

          )}


          {/* EMPLOYEE */}

          {access ===
            "employee" && (

            <div className="mt-5">

              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Employee
              </label>

              <select
                value={employeeId}
                onChange={(e) =>
                  setEmployeeId(
                    e.target.value
                  )
                }
                disabled={
                  loadingEmployees
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
              >

                <option value="">
                  {loadingEmployees
                    ? "Loading employees..."
                    : "Select employee"}
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

                      {employee.full_name}
                      {" — "}
                      {employee.employee_id}

                    </option>

                  )
                )}

              </select>

            </div>

          )}


          {/* PERMISSIONS */}

          <div className="mt-6">

            <label className="mb-3 block text-sm font-semibold text-slate-700">
              Permissions
            </label>


            <div className="grid gap-3 sm:grid-cols-2">

              {/* VIEW */}

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 hover:bg-slate-50">

                <input
                  type="checkbox"
                  checked={
                    permissions.view
                  }
                  onChange={() =>
                    togglePermission(
                      "view"
                    )
                  }
                  className="h-4 w-4 accent-indigo-600"
                />

                <div>

                  <p className="text-sm font-semibold text-slate-800">
                    View
                  </p>

                  <p className="text-xs text-slate-500">
                    Users can open the document.
                  </p>

                </div>

              </label>


              {/* DOWNLOAD */}

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 hover:bg-slate-50">

                <input
                  type="checkbox"
                  checked={
                    permissions.download
                  }
                  onChange={() =>
                    togglePermission(
                      "download"
                    )
                  }
                  className="h-4 w-4 accent-indigo-600"
                />

                <div>

                  <p className="text-sm font-semibold text-slate-800">
                    Download
                  </p>

                  <p className="text-xs text-slate-500">
                    Users can download the document.
                  </p>

                </div>

              </label>

            </div>

          </div>


          {/* ACTIONS */}

          <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-5">

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>


            <button
              type="submit"
              disabled={uploading}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >

              <FileText size={17} />

              {uploading
                ? "Uploading..."
                : "Upload Document"}

            </button>

          </div>

        </form>

      </div>

    </div>

  );

}