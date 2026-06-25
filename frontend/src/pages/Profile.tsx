import { useEffect, useState } from "react";
import axios from "axios";
import { PenLine, Save, ShieldCheck } from "lucide-react";
import SignaturePad from "../components/SignaturePad";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

const Profile = () => {
  const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem("user") || "{}"));
  const [sig, setSig] = useState<string | null>(user?.signature || null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const headers = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    axios.get(`${API_BASE}/me`, { headers: headers() })
      .then((r) => { setUser(r.data); setSig(r.data.signature || null); })
      .catch(() => {});
  }, []);

  const save = async () => {
    if (!sig) { setMsg("Please draw your signature first."); return; }
    setSaving(true); setMsg("");
    try {
      await axios.post(`${API_BASE}/me/signature`, { signature: sig }, { headers: headers() });
      const updated = { ...user, signature: sig };
      localStorage.setItem("user", JSON.stringify(updated));
      setUser(updated);
      setMsg("Signature saved successfully.");
    } catch (e: any) {
      setMsg(e?.response?.data?.message || "Save failed");
    } finally { setSaving(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fdfbf7", padding: "1.2rem 1rem", fontFamily: "'Plus Jakarta Sans','Inter',sans-serif", color: "#1e293b" }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", marginBottom: "1.2rem" }}>
          <PenLine size={22} style={{ color: "#4f46e5" }} />
          <h1 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0, color: "#0f172a" }}>My Profile & Signature</h1>
        </div>

        <div style={{ background: "white", border: "1px solid #eef1f6", borderRadius: 14, boxShadow: "0 6px 18px rgba(15,23,42,0.07)", padding: "1.5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.4rem" }}>
            <Info label="Name" value={user?.name} />
            <Info label="Role" value={String(user?.role || "").replace(/_/g, " ")} />
            <Info label="Email" value={user?.email} />
            <Info label="Phone" value={user?.phone} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.8rem", paddingTop: "1rem", borderTop: "1px solid #f1f5f9" }}>
            <ShieldCheck size={17} style={{ color: "#10b981" }} />
            <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#0f172a" }}>Your Digital Signature</span>
          </div>
          <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 1rem", lineHeight: 1.5 }}>
            Draw your signature below. It will be applied to documents you approve (Payment Requests, Leave Requests, vouchers) and pre-filled on forms you sign.
          </p>

          <SignaturePad value={sig || undefined} onChange={setSig} height={170} />

          {msg && <div style={{ marginTop: "0.9rem", fontSize: "0.8rem", fontWeight: 600, color: msg.includes("success") ? "#059669" : "#dc2626" }}>{msg}</div>}

          <button onClick={save} disabled={saving} style={{ marginTop: "1.2rem", display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1.6rem", borderRadius: 10, background: "#102a43", border: "none", fontWeight: 800, fontSize: "0.85rem", cursor: "pointer", color: "white", boxShadow: "0 6px 16px rgba(16,42,67,0.3)" }}>
            <Save size={16} /> {saving ? "Saving..." : "Save Signature"}
          </button>
        </div>
      </div>
    </div>
  );
};

const Info = ({ label, value }: { label: string; value: any }) => (
  <div>
    <span style={{ display: "block", fontSize: "0.62rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</span>
    <span style={{ fontWeight: 700, color: "#1e293b", textTransform: "capitalize" }}>{value || "—"}</span>
  </div>
);

export default Profile;
