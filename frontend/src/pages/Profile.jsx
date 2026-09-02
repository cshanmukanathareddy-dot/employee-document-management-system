import {
  CalendarDays,
  Building2,
  FolderOpen,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User,
  BriefcaseBusiness,
} from "lucide-react";

import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user } = useAuth();

  const firstLetter =
    user?.full_name
      ?.charAt(0)
      ?.toUpperCase() || "U";

  const formattedStatus =
    user?.status
      ? user.status.charAt(0).toUpperCase() +
        user.status.slice(1)
      : "Unknown";

  return (
    <div className="min-h-screen bg-slate-50">

      {/* =====================================================
          SIDEBAR
          ===================================================== */}

      <Sidebar />

      {/* =====================================================
          MAIN CONTENT
          ===================================================== */}

      <main className="ml-0 lg:ml-64">

        <Navbar title="My Profile" />

        <div className="p-4 sm:p-6 lg:p-8">

          {/* =================================================
              PAGE INTRO
              ================================================= */}

          <div className="mb-7">

            <div className="flex items-center gap-2 text-sm font-medium text-indigo-600">
              <User size={16} />

              <span>
                Employee Profile
              </span>
            </div>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              My Profile
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              View your personal and employment information.
            </p>

          </div>

          {/* =================================================
              PROFILE HEADER
              ================================================= */}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 px-8 py-8">

              {/* Decorative circles */}

              <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10" />

              <div className="absolute -bottom-28 right-24 h-64 w-64 rounded-full bg-white/[0.05]" />

              <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">

                {/* USER */}

                <div className="flex items-center gap-5">

                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-3xl font-bold text-white shadow-lg backdrop-blur-sm">
                    {firstLetter}
                  </div>

                  <div>

                    <h2 className="text-2xl font-bold tracking-tight text-white">
                      {user?.full_name || "Employee"}
                    </h2>

                    <p className="mt-1 flex items-center gap-2 text-sm text-indigo-100">
                      <BriefcaseBusiness
                        size={15}
                      />

                      {user?.designation ||
                        "Employee"}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">

                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-100">

                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />

                        {formattedStatus}

                      </span>

                      {user?.employee_id && (
                        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-indigo-100">
                          ID: {user.employee_id}
                        </span>
                      )}

                    </div>

                  </div>

                </div>

                {/* PROFILE BADGE */}

                <div className="hidden rounded-2xl border border-white/10 bg-white/10 px-5 py-4 backdrop-blur-sm sm:block">

                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-200">
                    Account
                  </p>

                  <p className="mt-1 text-sm font-semibold text-white">
                    Active Profile
                  </p>

                </div>

              </div>

            </div>

            {/* =================================================
                QUICK INFORMATION
                ================================================= */}

            <div className="grid border-b border-slate-100 sm:grid-cols-3">

              <QuickInfo
                icon={<Building2 size={17} />}
                label="Department"
                value={
                  user?.department ||
                  "-"
                }
              />

              <QuickInfo
                icon={<BriefcaseBusiness size={17} />}
                label="Designation"
                value={
                  user?.designation ||
                  "-"
                }
              />

              <QuickInfo
                icon={<CalendarDays size={17} />}
                label="Joining Date"
                value={
                  user?.joining_date
                    ? new Date(
                        user.joining_date
                      ).toLocaleDateString()
                    : "-"
                }
              />

            </div>

            {/* =================================================
                PERSONAL & EMPLOYMENT DETAILS
                ================================================= */}

            <div className="p-4 sm:p-6 lg:p-8">

              <div className="mb-6">

                <h3 className="text-base font-bold text-slate-900">
                  Personal & Employment Information
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Your registered employee information.
                </p>

              </div>

              <div className="grid gap-4 md:grid-cols-2">

                <Info
                  icon={<User size={18} />}
                  label="Full Name"
                  value={user?.full_name}
                />

                <Info
                  icon={<User size={18} />}
                  label="Employee ID"
                  value={user?.employee_id}
                />

                <Info
                  icon={<Mail size={18} />}
                  label="Email Address"
                  value={user?.email}
                />

                <Info
                  icon={<Phone size={18} />}
                  label="Mobile Number"
                  value={user?.mobile_number}
                />

                <Info
                  icon={<Building2 size={18} />}
                  label="Department"
                  value={user?.department}
                />

                <Info
                  icon={<BriefcaseBusiness size={18} />}
                  label="Designation"
                  value={user?.designation}
                />

                <Info
                  icon={<CalendarDays size={18} />}
                  label="Joining Date"
                  value={
                    user?.joining_date
                      ? new Date(
                          user.joining_date
                        ).toLocaleDateString()
                      : "-"
                  }
                />

                <Info
                  icon={<Phone size={18} />}
                  label="Emergency Contact"
                  value={
                    user?.emergency_contact
                  }
                />

                <Info
                  icon={<MapPin size={18} />}
                  label="Address"
                  value={user?.address}
                  fullWidth
                />

              </div>

            </div>

          </div>

          {/* =================================================
              DOCUMENT DIRECTORY
              ================================================= */}

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

              <div className="flex items-center gap-4">

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <FolderOpen
                    size={20}
                  />
                </div>

                <div>

                  <h3 className="text-sm font-bold text-slate-900">
                    Document Directory
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    Your employee documents are stored in your
                    assigned directory.
                  </p>

                </div>

              </div>

              <div className="max-w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:max-w-sm">

                <p className="break-all text-xs font-semibold text-slate-700">
                  {user?.directory_name ||
                    "No directory assigned"}
                </p>

              </div>

            </div>

          </div>

          {/* =================================================
              ACCOUNT INFORMATION
              ================================================= */}

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="mb-5 flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <ShieldCheck
                  size={19}
                />
              </div>

              <div>

                <h3 className="text-sm font-bold text-slate-900">
                  Account Information
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  Basic information about your EDMS account.
                </p>

              </div>

            </div>

            <div className="grid gap-4 sm:grid-cols-2">

              <Info
                icon={<ShieldCheck size={18} />}
                label="Account Status"
                value={formattedStatus}
              />

              <Info
                icon={<CalendarDays size={18} />}
                label="Account Created"
                value={
                  user?.created_at
                    ? new Date(
                        user.created_at
                      ).toLocaleDateString()
                    : "-"
                }
              />

            </div>

          </div>

        </div>

      </main>

    </div>
  );
}

/* =========================================================
   QUICK INFO
   ========================================================= */

function QuickInfo({
  icon,
  label,
  value,
}) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 p-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
        {icon}
      </div>

      <div className="min-w-0">

        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
          {label}
        </p>

        <p className="mt-1 truncate text-sm font-semibold text-slate-800">
          {value || "-"}
        </p>

      </div>

    </div>
  );
}

/* =========================================================
   INFORMATION CARD
   ========================================================= */

function Info({
  icon,
  label,
  value,
  fullWidth = false,
}) {
  return (
    <div
      className={`group flex min-w-0 items-start gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition hover:border-indigo-200 hover:bg-indigo-50/30 ${
        fullWidth
          ? "md:col-span-2"
          : ""
      }`}
    >

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm ring-1 ring-slate-100 transition group-hover:text-indigo-600">
        {icon}
      </div>

      <div className="min-w-0">

        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
          {label}
        </p>

        <p className="mt-1 break-words text-sm font-semibold text-slate-800">
          {value || "-"}
        </p>

      </div>

    </div>
  );
}