import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  AlertCircle,
  Loader2,
} from "lucide-react";
import api from "../services/api";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Multi-step flow: 1 = Verify Identity, 2 = Set New Password, 3 = Success
  const [step, setStep] = useState(1);

  // Step 1 Form
  const [email, setEmail] = useState("");

  // Step 2 Form
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Auto-detect token in URL (e.g. from an emailed or direct link)
  useEffect(() => {
    const urlToken = searchParams.get("token");
    if (urlToken) {
      setResetToken(urlToken);
      verifyToken(urlToken);
    }
  }, [searchParams]);

  const verifyToken = async (token) => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get(`/auth/verify-reset-token/${encodeURIComponent(token)}`);
      if (response.data?.email) {
        setEmail(response.data.email);
      }
      setStep(2);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "This password reset link is invalid or has expired."
      );
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  // Handle Step 1: Verify Email
  const handleVerifyIdentity = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await api.post("/auth/forgot-password", {
        email: email.trim(),
      });

      setResetToken(response.data.reset_token);
      setSuccess(response.data.message || "Identity verified.");
      setStep(2);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to find an account with this email. Please check your email address."
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle Step 2: Set New Password
  const handleResetPassword = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/auth/reset-password", {
        token: resetToken,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      setSuccess(response.data.message || "Password reset successfully.");
      setStep(3);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Failed to reset password. The link or token may have expired."
      );
    } finally {
      setLoading(false);
    }
  };

  // Password strength calculation
  const getPasswordStrength = (pwd) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    return score;
  };

  const strengthScore = getPasswordStrength(newPassword);

  const strengthColor = () => {
    if (strengthScore <= 1) return "bg-red-500";
    if (strengthScore <= 3) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const strengthLabel = () => {
    if (!newPassword) return "";
    if (strengthScore <= 1) return "Weak";
    if (strengthScore <= 3) return "Moderate";
    return "Strong";
  };

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900 lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      {/* BRAND PANEL (LEFT) */}
      <section className="relative hidden overflow-hidden bg-slate-950 lg:flex lg:min-h-screen lg:flex-col lg:justify-between">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
          <div className="absolute -bottom-40 right-0 h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-3xl" />
          <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.04]" />
          <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.025]" />
        </div>

        <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
          {/* BRAND */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-950/40">
              <ShieldCheck size={23} />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight !text-white">EDMS</p>
              <p className="text-[11px] font-medium !text-slate-300">
                Employee Document Management
              </p>
            </div>
          </div>

          {/* HERO */}
          <div className="max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
              <Sparkles size={13} className="text-indigo-400" />
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] !text-slate-300">
                Account Recovery
              </span>
            </div>

            <h1 className="text-4xl font-extrabold leading-[1.12] tracking-[-0.04em] !text-white xl:text-5xl">
              Forgot your
              <br />
              <span className="!text-indigo-400">password?</span>
            </h1>

            <p className="mt-4 text-sm font-medium leading-relaxed !text-slate-300">
              Easily reset your password and regain access to your documents in two simple steps.
            </p>

            {/* Steps indicator */}
            <div className="mt-8 grid grid-cols-2 gap-4">
              <div
                className={`rounded-2xl border p-4 transition ${
                  step === 1
                    ? "border-indigo-500/50 bg-indigo-500/10"
                    : "border-white/5 bg-white/[0.02]"
                }`}
              >
                <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                  Step 1
                </p>
                <p className="mt-1 text-xs font-semibold text-white">
                  Verify Identity
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Registered Email
                </p>
              </div>

              <div
                className={`rounded-2xl border p-4 transition ${
                  step >= 2
                    ? "border-indigo-500/50 bg-indigo-500/10"
                    : "border-white/5 bg-white/[0.02]"
                }`}
              >
                <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                  Step 2
                </p>
                <p className="mt-1 text-xs font-semibold text-white">
                  New Password
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Create safe credentials
                </p>
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="border-t border-white/[0.08] pt-6">
            <p className="text-xs text-slate-400">
              Need assistance? Contact your System Administrator.
            </p>
          </div>
        </div>
      </section>

      {/* FORM PANEL (RIGHT) */}
      <main className="flex min-h-screen flex-col justify-center px-6 py-12 sm:px-10 lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-md">
          {/* Top back link */}
          <div className="mb-6">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 transition hover:text-slate-900"
            >
              <ArrowLeft size={16} />
              <span>Back to Login</span>
            </Link>
          </div>

          {/* Card */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-7 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-9">
            {/* Header */}
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                <KeyRound size={22} />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  {step === 1 && "Reset Password"}
                  {step === 2 && "Create New Password"}
                  {step === 3 && "Password Reset Complete"}
                </h2>
                <p className="text-xs text-slate-500">
                  {step === 1 && "Enter your registered email to proceed"}
                  {step === 2 && "Enter and confirm your new secure password"}
                  {step === 3 && "You can now log in with your updated password"}
                </p>
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5"
              >
                <AlertCircle size={17} className="mt-0.5 shrink-0 text-red-600" />
                <p className="text-xs font-semibold leading-5 text-red-700">
                  {error}
                </p>
              </div>
            )}

            {/* Success Banner */}
            {success && step !== 3 && (
              <div
                role="status"
                className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5"
              >
                <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-600" />
                <p className="text-xs font-semibold leading-5 text-emerald-700">
                  {success}
                </p>
              </div>
            )}

            {/* STEP 1: VERIFY IDENTITY */}
            {step === 1 && (
              <form onSubmit={handleVerifyIdentity} className="mt-6 space-y-5">
                {/* Email Address */}
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-600"
                  >
                    Registered Email
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
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                    />
                  </div>
                </div>


                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="relative flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify & Continue</span>
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* STEP 2: SET NEW PASSWORD */}
            {step === 2 && (
              <form onSubmit={handleResetPassword} className="mt-6 space-y-5">
                {/* Account badge */}
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs">
                  <span className="font-semibold text-slate-500">Account:</span>
                  <span className="font-bold text-slate-800">{email}</span>
                </div>

                {/* New Password */}
                <div>
                  <label
                    htmlFor="newPassword"
                    className="mb-2 block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-600"
                  >
                    New Password
                  </label>
                  <div className="group relative">
                    <Lock
                      size={17}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition group-focus-within:text-indigo-500"
                    />
                    <input
                      id="newPassword"
                      name="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-12 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((p) => !p)}
                      className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700"
                    >
                      {showNewPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>

                  {/* Strength meter */}
                  {newPassword && (
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Strength:</span>
                        <span className="font-bold text-slate-700">
                          {strengthLabel()}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full transition-all duration-300 ${strengthColor()}`}
                          style={{
                            width: `${Math.min((strengthScore / 5) * 100, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="mb-2 block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-600"
                  >
                    Confirm New Password
                  </label>
                  <div className="group relative">
                    <Lock
                      size={17}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition group-focus-within:text-indigo-500"
                    />
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your new password"
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-12 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((p) => !p)}
                      className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700"
                    >
                      {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>

                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="mt-1.5 text-[11px] font-semibold text-red-600">
                      Passwords do not match.
                    </p>
                  )}
                  {confirmPassword && newPassword === confirmPassword && (
                    <p className="mt-1.5 text-[11px] font-semibold text-emerald-600">
                      Passwords match.
                    </p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="relative flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <span>Save New Password</span>
                      <CheckCircle2 size={17} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* STEP 3: SUCCESS CONFIRMATION */}
            {step === 3 && (
              <div className="mt-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                  <CheckCircle2 size={32} />
                </div>

                <h3 className="mt-4 text-base font-bold text-slate-900">
                  Password Updated Successfully!
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Your account credentials have been reset. You can now use your new password to sign in.
                </p>

                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-700"
                >
                  <span>Proceed to Login</span>
                  <ArrowRight size={17} />
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
