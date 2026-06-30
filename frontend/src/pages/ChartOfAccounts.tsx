import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import AlertModal from "../components/AlertModal";
import ConfirmModal from "../components/ConfirmModal";
import ExportButtons from "../components/ExportButtons";
import GetHelp from "../components/GetHelp";
import { printDocument } from "../utils/printDoc";

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

// English labels used for CSV/print export (locale-independent files).
const TYPE_LABELS: Record<string, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  income: "Income",
  expense: "Expense",
};

const ChartOfAccounts = () => {
  const navigate = useNavigate();
  const { t } = useTranslation("accounting");
  // Localized type labels for on-screen display.
  const typeLabel = (type: string) => t(`chart.type${type.charAt(0).toUpperCase() + type.slice(1)}`);
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
    if (account.is_system) return;
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

  const exportRows = () => filtered.map(a => ({
    Code: a.code, Name: a.name, Type: TYPE_LABELS[a.type], "Normal Balance": a.normal_balance,
    "Cash/Bank": a.is_cash_account ? "Yes" : "No", Status: a.is_active ? "Active" : "Inactive",
  }));

  const handlePrint = () => {
    const rowsHtml = filtered.map(a => `<tr><td>${a.code}</td><td>${a.name}${a.is_system ? " (SYSTEM)" : ""}</td><td style="text-transform:capitalize">${a.type}</td><td style="text-transform:capitalize">${a.normal_balance}</td><td>${a.is_cash_account ? "Yes" : "—"}</td><td>${a.is_active ? "Active" : "Inactive"}</td></tr>`).join("");
    const body = `<table><thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Normal Balance</th><th>Cash?</th><th>Status</th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
    printDocument("Chart of Accounts", body);
  };

  return (
    <div className="coa-page">
      <AlertModal isOpen={modal.isOpen} title={modal.title} message={modal.message} type={modal.type} onClose={() => setModal({ ...modal, isOpen: false })} />
      <ConfirmModal isOpen={confirm.isOpen} title={confirm.title} message={confirm.message} type={confirm.type} onConfirm={confirm.onConfirm} onCancel={() => setConfirm({ ...confirm, isOpen: false })} />

      <div className="coa-card">
        <div className="coa-accent-bar" />
        <div className="coa-sticky-top">
          <div className="coa-header">
            <div>
              <h1>{t("chart.title")}</h1>
              <p>{t("chart.subtitle")}</p>
            </div>
            <button className="coa-add-btn" onClick={() => { resetForm(); setShowModal(true); }}>{t("chart.addAccount")}</button>
          </div>

          <GetHelp
            title="How to use the Chart of Accounts"
            intro="This is the full list of General Ledger accounts the system posts to. Every Journal Entry, repayment, disbursement, provisioning run, and accrual ultimately lands on one of these accounts."
            steps={[
              { title: "1. Browse or search", text: "Use the search box to find an account by its code or name, and the Type filter to narrow to Asset, Liability, Equity, Income or Expense accounts only.", example: "Type \"1100\" to jump straight to Loans Receivable." },
              { title: "2. Open an account's ledger", text: "Click any blue account code to open its General Ledger — every posted line for that account, in date order, with a running balance." },
              { title: "3. Add a new account", text: "Click + Add Account, fill in a unique code, name, type and normal balance (Debit for assets/expenses, Credit for liabilities/equity/income), then Create Account." },
              { title: "4. Activate / deactivate", text: "Click the Active/Inactive badge to toggle an account. System accounts (badged SYSTEM) are protected — the platform depends on them, so they can't be deactivated or deleted." },
              { title: "5. Export or print", text: "Use CSV / Excel / Print to share the current filtered list with auditors or management." },
            ]}
            tip="System accounts (1010 Cash, 1100 Loans Receivable, 1110 Interest Receivable, 1150 Allowance for Loan Losses, etc.) are the backbone of every automated posting — never delete or rename them."
          />

          <div className="coa-filters">
            <input type="text" placeholder={t("chart.searchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="">{t("chart.allTypes")}</option>
              {Object.keys(TYPE_LABELS).map(k => <option key={k} value={k}>{typeLabel(k)}</option>)}
            </select>
            <ExportButtons getRows={exportRows} filename="chart-of-accounts" sheetName="Chart of Accounts" onPrint={handlePrint} disabled={!filtered.length} />
          </div>
        </div>

        {loading ? (
          <div className="coa-empty">{t("common.loading")}</div>
        ) : (
          <div className="coa-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("common.code")}</th><th>{t("common.name")}</th><th>{t("common.type")}</th><th>{t("chart.normalBalance")}</th><th>{t("chart.cash")}</th><th>{t("common.status")}</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="coa-empty">{t("chart.noAccounts")}</td></tr>
                ) : filtered.map(a => (
                  <tr key={a.id}>
                    <td className="coa-code" onClick={() => navigate(`/accounting/general-ledger?account_id=${a.id}`)}>{a.code}</td>
                    <td>{a.name} {a.is_system && <span className="coa-system-badge">SYSTEM</span>}</td>
                    <td><span className={`coa-type-badge coa-type-${a.type}`}>{typeLabel(a.type)}</span></td>
                    <td style={{ textTransform: "capitalize" }}>{a.normal_balance === "debit" ? t("common.debit") : t("common.credit")}</td>
                    <td>{a.is_cash_account ? "Yes" : "—"}</td>
                    <td>
                      <span className={`coa-status-badge ${a.is_active ? "active" : "inactive"}`} onClick={() => toggleActive(a)} style={{ cursor: a.is_system ? "not-allowed" : "pointer" }}>
                        {a.is_active ? t("chart.active") : t("chart.inactive")}
                      </span>
                    </td>
                    <td>
                      {!a.is_system && <button className="coa-delete-btn" onClick={() => deleteAccount(a)}>{t("common.delete")}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="coa-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="coa-modal-content" onClick={e => e.stopPropagation()}>
            <h2>{t("chart.addAccountTitle")}</h2>
            <table className="coa-form-table">
              <tbody>
                <tr>
                  <td><strong>{t("common.code")}</strong><br /><input type="text" placeholder={t("chart.codeExample")} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></td>
                  <td colSpan={2}><strong>{t("common.name")}</strong><br /><input type="text" placeholder={t("chart.nameExample")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></td>
                </tr>
                <tr>
                  <td>
                    <strong>{t("common.type")}</strong><br />
                    <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                      {Object.keys(TYPE_LABELS).map(k => <option key={k} value={k}>{typeLabel(k)}</option>)}
                    </select>
                  </td>
                  <td>
                    <strong>{t("chart.normalBalance")}</strong><br />
                    <select value={form.normal_balance} onChange={e => setForm({ ...form, normal_balance: e.target.value })}>
                      <option value="debit">{t("common.debit")}</option>
                      <option value="credit">{t("common.credit")}</option>
                    </select>
                  </td>
                  <td>
                    <strong>{t("chart.cashBankAccount")}</strong><br />
                    <label className="coa-checkbox-label"><input type="checkbox" checked={form.is_cash_account} onChange={e => setForm({ ...form, is_cash_account: e.target.checked })} /> {t("chart.usedInCashBook")}</label>
                  </td>
                </tr>
                <tr>
                  <td colSpan={3}><strong>{t("common.description")}</strong><br /><textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></td>
                </tr>
              </tbody>
            </table>
            <div className="coa-modal-actions">
              <button className="coa-cancel-btn" onClick={() => setShowModal(false)}>{t("common.cancel")}</button>
              <button className="coa-save-btn" onClick={saveAccount}>{t("chart.createAccount")}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .coa-page { min-height: 100vh; background: #f1f5f9; padding: 80px 28px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .coa-card { max-width: 1900px; margin: 0 auto; background: white; border-radius: 20px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; position: relative; overflow: hidden; }
        .coa-accent-bar { position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg, #102a43 0%, #1e5fae 45%, #22c55e 100%); }
        .coa-sticky-top { position: sticky; top: 0; z-index: 5; background: white; padding-top: 6px; margin-bottom: 4px; }
        .coa-table-scroll { max-height: 62vh; overflow-y: auto; }
        .coa-table-scroll thead th { position: sticky; top: 0; z-index: 2; }
        .coa-header { display: flex; justify-content: space-between; align-items: center; margin: 6px 0 20px; flex-wrap: wrap; gap: 16px; }
        .coa-header h1 { font-size: 22px; font-weight: 700; color: #102a43; margin: 0 0 4px; }
        .coa-header p { font-size: 13px; color: #64748b; margin: 0; }
        .coa-add-btn { background: #102a43; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .coa-add-btn:hover { background: #1e5fae; }
        .coa-filters { display: flex; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
        .coa-filters input { flex: 1; min-width: 220px; padding: 9px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; }
        .coa-filters select { padding: 9px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 12px 10px; background: #f8fafc; color: #334155; font-size: 12px; font-weight: 700; border-bottom: 1px solid #e2e8f0; }
        td { padding: 12px 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b; }
        .coa-code { font-weight: 700; color: #1e5fae; font-family: monospace; cursor: pointer; }
        .coa-code:hover { text-decoration: underline; }
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
        .coa-modal-content { background: white; border-radius: 20px; padding: 26px; width: 620px; max-width: 92%; max-height: 90vh; overflow-y: auto; }
        .coa-modal-content h2 { font-size: 18px; font-weight: 700; color: #102a43; margin: 0 0 18px; }
        .coa-form-table { border-collapse: collapse; }
        .coa-form-table td { padding: 8px 10px; border: none; vertical-align: top; }
        .coa-form-table strong { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; display: block; margin-bottom: 6px; }
        .coa-form-table input, .coa-form-table select, .coa-form-table textarea { width: 100%; padding: 9px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; box-sizing: border-box; }
        .coa-checkbox-label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #334155; padding-top: 9px; }
        .coa-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
        .coa-cancel-btn { background: #e2e8f0; border: none; padding: 9px 18px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .coa-save-btn { background: #102a43; color: white; border: none; padding: 9px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .coa-save-btn:hover { background: #1e5fae; }
      `}</style>
    </div>
  );
};

export default ChartOfAccounts;
