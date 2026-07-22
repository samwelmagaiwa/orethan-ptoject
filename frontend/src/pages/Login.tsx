import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowLeft, ShieldCheck, KeyRound, Phone, Lock } from "lucide-react";
import logo from "../assets/logo.png";
import { API_BASE } from "../lib/api";
import { popLastPath } from "../hooks/useSessionTimeout";



type Step = "login" | "otp" | "forgot" | "forgot-otp" | "change";

const browserNotify = (title: string, body: string) => {
  try {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") new Notification(title, { body });
    else if (Notification.permission !== "denied") Notification.requestPermission().then((p) => { if (p === "granted") new Notification(title, { body }); });
  } catch { /* ignore */ }
};

function Login() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (resendTimer.current) clearInterval(resendTimer.current); };
  }, []);

  const startResendCooldown = () => {
    setResendCooldown(60);
    resendTimer.current = setInterval(() => {
      setResendCooldown(prev => { if (prev <= 1) { clearInterval(resendTimer.current!); return 0; } return prev - 1; });
    }, 1000);
  };

  const handleResendOtp = async () => {
    reset();
    try {
      const res = await axios.post(`${API_BASE}/resend-otp`, { email: email.trim() });
      setSmsSent(res.data.sms_sent ?? false);
      setInfo(res.data.message);
      startResendCooldown();
    } catch {
      setError("Failed to resend code. Please try again.");
    }
  };

  const reset = () => { setError(null); setInfo(null); };

  const finalize = (data: any) => {
    if (data.token) localStorage.setItem("token", data.token);
    if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
    if (data.must_change_password) { setStep("change"); reset(); }
    else {
      const lastPath = popLastPath();
      navigate(lastPath || "/repayment-tracker");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); reset();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/login`, { email: email.trim(), password: password.trim() });
      if (res.data.otp_required) {
        setSmsSent(res.data.sms_sent ?? false); setStep("otp"); setOtp(""); startResendCooldown();
        browserNotify("Orethan -- Verification Code", res.data.message ?? "A verification code has been sent to your phone.");
      } else {
        finalize(res.data);
      }
    } catch (err: any) {
      setError(err?.response?.status === 401 ? "Invalid email or password" : err?.response?.data?.message || "Server error. Please try again.");
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault(); reset();
    if (otp.trim().length < 6) { setError("Enter the 6-digit code sent to your phone."); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/verify-otp`, { email: email.trim(), otp: otp.trim() });
      finalize(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Verification failed");
    } finally { setLoading(false); }
  };

  // Forgot password -- Step 1: send OTP to phone
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault(); reset();
    if (!phone.trim()) { setError("Enter your registered phone number."); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/forgot-password`, { phone: phone.trim() });
      setSmsSent(true);
      setInfo(res.data.message ?? "A verification code has been sent to your phone.");
      setOtp(""); setNewPassword(""); setConfirmPassword("");
      setStep("forgot-otp");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Reset failed");
    } finally { setLoading(false); }
  };

  // Forgot password -- Step 2: verify OTP + set new password
  const handleForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault(); reset();
    if (otp.trim().length < 6) { setError("Enter the 6-digit code sent to your phone."); return; }
    if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/verify-forgot-password-otp`, {
        phone: phone.trim(),
        otp: otp.trim(),
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      });
      finalize(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Verification failed");
    } finally { setLoading(false); }
  };

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault(); reset();
    if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API_BASE}/change-password`, { new_password: newPassword, new_password_confirmation: confirmPassword }, { headers: { Authorization: `Bearer ${token}` } });
      navigate(popLastPath() || "/repayment-tracker");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not change password");
    } finally { setLoading(false); }
  };

  return (
    <div className="lg">
      <div className="lg__mesh" />

      {/* ── LEFT PANEL — flyer1.png (top) + flyer2.png (bottom) ── */}
      <div className="lg-side lg-side--left">
        <div className="lg-side__img lg-side__img--top">
          <img src="/flyer1.png" alt="" />
        </div>
        <div className="lg-side__img lg-side__img--bottom">
          <img src="/flyer2.png" alt="" />
        </div>
        <div className="lg-side__veil lg-side__veil--right" />
      </div>

      {/* ── CENTER ── */}
      <div className="lg__center">
      <div className="lg__card">
        <div className="lg__brand">
          <img src={logo} alt="Orethan Microfinance" />
          <div className="lg__bars"><span className="g" /><span className="b" /></div>
        </div>

        {error && <div className="lg__msg lg__msg--err">{error}</div>}
        {info && <div className="lg__msg lg__msg--info">{info}</div>}

        {/* STEP: LOGIN */}
        {step === "login" && (
          <form onSubmit={handleLogin}>
            <h2>Welcome back</h2>
            <p className="lg__sub">Sign in to continue to your dashboard.</p>
            <Field label="Email">
              <input type="email" placeholder="you@orethan.co.tz" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Password">
              <div className="lg__pw">
                <input type={showPassword ? "text" : "password"} placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPassword((s) => !s)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </Field>
            <div className="lg__row">
              <button type="button" className="lg__link" onClick={() => { reset(); setStep("forgot"); }}>Forgot password?</button>
            </div>
            <button type="submit" className="lg__btn" disabled={loading}>{loading ? "Signing in…" : "Sign In"}</button>
          </form>
        )}

        {/* STEP: OTP (first login -- code sent via SMS) */}
        {step === "otp" && (
          <form onSubmit={handleVerifyOtp}>
            <button type="button" className="lg__back" onClick={() => { reset(); setStep("login"); }}><ArrowLeft size={15} /> Back</button>
            <div className="lg__icon"><ShieldCheck size={26} /></div>
            <h2>Verify it's you</h2>
            <p className="lg__sub">
              {smsSent
                ? "A 6-digit verification code has been sent to your registered phone number. Check your SMS."
                : "Enter the 6-digit verification code provided by your administrator."}
            </p>
            <Field label="6-digit verification code">
              <input inputMode="numeric" maxLength={6} placeholder="••••••" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} style={{ textAlign: "center", letterSpacing: "0.5rem", fontSize: "1.3rem", fontWeight: 800 }} required />
            </Field>
            <button type="submit" className="lg__btn" disabled={loading}>{loading ? "Verifying…" : "Verify & Continue"}</button>
            <div style={{ textAlign: "center", marginTop: "12px" }}>
              {resendCooldown > 0 ? (
                <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Resend code in {resendCooldown}s</span>
              ) : (
                <button type="button" className="lg__link" onClick={handleResendOtp}>
                  Didn't receive the code? Resend
                </button>
              )}
            </div>
          </form>
        )}

        {/* STEP: FORGOT -- enter phone to receive OTP */}
        {step === "forgot" && (
          <form onSubmit={handleForgot}>
            <button type="button" className="lg__back" onClick={() => { reset(); setStep("login"); }}><ArrowLeft size={15} /> Back</button>
            <div className="lg__icon"><Phone size={24} /></div>
            <h2>Forgot password</h2>
            <p className="lg__sub">Enter your registered phone number and we'll send a 6-digit reset code via SMS.</p>
            <Field label="Registered Phone Number">
              <input type="tel" placeholder="e.g. 0769 337 774" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </Field>
            <button type="submit" className="lg__btn" disabled={loading}>{loading ? "Sending code…" : "Send Reset Code"}</button>
          </form>
        )}

        {/* STEP: FORGOT-OTP -- enter code + new password */}
        {step === "forgot-otp" && (
          <form onSubmit={handleForgotOtp}>
            <button type="button" className="lg__back" onClick={() => { reset(); setStep("forgot"); }}><ArrowLeft size={15} /> Back</button>
            <div className="lg__icon"><ShieldCheck size={26} /></div>
            <h2>Reset password</h2>
            <p className="lg__sub">Enter the 6-digit code sent to your phone, then choose a new password.</p>
            <Field label="Verification code (from SMS)">
              <input inputMode="numeric" maxLength={6} placeholder="••••••" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} style={{ textAlign: "center", letterSpacing: "0.5rem", fontSize: "1.3rem", fontWeight: 800 }} required />
            </Field>
            <Field label="New Password">
              <div className="lg__pw">
                <input type={showPassword ? "text" : "password"} placeholder="At least 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPassword((s) => !s)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </Field>
            <Field label="Confirm New Password">
              <div className="lg__pw"><Lock size={15} className="lg__pwic" />
                <input type={showPassword ? "text" : "password"} placeholder="Re-enter password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required style={{ paddingLeft: "2.4rem" }} />
              </div>
            </Field>
            <button type="submit" className="lg__btn" disabled={loading}>{loading ? "Resetting…" : "Reset & Sign In"}</button>
          </form>
        )}

        {/* STEP: FORCE CHANGE PASSWORD */}
        {step === "change" && (
          <form onSubmit={handleChange}>
            <div className="lg__icon"><KeyRound size={24} /></div>
            <h2>Set a new password</h2>
            <p className="lg__sub">You're signed in with the default password. Please create a new password to continue.</p>
            <Field label="New Password">
              <div className="lg__pw">
                <input type={showPassword ? "text" : "password"} placeholder="At least 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPassword((s) => !s)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </Field>
            <Field label="Confirm New Password">
              <div className="lg__pw"><Lock size={15} className="lg__pwic" />
                <input type={showPassword ? "text" : "password"} placeholder="Re-enter password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required style={{ paddingLeft: "2.4rem" }} />
              </div>
            </Field>
            <button type="submit" className="lg__btn" disabled={loading}>{loading ? "Saving…" : "Save & Continue"}</button>
          </form>
        )}

        <div className="lg__foot">© {new Date().getFullYear()} Orethan Microfinance</div>
      </div>
      </div>{/* end lg__center */}

      {/* ── RIGHT PANEL — flyer 3 (top) + flyer 4 (bottom) ── */}
      <div className="lg-side lg-side--right">
        <div className="lg-side__img lg-side__img--top">
          <img src="/flyer3.png" alt="" />
        </div>
        <div className="lg-side__img lg-side__img--bottom">
          <img src="/flyer4.png" alt="" />
        </div>
        <div className="lg-side__veil lg-side__veil--left" />
      </div>

      <style>{`
        * { box-sizing: border-box; }

        /* ── PAGE SHELL ── */
        .lg {
          min-height: 100vh; height: 100vh;
          display: flex; flex-direction: row; align-items: stretch;
          position: relative; overflow: hidden;
          background: linear-gradient(120deg, #0a1628 0%, #0d2137 40%, #102a43 100%);
          font-family: 'Inter', -apple-system, 'Segoe UI', sans-serif;
        }
        .lg__mesh {
          position: absolute; inset: 0; pointer-events: none; z-index: 0;
          background:
            radial-gradient(900px 900px at 20% 50%, rgba(87,179,59,0.18), transparent 65%),
            radial-gradient(900px 900px at 80% 50%, rgba(13,110,253,0.18), transparent 65%),
            radial-gradient(500px 500px at 50% 50%, rgba(30,136,229,0.10), transparent 70%);
        }

        /* ── SIDE PANELS ── */
        .lg-side {
          flex: 1; min-width: 0;
          position: relative; overflow: hidden;
          display: flex; flex-direction: column;
          z-index: 1;
        }
        .lg-side__img {
          flex: 1; position: relative; overflow: hidden;
        }
        .lg-side__img img {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover; object-position: center top;
          will-change: transform;
        }
        /* Ken Burns — top images zoom in slowly */
        .lg-side__img--top img {
          animation: kbZoomIn 18s ease-in-out infinite alternate;
        }
        /* Ken Burns — bottom images zoom out + pan */
        .lg-side__img--bottom img {
          animation: kbZoomOut 18s ease-in-out infinite alternate;
          animation-delay: -9s;
        }
        @keyframes kbZoomIn {
          0%   { transform: scale(1.0) translate(0%, 0%); }
          100% { transform: scale(1.12) translate(-3%, 2%); }
        }
        @keyframes kbZoomOut {
          0%   { transform: scale(1.12) translate(3%, -2%); }
          100% { transform: scale(1.0) translate(0%, 0%); }
        }
        /* Right panel — mirror the Ken Burns directions */
        .lg-side--right .lg-side__img--top img {
          animation: kbZoomInR 18s ease-in-out infinite alternate;
        }
        .lg-side--right .lg-side__img--bottom img {
          animation: kbZoomOutR 18s ease-in-out infinite alternate;
          animation-delay: -9s;
        }
        @keyframes kbZoomInR {
          0%   { transform: scale(1.0) translate(0%, 0%); }
          100% { transform: scale(1.12) translate(3%, 2%); }
        }
        @keyframes kbZoomOutR {
          0%   { transform: scale(1.12) translate(-3%, -2%); }
          100% { transform: scale(1.0) translate(0%, 0%); }
        }
        /* Divider between top & bottom image */
        .lg-side__img--top::after {
          content: '';
          position: absolute; bottom: 0; left: 0; right: 0; height: 4px;
          background: linear-gradient(90deg, rgba(87,179,59,0.9), rgba(30,136,229,0.9));
          z-index: 2;
        }
        /* Veil — gradient fade on inner edge toward center card */
        .lg-side__veil {
          position: absolute; top: 0; bottom: 0; width: 120px; z-index: 3; pointer-events: none;
        }
        .lg-side__veil--right {
          right: 0;
          background: linear-gradient(to right, transparent, rgba(10,22,40,0.92));
        }
        .lg-side__veil--left {
          left: 0;
          background: linear-gradient(to left, transparent, rgba(10,22,40,0.92));
        }
        /* Subtle dark overlay on whole panel for contrast */
        .lg-side::after {
          content: ''; position: absolute; inset: 0; z-index: 2; pointer-events: none;
          background: rgba(5,15,30,0.18);
        }

        /* ── CENTER ── */
        .lg__center {
          flex-shrink: 0;
          width: 420px;
          display: flex; align-items: center; justify-content: center;
          padding: 24px 16px;
          position: relative; z-index: 10;
        }

        /* ── CARD ── */
        .lg__card {
          width: 100%;
          background: rgba(255,255,255,0.10);
          backdrop-filter: blur(32px) saturate(1.7);
          -webkit-backdrop-filter: blur(32px) saturate(1.7);
          border: 1px solid rgba(255,255,255,0.22);
          border-radius: 26px;
          box-shadow: 0 40px 80px rgba(5,15,30,0.55), inset 0 1px 0 rgba(255,255,255,0.30);
          padding: 2rem 2rem 1.4rem;
        }
        .lg__brand { text-align: center; margin-bottom: 1.2rem; }
        .lg__brand img { height: 140px; width: auto; object-fit: contain; filter: drop-shadow(0 8px 18px rgba(7,42,67,0.4)); animation: lgLogo 5s ease-in-out infinite; }
        @keyframes lgLogo { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-5px) scale(1.02); } }
        .lg__bars { display: flex; height: 4px; border-radius: 3px; overflow: hidden; margin: 0.8rem auto 0; max-width: 200px; }
        .lg__bars .g { flex: 1; background: linear-gradient(90deg,#7cb342,#aed581); }
        .lg__bars .b { flex: 1; background: linear-gradient(90deg,#1565c0,#1d8ad1); }
        .lg__card h2 { font-size: 1.5rem; font-weight: 900; color: #ffffff; margin: 0 0 0.25rem; letter-spacing: -0.02em; text-shadow: 0 2px 8px rgba(7,42,67,0.3); }
        .lg__sub { font-size: 0.82rem; color: rgba(255,255,255,0.8); margin: 0 0 1.1rem; line-height: 1.5; }
        form { display: flex; flex-direction: column; gap: 0; }
        .lg__field { margin-bottom: 0.9rem; }
        .lg__field label { display: block; font-size: 0.7rem; font-weight: 800; color: rgba(255,255,255,0.9); margin-bottom: 0.35rem; text-transform: uppercase; letter-spacing: 0.5px; }
        .lg__field input { width: 100%; padding: 0.8rem 1rem; border: 1.5px solid rgba(255,255,255,0.28); border-radius: 12px; font-size: 0.9rem; font-weight: 600; color: #ffffff; outline: none; transition: all 0.18s; background: rgba(255,255,255,0.12); }
        .lg__field input::placeholder { color: rgba(255,255,255,0.55); }
        .lg__field input:focus { border-color: rgba(255,255,255,0.75); box-shadow: 0 0 0 3px rgba(255,255,255,0.14); background: rgba(255,255,255,0.22); }
        .lg__pw { position: relative; }
        .lg__pw > button { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: rgba(255,255,255,0.8); cursor: pointer; display: flex; }
        .lg__pwic { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.8); }
        .lg__row { display: flex; justify-content: flex-end; margin: -0.2rem 0 0.9rem; }
        .lg__link { background: none; border: none; color: #ffffff; font-weight: 800; font-size: 0.78rem; cursor: pointer; padding: 0; text-decoration: underline; text-underline-offset: 3px; }
        .lg__btn { width: 100%; padding: 0.9rem; border: none; border-radius: 12px; background: linear-gradient(135deg,#57b33b 0%,#1f9e74 42%,#1e88e5 78%,#0d6efd 100%); color: #fff; font-size: 0.93rem; font-weight: 800; cursor: pointer; transition: all 0.2s; box-shadow: 0 12px 28px rgba(13,80,180,0.4), inset 0 1px 0 rgba(255,255,255,0.28); margin-top: 0.2rem; }
        .lg__btn:hover { transform: translateY(-1px); filter: brightness(1.08); }
        .lg__btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .lg__back { display: inline-flex; align-items: center; gap: 0.3rem; background: none; border: none; color: rgba(255,255,255,0.85); font-weight: 700; font-size: 0.78rem; cursor: pointer; padding: 0; margin-bottom: 0.8rem; }
        .lg__icon { width: 48px; height: 48px; border-radius: 14px; background: rgba(255,255,255,0.18); color: #ffffff; display: flex; align-items: center; justify-content: center; margin-bottom: 0.8rem; border: 1px solid rgba(255,255,255,0.28); }
        .lg__msg { font-size: 0.8rem; font-weight: 700; padding: 0.7rem 0.85rem; border-radius: 10px; margin-bottom: 0.9rem; line-height: 1.45; backdrop-filter: blur(6px); }
        .lg__msg--err { background: rgba(239,68,68,0.22); border: 1px solid rgba(254,202,202,0.6); color: #fff; }
        .lg__msg--info { background: rgba(16,185,129,0.22); border: 1px solid rgba(167,243,208,0.6); color: #fff; }
        .lg__foot { text-align: center; font-size: 0.68rem; color: rgba(255,255,255,0.65); margin-top: 1.2rem; font-weight: 600; }

        /* ── RESPONSIVE: hide panels on small screens ── */
        @media (max-width: 1024px) {
          .lg-side--left { display: none; }
          .lg-side--right { display: none; }
          .lg__center { width: 100%; max-width: 440px; margin: 0 auto; }
          .lg { justify-content: center; background: linear-gradient(120deg, #57b33b 0%, #1f9e74 30%, #1e88e5 66%, #0d6efd 100%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .lg-side__img img, .lg__brand img { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="lg__field">
    <label>{label}</label>
    {children}
  </div>
);

export default Login;

