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

import { useTranslation } from "react-i18next";

import { printReceipt, type ReceiptData } from "../utils/receipt";

import AlertModal from "../components/AlertModal";

import SmsStatusBadge, { smsStatusBadgeStyles } from "../components/SmsStatusBadge";

import { API_BASE } from "../lib/api";







interface NextInstallment {

  installment_number: number;

  due_date: string | null;

  principal_amount: number;

  interest_amount: number;

  total_amount: number;

  status: string;

}



interface Loan {

  id: number;

  name: string;

  amount: number;

  total_paid: number;

  remaining_balance: number;

  payment_status: string;

  status: string;

  completed_at?: string;

  next_installment?: NextInstallment | null;

  sms_status?: string | null;

  sms_type?: string | null;

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

  const { t } = useTranslation(["repaymentTracker", "common"]);

  const tc = (key: string) => t(key, { ns: "common" });

  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);

  const [completedLoans, setCompletedLoans] = useState<Loan[]>([]);

  const [summary, setSummary] = useState<Summary | null>(null);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [filterStatus, setFilterStatus] = useState<"all" | "current" | "overdue" | "pending">("all");

  const [showFilterMenu, setShowFilterMenu] = useState(false);



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



  // Alert modal state

  const [alertOpen, setAlertOpen] = useState(false);

  const [alertMessage, setAlertMessage] = useState("");

  const [alertTitle, setAlertTitle] = useState("");

  const [alertType, setAlertType] = useState<"success" | "error" | "info" | "warning">("info");



  const showAlert = (message: string, title?: string, type: "success" | "error" | "info" | "warning" = "info") => {

    setAlertMessage(message);

    setAlertTitle(title ?? "");

    setAlertType(type);

    setAlertOpen(true);

  };



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

    if (isNaN(amount) || amount <= 0 || !selectedLoan) {

      showAlert(t("validation.amountRequired"), "", "warning");

      return;

    }

    if (amount > selectedLoan.remaining_balance) {

      showAlert(t("validation.amountExceeds", {

        amount: amount.toLocaleString(),

        balance: Math.round(selectedLoan.remaining_balance).toLocaleString(),

      }), "", "error");

      return;

    }

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

    } catch (e: any) {

      console.error(e);

      showAlert(e.response?.data?.message || "Imeshindwa kufanya malipo. Tafadhali jaribu tena.", tc("modal.error"), "error");

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



  const [sendingReminderFor, setSendingReminderFor] = useState<number | null>(null);



  const sendReminder = async (loanId: number, customer: string) => {

    setSendingReminderFor(loanId);

    try {

      const token = localStorage.getItem("token");

      const res = await axios.post(`${API_BASE}/overdue/loans/${loanId}/send-reminder-sms`, {}, { headers: { Authorization: `Bearer ${token}` } });

      showAlert(res.data?.message || t("alerts.smsSent", { customer }), tc("modal.success"), "success");

    } catch (e: any) {

      showAlert(e.response?.data?.message || t("alerts.smsFailed", { customer }), tc("modal.error"), "error");

    } finally {

      setSendingReminderFor(null);

    }

  };



  const collectionRate = summary?.collection_rate || 0;



  const statCards = [

    { label: t("stats.totalExpected"), value: fmt(summary?.total_expected), icon: <DollarSign size={20} />, gradient: "linear-gradient(135deg, #6366f1, #818cf8)" },

    { label: t("stats.totalCollected"), value: fmt(summary?.total_collected), icon: <TrendingUp size={20} />, gradient: "linear-gradient(135deg, #10b981, #34d399)" },

    { label: t("stats.outstandingBalance"), value: fmt(summary?.outstanding_balance), icon: <Wallet size={20} />, gradient: "linear-gradient(135deg, #f59e0b, #fbbf24)" },

    { label: t("stats.overdueAmount"), value: fmt(summary?.overdue_amount), icon: <AlertTriangle size={20} />, gradient: "linear-gradient(135deg, #ef4444, #f87171)" },

    { label: t("stats.collectionRate"), value: `${collectionRate}%`, icon: <PieIcon size={20} />, gradient: "linear-gradient(135deg, #3b82f6, #60a5fa)" },

    { label: t("stats.activeLoans"), value: summary?.active_loans ?? activeLoans.length, icon: <Users size={20} />, gradient: "linear-gradient(135deg, #8b5cf6, #a78bfa)" },

    { label: t("stats.defaultedLoans"), value: summary?.defaulted_loans ?? 0, icon: <AlertCircle size={20} />, gradient: "linear-gradient(135deg, #f43f5e, #fb7185)" },

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

    { name: t("charts.current"), value: health.current, color: "#10b981" },

    { name: t("charts.atRisk"), value: health.at_risk, color: "#f59e0b" },

    { name: t("charts.critical"), value: health.critical, color: "#ef4444" },

  ];

  const hasHealth = health.current + health.at_risk + health.critical > 0;



  const currentLoans = (activeTab === "active" ? activeLoans : completedLoans)
    .filter((l) => l.name.toLowerCase().includes(search.toLowerCase()))
    .filter((l) => {
      if (filterStatus === "all") return true;
      const s = l.next_installment?.status ?? l.payment_status;
      return s === filterStatus;
    });

  const exportCsv = () => {
    const rows = [
      ["#", "Client", "Loan ID", "Installment", "Due Date", "Principal", "Interest", "Total", "Balance", "Status"],
      ...currentLoans.map((l, i) => [
        i + 1,
        l.name,
        `LN-${l.id}`,
        l.next_installment ? `#${l.next_installment.installment_number}` : "—",
        l.next_installment?.due_date ? new Date(l.next_installment.due_date).toLocaleDateString("en-GB") : "—",
        l.next_installment?.principal_amount ?? "—",
        l.next_installment?.interest_amount ?? "—",
        l.next_installment?.total_amount ?? "—",
        l.remaining_balance,
        l.next_installment?.status ?? l.payment_status,
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `repayment-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };



  return (

    <div style={{ minHeight: "100vh", maxWidth: "100%", overflowX: "hidden", boxSizing: "border-box", background: "#fdfbf7", padding: "0", fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif", color: "#1e293b" }}>
      <style>{`
        .ph-bar{display:flex;align-items:stretch;background:#f1f5f9;position:sticky;top:0;z-index:100;border-bottom:2px solid #e2e8f0;min-height:50px}
        .ph-inner{display:flex;align-items:flex-end;gap:4px;padding:10px 14px 0;flex:1;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none}
        .ph-inner::-webkit-scrollbar{display:none}
        .ph-brand{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;color:#102a43;white-space:nowrap;padding-bottom:10px;flex-shrink:0}
        .ph-actions{display:flex;align-items:center;gap:8px;padding:6px 14px;flex-shrink:0;border-left:1px solid #e2e8f0;background:#f1f5f9}
      `}</style>
      <div className="ph-bar">
        <div className="ph-inner">
          <div className="ph-brand">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
            <span>Repayment Tracker</span>
          </div>
        </div>
      </div>
      <div style={{ padding: "0.6rem 1rem 1rem" }}>



        {/* ─── STAT CARDS — SEPARATE BORDERED CARDS WITH SPACING (WRAPPING) ─── */}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(225px, 1fr))", gap: SECTION_GAP, marginBottom: SECTION_GAP }}>

          {statCards.map((card, i) => (

            <div key={i} className="rt-stat-card"

              style={{ ...CARD_STYLE, padding: "1.15rem 1.2rem", display: "flex", alignItems: "center", gap: "0.85rem", transition: "all 0.2s", overflow: "hidden" }}>

              <div style={{ width: 44, height: 44, borderRadius: "12px", background: card.gradient, display: "flex", alignItems: "center", justifyContent: "center", color: "white", flexShrink: 0, boxShadow: "0 4px 10px rgba(15,23,42,0.12)" }}>

                <span style={{ transform: "scale(0.85)" }}>{card.icon}</span>

              </div>

              <div style={{ minWidth: 0, overflow: "hidden" }}>

                <p style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: "#94a3b8", margin: "0 0 0.3rem", lineHeight: 1.25, wordBreak: "break-word" }}>{card.label}</p>

                <h3 title={String(card.value)} style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.value}</h3>

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

                <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>{t("charts.overview")}</h2>

              </div>

              <select style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.4rem 0.8rem", color: "#64748b", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", outline: "none" }}>

                <option>{t("charts.last6Months")}</option>

              </select>

            </div>

            <div style={{ height: 280, width: "100%", minWidth: 0 }}>

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

              {[{ l: t("charts.disbursed"), c: "#6366f1" }, { l: t("charts.repaid"), c: "#10b981" }, { l: t("charts.outstanding"), c: "#f59e0b" }].map((item) => (

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

              <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>{t("charts.portfolioHealth")}</h2>

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

                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#10b981" }}>{t("charts.healthy")}</span>

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

                {t("empty.noPortfolioData")}

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

              <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>{t("todayCollection.title")}</h2>

              <span style={{ marginLeft: "auto", background: "#eef2ff", color: "#6366f1", padding: "2px 10px", borderRadius: 20, fontSize: "0.7rem", fontWeight: 800 }}>{t("todayCollection.dueBadge", { count: todayCollections.length })}</span>

            </div>

            <div style={{ overflowX: "auto" }}>

              <table style={{ width: "100%", borderCollapse: "collapse" }}>

                <thead>

                  <tr>

                    {[t("table.customer"), t("table.loanNo"), t("table.dueAmount"), t("table.dueDate"), t("table.action")].map((h, i) => (

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

                          <button onClick={() => openCollect(row.loan_id, row.customer, row.due_amount, row.due_amount)} title={t("actions.collectPayment")}

                            style={{ padding: "0.35rem 0.7rem", borderRadius: 8, background: "#6366f1", border: "none", color: "white", fontWeight: 700, fontSize: "0.62rem", cursor: "pointer" }}>{t("actions.collect")}</button>

                          <button onClick={() => sendReminder(row.loan_id, row.customer)} disabled={sendingReminderFor === row.loan_id} title={t("actions.sendSmsReminder")}

                            style={{ padding: "0.35rem", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", cursor: sendingReminderFor === row.loan_id ? "wait" : "pointer", color: "#64748b", display: "flex", alignItems: "center", opacity: sendingReminderFor === row.loan_id ? 0.6 : 1 }}><Send size={13} /></button>

                          <button onClick={() => viewSchedule(row.loan_id)} title={t("actions.viewLoan")}

                            style={{ padding: "0.35rem", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center" }}><Eye size={13} /></button>

                        </div>

                      </td>

                    </tr>

                  ))}

                  {todayCollections.length === 0 && (

                    <tr><td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8", fontWeight: 600, fontSize: "0.82rem" }}>{t("empty.noPaymentsDueToday")}</td></tr>

                  )}

                </tbody>

              </table>

            </div>

          </div>



          {/* Overdue Management */}

          <div style={{ ...CARD_STYLE, padding: "1.5rem", minWidth: 0 }}>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>

              <AlertTriangle size={18} style={{ color: "#ef4444" }} />

              <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>{t("overdueManagement.title")}</h2>

              <span style={{ marginLeft: "auto", background: "#fef2f2", color: "#ef4444", padding: "2px 10px", borderRadius: 20, fontSize: "0.7rem", fontWeight: 800 }}>{t("overdueManagement.lateBadge", { count: overdueList.length })}</span>

            </div>

            <div style={{ overflowX: "auto" }}>

              <table style={{ width: "100%", borderCollapse: "collapse" }}>

                <thead>

                  <tr>

                    {[t("table.customer"), t("table.daysLate"), t("table.amount"), t("table.penalty"), t("table.action")].map((h, i) => (

                      <th key={h} style={{ textAlign: i === 4 ? "right" : "left", padding: "0 0.6rem 0.7rem", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#94a3b8", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{h}</th>

                    ))}

                  </tr>

                </thead>

                <tbody>

                  {overdueList.map((row) => (

                    <tr key={row.schedule_id} className="rt-table-row">

                      <td style={{ padding: "0.8rem 0.6rem", fontWeight: 700, color: "#1e293b", fontSize: "0.82rem" }}>{row.customer}</td>

                      <td style={{ padding: "0.8rem 0.6rem" }}>

                        <span style={{ background: "#fef2f2", color: "#dc2626", padding: "2px 9px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 800 }}>{t("overdueManagement.daysLateValue", { count: row.days_late })}</span>

                      </td>

                      <td style={{ padding: "0.8rem 0.6rem", fontWeight: 800, color: "#0f172a", fontSize: "0.82rem" }}>{fmt(row.amount)}</td>

                      <td style={{ padding: "0.8rem 0.6rem", fontWeight: 700, color: "#ef4444", fontSize: "0.82rem" }}>{fmt(row.penalty)}</td>

                      <td style={{ padding: "0.8rem 0.6rem" }}>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.35rem" }}>

                          <button onClick={() => sendReminder(row.loan_id, row.customer)} disabled={sendingReminderFor === row.loan_id} title={t("actions.sendOverdueSms")}

                            style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.35rem 0.7rem", borderRadius: 8, background: "#fee2e2", border: "1px solid #fecaca", color: "#dc2626", fontWeight: 700, fontSize: "0.62rem", cursor: sendingReminderFor === row.loan_id ? "wait" : "pointer", opacity: sendingReminderFor === row.loan_id ? 0.6 : 1 }}><Phone size={12} /> {t("actions.contact")}</button>

                          <button onClick={() => openCollect(row.loan_id, row.customer, row.amount + row.penalty, row.amount + row.penalty)} title={t("actions.collectWithPenalty")}

                            style={{ padding: "0.35rem 0.7rem", borderRadius: 8, background: "#6366f1", border: "none", color: "white", fontWeight: 700, fontSize: "0.62rem", cursor: "pointer" }}>{t("actions.collect")}</button>

                        </div>

                      </td>

                    </tr>

                  ))}

                  {overdueList.length === 0 && (

                    <tr><td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8", fontWeight: 600, fontSize: "0.82rem" }}>{t("empty.noOverduePayments")}</td></tr>

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

              {([["active", t("tabs.activeLoans"), activeLoans.length, Clock, "#4f46e5"], ["completed", t("tabs.completed"), completedLoans.length, CheckCircle2, "#059669"]] as const).map(([key, label, count, Icon, color]) => {

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

                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("filters.searchClient")}

                  style={{ padding: "0.45rem 0.8rem 0.45rem 2.1rem", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", outline: "none", fontWeight: 600, fontSize: "0.78rem", color: "#1e293b", width: 200 }} />

              </div>

              <div style={{ position: "relative" }}>
                <button onClick={() => setShowFilterMenu(v => !v)}
                  style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.45rem 0.85rem", borderRadius: 8, background: filterStatus !== "all" ? "#eef2ff" : "white", border: filterStatus !== "all" ? "1px solid #6366f1" : "1px solid #e2e8f0", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", color: filterStatus !== "all" ? "#4f46e5" : "#64748b" }}>
                  <Filter size={14} /> {t("filters.filter")}{filterStatus !== "all" ? ` · ${filterStatus}` : ""}
                </button>
                {showFilterMenu && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "white", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 8px 24px rgba(15,23,42,0.12)", zIndex: 200, minWidth: 160, overflow: "hidden" }}>
                    {(["all", "current", "overdue", "pending"] as const).map((s) => (
                      <button key={s} onClick={() => { setFilterStatus(s); setShowFilterMenu(false); }}
                        style={{ display: "block", width: "100%", padding: "0.6rem 1rem", background: filterStatus === s ? "#eef2ff" : "white", border: "none", textAlign: "left", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", color: filterStatus === s ? "#4f46e5" : "#475569" }}>
                        {s === "all" ? "All Statuses" : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={loadData}
                style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.45rem 0.85rem", borderRadius: 8, background: "white", border: "1px solid #e2e8f0", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", color: "#475569" }}>
                <RefreshCw size={14} className={loading ? "rt-spin" : ""} /> {t("actions.refresh")}
              </motion.button>

              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={exportCsv}
                style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.45rem 0.95rem", borderRadius: 8, background: "#6366f1", border: "none", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", color: "white", boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}>
                <ArrowUpRight size={14} /> {t("actions.export")}
              </motion.button>

            </div>

          </div>



          <div style={{ overflowX: "auto" }}>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>

              <thead>

                <tr>

                  {[t("table.number"), t("table.clientIdentity"), t("scheduleModal.installment"), t("table.dueDate"), t("table.principal"), t("scheduleModal.interest"), t("scheduleModal.total"), t("table.balance"), t("table.status"), "SMS", t("table.management")].map((h, i) => (

                    <th key={h} style={{ textAlign: i === 10 ? "right" : i >= 4 && i <= 7 ? "right" : "left", padding: "0 0.8rem 1rem", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#94a3b8", borderBottom: "1px solid #f1f5f9" }}>{h}</th>

                  ))}

                </tr>

              </thead>

              <tbody>

                <AnimatePresence mode="popLayout">

                  {currentLoans.map((loan, idx) => {

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

                              <p style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", color: "#94a3b8", margin: 0 }}>{t("table.loanNumberFormat", { id: loan.id })}</p>

                            </div>

                          </div>

                        </td>

                        <td style={{ padding: "1rem 0.8rem", fontWeight: 700, color: "#334155", fontSize: "0.85rem" }}>

                          {loan.next_installment ? `#${loan.next_installment.installment_number}` : "—"}

                        </td>

                        <td style={{ padding: "1rem 0.8rem", textAlign: "right", fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>

                          {loan.next_installment?.due_date ? new Date(loan.next_installment.due_date).toLocaleDateString("en-GB") : "—"}

                        </td>

                        <td style={{ padding: "1rem 0.8rem", textAlign: "right", fontWeight: 700, color: "#1e293b", fontSize: "0.85rem" }}>

                          {loan.next_installment ? fmt(loan.next_installment.principal_amount) : "—"}

                        </td>

                        <td style={{ padding: "1rem 0.8rem", textAlign: "right", fontWeight: 700, color: "#8a7a52", fontSize: "0.85rem" }}>

                          {loan.next_installment ? fmt(loan.next_installment.interest_amount) : "—"}

                        </td>

                        <td style={{ padding: "1rem 0.8rem", textAlign: "right", fontWeight: 900, color: "#0f172a", fontSize: "0.85rem" }}>

                          {loan.next_installment ? fmt(loan.next_installment.total_amount) : "—"}

                        </td>

                        <td style={{ padding: "1rem 0.8rem", textAlign: "right", fontWeight: 800, color: "#0f172a", fontSize: "0.85rem" }}>

                          {fmt(loan.remaining_balance)}

                        </td>

                        <td style={{ padding: "1rem 0.8rem" }}>

                          {(() => {

                            const instStatus = loan.next_installment?.status ?? (loan.payment_status === "completed" ? "paid" : loan.payment_status || "current");

                            return (

                              <span style={{

                                display: "inline-block", padding: "0.25rem 0.7rem", borderRadius: 16, fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.8px",

                                background: instStatus === "paid" ? "rgba(16,185,129,0.12)" : instStatus === "overdue" ? "rgba(239,68,68,0.12)" : "rgba(99,102,241,0.12)",

                                color: instStatus === "paid" ? "#059669" : instStatus === "overdue" ? "#dc2626" : "#4f46e5"

                              }}>

                                {t(`status.${instStatus}`, { defaultValue: instStatus })}

                              </span>

                            );

                          })()}

                        </td>

                        <td style={{ padding: "1rem 0.8rem" }}>

                          <SmsStatusBadge status={loan.sms_status} type={loan.sms_type} />

                        </td>

                        <td style={{ padding: "1rem 0.8rem", textAlign: "right" }}>

                          <div className="rt-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "0.4rem" }}>

                            {activeTab === "active" && (

                              <button onClick={() => {

                                const due = loan.next_installment ? Math.min(loan.next_installment.total_amount, loan.remaining_balance) : loan.remaining_balance;

                                setSelectedLoan(loan);

                                setRepaymentAmount(due > 0 ? String(due) : "");

                                setTransactionId(""); setReceivedBy(""); setNotes("");

                                setPaymentDate(new Date().toISOString().split("T")[0]);

                                setShowRepaymentModal(true);

                              }}

                                style={{ padding: "0.4rem 0.9rem", borderRadius: 10, background: "#6366f1", border: "none", color: "white", fontWeight: 700, fontSize: "0.65rem", cursor: "pointer", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }} className="rt-btn-pay">

                                {t("actions.addPayment")}

                              </button>

                            )}

                            <button onClick={() => viewSchedule(loan.id)} title={t("actions.viewSchedule")} style={{ padding: "0.4rem", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>

                              <Eye size={14} />

                            </button>

                          </div>

                        </td>

                      </motion.tr>

                    );

                  })}

                </AnimatePresence>

                {currentLoans.length === 0 && !loading && (

                  <tr><td colSpan={10} style={{ textAlign: "center", padding: "3rem", color: "#475569", fontWeight: 600 }}>{t("empty.noLoansInCategory")}</td></tr>

                )}

              </tbody>

            </table>

          </div>

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

                  <h2 style={{ fontSize: "1.3rem", fontWeight: 900, margin: 0 }}>{t("modal.postRepayment")}</h2>

                  <button onClick={() => { setShowRepaymentModal(false); setRepaymentAmount(""); setTransactionId(""); setReceivedBy(""); setNotes(""); }} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.2)", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>“•</button>

                </div>

                <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 16, padding: "1rem", display: "flex", alignItems: "center", gap: "0.8rem" }}>

                  <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "1.1rem" }}>{selectedLoan?.name.charAt(0)}</div>

                  <div style={{ flex: 1 }}>

                    <p style={{ fontSize: "0.65rem", fontWeight: 700, opacity: 0.65, margin: 0, textTransform: "uppercase" }}>{t("modal.borrower")}</p>

                    <p style={{ fontWeight: 900, margin: 0 }}>{selectedLoan?.name}</p>

                  </div>

                  <div style={{ textAlign: "right" }}>

                    <p style={{ fontSize: "0.65rem", fontWeight: 700, opacity: 0.65, margin: 0, textTransform: "uppercase" }}>{t("modal.balance")}</p>

                    <p style={{ fontWeight: 900, margin: 0 }}>{fmt(selectedLoan?.remaining_balance)}</p>

                  </div>

                </div>

              </div>

              <div style={{ padding: "1.5rem" }}>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>

                  <div>

                    <label style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#64748b", display: "block", marginBottom: "0.4rem" }}>{t("modal.amount")}</label>

                    <input type="number" value={repaymentAmount} onChange={(e) => setRepaymentAmount(e.target.value)} placeholder="0.00"

                      style={{ width: "100%", padding: "0.8rem", borderRadius: 12, background: "#0b1120", border: "1px solid #1e293b", outline: "none", fontWeight: 800, fontSize: "0.9rem", color: "#e2e8f0", boxSizing: "border-box" }} />

                  </div>

                  <div>

                    <label style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#64748b", display: "block", marginBottom: "0.4rem" }}>{t("modal.date")}</label>

                    <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}

                      style={{ width: "100%", padding: "0.8rem", borderRadius: 12, background: "#0b1120", border: "1px solid #1e293b", outline: "none", fontWeight: 700, fontSize: "0.85rem", color: "#e2e8f0", boxSizing: "border-box" }} />

                  </div>

                </div>

                <label style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#64748b", display: "block", margin: "1rem 0 0.4rem" }}>{t("modal.paymentMethod")}</label>

                <div style={{ display: "flex", gap: "0.6rem" }}>

                  {[["cash", t("modal.methodCash")], ["bank_transfer", t("modal.methodBank")], ["mobile_money", t("modal.methodMobileMoney")]].map(([val, lbl]) => (

                    <button key={val} onClick={() => setPaymentMethod(val)}

                      style={{ flex: 1, padding: "0.75rem", borderRadius: 12, border: paymentMethod === val ? "2px solid #6366f1" : "1px solid #1e293b", background: paymentMethod === val ? "rgba(99,102,241,0.1)" : "#0b1120", fontWeight: 700, cursor: "pointer", color: paymentMethod === val ? "#a5b4fc" : "#64748b", fontSize: "0.78rem", transition: "all 0.2s" }}>

                      {lbl}

                    </button>

                  ))}

                </div>

                <input type="text" placeholder={t("modal.transactionReference")} value={transactionId} onChange={(e) => setTransactionId(e.target.value)}

                  style={{ width: "100%", padding: "0.8rem", borderRadius: 12, background: "#0b1120", border: "1px solid #1e293b", outline: "none", fontWeight: 700, fontSize: "0.8rem", color: "#e2e8f0", marginTop: "0.8rem", boxSizing: "border-box" }} />

                <input type="text" placeholder={t("modal.receivedBy")} value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)}

                  style={{ width: "100%", padding: "0.8rem", borderRadius: 12, background: "#0b1120", border: "1px solid #1e293b", outline: "none", fontWeight: 700, fontSize: "0.8rem", color: "#e2e8f0", marginTop: "0.8rem", boxSizing: "border-box" }} />

                <input type="text" placeholder={t("modal.notesOptional")} value={notes} onChange={(e) => setNotes(e.target.value)}

                  style={{ width: "100%", padding: "0.8rem", borderRadius: 12, background: "#0b1120", border: "1px solid #1e293b", outline: "none", fontWeight: 700, fontSize: "0.8rem", color: "#e2e8f0", marginTop: "0.8rem", boxSizing: "border-box" }} />

                <div style={{ display: "flex", gap: "0.8rem", marginTop: "1.5rem" }}>

                  <button onClick={() => { setShowRepaymentModal(false); setRepaymentAmount(""); setTransactionId(""); setReceivedBy(""); setNotes(""); }} style={{ flex: 1, padding: "0.85rem", borderRadius: 14, background: "#1e293b", border: "none", fontWeight: 800, fontSize: "0.85rem", cursor: "pointer", color: "#94a3b8" }}>{t("actions.discard")}</button>

                  <button onClick={submitRepayment} style={{ flex: 2, padding: "0.85rem", borderRadius: 14, background: "#6366f1", border: "none", fontWeight: 800, fontSize: "0.85rem", cursor: "pointer", color: "white", boxShadow: "0 6px 20px rgba(99,102,241,0.35)" }}>{t("actions.confirmPayment")}</button>

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

              style={{ width: "100%", maxWidth: 780, maxHeight: "85vh", borderRadius: 24, background: "#fffcf6", border: "1px solid #e3d7b0", boxShadow: "0 30px 70px rgba(74,60,26,0.35)", overflow: "hidden", display: "flex", flexDirection: "column" }}>

              <div style={{ position: "relative", background: "linear-gradient(135deg, #102a43 0%, #1d3a5f 55%, #2c5282 100%)", padding: "1.5rem 1.7rem 1.7rem", color: "white", display: "flex", justifyContent: "space-between", alignItems: "flex-start", overflow: "hidden" }}>

                <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(226,188,138,0.12)" }} />

                <div style={{ position: "relative", zIndex: 1 }}>

                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.62rem", fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: "#e2bc8a", background: "rgba(226,188,138,0.15)", padding: "4px 10px", borderRadius: 20, marginBottom: 10 }}>

                    <Calendar size={11} /> {t("scheduleModal.loanRepaymentPlan")}

                  </span>

                  {scheduleData && <p style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", color: "#cbd9ea", fontWeight: 700, letterSpacing: "0.3px" }}>{scheduleData.customer} <span style={{ color: "#e2bc8a" }}>&bull;</span> {scheduleData.loan_number}</p>}

                </div>

                <button onClick={() => setShowSchedule(false)} style={{ position: "relative", zIndex: 1, width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.25)", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }}

                  onMouseOver={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.26)"; }}

                  onMouseOut={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; }}>

                  <X size={18} />

                </button>

                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #e2bc8a, #c19a6b 50%, #e2bc8a)" }} />

              </div>

              <div style={{ padding: "1.3rem 1.6rem 1.6rem", overflowY: "auto", background: "#fffcf6" }}>

                {scheduleLoading ? (

                  <div style={{ textAlign: "center", padding: "3rem", color: "#8a7338", fontWeight: 600 }}>{t("scheduleModal.loadingSchedule")}</div>

                ) : (

                  <div style={{ borderRadius: 16, border: "1px solid #efe6d0", overflow: "hidden", background: "#ffffff" }}>

                    <table style={{ width: "100%", borderCollapse: "collapse" }}>

                      <thead>

                        <tr style={{ background: "#f8f1de" }}>

                          {[t("scheduleModal.installment"), t("table.dueDate"), t("table.principal"), t("scheduleModal.interest"), t("scheduleModal.total"), t("table.status")].map((h, i) => (

                            <th key={h} style={{ textAlign: i >= 2 && i <= 4 ? "right" : "left", padding: "0.85rem 0.9rem", fontSize: "0.62rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.2px", color: "#8a7338", borderBottom: "1.5px solid #efe6d0" }}>{h}</th>

                          ))}

                        </tr>

                      </thead>

                      <tbody>

                        {(scheduleData?.schedule || []).map((s, idx) => {

                          const cfg = s.status === "paid"

                            ? { bg: "#ecfdf5", color: "#059669", dot: "#10b981", label: t("status.paid") }

                            : s.status === "overdue"

                              ? { bg: "#fef2f2", color: "#dc2626", dot: "#ef4444", label: t("status.overdue") }

                              : { bg: "#fff7e6", color: "#b45309", dot: "#f59e0b", label: t("status.pending") };

                          return (

                            <tr key={s.installment_number} style={{ background: idx % 2 === 0 ? "#ffffff" : "#fffcf6", borderBottom: "1px solid #f5efe0", transition: "background 0.15s" }}

                              onMouseOver={(e) => { e.currentTarget.style.background = "#fbf3e0"; }}

                              onMouseOut={(e) => { e.currentTarget.style.background = idx % 2 === 0 ? "#ffffff" : "#fffcf6"; }}>

                              <td style={{ padding: "0.85rem 0.9rem" }}>

                                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 30, height: 24, padding: "0 8px", borderRadius: 8, background: "#102a43", color: "#e2bc8a", fontWeight: 800, fontSize: "0.74rem" }}>#{s.installment_number}</span>

                              </td>

                              <td style={{ padding: "0.85rem 0.9rem", fontSize: "0.8rem", color: "#7a6a4a", fontWeight: 600 }}>{new Date(s.due_date).toLocaleDateString("en-GB")}</td>

                              <td style={{ padding: "0.85rem 0.9rem", textAlign: "right", fontWeight: 700, color: "#3f3318", fontSize: "0.82rem" }}>{fmt(s.principal_amount)}</td>

                              <td style={{ padding: "0.85rem 0.9rem", textAlign: "right", fontWeight: 700, color: "#8a7a52", fontSize: "0.82rem" }}>{fmt(s.interest_amount)}</td>

                              <td style={{ padding: "0.85rem 0.9rem", textAlign: "right", fontWeight: 900, color: "#102a43", fontSize: "0.86rem" }}>{fmt(s.total_amount)}</td>

                              <td style={{ padding: "0.85rem 0.9rem" }}>

                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: cfg.bg, color: cfg.color, padding: "5px 12px", borderRadius: 20, fontSize: "0.68rem", fontWeight: 800, whiteSpace: "nowrap" }}>

                                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, display: "inline-block" }} />

                                  {cfg.label}

                                </span>

                              </td>

                            </tr>

                          );

                        })}

                        {scheduleData && scheduleData.schedule.length === 0 && (

                          <tr><td colSpan={6} style={{ textAlign: "center", padding: "2.5rem", color: "#8a7338", fontWeight: 600 }}>{t("empty.noScheduleGenerated")}</td></tr>

                        )}

                      </tbody>

                    </table>

                  </div>

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

                <h2 style={{ fontSize: "1.2rem", fontWeight: 900, margin: 0 }}>{t("receiptModal.paymentRecorded")}</h2>

                <p style={{ margin: "0.3rem 0 0", fontSize: "0.82rem", opacity: 0.9, fontWeight: 600 }}>{fmt(receipt.amount_paid)} Â· {receipt.receipt_number}</p>

              </div>

              <div style={{ padding: "1.4rem 1.5rem" }}>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center", marginBottom: "1rem", fontSize: "0.82rem", fontWeight: 700, color: "#475569" }}>

                  <ReceiptIcon size={16} style={{ color: "#059669" }} /> {t("receiptModal.printOrDownload")}

                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.7rem" }}>

                  <button onClick={() => printReceipt(receipt, "a4")} style={rcptBtn("#102a43")}><Printer size={16} /> {t("receiptModal.a4Receipt")}</button>

                  <button onClick={() => printReceipt(receipt, "a4")} style={rcptBtn("#1d8ad1")}><Download size={16} /> {t("receiptModal.downloadPdf")}</button>

                  <button onClick={() => printReceipt(receipt, "80mm")} style={rcptBtn("#475569")}><Printer size={16} /> {t("receiptModal.thermal80")}</button>

                  <button onClick={() => printReceipt(receipt, "58mm")} style={rcptBtn("#475569")}><Printer size={16} /> {t("receiptModal.thermal58")}</button>

                </div>

                <button onClick={() => setReceipt(null)} style={{ width: "100%", marginTop: "0.9rem", padding: "0.7rem", borderRadius: 12, background: "#f1f5f9", border: "none", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", color: "#64748b" }}>{t("actions.done")}</button>

              </div>

            </motion.div>

          </div>

        )}

      </AnimatePresence>



      <AlertModal

        isOpen={alertOpen}

        title={alertTitle}

        message={alertMessage}

        type={alertType}

        onClose={() => setAlertOpen(false)}

      />



      <style>{`

        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        .rt-spin { animation: rt-spin 1s linear infinite; }

        @keyframes rt-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        ${smsStatusBadgeStyles}

        .rt-stat-card:hover { transform: translateY(-3px); box-shadow: 0 12px 26px rgba(15,23,42,0.1) !important; border-color: #dbe2ea !important; }

        .rt-table-row { border-bottom: 1px solid #f1f5f9; transition: all 0.15s; }

        .rt-table-row:hover { background: #fdfbf7; }

        .rt-table-row:hover .rt-avatar { background: white !important; color: #4f46e5 !important; border-color: #6366f1 !important; }

        /* Actions stay visible always — hover-only would make them

           permanently unreachable on touch devices (tablet/phone), which

           have no hover state at all. */

        .rt-table-row .rt-actions { opacity: 1; transition: opacity 0.2s; }

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



