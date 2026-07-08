import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import AlertModal from "../components/AlertModal";
import ConfirmModal from "../components/ConfirmModal";
import { API_BASE as API } from "../lib/api";
import { useOrgSettings } from "../utils/orgSettings";
import staticLogo from "../assets/logo.png";
const fmt = (v: any) => `TZS ${Number(v || 0).toLocaleString()}`;
const fmtNum = (v: any) => Number(v || 0).toLocaleString();


// --- Types ------------------------------------------------------------
interface SalaryComponent { id: number; code: string; name: string; type: "earning" | "deduction"; taxable: boolean; statutory: boolean; active: boolean; default_amount: number; sort_order: number; }
interface Employee { id: number; employee_id: string; full_name: string; department: string; designation: string; branch: string; employment_type: string; basic_salary: number; bank_name: string; bank_account: string; tin_number: string; nssf_number: string; nhif_number: string; phone: string; email: string; hire_date: string; active: boolean; date_of_joining?: string; tin?: string; work_station?: string; }
interface PayrollRun { id: number; payroll_no: string; month: number; year: number; pay_date: string; status: string; notes: string; created_by: any; approved_by: any; approved_at: string; gl_post_journal_id: number | null; gl_pay_journal_id: number | null; }
interface ItemDetail { id: number; component: SalaryComponent; amount: number; }
interface PayrollItem { id: number; employee: Employee; gross_salary: number; total_earnings: number; total_deductions: number; net_salary: number; payment_status: string; payment_method: string; payment_reference: string; payment_date: string | null; email_sent_at: string | null; email_status: string | null; details: ItemDetail[]; }
interface PayrollFull extends PayrollRun { items: PayrollItem[]; }
interface BreakdownRow { department: string; headcount: number; gross: number; deductions: number; net: number; paye: number; nssf: number; nhif: number; paid_count: number; emailed_count: number; }
interface AnalyticsRow { id: number; payroll_no: string; month: number; year: number; status: string; headcount: number; total_gross: number; total_deductions: number; total_net: number; paid_count: number; }

type Tab = "runs" | "components" | "employees" | "myslips" | "breakdown";

// --- Status helpers ----------------------------------------------------
const statusColor: Record<string, string> = {
  draft: "#94a3b8", approved: "#3b82f6", posted: "#8b5cf6", paid: "#10b981", cancelled: "#ef4444",
};
const payColor: Record<string, string> = {
  pending: "#f59e0b", partially_paid: "#3b82f6", paid: "#10b981",
};

function numberToWords(n: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  if (n === 0) return "Zero";
  const convert = (num: number): string => {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
    if (num < 1000) return ones[Math.floor(num / 100)] + " Hundred" + (num % 100 ? " " + convert(num % 100) : "");
    if (num < 1000000) return convert(Math.floor(num / 1000)) + " Thousand" + (num % 1000 ? " " + convert(num % 1000) : "");
    if (num < 1000000000) return convert(Math.floor(num / 1000000)) + " Million" + (num % 1000000 ? " " + convert(num % 1000000) : "");
    return convert(Math.floor(num / 1000000000)) + " Billion" + (num % 1000000000 ? " " + convert(num % 1000000000) : "");
  };
  return convert(Math.floor(n)) + " Tanzanian Shillings Only";
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Payroll() {
  const { t } = useTranslation("payroll");
  const org = useOrgSettings();
  const orgLogo = org.company_logo_url || staticLogo;
  const orgName = org.company_name || "Microfinance Institution";
  const orgTagline = org.company_tagline || "";
  const orgPhone = org.company_phone || "";
  const orgEmail = org.company_email || "";
  const orgWebsite = org.company_website || "";
  const orgAddress = org.company_address || "";
  const auth = () => { const tok = localStorage.getItem("token"); return tok ? { Authorization: `Bearer ${tok}` } : {}; };

  const getMonthName = (m: number): string => {
    const list = t("months", { returnObjects: true });
    return Array.isArray(list) && list[m] ? list[m] : [
      "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"
    ][m];
  };

  const getMonthShort = (m: number): string => {
    const list = t("months_short", { returnObjects: true });
    return Array.isArray(list) && list[m] ? list[m] : [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ][m];
  };

  const [tab, setTab] = useState<Tab>("runs");
  const [payrolls, setPayrolls] = useState<PayrollRun[]>([]);
  const [payroll, setPayroll] = useState<PayrollFull | null>(null);
  const [selItem, setSelItem] = useState<PayrollItem | null>(null);
  const [components, setComponents] = useState<SalaryComponent[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<any>({ isOpen: false, title: "", message: "", type: "info" });
  const [confirm, setConfirm] = useState<any>({ isOpen: false, title: "", message: "", type: "info", onConfirm: () => { } });

  // Payment modal state
  interface GlAccount { id: number; code: string; name: string; }
  const [payModal, setPayModal] = useState<{ open: boolean; mode: "single" | "bulk"; item?: PayrollItem }>({ open: false, mode: "single" });
  const [pmMethod, setPmMethod] = useState<"bank_transfer" | "cash" | "mobile_money">("bank_transfer");
  const [pmAccountCode, setPmAccountCode] = useState("1020");
  const [pmReference, setPmReference] = useState("");
  const [pmAccounts, setPmAccounts] = useState<GlAccount[]>([]);
  const [pmDefaults, setPmDefaults] = useState({ bank_account_code: "1020", cash_account_code: "1010" });

  // Filters
  const [fMonth, setFMonth] = useState(new Date().getMonth() + 1);
  const [fYear, setFYear] = useState(new Date().getFullYear());
  const [fStatus, setFStatus] = useState("");

  // Create payroll form
  const [showCreate, setShowCreate] = useState(false);
  const [cpMonth, setCpMonth] = useState(new Date().getMonth() + 1);
  const [cpYear, setCpYear] = useState(new Date().getFullYear());
  const [cpDate, setCpDate] = useState("");
  const [cpNotes, setCpNotes] = useState("");

  // Edit item amounts
  const [editAmounts, setEditAmounts] = useState<Record<number, string>>({});
  const [editMethod, setEditMethod] = useState("");
  const [editRef, setEditRef] = useState("");
  const [editDirty, setEditDirty] = useState(false);
  const [printMode, setPrintMode] = useState<"slip" | "stmt" | null>(null);
  // Analytics / breakdown
  const [analytics, setAnalytics] = useState<AnalyticsRow[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);
  // My slips (employee self-service)
  const [mySlips, setMySlips] = useState<any[]>([]);
  const [myEmployee, setMyEmployee] = useState<Employee | null>(null);
  const [mySelSlip, setMySelSlip] = useState<any | null>(null);
  const [myRole, setMyRole] = useState<string>("");
  const [myYearFilter, setMyYearFilter] = useState<number>(new Date().getFullYear());
  const [hasEmpRecord, setHasEmpRecord] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [payrollRoles, setPayrollRoles] = useState<string[]>(
    (() => { try { return JSON.parse(localStorage.getItem("payroll_access_roles") || "null") || ["admin", "finance_officer", "general_manager", "managing_director"]; } catch { return ["admin", "finance_officer", "general_manager", "managing_director"]; } })()
  );
  // admin always sees management; others only if their role is in payrollRoles
  const isPayrollAdmin = myRole === "admin" || payrollRoles.includes(myRole);
  const allowedTabs = (() => {
    const list: Tab[] = [];
    if (isPayrollAdmin) {
      list.push("runs", "components", "employees");
    }
    if (hasEmpRecord) {
      list.push("myslips");
    }
    if (isPayrollAdmin) {
      list.push("breakdown");
    }
    return list;
  })();

  // Modals for employees / components
  const [showEmpForm, setShowEmpForm] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [empForm, setEmpForm] = useState<any>({});
  const [nextIdLoading, setNextIdLoading] = useState(false);

  const [showCompForm, setShowCompForm] = useState(false);
  const [editComp, setEditComp] = useState<SalaryComponent | null>(null);
  const [compForm, setCompForm] = useState<any>({});

  const slipRef = useRef<HTMLDivElement>(null);

  const err = (e: any) => setModal({ isOpen: true, title: "Error", message: e?.response?.data?.message || String(e), type: "error" });

  // --- Load payrolls ----------------------------------------------------
  const loadPayrolls = async () => {
    try {
      const params: any = {};
      if (fMonth) params.month = fMonth;
      if (fYear) params.year = fYear;
      if (fStatus) params.status = fStatus;
      const res = await axios.get(`${API}/payroll`, { params, headers: auth() });
      setPayrolls(res.data.data || []);
    } catch (e) { err(e); }
  };

  const loadPayroll = async (id: number) => {
    setBusy(true);
    try {
      const [payRes, bdRes] = await Promise.all([
        axios.get(`${API}/payroll/${id}`, { headers: auth() }),
        axios.get(`${API}/payroll/${id}/breakdown`, { headers: auth() }),
      ]);
      setPayroll(payRes.data.data);
      setBreakdown(bdRes.data.departments || []);
      setSelItem(null);
    } catch (e) { err(e); } finally { setBusy(false); }
  };

  const loadAnalytics = async () => {
    try {
      const res = await axios.get(`${API}/payroll/analytics`, { headers: auth() });
      setAnalytics(res.data.data || []);
      setAnalyticsLoaded(true);
    } catch { /* non-critical */ }
  };

  const loadComponents = async () => {
    const res = await axios.get(`${API}/hr/components`, { headers: auth() });
    setComponents(res.data.data || []);
  };

  const loadEmployees = async () => {
    const res = await axios.get(`${API}/hr/employees`, { headers: auth() });
    setEmployees(res.data.data || []);
  };

  // Bootstrap: fetch current user role + settings + own slips
  useEffect(() => {
    (async () => {
      try {
        const [meRes, settingsRes] = await Promise.all([
          axios.get(`${API}/me`, { headers: auth() }),
          axios.get(`${API}/loan-settings`),
        ]);
        const role: string = meRes.data.role || "";
        const emp: boolean = !!meRes.data.has_employee_record;
        const pRoles: string[] = settingsRes.data.data?.payroll_access_roles || payrollRoles;
        setMyRole(role);
        setHasEmpRecord(emp);
        setPayrollRoles(pRoles);
        setSettingsLoaded(true);
        // If NOT a payroll admin but has employee record -> open on My Slips tab
        const isAdmin = role === "admin" || pRoles.includes(role);
        if (!isAdmin && emp) setTab("myslips");
        // Load employee's own slips
        if (emp) {
          const slipRes = await axios.get(`${API}/payroll/my-slips`, { headers: auth() });
          const slips: any[] = slipRes.data.data || [];
          setMySlips(slips);
          setMyEmployee(slipRes.data.employee || null);
          // Auto-select the most recent PAID slip so it's visible immediately on login
          const latestPaid = slips.find((s: any) => s.payment_status === "paid" || s.payroll?.status === "paid");
          if (latestPaid) {
            setMySelSlip(latestPaid);
            setMyYearFilter(latestPaid.payroll?.year || new Date().getFullYear());
          } else if (slips.length > 0) {
            setMySelSlip(slips[0]);
            setMyYearFilter(slips[0].payroll?.year || new Date().getFullYear());
          }
        }
      } catch { setSettingsLoaded(true); }
    })();
  }, []);

  useEffect(() => { if (settingsLoaded && isPayrollAdmin) { loadPayrolls(); if (!analyticsLoaded) loadAnalytics(); } }, [fMonth, fYear, fStatus, settingsLoaded, isPayrollAdmin]);
  useEffect(() => { if (tab === "components") loadComponents(); }, [tab]);
  useEffect(() => { if (tab === "employees") loadEmployees(); }, [tab]);
  useEffect(() => {
    if (tab === "myslips" && hasEmpRecord) {
      axios.get(`${API}/payroll/my-slips`, { headers: auth() })
        .then(r => {
          const slips: any[] = r.data.data || [];
          setMySlips(slips);
          setMyEmployee(r.data.employee || null);
          if (!mySelSlip && slips.length > 0) {
            const latestPaid = slips.find((s: any) => s.payment_status === "paid" || s.payroll?.status === "paid");
            const toSelect = latestPaid || slips[0];
            setMySelSlip(toSelect);
            setMyYearFilter(toSelect?.payroll?.year || new Date().getFullYear());
          }
        })
        .catch(() => { });
    }
  }, [tab]);

  // --- Select employee item ---------------------------------------------
  const selectItem = (item: PayrollItem) => {
    setSelItem(item);
    const map: Record<number, string> = {};
    item.details.forEach(d => { map[d.component.id] = String(d.amount); });
    setEditAmounts(map);
    setEditMethod(item.payment_method || "bank_transfer");
    setEditRef(item.payment_reference || "");
    setEditDirty(false);
  };

  // --- Create payroll ---------------------------------------------------
  const createPayroll = async () => {
    if (!cpDate) { setModal({ isOpen: true, title: "Validation", message: "Pay date is required.", type: "error" }); return; }
    setBusy(true);
    try {
      const res = await axios.post(`${API}/payroll`, { month: cpMonth, year: cpYear, pay_date: cpDate, notes: cpNotes }, { headers: auth() });
      setShowCreate(false);
      setCpNotes("");
      await loadPayrolls();
      await loadPayroll(res.data.data.id);
    } catch (e) { err(e); } finally { setBusy(false); }
  };

  // --- Status transition ------------------------------------------------
  const changeStatus = (status: string) => {
    if (!payroll) return;
    // "paid" gets the payment modal instead of a plain confirm
    if (status === "paid") { openPayModal("bulk"); return; }
    const labels: Record<string, string> = { approved: "Approve", posted: "Post to GL", cancelled: "Cancel", draft: "Revert to Draft" };
    setConfirm({
      isOpen: true, title: `${labels[status]} Payroll`, type: status === "cancelled" ? "danger" : "info",
      message: `Are you sure you want to ${labels[status]?.toLowerCase()} ${payroll.payroll_no}?`,
      onConfirm: async () => {
        setConfirm((p: any) => ({ ...p, isOpen: false }));
        try {
          await axios.put(`${API}/payroll/${payroll.id}/status`, { status }, { headers: auth() });
          await loadPayrolls();
          await loadPayroll(payroll.id);
        } catch (e) { err(e); }
      },
    });
  };

  // --- Save item amounts ------------------------------------------------
  const saveItem = async () => {
    if (!selItem) return;
    setBusy(true);
    try {
      const details = Object.entries(editAmounts).map(([cid, amt]) => ({
        component_id: Number(cid), amount: Number(amt) || 0,
      }));
      const res = await axios.put(`${API}/payroll/item/${selItem.id}`,
        { details, payment_method: editMethod, payment_reference: editRef },
        { headers: auth() }
      );
      const updated: PayrollItem = res.data.data;
      setSelItem(updated);
      // Update inside payroll
      if (payroll) {
        setPayroll({ ...payroll, items: payroll.items.map(i => i.id === updated.id ? updated : i) });
      }
      setEditDirty(false);
      setModal({ isOpen: true, title: "Saved", message: "Salary amounts updated.", type: "success" });
    } catch (e) { err(e); } finally { setBusy(false); }
  };

  // --- Delete payroll ---------------------------------------------------
  const deletePayroll = () => {
    if (!payroll) return;
    setConfirm({
      isOpen: true, title: "Delete Payroll", type: "danger",
      message: `Delete ${payroll.payroll_no}? This cannot be undone.`,
      onConfirm: async () => {
        setConfirm((p: any) => ({ ...p, isOpen: false }));
        try {
          await axios.delete(`${API}/payroll/${payroll.id}`, { headers: auth() });
          setPayroll(null); setSelItem(null);
          await loadPayrolls();
        } catch (e) { err(e); }
      },
    });
  };

  // --- Salary Component CRUD --------------------------------------------
  const openCompForm = (c?: SalaryComponent) => {
    setEditComp(c || null);
    setCompForm(c ? { ...c } : { code: "", name: "", type: "earning", taxable: false, statutory: false, active: true, default_amount: 0, sort_order: 99 });
    setShowCompForm(true);
  };
  const saveComp = async () => {
    try {
      if (editComp) { await axios.put(`${API}/hr/components/${editComp.id}`, compForm, { headers: auth() }); }
      else { await axios.post(`${API}/hr/components`, compForm, { headers: auth() }); }
      setShowCompForm(false);
      await loadComponents();
    } catch (e) { err(e); }
  };
  const deleteComp = (c: SalaryComponent) => {
    setConfirm({
      isOpen: true, title: "Delete Component", type: "danger",
      message: `Delete "${c.name}"?`,
      onConfirm: async () => {
        setConfirm((p: any) => ({ ...p, isOpen: false }));
        try { await axios.delete(`${API}/hr/components/${c.id}`, { headers: auth() }); await loadComponents(); } catch (e) { err(e); }
      },
    });
  };

  // --- Employee CRUD ----------------------------------------------------
  const openEmpForm = async (e?: Employee) => {
    setEditEmp(e || null);
    if (e) {
      setEmpForm({ ...e });
    } else {
      // Start with blank form then fetch auto-generated ID from backend
      const hireDate = new Date().toISOString().slice(0, 10);
      setEmpForm({ employee_id: "", full_name: "", department: "", designation: "", branch: "", employment_type: "permanent", basic_salary: 0, bank_name: "", bank_account: "", tin_number: "", nssf_number: "", nhif_number: "", phone: "", email: "", hire_date: hireDate, active: true });
      setNextIdLoading(true);
      try {
        const res = await axios.get(`${API}/hr/employees/next-id`, { params: { hire_date: hireDate }, headers: auth() });
        setEmpForm((prev: any) => ({ ...prev, employee_id: res.data.employee_id }));
      } catch { /* silently ignore; user can still type manually */ }
      finally { setNextIdLoading(false); }
    }
    setShowEmpForm(true);
  };
  const saveEmp = async () => {
    if (!empForm.full_name || !empForm.full_name.trim()) {
      setModal({ isOpen: true, title: "Validation Error", message: "Full Name is required.", type: "error" });
      return;
    }
    if (empForm.basic_salary === undefined || empForm.basic_salary === null || empForm.basic_salary === "" || Number(empForm.basic_salary) < 0 || isNaN(Number(empForm.basic_salary))) {
      setModal({ isOpen: true, title: "Validation Error", message: "Basic Salary must be a valid number greater than or equal to 0.", type: "error" });
      return;
    }
    try {
      if (editEmp) { await axios.put(`${API}/hr/employees/${editEmp.id}`, empForm, { headers: auth() }); }
      else { await axios.post(`${API}/hr/employees`, empForm, { headers: auth() }); }
      setShowEmpForm(false);
      await loadEmployees();
    } catch (e) { err(e); }
  };
  const deleteEmp = (e: Employee) => {
    setConfirm({
      isOpen: true, title: "Delete Employee", type: "danger",
      message: `Delete "${e.full_name}"?`,
      onConfirm: async () => {
        setConfirm((p: any) => ({ ...p, isOpen: false }));
        try { await axios.delete(`${API}/hr/employees/${e.id}`, { headers: auth() }); await loadEmployees(); } catch (e) { err(e); }
      },
    });
  };
  const syncUsers = async () => {
    setBusy(true);
    try {
      const res = await axios.post(`${API}/hr/employees/sync-users`, {}, { headers: auth() });
      setModal({ isOpen: true, title: "Sync Success", message: res.data.message, type: "success" });
      await loadEmployees();
    } catch (e: any) {
      err(e);
    } finally {
      setBusy(false);
    }
  };

  // --- Open payment modal (loads GL accounts once) -----------------------
  const openPayModal = async (mode: "single" | "bulk", item?: PayrollItem) => {
    if (pmAccounts.length === 0) {
      try {
        const r = await axios.get(`${API}/payroll/payment-accounts`, { headers: auth() });
        setPmAccounts(r.data.accounts || []);
        const defs = r.data.defaults || {};
        setPmDefaults(defs);
        // pre-fill default based on item method or bank default
        const defCode = (item?.payment_method === "cash" ? defs.cash_account_code : defs.bank_account_code) || "1020";
        setPmAccountCode(defCode);
        setPmMethod(item?.payment_method === "cash" ? "cash" : "bank_transfer");
      } catch {
        setPmAccounts([{ id: 0, code: "1020", name: "Bank Account" }, { id: 0, code: "1010", name: "Cash in Hand" }]);
      }
    } else {
      const defCode = (item?.payment_method === "cash" ? pmDefaults.cash_account_code : pmDefaults.bank_account_code) || "1020";
      setPmAccountCode(defCode);
      setPmMethod(item?.payment_method === "cash" ? "cash" : "bank_transfer");
    }
    setPmReference(item?.payment_reference || "");
    setPayModal({ open: true, mode, item });
  };

  // --- Confirm payment from modal -----------------------------------------
  const confirmPayment = async () => {
    if (!payroll) return;
    setBusy(true);
    try {
      if (payModal.mode === "single" && payModal.item) {
        const item = payModal.item;
        const res = await axios.put(`${API}/payroll/item/${item.id}/pay`, {
          payment_method: pmMethod,
          payment_reference: pmReference,
          payment_account_code: pmAccountCode,
        }, { headers: auth() });
        const updated: PayrollItem = res.data.data;
        setSelItem(updated);
        if (payroll) {
          const updatedItems = payroll.items.map(i => i.id === updated.id ? updated : i);
          const allPaid = updatedItems.every(i => i.payment_status === "paid");
          setPayroll({ ...payroll, items: updatedItems, status: allPaid ? "paid" : payroll.status });
        }
        await loadPayrolls();
        setModal({ isOpen: true, title: "Payment Posted", message: `${item.employee.full_name} marked as paid. GL journal posted to ${pmAccountCode}.${updated.email_status === "sent" ? " Email sent." : updated.email_status === "no_email" ? " No email on record." : ""}`, type: "success" });
      } else {
        // bulk -- mark whole payroll paid
        await axios.put(`${API}/payroll/${payroll.id}/status`, {
          status: "paid",
          payment_method: pmMethod,
          payment_reference: pmReference,
          payment_account_code: pmAccountCode,
        }, { headers: auth() });
        await loadPayrolls();
        await loadPayroll(payroll.id);
        setModal({ isOpen: true, title: "Payroll Paid", message: `All employees marked paid. GL journal posted to ${pmAccountCode}.`, type: "success" });
      }
      setPayModal({ open: false, mode: "single" });
    } catch (e) { err(e); } finally { setBusy(false); }
  };

  // --- Mark individual employee as paid (opens modal) --------------------
  const payItem = (item: PayrollItem) => openPayModal("single", item);

  // --- Resend salary slip email -------------------------------------------
  const resendEmail = async (item: PayrollItem) => {
    setBusy(true);
    try {
      const res = await axios.post(`${API}/payroll/item/${item.id}/resend-email`, {}, { headers: auth() });
      const updated: PayrollItem = res.data.data;
      setSelItem(updated);
      if (payroll) setPayroll({ ...payroll, items: payroll.items.map(i => i.id === updated.id ? updated : i) });
      setModal({ isOpen: true, title: "Email", message: res.data.message, type: "success" });
    } catch (e) { err(e); } finally { setBusy(false); }
  };

  const printSlip = () => { setPrintMode("slip"); setTimeout(() => { window.print(); setTimeout(() => setPrintMode(null), 500); }, 100); };
  const printStmt = () => {
    setPrintMode("stmt");
    setTimeout(() => {
      // Inject landscape @page for statement only; removed after print
      const s = document.createElement("style");
      s.id = "pay-landscape";
      s.textContent = "@page { size:A4 landscape; margin:12mm; }";
      document.head.appendChild(s);
      window.print();
      setTimeout(() => {
        document.getElementById("pay-landscape")?.remove();
        setPrintMode(null);
      }, 500);
    }, 100);
  };
  const printMySlip = () => {
    if (!mySelSlip) return;
    setSelItem(mySelSlip as PayrollItem);
    setPayroll({ ...mySelSlip.payroll, items: [] } as PayrollFull);
    setTimeout(() => { setPrintMode("slip"); setTimeout(() => { window.print(); setTimeout(() => { setPrintMode(null); setSelItem(null); setPayroll(null); }, 500); }, 100); }, 50);
  };

  // ── Compute totals for payroll statement ───────────────────────────────────
  const totals = payroll ? {
    count: payroll.items.length,
    gross: payroll.items.reduce((s, i) => s + i.gross_salary, 0),
    ded: payroll.items.reduce((s, i) => s + i.total_deductions, 0),
    net: payroll.items.reduce((s, i) => s + i.net_salary, 0),
  } : null;

  // ── Payroll runs tab ───────────────────────────────────────────────────────
  const earnings = selItem?.details.filter(d => d.component.type === "earning") ?? [];
  const deductions = selItem?.details.filter(d => d.component.type === "deduction") ?? [];

  if (!settingsLoaded) {
    return (
      <div className="pay-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", flexDirection: "column", gap: 18 }}>
        <div style={{ width: 48, height: 48, border: "4px solid #e2e8f0", borderTop: "4px solid #1e5fae", borderRadius: "50%", animation: "pay-spin 0.8s linear infinite" }} />
        <div style={{ fontSize: 14, color: "#627d98", fontWeight: 500 }}>Loading salary information...</div>
        <style>{`@keyframes pay-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (settingsLoaded && allowedTabs.length === 0) {
    return (
      <div className="pay-page">
        <AlertModal isOpen={modal.isOpen} title={modal.title} message={modal.message} type={modal.type} onClose={() => setModal({ ...modal, isOpen: false })} />
        <ConfirmModal isOpen={confirm.isOpen} title={confirm.title} message={confirm.message} type={confirm.type} onConfirm={confirm.onConfirm} onCancel={() => setConfirm({ ...confirm, isOpen: false })} />
        <div className="pay-empty pay-empty--big" style={{ margin: "auto", padding: "40px" }}>
          <div className="pay-empty-icon">🔒</div>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "#102a43" }}>
            {t("no_access_title", { defaultValue: "Access Restricted" })}
          </div>
          <div style={{ fontSize: "13px", color: "#64748b", maxWidth: "450px", marginTop: "8px", lineHeight: "1.6" }}>
            {t("no_access_desc", { defaultValue: "No payroll management permissions are assigned to your role, and there is no employee record linked to your user account. Please contact your administrator to link your profile." })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pay-page">
      <AlertModal isOpen={modal.isOpen} title={modal.title} message={modal.message} type={modal.type} onClose={() => setModal({ ...modal, isOpen: false })} />
      <ConfirmModal isOpen={confirm.isOpen} title={confirm.title} message={confirm.message} type={confirm.type} onConfirm={confirm.onConfirm} onCancel={() => setConfirm({ ...confirm, isOpen: false })} />

      {/* ── Payment Modal ──────────────────────────────────────────────────── */}
      {payModal.open && payroll && (
        <div className="ppm-overlay" onClick={e => { if (e.target === e.currentTarget) setPayModal({ open: false, mode: "single" }); }}>
          <div className="ppm-box">
            <div className="ppm-hd">
              <div>
                <div className="ppm-title">💳 Confirm Salary Payment</div>
                <div className="ppm-sub">{payModal.mode === "bulk" ? `${payroll.payroll_no} -- all employees` : payModal.item?.employee.full_name}</div>
              </div>
              <button className="ppm-close" onClick={() => setPayModal({ open: false, mode: "single" })}>✕</button>
            </div>

            {/* Amount summary */}
            <div className="ppm-amounts">
              {payModal.mode === "single" && payModal.item ? (
                <>
                  <div className="ppm-amt-row"><span>Gross Salary</span><span>{fmt(payModal.item.gross_salary)}</span></div>
                  <div className="ppm-amt-row ppm-amt-row--ded"><span>Total Deductions</span><span>− {fmt(payModal.item.total_deductions)}</span></div>
                  <div className="ppm-amt-row ppm-amt-row--net"><span>Net to Pay</span><span>{fmt(payModal.item.net_salary)}</span></div>
                </>
              ) : (
                <>
                  <div className="ppm-amt-row"><span>Employees</span><span>{payroll.items.filter(i => i.payment_status !== "paid").length}</span></div>
                  <div className="ppm-amt-row"><span>Total Gross</span><span>{fmt(payroll.items.reduce((s, i) => s + Number(i.gross_salary), 0))}</span></div>
                  <div className="ppm-amt-row ppm-amt-row--ded"><span>Total Deductions</span><span>− {fmt(payroll.items.reduce((s, i) => s + Number(i.total_deductions), 0))}</span></div>
                  <div className="ppm-amt-row ppm-amt-row--net"><span>Total Net to Pay</span><span>{fmt(payroll.items.filter(i => i.payment_status !== "paid").reduce((s, i) => s + Number(i.net_salary), 0))}</span></div>
                </>
              )}
            </div>

            {/* Payment details form */}
            <div className="ppm-form">
              <div className="ppm-field">
                <label>Payment Method</label>
                <div className="ppm-method-btns">
                  {([["bank_transfer", "🏦 Bank Transfer", pmDefaults.bank_account_code], ["cash", "💵 Cash", pmDefaults.cash_account_code], ["mobile_money", "📱 Mobile Money", pmDefaults.bank_account_code]] as const).map(([val, lbl, defCode]) => (
                    <button key={val}
                      className={`ppm-method-btn ${pmMethod === val ? "ppm-method-btn--active" : ""}`}
                      onClick={() => { setPmMethod(val); setPmAccountCode(defCode); }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ppm-field">
                <label>Payment Account <span className="ppm-label-hint">(GL account to credit)</span></label>
                <select value={pmAccountCode} onChange={e => setPmAccountCode(e.target.value)}>
                  {pmAccounts.length > 0
                    ? pmAccounts.map(a => <option key={a.code} value={a.code}>{a.code} -- {a.name}</option>)
                    : <>
                      <option value="1020">1020 -- NMB / Bank Account</option>
                      <option value="1010">1010 -- Cash in Hand</option>
                    </>
                  }
                </select>
              </div>

              <div className="ppm-field">
                <label>Reference / Batch No. <span className="ppm-label-hint">(optional)</span></label>
                <input type="text" value={pmReference} onChange={e => setPmReference(e.target.value)}
                  placeholder="e.g. TRN-20260702-001, NMB Batch #123" />
              </div>
            </div>

            {/* GL journal preview */}
            <div className="ppm-journal">
              <div className="ppm-journal-title">📒 Journal Entry Preview</div>
              <table className="ppm-je-table">
                <thead><tr><th>Account</th><th>Dr</th><th>Cr</th></tr></thead>
                <tbody>
                  <tr>
                    <td>2200 -- Accrued Salaries Payable</td>
                    <td className="ppm-dr">{fmt(
                      payModal.mode === "single" && payModal.item
                        ? payModal.item.net_salary
                        : payroll.items.filter(i => i.payment_status !== "paid").reduce((s, i) => s + Number(i.net_salary), 0)
                    )}</td>
                    <td>--</td>
                  </tr>
                  <tr>
                    <td>{pmAccountCode} -- {pmAccounts.find(a => a.code === pmAccountCode)?.name ?? "Selected Account"}</td>
                    <td>--</td>
                    <td className="ppm-cr">{fmt(
                      payModal.mode === "single" && payModal.item
                        ? payModal.item.net_salary
                        : payroll.items.filter(i => i.payment_status !== "paid").reduce((s, i) => s + Number(i.net_salary), 0)
                    )}</td>
                  </tr>
                </tbody>
              </table>
              <div className="ppm-journal-note">This journal will be posted automatically on confirmation.</div>
            </div>

            <div className="ppm-footer">
              <button className="ppm-btn ppm-btn--cancel" onClick={() => setPayModal({ open: false, mode: "single" })} disabled={busy}>Cancel</button>
              <button className="ppm-btn ppm-btn--confirm" onClick={confirmPayment} disabled={busy}>
                {busy ? "Processing…" : `✅ Confirm & Post Payment`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Employee-only slip view: premium redesign --- */}
      {settingsLoaded && !isPayrollAdmin && hasEmpRecord && tab === "myslips" && (() => {
        const filteredSlips = mySlips.filter((s: any) => s.payroll?.year === myYearFilter);
        const slip = mySelSlip;
        const earnings_my = slip?.details?.filter((d: any) => d.component?.type === "earning") ?? [];
        const deductions_my = slip?.details?.filter((d: any) => d.component?.type === "deduction") ?? [];
        const isPaidSlip = slip?.payment_status === "paid" || slip?.payroll?.status === "paid";
        return (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#eef2f7", fontFamily: "'Inter',system-ui,sans-serif" }}>

            {/* ── Hero header bar ── */}
            <div style={{ background: "linear-gradient(135deg,#0d1f33 0%,#1a3a5c 60%,#1e5fae 100%)", padding: "0 32px", display: "flex", alignItems: "center", gap: 20, flexShrink: 0, minHeight: 76, position: "relative", overflow: "hidden" }}>
              {/* Decorative circles */}
              <div style={{ position: "absolute", right: -40, top: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", right: 60, bottom: -50, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.03)", pointerEvents: "none" }} />
              {myEmployee && (
                <div style={{ width: 46, height: 46, borderRadius: "50%", background: "linear-gradient(135deg,#059669,#10b981)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 20, flexShrink: 0, boxShadow: "0 0 0 3px rgba(255,255,255,0.15)" }}>
                  {myEmployee.full_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 16, letterSpacing: "0.2px" }}>{myEmployee?.full_name || "My Salary Slips"}</div>
                {myEmployee && (
                  <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <span>{myEmployee.employee_id}</span>
                    {myEmployee.designation && <><span style={{ opacity: 0.4 }}>·</span><span>{myEmployee.designation}</span></>}
                    {myEmployee.department && <><span style={{ opacity: 0.4 }}>·</span><span>{myEmployee.department}</span></>}
                  </div>
                )}
              </div>
              {/* Year selector */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Year</span>
                <select
                  value={myYearFilter}
                  onChange={e => { const yr = Number(e.target.value); setMyYearFilter(yr); const first = mySlips.find((s: any) => s.payroll?.year === yr); if (first) setMySelSlip(first); }}
                  style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", backdropFilter: "blur(4px)" }}
                >
                  {[...new Set(mySlips.map((s: any) => s.payroll?.year).filter(Boolean))].sort((a: any, b: any) => b - a).map((yr: any) => (
                    <option key={yr} value={yr} style={{ color: "#000", background: "#fff" }}>{yr}</option>
                  ))}
                </select>
              </div>
              {slip && (
                <button onClick={printMySlip} style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.25)", borderRadius: 10, padding: "8px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13, backdropFilter: "blur(4px)", transition: "all .15s", flexShrink: 0 }}>
                  🖨 Print Slip
                </button>
              )}
            </div>

            {/* ── No employee record ── */}
            {!myEmployee && (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 56, opacity: 0.3 }}>🔍</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#334155" }}>No employee record linked to your account</div>
                <div style={{ fontSize: 13, color: "#94a3b8" }}>Ask your administrator to link your user profile.</div>
              </div>
            )}

            {/* ── Content area ── */}
            {myEmployee && (
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

                {/* Left: slip list */}
                <div style={{ width: 280, background: "#fff", borderRight: "1px solid #e2e8f0", overflow: "auto", flexShrink: 0 }}>
                  <div style={{ padding: "14px 16px 8px", fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", borderBottom: "1px solid #f1f5f9" }}>
                    {filteredSlips.length} Slip{filteredSlips.length !== 1 ? "s" : ""} · {myYearFilter}
                  </div>
                  {filteredSlips.length === 0 ? (
                    <div style={{ padding: "32px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>No slips for {myYearFilter}</div>
                  ) : filteredSlips.map((s: any) => {
                    const isActive = mySelSlip?.id === s.id;
                    const sIsPaid = s.payment_status === "paid" || s.payroll?.status === "paid";
                    return (
                      <div key={s.id} onClick={() => setMySelSlip(s)} style={{ padding: "13px 16px", borderBottom: "1px solid #f8fafc", cursor: "pointer", background: isActive ? "#f0f9ff" : "#fff", borderLeft: `3px solid ${isActive ? "#1e5fae" : "transparent"}`, transition: "all .12s" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: isActive ? "#1e5fae" : "#0f172a" }}>
                            {getMonthName((s.payroll?.month || 1) - 1)}
                          </div>
                          {sIsPaid
                            ? <span style={{ fontSize: 9, fontWeight: 800, background: "#d1fae5", color: "#065f46", padding: "2px 7px", borderRadius: 20, letterSpacing: "0.3px" }}>PAID</span>
                            : <span style={{ fontSize: 9, fontWeight: 800, background: "#fef3c7", color: "#92400e", padding: "2px 7px", borderRadius: 20, letterSpacing: "0.3px" }}>{(s.payroll?.status || "draft").toUpperCase()}</span>
                          }
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 5 }}>{s.payroll?.payroll_no}</div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: isActive ? "#1e5fae" : "#1e293b" }}>{fmt(s.net_salary)}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Right: slip detail */}
                <div style={{ flex: 1, overflow: "auto", padding: "20px 16px" }}>
                  {!slip ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 12, color: "#94a3b8" }}>
                      <div style={{ fontSize: 64, opacity: 0.2 }}>🧾</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#64748b" }}>Select a month from the left to view your slip</div>
                    </div>
                  ) : (
                    <div style={{ minWidth: 680, maxWidth: 860, margin: "0 auto", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>
                      <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 60px rgba(11,31,58,0.18)", border: "1px solid #dde3ed" }}>

                        {/* ══ HEADER ══ */}
                        <div style={{ background: "linear-gradient(135deg,#0B1F3A 0%,#0d2847 55%,#112240 100%)", padding: "22px 30px", position: "relative", overflow: "hidden" }}>
                          <div style={{ position: "absolute", right: -50, top: -50, width: 200, height: 200, borderRadius: "50%", background: "rgba(212,175,55,0.06)", pointerEvents: "none" }} />
                          <div style={{ position: "absolute", right: 90, bottom: -70, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.03)", pointerEvents: "none" }} />
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
                            {/* Left — logo + company */}
                            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                              <div style={{ width: 52, height: 52, borderRadius: 12, background: "linear-gradient(135deg,#D4AF37,#f0d060)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(212,175,55,0.45)", flexShrink: 0 }}>
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="#0B1F3A"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
                              </div>
                              <div>
                                <div style={{ color: "#D4AF37", fontWeight: 900, fontSize: 17, letterSpacing: "1.5px", textTransform: "uppercase", lineHeight: 1 }}>Orethan</div>
                                <div style={{ color: "rgba(255,255,255,0.85)", fontWeight: 700, fontSize: 10, letterSpacing: "0.6px", marginTop: 3 }}>MICROFINANCE LTD</div>
                                <div style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400, fontSize: 9, marginTop: 2, fontStyle: "italic" }}>Empowering Financial Growth</div>
                              </div>
                            </div>
                            {/* Right — title + badge */}
                            <div style={{ textAlign: "right" }}>
                              <div style={{ color: "#fff", fontWeight: 900, fontSize: 26, letterSpacing: "5px", textTransform: "uppercase", lineHeight: 1 }}>SALARY SLIP</div>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 7, margin: "6px 0" }}>
                                <div style={{ height: 1, width: 36, background: "linear-gradient(to right,transparent,#D4AF37)" }} />
                                <span style={{ color: "#D4AF37", fontSize: 9, fontWeight: 700, letterSpacing: "2.5px" }}>CONFIDENTIAL</span>
                                <div style={{ height: 1, width: 36, background: "linear-gradient(to left,transparent,#D4AF37)" }} />
                              </div>
                              <div style={{ display: "inline-block", background: "#D4AF37", color: "#0B1F3A", fontWeight: 900, fontSize: 10, letterSpacing: "1.5px", padding: "5px 14px", borderRadius: 4 }}>
                                {getMonthName((slip.payroll?.month || 1) - 1).toUpperCase()} {slip.payroll?.year}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Gold line */}
                        <div style={{ height: 3, background: "linear-gradient(to right,#D4AF37,#f0d060,#D4AF37)" }} />

                        {/* ══ SECTION 1: Employee Info + Pay Period ══ */}
                        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 0, background: "#fff" }}>
                          {/* Employee */}
                          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "20px 20px 20px 28px", borderRight: "1px solid #e9ecef" }}>
                            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg,#0B1F3A,#1a3a5c)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 28, flexShrink: 0, border: "3px solid #D4AF37", boxShadow: "0 4px 14px rgba(212,175,55,0.28)" }}>
                              {(myEmployee?.full_name || "?").charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 900, fontSize: 15, color: "#0B1F3A", marginBottom: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{myEmployee?.full_name}</div>
                              <div style={{ color: "#D4AF37", fontWeight: 700, fontSize: 11, marginBottom: 8 }}>{myEmployee?.designation || "Staff"}</div>
                              {[
                                { label: "Employee ID", val: myEmployee?.employee_id },
                                { label: "Department",  val: myEmployee?.department },
                                { label: "Date Joined", val: myEmployee?.date_of_joining },
                                { label: "Bank",        val: myEmployee?.bank_name },
                                { label: "TIN",         val: myEmployee?.tin },
                                { label: "Work Station",val: myEmployee?.work_station },
                              ].filter(f => f.val).map((f, i) => (
                                <div key={i} style={{ display: "flex", gap: 4, marginBottom: 3 }}>
                                  <span style={{ fontSize: 10, color: "#64748b", minWidth: 72, fontWeight: 600, flexShrink: 0 }}>{f.label}</span>
                                  <span style={{ fontSize: 10, color: "#1e293b", minWidth: 0, wordBreak: "break-word" }}>: {f.val}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Pay period + Net Pay — unified card */}
                          <div style={{ padding: "20px 28px 20px 20px" }}>
                            <div style={{ border: "1px solid #dde3ed", borderRadius: 10, overflow: "hidden" }}>
                              {/* Pay period header */}
                              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", background: "#F5F7FA", borderBottom: "1px solid #e2e8f0" }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0B1F3A" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                <span style={{ fontSize: 9, fontWeight: 800, color: "#0B1F3A", textTransform: "uppercase", letterSpacing: "0.8px" }}>Pay Period</span>
                              </div>
                              {/* Pay period rows */}
                              {[
                                { label: "Pay Period",   val: `${getMonthName((slip.payroll?.month || 1) - 1)} ${slip.payroll?.year}` },
                                { label: "Pay Cycle",    val: "Monthly" },
                                { label: "Payment Date", val: slip.payroll?.pay_date || "--" },
                                { label: "Slip No.",     val: slip.payroll?.payroll_no || "--" },
                              ].map((r, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 14px", borderBottom: "1px solid #f1f5f9", gap: 8, background: "#fff" }}>
                                  <span style={{ fontSize: 11, color: "#64748b", flexShrink: 0 }}>{r.label}</span>
                                  <span style={{ fontSize: 11, color: "#0B1F3A", fontWeight: 700, textAlign: "right" }}>{r.val}</span>
                                </div>
                              ))}
                              {/* Net Pay — fused bottom of same card */}
                              <div style={{ background: "#0B1F3A", padding: "12px 14px", position: "relative", overflow: "hidden" }}>
                                <div style={{ position: "absolute", right: -14, bottom: -14, width: 60, height: 60, borderRadius: "50%", background: "rgba(212,175,55,0.12)", pointerEvents: "none" }} />
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
                                  <div>
                                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 3 }}>Net Pay</div>
                                    {isPaidSlip && (
                                      <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.4)", borderRadius: 20, padding: "2px 8px" }}>
                                        <span style={{ color: "#4ade80", fontSize: 9, fontWeight: 700 }}>✓ PAID</span>
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ textAlign: "right" }}>
                                    <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, marginBottom: 1 }}>TZS</div>
                                    <div style={{ color: "#D4AF37", fontWeight: 900, fontSize: 22, letterSpacing: "-0.5px", lineHeight: 1 }}>{fmtNum(slip.net_salary)}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Thin gold rule */}
                        <div style={{ height: 1, background: "linear-gradient(to right,transparent,#D4AF37 30%,#D4AF37 70%,transparent)", margin: "0 30px" }} />

                        {/* ══ SECTION 2: Earnings & Deductions ══ */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                          {/* Earnings */}
                          <div style={{ padding: "18px 22px 16px 30px", borderRight: "1px solid #e2e8f0" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, background: "#0B1F3A", borderRadius: 7, padding: "9px 12px" }}>
                              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(212,175,55,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>💰</div>
                              <span style={{ color: "#fff", fontWeight: 800, fontSize: 11, letterSpacing: "1px", textTransform: "uppercase" }}>Earnings</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "0 0 5px", borderBottom: "2px solid #e2e8f0", marginBottom: 6 }}>
                              <span style={{ fontSize: 9, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Description</span>
                              <span style={{ fontSize: 9, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Amount (TZS)</span>
                            </div>
                            {earnings_my.filter((d: any) => d.amount > 0).map((d: any) => (
                              <div key={d.component?.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px dashed #f1f5f9" }}>
                                <span style={{ fontSize: 12, color: "#374151" }}>{d.component?.name}</span>
                                <span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>{fmtNum(d.amount)}</span>
                              </div>
                            ))}
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0 0", borderTop: "2px solid #0B1F3A", marginTop: 6 }}>
                              <span style={{ fontSize: 11, fontWeight: 800, color: "#0B1F3A", textTransform: "uppercase" }}>Total Earnings</span>
                              <span style={{ fontSize: 12, fontWeight: 900, color: "#0B1F3A" }}>{fmtNum(slip.gross_salary)}</span>
                            </div>
                          </div>

                          {/* Deductions */}
                          <div style={{ padding: "18px 30px 16px 22px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, background: "#0B1F3A", borderRadius: 7, padding: "9px 12px" }}>
                              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(220,38,38,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>📉</div>
                              <span style={{ color: "#fff", fontWeight: 800, fontSize: 11, letterSpacing: "1px", textTransform: "uppercase" }}>Deductions</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "0 0 5px", borderBottom: "2px solid #e2e8f0", marginBottom: 6 }}>
                              <span style={{ fontSize: 9, fontWeight: 800, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.5px" }}>Description</span>
                              <span style={{ fontSize: 9, fontWeight: 800, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.5px" }}>Amount (TZS)</span>
                            </div>
                            {deductions_my.filter((d: any) => d.amount > 0).map((d: any) => (
                              <div key={d.component?.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px dashed #f1f5f9" }}>
                                <span style={{ fontSize: 12, color: "#374151" }}>{d.component?.name}</span>
                                <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{fmtNum(d.amount)}</span>
                              </div>
                            ))}
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0 0", borderTop: "2px solid #dc2626", marginTop: 6 }}>
                              <span style={{ fontSize: 11, fontWeight: 800, color: "#dc2626", textTransform: "uppercase" }}>Total Deductions</span>
                              <span style={{ fontSize: 12, fontWeight: 900, color: "#dc2626" }}>{fmtNum(slip.total_deductions)}</span>
                            </div>
                          </div>
                        </div>

                        {/* ══ SECTION 3: 4-stat summary cards ══ */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", background: "#F5F7FA", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
                          {[
                            { icon: "💼", label: "GROSS PAY",        val: slip.gross_salary,       color: "#0B1F3A" },
                            { icon: "➖", label: "TOTAL DEDUCTIONS",  val: slip.total_deductions,   color: "#dc2626" },
                            { icon: "💳", label: "NET PAY",           val: slip.net_salary,         color: "#059669" },
                            { icon: "📊", label: "TAXABLE PAY",       val: Math.max(0, Number(slip.gross_salary) - deductions_my.filter((d: any) => d.component?.taxable === false).reduce((s: number, d: any) => s + Number(d.amount), 0)), color: "#b45309" },
                          ].map((item, i) => (
                            <div key={i} style={{ padding: "14px 12px", textAlign: "center", borderRight: i < 3 ? "1px solid #e2e8f0" : "none" }}>
                              <div style={{ fontSize: 18, marginBottom: 5 }}>{item.icon}</div>
                              <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>{item.label}</div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", marginBottom: 1 }}>TZS</div>
                              <div style={{ fontWeight: 900, fontSize: 14, color: item.color }}>{fmtNum(item.val)}</div>
                            </div>
                          ))}
                        </div>

                        {/* ══ SECTION 4: Message + Authorization ══ */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "18px 30px", background: "#fff", borderBottom: "1px solid #e2e8f0", gap: 24 }}>
                          {/* Message */}
                          <div style={{ paddingRight: 20, borderRight: "1px solid #e2e8f0" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                              <span style={{ fontSize: 9, fontWeight: 800, color: "#0B1F3A", textTransform: "uppercase", letterSpacing: "0.8px" }}>Message</span>
                            </div>
                            <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.7, marginBottom: 10 }}>Thank you for your dedication and commitment. Your hard work makes a difference to our mission and values.</div>
                            <div style={{ fontFamily: "Georgia,serif", fontSize: 15, color: "#D4AF37", fontStyle: "italic" }}>We value you!</div>
                          </div>
                          {/* Authorization */}
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                              <span style={{ fontSize: 9, fontWeight: 800, color: "#0B1F3A", textTransform: "uppercase", letterSpacing: "0.8px" }}>Authorized By</span>
                            </div>
                            {slip.payroll?.approved_by?.name
                              ? <div style={{ fontSize: 14, fontWeight: 700, color: "#0B1F3A", fontFamily: "Georgia,serif", fontStyle: "italic", marginBottom: 4 }}>{slip.payroll.approved_by.name}</div>
                              : <div style={{ height: 24, borderBottom: "1px solid #94a3b8", width: 130, marginBottom: 6 }} />
                            }
                            <div style={{ height: 1, background: "#d1d5db", width: 130, marginBottom: 6 }} />
                            <div style={{ fontSize: 10, color: "#64748b" }}>Finance Manager — Orethan Microfinance Ltd</div>
                            <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 6 }}>Generated: {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</div>
                          </div>
                        </div>

                        {/* ══ FOOTER ══ */}
                        <div style={{ background: "#0B1F3A", padding: "12px 30px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                          {[
                            { icon: "📞", text: "+255 123 456 789" },
                            { icon: "✉",  text: "info@orethan.co.tz" },
                            { icon: "🌐", text: "www.orethan.co.tz" },
                            { icon: "📍", text: "P.O. Box 123, Tanzania" },
                          ].map((f, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <span style={{ fontSize: 10 }}>{f.icon}</span>
                              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{f.text}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ background: "#0B1F3A", padding: "6px 30px 12px", textAlign: "center", borderTop: "1px solid rgba(212,175,55,0.2)" }}>
                          <span style={{ fontSize: 8, color: "#D4AF37", fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase" }}>This is a computer generated document and does not require a signature.</span>
                        </div>

                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* --- Page Header for mgmt view with myslips tab only (payroll admin who also has emp record) --- */}
      {settingsLoaded && isPayrollAdmin && allowedTabs.length === 1 && allowedTabs[0] === "myslips" && (
        <div style={{ padding: "20px 24px 10px", background: "#f1f5f9" }}>
          <h1 style={{ fontSize: "22px", fontWeight: "800", color: "#102a43", margin: 0 }}>
            {t("my_salary_slips", { defaultValue: "My Salary Slips" })}
          </h1>
        </div>
      )}

      {/* --- Tabs (payroll admins only) ----------------------------------------- */}
      {settingsLoaded && isPayrollAdmin && allowedTabs.length > 1 && (
        <div className="pay-tab-bar">
          {allowedTabs.map(tKey => (
            <button key={tKey} className={`pay-tab ${tab === tKey ? "pay-tab--active" : ""}`} onClick={() => setTab(tKey)}>
              {tKey === "runs" ? `📋 ${t("payroll_runs")}` : tKey === "components" ? `⚙️ ${t("salary_components")}` : tKey === "employees" ? `👥 ${t("employees")}` : tKey === "myslips" ? `🧾 ${t("my_slips")}` : `🏢 Department Breakdown`}
            </button>
          ))}
          <div className="pay-tab-space" />
          {tab === "runs" && (
            <button className="pay-btn pay-btn--primary" onClick={() => setShowCreate(true)}>{t("new_payroll")}</button>
          )}
          {tab === "components" && (
            <button className="pay-btn pay-btn--primary" onClick={() => openCompForm()}>{t("add_component")}</button>
          )}
          {tab === "employees" && (
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="pay-btn pay-btn--outline" onClick={syncUsers} disabled={busy}>
                {busy ? t("importing") : `🔄 ${t("import_from_users")}`}
              </button>
              <button className="pay-btn pay-btn--primary" onClick={() => openEmpForm()}>{t("add_employee")}</button>
            </div>
          )}
        </div>
      )}

      {/* ││││││││││││││││││││││││││││││││││││││││││││││││││││││││││││││
          TAB: RUNS " 3-column layout
          ││││││││││││││││││││││││││││││││││││││││││││││││││││││││││││││ */}
      {tab === "runs" && isPayrollAdmin && (
        <>
          {/* Filters bar */}
          <div className="pay-filters">
            <select value={fMonth} onChange={e => setFMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }).map((_, i) => <option key={i} value={i + 1}>{getMonthShort(i)}</option>)}
            </select>
            <select value={fYear} onChange={e => setFYear(Number(e.target.value))}>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={fStatus} onChange={e => setFStatus(e.target.value)}>
              <option value="">{t("all_status")}</option>
              {["draft", "approved", "posted", "paid", "cancelled"].map(s => (
                <option key={s} value={s}>{t(`status_actions.${s}`)}</option>
              ))}
            </select>
            {payrolls.length > 0 && (
              <>
                <div className="pay-filter-sep" />
                <div className="pay-filter-run-scroll">
                  {payrolls.map(p => (
                    <button
                      key={p.id}
                      className={`pay-filter-run-btn ${payroll?.id === p.id ? "pay-filter-run-btn--active" : ""}`}
                      onClick={() => loadPayroll(p.id)}
                    >
                      <span className="pay-filter-run-no">{p.payroll_no}</span>
                      <span className="pay-filter-run-period">{getMonthName(p.month - 1)} {p.year}</span>
                      <span className="pay-badge" style={{ background: (statusColor[p.status] || "#059669") + "22", color: statusColor[p.status] || "#059669", border: `1px solid ${(statusColor[p.status] || "#059669")}44`, fontSize: 10 }}>
                        {t(`status_actions.${p.status}`).toUpperCase()}
                      </span>
                      <span className="pay-filter-run-date">{t("pay_date")}: {p.pay_date}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="pay-3col">
            {/* ── CENTER: Employee table ─────────────────────────────── */}
            <div className="pay-col-center">
              {!payroll ? (
                <div className="pay-analytics-panel">
                  <div className="pay-analytics-title">📊 Payroll Analytics -- Last 12 Months</div>
                  {analytics.length === 0 ? (
                    <div className="pay-empty pay-empty--big" style={{ marginTop: 24 }}>
                      <div className="pay-empty-icon">📊</div>
                      <div>Select a payroll run to view employees</div>
                    </div>
                  ) : (
                    <div className="pay-table-wrap" style={{ marginTop: 12 }}>
                      <table className="pay-table">
                        <thead>
                          <tr>
                            <th>Payroll</th>
                            <th>Period</th>
                            <th>Status</th>
                            <th className="pay-r">Staff</th>
                            <th className="pay-r">Gross</th>
                            <th className="pay-r">Deductions</th>
                            <th className="pay-r">Net</th>
                            <th className="pay-r">Paid</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.map(a => (
                            <tr key={a.id} className="pay-tr" onClick={() => loadPayroll(a.id)} style={{ cursor: "pointer" }}>
                              <td><span className="pay-run-no" style={{ fontSize: 12 }}>{a.payroll_no}</span></td>
                              <td>{getMonthShort(a.month - 1)} {a.year}</td>
                              <td>
                                <span className="pay-badge" style={{ background: statusColor[a.status] + "22", color: statusColor[a.status], border: `1px solid ${statusColor[a.status]}44`, fontSize: 10 }}>
                                  {a.status.toUpperCase()}
                                </span>
                              </td>
                              <td className="pay-r">{a.headcount}</td>
                              <td className="pay-r pay-bold">{fmtNum(a.total_gross)}</td>
                              <td className="pay-r pay-ded">{fmtNum(a.total_deductions)}</td>
                              <td className="pay-r pay-net">{fmtNum(a.total_net)}</td>
                              <td className="pay-r">{a.paid_count}/{a.headcount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Payroll header — single compact bar */}
                  <div className="pay-payroll-hd">
                    <div className="pay-payroll-meta">
                      <span className="pay-payroll-title">{payroll.payroll_no}</span>
                      <span className="pay-payroll-dot">·</span>
                      <span className="pay-payroll-sub">{getMonthName(payroll.month - 1)} {payroll.year}</span>
                      <span className="pay-payroll-dot">·</span>
                      <span className="pay-payroll-sub">{t("pay_date")}: {payroll.pay_date}</span>
                      {payroll.gl_post_journal_id && (
                        <>
                          <span className="pay-payroll-dot">·</span>
                          <span className="pay-gl-ref">📒 JE#{payroll.gl_post_journal_id}</span>
                          {payroll.gl_pay_journal_id && <><span className="pay-payroll-dot">·</span><span className="pay-gl-ref">💳 JE#{payroll.gl_pay_journal_id}</span></>}
                        </>
                      )}
                    </div>
                    <div className="pay-payroll-actions">
                      <span className="pay-badge pay-badge--lg" style={{ background: statusColor[payroll.status] + "22", color: statusColor[payroll.status], border: `1px solid ${statusColor[payroll.status]}55` }}>
                        {t(`status_actions.${payroll.status}`).toUpperCase()}
                      </span>
                      {payroll.status === "draft" && <button className="pay-btn pay-btn--blue" onClick={() => changeStatus("approved")}>{t("actions.approve")}</button>}
                      {payroll.status === "approved" && <>
                        <button className="pay-btn pay-btn--blue" onClick={() => changeStatus("draft")}>{t("actions.revert_draft")}</button>
                        <button className="pay-btn pay-btn--purple" onClick={() => changeStatus("posted")}>{t("actions.post_gl")}</button>
                      </>}
                      {payroll.status === "posted" && <button className="pay-btn pay-btn--green" onClick={() => changeStatus("paid")}>✅ {t("actions.mark_paid")} All</button>}
                      {["draft", "approved"].includes(payroll.status) && (
                        <button className="pay-btn pay-btn--danger" onClick={deletePayroll}>{t("actions.delete")}</button>
                      )}
                      <button className="pay-btn pay-btn--outline" onClick={printStmt}>🖨️ {t("actions.print_statement")}</button>
                    </div>
                  </div>

                  {/* Summary row */}
                  {totals && (
                    <div className="pay-summary-row">
                      <div className="pay-stat"><span>{totals.count}</span><label>{t("employees")}</label></div>
                      <div className="pay-stat pay-stat--earn"><span>{fmt(totals.gross)}</span><label>{t("financials.gross_salary")}</label></div>
                      <div className="pay-stat pay-stat--ded"><span>{fmt(totals.ded)}</span><label>{t("financials.total_deductions")}</label></div>
                      <div className="pay-stat pay-stat--net"><span>{fmt(totals.net)}</span><label>{t("financials.net_salary")}</label></div>
                    </div>
                  )}

                  {/* Employees table */}
                  <div className="pay-table-wrap">
                    <table className="pay-table">
                      <thead>
                        <tr>
                          <th>{t("columns.name")}</th>
                          <th>{t("columns.department")}</th>
                          <th className="pay-r">{t("financials.gross_salary")}</th>
                          <th className="pay-r">{t("financials.deductions")}</th>
                          <th className="pay-r">{t("financials.net_salary")}</th>
                          <th>{t("columns.status")}</th>
                          <th>✉</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payroll.items.length === 0 && (
                          <tr><td colSpan={6} className="pay-tc pay-empty-sm">No employees in this payroll</td></tr>
                        )}
                        {payroll.items.map(item => (
                          <tr key={item.id}
                            className={`pay-tr ${selItem?.id === item.id ? "pay-tr--active" : ""}`}
                            onClick={() => selectItem(item)}
                          >
                            <td>
                              <div className="pay-emp-name">{item.employee.full_name}</div>
                              <div className="pay-emp-sub">{item.employee.employee_id} · {item.employee.designation}</div>
                            </td>
                            <td>{item.employee.department}</td>
                            <td className="pay-r pay-bold">{fmtNum(item.gross_salary)}</td>
                            <td className="pay-r pay-ded">{fmtNum(item.total_deductions)}</td>
                            <td className="pay-r pay-net">{fmtNum(item.net_salary)}</td>
                            <td>
                              <span className="pay-badge" style={{ background: payColor[item.payment_status] + "22", color: payColor[item.payment_status], border: `1px solid ${payColor[item.payment_status]}44` }}>
                                {item.payment_status.replace("_", " ")}
                              </span>
                            </td>
                            <td>
                              {item.email_status === "sent" ? (
                                <span className="pay-email-badge pay-email-badge--sent" title={`Sent ${item.email_sent_at ?? ""}`}>✉ Sent</span>
                              ) : item.employee.email ? (
                                <span className="pay-email-badge pay-email-badge--pending">⏳ Pending</span>
                              ) : (
                                <span className="pay-email-badge pay-email-badge--none">--</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* --- RIGHT: Salary slip preview --------------------------------------- */}
            {selItem && <div className="pay-col-right">
              {(
                <>
                  <div className="pay-slip-hd">
                    <div>
                      <div className="pay-slip-name">{selItem.employee.full_name}</div>
                      <div className="pay-slip-role">{selItem.employee.designation} · {selItem.employee.department}</div>
                    </div>
                    <button className="pay-btn pay-btn--primary" onClick={printSlip}>🖨️ {t("actions.print_slip")}</button>
                  </div>

                  {/* Earnings mini-table */}
                  <div className="pay-slip-section-title">{t("financials.earnings")}</div>
                  {earnings.map(d => (
                    <div key={d.component.id} className="pay-slip-line">
                      <span>{d.component.name}</span>
                      {payroll && ["draft", "approved"].includes(payroll.status) ? (
                        <input className="pay-amt-input"
                          value={editAmounts[d.component.id] ?? "0"}
                          onChange={e => { setEditAmounts({ ...editAmounts, [d.component.id]: e.target.value }); setEditDirty(true); }}
                        />
                      ) : (
                        <span className="pay-slip-amt">{fmtNum(d.amount)}</span>
                      )}
                    </div>
                  ))}
                  <div className="pay-slip-subtotal"><span>{t("financials.gross_salary")}</span><strong>{fmtNum(selItem.gross_salary)}</strong></div>

                  <div className="pay-slip-section-title">{t("financials.deductions")}</div>
                  {deductions.map(d => (
                    <div key={d.component.id} className="pay-slip-line pay-slip-line--ded">
                      <span>{d.component.name}</span>
                      {payroll && ["draft", "approved"].includes(payroll.status) ? (
                        <input className="pay-amt-input pay-amt-input--ded"
                          value={editAmounts[d.component.id] ?? "0"}
                          onChange={e => { setEditAmounts({ ...editAmounts, [d.component.id]: e.target.value }); setEditDirty(true); }}
                        />
                      ) : (
                        <span className="pay-slip-amt pay-ded">{fmtNum(d.amount)}</span>
                      )}
                    </div>
                  ))}
                  <div className="pay-slip-subtotal pay-slip-subtotal--ded"><span>{t("financials.total_deductions")}</span><strong className="pay-ded">{fmtNum(selItem.total_deductions)}</strong></div>

                  <div className="pay-net-box">
                    <div className="pay-net-label">{t("financials.net_salary")}</div>
                    <div className="pay-net-amount">{fmt(selItem.net_salary)}</div>
                    <div className="pay-net-words">{numberToWords(selItem.net_salary)}</div>
                  </div>

                  {/* Per-employee payment & email actions */}
                  {payroll && (
                    <div className="pay-item-actions">
                      {payroll.status === "posted" && selItem.payment_status !== "paid" && (
                        <button className="pay-btn pay-btn--green pay-btn--full" onClick={() => payItem(selItem)} disabled={busy}>
                          {busy ? "Processing…" : "✅ Mark This Employee Paid"}
                        </button>
                      )}
                      {selItem.payment_status === "paid" && (
                        <div className="pay-paid-badge">✅ Paid {selItem.payment_date ? `on ${selItem.payment_date}` : ""}</div>
                      )}
                      {["posted", "paid"].includes(payroll.status) && (
                        <button className="pay-btn pay-btn--outline pay-btn--full" onClick={() => resendEmail(selItem)} disabled={busy}>
                          {busy ? "Sending…" : `✉ ${selItem.email_status === "sent" ? "Resend" : "Send"} Salary Slip Email`}
                        </button>
                      )}
                      {selItem.email_sent_at && (
                        <div className="pay-email-info">Last emailed: {new Date(selItem.email_sent_at).toLocaleString()} -- <span style={{ color: selItem.email_status === "sent" ? "#059669" : "#ef4444" }}>{selItem.email_status}</span></div>
                      )}
                      {!selItem.employee.email && ["posted", "paid"].includes(payroll.status) && (
                        <div className="pay-email-info pay-email-info--warn">⚠ No work email -- slip cannot be emailed</div>
                      )}
                    </div>
                  )}

                  {/* Payment info */}
                  {payroll && ["draft", "approved"].includes(payroll.status) && (
                    <div className="pay-payment-edit">
                      <label>{t("financials.payment_method")}
                        <select value={editMethod} onChange={e => { setEditMethod(e.target.value); setEditDirty(true); }}>
                          <option value="bank_transfer">Bank Transfer</option>
                          <option value="cash">Cash</option>
                          <option value="mobile_money">Mobile Money</option>
                        </select>
                      </label>
                      <label>{t("financials.reference")}
                        <input value={editRef} onChange={e => { setEditRef(e.target.value); setEditDirty(true); }} placeholder="Transaction ref..." />
                      </label>
                    </div>
                  )}

                  {editDirty && (
                    <button className="pay-btn pay-btn--green pay-save-btn" onClick={saveItem} disabled={busy}>
                      {busy ? t("form.saving") : `💾 ${t("actions.save_changes")}`}
                    </button>
                  )}
                </>
              )}
            </div>}
          </div>
        </>
      )}


      {/* ══════════════════════════════════════════════════════════════
          TAB: MY SALARY SLIPS (employee self-service)
          ══════════════════════════════════════════════════════════════ */}
      {tab === "myslips" && isPayrollAdmin && (
        <div className="pay-myslips">
          {/* Employee info card */}
          {myEmployee && (
            <div className="pay-emp-card">
              <div className="pay-emp-avatar">{myEmployee.full_name.charAt(0).toUpperCase()}</div>
              <div className="pay-emp-details">
                <div className="pay-emp-card-name">{myEmployee.full_name}</div>
                <div className="pay-emp-card-meta">{myEmployee.employee_id} &nbsp;·&nbsp; {myEmployee.designation} &nbsp;·&nbsp; {myEmployee.department}</div>
                <div className="pay-emp-card-meta">{myEmployee.branch} &nbsp;·&nbsp; <span style={{ textTransform: "capitalize" }}>{myEmployee.employment_type}</span></div>
              </div>
              {/* Year filter */}
              <div className="pay-year-filter">
                <label className="pay-year-filter-label">Year</label>
                <select
                  className="pay-year-sel"
                  value={myYearFilter}
                  onChange={e => {
                    const yr = Number(e.target.value);
                    setMyYearFilter(yr);
                    // auto-select first slip of that year
                    const first = mySlips.find((s: any) => s.payroll?.year === yr);
                    if (first) setMySelSlip(first);
                  }}
                >
                  {[...new Set(mySlips.map((s: any) => s.payroll?.year).filter(Boolean))].sort((a, b) => b - a).map((yr: any) => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>
              {mySelSlip && (
                <button className="pay-btn pay-btn--primary" onClick={printMySlip}>🖨️ Print Slip</button>
              )}
            </div>
          )}

          {!myEmployee && (
            <div className="pay-empty pay-empty--big">
              <div className="pay-empty-icon">🔍</div>
              <div>No employee record is linked to your account.</div>
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>Ask your administrator to link your user account to an employee profile.</div>
            </div>
          )}

          {myEmployee && mySlips.length === 0 && (
            <div className="pay-empty pay-empty--big">
              <div className="pay-empty-icon">📭</div>
              <div>No salary slips available yet.</div>
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>Slips appear here once payroll is approved or posted.</div>
            </div>
          )}

          {myEmployee && mySlips.length > 0 && (() => {
            const filteredSlips = mySlips.filter((s: any) => s.payroll?.year === myYearFilter);
            return (
              <div className="pay-3col">
                {/* Left: slip list filtered by year */}
                <div className="pay-col-left">
                  <div className="pay-col-hd">
                    {myYearFilter} -- {filteredSlips.length} slip{filteredSlips.length !== 1 ? "s" : ""}
                  </div>
                  {filteredSlips.length === 0 && (
                    <div className="pay-empty" style={{ padding: "24px 16px" }}>
                      <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center" }}>No slips for {myYearFilter}</div>
                    </div>
                  )}
                  {filteredSlips.map((slip: any) => (
                    <div key={slip.id}
                      className={`pay-run-card ${mySelSlip?.id === slip.id ? "pay-run-card--active" : ""}`}
                      onClick={() => setMySelSlip(slip)}
                    >
                      <div className="pay-run-no">{slip.payroll?.payroll_no}</div>
                      <div className="pay-run-period">{getMonthName((slip.payroll?.month || 1) - 1)} {slip.payroll?.year}</div>
                      <div className="pay-run-row">
                        <span className="pay-badge" style={{ background: statusColor[slip.payroll?.status] + "22", color: statusColor[slip.payroll?.status], border: `1px solid ${statusColor[slip.payroll?.status]}44` }}>
                          {slip.payroll?.status?.toUpperCase()}
                        </span>
                        <span className="pay-run-date">{slip.payroll?.pay_date}</span>
                      </div>
                      <div className="pay-run-net">{fmt(slip.net_salary)}</div>
                      {slip.payment_status === "paid" && (
                        <div className="pay-run-paid-pill">✅ Paid{slip.payment_date ? ` · ${slip.payment_date}` : ""}</div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Center: slip detail */}
                <div className="pay-col-center">
                  {!mySelSlip ? (
                    <div className="pay-empty pay-empty--big"><div className="pay-empty-icon">👈</div><div>Select a payslip to view details</div></div>
                  ) : (
                    <>
                      <div className="pay-payroll-hd">
                        <div>
                          <div className="pay-payroll-title">{mySelSlip.payroll?.payroll_no} -- {getMonthName((mySelSlip.payroll?.month || 1) - 1)} {mySelSlip.payroll?.year}</div>
                          <div className="pay-payroll-sub">Pay Date: {mySelSlip.payroll?.pay_date}</div>
                        </div>
                        <button className="pay-btn pay-btn--primary" onClick={printMySlip}>🖨️ Print</button>
                      </div>
                      <div className="pay-summary-row" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
                        <div className="pay-stat pay-stat--earn"><span>{fmtNum(mySelSlip.gross_salary)}</span><label>{t("financials.gross_salary")}</label></div>
                        <div className="pay-stat pay-stat--ded"><span>{fmtNum(mySelSlip.total_deductions)}</span><label>{t("financials.deductions")}</label></div>
                        <div className="pay-stat pay-stat--net"><span>{fmtNum(mySelSlip.net_salary)}</span><label>{t("financials.net_salary")}</label></div>
                      </div>
                      <div className="pay-table-wrap">
                        <table className="pay-table">
                          <thead><tr><th>Component</th><th>Type</th><th className="pay-r">Amount (TZS)</th></tr></thead>
                          <tbody>
                            {mySelSlip.details?.map((d: any) => d.amount > 0 && (
                              <tr key={d.component.id}>
                                <td className="pay-bold">{d.component.name}</td>
                                <td>
                                  <span className="pay-badge" style={{ background: d.component.type === "earning" ? "#d1fae522" : "#fee2e222", color: d.component.type === "earning" ? "#059669" : "#ef4444", border: `1px solid ${d.component.type === "earning" ? "#a7f3d0" : "#fca5a5"}` }}>
                                    {d.component.type}
                                  </span>
                                </td>
                                <td className={`pay-r pay-bold ${d.component.type === "deduction" ? "pay-ded" : ""}`}>{fmtNum(d.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>

                {/* Right: net + payment status */}
                <div className="pay-col-right">
                  {mySelSlip ? (
                    <>
                      <div style={{ padding: "16px 16px 0" }}>
                        <div className="pay-net-box">
                          <div className="pay-net-label">{t("financials.net_salary")}</div>
                          <div className="pay-net-amount">{fmt(mySelSlip.net_salary)}</div>
                          <div className="pay-net-words">{numberToWords(mySelSlip.net_salary)}</div>
                        </div>
                      </div>

                      {/* Payment status panel -- clean, no clutter */}
                      <div className="pay-slip-status-panel">
                        {mySelSlip.payment_status === "paid" ? (
                          <div className="pay-slip-paid-block">
                            <div className="pay-slip-paid-icon">✅</div>
                            <div className="pay-slip-paid-label">Salary Paid</div>
                            <div className="pay-slip-paid-date">{mySelSlip.payment_date || mySelSlip.payroll?.pay_date}</div>
                            {mySelSlip.payment_method && (
                              <div className="pay-slip-paid-method">{mySelSlip.payment_method.replace(/_/g, " ")}</div>
                            )}
                            {mySelSlip.payment_reference && (
                              <div className="pay-slip-paid-ref">Ref: {mySelSlip.payment_reference}</div>
                            )}
                          </div>
                        ) : (
                          <div className="pay-slip-pending-block">
                            <div className="pay-slip-paid-icon">⏳</div>
                            <div className="pay-slip-paid-label" style={{ color: "#f59e0b" }}>Payment Pending</div>
                            <div className="pay-slip-paid-date">Status: {mySelSlip.payroll?.status}</div>
                          </div>
                        )}

                        {/* Email status -- clean single line */}
                        <div className="pay-slip-email-row">
                          {mySelSlip.email_status === "sent" ? (
                            <span className="pay-slip-email-badge pay-slip-email-badge--sent">✉ Slip emailed {mySelSlip.email_sent_at ? new Date(mySelSlip.email_sent_at).toLocaleDateString() : ""}</span>
                          ) : mySelSlip.email_status === "no_email" || !mySelSlip.employee?.email ? (
                            <span className="pay-slip-email-badge pay-slip-email-badge--none">⚠ No email on record</span>
                          ) : mySelSlip.email_status === "failed" ? (
                            <span className="pay-slip-email-badge pay-slip-email-badge--fail">✕ Email delivery failed</span>
                          ) : (
                            <span className="pay-slip-email-badge pay-slip-email-badge--pending">⏳ Email not yet sent</span>
                          )}
                        </div>
                      </div>

                      <div style={{ padding: "0 16px 16px" }}>
                        <button className="pay-btn pay-btn--primary" style={{ width: "100%" }} onClick={printMySlip}>
                          🖨️ Print Salary Slip
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="pay-empty pay-empty--big"><div className="pay-empty-icon">🧾</div><div>Select a slip to preview</div></div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* --- Tab: Department Breakdown ---------------------------------------- */}
      {tab === "breakdown" && (
        <div style={{ padding: "10px 16px 24px", width: "100%" }}>
          {!payroll ? (
            <div className="pay-empty pay-empty--big">
              <div className="pay-empty-icon">🏢</div>
              <div>Select a payroll run from the <strong>Payroll Runs</strong> tab first</div>
            </div>
          ) : breakdown.length === 0 ? (
            <div className="pay-empty pay-empty--big">
              <div className="pay-empty-icon">📊</div>
              <div>No department breakdown available for this payroll run</div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#102a43" }}>Department Breakdown</div>
                  <div style={{ fontSize: 12, color: "#8a7338", marginTop: 2 }}>{payroll.payroll_no} · {payroll.pay_date}</div>
                </div>
                <span className="pay-badge" style={{ background: (statusColor[payroll.status] || "#059669") + "22", color: statusColor[payroll.status] || "#059669", border: `1px solid ${(statusColor[payroll.status] || "#059669")}44`, fontSize: 12, padding: "5px 14px" }}>
                  {payroll.status.toUpperCase()}
                </span>
              </div>
              <div style={{ background: "white", borderRadius: 14, border: "1px solid #e8d5b0", overflow: "hidden", boxShadow: "0 4px 16px rgba(74,60,26,0.08)" }}>
                <table className="pay-table">
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th className="pay-r">Staff</th>
                      <th className="pay-r">Gross</th>
                      <th className="pay-r">Net</th>
                      <th className="pay-r">Paid</th>
                      <th className="pay-r">Emailed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((b, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600, color: "#102a43" }}>{b.department || "Unassigned"}</td>
                        <td className="pay-r">{b.headcount}</td>
                        <td className="pay-r pay-bold">{fmtNum(b.gross)}</td>
                        <td className="pay-r pay-net">{fmtNum(b.net)}</td>
                        <td className="pay-r">{b.paid_count}/{b.headcount}</td>
                        <td className="pay-r">{b.emailed_count}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "linear-gradient(135deg,#102a43,#1d3a5f)" }}>
                      <td style={{ fontWeight: 800, color: "#e2bc8a", padding: "10px 14px", fontSize: 12 }}>TOTALS</td>
                      <td className="pay-r" style={{ color: "#e2bc8a", padding: "10px 14px", fontWeight: 700 }}>{breakdown.reduce((s, b) => s + b.headcount, 0)}</td>
                      <td className="pay-r" style={{ color: "#e2bc8a", padding: "10px 14px", fontWeight: 700 }}>{fmtNum(breakdown.reduce((s, b) => s + Number(b.gross), 0))}</td>
                      <td className="pay-r" style={{ color: "#10b981", padding: "10px 14px", fontWeight: 800 }}>{fmtNum(breakdown.reduce((s, b) => s + Number(b.net), 0))}</td>
                      <td className="pay-r" style={{ color: "#e2bc8a", padding: "10px 14px", fontWeight: 700 }}>{breakdown.reduce((s, b) => s + b.paid_count, 0)}/{breakdown.reduce((s, b) => s + b.headcount, 0)}</td>
                      <td className="pay-r" style={{ color: "#e2bc8a", padding: "10px 14px", fontWeight: 700 }}>{breakdown.reduce((s, b) => s + b.emailed_count, 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* --- Tab: Salary Components ------------------------------------------- */}
      {tab === "components" && (
        <div className="pay-card">
          <div className="pay-card-hd">
            <h2>{t("salary_components")}</h2>
            <p>{t("comp_desc", { defaultValue: "Define earnings and deductions used across all payrolls." })}</p>
          </div>
          <div className="pay-table-wrap">
            <table className="pay-table">
              <thead>
                <tr><th>{t("columns.code")}</th><th>{t("columns.name")}</th><th>{t("columns.type")}</th><th>{t("columns.taxable")}</th><th>{t("columns.statutory")}</th><th className="pay-r">{t("columns.default_amount")}</th><th>{t("columns.active")}</th><th>{t("columns.order")}</th><th>{t("columns.actions")}</th></tr>
              </thead>
              <tbody>
                {components.map(c => (
                  <tr key={c.id}>
                    <td><code className="pay-code">{c.code}</code></td>
                    <td className="pay-bold">{c.name}</td>
                    <td>
                      <span className="pay-badge" style={{ background: c.type === "earning" ? "#d1fae522" : "#fee2e222", color: c.type === "earning" ? "#059669" : "#ef4444", border: `1px solid ${c.type === "earning" ? "#a7f3d0" : "#fca5a5"}` }}>
                        {c.type}
                      </span>
                    </td>
                    <td>{c.taxable ? "✅" : "--"}</td>
                    <td>{c.statutory ? "⚖️" : "--"}</td>
                    <td className="pay-r">{fmtNum(c.default_amount)}</td>
                    <td>
                      <span style={{ color: c.active ? "#10b981" : "#94a3b8", fontWeight: 700 }}>{c.active ? t("columns.active") : t("inactive", { defaultValue: "Inactive" })}</span>
                    </td>
                    <td className="pay-tc">{c.sort_order}</td>
                    <td>
                      <button className="pay-act-btn" onClick={() => openCompForm(c)}>{t("actions.edit")}</button>
                      <button className="pay-act-btn pay-act-btn--del" onClick={() => deleteComp(c)}>{t("actions.del")}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- Tab: Employees --------------------------------------------------- */}
      {tab === "employees" && (
        <div className="pay-card">
          <div className="pay-card-hd">
            <h2>{t("employee_register")}</h2>
            <p>{t("emp_register_desc", { defaultValue: "Employees listed here are automatically included in new payroll runs." })}</p>
          </div>
          <div className="pay-table-wrap">
            <table className="pay-table">
              <thead>
                <tr><th>{t("columns.emp_id")}</th><th>{t("columns.name")}</th><th>{t("columns.department")}</th><th>{t("columns.designation")}</th><th>{t("columns.branch")}</th><th>{t("columns.type")}</th><th className="pay-r">{t("columns.basic_salary")}</th><th>{t("columns.bank")}</th><th>{t("columns.status")}</th><th>{t("columns.actions")}</th></tr>
              </thead>
              <tbody>
                {employees.length === 0 && <tr><td colSpan={10} className="pay-tc pay-empty-sm">No employees yet -- click "Add Employee"</td></tr>}
                {employees.map(e => (
                  <tr key={e.id}>
                    <td><code className="pay-code">{e.employee_id}</code></td>
                    <td className="pay-bold">{e.full_name}</td>
                    <td>{e.department || "--"}</td>
                    <td>{e.designation || "--"}</td>
                    <td>{e.branch || "--"}</td>
                    <td style={{ textTransform: "capitalize" }}>{e.employment_type}</td>
                    <td className="pay-r pay-bold">{fmtNum(e.basic_salary)}</td>
                    <td>{e.bank_name ? `${e.bank_name} ···${(e.bank_account || "").slice(-4)}` : "--"}</td>
                    <td><span style={{ color: e.active ? "#10b981" : "#94a3b8", fontWeight: 700 }}>{e.active ? t("columns.active") : t("inactive", { defaultValue: "Inactive" })}</span></td>
                    <td>
                      <button className="pay-act-btn" onClick={() => openEmpForm(e)}>{t("actions.edit")}</button>
                      <button className="pay-act-btn pay-act-btn--del" onClick={() => deleteEmp(e)}>{t("actions.del")}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ││││││││││││││││││││││││││││││││││││││││││││││││││││││││││││││
          MODAL: Create Payroll
          ││││││││││││││││││││││││││││││││││││││││││││││││││││││││││││││ */}
      {showCreate && (
        <div className="pay-overlay" onClick={() => setShowCreate(false)}>
          <div className="pay-modal" onClick={e => e.stopPropagation()}>
            <div className="pay-modal-hd">{t("new_payroll_run")}</div>
            <div className="pay-modal-body">
              <div className="pay-form-row">
                <label>{t("month")}
                  <select value={cpMonth} onChange={e => setCpMonth(Number(e.target.value))}>
                    {Array.from({ length: 12 }).map((_, i) => <option key={i} value={i + 1}>{getMonthName(i)}</option>)}
                  </select>
                </label>
                <label>{t("year")}
                  <select value={cpYear} onChange={e => setCpYear(Number(e.target.value))}>
                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </label>
              </div>
              <label className="pay-full">{t("pay_date")}
                <input type="date" value={cpDate} onChange={e => setCpDate(e.target.value)} />
              </label>
              <label className="pay-full">{t("notes")}
                <textarea value={cpNotes} onChange={e => setCpNotes(e.target.value)} rows={2} placeholder="e.g. June 2026 monthly payroll" />
              </label>
              <p className="pay-modal-hint">All active employees will be auto-added with pre-calculated PAYE, NSSF &amp; NHIF amounts.</p>
            </div>
            <div className="pay-modal-ft">
              <button className="pay-btn pay-btn--outline" onClick={() => setShowCreate(false)}>{t("cancel")}</button>
              <button className="pay-btn pay-btn--primary" onClick={createPayroll} disabled={busy}>{busy ? t("form.saving") : t("new_payroll_run")}</button>
            </div>
          </div>
        </div>
      )}

      {/* --- Modal: Salary Component Form ------------------------------------- */}
      {showCompForm && (
        <div className="pay-overlay" onClick={() => setShowCompForm(false)}>
          <div className="pay-modal" onClick={e => e.stopPropagation()}>
            <div className="pay-modal-hd">{editComp ? "Edit Component" : "New Salary Component"}</div>
            <div className="pay-modal-body">
              <div className="pay-form-row">
                <label>Code
                  <input value={compForm.code || ""} onChange={e => setCompForm({ ...compForm, code: e.target.value })} placeholder="e.g. RISK" />
                </label>
                <label>Name
                  <input value={compForm.name || ""} onChange={e => setCompForm({ ...compForm, name: e.target.value })} />
                </label>
              </div>
              <div className="pay-form-row">
                <label>Type
                  <select value={compForm.type || "earning"} onChange={e => setCompForm({ ...compForm, type: e.target.value })}>
                    <option value="earning">Earning</option>
                    <option value="deduction">Deduction</option>
                  </select>
                </label>
                <label>Default Amount
                  <input type="number" value={compForm.default_amount || 0} onChange={e => setCompForm({ ...compForm, default_amount: e.target.value })} min="0" />
                </label>
              </div>
              <div className="pay-form-row">
                <label>Sort Order
                  <input type="number" value={compForm.sort_order || 0} onChange={e => setCompForm({ ...compForm, sort_order: e.target.value })} />
                </label>
                <div className="pay-check-group">
                  <label className="pay-check"><input type="checkbox" checked={!!compForm.taxable} onChange={e => setCompForm({ ...compForm, taxable: e.target.checked })} /> Taxable</label>
                  <label className="pay-check"><input type="checkbox" checked={!!compForm.statutory} onChange={e => setCompForm({ ...compForm, statutory: e.target.checked })} /> Statutory</label>
                  <label className="pay-check"><input type="checkbox" checked={!!compForm.active} onChange={e => setCompForm({ ...compForm, active: e.target.checked })} /> Active</label>
                </div>
              </div>
            </div>
            <div className="pay-modal-ft">
              <button className="pay-btn pay-btn--outline" onClick={() => setShowCompForm(false)}>Cancel</button>
              <button className="pay-btn pay-btn--primary" onClick={saveComp}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* --- Modal: Employee Form --------------------------------------------- */}
      {showEmpForm && (
        <div className="pay-overlay" onClick={() => setShowEmpForm(false)}>
          <div className="pay-modal pay-modal--wide" onClick={e => e.stopPropagation()}>
            <div className="pay-modal-hd">{editEmp ? "Edit Employee" : "Add Employee"}</div>
            <div className="pay-modal-body">
              <div className="pay-form-row">
                <label>
                  Employee ID (auto-generated)
                  <input
                    value={nextIdLoading ? "Generating…" : (empForm.employee_id || "")}
                    readOnly={!editEmp}
                    onChange={e => editEmp && setEmpForm({ ...empForm, employee_id: e.target.value })}
                    placeholder="ORN-ZKM-2026-001"
                    style={{ background: !editEmp ? "#f1f5f9" : undefined, color: !editEmp ? "#1e5fae" : undefined, fontWeight: 700, fontFamily: "monospace", cursor: !editEmp ? "default" : undefined }}
                  />
                </label>
                <label>Full Name *<input value={empForm.full_name || ""} onChange={e => setEmpForm({ ...empForm, full_name: e.target.value })} /></label>
              </div>
              <div className="pay-form-row">
                <label>Department<input value={empForm.department || ""} onChange={e => setEmpForm({ ...empForm, department: e.target.value })} /></label>
                <label>Designation<input value={empForm.designation || ""} onChange={e => setEmpForm({ ...empForm, designation: e.target.value })} /></label>
              </div>
              <div className="pay-form-row">
                <label>Branch<input value={empForm.branch || ""} onChange={e => setEmpForm({ ...empForm, branch: e.target.value })} /></label>
                <label>Employment Type
                  <select value={empForm.employment_type || "permanent"} onChange={e => setEmpForm({ ...empForm, employment_type: e.target.value })}>
                    <option value="permanent">Permanent</option>
                    <option value="contract">Contract</option>
                    <option value="casual">Casual</option>
                    <option value="probation">Probation</option>
                  </select>
                </label>
              </div>
              <div className="pay-form-row">
                <label>Basic Salary (TZS) *<input type="number" value={empForm.basic_salary || 0} onChange={e => setEmpForm({ ...empForm, basic_salary: e.target.value })} min="0" /></label>
                <label>Phone<input value={empForm.phone || ""} onChange={e => setEmpForm({ ...empForm, phone: e.target.value })} /></label>
              </div>
              <div className="pay-form-row">
                <label>Bank Name<input value={empForm.bank_name || ""} onChange={e => setEmpForm({ ...empForm, bank_name: e.target.value })} /></label>
                <label>Account Number<input value={empForm.bank_account || ""} onChange={e => setEmpForm({ ...empForm, bank_account: e.target.value })} /></label>
              </div>
              <div className="pay-form-row">
                <label>TIN Number<input value={empForm.tin_number || ""} onChange={e => setEmpForm({ ...empForm, tin_number: e.target.value })} /></label>
                <label>NSSF Number<input value={empForm.nssf_number || ""} onChange={e => setEmpForm({ ...empForm, nssf_number: e.target.value })} /></label>
              </div>
              <div className="pay-form-row">
                <label>NHIF Number<input value={empForm.nhif_number || ""} onChange={e => setEmpForm({ ...empForm, nhif_number: e.target.value })} /></label>
                <label>Hire Date<input type="date" value={empForm.hire_date || ""} onChange={e => setEmpForm({ ...empForm, hire_date: e.target.value })} /></label>
              </div>
              <label className="pay-check"><input type="checkbox" checked={!!empForm.active} onChange={e => setEmpForm({ ...empForm, active: e.target.checked })} /> Active (included in payrolls)</label>
            </div>
            <div className="pay-modal-ft">
              <button className="pay-btn pay-btn--outline" onClick={() => setShowEmpForm(false)}>Cancel</button>
              <button className="pay-btn pay-btn--primary" onClick={saveEmp}>Save Employee</button>
            </div>
          </div>
        </div>
      )}

      {/* --- PRINT: Salary Slip (A4 portrait, hidden on screen) ---------------- */}
      {selItem && payroll && (
        <div className={`pay-print-slip ${printMode === "slip" ? "pay-print--active" : ""}`} ref={slipRef}>

          {/* Watermark — logo image, faint diagonal, shown in print CSS */}
          <div className="psl-watermark">
            <img src={orgLogo} alt="" />
          </div>

          {/* ══ LETTERHEAD HEADER (white, matches Financial Reports style) ══ */}
          <div className="psl-lh">
            <div className="psl-lh-left">
              <img src={orgLogo} alt={orgName} className="psl-lh-logo" />
              <div className="psl-lh-name">{orgName}</div>
              {orgTagline && <div className="psl-lh-tag">{orgTagline}</div>}
            </div>
            <div className="psl-lh-contacts">
              {orgAddress && (
                <div className="psl-lh-row">
                  <span className="psl-lh-ic">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg>
                  </span>
                  <span>{orgAddress}</span>
                </div>
              )}
              {orgEmail && (
                <div className="psl-lh-row">
                  <span className="psl-lh-ic">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>
                  </span>
                  <span>{orgEmail}</span>
                </div>
              )}
              {orgPhone && (
                <div className="psl-lh-row">
                  <span className="psl-lh-ic">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </span>
                  <span><strong>Mobile:</strong> {orgPhone}</span>
                </div>
              )}
              {!orgAddress && !orgEmail && !orgPhone && orgWebsite && (
                <div className="psl-lh-row">
                  <span className="psl-lh-ic">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  </span>
                  <span>{orgWebsite}</span>
                </div>
              )}
            </div>
          </div>
          {/* Colour bars (green + brand) */}
          <div className="psl-lh-bars">
            <div className="psl-lh-bar-green" />
            <div className="psl-lh-bar-blue" style={{ background: `linear-gradient(90deg,${org.brand_color || "#1565c0"},#1d8ad1)` }} />
          </div>

          {/* ══ DOCUMENT TITLE BAND ══ */}
          <div className="psl-hdr">
            <div className="psl-hdr-title-txt">SALARY SLIP</div>
            <div className="psl-hdr-conf">
              <div className="psl-gold-line" />
              <span>CONFIDENTIAL</span>
              <div className="psl-gold-line" />
            </div>
            <div className="psl-month-badge">{getMonthName((payroll.month || 1) - 1).toUpperCase()} {payroll.year}</div>
          </div>
          <div className="psl-gold-bar" />

          {/* ══ EMPLOYEE + PAY PERIOD ══ */}
          <div className="psl-info-row">
            {/* Employee */}
            <div className="psl-emp-block">
              <div className="psl-avatar">{selItem.employee.full_name.charAt(0).toUpperCase()}</div>
              <div className="psl-emp-detail">
                <div className="psl-emp-name">{selItem.employee.full_name}</div>
                <div className="psl-emp-desig">{selItem.employee.designation || "Staff"}</div>
                {[
                  ["Employee ID", selItem.employee.employee_id],
                  ["Department",  selItem.employee.department],
                  ["Date Joined", selItem.employee.date_of_joining],
                  ["Bank",        selItem.employee.bank_name],
                  ["TIN",         selItem.employee.tin_number],
                  ["Work Station",selItem.employee.branch],
                ].filter(([,v]) => v).map(([l, v], i) => (
                  <div key={i} className="psl-emp-row">
                    <span className="psl-emp-lbl">{l}</span>
                    <span className="psl-emp-val">: {v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pay period unified card */}
            <div className="psl-pay-card">
              <div className="psl-pay-card-hd">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0B1F3A" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                PAY PERIOD
              </div>
              {[
                ["Pay Period",   `${getMonthName((payroll.month || 1) - 1)} ${payroll.year}`],
                ["Pay Cycle",   "Monthly"],
                ["Payment Date", payroll.pay_date || "--"],
                ["Slip No.",    payroll.payroll_no || "--"],
              ].map(([l, v], i) => (
                <div key={i} className="psl-pay-row">
                  <span className="psl-pay-lbl">{l}</span>
                  <span className="psl-pay-val">{v}</span>
                </div>
              ))}
              <div className="psl-net-box">
                <div className="psl-net-left">
                  <div className="psl-net-label">NET PAY</div>
                  {(payroll.status === "paid" || payroll.status === "posted") && (
                    <div className="psl-paid-pill">✓ PAID</div>
                  )}
                </div>
                <div className="psl-net-right">
                  <div className="psl-net-cur">TZS</div>
                  <div className="psl-net-amt">{fmtNum(selItem.net_salary)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="psl-gold-rule" />

          {/* ══ EARNINGS & DEDUCTIONS ══ */}
          <div className="psl-columns">
            <div className="psl-col">
              <div className="psl-col-hd psl-earn-hd">EARNINGS</div>
              <table className="psl-table">
                <thead><tr><th>Description</th><th className="psl-r">Amount (TZS)</th></tr></thead>
                <tbody>
                  {earnings.filter(d => d.amount > 0).map(d => (
                    <tr key={d.component.id}><td>{d.component.name}</td><td className="psl-r">{fmtNum(d.amount)}</td></tr>
                  ))}
                  {earnings.filter(d => d.amount > 0).length === 0 && (
                    <tr><td colSpan={2} className="psl-empty-row">No earnings components</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="psl-subtotal psl-earn-foot"><td>Total Earnings</td><td className="psl-r">{fmtNum(selItem.gross_salary)}</td></tr>
                </tfoot>
              </table>
            </div>
            <div className="psl-col">
              <div className="psl-col-hd psl-ded-hd">DEDUCTIONS</div>
              <table className="psl-table">
                <thead><tr><th>Description</th><th className="psl-r" style={{color:"#b91c1c"}}>Amount (TZS)</th></tr></thead>
                <tbody>
                  {deductions.filter(d => d.amount > 0).map(d => (
                    <tr key={d.component.id}><td>{d.component.name}</td><td className="psl-r">{fmtNum(d.amount)}</td></tr>
                  ))}
                  {deductions.filter(d => d.amount > 0).length === 0 && (
                    <tr><td colSpan={2} className="psl-empty-row">No deductions</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="psl-subtotal psl-ded-foot"><td>Total Deductions</td><td className="psl-r">{fmtNum(selItem.total_deductions)}</td></tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ══ 4-STAT SUMMARY ══ */}
          <div className="psl-stats">
            {[
              { label: "GROSS PAY",       val: selItem.gross_salary,       color: "#0B1F3A" },
              { label: "TOTAL DEDUCTIONS",val: selItem.total_deductions,   color: "#b91c1c" },
              { label: "NET PAY",         val: selItem.net_salary,         color: "#065f46" },
              { label: "IN WORDS",        val: numberToWords(selItem.net_salary), color: "#92400e", isText: true },
            ].map((s, i) => (
              <div key={i} className="psl-stat-cell" style={{ borderRight: i < 3 ? "1px solid #e2e8f0" : "none" }}>
                <div className="psl-stat-label">{s.label}</div>
                {s.isText
                  ? <div className="psl-stat-words" style={{ color: s.color }}>{s.val}</div>
                  : <><div className="psl-stat-cur">TZS</div><div className="psl-stat-val" style={{ color: s.color }}>{fmtNum(s.val as number)}</div></>
                }
              </div>
            ))}
          </div>

          {/* ══ MESSAGE + AUTHORIZATION ══ */}
          <div className="psl-bottom">
            <div className="psl-msg">
              <div className="psl-section-hd">MESSAGE</div>
              <div className="psl-msg-body">Thank you for your dedication and commitment. Your hard work makes a difference to our mission and values.</div>
              <div className="psl-msg-quote">We value you!</div>
            </div>
            <div className="psl-auth">
              <div className="psl-section-hd">AUTHORIZED BY</div>
              {payroll.approved_by?.name
                ? <div className="psl-auth-name">{payroll.approved_by.name}</div>
                : <div className="psl-auth-blank" />
              }
              <div className="psl-auth-line" />
              <div className="psl-auth-role">Finance Manager — {orgName}</div>
              <div className="psl-auth-date">Generated: {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</div>
            </div>
          </div>

          {/* ══ FOOTER ══ */}
          <div className="psl-footer-bar">
            {orgPhone   && <span>{orgPhone}</span>}
            {orgEmail   && <span>{orgEmail}</span>}
            {orgWebsite && <span>{orgWebsite}</span>}
            {orgAddress && <span>{orgAddress}</span>}
            {!orgPhone && !orgEmail && !orgWebsite && !orgAddress && (
              <span>{orgName} · Confidential Payroll Document</span>
            )}
          </div>
          <div className="psl-footer-disc">
            THIS IS A COMPUTER GENERATED DOCUMENT AND DOES NOT REQUIRE A SIGNATURE.
          </div>
        </div>
      )}

      {/* --- PRINT: Payroll Statement (A4 landscape, hidden on screen) ------------ */}
      {payroll && (
        <div className={`pay-print-stmt ${printMode === "stmt" ? "pay-print--active" : ""}`}>
          <div className="pst-header">
            <div className="pst-hdr-top">
              <img src={orgLogo} alt={orgName} className="pst-logo" />
              <div>
                <div className="pst-company">{orgName.toUpperCase()} — PAYROLL STATEMENT</div>
                {orgTagline && <div className="pst-tagline">{orgTagline}</div>}
              </div>
            </div>
            <div className="pst-meta">
              <span>{payroll.payroll_no}</span>
              <span>Period: {getMonthName(payroll.month)} {payroll.year}</span>
              <span>Pay Date: {payroll.pay_date}</span>
              <span>Status: {payroll.status.toUpperCase()}</span>
            </div>
          </div>
          {payroll.status !== "paid" && payroll.status !== "posted" && (
            <div className="pst-watermark">{payroll.status.toUpperCase()}</div>
          )}
          <table className="pst-table">
            <thead>
              <tr>
                <th>#</th><th>Emp ID</th><th>Name</th><th>Department</th><th>Designation</th>
                <th className="pst-r">Gross</th><th className="pst-r">Deductions</th><th className="pst-r">Net Salary</th>
                <th>Bank</th><th>Account</th><th>Payment</th>
              </tr>
            </thead>
            <tbody>
              {payroll.items.map((item, idx) => (
                <tr key={item.id}>
                  <td>{idx + 1}</td>
                  <td>{item.employee.employee_id}</td>
                  <td style={{ fontWeight: 600 }}>{item.employee.full_name}</td>
                  <td>{item.employee.department}</td>
                  <td>{item.employee.designation}</td>
                  <td className="pst-r">{fmtNum(item.gross_salary)}</td>
                  <td className="pst-r">{fmtNum(item.total_deductions)}</td>
                  <td className="pst-r" style={{ fontWeight: 700 }}>{fmtNum(item.net_salary)}</td>
                  <td>{item.employee.bank_name || "--"}</td>
                  <td>{item.employee.bank_account || "--"}</td>
                  <td>{item.payment_status.replace("_", " ")}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="pst-total">
                <td colSpan={5}><strong>TOTALS -- {payroll.items.length} Employee(s)</strong></td>
                <td className="pst-r"><strong>{totals ? fmtNum(totals.gross) : "0"}</strong></td>
                <td className="pst-r"><strong>{totals ? fmtNum(totals.ded) : "0"}</strong></td>
                <td className="pst-r"><strong>{totals ? fmtNum(totals.net) : "0"}</strong></td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
          <div className="pst-sig-row">
            <div className="pst-sig"><div className="pst-sig-line" /><div>Prepared By / Payroll Officer</div></div>
            <div className="pst-sig"><div className="pst-sig-line" /><div>Approved By / {payroll.approved_by?.name || "General Manager"}</div></div>
            <div className="pst-sig"><div className="pst-sig-line" /><div>Finance Director</div></div>
          </div>
          <div className="pst-footer">Generated: {new Date().toLocaleString()} · {payroll.payroll_no} · Confidential -- For Internal Use Only</div>
        </div>
      )}

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
/* --- Page wrapper ---------------------------------------------------- */
.pay-page { flex:1; min-height:0; overflow-y:auto; overflow-x:hidden; background:#fffcf6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; display:flex; flex-direction:column; }

/* --- Tab bar --------------------------------------------------------- */
.pay-tab-bar { display:flex; align-items:center; gap:0; padding:0 18px; background:linear-gradient(135deg,#102a43,#1d3a5f); position:sticky; top:0; z-index:10; border-bottom:2px solid #0d2137; overflow-x:auto; flex-shrink:0; }
.pay-tab { white-space:nowrap; }
.pay-tab { padding:13px 22px; border:none; border-radius:0; font-size:13px; font-weight:700; cursor:pointer; background:transparent; color:rgba(255,255,255,.6); transition:all .15s; letter-spacing:.2px; }
.pay-tab--active { background:rgba(255,255,255,.1); color:#e2bc8a; box-shadow:0 -3px 0 #e2bc8a inset; }
.pay-tab:hover:not(.pay-tab--active) { background:rgba(255,255,255,.07); color:rgba(255,255,255,.9); }
.pay-tab-space { flex:1; }

/* --- Buttons --------------------------------------------------------- */
.pay-btn { padding:8px 16px; border:none; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; transition:all .15s; }
.pay-btn--primary  { background:linear-gradient(135deg,#102a43,#1d3a5f); color:#e2bc8a; } .pay-btn--primary:hover  { background:linear-gradient(135deg,#0d2137,#102a43); }
.pay-btn--blue     { background:#1e5fae; color:white; } .pay-btn--blue:hover     { background:#1d4ed8; }
.pay-btn--purple   { background:#7c3aed; color:white; } .pay-btn--purple:hover   { background:#6d28d9; }
.pay-btn--green    { background:#059669; color:white; } .pay-btn--green:hover    { background:#047857; }
.pay-btn--danger   { background:#ef4444; color:white; } .pay-btn--danger:hover   { background:#dc2626; }
.pay-btn--outline  { background:#fffcf6; color:#102a43; border:1.5px solid #c19a6b; } .pay-btn--outline:hover { background:#fdf3e3; border-color:#8a7338; }
.pay-btn:disabled  { opacity:.5; cursor:not-allowed; }

/* --- Filters bar ----------------------------------------------------- */
.pay-filters { display:flex; align-items:center; gap:10px; padding:8px 18px; background:#fffcf6; border-bottom:1px solid #e8d5b0; flex-shrink:0; }
.pay-filters select { padding:7px 12px; border:1.5px solid #c19a6b; border-radius:8px; font-size:13px; font-weight:600; color:#102a43; background:#fffcf6; cursor:pointer; }
.pay-filter-sep { width:1px; height:28px; background:#c19a6b; opacity:.4; flex-shrink:0; }
.pay-filter-run-scroll { display:flex; align-items:center; gap:6px; overflow-x:auto; flex:1; scrollbar-width:none; }
.pay-filter-run-scroll::-webkit-scrollbar { display:none; }
.pay-filter-run-btn { display:inline-flex; align-items:center; gap:7px; padding:5px 12px; border-radius:20px; border:1.5px solid #e8d5b0; background:#fffcf6; cursor:pointer; white-space:nowrap; transition:all .15s; flex-shrink:0; }
.pay-filter-run-btn:hover { background:#fdf3e3; border-color:#c19a6b; }
.pay-filter-run-btn--active { background:#102a43; border-color:#102a43; }
.pay-filter-run-btn--active .pay-filter-run-no { color:#e2bc8a; }
.pay-filter-run-btn--active .pay-filter-run-period { color:rgba(255,255,255,.65); }
.pay-filter-run-btn--active .pay-filter-run-date { color:rgba(226,188,138,.7); }
.pay-filter-run-no { font-size:12px; font-weight:800; color:#102a43; font-family:monospace; letter-spacing:.3px; }
.pay-filter-run-period { font-size:11px; color:#64748b; font-weight:600; }
.pay-filter-run-date { font-size:11px; color:#8a7338; font-weight:600; }

/* --- 3-column body --------------------------------------------------- */
.pay-3col { display:flex; flex:1; min-height:0; overflow:hidden; gap:0; }

/* Left column - payroll runs */
.pay-col-left { width:260px; min-width:220px; background:#fffcf6; border-right:1px solid #e8d5b0; overflow-y:auto; display:flex; flex-direction:column; }

/* Responsive: hide side panels on small screens, allow horizontal scroll */
@media (max-width: 900px) {
  .pay-3col { overflow-x: auto; }
  .pay-col-right { width: 280px; min-width: 240px; }
}
@media (max-width: 640px) {
  .pay-col-left { display: none !important; }
  .pay-col-right { display: none !important; }
  .pay-summary-row { grid-template-columns: repeat(2, 1fr); }
  .pay-filters { flex-wrap: wrap; }
}
/* Left column header */
.pay-col-hd { padding:14px 16px 10px; font-size:11px; font-weight:800; color:#8a7338; text-transform:uppercase; letter-spacing:.6px; border-bottom:1px solid #e8d5b0; background:#fdf3e3; }

.pay-run-card { display:block; width:100%; padding:12px 16px; border:none; border-bottom:1px solid #f0e4cc; border-left:3px solid transparent; background:transparent; cursor:pointer; text-align:left; transition:background .15s, border-left-color .15s; }
.pay-run-card:hover { background:#fdf3e3; border-left-color:#e2bc8a; }
.pay-run-card--active { background:#fdf3e3; border-left-color:#c19a6b; box-shadow:inset 2px 0 0 #c19a6b; }
.pay-run-no { font-size:12px; font-weight:800; color:#102a43; font-family:monospace; }
.pay-run-period { font-size:13px; color:#334155; font-weight:600; margin:2px 0; }
.pay-run-row { display:flex; justify-content:space-between; align-items:center; margin-top:4px; }
.pay-run-date { font-size:11px; color:#8a7338; }

/* Center column - employee table */
.pay-col-center { flex:1; min-width:0; display:flex; flex-direction:column; overflow:hidden; background:#fffcf6; }
.pay-payroll-hd { display:flex; justify-content:space-between; align-items:center; padding:10px 18px; background:linear-gradient(135deg,#102a43,#1d3a5f); border-bottom:1px solid #0d2137; flex-wrap:wrap; gap:8px; flex-shrink:0; }
.pay-payroll-meta { display:flex; align-items:center; gap:6px; flex-wrap:wrap; min-width:0; }
.pay-payroll-title { font-size:13px; font-weight:800; color:#e2bc8a; font-family:monospace; white-space:nowrap; }
.pay-payroll-sub { font-size:12px; color:rgba(255,255,255,.65); white-space:nowrap; }
.pay-payroll-dot { font-size:12px; color:rgba(255,255,255,.3); flex-shrink:0; }
.pay-payroll-actions { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }

/* pay-summary-row and pay-stat defined below near pay-emp-card */

.pay-table-wrap { flex:1; overflow:auto; min-height:220px; }
.pay-table { width:100%; border-collapse:collapse; font-size:13px; }
.pay-table thead th { position:sticky; top:0; background:linear-gradient(135deg,#102a43,#1d3a5f); padding:10px 14px; text-align:left; font-size:11px; font-weight:700; color:#e2bc8a; border-bottom:2px solid #0d2137; white-space:nowrap; }
.pay-table td { padding:10px 14px; border-bottom:1px solid #f0e4cc; vertical-align:middle; background:#fffcf6; }
.pay-tr { cursor:pointer; transition:background .1s; }
.pay-tr:hover td { background:#fdf3e3 !important; }
.pay-tr--active td { background:#fdf3e3 !important; }
.pay-emp-name { font-weight:700; color:#102a43; }
.pay-emp-sub  { font-size:11px; color:#8a7338; margin-top:1px; }
.pay-r { text-align:right !important; }
.pay-tc { text-align:center !important; }
.pay-bold { font-weight:700; color:#102a43; }
.pay-ded { color:#ef4444; }
.pay-net { color:#059669; font-weight:800; }

/* Right column - slip preview */
.pay-col-right { width:320px; min-width:280px; background:#fffcf6; border-left:1px solid #e8d5b0; overflow-y:auto; display:flex; flex-direction:column; gap:0; padding:0; }
.pay-slip-hd { display:flex; justify-content:space-between; align-items:flex-start; padding:14px 16px; border-bottom:1px solid #e8d5b0; gap:8px; position:sticky; top:0; background:linear-gradient(135deg,#102a43,#1d3a5f); z-index:2; }
.pay-slip-name { font-size:14px; font-weight:800; color:#e2bc8a; }
.pay-slip-role { font-size:11px; color:rgba(255,255,255,.6); margin-top:2px; }
.pay-slip-section-title { padding:8px 16px 4px; font-size:10px; font-weight:800; color:#8a7338; text-transform:uppercase; letter-spacing:.5px; background:#fdf3e3; border-top:1px solid #e8d5b0; border-bottom:1px solid #e8d5b0; }
.pay-slip-line { display:flex; justify-content:space-between; align-items:center; padding:6px 16px; border-bottom:1px solid #f0e4cc; }
.pay-slip-line span { font-size:12px; color:#475569; }
.pay-slip-line--ded span { color:#94a3b8; }
.pay-slip-amt { font-size:12px; font-weight:700; color:#102a43; }
.pay-amt-input { width:90px; padding:4px 8px; border:1.5px solid #c19a6b; border-radius:6px; font-size:12px; font-weight:700; text-align:right; color:#102a43; background:#fffcf6; }
.pay-amt-input:focus { outline:none; border-color:#8a7338; }
.pay-amt-input--ded { border-color:#fee2e2; color:#ef4444; }
.pay-slip-subtotal { display:flex; justify-content:space-between; padding:8px 16px; background:#fdf3e3; font-size:12px; border-top:1px solid #e8d5b0; }
.pay-slip-subtotal strong { color:#102a43; }
.pay-slip-subtotal--ded strong { color:#ef4444; }

.pay-gl-ref { font-size:11px; color:rgba(226,188,138,.7); font-weight:600; white-space:nowrap; }
.pay-analytics-panel { padding:16px; height:100%; overflow-y:auto; }
.pay-analytics-title { font-size:14px; font-weight:700; color:#102a43; margin-bottom:8px; }
/* pay-breakdown and pay-breakdown-title defined below near pay-emp-card */
.pay-item-actions { display:flex; flex-direction:column; gap:8px; padding:10px 16px; border-top:1px solid #e8d5b0; }
.pay-btn--full { width:100%; justify-content:center; }
.pay-paid-badge { background:#d1fae5; color:#065f46; border:1px solid #6ee7b7; border-radius:8px; padding:8px 12px; font-size:12px; font-weight:700; text-align:center; }
.pay-email-badge { font-size:10px; font-weight:700; padding:2px 6px; border-radius:6px; white-space:nowrap; }
.pay-email-badge--sent { background:#d1fae5; color:#065f46; border:1px solid #6ee7b744; }
.pay-email-badge--pending { background:#fef3c7; color:#92400e; border:1px solid #fcd34d44; }
.pay-email-badge--none { background:#fdf3e3; color:#8a7338; }
.pay-email-info { font-size:11px; color:#64748b; padding:0 2px; }
.pay-email-info--warn { color:#b45309; background:#fef3c7; border-radius:6px; padding:6px 8px; }

/* ── Payment Modal ────────────────────────────────────────────────────────── */
.ppm-overlay { position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:1000; display:flex; align-items:center; justify-content:center; padding:16px; }
.ppm-box { background:#fffcf6; border-radius:20px; width:100%; max-width:540px; max-height:90vh; overflow-y:auto; box-shadow:0 24px 64px rgba(0,0,0,0.22); display:flex; flex-direction:column; }
.ppm-hd { display:flex; align-items:flex-start; justify-content:space-between; padding:20px 22px 16px; border-bottom:1px solid #e8d5b0; background:linear-gradient(135deg,#102a43,#1d3a5f); border-radius:20px 20px 0 0; }
.ppm-title { font-size:16px; font-weight:900; color:#e2bc8a; }
.ppm-sub { font-size:12px; color:rgba(255,255,255,.6); margin-top:2px; font-weight:600; }
.ppm-close { border:none; background:rgba(255,255,255,.1); font-size:18px; color:rgba(255,255,255,.7); cursor:pointer; padding:2px 8px; border-radius:6px; }
.ppm-close:hover { background:rgba(255,255,255,.2); color:white; }

.ppm-amounts { margin:16px 22px; background:#fdf3e3; border:1px solid #e8d5b0; border-radius:12px; overflow:hidden; }
.ppm-amt-row { display:flex; justify-content:space-between; padding:9px 14px; font-size:13px; color:#334155; border-bottom:1px solid #e8d5b0; }
.ppm-amt-row:last-child { border-bottom:none; }
.ppm-amt-row--ded { color:#dc2626; }
.ppm-amt-row--net { background:linear-gradient(135deg,#102a43,#1d3a5f); color:#e2bc8a; font-weight:900; font-size:14px; }

.ppm-form { padding:0 22px 4px; display:flex; flex-direction:column; gap:14px; }
.ppm-field { display:flex; flex-direction:column; gap:6px; }
.ppm-field label { font-size:12px; font-weight:800; color:#475569; }
.ppm-label-hint { font-weight:500; color:#94a3b8; }
.ppm-field select,.ppm-field input { padding:9px 12px; border:1.5px solid #c19a6b; border-radius:10px; font-size:13px; color:#102a43; background:#fffcf6; }
.ppm-field select:focus,.ppm-field input:focus { outline:none; border-color:#8a7338; box-shadow:0 0 0 3px rgba(193,154,107,.2); }
.ppm-method-btns { display:flex; gap:8px; }
.ppm-method-btn { flex:1; padding:9px 6px; border:1.5px solid #c19a6b; border-radius:10px; background:#fffcf6; font-size:12px; font-weight:700; color:#8a7338; cursor:pointer; transition:all .15s; }
.ppm-method-btn--active { border-color:#102a43; background:#fdf3e3; color:#102a43; box-shadow:0 0 0 2px rgba(16,42,67,.15); }

.ppm-journal { margin:16px 22px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:14px; }
.ppm-journal-title { font-size:12px; font-weight:800; color:#065f46; margin-bottom:10px; }
.ppm-je-table { width:100%; border-collapse:collapse; font-size:12px; }
.ppm-je-table th { text-align:left; padding:6px 8px; background:#dcfce7; color:#065f46; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; }
.ppm-je-table td { padding:7px 8px; border-top:1px solid #bbf7d0; color:#166534; }
.ppm-dr { color:#102a43; font-weight:800; }
.ppm-cr { color:#059669; font-weight:800; }
.ppm-journal-note { font-size:10px; color:#6b7280; margin-top:8px; font-style:italic; }

.ppm-footer { display:flex; gap:10px; padding:16px 22px 20px; border-top:1px solid #e8d5b0; }
.ppm-btn { flex:1; padding:11px 16px; border:none; border-radius:10px; font-weight:800; font-size:13px; cursor:pointer; }
.ppm-btn--cancel { background:#fdf3e3; color:#8a7338; border:1px solid #c19a6b; }
.ppm-btn--confirm { background:linear-gradient(135deg,#102a43,#1d3a5f); color:#e2bc8a; }
.ppm-btn--confirm:disabled,.ppm-btn--cancel:disabled { opacity:.5; cursor:not-allowed; }
.pay-net-box { margin:12px 16px; background:linear-gradient(135deg,#102a43,#1d3a5f); border-radius:12px; padding:16px; color:white; text-align:center; }
.pay-net-label { font-size:10px; font-weight:800; letter-spacing:1px; opacity:.7; }
.pay-net-amount { font-size:20px; font-weight:900; margin:4px 0; color:#e2bc8a; }
.pay-net-words { font-size:9px; opacity:.8; line-height:1.4; }
/* Year filter in emp-card header */
.pay-year-filter { display:flex; align-items:center; gap:6px; margin-left:auto; margin-right:8px; }
.pay-year-filter-label { font-size:11px; font-weight:700; color:rgba(255,255,255,.6); }
.pay-year-sel { font-size:12px; font-weight:700; border:1.5px solid #c19a6b; border-radius:6px; padding:4px 8px; background:#fffcf6; color:#102a43; cursor:pointer; }
.pay-year-sel:focus { outline:none; border-color:#8a7338; }
/* Slip list enhancements */
.pay-run-net { margin-top:6px; font-weight:800; color:#059669; font-size:14px; }
.pay-run-paid-pill { display:inline-block; margin-top:5px; font-size:10px; font-weight:700; background:#d1fae5; color:#065f46; border-radius:20px; padding:2px 8px; }
/* Payment status panel in My Slips right column */
.pay-slip-status-panel { margin:0 16px 12px; border:1.5px solid #e8d5b0; border-radius:10px; overflow:hidden; }
.pay-slip-paid-block { padding:14px 16px; text-align:center; background:#f0fdf4; border-bottom:1px solid #d1fae5; }
.pay-slip-pending-block { padding:14px 16px; text-align:center; background:#fffbeb; border-bottom:1px solid #fde68a; }
.pay-slip-paid-icon { font-size:22px; margin-bottom:4px; }
.pay-slip-paid-label { font-size:13px; font-weight:800; color:#065f46; }
.pay-slip-paid-date { font-size:11px; color:#047857; margin-top:2px; }
.pay-slip-paid-method { font-size:10px; color:#64748b; text-transform:capitalize; margin-top:2px; }
.pay-slip-paid-ref { font-size:10px; color:#94a3b8; margin-top:1px; }
/* Email status badge */
.pay-slip-email-row { padding:8px 12px; }
.pay-slip-email-badge { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:600; border-radius:6px; padding:4px 10px; }
.pay-slip-email-badge--sent { background:#dbeafe; color:#1e40af; }
.pay-slip-email-badge--none { background:#fef3c7; color:#92400e; }
.pay-slip-email-badge--fail { background:#fee2e2; color:#991b1b; }
.pay-slip-email-badge--pending { background:#fdf3e3; color:#8a7338; }

.pay-payment-edit { padding:10px 16px; display:flex; flex-direction:column; gap:8px; border-top:1px solid #e8d5b0; }
.pay-payment-edit label { font-size:11px; font-weight:700; color:#475569; display:flex; flex-direction:column; gap:4px; }
.pay-payment-edit select, .pay-payment-edit input { padding:6px 10px; border:1.5px solid #c19a6b; border-radius:7px; font-size:12px; background:#fffcf6; }
.pay-save-btn { margin:12px 16px; width:calc(100% - 32px); padding:10px; }

/* --- Badges ---------------------------------------------------------- */
.pay-badge { display:inline-block; padding:3px 8px; border-radius:999px; font-size:10px; font-weight:800; letter-spacing:.3px; }
.pay-badge--lg { padding:5px 12px; font-size:11px; }

/* --- Empty states ---------------------------------------------------- */
.pay-empty { padding:16px; text-align:center; color:#8a7338; font-size:13px; }
.pay-empty--big { display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1; gap:12px; color:#8a7338; font-size:13px; padding:40px; }
.pay-empty-icon { font-size:40px; opacity:.3; }
.pay-empty-sm { padding:20px; color:#8a7338; font-size:13px; }

/* --- My Slips admin header (pay-emp-card) ---------------------------- */
.pay-myslips { display:flex; flex-direction:column; flex:1; min-height:0; overflow:hidden; }
.pay-emp-card { display:flex; align-items:center; gap:16px; padding:0 24px; background:linear-gradient(135deg,#102a43,#1d3a5f); flex-shrink:0; min-height:72px; position:relative; overflow:hidden; }
.pay-emp-card::after { content:""; position:absolute; right:-30px; top:-30px; width:140px; height:140px; border-radius:50%; background:rgba(255,255,255,.04); pointer-events:none; }
.pay-emp-avatar { width:44px; height:44px; border-radius:50%; background:linear-gradient(135deg,#c19a6b,#e2bc8a); color:#102a43; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:19px; flex-shrink:0; border:2px solid rgba(226,188,138,.4); }
.pay-emp-details { flex:1; min-width:0; }
.pay-emp-card-name { font-size:15px; font-weight:800; color:#e2bc8a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pay-emp-card-meta { font-size:11px; color:rgba(255,255,255,.55); margin-top:2px; }

/* --- Summary row — compact ------------------------------------------- */
.pay-summary-row { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; padding:8px 16px; background:#fdf3e3; border-bottom:1px solid #e8d5b0; flex-shrink:0; }
.pay-stat { background:#fffcf6; border-radius:8px; padding:8px 12px; text-align:center; border:1px solid #e8d5b0; }
.pay-stat span { display:block; font-size:14px; font-weight:800; color:#102a43; }
.pay-stat label { display:block; font-size:9px; color:#8a7338; font-weight:700; text-transform:uppercase; margin-top:1px; letter-spacing:.3px; }
.pay-stat--earn span { color:#059669; }
.pay-stat--ded span  { color:#ef4444; }
.pay-stat--net  { background:linear-gradient(135deg,#102a43,#1d3a5f); border-color:#0d2137; }
.pay-stat--net span { color:#e2bc8a; }
.pay-stat--net label { color:rgba(255,255,255,.6); }

/* --- Department breakdown — compact with max-height ------------------- */
.pay-breakdown { padding:0; border-top:1px solid #e8d5b0; margin:0; flex-shrink:0; max-height:180px; overflow:hidden; display:flex; flex-direction:column; }
.pay-breakdown-title { font-size:10px; font-weight:800; color:#8a7338; text-transform:uppercase; letter-spacing:.6px; padding:6px 16px; background:#fdf3e3; border-bottom:1px solid #e8d5b0; flex-shrink:0; }

/* --- Card (for components/employees tabs) ---------------------------- */
.pay-card { margin:18px; background:#fffcf6; border-radius:16px; border:1px solid #e8d5b0; overflow:clip; }
.pay-card-hd { padding:18px 20px 14px; border-bottom:1px solid #e8d5b0; background:linear-gradient(135deg,#102a43,#1d3a5f); }
.pay-card-hd h2 { font-size:18px; font-weight:800; color:#e2bc8a; margin:0 0 4px; }
.pay-card-hd p  { font-size:13px; color:rgba(255,255,255,.6); margin:0; }
.pay-code { background:#fdf3e3; padding:2px 7px; border-radius:5px; font-size:12px; color:#8a7338; font-weight:700; }
.pay-act-btn { padding:4px 10px; border:1.5px solid #c19a6b; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer; background:#fffcf6; color:#102a43; margin-right:4px; }
.pay-act-btn:hover { background:#fdf3e3; }
.pay-act-btn--del { color:#ef4444; border-color:#fee2e2; }
.pay-act-btn--del:hover { background:#fef2f2; }
.pay-check-group { display:flex; flex-direction:column; gap:6px; padding-top:20px; }
.pay-check { display:flex; align-items:center; gap:6px; font-size:13px; font-weight:600; color:#102a43; cursor:pointer; }
.pay-check input { width:15px; height:15px; cursor:pointer; }

/* --- Overlays / Modals ----------------------------------------------- */
.pay-overlay { position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px; }
.pay-modal { background:#fffcf6; border-radius:16px; width:520px; max-width:100%; max-height:90vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,.25); }
.pay-modal--wide { width:720px; }
.pay-modal-hd { padding:18px 22px 14px; font-size:18px; font-weight:800; color:#e2bc8a; border-bottom:1px solid #e8d5b0; background:linear-gradient(135deg,#102a43,#1d3a5f); border-radius:16px 16px 0 0; }
.pay-modal-body { padding:18px 22px; display:flex; flex-direction:column; gap:14px; }
.pay-modal-body label { display:flex; flex-direction:column; gap:5px; font-size:12px; font-weight:700; color:#475569; }
.pay-modal-body input, .pay-modal-body select, .pay-modal-body textarea { padding:9px 12px; border:1.5px solid #c19a6b; border-radius:9px; font-size:14px; font-family:inherit; background:#fffcf6; color:#102a43; }
.pay-modal-body input:focus, .pay-modal-body select:focus, .pay-modal-body textarea:focus { outline:none; border-color:#8a7338; box-shadow:0 0 0 3px rgba(193,154,107,.2); }
.pay-modal-hint { font-size:11px; color:#8a7338; background:#fdf3e3; padding:10px 12px; border-radius:8px; margin:0; border:1px solid #e8d5b0; }
.pay-modal-ft { padding:14px 22px 18px; display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #e8d5b0; }
.pay-form-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.pay-full { grid-column:1/-1; }

/* --- PRINT: Salary Slip ---------------------------------------------- */
.pay-print-slip { display:none; }
.pay-print-stmt { display:none; }
.psl-watermark { display:none; }

@media print {
  /* ── Visibility isolation ── */
  body * { visibility:hidden !important; }
  .pay-print-slip.pay-print--active,
  .pay-print-slip.pay-print--active * { visibility:visible !important; }
  .pay-print-slip.pay-print--active {
    display:block !important;
    position:fixed !important;
    left:0 !important; top:0 !important;
    width:100vw !important;
    min-height:100vh !important;
    margin:0 !important; padding:0 !important;
    background:white !important;
    box-sizing:border-box !important;
    -webkit-print-color-adjust:exact !important;
    print-color-adjust:exact !important;
    z-index:99999 !important;
  }
  .pay-print-slip:not(.pay-print--active) { display:none !important; }

  /* ── Statement print ── */
  .pay-print-stmt.pay-print--active,
  .pay-print-stmt.pay-print--active * { visibility:visible !important; }
  .pay-print-stmt.pay-print--active {
    display:block !important;
    position:fixed !important;
    left:0 !important; top:0 !important;
    width:100vw !important;
    min-height:100vh !important;
    margin:0 !important; padding:20px !important;
    background:white !important;
    box-sizing:border-box !important;
    -webkit-print-color-adjust:exact !important;
    print-color-adjust:exact !important;
    z-index:99999 !important;
  }
  .pay-print-stmt:not(.pay-print--active) { display:none !important; }

  /* Force background colors on all children */
  .pay-print-slip.pay-print--active * {
    -webkit-print-color-adjust:exact !important;
    print-color-adjust:exact !important;
    box-sizing:border-box !important;
  }

  .pay-print-slip strong::after, .pay-print-slip *::after { content:none !important; }

  /* ── Watermark ── */
  .psl-watermark { display:block !important; visibility:visible !important; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-28deg); pointer-events:none; z-index:0; opacity:0.07; }
  .psl-watermark img { width:520px; max-width:80vw; display:block; }

  @page { size:A4 portrait; margin:8mm 12mm; }

  /* ══ LETTERHEAD (white, matches Financial Reports style) ══ */
  .psl-lh { display:flex; align-items:center; justify-content:space-between; gap:24px; padding:18px 20px 14px; background:#fff; flex-wrap:wrap; }
  .psl-lh-left { display:flex; flex-direction:column; align-items:flex-start; }
  .psl-lh-logo { height:80px; width:auto; object-fit:contain; margin-bottom:6px; }
  .psl-lh-name { font-size:18px; font-weight:900; color:#102a43; margin-top:2px; letter-spacing:-0.3px; }
  .psl-lh-tag { font-size:11px; color:#64748b; margin-top:2px; }
  .psl-lh-contacts { display:flex; flex-direction:column; gap:9px; }
  .psl-lh-row { display:flex; align-items:center; gap:10px; font-size:13.5px; color:#0f172a; }
  .psl-lh-ic { width:26px; height:26px; border-radius:50%; background:#1d8ad1; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; }
  .psl-lh-bars { display:flex; height:7px; border-radius:0; overflow:hidden; }
  .psl-lh-bar-green { flex:1; background:linear-gradient(90deg,#7cb342,#aed581); }
  .psl-lh-bar-blue { flex:1; }

  /* ══ DOCUMENT TITLE BAND ══ */
  .psl-hdr { background:#0B1F3A; padding:14px 20px; display:flex; align-items:center; justify-content:flex-end; gap:16px; }
  .psl-hdr-title-txt { color:white; font-weight:900; font-size:22px; letter-spacing:4px; text-transform:uppercase; line-height:1; margin-right:auto; }
  .psl-hdr-conf { display:flex; align-items:center; gap:6px; }
  .psl-hdr-conf span { color:#D4AF37; font-size:8px; font-weight:700; letter-spacing:2px; }
  .psl-gold-line { height:1px; width:28px; background:#D4AF37; }
  .psl-month-badge { display:inline-block; background:#D4AF37; color:#0B1F3A; font-weight:900; font-size:9px; letter-spacing:1.5px; padding:4px 12px; border-radius:3px; }
  .psl-gold-bar { height:3px; background:#D4AF37; }

  /* ══ EMPLOYEE + PAY PERIOD ══ */
  .psl-info-row { display:grid; grid-template-columns:1fr 1fr; gap:0; border-bottom:1px solid #e2e8f0; }
  .psl-emp-block { display:flex; gap:12px; align-items:flex-start; padding:14px 16px 14px 20px; border-right:1px solid #e2e8f0; }
  .psl-avatar { width:60px; height:60px; border-radius:50%; background:#0B1F3A; color:white; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:24px; flex-shrink:0; border:2px solid #D4AF37; }
  .psl-emp-detail { flex:1; min-width:0; }
  .psl-emp-name { font-weight:900; font-size:13px; color:#0B1F3A; margin-bottom:1px; }
  .psl-emp-desig { color:#D4AF37; font-weight:700; font-size:9px; margin-bottom:7px; }
  .psl-emp-row { display:flex; gap:4px; margin-bottom:3px; }
  .psl-emp-lbl { font-size:9px; color:#64748b; font-weight:600; min-width:66px; flex-shrink:0; }
  .psl-emp-val { font-size:9px; color:#1e293b; word-break:break-word; }

  /* Pay period unified card */
  .psl-pay-card { border-left:none; }
  .psl-pay-card-hd { display:flex; align-items:center; gap:5px; padding:7px 14px; background:#F5F7FA; border-bottom:1px solid #e2e8f0; font-size:8px; font-weight:800; color:#0B1F3A; text-transform:uppercase; letter-spacing:0.8px; }
  .psl-pay-row { display:flex; justify-content:space-between; align-items:center; padding:5px 14px; border-bottom:1px solid #f1f5f9; gap:8px; background:white; }
  .psl-pay-lbl { font-size:10px; color:#64748b; }
  .psl-pay-val { font-size:10px; color:#0B1F3A; font-weight:700; text-align:right; }
  .psl-net-box { background:#0B1F3A; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; }
  .psl-net-label { color:rgba(255,255,255,.5); font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:3px; }
  .psl-paid-pill { display:inline-flex; align-items:center; background:rgba(16,185,129,.2); border:1px solid rgba(16,185,129,.4); border-radius:20px; padding:1px 8px; font-size:8px; color:#4ade80; font-weight:700; }
  .psl-net-cur { color:rgba(255,255,255,.45); font-size:8px; text-align:right; margin-bottom:1px; }
  .psl-net-amt { color:#D4AF37; font-weight:900; font-size:18px; letter-spacing:-0.5px; line-height:1; }

  .psl-gold-rule { height:1px; background:#D4AF37; margin:0 20px; opacity:0.5; }

  /* ══ EARNINGS / DEDUCTIONS ══ */
  .psl-columns { display:grid; grid-template-columns:1fr 1fr; gap:0; margin:12px 0; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; }
  .psl-col { }
  .psl-col:first-child { border-right:1px solid #e2e8f0; }
  .psl-col-hd { padding:7px 10px; font-size:9px; font-weight:800; color:white; letter-spacing:1px; text-transform:uppercase; }
  .psl-earn-hd { background:#0B1F3A; }
  .psl-ded-hd  { background:#0B1F3A; }
  .psl-table { width:100%; border-collapse:collapse; font-size:10px; }
  .psl-table th { background:#F5F7FA; padding:5px 8px; text-align:left; font-weight:700; color:#64748b; border-bottom:1px solid #e2e8f0; font-size:8px; text-transform:uppercase; letter-spacing:0.4px; }
  .psl-table td { padding:5px 8px; border-bottom:1px dashed #f1f5f9; color:#374151; }
  .psl-r { text-align:right !important; }
  .psl-empty-row { color:#9ca3af; font-style:italic; text-align:center; padding:10px 8px !important; }
  .psl-subtotal td { padding:6px 8px; font-weight:800; font-size:10px; border-top:2px solid #0B1F3A; }
  .psl-earn-foot td { color:#0B1F3A; background:#f8fafc; }
  .psl-ded-foot  td { color:#b91c1c; background:#fff5f5; }

  /* ══ 4-STAT SUMMARY ══ */
  .psl-stats { display:grid; grid-template-columns:repeat(4,1fr); background:#F5F7FA; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; margin-bottom:12px; }
  .psl-stat-cell { padding:10px 8px; text-align:center; }
  .psl-stat-label { font-size:7px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.4px; margin-bottom:3px; }
  .psl-stat-cur { font-size:8px; color:#94a3b8; }
  .psl-stat-val { font-weight:900; font-size:13px; }
  .psl-stat-words { font-size:8px; font-weight:600; font-style:italic; line-height:1.4; }

  /* ══ BOTTOM: MESSAGE + AUTH ══ */
  .psl-bottom { display:grid; grid-template-columns:1fr 1fr; gap:0; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; margin-bottom:12px; }
  .psl-section-hd { display:flex; align-items:center; gap:5px; font-size:8px; font-weight:800; color:#0B1F3A; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:7px; }
  .psl-msg { padding:12px 14px; border-right:1px solid #e2e8f0; }
  .psl-msg-body { font-size:10px; color:#475569; line-height:1.7; margin-bottom:8px; }
  .psl-msg-quote { font-family:Georgia,serif; font-size:13px; color:#D4AF37; font-style:italic; }
  .psl-auth { padding:12px 14px; }
  .psl-auth-name { font-size:13px; font-weight:700; color:#0B1F3A; font-family:Georgia,serif; font-style:italic; margin-bottom:4px; }
  .psl-auth-blank { height:20px; border-bottom:1px solid #94a3b8; width:110px; margin-bottom:4px; }
  .psl-auth-line { height:1px; background:#d1d5db; width:110px; margin-bottom:5px; }
  .psl-auth-role { font-size:9px; color:#64748b; }
  .psl-auth-date { font-size:8px; color:#94a3b8; margin-top:5px; }

  /* ══ FOOTER ══ */
  .psl-footer-bar { background:#0B1F3A; padding:8px 20px; display:flex; justify-content:space-between; font-size:8px; color:rgba(255,255,255,.5); }
  .psl-footer-disc { background:#0B1F3A; padding:5px 20px 8px; text-align:center; font-size:7px; color:#D4AF37; font-weight:700; letter-spacing:1px; text-transform:uppercase; border-top:1px solid rgba(212,175,55,.2); }
  /* Statement styles -- JS injects a <style id="pay-landscape"> before window.print() */
  .pay-print-stmt + style, /* noop selector just for clarity */
  .pay-print-stmt { /* landscape injected dynamically */ }
  .pst-header { margin-bottom:10px; }
  .pst-hdr-top { display:flex; align-items:center; gap:12px; margin-bottom:6px; }
  .pst-logo { height:44px; width:auto; object-fit:contain; border-radius:6px; }
  .pst-company { font-size:14px; font-weight:900; color:#102a43; }
  .pst-tagline { font-size:9px; color:#64748b; margin-top:1px; font-style:italic; }
  .pst-meta { display:flex; gap:20px; font-size:10px; color:#64748b; margin-top:4px; }
  .pst-watermark { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-30deg); font-size:100px; font-weight:900; color:rgba(239,68,68,.08); pointer-events:none; z-index:0; }
  .pst-table { width:100%; border-collapse:collapse; font-size:10px; margin-bottom:16px; }
  .pst-table th { background:#102a43; color:white; padding:7px 8px; text-align:left; font-size:9px; font-weight:700; }
  .pst-table td { padding:6px 8px; border-bottom:1px solid #f1f5f9; }
  .pst-table tr:nth-child(even) td { background:#f8fafc; }
  .pst-r { text-align:right !important; }
  .pst-total td { background:#102a43 !important; color:white; font-size:11px; padding:8px; }
  .pst-sig-row { display:flex; justify-content:space-around; margin-top:20px; }
  .pst-sig { text-align:center; font-size:10px; color:#64748b; width:150px; }
  .pst-sig-line { border-top:1.5px solid #334155; margin-bottom:6px; }
  .pst-footer { font-size:9px; color:#94a3b8; text-align:center; margin-top:10px; border-top:1px solid #e2e8f0; padding-top:6px; }
}
`;

