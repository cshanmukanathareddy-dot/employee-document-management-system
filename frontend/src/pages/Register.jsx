import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, HardDrive, ShieldCheck } from "lucide-react";

import api, { getErrorMessage } from "../services/api";
import { STANDARD_STORAGE_PRESETS, convertToGb } from "../utils/storageHelper";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    employee_id: "",
    full_name: "",
    email: "",
    password: "",
    mobile_number: "",
    department: "",
    designation: "",
    joining_date: "",
    aadhaar_number: "",
    pan_number: "",
    address: "",
    emergency_contact: "",
    directory_name: "",
    storage_gb: "2",
  });

  const [selectedStoragePreset, setSelectedStoragePreset] = useState("2");
  const [customStorageValue, setCustomStorageValue] = useState("500");
  const [customStorageUnit, setCustomStorageUnit] = useState("MB");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const updateField = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDirectoryChange = (e) => {
    const value = e.target.value;
    if (/^[A-Za-z0-9_]*$/.test(value)) {
      setForm((prev) => ({ ...prev, directory_name: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!termsAccepted) {
      setError("You must accept the Terms and Conditions before registering.");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/auth/register", {
        ...form,
        terms_accepted: termsAccepted,
      });
      setSuccess(response.data.message);
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setError(getErrorMessage(err, "Registration failed."));
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <Link
            to="/login"
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-600"
          >
            <ArrowLeft size={18} />
            Back to login
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <ShieldCheck size={22} />
            </div>
            <span className="font-bold text-slate-900">EDMS</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Request Portal Access</h1>
            <p className="mt-2 text-slate-500">
              Submit your details to request access to the EDMS portal. An administrator will review your request and assign the appropriate access level.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <CheckCircle2 size={18} />
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <section>
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Basic Information</h2>
              <div className="grid gap-5 md:grid-cols-2">
                <Input label="Employee ID" name="employee_id" value={form.employee_id} onChange={updateField} placeholder="EMP001" required />
                <Input label="Full Name" name="full_name" value={form.full_name} onChange={updateField} placeholder="John Reddy" required />
                <Input label="Email" name="email" type="email" value={form.email} onChange={updateField} placeholder="john@company.com" required />
                <Input label="Password" name="password" type="password" value={form.password} onChange={updateField} placeholder="Minimum 6 characters" required />
                <Input label="Mobile Number" name="mobile_number" value={form.mobile_number} onChange={updateField} placeholder="9876543210" required />
                <Input label="Department" name="department" value={form.department} onChange={updateField} placeholder="Finance" required />
                <Input label="Designation" name="designation" value={form.designation} onChange={updateField} placeholder="Software Engineer" required />
                <Input label="Joining Date" name="joining_date" type="date" value={form.joining_date} onChange={updateField} required />
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Official Information</h2>
              <div className="grid gap-5 md:grid-cols-2">
                <Input label="Aadhaar Number" name="aadhaar_number" value={form.aadhaar_number} onChange={updateField} placeholder="XXXX XXXX XXXX" required />
                <Input label="PAN Number" name="pan_number" value={form.pan_number} onChange={updateField} placeholder="ABCDE1234F" required />
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">Address</label>
                  <textarea
                    name="address"
                    value={form.address}
                    onChange={updateField}
                    rows="3"
                    required
                    placeholder="Enter complete address"
                    className={inputClass}
                  />
                </div>
                <Input label="Emergency Contact" name="emergency_contact" value={form.emergency_contact} onChange={updateField} placeholder="9876543210" required />
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-2">
                <HardDrive size={20} className="text-indigo-600" />
                <h2 className="text-lg font-semibold text-slate-900">Storage Allocation</h2>
              </div>
              <p className="mb-4 text-sm text-slate-500">
                Choose the initial storage allocation for your employee documents. Sub-1 GB (500 MB) and standard GB quotas are both supported.
              </p>

              <div className="grid gap-3 sm:grid-cols-3 max-w-2xl mb-4">
                {STANDARD_STORAGE_PRESETS.map((preset) => {
                  const isSelected = selectedStoragePreset === String(preset.gb);
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setSelectedStoragePreset(String(preset.gb));
                        setForm((prev) => ({ ...prev, storage_gb: String(preset.gb) }));
                      }}
                      className={`relative flex flex-col items-start p-4 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-base font-bold text-slate-900">{preset.label}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                        }`}>
                          {preset.sublabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{preset.description}</p>
                    </button>
                  );
                })}
              </div>

              <div className="max-w-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStoragePreset("custom");
                    const converted = convertToGb(customStorageValue, customStorageUnit);
                    setForm((prev) => ({ ...prev, storage_gb: String(converted || 0.5) }));
                  }}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                    selectedStoragePreset === "custom"
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Custom storage amount...
                </button>

                {selectedStoragePreset === "custom" && (
                  <div className="mt-3 p-4 rounded-xl border border-indigo-100 bg-indigo-50/30 flex flex-col sm:flex-row items-center gap-3">
                    <div className="flex-1 w-full">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Enter custom storage
                      </label>
                      <input
                        type="number"
                        min={customStorageUnit === "MB" ? "100" : "0.1"}
                        max={customStorageUnit === "MB" ? "2048" : "2"}
                        step={customStorageUnit === "MB" ? "50" : "0.1"}
                        value={customStorageValue}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomStorageValue(val);
                          const converted = convertToGb(val, customStorageUnit);
                          setForm((prev) => ({ ...prev, storage_gb: String(converted || 0.5) }));
                        }}
                        placeholder={customStorageUnit === "MB" ? "e.g. 500" : "e.g. 0.5"}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="w-full sm:w-32">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Unit</label>
                      <select
                        value={customStorageUnit}
                        onChange={(e) => {
                          const unit = e.target.value;
                          setCustomStorageUnit(unit);
                          const converted = convertToGb(customStorageValue, unit);
                          setForm((prev) => ({ ...prev, storage_gb: String(converted || 0.5) }));
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
                      >
                        <option value="MB">MB (Megabytes)</option>
                        <option value="GB">GB (Gigabytes)</option>
                      </select>
                    </div>

                    <div className="pt-4 text-xs font-medium text-slate-500">
                      Selected: <strong className="text-slate-900">{form.storage_gb} GB</strong>
                    </div>
                  </div>
                )}

                <p className="mt-2 text-xs text-slate-500">
                  Initial quota ranges from 100 MB up to 2 GB. Additional storage can be requested anytime from the administrator.
                </p>
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-slate-900">Document Directory</h2>
              <p className="mb-4 text-sm text-slate-500">
                Choose a unique name for your personal document folder.
              </p>
              <div className="max-w-xl">
                <Input
                  label="Directory Name"
                  name="directory_name"
                  value={form.directory_name}
                  onChange={handleDirectoryChange}
                  placeholder="john_reddy"
                  required
                />
                <p className="mt-2 text-xs text-slate-500">Only letters, numbers and underscores are allowed.</p>
              </div>
            </section>

            <section>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h2 className="mb-2 text-lg font-semibold text-slate-900">Terms and Conditions</h2>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
                  <p>By registering for the EDMS portal, you confirm that the information you provide is accurate and belongs to you.</p>
                  <p className="mt-2">You agree to use the system only for authorized employee and organizational document management purposes.</p>
                  <p className="mt-2">You are responsible for keeping your password confidential and for using the portal in accordance with organizational policies.</p>
                  <p className="mt-2">Documents and personal information must not be uploaded, accessed, shared, or downloaded without proper authorization. Access may be restricted or revoked by an administrator.</p>
                  <p className="mt-2">Your registration request will remain pending until reviewed by an administrator. Submission of this form does not guarantee access.</p>
                  <p className="mt-2">The organization may maintain account and document records for legitimate operational, security, compliance, and audit purposes.</p>
                </div>

                <label className="mt-4 flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-700">
                    I have read and agree to the Terms and Conditions.
                  </span>
                </label>
              </div>
            </section>

            <button
              type="submit"
              disabled={loading || !termsAccepted}
              className="w-full rounded-xl bg-indigo-600 py-3.5 font-semibold text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? "Submitting request..." : "Submit Registration Request"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Input({ label, name, type = "text", value, onChange, placeholder, required }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        min={type === "number" ? "0.1" : undefined}
        max={type === "number" ? "2" : undefined}
        step={type === "number" ? "0.1" : undefined}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
      />
    </div>
  );
}