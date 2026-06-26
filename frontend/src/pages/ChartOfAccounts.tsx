import { useEffect, useState } from "react";
import axios from "axios";
import AlertModal from "../components/AlertModal";
import ConfirmModal from "../components/ConfirmModal";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

interface Account {
  id: number;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  normal_balance: "debit" | "credit";
  is_cash_account: boolean;
  is_system: boolean;
  is_active: boolean;
  description?: string;
}

const TYPE_LABELS: Record<string, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  income: "Income",
  expense: "Expense",
};

const ChartOfAccounts = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", type: "asset", normal_balance: "debit", is_cash_account: false, description: "" });
  const [modal, setModal] = useState({ isOpen: false, title: "", message: "", type: "info" as any });
  const [confirm, setConfirm] = useState({ isOpen: false, title: "", message: "", onConfirm: () => {}, type: "info" as any });

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/accounting/chart-of-accounts`, { headers: authHeaders() });
      setAccounts(res.data.data || []);
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Failed to load Chart of Accounts", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => setForm({ code: "", name: "", type: "asset", normal_balance: "debit", is_cash_account: false, description: "" });

  const saveAccount = async () => {
    if (!form.code || !form.name) {
      setModal({ isOpen: true, title: "Missing Information", message: "Code and Name are required", type: "warning" });
      return;
    }
    try {
      await axios.post(`${API_BASE}/accounting/chart-of-accounts`, form, { headers: authHeaders() });
      setShowModal(false);
      resetForm();
      load();
      setModal({ isOpen: true, title: "Success", message: "Account created successfully", type: "success" });
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Failed to create account", type: "error" });
    }
  };

  const toggleActive = (account: Account) => {
    setConfirm({
      isOpen: true,
      title: account.is_active ? "Deactivate Account" : "Activate Account",
      message: `${account.is_active ? "Deactivate" : "Activate"} ${account.code} — ${account.name}?`,
      type: "info",
      onConfirm: async () => {
        setConfirm(prev => ({ ...prev, isOpen: false }));
        try {
          await axios.put(`${API_BASE}/accounting/chart-of-accounts/${account.id}`, { is_active: !account.is_active }, { headers: authHeaders() });
          load();
        } catch (err: any) {
          setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Action failed", type: "error" });
        }
      },
    });
  };

  const deleteAccount = (account: Account) => {
    setConfirm({
      isOpen: true,
      title: "Delete Account",
      message: `Delete ${account.code} — ${account.name}? This cannot be undone.`,
      type: "danger",
      onConfirm: async () => {
        setConfirm(prev => ({ ...prev, isOpen: false }));
        try {
          await axios.delete(`${API_BASE}/accounting/chart-of-accounts/${account.id}`, { headers: authHeaders() });
          load();
        } catch (err: any) {
          setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Delete failed", type: "error" });
        }
      },
    });
  };

  const filtered = accounts.filter(a =>
    (!typeFilter || a.type === typeFilter) &&
    (a.code.toLowerCase().includes(search.toLowerCase()) || a.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="coa-page">
      <AlertModal isOpen={modal.isOpen} title={modal.title} message={modal.message} type={modal.type} onClose={() => setModal({ ...modal, isOpen: false })} />
      <ConfirmModal isOpen={confirm.isOpen} title={confirm.title} message={confirm.message} type={confirm.type} onConfirm={confirm.onConfirm} onCancel={() => setConfirm({ ...confirm, isOpen: false })} />

      <div className="coa-card">
        <div className="coa-header">
          <div>
            <h1>Chart of Accounts</h1>
            <p>General Ledger account structure</p>
          </div>
          <button className="coa-add-btn" onClick={() => { resetForm(); setShowModal(true); }}>+ Add Account</button>
        </div>

        <div className="coa-filters">
          <input type="text" placeholder="Search by code or name..." value={search} onChange={e => setSearch(e.target.value)} />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="coa-empty">Loading...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Code</th><th>Name</th><th>Type</th><th>Normal Balance</th><th>Cash?</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="coa-empty">No accounts found</td></tr>
              ) : filtered.map(a => (
                <tr key={a.id}>
                  <td className="coa-code">{a.code}</td>
                  <td>{a.name} {a.is_system && <span className="coa-system-badge">SYSTEM</span>}</td>
                  <td><span className={`coa-type-badge coa-type-${a.type}`}>{TYPE_LABELS[a.type]}</span></td>
                  <td style={{ textTransform: "capitalize" }}>{a.normal_balance}</td>
                  <td>{a.is_cash_account ? "Yes" : "—"}</td>
                  <td>
                    <span className={`coa-status-badge ${a.is_active ? "active" : "inactive"}`} onClick={() => toggleActive(a)} style={{ cursor: a.is_system ? "not-allowed" : "pointer" }}>
                      {a.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    {!a.is_system && <button className="coa-delete-btn" onClick={() => deleteAccount(a)}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="coa-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="coa-modal-content" onClick={e => e.stopPropagation()}>
            <h2>Add Account</h2>
            <div className="coa-modal-form">
              <div className="coa-field"><label>Code</label><input type="text" placeholder="e.g. 1030" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
              <div className="coa-field"><label>Name</label><input type="text" placeholder="e.g. Mobile Money Wallet" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="coa-field">
                <label>Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="coa-field">
                <label>Normal Balance</label>
                <select value={form.normal_balance} onChange={e => setForm({ ...form, normal_balance: e.target.value })}>
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
                </select>
              </div>
              <div className="coa-field-checkbox">
                <label><input type="checkbox" checked={form.is_cash_account} onChange={e => setForm({ ...form, is_cash_account: e.target.checked })} /> Cash/Bank account (used in Cash Book)</label>
              </div>
              <div className="coa-field"><label>Description</label><textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <div className="coa-modal-actions">
              <button className="coa-cancel-btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="coa-save-btn" onClick={saveAccount}>Create Account</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .coa-page { min-height: 100vh; background: #f1f5f9; padding: 80px 28px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .coa-card { max-width: 1400px; margin: 0 auto; background: white; border-radius: 20px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
        .coa-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 16px; }
        .coa-header h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
        .coa-header p { font-size: 13px; color: #64748b; margin: 0; }
        .coa-add-btn { background: #0f172a; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .coa-add-btn:hover { background: #1e293b; }
        .coa-filters { display: flex; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
        .coa-filters input { flex: 1; min-width: 220px; padding: 9px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; }
        .coa-filters select { padding: 9px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 12px 10px; background: #f8fafc; color: #334155; font-size: 12px; font-weight: 700; border-bottom: 1px solid #e2e8f0; }
        td { padding: 12px 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b; }
        .coa-code { font-weight: 700; color: #0f172a; font-family: monospace; }
        .coa-system-badge { font-size: 9px; background: #e0e7ff; color: #4338ca; padding: 2px 6px; border-radius: 6px; margin-left: 6px; font-weight: 700; }
        .coa-type-badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .coa-type-asset { background: #dbeafe; color: #1e40af; }
        .coa-type-liability { background: #fee2e2; color: #b91c1c; }
        .coa-type-equity { background: #e9d5ff; color: #6b21a8; }
        .coa-type-income { background: #dcfce7; color: #166534; }
        .coa-type-expense { background: #fed7aa; color: #9a3412; }
        .coa-status-badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
        .coa-status-badge.active { background: #ecfdf5; color: #059669; }
        .coa-status-badge.inactive { background: #fef2f2; color: #dc2626; }
        .coa-delete-btn { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; padding: 5px 12px; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; }
        .coa-empty { text-align: center; padding: 40px; color: #64748b; }
        .coa-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .coa-modal-content { background: white; border-radius: 20px; padding: 26px; width: 460px; max-width: 90%; max-height: 90vh; overflow-y: auto; }
        .coa-modal-content h2 { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 18px; }
        .coa-modal-form { display: flex; flex-direction: column; gap: 14px; }
        .coa-field { display: flex; flex-direction: column; gap: 6px; }
        .coa-field label { font-size: 12px; font-weight: 600; color: #334155; }
        .coa-field input, .coa-field select, .coa-field textarea { padding: 10px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; }
        .coa-field-checkbox label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155; }
        .coa-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
        .coa-cancel-btn { background: #e2e8f0; border: none; padding: 9px 18px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .coa-save-btn { background: #0f172a; color: white; border: none; padding: 9px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
      `}</style>
    </div>
  );
};

export default ChartOfAccounts;
