import { useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import AlertModal from "../components/AlertModal";
import ConfirmModal from "../components/ConfirmModal";
import GetHelp, { type HelpStep } from "../components/GetHelp";
import { API_BASE, fmtLoanId } from "../lib/api";

const fmt = (v: any) => `TZS ${Number(v || 0).toLocaleString()}`;

type Action = "reschedule" | "topup" | "writeoff";

interface LoanResult {
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

const statusColor: Record<string, string> = {
  disbursed: "#1e5fae",
  active: "#1e5fae",
  completed: "#1f9254",
  written_off: "#c0392b",
  overdue: "#b9770e",
  pending: "#6b7280",
};

const LoanLifecycle = () => {
  const { t } = useTranslation("common");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LoanResult[]>([]);
  const [loan, setLoan] = useState<LoanResult | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [action, setAction] = useState<Action>("reschedule");
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: "", message: "", type: "info" as any });
  const [confirm, setConfirm] = useState<any>({ isOpen: false, title: "", message: "", type: "info", onConfirm: () => {} });

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
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setResults([]);
    setLoan(null);
    try {
      const res = await axios.get(`${API_BASE}/loans/search`, { params: { q }, headers: authHeaders() });
      const list: LoanResult[] = res.data.data || [];
      if (list.length === 0) {
        setModal({ isOpen: true, title: "Not Found", message: "No loans found. Try the loan ID, account number, borrower name, or phone number.", type: "error" });
      } else if (list.length === 1) {
        selectLoan(list[0]);
      } else {
        setResults(list);
      }
    } catch (err: any) {
      setModal({ isOpen: true, title: "Search Error", message: err.response?.data?.message || "Search failed. Please try again.", type: "error" });
    } finally {
      setSearching(false);
    }
  };

  const selectLoan = (l: LoanResult) => {
    setLoan(l);
    setResults([]);
    loadHistory(l.id);
  };

  const refresh = async () => {
    if (!loan) return;
    const res = await axios.get(`${API_BASE}/loans/${loan.id}`, { headers: authHeaders() });
    setLoan(res.data.data || res.data);
    loadHistory(loan.id);
  };

  const post = async (url: string, body: any, successMsg: string) => {
    setBusy(true);
    try {
      const res = await axios.post(`${API_BASE}${url}`, body, { headers: authHeaders() });
      await refresh();
      setModal({ isOpen: true, title: "Success", message: res.data.message || successMsg, type: "success" });
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
      if (!amt || amt <= 0) { setModal({ isOpen: true, title: "Invalid", message: "Enter a valid top-up amount.", type: "error" }); return; }
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

  const progressPct = loan
    ? Math.min(100, Math.round((Number(loan.total_paid) / (Number(loan.amount) || 1)) * 100))
    : 0;

  return (
    <div className="ll-wrap">
      <style>{styles}</style>

      {/* Sticky toolbar */}
      <div className="ll-sticky-top">
        <h1 className="ll-title">Loan Restructuring</h1>
        <div className="ll-sep" />
        <GetHelp
          title={t("loanLifecycle.help.title")}
          intro={t("loanLifecycle.help.intro")}
          steps={t("loanLifecycle.help.steps", { returnObjects: true }) as HelpStep[]}
          tip={t("loanLifecycle.help.tip")}
        />
        <div className="ll-sep" />
        <input
          className="ll-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Loan ID, account number, borrower name or phone..."
        />
        <button className="ll-search-btn" onClick={search} disabled={searching || busy}>
          {searching ? <span className="ll-spinner" /> : "Search"}
        </button>
        {loan && (
          <button className="ll-clear-btn" onClick={() => { setLoan(null); setResults([]); setQuery(""); setHistory([]); }}>
            Clear
          </button>
        )}
      </div>

      {/* Multiple results table */}
      {results.length > 1 && (
        <div className="ll-results-card">
          <p className="ll-results-heading">{results.length} loans found - select one:</p>
          <table className="ll-pick-table">
            <thead>
              <tr>
                <th>Borrower</th>
                <th>Account Number</th>
                <th>Outstanding</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="ll-pick-row" onClick={() => selectLoan(r)}>
                  <td className="ll-result-name">{r.name}</td>
                  <td>{r.loan_account_number || `#${fmtLoanId(r.id)}`}</td>
                  <td>{fmt(r.remaining_balance)}</td>
                  <td>
                    <span className="ll-badge" style={{ background: `${statusColor[r.status] || "#6b7280"}22`, color: statusColor[r.status] || "#6b7280" }}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Loan detail */}
      {loan && (
        <>
          {/* Loan summary card */}
          <div className="ll-loan-card">
            <div className="ll-loan-top">
              <div className="ll-loan-avatar">{loan.name.charAt(0).toUpperCase()}</div>
              <div className="ll-loan-info">
                <div className="ll-loan-name">{loan.name}</div>
                <div className="ll-loan-acct">{loan.loan_account_number || `Loan #${fmtLoanId(loan.id)}`}</div>
              </div>
              <span className="ll-badge ll-status-badge" style={{ background: `${statusColor[loan.status] || "#6b7280"}18`, color: statusColor[loan.status] || "#6b7280" }}>
                {loan.status.replace("_", " ")}
              </span>
            </div>

            <div className="ll-loan-stats">
              <div className="ll-stat">
                <span className="ll-stat-label">Principal</span>
                <span className="ll-stat-value">{fmt(loan.amount)}</span>
              </div>
              <div className="ll-stat">
                <span className="ll-stat-label">Outstanding</span>
                <span className="ll-stat-value ll-outstanding">{fmt(loan.remaining_balance)}</span>
              </div>
              <div className="ll-stat">
                <span className="ll-stat-label">Total Paid</span>
                <span className="ll-stat-value ll-paid">{fmt(loan.total_paid)}</span>
              </div>
              <div className="ll-stat">
                <span className="ll-stat-label">Next Due</span>
                <span className="ll-stat-value">{loan.next_payment_date || "--"}</span>
              </div>
            </div>

            <div className="ll-progress-wrap">
              <div className="ll-progress-bar">
                <div className="ll-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="ll-progress-pct">{progressPct}% repaid</span>
            </div>
          </div>

          {/* Action tabs */}
          <div className="ll-tabs">
            {(["reschedule", "topup", "writeoff"] as Action[]).map((tab) => (
              <button
                key={tab}
                className={`ll-tab ${action === tab ? "ll-tab--active" : ""} ${tab === "writeoff" ? "ll-tab--danger" : ""}`}
                onClick={() => setAction(tab)}
              >
                {tab === "reschedule" && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>}
                {tab === "topup" && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}
                {tab === "writeoff" && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>}
                {tab === "reschedule" ? "Reschedule" : tab === "topup" ? "Top-Up" : "Write-Off"}
              </button>
            ))}
          </div>

          {/* Action form */}
          <div className="ll-form-card">
            <h3 className="ll-form-heading">
              {action === "reschedule" ? "Reschedule Loan" : action === "topup" ? "Advance Top-Up" : "Write Off Loan"}
            </h3>

            {action === "reschedule" && (
              <div className="ll-form">
                <div className="ll-field">
                  <label>New term (months)</label>
                  <input type="number" min={1} value={termMonths} onChange={(e) => setTermMonths(Number(e.target.value))} />
                </div>
                <div className="ll-field">
                  <label>Frequency</label>
                  <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                    <option>Monthly</option><option>Weekly</option><option>Bi-Weekly</option><option>Daily</option><option>Quarterly</option>
                  </select>
                </div>
                <div className="ll-field">
                  {(() => { const isLM = JSON.parse(localStorage.getItem("user")||"{}").role === "loan_manager"; return (<>
                    <label>Interest rate % <span className="ll-opt">{isLM ? "(set by admin — cannot change)" : "(leave blank to keep current)"}</span></label>
                    <input type="number" step="0.1" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} placeholder="e.g. 18" disabled={isLM} style={isLM ? { opacity: 0.5, cursor: "not-allowed", background: "#f1f5f9" } : undefined} />
                  </>); })()}
                </div>
                <div className="ll-field">
                  <label>Start date <span className="ll-opt">(optional)</span></label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="ll-field ll-field--full">
                  <label>Notes <span className="ll-opt">(optional)</span></label>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for rescheduling" />
                </div>
                <div className="ll-info-box">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  Rescheduling re-amortizes the outstanding balance over new terms. No cash moves &mdash; only the repayment schedule is rebuilt.
                </div>
              </div>
            )}

            {action === "topup" && (
              <div className="ll-form">
                <div className="ll-field">
                  <label>Top-up amount (TZS)</label>
                  <input type="number" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} placeholder="e.g. 500000" />
                </div>
                <div className="ll-field">
                  <label>Disbursement method</label>
                  <select value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="cash">Cash</option><option value="bank">Bank Transfer</option><option value="mobile">Mobile Money</option>
                  </select>
                </div>
                <div className="ll-field">
                  <label>New term (months)</label>
                  <input type="number" min={1} value={termMonths} onChange={(e) => setTermMonths(Number(e.target.value))} />
                </div>
                <div className="ll-field">
                  <label>Interest rate % <span className="ll-opt">(leave blank to keep current)</span></label>
                  <input type="number" step="0.1" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} placeholder="e.g. 18" />
                </div>
                <div className="ll-field ll-field--full">
                  <label>Notes <span className="ll-opt">(optional)</span></label>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Purpose of top-up" />
                </div>
                {topUpAmount && Number(topUpAmount) > 0 && (
                  <div className="ll-info-box ll-info-box--green">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                    New outstanding balance will be {fmt(Number(loan.remaining_balance) + Number(topUpAmount))}
                  </div>
                )}
              </div>
            )}

            {action === "writeoff" && (
              <div className="ll-form">
                <div className="ll-field ll-field--full">
                  <label>Write-off reason <span className="ll-required">*</span></label>
                  <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Borrower deceased / uncollectible after 180 days" />
                </div>
                <div className="ll-field ll-field--full">
                  <label>Additional notes <span className="ll-opt">(optional)</span></label>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any extra context" />
                </div>
                <div className="ll-warn-box">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <div>
                    <strong>Irreversible action.</strong> Writing off {fmt(loan.remaining_balance)} will close this loan and post the loss to the General Ledger against the Allowance for Loan Losses. This cannot be undone.
                  </div>
                </div>
              </div>
            )}

            <div className="ll-form-footer">
              <button
                className={`ll-submit-btn ${action === "writeoff" ? "ll-submit-btn--danger" : ""}`}
                onClick={submit}
                disabled={busy || (action === "writeoff" ? !writeOffOk : !canAct)}
              >
                {busy && <span className="ll-spinner ll-spinner--sm" />}
                {action === "reschedule" ? "Reschedule Loan" : action === "topup" ? "Advance Top-Up" : "Write Off Loan"}
              </button>
              {!canAct && action !== "writeoff" && (
                <span className="ll-status-warn">
                  This loan is <strong>{loan.status}</strong> &mdash; only write-off may apply.
                </span>
              )}
            </div>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="ll-history-card">
              <div className="ll-history-head">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Lifecycle History
              </div>
              <div className="ll-history-table-wrap">
                <table className="ll-table">
                  <thead>
                    <tr><th>Date</th><th>Action</th><th>Amount</th><th>Balance Change</th><th>By</th><th>Notes</th></tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td>{new Date(h.created_at).toLocaleDateString()}</td>
                        <td>
                          <span className="ll-badge" style={{ background: h.type === "writeoff" ? "#fdecec" : h.type === "topup" ? "#eafaf1" : "#fff4e0", color: h.type === "writeoff" ? "#c0392b" : h.type === "topup" ? "#1f9254" : "#b9770e" }}>
                            {h.type}
                          </span>
                        </td>
                        <td>{Number(h.amount) > 0 ? fmt(h.amount) : "--"}</td>
                        <td className="ll-balance-change">{fmt(h.balance_before)} &rarr; {fmt(h.balance_after)}</td>
                        <td>{h.performer?.name || "--"}</td>
                        <td className="ll-notes-cell">{h.notes || "--"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
.ll-wrap { flex: 1; min-height: 0; overflow-x: hidden; background: #f1f5f9; padding: 24px 24px 64px; font-family: inherit; }

/* Sticky toolbar */
.ll-sticky-top { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 10px; background: #f1f5f9; padding: 14px 0 14px; margin: -24px 0 20px; border-bottom: 1px solid #e2e8f0; flex-wrap: wrap; }
@media (max-width: 600px) { .ll-title { font-size: 16px; } .ll-sep { display: none; } }
.ll-title { margin: 0; font-size: 20px; font-weight: 700; color: #102a43; white-space: nowrap; }
.ll-sep { width: 1px; height: 28px; background: #d2dbe6; flex-shrink: 0; }
.ll-search-input { flex: 1; min-width: 180px; padding: 9px 14px; border: 1.5px solid #d2dbe6; border-radius: 10px; font-size: 14px; color: #243b53; background: #fff; transition: border-color .15s; }
.ll-search-input:focus { outline: none; border-color: #1e5fae; }
.ll-search-btn { background: #102a43; color: #fff; border: none; padding: 9px 20px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 8px; transition: background .15s; }
.ll-search-btn:hover:not(:disabled) { background: #1e5fae; }
.ll-search-btn:disabled { opacity: .55; cursor: not-allowed; }
.ll-clear-btn { background: transparent; border: 1.5px solid #d2dbe6; color: #627d98; padding: 9px 16px; border-radius: 10px; font-size: 13px; cursor: pointer; white-space: nowrap; }
.ll-clear-btn:hover { border-color: #9fb3c8; color: #334e68; }

/* Results table */
.ll-results-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; margin-bottom: 20px; box-shadow: 0 1px 4px rgba(16,42,67,.06); overflow-x: auto; }
.ll-results-heading { margin: 0 0 12px; font-size: 13px; color: #627d98; }
.ll-pick-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.ll-pick-table thead tr { background: #f8fafc; }
.ll-pick-table th { padding: 9px 14px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: #486581; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
.ll-pick-table td { padding: 11px 14px; border-bottom: 1px solid #f0f4f8; color: #243b53; vertical-align: middle; }
.ll-pick-row { cursor: pointer; transition: background .1s; }
.ll-pick-row:hover { background: #f0f7ff; }
.ll-pick-row:last-child td { border-bottom: none; }
.ll-result-name { font-weight: 600; color: #243b53; }

/* Loan card */
.ll-loan-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px 22px; margin-bottom: 16px; box-shadow: 0 1px 4px rgba(16,42,67,.06); }
.ll-loan-top { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
.ll-loan-avatar { width: 44px; height: 44px; border-radius: 50%; background: #102a43; color: #fff; font-size: 18px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ll-loan-info { flex: 1; }
.ll-loan-name { font-size: 16px; font-weight: 700; color: #243b53; }
.ll-loan-acct { font-size: 12.5px; color: #829ab1; margin-top: 2px; }
.ll-status-badge { font-size: 11.5px; padding: 4px 12px; border-radius: 999px; font-weight: 700; text-transform: capitalize; }
.ll-loan-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 14px; margin-bottom: 18px; }
.ll-stat { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; background: #f8fafc; border-radius: 10px; }
.ll-stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: .4px; color: #829ab1; font-weight: 600; }
.ll-stat-value { font-size: 15px; font-weight: 700; color: #243b53; }
.ll-outstanding { color: #c0392b; }
.ll-paid { color: #1f9254; }
.ll-progress-wrap { display: flex; align-items: center; gap: 10px; }
.ll-progress-bar { flex: 1; height: 7px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
.ll-progress-fill { height: 100%; background: linear-gradient(90deg, #1e5fae, #1f9254); border-radius: 999px; transition: width .5s; }
.ll-progress-pct { font-size: 12px; color: #627d98; font-weight: 600; white-space: nowrap; }

/* Tabs */
.ll-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.ll-tab { flex: 1; padding: 12px 10px; border: 1.5px solid #d2dbe6; background: #fff; border-radius: 12px; font-size: 13.5px; font-weight: 600; color: #486581; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all .15s; }
.ll-tab:hover { background: #f0f7ff; border-color: #1e5fae; color: #1e5fae; }
.ll-tab--active { background: #102a43; color: #fff; border-color: #102a43; }
.ll-tab--active:hover { background: #1e5fae; border-color: #1e5fae; }
.ll-tab--danger.ll-tab--active { background: #c0392b; border-color: #c0392b; }
.ll-tab--danger:hover { border-color: #c0392b; color: #c0392b; background: #fdf1f1; }

/* Form card */
.ll-form-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 22px; margin-bottom: 16px; box-shadow: 0 1px 4px rgba(16,42,67,.06); }
.ll-form-heading { margin: 0 0 18px; font-size: 15px; font-weight: 700; color: #243b53; }
.ll-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px; }
.ll-field { display: flex; flex-direction: column; gap: 6px; }
.ll-field--full { grid-column: 1 / -1; }
.ll-field label { font-size: 12.5px; font-weight: 700; color: #486581; }
.ll-opt { font-weight: 400; color: #9fb3c8; }
.ll-required { color: #c0392b; }
.ll-field input, .ll-field select { padding: 10px 13px; border: 1.5px solid #d2dbe6; border-radius: 9px; font-size: 14px; color: #243b53; background: #f8fafc; transition: border-color .15s; }
.ll-field input:focus, .ll-field select:focus { outline: none; border-color: #1e5fae; background: #fff; }
.ll-info-box { grid-column: 1 / -1; display: flex; align-items: flex-start; gap: 10px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px 14px; font-size: 13px; color: #1e40af; }
.ll-info-box--green { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
.ll-warn-box { grid-column: 1 / -1; display: flex; align-items: flex-start; gap: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 14px 16px; font-size: 13px; color: #991b1b; line-height: 1.5; }
.ll-warn-box strong { display: block; margin-bottom: 3px; }
.ll-form-footer { margin-top: 20px; display: flex; align-items: center; gap: 16px; padding-top: 18px; border-top: 1px solid #f0f3f7; }
.ll-submit-btn { background: #102a43; color: #fff; border: none; padding: 12px 28px; border-radius: 11px; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 9px; transition: background .15s; }
.ll-submit-btn:hover:not(:disabled) { background: #1e5fae; }
.ll-submit-btn--danger { background: #c0392b; }
.ll-submit-btn--danger:hover:not(:disabled) { background: #a93226; }
.ll-submit-btn:disabled { opacity: .5; cursor: not-allowed; }
.ll-status-warn { font-size: 13px; color: #b9770e; }

/* History */
.ll-history-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px 22px; box-shadow: 0 1px 4px rgba(16,42,67,.06); }
.ll-history-head { display: flex; align-items: center; gap: 9px; font-size: 14px; font-weight: 700; color: #243b53; margin-bottom: 16px; }
.ll-history-table-wrap { overflow-x: auto; }
.ll-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.ll-table th { text-align: left; padding: 9px 10px; border-bottom: 2px solid #e6ebf1; color: #627d98; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; white-space: nowrap; }
.ll-table td { padding: 10px; border-bottom: 1px solid #f0f3f7; color: #334e68; }
.ll-table tr:last-child td { border-bottom: none; }
.ll-balance-change { font-size: 12px; color: #829ab1; }
.ll-notes-cell { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Badge */
.ll-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700; text-transform: capitalize; }

/* Spinner */
.ll-spinner { width: 16px; height: 16px; border: 2.5px solid rgba(255,255,255,.3); border-top-color: #fff; border-radius: 50%; animation: ll-spin .7s linear infinite; display: inline-block; }
.ll-spinner--sm { width: 14px; height: 14px; }
@keyframes ll-spin { to { transform: rotate(360deg); } }

@media (max-width: 600px) {
  .ll-wrap { padding: 16px 12px 48px; }
  .ll-tabs { flex-direction: column; }
  .ll-search-row { flex-wrap: wrap; }
  .ll-search-input { min-width: 0; }
}
`;

export default LoanLifecycle;
