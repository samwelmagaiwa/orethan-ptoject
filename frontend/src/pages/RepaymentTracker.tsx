import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import {
  RefreshCw, TrendingUp, DollarSign, PieChart as PieIcon,
  Users, CheckCircle2, AlertCircle, Wallet, AlertTriangle,
  Search, Filter, ArrowUpRight, Clock, Activity,
  Calendar, Send, Eye, Phone, X, Printer, Download, Receipt as ReceiptIcon
} from "lucide-react";
import { printReceipt, type ReceiptData } from "../utils/receipt";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

interface Loan {
  id: number;
  name: string;
  amount: number;
  total_paid: number;
  remaining_balance: number;
  payment_status: string;
  status: string;
  completed_at?: string;
}

interface TrendPoint { name: string; disbursed: number; repaid: number; outstanding: number; }
interface TodayCollection { loan_id: number; schedule_id: number; customer: string; loan_number: string; due_amount: number; due_date: string; status: string; }
interface OverdueRow { loan_id: number; schedule_id: number; customer: string; loan_number: string; days_late: number; amount: number; penalty: number; due_date: string; }
interface ScheduleRow { installment_number: number; due_date: string; principal_amount: number; interest_amount: number; total_amount: number; amount_paid: number; status: string; }
interface Summary {
  total_expected: number;
  total_collected: number;
  outstanding_balance: number;
  overdue_amount: number;
  collection_rate: number;
  active_loans: number;
  defaulted_loans: number;
  total_disbursed: number;
  total_repaid: number;
  outstanding: number;
  repayment_rate: number;
  completed_loans: number;
  monthly_trend: TrendPoint[];
  portfolio_health: { current: number; at_risk: number; critical: number };
  today_collections: TodayCollection[];
  overdue_list: OverdueRow[];
}

const fmt = (val: any) => `TZS ${Math.round(Number(val) || 0).toLocaleString()}`;

const rcptBtn = (bg: string): React.CSSProperties => ({
  display: "flex", alignItems: "center", justifyContent: "center", gap: "0.45rem",
  padding: "0.75rem", borderRadius: 12, background: bg, border: "none", color: "white",
  fontWeight: 700, fontSize: "0.8rem", cursor: "pointer",
});

const SECTION_GAP = "0.75rem";
const CARD_SHADOW = "0 6px 18px rgba(15,23,42,0.07)";
const CARD_STYLE: React.CSSProperties = {
  background: "white",
  borderRadius: "14px",
  border: "1px solid #eef1f6",
  boxShadow: CARD_SHADOW,
};

const RepaymentTracker = () => {
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [completedLoans, setCompletedLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const [repaymentAmount, setRepaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [transactionId, setTransactionId] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  // Repayment schedule modal
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleData, setScheduleData] = useState<{ customer: string; loan_number: string; schedule: ScheduleRow[] } | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [loansRes, summaryRes] = await Promise.all([
        axios.get(`${API_BASE}/loans/active`, { headers }),
        axios.get(`${API_BASE}/repayments/summary`, { headers }),
      ]);

      const active: Loan[] = [];
      const completed: Loan[] = [];
      (loansRes.data || []).forEach((loan: any) => {
        const normalized: Loan = {
          ...loan,
          amount: Math.round(loan.amount),
          total_paid: Math.round(loan.total_paid || 0),
          remaining_balance: Math.round(loan.remaining_balance),
        };
        if (normalized.remaining_balance <= 0) {
          completed.push({ ...normalized, remaining_balance: 0, total_paid: normalized.amount, payment_status: "completed" });
        } else {
          active.push(normalized);
        }
      });

      setActiveLoans(active);
      setCompletedLoans(completed);
      setSummary(summaryRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const submitRepayment = async () => {
    const amount = Math.round(parseFloat(repaymentAmount));
    if (isNaN(amount) || amount <= 0 || !selectedLoan) return;
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(`${API_BASE}/loans/${selectedLoan.id}/repay`, {
        amount, payment_date: paymentDate, payment_method: paymentMethod, transaction_id: transactionId, received_by: receivedBy, notes,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setShowRepaymentModal(false);
      setRepaymentAmount(""); setTransactionId(""); setReceivedBy(""); setNotes("");
      const rcpt = res.data?.data?.receipt;
      if (rcpt) setReceipt(rcpt);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  // Open the collection form, optionally prefilled with a due amount.
  const openCollect = (loanId: number, customer: string, balance: number, prefillAmount?: number) => {
    setSelectedLoan({ id: loanId, name: customer, amount: 0, total_paid: 0, remaining_balance: balance, payment_status: "pending", status: "disbursed" });
    setRepaymentAmount(prefillAmount ? String(prefillAmount) : "");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setShowRepaymentModal(true);
  };

  // Load and show a loan's repayment schedule.
  const viewSchedule = async (loanId: number) => {
    setScheduleLoading(true);
    setShowSchedule(true);
    setScheduleData(null);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE}/loans/${loanId}/schedule`, { headers: { Authorization: `Bearer ${token}` } });
      setScheduleData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setScheduleLoading(false);
    }
  };

  const sendReminder = (customer: string) => {
    alert(`Reminder queued for ${customer}.`);
  };

  const collectionRate = summary?.collection_rate || 0;

  const statCards = [
    { label: "TOTAL EXPECTED", value: fmt(summary?.total_expected), icon: <DollarSign size={20} />, gradient: "linear-gradient(135deg, #6366f1, #818cf8)" },
    { label: "TOTAL COLLECTED", value: fmt(summary?.total_collected), icon: <TrendingUp size={20} />, gradient: "linear-gradient(135deg, #10b981, #34d399)" },
    { label: "OUTSTANDING BALANCE", value: fmt(summary?.outstanding_balance), icon: <Wallet size={20} />, gradient: "linear-gradient(135deg, #f59e0b, #fbbf24)" },
    { label: "OVERDUE AMOUNT", value: fmt(summary?.overdue_amount), icon: <AlertTriangle size={20} />, gradient: "linear-gradient(135deg, #ef4444, #f87171)" },
    { label: "COLLECTION RATE", value: `${collectionRate}%`, icon: <PieIcon size={20} />, gradient: "linear-gradient(135deg, #3b82f6, #60a5fa)" },
    { label: "ACTIVE LOANS", value: summary?.active_loans ?? activeLoans.length, icon: <Users size={20} />, gradient: "linear-gradient(135deg, #8b5cf6, #a78bfa)" },
    { label: "DEFAULTED LOANS", value: summary?.defaulted_loans ?? 0, icon: <AlertCircle size={20} />, gradient: "linear-gradient(135deg, #f43f5e, #fb7185)" },
  ];

  const todayCollections = summary?.today_collections || [];
  const overdueList = summary?.overdue_list || [];

  const overviewData = useMemo(() => (summary?.monthly_trend || []).map((m) => ({
    name: m.name,
    Disbursed: m.disbursed,
    Repaid: m.repaid,
    Outstanding: m.outstanding,
    Rate: m.disbursed > 0 ? Math.round((m.repaid / m.disbursed) * 100) : 0,
  })), [summary]);

  const health = summary?.portfolio_health || { current: 0, at_risk: 0, critical: 0 };
  const healthData = [
    { name: "Current", value: health.current, color: "#10b981" },
    { name: "At Risk", value: health.at_risk, color: "#f59e0b" },
    { name: "Critical", value: health.critical, color: "#ef4444" },
  ];
  const hasHealth = health.current + health.at_risk + health.critical > 0;

  const currentLoans = (activeTab === "active" ? activeLoans : completedLoans)
    .filter((l) => l.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ minHeight: "100vh", maxWidth: "100%", overflowX: "hidden", boxSizing: "border-box", background: "#fdfbf7", padding: "0.6rem 1rem 1rem", fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif", color: "#1e293b" }}>

      {/* ─── STAT CARDS — SEPARATE BORDERED CARDS WITH SPACING (WRAPPING) ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: SECTION_GAP, marginBottom: SECTION_GAP }}>
        {statCards.map((card, i) => (
          <div key={i} className="rt-stat-card"
            style={{ ...CARD_STYLE, padding: "1.15rem 1.2rem", display: "flex", alignItems: "center", gap: "0.85rem", transition: "all 0.2s" }}>
            <div style={{ width: 44, height: 44, borderRadius: "12px", background: card.gradient, display: "flex", alignItems: "center", justifyContent: "center", color: "white", flexShrink: 0, boxShadow: "0 4px 10px rgba(15,23,42,0.12)" }}>
              <span style={{ transform: "scale(0.85)" }}>{card.icon}</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: "#94a3b8", margin: "0 0 0.3rem", lineHeight: 1.25, wordBreak: "break-word" }}>{card.label}</p>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f172a", margin: 0, whiteSpace: "nowrap" }}>{card.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* ─── CHARTS ROW ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: SECTION_GAP, marginBottom: SECTION_GAP }}>
        {/* Overview Area Chart */}
        <div style={{ ...CARD_STYLE, padding: "1.5rem", minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Activity size={18} style={{ color: "#6366f1" }} />
              <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Overview</h2>
            </div>
            <select style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.4rem 0.8rem", color: "#64748b", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", outline: "none" }}>
              <option>Last 6 months</option>
            </select>
          </div>
          <div style={{ height: 280, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overviewData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gDisbursed" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gRepaid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gOutstanding" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} /><stop offset="100%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 600 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <RechartsTooltip contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, color: "#1e293b", fontWeight: 700, fontSize: "0.8rem" }} formatter={(v: any) => fmt(v)} />
                <Area type="monotone" dataKey="Disbursed" stroke="#6366f1" strokeWidth={2.5} fill="url(#gDisbursed)" dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }} />
                <Area type="monotone" dataKey="Repaid" stroke="#10b981" strokeWidth={2.5} fill="url(#gRepaid)" dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }} />
                <Area type="monotone" dataKey="Outstanding" stroke="#f59e0b" strokeWidth={2.5} fill="url(#gOutstanding)" dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", gap: "1.5rem", justifyContent: "center", marginTop: "0.75rem" }}>
            {[{ l: "Disbursed", c: "#6366f1" }, { l: "Repaid", c: "#10b981" }, { l: "Outstanding", c: "#f59e0b" }].map((item) => (
              <div key={item.l} style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.7rem", fontWeight: 600, color: "#94a3b8" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.c, display: "inline-block" }}></span> {item.l}
              </div>
            ))}
          </div>
        </div>

        {/* Portfolio Health Donut */}
        <div style={{ ...CARD_STYLE, padding: "1.5rem", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <PieIcon size={18} style={{ color: "#10b981" }} />
            <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Portfolio Health</h2>
          </div>
          {hasHealth ? (
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "1rem" }}>
              <div style={{ width: "55%", position: "relative" }}>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={healthData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}>
                      {healthData.map((entry, index) => (<Cell key={index} fill={entry.color} stroke="none" />))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                  <span style={{ fontSize: "2rem", fontWeight: 900, color: "#0f172a" }}>{health.current}%</span>
                  <br />
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#10b981" }}>Healthy</span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                {healthData.map((item) => (
                  <div key={item.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0", borderBottom: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: item.color, display: "inline-block" }}></span>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b" }}>{item.name}</span>
                    </div>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#1e293b" }}>{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontWeight: 600, fontSize: "0.85rem" }}>
              No active portfolio data yet
            </div>
          )}
        </div>
      </div>

      {/* ─── TODAY'S COLLECTION + OVERDUE MANAGEMENT ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SECTION_GAP, marginBottom: SECTION_GAP }}>
        {/* Today's Collection */}
        <div style={{ ...CARD_STYLE, padding: "1.5rem", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <Calendar size={18} style={{ color: "#6366f1" }} />
            <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Today's Collection</h2>
            <span style={{ marginLeft: "auto", background: "#eef2ff", color: "#6366f1", padding: "2px 10px", borderRadius: 20, fontSize: "0.7rem", fontWeight: 800 }}>{todayCollections.length} due</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Customer", "Loan No", "Due Amount", "Due Date", "Action"].map((h, i) => (
                    <th key={h} style={{ textAlign: i >= 2 && i <= 3 ? "left" : i === 4 ? "right" : "left", padding: "0 0.6rem 0.7rem", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#94a3b8", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {todayCollections.map((row) => (
                  <tr key={row.schedule_id} className="rt-table-row">
                    <td style={{ padding: "0.8rem 0.6rem", fontWeight: 700, color: "#1e293b", fontSize: "0.82rem" }}>{row.customer}</td>
                    <td style={{ padding: "0.8rem 0.6rem", fontSize: "0.72rem", fontWeight: 700, color: "#64748b", whiteSpace: "nowrap" }}>{row.loan_number}</td>
                    <td style={{ padding: "0.8rem 0.6rem", fontWeight: 800, color: "#0f172a", fontSize: "0.82rem" }}>{fmt(row.due_amount)}</td>
                    <td style={{ padding: "0.8rem 0.6rem", fontSize: "0.78rem", color: "#64748b" }}>{new Date(row.due_date).toLocaleDateString("en-GB")}</td>
                    <td style={{ padding: "0.8rem 0.6rem" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.35rem" }}>
                        <button onClick={() => openCollect(row.loan_id, row.customer, row.due_amount, row.due_amount)} title="Collect Payment"
                          style={{ padding: "0.35rem 0.7rem", borderRadius: 8, background: "#6366f1", border: "none", color: "white", fontWeight: 700, fontSize: "0.62rem", cursor: "pointer" }}>Collect</button>
                        <button onClick={() => sendReminder(row.customer)} title="Send Reminder"
                          style={{ padding: "0.35rem", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center" }}><Send size={13} /></button>
                        <button onClick={() => viewSchedule(row.loan_id)} title="View Loan"
                          style={{ padding: "0.35rem", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center" }}><Eye size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {todayCollections.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8", fontWeight: 600, fontSize: "0.82rem" }}>No payments due today</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Overdue Management */}
        <div style={{ ...CARD_STYLE, padding: "1.5rem", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <AlertTriangle size={18} style={{ color: "#ef4444" }} />
            <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Overdue Management</h2>
            <span style={{ marginLeft: "auto", background: "#fef2f2", color: "#ef4444", padding: "2px 10px", borderRadius: 20, fontSize: "0.7rem", fontWeight: 800 }}>{overdueList.length} late</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Customer", "Days Late", "Amount", "Penalty", "Action"].map((h, i) => (
                    <th key={h} style={{ textAlign: i === 4 ? "right" : "left", padding: "0 0.6rem 0.7rem", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#94a3b8", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overdueList.map((row) => (
                  <tr key={row.schedule_id} className="rt-table-row">
                    <td style={{ padding: "0.8rem 0.6rem", fontWeight: 700, color: "#1e293b", fontSize: "0.82rem" }}>{row.customer}</td>
                    <td style={{ padding: "0.8rem 0.6rem" }}>
                      <span style={{ background: "#fef2f2", color: "#dc2626", padding: "2px 9px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 800 }}>{row.days_late}d</span>
                    </td>
                    <td style={{ padding: "0.8rem 0.6rem", fontWeight: 800, color: "#0f172a", fontSize: "0.82rem" }}>{fmt(row.amount)}</td>
                    <td style={{ padding: "0.8rem 0.6rem", fontWeight: 700, color: "#ef4444", fontSize: "0.82rem" }}>{fmt(row.penalty)}</td>
                    <td style={{ padding: "0.8rem 0.6rem" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.35rem" }}>
                        <button onClick={() => sendReminder(row.customer)} title="Contact"
                          style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.35rem 0.7rem", borderRadius: 8, background: "#fee2e2", border: "1px solid #fecaca", color: "#dc2626", fontWeight: 700, fontSize: "0.62rem", cursor: "pointer" }}><Phone size={12} /> Contact</button>
                        <button onClick={() => openCollect(row.loan_id, row.customer, row.amount + row.penalty, row.amount + row.penalty)} title="Collect with penalty"
                          style={{ padding: "0.35rem 0.7rem", borderRadius: 8, background: "#6366f1", border: "none", color: "white", fontWeight: 700, fontSize: "0.62rem", cursor: "pointer" }}>Collect</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {overdueList.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8", fontWeight: 600, fontSize: "0.82rem" }}>No overdue payments 🎉</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── TABLE SECTION ─── */}
      <div style={{ ...CARD_STYLE, padding: "1.5rem" }}>
        {/* TABLE TOOLBAR (NARROW) */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.7rem", marginBottom: "1.1rem", paddingBottom: "1rem", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", background: "#f1f5f9", padding: 3, borderRadius: 9, gap: 3 }}>
            {([["active", "Active Loans", activeLoans.length, Clock, "#4f46e5"], ["completed", "Completed", completedLoans.length, CheckCircle2, "#059669"]] as const).map(([key, label, count, Icon, color]) => {
              const isActive = activeTab === key;
              return (
                <button key={key} onClick={() => setActiveTab(key)}
                  style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.4rem 0.85rem", borderRadius: 7, border: "none", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", background: isActive ? "white" : "transparent", color: isActive ? color : "#64748b", boxShadow: isActive ? "0 1px 4px rgba(15,23,42,0.1)" : "none", transition: "all 0.2s" }}>
                  <Icon size={14} /> {label}
                  <span style={{ background: isActive ? `${color}1a` : "#e2e8f0", color: isActive ? color : "#94a3b8", padding: "0px 7px", borderRadius: 20, fontSize: "0.62rem", fontWeight: 800 }}>{count}</span>
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search client..."
                style={{ padding: "0.45rem 0.8rem 0.45rem 2.1rem", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", outline: "none", fontWeight: 600, fontSize: "0.78rem", color: "#1e293b", width: 200 }} />
            </div>
            <button style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.45rem 0.85rem", borderRadius: 8, background: "white", border: "1px solid #e2e8f0", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", color: "#64748b" }}>
              <Filter size={14} /> Filter
            </button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={loadData}
              style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.45rem 0.85rem", borderRadius: 8, background: "white", border: "1px solid #e2e8f0", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", color: "#475569" }}>
              <RefreshCw size={14} className={loading ? "rt-spin" : ""} /> Refresh
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.45rem 0.95rem", borderRadius: 8, background: "#6366f1", border: "none", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", color: "white", boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}>
              <ArrowUpRight size={14} /> Export
            </motion.button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["#", "Client Identity", "Principal", "Amortized", "Balance", "Efficiency", "Status", "Management"].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 7 ? "right" : "left", padding: "0 0.8rem 1rem", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#94a3b8", borderBottom: "1px solid #f1f5f9" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {currentLoans.map((loan, idx) => {
                  const progress = loan.amount > 0 ? (loan.total_paid / loan.amount) * 100 : 0;
                  return (
                    <motion.tr key={loan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: idx * 0.04 }} className="rt-table-row">
                      <td style={{ padding: "1rem 0.8rem", fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>{(idx + 1).toString().padStart(2, "0")}</td>
                      <td style={{ padding: "1rem 0.8rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
                          <div className="rt-avatar" style={{ width: 36, height: 36, borderRadius: 8, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.85rem", color: "#64748b", border: "1px solid #e2e8f0" }}>
                            {loan.name.charAt(0)}
                          </div>
                          <div>
                            <p style={{ fontWeight: 700, color: "#1e293b", margin: 0, fontSize: "0.85rem" }}>{loan.name}</p>
                            <p style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", color: "#94a3b8", margin: 0 }}>LN-{loan.id}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "1rem 0.8rem", fontWeight: 700, color: "#1e293b", fontSize: "0.85rem" }}>{fmt(loan.amount)}</td>
                      <td style={{ padding: "1rem 0.8rem", fontWeight: 700, color: "#10b981", fontSize: "0.85rem" }}>+{fmt(loan.total_paid)}</td>
                      <td style={{ padding: "1rem 0.8rem", fontWeight: 800, color: "#0f172a", fontSize: "0.85rem" }}>{fmt(loan.remaining_balance)}</td>
                      <td style={{ padding: "1rem 0.8rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <div style={{ width: 80, height: 5, borderRadius: 3, background: "#e2e8f0", overflow: "hidden" }}>
                            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(progress, 100)}%` }} transition={{ duration: 0.8 }}
                              style={{ height: "100%", borderRadius: 3, background: progress >= 90 ? "#10b981" : progress >= 40 ? "#6366f1" : "#f59e0b" }} />
                          </div>
                          <span style={{ fontSize: "0.7rem", fontWeight: 900, color: "#64748b" }}>{Math.round(progress)}%</span>
                        </div>
                      </td>
                      <td style={{ padding: "1rem 0.8rem" }}>
                        <span style={{
                          display: "inline-block", padding: "0.25rem 0.7rem", borderRadius: 16, fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.8px",
                          background: loan.payment_status === "completed" ? "rgba(16,185,129,0.12)" : loan.payment_status === "overdue" ? "rgba(239,68,68,0.12)" : "rgba(99,102,241,0.12)",
                          color: loan.payment_status === "completed" ? "#059669" : loan.payment_status === "overdue" ? "#dc2626" : "#4f46e5"
                        }}>
                          {loan.payment_status || "current"}
                        </span>
                      </td>
                      <td style={{ padding: "1rem 0.8rem", textAlign: "right" }}>
                        <div className="rt-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "0.4rem" }}>
                          {activeTab === "active" && (
                            <button onClick={() => { setSelectedLoan(loan); setShowRepaymentModal(true); }}
                              style={{ padding: "0.4rem 0.9rem", borderRadius: 10, background: "#6366f1", border: "none", color: "white", fontWeight: 700, fontSize: "0.65rem", cursor: "pointer", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }} className="rt-btn-pay">
                              Add Payment
                            </button>
                          )}
                          <button onClick={() => viewSchedule(loan.id)} title="View schedule" style={{ padding: "0.4rem", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                            <Eye size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
              {currentLoans.length === 0 && !loading && (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: "3rem", color: "#475569", fontWeight: 600 }}>No loans found in this category</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── REPAYMENT MODAL ─── */}
      <AnimatePresence>
        {showRepaymentModal && (
          <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", backdropFilter: "blur(10px)", background: "rgba(0,0,0,0.6)" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ width: "100%", maxWidth: 500, borderRadius: 24, background: "#111827", boxShadow: "0 25px 60px rgba(0,0,0,0.5)", border: "1px solid #1e293b", overflow: "hidden" }}>
              <div style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", padding: "1.5rem", color: "white" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 900, margin: 0 }}>Post Repayment</h2>
                  <button onClick={() => setShowRepaymentModal(false)} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.2)", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>✕</button>
                </div>
                <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 16, padding: "1rem", display: "flex", alignItems: "center", gap: "0.8rem" }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "1.1rem" }}>{selectedLoan?.name.charAt(0)}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "0.65rem", fontWeight: 700, opacity: 0.65, margin: 0, textTransform: "uppercase" }}>Borrower</p>
                    <p style={{ fontWeight: 900, margin: 0 }}>{selectedLoan?.name}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: "0.65rem", fontWeight: 700, opacity: 0.65, margin: 0, textTransform: "uppercase" }}>Balance</p>
                    <p style={{ fontWeight: 900, margin: 0 }}>{fmt(selectedLoan?.remaining_balance)}</p>
                  </div>
                </div>
              </div>
              <div style={{ padding: "1.5rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#64748b", display: "block", marginBottom: "0.4rem" }}>Amount</label>
                    <input type="number" value={repaymentAmount} onChange={(e) => setRepaymentAmount(e.target.value)} placeholder="0.00"
                      style={{ width: "100%", padding: "0.8rem", borderRadius: 12, background: "#0b1120", border: "1px solid #1e293b", outline: "none", fontWeight: 800, fontSize: "0.9rem", color: "#e2e8f0", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#64748b", display: "block", marginBottom: "0.4rem" }}>Date</label>
                    <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
                      style={{ width: "100%", padding: "0.8rem", borderRadius: 12, background: "#0b1120", border: "1px solid #1e293b", outline: "none", fontWeight: 700, fontSize: "0.85rem", color: "#e2e8f0", boxSizing: "border-box" }} />
                  </div>
                </div>
                <label style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#64748b", display: "block", margin: "1rem 0 0.4rem" }}>Payment Method</label>
                <div style={{ display: "flex", gap: "0.6rem" }}>
                  {[["cash", "Cash"], ["bank_transfer", "Bank"], ["mobile_money", "Mobile Money"]].map(([val, lbl]) => (
                    <button key={val} onClick={() => setPaymentMethod(val)}
                      style={{ flex: 1, padding: "0.75rem", borderRadius: 12, border: paymentMethod === val ? "2px solid #6366f1" : "1px solid #1e293b", background: paymentMethod === val ? "rgba(99,102,241,0.1)" : "#0b1120", fontWeight: 700, cursor: "pointer", color: paymentMethod === val ? "#a5b4fc" : "#64748b", fontSize: "0.78rem", transition: "all 0.2s" }}>
                      {lbl}
                    </button>
                  ))}
                </div>
                <input type="text" placeholder="Transaction Reference" value={transactionId} onChange={(e) => setTransactionId(e.target.value)}
                  style={{ width: "100%", padding: "0.8rem", borderRadius: 12, background: "#0b1120", border: "1px solid #1e293b", outline: "none", fontWeight: 700, fontSize: "0.8rem", color: "#e2e8f0", marginTop: "0.8rem", boxSizing: "border-box" }} />
                <input type="text" placeholder="Received By" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)}
                  style={{ width: "100%", padding: "0.8rem", borderRadius: 12, background: "#0b1120", border: "1px solid #1e293b", outline: "none", fontWeight: 700, fontSize: "0.8rem", color: "#e2e8f0", marginTop: "0.8rem", boxSizing: "border-box" }} />
                <input type="text" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)}
                  style={{ width: "100%", padding: "0.8rem", borderRadius: 12, background: "#0b1120", border: "1px solid #1e293b", outline: "none", fontWeight: 700, fontSize: "0.8rem", color: "#e2e8f0", marginTop: "0.8rem", boxSizing: "border-box" }} />
                <div style={{ display: "flex", gap: "0.8rem", marginTop: "1.5rem" }}>
                  <button onClick={() => setShowRepaymentModal(false)} style={{ flex: 1, padding: "0.85rem", borderRadius: 14, background: "#1e293b", border: "none", fontWeight: 800, fontSize: "0.85rem", cursor: "pointer", color: "#94a3b8" }}>Discard</button>
                  <button onClick={submitRepayment} style={{ flex: 2, padding: "0.85rem", borderRadius: 14, background: "#6366f1", border: "none", fontWeight: 800, fontSize: "0.85rem", cursor: "pointer", color: "white", boxShadow: "0 6px 20px rgba(99,102,241,0.35)" }}>Confirm Payment</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── REPAYMENT SCHEDULE MODAL ─── */}
      <AnimatePresence>
        {showSchedule && (
          <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", backdropFilter: "blur(10px)", background: "rgba(0,0,0,0.6)" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ width: "100%", maxWidth: 760, maxHeight: "85vh", borderRadius: 20, background: "white", boxShadow: "0 25px 60px rgba(0,0,0,0.4)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", padding: "1.3rem 1.5rem", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ fontSize: "1.2rem", fontWeight: 900, margin: 0 }}>Repayment Schedule</h2>
                  {scheduleData && <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", opacity: 0.85, fontWeight: 600 }}>{scheduleData.customer} • {scheduleData.loan_number}</p>}
                </div>
                <button onClick={() => setShowSchedule(false)} style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.2)", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} /></button>
              </div>
              <div style={{ padding: "1.2rem 1.5rem", overflowY: "auto" }}>
                {scheduleLoading ? (
                  <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8", fontWeight: 600 }}>Loading schedule...</div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Installment", "Due Date", "Principal", "Interest", "Total", "Status"].map((h, i) => (
                          <th key={h} style={{ textAlign: i >= 2 && i <= 4 ? "right" : "left", padding: "0 0.7rem 0.8rem", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#94a3b8", borderBottom: "1px solid #f1f5f9" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(scheduleData?.schedule || []).map((s) => {
                        const cfg = s.status === "paid"
                          ? { bg: "#ecfdf5", color: "#059669", label: "🟢 Paid" }
                          : s.status === "overdue"
                            ? { bg: "#fef2f2", color: "#dc2626", label: "🔴 Overdue" }
                            : { bg: "#fffbeb", color: "#d97706", label: "🟡 Pending" };
                        return (
                          <tr key={s.installment_number} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "0.8rem 0.7rem", fontWeight: 800, color: "#334155", fontSize: "0.82rem" }}>#{s.installment_number}</td>
                            <td style={{ padding: "0.8rem 0.7rem", fontSize: "0.8rem", color: "#64748b" }}>{new Date(s.due_date).toLocaleDateString("en-GB")}</td>
                            <td style={{ padding: "0.8rem 0.7rem", textAlign: "right", fontWeight: 700, color: "#1e293b", fontSize: "0.82rem" }}>{fmt(s.principal_amount)}</td>
                            <td style={{ padding: "0.8rem 0.7rem", textAlign: "right", fontWeight: 700, color: "#64748b", fontSize: "0.82rem" }}>{fmt(s.interest_amount)}</td>
                            <td style={{ padding: "0.8rem 0.7rem", textAlign: "right", fontWeight: 800, color: "#0f172a", fontSize: "0.82rem" }}>{fmt(s.total_amount)}</td>
                            <td style={{ padding: "0.8rem 0.7rem" }}>
                              <span style={{ background: cfg.bg, color: cfg.color, padding: "3px 10px", borderRadius: 20, fontSize: "0.68rem", fontWeight: 800, whiteSpace: "nowrap" }}>{cfg.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                      {scheduleData && scheduleData.schedule.length === 0 && (
                        <tr><td colSpan={6} style={{ textAlign: "center", padding: "2.5rem", color: "#94a3b8", fontWeight: 600 }}>No schedule generated for this loan</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── RECEIPT (PRINT / DOWNLOAD) MODAL ─── */}
      <AnimatePresence>
        {receipt && (
          <div style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", backdropFilter: "blur(10px)", background: "rgba(0,0,0,0.6)" }}>
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              style={{ width: "100%", maxWidth: 440, borderRadius: 20, background: "white", overflow: "hidden", boxShadow: "0 25px 60px rgba(0,0,0,0.4)" }}>
              <div style={{ background: "linear-gradient(135deg,#059669,#065f46)", padding: "1.6rem 1.5rem", color: "white", textAlign: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 0.8rem" }}><CheckCircle2 size={30} /></div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 900, margin: 0 }}>Payment Recorded</h2>
                <p style={{ margin: "0.3rem 0 0", fontSize: "0.82rem", opacity: 0.9, fontWeight: 600 }}>{fmt(receipt.amount_paid)} · {receipt.receipt_number}</p>
              </div>
              <div style={{ padding: "1.4rem 1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center", marginBottom: "1rem", fontSize: "0.82rem", fontWeight: 700, color: "#475569" }}>
                  <ReceiptIcon size={16} style={{ color: "#059669" }} /> Print or download the receipt
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.7rem" }}>
                  <button onClick={() => printReceipt(receipt, "a4")} style={rcptBtn("#102a43")}><Printer size={16} /> A4 Receipt</button>
                  <button onClick={() => printReceipt(receipt, "a4")} style={rcptBtn("#1d8ad1")}><Download size={16} /> Download PDF</button>
                  <button onClick={() => printReceipt(receipt, "80mm")} style={rcptBtn("#475569")}><Printer size={16} /> Thermal 80mm</button>
                  <button onClick={() => printReceipt(receipt, "58mm")} style={rcptBtn("#475569")}><Printer size={16} /> Thermal 58mm</button>
                </div>
                <button onClick={() => setReceipt(null)} style={{ width: "100%", marginTop: "0.9rem", padding: "0.7rem", borderRadius: 12, background: "#f1f5f9", border: "none", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", color: "#64748b" }}>Done</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .rt-spin { animation: rt-spin 1s linear infinite; }
        @keyframes rt-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .rt-stat-card:hover { transform: translateY(-3px); box-shadow: 0 12px 26px rgba(15,23,42,0.1) !important; border-color: #dbe2ea !important; }
        .rt-table-row { border-bottom: 1px solid #f1f5f9; transition: all 0.15s; }
        .rt-table-row:hover { background: #fdfbf7; }
        .rt-table-row:hover .rt-avatar { background: white !important; color: #4f46e5 !important; border-color: #6366f1 !important; }
        .rt-table-row .rt-actions { opacity: 0; transition: opacity 0.2s; }
        .rt-table-row:hover .rt-actions { opacity: 1; }
        .rt-btn-pay:hover { background: #4f46e5 !important; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 5px; }
        select::-ms-expand { display: none; }
      `}</style>
    </div>
  );
};

export default RepaymentTracker;
