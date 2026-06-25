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
      await axios.post(`${API_BASE}/change-password`, { new_password: newPassword, new_password_confirmation: confirmPassword }, { headers: { Authorization: `Bearer ${token}` } });
      navigate("/repayment-tracker");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not change password");
    } finally { setLoading(false); }
  };

  return (
    <div className="lg">
      <div className="lg__mesh" />
      <img src={logo} className="lg__bglogo" alt="" aria-hidden="true" />
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
            <p className="lg__sub">First-time sign-in requires a one-time verification code.</p>
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
          background: radial-gradient(1200px 600px at 10% -10%, #e3f2e9 0%, transparent 55%), radial-gradient(1000px 600px at 110% 110%, #e0eefb 0%, transparent 55%), #f6f9fc;
          font-family: 'Inter', -apple-system, 'Segoe UI', sans-serif; }
        .lg__mesh { position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(420px 420px at 85% 15%, rgba(29,138,209,0.10), transparent 70%), radial-gradient(420px 420px at 12% 85%, rgba(124,179,66,0.12), transparent 70%); }
        .lg__bglogo { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); width: min(1150px, 96vw); max-height: 96vh; object-fit: contain; opacity: 0.08; pointer-events: none; z-index: 0; filter: saturate(1.1); }
        .lg__card { position: relative; z-index: 1; width: 100%; max-width: 430px;
          background: rgba(255,255,255,0.45);
          backdrop-filter: blur(22px) saturate(1.5);
          -webkit-backdrop-filter: blur(22px) saturate(1.5);
          border: 1px solid rgba(255,255,255,0.65);
          border-radius: 24px;
          box-shadow: 0 30px 70px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.6);
          padding: 2.2rem 2.2rem 1.6rem; }
        .lg__brand { text-align: center; margin-bottom: 1.4rem; }
        .lg__brand img { height: 86px; width: auto; object-fit: contain; }
        .lg__bars { display: flex; height: 5px; border-radius: 3px; overflow: hidden; margin: 0.8rem auto 0; max-width: 220px; }
        .lg__bars .g { flex: 1; background: linear-gradient(90deg,#7cb342,#aed581); }
        .lg__bars .b { flex: 1; background: linear-gradient(90deg,#1565c0,#1d8ad1); }
        .lg__card h2 { font-size: 1.5rem; font-weight: 800; color: #0f172a; margin: 0 0 0.3rem; letter-spacing: -0.02em; }
        .lg__sub { font-size: 0.84rem; color: #64748b; margin: 0 0 1.3rem; line-height: 1.5; }
        form { display: flex; flex-direction: column; gap: 0; }
        .lg__field { margin-bottom: 1rem; }
        .lg__field label { display: block; font-size: 0.72rem; font-weight: 700; color: #475569; margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.4px; }
        .lg__field input { width: 100%; padding: 0.85rem 1rem; border: 1.5px solid rgba(255,255,255,0.7); border-radius: 12px; font-size: 0.92rem; font-weight: 600; color: #0f172a; outline: none; transition: all 0.18s; background: rgba(255,255,255,0.55); }
        .lg__field input::placeholder { color: #64748b; }
        .lg__field input:focus { border-color: #1d8ad1; box-shadow: 0 0 0 3px rgba(29,138,209,0.15); background: rgba(255,255,255,0.9); }
        .lg__pw { position: relative; }
        .lg__pw > button { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94a3b8; cursor: pointer; display: flex; }
        .lg__pwic { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        .lg__row { display: flex; justify-content: flex-end; margin: -0.3rem 0 1rem; }
        .lg__link { background: none; border: none; color: #1d8ad1; font-weight: 700; font-size: 0.8rem; cursor: pointer; padding: 0; }
        .lg__btn { width: 100%; padding: 0.95rem; border: none; border-radius: 12px; background: linear-gradient(135deg,#102a43,#1d3a5f); color: #fff; font-size: 0.95rem; font-weight: 800; cursor: pointer; transition: all 0.2s; box-shadow: 0 10px 22px rgba(16,42,67,0.28); }
        .lg__btn:hover { transform: translateY(-1px); filter: brightness(1.07); }
        .lg__btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .lg__back { display: inline-flex; align-items: center; gap: 0.3rem; background: none; border: none; color: #64748b; font-weight: 700; font-size: 0.8rem; cursor: pointer; padding: 0; margin-bottom: 1rem; }
        .lg__icon { width: 52px; height: 52px; border-radius: 15px; background: #eef2ff; color: #4f46e5; display: flex; align-items: center; justify-content: center; margin-bottom: 0.9rem; }
        .lg__otpbox { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; background: linear-gradient(135deg,#eef2ff,#e0f2fe); border: 1px solid #c7d2fe; border-radius: 14px; padding: 1rem; margin-bottom: 1.1rem; }
        .lg__otpbox span { font-size: 0.68rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
        .lg__otpbox strong { font-size: 2.1rem; font-weight: 900; color: #102a43; letter-spacing: 0.7rem; padding-left: 0.7rem; }
        .lg__msg { font-size: 0.82rem; font-weight: 600; padding: 0.75rem 0.9rem; border-radius: 10px; margin-bottom: 1rem; line-height: 1.45; }
        .lg__msg--err { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; }
        .lg__msg--info { background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; }
        .lg__foot { text-align: center; font-size: 0.7rem; color: #94a3b8; margin-top: 1.4rem; font-weight: 600; }
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
