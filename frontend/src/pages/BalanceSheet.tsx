import { useEffect, useState } from "react";
import axios from "axios";
import AlertModal from "../components/AlertModal";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
const fmt = (v: any) => `TZS ${Number(v || 0).toLocaleString()}`;

interface Line { code: string | null; name: string; amount: number; }
interface Sheet {
  as_of: string; assets: Line[]; liabilities: Line[]; equity: Line[];
  total_assets: number; total_liabilities: number; total_equity: number; is_balanced: boolean;
}

const BalanceSheet = () => {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<Sheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ isOpen: false, title: "", message: "", type: "info" as any });

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const load = async (date: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/accounting/balance-sheet`, { params: { as_of: date }, headers: authHeaders() });
      setData(res.data.data);
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Failed to load Balance Sheet", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(asOf); }, []);

  const section = (title: string, lines: Line[], total: number) => (
    <div className="bs-section">
      <div className="bs-section-title">{title}</div>
      {lines.length === 0 ? <div className="bs-empty-small">None</div> : lines.map((l, i) => (
        <div className="bs-row" key={l.code ?? i}><span>{l.name}</span><span>{fmt(l.amount)}</span></div>
      ))}
      <div className="bs-row bs-total"><span>Total {title}</span><span>{fmt(total)}</span></div>
    </div>
  );

  return (
    <div className="bs-page">
      <AlertModal isOpen={modal.isOpen} title={modal.title} message={modal.message} type={modal.type} onClose={() => setModal({ ...modal, isOpen: false })} />

      <div className="bs-card">
        <div className="bs-header">
          <div>
            <h1>Balance Sheet</h1>
            <p>Assets = Liabilities + Equity, as of a given date</p>
          </div>
          <div className="bs-filters">
            <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} />
            <button onClick={() => load(asOf)}>Refresh</button>
          </div>
        </div>

        {loading ? (
          <div className="bs-empty">Loading...</div>
        ) : !data ? (
          <div className="bs-empty">No data</div>
        ) : (
          <>
            <div className="bs-columns">
              <div>{section("Assets", data.assets, data.total_assets)}</div>
              <div>
                {section("Liabilities", data.liabilities, data.total_liabilities)}
                {section("Equity", data.equity, data.total_equity)}
              </div>
            </div>
            <div className={`bs-balance-flag ${data.is_balanced ? "ok" : "off"}`}>
              {data.is_balanced
                ? `✓ Balanced — Assets ${fmt(data.total_assets)} = Liabilities + Equity ${fmt(data.total_liabilities + data.total_equity)}`
                : `✗ NOT balanced — Assets ${fmt(data.total_assets)} vs Liabilities + Equity ${fmt(data.total_liabilities + data.total_equity)}`}
            </div>
          </>
        )}
      </div>

      <style>{`
        .bs-page { min-height: 100vh; background: #f1f5f9; padding: 80px 28px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .bs-card { max-width: 1100px; margin: 0 auto; background: white; border-radius: 20px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
        .bs-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 14px; }
        .bs-header h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
        .bs-header p { font-size: 13px; color: #64748b; margin: 0; }
        .bs-filters { display: flex; gap: 8px; }
        .bs-filters input { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 12px; }
        .bs-filters button { background: #0f172a; color: white; border: none; padding: 8px 16px; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .bs-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
        .bs-section { margin-bottom: 22px; }
        .bs-section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #334155; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
        .bs-row { display: flex; justify-content: space-between; padding: 8px 4px; font-size: 14px; color: #1e293b; }
        .bs-row.bs-total { font-weight: 700; border-top: 1px solid #e2e8f0; margin-top: 4px; padding-top: 10px; }
        .bs-empty, .bs-empty-small { text-align: center; padding: 10px; color: #94a3b8; font-size: 13px; }
        .bs-empty { padding: 40px; }
        .bs-balance-flag { padding: 14px 16px; border-radius: 12px; font-size: 13px; font-weight: 700; text-align: center; margin-top: 10px; }
        .bs-balance-flag.ok { background: #ecfdf5; color: #059669; }
        .bs-balance-flag.off { background: #fef2f2; color: #dc2626; }
        @media (max-width: 768px) { .bs-columns { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
};

export default BalanceSheet;
