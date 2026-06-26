import { useEffect, useState } from "react";
import axios from "axios";
import AlertModal from "../components/AlertModal";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
const fmt = (v: any) => Number(v || 0).toLocaleString();

interface GLLine { date: string; entry_number: string; description: string; debit: number; credit: number; running_balance: number; }
interface AccountLedger { account: { id: number; code: string; name: string }; opening_balance: number; closing_balance: number; lines: GLLine[]; }

const CashBook = () => {
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<{ accounts: AccountLedger[]; combined_opening_balance: number; combined_closing_balance: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ isOpen: false, title: "", message: "", type: "info" as any });

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/accounting/cash-book`, { params: { from, to }, headers: authHeaders() });
      setData(res.data.data);
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Failed to load Cash Book", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="cb-page">
      <AlertModal isOpen={modal.isOpen} title={modal.title} message={modal.message} type={modal.type} onClose={() => setModal({ ...modal, isOpen: false })} />

      <div className="cb-card">
        <div className="cb-header">
          <div>
            <h1>Cash Book</h1>
            <p>Combined ledger across every Cash and Bank account</p>
          </div>
          <div className="cb-filters">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
            <span>to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} />
            <button onClick={load}>Refresh</button>
          </div>
        </div>

        {loading ? (
          <div className="cb-empty">Loading...</div>
        ) : !data ? (
          <div className="cb-empty">No data</div>
        ) : (
          <>
            <div className="cb-summary">
              <div><span>Combined Opening Balance</span><strong>TZS {fmt(data.combined_opening_balance)}</strong></div>
              <div><span>Combined Closing Balance</span><strong>TZS {fmt(data.combined_closing_balance)}</strong></div>
            </div>

            {data.accounts.length === 0 ? (
              <div className="cb-empty">No cash/bank accounts flagged in the Chart of Accounts</div>
            ) : data.accounts.map(acc => (
              <div className="cb-account-block" key={acc.account.id}>
                <div className="cb-account-title">{acc.account.code} — {acc.account.name} <span className="cb-account-balance">Closing: TZS {fmt(acc.closing_balance)}</span></div>
                <table>
                  <thead><tr><th>Date</th><th>Entry No.</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
                  <tbody>
                    {acc.lines.length === 0 ? (
                      <tr><td colSpan={6} className="cb-empty-small">No transactions in this period</td></tr>
                    ) : acc.lines.map((line, i) => (
                      <tr key={i}>
                        <td>{line.date}</td>
                        <td className="cb-entry-number">{line.entry_number}</td>
                        <td>{line.description}</td>
                        <td>{Number(line.debit) > 0 ? fmt(line.debit) : "—"}</td>
                        <td>{Number(line.credit) > 0 ? fmt(line.credit) : "—"}</td>
                        <td className="cb-balance">{fmt(line.running_balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </>
        )}
      </div>

      <style>{`
        .cb-page { min-height: 100vh; background: #f1f5f9; padding: 80px 28px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .cb-card { max-width: 1300px; margin: 0 auto; background: white; border-radius: 20px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
        .cb-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 14px; }
        .cb-header h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
        .cb-header p { font-size: 13px; color: #64748b; margin: 0; }
        .cb-filters { display: flex; align-items: center; gap: 8px; }
        .cb-filters input { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 12px; }
        .cb-filters span { font-size: 12px; color: #64748b; }
        .cb-filters button { background: #0f172a; color: white; border: none; padding: 8px 16px; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .cb-summary { display: flex; gap: 24px; margin-bottom: 22px; padding: 16px; background: #f8fafc; border-radius: 12px; flex-wrap: wrap; }
        .cb-summary div { display: flex; flex-direction: column; gap: 4px; }
        .cb-summary span { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; }
        .cb-summary strong { font-size: 16px; color: #0f172a; }
        .cb-account-block { margin-bottom: 28px; }
        .cb-account-title { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 10px; display: flex; justify-content: space-between; }
        .cb-account-balance { font-size: 13px; color: #059669; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 10px; background: #f8fafc; color: #334155; font-size: 11px; font-weight: 700; border-bottom: 1px solid #e2e8f0; }
        td { padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b; }
        .cb-entry-number { font-family: monospace; font-weight: 600; }
        .cb-balance { font-weight: 700; color: #0f172a; }
        .cb-empty { text-align: center; padding: 40px; color: #64748b; }
        .cb-empty-small { text-align: center; padding: 16px; color: #94a3b8; }
      `}</style>
    </div>
  );
};

export default CashBook;
