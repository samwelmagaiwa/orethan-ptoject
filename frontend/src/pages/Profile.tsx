import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Camera, Save, ShieldCheck, Mail, Phone, BadgeCheck, PenLine, User as UserIcon } from "lucide-react";
import SignaturePad from "../components/SignaturePad";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

/** Downscale + compress an image to a compact JPEG data URL. */
const fileToAvatar = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 320;
        const scale = Math.min(size / img.width, size / img.height);
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const Profile = () => {
  const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem("user") || "{}"));
  const [sig, setSig] = useState<string | null>(user?.signature || null);
  const [savingSig, setSavingSig] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [padKey, setPadKey] = useState(0); // remount the pad when the saved signature loads
  const fileRef = useRef<HTMLInputElement | null>(null);

  const headers = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    axios.get(`${API_BASE}/me`, { headers: headers() })
      .then((r) => { setUser(r.data); setSig(r.data.signature || null); setPadKey((k) => k + 1); localStorage.setItem("user", JSON.stringify(r.data)); })
      .catch(() => {});
  }, []);

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setMsg("");
    try {
      const avatar = await fileToAvatar(file);
      await axios.post(`${API_BASE}/me/avatar`, { avatar }, { headers: headers() });
      const updated = { ...user, avatar };
      setUser(updated); localStorage.setItem("user", JSON.stringify(updated));
      setMsg("Profile photo updated.");
    } catch { setMsg("Photo upload failed."); } finally { setUploading(false); }
  };

  const saveSignature = async () => {
    if (!sig) { setMsg("Please draw your signature first."); return; }
    setSavingSig(true); setMsg("");
    try {
      await axios.post(`${API_BASE}/me/signature`, { signature: sig }, { headers: headers() });
      const updated = { ...user, signature: sig };
      localStorage.setItem("user", JSON.stringify(updated)); setUser(updated);
      setMsg("Signature saved successfully.");
    } catch (e: any) { setMsg(e?.response?.data?.message || "Save failed"); } finally { setSavingSig(false); }
  };

  const initial = (user?.name || "U").charAt(0).toUpperCase();
  const roleLabel = String(user?.role || "").replace(/_/g, " ");

  return (
    <div style={{ minHeight: "100vh", background: "#fdfbf7", padding: "1.2rem 1.5rem 2rem", fontFamily: "'Plus Jakarta Sans','Inter',sans-serif", color: "#1e293b" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>

        {/* COMPACT HEADER */}
        <div style={{ ...CARD, display: "flex", alignItems: "center", gap: "1.2rem", marginBottom: "1.3rem" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{ width: 92, height: 92, borderRadius: "50%", border: "3px solid #eef1f6", background: "#fff", boxShadow: "0 6px 16px rgba(15,23,42,0.12)", overflow: "hidden" }}>
              {user?.avatar
                ? <img src={user.avatar} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 36 }}>{initial}</div>}
            </div>
            <button onClick={() => fileRef.current?.click()} title="Change photo" style={{ position: "absolute", bottom: 2, right: 2, width: 30, height: 30, borderRadius: "50%", background: "#4f46e5", border: "3px solid white", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 10px rgba(79,70,229,0.4)" }}>
              <Camera size={14} />
            </button>
            <input ref={fileRef} type="file" hidden accept="image/*" onChange={onPickPhoto} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#0f172a", letterSpacing: "-0.02em" }}>{user?.name || "User"}</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, background: "#eef2ff", color: "#4f46e5", padding: "3px 12px", borderRadius: 20, fontSize: "0.74rem", fontWeight: 800, textTransform: "capitalize" }}>
              <BadgeCheck size={13} /> {roleLabel || "—"}
            </div>
            {uploading && <div style={{ marginTop: 8, fontSize: "0.76rem", fontWeight: 600, color: "#4f46e5" }}>Uploading photo…</div>}
          </div>
        </div>

        {/* CONTENT GRID */}
        <div className="prof-grid">

          {/* Account details */}
          <div style={CARD}>
            <SectionTitle icon={<UserIcon size={16} />} title="Account Details" />
            <Detail icon={<UserIcon size={15} />} label="Full Name" value={user?.name} />
            <Detail icon={<BadgeCheck size={15} />} label="Role" value={roleLabel} capitalize />
            <Detail icon={<Mail size={15} />} label="Email" value={user?.email} />
            <Detail icon={<Phone size={15} />} label="Phone" value={user?.phone} last />
            <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.74rem", color: user?.is_locked ? "#dc2626" : "#059669", fontWeight: 700, background: user?.is_locked ? "#fef2f2" : "#ecfdf5", padding: "0.6rem 0.8rem", borderRadius: 10 }}>
              <ShieldCheck size={15} /> {user?.is_locked ? "Account Locked" : "Account Active"}
            </div>
          </div>

          {/* Signature */}
          <div style={CARD}>
            <SectionTitle icon={<PenLine size={16} />} title="Digital Signature" hint="Applied to documents you sign & approve" />
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 1rem", lineHeight: 1.5 }}>
              Draw your signature below. It auto-stamps on documents you approve (Payment Requests, Leave Requests, vouchers) and pre-fills on forms you sign.
            </p>
            <SignaturePad key={padKey} value={sig || undefined} onChange={setSig} height={190} />
            <button onClick={saveSignature} disabled={savingSig} style={{ marginTop: "1.2rem", display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.8rem 1.7rem", borderRadius: 10, background: "#102a43", border: "none", fontWeight: 800, fontSize: "0.85rem", cursor: "pointer", color: "white", boxShadow: "0 6px 16px rgba(16,42,67,0.3)" }}>
              <Save size={16} /> {savingSig ? "Saving..." : "Save Signature"}
            </button>
          </div>
        </div>

        {msg && <div style={{ marginTop: "1rem", fontSize: "0.82rem", fontWeight: 700, color: msg.toLowerCase().includes("success") || msg.toLowerCase().includes("updated") || msg.toLowerCase().includes("saved") ? "#059669" : "#dc2626", background: "#fff", border: "1px solid #eef1f6", borderRadius: 10, padding: "0.7rem 1rem", boxShadow: "0 4px 12px rgba(15,23,42,0.05)" }}>{msg}</div>}

        <style>{`
          .prof-grid { display: grid; grid-template-columns: 1fr 1.4fr; gap: 1.3rem; align-items: start; }
          @media (max-width: 820px){ .prof-grid { grid-template-columns: 1fr; } }
        `}</style>
      </div>
    </div>
  );
};

const CARD: React.CSSProperties = { background: "white", borderRadius: 16, border: "1px solid #eef1f6", boxShadow: "0 8px 22px rgba(15,23,42,0.06)", padding: "1.5rem 1.6rem" };

const SectionTitle = ({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) => (
  <div style={{ marginBottom: "1.1rem" }}>
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: "#eef2ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
      <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#0f172a" }}>{title}</h3>
    </div>
    {hint && <div style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 600, marginTop: "0.3rem", marginLeft: "2.4rem" }}>{hint}</div>}
  </div>
);

const Detail = ({ icon, label, value, last, capitalize }: any) => (
  <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", padding: "0.75rem 0", borderBottom: last ? "none" : "1px solid #f4f6f9" }}>
    <div style={{ width: 34, height: 34, borderRadius: 9, background: "#f8fafc", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</div>
      <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#1e293b", textTransform: capitalize ? "capitalize" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value || "—"}</div>
    </div>
  </div>
);

export default Profile;
