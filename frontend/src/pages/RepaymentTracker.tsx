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

  customer_id?: number | null;

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

  const [canCollect, setCanCollect] = useState(false);
  const [submittingRepayment, setSubmittingRepayment] = useState(false);

  const tc = (key: string) => t(key, { ns: "common" });

  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);

  const [completedLoans, setCompletedLoans] = useState<Loan[]>([]);

  const [customersCount, setCustomersCount] = useState(0);
  const [pendingCustomers, setPendingCustomers] = useState(0);
  const [disbursedCustomers, setDisbursedCustomers] = useState(0);

  const [summary, setSummary] = useState<Summary | null>(null);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [filterStatus, setFilterStatus] = useState<"all" | "current" | "overdue" | "pending">("all");

  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [openRowDropdown, setOpenRowDropdown] = useState<number | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);



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

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-rt-dropdown]')) setOpenRowDropdown(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);



  const loadData = async () => {

    setLoading(true);

    try {

      const token = localStorage.getItem("token");

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [loansRes, summaryRes, settingsRes] = await Promise.all([

        axios.get(`${API_BASE}/loans/active`, { headers }),

        axios.get(`${API_BASE}/repayments/summary`, { headers }),

        axios.get(`${API_BASE}/loan-settings`, { headers }).catch(() => ({ data: {} })),

      ]);

      // Mirror backend User::canRecordRepayment() exactly:
      // 1. Always-on roles  2. full_sidebar_access  3. per-user override  4. role-level matrix
      (() => {
        try {
          const u = JSON.parse(localStorage.getItem("user") || "{}");
          const role: string = u.role ?? "";
          if (["admin", "finance_officer", "cashier"].includes(role)) { setCanCollect(true); return; }
          if (u.full_sidebar_access) { setCanCollect(true); return; }
          const perms = u.sidebar_permissions ?? {};
          if (perms.can_record_repayment || perms.can_disburse) { setCanCollect(true); return; }
          const matrixRoles: string[] = settingsRes.data?.record_repayment_roles ?? [];
          setCanCollect(matrixRoles.includes(role));
        } catch { setCanCollect(false); }
      })();

      axios.get(`${API_BASE}/loans/stats`, { headers }).then(r => {
        setCustomersCount(r.data.customers_count || 0);
        setPendingCustomers(r.data.pending_customers || 0);
        setDisbursedCustomers(r.data.disbursed_customers || 0);
      }).catch(() => {});



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

    if (submittingRepayment) return;
    setSubmittingRepayment(true);

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

    } finally {

      setSubmittingRepayment(false);

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
  const [reminderConfirm, setReminderConfirm] = useState<{ loanId: number; customer: string } | null>(null);



  const sendReminder = async (loanId: number, customer: string) => {
    setReminderConfirm({ loanId, customer });
  };

  const confirmSendReminder = async () => {
    if (!reminderConfirm) return;
    const { loanId, customer } = reminderConfirm;
    setReminderConfirm(null);
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

    { label: "Pending Customers", value: pendingCustomers, total: customersCount, icon: <Users size={18} />, accent: "#f59e0b", bg: "#fffbeb", border: "#fde68a", iconBg: "linear-gradient(135deg,#f59e0b,#fbbf24)", hint: "Awaiting disbursement" },

    { label: "Disbursed Customers", value: disbursedCustomers, total: customersCount, icon: <Users size={18} />, accent: "#0ea5e9", bg: "#f0f9ff", border: "#bae6fd", iconBg: "linear-gradient(135deg,#0ea5e9,#38bdf8)", hint: "Active borrowers" },

    { label: t("stats.totalExpected"), value: fmt(summary?.total_expected), total: null, icon: <DollarSign size={18} />, accent: "#6366f1", bg: "#eef2ff", border: "#c7d2fe", iconBg: "linear-gradient(135deg,#6366f1,#818cf8)", hint: null },

    { label: t("stats.totalCollected"), value: fmt(summary?.total_collected), total: null, icon: <TrendingUp size={18} />, accent: "#10b981", bg: "#ecfdf5", border: "#a7f3d0", iconBg: "linear-gradient(135deg,#10b981,#34d399)", hint: null },

    { label: t("stats.outstandingBalance"), value: fmt(summary?.outstanding_balance), total: null, icon: <Wallet size={18} />, accent: "#f59e0b", bg: "#fffbeb", border: "#fde68a", iconBg: "linear-gradient(135deg,#f59e0b,#fbbf24)", hint: null },

    { label: t("stats.overdueAmount"), value: fmt(summary?.overdue_amount), total: null, icon: <AlertTriangle size={18} />, accent: "#ef4444", bg: "#fef2f2", border: "#fecaca", iconBg: "linear-gradient(135deg,#ef4444,#f87171)", hint: null },

    { label: t("stats.collectionRate"), value: `${collectionRate}%`, total: null, icon: <PieIcon size={18} />, accent: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe", iconBg: "linear-gradient(135deg,#3b82f6,#60a5fa)", hint: null },

    { label: t("stats.activeLoans"), value: summary?.active_loans ?? activeLoans.length, total: null, icon: <Users size={18} />, accent: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe", iconBg: "linear-gradient(135deg,#8b5cf6,#a78bfa)", hint: null },

    { label: t("stats.defaultedLoans"), value: summary?.defaulted_loans ?? 0, total: null, icon: <AlertCircle size={18} />, accent: "#f43f5e", bg: "#fff1f2", border: "#fecdd3", iconBg: "linear-gradient(135deg,#f43f5e,#fb7185)", hint: null },

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



        {/* ─── STAT CARDS — ALL IN ONE ROW ─── */}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(225px, 1fr))", gap: SECTION_GAP, marginBottom: SECTION_GAP }}>

          {/* ── COMBINED CUSTOMER CARD — same padding/height as regular cards ── */}
          <div style={{ background: "white", border: "1.5px solid #e2e8f0", borderRadius: 14, boxShadow: "0 2px 10px rgba(15,23,42,0.06)", padding: "1.15rem 1rem", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 0, transition: "box-shadow 0.2s, transform 0.2s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(15,23,42,0.12)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 10px rgba(15,23,42,0.06)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
          >
            {/* Total badge — top-right corner */}
            <span style={{ position: "absolute", top: 8, right: 10, background: "linear-gradient(135deg,#f59e0b,#0ea5e9)", color: "#fff", fontSize: "0.58rem", fontWeight: 800, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>
              {customersCount} total
            </span>

            {/* Left — Pending */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.5rem", paddingRight: "0.6rem", borderRight: "1px solid #f1f5f9" }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: "linear-gradient(135deg,#f59e0b,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 10px #f59e0b33" }}>
                <Users size={16} color="#fff" />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: "0.58rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "#f59e0b", margin: "0 0 0.2rem", lineHeight: 1.2 }}>Pending</p>
                <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a", margin: "0 0 0.1rem" }}>{pendingCustomers}</h3>
                <p style={{ fontSize: "0.55rem", fontWeight: 600, color: "#f59e0b", margin: 0, opacity: 0.8 }}>Awaiting</p>
              </div>
            </div>

            {/* Right — Disbursed */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.5rem", paddingLeft: "0.6rem" }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: "linear-gradient(135deg,#0ea5e9,#38bdf8)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 10px #0ea5e933" }}>
                <Users size={16} color="#fff" />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: "0.58rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "#0ea5e9", margin: "0 0 0.2rem", lineHeight: 1.2 }}>Disbursed</p>
                <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a", margin: "0 0 0.1rem" }}>{disbursedCustomers}</h3>
                <p style={{ fontSize: "0.55rem", fontWeight: 600, color: "#0ea5e9", margin: 0, opacity: 0.8 }}>Active</p>
              </div>
            </div>

            {/* Decorative corner circle */}
            <div style={{ position: "absolute", bottom: -14, right: -14, width: 52, height: 52, borderRadius: "50%", background: "#0ea5e9", opacity: 0.07, pointerEvents: "none" }} />
          </div>

          {/* ── REMAINING 7 STAT CARDS ── */}
          {statCards.filter(c => c.total === null).map((card, i) => (

            <div key={i} style={{
              background: card.bg,
              border: `1.5px solid ${card.border}`,
              borderRadius: 14,
              padding: "1.15rem 1rem",
              boxShadow: "0 2px 10px rgba(15,23,42,0.06)",
              display: "flex", alignItems: "center", gap: "0.7rem",
              position: "relative", overflow: "hidden",
              transition: "box-shadow 0.2s, transform 0.2s",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(15,23,42,0.12)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 10px rgba(15,23,42,0.06)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 11, background: card.iconBg, display: "flex", alignItems: "center", justifyContent: "center", color: "white", flexShrink: 0, boxShadow: `0 4px 10px ${card.accent}33` }}>
                <span style={{ transform: "scale(0.85)" }}>{card.icon}</span>
              </div>
              <div style={{ minWidth: 0, overflow: "hidden" }}>
                <p style={{ fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: card.accent, margin: "0 0 0.25rem", lineHeight: 1.2 }}>{card.label}</p>
                <h3 title={String(card.value)} style={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.value}</h3>
              </div>
              <div style={{ position: "absolute", bottom: -14, right: -14, width: 52, height: 52, borderRadius: "50%", background: card.accent, opacity: 0.07, pointerEvents: "none" }} />
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

          {/* ── Today's Collection — navy blue accent ── */}
          <div style={{ background: "white", borderRadius: 14, boxShadow: "0 2px 16px rgba(15,23,42,0.10)", borderTop: "4px solid #1e5fae", border: "1px solid #dbeafe", borderTopWidth: 4, borderTopColor: "#1e5fae", overflow: "hidden" }}>
            <div style={{ padding: "1rem 1.25rem 0.5rem", display: "flex", alignItems: "center", gap: "0.6rem", borderBottom: "1px solid #eff6ff" }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#1e5fae,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Calendar size={16} color="#fff" />
              </div>
              <span style={{ fontWeight: 800, fontSize: "1rem", color: "#102a43", flex: 1 }}>{t("todayCollection.title")}</span>
              <span style={{ background: "#1e5fae", color: "#fff", padding: "3px 12px", borderRadius: 20, fontSize: "0.68rem", fontWeight: 800 }}>{t("todayCollection.dueBadge", { count: todayCollections.length })}</span>
            </div>
            <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 300 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
                <thead>
                  <tr style={{ background: "#eff6ff", position: "sticky", top: 0, zIndex: 1 }}>
                    {[t("table.customer"), t("table.loanNo"), t("table.dueAmount"), t("table.dueDate"), t("table.action")].map((h, i) => (
                      <th key={h} style={{ textAlign: i === 4 ? "right" : "left", padding: "0.6rem 0.75rem", fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#1e5fae", borderBottom: "2px solid #bfdbfe", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {todayCollections.map((row, idx) => (
                    <tr key={row.schedule_id} style={{ background: idx % 2 === 0 ? "#fff" : "#f0f7ff", borderBottom: "1px solid #e0effe" }}>
                      <td style={{ padding: "0.7rem 0.75rem", fontWeight: 700, color: "#102a43", fontSize: "0.8rem" }}>{row.customer}</td>
                      <td style={{ padding: "0.7rem 0.75rem", fontSize: "0.68rem", fontWeight: 600, color: "#1e5fae", whiteSpace: "nowrap" }}>{row.loan_number}</td>
                      <td style={{ padding: "0.7rem 0.75rem", fontWeight: 800, color: "#102a43", fontSize: "0.82rem", whiteSpace: "nowrap" }}>{fmt(row.due_amount)}</td>
                      <td style={{ padding: "0.7rem 0.75rem", fontSize: "0.75rem", color: "#475569", whiteSpace: "nowrap" }}>{new Date(row.due_date).toLocaleDateString("en-GB")}</td>
                      <td style={{ padding: "0.7rem 0.75rem" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.3rem" }}>
                          <button onClick={canCollect ? () => openCollect(row.loan_id, row.customer, row.due_amount, row.due_amount) : undefined} disabled={!canCollect} style={{ padding: "0.3rem 0.8rem", borderRadius: 7, background: canCollect ? "#1e5fae" : "#94a3b8", border: "none", color: "#fff", fontWeight: 700, fontSize: "0.65rem", cursor: canCollect ? "pointer" : "not-allowed", opacity: canCollect ? 1 : 0.5 }}>{t("actions.collect")}</button>
                          <button onClick={() => sendReminder(row.loan_id, row.customer)} disabled={sendingReminderFor === row.loan_id} style={{ padding: "0.3rem 0.4rem", borderRadius: 7, background: "#dbeafe", border: "1px solid #93c5fd", cursor: "pointer", color: "#1d4ed8", display: "flex", alignItems: "center", opacity: sendingReminderFor === row.loan_id ? 0.5 : 1 }}><Send size={12} /></button>
                          <button onClick={() => viewSchedule(row.loan_id)} style={{ padding: "0.3rem 0.4rem", borderRadius: 7, background: "#f0f9ff", border: "1px solid #7dd3fc", cursor: "pointer", color: "#0369a1", display: "flex", alignItems: "center" }}><Eye size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {todayCollections.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: "2.5rem 1rem", color: "#94a3b8", fontWeight: 600, fontSize: "0.82rem" }}>{t("empty.noPaymentsDueToday")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Overdue Management — crimson red accent ── */}
          <div style={{ background: "white", borderRadius: 14, boxShadow: "0 2px 16px rgba(15,23,42,0.10)", border: "1px solid #fee2e2", borderTopWidth: 4, borderTopColor: "#dc2626", overflow: "hidden" }}>
            <div style={{ padding: "1rem 1.25rem 0.5rem", display: "flex", alignItems: "center", gap: "0.6rem", borderBottom: "1px solid #fff1f2" }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#991b1b,#dc2626)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertTriangle size={16} color="#fff" />
              </div>
              <span style={{ fontWeight: 800, fontSize: "1rem", color: "#7f1d1d", flex: 1 }}>{t("overdueManagement.title")}</span>
              <span style={{ background: "#dc2626", color: "#fff", padding: "3px 12px", borderRadius: 20, fontSize: "0.68rem", fontWeight: 800 }}>{t("overdueManagement.lateBadge", { count: overdueList.length })}</span>
            </div>
            <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 300 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
                <thead>
                  <tr style={{ background: "#fff1f2", position: "sticky", top: 0, zIndex: 1 }}>
                    {[t("table.customer"), t("table.daysLate"), t("table.amount"), t("table.penalty"), "TOTAL", t("table.action")].map((h, i) => (
                      <th key={h} style={{ textAlign: i === 5 ? "right" : i >= 2 ? "right" : "left", padding: "0.6rem 0.75rem", fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#dc2626", borderBottom: "2px solid #fecaca", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Group rows by customer name to compute subtotals
                    const rows: React.ReactNode[] = [];
                    let i = 0;
                    while (i < overdueList.length) {
                      const customerName = overdueList[i].customer;
                      const customerLoanId = overdueList[i].loan_id;
                      // Collect all consecutive rows for this customer (same loan_id)
                      let j = i;
                      while (j < overdueList.length && overdueList[j].loan_id === customerLoanId) j++;
                      const group = overdueList.slice(i, j);
                      const subtotalAmount = group.reduce((s, r) => s + r.amount, 0);
                      const subtotalPenalty = group.reduce((s, r) => s + r.penalty, 0);
                      const subtotalTotal = subtotalAmount + subtotalPenalty;

                      group.forEach((row, gi) => {
                        const rowBg = (i + gi) % 2 === 0 ? "#fff" : "#fff5f5";
                        rows.push(
                          <tr key={row.schedule_id} style={{ background: rowBg, borderBottom: "1px solid #fee2e2" }}>
                            <td style={{ padding: "0.7rem 0.75rem", fontWeight: 700, color: "#7f1d1d", fontSize: "0.8rem" }}>{row.customer}</td>
                            <td style={{ padding: "0.7rem 0.75rem" }}>
                              <span style={{ background: "#fef2f2", color: "#dc2626", padding: "3px 10px", borderRadius: 20, fontSize: "0.68rem", fontWeight: 800, border: "1px solid #fecaca" }}>
                                {Math.floor(row.days_late)}d
                              </span>
                            </td>
                            <td style={{ padding: "0.7rem 0.75rem", fontWeight: 800, color: "#102a43", fontSize: "0.82rem", whiteSpace: "nowrap", textAlign: "right" }}>{fmt(row.amount)}</td>
                            <td style={{ padding: "0.7rem 0.75rem", fontWeight: 700, color: "#dc2626", fontSize: "0.82rem", whiteSpace: "nowrap", textAlign: "right" }}>{fmt(row.penalty)}</td>
                            <td style={{ padding: "0.7rem 0.75rem", fontWeight: 800, color: "#7f1d1d", fontSize: "0.82rem", whiteSpace: "nowrap", textAlign: "right" }}>{fmt(row.amount + row.penalty)}</td>
                            <td style={{ padding: "0.7rem 0.75rem" }}>
                              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.3rem" }}>
                                <button onClick={() => sendReminder(row.loan_id, row.customer)} disabled={sendingReminderFor === row.loan_id} style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.3rem 0.7rem", borderRadius: 7, background: "#fee2e2", border: "1px solid #fca5a5", color: "#991b1b", fontWeight: 700, fontSize: "0.62rem", cursor: "pointer", opacity: sendingReminderFor === row.loan_id ? 0.5 : 1 }}><Phone size={12} />{t("actions.contact")}</button>
                                <button onClick={canCollect ? () => openCollect(row.loan_id, row.customer, row.amount + row.penalty, row.amount + row.penalty) : undefined} disabled={!canCollect} style={{ padding: "0.3rem 0.8rem", borderRadius: 7, background: canCollect ? "#dc2626" : "#94a3b8", border: "none", color: "#fff", fontWeight: 700, fontSize: "0.65rem", cursor: canCollect ? "pointer" : "not-allowed", opacity: canCollect ? 1 : 0.5 }}>{t("actions.collect")}</button>
                              </div>
                            </td>
                          </tr>
                        );
                      });

                      // Subtotal row for this customer (only if >1 row, or always for clarity)
                      rows.push(
                        <tr key={`sub-${customerLoanId}`} style={{ background: "#fef2f2", borderBottom: "2px solid #fca5a5", borderTop: "1px solid #fca5a5" }}>
                          <td colSpan={2} style={{ padding: "0.45rem 0.75rem", fontSize: "0.7rem", fontWeight: 800, color: "#991b1b", fontStyle: "italic" }}>
                            Jumla — {customerName}
                          </td>
                          <td style={{ padding: "0.45rem 0.75rem", fontWeight: 800, color: "#102a43", fontSize: "0.75rem", textAlign: "right", whiteSpace: "nowrap" }}>{fmt(subtotalAmount)}</td>
                          <td style={{ padding: "0.45rem 0.75rem", fontWeight: 800, color: "#dc2626", fontSize: "0.75rem", textAlign: "right", whiteSpace: "nowrap" }}>{fmt(subtotalPenalty)}</td>
                          <td style={{ padding: "0.45rem 0.75rem", fontWeight: 900, color: "#7f1d1d", fontSize: "0.78rem", textAlign: "right", whiteSpace: "nowrap", background: "#fee2e2", borderRadius: 4 }}>{fmt(subtotalTotal)}</td>
                          <td />
                        </tr>
                      );

                      i = j;
                    }
                    return rows;
                  })()}
                  {overdueList.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: "2.5rem 1rem", color: "#94a3b8", fontWeight: 600, fontSize: "0.82rem" }}>{t("empty.noOverduePayments")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>



        {/* ─── TABLE SECTION ─── */}

        <div style={{ background: "white", borderRadius: 14, boxShadow: "0 2px 16px rgba(15,23,42,0.09)", border: "1px solid #e2e8f0", borderTopWidth: 4, borderTopColor: "#4f46e5", overflow: "hidden" }}>

          {/* SINGLE TOOLBAR ROW — tabs + search + filter + actions */}
          <div style={{ padding: "0.85rem 1.25rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", borderBottom: "1px solid #f1f5f9" }}>

            {/* Tabs */}
            <div style={{ display: "flex", background: "#f1f5f9", padding: 3, borderRadius: 10, gap: 3, flexShrink: 0 }}>
              {([["active", t("tabs.activeLoans"), activeLoans.length, "#4f46e5", "#eef2ff"], ["completed", t("tabs.completed"), completedLoans.length, "#059669", "#ecfdf5"]] as const).map(([key, label, count, color, bg]) => {
                const isActive = activeTab === key;
                return (
                  <button key={key} onClick={() => setActiveTab(key)}
                    style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.38rem 0.9rem", borderRadius: 8, border: "none", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", transition: "all 0.18s",
                      background: isActive ? "white" : "transparent",
                      color: isActive ? color : "#64748b",
                      boxShadow: isActive ? "0 1px 6px rgba(15,23,42,0.12)" : "none" }}>
                    {isActive ? (key === "active" ? <Clock size={13}/> : <CheckCircle2 size={13}/>) : null}
                    {label}
                    <span style={{ background: isActive ? bg : "#e2e8f0", color: isActive ? color : "#94a3b8", padding: "1px 8px", borderRadius: 20, fontSize: "0.62rem", fontWeight: 800, whiteSpace: "nowrap" }}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div style={{ position: "relative", flex: "1 1 160px", maxWidth: 240 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("filters.searchClient")}
                style={{ width: "100%", padding: "0.42rem 0.8rem 0.42rem 2.1rem", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#f8fafc", outline: "none", fontWeight: 600, fontSize: "0.78rem", color: "#1e293b" }} />
            </div>

            {/* Filter */}
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowFilterMenu(v => !v)}
                style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.42rem 0.9rem", borderRadius: 8, background: filterStatus !== "all" ? "#eef2ff" : "white", border: filterStatus !== "all" ? "1.5px solid #6366f1" : "1.5px solid #e2e8f0", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", color: filterStatus !== "all" ? "#4f46e5" : "#64748b" }}>
                <Filter size={14} /> {t("filters.filter")}{filterStatus !== "all" ? ` · ${filterStatus}` : ""}
              </button>
              {showFilterMenu && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: "white", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 8px 24px rgba(15,23,42,0.12)", zIndex: 200, minWidth: 160, overflow: "hidden" }}>
                  {(["all", "current", "overdue", "pending"] as const).map((s) => (
                    <button key={s} onClick={() => { setFilterStatus(s); setShowFilterMenu(false); }}
                      style={{ display: "block", width: "100%", padding: "0.6rem 1rem", background: filterStatus === s ? "#eef2ff" : "white", border: "none", textAlign: "left", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", color: filterStatus === s ? "#4f46e5" : "#475569" }}>
                      {s === "all" ? "All Statuses" : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Refresh + Export */}
            <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", flexShrink: 0 }}>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={loadData}
                style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.42rem 0.9rem", borderRadius: 8, background: "white", border: "1.5px solid #e2e8f0", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", color: "#475569" }}>
                <RefreshCw size={14} className={loading ? "rt-spin" : ""} /> {t("actions.refresh")}
              </motion.button>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={exportCsv}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.42rem 1.1rem", borderRadius: 8, background: "linear-gradient(135deg,#4f46e5,#6366f1)", border: "none", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", color: "white", boxShadow: "0 4px 12px rgba(99,102,241,0.35)" }}>
                <ArrowUpRight size={14} /> {t("actions.export")}
              </motion.button>
            </div>
          </div>

          {/* TABLE */}
          <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 420 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: 780 }}>

              <colgroup>
                <col style={{ width: "3%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "11%" }} />
              </colgroup>

              <thead>
                <tr style={{ background: "#f8f9ff", position: "sticky", top: 0, zIndex: 1 }}>
                  {[t("table.number"), t("table.clientIdentity"), t("scheduleModal.installment"), t("table.dueDate"), t("table.principal"), t("scheduleModal.interest"), "TOTAL BALANCE", t("table.status"), "SMS", t("table.management")].map((h, i) => (
                    <th key={h} style={{ textAlign: i === 9 ? "right" : i >= 4 && i <= 6 ? "right" : "left", padding: "0.7rem 0.6rem", fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4f46e5", borderBottom: "2px solid #e0e7ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h}</th>
                  ))}
                </tr>
              </thead>

              <tbody>

                <AnimatePresence mode="popLayout">

                  {currentLoans.map((loan, idx) => {

                    return (

                      <motion.tr key={loan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: idx * 0.04 }}
                        style={{ background: idx % 2 === 0 ? "white" : "#fafbff", borderBottom: "1px solid #f1f5f9", cursor: "default" }}>

                        <td style={{ padding: "0.85rem 0.6rem", fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8" }}>{(idx + 1).toString().padStart(2, "0")}</td>

                        <td style={{ padding: "0.85rem 0.6rem", overflow: "hidden" }}>
                          <p style={{ fontWeight: 800, color: "#0f172a", margin: 0, fontSize: "0.82rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loan.name}</p>
                          <p style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", color: "#4f46e5", margin: 0, letterSpacing: "0.04em" }}>{t("table.loanNumberFormat", { id: loan.id })}</p>
                        </td>

                        <td style={{ padding: "0.85rem 0.6rem" }}>
                          <span style={{ background: "#eef2ff", color: "#4f46e5", fontWeight: 800, fontSize: "0.72rem", padding: "3px 10px", borderRadius: 20 }}>
                            {loan.next_installment ? `#${loan.next_installment.installment_number}` : "—"}
                          </span>
                        </td>

                        <td style={{ padding: "0.85rem 0.6rem", fontSize: "0.76rem", color: "#475569", fontWeight: 600, whiteSpace: "nowrap" }}>
                          {loan.next_installment?.due_date ? new Date(loan.next_installment.due_date).toLocaleDateString("en-GB") : "—"}
                        </td>

                        <td style={{ padding: "0.85rem 0.6rem", textAlign: "right", fontWeight: 700, color: "#102a43", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                          {loan.next_installment ? fmt(loan.next_installment.principal_amount) : "—"}
                        </td>

                        <td style={{ padding: "0.85rem 0.6rem", textAlign: "right", fontWeight: 700, color: "#92701a", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                          {loan.next_installment ? fmt(loan.next_installment.interest_amount) : "—"}
                        </td>

                        <td style={{ padding: "0.85rem 0.6rem", textAlign: "right", fontWeight: 900, color: "#0f172a", fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                          {fmt(loan.remaining_balance)}
                        </td>

                        <td style={{ padding: "0.85rem 0.6rem" }}>
                          {(() => {
                            const instStatus = loan.next_installment?.status ?? (loan.payment_status === "completed" ? "paid" : loan.payment_status || "current");
                            const cfg: Record<string, [string, string]> = {
                              paid:    ["#ecfdf5", "#059669"],
                              overdue: ["#fef2f2", "#dc2626"],
                              current: ["#eff6ff", "#1d4ed8"],
                              pending: ["#eef2ff", "#4f46e5"],
                            };
                            const [bg, fg] = cfg[instStatus] ?? ["#f1f5f9", "#64748b"];
                            return (
                              <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", background: bg, color: fg }}>
                                {t(`status.${instStatus}`, { defaultValue: instStatus })}
                              </span>
                            );
                          })()}
                        </td>

                        <td style={{ padding: "0.85rem 0.6rem" }}>
                          <SmsStatusBadge status={loan.sms_status} type={loan.sms_type} />
                        </td>

                        <td style={{ padding: "0.85rem 0.6rem", textAlign: "right" }}>

                          <div style={{ position: "relative", display: "inline-block" }} data-rt-dropdown>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (openRowDropdown === loan.id) {
                                  setOpenRowDropdown(null);
                                  setDropdownPos(null);
                                } else {
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  const DROPDOWN_HEIGHT = 140; // approx height of all items
                                  const spaceBelow = window.innerHeight - rect.bottom;
                                  if (spaceBelow < DROPDOWN_HEIGHT) {
                                    setDropdownPos({ bottom: window.innerHeight - rect.top + 6, right: window.innerWidth - rect.right });
                                  } else {
                                    setDropdownPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                                  }
                                  setOpenRowDropdown(loan.id);
                                }
                              }}
                              style={{ padding: "0.38rem 0.65rem", borderRadius: 8, background: "#eef2ff", border: "1px solid #c7d2fe", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#4f46e5", fontWeight: 700, fontSize: "0.65rem" }}
                            >
                              <Eye size={14} />
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                            </button>

                            {openRowDropdown === loan.id && dropdownPos && (
                              <div style={{ position: "fixed", top: dropdownPos.top, bottom: dropdownPos.bottom, right: dropdownPos.right, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10, boxShadow: "0 8px 24px -6px rgba(0,0,0,0.15)", zIndex: 9999, minWidth: 160, overflow: "hidden" }}>

                                {activeTab === "active" && (
                                  <button
                                    disabled={!canCollect}
                                    onClick={canCollect ? () => {
                                      const due = loan.next_installment ? Math.min(loan.next_installment.total_amount, loan.remaining_balance) : loan.remaining_balance;
                                      setSelectedLoan(loan);
                                      setRepaymentAmount(due > 0 ? String(due) : "");
                                      setTransactionId(""); setReceivedBy(""); setNotes("");
                                      setPaymentDate(new Date().toISOString().split("T")[0]);
                                      setShowRepaymentModal(true);
                                      setOpenRowDropdown(null);
                                    } : undefined}
                                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", background: "none", border: "none", borderBottom: "1px solid #f1f5f9", cursor: canCollect ? "pointer" : "not-allowed", fontSize: "0.75rem", fontWeight: 700, color: canCollect ? "#4f46e5" : "#94a3b8", textAlign: "left", opacity: canCollect ? 1 : 0.5 }}
                                  >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                                    {t("actions.addPayment")}
                                  </button>
                                )}

                                <button
                                  onClick={() => { viewSchedule(loan.id); setOpenRowDropdown(null); }}
                                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", fontWeight: 700, color: "#374151", textAlign: "left", borderBottom: "1px solid #f1f5f9" }}
                                >
                                  <Eye size={13} />
                                  {t("actions.viewSchedule")}
                                </button>

                                {loan.customer_id && (
                                  <button
                                    onClick={() => { setOpenRowDropdown(null); window.location.href = `/customers/${loan.customer_id}/statement`; }}
                                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", background: "none", border: "none", borderBottom: "1px solid #f1f5f9", cursor: "pointer", fontSize: "0.75rem", fontWeight: 700, color: "#4f46e5", textAlign: "left" }}
                                  >
                                    📄 Taarifa ya Mteja
                                  </button>
                                )}

                                {['fully_paid', 'closed', 'completed'].includes(loan.status ?? loan.payment_status) && (
                                  <button
                                    onClick={() => { window.location.href = `/loans/${loan.id}/renew`; setOpenRowDropdown(null); }}
                                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", fontWeight: 700, color: "#059669", textAlign: "left" }}
                                  >
                                    🔄 Ongeza Mkopo Mpya
                                  </button>
                                )}

                              </div>
                            )}

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

                  <button onClick={submitRepayment} disabled={submittingRepayment} style={{ flex: 2, padding: "0.85rem", borderRadius: 14, background: submittingRepayment ? "#94a3b8" : "#6366f1", border: "none", fontWeight: 800, fontSize: "0.85rem", cursor: submittingRepayment ? "not-allowed" : "pointer", color: "white", boxShadow: submittingRepayment ? "none" : "0 6px 20px rgba(99,102,241,0.35)" }}>{submittingRepayment ? "Inatuma…" : t("actions.confirmPayment")}</button>

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

      {/* ── Guarantor SMS confirmation popup ─────────────────────────────── */}
      {reminderConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: "2rem 2rem 1.5rem", maxWidth: 360, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: "0.75rem" }}>📨</div>
            <h3 style={{ margin: "0 0 0.6rem", fontSize: "1rem", fontWeight: 800, color: "#1e293b" }}>Tuma SMS kwa Wadhamini</h3>
            <p style={{ margin: "0 0 1.5rem", fontSize: "0.88rem", color: "#475569", lineHeight: 1.5 }}>
              Unataka kutuma SMS kwenda kwa wadhamini wa <strong style={{ color: "#1e5fae" }}>{reminderConfirm.customer}</strong>?
            </p>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                onClick={() => setReminderConfirm(null)}
                style={{ flex: 1, padding: "0.75rem", borderRadius: 12, border: "1.5px solid #e2e8f0", background: "#f8fafc", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", color: "#64748b" }}
              >
                Hapana
              </button>
              <button
                onClick={confirmSendReminder}
                style={{ flex: 1, padding: "0.75rem", borderRadius: 12, border: "none", background: "#1e5fae", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", color: "#fff", boxShadow: "0 4px 14px rgba(30,95,174,0.35)" }}
              >
                Ndio, Tuma
              </button>
            </div>
          </div>
        </div>
      )}



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



