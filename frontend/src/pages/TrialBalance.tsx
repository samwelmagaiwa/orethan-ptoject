import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import AlertModal from "../components/AlertModal";
import ExportButtons from "../components/ExportButtons";
import { printDocument } from "../utils/printDoc";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
const fmt = (v: any) => Number(v || 0).toLocaleString();

interface Row { id: number; code: string; name: string; type: string; debit: number; credit: number; }

const TrialBalance = () => {
  const navigate = useNavigate();
  const { t } = useTranslation("accounting");
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<{ rows: Row[]; total_debit: number; total_credit: number; is_balanced: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ isOpen: false, title: "", message: "", type: "info" as any });

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const load = async (date: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/accounting/trial-balance`, { params: { as_of: date }, headers: authHeaders() });
      setData(res.data.data);
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Failed to load Trial Balance", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(asOf); }, []);

  const exportRows = () => (data?.rows || []).map(r => ({
    Code: r.code, Account: r.name, Type: r.type, Debit: r.debit, Credit: r.credit,
  }));

  const handlePrint = () => {
    if (!data) return;
    const rowsHtml = data.rows.map(r => `<tr><td>${r.code}</td><td>${r.name}</td><td style="text-transform:capitalize">${r.type}</td><td style="text-align:right">${r.debit > 0 ? fmt(r.debit) : "—"}</td><td style="text-align:right">${r.credit > 0 ? fmt(r.credit) : "—"}</td></tr>`).join("");
    const body = `
      <table>
        <thead><tr><th>Code</th><th>Account</th><th>Type</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr><td colspan="3"><strong>TOTAL</strong></td><td style="text-align:right"><strong>${fmt(data.total_debit)}</strong></td><td style="text-align:right"><strong>${fmt(data.total_credit)}</strong></td></tr></tfoot>
      </table>
      <p style="margin-top:14px;font-weight:700;color:${data.is_balanced ? "#059669" : "#dc2626"}">${data.is_balanced ? "Books are balanced" : "Books are NOT balanced — investigate immediately"}</p>
    `;
    printDocument("Trial Balance", body, asOf);
  };

  return (
    <div className="tb-page">
      <AlertModal isOpen={modal.isOpen} title={modal.title} message={modal.message} type={modal.type} onClose={() => setModal({ ...modal, isOpen: false })} />

      <div className="tb-card">
        <div className="tb-accent-bar" />
        <div className="tb-header">
          <div>
            <h1>{t("trial.title")}</h1>
            <p>{t("trial.subtitle")}</p>
          </div>
          <div className="tb-filters">
            <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} />
            <button onClick={() => load(asOf)}>{t("common.refresh")}</button>
            <ExportButtons getRows={exportRows} filename="trial-balance" sheetName="Trial Balance" onPrint={handlePrint} disabled={!data?.rows?.length} />
          </div>
        </div>

        {loading ? (
          <div className="tb-empty">{t("common.loading")}</div>
        ) : !data ? (
          <div className="tb-empty">No data</div>
        ) : (
          <>
            <table>
              <thead><tr><th>{t("common.code")}</th><th>{t("common.account")}</th><th>{t("common.type")}</th><th>{t("common.debit")}</th><th>{t("common.credit")}</th></tr></thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr><td colSpan={5} className="tb-empty">No posted transactions yet</td></tr>
                ) : data.rows.map(r => (
                  <tr key={r.code}>
                    <td className="tb-code" onClick={() => navigate(`/accounting/general-ledger?account_id=${r.id}`)}>{r.code}</td>
                    <td>{r.name}</td>
                    <td style={{ textTransform: "capitalize" }}>{r.type}</td>
                    <td>{r.debit > 0 ? fmt(r.debit) : "—"}</td>
                    <td>{r.credit > 0 ? fmt(r.credit) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}><strong>{t("common.total")}</strong></td>
                  <td><strong>{fmt(data.total_debit)}</strong></td>
                  <td><strong>{fmt(data.total_credit)}</strong></td>
                </tr>
              </tfoot>
            </table>
            <div className={`tb-balance-flag ${data.is_balanced ? "ok" : "off"}`}>
              {data.is_balanced ? "✓ Books are balanced" : "✗ Books are NOT balanced — investigate immediately"}
            </div>
          </>
        )}
      </div>

      <style>{`
        .tb-page { min-height: 100vh; background: #f1f5f9; padding: 80px 28px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .tb-card { max-width: 1900px; margin: 0 auto; background: white; border-radius: 20px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; position: relative; overflow: hidden; }
        .tb-accent-bar { position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg, #102a43 0%, #1e5fae 45%, #22c55e 100%); }
        .tb-header { display: flex; justify-content: space-between; align-items: center; margin: 6px 0 20px; flex-wrap: wrap; gap: 14px; }
        .tb-header h1 { font-size: 22px; font-weight: 700; color: #102a43; margin: 0 0 4px; }
        .tb-header p { font-size: 13px; color: #64748b; margin: 0; }
        .tb-filters { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .tb-filters input { padding: 9px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; }
        .tb-filters button { background: #102a43; color: white; border: none; padding: 9px 18px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .tb-filters button:hover { background: #1e5fae; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 12px 10px; background: #f8fafc; color: #334155; font-size: 12px; font-weight: 700; border-bottom: 1px solid #e2e8f0; }
        td { padding: 11px 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b; }
        tfoot td { border-top: 2px solid #102a43; border-bottom: none; padding-top: 14px; }
        .tb-code { font-weight: 700; font-family: monospace; color: #1e5fae; cursor: pointer; }
        .tb-code:hover { text-decoration: underline; }
        .tb-empty { text-align: center; padding: 40px; color: #64748b; }
        .tb-balance-flag { margin-top: 18px; padding: 12px 16px; border-radius: 10px; font-size: 14px; font-weight: 700; text-align: center; }
        .tb-balance-flag.ok { background: #ecfdf5; color: #059669; }
        .tb-balance-flag.off { background: #fef2f2; color: #dc2626; }
      `}</style>
    </div>
  );
};

export default TrialBalance;
