import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { API_BASE } from "../lib/api";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const today = new Date().toISOString().split("T")[0];
const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

interface Customer {
  id: number;
  full_name: string;
  phone_number: string;
  customer_number?: string;
}

interface Installment {
  number: number;
  due_date: string;
  amount: number; // scheduled installment amount
  paid: boolean;
  paid_date: string;
  normal_paid: string;  // actual normal/principal amount paid
  penalty_paid: string; // penalty amount paid (if any)
}

interface FieldErrors { [key: string]: string }

function FErr({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p style={{ fontSize: 11, color: "#dc2626", margin: "4px 0 0 0", fontWeight: 600 }}>{msg}</p>;
}

// Mirror of backend buildScheduleRows — flat-rate method
function buildSchedule(
  principal: number,
  monthlyRate: number,
  months: number,
  frequency: string,
  disbursedAt: string
): { number: number; due_date: string; amount: number }[] {
  if (!principal || !months || !disbursedAt) return [];

  const installmentsPerMonth =
    frequency === "Weekly" ? 4.33
    : frequency === "Bi-Weekly" ? 2.165
    : frequency === "Daily" ? 30
    : frequency === "Quarterly" ? 1 / 3
    : 1.0;

  const total = Math.max(1, Math.round(months * installmentsPerMonth));
  const totalInterest = principal * monthlyRate * months;
  const principalPer = principal / total;
  const interestPer = totalInterest / total;
  const amountPer = Math.round((principalPer + interestPer) * 100) / 100;

  const rows: { number: number; due_date: string; amount: number }[] = [];
  const date = new Date(disbursedAt + "T00:00:00");

  for (let i = 1; i <= total; i++) {
    if (frequency === "Weekly") date.setDate(date.getDate() + 7);
    else if (frequency === "Bi-Weekly") date.setDate(date.getDate() + 14);
    else if (frequency === "Daily") date.setDate(date.getDate() + 1);
    else if (frequency === "Quarterly") date.setMonth(date.getMonth() + 3);
    else date.setMonth(date.getMonth() + 1);

    rows.push({
      number: i,
      due_date: date.toISOString().split("T")[0],
      amount: amountPer,
    });
  }
  return rows;
}

export default function HistoricalLoan() {
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [searchPhone, setSearchPhone] = useState("");
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const [amount, setAmount] = useState("");
  const [totalRepayable, setTotalRepayable] = useState(""); // "Riba" as written on paper = total to repay
  const [termMonths, setTermMonths] = useState("");
  const [frequency, setFrequency] = useState("Monthly");
  const [disbursedAt, setDisbursedAt] = useState("");
  const [employment, setEmployment] = useState("Hapana");
  const [processingFee, setProcessingFee] = useState("0");
  const [insuranceFee, setInsuranceFee] = useState("0");
  const [otherCharges, setOtherCharges] = useState("0");

  const [g1Name, setG1Name] = useState("");
  const [g1Phone, setG1Phone] = useState("");
  const [g2Name, setG2Name] = useState("");
  const [g2Phone, setG2Phone] = useState("");

  // Installment schedule state — each row tracks paid status + payment date
  const [installments, setInstallments] = useState<Installment[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ loanNo: string; remaining: number } | null>(null);
  const [globalError, setGlobalError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (customerMode !== "existing" || searchPhone.length < 7) {
      setFoundCustomer(null); setSearchError(""); return;
    }
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(async () => {
      setSearchLoading(true); setSearchError("");
      try {
        const res = await axios.get(`${API_BASE}/customers/search?q=${searchPhone}`, { headers: getAuthHeaders() });
        const list: Customer[] = res.data?.data ?? res.data ?? [];
        const match = list.find(c => c.phone_number.replace(/\s/g, "") === searchPhone.replace(/\s/g, ""));
        if (match) { setFoundCustomer(match); setSearchError(""); }
        else { setFoundCustomer(null); setSearchError("Mteja hajapatikana. Badilisha kwenye 'Mteja Mpya' ili kumsajili."); }
      } catch { setSearchError("Hitilafu ya mtandao. Jaribu tena."); }
      finally { setSearchLoading(false); }
    }, 500);
  }, [searchPhone, customerMode]);

  // Derive monthly interest rate from (totalRepayable - principal) / (principal × months)
  const derivedRate = useMemo(() => {
    const p = parseFloat(amount) || 0;
    const t = parseFloat(totalRepayable) || 0;
    const m = parseInt(termMonths) || 0;
    if (!p || !m || t <= p) return 0;
    return (t - p) / (p * m) * 100;
  }, [amount, totalRepayable, termMonths]);

  // Recompute schedule whenever loan parameters change.
  // When the scheduled amount for an installment changes (loan params changed),
  // reset normal_paid to the new amount so stale user-entered values don't persist.
  useEffect(() => {
    const principal = parseFloat(amount) || 0;
    const rate = derivedRate / 100;
    const months = parseInt(termMonths) || 0;

    if (!principal || !rate || !months || !disbursedAt) {
      setInstallments([]);
      return;
    }

    const rows = buildSchedule(principal, rate, months, frequency, disbursedAt);
    if (rows.length === 0) { setInstallments([]); return; }
    setInstallments(prev => rows.map(r => {
      const existing = prev.find(p => p.number === r.number);
      // If the scheduled amount changed (loan params were edited), reset normal_paid.
      const amountChanged = existing && existing.amount !== r.amount;
      return {
        number: r.number,
        due_date: r.due_date,
        amount: r.amount,
        paid: existing?.paid ?? false,
        paid_date: existing?.paid_date ?? "",
        normal_paid: (amountChanged || !existing) ? String(r.amount) : existing.normal_paid,
        penalty_paid: (amountChanged || !existing) ? "0" : existing.penalty_paid,
      };
    }));
  }, [amount, derivedRate, termMonths, frequency, disbursedAt]);

  const togglePaid = (i: number) => {
    setInstallments(prev => prev.map((inst, idx) =>
      idx === i
        ? { ...inst, paid: !inst.paid, paid_date: inst.paid ? "" : inst.paid_date,
            normal_paid: inst.paid ? String(inst.amount) : inst.normal_paid,
            penalty_paid: inst.paid ? "0" : inst.penalty_paid }
        : inst
    ));
  };

  const setInstField = (i: number, field: "paid_date" | "normal_paid" | "penalty_paid", val: string) => {
    setInstallments(prev => prev.map((inst, idx) => idx === i ? { ...inst, [field]: val } : inst));
  };

  const paidCount = installments.filter(i => i.paid).length;
  const totalNormalPaid = installments.filter(i => i.paid).reduce((s, i) => s + (parseFloat(i.normal_paid) || 0), 0);
  const totalPenaltyPaid = installments.filter(i => i.paid).reduce((s, i) => s + (parseFloat(i.penalty_paid) || 0), 0);
  const totalPaid = totalNormalPaid + totalPenaltyPaid;
  const totalLoan = installments.reduce((s, i) => s + i.amount, 0);
  const remaining = Math.max(0, totalLoan - totalNormalPaid);

  const validate = (): boolean => {
    const errs: FieldErrors = {};
    if (customerMode === "existing") {
      if (!searchPhone.trim()) errs.searchPhone = "Ingiza namba ya simu ya mteja.";
      else if (!foundCustomer) errs.searchPhone = "Thibitisha mteja kwa kutafuta namba yake.";
    } else {
      if (!newName.trim()) errs.newName = "Jina la mteja linahitajika.";
      if (!newPhone.trim()) errs.newPhone = "Namba ya simu inahitajika.";
      else if (!/^0[0-9]{9}$/.test(newPhone.replace(/\s/g, ""))) errs.newPhone = "Namba ya simu sio sahihi (mfano: 0712345678).";
    }
    if (!amount || parseFloat(amount) <= 0) errs.amount = "Kiasi cha mkopo lazima kiwe zaidi ya sifuri.";
    const riba = parseFloat(totalRepayable) || 0;
    const principal = parseFloat(amount) || 0;
    if (!totalRepayable || riba <= 0) errs.totalRepayable = "Jumla ya kulipa (Riba) inahitajika.";
    else if (riba < principal) errs.totalRepayable = "Jumla ya kulipa lazima iwe sawa au zaidi ya kiasi cha mkopo.";
    else if (riba === principal) errs.totalRepayable = "Riba ni 0% — hakuna faida. Thibitisha tena.";
    if (!termMonths || parseInt(termMonths) < 1 || !Number.isInteger(parseFloat(termMonths))) errs.termMonths = "Muda lazima uwe namba nzima zaidi ya sifuri.";
    if (!disbursedAt) errs.disbursedAt = "Tarehe ya kutolewa inahitajika.";
    else if (disbursedAt > today) errs.disbursedAt = "Tarehe ya kutolewa haiwezi kuwa siku zijazo.";
    if ((g1Name.trim() && !g1Phone.trim()) || (!g1Name.trim() && g1Phone.trim())) errs.g1 = "Jina na simu ya Mdhamini 1 lazima vijazwe vyote.";
    if (g1Phone.trim() && !/^0[0-9]{9}$/.test(g1Phone.replace(/\s/g, ""))) errs.g1Phone = "Simu ya Mdhamini 1 sio sahihi.";
    if ((g2Name.trim() && !g2Phone.trim()) || (!g2Name.trim() && g2Phone.trim())) errs.g2 = "Jina na simu ya Mdhamini 2 lazima vijazwe vyote.";
    if (g2Phone.trim() && !/^0[0-9]{9}$/.test(g2Phone.replace(/\s/g, ""))) errs.g2Phone = "Simu ya Mdhamini 2 sio sahihi.";

    // Fee validation
    const pf = parseFloat(processingFee) || 0;
    const ins = parseFloat(insuranceFee) || 0;
    const oc = parseFloat(otherCharges) || 0;
    if (pf < 0) errs.processingFee = "Ada ya usindikaji haiwezi kuwa chini ya sifuri.";
    if (ins < 0) errs.insuranceFee = "Ada ya bima haiwezi kuwa chini ya sifuri.";
    if (oc < 0) errs.otherCharges = "Gharama nyingine haiwezi kuwa chini ya sifuri.";
    const totalFees = pf + ins + oc;
    const loanAmt = parseFloat(amount) || 0;
    if (loanAmt > 0 && totalFees >= loanAmt) {
      errs.fees = "Jumla ya ada haiwezi kuwa sawa au zaidi ya kiasi cha mkopo.";
    }

    // Validate each paid installment
    installments.forEach((inst, i) => {
      if (!inst.paid) return;
      if (!inst.paid_date) {
        errs[`inst_date_${i}`] = "Tarehe ya malipo inahitajika.";
      } else if (disbursedAt && inst.paid_date < disbursedAt) {
        errs[`inst_date_${i}`] = "Tarehe haiwezi kuwa kabla ya kutolewa mkopo.";
      } else if (inst.paid_date > today) {
        errs[`inst_date_${i}`] = "Tarehe haiwezi kuwa siku zijazo.";
      }
      const norm = parseFloat(inst.normal_paid) || 0;
      if (norm <= 0) errs[`inst_norm_${i}`] = "Malipo ya kawaida lazima yawe zaidi ya sifuri.";
      const pen = parseFloat(inst.penalty_paid) || 0;
      if (pen < 0) errs[`inst_pen_${i}`] = "Penati haiwezi kuwa chini ya sifuri.";
    });

    // Gap detection: cannot mark a later installment paid if an earlier one is unpaid
    for (let i = 1; i < installments.length; i++) {
      if (installments[i].paid && !installments[i - 1].paid) {
        errs[`inst_gap_${i}`] = `Awamu #${installments[i - 1].number} bado haijatiwa alama ya "Amelipa" — lazima ulipie kwa mpangilio.`;
      }
    }

    // Total normal payments must not exceed total scheduled (principal + interest)
    const totalNorm = installments.filter(i => i.paid).reduce((s, i) => s + (parseFloat(i.normal_paid) || 0), 0);
    const totalSched = installments.reduce((s, i) => s + i.amount, 0);
    if (totalNorm > totalSched + 1) { // +1 TZS rounding tolerance
      errs.totalPayments = `Jumla ya malipo ya kawaida (TZS ${fmt(totalNorm)}) inazidi jumla ya mkopo na riba (TZS ${fmt(totalSched)}).`;
    }

    // Must have schedule generated before submitting
    if (installments.length === 0 && parseFloat(amount) > 0 && parseInt(termMonths) > 0 && disbursedAt) {
      errs.schedule = "Ratiba ya malipo haijatengenezwa. Jaza maelezo ya mkopo kwanza.";
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const resetForm = () => {
    setSearchPhone(""); setFoundCustomer(null); setNewName(""); setNewPhone("");
    setAmount(""); setTotalRepayable(""); setTermMonths(""); setDisbursedAt("");
    setEmployment("Hapana"); setProcessingFee("0"); setInsuranceFee("0"); setOtherCharges("0");
    setG1Name(""); setG1Phone(""); setG2Name(""); setG2Phone("");
    setInstallments([]); setFieldErrors({});
  };

  const handleSubmit = async () => {
    setGlobalError("");
    if (!validate()) {
      setGlobalError("Tafadhali sahihisha makosa yaliyoonyeshwa hapa chini.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const phone = (customerMode === "existing" ? searchPhone : newPhone).replace(/\s/g, "");
    const name  = customerMode === "existing" ? foundCustomer?.full_name : newName;

    // Convert paid installments to payments array (normal + penalty per installment)
    const payments = installments
      .filter(inst => inst.paid && inst.paid_date)
      .map(inst => ({
        date: inst.paid_date,
        amount: parseFloat(inst.normal_paid) || 0,
        penalty: parseFloat(inst.penalty_paid) || 0,
      }));

    const payload: Record<string, unknown> = {
      customer_phone: phone, customer_name: name,
      customer_id: foundCustomer?.id ?? undefined,
      amount: parseFloat(amount), interest_rate: parseFloat(derivedRate.toFixed(6)),
      term_months: parseInt(termMonths), repayment_frequency: frequency,
      disbursed_at: disbursedAt, employment,
      processing_fee: parseFloat(processingFee) || 0,
      insurance_fee: parseFloat(insuranceFee) || 0,
      other_charges: parseFloat(otherCharges) || 0,
      guarantor_1_name: g1Name.trim() || undefined, guarantor_1_phone: g1Phone.trim() || undefined,
      guarantor_2_name: g2Name.trim() || undefined, guarantor_2_phone: g2Phone.trim() || undefined,
      payments,
    };
    setSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/loans/historical`, payload, { headers: getAuthHeaders() });
      setSuccess({
        loanNo: res.data.loan?.loan_account_number ?? "—",
        remaining: res.data.loan?.remaining_balance ?? 0,
      });
      resetForm();
    } catch (e: unknown) {
      const resp = (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
      setGlobalError(resp?.errors ? Object.values(resp.errors).flat().join(" | ") : (resp?.message ?? "Imeshindwa. Jaribu tena."));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally { setSubmitting(false); }
  };

  const inp = (err?: string) => `hl-input${err ? " hl-err" : ""}`;

  return (
    <div className="hl-wrap">
      <style>{`
        .hl-wrap { padding: 24px 32px; }
        .hl-title { font-size: 22px; font-weight: 800; color: #1e293b; margin: 0 0 4px; display: flex; align-items: center; gap: 10px; }
        .hl-subtitle { font-size: 13px; color: #64748b; margin: 0 0 24px; }
        .hl-badge { background: #fef9c3; color: #854d0e; border-radius: 6px; padding: 3px 9px; font-size: 11px; font-weight: 700; }
        .hl-section { background: #102a43; color: #fff; padding: 8px 16px; border-radius: 6px; font-weight: 700; font-size: 13px; margin-bottom: 18px; margin-top: 8px; }
        .hl-body { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px 28px; margin-bottom: 24px; }
        .hl-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .hl-grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .hl-field { display: flex; flex-direction: column; }
        .hl-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .hl-input { width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; color: #1e293b; background: #fff; box-sizing: border-box; transition: border-color 0.15s; outline: none; }
        .hl-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.08); }
        .hl-input.hl-err { border-color: #f87171; background: #fff8f8; }
        .hl-toggle { display: flex; gap: 8px; margin-bottom: 16px; }
        .hl-toggle-btn { flex: 1; padding: 9px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1.5px solid #cbd5e1; background: #f8fafc; color: #64748b; transition: all 0.15s; }
        .hl-toggle-btn.active { background: #102a43; border-color: #102a43; color: #fff; }
        .hl-found { background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 10px 14px; font-size: 13px; color: #16a34a; font-weight: 600; margin-top: 8px; }
        .hl-totals { display: flex; background: #f1f5f9; border-radius: 8px; padding: 14px 20px; margin-top: 16px; }
        .hl-totals-col { flex: 1; text-align: center; padding: 0 10px; border-right: 1px solid #e2e8f0; }
        .hl-totals-col:last-child { border-right: none; }
        .hl-totals-col .tv { font-size: 17px; font-weight: 800; color: #1e293b; }
        .hl-totals-col .tl { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 3px; }
        .hl-global-err { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 12px 16px; color: #dc2626; font-size: 13px; margin-bottom: 18px; }
        .hl-field-err { font-size: 11px; color: #dc2626; margin: 4px 0 0; font-weight: 600; }
        .hl-section-err { background: #fef2f2; border-radius: 6px; padding: 8px 12px; color: #dc2626; font-size: 11px; margin-top: 8px; font-weight: 600; }
        .hl-success { background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px; padding: 24px 28px; text-align: center; margin-bottom: 24px; }
        .hl-success h2 { color: #16a34a; font-size: 17px; margin: 0 0 10px; }
        .hl-success p { color: #4d7c0f; font-size: 13px; margin: 4px 0; }
        .hl-submit { width: 100%; padding: 14px; border-radius: 8px; background: #102a43; color: #fff; font-size: 14px; font-weight: 700; border: none; cursor: pointer; transition: opacity 0.15s; }
        .hl-submit:hover:not(:disabled) { background: #1e3a5f; }
        .hl-submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .hl-hint { font-size: 12px; color: #64748b; margin: -8px 0 16px; }

        /* Schedule table */
        .hl-sched-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .hl-sched-table th { background: #f8fafc; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; text-align: left; }
        .hl-sched-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        .hl-sched-table tr:last-child td { border-bottom: none; }
        .hl-sched-row-paid { background: #f0fdf4; }
        .hl-sched-row-pending { background: #fff; }
        .hl-sched-row-overdue { background: #fff7ed; }

        .hl-paid-toggle { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
        .hl-paid-toggle input[type=checkbox] { width: 16px; height: 16px; accent-color: #16a34a; cursor: pointer; }

        .hl-date-input { padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 5px; font-size: 12px; color: #1e293b; width: 140px; box-sizing: border-box; }
        .hl-date-input:focus { border-color: #3b82f6; outline: none; }
        .hl-date-input.err { border-color: #f87171; background: #fff8f8; }

        .hl-status-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 800; white-space: nowrap; }
        .hl-badge-paid { background: #dcfce7; color: #16a34a; }
        .hl-badge-pending { background: #fef9c3; color: #854d0e; }
        .hl-badge-overdue { background: #fee2e2; color: #dc2626; }

        .hl-empty-sched { text-align: center; padding: 28px 0; color: #94a3b8; font-size: 13px; }

        @media (max-width: 700px) {
          .hl-grid2, .hl-grid3 { grid-template-columns: 1fr; }
          .hl-sched-table { font-size: 11px; }
          .hl-date-input { width: 120px; }
        }
      `}</style>

      <h1 className="hl-title">
        Ingiza Mkopo wa Zamani
        <span className="hl-badge">KIHISTORIA</span>
      </h1>
      <p className="hl-subtitle">
        Rekodi mkopo ulioidhinishwa kabla ya mfumo — jaza maelezo na onyesha awamu zilizolipwa ili mfumo uhesabu deni sahihi.
      </p>

      {globalError && <div className="hl-global-err">⚠ {globalError}</div>}

      {success && (
        <div className="hl-success">
          <h2>✓ Mkopo Umerekodiwa Kikamilifu!</h2>
          <p>Namba ya Akaunti: <strong>{success.loanNo}</strong></p>
          <p>Salio linalobaki: <strong>TZS {fmt(success.remaining)}</strong></p>
          <p style={{ fontSize: 11, marginTop: 10, color: "#6b7280" }}>
            Ujumbe wa taarifa umepelekwa kwa wafanyakazi wote. Mteja ataendelea kupata SMS za malipo yake ya kawaida.
          </p>
          <button
            onClick={() => setSuccess(null)}
            style={{ marginTop: 14, padding: "9px 22px", borderRadius: 6, background: "#16a34a", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
          >
            Ingiza Mkopo Mwingine
          </button>
        </div>
      )}

      <div className="hl-body">

        {/* ── SEHEMU 1: MTEJA ────────────────────────────────────────────── */}
        <div className="hl-section">SEHEMU 1: TAARIFA ZA MTEJA</div>

        <div className="hl-toggle">
          <button className={`hl-toggle-btn${customerMode === "existing" ? " active" : ""}`}
            onClick={() => { setCustomerMode("existing"); setFieldErrors({}); }}>
            Mteja Aliyepo Mfumoni
          </button>
          <button className={`hl-toggle-btn${customerMode === "new" ? " active" : ""}`}
            onClick={() => { setCustomerMode("new"); setFieldErrors({}); }}>
            Mteja Mpya
          </button>
        </div>

        {customerMode === "existing" ? (
          <div className="hl-field" style={{ marginBottom: 16 }}>
            <label className="hl-label">Tafuta kwa Namba ya Simu</label>
            <input className={inp(fieldErrors.searchPhone)} placeholder="0712345678"
              value={searchPhone} onChange={e => setSearchPhone(e.target.value)} />
            {searchLoading && <p style={{ fontSize: 12, color: "#64748b", margin: "6px 0 0" }}>Inatafuta...</p>}
            {searchError && <p style={{ fontSize: 12, color: "#dc2626", margin: "6px 0 0" }}>{searchError}</p>}
            {foundCustomer && (
              <div className="hl-found">
                ✓ {foundCustomer.full_name} — {foundCustomer.phone_number}
                {foundCustomer.customer_number && <span style={{ opacity: 0.7 }}> ({foundCustomer.customer_number})</span>}
              </div>
            )}
            {fieldErrors.searchPhone && <p className="hl-field-err">{fieldErrors.searchPhone}</p>}
          </div>
        ) : (
          <div className="hl-grid2">
            <div className="hl-field">
              <label className="hl-label">Jina Kamili la Mteja</label>
              <input className={inp(fieldErrors.newName)} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Jina Kamili" />
              {fieldErrors.newName && <p className="hl-field-err">{fieldErrors.newName}</p>}
            </div>
            <div className="hl-field">
              <label className="hl-label">Namba ya Simu</label>
              <input className={inp(fieldErrors.newPhone)} value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="0712345678" />
              {fieldErrors.newPhone && <p className="hl-field-err">{fieldErrors.newPhone}</p>}
            </div>
          </div>
        )}

        {/* ── SEHEMU 2: MKOPO ────────────────────────────────────────────── */}
        <div className="hl-section" style={{ marginTop: 24 }}>SEHEMU 2: MAELEZO YA MKOPO</div>

        <div className="hl-grid2">
          <div className="hl-field">
            <label className="hl-label">Mkopo — Kiasi Kilichotolewa (TZS)</label>
            <input className={inp(fieldErrors.amount)} type="number" min="1" value={amount}
              onChange={e => setAmount(e.target.value)} placeholder="200000" />
            {fieldErrors.amount && <p className="hl-field-err">{fieldErrors.amount}</p>}
          </div>
          <div className="hl-field">
            <label className="hl-label">Riba — Jumla ya Kulipa (TZS)</label>
            <input className={inp(fieldErrors.totalRepayable)} type="number" min="1" value={totalRepayable}
              onChange={e => setTotalRepayable(e.target.value)} placeholder="280000" />
            <p style={{ fontSize: 11, color: "#64748b", margin: "3px 0 0" }}>
              {derivedRate > 0
                ? `≈ ${derivedRate.toFixed(1)}% kwa mwezi`
                : "Jumla ya kulipa kama inavyoandikwa karatasi (Mkopo + Riba)"}
            </p>
            {fieldErrors.totalRepayable && <p className="hl-field-err">{fieldErrors.totalRepayable}</p>}
          </div>
        </div>
        <div className="hl-grid2">
          <div className="hl-field">
            <label className="hl-label">Muda wa Mkopo (Miezi)</label>
            <input className={inp(fieldErrors.termMonths)} type="number" min="1" value={termMonths}
              onChange={e => setTermMonths(e.target.value)} placeholder="12" />
            {fieldErrors.termMonths && <p className="hl-field-err">{fieldErrors.termMonths}</p>}
          </div>
          <div className="hl-field">
            <label className="hl-label">Mzunguko wa Malipo</label>
            <select className="hl-input" value={frequency} onChange={e => setFrequency(e.target.value)}>
              <option value="Monthly">Kila Mwezi</option>
              <option value="Weekly">Kila Wiki</option>
              <option value="Bi-Weekly">Wiki Mbili Mbili</option>
              <option value="Daily">Kila Siku</option>
              <option value="Quarterly">Kila Robo Mwaka</option>
            </select>
          </div>
        </div>
        <div className="hl-grid2">
          <div className="hl-field">
            <label className="hl-label">Tarehe ya Kutolewa kwa Mkopo</label>
            <input className={inp(fieldErrors.disbursedAt)} type="date" max={today}
              value={disbursedAt} onChange={e => setDisbursedAt(e.target.value)} />
            {fieldErrors.disbursedAt && <p className="hl-field-err">{fieldErrors.disbursedAt}</p>}
          </div>
          <div className="hl-field">
            <label className="hl-label">Hali ya Ajira ya Mkopaji</label>
            <select className="hl-input" value={employment} onChange={e => setEmployment(e.target.value)}>
              <option value="Hapana">Hajaajiriwa (Biashara)</option>
              <option value="Ndio">Ameajiriwa</option>
            </select>
          </div>
        </div>

        {/* Fees row */}
        <div className="hl-grid3" style={{ marginTop: 0 }}>
          <div className="hl-field">
            <label className="hl-label">Ada ya Usindikaji / Processing Fee (TZS)</label>
            <input className={inp(fieldErrors.processingFee)} type="number" min="0" value={processingFee}
              onChange={e => setProcessingFee(e.target.value)} placeholder="0" />
            <FErr msg={fieldErrors.processingFee} />
          </div>
          <div className="hl-field">
            <label className="hl-label">Ada ya Bima / Insurance Fee (TZS)</label>
            <input className={inp(fieldErrors.insuranceFee)} type="number" min="0" value={insuranceFee}
              onChange={e => setInsuranceFee(e.target.value)} placeholder="0" />
            <FErr msg={fieldErrors.insuranceFee} />
          </div>
          <div className="hl-field">
            <label className="hl-label">Gharama Nyingine / Other Charges (TZS)</label>
            <input className={inp(fieldErrors.otherCharges)} type="number" min="0" value={otherCharges}
              onChange={e => setOtherCharges(e.target.value)} placeholder="0" />
            <FErr msg={fieldErrors.otherCharges} />
          </div>
        </div>
        {fieldErrors.fees && <div className="hl-section-err">⚠ {fieldErrors.fees}</div>}

        {/* Disbursement breakdown — always visible when amount is entered */}
        {(parseFloat(amount) || 0) > 0 && (() => {
          const a = parseFloat(amount) || 0;
          const tr = parseFloat(totalRepayable) || 0;
          const pf = parseFloat(processingFee) || 0;
          const ins = parseFloat(insuranceFee) || 0;
          const oc = parseFloat(otherCharges) || 0;
          const totalF = pf + ins + oc;
          const net = Math.max(0, a - totalF);
          const totalInt = tr > a ? tr - a : 0;
          const hasBreakdown = tr > a && parseInt(termMonths) > 0;
          return (
            <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 12 }}>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
                <div><span style={{ color: "#64748b" }}>Mkopo:</span> <strong style={{ color: "#1e293b" }}>TZS {fmt(a)}</strong></div>
                {totalF > 0 && <div><span style={{ color: "#64748b" }}>Ada zote:</span> <strong style={{ color: "#b45309" }}>−TZS {fmt(totalF)}</strong></div>}
                <div><span style={{ color: "#64748b" }}>Mteja alipokea:</span> <strong style={{ color: "#1d4ed8" }}>TZS {fmt(net)}</strong></div>
                {hasBreakdown && <div><span style={{ color: "#64748b" }}>Faida (Riba):</span> <strong style={{ color: "#7c3aed" }}>TZS {fmt(Math.round(totalInt))}</strong></div>}
                {hasBreakdown && <div><span style={{ color: "#64748b" }}>Jumla ya kulipa:</span> <strong style={{ color: "#dc2626" }}>TZS {fmt(Math.round(tr))}</strong></div>}
                {hasBreakdown && <div><span style={{ color: "#64748b" }}>Kiwango:</span> <strong style={{ color: "#059669" }}>{derivedRate.toFixed(1)}%/mwezi</strong></div>}
              </div>
            </div>
          );
        })()}

        {/* ── SEHEMU 3: WADHAMINI ─────────────────────────────────────────── */}
        <div className="hl-section" style={{ marginTop: 24 }}>SEHEMU 3: WADHAMINI (HIARI)</div>
        <p className="hl-hint">Jaza jina na simu vyote viwili au viacha wote wazi. Wadhamini watapata SMS kama mkopaji atachelewa kulipa.</p>

        <div className="hl-grid2">
          <div className="hl-field">
            <label className="hl-label">Mdhamini 1 — Jina</label>
            <input className={inp(fieldErrors.g1)} value={g1Name} onChange={e => setG1Name(e.target.value)} placeholder="Jina Kamili" />
          </div>
          <div className="hl-field">
            <label className="hl-label">Mdhamini 1 — Simu</label>
            <input className={inp(fieldErrors.g1 || fieldErrors.g1Phone)} value={g1Phone}
              onChange={e => setG1Phone(e.target.value)} placeholder="0712345678" />
          </div>
        </div>
        {(fieldErrors.g1 || fieldErrors.g1Phone) && <div className="hl-section-err">{fieldErrors.g1 || fieldErrors.g1Phone}</div>}

        <div className="hl-grid2" style={{ marginTop: 14 }}>
          <div className="hl-field">
            <label className="hl-label">Mdhamini 2 — Jina (Hiari)</label>
            <input className={inp(fieldErrors.g2)} value={g2Name} onChange={e => setG2Name(e.target.value)} placeholder="Jina Kamili" />
          </div>
          <div className="hl-field">
            <label className="hl-label">Mdhamini 2 — Simu (Hiari)</label>
            <input className={inp(fieldErrors.g2 || fieldErrors.g2Phone)} value={g2Phone}
              onChange={e => setG2Phone(e.target.value)} placeholder="0712345678" />
          </div>
        </div>
        {(fieldErrors.g2 || fieldErrors.g2Phone) && <div className="hl-section-err">{fieldErrors.g2 || fieldErrors.g2Phone}</div>}

        {/* ── SEHEMU 4: HALI YA MALIPO KWA KILA AWAMU ────────────────────── */}
        <div className="hl-section" style={{ marginTop: 24 }}>SEHEMU 4: HALI YA MALIPO — AMELIPA LINI?</div>
        <p className="hl-hint">
          Mfumo umehesabu awamu zote za mkopo huu. Bonyeza kisanduku cha "Amelipa" kwa kila awamu iliyolipwa na ingiza tarehe halisi ya malipo.
          Awamu ambazo hazijalipwa zinabaki kama "Bado" — mfumo utatumia tarehe hizi kuhesabu deni na mwaka unaofuata wa malipo.
        </p>

        {fieldErrors.schedule && <div className="hl-section-err">⚠ {fieldErrors.schedule}</div>}
        {fieldErrors.totalPayments && <div className="hl-section-err">⚠ {fieldErrors.totalPayments}</div>}

        {installments.length === 0 ? (
          <div className="hl-empty-sched">
            📋 Jaza kiasi, riba, muda na tarehe ya kutolewa mkopo ili ratiba ionekane hapa.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="hl-sched-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tarehe ya Ratiba</th>
                  <th style={{ textAlign: "right" }}>Kiasi Ratiba</th>
                  <th style={{ textAlign: "center" }}>Amelipa?</th>
                  <th>Malipo ya Kawaida (TZS) <span style={{ color: "#ef4444" }}>*</span></th>
                  <th>Penati Iliyolipwa (TZS)</th>
                  <th>Tarehe Halisi <span style={{ color: "#ef4444" }}>*</span></th>
                  <th>Hali</th>
                </tr>
              </thead>
              <tbody>
                {installments.map((inst, i) => {
                  const isOverdue = !inst.paid && inst.due_date < today;
                  const rowClass = inst.paid ? "hl-sched-row-paid" : isOverdue ? "hl-sched-row-overdue" : "hl-sched-row-pending";
                  const badgeClass = inst.paid ? "hl-badge-paid" : isOverdue ? "hl-badge-overdue" : "hl-badge-pending";
                  const badgeLabel = inst.paid ? "✓ Amelipa" : isOverdue ? "⚠ Chelewa" : "Bado";
                  const totalThisInst = (parseFloat(inst.normal_paid) || 0) + (parseFloat(inst.penalty_paid) || 0);
                  return (
                    <React.Fragment key={inst.number}>
                    <tr className={rowClass}>
                      <td>
                        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 28, height: 22, padding: "0 7px", borderRadius: 6, background: "#102a43", color: "#e2bc8a", fontWeight: 800, fontSize: "0.72rem" }}>
                          #{inst.number}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: "#475569" }}>
                        {new Date(inst.due_date + "T00:00:00").toLocaleDateString("en-GB")}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "#1e293b" }}>
                        {fmt(inst.amount)}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <label className="hl-paid-toggle">
                          <input type="checkbox" checked={inst.paid} onChange={() => togglePaid(i)} />
                        </label>
                      </td>

                      {/* Malipo ya kawaida */}
                      <td>
                        {inst.paid ? (
                          <div>
                            <input
                              type="number" min="0"
                              className={`hl-date-input${fieldErrors[`inst_norm_${i}`] ? " err" : ""}`}
                              style={{ width: 110 }}
                              value={inst.normal_paid}
                              onChange={e => setInstField(i, "normal_paid", e.target.value)}
                            />
                            {fieldErrors[`inst_norm_${i}`] && (
                              <p style={{ fontSize: 10, color: "#dc2626", margin: "3px 0 0", fontWeight: 600 }}>{fieldErrors[`inst_norm_${i}`]}</p>
                            )}
                          </div>
                        ) : <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>}
                      </td>

                      {/* Penati */}
                      <td>
                        {inst.paid ? (
                          <div>
                            <input
                              type="number" min="0"
                              className={`hl-date-input${fieldErrors[`inst_pen_${i}`] ? " err" : ""}`}
                              style={{ width: 90 }}
                              value={inst.penalty_paid}
                              onChange={e => setInstField(i, "penalty_paid", e.target.value)}
                              placeholder="0"
                            />
                            {fieldErrors[`inst_pen_${i}`] && (
                              <p style={{ fontSize: 10, color: "#dc2626", margin: "3px 0 0", fontWeight: 600 }}>{fieldErrors[`inst_pen_${i}`]}</p>
                            )}
                            {totalThisInst > 0 && (
                              <p style={{ fontSize: 10, color: "#64748b", margin: "2px 0 0" }}>Jumla: {fmt(totalThisInst)}</p>
                            )}
                          </div>
                        ) : <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>}
                      </td>

                      {/* Tarehe halisi */}
                      <td>
                        {inst.paid ? (
                          <div>
                            <input
                              type="date"
                              className={`hl-date-input${fieldErrors[`inst_date_${i}`] ? " err" : ""}`}
                              value={inst.paid_date}
                              min={disbursedAt || undefined}
                              max={today}
                              onChange={e => setInstField(i, "paid_date", e.target.value)}
                            />
                            {fieldErrors[`inst_date_${i}`] && (
                              <p style={{ fontSize: 10, color: "#dc2626", margin: "3px 0 0", fontWeight: 600 }}>{fieldErrors[`inst_date_${i}`]}</p>
                            )}
                          </div>
                        ) : <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>}
                      </td>

                      <td>
                        <span className={`hl-status-badge ${badgeClass}`}>{badgeLabel}</span>
                        {fieldErrors[`inst_gap_${i}`] && (
                          <p style={{ fontSize: 10, color: "#dc2626", margin: "3px 0 0", fontWeight: 600, whiteSpace: "nowrap" }}>
                            ⚠ Mpangilio!
                          </p>
                        )}
                      </td>
                    </tr>
                    {fieldErrors[`inst_gap_${i}`] && (
                      <tr>
                        <td colSpan={8} style={{ padding: "4px 10px", background: "#fef2f2" }}>
                          <p style={{ fontSize: 11, color: "#dc2626", margin: 0, fontWeight: 600 }}>
                            ⚠ {fieldErrors[`inst_gap_${i}`]}
                          </p>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals summary */}
        {installments.length > 0 && (
          <div className="hl-totals" style={{ marginTop: 16 }}>
            <div className="hl-totals-col">
              <div className="tv">TZS {fmt(totalLoan)}</div>
              <div className="tl">Jumla ya Mkopo</div>
            </div>
            <div className="hl-totals-col">
              <div className="tv" style={{ color: "#16a34a" }}>TZS {fmt(totalNormalPaid)}</div>
              <div className="tl">Malipo ya Kawaida ({paidCount} awamu)</div>
            </div>
            <div className="hl-totals-col">
              <div className="tv" style={{ color: totalPenaltyPaid > 0 ? "#b45309" : "#94a3b8" }}>TZS {fmt(totalPenaltyPaid)}</div>
              <div className="tl">Penati Zilizolipwa</div>
            </div>
            <div className="hl-totals-col">
              <div className="tv" style={{ color: remaining > 0 ? "#ef4444" : "#16a34a" }}>TZS {fmt(remaining)}</div>
              <div className="tl">Salio Linalobaki</div>
            </div>
          </div>
        )}

        {/* Submit */}
        <button className="hl-submit" style={{ marginTop: 28 }} onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Inarekodia mkopo..." : "Rekodi Mkopo wa Zamani"}
        </button>

      </div>{/* end hl-body */}
    </div>
  );
}
