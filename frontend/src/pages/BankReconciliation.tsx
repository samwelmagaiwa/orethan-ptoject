import { useEffect, useState } from "react";
import axios from "axios";
import AlertModal from "../components/AlertModal";

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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [list, setList] = useState<Reconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [accountId, setAccountId] = useState<number | "">("");
  const [statementDate, setStatementDate] = useState(new Date().toISOString().slice(0, 10));
  const [statementBalance, setStatementBalance] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [modal, setModal] = useState({ isOpen: false, title: "", message: "", type: "info" as any });

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
  };

  const addItem = (type: Item["type"]) => setItems(prev => [...prev, { type, description: "", amount: "", date: statementDate }]);
  const updateItem = (i: number, field: keyof Item, value: string) => setItems(prev => prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

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

  return (
    <div className="br-page">
      <AlertModal isOpen={modal.isOpen} title={modal.title} message={modal.message} type={modal.type} onClose={() => setModal({ ...modal, isOpen: false })} />

      <div className="br-card">
        <div className="br-header">
          <div>
            <h1>Bank Reconciliation</h1>
            <p>Compare a bank statement balance against the GL-derived book balance</p>
          </div>
          <button className="br-add-btn" onClick={() => { resetForm(); setShowModal(true); }}>+ New Reconciliation</button>
        </div>

        {loading ? (
          <div className="br-empty">Loading...</div>
        ) : (
          <table>
            <thead><tr><th>Account</th><th>Statement Date</th><th>Statement Balance</th><th>Book Balance</th><th>Adjusted Balance</th><th>Difference</th><th>Status</th></tr></thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan={7} className="br-empty">No reconciliations yet</td></tr>
              ) : list.map(r => (
                <tr key={r.id}>
                  <td>{r.account.code} — {r.account.name}</td>
                  <td>{r.statement_date}</td>
                  <td>{fmt(r.statement_balance)}</td>
                  <td>{fmt(r.book_balance)}</td>
                  <td>{fmt(r.adjusted_balance)}</td>
                  <td>{fmt(r.difference)}</td>
                  <td><span className={`br-status ${r.status}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="br-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="br-modal-content" onClick={e => e.stopPropagation()}>
            <h2>New Bank Reconciliation</h2>
            <div className="br-modal-form">
              <div className="br-field-row">
                <div className="br-field">
                  <label>Cash/Bank Account</label>
                  <select value={accountId} onChange={e => setAccountId(Number(e.target.value))}>
                    <option value="">Select account</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                  </select>
                </div>
                <div className="br-field"><label>Statement Date</label><input type="date" value={statementDate} onChange={e => setStatementDate(e.target.value)} /></div>
                <div className="br-field"><label>Statement Balance</label><input type="number" value={statementBalance} onChange={e => setStatementBalance(e.target.value)} /></div>
              </div>

              <div className="br-items-section">
                <div className="br-items-header">
                  <strong>Outstanding Items (optional)</strong>
                  <div>
                    <button type="button" onClick={() => addItem("deposit_in_transit")}>+ Deposit in Transit</button>
                    <button type="button" onClick={() => addItem("outstanding_payment")}>+ Outstanding Payment</button>
                  </div>
                </div>
                {items.map((item, i) => (
                  <div className="br-item-row" key={i}>
                    <span className="br-item-type">{item.type === "deposit_in_transit" ? "Deposit" : "Payment"}</span>
                    <input type="text" placeholder="Description" value={item.description} onChange={e => updateItem(i, "description", e.target.value)} />
                    <input type="number" placeholder="Amount" value={item.amount} onChange={e => updateItem(i, "amount", e.target.value)} />
                    <input type="date" value={item.date} onChange={e => updateItem(i, "date", e.target.value)} />
                    <button type="button" className="br-remove-btn" onClick={() => removeItem(i)}>×</button>
                  </div>
                ))}
              </div>

              <div className="br-field"><label>Notes</label><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
            </div>
            <div className="br-modal-actions">
              <button className="br-cancel-btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="br-save-btn" onClick={submit}>Save Reconciliation</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .br-page { min-height: 100vh; background: #f1f5f9; padding: 80px 28px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .br-card { max-width: 1300px; margin: 0 auto; background: white; border-radius: 20px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
        .br-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 16px; }
        .br-header h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
        .br-header p { font-size: 13px; color: #64748b; margin: 0; }
        .br-add-btn { background: #0f172a; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 12px 10px; background: #f8fafc; color: #334155; font-size: 12px; font-weight: 700; border-bottom: 1px solid #e2e8f0; }
        td { padding: 11px 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b; }
        .br-status { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .br-status.reconciled { background: #ecfdf5; color: #059669; }
        .br-status.draft { background: #fffbeb; color: #d97706; }
        .br-empty { text-align: center; padding: 40px; color: #64748b; }
        .br-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .br-modal-content { background: white; border-radius: 20px; padding: 26px; width: 680px; max-width: 94%; max-height: 90vh; overflow-y: auto; }
        .br-modal-content h2 { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 18px; }
        .br-modal-form { display: flex; flex-direction: column; gap: 16px; }
        .br-field-row { display: flex; gap: 12px; }
        .br-field { display: flex; flex-direction: column; gap: 6px; flex: 1; }
        .br-field label { font-size: 12px; font-weight: 600; color: #334155; }
        .br-field input, .br-field select, .br-field textarea { padding: 10px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; }
        .br-items-section { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; }
        .br-items-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .br-items-header strong { font-size: 13px; color: #334155; }
        .br-items-header button { background: #f1f5f9; border: 1px dashed #cbd5e1; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 600; color: #334155; cursor: pointer; margin-left: 8px; }
        .br-item-row { display: grid; grid-template-columns: 90px 2fr 1fr 1fr 30px; gap: 8px; margin-bottom: 8px; align-items: center; }
        .br-item-type { font-size: 11px; font-weight: 700; color: #64748b; }
        .br-item-row input { padding: 7px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; }
        .br-remove-btn { background: #fee2e2; color: #dc2626; border: none; border-radius: 6px; width: 26px; height: 26px; font-size: 14px; cursor: pointer; }
        .br-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
        .br-cancel-btn { background: #e2e8f0; border: none; padding: 9px 18px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .br-save-btn { background: #0f172a; color: white; border: none; padding: 9px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
      `}</style>
    </div>
  );
};

export default BankReconciliation;
