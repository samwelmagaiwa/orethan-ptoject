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

interface ParBucket { days: number; outstanding_at_risk: number; percentage: number; }
interface ParSummary { total_outstanding_portfolio: number; par: Record<string, ParBucket>; risk_distribution: { low: number; medium: number; high: number; critical: number }; }
interface Cohort { cohort: string; disbursed_count: number; disbursed_amount: number; defaulted_count: number; defaulted_amount: number; default_rate_by_count: number; default_rate_by_amount: number; }
interface DefaultedLoan { loan_id: number; loan_number: string; borrower: string; disbursed_at: string; amount: number; remaining_balance: number; }
interface DefaultAnalysis { cohorts: Cohort[]; overall: { defaulted_loans: number; defaulted_amount: number; default_rate_by_count: number; default_rate_by_amount: number }; defaulted_loans: DefaultedLoan[]; }

const RiskReports = () => {
  const { t } = useTranslation("accounting");
  const [par, setPar] = useState<ParSummary | null>(null);
  const [defaults, setDefaults] = useState<DefaultAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ isOpen: false, title: "", message: "", type: "info" as any });

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const load = async () => {
    setLoading(true);
    try {
      const [parRes, defaultRes] = await Promise.all([
        axios.get(`${API_BASE}/reports/risk/par-summary`, { headers: authHeaders() }),
        axios.get(`${API_BASE}/reports/risk/default-analysis`, { headers: authHeaders() }),
      ]);
      setPar(parRes.data.data);
      setDefaults(defaultRes.data.data);
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Failed to load Risk Reports", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const riskBuckets = [
    { key: "low", label: "Low (1-30 DPD)", color: "#059669", bg: "#ecfdf5" },
    { key: "medium", label: "Medium (31-60 DPD)", color: "#d97706", bg: "#fffbeb" },
    { key: "high", label: "High (61-90 DPD)", color: "#ea580c", bg: "#fff7ed" },
    { key: "critical", label: "Critical (90+ DPD)", color: "#dc2626", bg: "#fef2f2" },
  ] as const;

  const exportRows = () => (defaults?.cohorts || []).map(c => ({
    Cohort: c.cohort, "Disbursed Count": c.disbursed_count, "Disbursed Amount": c.disbursed_amount,
    "Defaulted Count": c.defaulted_count, "Defaulted Amount": c.defaulted_amount, "Default Rate (%)": c.default_rate_by_amount,
  }));

  const handlePrint = () => {
    if (!defaults) return;
    const body = `
      <p><strong>Total Outstanding Portfolio:</strong> ${fmt(par?.total_outstanding_portfolio)}</p>
      <p>${defaults.overall.defaulted_loans} defaulted loans | ${fmt(defaults.overall.defaulted_amount)} at risk | Default rate: ${defaults.overall.default_rate_by_count}% by count, ${defaults.overall.default_rate_by_amount}% by amount</p>
      <table>
        <thead><tr><th>Cohort</th><th style="text-align:right">Disbursed</th><th style="text-align:right">Disbursed Amount</th><th style="text-align:right">Defaulted</th><th style="text-align:right">Defaulted Amount</th><th style="text-align:right">Default Rate</th></tr></thead>
        <tbody>${defaults.cohorts.map(c => `<tr><td>${c.cohort}</td><td style="text-align:right">${c.disbursed_count}</td><td style="text-align:right">${fmt(c.disbursed_amount)}</td><td style="text-align:right">${c.defaulted_count}</td><td style="text-align:right">${fmt(c.defaulted_amount)}</td><td style="text-align:right">${c.default_rate_by_amount}%</td></tr>`).join("")}</tbody>
      </table>
      ${defaults.defaulted_loans.length > 0 ? `
        <h4 style="margin:18px 0 8px">Defaulted Loans</h4>
        <table>
          <thead><tr><th>Loan No.</th><th>Borrower</th><th>Disbursed</th><th style="text-align:right">Amount</th><th style="text-align:right">Outstanding</th></tr></thead>
          <tbody>${defaults.defaulted_loans.map(l => `<tr><td>${l.loan_number}</td><td>${l.borrower}</td><td>${l.disbursed_at}</td><td style="text-align:right">${fmt(l.amount)}</td><td style="text-align:right">${fmt(l.remaining_balance)}</td></tr>`).join("")}</tbody>
        </table>
      ` : ""}
    `;
    printDocument("Risk Reports", body);
  };

  return (
    <div className="rr-page">
      <AlertModal isOpen={modal.isOpen} title={modal.title} message={modal.message} type={modal.type} onClose={() => setModal({ ...modal, isOpen: false })} />

      <ReportsNav />

      <div className="rr-card">
        <div className="rr-accent-bar" />

        <div className="rr-sticky-top">
          <GetHelp
            title={t("risk.help.title")}
            intro={t("risk.help.intro")}
            steps={t("risk.help.steps", { returnObjects: true }) as HelpStep[]}
            tip={t("risk.help.tip")}
            actions={
              <ExportButtons getRows={exportRows} filename="risk-reports" sheetName="Risk Reports" onPrint={handlePrint} disabled={!defaults} />
            }
          />
        </div>

        {loading ? (
          <div className="rr-empty">Loading...</div>
        ) : (
          <div className="rr-body">
            <div className="rr-portfolio-line">Total Outstanding Portfolio: <strong>{fmt(par?.total_outstanding_portfolio)}</strong></div>

            <div className="rr-par-grid">
              {[1, 30, 60, 90].map(days => {
                const bucket = par?.par[`par${days}`];
                return (
                  <div className="rr-par-card" key={days}>
                    <div className="rr-par-label">PAR{days === 1 ? "" : days}</div>
                    <div className="rr-par-pct">{bucket?.percentage ?? 0}%</div>
                    <div className="rr-par-amount">{fmt(bucket?.outstanding_at_risk)}</div>
                  </div>
                );
              })}
            </div>

            <div className="rr-section-title">Risk Distribution (overdue loans by severity)</div>
            <div className="rr-risk-grid">
              {riskBuckets.map(b => (
                <div className="rr-risk-card" style={{ background: b.bg }} key={b.key}>
                  <div className="rr-risk-count" style={{ color: b.color }}>{par?.risk_distribution[b.key] ?? 0}</div>
                  <div className="rr-risk-label">{b.label}</div>
                </div>
              ))}
            </div>

            <div className="rr-section-title">Default Analysis (90+ days past due)</div>
            <div className="rr-overall-line">
              {defaults?.overall.defaulted_loans ?? 0} defaulted loans &nbsp;|&nbsp; {fmt(defaults?.overall.defaulted_amount)} at risk &nbsp;|&nbsp;
              Default rate: {defaults?.overall.default_rate_by_count ?? 0}% by count, {defaults?.overall.default_rate_by_amount ?? 0}% by amount
            </div>

            <div className="rr-table-wrap">
              <table>
                <thead><tr><th>Cohort (Disbursement Month)</th><th>Disbursed</th><th>Disbursed Amount</th><th>Defaulted</th><th>Defaulted Amount</th><th>Default Rate</th></tr></thead>
                <tbody>
                  {!defaults || defaults.cohorts.length === 0 ? (
                    <tr><td colSpan={6} className="rr-empty-small">No disbursed loans yet</td></tr>
                  ) : defaults.cohorts.map(c => (
                    <tr key={c.cohort}>
                      <td>{c.cohort}</td>
                      <td>{c.disbursed_count}</td>
                      <td>{fmt(c.disbursed_amount)}</td>
                      <td>{c.defaulted_count}</td>
                      <td>{fmt(c.defaulted_amount)}</td>
                      <td>{c.default_rate_by_amount}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {defaults && defaults.defaulted_loans.length > 0 && (
              <>
                <div className="rr-section-title">Defaulted Loans</div>
                <div className="rr-table-wrap">
                  <table>
                    <thead><tr><th>Loan No.</th><th>Borrower</th><th>Disbursed</th><th>Amount</th><th>Outstanding</th></tr></thead>
                    <tbody>
                      {defaults.defaulted_loans.map(l => (
                        <tr key={l.loan_id}>
                          <td className="rr-loan-number">{l.loan_number}</td>
                          <td>{l.borrower}</td>
                          <td>{l.disbursed_at}</td>
                          <td>{fmt(l.amount)}</td>
                          <td>{fmt(l.remaining_balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        /* ── page shell ── */
        .rr-page { height: 100%; overflow-y: auto; overflow-x: hidden; background: #f1f5f9; padding: 14px 18px 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-sizing: border-box; }
        .rr-card { max-width: 1900px; margin: 0 auto; background: #fff; border-radius: 20px; padding: 0 28px 28px; box-shadow: 0 1px 3px rgba(0,0,0,.05); border: 1px solid #e2e8f0; position: relative; overflow: clip; }
        .rr-accent-bar { position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg,#102a43 0%,#1e5fae 45%,#22c55e 100%); }

        /* ── sticky header ── */
        .rr-sticky-top { position: sticky; top: 0; z-index: 5; background: #fff; padding: 22px 0 10px; }

        /* ── body ── */
        .rr-body { padding-top: 10px; }
        .rr-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 10px; }

        /* ── stat lines ── */
        .rr-portfolio-line { font-size: 14px; color: #334155; margin-bottom: 18px; padding: 12px 16px; background: #f8fafc; border-radius: 10px; }

        /* ── PAR grid ── */
        .rr-par-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 26px; }
        .rr-par-card { background: linear-gradient(135deg,#102a43 0%,#1e5fae 100%); color: #fff; border-radius: 14px; padding: 18px; text-align: center; }
        .rr-par-label { font-size: 12px; font-weight: 700; opacity: .7; text-transform: uppercase; letter-spacing: .5px; }
        .rr-par-pct { font-size: 28px; font-weight: 800; margin: 6px 0; }
        .rr-par-amount { font-size: 12px; opacity: .85; }

        /* ── risk grid ── */
        .rr-risk-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 8px; }
        .rr-risk-card { border-radius: 14px; padding: 16px; text-align: center; }
        .rr-risk-count { font-size: 26px; font-weight: 800; }
        .rr-risk-label { font-size: 11px; font-weight: 600; color: #475569; margin-top: 4px; }

        /* ── section labels ── */
        .rr-section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #334155; margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
        .rr-overall-line { font-size: 13px; color: #475569; margin-bottom: 14px; }

        /* ── tables ── */
        table { width: 100%; border-collapse: collapse; min-width: 360px; }
        th { text-align: left; padding: 11px 12px; background: #f8fafc; color: #334155; font-size: 12px; font-weight: 700; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
        td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b; }
        .rr-loan-number { font-family: monospace; font-weight: 700; }

        /* ── empty ── */
        .rr-empty { text-align: center; padding: 40px; color: #64748b; }
        .rr-empty-small { text-align: center; padding: 16px; color: #94a3b8; font-size: 13px; }

        /* ── responsive ── */
        @media (max-width: 900px) {
          .rr-par-grid { grid-template-columns: repeat(2, 1fr); }
          .rr-risk-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          .rr-card { padding: 0 14px 20px; border-radius: 14px; }
          .rr-par-pct { font-size: 22px; }
          .rr-par-card { padding: 14px; }
          .rr-sticky-top { padding: 14px 0 8px; }
        }
        @media (max-width: 480px) {
          .rr-page { padding: 8px 8px 32px; }
          .rr-par-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .rr-risk-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .rr-sticky-top { padding: 10px 0 6px; }
          .rr-par-card { padding: 12px; }
          .rr-par-pct { font-size: 20px; }
          .rr-par-label { font-size: 10px; }
          .rr-par-amount { font-size: 10px; }
          .rr-risk-count { font-size: 20px; }
          .rr-risk-label { font-size: 10px; }
          .rr-section-title { font-size: 10.5px; margin: 14px 0 8px; }
          .rr-portfolio-line { font-size: 13px; padding: 10px 12px; margin-bottom: 12px; }
        }
      `}</style>
    </div>
  );
};

export default RiskReports;

