import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
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

interface Account { id: number; code: string; name: string; }
interface GLLine { date: string; entry_number: string; description: string; debit: number; credit: number; running_balance: number; }

const GeneralLedger = () => {
  const { t } = useTranslation("accounting");
  const [searchParams] = useSearchParams();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<number | "">(() => {
    const fromUrl = searchParams.get("account_id");
    return fromUrl ? Number(fromUrl) : "";
  });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [ledger, setLedger] = useState<{ account: any; opening_balance: number; closing_balance: number; lines: GLLine[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: "", message: "", type: "info" as any });

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    axios.get(`${API_BASE}/accounting/chart-of-accounts`, { params: { active_only: true }, headers: authHeaders() })
      .then(res => {
        setAccounts(res.data.data || []);
        if (searchParams.get("account_id")) {
          load(Number(searchParams.get("account_id")));
        }
      })
      .catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async (overrideAccountId?: number) => {
    const id = overrideAccountId ?? accountId;
    if (!id) {
      setModal({ isOpen: true, title: "Select Account", message: "Please choose an account to view its ledger", type: "warning" });
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/accounting/general-ledger`, {
        params: { account_id: id, from: from || undefined, to: to || undefined },
        headers: authHeaders(),
      });
      setLedger(res.data.data);
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Failed to load General Ledger", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const exportRows = () => (ledger?.lines || []).map(l => ({
    Date: l.date, "Entry No.": l.entry_number, Description: l.description,
    Debit: l.debit, Credit: l.credit, Balance: l.running_balance,
  }));

  const handlePrint = () => {
    if (!ledger) return;
    const body = `
      <p><strong>Account:</strong> ${ledger.account.code} " ${ledger.account.name} &nbsp; | &nbsp; <strong>Opening:</strong> ${fmt(ledger.opening_balance)} &nbsp; | &nbsp; <strong>Closing:</strong> ${fmt(ledger.closing_balance)}</p>
      <table>
        <thead><tr><th>Date</th><th>Entry No.</th><th>Description</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Balance</th></tr></thead>
        <tbody>${ledger.lines.map(l => `<tr><td>${l.date}</td><td>${l.entry_number}</td><td>${l.description}</td><td style="text-align:right">${Number(l.debit) > 0 ? fmt(l.debit) : "–"}</td><td style="text-align:right">${Number(l.credit) > 0 ? fmt(l.credit) : "–"}</td><td style="text-align:right">${fmt(l.running_balance)}</td></tr>`).join("")}</tbody>
      </table>
    `;
    printDocument("General Ledger", body, `${from || "–"} to ${to || "–"}`);
  };

  return (
    <div className="gl-page">
      <style>{styles}</style>
      <AlertModal isOpen={modal.isOpen} title={modal.title} message={modal.message} type={modal.type} onClose={() => setModal({ ...modal, isOpen: false })} />

      <AccountingTabBar activePath="/accounting/general-ledger">
        <div className="gl-filters" style={{ margin: 0 }}>
          <select value={accountId} onChange={e => setAccountId(Number(e.target.value))}>
            <option value="">{t("common.selectAccount")}</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
          <button className="gl-load-btn" onClick={() => load()}>{t("common.refresh")}</button>
          <ExportButtons getRows={exportRows} filename="general-ledger" sheetName="General Ledger" onPrint={handlePrint} disabled={!ledger?.lines?.length} />
        </div>
      </AccountingTabBar>

      <div className="gl-card">
        <GetHelp
          title={t("ledger.help.title")}
          intro={t("ledger.help.intro")}
          steps={t("ledger.help.steps", { returnObjects: true }) as HelpStep[]}
          tip={t("ledger.help.tip")}
        />

        {loading && <div className="gl-empty">{t("common.loading")}</div>}

        {!loading && ledger && (
          <>
            <div className="gl-summary">
              <div><span>{t("common.account")}</span><strong>{ledger.account.code} " {ledger.account.name}</strong></div>
              <div><span>{t("ledger.openingBalance")}</span><strong>{fmt(ledger.opening_balance)}</strong></div>
              <div><span>{t("ledger.closingBalance")}</span><strong>{fmt(ledger.closing_balance)}</strong></div>
            </div>
            <div className="gl-table-scroll">
              <table>
                <thead><tr><th>{t("common.date")}</th><th>{t("common.entryNo")}</th><th>{t("common.description")}</th><th>{t("common.debit")}</th><th>{t("common.credit")}</th><th>{t("common.balance")}</th></tr></thead>
                <tbody>
                  {ledger.lines.length === 0 ? (
                    <tr><td colSpan={6} className="gl-empty">No transactions in this period</td></tr>
                  ) : ledger.lines.map((line, i) => (
                    <tr key={i}>
                      <td>{line.date}</td>
                      <td className="gl-entry-number">{line.entry_number}</td>
                      <td>{line.description}</td>
                      <td>{Number(line.debit) > 0 ? fmt(line.debit) : "–"}</td>
                      <td>{Number(line.credit) > 0 ? fmt(line.credit) : "–"}</td>
                      <td className="gl-balance">{fmt(line.running_balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && !ledger && <div className="gl-empty">Choose an account and click Load to view its ledger</div>}
      </div>
    </div>
  );
};

const styles = `
  .gl-page { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; background: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  .gl-card { max-width: 1900px; width: 100%; margin: 12px auto 40px; background: white; border-radius: 16px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; overflow: clip; position: relative; }
  .gl-filters { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .gl-filters select, .gl-filters input { padding: 9px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; }
  .gl-filters select { flex: 1; min-width: 240px; }
  .gl-load-btn { background: #102a43; color: white; border: none; padding: 9px 22px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .gl-load-btn:hover { background: #1e5fae; }
  .gl-summary { display: flex; gap: 24px; margin-bottom: 18px; padding: 16px; background: #f8fafc; border-radius: 12px; flex-wrap: wrap; }
  .gl-summary div { display: flex; flex-direction: column; gap: 4px; }
  .gl-summary span { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; }
  .gl-summary strong { font-size: 15px; color: #102a43; }
  .gl-table-scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 12px 10px; background: #f8fafc; color: #334155; font-size: 12px; font-weight: 700; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
  td { padding: 11px 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b; }
  .gl-entry-number { font-family: monospace; font-weight: 600; }
  .gl-balance { font-weight: 700; color: #102a43; }
  .gl-empty { text-align: center; padding: 40px; color: #64748b; }
`;

export default GeneralLedger;

