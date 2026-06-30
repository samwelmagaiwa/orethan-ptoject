import { useEffect, useState } from "react";
import axios from "axios";
import AlertModal from "../components/AlertModal";
import ExportButtons from "../components/ExportButtons";
import GetHelp from "../components/GetHelp";
import { printDocument } from "../utils/printDoc";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
const fmt = (v: any) => `TZS ${Number(v || 0).toLocaleString()}`;

interface ClassRow { label: string; rate: number; count: number; outstanding: number; provision: number; }
interface Report {
  period: { type: string; year: number; period: number; label: string; from: string; to: string; generated_at: string };
  portfolio: { new_loans_count: number; new_loans_value: number; principal_collected: number; interest_collected: number; total_collected: number; total_outstanding: number; active_loans: number; active_borrowers: number; write_offs_count: number; write_offs_value: number };
  classification: ClassRow[];
  par: { amount_at_risk: number; ratio: number };
  provisioning: { total_required: number };
  demographics: { male: number; female: number; unknown: number };
  financials: { total_income: number; total_expense: number; net_income: number; total_assets: number; total_liabilities: number; total_equity: number };
}

const CURRENT_YEAR = new Date().getFullYear();

const RegulatorReports = () => {
  const [periodType, setPeriodType] = useState<"quarter" | "half" | "annual">("quarter");
  const [year, setYear] = useState(CURRENT_YEAR);
  const [period, setPeriod] = useState(1);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: "", message: "", type: "info" as any });

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const generate = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/reports/regulator/bot`, {
        params: { period_type: periodType, year, period },
        headers: authHeaders(),
      });
      setReport(res.data.data);
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Failed to generate report", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { generate(); /* eslint-disable-next-line */ }, []);

  const periodOptions = periodType === "quarter"
    ? [{ v: 1, l: "Q1 (Jan–Mar)" }, { v: 2, l: "Q2 (Apr–Jun)" }, { v: 3, l: "Q3 (Jul–Sep)" }, { v: 4, l: "Q4 (Oct–Dec)" }]
    : periodType === "half"
      ? [{ v: 1, l: "H1 (Jan–Jun)" }, { v: 2, l: "H2 (Jul–Dec)" }]
      : [{ v: 1, l: "Full Year" }];

  const exportRows = () => {
    if (!report) return [];
    return report.classification.map(c => ({
      Classification: c.label, "Provision Rate (%)": (c.rate * 100), Loans: c.count,
      "Outstanding (TZS)": c.outstanding, "Provision Required (TZS)": c.provision,
    }));
  };

  const handlePrint = () => {
    if (!report) return;
    const p = report.portfolio, f = report.financials;
    const classRows = report.classification.map(c => `<tr><td>${c.label}</td><td style="text-align:right">${(c.rate * 100).toFixed(0)}%</td><td style="text-align:right">${c.count}</td><td style="text-align:right">${fmt(c.outstanding)}</td><td style="text-align:right">${fmt(c.provision)}</td></tr>`).join("");
    const body = `
      <h2>BOT Microfinance Return — ${report.period.label}</h2>
      <p><strong>Period:</strong> ${report.period.from} to ${report.period.to}</p>
      <h3>Portfolio Summary</h3>
      <table>
        <tr><td>New loans disbursed</td><td style="text-align:right">${p.new_loans_count} (${fmt(p.new_loans_value)})</td></tr>
        <tr><td>Principal collected</td><td style="text-align:right">${fmt(p.principal_collected)}</td></tr>
        <tr><td>Interest collected</td><td style="text-align:right">${fmt(p.interest_collected)}</td></tr>
        <tr><td>Outstanding portfolio</td><td style="text-align:right">${fmt(p.total_outstanding)}</td></tr>
        <tr><td>Active loans / borrowers</td><td style="text-align:right">${p.active_loans} / ${p.active_borrowers}</td></tr>
        <tr><td>Write-offs</td><td style="text-align:right">${p.write_offs_count} (${fmt(p.write_offs_value)})</td></tr>
      </table>
      <h3>Loan Classification &amp; Provisioning</h3>
      <table><thead><tr><th>Classification</th><th style="text-align:right">Rate</th><th style="text-align:right">Loans</th><th style="text-align:right">Outstanding</th><th style="text-align:right">Provision</th></tr></thead><tbody>${classRows}
        <tr><td><strong>TOTAL PROVISION</strong></td><td></td><td></td><td></td><td style="text-align:right"><strong>${fmt(report.provisioning.total_required)}</strong></td></tr>
      </tbody></table>
      <p><strong>PAR (≥1 day):</strong> ${fmt(report.par.amount_at_risk)} (${report.par.ratio}%)</p>
      <h3>Financial Position</h3>
      <table>
        <tr><td>Total income</td><td style="text-align:right">${fmt(f.total_income)}</td></tr>
        <tr><td>Total expense</td><td style="text-align:right">${fmt(f.total_expense)}</td></tr>
        <tr><td>Net income</td><td style="text-align:right">${fmt(f.net_income)}</td></tr>
        <tr><td>Total assets</td><td style="text-align:right">${fmt(f.total_assets)}</td></tr>
        <tr><td>Total liabilities</td><td style="text-align:right">${fmt(f.total_liabilities)}</td></tr>
        <tr><td>Total equity</td><td style="text-align:right">${fmt(f.total_equity)}</td></tr>
      </table>`;
    printDocument("BOT Microfinance Return", body, report.period.label);
  };

  const stat = (label: string, value: string, sub?: string) => (
    <div className="rr-stat">
      <span className="rr-stat-label">{label}</span>
      <span className="rr-stat-value">{value}</span>
      {sub && <span className="rr-stat-sub">{sub}</span>}
    </div>
  );

  return (
    <div className="rr-page">
      <AlertModal isOpen={modal.isOpen} title={modal.title} message={modal.message} type={modal.type} onClose={() => setModal({ ...modal, isOpen: false })} />

      <div className="rr-card">
        <div className="rr-accent-bar" />
        <div className="rr-sticky-top">
          <div className="rr-header">
            <div>
              <h1>Regulator Reports (BOT)</h1>
              <p>Bank of Tanzania Tier-2 microfinance returns — quarterly, mid-annual and annual</p>
            </div>
            <ExportButtons getRows={exportRows} filename="bot-regulator-report" sheetName="BOT Return" onPrint={handlePrint} disabled={!report} />
          </div>

          <GetHelp
            title="How to use Regulator Reports (BOT)"
            intro="Generates Bank of Tanzania Tier-2 non-deposit-taking microfinance statutory returns for the period you choose. Figures are pulled live from the portfolio and the General Ledger — no manual entry."
            steps={[
              { title: "1. Choose the return type", text: "Select Quarterly (Q1–Q4), Mid-Annual (H1 or H2), or Annual." },
              { title: "2. Set the year and sub-period", text: "Pick the year and — for quarterly/half-year returns — the specific quarter or half.", example: "Q2 2026 = April 1 → June 30, 2026." },
              { title: "3. Generate", text: "Click Generate. The system computes portfolio activity, BOT loan classification, PAR, provisioning, borrower demographics, and income-statement/balance-sheet figures for the period." },
              { title: "4. Loan classification table", text: "Rows show each BOT aging band (Current, Especially Mentioned, Substandard, Doubtful, Loss) with loan counts, outstanding balances, provision rates, and required provisions." },
              { title: "5. PAR flag", text: "Portfolio at Risk (all loans ≥1 day overdue) as a percentage of the total portfolio. BOT triggers supervision at PAR30 > 10% — watch this number monthly." },
              { title: "6. Export / Print", text: "Use CSV / Excel to populate your BOT submission spreadsheet, or Print for a signed paper record." },
            ]}
            tip="Run this at the end of each quarter immediately after month-end provisioning and interest accrual have been posted, so the ledger figures it reads are complete."
          />

          <div className="rr-filters">
            <select value={periodType} onChange={e => { setPeriodType(e.target.value as any); setPeriod(1); }}>
              <option value="quarter">Quarterly</option>
              <option value="half">Mid-Annual (Half-Year)</option>
              <option value="annual">Annual</option>
            </select>
            {periodType !== "annual" && (
              <select value={period} onChange={e => setPeriod(Number(e.target.value))}>
                {periodOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            )}
            <select value={year} onChange={e => setYear(Number(e.target.value))}>
              {Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button className="rr-generate-btn" onClick={generate} disabled={loading}>{loading ? "Generating..." : "Generate"}</button>
          </div>
        </div>

        {loading ? (
          <div className="rr-empty">Loading...</div>
        ) : !report ? (
          <div className="rr-empty">Select a period and generate the report</div>
        ) : (
          <>
            <div className="rr-period-banner">{report.period.label} &nbsp;·&nbsp; {report.period.from} to {report.period.to}</div>

            <h3 className="rr-section-title">Portfolio Summary</h3>
            <div className="rr-stats-grid">
              {stat("New Loans Disbursed", String(report.portfolio.new_loans_count), fmt(report.portfolio.new_loans_value))}
              {stat("Outstanding Portfolio", fmt(report.portfolio.total_outstanding))}
              {stat("Active Loans", String(report.portfolio.active_loans), `${report.portfolio.active_borrowers} borrowers`)}
              {stat("Principal Collected", fmt(report.portfolio.principal_collected))}
              {stat("Interest Collected", fmt(report.portfolio.interest_collected))}
              {stat("Write-offs", String(report.portfolio.write_offs_count), fmt(report.portfolio.write_offs_value))}
            </div>

            <h3 className="rr-section-title">Loan Classification &amp; Provisioning (as of period end)</h3>
            <table>
              <thead><tr><th>Classification</th><th>Provision Rate</th><th>Loans</th><th>Outstanding</th><th>Provision Required</th></tr></thead>
              <tbody>
                {report.classification.map(c => (
                  <tr key={c.label}>
                    <td><span className={`rr-class-badge rr-class-${c.label.replace(/\s+/g, "-").toLowerCase()}`}>{c.label}</span></td>
                    <td>{(c.rate * 100).toFixed(0)}%</td>
                    <td>{c.count}</td>
                    <td>{fmt(c.outstanding)}</td>
                    <td>{fmt(c.provision)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={4}><strong>TOTAL PROVISION REQUIRED</strong></td><td><strong>{fmt(report.provisioning.total_required)}</strong></td></tr>
              </tfoot>
            </table>
            <div className="rr-par-flag">Portfolio at Risk (≥1 day overdue): <strong>{fmt(report.par.amount_at_risk)}</strong> &nbsp;=&nbsp; <strong>{report.par.ratio}%</strong> of portfolio</div>

            <div className="rr-two-col">
              <div>
                <h3 className="rr-section-title">Financial Position</h3>
                <table>
                  <tbody>
                    <tr><td>Total Income</td><td className="rr-num">{fmt(report.financials.total_income)}</td></tr>
                    <tr><td>Total Expense</td><td className="rr-num">{fmt(report.financials.total_expense)}</td></tr>
                    <tr><td><strong>Net Income</strong></td><td className="rr-num"><strong>{fmt(report.financials.net_income)}</strong></td></tr>
                    <tr><td>Total Assets</td><td className="rr-num">{fmt(report.financials.total_assets)}</td></tr>
                    <tr><td>Total Liabilities</td><td className="rr-num">{fmt(report.financials.total_liabilities)}</td></tr>
                    <tr><td>Total Equity</td><td className="rr-num">{fmt(report.financials.total_equity)}</td></tr>
                  </tbody>
                </table>
              </div>
              <div>
                <h3 className="rr-section-title">Borrower Demographics (active)</h3>
                <table>
                  <tbody>
                    <tr><td>Male borrowers</td><td className="rr-num">{report.demographics.male}</td></tr>
                    <tr><td>Female borrowers</td><td className="rr-num">{report.demographics.female}</td></tr>
                    <tr><td>Unspecified</td><td className="rr-num">{report.demographics.unknown}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rr-footnote">Generated {report.period.generated_at}. Figures derive from the loan portfolio and the double-entry ledger. Classification follows BOT non-deposit-taking microfinance bands (Current 1%, Especially Mentioned 5%, Substandard 25%, Doubtful 50%, Loss 100%).</div>
          </>
        )}
      </div>

      <style>{`
        .rr-page { flex: 1; min-height: 0; overflow-x: hidden; background: #f1f5f9; padding: 14px 18px 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .rr-card { max-width: 1900px; margin: 0 auto; background: white; border-radius: 20px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; position: relative; overflow: clip; }
        .rr-accent-bar { position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg, #102a43 0%, #1e5fae 45%, #e2bc8a 100%); }
        .rr-sticky-top { position: sticky; top: 0; z-index: 5; background: white; padding-bottom: 4px; }
        .rr-header { display: flex; justify-content: space-between; align-items: center; margin: 6px 0 18px; flex-wrap: wrap; gap: 16px; }
        .rr-header h1 { font-size: 22px; font-weight: 700; color: #102a43; margin: 0 0 4px; }
        .rr-header p { font-size: 13px; color: #64748b; margin: 0; }
        .rr-filters { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; }
        .rr-filters select { padding: 9px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; }
        .rr-generate-btn { background: #102a43; color: white; border: none; padding: 9px 22px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .rr-generate-btn:hover:not(:disabled) { background: #1e5fae; }
        .rr-generate-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .rr-period-banner { background: #f8f1de; color: #5c4a1f; border: 1px solid #e3d7b0; border-radius: 10px; padding: 10px 16px; font-size: 13px; font-weight: 700; margin-bottom: 18px; }
        .rr-section-title { font-size: 14px; font-weight: 700; color: #102a43; margin: 22px 0 10px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
        .rr-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
        .rr-stat { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 3px; }
        .rr-stat-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; }
        .rr-stat-value { font-size: 18px; font-weight: 800; color: #102a43; }
        .rr-stat-sub { font-size: 11.5px; color: #94a3b8; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 11px 10px; background: #f8fafc; color: #334155; font-size: 11.5px; font-weight: 700; border-bottom: 1px solid #e2e8f0; }
        td { padding: 11px 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b; }
        tfoot td { border-top: 2px solid #102a43; border-bottom: none; }
        .rr-num { text-align: right; font-weight: 600; }
        .rr-class-badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
        .rr-class-current { background: #ecfdf5; color: #059669; }
        .rr-class-especially-mentioned { background: #eff6ff; color: #1d4ed8; }
        .rr-class-substandard { background: #fffbeb; color: #d97706; }
        .rr-class-doubtful { background: #fff7ed; color: #ea580c; }
        .rr-class-loss { background: #fef2f2; color: #dc2626; }
        .rr-par-flag { margin-top: 12px; background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; border-radius: 10px; padding: 10px 16px; font-size: 13px; }
        .rr-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; }
        @media (max-width: 800px) { .rr-two-col { grid-template-columns: 1fr; } }
        .rr-footnote { margin-top: 22px; font-size: 11px; color: #94a3b8; font-style: italic; line-height: 1.5; border-top: 1px dashed #e2e8f0; padding-top: 14px; }
        .rr-empty { text-align: center; padding: 50px; color: #64748b; }
      `}</style>
    </div>
  );
};

export default RegulatorReports;
