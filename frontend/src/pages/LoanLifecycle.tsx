import { useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import AlertModal from "../components/AlertModal";
import ConfirmModal from "../components/ConfirmModal";
import GetHelp from "../components/GetHelp"
import type { HelpStep } from "../components/GetHelp";
import ComplianceTabBar from "../components/ComplianceTabBar";

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
  const { t } = useTranslation("common");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Loan[]>([]);
  const [loan, setLoan] = useState<Loan | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [action, setAction] = useState<Action>("reschedule");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: "", message: "", type: "info" as any });
  const [confirm, setConfirm] = useState<any>({ isOpen: false, title: "", message: "", type: "info", onConfirm: () => { } });

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
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    setResults([]);
    setLoan(null);
    try {
      const res = await axios.get(`${API_BASE}/loans/search`, { params: { q }, headers: authHeaders() });
      const list: Loan[] = res.data.data || [];
      if (list.length === 1) {
        setLoan(list[0]);
        loadHistory(list[0].id);
      } else if (list.length > 1) {
        setResults(list);
      } else {
        setModal({ isOpen: true, title: "Not Found", message: "No loan found matching that search. Try a loan ID, account number, name, or phone.", type: "error" });
      }
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Search failed.", type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const selectLoan = (l: Loan) => {
    setResults([]);
    setLoan(l);
    loadHistory(l.id);
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

  const actionLabel: Record<Action, string> = {
    reschedule: `${t("loanLifecycle.page.reschedule")} Loan`,
    topup: `Advance ${t("loanLifecycle.page.topup")}`,
    writeoff: `${t("loanLifecycle.page.writeoff")} Loan`,
  };

  return (
    <div className="ll-page">
      <style>{styles}</style>
      <AlertModal isOpen={modal.isOpen} title={modal.title} message={modal.message} type={modal.type} onClose={() => setModal({ ...modal, isOpen: false })} />
      <ConfirmModal isOpen={confirm.isOpen} title={confirm.title} message={confirm.message} type={confirm.type} onConfirm={confirm.onConfirm} onCancel={() => setConfirm((p: any) => ({ ...p, isOpen: false }))} />

      {/* ─── Compliance Tab Bar (matches Accounting style) ──────────── */}
      <ComplianceTabBar activePath="/loan-lifecycle">
        <div className="ll-action-tabs">
          {(["reschedule", "topup", "writeoff"] as Action[]).map(a => (
            <button
              key={a}
              className={`ll-action-tab ${action === a ? "ll-action-tab--active" : ""}`}
              onClick={() => setAction(a)}
            >
              {a === "reschedule" ? `🔄 ${t("loanLifecycle.page.reschedule")}` : a === "topup" ? `➕ ${t("loanLifecycle.page.topup")}` : `❌ ${t("loanLifecycle.page.writeoff")}`}
            </button>
          ))}
        </div>
      </ComplianceTabBar>

      {/* ─── Main card ──────────────────────────────────────────────── */}
      <div className="ll-card">

        {/* GetHelp lives in the card, not the sticky bar */}
        <GetHelp
          title={t("loanLifecycle.help.title")}
          intro={t("loanLifecycle.help.intro")}
          steps={t("loanLifecycle.help.steps", { returnObjects: true }) as HelpStep[]}
          tip={t("loanLifecycle.help.tip")}
        />

        {/* Search bar */}
        <div className="ll-search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder={t("loanLifecycle.page.searchPlaceholder")}
          />
          <button className="ll-btn ll-btn--primary" onClick={search} disabled={busy}>
            {busy ? t("loanLifecycle.page.searching") : `🔍 ${t("loanLifecycle.page.searchBtn")}`}
          </button>
        </div>

        {/* Multi-result list */}
        {results.length > 1 && (
          <div className="ll-results">
            <p className="ll-results-hint">{t("loanLifecycle.page.multipleMatches")}</p>
            {results.map(r => (
              <div key={r.id} className="ll-result-row" onClick={() => selectLoan(r)}>
                <strong>{r.name}</strong>
                <span>{r.loan_account_number || `#${r.id}`}</span>
                <span className={`ll-badge ll-${r.status}`}>{r.status}</span>
                <span>{fmt(r.remaining_balance)} remaining</span>
              </div>
            ))}
          </div>
        )}

        {/* Loan detail panels */}
        {loan && (
          <>
            {/* Loan summary grid */}
            <div className="ll-loan-grid">
              <div className="ll-loan-stat"><span>{t("loanLifecycle.page.borrower")}</span><strong>{loan.name}</strong></div>
              <div className="ll-loan-stat"><span>{t("loanLifecycle.page.account")}</span><strong>{loan.loan_account_number || `#${loan.id}`}</strong></div>
              <div className="ll-loan-stat"><span>{t("loanLifecycle.page.principal")}</span><strong>{fmt(loan.amount)}</strong></div>
              <div className="ll-loan-stat"><span>{t("loanLifecycle.page.outstanding")}</span><strong>{fmt(loan.remaining_balance)}</strong></div>
              <div className="ll-loan-stat"><span>{t("loanLifecycle.page.status")}</span><strong className={`ll-badge ll-${loan.status}`}>{loan.status}</strong></div>
              <div className="ll-loan-stat"><span>{t("loanLifecycle.page.nextDue")}</span><strong>{loan.next_payment_date || "–"}</strong></div>
            </div>

            {/* Action form */}
            <div className="ll-action-card">
              <div className="ll-action-title">
                {action === "reschedule" ? `🔄 ${t("loanLifecycle.page.reschedule")}` : action === "topup" ? `➕ ${t("loanLifecycle.page.topupLoan")}` : `❌ ${t("loanLifecycle.page.writeoffLoan")}`}
              </div>

              {action === "reschedule" && (
                <div className="ll-form">
                  <label>{t("loanLifecycle.page.newTerm")}<input type="number" min={1} value={termMonths} onChange={(e) => setTermMonths(Number(e.target.value))} /></label>
                  <label>{t("loanLifecycle.page.frequency")}
                    <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                      <option>{t("loanLifecycle.page.monthly")}</option><option>{t("loanLifecycle.page.weekly")}</option><option>{t("loanLifecycle.page.biWeekly")}</option><option>{t("loanLifecycle.page.daily")}</option><option>{t("loanLifecycle.page.quarterly")}</option>
                    </select>
                  </label>
                  <label>{t("loanLifecycle.page.interestRateField")} <small>({t("loanLifecycle.page.interestRateBlank")})</small><input type="number" step="0.1" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} placeholder="default" /></label>
                  <label>{t("loanLifecycle.page.startDate")}<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
                  <label className="ll-full">{t("loanLifecycle.page.notes")}<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("loanLifecycle.page.optional")} /></label>
                </div>
              )}
              {action === "topup" && (
                <div className="ll-form">
                  <label>{t("loanLifecycle.page.topUpAmount")}<input type="number" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} placeholder="0" /></label>
                  <label>{t("loanLifecycle.page.payOutVia")}
                    <select value={method} onChange={(e) => setMethod(e.target.value)}>
                      <option value="cash">{t("loanLifecycle.page.cash")}</option><option value="bank">{t("loanLifecycle.page.bank")}</option><option value="mobile">{t("loanLifecycle.page.mobileMoney")}</option>
                    </select>
                  </label>
                  <label>{t("loanLifecycle.page.newTerm")}<input type="number" min={1} value={termMonths} onChange={(e) => setTermMonths(Number(e.target.value))} /></label>
                  <label>{t("loanLifecycle.page.interestRateField")} <small>({t("loanLifecycle.page.interestRateBlank")})</small><input type="number" step="0.1" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} placeholder="default" /></label>
                  <label className="ll-full">{t("loanLifecycle.page.notes")}<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("loanLifecycle.page.optional")} /></label>
                </div>
              )}
              {action === "writeoff" && (
                <div className="ll-form">
                  <label className="ll-full">{t("loanLifecycle.page.reason")}<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Borrower deceased / uncollectible after 180 days" /></label>
                  <label className="ll-full">{t("loanLifecycle.page.notes")}<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("loanLifecycle.page.optional")} /></label>
                  <p className="ll-note ll-full">Writes off {fmt(loan.remaining_balance)} against the Allowance for Loan Losses (shortfall to provision expense), and closes the loan.</p>
                </div>
              )}

              <div className="ll-actions">
                <button
                  className={`ll-btn ${action === "writeoff" ? "ll-btn--danger" : "ll-btn--primary"}`}
                  onClick={submit}
                  disabled={busy || (action === "writeoff" ? !writeOffOk : !canAct)}
                >
                  {actionLabel[action]}
                </button>
                {!canAct && action !== "writeoff" && (
                  <span className="ll-warn">This loan is {loan.status} &ndash; only write-off may apply.</span>
                )}
              </div>
            </div>

            {/* History table */}
            {history.length > 0 && (
              <div className="ll-action-card" style={{ marginTop: 18 }}>
                <div className="ll-action-title">📋 {t("loanLifecycle.page.historyTitle")}</div>
                <table className="ll-table">
                  <thead>
                    <tr><th>{t("loanLifecycle.page.historyDate")}</th><th>{t("loanLifecycle.page.historyAction")}</th><th>{t("loanLifecycle.page.historyAmount")}</th><th>{t("loanLifecycle.page.historyBalance")} &rarr;</th><th>{t("loanLifecycle.page.historyBy")}</th><th>{t("loanLifecycle.page.notes")}</th></tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td>{new Date(h.created_at).toLocaleDateString()}</td>
                        <td><span className={`ll-badge ll-${h.type}`}>{h.type}</span></td>
                        <td>{Number(h.amount) > 0 ? fmt(h.amount) : "–"}</td>
                        <td>{fmt(h.balance_before)} &rarr; {fmt(h.balance_after)}</td>
                        <td>{h.performer?.name || "–"}</td>
                        <td>{h.notes || "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {!loan && results.length === 0 && (
          <div className="ll-empty">
            <div className="ll-empty-icon">🔍</div>
            <p>{t("loanLifecycle.page.emptyState")}</p>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = `
/* ─── Page ────────────────────────────────────────────────────────── */
.ll-page {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  background: #f1f5f9;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* ─── Action sub-tabs (inside ComplianceTabBar actions area) ─────── */
.ll-action-tabs { display: flex; gap: 4px; align-items: center; }
.ll-action-tab {
  padding: 6px 14px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  background: #e2e8f0;
  color: #475569;
  transition: background .15s, color .15s;
  white-space: nowrap;
}
.ll-action-tab:hover:not(.ll-action-tab--active) { background: #cbd5e1; color: #334155; }
.ll-action-tab--active { background: #102a43; color: #fff; }

/* ─── Card ─────────────────────────────────────────────────────────── */
.ll-card {
  max-width: 1200px;
  width: 100%;
  margin: 12px auto 40px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 1px 3px rgba(0,0,0,.05);
}

/* ─── Search ─────────────────────────────────────────────────────── */
.ll-search { display: flex; gap: 10px; margin-bottom: 18px; }
.ll-search input {
  flex: 1; max-width: 520px;
  padding: 11px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  font-size: 14px;
}
.ll-search input:focus { outline: none; border-color: #1e5fae; box-shadow: 0 0 0 3px rgba(30,95,174,.1); }

/* ─── Buttons ─────────────────────────────────────────────────────── */
.ll-btn {
  padding: 10px 20px;
  border-radius: 10px;
  border: none;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: opacity .15s, transform .1s;
}
.ll-btn:active { transform: scale(.97); }
.ll-btn:disabled { opacity: .5; cursor: not-allowed; }
.ll-btn--primary { background: #102a43; color: #fff; }
.ll-btn--primary:hover:not(:disabled) { background: #1e5fae; }
.ll-btn--danger { background: #c0392b; color: #fff; }
.ll-btn--danger:hover:not(:disabled) { background: #a93226; }

/* ─── Results dropdown ────────────────────────────────────────────── */
.ll-results { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 18px; overflow: hidden; }
.ll-results-hint { font-size: 12px; color: #64748b; margin: 0; padding: 10px 14px 6px; border-bottom: 1px solid #e2e8f0; }
.ll-result-row { display: flex; gap: 16px; align-items: center; padding: 10px 14px; cursor: pointer; font-size: 13px; border-bottom: 1px solid #f1f5f9; transition: background .12s; }
.ll-result-row:last-child { border-bottom: none; }
.ll-result-row:hover { background: #eff6ff; }
.ll-result-row strong { min-width: 140px; color: #102a43; }
.ll-result-row span { color: #64748b; }

/* ─── Loan stat grid ────────────────────────────────────────────────── */
.ll-loan-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 22px; }
.ll-loan-stat { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; }
.ll-loan-stat span { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: #64748b; margin-bottom: 4px; }
.ll-loan-stat strong { font-size: 15px; font-weight: 700; color: #102a43; }

/* ─── Badges ─────────────────────────────────────────────────────── */
.ll-badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: capitalize; }
.ll-disbursed { background: #e3f0ff; color: #1e5fae; }
.ll-completed { background: #e6f6ec; color: #1f9254; }
.ll-written_off, .ll-writeoff { background: #fdecec; color: #c0392b; }
.ll-reschedule { background: #fff4e0; color: #b9770e; }
.ll-topup { background: #eafaf1; color: #1f9254; }

/* ─── Action card ───────────────────────────────────────────────────── */
.ll-action-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 22px;
  margin-bottom: 18px;
}
.ll-action-title { font-size: 15px; font-weight: 700; color: #102a43; margin-bottom: 18px; }

/* ─── Form ──────────────────────────────────────────────────────────── */
.ll-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
.ll-form label { display: flex; flex-direction: column; font-size: 13px; font-weight: 600; color: #486581; gap: 6px; }
.ll-form label small { font-weight: 400; color: #9fb3c8; }
.ll-form input, .ll-form select { padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 9px; font-size: 14px; background: #fff; }
.ll-form input:focus, .ll-form select:focus { outline: none; border-color: #1e5fae; box-shadow: 0 0 0 3px rgba(30,95,174,.1); }
.ll-full { grid-column: 1 / -1; }
.ll-note { grid-column: 1 / -1; font-size: 13px; color: #c0392b; background: #fdf1f1; padding: 10px 12px; border-radius: 8px; margin: 0; border: 1px solid #fecaca; }

/* ─── Actions row ─────────────────────────────────────────────────── */
.ll-actions { margin-top: 18px; display: flex; align-items: center; gap: 14px; }
.ll-warn { color: #b9770e; font-size: 13px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 6px 12px; }

/* ─── Table ─────────────────────────────────────────────────────────── */
.ll-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.ll-table th { text-align: left; padding: 9px 10px; border-bottom: 2px solid #e2e8f0; color: #627d98; font-size: 11px; text-transform: uppercase; background: #f8fafc; }
.ll-table td { padding: 9px 10px; border-bottom: 1px solid #f1f5f9; color: #334e68; }
.ll-table tbody tr:hover td { background: #f8fafc; }

/* ─── Empty state ────────────────────────────────────────────────── */
.ll-empty { text-align: center; padding: 60px 40px; color: #94a3b8; }
.ll-empty-icon { font-size: 48px; margin-bottom: 12px; }
.ll-empty p { font-size: 14px; }
`;

export default LoanLifecycle;
