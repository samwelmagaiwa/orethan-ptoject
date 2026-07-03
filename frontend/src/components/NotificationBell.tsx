import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, Check } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

const NotificationBell = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const [items, setItems] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const headers = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const load = async () => {
    if (!localStorage.getItem("token")) return;
    try {
      const res = await axios.get(`${API_BASE}/notifications`, { headers: headers() });
      setItems(res.data.notifications || []);
      setUnread(res.data.unread_count || 0);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    const onFocus = () => load();
    const onClickOut = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current && !btnRef.current.contains(target)) {
        const portal = document.getElementById("notif-bell-portal");
        if (!portal || !portal.contains(target)) setOpen(false);
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("mousedown", onClickOut);
    return () => { clearInterval(timer); window.removeEventListener("focus", onFocus); document.removeEventListener("mousedown", onClickOut); };
  }, []);

  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setOpen(o => !o);
  };

  const openItem = async (n: any) => {
    setOpen(false);
    try { await axios.post(`${API_BASE}/notifications/${n.id}/read`, {}, { headers: headers() }); } catch { /* ignore */ }
    setUnread((u) => Math.max(0, u - (n.read_at ? 0 : 1)));
    setItems((arr) => arr.map((x) => x.id === n.id ? { ...x, read_at: x.read_at || new Date().toISOString() } : x));
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    try { await axios.post(`${API_BASE}/notifications/read-all`, {}, { headers: headers() }); } catch { /* ignore */ }
    setUnread(0);
    setItems((arr) => arr.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
  };

  const ago = (d: string) => {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return t("notifications.justNow");
    if (s < 3600) return t("notifications.minutesAgo", { count: Math.floor(s / 60) });
    if (s < 86400) return t("notifications.hoursAgo", { count: Math.floor(s / 3600) });
    return t("notifications.daysAgo", { count: Math.floor(s / 86400) });
  };

  const dropdown = open ? (
    <div
      id="notif-bell-portal"
      style={{ position: "fixed", top: dropPos.top, right: dropPos.right, width: 340, maxHeight: 420, background: "white", borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 20px 45px rgba(15,23,42,0.18)", zIndex: 99999, overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.8rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
        <span style={{ fontWeight: 800, fontSize: "0.85rem", color: "#0f172a" }}>{t("notifications.title")}</span>
        {unread > 0 && <button onClick={markAll} style={{ display: "flex", alignItems: "center", gap: "0.3rem", background: "none", border: "none", color: "#4f46e5", fontWeight: 700, fontSize: "0.72rem", cursor: "pointer" }}><Check size={13} /> {t("notifications.markAllRead")}</button>}
      </div>
      <div style={{ overflowY: "auto" }}>
        {items.length === 0 ? (
          <div style={{ padding: "2.2rem 1rem", textAlign: "center", color: "#94a3b8", fontSize: "0.82rem", fontWeight: 600 }}>{t("notifications.empty")}</div>
        ) : items.map((n) => (
          <div key={n.id} onClick={() => openItem(n)} style={{ padding: "0.8rem 1rem", borderBottom: "1px solid #f5f7fa", cursor: "pointer", background: n.read_at ? "white" : "#eff6ff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {!n.read_at && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#3b82f6", flexShrink: 0 }} />}
              <span style={{ fontWeight: 800, fontSize: "0.78rem", color: "#0f172a" }}>{n.title}</span>
              <span style={{ marginLeft: "auto", fontSize: "0.64rem", color: "#94a3b8", fontWeight: 600 }}>{ago(n.created_at)}</span>
            </div>
            {n.message && <div style={{ fontSize: "0.74rem", color: "#64748b", marginTop: "0.25rem", lineHeight: 1.4 }}>{n.message}</div>}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        style={{ position: "relative", width: 40, height: 40, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}
      >
        <Bell size={19} />
        {unread > 0 && (
          <span style={{ position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, padding: "0 4px", borderRadius: 9, background: "#ef4444", color: "white", fontSize: "0.62rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(239,68,68,0.4)" }}>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>
      {createPortal(dropdown, document.body)}
    </>
  );
};

export default NotificationBell;
