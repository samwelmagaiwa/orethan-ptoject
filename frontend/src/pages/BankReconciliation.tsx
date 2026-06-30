import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import AlertModal from "../components/AlertModal";
import ConfirmModal from "../components/ConfirmModal";
import ExportButtons from "../components/ExportButtons";
import { printDocument } from "../utils/printDoc";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
const fmt = (v: any) => Number(v || 0).toLocaleString();

interface Account { id: number; code: string; name: string; }
interface Item { type: "deposit_in_transit" | "outstanding_payment"; description: string; amount: string; date: string; }
interface Reconciliation {
  id: number; statement_date: string; statement_balance: number; book_balance: number;
  adjusted_balance: number; difference: number; status: "draft" | "reconciled";
  account: Account; items: { type: string; description: string; amount: number; date: string }[];
}

const BankReconciliation = () => {
  const { t } = useTranslation("accounting");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [list, setList] = useState<Reconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [accountId, setAccountId] = useState<number | "">("");
  const [statementDate, setStatementDate] = useState(new Date().toISOString().slice(0, 10));
  const [statementBalance, setStatementBalance] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [statementLinesText, setStatementLinesText] = useState("");
  const [matching, setMatching] = useState(false);
  const [matchSummary, setMatchSummary] = useState<{ matchedCount: number; unmatchedStatementLines: { date: string; amount: number; description?: string }[] } | null>(null);
  const [modal, setModal] = useState({ isOpen: false, title: "", message: "", type: "info" as any });
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const load = async () => {
    setLoading(true);
    try {
      const [recRes, accRes] = await Promise.all([
        axios.get(`${API_BASE}/accounting/bank-reconciliations`, { headers: authHeaders() }),
        axios.get(`${API_BASE}/accounting/chart-of-accounts`, { params: { active_only: true }, headers: authHeaders() }),
      ]);
      setList(recRes.data.data || []);
      setAccounts((accRes.data.data || []).filter((a: any) => a.is_cash_account));
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Failed to load Bank Reconciliations", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setAccountId("");
    setStatementDate(new Date().toISOString().slice(0, 10));
    setStatementBalance("");
    setNotes("");
    setItems([]);
    setStatementLinesText("");
    setMatchSummary(null);
  };

  const addItem = (type: Item["type"]) => setItems(prev => [...prev, { type, description: "", amount: "", date: statementDate }]);
  const updateItem = (i: number, field: keyof Item, value: string) => setItems(prev => prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  // Parses "YYYY-MM-DD, amount, description" lines (one per row) pasted/typed
  // from the actual paper/PDF bank statement.
  const parseStatementLines = () => statementLinesText
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const [date, amount, ...rest] = line.split(",").map(p => p.trim());
      return { date, amount: Number(amount), description: rest.join(", ") };
    })
    .filter(l => l.date && !isNaN(l.amount) && l.amount !== 0);

  const autoMatch = async () => {
    if (!accountId) {
      setModal({ isOpen: true, title: "Select Account", message: "Choose a Cash/Bank account first", type: "warning" });
      return;
    }
    const statementLines = parseStatementLines();
    if (statementLines.length === 0) {
      setModal({ isOpen: true, title: "No Statement Lines", message: "Paste at least one statement line as: date, amount, description", type: "warning" });
      return;
    }
    setMatching(true);
    try {
      const res = await axios.post(`${API_BASE}/accounting/bank-reconciliations/auto-match`, {
        chart_of_account_id: accountId,
        statement_date: statementDate,
        statement_lines: statementLines,
      }, { headers: authHeaders() });
      const { matched, unmatched_book_items, unmatched_statement_lines } = res.data.data;
      setItems(unmatched_book_items.map((it: any) => ({ type: it.type, description: it.description, amount: String(it.amount), date: it.date })));
      setMatchSummary({ matchedCount: matched.length, unmatchedStatementLines: unmatched_statement_lines });
      setModal({ isOpen: true, title: "Auto-Match Complete", message: `${matched.length} transaction(s) matched against the ledger. ${unmatched_book_items.length} unmatched book item(s) were added below for you to review.`, type: "success" });
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Failed to auto-match statement", type: "error" });
    } finally {
      setMatching(false);
    }
  };

  const submit = async () => {
    if (!accountId || !statementBalance) {
      setModal({ isOpen: true, title: "Missing Information", message: "Account and Statement Balance are required", type: "warning" });
      return;
    }
    try {
      await axios.post(`${API_BASE}/accounting/bank-reconciliations`, {
        chart_of_account_id: accountId,
        statement_date: statementDate,
        statement_balance: statementBalance,
        notes,
        items: items.filter(i => i.description && Number(i.amount) > 0),
      }, { headers: authHeaders() });
      setShowModal(false);
      resetForm();
      load();
      setModal({ isOpen: true, title: "Saved", message: "Bank Reconciliation saved successfully", type: "success" });
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Failed to save reconciliation", type: "error" });
    }
  };

  const exportRows = () => list.map(r => ({
    Account: `${r.account.code} — ${r.account.name}`, "Statement Date": r.statement_date,
    "Statement Balance": r.statement_balance, "Book Balance": r.book_balance,
    "Adjusted Balance": r.adjusted_balance, Difference: r.difference, Status: r.status,
  }));

  const handlePrint = () => {
    const rowsHtml = list.map(r => `<tr><td>${r.account.code} — ${r.account.name}</td><td>${r.statement_date}</td><td style="text-align:right">${fmt(r.statement_balance)}</td><td style="text-align:right">${fmt(r.book_balance)}</td><td style="text-align:right">${fmt(r.adjusted_balance)}</td><td style="text-align:right">${fmt(r.difference)}</td><td style="text-transform:capitalize">${r.status}</td></tr>`).join("");
    const body = `<table><thead><tr><th>Account</th><th>Statement Date</th><th style="text-align:right">Statement Balance</th><th style="text-align:right">Book Balance</th><th style="text-align:right">Adjusted Balance</th><th style="text-align:right">Difference</th><th>Status</th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
    printDocument("Bank Reconciliations", body);
  };

  const deleteReconciliation = async () => {
    if (!confirmDeleteId) return;
    try {
      await axios.delete(`${API_BASE}/accounting/bank-reconciliations/${confirmDeleteId}`, { headers: authHeaders() });
      setList(prev => prev.filter(r => r.id !== confirmDeleteId));
      setModal({ isOpen: true, title: "Deleted", message: "Bank Reconciliation deleted", type: "success" });
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Failed to delete reconciliation", type: "error" });
    } finally {
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="br-page">
      <AlertModal isOpen={modal.isOpen} title={modal.title} message={modal.message} type={modal.type} onClose={() => setModal({ ...modal, isOpen: false })} />
      <ConfirmModal
        isOpen={confirmDeleteId !== null}
        title={t("bank.deleteTitle")}
        message={t("bank.deleteMessage")}
        type="danger"
        confirmText={t("bank.yesDelete")}
        cancelText={t("common.cancel")}
        onConfirm={deleteReconciliation}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <div className="br-card">
        <div className="br-accent-bar" />
        <div className="br-header">
          <div>
            <h1>{t("bank.title")}</h1>
            <p>{t("bank.subtitle")}</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <ExportButtons getRows={exportRows} filename="bank-reconciliations" sheetName="Bank Reconciliations" onPrint={handlePrint} disabled={!list.length} />
            <button className="br-add-btn" onClick={() => { resetForm(); setShowModal(true); }}>{t("bank.newReconciliation")}</button>
          </div>
        </div>

        {loading ? (
          <div className="br-empty">{t("common.loading")}</div>
        ) : (
          <table>
            <thead><tr><th>{t("common.account")}</th><th>{t("bank.statementDate")}</th><th>{t("bank.statementBalance")}</th><th>{t("bank.bookBalance")}</th><th>{t("bank.adjustedBalance")}</th><th>{t("bank.difference")}</th><th>{t("common.status")}</th><th></th></tr></thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan={8} className="br-empty">{t("bank.noReconciliations")}</td></tr>
              ) : list.map(r => (
                <tr key={r.id}>
                  <td>{r.account.code} — {r.account.name}</td>
                  <td>{r.statement_date}</td>
                  <td>{fmt(r.statement_balance)}</td>
                  <td>{fmt(r.book_balance)}</td>
                  <td>{fmt(r.adjusted_balance)}</td>
                  <td>{fmt(r.difference)}</td>
                  <td><span className={`br-status ${r.status}`}>{r.status}</span></td>
                  <td><button type="button" className="br-delete-btn" onClick={() => setConfirmDeleteId(r.id)}>{t("common.delete")}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="br-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="br-modal-content" onClick={e => e.stopPropagation()}>
            <h2>{t("bank.newReconciliationTitle")}</h2>

            <div className="br-guide">
              <strong>{t("bank.guideTitle")}</strong>
              <ul>
                <li>{t("bank.guideStatementBalance")}</li>
                <li>{t("bank.guideAutoMatch")}</li>
                <li>{t("bank.guideDepositInTransit")}</li>
                <li>{t("bank.guideOutstandingPayment")}</li>
              </ul>
            </div>

            <div className="br-modal-form">
              <table className="br-form-table">
                <tbody>
                  <tr>
                    <td>
                      <strong>{t("bank.cashBankAccount")}</strong>
                      <select value={accountId} onChange={e => setAccountId(Number(e.target.value))}>
                        <option value="">{t("bank.selectAccount")}</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                      </select>
                    </td>
                    <td><strong>{t("bank.statementDate")}</strong><input type="date" value={statementDate} onChange={e => setStatementDate(e.target.value)} /></td>
                    <td><strong>{t("bank.statementBalance")}</strong><input type="number" value={statementBalance} onChange={e => setStatementBalance(e.target.value)} /></td>
                  </tr>
                </tbody>
              </table>

              <div className="br-items-section">
                <div className="br-items-header">
                  <strong>{t("bank.statementLinesTitle")}</strong>
                </div>
                <p className="br-match-hint">{t("bank.statementLinesHint")}</p>
                <textarea
                  className="br-statement-textarea"
                  rows={4}
                  placeholder={"2026-06-05, 500000, Customer deposit\n2026-06-10, -120000, Supplier payment"}
                  value={statementLinesText}
                  onChange={e => setStatementLinesText(e.target.value)}
                />
                <button type="button" className="br-match-btn" onClick={autoMatch} disabled={matching}>
                  {matching ? t("bank.matching") : t("bank.autoMatch")}
                </button>
                {matchSummary && (
                  <div className="br-match-summary">
                    <span>✓ {matchSummary.matchedCount} statement line(s) matched a book transaction.</span>
                    {matchSummary.unmatchedStatementLines.length > 0 && (
                      <span className="br-match-warning">⚠ {matchSummary.unmatchedStatementLines.length} statement line(s) had no matching book transaction — these may need a manual journal entry.</span>
                    )}
                  </div>
                )}
              </div>

              <div className="br-items-section">
                <div className="br-items-header">
                  <strong>{t("bank.outstandingItems")} {items.length > 0 ? `(${items.length})` : t("bank.optional")}</strong>
                  <div>
                    <button type="button" onClick={() => addItem("deposit_in_transit")}>{t("bank.depositInTransit")}</button>
                    <button type="button" onClick={() => addItem("outstanding_payment")}>{t("bank.outstandingPayment")}</button>
                  </div>
                </div>
                {items.map((item, i) => (
                  <div className="br-item-row" key={i}>
                    <span className="br-item-type">{item.type === "deposit_in_transit" ? t("bank.deposit") : t("bank.payment")}</span>
                    <input type="text" placeholder={t("common.description")} value={item.description} onChange={e => updateItem(i, "description", e.target.value)} />
                    <input type="number" placeholder={t("common.amount")} value={item.amount} onChange={e => updateItem(i, "amount", e.target.value)} />
                    <input type="date" value={item.date} onChange={e => updateItem(i, "date", e.target.value)} />
                    <button type="button" className="br-remove-btn" onClick={() => removeItem(i)}>×</button>
                  </div>
                ))}
              </div>

              <div className="br-field"><label>{t("bank.notes")}</label><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
            </div>
            <div className="br-modal-actions">
              <button className="br-cancel-btn" onClick={() => setShowModal(false)}>{t("common.cancel")}</button>
              <button className="br-save-btn" onClick={submit}>{t("bank.saveReconciliation")}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .br-page { min-height: 100vh; background: #f1f5f9; padding: 80px 28px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .br-card { max-width: 1900px; margin: 0 auto; background: white; border-radius: 20px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; position: relative; overflow: hidden; }
        .br-accent-bar { position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg, #102a43 0%, #1e5fae 45%, #22c55e 100%); }
        .br-header { display: flex; justify-content: space-between; align-items: center; margin: 6px 0 20px; flex-wrap: wrap; gap: 16px; }
        .br-header h1 { font-size: 22px; font-weight: 700; color: #102a43; margin: 0 0 4px; }
        .br-header p { font-size: 13px; color: #64748b; margin: 0; }
        .br-add-btn { background: #102a43; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .br-add-btn:hover { background: #1e5fae; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 12px 10px; background: #f8fafc; color: #334155; font-size: 12px; font-weight: 700; border-bottom: 1px solid #e2e8f0; }
        td { padding: 11px 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b; }
        .br-status { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .br-status.reconciled { background: #ecfdf5; color: #059669; }
        .br-status.draft { background: #fffbeb; color: #d97706; }
        .br-delete-btn { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; padding: 5px 12px; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; }
        .br-delete-btn:hover { background: #fecaca; }
        .br-empty { text-align: center; padding: 40px; color: #64748b; }
        .br-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .br-modal-content { background: white; border-radius: 20px; padding: 26px; width: 720px; max-width: 94%; max-height: 90vh; overflow-y: auto; }
        .br-modal-content h2 { font-size: 18px; font-weight: 700; color: #102a43; margin: 0 0 14px; }
        .br-guide { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 12px 16px; margin-bottom: 16px; }
        .br-guide strong { font-size: 12.5px; color: #1e40af; }
        .br-guide ul { margin: 8px 0 0; padding-left: 18px; }
        .br-guide li { font-size: 11.5px; color: #334155; line-height: 1.55; margin-bottom: 5px; }
        .br-modal-form { display: flex; flex-direction: column; gap: 16px; }
        .br-form-table { border-collapse: collapse; }
        .br-form-table td { padding: 8px 10px 8px 0; border: none; vertical-align: top; }
        .br-form-table strong { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; display: block; margin-bottom: 6px; }
        .br-form-table input, .br-form-table select { width: 100%; padding: 9px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; box-sizing: border-box; }
        .br-field { display: flex; flex-direction: column; gap: 6px; flex: 1; }
        .br-field label { font-size: 12px; font-weight: 600; color: #334155; }
        .br-field input, .br-field select, .br-field textarea { padding: 10px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; }
        .br-items-section { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; }
        .br-match-hint { font-size: 11.5px; color: #64748b; margin: 0 0 8px; line-height: 1.5; }
        .br-match-hint code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; font-size: 11px; }
        .br-statement-textarea { width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12.5px; font-family: ui-monospace, monospace; box-sizing: border-box; resize: vertical; }
        .br-match-btn { margin-top: 10px; background: #1e5fae; color: white; border: none; padding: 9px 18px; border-radius: 8px; font-size: 12.5px; font-weight: 700; cursor: pointer; }
        .br-match-btn:hover:not(:disabled) { background: #164a8a; }
        .br-match-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .br-match-summary { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
        .br-match-summary span:first-child { color: #059669; font-weight: 600; }
        .br-match-warning { color: #b45309; font-weight: 600; }
        .br-items-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .br-items-header strong { font-size: 13px; color: #334155; }
        .br-items-header button { background: #f1f5f9; border: 1px dashed #cbd5e1; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 600; color: #334155; cursor: pointer; margin-left: 8px; }
        .br-item-row { display: grid; grid-template-columns: 90px 2fr 1fr 1fr 30px; gap: 8px; margin-bottom: 8px; align-items: center; }
        .br-item-type { font-size: 11px; font-weight: 700; color: #64748b; }
        .br-item-row input { padding: 7px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; }
        .br-remove-btn { background: #fee2e2; color: #dc2626; border: none; border-radius: 6px; width: 26px; height: 26px; font-size: 14px; cursor: pointer; }
        .br-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
        .br-cancel-btn { background: #e2e8f0; border: none; padding: 9px 18px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .br-save-btn { background: #102a43; color: white; border: none; padding: 9px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .br-save-btn:hover { background: #1e5fae; }
      `}</style>
    </div>
  );
};

export default BankReconciliation;
