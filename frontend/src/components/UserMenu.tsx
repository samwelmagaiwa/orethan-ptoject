import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Camera, PenLine, LogOut, ChevronDown, User as UserIcon } from "lucide-react";
import { API_BASE } from "../lib/api";


/** Downscale + compress an image file to a small JPEG data URL. */
const fileToAvatar = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const scale = Math.min(size / img.width, size / img.height);
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const UserMenu = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem("user") || "{}"));
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const ref = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const headers = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    axios.get(`${API_BASE}/me`, { headers: headers() })
      .then((r) => { setUser(r.data); localStorage.setItem("user", JSON.stringify(r.data)); })
      .catch(() => {});
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const avatar = await fileToAvatar(file);
      await axios.post(`${API_BASE}/me/avatar`, { avatar }, { headers: headers() });
      const updated = { ...user, avatar };
      setUser(updated); localStorage.setItem("user", JSON.stringify(updated));
    } catch { alert(t("userMenu.uploadFailed")); } finally { setUploading(false); }
  };

  const logout = async () => {
    try { await axios.post(`${API_BASE}/logout`, {}, { headers: headers() }); } catch { /* ignore */ }
    localStorage.removeItem("token"); localStorage.removeItem("user");
    navigate("/login");
  };

  const initial = (user?.name || "U").charAt(0).toUpperCase();
  const roleKey = String(user?.role || "");
  const roleLabel = i18n.exists(`roles.${roleKey}`) ? t(`roles.${roleKey}`) : roleKey.replace(/_/g, " ");

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        id="um-trigger"
        onClick={(e) => {
          const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
          // Clamp top to always clear the 80px sticky navbar
          setDropPos({ top: Math.max(r.bottom + 8, 90), right: window.innerWidth - r.right });
          setOpen((o) => !o);
        }}
        style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "5px 10px 5px 5px", cursor: "pointer" }}>
        <Avatar avatar={user?.avatar} initial={initial} size={34} />
        <div style={{ textAlign: "left", lineHeight: 1.1 }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#0f172a", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name || t("userMenu.user")}</div>
          <div style={{ fontSize: "0.62rem", color: "#94a3b8", fontWeight: 700, textTransform: "capitalize" }}>{roleLabel || "--"}</div>
        </div>
        <ChevronDown size={15} style={{ color: "#94a3b8" }} />
      </button>

      {open && (
        <div style={{ position: "fixed", top: dropPos.top, right: dropPos.right, width: 280, background: "white", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 24px 50px rgba(15,23,42,0.2)", zIndex: 9999, overflow: "hidden" }}>
          {/* Header with avatar */}
          <div style={{ background: "linear-gradient(135deg,#102a43,#1d3a5f)", padding: "1.1rem 1.1rem 1rem", color: "white", textAlign: "center", position: "relative" }}>
            <div style={{ position: "relative", width: 72, height: 72, margin: "0 auto 0.6rem" }}>
              <Avatar avatar={user?.avatar} initial={initial} size={72} ring />
              <button onClick={() => fileRef.current?.click()} title={t("userMenu.changePhotoTitle")} style={{ position: "absolute", bottom: -2, right: -2, width: 26, height: 26, borderRadius: "50%", background: "#4f46e5", border: "2px solid white", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Camera size={13} />
              </button>
              <input ref={fileRef} type="file" hidden accept="image/*" onChange={onPick} />
            </div>
            <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>{user?.name || t("userMenu.user")}</div>
            <div style={{ fontSize: "0.72rem", opacity: 0.85, textTransform: "capitalize" }}>{roleLabel}</div>
            <div style={{ fontSize: "0.68rem", opacity: 0.7, marginTop: 2 }}>{user?.email}</div>
            {uploading && <div style={{ fontSize: "0.66rem", marginTop: 6, opacity: 0.9 }}>{t("userMenu.uploadingPhoto")}</div>}
          </div>

          {/* Actions */}
          <div style={{ padding: "0.5rem" }}>
            <MenuItem icon={<Camera size={16} />} label={t("userMenu.changePhoto")} onClick={() => fileRef.current?.click()} />
            <MenuItem icon={<UserIcon size={16} />} label={t("userMenu.myProfile")} onClick={() => { setOpen(false); navigate("/profile"); }} />
            <MenuItem icon={<PenLine size={16} />} label={t("userMenu.mySignature")} onClick={() => { setOpen(false); navigate("/profile"); }} />
            <div style={{ height: 1, background: "#f1f5f9", margin: "0.4rem 0" }} />
            <MenuItem icon={<LogOut size={16} />} label={t("userMenu.logout")} danger onClick={logout} />
          </div>
        </div>
      )}
    </div>
  );
};

const Avatar = ({ avatar, initial, size, ring }: { avatar?: string; initial: string; size: number; ring?: boolean }) => (
  avatar ? (
    <img src={avatar} alt="avatar" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: ring ? "3px solid rgba(255,255,255,0.5)" : "1px solid #e2e8f0" }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: size * 0.4, border: ring ? "3px solid rgba(255,255,255,0.5)" : "none" }}>{initial}</div>
  )
);

const MenuItem = ({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) => (
  <button onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.7rem", padding: "0.6rem 0.7rem", borderRadius: 10, background: "transparent", border: "none", cursor: "pointer", fontSize: "0.82rem", fontWeight: 700, color: danger ? "#dc2626" : "#334155", transition: "background 0.15s" }}
    onMouseEnter={(e) => (e.currentTarget.style.background = danger ? "#fef2f2" : "#f1f5f9")}
    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
    <span style={{ color: danger ? "#dc2626" : "#64748b", display: "flex" }}>{icon}</span> {label}
  </button>
);

export default UserMenu;
