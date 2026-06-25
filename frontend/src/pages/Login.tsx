import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowLeft, ShieldCheck, KeyRound, Phone, Lock } from "lucide-react";
import logo from "../assets/logo.png";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

type Step = "login" | "otp" | "forgot" | "change";

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
  const [shownOtp, setShownOtp] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const reset = () => { setError(null); setInfo(null); };

  const finalize = (data: any) => {
    if (data.token) localStorage.setItem("token", data.token);
    if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
    if (data.must_change_password) { setStep("change"); reset(); }
    else navigate("/repayment-tracker");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); reset();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/login`, { email: email.trim(), password: password.trim() });
      if (res.data.otp_required) {
        setShownOtp(res.data.otp); setStep("otp"); setOtp("");
        browserNotify("Orethan — Verification Code", `Your one-time code is ${res.data.otp}`);
      } else {
        finalize(res.data);
      }
    } catch (err: any) {
      setError(err?.response?.status === 401 ? "Invalid email or password" : err?.response?.data?.message || "Server error. Please try again.");
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault(); reset();
    if (otp.trim().length < 4) { setError("Enter the 4-digit code."); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/verify-otp`, { email: email.trim(), otp: otp.trim() });
      finalize(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Verification failed");
    } finally { setLoading(false); }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault(); reset();
    if (!phone.trim()) { setError("Enter your registered phone number."); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/forgot-password`, { phone: phone.trim() });
      browserNotify("Orethan — Password Reset", `Your password has been reset to: ${res.data.default_password}`);
      setInfo(`Phone verified. Your password has been reset to the default password "${res.data.default_password}". Sign in with it, then you'll be asked to set a new password.`);
      if (res.data.email) setEmail(res.data.email);
      setPassword(""); setStep("login");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Reset failed");
    } finally { setLoading(false); }
  };

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault(); reset();
    if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(`${API_BASE}/change-password`, { new_password: newPassword, new_password_confirmation: confirmPassword }, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.otp_required) {
        setShownOtp(res.data.otp); setOtp(""); setStep("otp");
        setInfo("Password changed. Enter the verification code below to finish.");
        browserNotify("Orethan — Verification Code", `Your one-time code is ${res.data.otp}`);
      } else {
        navigate("/repayment-tracker");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not change password");
    } finally { setLoading(false); }
  };

  return (
    <div className="lg">
      <div className="lg__mesh" />
      <div className="lg__wm" aria-hidden="true">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i}>ORETHAN&nbsp;&nbsp;&nbsp;ORETHAN&nbsp;&nbsp;&nbsp;ORETHAN&nbsp;&nbsp;&nbsp;ORETHAN</div>
        ))}
      </div>
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

        {/* STEP: OTP */}
        {step === "otp" && (
          <form onSubmit={handleVerifyOtp}>
            <button type="button" className="lg__back" onClick={() => { reset(); setStep("login"); }}><ArrowLeft size={15} /> Back</button>
            <div className="lg__icon"><ShieldCheck size={26} /></div>
            <h2>Verify it's you</h2>
            <p className="lg__sub">Enter the one-time verification code to continue.</p>
            <div className="lg__otpbox">
              <span>Your verification code</span>
              <strong>{shownOtp}</strong>
            </div>
            <Field label="Enter the 4-digit code">
              <input inputMode="numeric" maxLength={4} placeholder="••••" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} style={{ textAlign: "center", letterSpacing: "0.6rem", fontSize: "1.3rem", fontWeight: 800 }} required />
            </Field>
            <button type="submit" className="lg__btn" disabled={loading}>{loading ? "Verifying…" : "Verify & Continue"}</button>
          </form>
        )}

        {/* STEP: FORGOT */}
        {step === "forgot" && (
          <form onSubmit={handleForgot}>
            <button type="button" className="lg__back" onClick={() => { reset(); setStep("login"); }}><ArrowLeft size={15} /> Back</button>
            <div className="lg__icon"><Phone size={24} /></div>
            <h2>Forgot password</h2>
            <p className="lg__sub">Enter your registered phone number. If it matches our records, your password will be reset to the default.</p>
            <Field label="Registered Phone Number">
              <input type="tel" placeholder="e.g. 0769 337 774" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </Field>
            <button type="submit" className="lg__btn" disabled={loading}>{loading ? "Verifying…" : "Reset Password"}</button>
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

      <style>{`
        * { box-sizing: border-box; }
        .lg { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; position: relative; overflow: hidden;
          background: linear-gradient(120deg, #57b33b 0%, #1f9e74 30%, #1e88e5 66%, #0d6efd 100%);
          font-family: 'Inter', -apple-system, 'Segoe UI', sans-serif; }
        .lg__mesh { position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(640px 640px at 82% 12%, rgba(255,255,255,0.26), transparent 62%), radial-gradient(560px 560px at 12% 86%, rgba(102,187,106,0.5), transparent 64%), radial-gradient(560px 560px at 92% 90%, rgba(13,110,253,0.5), transparent 66%), radial-gradient(440px 440px at 60% 50%, rgba(30,136,229,0.22), transparent 70%); }
        .lg__wm { position: fixed; inset: -28%; transform: rotate(-26deg); display: flex; flex-direction: column; justify-content: center; gap: 2.4rem; pointer-events: none; z-index: 0; animation: wmFloat 18s ease-in-out infinite; transform-origin: center; }
        @keyframes wmFloat {
          0%, 100% { transform: rotate(-26deg) translate(0, 0); }
          50% { transform: rotate(-26deg) translate(-48px, 30px); }
        }
        .lg__wm div {
          font-family: 'Inter', sans-serif; font-size: clamp(4rem, 8vw, 8.5rem); font-weight: 900;
          color: rgba(255,255,255,0.18); letter-spacing: 0.4rem; white-space: nowrap; text-align: center; line-height: 1; user-select: none;
          text-shadow:
            1px 1px 0 rgba(255,255,255,0.14),
            2px 2px 0 rgba(255,255,255,0.11),
            3px 3px 0 rgba(255,255,255,0.08),
            4px 4px 0 rgba(7,42,67,0.10),
            5px 5px 1px rgba(7,42,67,0.10),
            8px 9px 18px rgba(7,42,67,0.28);
          animation: wmShine 7s ease-in-out infinite;
        }
        .lg__wm div:nth-child(even) { animation-delay: 1.4s; }
        .lg__wm div:nth-child(3n) { animation-delay: 2.8s; }
        @keyframes wmShine { 0%, 100% { opacity: 0.85; } 50% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .lg__wm, .lg__wm div, .lg__brand img { animation: none !important; } }
        .lg__card { position: relative; z-index: 1; width: 100%; max-width: 430px;
          background: rgba(255,255,255,0.14);
          backdrop-filter: blur(30px) saturate(1.6);
          -webkit-backdrop-filter: blur(30px) saturate(1.6);
          border: 1px solid rgba(255,255,255,0.4);
          border-radius: 26px;
          box-shadow: 0 35px 80px rgba(7,42,67,0.35), inset 0 1px 0 rgba(255,255,255,0.45);
          padding: 2.2rem 2.2rem 1.6rem; }
        .lg__brand { text-align: center; margin-bottom: 1.4rem; }
        .lg__brand img { height: 172px; width: auto; object-fit: contain; filter: drop-shadow(0 8px 18px rgba(7,42,67,0.3)); animation: lgLogo 5s ease-in-out infinite; }
        @keyframes lgLogo { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-6px) scale(1.02); } }
        .lg__bars { display: flex; height: 5px; border-radius: 3px; overflow: hidden; margin: 1rem auto 0; max-width: 240px; }
        .lg__bars .g { flex: 1; background: linear-gradient(90deg,#7cb342,#aed581); }
        .lg__bars .b { flex: 1; background: linear-gradient(90deg,#1565c0,#1d8ad1); }
        .lg__card h2 { font-size: 1.55rem; font-weight: 900; color: #ffffff; margin: 0 0 0.3rem; letter-spacing: -0.02em; text-shadow: 0 2px 8px rgba(7,42,67,0.25); }
        .lg__sub { font-size: 0.84rem; color: rgba(255,255,255,0.85); margin: 0 0 1.3rem; line-height: 1.5; }
        form { display: flex; flex-direction: column; gap: 0; }
        .lg__field { margin-bottom: 1rem; }
        .lg__field label { display: block; font-size: 0.72rem; font-weight: 800; color: rgba(255,255,255,0.92); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.5px; }
        .lg__field input { width: 100%; padding: 0.85rem 1rem; border: 1.5px solid rgba(255,255,255,0.35); border-radius: 12px; font-size: 0.92rem; font-weight: 600; color: #ffffff; outline: none; transition: all 0.18s; background: rgba(255,255,255,0.14); }
        .lg__field input::placeholder { color: rgba(255,255,255,0.6); }
        .lg__field input:focus { border-color: rgba(255,255,255,0.85); box-shadow: 0 0 0 3px rgba(255,255,255,0.18); background: rgba(255,255,255,0.26); }
        .lg__pw { position: relative; }
        .lg__pw > button { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: rgba(255,255,255,0.8); cursor: pointer; display: flex; }
        .lg__pwic { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.8); }
        .lg__row { display: flex; justify-content: flex-end; margin: -0.3rem 0 1rem; }
        .lg__link { background: none; border: none; color: #ffffff; font-weight: 800; font-size: 0.8rem; cursor: pointer; padding: 0; text-decoration: underline; text-underline-offset: 3px; }
        .lg__btn { width: 100%; padding: 0.95rem; border: none; border-radius: 12px; background: linear-gradient(135deg,#57b33b 0%,#1f9e74 42%,#1e88e5 78%,#0d6efd 100%); color: #fff; font-size: 0.95rem; font-weight: 800; cursor: pointer; transition: all 0.2s; box-shadow: 0 14px 30px rgba(13,80,180,0.4), inset 0 1px 0 rgba(255,255,255,0.28); }
        .lg__btn:hover { transform: translateY(-1px); filter: brightness(1.08); }
        .lg__btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .lg__back { display: inline-flex; align-items: center; gap: 0.3rem; background: none; border: none; color: rgba(255,255,255,0.85); font-weight: 700; font-size: 0.8rem; cursor: pointer; padding: 0; margin-bottom: 1rem; }
        .lg__icon { width: 52px; height: 52px; border-radius: 15px; background: rgba(255,255,255,0.2); color: #ffffff; display: flex; align-items: center; justify-content: center; margin-bottom: 0.9rem; border: 1px solid rgba(255,255,255,0.3); }
        .lg__otpbox { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.35); border-radius: 14px; padding: 1rem; margin-bottom: 1.1rem; }
        .lg__otpbox span { font-size: 0.68rem; font-weight: 800; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 1px; }
        .lg__otpbox strong { font-size: 2.1rem; font-weight: 900; color: #ffffff; letter-spacing: 0.7rem; padding-left: 0.7rem; text-shadow: 0 2px 8px rgba(7,42,67,0.3); }
        .lg__msg { font-size: 0.82rem; font-weight: 700; padding: 0.75rem 0.9rem; border-radius: 10px; margin-bottom: 1rem; line-height: 1.45; backdrop-filter: blur(6px); }
        .lg__msg--err { background: rgba(239,68,68,0.22); border: 1px solid rgba(254,202,202,0.6); color: #fff; }
        .lg__msg--info { background: rgba(16,185,129,0.22); border: 1px solid rgba(167,243,208,0.6); color: #fff; }
        .lg__foot { text-align: center; font-size: 0.7rem; color: rgba(255,255,255,0.75); margin-top: 1.4rem; font-weight: 600; }
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
