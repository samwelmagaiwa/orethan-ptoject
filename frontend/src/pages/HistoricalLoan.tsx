import { useState, useEffect, useRef } from "react";
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

interface Payment {
  date: string;
  amount: string;
}

interface FieldErrors { [key: string]: string }

function FErr({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p style={{ fontSize: 11, color: "#dc2626", margin: "4px 0 0 0", fontWeight: 600 }}>{msg}</p>;
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
  const [interestRate, setInterestRate] = useState("");
  const [termMonths, setTermMonths] = useState("");
  const [frequency, setFrequency] = useState("Monthly");
  const [disbursedAt, setDisbursedAt] = useState("");
  const [employment, setEmployment] = useState("Hapana");

  const [g1Name, setG1Name] = useState("");
  const [g1Phone, setG1Phone] = useState("");
  const [g2Name, setG2Name] = useState("");
  const [g2Phone, setG2Phone] = useState("");

  const [payments, setPayments] = useState<Payment[]>([{ date: "", amount: "" }]);

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

  const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const loanAmount = parseFloat(amount) || 0;
  const remaining = Math.max(0, loanAmount - totalPaid);

  const addPayment = () => setPayments([...payments, { date: "", amount: "" }]);
  const removePayment = (i: number) => { if (payments.length > 1) setPayments(payments.filter((_, idx) => idx !== i)); };
  const updatePayment = (i: number, f: "date" | "amount", v: string) => {
    const c = [...payments]; c[i] = { ...c[i], [f]: v }; setPayments(c);
  };

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
    if (!interestRate || parseFloat(interestRate) < 0 || parseFloat(interestRate) > 100) errs.interestRate = "Riba lazima iwe kati ya 0% na 100%.";
    if (!termMonths || parseInt(termMonths) < 1 || !Number.isInteger(parseFloat(termMonths))) errs.termMonths = "Muda lazima uwe namba nzima zaidi ya sifuri.";
    if (!disbursedAt) errs.disbursedAt = "Tarehe ya kutolewa inahitajika.";
    else if (disbursedAt > today) errs.disbursedAt = "Tarehe ya kutolewa haiwezi kuwa siku zijazo.";
    if ((g1Name.trim() && !g1Phone.trim()) || (!g1Name.trim() && g1Phone.trim())) errs.g1 = "Jina na simu ya Mdhamini 1 lazima vijazwe vyote.";
    if (g1Phone.trim() && !/^0[0-9]{9}$/.test(g1Phone.replace(/\s/g, ""))) errs.g1Phone = "Simu ya Mdhamini 1 sio sahihi.";
    if ((g2Name.trim() && !g2Phone.trim()) || (!g2Name.trim() && g2Phone.trim())) errs.g2 = "Jina na simu ya Mdhamini 2 lazima vijazwe vyote.";
    if (g2Phone.trim() && !/^0[0-9]{9}$/.test(g2Phone.replace(/\s/g, ""))) errs.g2Phone = "Simu ya Mdhamini 2 sio sahihi.";
    const filledPayments = payments.filter(p => p.date || p.amount);
    filledPayments.forEach((p, i) => {
      if (!p.date) errs[`pay_date_${i}`] = "Tarehe ya malipo inahitajika.";
      else if (disbursedAt && p.date < disbursedAt) errs[`pay_date_${i}`] = "Tarehe haiwezi kuwa kabla ya kutolewa mkopo.";
      else if (p.date > today) errs[`pay_date_${i}`] = "Tarehe haiwezi kuwa siku zijazo.";
      if (!p.amount || parseFloat(p.amount) <= 0) errs[`pay_amt_${i}`] = "Kiasi lazima kiwe zaidi ya sifuri.";
    });
    if (loanAmount > 0 && totalPaid > loanAmount) errs.payments_total = "Jumla ya malipo inazidi kiasi cha mkopo.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const resetForm = () => {
    setSearchPhone(""); setFoundCustomer(null); setNewName(""); setNewPhone("");
    setAmount(""); setInterestRate(""); setTermMonths(""); setDisbursedAt("");
    setEmployment("Hapana"); setG1Name(""); setG1Phone(""); setG2Name(""); setG2Phone("");
    setPayments([{ date: "", amount: "" }]); setFieldErrors({});
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
    const validPayments = payments.filter(p => p.date && parseFloat(p.amount) > 0);
    const payload: Record<string, unknown> = {
      customer_phone: phone, customer_name: name,
      customer_id: foundCustomer?.id ?? undefined,
      amount: parseFloat(amount), interest_rate: parseFloat(interestRate),
      term_months: parseInt(termMonths), repayment_frequency: frequency,
      disbursed_at: disbursedAt, employment,
      guarantor_1_name: g1Name.trim() || undefined, guarantor_1_phone: g1Phone.trim() || undefined,
      guarantor_2_name: g2Name.trim() || undefined, guarantor_2_phone: g2Phone.trim() || undefined,
      payments: validPayments.map(p => ({ date: p.date, amount: parseFloat(p.amount) })),
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

  // Shared input class helper
  const inp = (err?: string) => `hl-input${err ? " hl-err" : ""}`;

  return (
    <div className="hl-wrap">
      <style>{`
        .hl-wrap { padding: 24px 32px; }
        .hl-title { font-size: 22px; font-weight: 800; color: #1e293b; margin: 0 0 4px; display: flex; align-items: center; gap: 10px; }
        .hl-subtitle { font-size: 13px; color: #64748b; margin: 0 0 24px; }
        .hl-badge { background: #fef9c3; color: #854d0e; border-radius: 6px; padding: 3px 9px; font-size: 11px; font-weight: 700; }

        /* Section divider — same style as PersonalLoan */
        .hl-section {
          background: #102a43; color: #fff; padding: 8px 16px;
          border-radius: 6px; font-weight: 700; font-size: 13px;
          margin-bottom: 18px; margin-top: 8px;
        }

        /* Form body (no card boxes, no gaps) */
        .hl-body { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px 28px; margin-bottom: 24px; }

        .hl-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .hl-grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .hl-field { display: flex; flex-direction: column; }
        .hl-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .hl-input {
          width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px;
          font-size: 13px; color: #1e293b; background: #fff; box-sizing: border-box;
          transition: border-color 0.15s; outline: none;
        }
        .hl-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.08); }
        .hl-input.hl-err { border-color: #f87171; background: #fff8f8; }

        /* Toggle */
        .hl-toggle { display: flex; gap: 8px; margin-bottom: 16px; }
        .hl-toggle-btn {
          flex: 1; padding: 9px 12px; border-radius: 6px; font-size: 13px; font-weight: 600;
          cursor: pointer; border: 1.5px solid #cbd5e1; background: #f8fafc; color: #64748b; transition: all 0.15s;
        }
        .hl-toggle-btn.active { background: #102a43; border-color: #102a43; color: #fff; }

        .hl-found { background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 10px 14px; font-size: 13px; color: #16a34a; font-weight: 600; margin-top: 8px; }

        /* Payment rows */
        .hl-pay-row { display: grid; grid-template-columns: 1fr 1fr 36px; gap: 12px; align-items: end; margin-bottom: 12px; }
        .hl-rm {
          width: 36px; height: 36px; border-radius: 6px; background: #fee2e2; border: none;
          color: #dc2626; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;
        }
        .hl-rm:disabled { opacity: 0.3; cursor: not-allowed; }
        .hl-add {
          padding: 7px 16px; border: 1.5px dashed #cbd5e1; border-radius: 6px;
          background: transparent; color: #64748b; font-size: 12px; font-weight: 600; cursor: pointer; margin-top: 4px;
        }
        .hl-add:hover { background: #f1f5f9; }

        /* Totals summary */
        .hl-totals { display: flex; background: #f1f5f9; border-radius: 8px; padding: 14px 20px; margin-top: 16px; }
        .hl-totals-col { flex: 1; text-align: center; padding: 0 10px; border-right: 1px solid #e2e8f0; }
        .hl-totals-col:last-child { border-right: none; }
        .hl-totals-col .tv { font-size: 17px; font-weight: 800; color: #1e293b; }
        .hl-totals-col .tl { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 3px; }

        /* Error / success banners */
        .hl-global-err { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 12px 16px; color: #dc2626; font-size: 13px; margin-bottom: 18px; }
        .hl-field-err { font-size: 11px; color: #dc2626; margin: 4px 0 0; font-weight: 600; }
        .hl-section-err { background: #fef2f2; border-radius: 6px; padding: 8px 12px; color: #dc2626; font-size: 11px; margin-top: 8px; font-weight: 600; }
        .hl-success { background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px; padding: 24px 28px; text-align: center; margin-bottom: 24px; }
        .hl-success h2 { color: #16a34a; font-size: 17px; margin: 0 0 10px; }
        .hl-success p { color: #4d7c0f; font-size: 13px; margin: 4px 0; }

        /* Submit */
        .hl-submit {
          width: 100%; padding: 14px; border-radius: 8px; background: #102a43;
          color: #fff; font-size: 14px; font-weight: 700; border: none; cursor: pointer; transition: opacity 0.15s;
        }
        .hl-submit:hover:not(:disabled) { background: #1e3a5f; }
        .hl-submit:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Note/hint */
        .hl-hint { font-size: 12px; color: #64748b; margin: -8px 0 16px; }

        @media (max-width: 700px) {
          .hl-grid2, .hl-grid3 { grid-template-columns: 1fr; }
          .hl-pay-row { grid-template-columns: 1fr 1fr 36px; }
        }
      `}</style>

      <h1 className="hl-title">
        Ingiza Mkopo wa Zamani
        <span className="hl-badge">KIHISTORIA</span>
      </h1>
      <p className="hl-subtitle">
        Rekodi mkopo ulioidhinishwa kabla ya mfumo — mfumo utatengeneza ratiba sahihi na namba ya akaunti kulingana na tarehe halisi ya mkopo.
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
            <label className="hl-label">Kiasi cha Mkopo (TZS)</label>
            <input className={inp(fieldErrors.amount)} type="number" min="1" value={amount}
              onChange={e => setAmount(e.target.value)} placeholder="1000000" />
            {fieldErrors.amount && <p className="hl-field-err">{fieldErrors.amount}</p>}
          </div>
          <div className="hl-field">
            <label className="hl-label">Riba ya Kila Mwezi (%)</label>
            <input className={inp(fieldErrors.interestRate)} type="number" min="0" step="0.1" max="100"
              value={interestRate} onChange={e => setInterestRate(e.target.value)} placeholder="3.0" />
            {fieldErrors.interestRate && <p className="hl-field-err">{fieldErrors.interestRate}</p>}
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

        {/* ── SEHEMU 4: HISTORIA YA MALIPO ────────────────────────────────── */}
        <div className="hl-section" style={{ marginTop: 24 }}>SEHEMU 4: HISTORIA YA MALIPO YALIYOFANYWA</div>
        <p className="hl-hint">
          Ingiza kila malipo yaliyolipwa tangu mkopo ulitolewa. Tarehe lazima iwe baada ya tarehe ya kutolewa mkopo.
          Ratiba itatengenezwa kulingana na tarehe halisi.
        </p>

        {payments.map((p, i) => (
          <div key={i} className="hl-pay-row">
            <div className="hl-field">
              <label className="hl-label">Tarehe ya Malipo</label>
              <input className={inp(fieldErrors[`pay_date_${i}`])} type="date"
                value={p.date} min={disbursedAt || undefined} max={today}
                onChange={e => updatePayment(i, "date", e.target.value)} />
              {fieldErrors[`pay_date_${i}`] && <p className="hl-field-err">{fieldErrors[`pay_date_${i}`]}</p>}
            </div>
            <div className="hl-field">
              <label className="hl-label">Kiasi (TZS)</label>
              <input className={inp(fieldErrors[`pay_amt_${i}`])} type="number" min="1"
                value={p.amount} onChange={e => updatePayment(i, "amount", e.target.value)} placeholder="50000" />
              {fieldErrors[`pay_amt_${i}`] && <p className="hl-field-err">{fieldErrors[`pay_amt_${i}`]}</p>}
            </div>
            <button className="hl-rm" onClick={() => removePayment(i)} disabled={payments.length === 1} title="Ondoa">×</button>
          </div>
        ))}

        <button className="hl-add" onClick={addPayment}>+ Ongeza Malipo</button>

        {fieldErrors.payments_total && <div className="hl-section-err">⚠ {fieldErrors.payments_total}</div>}

        <div className="hl-totals">
          <div className="hl-totals-col">
            <div className="tv">TZS {fmt(loanAmount)}</div>
            <div className="tl">Kiasi cha Mkopo</div>
          </div>
          <div className="hl-totals-col">
            <div className="tv" style={{ color: "#16a34a" }}>TZS {fmt(totalPaid)}</div>
            <div className="tl">Jumla Imelipwa</div>
          </div>
          <div className="hl-totals-col">
            <div className="tv" style={{ color: remaining > 0 ? "#ef4444" : "#16a34a" }}>TZS {fmt(remaining)}</div>
            <div className="tl">Salio Linalobaki</div>
          </div>
        </div>

        {/* Submit */}
        <button className="hl-submit" style={{ marginTop: 28 }} onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Inarekodia mkopo..." : "Rekodi Mkopo wa Zamani"}
        </button>

      </div>{/* end hl-body */}
    </div>
  );
}
