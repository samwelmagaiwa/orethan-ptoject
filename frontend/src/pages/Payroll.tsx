import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import AlertModal from "../components/AlertModal";
import ConfirmModal from "../components/ConfirmModal";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
const fmt = (v: any) => `TZS ${Number(v || 0).toLocaleString()}`;
const fmtNum = (v: any) => Number(v || 0).toLocaleString();


// --- Types ------------------------------------------------------------
interface SalaryComponent { id: number; code: string; name: string; type: "earning" | "deduction"; taxable: boolean; statutory: boolean; active: boolean; default_amount: number; sort_order: number; }
interface Employee { id: number; employee_id: string; full_name: string; department: string; designation: string; branch: string; employment_type: string; basic_salary: number; bank_name: string; bank_account: string; tin_number: string; nssf_number: string; nhif_number: string; phone: string; email: string; hire_date: string; active: boolean; }
interface PayrollRun { id: number; payroll_no: string; month: number; year: number; pay_date: string; status: string; notes: string; created_by: any; approved_by: any; approved_at: string; gl_post_journal_id: number | null; gl_pay_journal_id: number | null; }
interface ItemDetail { id: number; component: SalaryComponent; amount: number; }
interface PayrollItem { id: number; employee: Employee; gross_salary: number; total_earnings: number; total_deductions: number; net_salary: number; payment_status: string; payment_method: string; payment_reference: string; payment_date: string | null; email_sent_at: string | null; email_status: string | null; details: ItemDetail[]; }
interface PayrollFull extends PayrollRun { items: PayrollItem[]; }
interface BreakdownRow { department: string; headcount: number; gross: number; deductions: number; net: number; paye: number; nssf: number; nhif: number; paid_count: number; emailed_count: number; }
interface AnalyticsRow { id: number; payroll_no: string; month: number; year: number; status: string; headcount: number; total_gross: number; total_deductions: number; total_net: number; paid_count: number; }

type Tab = "runs" | "components" | "employees" | "myslips";

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

// â€â€â€ Component â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€
export default function Payroll() {
  const { t } = useTranslation("payroll");
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
        // bulk — mark whole payroll paid
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
  const printStmt = () => { setPrintMode("stmt"); setTimeout(() => { window.print(); setTimeout(() => setPrintMode(null), 500); }, 100); };
  const printMySlip = () => {
    if (!mySelSlip) return;
    setSelItem(mySelSlip as PayrollItem);
    setPayroll({ ...mySelSlip.payroll, items: [] } as PayrollFull);
    setTimeout(() => { setPrintMode("slip"); setTimeout(() => { window.print(); setTimeout(() => { setPrintMode(null); setSelItem(null); setPayroll(null); }, 500); }, 100); }, 50);
  };

  // â€â€ Compute totals for payroll statement â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€
  const totals = payroll ? {
    count: payroll.items.length,
    gross: payroll.items.reduce((s, i) => s + i.gross_salary, 0),
    ded: payroll.items.reduce((s, i) => s + i.total_deductions, 0),
    net: payroll.items.reduce((s, i) => s + i.net_salary, 0),
  } : null;

  // â€â€ Payroll runs tab â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€
  const earnings = selItem?.details.filter(d => d.component.type === "earning") ?? [];
  const deductions = selItem?.details.filter(d => d.component.type === "deduction") ?? [];

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
                <div className="ppm-sub">{payModal.mode === "bulk" ? `${payroll.payroll_no} — all employees` : payModal.item?.employee.full_name}</div>
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
                    ? pmAccounts.map(a => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)
                    : <>
                      <option value="1020">1020 — NMB / Bank Account</option>
                      <option value="1010">1010 — Cash in Hand</option>
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
                    <td>2200 — Accrued Salaries Payable</td>
                    <td className="ppm-dr">{fmt(
                      payModal.mode === "single" && payModal.item
                        ? payModal.item.net_salary
                        : payroll.items.filter(i => i.payment_status !== "paid").reduce((s, i) => s + Number(i.net_salary), 0)
                    )}</td>
                    <td>—</td>
                  </tr>
                  <tr>
                    <td>{pmAccountCode} — {pmAccounts.find(a => a.code === pmAccountCode)?.name ?? "Selected Account"}</td>
                    <td>—</td>
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

      {/* --- Employee-only slip view: clean dedicated layout when user has NO management access --- */}
      {settingsLoaded && !isPayrollAdmin && hasEmpRecord && tab === "myslips" && (() => {
        const filteredSlips = mySlips.filter((s: any) => s.payroll?.year === myYearFilter);
        const slip = mySelSlip;
        const earnings_my = slip?.details?.filter((d: any) => d.component?.type === "earning") ?? [];
        const deductions_my = slip?.details?.filter((d: any) => d.component?.type === "deduction") ?? [];
        return (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8f7f4", fontFamily: "Inter, sans-serif" }}>
            {/* Page header */}
            <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#1e293b" }}>🧾 {t("my_salary_slips", { defaultValue: "My Salary Slips" })}</div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{t("my_slips_subtitle", { defaultValue: "View and print your monthly salary details and payment status" })}</div>
              </div>
              {slip && (
                <button onClick={printMySlip} style={{ background: "#102a43", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
                  🖨️ Print Slip
                </button>
              )}
            </div>

            {/* Employee info strip */}
            {myEmployee && (
              <div style={{ background: "#102a43", padding: "14px 28px", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#4f7c3f", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
                  {myEmployee.full_name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{myEmployee.full_name}</div>
                  <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 2 }}>
                    {myEmployee.employee_id}
                    {myEmployee.designation ? ` · ${myEmployee.designation}` : ""}
                    {myEmployee.department ? ` · ${myEmployee.department}` : ""}
                    {myEmployee.employment_type ? ` · ${myEmployee.employment_type.replace(/_/g, " ")}` : ""}
                  </div>
                </div>
                {/* Year filter */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>Year</label>
                  <select
                    value={myYearFilter}
                    onChange={e => {
                      const yr = Number(e.target.value);
                      setMyYearFilter(yr);
                      const first = mySlips.find((s: any) => s.payroll?.year === yr);
                      if (first) setMySelSlip(first);
                    }}
                    style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 13, cursor: "pointer" }}
                  >
                    {[...new Set(mySlips.map((s: any) => s.payroll?.year).filter(Boolean))].sort((a: any, b: any) => b - a).map((yr: any) => (
                      <option key={yr} value={yr} style={{ color: "#000" }}>{yr}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* No employee record */}
            {!myEmployee && (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, color: "#64748b" }}>
                <div style={{ fontSize: 40 }}>🔍</div>
                <div style={{ fontWeight: 600 }}>No employee record linked to your account</div>
                <div style={{ fontSize: 13 }}>Ask your administrator to link your user profile.</div>
              </div>
            )}

            {/* Content area */}
            {myEmployee && (
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                {/* Left: slip list (month pills) */}
                <div style={{ width: 220, borderRight: "1px solid #e5e7eb", background: "#fff", overflow: "auto", flexShrink: 0 }}>
                  {filteredSlips.length === 0 ? (
                    <div style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                      No slips for {myYearFilter}
                    </div>
                  ) : (
                    filteredSlips.map((s: any) => {
                      const isActive = mySelSlip?.id === s.id;
                      const isPaid = s.payment_status === "paid" || s.payroll?.status === "paid";
                      return (
                        <div
                          key={s.id}
                          onClick={() => setMySelSlip(s)}
                          style={{
                            padding: "14px 16px",
                            borderBottom: "1px solid #f1f5f9",
                            cursor: "pointer",
                            background: isActive ? "#f0fdf4" : "#fff",
                            borderLeft: isActive ? "3px solid #4f7c3f" : "3px solid transparent",
                            transition: "all .15s",
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: 13, color: isActive ? "#4f7c3f" : "#1e293b" }}>
                            {getMonthName((s.payroll?.month || 1) - 1)} {s.payroll?.year}
                          </div>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{s.payroll?.payroll_no}</div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{fmt(s.net_salary)}</span>
                            {isPaid ? (
                              <span style={{ fontSize: 10, fontWeight: 700, background: "#d1fae5", color: "#059669", padding: "2px 7px", borderRadius: 10 }}>PAID</span>
                            ) : (
                              <span style={{ fontSize: 10, fontWeight: 700, background: "#fef9c3", color: "#a16207", padding: "2px 7px", borderRadius: 10 }}>
                                {(s.payroll?.status || "draft").toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Right: slip detail */}
                <div style={{ flex: 1, overflow: "auto", padding: 28 }}>
                  {!slip ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 8, color: "#9ca3af" }}>
                      <div style={{ fontSize: 40 }}>👈</div>
                      <div style={{ fontSize: 14 }}>Select a month to view your slip</div>
                    </div>
                  ) : (
                    <div style={{ maxWidth: 700, margin: "0 auto" }}>
                      {/* Slip card */}
                      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                        {/* Slip header */}
                        <div style={{ background: "#102a43", padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>
                              {getMonthName((slip.payroll?.month || 1) - 1)} {slip.payroll?.year} — Salary Slip
                            </div>
                            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 4 }}>
                              {slip.payroll?.payroll_no} · Pay Date: {slip.payroll?.pay_date}
                            </div>
                          </div>
                          {slip.payment_status === "paid" ? (
                            <span style={{ background: "#d1fae5", color: "#059669", fontWeight: 800, fontSize: 12, padding: "5px 14px", borderRadius: 20 }}>✅ PAID</span>
                          ) : (
                            <span style={{ background: "#fef9c3", color: "#a16207", fontWeight: 800, fontSize: 12, padding: "5px 14px", borderRadius: 20 }}>
                              {(slip.payroll?.status || "draft").toUpperCase()}
                            </span>
                          )}
                        </div>

                        {/* Net salary highlight */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, borderBottom: "1px solid #f1f5f9" }}>
                          {[
                            { label: "Gross Salary", val: slip.gross_salary, color: "#059669" },
                            { label: "Deductions", val: slip.total_deductions, color: "#ef4444" },
                            { label: "Net Salary", val: slip.net_salary, color: "#102a43" },
                          ].map((item, i) => (
                            <div key={i} style={{ padding: "18px 20px", textAlign: "center", borderRight: i < 2 ? "1px solid #f1f5f9" : "none", background: i === 2 ? "#f0fdf4" : "#fff" }}>
                              <div style={{ fontWeight: 800, fontSize: 22, color: item.color }}>{fmtNum(item.val)}</div>
                              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 3 }}>{item.label}</div>
                            </div>
                          ))}
                        </div>

                        {/* Breakdown table */}
                        <div style={{ padding: "0 0 20px" }}>
                          {earnings_my.length > 0 && (
                            <>
                              <div style={{ padding: "12px 20px 6px", fontSize: 11, fontWeight: 800, color: "#059669", textTransform: "uppercase", letterSpacing: "1px", borderBottom: "1px solid #f1f5f9" }}>Earnings</div>
                              {earnings_my.map((d: any) => d.amount > 0 && (
                                <div key={d.component?.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 20px", borderBottom: "1px solid #f9fafb", fontSize: 13 }}>
                                  <span style={{ color: "#374151", fontWeight: 500 }}>{d.component?.name}</span>
                                  <span style={{ fontWeight: 600, color: "#1e293b" }}>TZS {fmtNum(d.amount)}</span>
                                </div>
                              ))}
                            </>
                          )}
                          {deductions_my.length > 0 && (
                            <>
                              <div style={{ padding: "12px 20px 6px", fontSize: 11, fontWeight: 800, color: "#ef4444", textTransform: "uppercase", letterSpacing: "1px", borderBottom: "1px solid #f1f5f9" }}>Deductions</div>
                              {deductions_my.map((d: any) => d.amount > 0 && (
                                <div key={d.component?.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 20px", borderBottom: "1px solid #f9fafb", fontSize: 13 }}>
                                  <span style={{ color: "#374151", fontWeight: 500 }}>{d.component?.name}</span>
                                  <span style={{ fontWeight: 600, color: "#ef4444" }}>− TZS {fmtNum(d.amount)}</span>
                                </div>
                              ))}
                            </>
                          )}
                          {/* Net total row */}
                          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 20px", background: "#f0fdf4", marginTop: 4, borderTop: "2px solid #bbf7d0" }}>
                            <span style={{ fontWeight: 800, fontSize: 14, color: "#102a43" }}>NET SALARY</span>
                            <span style={{ fontWeight: 800, fontSize: 14, color: "#059669" }}>TZS {fmtNum(slip.net_salary)}</span>
                          </div>
                          <div style={{ padding: "4px 20px 10px", fontSize: 11, color: "#9ca3af", fontStyle: "italic" }}>
                            {numberToWords(Number(slip.net_salary))}
                          </div>
                        </div>

                        {/* Payment + email footer */}
                        <div style={{ borderTop: "1px solid #f1f5f9", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafafa" }}>
                          <div>
                            {slip.payment_status === "paid" ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 20 }}>✅</span>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 13, color: "#059669" }}>Salary Paid</div>
                                  <div style={{ fontSize: 11, color: "#9ca3af" }}>
                                    {slip.payment_date || slip.payroll?.pay_date}
                                    {slip.payment_method ? ` · ${slip.payment_method.replace(/_/g, " ")}` : ""}
                                    {slip.payment_reference ? ` · Ref: ${slip.payment_reference}` : ""}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 20 }}>⏳</span>
                                <div style={{ fontWeight: 700, fontSize: 13, color: "#f59e0b" }}>Payment Pending</div>
                              </div>
                            )}
                          </div>
                          <div>
                            {slip.email_status === "sent" ? (
                              <span style={{ fontSize: 12, color: "#059669", background: "#d1fae5", padding: "3px 10px", borderRadius: 12 }}>
                                ✉ Slip emailed {slip.email_sent_at ? new Date(slip.email_sent_at).toLocaleDateString() : ""}
                              </span>
                            ) : slip.email_status === "failed" ? (
                              <span style={{ fontSize: 12, color: "#ef4444", background: "#fee2e2", padding: "3px 10px", borderRadius: 12 }}>✕ Email failed</span>
                            ) : (
                              <span style={{ fontSize: 12, color: "#9ca3af" }}>Email not sent</span>
                            )}
                          </div>
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
              {tKey === "runs" ? `📋 ${t("payroll_runs")}` : tKey === "components" ? `⚙️ ${t("salary_components")}` : tKey === "employees" ? `👥 ${t("employees")}` : `🧾 ${t("my_slips")}`}
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

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          TAB: RUNS " 3-column layout
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {tab === "runs" && (
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
          </div>

          <div className="pay-3col">
            {/* â€â€ LEFT: Payroll runs list â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€ */}
            <div className="pay-col-left">
              <div className="pay-col-hd">{t("payroll_runs")}</div>
              {payrolls.length === 0 && <div className="pay-empty">{t("no_payrolls", { defaultValue: "No payrolls found" })}</div>}
              {payrolls.map(p => (
                <div key={p.id}
                  className={`pay-run-card ${payroll?.id === p.id ? "pay-run-card--active" : ""}`}
                  onClick={() => loadPayroll(p.id)}
                >
                  <div className="pay-run-no">{p.payroll_no}</div>
                  <div className="pay-run-period">{getMonthName(p.month - 1)} {p.year}</div>
                  <div className="pay-run-row">
                    <span className="pay-badge" style={{ background: statusColor[p.status] + "22", color: statusColor[p.status], border: `1px solid ${statusColor[p.status]}44` }}>
                      {t(`status_actions.${p.status}`).toUpperCase()}
                    </span>
                    <span className="pay-run-date">{t("pay_date")}: {p.pay_date}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* â€â€ CENTER: Employee table â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€â€ */}
            <div className="pay-col-center">
              {!payroll ? (
                <div className="pay-analytics-panel">
                  <div className="pay-analytics-title">📊 Payroll Analytics — Last 12 Months</div>
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
                  {/* Payroll header */}
                  <div className="pay-payroll-hd">
                    <div>
                      <div className="pay-payroll-title">{payroll.payroll_no}</div>
                      <div className="pay-payroll-sub">{getMonthName(payroll.month - 1)} {payroll.year} · {t("pay_date")}: {payroll.pay_date}</div>
                      {payroll.gl_post_journal_id && (
                        <div className="pay-gl-ref">📒 GL Expense JE#{payroll.gl_post_journal_id} · {payroll.gl_pay_journal_id ? `💳 Payment JE#${payroll.gl_pay_journal_id}` : "Payment pending"}</div>
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

                  {/* Department breakdown */}
                  {breakdown.length > 0 && (
                    <div className="pay-breakdown">
                      <div className="pay-breakdown-title">Department Breakdown</div>
                      <div className="pay-table-wrap">
                        <table className="pay-table">
                          <thead>
                            <tr><th>Department</th><th className="pay-r">Staff</th><th className="pay-r">Gross</th><th className="pay-r">Net</th><th className="pay-r">Paid</th><th className="pay-r">Emailed</th></tr>
                          </thead>
                          <tbody>
                            {breakdown.map((b, i) => (
                              <tr key={i}>
                                <td>{b.department}</td>
                                <td className="pay-r">{b.headcount}</td>
                                <td className="pay-r pay-bold">{fmtNum(b.gross)}</td>
                                <td className="pay-r pay-net">{fmtNum(b.net)}</td>
                                <td className="pay-r">{b.paid_count}/{b.headcount}</td>
                                <td className="pay-r">{b.emailed_count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
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
                                <span className="pay-email-badge pay-email-badge--none">—</span>
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
            <div className="pay-col-right">
              {!selItem ? (
                <div className="pay-empty pay-empty--big">
                  <div className="pay-empty-icon">🧾</div>
                  <div>{t("click_employee_preview")}</div>
                </div>
              ) : (
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
                        <div className="pay-email-info">Last emailed: {new Date(selItem.email_sent_at).toLocaleString()} — <span style={{ color: selItem.email_status === "sent" ? "#059669" : "#ef4444" }}>{selItem.email_status}</span></div>
                      )}
                      {!selItem.employee.email && ["posted", "paid"].includes(payroll.status) && (
                        <div className="pay-email-info pay-email-info--warn">⚠ No work email — slip cannot be emailed</div>
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
            </div>
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
                    {myYearFilter} — {filteredSlips.length} slip{filteredSlips.length !== 1 ? "s" : ""}
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
                          <div className="pay-payroll-title">{mySelSlip.payroll?.payroll_no} — {getMonthName((mySelSlip.payroll?.month || 1) - 1)} {mySelSlip.payroll?.year}</div>
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

                      {/* Payment status panel — clean, no clutter */}
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

                        {/* Email status — clean single line */}
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
                    <td>{c.taxable ? "✅" : "—"}</td>
                    <td>{c.statutory ? "⚖️" : "—"}</td>
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
                {employees.length === 0 && <tr><td colSpan={10} className="pay-tc pay-empty-sm">No employees yet — click "Add Employee"</td></tr>}
                {employees.map(e => (
                  <tr key={e.id}>
                    <td><code className="pay-code">{e.employee_id}</code></td>
                    <td className="pay-bold">{e.full_name}</td>
                    <td>{e.department || "—"}</td>
                    <td>{e.designation || "—"}</td>
                    <td>{e.branch || "—"}</td>
                    <td style={{ textTransform: "capitalize" }}>{e.employment_type}</td>
                    <td className="pay-r pay-bold">{fmtNum(e.basic_salary)}</td>
                    <td>{e.bank_name ? `${e.bank_name} ···${(e.bank_account || "").slice(-4)}` : "—"}</td>
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

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          MODAL: Create Payroll
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
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
          <div className="psl-company">
            <div className="psl-logo-wrap">
              <div className="psl-logo-box">MF</div>
            </div>
            <div className="psl-company-info">
              <div className="psl-company-name">MICROFINANCE INSTITUTION</div>
              <div className="psl-company-detail">P.O. Box 12345, Dar es Salaam, Tanzania</div>
              <div className="psl-company-detail">Tel: +255 22 000 0000 | Email: info@mfi.co.tz | TIN: 100-000-000</div>
            </div>
          </div>
          <div className="psl-title-bar">
            <div className="psl-title">SALARY SLIP</div>
            <div className="psl-title-meta">
              <span>Payroll: {payroll.payroll_no}</span>
              <span>Period: {getMonthName(payroll.month)} {payroll.year}</span>
              <span>Pay Date: {payroll.pay_date}</span>
            </div>
          </div>

          {/* Status watermark for non-paid */}
          {payroll.status !== "paid" && payroll.status !== "posted" && (
            <div className="psl-watermark">{payroll.status.toUpperCase()}</div>
          )}

          {/* Employee info */}
          <div className="psl-emp-grid">
            <div className="psl-emp-row"><span>Employee ID</span><strong>{selItem.employee.employee_id}</strong></div>
            <div className="psl-emp-row"><span>Full Name</span><strong>{selItem.employee.full_name}</strong></div>
            <div className="psl-emp-row"><span>Department</span><strong>{selItem.employee.department || "—"}</strong></div>
            <div className="psl-emp-row"><span>Designation</span><strong>{selItem.employee.designation || "—"}</strong></div>
            <div className="psl-emp-row"><span>Branch</span><strong>{selItem.employee.branch || "—"}</strong></div>
            <div className="psl-emp-row"><span>Employment Type</span><strong style={{ textTransform: "capitalize" }}>{selItem.employee.employment_type}</strong></div>
            {selItem.employee.nssf_number && <div className="psl-emp-row"><span>NSSF No.</span><strong>{selItem.employee.nssf_number}</strong></div>}
            {selItem.employee.nhif_number && <div className="psl-emp-row"><span>NHIF No.</span><strong>{selItem.employee.nhif_number}</strong></div>}
            {selItem.employee.tin_number && <div className="psl-emp-row"><span>TIN</span><strong>{selItem.employee.tin_number}</strong></div>}
            {selItem.employee.bank_name && <div className="psl-emp-row"><span>Bank</span><strong>{selItem.employee.bank_name}</strong></div>}
            {selItem.employee.bank_account && <div className="psl-emp-row"><span>Account No.</span><strong>{selItem.employee.bank_account}</strong></div>}
          </div>

          {/* Earnings & Deductions side-by-side */}
          <div className="psl-columns">
            <div className="psl-col">
              <div className="psl-col-hd psl-earn-hd">EARNINGS</div>
              <table className="psl-table">
                <thead><tr><th>Description</th><th>Amount (TZS)</th></tr></thead>
                <tbody>
                  {earnings.filter(d => d.amount > 0).map(d => (
                    <tr key={d.component.id}><td>{d.component.name}</td><td className="psl-r">{fmtNum(d.amount)}</td></tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="psl-subtotal"><td><strong>Gross Salary</strong></td><td className="psl-r"><strong>{fmtNum(selItem.gross_salary)}</strong></td></tr>
                </tfoot>
              </table>
            </div>
            <div className="psl-col">
              <div className="psl-col-hd psl-ded-hd">DEDUCTIONS</div>
              <table className="psl-table">
                <thead><tr><th>Description</th><th>Amount (TZS)</th></tr></thead>
                <tbody>
                  {deductions.filter(d => d.amount > 0).map(d => (
                    <tr key={d.component.id}><td>{d.component.name}</td><td className="psl-r">{fmtNum(d.amount)}</td></tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="psl-subtotal"><td><strong>Total Deductions</strong></td><td className="psl-r"><strong>{fmtNum(selItem.total_deductions)}</strong></td></tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Net salary box */}
          <div className="psl-net-section">
            <div className="psl-net-row"><span>Gross Salary</span><span>{fmtNum(selItem.gross_salary)}</span></div>
            <div className="psl-net-row psl-net-row--ded"><span>Less: Total Deductions</span><span>({fmtNum(selItem.total_deductions)})</span></div>
            <div className="psl-net-divider" />
            <div className="psl-net-row psl-net-row--total"><span>NET SALARY</span><span>{fmt(selItem.net_salary)}</span></div>
            <div className="psl-net-divider" />
            <div className="psl-in-words">In Words: <strong>{numberToWords(selItem.net_salary)}</strong></div>
          </div>

          {/* Payment info */}
          <div className="psl-payment">
            <div className="psl-payment-hd">PAYMENT INFORMATION</div>
            <div className="psl-payment-row">
              <span>Payment Method:</span>
              <strong>{selItem.payment_method?.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase()) || "Bank Transfer"}</strong>
            </div>
            {selItem.employee.bank_name && (
              <div className="psl-payment-row"><span>Bank:</span><strong>{selItem.employee.bank_name}</strong></div>
            )}
            {selItem.employee.bank_account && (
              <div className="psl-payment-row"><span>Account No:</span><strong>{selItem.employee.bank_account}</strong></div>
            )}
            {selItem.payment_reference && (
              <div className="psl-payment-row"><span>Transaction Ref:</span><strong>{selItem.payment_reference}</strong></div>
            )}
          </div>

          {/* Signature block */}
          <div className="psl-sig-grid">
            <div className="psl-sig-box"><div className="psl-sig-line" /><div>Prepared By</div><div className="psl-sig-name">Payroll Officer</div></div>
            <div className="psl-sig-box"><div className="psl-sig-line" /><div>Approved By</div><div className="psl-sig-name">{payroll.approved_by?.name || "General Manager"}</div></div>
            <div className="psl-sig-box"><div className="psl-sig-line" /><div>Received By</div><div className="psl-sig-name">{selItem.employee.full_name}</div></div>
          </div>

          <div className="psl-footer">
            <div>Generated: {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
            <div>⚡ This is a computer-generated salary slip. No signature is required if paid via bank transfer.</div>
            <div className="psl-verify">Verify: {payroll.payroll_no}-{selItem.employee.employee_id}</div>
          </div>
        </div>
      )}

      {/* --- PRINT: Payroll Statement (A4 landscape, hidden on screen) ------------ */}
      {payroll && (
        <div className={`pay-print-stmt ${printMode === "stmt" ? "pay-print--active" : ""}`}>
          <div className="pst-header">
            <div className="pst-company">MICROFINANCE INSTITUTION — PAYROLL STATEMENT</div>
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
                  <td>{item.employee.bank_name || "—"}</td>
                  <td>{item.employee.bank_account || "—"}</td>
                  <td>{item.payment_status.replace("_", " ")}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="pst-total">
                <td colSpan={5}><strong>TOTALS — {payroll.items.length} Employee(s)</strong></td>
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
          <div className="pst-footer">Generated: {new Date().toLocaleString()} · {payroll.payroll_no} · Confidential — For Internal Use Only</div>
        </div>
      )}

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
/* --- Page wrapper ---------------------------------------------------- */
.pay-page { flex:1; min-height:0; overflow-y:auto; overflow-x:hidden; background:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; display:flex; flex-direction:column; }

/* --- Tab bar --------------------------------------------------------- */
.pay-tab-bar { display:flex; align-items:center; gap:6px; padding:14px 18px 0; background:#f1f5f9; position:sticky; top:0; z-index:10; border-bottom:2px solid #e2e8f0; }
.pay-tab { padding:9px 20px; border:none; border-radius:10px 10px 0 0; font-size:13px; font-weight:700; cursor:pointer; background:transparent; color:#64748b; transition:all .15s; }
.pay-tab--active { background:white; color:#102a43; box-shadow:0 -2px 0 #1e5fae inset; }
.pay-tab:hover:not(.pay-tab--active) { background:#e2e8f0; }
.pay-tab-space { flex:1; }

/* --- Buttons --------------------------------------------------------- */
.pay-btn { padding:8px 16px; border:none; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; transition:all .15s; }
.pay-btn--primary  { background:#102a43; color:white; } .pay-btn--primary:hover  { background:#1e5fae; }
.pay-btn--blue     { background:#1e5fae; color:white; } .pay-btn--blue:hover     { background:#1d4ed8; }
.pay-btn--purple   { background:#7c3aed; color:white; } .pay-btn--purple:hover   { background:#6d28d9; }
.pay-btn--green    { background:#059669; color:white; } .pay-btn--green:hover    { background:#047857; }
.pay-btn--danger   { background:#ef4444; color:white; } .pay-btn--danger:hover   { background:#dc2626; }
.pay-btn--outline  { background:white; color:#102a43; border:1.5px solid #e2e8f0; } .pay-btn--outline:hover { border-color:#94a3b8; }
.pay-btn:disabled  { opacity:.5; cursor:not-allowed; }

/* --- Filters bar ----------------------------------------------------- */
.pay-filters { display:flex; gap:10px; padding:10px 18px; background:white; border-bottom:1px solid #e2e8f0; }
.pay-filters select { padding:7px 12px; border:1.5px solid #e2e8f0; border-radius:8px; font-size:13px; font-weight:600; color:#334155; background:white; cursor:pointer; }

/* --- 3-column body --------------------------------------------------- */
.pay-3col { display:flex; flex:1; min-height:0; overflow:hidden; gap:0; }

/* Left column - payroll runs */
.pay-col-left { width:260px; min-width:220px; background:white; border-right:1px solid #e2e8f0; overflow-y:auto; display:flex; flex-direction:column; }
.pay-col-hd { padding:14px 16px 10px; font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:.6px; border-bottom:1px solid #f1f5f9; }

.pay-run-card { padding:12px 16px; border-bottom:1px solid #f8fafc; cursor:pointer; transition:background .1s; }
.pay-run-card:hover { background:#f8fafc; }
.pay-run-card--active { background:#eff6ff; border-left:3px solid #1e5fae; }
.pay-run-no { font-size:12px; font-weight:800; color:#102a43; font-family:monospace; }
.pay-run-period { font-size:13px; color:#334155; font-weight:600; margin:2px 0; }
.pay-run-row { display:flex; justify-content:space-between; align-items:center; margin-top:4px; }
.pay-run-date { font-size:11px; color:#94a3b8; }

/* Center column - employee table */
.pay-col-center { flex:1; min-width:0; display:flex; flex-direction:column; overflow:hidden; background:#f8fafc; }
.pay-payroll-hd { display:flex; justify-content:space-between; align-items:flex-start; padding:14px 18px 10px; background:white; border-bottom:1px solid #e2e8f0; flex-wrap:wrap; gap:10px; }
.pay-payroll-title { font-size:16px; font-weight:800; color:#102a43; font-family:monospace; }
.pay-payroll-sub { font-size:12px; color:#64748b; margin-top:2px; }
.pay-payroll-actions { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }

.pay-summary-row { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; padding:10px 18px; background:white; border-bottom:1px solid #e2e8f0; }
.pay-stat { background:#f8fafc; border-radius:10px; padding:10px 14px; text-align:center; }
.pay-stat span { display:block; font-size:15px; font-weight:800; color:#102a43; }
.pay-stat label { display:block; font-size:10px; color:#94a3b8; font-weight:700; text-transform:uppercase; margin-top:2px; }
.pay-stat--earn span { color:#059669; }
.pay-stat--ded span  { color:#ef4444; }
.pay-stat--net  { background:linear-gradient(135deg,#102a43 0%,#1e5fae 100%); }
.pay-stat--net span, .pay-stat--net label { color:white; }

.pay-table-wrap { flex:1; overflow:auto; }
.pay-table { width:100%; border-collapse:collapse; font-size:13px; }
.pay-table thead th { position:sticky; top:0; background:#f8fafc; padding:10px 14px; text-align:left; font-size:11px; font-weight:700; color:#475569; border-bottom:2px solid #e2e8f0; white-space:nowrap; }
.pay-table td { padding:10px 14px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
.pay-tr { cursor:pointer; transition:background .1s; }
.pay-tr:hover { background:#f0f9ff; }
.pay-tr--active { background:#eff6ff !important; }
.pay-emp-name { font-weight:700; color:#102a43; }
.pay-emp-sub  { font-size:11px; color:#94a3b8; margin-top:1px; }
.pay-r { text-align:right !important; }
.pay-tc { text-align:center !important; }
.pay-bold { font-weight:700; color:#102a43; }
.pay-ded { color:#ef4444; }
.pay-net { color:#059669; font-weight:800; }

/* Right column - slip preview */
.pay-col-right { width:320px; min-width:280px; background:white; border-left:1px solid #e2e8f0; overflow-y:auto; display:flex; flex-direction:column; gap:0; padding:0; }
.pay-slip-hd { display:flex; justify-content:space-between; align-items:flex-start; padding:14px 16px; border-bottom:1px solid #f1f5f9; gap:8px; position:sticky; top:0; background:white; z-index:2; }
.pay-slip-name { font-size:14px; font-weight:800; color:#102a43; }
.pay-slip-role { font-size:11px; color:#64748b; margin-top:2px; }
.pay-slip-section-title { padding:8px 16px 4px; font-size:10px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:.5px; background:#f8fafc; border-top:1px solid #f1f5f9; border-bottom:1px solid #f1f5f9; }
.pay-slip-line { display:flex; justify-content:space-between; align-items:center; padding:6px 16px; border-bottom:1px solid #f8fafc; }
.pay-slip-line span { font-size:12px; color:#475569; }
.pay-slip-line--ded span { color:#94a3b8; }
.pay-slip-amt { font-size:12px; font-weight:700; color:#334155; }
.pay-amt-input { width:90px; padding:4px 8px; border:1.5px solid #e2e8f0; border-radius:6px; font-size:12px; font-weight:700; text-align:right; color:#102a43; }
.pay-amt-input:focus { outline:none; border-color:#1e5fae; }
.pay-amt-input--ded { border-color:#fee2e2; color:#ef4444; }
.pay-slip-subtotal { display:flex; justify-content:space-between; padding:8px 16px; background:#f8fafc; font-size:12px; border-top:1px solid #e2e8f0; }
.pay-slip-subtotal strong { color:#102a43; }
.pay-slip-subtotal--ded strong { color:#ef4444; }

.pay-gl-ref { font-size:11px; color:#6366f1; font-weight:600; margin-top:4px; }
.pay-analytics-panel { padding:16px; height:100%; overflow-y:auto; }
.pay-analytics-title { font-size:14px; font-weight:700; color:#1e293b; margin-bottom:8px; }
.pay-breakdown { padding:12px 0 0; border-top:1px solid #f1f5f9; margin:0 0 4px; }
.pay-breakdown-title { font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.05em; margin-bottom:8px; padding:0 16px; }
.pay-item-actions { display:flex; flex-direction:column; gap:8px; padding:10px 16px; border-top:1px solid #f1f5f9; }
.pay-btn--full { width:100%; justify-content:center; }
.pay-paid-badge { background:#d1fae5; color:#065f46; border:1px solid #6ee7b7; border-radius:8px; padding:8px 12px; font-size:12px; font-weight:700; text-align:center; }
.pay-email-badge { font-size:10px; font-weight:700; padding:2px 6px; border-radius:6px; white-space:nowrap; }
.pay-email-badge--sent { background:#d1fae5; color:#065f46; border:1px solid #6ee7b744; }
.pay-email-badge--pending { background:#fef3c7; color:#92400e; border:1px solid #fcd34d44; }
.pay-email-badge--none { background:#f1f5f9; color:#94a3b8; }
.pay-email-info { font-size:11px; color:#64748b; padding:0 2px; }
.pay-email-info--warn { color:#b45309; background:#fef3c7; border-radius:6px; padding:6px 8px; }

/* ── Payment Modal ────────────────────────────────────────────────────────── */
.ppm-overlay { position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:1000; display:flex; align-items:center; justify-content:center; padding:16px; }
.ppm-box { background:white; border-radius:20px; width:100%; max-width:540px; max-height:90vh; overflow-y:auto; box-shadow:0 24px 64px rgba(0,0,0,0.22); display:flex; flex-direction:column; }
.ppm-hd { display:flex; align-items:flex-start; justify-content:space-between; padding:20px 22px 16px; border-bottom:1px solid #f1f5f9; }
.ppm-title { font-size:16px; font-weight:900; color:#0f172a; }
.ppm-sub { font-size:12px; color:#64748b; margin-top:2px; font-weight:600; }
.ppm-close { border:none; background:none; font-size:18px; color:#94a3b8; cursor:pointer; padding:2px 6px; border-radius:6px; }
.ppm-close:hover { background:#f1f5f9; color:#334155; }

.ppm-amounts { margin:16px 22px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; }
.ppm-amt-row { display:flex; justify-content:space-between; padding:9px 14px; font-size:13px; color:#334155; border-bottom:1px solid #f1f5f9; }
.ppm-amt-row:last-child { border-bottom:none; }
.ppm-amt-row--ded { color:#dc2626; }
.ppm-amt-row--net { background:#102a43; color:white; font-weight:900; font-size:14px; }

.ppm-form { padding:0 22px 4px; display:flex; flex-direction:column; gap:14px; }
.ppm-field { display:flex; flex-direction:column; gap:6px; }
.ppm-field label { font-size:12px; font-weight:800; color:#475569; }
.ppm-label-hint { font-weight:500; color:#94a3b8; }
.ppm-field select,.ppm-field input { padding:9px 12px; border:1.5px solid #e2e8f0; border-radius:10px; font-size:13px; color:#0f172a; }
.ppm-field select:focus,.ppm-field input:focus { outline:none; border-color:#1e5fae; box-shadow:0 0 0 3px #1e5fae22; }
.ppm-method-btns { display:flex; gap:8px; }
.ppm-method-btn { flex:1; padding:9px 6px; border:1.5px solid #e2e8f0; border-radius:10px; background:white; font-size:12px; font-weight:700; color:#64748b; cursor:pointer; transition:all .15s; }
.ppm-method-btn--active { border-color:#1e5fae; background:#eff6ff; color:#1e5fae; box-shadow:0 0 0 2px #1e5fae33; }

.ppm-journal { margin:16px 22px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:14px; }
.ppm-journal-title { font-size:12px; font-weight:800; color:#065f46; margin-bottom:10px; }
.ppm-je-table { width:100%; border-collapse:collapse; font-size:12px; }
.ppm-je-table th { text-align:left; padding:6px 8px; background:#dcfce7; color:#065f46; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; }
.ppm-je-table td { padding:7px 8px; border-top:1px solid #bbf7d0; color:#166534; }
.ppm-dr { color:#1e5fae; font-weight:800; }
.ppm-cr { color:#059669; font-weight:800; }
.ppm-journal-note { font-size:10px; color:#6b7280; margin-top:8px; font-style:italic; }

.ppm-footer { display:flex; gap:10px; padding:16px 22px 20px; border-top:1px solid #f1f5f9; }
.ppm-btn { flex:1; padding:11px 16px; border:none; border-radius:10px; font-weight:800; font-size:13px; cursor:pointer; }
.ppm-btn--cancel { background:#f1f5f9; color:#475569; }
.ppm-btn--confirm { background:#059669; color:white; }
.ppm-btn--confirm:disabled,.ppm-btn--cancel:disabled { opacity:.5; cursor:not-allowed; }
.pay-net-box { margin:12px 16px; background:linear-gradient(135deg,#102a43 0%,#1e5fae 100%); border-radius:12px; padding:16px; color:white; text-align:center; }
.pay-net-label { font-size:10px; font-weight:800; letter-spacing:1px; opacity:.7; }
.pay-net-amount { font-size:20px; font-weight:900; margin:4px 0; }
.pay-net-words { font-size:9px; opacity:.8; line-height:1.4; }
/* Year filter in emp-card header */
.pay-year-filter { display:flex; align-items:center; gap:6px; margin-left:auto; margin-right:8px; }
.pay-year-filter-label { font-size:11px; font-weight:700; color:#64748b; }
.pay-year-sel { font-size:12px; font-weight:700; border:1.5px solid #e2e8f0; border-radius:6px; padding:4px 8px; background:#f8fafc; color:#1e293b; cursor:pointer; }
.pay-year-sel:focus { outline:none; border-color:#3b82f6; }
/* Slip list enhancements */
.pay-run-net { margin-top:6px; font-weight:800; color:#059669; font-size:14px; }
.pay-run-paid-pill { display:inline-block; margin-top:5px; font-size:10px; font-weight:700; background:#d1fae5; color:#065f46; border-radius:20px; padding:2px 8px; }
/* Payment status panel in My Slips right column */
.pay-slip-status-panel { margin:0 16px 12px; border:1.5px solid #e2e8f0; border-radius:10px; overflow:hidden; }
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
.pay-slip-email-badge--pending { background:#f1f5f9; color:#64748b; }

.pay-payment-edit { padding:10px 16px; display:flex; flex-direction:column; gap:8px; border-top:1px solid #f1f5f9; }
.pay-payment-edit label { font-size:11px; font-weight:700; color:#475569; display:flex; flex-direction:column; gap:4px; }
.pay-payment-edit select, .pay-payment-edit input { padding:6px 10px; border:1.5px solid #e2e8f0; border-radius:7px; font-size:12px; }
.pay-save-btn { margin:12px 16px; width:calc(100% - 32px); padding:10px; }

/* --- Badges ---------------------------------------------------------- */
.pay-badge { display:inline-block; padding:3px 8px; border-radius:999px; font-size:10px; font-weight:800; letter-spacing:.3px; }
.pay-badge--lg { padding:5px 12px; font-size:11px; }

/* --- Empty states ---------------------------------------------------- */
.pay-empty { padding:16px; text-align:center; color:#94a3b8; font-size:13px; }
.pay-empty--big { display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1; gap:12px; color:#94a3b8; font-size:13px; padding:40px; }
.pay-empty-icon { font-size:40px; opacity:.3; }
.pay-empty-sm { padding:20px; color:#94a3b8; font-size:13px; }

/* --- Card (for components/employees tabs) ---------------------------- */
.pay-card { margin:18px; background:white; border-radius:16px; border:1px solid #e2e8f0; overflow:clip; }
.pay-card-hd { padding:18px 20px 14px; border-bottom:1px solid #e2e8f0; }
.pay-card-hd h2 { font-size:18px; font-weight:800; color:#102a43; margin:0 0 4px; }
.pay-card-hd p  { font-size:13px; color:#64748b; margin:0; }
.pay-code { background:#f1f5f9; padding:2px 7px; border-radius:5px; font-size:12px; color:#1e5fae; font-weight:700; }
.pay-act-btn { padding:4px 10px; border:1.5px solid #e2e8f0; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer; background:white; color:#334155; margin-right:4px; }
.pay-act-btn:hover { background:#f8fafc; }
.pay-act-btn--del { color:#ef4444; border-color:#fee2e2; }
.pay-act-btn--del:hover { background:#fef2f2; }
.pay-check-group { display:flex; flex-direction:column; gap:6px; padding-top:20px; }
.pay-check { display:flex; align-items:center; gap:6px; font-size:13px; font-weight:600; color:#334155; cursor:pointer; }
.pay-check input { width:15px; height:15px; cursor:pointer; }

/* --- Overlays / Modals ----------------------------------------------- */
.pay-overlay { position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px; }
.pay-modal { background:white; border-radius:16px; width:520px; max-width:100%; max-height:90vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,.25); }
.pay-modal--wide { width:720px; }
.pay-modal-hd { padding:18px 22px 14px; font-size:18px; font-weight:800; color:#102a43; border-bottom:1px solid #e2e8f0; }
.pay-modal-body { padding:18px 22px; display:flex; flex-direction:column; gap:14px; }
.pay-modal-body label { display:flex; flex-direction:column; gap:5px; font-size:12px; font-weight:700; color:#475569; }
.pay-modal-body input, .pay-modal-body select, .pay-modal-body textarea { padding:9px 12px; border:1.5px solid #e2e8f0; border-radius:9px; font-size:14px; font-family:inherit; }
.pay-modal-body input:focus, .pay-modal-body select:focus, .pay-modal-body textarea:focus { outline:none; border-color:#1e5fae; }
.pay-modal-hint { font-size:11px; color:#94a3b8; background:#f8fafc; padding:10px 12px; border-radius:8px; margin:0; }
.pay-modal-ft { padding:14px 22px 18px; display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #e2e8f0; }
.pay-form-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.pay-full { grid-column:1/-1; }

/* --- PRINT: Salary Slip ---------------------------------------------- */
.pay-print-slip { display:none; }
.pay-print-stmt { display:none; }

@media print {
  .pay-page > *:not(.pay-print--active) { display:none !important; }
  .pay-print--active { display:block !important; position:relative; }

  /* Slip styles */
  .psl-company { display:flex; align-items:center; gap:16px; margin-bottom:14px; padding-bottom:12px; border-bottom:3px solid #102a43; }
  .psl-logo-box { width:52px; height:52px; background:linear-gradient(135deg,#102a43,#1e5fae); border-radius:10px; color:white; font-weight:900; font-size:18px; display:flex; align-items:center; justify-content:center; }
  .psl-company-name { font-size:16px; font-weight:900; color:#102a43; }
  .psl-company-detail { font-size:9px; color:#64748b; margin-top:2px; }

  .psl-title-bar { background:linear-gradient(90deg,#102a43 0%,#1e5fae 55%,#e2bc8a 100%); color:white; padding:10px 16px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
  .psl-title { font-size:18px; font-weight:900; letter-spacing:1px; }
  .psl-title-meta { display:flex; gap:16px; font-size:10px; opacity:.9; }

  .psl-watermark { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-35deg); font-size:80px; font-weight:900; color:rgba(239,68,68,.12); pointer-events:none; z-index:0; letter-spacing:4px; }

  .psl-emp-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px 14px; margin-bottom:14px; padding:12px 16px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; }
  .psl-emp-row { display:flex; flex-direction:column; gap:2px; }
  .psl-emp-row span { font-size:9px; color:#94a3b8; text-transform:uppercase; letter-spacing:.3px; }
  .psl-emp-row strong { font-size:12px; color:#102a43; font-weight:700; }

  .psl-columns { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:14px; }
  .psl-col-hd { padding:6px 10px; font-size:11px; font-weight:800; color:white; border-radius:6px 6px 0 0; }
  .psl-earn-hd { background:#059669; }
  .psl-ded-hd  { background:#ef4444; }
  .psl-table { width:100%; border-collapse:collapse; font-size:11px; }
  .psl-table th { background:#f8fafc; padding:6px 8px; text-align:left; font-weight:700; color:#475569; border-bottom:1px solid #e2e8f0; }
  .psl-table td { padding:5px 8px; border-bottom:1px solid #f1f5f9; }
  .psl-r { text-align:right !important; }
  .psl-subtotal td { background:#f1f5f9; font-weight:700; border-top:2px solid #e2e8f0; }

  .psl-net-section { background:linear-gradient(135deg,#102a43 0%,#1e5fae 100%); color:white; border-radius:10px; padding:14px 20px; margin-bottom:14px; }
  .psl-net-row { display:flex; justify-content:space-between; font-size:12px; padding:3px 0; }
  .psl-net-row--ded { color:rgba(255,255,255,.8); }
  .psl-net-row--total { font-size:17px; font-weight:900; padding:6px 0; }
  .psl-net-divider { border-top:1.5px solid rgba(255,255,255,.3); margin:6px 0; }
  .psl-in-words { font-size:10px; color:rgba(255,255,255,.85); margin-top:6px; }

  .psl-payment { margin-bottom:14px; padding:10px 14px; border:1px solid #e2e8f0; border-radius:8px; }
  .psl-payment-hd { font-size:10px; font-weight:800; color:#102a43; text-transform:uppercase; margin-bottom:6px; }
  .psl-payment-row { display:flex; gap:10px; font-size:11px; color:#334155; padding:2px 0; }
  .psl-payment-row span { color:#94a3b8; min-width:110px; }

  .psl-sig-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; margin-bottom:14px; }
  .psl-sig-box { text-align:center; font-size:10px; color:#64748b; }
  .psl-sig-line { border-top:1.5px solid #334155; margin-bottom:6px; }
  .psl-sig-name { font-weight:700; color:#102a43; }

  .psl-footer { display:flex; justify-content:space-between; font-size:9px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:8px; }
  .psl-verify { font-family:monospace; color:#102a43; }

  /* Statement styles */
  @page { size:A4 landscape; margin:12mm; }
  .pst-header { margin-bottom:10px; }
  .pst-company { font-size:14px; font-weight:900; color:#102a43; }
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

