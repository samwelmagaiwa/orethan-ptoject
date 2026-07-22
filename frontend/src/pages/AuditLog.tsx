import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { API_BASE } from "../lib/api";

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` });

// ── Brand colours (from Orethan logo: teal + navy) ───────────────────────────
const BRAND = {
  teal:      "#0d9488",
  tealLight: "#ccfbf1",
  tealMid:   "#14b8a6",
  navy:      "#0f172a",
  navyMid:   "#1e293b",
  navySoft:  "#334155",
};

const ACTION_META: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  login:          { color: "#0369a1", bg: "#e0f2fe", border: "#7dd3fc", icon: "🔐" },
  logout:         { color: "#475569", bg: "#f1f5f9", border: "#cbd5e1", icon: "🚪" },
  create:         { color: "#15803d", bg: "#dcfce7", border: "#86efac", icon: "➕" },
  update:         { color: "#1d4ed8", bg: "#dbeafe", border: "#93c5fd", icon: "✏️" },
  delete:         { color: "#b91c1c", bg: "#fee2e2", border: "#fca5a5", icon: "🗑️" },
  approve:        { color: "#15803d", bg: "#dcfce7", border: "#86efac", icon: "✅" },
  reject:         { color: "#b91c1c", bg: "#fee2e2", border: "#fca5a5", icon: "❌" },
  disburse:       { color: "#7c3aed", bg: "#ede9fe", border: "#c4b5fd", icon: "💸" },
  repay:          { color: "#0891b2", bg: "#cffafe", border: "#67e8f9", icon: "💰" },
  reset_password: { color: "#c2410c", bg: "#ffedd5", border: "#fdba74", icon: "🔑" },
  lock:           { color: "#92400e", bg: "#fef3c7", border: "#fcd34d", icon: "🔒" },
  unlock:         { color: "#15803d", bg: "#dcfce7", border: "#86efac", icon: "🔓" },
  submit:         { color: "#1d4ed8", bg: "#dbeafe", border: "#93c5fd", icon: "📤" },
};

const ROLE_META: Record<string, { color: string; bg: string; short: string }> = {
  admin:              { color: "#7c3aed", bg: "#ede9fe", short: "ADM" },
  loan_officer:       { color: "#0891b2", bg: "#cffafe", short: "LO"  },
  loan_manager:       { color: "#1d4ed8", bg: "#dbeafe", short: "LM"  },
  general_manager:    { color: "#15803d", bg: "#dcfce7", short: "GM"  },
  managing_director:  { color: "#92400e", bg: "#fef3c7", short: "MD"  },
  finance_officer:    { color: "#0369a1", bg: "#e0f2fe", short: "FO"  },
  cashier:            { color: "#475569", bg: "#f1f5f9", short: "CSH" },
};

const MODULE_ICON: Record<string, string> = {
  Auth: "🔑", User: "👤", Customer: "🧑", Loan: "📋",
  PaymentRequest: "💳", LeaveRequest: "🏖️", BranchReport: "📊",
  LoanSettings: "⚙️", System: "🔧",
};

const MODULES = ["All","Auth","User","Customer","Loan","PaymentRequest","LeaveRequest","BranchReport","LoanSettings"];
const ACTIONS = ["All","login","logout","create","update","delete","approve","reject","disburse","reset_password","lock","unlock"];

function elapsed(dateStr: string) {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m`;
  if (s < 86400) return `${Math.floor(s/3600)}h`;
  return `${Math.floor(s/86400)}d`;
}

function fmtTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-TZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-TZ", { day: "2-digit", month: "short", year: "numeric" });
}

function roleLabel(r: string) {
  return r?.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()) ?? "—";
}

// thin brand-coloured divider
const Divider = ({ my = 0 }: { my?: number }) => (
  <div style={{ height: 2, background: `linear-gradient(90deg, ${BRAND.teal}, ${BRAND.tealMid}55, transparent)`, margin: `${my}px 0` }} />
);

export default function AuditLog() {
  const [logs,      setLogs]      = useState<any[]>([]);
  const [online,    setOnline]    = useState<any[]>([]);
  const [users,     setUsers]     = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [page,      setPage]      = useState(1);
  const [lastPage,  setLastPage]  = useState(1);
  const [total,     setTotal]     = useState(0);

  const [search,       setSearch]       = useState("");
  const [filterModule, setFilterModule] = useState("All");
  const [filterAction, setFilterAction] = useState("All");
  const [filterUser,   setFilterUser]   = useState("");
  const [filterDate,   setFilterDate]   = useState("");
  const [autoRefresh,  setAutoRefresh]  = useState(true);

  const [selected,   setSelected]   = useState<Set<number>>(new Set());
  const [deleting,   setDeleting]   = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async (p = 1) => {
    try {
      const params: any = { page: p };
      if (search)                   params.search    = search;
      if (filterModule !== "All")   params.module    = filterModule;
      if (filterAction !== "All")   params.action    = filterAction;
      if (filterUser)               params.user_id   = filterUser;
      if (filterDate)               params.date      = filterDate;

      const res = await axios.get(`${API_BASE}/activity-logs`, { headers: auth(), params });
      setLogs(res.data.logs.data);
      setLastPage(res.data.logs.last_page);
      setTotal(res.data.logs.total);
      setOnline(res.data.online ?? []);
    } catch { /* not admin */ }
    finally { setLoading(false); }
  }, [search, filterModule, filterAction, filterUser, filterDate]);

  useEffect(() => {
    axios.get(`${API_BASE}/activity-logs/users`, { headers: auth() })
      .then(r => setUsers(r.data)).catch(() => {});
  }, []);

  useEffect(() => { setPage(1); fetchLogs(1); }, [search, filterModule, filterAction, filterUser, filterDate]);
  useEffect(() => { fetchLogs(page); }, [page]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoRefresh) timerRef.current = setInterval(() => fetchLogs(page), 30000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefresh, page, fetchLogs]);

  const clearFilters = () => { setSearch(""); setFilterModule("All"); setFilterAction("All"); setFilterUser(""); setFilterDate(""); };

  const toggleSelect = (id: number) => setSelected(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const toggleSelectAll = () => {
    if (selected.size === logs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(logs.map((l: any) => l.id)));
    }
  };

  const deleteOne = async (id: number) => {
    if (!confirm("Delete this event?")) return;
    try {
      await axios.delete(`${API_BASE}/activity-logs/${id}`, { headers: auth() });
      setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
      fetchLogs(page);
    } catch { alert("Delete failed."); }
  };

  const deleteBulk = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected event(s)? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await axios.delete(`${API_BASE}/activity-logs/bulk`, {
        headers: auth(),
        data: { ids: Array.from(selected) },
      });
      setSelected(new Set());
      fetchLogs(page);
    } catch { alert("Bulk delete failed."); }
    finally { setDeleting(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", padding: "0 0 48px" }}>

      {/* ── Page Header — STICKY, matches other pages ── */}
      <div style={{
        background: "#f1f5f9",
        borderBottom: "2px solid #e2e8f0",
        padding: "10px 32px",
        position: "sticky",
        top: 0,
        zIndex: 50,
        boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18 }}>🔍</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0f172a" }}>Event Auditor</h1>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
              Real-time activity log — who did what, when, and from where
            </p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: BRAND.teal, lineHeight: 1 }}>{total.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Events</div>
            </div>
            <div style={{ width: 1, height: 28, background: "#e2e8f0" }} />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: online.length > 0 ? "#22c55e" : "#94a3b8", lineHeight: 1 }}>{online.length}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Online Now</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Body ────────────────────────────────────────────────────── */}
      <div style={{ padding: "28px 32px 0", display: "flex", gap: 0, alignItems: "flex-start" }}>

        {/* ════════════════════════════════════════════════════════════════
            LEFT — Filters + Activity Table  (flex: 1)
        ════════════════════════════════════════════════════════════════ */}
        <div style={{ flex: 1, minWidth: 0, paddingRight: 28 }}>

          {/* Filter Bar */}
          <div style={{
            background: "white", borderRadius: 14, overflow: "hidden",
            border: "1px solid #e2e8f0",
            boxShadow: "0 2px 12px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)",
            marginBottom: 20,
          }}>
            <div style={{
              padding: "12px 20px", background: `linear-gradient(90deg, ${BRAND.teal}0d, transparent)`,
              borderBottom: `2px solid ${BRAND.teal}`,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 14 }}>🔎</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: BRAND.navy }}>Filter Activity</span>
              {(search || filterModule !== "All" || filterAction !== "All" || filterUser || filterDate) && (
                <button onClick={clearFilters} style={{
                  marginLeft: "auto", background: "#fee2e2", color: "#b91c1c", border: "none",
                  borderRadius: 20, padding: "3px 12px", fontSize: 11, cursor: "pointer", fontWeight: 700,
                }}>✕ Clear</button>
              )}
            </div>
            <div style={{ padding: "16px 20px", display: "flex", flexWrap: "wrap", gap: 12 }}>
              <div style={{ position: "relative", flex: "1 1 200px" }}>
                <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#94a3b8" }}>🔍</span>
                <input type="text" placeholder="Search descriptions, users…" value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: "100%", paddingLeft: 32, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: "1px solid #e2e8f0", borderRadius: 9, fontSize: 13, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
                  onFocus={e => e.target.style.borderColor = BRAND.teal}
                  onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                />
              </div>
              {[
                { val: filterModule, set: setFilterModule, opts: MODULES, placeholder: "Module" },
                { val: filterAction, set: setFilterAction, opts: ACTIONS,  placeholder: "Action" },
              ].map(({ val, set, opts, placeholder }, i) => (
                <select key={i} value={val} onChange={e => set(e.target.value)}
                  style={{ padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 9, fontSize: 13, background: "white", color: "#334155", outline: "none", cursor: "pointer" }}>
                  <option value="All">{placeholder}: All</option>
                  {opts.filter(o => o !== "All").map(o => <option key={o}>{o}</option>)}
                </select>
              ))}
              <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
                style={{ padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 9, fontSize: 13, background: "white", color: "#334155", outline: "none", cursor: "pointer", minWidth: 140 }}>
                <option value="">User: All</option>
                {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                style={{ padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 9, fontSize: 13, color: "#334155", outline: "none" }} />
            </div>
          </div>

          {/* Activity Table */}
          <div style={{
            background: "white", borderRadius: 14, overflow: "hidden",
            border: "1px solid #e2e8f0",
            boxShadow: "0 2px 12px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)",
          }}>
            {/* Table header strip */}
            <div style={{
              padding: "12px 20px",
              background: `linear-gradient(90deg, ${BRAND.navy}, ${BRAND.navyMid})`,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 14 }}>📋</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: "white" }}>Activity Log</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>
                {total.toLocaleString()} events · page {page}/{lastPage}
              </span>
            </div>

            {/* Bulk-action toolbar — shown only when rows are selected */}
            {selected.size > 0 && (
              <div style={{
                padding: "10px 20px",
                background: "#fff7ed",
                borderBottom: "2px solid #fed7aa",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#c2410c" }}>
                  {selected.size} event{selected.size > 1 ? "s" : ""} selected
                </span>
                <button onClick={deleteBulk} disabled={deleting} style={{
                  background: "#b91c1c", color: "white", border: "none",
                  borderRadius: 8, padding: "6px 18px", fontSize: 12,
                  fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                  opacity: deleting ? 0.6 : 1,
                }}>
                  🗑️ {deleting ? "Deleting…" : `Delete ${selected.size > 1 ? "All Selected" : "Selected"}`}
                </button>
                <button onClick={() => setSelected(new Set())} style={{
                  background: "transparent", color: "#64748b", border: "1px solid #cbd5e1",
                  borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer",
                }}>✕ Deselect</button>
              </div>
            )}
            <Divider />

            {loading ? (
              <div style={{ padding: 56, textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>⏳</div>
                <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>Loading activity…</p>
              </div>
            ) : logs.length === 0 ? (
              <div style={{ padding: 56, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📋</div>
                <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>No activity found for current filters.</p>
              </div>
            ) : (
              <>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${BRAND.teal}33` }}>
                        {/* Select-all checkbox */}
                      <th style={{ padding: "10px 12px", background: "#f8fafc", width: 36 }}>
                        <input type="checkbox"
                          checked={logs.length > 0 && selected.size === logs.length}
                          onChange={toggleSelectAll}
                          style={{ accentColor: BRAND.teal, cursor: "pointer", width: 15, height: 15 }}
                        />
                      </th>
                      {[
                          { label: "Time",        w: 110 },
                          { label: "User",        w: 160 },
                          { label: "Action",      w: 130 },
                          { label: "Module",      w: 110 },
                          { label: "Description", w: "auto" as any },
                          { label: "IP",          w: 110 },
                          { label: "",            w: 44  },
                        ].map(({ label, w }) => (
                          <th key={label} style={{
                            padding: "10px 16px", textAlign: "left",
                            fontSize: 10, fontWeight: 800, color: "#64748b",
                            textTransform: "uppercase", letterSpacing: "0.07em",
                            background: "#f8fafc", width: w !== "auto" ? w : undefined,
                            whiteSpace: "nowrap",
                          }}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log: any, i) => {
                        const meta = ACTION_META[log.action] ?? { color: "#475569", bg: "#f1f5f9", border: "#cbd5e1", icon: "•" };
                        const rm   = ROLE_META[log.user_role] ?? { color: "#475569", bg: "#f1f5f9", short: "?" };
                        const isEven = i % 2 === 0;
                        return (
                          <tr key={log.id}
                            style={{
                              background: selected.has(log.id) ? "#fff7ed" : isEven ? "white" : "#fafbfd",
                              borderBottom: "1px solid #f1f5f9", transition: "background 0.12s",
                              outline: selected.has(log.id) ? "2px solid #fed7aa" : "none",
                            }}
                            onMouseEnter={e => { if (!selected.has(log.id)) e.currentTarget.style.background = `${BRAND.teal}0a`; }}
                            onMouseLeave={e => { if (!selected.has(log.id)) e.currentTarget.style.background = isEven ? "white" : "#fafbfd"; }}
                          >
                            {/* Checkbox */}
                            <td style={{ padding: "10px 12px", borderLeft: `3px solid ${selected.has(log.id) ? "#f97316" : meta.border}` }}>
                              <input type="checkbox"
                                checked={selected.has(log.id)}
                                onChange={() => toggleSelect(log.id)}
                                style={{ accentColor: BRAND.teal, cursor: "pointer", width: 15, height: 15 }}
                              />
                            </td>
                            {/* Time */}
                            <td style={{ padding: "10px 16px", whiteSpace: "nowrap" }}>
                              <div style={{ fontWeight: 700, fontSize: 12, color: BRAND.navy }}>{fmtTime(log.created_at)}</div>
                              <div style={{ fontSize: 10, color: "#94a3b8" }}>{fmtDate(log.created_at)}</div>
                              <div style={{ fontSize: 9, color: BRAND.teal, fontWeight: 700, marginTop: 1 }}>{elapsed(log.created_at)} ago</div>
                            </td>
                            {/* User */}
                            <td style={{ padding: "10px 16px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                <div style={{
                                  width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                                  background: rm.bg, color: rm.color,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: 9, fontWeight: 800, border: `1px solid ${rm.color}33`,
                                }}>{rm.short}</div>
                                <div>
                                  <div style={{ fontWeight: 700, color: BRAND.navy, fontSize: 12 }}>{log.user_name ?? "System"}</div>
                                  {log.record_label && <div style={{ fontSize: 10, color: "#64748b" }}>↳ {log.record_label}</div>}
                                </div>
                              </div>
                            </td>
                            {/* Action */}
                            <td style={{ padding: "10px 16px" }}>
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 5,
                                background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`,
                                borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 700,
                              }}>
                                {meta.icon} {log.action}
                              </span>
                            </td>
                            {/* Module */}
                            <td style={{ padding: "10px 16px" }}>
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                background: `${BRAND.teal}0d`, color: BRAND.teal,
                                borderRadius: 8, padding: "3px 9px", fontSize: 11, fontWeight: 600,
                                border: `1px solid ${BRAND.teal}22`,
                              }}>
                                {MODULE_ICON[log.module] ?? "📦"} {log.module}
                              </span>
                            </td>
                            {/* Description */}
                            <td style={{ padding: "10px 16px", color: "#334155", fontSize: 12, maxWidth: 340, lineHeight: 1.5 }}>
                              {log.description}
                            </td>
                            {/* IP */}
                            <td style={{ padding: "10px 16px", fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", fontFamily: "monospace" }}>
                              {log.ip_address ?? "—"}
                            </td>
                            {/* Delete */}
                            <td style={{ padding: "10px 8px", textAlign: "center" }}>
                              <button
                                onClick={() => deleteOne(log.id)}
                                title="Delete this event"
                                style={{
                                  background: "transparent", border: "none", cursor: "pointer",
                                  fontSize: 15, padding: "3px 6px", borderRadius: 6, lineHeight: 1,
                                  color: "#fca5a5", transition: "background 0.15s, color 0.15s",
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fee2e2"; (e.currentTarget as HTMLButtonElement).style.color = "#b91c1c"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#fca5a5"; }}
                              >🗑️</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div style={{ padding: "12px 20px", borderTop: `1px solid #f1f5f9`, display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => setPage(1)} disabled={page === 1}
                    style={{ padding: "5px 11px", borderRadius: 7, border: "1px solid #e2e8f0", background: "white", fontSize: 12, color: "#475569", cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.4 : 1 }}>«</button>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    style={{ padding: "5px 14px", borderRadius: 7, border: "1px solid #e2e8f0", background: "white", fontSize: 12, color: "#475569", cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.4 : 1 }}>‹ Prev</button>
                  <div style={{ flex: 1, textAlign: "center", fontSize: 12, color: "#64748b" }}>
                    Page <strong>{page}</strong> of <strong>{lastPage}</strong>
                    <span style={{ marginLeft: 10, color: "#94a3b8" }}>({total.toLocaleString()} total)</span>
                  </div>
                  <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page === lastPage}
                    style={{ padding: "5px 14px", borderRadius: 7, border: "1px solid #e2e8f0", background: "white", fontSize: 12, color: "#475569", cursor: page === lastPage ? "default" : "pointer", opacity: page === lastPage ? 0.4 : 1 }}>Next ›</button>
                  <button onClick={() => setPage(lastPage)} disabled={page === lastPage}
                    style={{ padding: "5px 11px", borderRadius: 7, border: "1px solid #e2e8f0", background: "white", fontSize: 12, color: "#475569", cursor: page === lastPage ? "default" : "pointer", opacity: page === lastPage ? 0.4 : 1 }}>»</button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            RIGHT — Online Users Panel  (fixed width, sticky)
        ════════════════════════════════════════════════════════════════ */}
        <div style={{
          width: 320, flexShrink: 0, position: "sticky", top: 70,
          alignSelf: "flex-start",
          borderLeft: `3px solid ${BRAND.teal}`,
          paddingLeft: 24,
          boxShadow: `-6px 0 18px rgba(13,148,136,0.10)`,
        }}>
          <div style={{
            background: "white", borderRadius: 14, overflow: "hidden",
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 20px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.05)",
          }}>
            {/* Header */}
            <div style={{
              padding: "14px 16px",
              background: `linear-gradient(135deg, ${BRAND.navy}, ${BRAND.navyMid})`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>🌐</span>
                <span style={{ fontWeight: 800, fontSize: 14, color: "white" }}>Online Now</span>
                <span style={{
                  marginLeft: "auto",
                  background: online.length > 0 ? "#22c55e" : "#475569",
                  color: "white", borderRadius: 20, padding: "2px 9px",
                  fontSize: 11, fontWeight: 800,
                }}>{online.length}</span>
              </div>
              <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button onClick={() => fetchLogs(page)} style={{
                  background: `${BRAND.teal}22`, color: BRAND.tealMid, border: `1px solid ${BRAND.teal}44`,
                  borderRadius: 8, padding: "5px 12px", fontSize: 11, cursor: "pointer", fontWeight: 700,
                }}>⟳ Refresh</button>
                <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#94a3b8", cursor: "pointer" }}>
                  <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)}
                    style={{ accentColor: BRAND.teal }} />
                  Auto 30s
                </label>
              </div>
            </div>
            <Divider />

            {/* User list */}
            <div style={{ maxHeight: 460, overflowY: "auto" }}>
              {online.length === 0 ? (
                <div style={{ padding: "32px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 32, opacity: 0.2, marginBottom: 8 }}>😴</div>
                  <p style={{ color: "#94a3b8", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                    No users active<br />in the last 5 minutes
                  </p>
                </div>
              ) : (
                online.map((u: any, i) => {
                  const rm = ROLE_META[u.role] ?? { color: "#475569", bg: "#f1f5f9", short: "?" };
                  return (
                    <div key={u.id}>
                      <div style={{ padding: "11px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                        {/* Avatar */}
                        <div style={{
                          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                          background: `linear-gradient(135deg, ${rm.color}22, ${rm.color}44)`,
                          border: `1px solid ${rm.color}44`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 800, fontSize: 13, color: rm.color, position: "relative",
                        }}>
                          {u.name?.[0]?.toUpperCase() ?? "?"}
                          {/* online dot */}
                          <span style={{
                            position: "absolute", bottom: -2, right: -2,
                            width: 9, height: 9, background: "#22c55e", borderRadius: "50%",
                            border: "2px solid white",
                          }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: BRAND.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {u.name}
                          </div>
                          <div style={{ fontSize: 10, color: rm.color, fontWeight: 700, marginTop: 1 }}>
                            {roleLabel(u.role)}
                          </div>
                        </div>
                        <div style={{ fontSize: 10, color: "#94a3b8", flexShrink: 0, textAlign: "right" }}>
                          <div style={{ color: "#22c55e", fontWeight: 700 }}>ACTIVE</div>
                          <div>{elapsed(u.last_seen_at)} ago</div>
                        </div>
                      </div>
                      {i < online.length - 1 && (
                        <div style={{ height: 1, background: "#f1f5f9", margin: "0 16px" }} />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Legend divider */}
            <Divider my={0} />

            {/* Action legend */}
            <div style={{ padding: "12px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 9 }}>
                Action Legend
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 8px" }}>
                {Object.entries(ACTION_META).map(([action, meta]) => (
                  <div key={action} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 18, height: 18, borderRadius: 5,
                      background: meta.bg, fontSize: 10,
                    }}>{meta.icon}</span>
                    <span style={{ fontSize: 10, color: meta.color, fontWeight: 600 }}>{action}</span>
                  </div>
                ))}
              </div>
            </div>

            <Divider my={0} />

            {/* Module legend */}
            <div style={{ padding: "12px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 9 }}>
                Modules
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 8px" }}>
                {Object.entries(MODULE_ICON).map(([mod, icon]) => (
                  <div key={mod} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontSize: 12 }}>{icon}</span>
                    <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>{mod}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* end RIGHT panel */}

      </div>
      {/* end main body */}
    </div>
  );
}
