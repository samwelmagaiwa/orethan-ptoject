/**
 * Branch Weekly/Daily/Monthly Report
 * - Loan Officers & Branch Managers submit reports
 * - GM, MD, Admin view all reports with branch/period filters
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import {
  FileText, Plus, Printer, Eye, Trash2, ChevronLeft,
  CheckCircle, Filter, Users, TrendingUp,
  ClipboardList, DollarSign, Building2, X, SlidersHorizontal,
} from "lucide-react";
import { letterheadBlock, watermarkBlock, triggerPrint } from "../utils/printDoc";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
const fmtTZS = (n: any) => Number(n || 0).toLocaleString();
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("en-GB") : "—";

// Role → section label resolved at render time via t("roles.xxx")
const ROLE_KEYS = ["loan_officer","loan_manager","finance_officer","general_manager","managing_director","admin"] as const;

// ─── types ────────────────────────────────────────────────────────────────────
interface FinRow {
  date: string;
  mapato: string; mapato_maelezo: string;
  matumizi: string; matumizi_maelezo: string;
  mkopo: string; mkopo_maelezo: string;
  kutoka_benki: string; kwenda_benki: string;
}
interface OfficerRow { name: string; hadi_sasa: string; tegemeo: string; }
interface ExpectedLoan { customer_name: string; hatua: string; }
interface Operations {
  new_customers_inquired: string; customers_called: string;
  forms_issued: string; form_recipients: string[];
  loans_disbursed: string; site_visits: string;
  loans_in_progress: string; customers_waiting: string;
  customers_completing_forms: string; phone_reminders: string; sms_sent: string;
  notes: string;
}
interface Balances { cash: string; mobile: string; safe: string; }
interface ReportData {
  branch: string; department: string; section: string;
  report_type: "daily" | "weekly" | "monthly";
  period_start: string; period_end: string;
  operations: Operations;
  financials: FinRow[];
  balances: Balances;
  loan_officers: OfficerRow[];
  expected_loans: ExpectedLoan[];
}

// ─── config arrays for looping ────────────────────────────────────────────────
// Operation column keys — labels resolved via t("ops.fields.xxx") at render time
const OPS_COL1 = [
  { key: "new_customers_inquired", icon: "👥" },
  { key: "customers_called",       icon: "📞" },
  { key: "forms_issued",           icon: "📋" },
] as const;
const OPS_COL2 = [
  { key: "loans_disbursed",            icon: "💰" },
  { key: "loans_in_progress",          icon: "⚙️" },
  { key: "customers_waiting",          icon: "⏳" },
  { key: "customers_completing_forms", icon: "✏️" },
] as const;
const OPS_COL3 = [
  { key: "site_visits",     icon: "🏠" },
  { key: "phone_reminders", icon: "📲" },
  { key: "sms_sent",        icon: "💬" },
] as const;

const blankOps = (): Operations => ({
  new_customers_inquired:"", customers_called:"", forms_issued:"",
  form_recipients:[], loans_disbursed:"", site_visits:"",
  loans_in_progress:"", customers_waiting:"", customers_completing_forms:"",
  phone_reminders:"", sms_sent:"", notes:"",
});
const blankFin = (date: string): FinRow => ({
  date, mapato:"", mapato_maelezo:"", matumizi:"", matumizi_maelezo:"",
  mkopo:"", mkopo_maelezo:"", kutoka_benki:"", kwenda_benki:"",
});
const blankReport = (): ReportData => ({
  branch:"", department:"LOAN", section:"G.M na L.M",
  report_type:"weekly", period_start:"", period_end:"",
  operations: blankOps(),
  financials: [],
  balances:{ cash:"", mobile:"", safe:"" },
  loan_officers:[{ name:"", hadi_sasa:"", tegemeo:"" }],
  expected_loans:[{ customer_name:"", hatua:"" }],
});

// ─── date helpers ─────────────────────────────────────────────────────────────
function datesInRange(start: string, end: string): string[] {
  if (!start || !end) return [];
  const dates: string[] = [];
  const cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}
function weekStart(d: Date) { const c = new Date(d); const day = c.getDay(); c.setDate(c.getDate() - (day === 0 ? 6 : day - 1)); return c.toISOString().slice(0, 10); }
function weekEnd(s: string)  { const c = new Date(s); c.setDate(c.getDate() + 5); return c.toISOString().slice(0, 10); }
function monthStart(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; }
function monthEnd(d: Date)   { return new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().slice(0,10); }

// ─── styling constants ────────────────────────────────────────────────────────
const S = {
  sectionTitle: (color = "#102a43"): React.CSSProperties => ({
    fontSize: "11px", fontWeight: 800, textTransform: "uppercase" as const,
    letterSpacing: "1.5px", color, margin: "0 0 16px 0",
    paddingBottom: "10px", borderBottom: `2px solid ${color}20`,
    display: "flex", alignItems: "center", gap: "8px",
  }),
  col3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" } as React.CSSProperties,
  col: (last = false): React.CSSProperties => ({ padding: "10px 14px", borderRight: last ? "none" : "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "8px" }),
  field: { display: "flex", flexDirection: "column" as const, gap: "3px" },
  label: { fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.8px" },
  input: { padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "13px", fontWeight: 600, color: "#0f172a", outline: "none", background: "#fff" } as React.CSSProperties,
  numInput: { padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "13px", fontWeight: 800, color: "#0f172a", outline: "none", background: "#f8fafc", textAlign: "right" as const },
  secPanel: (last = false): React.CSSProperties => ({
    padding: "16px 22px",
    borderBottom: last ? "none" : "2px solid #f1f5f9",
    background: "#fff",
  }),
};

// ─── main component ───────────────────────────────────────────────────────────
const DEFAULT_PERMS = {
  submit:        ["loan_officer","loan_manager","finance_officer","general_manager","managing_director","admin"],
  view_all:      ["loan_manager","general_manager","managing_director","admin"],
  print:         ["loan_officer","loan_manager","finance_officer","general_manager","managing_director","admin"],
  approve:       ["loan_manager","admin"],
  delete:        ["admin"] as string[],
  skip_approval: [] as string[],  // roles whose submissions auto-approve (no LM step)
};

export default function BranchReport() {
  const { t } = useTranslation("branchReport");
  const [user]   = useState<any>(() => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } });
  const userRole = user?.role || "";

  // Dynamic permissions — read from localStorage (set by Sidebar on login)
  const brPerms = useMemo(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("branch_report_permissions") || "null");
      return raw ? { ...DEFAULT_PERMS, ...raw } : DEFAULT_PERMS;
    } catch { return DEFAULT_PERMS; }
  }, []);

  const hasPermission = (key: keyof typeof DEFAULT_PERMS) =>
    (brPerms[key] ?? []).includes(userRole);

  const canSubmit  = hasPermission("submit");
  const canView    = !!userRole; // nav access already gated by branch_report_roles in Sidebar
  const canViewAll = hasPermission("view_all");
  const canPrint   = hasPermission("print");
  const canApprove = hasPermission("approve");
  const canDelete  = hasPermission("delete");
  // Only loan_manager sees pending reports and can action them —
  // Admin/GM/MD only see already-approved reports (backend enforces same rule).
  const isLoanManager = userRole === "loan_manager";

  // Localised type labels — re-computed when language changes
  const typeLabels = useMemo(() => ({
    daily:   t("period.badgeLabels.daily"),
    weekly:  t("period.badgeLabels.weekly"),
    monthly: t("period.badgeLabels.monthly"),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [t]);

  const [tab, setTab]         = useState<"submit"|"view">(canSubmit ? "submit" : "view");
  const [form, setForm]       = useState<ReportData>(blankReport);
  const [submitting, setSub]  = useState(false);
  const [toast, setToast]     = useState<{msg:string;ok:boolean}|null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail]   = useState<any|null>(null);
  const [showFilterDrop, setShowFilterDrop] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  // auto-aggregate state
  const [dailySources, setDailySources] = useState<any[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  // validation errors
  const [errors, setErrors] = useState<Record<string,string>>({});
  // signature modals
  const [sigModal, setSigModal]     = useState<"submit"|"approve"|null>(null);
  const [sigPassword, setSigPassword] = useState("");
  const [sigLoading, setSigLoading]   = useState(false);
  const [sigError, setSigError]       = useState("");
  const [approveTarget, setApproveTarget] = useState<any>(null);
  // accounting GL snapshot pulled for reconciliation
  const [glSnapshot, setGlSnapshot] = useState<{
    daily: Record<string, { mapato:number; matumizi:number; mkopo:number; kutoka_benki:number; kwenda_benki:number }>;
    closing_cash: number; closing_bank: number;
  } | null>(null);
  const [loadingGL, setLoadingGL] = useState(false);

  // filters for view tab
  const [fBranch, setFBranch] = useState("");
  const [fType,   setFType]   = useState("");
  const [fFrom,   setFFrom]   = useState("");
  const [fTo,     setFTo]     = useState("");

  const showToast = (msg: string, ok = true) => { setToast({msg,ok}); setTimeout(() => setToast(null), 4000); };

  // fetch branch name from admin settings + seed form defaults from logged-in user
  useEffect(() => {
    const sehemu = ROLE_KEYS.includes(userRole as any) ? t(`roles.${userRole}`) : userRole;
    axios.get(`${API}/loan-settings`).then(res => {
      const s = res.data?.data || res.data || {};
      const branch = s.company_branch || s.company_name || "";
      setForm(f => ({ ...f, branch, section: sehemu }));
    }).catch(() => {
      setForm(f => ({ ...f, section: sehemu }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, t]);

  // close filter dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilterDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // auto-generate financial rows when period changes
  useEffect(() => {
    const dates = datesInRange(form.period_start, form.period_end);
    if (dates.length === 0) { setForm(f => ({ ...f, financials: [] })); return; }
    setForm(f => {
      const existing: Record<string,FinRow> = {};
      f.financials.forEach(r => { existing[r.date] = r; });
      return { ...f, financials: dates.map(d => existing[d] ?? blankFin(d)) };
    });
  }, [form.period_start, form.period_end]);

  // fetch available daily reports when weekly/monthly period is selected
  useEffect(() => {
    if (form.report_type === "daily" || !form.period_start || !form.period_end) {
      setDailySources([]);
      return;
    }
    setLoadingSources(true);
    axios.get(`${API}/branch-reports`, {
      params: { type: "daily", date_from: form.period_start, date_to: form.period_end },
    }).then(res => {
      const sources = res.data.data?.data ?? res.data.data ?? [];
      setDailySources(sources);
      if (sources.length > 0) generateFromSources(sources);
    }).catch(() => setDailySources([]))
      .finally(() => setLoadingSources(false));
  }, [form.report_type, form.period_start, form.period_end]);

  // aggregate daily reports into the weekly/monthly form
  // accepts sources directly so it can be called from the fetch callback (auto) or manually
  const generateFromSources = (sources: any[]) => {
    if (!sources.length) return;

    const OPS_NUM_KEYS: (keyof Operations)[] = [
      "new_customers_inquired","customers_called","forms_issued",
      "loans_disbursed","site_visits","loans_in_progress",
      "customers_waiting","customers_completing_forms","phone_reminders","sms_sent",
    ];
    // ── 1. Operations: sum all numeric fields across daily sources ──
    const aggOps = blankOps();
    const recipientSet = new Set<string>();
    const notesParts: string[] = [];
    sources.forEach(r => {
      const ops: Operations = r.operations || blankOps();
      OPS_NUM_KEYS.forEach(k => {
        (aggOps as any)[k] = String(Number((aggOps as any)[k] || 0) + Number((ops as any)[k] || 0));
      });
      (ops.form_recipients || []).forEach((n: string) => { if (n.trim()) recipientSet.add(n.trim()); });
      if (ops.notes?.trim()) notesParts.push(ops.notes.trim());
    });
    aggOps.form_recipients = Array.from(recipientSet);
    aggOps.notes = notesParts.join(" | ");

    // ── 2. Financials: map each daily report's rows by date ──
    const finByDate: Record<string, FinRow> = {};
    sources.forEach(r => {
      (r.financials || []).forEach((row: FinRow) => {
        if (row.date) finByDate[row.date] = { ...row };
      });
    });

    // ── 3. Balances: take from the latest daily report ──
    const sorted = [...sources].sort(
      (a, b) => new Date(b.period_end || b.period_start).getTime() - new Date(a.period_end || a.period_start).getTime()
    );
    const latestBal: Balances = sorted[0]?.balances || { cash:"", mobile:"", safe:"" };

    // ── 4. Loan officers: merge by name, sum amounts ──
    const officerMap: Record<string, OfficerRow> = {};
    sources.forEach(r => {
      (r.loan_officers || []).forEach((o: OfficerRow) => {
        if (!o.name?.trim()) return;
        const key = o.name.trim();
        if (!officerMap[key]) officerMap[key] = { name: key, hadi_sasa: "0", tegemeo: "0" };
        officerMap[key].hadi_sasa = String(Number(officerMap[key].hadi_sasa) + Number(o.hadi_sasa || 0));
        officerMap[key].tegemeo   = String(Number(officerMap[key].tegemeo)   + Number(o.tegemeo   || 0));
      });
    });
    const loan_officers = Object.values(officerMap);
    if (!loan_officers.length) loan_officers.push({ name:"", hadi_sasa:"", tegemeo:"" });

    // ── 5. Expected loans: merge unique by customer name ──
    const expMap: Record<string, ExpectedLoan> = {};
    sources.forEach(r => {
      (r.expected_loans || []).forEach((e: ExpectedLoan) => {
        if (e.customer_name?.trim()) expMap[e.customer_name.trim()] = e;
      });
    });
    const expected_loans = Object.values(expMap);
    if (!expected_loans.length) expected_loans.push({ customer_name:"", hatua:"" });

    setForm(f => ({
      ...f,
      operations: aggOps,
      balances: latestBal,
      loan_officers,
      expected_loans,
      financials: f.financials.map(row => finByDate[row.date] ? { ...finByDate[row.date] } : row),
    }));

    showToast(t("toast.autoGenSuccess", { count: sources.length }));
  };

  // keep the manual button wired to whatever was last fetched
  const autoGenerate = () => generateFromSources(dailySources);

  const handleTypeChange = (type: "daily"|"weekly"|"monthly") => {
    const today = new Date();
    let start = "", end = "";
    if (type === "daily")   { start = today.toISOString().slice(0,10); end = start; }
    if (type === "weekly")  { start = weekStart(today); end = weekEnd(start); }
    if (type === "monthly") { start = monthStart(today); end = monthEnd(today); }
    setForm(f => ({ ...f, report_type: type, period_start: start, period_end: end }));
    setShowFilterDrop(false);
  };
  const handleStartChange = (s: string) => {
    let end = s;
    if (form.report_type === "weekly")  end = weekEnd(s);
    if (form.report_type === "monthly") end = monthEnd(new Date(s));
    setForm(f => ({ ...f, period_start: s, period_end: end }));
  };

  const clearErr = (key: string) =>
    setErrors(er => { const { [key]: _, ...rest } = er; return rest; });

  const setOps = (key: keyof Operations, val: string) => {
    setForm(f => ({ ...f, operations: { ...f.operations, [key]: val } }));
    clearErr("ops");
  };
  const setFin = (idx: number, key: keyof FinRow, val: string) => {
    setForm(f => { const rows = [...f.financials]; rows[idx] = { ...rows[idx], [key]: val }; return { ...f, financials: rows }; });
    clearErr("financials");
  };
  const setOfficer = (idx: number, key: keyof OfficerRow, val: string) =>
    setForm(f => { const arr = [...f.loan_officers]; arr[idx] = { ...arr[idx], [key]: val }; return { ...f, loan_officers: arr }; });
  const setExpected = (idx: number, key: keyof ExpectedLoan, val: string) =>
    setForm(f => { const arr = [...f.expected_loans]; arr[idx] = { ...arr[idx], [key]: val }; return { ...f, expected_loans: arr }; });
  const addRecipient = () => setForm(f => ({ ...f, operations: { ...f.operations, form_recipients: [...f.operations.form_recipients, ""] } }));
  const setRecipient = (i: number, v: string) => setForm(f => { const arr = [...f.operations.form_recipients]; arr[i] = v; return { ...f, operations: { ...f.operations, form_recipients: arr } }; });
  const removeRecipient = (i: number) => setForm(f => { const arr = f.operations.form_recipients.filter((_,j) => j !== i); return { ...f, operations: { ...f.operations, form_recipients: arr } }; });

  // ── Pull financial data from the General Ledger ──────────────────────────
  const pullFromAccounting = async () => {
    if (!form.period_start || !form.period_end) {
      showToast(t("toast.periodRequired"), false);
      return;
    }
    setLoadingGL(true);
    try {
      const res = await axios.get(`${API}/accounting/branch-summary`, {
        params: { from: form.period_start, to: form.period_end },
      });
      const snap = res.data?.data ?? res.data;
      setGlSnapshot(snap);

      // Pre-fill financial rows where GL has data for that date
      setForm(f => ({
        ...f,
        financials: f.financials.map(row => {
          const gl = snap.daily?.[row.date];
          if (!gl) return row;
          return {
            ...row,
            mapato:       row.mapato       || String(gl.mapato       || ""),
            matumizi:     row.matumizi     || String(gl.matumizi     || ""),
            mkopo:        row.mkopo        || String(gl.mkopo        || ""),
            kutoka_benki: row.kutoka_benki || String(gl.kutoka_benki || ""),
            kwenda_benki: row.kwenda_benki || String(gl.kwenda_benki || ""),
          };
        }),
        // Pre-fill closing cash balance only if not already entered
        balances: {
          ...f.balances,
          cash: f.balances.cash || (snap.closing_cash ? String(snap.closing_cash) : f.balances.cash),
        },
      }));

      showToast(t("toast.glSuccess"));
    } catch {
      showToast(t("toast.glError"), false);
    } finally {
      setLoadingGL(false);
    }
  };

  const validate = (): Record<string,string> => {
    const e: Record<string,string> = {};

    // Period
    if (!form.period_start) e.period = t("validate.periodRequired");
    else if (!form.period_end)   e.period = t("validate.periodEndRequired");
    else if (form.period_end < form.period_start) e.period = t("validate.periodEndBeforeStart");

    // Branch / meta
    if (!form.branch.trim())     e.branch     = t("validate.branchRequired");
    if (!form.department.trim()) e.department = t("validate.departmentRequired");

    // Financial: at least one row must have some data entered
    const hasFinData = form.financials.some(r =>
      Number(r.mapato||0) || Number(r.matumizi||0) || Number(r.mkopo||0) ||
      Number(r.kutoka_benki||0) || Number(r.kwenda_benki||0)
    );
    if (form.financials.length > 0 && !hasFinData)
      e.financials = t("validate.financialsRequired");

    // Balances: if any balance filled, all should be filled
    const b = form.balances;
    const anyBal = Number(b.cash||0) || Number(b.mobile||0) || Number(b.safe||0);
    if (anyBal) {
      if (!b.cash.trim())   e.bal_cash   = t("validate.balanceCash");
      if (!b.mobile.trim()) e.bal_mobile = t("validate.balanceMobile");
      if (!b.safe.trim())   e.bal_safe   = t("validate.balanceSafe");
    }

    // Loan officers: any row with data must have a name
    form.loan_officers.forEach((o, i) => {
      if ((o.hadi_sasa || o.tegemeo) && !o.name.trim())
        e[`officer_${i}`] = t("validate.officerName");
    });

    // Expected loans: any row must have a customer name
    form.expected_loans.forEach((ex, i) => {
      if (ex.hatua && !ex.customer_name.trim())
        e[`loan_${i}`] = t("validate.loanCustomer");
    });

    // Operations: warn if ALL numeric ops are zero
    const OPS_NUM: (keyof Operations)[] = [
      "new_customers_inquired","customers_called","forms_issued","loans_disbursed",
      "site_visits","loans_in_progress","customers_waiting","customers_completing_forms",
      "phone_reminders","sms_sent",
    ];
    const allOpsZero = OPS_NUM.every(k => !Number((form.operations as any)[k] || 0));
    if (allOpsZero) e.ops = t("validate.opsRequired");

    return e;
  };

  const handleSubmit = () => {
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      const first = document.querySelector("[data-err]");
      first?.scrollIntoView({ behavior:"smooth", block:"center" });
      showToast(t("toast.validationErrors", { count: Object.keys(errs).length }), false);
      return;
    }
    setErrors({});
    setSigPassword(""); setSigError("");
    setSigModal("submit");
  };

  const doSubmit = async () => {
    setSigLoading(true); setSigError("");
    try {
      await axios.post(`${API}/branch-reports`, { ...form, signature_password: sigPassword });
      showToast(t("toast.submitSuccess"));
      setForm(blankReport());
      setSigModal(null);
      setTab("view"); fetchReports();
    } catch { showToast(t("toast.submitError"), false); }
    finally { setSub(false); setSigLoading(false); }
  };

  const openApprove = (r: any) => {
    setApproveTarget(r); setSigPassword(""); setSigError("");
    setSigModal("approve");
  };

  const doApprove = async () => {
    if (!approveTarget) return;
    setSigLoading(true); setSigError("");
    try {
      const res = await axios.post(`${API}/branch-reports/${approveTarget.id}/approve`, { signature_password: sigPassword });
      showToast("✓ Ripoti imeidhinishwa na imewekwa kwa GM/MD/Admin");
      setSigModal(null);
      // update local list
      setReports(rs => rs.map(r => r.id === approveTarget.id ? res.data.data : r));
      if (detail?.id === approveTarget.id) setDetail(res.data.data);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Hitilafu — jaribu tena";
      setSigError(msg);
    } finally { setSigLoading(false); }
  };

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (fBranch) params.branch   = fBranch;
      if (fType)   params.type     = fType;
      if (fFrom)   params.date_from = fFrom;
      if (fTo)     params.date_to   = fTo;
      const res = await axios.get(`${API}/branch-reports`, { params });
      setReports(res.data.data?.data ?? res.data.data ?? []);
    } catch { showToast(t("toast.loadError"), false); }
    finally { setLoading(false); }
  }, [fBranch, fType, fFrom, fTo]);

  useEffect(() => { if (tab === "view") fetchReports(); }, [tab, fetchReports]);

  const deleteReport = async (id: number) => {
    if (!confirm(t("view.confirmDelete"))) return;
    await axios.delete(`${API}/branch-reports/${id}`);
    setReports(r => r.filter(x => x.id !== id));
    if (detail?.id === id) setDetail(null);
  };

  const finTotals = (rows: FinRow[]) => ({
    mapato:   rows.reduce((s,r) => s + Number(r.mapato||0), 0),
    matumizi: rows.reduce((s,r) => s + Number(r.matumizi||0), 0),
    mkopo:    rows.reduce((s,r) => s + Number(r.mkopo||0), 0),
    kutoka:   rows.reduce((s,r) => s + Number(r.kutoka_benki||0), 0),
    kwenda:   rows.reduce((s,r) => s + Number(r.kwenda_benki||0), 0),
  });

  // ── print ──────────────────────────────────────────────────────────────────
  const printReport = (r: any) => {
    const ops: Operations  = r.operations  || blankOps();
    const fins: FinRow[]   = r.financials  || [];
    const bal: Balances    = r.balances    || { cash:"", mobile:"", safe:"" };
    const officers: OfficerRow[]   = r.loan_officers  || [];
    const expected: ExpectedLoan[] = r.expected_loans || [];
    const tot = finTotals(fins);
    const totalBal = Number(bal.cash||0) + Number(bal.mobile||0) + Number(bal.safe||0);
    const typeLabel = { daily:"KILA SIKU", weekly:"WIKI", monthly:"MWEZI" }[r.report_type as string] || r.report_type;

    const secTitle = (n: number, t: string) => `
      <div style="display:flex;align-items:center;gap:10px;margin:18px 0 10px">
        <span style="width:24px;height:24px;border-radius:6px;background:#102a43;color:#fff;font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center">${n}</span>
        <span style="font-size:13px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#102a43">${t}</span>
        <span style="flex:1;height:2px;border-radius:2px;background:linear-gradient(90deg,#7cb342,rgba(29,138,209,0))"></span>
      </div>`;
    const opRow = (label: string, val: string) => val
      ? `<tr><td style="padding:5px 0;font-size:11.5px;color:#64748b;border-bottom:1px solid #f1f5f9;width:65%">${label}</td><td style="padding:5px 0;font-size:13px;font-weight:800;color:#0f172a;text-align:right;border-bottom:1px solid #f1f5f9">${val}</td></tr>`
      : "";

    const opsBlock = `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <div style="padding:12px;border-right:1px solid #e2e8f0">
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#7c3aed;margin-bottom:8px">Shughuli za Wateja</div>
          <table style="width:100%;border-collapse:collapse">
            ${opRow("Wateja Wapya Waliofika", ops.new_customers_inquired)}
            ${opRow("Wateja Waliopigiwa Simu", ops.customers_called)}
            ${opRow("Application Forms Zilizotolewa", ops.forms_issued)}
          </table>
          ${ops.form_recipients?.length ? `<div style="margin-top:6px;font-size:10px;color:#64748b;font-weight:600">Waliopewa Fomu:</div>${ops.form_recipients.map((n,i)=>`<div style="font-size:11px;color:#0f172a;font-weight:700">${String.fromCharCode(97+i)}) ${n}</div>`).join("")}` : ""}
        </div>
        <div style="padding:12px;border-right:1px solid #e2e8f0">
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#059669;margin-bottom:8px">Usimamizi wa Mikopo</div>
          <table style="width:100%;border-collapse:collapse">
            ${opRow("Mikopo Iliyotolewa", ops.loans_disbursed)}
            ${opRow("Mikopo Inayofanyanyiwa Kazi", ops.loans_in_progress)}
            ${opRow("Wateja Wanaosubiri", ops.customers_waiting)}
            ${opRow("Wanaokamilisha Fomu", ops.customers_completing_forms)}
            ${opRow("Visitation za Dhamana", ops.site_visits)}
          </table>
        </div>
        <div style="padding:12px">
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#f59e0b;margin-bottom:8px">Mawasiliano</div>
          <table style="width:100%;border-collapse:collapse">
            ${opRow("Simu za Ukumbushaji", ops.phone_reminders)}
            ${opRow("SMS Zilizotumwa", ops.sms_sent)}
          </table>
          ${ops.notes ? `<div style="margin-top:8px;font-size:10px;color:#64748b;font-style:italic">${ops.notes}</div>` : ""}
        </div>
      </div>`;

    const finTable = `
      <table style="width:100%;border-collapse:collapse;font-size:10.5px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:7px 8px;border:1px solid #e2e8f0;text-align:left;font-weight:800;color:#64748b;font-size:9px;text-transform:uppercase">Tarehe</th>
            <th style="padding:7px 8px;border:1px solid #e2e8f0;text-align:right;font-weight:800;color:#059669;font-size:9px;text-transform:uppercase">Mapato (TZS)</th>
            <th style="padding:7px 8px;border:1px solid #e2e8f0;text-align:left;font-weight:800;color:#059669;font-size:9px;text-transform:uppercase;opacity:0.7">Maelezo</th>
            <th style="padding:7px 8px;border:1px solid #e2e8f0;text-align:right;font-weight:800;color:#dc2626;font-size:9px;text-transform:uppercase">Matumizi (TZS)</th>
            <th style="padding:7px 8px;border:1px solid #e2e8f0;text-align:left;font-weight:800;color:#dc2626;font-size:9px;text-transform:uppercase;opacity:0.7">Maelezo</th>
            <th style="padding:7px 8px;border:1px solid #e2e8f0;text-align:right;font-weight:800;color:#7c3aed;font-size:9px;text-transform:uppercase">Mkopo Uliotolewa</th>
            <th style="padding:7px 8px;border:1px solid #e2e8f0;text-align:left;font-weight:800;color:#7c3aed;font-size:9px;text-transform:uppercase;opacity:0.7">Maelezo</th>
            <th style="padding:7px 8px;border:1px solid #e2e8f0;text-align:right;font-weight:800;color:#0ea5e9;font-size:9px;text-transform:uppercase">Kutoka Benki</th>
            <th style="padding:7px 8px;border:1px solid #e2e8f0;text-align:right;font-weight:800;color:#f59e0b;font-size:9px;text-transform:uppercase">Kwenda Benki</th>
          </tr>
        </thead>
        <tbody>
          ${fins.map(row => `
            <tr>
              <td style="padding:6px 8px;border:1px solid #f1f5f9;font-weight:700;color:#0f172a;white-space:nowrap">${fmtDate(row.date)}</td>
              <td style="padding:6px 8px;border:1px solid #f1f5f9;text-align:right;font-weight:600;color:#059669">${row.mapato ? fmtTZS(row.mapato) : "—"}</td>
              <td style="padding:6px 8px;border:1px solid #f1f5f9;font-size:10px;color:#64748b">${row.mapato_maelezo||""}</td>
              <td style="padding:6px 8px;border:1px solid #f1f5f9;text-align:right;font-weight:600;color:#dc2626">${row.matumizi ? fmtTZS(row.matumizi) : "—"}</td>
              <td style="padding:6px 8px;border:1px solid #f1f5f9;font-size:10px;color:#64748b">${row.matumizi_maelezo||""}</td>
              <td style="padding:6px 8px;border:1px solid #f1f5f9;text-align:right;font-weight:600;color:#7c3aed">${row.mkopo ? fmtTZS(row.mkopo) : "—"}</td>
              <td style="padding:6px 8px;border:1px solid #f1f5f9;font-size:10px;color:#64748b">${row.mkopo_maelezo||""}</td>
              <td style="padding:6px 8px;border:1px solid #f1f5f9;text-align:right;font-weight:600;color:#0ea5e9">${row.kutoka_benki ? fmtTZS(row.kutoka_benki) : "—"}</td>
              <td style="padding:6px 8px;border:1px solid #f1f5f9;text-align:right;font-weight:600;color:#f59e0b">${row.kwenda_benki ? fmtTZS(row.kwenda_benki) : "—"}</td>
            </tr>`).join("")}
          <tr style="background:#f0fdf4;font-weight:900">
            <td style="padding:8px;border:1px solid #e2e8f0;font-size:12px;color:#059669;font-weight:900">JUMLA</td>
            <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;color:#059669">${fmtTZS(tot.mapato)}</td>
            <td style="padding:8px;border:1px solid #e2e8f0"></td>
            <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;color:#dc2626">${fmtTZS(tot.matumizi)}</td>
            <td style="padding:8px;border:1px solid #e2e8f0"></td>
            <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;color:#7c3aed">${fmtTZS(tot.mkopo)}</td>
            <td style="padding:8px;border:1px solid #e2e8f0"></td>
            <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;color:#0ea5e9">${fmtTZS(tot.kutoka)}</td>
            <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;color:#f59e0b">${fmtTZS(tot.kwenda)}</td>
          </tr>
        </tbody>
      </table>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-top:10px">
        ${[
          { label:"CASH (TZS)",   val: bal.cash,   color:"#059669" },
          { label:"SIMU (TZS)",   val: bal.mobile, color:"#7c3aed" },
          { label:"SAFE (TZS)",   val: bal.safe,   color:"#f59e0b" },
          { label:"JUMLA BALANCE",val: String(totalBal), color:"#102a43" },
        ].map((b,i,arr) => `
          <div style="padding:12px 14px;background:${i===3?"#f0f9ff":"#fff"};border-right:${i<arr.length-1?"1px solid #e2e8f0":"none"}">
            <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#94a3b8">${b.label}</div>
            <div style="font-size:16px;font-weight:900;color:${b.color};margin-top:4px">${b.val ? fmtTZS(b.val) : "0"}/=</div>
          </div>`).join("")}
      </div>`;

    const officersTable = officers.some(o => o.name) ? `
      ${secTitle(3, "Idadi ya Wateja Waliochukua Mkopo Mwezi Huu")}
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#f8fafc">
          <th style="padding:8px;border:1px solid #e2e8f0;font-size:9.5px;font-weight:800;color:#64748b;text-transform:uppercase">#</th>
          <th style="padding:8px;border:1px solid #e2e8f0;font-size:9.5px;font-weight:800;color:#64748b;text-transform:uppercase;text-align:left">Afisa</th>
          <th style="padding:8px;border:1px solid #e2e8f0;font-size:9.5px;font-weight:800;color:#059669;text-transform:uppercase">Hadi Sasa</th>
          <th style="padding:8px;border:1px solid #e2e8f0;font-size:9.5px;font-weight:800;color:#7c3aed;text-transform:uppercase">Tegemeo</th>
        </tr></thead>
        <tbody>${officers.filter(o=>o.name).map((o,i) => `
          <tr>
            <td style="padding:7px 8px;border:1px solid #f1f5f9;text-align:center;font-weight:700">${i+1}</td>
            <td style="padding:7px 8px;border:1px solid #f1f5f9;font-weight:700;color:#0f172a">${o.name}</td>
            <td style="padding:7px 8px;border:1px solid #f1f5f9;text-align:center;font-weight:800;color:#059669">${o.hadi_sasa||"—"}</td>
            <td style="padding:7px 8px;border:1px solid #f1f5f9;text-align:center;font-weight:800;color:#7c3aed">${o.tegemeo||"—"}</td>
          </tr>`).join("")}
        </tbody>
      </table>` : "";

    const expectedTable = expected.some(e => e.customer_name) ? `
      ${secTitle(4, "Mikopo Tunayotegemea Kuwapatia Wateja")}
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#f8fafc">
          <th style="padding:8px;border:1px solid #e2e8f0;font-size:9.5px;font-weight:800;color:#64748b;text-transform:uppercase">#</th>
          <th style="padding:8px;border:1px solid #e2e8f0;font-size:9.5px;font-weight:800;color:#64748b;text-transform:uppercase;text-align:left">Jina la Mteja</th>
          <th style="padding:8px;border:1px solid #e2e8f0;font-size:9.5px;font-weight:800;color:#f59e0b;text-transform:uppercase;text-align:left">Hatua</th>
        </tr></thead>
        <tbody>${expected.filter(e=>e.customer_name).map((e,i) => `
          <tr>
            <td style="padding:7px 8px;border:1px solid #f1f5f9;text-align:center;font-weight:700">${i+1}</td>
            <td style="padding:7px 8px;border:1px solid #f1f5f9;font-weight:700;color:#0f172a">${e.customer_name}</td>
            <td style="padding:7px 8px;border:1px solid #f1f5f9;font-weight:600;color:#b45309">${e.hatua||"—"}</td>
          </tr>`).join("")}
        </tbody>
      </table>` : "";

    const body = `
      <div style="max-width:820px;margin:0 auto;color:#0f172a">
        <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2.5px solid #102a43;padding-bottom:12px">
          <div>
            <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#64748b;font-weight:700">IDARA: ${r.department} &nbsp;|&nbsp; SEHEMU: ${r.section}</div>
            <div style="font-size:22px;font-weight:800;color:#102a43;margin-top:4px">Ripoti ya ${typeLabel}</div>
            <div style="font-size:12px;color:#475569;font-weight:600;margin-top:2px">${fmtDate(r.period_start)} — ${fmtDate(r.period_end)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:10px;color:#94a3b8;font-weight:700">Tawi: ${r.branch || "—"}</div>
            <div style="font-size:10px;color:#94a3b8;margin-top:3px">Imeandikwa na: ${r.submitted_by_name || "—"}</div>
          </div>
        </div>
        ${secTitle(1,"Utendaji (Shughuli za Kipindi)")}
        ${opsBlock}
        ${secTitle(2,"Takwimu za Fedha (Kila Siku)")}
        ${finTable}
        ${officersTable}
        ${expectedTable}
        <div style="margin-top:32px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:36px">
          <div style="text-align:center">
            <div style="height:36px;display:flex;flex-direction:column;justify-content:flex-end;padding-bottom:4px">
              ${r.submitted_by_name ? `<div style="font-size:11px;font-weight:800;color:#0f172a">${r.submitted_by_name}</div>` : ""}
              ${r.lo_signed ? `<div style="font-size:9px;color:#059669;font-weight:700;margin-top:2px">✓ Amesaini</div>` : ""}
            </div>
            <div style="border-top:1.5px solid #0f172a;padding-top:8px;font-size:9.5px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1px">Imeandikwa na</div>
          </div>
          <div style="text-align:center">
            <div style="height:36px;display:flex;flex-direction:column;justify-content:flex-end;padding-bottom:4px">
              ${r.lm_signed && r.approved_by_name ? `<div style="font-size:11px;font-weight:800;color:#0f172a">${r.approved_by_name}</div>` : ""}
              ${r.lm_signed ? `<div style="font-size:9px;color:#059669;font-weight:700;margin-top:2px">✓ Amekagua</div>` : ""}
            </div>
            <div style="border-top:1.5px solid #0f172a;padding-top:8px;font-size:9.5px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1px">Imekaguliwa na</div>
          </div>
          <div style="text-align:center">
            <div style="height:36px;display:flex;flex-direction:column;justify-content:flex-end;padding-bottom:4px">
              ${r.approval_status === "approved" && r.approved_by_name ? `<div style="font-size:11px;font-weight:800;color:#0f172a">${r.approved_by_name}</div>` : ""}
              ${r.approved_at ? `<div style="font-size:9px;color:#059669;font-weight:700;margin-top:2px">✓ ${new Date(r.approved_at).toLocaleDateString("sw-TZ")}</div>` : r.approval_status === "pending" ? `<div style="font-size:9px;color:#f59e0b;font-weight:700">Inasubiri...</div>` : ""}
            </div>
            <div style="border-top:1.5px solid #0f172a;padding-top:8px;font-size:9.5px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1px">Imeidhinishwa na</div>
          </div>
        </div>
        <div style="margin-top:20px;text-align:center;font-size:9.5px;color:#94a3b8;border-top:1px dashed #e2e8f0;padding-top:12px;font-style:italic">
          Ripoti rasmi · ${r.branch || ""} · Tarehe iliyochapishwa: ${new Date().toLocaleString("sw-TZ")}
        </div>
      </div>`;

    const win = window.open("", "_blank", "width=950,height=1100");
    if (!win) return;
    win.document.write(`<html><head><title>Ripoti ya ${typeLabel}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;padding:32px 40px;background:#f8fafc;-webkit-print-color-adjust:exact;print-color-adjust:exact}@media print{body{padding:0;background:#fff}}</style></head><body>${watermarkBlock()}<div style="max-width:820px;margin:0 auto;position:relative;z-index:1">${letterheadBlock()}<div style="height:12px"></div>${body}</div></body></html>`);
    win.document.close();
    triggerPrint(win);
  };

  // ── FILTER DROPDOWN (in header) ────────────────────────────────────────────
  const typeLabel = typeLabels[form.report_type];
  const hasDateRange = form.period_start && form.period_end;
  const filterBadge = hasDateRange
    ? `${typeLabel} · ${fmtDate(form.period_start)}${form.report_type !== "daily" ? ` – ${fmtDate(form.period_end)}` : ""}`
    : typeLabel;

  // ── error message helper ───────────────────────────────────────────────────
  const Err = ({ k }: { k: string }) => errors[k]
    ? <div data-err style={{ fontSize:"10.5px", color:"#dc2626", fontWeight:700, marginTop:4, display:"flex", alignItems:"center", gap:4 }}>⚠ {errors[k]}</div>
    : null;

  const errBorder = (k: string): React.CSSProperties =>
    errors[k] ? { borderColor:"#fca5a5", background:"#fff5f5" } : {};

  // ── FORM TAB ───────────────────────────────────────────────────────────────
  const renderForm = () => {
    const ops = form.operations;
    const renderOpsCol = (fields: readonly {key: string; icon: string; label?: string}[], last = false) => (
      <div style={S.col(last)}>
        {fields.map(f => (
          <div key={f.key} style={S.field}>
            <label style={S.label}>{f.icon} {t(`ops.fields.${f.key}`)}</label>
            <input type="number" min="0" style={S.numInput}
              value={(ops as any)[f.key]}
              onChange={e => setOps(f.key as keyof Operations, e.target.value)}
              placeholder="0"
            />
          </div>
        ))}
      </div>
    );

    // financial table column defs with inline maelezo
    const finThStyle = (color: string, align: "left"|"right" = "right"): React.CSSProperties => ({
      padding:"10px 8px", border:"1px solid #e2e8f0", textAlign: align,
      fontSize:"9.5px", fontWeight:800, color, textTransform:"uppercase",
    });
    const finTdStyle = (isNote = false): React.CSSProperties => ({
      padding:"3px 5px", border:"1px solid #f1f5f9",
      ...(isNote ? { minWidth: 110 } : { minWidth: 100 }),
    });
    const finInput = (color = "#0f172a"): React.CSSProperties => ({
      width:"100%", padding:"5px 7px", border:"1px solid #e2e8f0",
      borderRadius:"5px", fontSize:"12px", fontWeight:700,
      textAlign:"right", outline:"none", background:"transparent", color,
    });
    const noteInput: React.CSSProperties = {
      width:"100%", padding:"5px 7px", border:"1px solid #e2e8f0",
      borderRadius:"5px", fontSize:"11px", fontWeight:500,
      outline:"none", background:"transparent", color:"#64748b",
    };

    // ── auto-aggregate banner label ──
    const typeWord = t(`autoGen.typeWords.${form.report_type}` as any, { defaultValue: form.report_type });

    return (
      <div style={{ maxWidth: 1380, margin: "0 auto", display: "flex", flexDirection: "column", gap: 0 }}>

        {/* AUTO-AGGREGATE BANNER — visible for weekly/monthly when daily reports exist */}
        {form.report_type !== "daily" && form.period_start && form.period_end && (
          <div style={{
            marginBottom: "16px",
            borderRadius: "12px",
            border: dailySources.length > 0 ? "1.5px solid #bbf7d0" : "1.5px solid #e2e8f0",
            background: dailySources.length > 0 ? "#f0fdf4" : "#f8fafc",
            padding: "14px 20px",
            display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap",
          }}>
            {loadingSources ? (
              <span style={{ fontSize:"13px", color:"#94a3b8", fontWeight:600 }}>🔍 Inatafuta ripoti za kila siku...</span>
            ) : dailySources.length > 0 ? (
              <>
                <span style={{ fontSize:"20px" }}>⚡</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:"13px", fontWeight:800, color:"#059669" }}>
                    {t("autoGen.foundTitle", { count: dailySources.length })}
                  </div>
                  <div style={{ fontSize:"11px", color:"#64748b", marginTop:"2px" }}>
                    {t("autoGen.foundSub", { type: typeWord })}
                  </div>
                </div>
                {/* loop: show pill per found daily report */}
                <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                  {dailySources.map((r: any, i: number) => (
                    <span key={i} style={{
                      background:"#dcfce7", color:"#166534", fontSize:"10px", fontWeight:700,
                      padding:"3px 9px", borderRadius:"20px", border:"1px solid #bbf7d0",
                    }}>
                      {fmtDate(r.period_start)}
                    </span>
                  ))}
                </div>
                <button onClick={autoGenerate} style={{
                  padding:"10px 22px", border:"none", borderRadius:"9px",
                  background:"linear-gradient(135deg,#059669,#047857)",
                  color:"#fff", fontSize:"13px", fontWeight:800, cursor:"pointer",
                  boxShadow:"0 3px 10px rgba(5,150,105,0.3)", whiteSpace:"nowrap",
                  display:"flex", alignItems:"center", gap:"7px",
                }}>
                  {t("autoGen.fillBtn")}
                </button>
              </>
            ) : (
              <>
                <span style={{ fontSize:"18px" }}>📭</span>
                <div>
                  <div style={{ fontSize:"13px", fontWeight:700, color:"#475569" }}>
                    {t("autoGen.noneTitle")}
                  </div>
                  <div style={{ fontSize:"11px", color:"#94a3b8", marginTop:"2px" }}>
                    {t("autoGen.noneSub", { type: typeWord })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* UNIFIED FORM CARD — all sections connected */}
        <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:"14px", overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,0.05)" }}>

          {/* META — auto-filled Tawi & Sehemu, editable Idara */}
          <div style={S.secPanel()}>
            <p style={S.sectionTitle("#102a43")}><FileText size={14} /> {t("meta.sectionTitle")}</p>
            {/* period error shown at top of card */}
            {errors.period && (
              <div data-err style={{ marginBottom:14, padding:"10px 14px", background:"#fef2f2", border:"1.5px solid #fca5a5", borderRadius:8, fontSize:"12px", color:"#dc2626", fontWeight:700, display:"flex", alignItems:"center", gap:8 }}>
                ⚠ {errors.period}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
              {/* Tawi — read-only for loan_officer (auto from config), editable for LM/Admin */}
              <div style={S.field}>
                <label style={S.label}>
                  <Building2 size={10} style={{display:"inline"}}/> {t("meta.branchLabel")}
                  {userRole !== "loan_officer" && <span style={{ color:"#dc2626" }}> *</span>}
                  {userRole === "loan_officer" && (
                    <span style={{ marginLeft:6, fontSize:"9px", fontWeight:600, color:"#94a3b8", background:"#f1f5f9", padding:"1px 6px", borderRadius:4 }}>AUTO</span>
                  )}
                </label>
                {userRole === "loan_officer" ? (
                  <div style={{ ...S.input, background:"#f8fafc", color: form.branch ? "#0f172a" : "#dc2626", display:"flex", alignItems:"center", gap:6, cursor:"not-allowed", minHeight:36 } as React.CSSProperties}>
                    <Building2 size={12} color="#94a3b8" />
                    <span style={{ fontWeight:700 }}>{form.branch || t("meta.branchMissing")}</span>
                  </div>
                ) : (
                  <input
                    type="text"
                    style={{ ...S.input, ...errBorder("branch") }}
                    value={form.branch}
                    placeholder={t("meta.branchPlaceholder")}
                    onChange={e => { setForm(f => ({ ...f, branch: e.target.value })); clearErr("branch"); }}
                  />
                )}
                <Err k="branch" />
              </div>
              {/* Idara — editable */}
              <div style={S.field}>
                <label style={S.label}>{t("meta.departmentLabel")} <span style={{ color:"#dc2626" }}>*</span></label>
                <input type="text" style={{...S.input, ...errBorder("department")}}
                  value={form.department}
                  onChange={e => { setForm(f => ({...f, department: e.target.value})); clearErr("department"); }} />
                <Err k="department" />
              </div>
              {/* Sehemu — read-only, from logged-in role */}
              <div style={S.field}>
                <label style={S.label}>{t("meta.sectionLabel")}</label>
                <div style={{ ...S.input, background:"#f8fafc", color:"#0f172a", fontWeight:700, display:"flex", alignItems:"center", minHeight:36 } as React.CSSProperties}>
                  {form.section || userRole}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 1: UTENDAJI */}
          <div style={S.secPanel()}>
            <p style={S.sectionTitle("#7c3aed")}><ClipboardList size={14} /> {t("ops.sectionTitle")}</p>
            {errors.ops && (
              <div data-err style={{ marginBottom:12, padding:"8px 14px", background:"#fef2f2", border:"1.5px solid #fca5a5", borderRadius:8, fontSize:"11.5px", color:"#dc2626", fontWeight:700 }}>
                ⚠ {errors.ops}
              </div>
            )}
            <div style={S.col3}>
              <div style={S.col()}>
                <p style={{ fontSize:"10px", fontWeight:800, color:"#7c3aed", textTransform:"uppercase", letterSpacing:"1px", margin:"0 0 8px 0", borderBottom:"1px solid #ede9fe", paddingBottom:"6px" }}>{t("ops.col1Title")}</p>
                {renderOpsCol(OPS_COL1)}
                <div style={S.field}>
                  <label style={S.label}>{t("ops.formRecipientsLabel")}</label>
                  {ops.form_recipients.map((name, i) => (
                    <div key={i} style={{ display:"flex", gap:"6px", marginTop:"4px" }}>
                      <input type="text" style={{...S.input, flex:1, fontSize:"12px"}}
                        placeholder={`${String.fromCharCode(97+i)}) Jina kamili...`}
                        value={name} onChange={e => setRecipient(i, e.target.value)} />
                      <button onClick={() => removeRecipient(i)} style={{ background:"#fee2e2", border:"none", borderRadius:"6px", padding:"0 8px", cursor:"pointer", color:"#dc2626" }}><X size={12}/></button>
                    </div>
                  ))}
                  <button onClick={addRecipient} style={{ marginTop:"6px", padding:"5px 10px", border:"1.5px dashed #c4b5fd", borderRadius:"8px", fontSize:"11px", fontWeight:700, color:"#7c3aed", background:"#faf5ff", cursor:"pointer" }}>{t("ops.addName")}</button>
                </div>
              </div>
              <div style={S.col()}>
                <p style={{ fontSize:"10px", fontWeight:800, color:"#059669", textTransform:"uppercase", letterSpacing:"1px", margin:"0 0 8px 0", borderBottom:"1px solid #d1fae5", paddingBottom:"6px" }}>{t("ops.col2Title")}</p>
                {renderOpsCol(OPS_COL2)}
              </div>
              <div style={S.col(true)}>
                <p style={{ fontSize:"10px", fontWeight:800, color:"#f59e0b", textTransform:"uppercase", letterSpacing:"1px", margin:"0 0 8px 0", borderBottom:"1px solid #fef3c7", paddingBottom:"6px" }}>{t("ops.col3Title")}</p>
                {renderOpsCol(OPS_COL3)}
                <div style={S.field}>
                  <label style={S.label}>{t("ops.notesLabel")}</label>
                  <textarea rows={4} style={{...S.input, resize:"vertical"} as React.CSSProperties}
                    placeholder={t("ops.notesPlaceholder")}
                    value={ops.notes} onChange={e => setOps("notes", e.target.value)} />
                </div>
              </div>
            </div>

            {/* SECTION 3 — placed directly below utendaji cols */}
            <div style={{ marginTop:"22px", borderTop:"2px solid #f1f5f9", paddingTop:"22px" }}>
              <p style={{ ...S.sectionTitle("#3b82f6"), margin:"0 0 12px 0" }}><Users size={14} /> 3. {t(`sec3.${form.report_type}`)}</p>
              <div style={{ borderRadius:"10px", border:"1px solid #e2e8f0", overflow:"hidden" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"13px" }}>
                  <thead>
                    <tr style={{ background:"#eff6ff" }}>
                      {[t("sec3.colNum"),t("sec3.colOfficer"),t("sec3.colToDate"),t("sec3.colExpected"),""].map((h,i) => (
                        <th key={i} style={{ padding:"9px 12px", border:"1px solid #e2e8f0", textAlign: i===0||i===2||i===3?"center":"left", fontSize:"10px", fontWeight:800, color:"#3b82f6", textTransform:"uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {form.loan_officers.map((o, idx) => (
                      <tr key={idx} style={{ background: idx%2===0?"#fff":"#f8faff" }}>
                        <td style={{ padding:"5px 8px", border:"1px solid #f1f5f9", textAlign:"center", fontWeight:700, color:"#94a3b8", fontSize:"12px" }}>{idx+1}</td>
                        <td style={{ padding:"3px 6px", border:"1px solid #f1f5f9" }}>
                          <input type="text" style={{...S.input, ...errBorder(`officer_${idx}`), width:"100%", fontSize:"12.5px", padding:"5px 8px"}} placeholder={t("sec3.officerPlaceholder")} value={o.name}
                            onChange={e => { setOfficer(idx,"name",e.target.value); clearErr(`officer_${idx}`); }} />
                          {errors[`officer_${idx}`] && <div data-err style={{ fontSize:"10px", color:"#dc2626", fontWeight:700, marginTop:2 }}>⚠ {errors[`officer_${idx}`]}</div>}
                        </td>
                        <td style={{ padding:"3px 6px", border:"1px solid #f1f5f9", width:110 }}>
                          <input type="number" min="0" style={{...S.numInput, width:"100%", fontSize:"13px", padding:"5px 8px"}} placeholder="0" value={o.hadi_sasa} onChange={e => setOfficer(idx,"hadi_sasa",e.target.value)} />
                        </td>
                        <td style={{ padding:"3px 6px", border:"1px solid #f1f5f9", width:110 }}>
                          <input type="number" min="0" style={{...S.numInput, width:"100%", fontSize:"13px", padding:"5px 8px"}} placeholder="0" value={o.tegemeo} onChange={e => setOfficer(idx,"tegemeo",e.target.value)} />
                        </td>
                        <td style={{ padding:"3px 8px", border:"1px solid #f1f5f9", width:36 }}>
                          <button onClick={() => setForm(f => ({...f, loan_officers: f.loan_officers.filter((_,j)=>j!==idx)}))}
                            style={{ background:"#fee2e2", border:"none", borderRadius:"6px", padding:"3px 6px", cursor:"pointer", color:"#dc2626" }}><Trash2 size={11}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={() => setForm(f => ({...f, loan_officers:[...f.loan_officers,{name:"",hadi_sasa:"",tegemeo:""}]}))}
                style={{ marginTop:"8px", padding:"6px 14px", border:"1.5px dashed #93c5fd", borderRadius:"8px", fontSize:"12px", fontWeight:700, color:"#3b82f6", background:"#eff6ff", cursor:"pointer" }}>
                {t("sec3.addOfficer")}
              </button>
            </div>

            {/* SECTION 4 — placed directly below section 3 */}
            <div style={{ marginTop:"20px", borderTop:"2px solid #f1f5f9", paddingTop:"20px" }}>
              <p style={{ ...S.sectionTitle("#f59e0b"), margin:"0 0 12px 0" }}><TrendingUp size={14} /> {t("sec4.sectionTitle")}</p>
              <div style={{ borderRadius:"10px", border:"1px solid #e2e8f0", overflow:"hidden" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"13px" }}>
                  <thead>
                    <tr style={{ background:"#fffbeb" }}>
                      {[t("sec4.colNum"),t("sec4.colCustomer"),t("sec4.colStage"),""].map((h,i) => (
                        <th key={i} style={{ padding:"9px 12px", border:"1px solid #e2e8f0", textAlign: i===0?"center":"left", fontSize:"10px", fontWeight:800, color:"#f59e0b", textTransform:"uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {form.expected_loans.map((e, idx) => (
                      <tr key={idx} style={{ background: idx%2===0?"#fff":"#fffdf5" }}>
                        <td style={{ padding:"5px 8px", border:"1px solid #f1f5f9", textAlign:"center", fontWeight:700, color:"#94a3b8", fontSize:"12px" }}>{idx+1}</td>
                        <td style={{ padding:"3px 6px", border:"1px solid #f1f5f9" }}>
                          <input type="text" style={{...S.input, ...errBorder(`loan_${idx}`), width:"100%", fontSize:"12.5px", padding:"5px 8px"}} placeholder={t("sec4.customerPlaceholder")} value={e.customer_name}
                            onChange={ev => { setExpected(idx,"customer_name",ev.target.value); clearErr(`loan_${idx}`); }} />
                          {errors[`loan_${idx}`] && <div data-err style={{ fontSize:"10px", color:"#dc2626", fontWeight:700, marginTop:2 }}>⚠ {errors[`loan_${idx}`]}</div>}
                        </td>
                        <td style={{ padding:"3px 6px", border:"1px solid #f1f5f9" }}>
                          <input type="text" style={{...S.input, width:"100%", fontSize:"12.5px", padding:"5px 8px"}} placeholder={t("sec4.stagePlaceholder")} value={e.hatua} onChange={ev => setExpected(idx,"hatua",ev.target.value)} />
                        </td>
                        <td style={{ padding:"3px 8px", border:"1px solid #f1f5f9", width:36 }}>
                          <button onClick={() => setForm(f => ({...f, expected_loans: f.expected_loans.filter((_,j)=>j!==idx)}))}
                            style={{ background:"#fee2e2", border:"none", borderRadius:"6px", padding:"3px 6px", cursor:"pointer", color:"#dc2626" }}><Trash2 size={11}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={() => setForm(f => ({...f, expected_loans:[...f.expected_loans,{customer_name:"",hatua:""}]}))}
                style={{ marginTop:"8px", padding:"6px 14px", border:"1.5px dashed #fcd34d", borderRadius:"8px", fontSize:"12px", fontWeight:700, color:"#b45309", background:"#fffbeb", cursor:"pointer" }}>
                {t("sec4.addCustomer")}
              </button>
            </div>
          </div>

          {/* SECTION 2: FINANCIAL TABLE */}
          <div style={S.secPanel(true)}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
              <p style={{ ...S.sectionTitle("#059669"), margin:0 }}><DollarSign size={14} /> {t("fin.sectionTitle")}</p>
              <button
                onClick={pullFromAccounting}
                disabled={loadingGL || !form.period_start}
                title="Vuta takwimu za mapato, matumizi na mikopo moja kwa moja kutoka kwenye mfumo wa hesabu (General Ledger)"
                style={{
                  display:"flex", alignItems:"center", gap:7,
                  padding:"8px 16px", border:"1.5px solid #059669",
                  borderRadius:"9px", fontSize:"12px", fontWeight:800,
                  color: loadingGL ? "#94a3b8" : "#059669",
                  background: loadingGL ? "#f8fafc" : "#f0fdf4",
                  cursor: loadingGL || !form.period_start ? "not-allowed" : "pointer",
                  transition:"all .15s",
                  whiteSpace:"nowrap",
                }}
              >
                {loadingGL ? t("fin.pulling") : t("fin.pullBtn")}
              </button>
            </div>
            {/* GL reconciliation info banner */}
            {glSnapshot && (
              <div style={{
                marginBottom:12, padding:"8px 14px", background:"#ecfdf5",
                border:"1.5px solid #6ee7b7", borderRadius:8,
                display:"flex", alignItems:"center", gap:10, fontSize:"11.5px", color:"#065f46",
              }}>
                <span>📊</span>
                <span><strong>{t("fin.glBannerText")}</strong> <span style={{ color:"#059669", fontWeight:800 }}>{t("fin.glBannerMatches")}</span> {t("fin.glBannerSuffix")}</span>
                <span style={{ marginLeft:"auto", fontWeight:700 }}>{t("fin.glClosingPrefix")} {fmtTZS(glSnapshot.closing_cash)} {t("fin.glClosingBank")} {fmtTZS(glSnapshot.closing_bank)}</span>
              </div>
            )}
            {errors.financials && (
              <div data-err style={{ marginBottom:12, padding:"8px 14px", background:"#fef2f2", border:"1.5px solid #fca5a5", borderRadius:8, fontSize:"11.5px", color:"#dc2626", fontWeight:700 }}>
                ⚠ {errors.financials}
              </div>
            )}
            {form.financials.length === 0
              ? (
                <div style={{ textAlign:"center", padding:"32px", color:"#94a3b8", fontSize:"13px", background:"#f8fafc", borderRadius:"10px", border:"1px dashed #e2e8f0" }}>
                  {t("fin.emptyState")}
                </div>
              ) : (
              <>
                <div style={{ overflowX:"auto", borderRadius:"10px", border:"1px solid #e2e8f0" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
                    <thead>
                      <tr style={{ background:"#f8fafc" }}>
                        <th style={{ ...finThStyle("#64748b","left"), minWidth:90 }}>{t("fin.colDate")}</th>
                        {glSnapshot && <th style={{ ...finThStyle("#059669","left"), minWidth:42, opacity:.7 }}>{t("fin.colGL")}</th>}
                        <th style={finThStyle("#059669")}>{t("fin.colMapato")}</th>
                        <th style={{ ...finThStyle("#059669","left"), opacity:.7, fontWeight:600 }}>{t("fin.colDesc")}</th>
                        <th style={finThStyle("#dc2626")}>{t("fin.colMatumizi")}</th>
                        <th style={{ ...finThStyle("#dc2626","left"), opacity:.7, fontWeight:600 }}>{t("fin.colDesc")}</th>
                        <th style={finThStyle("#7c3aed")}>{t("fin.colMkopo")}</th>
                        <th style={{ ...finThStyle("#7c3aed","left"), opacity:.7, fontWeight:600 }}>{t("fin.colDesc")}</th>
                        <th style={finThStyle("#0ea5e9")}>{t("fin.colKutoka")}</th>
                        <th style={finThStyle("#f59e0b")}>{t("fin.colKwenda")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.financials.map((row, idx) => (
                        <tr key={row.date} style={{ background: idx%2===0?"#fff":"#fafafa" }}>
                          <td style={{ padding:"7px 10px", border:"1px solid #f1f5f9", fontWeight:700, color:"#334155", whiteSpace:"nowrap", fontSize:"11.5px" }}>
                            {new Date(row.date).toLocaleDateString("sw-TZ", { weekday:"short", day:"2-digit", month:"2-digit" })}
                          </td>
                          {/* GL reconciliation badge */}
                          {glSnapshot && (() => {
                            const gl = glSnapshot.daily?.[row.date];
                            if (!gl) return (
                              <td style={{ padding:"4px 6px", border:"1px solid #f1f5f9", textAlign:"center" }}>
                                <span title="Hakuna data ya GL kwa siku hii" style={{ fontSize:"13px", color:"#cbd5e1" }}>—</span>
                              </td>
                            );
                            const matches =
                              Number(row.mapato||0) === gl.mapato &&
                              Number(row.matumizi||0) === gl.matumizi &&
                              Number(row.mkopo||0) === gl.mkopo;
                            return (
                              <td style={{ padding:"4px 6px", border:"1px solid #f1f5f9", textAlign:"center" }}>
                                <span title={matches ? t("fin.glMatchTitle") : `GL: ${t("fin.colMapato")} ${fmtTZS(gl.mapato)}, ${t("fin.colMatumizi")} ${fmtTZS(gl.matumizi)}, ${t("fin.colMkopo")} ${fmtTZS(gl.mkopo)}`}
                                  style={{ fontSize:"13px", cursor:"help" }}>
                                  {matches ? "✅" : "⚠️"}
                                </span>
                              </td>
                            );
                          })()}
                          {/* Mapato + Maelezo */}
                          <td style={finTdStyle()}>
                            <input type="number" min="0" style={finInput("#059669")} placeholder="0"
                              value={row.mapato} onChange={e => setFin(idx,"mapato",e.target.value)} />
                          </td>
                          <td style={finTdStyle(true)}>
                            <input type="text" style={noteInput} placeholder={t("fin.descPlaceholder")}
                              value={row.mapato_maelezo} onChange={e => setFin(idx,"mapato_maelezo",e.target.value)} />
                          </td>
                          {/* Matumizi + Maelezo */}
                          <td style={finTdStyle()}>
                            <input type="number" min="0" style={finInput("#dc2626")} placeholder="0"
                              value={row.matumizi} onChange={e => setFin(idx,"matumizi",e.target.value)} />
                          </td>
                          <td style={finTdStyle(true)}>
                            <input type="text" style={noteInput} placeholder={t("fin.descPlaceholder")}
                              value={row.matumizi_maelezo} onChange={e => setFin(idx,"matumizi_maelezo",e.target.value)} />
                          </td>
                          {/* Mkopo + Maelezo */}
                          <td style={finTdStyle()}>
                            <input type="number" min="0" style={finInput("#7c3aed")} placeholder="0"
                              value={row.mkopo} onChange={e => setFin(idx,"mkopo",e.target.value)} />
                          </td>
                          <td style={finTdStyle(true)}>
                            <input type="text" style={noteInput} placeholder={t("fin.descPlaceholder")}
                              value={row.mkopo_maelezo} onChange={e => setFin(idx,"mkopo_maelezo",e.target.value)} />
                          </td>
                          {/* Kutoka Benki */}
                          <td style={finTdStyle()}>
                            <input type="number" min="0" style={finInput("#0ea5e9")} placeholder="0"
                              value={row.kutoka_benki} onChange={e => setFin(idx,"kutoka_benki",e.target.value)} />
                          </td>
                          {/* Kwenda Benki */}
                          <td style={finTdStyle()}>
                            <input type="number" min="0" style={finInput("#f59e0b")} placeholder="0"
                              value={row.kwenda_benki} onChange={e => setFin(idx,"kwenda_benki",e.target.value)} />
                          </td>
                        </tr>
                      ))}
                      {/* Totals row */}
                      {(() => { const tot = finTotals(form.financials); return (
                        <tr style={{ background:"#f0fdf4" }}>
                          <td style={{ padding:"10px 12px", border:"1px solid #e2e8f0", fontWeight:900, fontSize:"12px", color:"#059669" }}>{t("fin.totalRow")}</td>
                          {glSnapshot && <td style={{ border:"1px solid #e2e8f0" }}></td>}
                          <td style={{ padding:"10px 8px", border:"1px solid #e2e8f0", textAlign:"right", fontWeight:900, color:"#059669", fontSize:"13px" }}>{fmtTZS(tot.mapato)}</td>
                          <td style={{ border:"1px solid #e2e8f0", background:"#f8fdf8" }}></td>
                          <td style={{ padding:"10px 8px", border:"1px solid #e2e8f0", textAlign:"right", fontWeight:900, color:"#dc2626", fontSize:"13px" }}>{fmtTZS(tot.matumizi)}</td>
                          <td style={{ border:"1px solid #e2e8f0", background:"#f8fdf8" }}></td>
                          <td style={{ padding:"10px 8px", border:"1px solid #e2e8f0", textAlign:"right", fontWeight:900, color:"#7c3aed", fontSize:"13px" }}>{fmtTZS(tot.mkopo)}</td>
                          <td style={{ border:"1px solid #e2e8f0", background:"#f8fdf8" }}></td>
                          <td style={{ padding:"10px 8px", border:"1px solid #e2e8f0", textAlign:"right", fontWeight:900, color:"#0ea5e9", fontSize:"13px" }}>{fmtTZS(tot.kutoka)}</td>
                          <td style={{ padding:"10px 8px", border:"1px solid #e2e8f0", textAlign:"right", fontWeight:900, color:"#f59e0b", fontSize:"13px" }}>{fmtTZS(tot.kwenda)}</td>
                        </tr>
                      ); })()}
                    </tbody>
                  </table>
                </div>

                {/* Balance — compact single row */}
                <div style={{ marginTop:"14px", display:"flex", alignItems:"center", gap:"0", border:"1px solid #e2e8f0", borderRadius:"10px", overflow:"hidden" }}>
                  <div style={{ padding:"10px 16px", background:"#f0f9ff", borderRight:"1px solid #e2e8f0", whiteSpace:"nowrap" }}>
                    <span style={{ fontSize:"10px", fontWeight:800, color:"#0ea5e9", textTransform:"uppercase", letterSpacing:"1px" }}>{t("fin.balanceTitle")}</span>
                  </div>
                  {([
                    { key:"cash",   label:t("fin.cashLabel"),   color:"#059669", errKey:"bal_cash"   },
                    { key:"mobile", label:t("fin.mobileLabel"), color:"#7c3aed", errKey:"bal_mobile" },
                    { key:"safe",   label:t("fin.safeLabel"),   color:"#f59e0b", errKey:"bal_safe"   },
                  ] as const).map((b) => (
                    <div key={b.key} style={{ flex:1, padding:"6px 12px", borderRight:"1px solid #e2e8f0", display:"flex", flexDirection:"column", gap:2, background: errors[b.errKey] ? "#fff5f5" : "transparent" }}>
                      <label style={{ ...S.label, fontSize:"9px", color: errors[b.errKey] ? "#dc2626" : "#94a3b8" }}>{b.label} (TZS){errors[b.errKey] ? " ⚠" : ""}</label>
                      <input type="number" min="0"
                        style={{ border:"none", outline:"none", background:"transparent", fontSize:"14px", fontWeight:800, color: errors[b.errKey] ? "#dc2626" : b.color, textAlign:"right", width:"100%", padding:0 }}
                        placeholder="0"
                        value={form.balances[b.key]}
                        onChange={e => { setForm(f => ({...f, balances:{...f.balances, [b.key]: e.target.value}})); clearErr(b.errKey); }} />
                    </div>
                  ))}
                  <div style={{ padding:"6px 18px", background:"#0ea5e910", display:"flex", flexDirection:"column", gap:2, alignItems:"flex-end", borderLeft:"1px solid #e2e8f0" }}>
                    <span style={{ fontSize:"9px", fontWeight:800, color:"#0ea5e9", textTransform:"uppercase", letterSpacing:"1px" }}>{t("fin.totalLabel")}</span>
                    <span style={{ fontSize:"16px", fontWeight:900, color:"#0f172a", whiteSpace:"nowrap" }}>
                      TZS {fmtTZS(Number(form.balances.cash||0)+Number(form.balances.mobile||0)+Number(form.balances.safe||0))}/=
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>

        {/* ERROR SUMMARY */}
        {Object.keys(errors).length > 0 && (
          <div style={{ marginTop:16, padding:"14px 20px", background:"#fef2f2", border:"1.5px solid #fca5a5", borderRadius:"12px" }}>
            <div style={{ fontSize:"12px", fontWeight:800, color:"#dc2626", marginBottom:8 }}>
              {t("submit.errorSummaryTitle", { count: Object.keys(errors).length })}
            </div>
            <ul style={{ margin:0, paddingLeft:18 }}>
              {Object.values(errors).map((msg, i) => (
                <li key={i} style={{ fontSize:"11.5px", color:"#b91c1c", fontWeight:600, marginBottom:3 }}>{msg}</li>
              ))}
            </ul>
          </div>
        )}

        {/* SUBMIT */}
        <div style={{ display:"flex", justifyContent:"flex-end", gap:"12px", paddingTop:"16px", paddingBottom:"40px" }}>
          <button onClick={() => { setForm(blankReport()); setErrors({}); }} style={{ padding:"12px 28px", border:"1.5px solid #e2e8f0", borderRadius:"10px", fontSize:"14px", fontWeight:700, color:"#64748b", background:"#fff", cursor:"pointer" }}>
            {t("submit.clearBtn")}
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            style={{ padding:"12px 40px", border:"none", borderRadius:"10px", fontSize:"14px", fontWeight:800, color:"#fff", background: submitting?"#94a3b8": Object.keys(errors).length ? "#dc2626" : "linear-gradient(135deg,#102a43,#1d3a5f)", cursor: submitting?"not-allowed":"pointer", boxShadow:"0 4px 14px rgba(16,42,67,0.3)", display:"flex", alignItems:"center", gap:8 }}>
            {submitting ? t("submit.submitting") : (
              <>
                {t("submit.submitBtn")}
                {Object.keys(errors).length > 0 && (
                  <span style={{ background:"rgba(255,255,255,0.3)", borderRadius:"20px", padding:"1px 8px", fontSize:"11px", fontWeight:900 }}>
                    {t("submit.errorsCount", { count: Object.keys(errors).length })}
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  // ── VIEW TAB ───────────────────────────────────────────────────────────────
  const renderView = () => {
    if (detail) return renderDetail(detail);
    return (
      <div style={{ maxWidth:1380, margin:"0 auto" }}>
        {/* Scope indicator for non-view-all users */}
        {!canViewAll && (
          <div style={{ marginBottom:12, padding:"8px 16px", background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:"8px", fontSize:"12px", fontWeight:600, color:"#1d4ed8", display:"flex", alignItems:"center", gap:8 }}>
            👤 Unaona ripoti zako tu — wasiliana na Meneja ili uone ripoti zote
          </div>
        )}
        {/* Filters */}
        <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:"12px", padding:"16px 22px", marginBottom:"20px", display:"flex", gap:"12px", alignItems:"flex-end", flexWrap:"wrap" }}>
          <Filter size={16} color="#64748b" style={{ marginBottom:2 }} />
          <div style={S.field}>
            <label style={S.label}>{t("view.filterType")}</label>
            <select style={{...S.input, minWidth:120}} value={fType} onChange={e => setFType(e.target.value)}>
              <option value="">{t("view.filterAll")}</option>
              <option value="daily">{t("period.badgeLabels.daily")}</option>
              <option value="weekly">{t("period.badgeLabels.weekly")}</option>
              <option value="monthly">{t("period.badgeLabels.monthly")}</option>
            </select>
          </div>
          {canViewAll && (
          <div style={S.field}>
            <label style={S.label}>{t("view.filterBranch")}</label>
            <input type="text" style={{...S.input, minWidth:140}} placeholder={t("view.filterBranchPlaceholder")} value={fBranch} onChange={e => setFBranch(e.target.value)} />
          </div>
          )}
          <div style={S.field}>
            <label style={S.label}>{t("view.filterFrom")}</label>
            <input type="date" style={S.input} value={fFrom} onChange={e => setFFrom(e.target.value)} />
          </div>
          <div style={S.field}>
            <label style={S.label}>{t("view.filterTo")}</label>
            <input type="date" style={S.input} value={fTo} onChange={e => setFTo(e.target.value)} />
          </div>
          <button onClick={fetchReports} style={{ padding:"8px 22px", border:"none", borderRadius:"8px", background:"#102a43", color:"#fff", fontSize:"12px", fontWeight:800, cursor:"pointer" }}>
            {t("view.searchBtn")}
          </button>
          <button onClick={() => { setFBranch(""); setFType(""); setFFrom(""); setFTo(""); }} style={{ padding:"8px 14px", border:"1px solid #e2e8f0", borderRadius:"8px", background:"#fff", color:"#64748b", fontSize:"12px", fontWeight:700, cursor:"pointer" }}>
            {t("view.clearBtn")}
          </button>
        </div>

        {loading
          ? <div style={{ textAlign:"center", padding:40, color:"#94a3b8" }}>{t("view.loading")}</div>
          : reports.length === 0
          ? <div style={{ textAlign:"center", padding:60, color:"#94a3b8", fontSize:14 }}>{t("view.empty")}</div>
          : (
          <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
            {reports.map((r: any) => {
              const tot = finTotals(r.financials || []);
              const typeColor = { daily:"#059669", weekly:"#7c3aed", monthly:"#0ea5e9" }[r.report_type as string] || "#64748b";
              const tLabel = typeLabels[r.report_type as keyof typeof typeLabels] || r.report_type;
              return (
                <div key={r.id} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:"12px", overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"10px", padding:"12px 18px", borderBottom:"1px solid #f1f5f9", background:"#f8fafc", flexWrap:"wrap" }}>
                    <span style={{ background:typeColor, color:"#fff", fontSize:"10px", fontWeight:800, padding:"3px 10px", borderRadius:"20px", textTransform:"uppercase", letterSpacing:"1px" }}>{tLabel}</span>
                    {/* Approval status badge */}
                    {r.approval_status === "approved"
                      ? <span style={{ background:"#dcfce7", color:"#15803d", fontSize:"10px", fontWeight:800, padding:"3px 9px", borderRadius:"20px", display:"flex", alignItems:"center", gap:"4px" }}>✅ Imeidhinishwa</span>
                      : <span style={{ background:"#fef9c3", color:"#854d0e", fontSize:"10px", fontWeight:800, padding:"3px 9px", borderRadius:"20px", display:"flex", alignItems:"center", gap:"4px" }}>⏳ Inasubiri LM</span>
                    }
                    <span style={{ fontWeight:800, color:"#0f172a", fontSize:"13px" }}>{fmtDate(r.period_start)} — {fmtDate(r.period_end)}</span>
                    <span style={{ fontSize:"12px", color:"#64748b", fontWeight:600 }}>{r.branch || t("view.branchMissing")}</span>
                    <span style={{ marginLeft:"auto", fontSize:"11px", color:"#94a3b8" }}>{t("view.submittedBy")} {r.submitted_by_name}</span>
                    <div style={{ display:"flex", gap:"8px" }}>
                      {/* LM/Admin approve button for pending reports */}
                      {canApprove && isLoanManager && r.approval_status === "pending" && (
                        <button onClick={() => openApprove(r)} style={{ background:"#f0fdf4", border:"1.5px solid #86efac", borderRadius:"8px", padding:"6px 14px", cursor:"pointer", color:"#15803d", fontSize:"12px", fontWeight:800, display:"flex", alignItems:"center", gap:"5px" }}>
                          ✅ Idhinisha
                        </button>
                      )}
                      <button onClick={() => setDetail(r)} style={{ background:"#eff6ff", border:"none", borderRadius:"8px", padding:"6px 12px", cursor:"pointer", color:"#3b82f6", fontSize:"12px", fontWeight:700, display:"flex", alignItems:"center", gap:"5px" }}>
                        <Eye size={13}/> {t("view.viewBtn")}
                      </button>
                      {canPrint && (
                        <button onClick={() => printReport(r)} style={{ background:"#f0fdf4", border:"none", borderRadius:"8px", padding:"6px 12px", cursor:"pointer", color:"#059669", fontSize:"12px", fontWeight:700, display:"flex", alignItems:"center", gap:"5px" }}>
                          <Printer size={13}/> {t("view.printBtn")}
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => deleteReport(r.id)} style={{ background:"#fee2e2", border:"none", borderRadius:"8px", padding:"6px 10px", cursor:"pointer", color:"#dc2626" }}>
                          <Trash2 size={13}/>
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"0" }}>
                    <div style={{ padding:"12px 22px", borderRight:"1px solid #f1f5f9" }}>
                      <div style={{ fontSize:"9.5px", fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"1px" }}>{t("view.income")}</div>
                      <div style={{ fontSize:"16px", fontWeight:900, color:"#059669", marginTop:"3px" }}>TZS {fmtTZS(tot.mapato)}</div>
                    </div>
                    <div style={{ padding:"12px 22px", borderRight:"1px solid #f1f5f9" }}>
                      <div style={{ fontSize:"9.5px", fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"1px" }}>{t("view.expenses")}</div>
                      <div style={{ fontSize:"16px", fontWeight:900, color:"#dc2626", marginTop:"3px" }}>TZS {fmtTZS(tot.matumizi)}</div>
                    </div>
                    <div style={{ padding:"12px 22px" }}>
                      <div style={{ fontSize:"9.5px", fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"1px" }}>{t("view.balance")}</div>
                      <div style={{ fontSize:"16px", fontWeight:900, color:"#102a43", marginTop:"3px" }}>
                        TZS {fmtTZS(Number(r.balances?.cash||0)+Number(r.balances?.mobile||0)+Number(r.balances?.safe||0))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ── DETAIL VIEW ────────────────────────────────────────────────────────────
  const renderDetail = (r: any) => {
    const ops: Operations  = r.operations  || blankOps();
    const fins: FinRow[]   = r.financials  || [];
    const bal: Balances    = r.balances    || { cash:"", mobile:"", safe:"" };
    const officers: OfficerRow[]   = r.loan_officers  || [];
    const expected: ExpectedLoan[] = r.expected_loans || [];
    const tot = finTotals(fins);
    const totalBal = Number(bal.cash||0)+Number(bal.mobile||0)+Number(bal.safe||0);
    const opGroups = [
      { title:t("detail.col1Title"), color:"#7c3aed", bg:"#faf5ff", items: [
        { label:t("detail.opLabels.new_customers"), val: ops.new_customers_inquired },
        { label:t("detail.opLabels.customers_called"), val: ops.customers_called },
        { label:t("detail.opLabels.forms_issued"), val: ops.forms_issued },
      ]},
      { title:t("detail.col2Title"), color:"#059669", bg:"#f0fdf4", items: [
        { label:t("detail.opLabels.loans_disbursed"), val: ops.loans_disbursed },
        { label:t("detail.opLabels.loans_in_progress"), val: ops.loans_in_progress },
        { label:t("detail.opLabels.customers_waiting"), val: ops.customers_waiting },
        { label:t("detail.opLabels.customers_completing"), val: ops.customers_completing_forms },
        { label:t("detail.opLabels.site_visits"), val: ops.site_visits },
      ]},
      { title:t("detail.col3Title"), color:"#f59e0b", bg:"#fffbeb", items: [
        { label:t("detail.opLabels.phone_reminders"), val: ops.phone_reminders },
        { label:t("detail.opLabels.sms_sent"), val: ops.sms_sent },
      ]},
    ];
    return (
      <div style={{ maxWidth:1380, margin:"0 auto" }}>

        <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:"14px", overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,0.05)" }}>
          {/* Meta strip */}
          <div style={{ background:"#102a43", padding:"14px 24px", display:"flex", gap:"36px", alignItems:"center" }}>
            <div><div style={{ fontSize:"9px", color:"rgba(255,255,255,0.55)", fontWeight:700, textTransform:"uppercase", letterSpacing:"1px" }}>{t("detail.metaDept")}</div><div style={{ color:"#fff", fontWeight:800, fontSize:"13px", marginTop:"2px" }}>{r.department}</div></div>
            <div><div style={{ fontSize:"9px", color:"rgba(255,255,255,0.55)", fontWeight:700, textTransform:"uppercase", letterSpacing:"1px" }}>{t("detail.metaSection")}</div><div style={{ color:"#fff", fontWeight:800, fontSize:"13px", marginTop:"2px" }}>{r.section}</div></div>
            <div><div style={{ fontSize:"9px", color:"rgba(255,255,255,0.55)", fontWeight:700, textTransform:"uppercase", letterSpacing:"1px" }}>{t("detail.metaBranch")}</div><div style={{ color:"#fff", fontWeight:800, fontSize:"13px", marginTop:"2px" }}>{r.branch||"—"}</div></div>
            <div style={{ marginLeft:"auto" }}><div style={{ fontSize:"9px", color:"rgba(255,255,255,0.55)", fontWeight:700, textTransform:"uppercase", letterSpacing:"1px" }}>{t("detail.metaBy")}</div><div style={{ color:"#fff", fontWeight:700, fontSize:"12px", marginTop:"2px" }}>{r.submitted_by_name||"—"}</div></div>
          </div>

          {/* SECTION 1: UTENDAJI */}
          <div style={S.secPanel()}>
            <p style={S.sectionTitle("#7c3aed")}><ClipboardList size={13}/> {t("detail.sec1Title")}</p>
            <div style={S.col3}>
              {opGroups.map((g, gi) => (
                <div key={gi} style={{ padding:"14px 18px", borderRight: gi<2?"1px solid #e2e8f0":"none" }}>
                  <div style={{ fontSize:"9.5px", fontWeight:800, textTransform:"uppercase", letterSpacing:"1px", color:g.color, background:g.bg, padding:"4px 10px", borderRadius:"20px", marginBottom:"12px", display:"inline-block" }}>{g.title}</div>
                  {g.items.map((item,ii) => item.val ? (
                    <div key={ii} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:"1px solid #f1f5f9" }}>
                      <span style={{ fontSize:"12px", color:"#64748b" }}>{item.label}</span>
                      <span style={{ fontSize:"14px", fontWeight:900, color:g.color }}>{item.val}</span>
                    </div>
                  ) : null)}
                </div>
              ))}
            </div>
            {(ops.form_recipients?.length > 0 || ops.notes) && (
              <div style={{ marginTop:"12px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0", background:"#faf5ff", border:"1px solid #ddd6fe", borderRadius:"8px", overflow:"hidden" }}>
                {/* Left: recipients */}
                <div style={{ padding:"12px 16px", borderRight:"1px solid #ddd6fe" }}>
                  <div style={{ fontSize:"10px", fontWeight:800, color:"#7c3aed", textTransform:"uppercase", letterSpacing:"1px", marginBottom:"8px" }}>{t("detail.formRecipientsTitle")}</div>
                  {ops.form_recipients?.length > 0 ? (
                    <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                      {ops.form_recipients.map((n,i) => (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                          <span style={{ minWidth:"20px", fontSize:"10px", fontWeight:900, color:"#7c3aed" }}>{String.fromCharCode(97+i)})</span>
                          <span style={{ fontSize:"12.5px", fontWeight:700, color:"#0f172a" }}>{n}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize:"12px", color:"#94a3b8", fontStyle:"italic" }}>—</div>
                  )}
                </div>
                {/* Right: notes */}
                <div style={{ padding:"12px 16px" }}>
                  <div style={{ fontSize:"10px", fontWeight:800, color:"#64748b", textTransform:"uppercase", letterSpacing:"1px", marginBottom:"8px" }}>{t("ops.notesLabel") || "Maelezo / Kumbukumbu"}</div>
                  {ops.notes ? (
                    <div style={{ fontSize:"12.5px", color:"#475569", fontStyle:"italic", lineHeight:1.6 }}>{ops.notes}</div>
                  ) : (
                    <div style={{ fontSize:"12px", color:"#94a3b8", fontStyle:"italic" }}>—</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: FINANCIAL */}
          <div style={S.secPanel()}>
            <p style={S.sectionTitle("#059669")}><DollarSign size={13}/> {t("detail.sec2Title")}</p>
            <div style={{ overflowX:"auto", borderRadius:"10px", border:"1px solid #e2e8f0" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
                <thead>
                  <tr style={{ background:"#f8fafc" }}>
                    <th style={{ padding:"10px 12px", border:"1px solid #e2e8f0", textAlign:"left", fontSize:"9.5px", fontWeight:800, color:"#64748b", textTransform:"uppercase" }}>{t("detail.finHeaders.date")}</th>
                    <th style={{ padding:"10px 8px", border:"1px solid #e2e8f0", textAlign:"right", fontSize:"9.5px", fontWeight:800, color:"#059669", textTransform:"uppercase" }}>{t("detail.finHeaders.income")}</th>
                    <th style={{ padding:"10px 8px", border:"1px solid #e2e8f0", textAlign:"left", fontSize:"9.5px", fontWeight:600, color:"#059669", textTransform:"uppercase", opacity:.7 }}>{t("detail.finHeaders.desc")}</th>
                    <th style={{ padding:"10px 8px", border:"1px solid #e2e8f0", textAlign:"right", fontSize:"9.5px", fontWeight:800, color:"#dc2626", textTransform:"uppercase" }}>{t("detail.finHeaders.expenses")}</th>
                    <th style={{ padding:"10px 8px", border:"1px solid #e2e8f0", textAlign:"left", fontSize:"9.5px", fontWeight:600, color:"#dc2626", textTransform:"uppercase", opacity:.7 }}>{t("detail.finHeaders.desc")}</th>
                    <th style={{ padding:"10px 8px", border:"1px solid #e2e8f0", textAlign:"right", fontSize:"9.5px", fontWeight:800, color:"#7c3aed", textTransform:"uppercase" }}>{t("detail.finHeaders.loan")}</th>
                    <th style={{ padding:"10px 8px", border:"1px solid #e2e8f0", textAlign:"left", fontSize:"9.5px", fontWeight:600, color:"#7c3aed", textTransform:"uppercase", opacity:.7 }}>{t("detail.finHeaders.desc")}</th>
                    <th style={{ padding:"10px 8px", border:"1px solid #e2e8f0", textAlign:"right", fontSize:"9.5px", fontWeight:800, color:"#0ea5e9", textTransform:"uppercase" }}>{t("detail.finHeaders.fromBank")}</th>
                    <th style={{ padding:"10px 8px", border:"1px solid #e2e8f0", textAlign:"right", fontSize:"9.5px", fontWeight:800, color:"#f59e0b", textTransform:"uppercase" }}>{t("detail.finHeaders.toBank")}</th>
                  </tr>
                </thead>
                <tbody>
                  {fins.map((row,i) => (
                    <tr key={i} style={{ background: i%2===0?"#fff":"#fafafa" }}>
                      <td style={{ padding:"8px 12px", border:"1px solid #f1f5f9", fontWeight:700, color:"#334155", whiteSpace:"nowrap" }}>{fmtDate(row.date)}</td>
                      <td style={{ padding:"8px", border:"1px solid #f1f5f9", textAlign:"right", fontWeight:700, color:"#059669" }}>{row.mapato ? fmtTZS(row.mapato) : "—"}</td>
                      <td style={{ padding:"8px", border:"1px solid #f1f5f9", fontSize:"11px", color:"#64748b" }}>{row.mapato_maelezo||""}</td>
                      <td style={{ padding:"8px", border:"1px solid #f1f5f9", textAlign:"right", fontWeight:700, color:"#dc2626" }}>{row.matumizi ? fmtTZS(row.matumizi) : "—"}</td>
                      <td style={{ padding:"8px", border:"1px solid #f1f5f9", fontSize:"11px", color:"#64748b" }}>{row.matumizi_maelezo||""}</td>
                      <td style={{ padding:"8px", border:"1px solid #f1f5f9", textAlign:"right", fontWeight:700, color:"#7c3aed" }}>{row.mkopo ? fmtTZS(row.mkopo) : "—"}</td>
                      <td style={{ padding:"8px", border:"1px solid #f1f5f9", fontSize:"11px", color:"#64748b" }}>{row.mkopo_maelezo||""}</td>
                      <td style={{ padding:"8px", border:"1px solid #f1f5f9", textAlign:"right", fontWeight:700, color:"#0ea5e9" }}>{row.kutoka_benki ? fmtTZS(row.kutoka_benki) : "—"}</td>
                      <td style={{ padding:"8px", border:"1px solid #f1f5f9", textAlign:"right", fontWeight:700, color:"#f59e0b" }}>{row.kwenda_benki ? fmtTZS(row.kwenda_benki) : "—"}</td>
                    </tr>
                  ))}
                  <tr style={{ background:"#f0fdf4" }}>
                    <td style={{ padding:"10px 12px", border:"1px solid #e2e8f0", fontWeight:900, color:"#059669", fontSize:"12px" }}>{t("detail.totalRow")}</td>
                    <td style={{ padding:"10px 8px", border:"1px solid #e2e8f0", textAlign:"right", fontWeight:900, color:"#059669", fontSize:"13px" }}>{fmtTZS(tot.mapato)}</td>
                    <td style={{ border:"1px solid #e2e8f0" }}></td>
                    <td style={{ padding:"10px 8px", border:"1px solid #e2e8f0", textAlign:"right", fontWeight:900, color:"#dc2626", fontSize:"13px" }}>{fmtTZS(tot.matumizi)}</td>
                    <td style={{ border:"1px solid #e2e8f0" }}></td>
                    <td style={{ padding:"10px 8px", border:"1px solid #e2e8f0", textAlign:"right", fontWeight:900, color:"#7c3aed", fontSize:"13px" }}>{fmtTZS(tot.mkopo)}</td>
                    <td style={{ border:"1px solid #e2e8f0" }}></td>
                    <td style={{ padding:"10px 8px", border:"1px solid #e2e8f0", textAlign:"right", fontWeight:900, color:"#0ea5e9", fontSize:"13px" }}>{fmtTZS(tot.kutoka)}</td>
                    <td style={{ padding:"10px 8px", border:"1px solid #e2e8f0", textAlign:"right", fontWeight:900, color:"#f59e0b", fontSize:"13px" }}>{fmtTZS(tot.kwenda)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:"0", border:"1px solid #e2e8f0", borderRadius:"10px", overflow:"hidden", marginTop:"14px" }}>
              {[
                { label:`${t("detail.cashLabel")} (TZS)`,   val:bal.cash,   color:"#059669" },
                { label:`${t("detail.mobileLabel")} (TZS)`, val:bal.mobile, color:"#7c3aed" },
                { label:`${t("detail.safeLabel")} (TZS)`,   val:bal.safe,   color:"#f59e0b" },
                { label:t("detail.totalBalance"), val:String(totalBal), color:"#102a43" },
              ].map((b,i,arr) => (
                <div key={i} style={{ padding:"14px 20px", background:i===3?"#f0f9ff":"#fff", borderRight:i<arr.length-1?"1px solid #e2e8f0":"none" }}>
                  <div style={{ fontSize:"9px", fontWeight:800, textTransform:"uppercase", letterSpacing:"1px", color:"#94a3b8" }}>{b.label}</div>
                  <div style={{ fontSize:"18px", fontWeight:900, color:b.color, marginTop:"4px" }}>{fmtTZS(b.val)}/=</div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 3 & 4 side by side */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", borderTop:"2px solid #f1f5f9" }}>
            <div style={{ padding:"24px 28px", borderRight:"2px solid #f1f5f9" }}>
              <p style={S.sectionTitle("#3b82f6")}><Users size={13}/> {t("detail.sec3Title")}</p>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12.5px" }}>
                <thead><tr style={{ background:"#eff6ff" }}>
                  {[t("sec3.colNum"),t("detail.officersColName"),t("detail.officersColToDate"),t("detail.officersColExpected")].map((h,i) => <th key={i} style={{ padding:"8px", border:"1px solid #e2e8f0", fontSize:"9.5px", fontWeight:800, color:"#3b82f6", textTransform:"uppercase", textAlign:i===0||i>1?"center":"left" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {officers.filter(o=>o.name).map((o,i) => (
                    <tr key={i} style={{ background:i%2===0?"#fff":"#f8faff" }}>
                      <td style={{ padding:"7px 8px", border:"1px solid #f1f5f9", textAlign:"center", fontWeight:700, color:"#94a3b8", fontSize:"11px" }}>{i+1}</td>
                      <td style={{ padding:"7px 10px", border:"1px solid #f1f5f9", fontWeight:700, color:"#0f172a" }}>{o.name}</td>
                      <td style={{ padding:"7px 8px", border:"1px solid #f1f5f9", textAlign:"center", fontWeight:900, color:"#059669", fontSize:"14px" }}>{o.hadi_sasa||"—"}</td>
                      <td style={{ padding:"7px 8px", border:"1px solid #f1f5f9", textAlign:"center", fontWeight:900, color:"#7c3aed", fontSize:"14px" }}>{o.tegemeo||"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding:"24px 28px" }}>
              <p style={S.sectionTitle("#f59e0b")}><TrendingUp size={13}/> {t("detail.sec4Title")}</p>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12.5px" }}>
                <thead><tr style={{ background:"#fffbeb" }}>
                  {[t("sec4.colNum"),t("detail.expectedColCustomer"),t("detail.expectedColStage")].map((h,i) => <th key={i} style={{ padding:"8px", border:"1px solid #e2e8f0", fontSize:"9.5px", fontWeight:800, color:"#f59e0b", textTransform:"uppercase", textAlign:i===0?"center":"left" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {expected.filter(e=>e.customer_name).map((e,i) => (
                    <tr key={i} style={{ background:i%2===0?"#fff":"#fffdf5" }}>
                      <td style={{ padding:"7px 8px", border:"1px solid #f1f5f9", textAlign:"center", fontWeight:700, color:"#94a3b8", fontSize:"11px" }}>{i+1}</td>
                      <td style={{ padding:"7px 10px", border:"1px solid #f1f5f9", fontWeight:700, color:"#0f172a" }}>{e.customer_name}</td>
                      <td style={{ padding:"7px 10px", border:"1px solid #f1f5f9", fontWeight:600, color:"#b45309" }}>{e.hatua||"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SIGNATURE SECTION — all in one row */}
          <div style={{ padding:"18px 28px", borderTop:"2px solid #f1f5f9", background:"#fafbfc" }}>
            <div style={{ display:"grid", gridTemplateColumns: canApprove && isLoanManager && r.approval_status === "pending" ? "1fr 1fr 1fr 1fr" : "1fr 1fr 1fr", gap:"14px", alignItems:"stretch" }}>

              {/* LO Signature card — always shows submitter; indicates if digitally signed */}
              <div style={{ border:`2px solid ${r.lo_signed ? "#86efac" : r.submitted_by_name ? "#bfdbfe" : "#e2e8f0"}`, borderRadius:"12px", padding:"14px 18px", background: r.lo_signed ? "#f0fdf4" : r.submitted_by_name ? "#eff6ff" : "#fff" }}>
                <div style={{ fontSize:"9px", fontWeight:800, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"1px", marginBottom:"8px" }}>{t("detail.signedBy")}</div>
                {r.submitted_by_name ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                    <div style={{ fontSize:"13px", fontWeight:900, color: r.lo_signed ? "#15803d" : "#1d4ed8" }}>
                      {r.lo_signed ? "✅" : "📝"} {r.submitted_by_name}
                    </div>
                    <div style={{ fontSize:"10px", color:"#64748b" }}>{r.section || "—"}</div>
                    <div style={{ fontSize:"10px", marginTop:2, fontWeight:700, color: r.lo_signed ? "#059669" : "#3b82f6" }}>
                      {r.lo_signed ? "Amesaini kidijitali" : "Amewasilisha (bila saini)"}
                    </div>
                    <div style={{ fontSize:"10px", color:"#94a3b8" }}>{fmtDate(r.period_start)}</div>
                  </div>
                ) : (
                  <div style={{ fontSize:"12px", color:"#94a3b8", fontStyle:"italic" }}>Haijasainiwa</div>
                )}
              </div>

              {/* LM Signature / review card */}
              <div style={{ border:`2px solid ${r.lm_signed ? "#86efac" : isLoanManager && r.approval_status === "pending" ? "#fde68a" : "#e2e8f0"}`, borderRadius:"12px", padding:"14px 18px", background: r.lm_signed ? "#f0fdf4" : isLoanManager && r.approval_status === "pending" ? "#fffbeb" : "#fff" }}>
                <div style={{ fontSize:"9px", fontWeight:800, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"1px", marginBottom:"8px" }}>{t("detail.checkedBy")}</div>
                {r.lm_signed ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                    <div style={{ fontSize:"13px", fontWeight:900, color:"#15803d" }}>✅ {r.approved_by_name}</div>
                    <div style={{ fontSize:"10px", color:"#64748b" }}>Meneja wa Mikopo</div>
                    <div style={{ fontSize:"10px", color:"#94a3b8", marginTop:2 }}>{r.approved_at ? new Date(r.approved_at).toLocaleDateString("en-GB") : "—"}</div>
                  </div>
                ) : isLoanManager ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                    <div style={{ fontSize:"12px", fontWeight:800, color:"#92400e" }}>⏳ Saini yako inahitajika</div>
                    <div style={{ fontSize:"10px", color:"#b45309", marginTop:2 }}>Bonyeza "Saini & Idhinisha" kuthibitisha ripoti hii</div>
                  </div>
                ) : (
                  <div style={{ fontSize:"12px", color:"#94a3b8", fontStyle:"italic" }}>Inasubiri idhini ya LM</div>
                )}
              </div>

              {/* GM/MD Approval stamp */}
              <div style={{ border:`2px solid ${r.approval_status === "approved" ? "#bae6fd" : "#e2e8f0"}`, borderRadius:"12px", padding:"14px 18px", background: r.approval_status === "approved" ? "#f0f9ff" : "#fff" }}>
                <div style={{ fontSize:"9px", fontWeight:800, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"1px", marginBottom:"8px" }}>{t("detail.approvedBy")}</div>
                {r.approval_status === "approved" ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                    <div style={{ fontSize:"13px", fontWeight:900, color:"#0ea5e9" }}>📋 {r.approved_by_name}</div>
                    <div style={{ fontSize:"10px", color:"#64748b" }}>Imepelekwa GM / MD / Admin</div>
                    {r.approved_at && <div style={{ fontSize:"10px", color:"#94a3b8", marginTop:2 }}>{new Date(r.approved_at).toLocaleDateString("en-GB")}</div>}
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                    <div style={{ fontSize:"12px", color:"#94a3b8", fontStyle:"italic" }}>Inasubiri idhini ya LM</div>
                    <div style={{ fontSize:"10px", color:"#cbd5e1", marginTop:2 }}>Itapelekwa GM/MD/Admin baada ya LM kuthibitisha</div>
                  </div>
                )}
              </div>

              {/* Approve action card — only shown to LM when pending (4th column) */}
              {canApprove && isLoanManager && r.approval_status === "pending" && (
                <div style={{ border:"2px solid #fde68a", borderRadius:"12px", padding:"14px 18px", background:"#fef9c3", display:"flex", flexDirection:"column", justifyContent:"space-between", gap:"10px" }}>
                  <div>
                    <div style={{ fontSize:"9px", fontWeight:800, color:"#92400e", textTransform:"uppercase", letterSpacing:"1px", marginBottom:"6px" }}>⏳ Hatua Inayohitajika</div>
                    <div style={{ fontSize:"12px", fontWeight:700, color:"#854d0e" }}>Ripoti hii inasubiri idhini yako</div>
                    <div style={{ fontSize:"10px", color:"#92400e", marginTop:"3px" }}>na {r.submitted_by_name} · {fmtDate(r.period_start)}</div>
                  </div>
                  <button onClick={() => openApprove(r)} style={{ background:"#059669", border:"none", borderRadius:"8px", padding:"9px 14px", color:"#fff", fontSize:"12px", fontWeight:800, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px", width:"100%" }}>
                    ✅ Saini & Idhinisha
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ height:40 }}/>
      </div>
    );
  };

  // ── MAIN RENDER ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:"#f1f5f9", fontFamily:"'Inter',sans-serif" }}>
      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", top:20, right:20, zIndex:9999, background: toast.ok?"#059669":"#dc2626", color:"#fff", padding:"12px 22px", borderRadius:"10px", fontWeight:700, fontSize:"13px", boxShadow:"0 8px 24px rgba(0,0,0,0.2)", display:"flex", alignItems:"center", gap:"10px" }}>
          {toast.ok ? <CheckCircle size={16}/> : <X size={16}/>} {toast.msg}
        </div>
      )}

      {/* ── Sticky tab bar — matches AccountingTabBar design ── */}
      <div className="br-tab-bar">
        <div className="br-tab-scroll">
          {/* Page identity pill */}
          <div className="br-brand">
            <FileText size={14} />
            <span>📋 {t("header.title")}</span>
          </div>
          <div className="br-divider" />
          {/* Tabs */}
          {canSubmit && (
            <button className={`br-tab ${tab==="submit" ? "br-tab--active" : ""}`}
              onClick={() => { setDetail(null); setTab("submit"); }}>
              <Plus size={12}/> {t("header.submitTab")}
            </button>
          )}
          {canView && (
            <button className={`br-tab ${tab==="view" ? "br-tab--active" : ""}`}
              onClick={() => { setDetail(null); setTab("view"); }}>
              <Eye size={12}/> {t("header.viewTab")}
            </button>
          )}
        </div>

        {/* Right-side actions (period filter — submit tab only) */}
        <div className="br-tab-actions">
          {tab === "submit" && (
            <div ref={filterRef} style={{ position:"relative" }}>
              <button
                onClick={() => setShowFilterDrop(d => !d)}
                className={`br-action-btn ${showFilterDrop ? "br-action-btn--active" : ""}`}>
                <SlidersHorizontal size={13}/>
                <span>{t("period.btn")}</span>
                {hasDateRange && (
                  <span className="br-period-badge">{filterBadge}</span>
                )}
              </button>

              {showFilterDrop && (
                <div className="br-filter-drop">
                  <div className="br-filter-arrow"/>
                  <div className="br-filter-label">{t("period.typeLabel")}</div>
                  <div className="br-type-row">
                    {(["daily","weekly","monthly"] as const).map(typ => (
                      <button key={typ} onClick={() => handleTypeChange(typ)}
                        className={`br-type-btn ${form.report_type===typ ? "br-type-btn--active" : ""}`}>
                        {typ==="daily"?t("period.daily"):typ==="weekly"?t("period.weekly"):t("period.monthly")}
                      </button>
                    ))}
                  </div>
                  <div className="br-date-grid">
                    <div style={S.field}>
                      <label style={S.label}>{t("period.startDate")}</label>
                      <input type="date" style={{...S.input, fontSize:"12.5px"}}
                        value={form.period_start}
                        onChange={e => handleStartChange(e.target.value)} />
                    </div>
                    <div style={S.field}>
                      <label style={S.label}>{t("period.endDate")}</label>
                      <input type="date" style={{...S.input, fontSize:"12.5px"}}
                        value={form.period_end}
                        onChange={e => setForm(f => ({...f, period_end: e.target.value}))} />
                    </div>
                  </div>
                  {hasDateRange && (
                    <div className="br-date-confirm">
                      <span>✓ {fmtDate(form.period_start)}{form.report_type!=="daily" ? ` — ${fmtDate(form.period_end)}` : ""}</span>
                      <button onClick={() => setShowFilterDrop(false)} className="br-confirm-ok">{t("period.ok")}</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Detail sub-bar — shown when a report is open in the view tab */}
      {tab === "view" && detail && (
        <div className="br-sub-bar">
          <button className="br-back-btn" onClick={() => setDetail(null)}>
            <ChevronLeft size={15}/> {t("detail.backBtn")}
          </button>
          <div className="br-sub-title">
            {t("detail.titlePrefix")} {typeLabels[detail.report_type as keyof typeof typeLabels] || detail.report_type}
            {" — "}
            {fmtDate(detail.period_start)}
            {detail.report_type !== "daily" ? ` — ${fmtDate(detail.period_end)}` : ""}
          </div>
          {canPrint && (
            <button className="br-print-btn" onClick={() => printReport(detail)}>
              <Printer size={13}/> {t("detail.printBtn")}
            </button>
          )}
        </div>
      )}

      {/* CSS for the tab bar */}
      <style>{`
        .br-tab-bar {
          display: flex;
          align-items: stretch;
          background: #f1f5f9;
          position: sticky;
          top: 0;
          z-index: 100;
          border-bottom: 2px solid #e2e8f0;
          min-height: 50px;
        }
        .br-tab-scroll {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          padding: 10px 14px 0;
          overflow-x: auto;
          flex: 1;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .br-tab-scroll::-webkit-scrollbar { display: none; }
        .br-brand {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 13px;
          font-weight: 800;
          color: #102a43;
          white-space: nowrap;
          padding-bottom: 10px;
          flex-shrink: 0;
        }
        .br-divider {
          width: 1px;
          height: 24px;
          background: #cbd5e1;
          margin: 0 8px 10px;
          flex-shrink: 0;
        }
        .br-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          padding: 8px 16px;
          border: none;
          border-radius: 8px 8px 0 0;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          background: transparent;
          color: #64748b;
          transition: all .15s;
          flex-shrink: 0;
        }
        .br-tab--active {
          background: white;
          color: #102a43;
          box-shadow: 0 -2px 0 #1e5fae inset;
        }
        .br-tab:hover:not(.br-tab--active) {
          background: #e2e8f0;
          color: #334155;
        }
        .br-tab-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          flex-shrink: 0;
          border-left: 1px solid #e2e8f0;
          background: #f1f5f9;
        }
        .br-action-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px 14px;
          border: 1.5px solid #e2e8f0;
          border-radius: 8px;
          background: #fff;
          font-size: 12.5px;
          font-weight: 700;
          color: #475569;
          cursor: pointer;
          transition: all .15s;
          white-space: nowrap;
        }
        .br-action-btn--active {
          border-color: #7c3aed;
          background: #faf5ff;
          color: #7c3aed;
        }
        .br-action-btn:hover:not(.br-action-btn--active) {
          border-color: #94a3b8;
          color: #334155;
        }
        .br-period-badge {
          background: #7c3aed;
          color: #fff;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 20px;
        }
        .br-filter-drop {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          z-index: 200;
          background: #fff;
          border: 1.5px solid #e2e8f0;
          border-radius: 14px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.12);
          padding: 20px 22px;
          min-width: 380px;
        }
        .br-filter-arrow {
          position: absolute;
          top: -8px;
          right: 22px;
          width: 14px;
          height: 14px;
          background: #fff;
          border: 1.5px solid #e2e8f0;
          border-right: none;
          border-bottom: none;
          transform: rotate(45deg);
        }
        .br-filter-label {
          font-size: 10px;
          font-weight: 800;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          margin-bottom: 14px;
        }
        .br-type-row {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }
        .br-type-btn {
          flex: 1;
          padding: 10px 6px;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          background: #fff;
          color: #64748b;
          transition: all .15s;
        }
        .br-type-btn--active {
          border-color: #7c3aed;
          background: #7c3aed;
          color: #fff;
        }
        .br-date-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .br-date-confirm {
          margin-top: 14px;
          padding: 10px 14px;
          background: #f0fdf4;
          border-radius: 8px;
          border: 1px solid #bbf7d0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          font-weight: 700;
          color: #059669;
        }
        .br-confirm-ok {
          background: #059669;
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 4px 12px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }
        /* Detail sub-bar */
        .br-sub-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 20px;
          height: 46px;
          background: #fff;
          border-bottom: 1px solid #e2e8f0;
          position: sticky;
          top: 52px;
          z-index: 99;
        }
        .br-back-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          background: #f1f5f9;
          border: none;
          border-radius: 7px;
          padding: 6px 12px;
          font-size: 12.5px;
          font-weight: 700;
          color: #64748b;
          cursor: pointer;
          flex-shrink: 0;
          transition: background .15s;
        }
        .br-back-btn:hover { background: #e2e8f0; }
        .br-sub-title {
          font-size: 14px;
          font-weight: 800;
          color: #0f172a;
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .br-print-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #102a43;
          border: none;
          border-radius: 8px;
          padding: 7px 16px;
          font-size: 12.5px;
          font-weight: 800;
          color: #fff;
          cursor: pointer;
          flex-shrink: 0;
          transition: background .15s;
        }
        .br-print-btn:hover { background: #1e5fae; }
        /* Signature modal */
        .br-sig-overlay {
          position: fixed; inset: 0; z-index: 9000;
          background: rgba(0,0,0,0.55);
          display: flex; align-items: center; justify-content: center;
        }
        .br-sig-box {
          background: #fff; border-radius: 18px; padding: 32px 36px;
          min-width: 380px; max-width: 440px; width: 100%;
          box-shadow: 0 24px 80px rgba(0,0,0,0.25);
        }
        .br-sig-title {
          font-size: 17px; font-weight: 900; color: #0f172a; margin-bottom: 6px;
        }
        .br-sig-sub {
          font-size: 12px; color: #64748b; margin-bottom: 22px; line-height: 1.6;
        }
        .br-sig-label {
          font-size: 10px; font-weight: 800; color: #64748b;
          text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;
          display: block;
        }
        .br-sig-input {
          width: 100%; padding: 10px 14px; border: 1.5px solid #e2e8f0;
          border-radius: 10px; font-size: 14px; font-weight: 600;
          color: #0f172a; outline: none; box-sizing: border-box;
          margin-bottom: 6px; background: #f8fafc;
        }
        .br-sig-input:focus { border-color: #102a43; background: #fff; }
        .br-sig-err {
          font-size: 11.5px; font-weight: 700; color: #dc2626;
          margin-bottom: 16px; min-height: 18px;
        }
        .br-sig-row {
          display: flex; gap: 10px; margin-top: 18px;
        }
        .br-sig-cancel {
          flex: 1; padding: 10px; border: 1.5px solid #e2e8f0;
          border-radius: 10px; font-size: 13px; font-weight: 700;
          color: #64748b; background: #fff; cursor: pointer;
        }
        .br-sig-ok {
          flex: 2; padding: 10px; border: none;
          border-radius: 10px; font-size: 13px; font-weight: 800;
          color: #fff; cursor: pointer;
          background: linear-gradient(135deg,#102a43,#1d3a5f);
          box-shadow: 0 4px 12px rgba(16,42,67,0.3);
        }
        .br-sig-ok:disabled { background: #94a3b8; box-shadow: none; cursor: not-allowed; }
        .br-approve-ok { background: linear-gradient(135deg,#059669,#047857); box-shadow: 0 4px 12px rgba(5,150,105,0.3); }
      `}</style>

      {/* ── Signature / Approval modal ── */}
      {sigModal && (
        <div className="br-sig-overlay" onClick={e => { if (e.target === e.currentTarget) setSigModal(null); }}>
          <div className="br-sig-box">
            {sigModal === "submit" ? (
              <>
                <div className="br-sig-title">✍️ Thibitisha Saini Yako</div>
                <div className="br-sig-sub">
                  Ingiza nywila yako ili kuthibitisha ripoti hii kabla ya kuwasilisha kwa Meneja wa Mikopo.
                </div>
              </>
            ) : (
              <>
                <div className="br-sig-title">✅ Idhinisha Ripoti</div>
                <div className="br-sig-sub">
                  Ingiza nywila yako ili kuthibitisha idhini — ripoti itaonekana kwa GM, MD, na Admin.
                </div>
              </>
            )}
            <label className="br-sig-label">Nywila yako</label>
            <input
              className="br-sig-input"
              type="password"
              placeholder="••••••••"
              value={sigPassword}
              onChange={e => { setSigPassword(e.target.value); setSigError(""); }}
              onKeyDown={e => e.key === "Enter" && (sigModal === "submit" ? doSubmit() : doApprove())}
              autoFocus
            />
            {sigError && <div className="br-sig-err">⚠ {sigError}</div>}
            <div className="br-sig-row">
              <button className="br-sig-cancel" onClick={() => setSigModal(null)}>Ghairi</button>
              <button
                className={`br-sig-ok ${sigModal === "approve" ? "br-approve-ok" : ""}`}
                disabled={sigLoading || !sigPassword.trim()}
                onClick={sigModal === "submit" ? doSubmit : doApprove}
              >
                {sigLoading ? "Inatuma..." : sigModal === "submit" ? "✓ Saini & Wasilisha" : "✅ Saini & Idhinisha"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ maxWidth:1440, margin:"0 auto", padding:"28px 28px 0" }}>
        {tab === "submit" ? renderForm() : renderView()}
      </div>
    </div>
  );
}
