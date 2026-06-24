import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import {
  AlertTriangle, Wallet, Coins, Users, CalendarClock, CalendarDays,
  ShieldAlert, TrendingUp, Gauge, Ban, RefreshCw, Search, Phone, X, ClipboardList, History,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
const fmt = (v: any) => `TZS ${Math.round(Number(v) || 0).toLocaleString()}`;
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

const CARD_STYLE: React.CSSProperties = { background: "white", borderRadius: 14, border: "1px solid #eef1f6", boxShadow: "0 6px 18px rgba(15,23,42,0.07)" };
const GAP = "0.75rem";

// Hali (status) -> lebo ya Kiswahili + rangi
const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  due_today: { label: "Inadaiwa Leo", bg: "#eef2ff", color: "#4f46e5" },
  "1-7": { label: "Siku 1-7", bg: "#fffbeb", color: "#d97706" },
  "8-30": { label: "Siku 8-30", bg: "#fff7ed", color: "#ea580c" },
  "31-60": { label: "Siku 31-60", bg: "#fef2f2", color: "#dc2626" },
  "61-90": { label: "Siku 61-90", bg: "#fef2f2", color: "#b91c1c" },
  "90+": { label: "Imeshindwa 90+", bg: "#fee2e2", color: "#991b1b" },
  defaulted: { label: "Imeshindwa", bg: "#fee2e2", color: "#991b1b" },
  legal: { label: "Hatua za Kisheria", bg: "#1e293b", color: "#f8fafc" },
  restructured: { label: "Imepangwa Upya", bg: "#ecfdf5", color: "#059669" },
  written_off: { label: "Imefutwa", bg: "#f1f5f9", color: "#64748b" },
};
const RISK_META: Record<string, { label: string; bg: string; color: string }> = {
  low: { label: "Ndogo", bg: "#ecfdf5", color: "#059669" },
  medium: { label: "Wastani", bg: "#fffbeb", color: "#d97706" },
  high: { label: "Kubwa", bg: "#fff7ed", color: "#ea580c" },
  critical: { label: "Hatari Kubwa", bg: "#fee2e2", color: "#dc2626" },
};
const STAGES = [
  { value: "reminder", label: "Ukumbusho" },
  { value: "follow_up", label: "Ufuatiliaji" },
  { value: "recovery", label: "Urejeshaji" },
  { value: "escalation", label: "Kupandisha" },
  { value: "closure", label: "Kufunga" },
];
const METHODS = [
  { value: "sms", label: "SMS" }, { value: "email", label: "Barua pepe" }, { value: "call", label: "Simu" },
  { value: "whatsapp", label: "WhatsApp" }, { value: "letter", label: "Barua" }, { value: "field_visit", label: "Ziara" }, { value: "app", label: "Programu" },
];
const RECOVERY_STATUSES = [
  { value: "reminder", label: "Ukumbusho" }, { value: "follow_up", label: "Ufuatiliaji" }, { value: "recovery", label: "Urejeshaji" },
  { value: "escalation", label: "Kupandisha" }, { value: "legal", label: "Kisheria" }, { value: "restructured", label: "Kupanga Upya" },
  { value: "written_off", label: "Kufuta" }, { value: "closed", label: "Funga" },
];

interface OverdueLoan {
  loan_id: number; loan_number: string; borrower: string; customer_id: string; product: string; branch: string;
  loan_officer: string; loan_amount: number; outstanding_balance: number; installment_amount: number;
  due_date: string; days_past_due: number; penalty_amount: number; total_due: number; status: string; risk: string;
  recovery_status: string; activities_count: number;
}

const OverdueManagement = () => {
  const [dash, setDash] = useState<any>(null);
  const [loans, setLoans] = useState<OverdueLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");

  // Modal ya kurekodi hatua
  const [modalLoan, setModalLoan] = useState<OverdueLoan | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [stage, setStage] = useState("reminder");
  const [method, setMethod] = useState("call");
  const [notes, setNotes] = useState("");
  const [promisedAmount, setPromisedAmount] = useState("");
  const [promisedDate, setPromisedDate] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [recoveryStatus, setRecoveryStatus] = useState("follow_up");
  const [saving, setSaving] = useState(false);

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const load = async () => {
    setLoading(true);
    try {
      const [d, l] = await Promise.all([
        axios.get(`${API_BASE}/overdue/dashboard`, { headers: authHeaders() }),
        axios.get(`${API_BASE}/overdue/loans`, { headers: authHeaders(), params: { search, status: statusFilter, risk: riskFilter } }),
      ]);
      setDash(d.data);
      setLoans(l.data.loans || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [search, statusFilter, riskFilter]);

  const openModal = async (loan: OverdueLoan) => {
    setModalLoan(loan);
    setStage("reminder"); setMethod("call"); setNotes(""); setPromisedAmount(""); setPromisedDate(""); setNextAction(""); setRecoveryStatus("follow_up");
    try {
      const res = await axios.get(`${API_BASE}/overdue/loans/${loan.loan_id}/activities`, { headers: authHeaders() });
      setActivities(res.data.activities || []);
    } catch { setActivities([]); }
  };

  const saveActivity = async () => {
    if (!modalLoan) return;
    setSaving(true);
    try {
      await axios.post(`${API_BASE}/overdue/loans/${modalLoan.loan_id}/activities`, {
        stage, contact_method: method, notes,
        promised_amount: promisedAmount ? Number(promisedAmount) : null,
        promised_date: promisedDate || null, next_action_date: nextAction || null, recovery_status: recoveryStatus,
      }, { headers: authHeaders() });
      setModalLoan(null);
      await load();
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const cards = [
    { label: "Mikopo Iliyochelewa", value: dash?.total_overdue_loans ?? 0, icon: <AlertTriangle size={18} />, g: "linear-gradient(135deg,#ef4444,#f87171)" },
    { label: "Jumla ya Deni", value: fmt(dash?.total_overdue_amount), icon: <Wallet size={18} />, g: "linear-gradient(135deg,#f59e0b,#fbbf24)" },
    { label: "Jumla ya Adhabu", value: fmt(dash?.total_penalties), icon: <Coins size={18} />, g: "linear-gradient(135deg,#d946ef,#e879f9)" },
    { label: "Wateja Wadaiwa", value: dash?.delinquent_borrowers ?? 0, icon: <Users size={18} />, g: "linear-gradient(135deg,#8b5cf6,#a78bfa)" },
    { label: "Yanayodaiwa Leo", value: dash?.due_today ?? 0, icon: <CalendarClock size={18} />, g: "linear-gradient(135deg,#6366f1,#818cf8)" },
    { label: "Yanayodaiwa Wiki Hii", value: dash?.due_this_week ?? 0, icon: <CalendarDays size={18} />, g: "linear-gradient(135deg,#0ea5e9,#38bdf8)" },
    { label: "Hatari ya Mkopo (PAR)", value: `${dash?.par ?? 0}%`, icon: <ShieldAlert size={18} />, g: "linear-gradient(135deg,#dc2626,#ef4444)" },
    { label: "Kiwango cha Urejeshaji", value: `${dash?.recovery_rate ?? 0}%`, icon: <TrendingUp size={18} />, g: "linear-gradient(135deg,#10b981,#34d399)" },
    { label: "Ufanisi wa Ukusanyaji", value: `${dash?.collection_efficiency ?? 0}%`, icon: <Gauge size={18} />, g: "linear-gradient(135deg,#3b82f6,#60a5fa)" },
    { label: "Mikopo Iliyoshindwa", value: dash?.defaulted_loans ?? 0, icon: <Ban size={18} />, g: "linear-gradient(135deg,#991b1b,#dc2626)" },
    { label: "Inafuatiliwa", value: dash?.under_recovery ?? 0, icon: <ClipboardList size={18} />, g: "linear-gradient(135deg,#0d9488,#14b8a6)" },
  ];

  const agingData = dash?.aging ? [
    { name: "1-7", value: dash.aging["1-7"], color: "#fbbf24" },
    { name: "8-30", value: dash.aging["8-30"], color: "#f59e0b" },
    { name: "31-60", value: dash.aging["31-60"], color: "#ef4444" },
    { name: "61-90", value: dash.aging["61-90"], color: "#dc2626" },
    { name: "90+", value: dash.aging["90+"], color: "#991b1b" },
  ] : [];

  // Mgawanyo wa hatari (Risk distribution) kutoka kwenye mikopo
  const riskData = useMemo(() => {
    const counts: Record<string, number> = {};
    loans.forEach((l) => { counts[l.risk] = (counts[l.risk] || 0) + 1; });
    return Object.keys(RISK_META)
      .filter((k) => counts[k])
      .map((k) => ({ name: RISK_META[k].label, value: counts[k], color: RISK_META[k].color }));
  }, [loans]);

  // Mgawanyo wa hali (Status distribution) kutoka kwenye mikopo
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    loans.forEach((l) => { counts[l.status] = (counts[l.status] || 0) + 1; });
    return Object.keys(counts).map((k) => ({
      name: STATUS_META[k]?.label || k,
      value: counts[k],
      color: STATUS_META[k]?.color || "#94a3b8",
    }));
  }, [loans]);

  // Ufanisi wa ukusanyaji (Collection performance) kwa chati ya pau
  const performanceData = dash ? [
    { name: "Urejeshaji", value: dash.recovery_rate ?? 0, color: "#10b981" },
    { name: "Ufanisi", value: dash.collection_efficiency ?? 0, color: "#3b82f6" },
    { name: "PAR", value: dash.par ?? 0, color: "#ef4444" },
  ] : [];

  return (
    <div style={{ minHeight: "100vh", maxWidth: "100%", overflowX: "hidden", boxSizing: "border-box", background: "#fdfbf7", padding: "0.6rem 1rem 1rem", fontFamily: "'Plus Jakarta Sans','Inter',sans-serif", color: "#1e293b" }}>

      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: GAP }}>
        <AlertTriangle size={22} style={{ color: "#dc2626" }} />
        <h1 style={{ fontSize: "1.35rem", fontWeight: 800, margin: 0, color: "#0f172a" }}>Usimamizi wa Madeni Yaliyochelewa</h1>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={load}
          style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1rem", borderRadius: 10, background: "white", border: "1px solid #e2e8f0", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", color: "#475569" }}>
          <RefreshCw size={15} className={loading ? "ov-spin" : ""} /> Onyesha Upya
        </motion.button>
      </div>

      {/* DASHIBODI CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: GAP, marginBottom: GAP }}>
        {cards.map((c, i) => (
          <div key={i} style={{ ...CARD_STYLE, padding: "1rem", display: "flex", alignItems: "center", gap: "0.8rem" }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: c.g, display: "flex", alignItems: "center", justifyContent: "center", color: "white", flexShrink: 0, boxShadow: "0 4px 10px rgba(15,23,42,0.12)" }}>{c.icon}</div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: "#94a3b8", margin: "0 0 0.25rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.label}</p>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", margin: 0, whiteSpace: "nowrap" }}>{c.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* CHATI ZA UCHAMBUZI (Aging bar + Risk pie + Status pie) — flexible/wrapping */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: GAP, marginBottom: GAP }}>
        {/* Aging bar chart */}
        <div style={{ ...CARD_STYLE, padding: "1.25rem 1.5rem", minWidth: 0 }}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0f172a", margin: "0 0 0.75rem" }}>Uchambuzi wa Umri wa Madeni (Aging)</h2>
          <div style={{ height: 220, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <RechartsTooltip cursor={{ fill: "#f8fafc" }} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontWeight: 700, fontSize: "0.8rem" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {agingData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk distribution pie */}
        <div style={{ ...CARD_STYLE, padding: "1.25rem 1.5rem", minWidth: 0 }}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0f172a", margin: "0 0 0.5rem" }}>Mgawanyo wa Hatari</h2>
          <div style={{ height: 220, width: "100%" }}>
            {riskData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={riskData} cx="50%" cy="45%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {riskData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontWeight: 700, fontSize: "0.8rem" }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "0.68rem", fontWeight: 600, maxHeight: 56, overflowY: "auto" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </div>

        {/* Status distribution pie */}
        <div style={{ ...CARD_STYLE, padding: "1.25rem 1.5rem", minWidth: 0 }}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0f172a", margin: "0 0 0.5rem" }}>Mgawanyo wa Hali</h2>
          <div style={{ height: 220, width: "100%" }}>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="45%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {statusData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontWeight: 700, fontSize: "0.8rem" }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "0.68rem", fontWeight: 600, maxHeight: 56, overflowY: "auto" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </div>
      </div>

      {/* CHATI YA UFANISI WA UKUSANYAJI */}
      <div style={{ ...CARD_STYLE, padding: "1.25rem 1.5rem", marginBottom: GAP }}>
        <h2 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0f172a", margin: "0 0 0.75rem" }}>Ufanisi wa Ukusanyaji na Urejeshaji (%)</h2>
        <div style={{ height: Math.max(160, performanceData.length * 52), width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={performanceData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 600 }} width={90} />
              <RechartsTooltip cursor={{ fill: "#f8fafc" }} formatter={(v: any) => `${v}%`} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontWeight: 700, fontSize: "0.8rem" }} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={26}>
                {performanceData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* JEDWALI LA MIKOPO ILIYOCHELEWA */}
      <div style={{ ...CARD_STYLE, padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.7rem", marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px solid #f1f5f9" }}>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Ufuatiliaji wa Mikopo Iliyochelewa</h2>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tafuta mteja / namba..."
                style={{ padding: "0.45rem 0.8rem 0.45rem 2.1rem", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", outline: "none", fontWeight: 600, fontSize: "0.78rem", width: 200 }} />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: "0.45rem 0.7rem", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", fontWeight: 600, fontSize: "0.78rem", color: "#475569" }}>
              <option value="">Hali zote</option>
              {Object.entries(STATUS_META).filter(([k]) => k !== "defaulted").map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} style={{ padding: "0.45rem 0.7rem", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", fontWeight: 600, fontSize: "0.78rem", color: "#475569" }}>
              <option value="">Hatari zote</option>
              {Object.entries(RISK_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Namba ya Mkopo", "Mkopaji", "Bidhaa", "Tawi", "Afisa", "Salio", "Rejesho", "Tarehe", "Siku", "Adhabu", "Jumla", "Hatari", "Hali", "Hatua"].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 13 ? "right" : "left", padding: "0 0.6rem 0.8rem", fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#94a3b8", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loans.map((l) => {
                const sm = STATUS_META[l.status] || STATUS_META["1-7"];
                const rm = RISK_META[l.risk] || RISK_META.low;
                return (
                  <tr key={l.loan_id} className="ov-row">
                    <td style={{ padding: "0.8rem 0.6rem", fontSize: "0.7rem", fontWeight: 700, color: "#64748b", whiteSpace: "nowrap" }}>{l.loan_number}</td>
                    <td style={{ padding: "0.8rem 0.6rem" }}>
                      <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.82rem" }}>{l.borrower}</div>
                      <div style={{ fontSize: "0.62rem", color: "#94a3b8", fontWeight: 600 }}>{l.customer_id}</div>
                    </td>
                    <td style={{ padding: "0.8rem 0.6rem", fontSize: "0.78rem", color: "#64748b", whiteSpace: "nowrap" }}>{l.product}</td>
                    <td style={{ padding: "0.8rem 0.6rem", fontSize: "0.78rem", color: "#64748b", whiteSpace: "nowrap" }}>{l.branch}</td>
                    <td style={{ padding: "0.8rem 0.6rem", fontSize: "0.78rem", color: "#64748b", whiteSpace: "nowrap" }}>{l.loan_officer}</td>
                    <td style={{ padding: "0.8rem 0.6rem", fontWeight: 700, color: "#0f172a", fontSize: "0.8rem", whiteSpace: "nowrap" }}>{fmt(l.outstanding_balance)}</td>
                    <td style={{ padding: "0.8rem 0.6rem", fontSize: "0.8rem", color: "#475569", whiteSpace: "nowrap" }}>{fmt(l.installment_amount)}</td>
                    <td style={{ padding: "0.8rem 0.6rem", fontSize: "0.76rem", color: "#64748b", whiteSpace: "nowrap" }}>{fmtDate(l.due_date)}</td>
                    <td style={{ padding: "0.8rem 0.6rem" }}><span style={{ background: "#fef2f2", color: "#dc2626", padding: "2px 8px", borderRadius: 20, fontSize: "0.7rem", fontWeight: 800 }}>{l.days_past_due}</span></td>
                    <td style={{ padding: "0.8rem 0.6rem", fontWeight: 700, color: "#ef4444", fontSize: "0.8rem", whiteSpace: "nowrap" }}>{fmt(l.penalty_amount)}</td>
                    <td style={{ padding: "0.8rem 0.6rem", fontWeight: 800, color: "#0f172a", fontSize: "0.8rem", whiteSpace: "nowrap" }}>{fmt(l.total_due)}</td>
                    <td style={{ padding: "0.8rem 0.6rem" }}><span style={{ background: rm.bg, color: rm.color, padding: "2px 9px", borderRadius: 20, fontSize: "0.66rem", fontWeight: 800, whiteSpace: "nowrap" }}>{rm.label}</span></td>
                    <td style={{ padding: "0.8rem 0.6rem" }}><span style={{ background: sm.bg, color: sm.color, padding: "2px 9px", borderRadius: 20, fontSize: "0.66rem", fontWeight: 800, whiteSpace: "nowrap" }}>{sm.label}</span></td>
                    <td style={{ padding: "0.8rem 0.6rem", textAlign: "right" }}>
                      <button onClick={() => openModal(l)} title="Rekodi hatua"
                        style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.4rem 0.8rem", borderRadius: 8, background: "#6366f1", border: "none", color: "white", fontWeight: 700, fontSize: "0.66rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                        <Phone size={12} /> Fuatilia {l.activities_count > 0 && <span style={{ background: "rgba(255,255,255,0.25)", padding: "0 6px", borderRadius: 10 }}>{l.activities_count}</span>}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {loans.length === 0 && !loading && (
                <tr><td colSpan={14} style={{ textAlign: "center", padding: "3rem", color: "#94a3b8", fontWeight: 600 }}>Hakuna mikopo iliyochelewa 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: REKODI HATUA YA UKUSANYAJI */}
      <AnimatePresence>
        {modalLoan && (
          <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", backdropFilter: "blur(10px)", background: "rgba(0,0,0,0.6)" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ width: "100%", maxWidth: 620, maxHeight: "88vh", borderRadius: 20, background: "white", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 25px 60px rgba(0,0,0,0.4)" }}>
              <div style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)", padding: "1.2rem 1.5rem", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 900, margin: 0 }}>Fuatilia Deni</h2>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", opacity: 0.9, fontWeight: 600 }}>{modalLoan.borrower} • {modalLoan.loan_number} • Siku {modalLoan.days_past_due}</p>
                </div>
                <button onClick={() => setModalLoan(null)} style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.2)", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} /></button>
              </div>
              <div style={{ padding: "1.3rem 1.5rem", overflowY: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.9rem" }}>
                  <Field label="Hatua (Stage)"><select value={stage} onChange={(e) => setStage(e.target.value)} style={inp}>{STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></Field>
                  <Field label="Njia ya Mawasiliano"><select value={method} onChange={(e) => setMethod(e.target.value)} style={inp}>{METHODS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></Field>
                  <Field label="Kiasi cha Ahadi (TZS)"><input type="number" value={promisedAmount} onChange={(e) => setPromisedAmount(e.target.value)} placeholder="0" style={inp} /></Field>
                  <Field label="Tarehe ya Ahadi"><input type="date" value={promisedDate} onChange={(e) => setPromisedDate(e.target.value)} style={inp} /></Field>
                  <Field label="Hatua Inayofuata (Tarehe)"><input type="date" value={nextAction} onChange={(e) => setNextAction(e.target.value)} style={inp} /></Field>
                  <Field label="Hali ya Urejeshaji"><select value={recoveryStatus} onChange={(e) => setRecoveryStatus(e.target.value)} style={inp}>{RECOVERY_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></Field>
                  <div style={{ gridColumn: "1 / -1" }}><Field label="Maelezo / Mazungumzo"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...inp, resize: "vertical" }} /></Field></div>
                </div>

                <div style={{ display: "flex", gap: "0.7rem", marginTop: "1.2rem" }}>
                  <button onClick={() => setModalLoan(null)} style={{ flex: 1, padding: "0.8rem", borderRadius: 12, background: "#f1f5f9", border: "none", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer", color: "#64748b" }}>Ghairi</button>
                  <button onClick={saveActivity} disabled={saving} style={{ flex: 2, padding: "0.8rem", borderRadius: 12, background: "#6366f1", border: "none", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer", color: "white" }}>{saving ? "Inahifadhi..." : "Hifadhi Hatua"}</button>
                </div>

                {/* HISTORIA */}
                <div style={{ marginTop: "1.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.6rem", color: "#475569", fontWeight: 800, fontSize: "0.8rem" }}>
                    <History size={15} /> Historia ya Ufuatiliaji ({activities.length})
                  </div>
                  {activities.length === 0 ? (
                    <p style={{ fontSize: "0.78rem", color: "#94a3b8", fontWeight: 600 }}>Bado hakuna hatua zilizorekodiwa.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {activities.map((a) => (
                        <div key={a.id} style={{ background: "#f8fafc", borderRadius: 10, padding: "0.7rem 0.9rem", border: "1px solid #eef1f6" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", fontWeight: 700, color: "#475569" }}>
                            <span>{(STAGES.find((s) => s.value === a.stage)?.label) || a.stage} • {(METHODS.find((m) => m.value === a.contact_method)?.label) || a.contact_method || "—"}</span>
                            <span style={{ color: "#94a3b8" }}>{fmtDate(a.created_at)}</span>
                          </div>
                          {a.notes && <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", color: "#334155" }}>{a.notes}</p>}
                          {a.promised_amount && <p style={{ margin: "0.35rem 0 0", fontSize: "0.72rem", color: "#059669", fontWeight: 700 }}>Ahadi: {fmt(a.promised_amount)} • {fmtDate(a.promised_date)}</p>}
                          <div style={{ marginTop: "0.35rem", fontSize: "0.65rem", color: "#94a3b8", fontWeight: 700 }}>Afisa: {a.officer_name || "—"}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .ov-spin { animation: ov-spin 1s linear infinite; }
        @keyframes ov-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        .ov-row { border-bottom: 1px solid #f1f5f9; transition: background 0.15s; }
        .ov-row:hover { background: #fdfbf7; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 6px; }
      `}</style>
    </div>
  );
};

const inp: React.CSSProperties = { width: "100%", padding: "0.6rem 0.7rem", borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", outline: "none", fontWeight: 600, fontSize: "0.8rem", color: "#1e293b", boxSizing: "border-box", fontFamily: "inherit" };

const EmptyChart = () => (
  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontWeight: 600, fontSize: "0.78rem" }}>
    Hakuna data ya kuonyesha
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#94a3b8", display: "block", marginBottom: "0.35rem" }}>{label}</label>
    {children}
  </div>
);

export default OverdueManagement;
