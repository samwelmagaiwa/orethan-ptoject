import { useEffect, useState } from "react";
import axios from "axios";
import AlertModal from "../components/AlertModal";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
const fmt = (v: any) => `TZS ${Number(v || 0).toLocaleString()}`;

interface Line { code: string; name: string; amount: number; }
interface Statement { from: string; to: string; income: Line[]; expense: Line[]; total_income: number; total_expense: number; net_income: number; }

const IncomeStatement = () => {
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ isOpen: false, title: "", message: "", type: "info" as any });

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/accounting/income-statement`, { params: { from, to }, headers: authHeaders() });
      setData(res.data.data);
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Failed to load Income Statement", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="is-page">
      <AlertModal isOpen={modal.isOpen} title={modal.title} message={modal.message} type={modal.type} onClose={() => setModal({ ...modal, isOpen: false })} />

      <div className="is-card">
        <div className="is-header">
          <div>
            <h1>Income Statement (Profit &amp; Loss)</h1>
            <p>Revenue minus expenses for the selected period</p>
          </div>
          <div className="is-filters">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
            <span>to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} />
            <button onClick={load}>Refresh</button>
          </div>
        </div>

        {loading ? (
          <div className="is-empty">Loading...</div>
        ) : !data ? (
          <div className="is-empty">No data</div>
        ) : (
          <div className="is-body">
            <div className="is-section">
              <div className="is-section-title">Income</div>
              {data.income.length === 0 ? <div className="is-empty-small">No income recorded for this period</div> : data.income.map(l => (
                <div className="is-row" key={l.code}><span>{l.name}</span><span>{fmt(l.amount)}</span></div>
              ))}
              <div className="is-row is-total"><span>Total Income</span><span>{fmt(data.total_income)}</span></div>
            </div>

            <div className="is-section">
              <div className="is-section-title">Expenses</div>
              {data.expense.length === 0 ? <div className="is-empty-small">No expenses recorded for this period</div> : data.expense.map(l => (
                <div className="is-row" key={l.code}><span>{l.name}</span><span>{fmt(l.amount)}</span></div>
              ))}
              <div className="is-row is-total"><span>Total Expenses</span><span>{fmt(data.total_expense)}</span></div>
            </div>

            <div className={`is-net ${data.net_income >= 0 ? "positive" : "negative"}`}>
              <span>Net Income</span>
              <strong>{fmt(data.net_income)}</strong>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .is-page { min-height: 100vh; background: #f1f5f9; padding: 80px 28px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .is-card { max-width: 800px; margin: 0 auto; background: white; border-radius: 20px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
        .is-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 14px; }
        .is-header h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
        .is-header p { font-size: 13px; color: #64748b; margin: 0; }
        .is-filters { display: flex; align-items: center; gap: 8px; }
        .is-filters input { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 12px; }
        .is-filters span { font-size: 12px; color: #64748b; }
        .is-filters button { background: #0f172a; color: white; border: none; padding: 8px 16px; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .is-section { margin-bottom: 20px; }
        .is-section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #334155; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
        .is-row { display: flex; justify-content: space-between; padding: 8px 4px; font-size: 14px; color: #1e293b; }
        .is-row.is-total { font-weight: 700; border-top: 1px solid #e2e8f0; margin-top: 4px; padding-top: 10px; }
        .is-empty, .is-empty-small { text-align: center; padding: 12px; color: #94a3b8; font-size: 13px; }
        .is-empty { padding: 40px; }
        .is-net { display: flex; justify-content: space-between; align-items: center; padding: 16px 18px; border-radius: 12px; font-size: 15px; font-weight: 700; margin-top: 10px; }
        .is-net.positive { background: #ecfdf5; color: #059669; }
        .is-net.negative { background: #fef2f2; color: #dc2626; }
      `}</style>
    </div>
  );
};

export default IncomeStatement;
