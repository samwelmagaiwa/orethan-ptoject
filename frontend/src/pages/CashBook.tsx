import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import AlertModal from "../components/AlertModal";
import ExportButtons from "../components/ExportButtons";
import GetHelp from "../components/GetHelp"
import type { HelpStep } from "../components/GetHelp";
import { printDocument } from "../utils/printDoc";
import AccountingTabBar from "../components/AccountingTabBar";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
const fmt = (v: any) => Number(v || 0).toLocaleString();

interface GLLine { date: string; entry_number: string; description: string; debit: number; credit: number; running_balance: number; }
interface AccountLedger { account: { id: number; code: string; name: string }; opening_balance: number; closing_balance: number; lines: GLLine[]; }

const CashBook = () => {
  const navigate = useNavigate();
  const { t } = useTranslation("accounting");
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

  const exportRows = () => {
    if (!data) return [];
    const rows: Record<string, unknown>[] = [];
    data.accounts.forEach(acc => acc.lines.forEach(line => rows.push({
      Account: `${acc.account.code} " ${acc.account.name}`,
      Date: line.date, "Entry No.": line.entry_number, Description: line.description,
      Debit: line.debit, Credit: line.credit, Balance: line.running_balance,
    })));
    return rows;
  };

  const handlePrint = () => {
    if (!data) return;
    const body = `
      <p><strong>Combined Opening Balance:</strong> TZS ${fmt(data.combined_opening_balance)} &nbsp; | &nbsp; <strong>Combined Closing Balance:</strong> TZS ${fmt(data.combined_closing_balance)}</p>
      ${data.accounts.map(acc => `
        <h4 style="margin:18px 0 8px">${acc.account.code} " ${acc.account.name} (Closing: TZS ${fmt(acc.closing_balance)})</h4>
        <table>
          <thead><tr><th>Date</th><th>Entry No.</th><th>Description</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Balance</th></tr></thead>
          <tbody>${acc.lines.map(l => `<tr><td>${l.date}</td><td>${l.entry_number}</td><td>${l.description}</td><td style="text-align:right">${Number(l.debit) > 0 ? fmt(l.debit) : "–"}</td><td style="text-align:right">${Number(l.credit) > 0 ? fmt(l.credit) : "–"}</td><td style="text-align:right">${fmt(l.running_balance)}</td></tr>`).join("")}</tbody>
        </table>
      `).join("")}
    `;
    printDocument("Cash Book", body, `${from} to ${to}`);
  };

  return (
    <div className="cb-page">
      <AlertModal isOpen={modal.isOpen} title={modal.title} message={modal.message} type={modal.type} onClose={() => setModal({ ...modal, isOpen: false })} />

      <AccountingTabBar>
        <div className="cb-filters" style={{ margin: 0 }}>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <span>{t("common.to")}</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
          <button onClick={load}>{t("common.refresh")}</button>
          <ExportButtons getRows={exportRows} filename="cash-book" sheetName="Cash Book" onPrint={handlePrint} disabled={!data} />
        </div>
      </AccountingTabBar>

      <div className="cb-card">
        <GetHelp
          title={t("cashbook.help.title")}
          intro={t("cashbook.help.intro")}
          steps={t("cashbook.help.steps", { returnObjects: true }) as HelpStep[]}
          tip={t("cashbook.help.tip")}
        />

        {loading ? (
          <div className="cb-empty">{t("common.loading")}</div>
        ) : !data ? (
          <div className="cb-empty">No data</div>
        ) : (
          <>
            <div className="cb-summary">
              <div><span>{t("cashbook.combinedOpening")}</span><strong>TZS {fmt(data.combined_opening_balance)}</strong></div>
              <div><span>{t("cashbook.combinedClosing")}</span><strong>TZS {fmt(data.combined_closing_balance)}</strong></div>
            </div>

            {data.accounts.length === 0 ? (
              <div className="cb-empty">No cash/bank accounts flagged in the Chart of Accounts</div>
            ) : data.accounts.map(acc => (
              <div className="cb-account-block" key={acc.account.id}>
                <div className="cb-account-title">
                  <span className="cb-account-name" onClick={() => navigate(`/accounting/general-ledger?account_id=${acc.account.id}`)}>{acc.account.code} " {acc.account.name}</span>
                  <span className="cb-account-balance">Closing: TZS {fmt(acc.closing_balance)}</span>
                </div>
                <table>
                  <thead><tr><th>{t("common.date")}</th><th>{t("common.entryNo")}</th><th>{t("common.description")}</th><th>{t("common.debit")}</th><th>{t("common.credit")}</th><th>{t("common.balance")}</th></tr></thead>
                  <tbody>
                    {acc.lines.length === 0 ? (
                      <tr><td colSpan={6} className="cb-empty-small">No transactions in this period</td></tr>
                    ) : acc.lines.map((line, i) => (
                      <tr key={i}>
                        <td>{line.date}</td>
                        <td className="cb-entry-number">{line.entry_number}</td>
                        <td>{line.description}</td>
                        <td>{Number(line.debit) > 0 ? fmt(line.debit) : "–"}</td>
                        <td>{Number(line.credit) > 0 ? fmt(line.credit) : "–"}</td>
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
        .cb-page { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; background: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .cb-card { max-width: 1900px; width: 100%; margin: 12px auto 40px; background: white; border-radius: 16px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; position: relative; overflow: clip; }
        .cb-header { display: flex; justify-content: space-between; align-items: flex-start; margin: 6px 0 20px; flex-wrap: wrap; gap: 14px; }
        .cb-header h1 { font-size: 22px; font-weight: 700; color: #102a43; margin: 0 0 4px; }
        .cb-header p { font-size: 13px; color: #64748b; margin: 0; }
        .cb-filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .cb-filters input { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 12px; }
        .cb-filters span { font-size: 12px; color: #64748b; }
        .cb-filters button { background: #102a43; color: white; border: none; padding: 8px 16px; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .cb-filters button:hover { background: #1e5fae; }
        .cb-summary { display: flex; gap: 24px; margin-bottom: 22px; padding: 16px; background: #f8fafc; border-radius: 12px; flex-wrap: wrap; }
        .cb-summary div { display: flex; flex-direction: column; gap: 4px; }
        .cb-summary span { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; }
        .cb-summary strong { font-size: 16px; color: #102a43; }
        .cb-account-block { margin-bottom: 28px; }
        .cb-account-title { font-size: 14px; font-weight: 700; color: #102a43; margin-bottom: 10px; display: flex; justify-content: space-between; }
        .cb-account-name { color: #1e5fae; cursor: pointer; }
        .cb-account-name:hover { text-decoration: underline; }
        .cb-account-balance { font-size: 13px; color: #059669; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 10px; background: #f8fafc; color: #334155; font-size: 11px; font-weight: 700; border-bottom: 1px solid #e2e8f0; }
        td { padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b; }
        .cb-entry-number { font-family: monospace; font-weight: 600; }
        .cb-balance { font-weight: 700; color: #102a43; }
        .cb-empty { text-align: center; padding: 40px; color: #64748b; }
        .cb-empty-small { text-align: center; padding: 16px; color: #94a3b8; }
      `}</style>
    </div>
  );
};

export default CashBook;

