import {
  Bell,
  ChevronDown,
  Command,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  User,
  X,
} from "lucide-react";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

import api from "../services/api";

export default function Navbar({ title }) {
  const { user } = useAuth();

  const { isDark, toggleTheme } =
    useTheme();

  const navigate = useNavigate();

  const [showNotifications, setShowNotifications] =
    useState(false);

  const [showSearch, setShowSearch] =
    useState(false);

  const [showProfile, setShowProfile] =
    useState(false);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [notifications, setNotifications] =
    useState([]);

  const [notificationCount, setNotificationCount] =
    useState(0);

  const [notificationLoading, setNotificationLoading] =
    useState(false);

  const notificationRef = useRef(null);
  const profileRef = useRef(null);
  const searchInputRef = useRef(null);

  /* =========================================================
     NOTIFICATIONS
     ========================================================= */

  const loadNotifications = async () => {
    try {
      setNotificationLoading(true);

      const response =
        await api.get("/notifications");

      const data = Array.isArray(
        response.data
      )
        ? response.data
        : [];

      setNotifications(data);

      setNotificationCount(
        data.filter(
          (notification) =>
            !notification.is_read
        ).length
      );
    } catch (error) {
      console.error(
        "Unable to load notifications:",
        error
      );
    } finally {
      setNotificationLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();

    const interval = setInterval(
      loadNotifications,
      15000
    );

    return () => {
      clearInterval(interval);
    };
  }, []);

  /* =========================================================
     CLICK OUTSIDE
     ========================================================= */

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(
          event.target
        )
      ) {
        setShowNotifications(false);
      }

      if (
        profileRef.current &&
        !profileRef.current.contains(
          event.target
        )
      ) {
        setShowProfile(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  /* =========================================================
     KEYBOARD SEARCH
     ========================================================= */

  useEffect(() => {
    const handleKeyboardShortcut = (event) => {
      const isShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k";

      if (isShortcut) {
        event.preventDefault();

        setShowSearch(true);
        setShowNotifications(false);
        setShowProfile(false);

        requestAnimationFrame(() => {
          searchInputRef.current?.focus();
        });
      }

      if (
        event.key === "Escape" &&
        showSearch
      ) {
        setSearchQuery("");
        setShowSearch(false);
      }
    };

    document.addEventListener(
      "keydown",
      handleKeyboardShortcut
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyboardShortcut
      );
    };
  }, [showSearch]);

  /* =========================================================
     NOTIFICATION ACTIONS
     ========================================================= */

  const handleNotificationClick = () => {
    const nextState =
      !showNotifications;

    setShowNotifications(nextState);
    setShowSearch(false);
    setShowProfile(false);

    if (nextState) {
      loadNotifications();
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.put(
        `/notifications/${id}/read`
      );

      setNotifications(
        (previous) =>
          previous.map(
            (notification) =>
              notification.id === id
                ? {
                    ...notification,
                    is_read: true,
                  }
                : notification
          )
      );

      setNotificationCount(
        (previous) =>
          Math.max(previous - 1, 0)
      );
    } catch (error) {
      console.error(
        "Unable to mark notification as read:",
        error
      );
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put(
        "/notifications/read-all"
      );

      setNotifications(
        (previous) =>
          previous.map(
            (notification) => ({
              ...notification,
              is_read: true,
            })
          )
      );

      setNotificationCount(0);
    } catch (error) {
      console.error(
        "Unable to mark notifications as read:",
        error
      );
    }
  };

  /* =========================================================
     SEARCH
     ========================================================= */

  const openSearch = () => {
    setShowSearch(true);
    setShowNotifications(false);
    setShowProfile(false);

    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  };

  const handleSearch = (event) => {
    event.preventDefault();

    const query =
      searchQuery.trim();

    if (!query) {
      return;
    }

    setShowSearch(false);
    setSearchQuery("");

    navigate(
      `/documents?search=${encodeURIComponent(
        query
      )}`
    );
  };

  const clearSearch = () => {
    setSearchQuery("");
    setShowSearch(false);
  };

  /* =========================================================
     PROFILE
     ========================================================= */

  const openProfile = () => {
    setShowProfile(false);
    navigate("/profile");
  };

  const getInitials = (name) => {
    if (!name) {
      return "U";
    }

    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) =>
        part.charAt(0).toUpperCase()
      )
      .join("");
  };

  const firstName =
    user?.full_name?.split(" ")[0] ||
    "there";

  return (
    <header className="sticky top-0 z-30 h-[76px] border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">

      <div className="flex h-full items-center justify-between gap-2 pl-16 pr-3 sm:gap-4 sm:pr-6 lg:gap-5 lg:px-8">

        {/* =====================================================
            PAGE CONTEXT
            ===================================================== */}

        <div className="min-w-0">

          <div className="flex items-center gap-2">

            <h1 className="truncate text-[19px] font-bold tracking-[-0.025em] text-slate-950">
              {title}
            </h1>

            {user?.role === "admin" && (
              <span className="hidden items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-indigo-600 sm:inline-flex">

                <ShieldCheck
                  size={11}
                />

                Admin

              </span>
            )}

          </div>

          <p className="mt-0.5 truncate text-xs text-slate-400">

            Welcome back,{" "}

            <span className="font-semibold text-slate-500">
              {firstName}
            </span>

          </p>

        </div>

        {/* =====================================================
            RIGHT CONTROLS
            ===================================================== */}

        <div className="flex shrink-0 items-center gap-2">

          {/* =================================================
              SEARCH
              ================================================= */}

          {showSearch ? (

            <form
              onSubmit={handleSearch}
              className="flex items-center"
            >

              <div className="flex h-10 w-[min(280px,calc(100vw-88px))] items-center rounded-xl border border-indigo-200 bg-white px-3 shadow-[0_4px_16px_rgba(79,70,229,0.08)] ring-4 ring-indigo-50">

                <Search
                  size={17}
                  className="shrink-0 text-indigo-500"
                />

                <input
                  ref={searchInputRef}
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(event) =>
                    setSearchQuery(
                      event.target.value
                    )
                  }
                  placeholder="Search documents..."
                  className="ml-2 min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
                />

                <button
                  type="button"
                  onClick={clearSearch}
                  className="ml-2 flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close search"
                >
                  <X size={14} />
                </button>

              </div>

            </form>

          ) : (

            <button
              type="button"
              onClick={openSearch}
              className="group hidden h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-slate-400 transition hover:border-slate-300 hover:bg-white hover:text-slate-600 sm:flex"
              title="Search documents"
            >

              <Search
                size={17}
                className="transition-colors group-hover:text-indigo-500"
              />

              <span className="text-xs font-medium text-slate-400">
                Search
              </span>

              <span className="ml-4 inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-400 shadow-sm">

                <Command size={9} />

                K

              </span>

            </button>

          )}

          {!showSearch && (
            <button
              type="button"
              onClick={openSearch}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-slate-50 hover:text-indigo-600 sm:hidden"
              title="Search documents"
              aria-label="Search documents"
            >
              <Search size={19} />
            </button>
          )}

          {/* =================================================
              THEME TOGGLE
              ================================================= */}

          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-slate-50 hover:text-indigo-600 dark:text-slate-300"
            title={
              isDark
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
            aria-label={
              isDark
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
          >

            {isDark ? (
              <Sun size={19} />
            ) : (
              <Moon size={19} />
            )}

          </button>

          {/* =================================================
              DIVIDER
              ================================================= */}

          <div className="mx-1 hidden h-7 w-px bg-slate-200 sm:block" />

          {/* =================================================
              NOTIFICATIONS
              ================================================= */}

          <div
            ref={notificationRef}
            className="relative"
          >

            <button
              type="button"
              onClick={
                handleNotificationClick
              }
              className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                showNotifications
                  ? "border-indigo-100 bg-indigo-50 text-indigo-600"
                  : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-indigo-600"
              }`}
              title="Notifications"
              aria-label="Notifications"
            >

              <Bell
                size={19}
                strokeWidth={
                  showNotifications
                    ? 2.3
                    : 2
                }
              />

              {notificationCount >
                0 && (
                <>
                  <span className="absolute right-[8px] top-[7px] h-2 w-2 rounded-full border-2 border-white bg-red-500" />

                  <span className="absolute -right-1 -top-1 flex min-h-[19px] min-w-[19px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm">
                    {notificationCount >
                    99
                      ? "99+"
                      : notificationCount}
                  </span>
                </>
              )}

            </button>

            {/* Notification panel */}

            {showNotifications && (
              <div className="absolute right-0 top-[52px] w-[min(390px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.15)]">

                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">

                  <div>

                    <div className="flex items-center gap-2">

                      <h3 className="text-sm font-bold text-slate-900">
                        Notifications
                      </h3>

                      {notificationCount >
                        0 && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">
                          {notificationCount} new
                        </span>
                      )}

                    </div>

                    <p className="mt-1 text-[11px] text-slate-400">
                      Updates about your documents
                    </p>

                  </div>

                  {notificationCount >
                    0 && (
                    <button
                      type="button"
                      onClick={
                        markAllAsRead
                      }
                      className="rounded-lg px-2 py-1.5 text-[11px] font-bold text-indigo-600 transition hover:bg-indigo-50"
                    >
                      Mark all read
                    </button>
                  )}

                </div>

                {notificationLoading ? (

                  <NotificationLoading />

                ) : notifications.length ===
                  0 ? (

                  <NotificationEmpty />

                ) : (

                  <div className="max-h-[430px] overflow-y-auto">

                    {notifications
                      .slice(0, 8)
                      .map(
                        (
                          notification
                        ) => (
                          <NotificationItem
                            key={
                              notification.id
                            }
                            notification={
                              notification
                            }
                            onMarkRead={
                              markAsRead
                            }
                          />
                        )
                      )}

                  </div>

                )}

                {notifications.length >
                  8 && (

                  <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-center">

                    <button
                      type="button"
                      onClick={() => {
                        setShowNotifications(
                          false
                        );

                        navigate(
                          "/documents"
                        );
                      }}
                      className="text-[11px] font-bold text-indigo-600 transition hover:text-indigo-700"
                    >
                      View all document activity
                    </button>

                  </div>

                )}

              </div>
            )}

          </div>

          {/* =================================================
              PROFILE
              ================================================= */}

          <div
            ref={profileRef}
            className="relative ml-1"
          >

            <button
              type="button"
              onClick={() => {
                setShowProfile(
                  (previous) =>
                    !previous
                );

                setShowNotifications(
                  false
                );

                setShowSearch(false);
              }}
              className={`flex items-center gap-2 rounded-xl border px-1.5 py-1.5 transition ${
                showProfile
                  ? "border-indigo-100 bg-indigo-50"
                  : "border-transparent hover:border-slate-200 hover:bg-slate-50"
              }`}
              aria-label="Open profile menu"
            >

              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-100 to-violet-100 text-[11px] font-bold text-indigo-700 ring-1 ring-indigo-100">

                {getInitials(
                  user?.full_name
                )}

              </div>

              <div className="hidden max-w-[130px] text-left lg:block">

                <p className="truncate text-xs font-bold text-slate-700">
                  {user?.full_name ||
                    "User"}
                </p>

                <p className="truncate text-[10px] text-slate-400">
                  {user?.role === "admin"
                    ? "Administrator"
                    : user?.designation ||
                      "Employee"}
                </p>

              </div>

              <ChevronDown
                size={14}
                className={`hidden text-slate-400 transition-transform lg:block ${
                  showProfile
                    ? "rotate-180"
                    : ""
                }`}
              />

            </button>

            {showProfile && (
              <div className="absolute right-0 top-[52px] w-[min(235px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_20px_60px_rgba(15,23,42,0.15)]">

                <div className="mb-1 rounded-xl bg-slate-50 px-3 py-3">

                  <div className="flex items-center gap-3">

                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-xs font-bold text-indigo-700">

                      {getInitials(
                        user?.full_name
                      )}

                    </div>

                    <div className="min-w-0">

                      <p className="truncate text-xs font-bold text-slate-800">
                        {user?.full_name ||
                          "User"}
                      </p>

                      <p className="mt-0.5 truncate text-[10px] text-slate-400">
                        {user?.email ||
                          "Signed in"}
                      </p>

                    </div>

                  </div>

                </div>

                <button
                  type="button"
                  onClick={
                    openProfile
                  }
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >

                  <User
                    size={16}
                    className="text-slate-400"
                  />

                  My Profile

                </button>

              </div>
            )}

          </div>

        </div>

      </div>

    </header>
  );
}


/* =========================================================
   NOTIFICATION ITEM
   ========================================================= */

function NotificationItem({
  notification,
  onMarkRead,
}) {
  return (
    <div
      className={`border-b border-slate-100 px-5 py-4 transition last:border-b-0 hover:bg-slate-50 ${
        !notification.is_read
          ? "bg-indigo-50/35"
          : "bg-white"
      }`}
    >
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Bell size={16} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-xs font-bold leading-5 text-slate-800">
              {notification.title}
            </p>

            {!notification.is_read && (
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600" />
            )}
          </div>

          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            {notification.message}
          </p>

          <div className="mt-2.5 flex items-center justify-between gap-3">
            <p className="text-[10px] text-slate-400">
              {formatNotificationDate(
                notification.created_at
              )}
            </p>

            {!notification.is_read && (
              <button
                type="button"
                onClick={() =>
                  onMarkRead(notification.id)
                }
                className="shrink-0 rounded-md px-1.5 py-1 text-[10px] font-bold text-indigo-600 transition hover:bg-indigo-50"
              >
                Mark as read
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


/* =========================================================
   NOTIFICATION LOADING
   ========================================================= */

function NotificationLoading() {
  return (
    <div className="space-y-4 p-5">

      {Array.from({
        length: 3,
      }).map((_, index) => (

        <div
          key={index}
          className="flex gap-3"
        >

          <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-slate-100" />

          <div className="flex-1 space-y-2">

            <div className="h-3 w-32 animate-pulse rounded bg-slate-100" />

            <div className="h-2.5 w-full animate-pulse rounded bg-slate-100" />

            <div className="h-2.5 w-20 animate-pulse rounded bg-slate-100" />

          </div>

        </div>

      ))}

    </div>
  );
}


/* =========================================================
   NOTIFICATION EMPTY
   ========================================================= */

function NotificationEmpty() {
  return (
    <div className="px-6 py-10 text-center">

      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">

        <Bell size={19} />

      </div>

      <p className="mt-3 text-xs font-bold text-slate-700">
        No notifications
      </p>

      <p className="mt-1 text-[11px] text-slate-400">
        You're all caught up.
      </p>

    </div>
  );
}


/* =========================================================
   NOTIFICATION DATE
   ========================================================= */

function formatNotificationDate(
  dateString
) {
  if (!dateString) {
    return "";
  }

  const date =
    new Date(dateString);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}