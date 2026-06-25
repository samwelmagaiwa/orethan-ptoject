import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Bell, Check } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

const NotificationBell = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);

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
    const t = setInterval(load, 30000);
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => { clearInterval(t); document.removeEventListener("mousedown", onClick); };
  }, []);

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
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ position: "relative", width: 40, height: 40, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}>
        <Bell size={19} />
        {unread > 0 && (
          <span style={{ position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, padding: "0 4px", borderRadius: 9, background: "#ef4444", color: "white", fontSize: "0.62rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(239,68,68,0.4)" }}>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div style={{ position: "absolute", top: 48, right: 0, width: 340, maxHeight: 420, background: "white", borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 20px 45px rgba(15,23,42,0.18)", zIndex: 200, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.8rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
            <span style={{ fontWeight: 800, fontSize: "0.85rem", color: "#0f172a" }}>Notifications</span>
            {unread > 0 && <button onClick={markAll} style={{ display: "flex", alignItems: "center", gap: "0.3rem", background: "none", border: "none", color: "#4f46e5", fontWeight: 700, fontSize: "0.72rem", cursor: "pointer" }}><Check size={13} /> Mark all read</button>}
          </div>
          <div style={{ overflowY: "auto" }}>
            {items.length === 0 ? (
              <div style={{ padding: "2.2rem 1rem", textAlign: "center", color: "#94a3b8", fontSize: "0.82rem", fontWeight: 600 }}>No notifications</div>
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
      )}
    </div>
  );
};

export default NotificationBell;
