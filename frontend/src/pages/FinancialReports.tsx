import { useEffect, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import AlertModal from "../components/AlertModal";
import ExportButtons from "../components/ExportButtons";
import GetHelp, { type HelpStep } from "../components/GetHelp";
import ReportsNav from "../components/ReportsNav";
import { printDocument } from "../utils/printDoc";
import { API_BASE } from "../lib/api";


const fmt = (v: any) => `TZS ${Number(v || 0).toLocaleString()}`;

interface Executive {
  total_portfolio: number; total_outstanding: number; disbursed_this_period: number; collected_this_period: number;
  active_loans: number; completed_loans: number; npl_ratio: number;
  total_income_this_period: number; total_expense_this_period: number; net_income_this_period: number;
}
interface Collections { total_collected: number; by_method: { method: string; count: number; total: number }[]; monthly_trend: { month: string; count: number; total: number }[]; }
interface Trend { total_interest_income?: number; total_penalties_collected?: number; monthly_trend: { month: string; total: number }[]; }
interface PnL { income: { code: string; name: string; amount: number }[]; expense: { code: string; name: string; amount: number }[]; total_income: number; total_expense: number; net_income: number; }

const SECTIONS = ["executive", "collections", "interest", "penalties", "pnl"] as const;
const SECTION_LABELS: Record<string, string> = { executive: "Executive", collections: "Collections", interest: "Interest Income", penalties: "Penalties", pnl: "Profit & Loss" };
const SECTION_EMOJIS: Record<string, string> = { executive: "🏢", collections: "💰", interest: "📈", penalties: "⚡", pnl: "📊" };

const FinancialReports = () => {
  const { t } = useTranslation("accounting");
  const [section, setSection] = useState<typeof SECTIONS[number]>("executive");
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [executive, setExecutive] = useState<Executive | null>(null);
  const [collections, setCollections] = useState<Collections | null>(null);
  const [interest, setInterest] = useState<Trend | null>(null);
  const [penalties, setPenalties] = useState<Trend | null>(null);
  const [pnl, setPnl] = useState<PnL | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ isOpen: false, title: "", message: "", type: "info" as any });

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = { from, to };
      const [execRes, collRes, intRes, penRes, pnlRes] = await Promise.all([
        axios.get(`${API_BASE}/reports/financial/executive-summary`, { params, headers: authHeaders() }),
        axios.get(`${API_BASE}/reports/financial/collections`, { params, headers: authHeaders() }),
        axios.get(`${API_BASE}/reports/financial/interest-income`, { params, headers: authHeaders() }),
        axios.get(`${API_BASE}/reports/financial/penalties`, { params, headers: authHeaders() }),
        axios.get(`${API_BASE}/reports/financial/profit-and-loss`, { params, headers: authHeaders() }),
      ]);
      setExecutive(execRes.data.data);
      setCollections(collRes.data.data);
      setInterest(intRes.data.data);
      setPenalties(penRes.data.data);
      setPnl(pnlRes.data.data);
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Failed to load Financial Reports", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const exportRows = (): Record<string, unknown>[] => {
    switch (section) {
      case "executive":
        return executive ? [{
          "Total Portfolio": executive.total_portfolio, "Outstanding Balance": executive.total_outstanding,
          "Disbursed This Period": executive.disbursed_this_period, "Collected This Period": executive.collected_this_period,
          "Active Loans": executive.active_loans, "Completed Loans": executive.completed_loans,
          "NPL Ratio (%)": executive.npl_ratio, "Net Income This Period": executive.net_income_this_period,
        }] : [];
      case "collections":
        return (collections?.by_method || []).map(m => ({ Method: m.method, Count: m.count, Total: m.total }));
      case "interest":
        return (interest?.monthly_trend || []).map(t => ({ Month: t.month, "Interest Income": t.total }));
      case "penalties":
        return (penalties?.monthly_trend || []).map(t => ({ Month: t.month, "Penalties Collected": t.total }));
      case "pnl":
        if (!pnl) return [];
        return [
          ...pnl.income.map(l => ({ Section: "Income", Code: l.code, Account: l.name, Amount: l.amount })),
          { Section: "Income", Code: "", Account: "Total Income", Amount: pnl.total_income },
          ...pnl.expense.map(l => ({ Section: "Expense", Code: l.code, Account: l.name, Amount: l.amount })),
          { Section: "Expense", Code: "", Account: "Total Expenses", Amount: pnl.total_expense },
          { Section: "", Code: "", Account: "Net Income", Amount: pnl.net_income },
        ];
      default:
        return [];
    }
  };

  const handlePrint = () => {
    let body = "";
    if (section === "executive" && executive) {
      body = `
        <table><tbody>
          <tr><td>Total Portfolio</td><td style="text-align:right">${fmt(executive.total_portfolio)}</td></tr>
          <tr><td>Outstanding Balance</td><td style="text-align:right">${fmt(executive.total_outstanding)}</td></tr>
          <tr><td>Disbursed This Period</td><td style="text-align:right">${fmt(executive.disbursed_this_period)}</td></tr>
          <tr><td>Collected This Period</td><td style="text-align:right">${fmt(executive.collected_this_period)}</td></tr>
          <tr><td>Active Loans</td><td style="text-align:right">${executive.active_loans}</td></tr>
          <tr><td>Completed Loans</td><td style="text-align:right">${executive.completed_loans}</td></tr>
          <tr><td>NPL Ratio (PAR90)</td><td style="text-align:right">${executive.npl_ratio}%</td></tr>
          <tr><td><strong>Net Income This Period</strong></td><td style="text-align:right"><strong>${fmt(executive.net_income_this_period)}</strong></td></tr>
        </tbody></table>
      `;
    } else if (section === "collections" && collections) {
      body = `
        <p><strong>Total Collected:</strong> ${fmt(collections.total_collected)}</p>
        <h4>By Payment Method</h4>
        <table><thead><tr><th>Method</th><th style="text-align:right">Count</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${collections.by_method.map(m => `<tr><td style="text-transform:capitalize">${m.method.replace(/_/g, " ")}</td><td style="text-align:right">${m.count}</td><td style="text-align:right">${fmt(m.total)}</td></tr>`).join("")}</tbody></table>
        <h4>Monthly Trend</h4>
        <table><thead><tr><th>Month</th><th style="text-align:right">Count</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${collections.monthly_trend.map(t => `<tr><td>${t.month}</td><td style="text-align:right">${t.count}</td><td style="text-align:right">${fmt(t.total)}</td></tr>`).join("")}</tbody></table>
      `;
    } else if (section === "interest" && interest) {
      body = `
        <p><strong>Total Interest Income:</strong> ${fmt(interest.total_interest_income)}</p>
        <table><thead><tr><th>Month</th><th style="text-align:right">Interest Income</th></tr></thead>
        <tbody>${interest.monthly_trend.map(t => `<tr><td>${t.month}</td><td style="text-align:right">${fmt(t.total)}</td></tr>`).join("")}</tbody></table>
      `;
    } else if (section === "penalties" && penalties) {
      body = `
        <p><strong>Total Penalties Collected:</strong> ${fmt(penalties.total_penalties_collected)}</p>
        <table><thead><tr><th>Month</th><th style="text-align:right">Penalties Collected</th></tr></thead>
        <tbody>${penalties.monthly_trend.map(t => `<tr><td>${t.month}</td><td style="text-align:right">${fmt(t.total)}</td></tr>`).join("")}</tbody></table>
      `;
    } else if (section === "pnl" && pnl) {
      body = `
        <h4>Income</h4>
        <table><tbody>${pnl.income.map(l => `<tr><td>${l.name}</td><td style="text-align:right">${fmt(l.amount)}</td></tr>`).join("")}<tr><td><strong>Total Income</strong></td><td style="text-align:right"><strong>${fmt(pnl.total_income)}</strong></td></tr></tbody></table>
        <h4>Expenses</h4>
        <table><tbody>${pnl.expense.map(l => `<tr><td>${l.name}</td><td style="text-align:right">${fmt(l.amount)}</td></tr>`).join("")}<tr><td><strong>Total Expenses</strong></td><td style="text-align:right"><strong>${fmt(pnl.total_expense)}</strong></td></tr></tbody></table>
        <p style="margin-top:14px;font-weight:700">Net Income: ${fmt(pnl.net_income)}</p>
      `;
    }
    if (body) printDocument(`Financial Reports — ${SECTION_LABELS[section]}`, body, `${from} to ${to}`);
  };

  return (
    <div className="fr-page">
      <AlertModal isOpen={modal.isOpen} title={modal.title} message={modal.message} type={modal.type} onClose={() => setModal({ ...modal, isOpen: false })} />

      <ReportsNav />

      <div className="fr-card">
        <div className="fr-accent-bar" />

        <div className="fr-sticky-top">
          <GetHelp
            title={t("financial.help.title")}
            intro={t("financial.help.intro")}
            steps={t("financial.help.steps", { returnObjects: true }) as HelpStep[]}
            tip={t("financial.help.tip")}
            actions={
              <div className="fr-actions">
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="fr-date-input" />
                <span className="fr-to-label">to</span>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} className="fr-date-input" />
                <button onClick={load} className="fr-refresh-btn">Refresh</button>
                <ExportButtons
                  getRows={exportRows}
                  filename={`financial-report-${section}`}
                  sheetName={SECTION_LABELS[section]}
                  onPrint={handlePrint}
                  disabled={loading}
                />
              </div>
            }
          />

          <div className="fr-section-tabs">
            {SECTIONS.map(s => (
              <button
                key={s}
                className={`fr-section-tab${section === s ? " fr-section-tab--active" : ""}`}
                onClick={() => setSection(s)}
              >
                <span className="fr-section-tab__emoji">{SECTION_EMOJIS[s]}</span>
                <span className="fr-section-tab__label">{SECTION_LABELS[s]}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="fr-empty">Loading...</div>
        ) : (
          <div className="fr-body">
            {section === "executive" && executive && (
              <div className="fr-kpi-grid">
                <div className="fr-kpi"><span>Total Portfolio</span><strong>{fmt(executive.total_portfolio)}</strong></div>
                <div className="fr-kpi"><span>Outstanding Balance</span><strong>{fmt(executive.total_outstanding)}</strong></div>
                <div className="fr-kpi"><span>Disbursed This Period</span><strong>{fmt(executive.disbursed_this_period)}</strong></div>
                <div className="fr-kpi"><span>Collected This Period</span><strong>{fmt(executive.collected_this_period)}</strong></div>
                <div className="fr-kpi"><span>Active Loans</span><strong>{executive.active_loans}</strong></div>
                <div className="fr-kpi"><span>Completed Loans</span><strong>{executive.completed_loans}</strong></div>
                <div className="fr-kpi"><span>NPL Ratio (PAR90)</span><strong>{executive.npl_ratio}%</strong></div>
                <div className="fr-kpi fr-kpi--net"><span>Net Income This Period</span><strong>{fmt(executive.net_income_this_period)}</strong></div>
              </div>
            )}

            {section === "collections" && collections && (
              <>
                <div className="fr-total-line">Total Collected: <strong>{fmt(collections.total_collected)}</strong></div>
                <div className="fr-sub-title">By Payment Method</div>
                <div className="fr-table-wrap">
                  <table>
                    <thead><tr><th>Method</th><th>Count</th><th>Total</th></tr></thead>
                    <tbody>
                      {collections.by_method.length === 0
                        ? <tr><td colSpan={3} className="fr-empty-small">No collections in this period</td></tr>
                        : collections.by_method.map(m => <tr key={m.method}><td style={{ textTransform: "capitalize" }}>{m.method.replace(/_/g, " ")}</td><td>{m.count}</td><td>{fmt(m.total)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
                <div className="fr-sub-title">Monthly Trend</div>
                <div className="fr-table-wrap">
                  <table>
                    <thead><tr><th>Month</th><th>Count</th><th>Total</th></tr></thead>
                    <tbody>
                      {collections.monthly_trend.length === 0
                        ? <tr><td colSpan={3} className="fr-empty-small">No data</td></tr>
                        : collections.monthly_trend.map(t => <tr key={t.month}><td>{t.month}</td><td>{t.count}</td><td>{fmt(t.total)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {section === "interest" && interest && (
              <>
                <div className="fr-total-line">Total Interest Income: <strong>{fmt(interest.total_interest_income)}</strong></div>
                <div className="fr-sub-title">Monthly Trend</div>
                <div className="fr-table-wrap">
                  <table>
                    <thead><tr><th>Month</th><th>Interest Income</th></tr></thead>
                    <tbody>
                      {interest.monthly_trend.length === 0
                        ? <tr><td colSpan={2} className="fr-empty-small">No data</td></tr>
                        : interest.monthly_trend.map(t => <tr key={t.month}><td>{t.month}</td><td>{fmt(t.total)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {section === "penalties" && penalties && (
              <>
                <div className="fr-total-line">Total Penalties Collected: <strong>{fmt(penalties.total_penalties_collected)}</strong></div>
                <p className="fr-note">Note: the repayment flow does not yet let a Finance Officer earmark part of a payment as a penalty, so this will read TZS 0 until that capability is added.</p>
                <div className="fr-sub-title">Monthly Trend</div>
                <div className="fr-table-wrap">
                  <table>
                    <thead><tr><th>Month</th><th>Penalties Collected</th></tr></thead>
                    <tbody>
                      {penalties.monthly_trend.length === 0
                        ? <tr><td colSpan={2} className="fr-empty-small">No data</td></tr>
                        : penalties.monthly_trend.map(t => <tr key={t.month}><td>{t.month}</td><td>{fmt(t.total)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {section === "pnl" && pnl && (
              <div className="fr-pnl">
                <div className="fr-sub-title">Income</div>
                {pnl.income.length === 0
                  ? <div className="fr-empty-small">No income recorded for this period</div>
                  : pnl.income.map(l => <div className="fr-row" key={l.code}><span>{l.name}</span><span>{fmt(l.amount)}</span></div>)}
                <div className="fr-row fr-row--total"><span>Total Income</span><span>{fmt(pnl.total_income)}</span></div>

                <div className="fr-sub-title">Expenses</div>
                {pnl.expense.length === 0
                  ? <div className="fr-empty-small">No expenses recorded for this period</div>
                  : pnl.expense.map(l => <div className="fr-row" key={l.code}><span>{l.name}</span><span>{fmt(l.amount)}</span></div>)}
                <div className="fr-row fr-row--total"><span>Total Expenses</span><span>{fmt(pnl.total_expense)}</span></div>

                <div className={`fr-net ${pnl.net_income >= 0 ? "fr-net--pos" : "fr-net--neg"}`}>
                  <span>Net Income</span><strong>{fmt(pnl.net_income)}</strong>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        /* ── page shell ── */
        .fr-page { height: 100%; overflow-y: auto; overflow-x: hidden; background: #f1f5f9; padding: 14px 18px 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-sizing: border-box; }
        .fr-card { max-width: 1900px; margin: 0 auto; background: #fff; border-radius: 20px; padding: 0 28px 28px; box-shadow: 0 1px 3px rgba(0,0,0,.05); border: 1px solid #e2e8f0; position: relative; overflow: clip; }
        .fr-accent-bar { position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg,#102a43 0%,#1e5fae 45%,#22c55e 100%); }

        /* ── sticky header ── */
        .fr-sticky-top { position: sticky; top: 0; z-index: 5; background: #fff; padding: 22px 0 0; }

        /* ── GetHelp actions row ── */
        .fr-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .fr-date-input { padding: 6px 10px; border: 1px solid #d2dbe6; border-radius: 8px; font-size: 13px; min-width: 0; flex-shrink: 1; }
        .fr-to-label { font-size: 13px; color: #64748b; white-space: nowrap; }
        .fr-refresh-btn { padding: 6px 14px; background: #102a43; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; }
        .fr-refresh-btn:hover { background: #1e5fae; }

        /* ── section sub-tabs ── */
        .fr-section-tabs { display: flex; align-items: flex-end; gap: 4px; border-bottom: 2px solid #e2e8f0; overflow-x: auto; scrollbar-width: none; margin-top: 10px; }
        .fr-section-tabs::-webkit-scrollbar { display: none; }
        .fr-section-tab { display: flex; align-items: center; gap: 5px; padding: 8px 14px; border: none; border-radius: 10px 10px 0 0; font-size: 12.5px; font-weight: 700; cursor: pointer; background: transparent; color: #64748b; transition: all .15s; white-space: nowrap; flex-shrink: 0; }
        .fr-section-tab:hover { background: #f1f5f9; color: #334e68; }
        .fr-section-tab--active { background: #fff; color: #102a43; border-bottom: 2px solid #fff; margin-bottom: -2px; box-shadow: 0 -2px 8px rgba(16,42,67,.06); }
        .fr-section-tab__emoji { font-size: 14px; line-height: 1; }
        .fr-section-tab__label { font-size: 12.5px; }

        /* ── body ── */
        .fr-body { overflow-x: auto; padding-top: 20px; }

        /* ── KPI grid ── */
        .fr-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        .fr-kpi { background: #f8fafc; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 6px; }
        .fr-kpi span { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: .4px; }
        .fr-kpi strong { font-size: 17px; color: #102a43; font-weight: 800; }
        .fr-kpi--net { background: #ecfdf5; }
        .fr-kpi--net strong { color: #059669; }

        /* ── tables ── */
        .fr-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        table { width: 100%; border-collapse: collapse; min-width: 360px; }
        th { text-align: left; padding: 10px 12px; background: #f8fafc; color: #334155; font-size: 12px; font-weight: 700; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
        td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b; }

        /* ── misc labels ── */
        .fr-total-line { font-size: 14px; color: #334155; margin-bottom: 14px; }
        .fr-note { font-size: 12px; color: #94a3b8; background: #f8fafc; padding: 10px 14px; border-radius: 10px; margin-bottom: 14px; }
        .fr-sub-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #334155; margin: 18px 0 10px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }

        /* ── P&L ── */
        .fr-pnl { max-width: 640px; }
        .fr-row { display: flex; justify-content: space-between; padding: 8px 4px; font-size: 14px; color: #1e293b; border-bottom: 1px solid #f1f5f9; }
        .fr-row--total { font-weight: 700; border-top: 2px solid #e2e8f0; border-bottom: none; padding-top: 10px; margin-top: 4px; }
        .fr-net { display: flex; justify-content: space-between; align-items: center; padding: 16px 18px; border-radius: 12px; font-size: 15px; font-weight: 700; margin-top: 18px; }
        .fr-net--pos { background: #ecfdf5; color: #059669; }
        .fr-net--neg { background: #fef2f2; color: #dc2626; }

        /* ── empty ── */
        .fr-empty { text-align: center; padding: 40px; color: #64748b; font-size: 14px; }
        .fr-empty-small { text-align: center; padding: 14px; color: #94a3b8; font-size: 13px; }

        /* ── responsive ── */
        @media (max-width: 1100px) { .fr-kpi-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 800px)  {
          .fr-card { padding: 0 14px 20px; border-radius: 14px; }
          .fr-kpi-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .fr-section-tab__label { display: none; }
          .fr-section-tab { padding: 8px 10px; }
          .fr-section-tab__emoji { font-size: 16px; }
          .fr-actions { gap: 4px; }
          .fr-date-input { font-size: 12px; padding: 5px 8px; }
          .fr-refresh-btn { font-size: 12px; padding: 5px 10px; }
        }
        @media (max-width: 480px) {
          .fr-page { padding: 8px 8px 32px; }
          .fr-kpi-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
          .fr-kpi { padding: 12px; }
          .fr-kpi span { font-size: 9.5px; }
          .fr-kpi strong { font-size: 13px; }
          .fr-sticky-top { padding: 14px 0 0; }
        }
      `}</style>
    </div>
  );
};

export default FinancialReports;
