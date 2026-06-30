import { useState } from "react";
import axios from "axios";
import AlertModal from "../components/AlertModal";
import ConfirmModal from "../components/ConfirmModal";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
const fmt = (v: any) => `TZS ${Number(v || 0).toLocaleString()}`;

type Action = "reschedule" | "topup" | "writeoff";

interface Loan {
  id: number;
  name: string;
  loan_account_number?: string;
  amount: number;
  remaining_balance: number;
  total_paid: number;
  status: string;
  payment_status?: string;
  next_payment_date?: string;
}
interface HistoryRow {
  id: number;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  notes?: string;
  created_at: string;
  performer?: { name: string };
}

const LoanLifecycle = () => {
  const [query, setQuery] = useState("");
  const [loan, setLoan] = useState<Loan | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [action, setAction] = useState<Action>("reschedule");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: "", message: "", type: "info" as any });
  const [confirm, setConfirm] = useState<any>({ isOpen: false, title: "", message: "", type: "info", onConfirm: () => {} });

  // form fields
  const [termMonths, setTermMonths] = useState(12);
  const [interestRate, setInterestRate] = useState<string>("");
  const [frequency, setFrequency] = useState("Monthly");
  const [startDate, setStartDate] = useState("");
  const [topUpAmount, setTopUpAmount] = useState<string>("");
  const [method, setMethod] = useState("cash");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadHistory = async (loanId: number) => {
    try {
      const res = await axios.get(`${API_BASE}/loans/${loanId}/restructures`, { headers: authHeaders() });
      setHistory(res.data.data || []);
    } catch { setHistory([]); }
  };

  const search = async () => {
    const id = query.trim();
    if (!id) return;
    setBusy(true);
    try {
      const res = await axios.get(`${API_BASE}/loans/${id}`, { headers: authHeaders() });
      const l = res.data.data || res.data;
      setLoan(l);
      loadHistory(l.id);
    } catch (err: any) {
      setLoan(null);
      setModal({ isOpen: true, title: "Not Found", message: err.response?.data?.message || "Loan not found. Enter a valid loan ID.", type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    if (loan) {
      const res = await axios.get(`${API_BASE}/loans/${loan.id}`, { headers: authHeaders() });
      setLoan(res.data.data || res.data);
      loadHistory(loan.id);
    }
  };

  const post = async (url: string, body: any, successMsg: string) => {
    setBusy(true);
    try {
      const res = await axios.post(`${API_BASE}${url}`, body, { headers: authHeaders() });
      await refresh();
      setModal({ isOpen: true, title: "Done", message: res.data.message || successMsg, type: "success" });
      setReason(""); setNotes(""); setTopUpAmount("");
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Action failed", type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (!loan) return;
    if (action === "reschedule") {
      const body: any = { term_months: termMonths, frequency };
      if (interestRate) body.interest_rate = Number(interestRate);
      if (startDate) body.start_date = startDate;
      if (notes) body.notes = notes;
      setConfirm({
        isOpen: true, title: "Reschedule Loan", type: "info",
        message: `Re-amortize the outstanding ${fmt(loan.remaining_balance)} over ${termMonths} ${frequency.toLowerCase()} installment(s)? No cash moves.`,
        onConfirm: () => { setConfirm((p: any) => ({ ...p, isOpen: false })); post(`/loans/${loan.id}/reschedule`, body, "Loan rescheduled"); },
      });
    } else if (action === "topup") {
      const amt = Number(topUpAmount);
      if (!amt || amt <= 0) { setModal({ isOpen: true, title: "Invalid", message: "Enter a top-up amount.", type: "error" }); return; }
      const body: any = { amount: amt, method, term_months: termMonths };
      if (interestRate) body.interest_rate = Number(interestRate);
      if (startDate) body.start_date = startDate;
      if (notes) body.notes = notes;
      setConfirm({
        isOpen: true, title: "Top-Up Loan", type: "warning",
        message: `Advance an extra ${fmt(amt)} via ${method}? New balance becomes ${fmt(Number(loan.remaining_balance) + amt)} and the schedule is rebuilt.`,
        onConfirm: () => { setConfirm((p: any) => ({ ...p, isOpen: false })); post(`/loans/${loan.id}/top-up`, body, "Loan topped up"); },
      });
    } else {
      if (!reason.trim()) { setModal({ isOpen: true, title: "Reason Required", message: "A write-off reason is required.", type: "error" }); return; }
      setConfirm({
        isOpen: true, title: "Write Off Loan", type: "danger",
        message: `Write off the full outstanding ${fmt(loan.remaining_balance)}? This closes the loan and posts to the General Ledger. This cannot be undone.`,
        onConfirm: () => { setConfirm((p: any) => ({ ...p, isOpen: false })); post(`/loans/${loan.id}/write-off`, { reason, notes }, "Loan written off"); },
      });
    }
  };

  const canAct = loan && !["written_off", "completed"].includes(loan.status) && Number(loan.remaining_balance) > 0;
  const writeOffOk = loan && loan.status !== "written_off" && Number(loan.remaining_balance) > 0;

  return (
    <div className="ll-wrap">
      <style>{styles}</style>
      <div className="ll-head">
        <div>
          <h1>Loan Restructuring</h1>
          <p>Reschedule a struggling loan, advance a top-up, or write off bad debt — with automatic GL postings.</p>
        </div>
      </div>

      <div className="ll-search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Enter Loan ID…"
        />
        <button onClick={search} disabled={busy}>Find Loan</button>
      </div>

      {loan && (
        <>
          <div className="ll-card ll-loan">
            <div className="ll-loan-grid">
              <div><span>Borrower</span><strong>{loan.name}</strong></div>
              <div><span>Account</span><strong>{loan.loan_account_number || `#${loan.id}`}</strong></div>
              <div><span>Principal</span><strong>{fmt(loan.amount)}</strong></div>
              <div><span>Outstanding</span><strong>{fmt(loan.remaining_balance)}</strong></div>
              <div><span>Status</span><strong className={`ll-badge ll-${loan.status}`}>{loan.status}</strong></div>
              <div><span>Next Due</span><strong>{loan.next_payment_date || "—"}</strong></div>
            </div>
          </div>

          <div className="ll-tabs">
            <button className={action === "reschedule" ? "on" : ""} onClick={() => setAction("reschedule")}>Reschedule</button>
            <button className={action === "topup" ? "on" : ""} onClick={() => setAction("topup")}>Top-Up</button>
            <button className={action === "writeoff" ? "on" : ""} onClick={() => setAction("writeoff")}>Write-Off</button>
          </div>

          <div className="ll-card">
            {action === "reschedule" && (
              <div className="ll-form">
                <label>New term (months)<input type="number" min={1} value={termMonths} onChange={(e) => setTermMonths(Number(e.target.value))} /></label>
                <label>Frequency
                  <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                    <option>Monthly</option><option>Weekly</option><option>Bi-Weekly</option><option>Daily</option><option>Quarterly</option>
                  </select>
                </label>
                <label>Interest rate % <small>(blank = default)</small><input type="number" step="0.1" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} placeholder="default" /></label>
                <label>Start date<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
                <label className="ll-full">Notes<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></label>
              </div>
            )}
            {action === "topup" && (
              <div className="ll-form">
                <label>Top-up amount<input type="number" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} placeholder="0" /></label>
                <label>Pay out via
                  <select value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="cash">Cash</option><option value="bank">Bank</option><option value="mobile">Mobile Money</option>
                  </select>
                </label>
                <label>New term (months)<input type="number" min={1} value={termMonths} onChange={(e) => setTermMonths(Number(e.target.value))} /></label>
                <label>Interest rate % <small>(blank = default)</small><input type="number" step="0.1" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} placeholder="default" /></label>
                <label className="ll-full">Notes<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></label>
              </div>
            )}
            {action === "writeoff" && (
              <div className="ll-form">
                <label className="ll-full">Reason (required)<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Borrower deceased / uncollectible after 180 days" /></label>
                <label className="ll-full">Notes<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></label>
                <p className="ll-note">Writes off {fmt(loan.remaining_balance)} against the Allowance for Loan Losses (shortfall to provision expense), and closes the loan.</p>
              </div>
            )}

            <div className="ll-actions">
              <button
                className={`ll-submit ${action === "writeoff" ? "danger" : ""}`}
                onClick={submit}
                disabled={busy || (action === "writeoff" ? !writeOffOk : !canAct)}
              >
                {action === "reschedule" ? "Reschedule Loan" : action === "topup" ? "Advance Top-Up" : "Write Off Loan"}
              </button>
              {!canAct && action !== "writeoff" && <span className="ll-warn">This loan is {loan.status} — only write-off may apply.</span>}
            </div>
          </div>

          {history.length > 0 && (
            <div className="ll-card">
              <h3>Lifecycle History</h3>
              <table className="ll-table">
                <thead><tr><th>Date</th><th>Action</th><th>Amount</th><th>Balance →</th><th>By</th><th>Notes</th></tr></thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td>{new Date(h.created_at).toLocaleDateString()}</td>
                      <td><span className={`ll-badge ll-${h.type}`}>{h.type}</span></td>
                      <td>{Number(h.amount) > 0 ? fmt(h.amount) : "—"}</td>
                      <td>{fmt(h.balance_before)} → {fmt(h.balance_after)}</td>
                      <td>{h.performer?.name || "—"}</td>
                      <td>{h.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <AlertModal isOpen={modal.isOpen} title={modal.title} message={modal.message} type={modal.type} onClose={() => setModal({ ...modal, isOpen: false })} />
      <ConfirmModal isOpen={confirm.isOpen} title={confirm.title} message={confirm.message} type={confirm.type} onConfirm={confirm.onConfirm} onCancel={() => setConfirm((p: any) => ({ ...p, isOpen: false }))} />
    </div>
  );
};

const styles = `
.ll-wrap { max-width: 1100px; margin: 0 auto; padding: 8px 4px 48px; }
.ll-head h1 { font-size: 24px; color: #102a43; margin: 0 0 4px; }
.ll-head p { color: #627d98; margin: 0 0 18px; font-size: 14px; }
.ll-search { display: flex; gap: 10px; margin-bottom: 18px; }
.ll-search input { flex: 1; max-width: 320px; padding: 11px 14px; border: 1px solid #d2dbe6; border-radius: 10px; font-size: 14px; }
.ll-search button { background: #102a43; color: #fff; border: none; padding: 11px 22px; border-radius: 10px; font-weight: 600; cursor: pointer; }
.ll-card { background: #fff; border: 1px solid #e6ebf1; border-radius: 14px; padding: 20px; margin-bottom: 18px; box-shadow: 0 1px 3px rgba(16,42,67,.05); }
.ll-loan-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; }
.ll-loan-grid span { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; color: #829ab1; margin-bottom: 3px; }
.ll-loan-grid strong { font-size: 15px; color: #243b53; }
.ll-badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: capitalize; }
.ll-disbursed { background: #e3f0ff; color: #1e5fae; }
.ll-completed { background: #e6f6ec; color: #1f9254; }
.ll-written_off, .ll-writeoff { background: #fdecec; color: #c0392b; }
.ll-reschedule { background: #fff4e0; color: #b9770e; }
.ll-topup { background: #eafaf1; color: #1f9254; }
.ll-tabs { display: flex; gap: 8px; margin-bottom: 14px; }
.ll-tabs button { flex: 1; padding: 11px; border: 1px solid #d2dbe6; background: #f5f8fb; border-radius: 10px; font-weight: 600; color: #486581; cursor: pointer; }
.ll-tabs button.on { background: #102a43; color: #fff; border-color: #102a43; }
.ll-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
.ll-form label { display: flex; flex-direction: column; font-size: 13px; font-weight: 600; color: #486581; gap: 6px; }
.ll-form label small { font-weight: 400; color: #9fb3c8; }
.ll-form input, .ll-form select { padding: 10px 12px; border: 1px solid #d2dbe6; border-radius: 9px; font-size: 14px; }
.ll-full { grid-column: 1 / -1; }
.ll-note { grid-column: 1 / -1; font-size: 13px; color: #c0392b; background: #fdf1f1; padding: 10px 12px; border-radius: 8px; margin: 0; }
.ll-actions { margin-top: 18px; display: flex; align-items: center; gap: 14px; }
.ll-submit { background: #1f9254; color: #fff; border: none; padding: 12px 26px; border-radius: 10px; font-weight: 700; cursor: pointer; }
.ll-submit.danger { background: #c0392b; }
.ll-submit:disabled { opacity: .5; cursor: not-allowed; }
.ll-warn { color: #b9770e; font-size: 13px; }
.ll-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.ll-table th { text-align: left; padding: 9px; border-bottom: 2px solid #e6ebf1; color: #627d98; font-size: 11px; text-transform: uppercase; }
.ll-table td { padding: 9px; border-bottom: 1px solid #f0f3f7; color: #334e68; }
.ll-card h3 { margin: 0 0 14px; color: #102a43; font-size: 16px; }
`;

export default LoanLifecycle;
