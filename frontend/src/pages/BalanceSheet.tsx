import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import AlertModal from "../components/AlertModal";
import ExportButtons from "../components/ExportButtons";
import GetHelp from "../components/GetHelp";
import { printDocument } from "../utils/printDoc";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
const fmt = (v: any) => `TZS ${Number(v || 0).toLocaleString()}`;

interface Line { id: number | null; code: string | null; name: string; amount: number; }
interface Sheet {
  as_of: string; assets: Line[]; liabilities: Line[]; equity: Line[];
  total_assets: number; total_liabilities: number; total_equity: number; is_balanced: boolean;
}

const BalanceSheet = () => {
  const navigate = useNavigate();
  const { t } = useTranslation("accounting");
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

  const exportRows = () => {
    if (!data) return [];
    const rows: Record<string, unknown>[] = [];
    data.assets.forEach(l => rows.push({ Section: "Assets", Code: l.code ?? "", Account: l.name, Amount: l.amount }));
    rows.push({ Section: "Assets", Code: "", Account: "Total Assets", Amount: data.total_assets });
    data.liabilities.forEach(l => rows.push({ Section: "Liabilities", Code: l.code ?? "", Account: l.name, Amount: l.amount }));
    rows.push({ Section: "Liabilities", Code: "", Account: "Total Liabilities", Amount: data.total_liabilities });
    data.equity.forEach(l => rows.push({ Section: "Equity", Code: l.code ?? "", Account: l.name, Amount: l.amount }));
    rows.push({ Section: "Equity", Code: "", Account: "Total Equity", Amount: data.total_equity });
    return rows;
  };

  const sectionHtml = (title: string, lines: Line[], total: number) => `
    <h4 style="margin:18px 0 8px">${title}</h4>
    <table>
      <thead><tr><th>Code</th><th>Account</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${lines.map(l => `<tr><td>${l.code ?? "—"}</td><td>${l.name}</td><td style="text-align:right">${fmt(l.amount)}</td></tr>`).join("")}</tbody>
      <tfoot><tr><td colspan="2"><strong>Total ${title}</strong></td><td style="text-align:right"><strong>${fmt(total)}</strong></td></tr></tfoot>
    </table>
  `;

  const handlePrint = () => {
    if (!data) return;
    const body = `
      ${sectionHtml("Assets", data.assets, data.total_assets)}
      ${sectionHtml("Liabilities", data.liabilities, data.total_liabilities)}
      ${sectionHtml("Equity", data.equity, data.total_equity)}
      <p style="margin-top:14px;font-weight:700;color:${data.is_balanced ? "#059669" : "#dc2626"}">${data.is_balanced ? "Balanced" : "NOT balanced"} — Assets ${fmt(data.total_assets)} vs Liabilities + Equity ${fmt(data.total_liabilities + data.total_equity)}</p>
    `;
    printDocument("Balance Sheet", body, asOf);
  };

  const section = (title: string, lines: Line[], total: number) => (
    <div className="bs-section">
      <div className="bs-section-title">{title}</div>
      <table>
        <thead><tr><th>{t("common.code")}</th><th>{t("common.account")}</th><th>{t("common.amount")}</th></tr></thead>
        <tbody>
          {lines.length === 0 ? (
            <tr><td colSpan={3} className="bs-empty-small">None</td></tr>
          ) : lines.map((l, i) => (
            <tr key={l.id ?? i}>
              <td className={l.id ? "bs-code" : "bs-code-disabled"} onClick={() => l.id && navigate(`/accounting/general-ledger?account_id=${l.id}`)}>{l.code ?? "—"}</td>
              <td>{l.name}</td>
              <td>{fmt(l.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td colSpan={2}><strong>Total {title}</strong></td><td><strong>{fmt(total)}</strong></td></tr>
        </tfoot>
      </table>
    </div>
  );

  return (
    <div className="bs-page">
      <AlertModal isOpen={modal.isOpen} title={modal.title} message={modal.message} type={modal.type} onClose={() => setModal({ ...modal, isOpen: false })} />

      <div className="bs-card">
        <div className="bs-accent-bar" />
        <div className="bs-sticky-top">
          <div className="bs-header">
            <div>
              <h1>{t("balance.title")}</h1>
              <p>{t("balance.subtitle")}</p>
            </div>
            <div className="bs-filters">
              <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} />
              <button onClick={() => load(asOf)}>{t("common.refresh")}</button>
              <ExportButtons getRows={exportRows} filename="balance-sheet" sheetName="Balance Sheet" onPrint={handlePrint} disabled={!data} />
            </div>
          </div>
          <GetHelp
            title="How to use the Balance Sheet"
            intro="The Balance Sheet is a snapshot of the institution's financial position at a specific date. It shows what the institution owns (Assets), what it owes (Liabilities), and the owners' stake (Equity). Assets must equal Liabilities + Equity."
            steps={[
              { title: "1. Set the as-of date", text: "Pick any date to see the balance sheet position at that point. The default is today.", example: "As of 2026-06-30 → shows end-of-June position for half-year reporting." },
              { title: "2. Click Refresh", text: "Click Refresh to load the report. Assets appear on the left column; Liabilities and Equity on the right." },
              { title: "3. Verify the balance check", text: "The banner at the bottom confirms Assets = Liabilities + Equity. Green means balanced. Red means unbalanced — check for unposted journals or missing entries.", example: "Assets TZS 45,200,000 = Liabilities TZS 12,800,000 + Equity TZS 32,400,000 ✓" },
              { title: "4. Drill into any account", text: "Click any blue account code to open the General Ledger and trace the transactions that built up that balance." },
              { title: "5. Export or print", text: "Use Export for detailed spreadsheet review or Print for board meetings, auditors, and regulatory submissions." },
            ]}
            tip="Compare the Loan Receivable balance here to the outstanding loan portfolio in Loan Management — they should match. A gap indicates unposted transactions."
          />
        </div>

        {loading ? (
          <div className="bs-empty">{t("common.loading")}</div>
        ) : !data ? (
          <div className="bs-empty">No data</div>
        ) : (
          <>
            <div className="bs-columns">
              <div>{section(t("balance.assets"), data.assets, data.total_assets)}</div>
              <div>
                {section(t("balance.liabilities"), data.liabilities, data.total_liabilities)}
                {section(t("balance.equity"), data.equity, data.total_equity)}
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
        .bs-page { height: 100%; overflow-y: auto; overflow-x: hidden; background: #f1f5f9; padding: 14px 18px 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .bs-card { max-width: 1900px; margin: 0 auto; background: white; border-radius: 20px; padding: 0 28px 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; position: relative; overflow: clip; }
        .bs-sticky-top { position: sticky; top: 0; z-index: 5; background: white; padding: 22px 0 10px; margin-bottom: 4px; }
        .bs-accent-bar { position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg, #102a43 0%, #1e5fae 45%, #22c55e 100%); }
        .bs-header { display: flex; justify-content: space-between; align-items: flex-start; margin: 6px 0 24px; flex-wrap: wrap; gap: 14px; }
        .bs-header h1 { font-size: 20px; font-weight: 700; color: #102a43; margin: 0 0 4px; }
        .bs-header p { font-size: 13px; color: #64748b; margin: 0; }
        .bs-filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .bs-filters input { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 12px; }
        .bs-filters button { background: #102a43; color: white; border: none; padding: 8px 16px; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .bs-filters button:hover { background: #1e5fae; }
        .bs-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
        .bs-section { margin-bottom: 22px; }
        .bs-section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #334155; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 9px; background: #f8fafc; color: #334155; font-size: 11px; font-weight: 700; border-bottom: 1px solid #e2e8f0; }
        td { padding: 9px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b; }
        tfoot td { border-top: 2px solid #102a43; border-bottom: none; padding-top: 10px; }
        .bs-code { font-weight: 700; font-family: monospace; color: #1e5fae; cursor: pointer; }
        .bs-code:hover { text-decoration: underline; }
        .bs-code-disabled { font-weight: 700; font-family: monospace; color: #94a3b8; }
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
