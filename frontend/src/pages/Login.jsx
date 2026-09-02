import { useState } from "react";

import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();

  const { login } = useAuth();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  // =========================================================
  // LOGIN
  // =========================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const result =
        await login(
          email,
          password
        );

      if (
        result.role ===
        "admin"
      ) {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      setError(
        error.response?.data?.detail ||
          "Invalid email or password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900 lg:grid lg:grid-cols-[1.05fr_0.95fr]">

      {/* =====================================================
          LEFT BRAND PANEL
          ===================================================== */}

      <section className="relative hidden overflow-hidden bg-slate-950 lg:flex lg:min-h-screen lg:flex-col lg:justify-between">

        {/* Decorative background */}

        <div className="absolute inset-0 overflow-hidden">

          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />

          <div className="absolute -bottom-40 right-0 h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-3xl" />

          <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.04]" />

          <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.025]" />

        </div>

        <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">

          {/* =================================================
              BRAND
              ================================================= */}

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-950/40">

              <ShieldCheck
                size={23}
              />

            </div>

            <div>

              <p className="text-lg font-bold tracking-tight !text-white">
                EDMS
              </p>

              <p className="text-[11px] font-medium !text-slate-300">
                Employee Document Management
              </p>

            </div>

          </div>

          {/* =================================================
              HERO
              ================================================= */}

          <div className="max-w-xl">

            {/* Badge */}

            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">

              <Sparkles
                size={13}
                className="text-indigo-400"
              />

              <span className="text-[10px] font-bold uppercase tracking-[0.12em] !text-slate-300">
                Secure document workspace
              </span>

            </div>

            {/* Main heading */}

            <h1 className="text-5xl font-extrabold leading-[1.08] tracking-[-0.045em] !text-white xl:text-6xl">

              Your documents.

              <br />

              <span className="!text-indigo-400">
                Securely managed.
              </span>

            </h1>

            {/* Description */}

            <p className="mt-6 max-w-lg text-base leading-7 !text-slate-300">

              Store, access and manage official employee
              documents through one centralized workspace
              built for secure organizational document
              management.

            </p>

            {/* =================================================
                BENEFITS
                ================================================= */}

            <div className="mt-9 grid gap-3 sm:grid-cols-2">

              <Feature
                title="Centralized"
                description="One organized document workspace"
              />

              <Feature
                title="Role-based"
                description="Access based on your account"
              />

              <Feature
                title="Secure access"
                description="Protected employee documents"
              />

              <Feature
                title="Easy management"
                description="View, upload and download"
              />

            </div>

          </div>

          {/* =================================================
              FOOTER
              ================================================= */}

          <div className="flex items-center justify-between border-t border-white/[0.08] pt-6">

            <p className="text-[10px] font-medium !text-slate-400">
              Enterprise Document Management System
            </p>

            <p className="text-[10px] font-medium !text-slate-400">
              © 2026 EDMS
            </p>

          </div>

        </div>

      </section>

      {/* =====================================================
          RIGHT LOGIN PANEL
          ===================================================== */}

      <main className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8">

        <div className="w-full max-w-[430px]">

          {/* =================================================
              MOBILE BRAND
              ================================================= */}

          <div className="mb-8 flex items-center justify-center lg:hidden">

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">

                <ShieldCheck
                  size={23}
                />

              </div>

              <div>

                <p className="font-bold tracking-tight text-slate-900">
                  EDMS
                </p>

                <p className="text-[10px] font-medium text-slate-400">
                  Employee Documents
                </p>

              </div>

            </div>

          </div>

          {/* =================================================
              LOGIN CARD
              ================================================= */}

          <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.25)] sm:p-8">

            {/* HEADER */}

            <div>

              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">

                <Lock
                  size={19}
                />

              </div>

              <h2 className="text-[27px] font-bold tracking-[-0.04em] text-slate-950">
                Welcome back
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Sign in to access your employee document
                workspace.
              </p>

            </div>

            {/* =================================================
                ERROR
                ================================================= */}

            {error && (

              <div
                role="alert"
                className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5"
              >

                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">

                  <span className="text-[11px] font-bold">
                    !
                  </span>

                </div>

                <p className="text-xs font-semibold leading-5 text-red-700">
                  {error}
                </p>

              </div>

            )}

            {/* =================================================
                FORM
                ================================================= */}

            <form
              onSubmit={handleSubmit}
              className="mt-7 space-y-5"
            >

              {/* EMAIL */}

              <div>

                <label
                  htmlFor="email"
                  className="mb-2 block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-600"
                >
                  Email address
                </label>

                <div className="group relative">

                  <Mail
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition group-focus-within:text-indigo-500"
                  />

                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(
                        event.target.value
                      )
                    }
                    placeholder="you@company.com"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                  />

                </div>

              </div>

              {/* PASSWORD */}

              <div>

                <div className="mb-2 flex items-center justify-between">

                  <label
                    htmlFor="password"
                    className="block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-600"
                  >
                    Password
                  </label>

                </div>

                <div className="group relative">

                  <Lock
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition group-focus-within:text-indigo-500"
                  />

                  <input
                    id="password"
                    name="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value
                      )
                    }
                    placeholder="Enter your password"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-12 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                  />

                  <button
                    type="button"
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    onClick={() =>
                      setShowPassword(
                        (previous) =>
                          !previous
                      )
                    }
                    className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >

                    {showPassword ? (

                      <EyeOff
                        size={17}
                      />

                    ) : (

                      <Eye
                        size={17}
                      />

                    )}

                  </button>

                </div>

              </div>

              {/* =================================================
                  SUBMIT
                  ================================================= */}

              <button
                type="submit"
                disabled={loading}
                className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white shadow-lg shadow-slate-200 transition hover:bg-indigo-600 hover:shadow-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
              >

                {loading ? (

                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />

                    Signing in...
                  </>

                ) : (

                  <>
                    Sign in

                    <ArrowRight
                      size={17}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </>

                )}

              </button>

            </form>

            {/* =================================================
                SECURITY NOTE
                ================================================= */}

            <div className="mt-6 flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3.5">

              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">

                <CheckCircle2
                  size={15}
                />

              </div>

              <div>

                <p className="text-[11px] font-bold text-slate-700">
                  Secure workspace access
                </p>

                <p className="mt-0.5 text-[10px] leading-4 text-slate-400">
                  Your account permissions determine which
                  employee workspace you can access.
                </p>

              </div>

            </div>

            {/* =================================================
                REGISTER
                ================================================= */}

            <div className="mt-7 border-t border-slate-100 pt-6 text-center">

              <p className="text-xs text-slate-500">

                Don't have an account?{" "}

                <Link
                  to="/register"
                  className="font-bold text-indigo-600 transition hover:text-indigo-700"
                >
                  Create an account
                </Link>

              </p>

            </div>

          </div>

          {/* =================================================
              BOTTOM TRUST TEXT
              ================================================= */}

          <div className="mt-5 flex items-center justify-center gap-2 text-[10px] font-medium text-slate-400">

            <ShieldCheck
              size={12}
              className="text-emerald-500"
            />

            Protected employee document environment

          </div>

        </div>

      </main>

    </div>
  );
}


/* =========================================================
   FEATURE
   ========================================================= */

function Feature({
  title,
  description,
}) {

  return (

    <div className="rounded-xl border border-white/[0.10] bg-white/[0.045] p-3.5">

      <div className="flex items-center gap-2">

        <CheckCircle2
          size={14}
          className="shrink-0 !text-indigo-400"
        />

        <p className="text-xs font-bold !text-white">
          {title}
        </p>

      </div>

      <p className="mt-1 pl-[22px] text-[10px] leading-4 !text-slate-300">
        {description}
      </p>

    </div>

  );
}