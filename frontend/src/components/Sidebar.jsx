import {
  ChevronRight,
  FileText,
  HardDrive,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  User,
  UserRoundCheck,
  Users,
} from "lucide-react";

import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";

import { useAuth } from "../context/AuthContext";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
    setIsMobileOpen(false);
  };

  const getInitials = (name) => {
    if (!name) return "U";

    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  };

  const navClass = ({ isActive }) =>
    [
      "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5",
      "text-[13px] font-semibold transition-all duration-200",
      isActive
        ? "bg-indigo-50 text-indigo-700 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.08)]"
        : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
    ].join(" ");

  const iconClass = (isActive) =>
    `shrink-0 transition-colors ${
      isActive
        ? "text-indigo-600"
        : "text-slate-400 group-hover:text-slate-600"
    }`;

  const adminNavClass = ({ isActive }) =>
    [
      "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5",
      "text-[13px] font-semibold transition-all duration-200",
      isActive
        ? "bg-indigo-50 text-indigo-700 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.08)]"
        : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
    ].join(" ");

  const isAdmin = user?.role === "admin";

  return (
    <>
      <button
        type="button"
        onClick={() => setIsMobileOpen((previous) => !previous)}
        className="fixed left-3 top-3 z-[60] flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-lg shadow-slate-900/5 transition hover:border-indigo-200 hover:text-indigo-600 lg:hidden"
        aria-label={isMobileOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={isMobileOpen}
      >
        {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {isMobileOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[min(82vw,320px)] flex-col border-r border-slate-200/80 bg-white shadow-2xl transition-transform duration-300 lg:w-64 lg:translate-x-0 lg:shadow-none ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
      {/* ==================================================
          BRAND
          ================================================== */}

      <div className="flex h-[76px] shrink-0 items-center border-b border-slate-100 px-5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-[13px] bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 text-white shadow-[0_6px_16px_rgba(79,70,229,0.24)]">
            <div className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-white/15" />
            <ShieldCheck
              size={21}
              strokeWidth={2.2}
              className="relative"
            />
          </div>

          <div className="min-w-0">
            <p className="text-[15px] font-bold tracking-[-0.02em] text-slate-950">
              EDMS
            </p>

            <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Enterprise Workspace
            </p>
          </div>
        </div>
      </div>

      {/* ==================================================
          WORKSPACE
          ================================================== */}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-5">
        <div className="mb-3 px-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            Workspace
          </p>
        </div>

        <nav className="space-y-1" onClick={() => setIsMobileOpen(false)}>
          <NavLink
            to="/dashboard"
            end
            className={navClass}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 h-5 w-0.5 rounded-full bg-indigo-600" />
                )}

                <LayoutDashboard
                  size={18}
                  strokeWidth={isActive ? 2.2 : 2}
                  className={iconClass(isActive)}
                />

                <span className="flex-1">
                  Dashboard
                </span>

                {isActive && (
                  <ChevronRight
                    size={14}
                    className="text-indigo-400"
                  />
                )}
              </>
            )}
          </NavLink>

          <NavLink
            to="/documents"
            className={navClass}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 h-5 w-0.5 rounded-full bg-indigo-600" />
                )}

                <FileText
                  size={18}
                  strokeWidth={isActive ? 2.2 : 2}
                  className={iconClass(isActive)}
                />

                <span className="flex-1">
                  Documents
                </span>

                {isActive && (
                  <ChevronRight
                    size={14}
                    className="text-indigo-400"
                  />
                )}
              </>
            )}
          </NavLink>

          <NavLink
            to="/profile"
            className={navClass}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 h-5 w-0.5 rounded-full bg-indigo-600" />
                )}

                <User
                  size={18}
                  strokeWidth={isActive ? 2.2 : 2}
                  className={iconClass(isActive)}
                />

                <span className="flex-1">
                  My Profile
                </span>

                {isActive && (
                  <ChevronRight
                    size={14}
                    className="text-indigo-400"
                  />
                )}
              </>
            )}
          </NavLink>
        </nav>

        {/* ==================================================
            ADMINISTRATION
            ================================================== */}

        {isAdmin && (
          <>
            <div className="mb-3 mt-8 border-t border-slate-100 px-2.5 pt-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Administration
              </p>
            </div>

            <nav className="space-y-1" onClick={() => setIsMobileOpen(false)}>
              <NavLink
                to="/admin"
                end
                className={adminNavClass}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 h-5 w-0.5 rounded-full bg-indigo-600" />
                    )}

                    <Users
                      size={18}
                      strokeWidth={isActive ? 2.2 : 2}
                      className={
                        isActive
                          ? "text-indigo-600"
                          : "text-slate-400 group-hover:text-slate-600"
                      }
                    />

                    <span className="flex-1">
                      Admin Overview
                    </span>

                    {isActive && (
                      <ChevronRight
                        size={14}
                        className="text-indigo-400"
                      />
                    )}
                  </>
                )}
              </NavLink>

              <NavLink
                to="/admin/requests"
                className={adminNavClass}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 h-5 w-0.5 rounded-full bg-indigo-600" />
                    )}

                    <UserRoundCheck
                      size={18}
                      strokeWidth={isActive ? 2.2 : 2}
                      className={
                        isActive
                          ? "text-indigo-600"
                          : "text-slate-400 group-hover:text-slate-600"
                      }
                    />

                    <span className="flex-1">
                      Registration Requests
                    </span>

                    {isActive && (
                      <ChevronRight
                        size={14}
                        className="text-indigo-400"
                      />
                    )}
                  </>
                )}
              </NavLink>

              <NavLink
                to="/admin/storage-requests"
                className={adminNavClass}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 h-5 w-0.5 rounded-full bg-indigo-600" />
                    )}

                    <HardDrive
                      size={18}
                      strokeWidth={isActive ? 2.2 : 2}
                      className={
                        isActive
                          ? "text-indigo-600"
                          : "text-slate-400 group-hover:text-slate-600"
                      }
                    />

                    <span className="flex-1">
                      Storage Requests
                    </span>

                    {isActive && (
                      <ChevronRight
                        size={14}
                        className="text-indigo-400"
                      />
                    )}
                  </>
                )}
              </NavLink>

              <NavLink
                to="/admin/documents"
                className={adminNavClass}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 h-5 w-0.5 rounded-full bg-indigo-600" />
                    )}

                    <FileText
                      size={18}
                      strokeWidth={isActive ? 2.2 : 2}
                      className={
                        isActive
                          ? "text-indigo-600"
                          : "text-slate-400 group-hover:text-slate-600"
                      }
                    />

                    <span className="flex-1">
                      Document Review
                    </span>

                    {isActive && (
                      <ChevronRight
                        size={14}
                        className="text-indigo-400"
                      />
                    )}
                  </>
                )}
              </NavLink>
            </nav>
          </>
        )}

        {/* ==================================================
            SECURITY NOTE
            ================================================== */}

        <div className="mt-auto pt-8">
          <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-violet-50/50 p-3.5">
            <div className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm">
                <ShieldCheck size={15} />
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-700">
                  Secure workspace
                </p>

                <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
                  Your employee documents are managed
                  securely.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================
          USER AREA
          ================================================== */}

      <div className="shrink-0 border-t border-slate-100 bg-slate-50/50 p-3">
        <div className="mb-2.5 flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 text-xs font-bold text-indigo-700 ring-1 ring-indigo-100">
            {getInitials(user?.full_name)}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-slate-800">
              {user?.full_name || "User"}
            </p>

            <p className="mt-0.5 truncate text-[10px] text-slate-400">
              {user?.email || "Signed in"}
            </p>
          </div>

          {isAdmin ? (
            <span className="rounded-md bg-indigo-50 px-1.5 py-1 text-[9px] font-bold uppercase tracking-wide text-indigo-600">
              Admin
            </span>
          ) : user?.role === "readonlyemployee" ? (
            <span className="rounded-md bg-violet-50 px-1.5 py-1 text-[9px] font-bold uppercase tracking-wide text-violet-600">
              Read Only
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-slate-500 transition hover:bg-red-50 hover:text-red-600"
        >
          <LogOut
            size={18}
            className="text-slate-400 transition group-hover:text-red-500"
          />

          <span>Sign out</span>
        </button>
      </div>
    </aside>
    </>
  );
}