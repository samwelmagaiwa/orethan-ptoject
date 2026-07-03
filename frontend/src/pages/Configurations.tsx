/**
 * Configurations — unified global admin settings page.
 *
 * Sections (tab-bar, matching accounting page design):
 *   1. Loan Policy      — rates, fees, PAYE/NSSF bands
 *   2. Access Control   — role gates for compliance, payroll, biometric
 *   3. Payroll GL       — default GL accounts for salary payment
 *   4. Biometric        — scanner quality, matching, retry limits
 *   5. System           — app name, currency, fiscal year, date format
 */
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import PageHeader from "../components/PageHeader";
import AlertModal from "../components/AlertModal";
import { setOrgSettings, dispatchOrgUpdate } from "../utils/orgSettings";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` });

type Tab = "loan" | "access" | "payroll_gl" | "biometric" | "system";

// ── shared role list ──────────────────────────────────────────────────────────
const ALL_ROLES = [
  { value: "admin",            label: "Admin",            icon: "🛡️" },
  { value: "loan_officer",     label: "Loan Officer",     icon: "📝" },
  { value: "loan_manager",     label: "Loan Manager",     icon: "📋" },
  { value: "general_manager",  label: "General Manager",  icon: "🏢" },
  { value: "managing_director",label: "Managing Director",icon: "👔" },
  { value: "finance_officer",  label: "Finance Officer",  icon: "💰" },
  { value: "cashier",          label: "Cashier",          icon: "🏦" },
];

// ── types ─────────────────────────────────────────────────────────────────────
interface LoanCfg {
  penalty_rate: string | number;
  default_interest_rate: string | number;
  default_processing_fee_rate: string | number;
  compliance_roles: string[];
  payroll_access_roles: string[];
  salary_bank_account_code: string;
  salary_cash_account_code: string;
  paye_payable_account_code: string;
  nssf_payable_account_code: string;
}

interface OrgCfg {
  company_name: string;
  company_branch: string;
  company_tagline: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_website: string;
  company_logo_url: string | null;
  company_registration_no: string;
  company_tin: string;
  currency_code: string;
  date_format: string;
  timezone: string;
  fiscal_year_start_month: number;
  brand_color: string;
}

interface BioCfg {
  min_quality_score: number;
  min_similarity_score: number;
  max_retry_attempts: number;
  required_for_disbursement: boolean;
  check_duplicates_on_enroll: boolean;
  allowed_roles: string;
  exception_roles: string;
  agent_websocket_url: string;
}

interface GlAccount { id: number; code: string; name: string; }

const DEFAULT_LOAN: LoanCfg = {
  penalty_rate: 4,
  default_interest_rate: 3,
  default_processing_fee_rate: 0,
  compliance_roles: ["admin", "general_manager", "managing_director"],
  payroll_access_roles: ["admin", "finance_officer", "general_manager", "managing_director"],
  salary_bank_account_code: "1020",
  salary_cash_account_code: "1010",
  paye_payable_account_code: "2210",
  nssf_payable_account_code: "2220",
};

const DEFAULT_ORG: OrgCfg = {
  company_name: "Microfinance Management System",
  company_branch: "",
  company_tagline: "",
  company_address: "",
  company_phone: "",
  company_email: "",
  company_website: "",
  company_logo_url: null,
  company_registration_no: "",
  company_tin: "",
  currency_code: "TZS",
  date_format: "d/m/Y",
  timezone: "Africa/Dar_es_Salaam",
  fiscal_year_start_month: 1,
  brand_color: "#1e5fae",
};

const DEFAULT_BIO: BioCfg = {
  min_quality_score: 60,
  min_similarity_score: 75,
  max_retry_attempts: 3,
  required_for_disbursement: true,
  check_duplicates_on_enroll: true,
  allowed_roles: "admin,finance_officer",
  exception_roles: "admin,managing_director",
  agent_websocket_url: "ws://localhost:9000",
};

// ── helpers ───────────────────────────────────────────────────────────────────
const RoleCheckGrid = ({
  value, onChange, disabled,
}: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) => (
  <div className="cfg-role-grid">
    {ALL_ROLES.map(r => {
      const checked = value.includes(r.value);
      return (
        <label
          key={r.value}
          className={`cfg-role-pill ${checked ? "cfg-role-pill--on" : ""} ${disabled ? "cfg-role-pill--disabled" : ""}`}
        >
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={e => onChange(
              e.target.checked ? [...value, r.value] : value.filter(v => v !== r.value)
            )}
          />
          <span>{r.icon}</span> {r.label}
        </label>
      );
    })}
  </div>
);

const RoleCommaGrid = ({
  value, onChange, disabled,
}: { value: string; onChange: (v: string) => void; disabled?: boolean }) => {
  const arr = value.split(",").map(s => s.trim()).filter(Boolean);
  return (
    <RoleCheckGrid
      value={arr}
      disabled={disabled}
      onChange={next => onChange(next.join(","))}
    />
  );
};

const Toggle = ({
  checked, onChange, disabled,
}: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
  <label className="cfg-toggle">
    <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
    <span className="cfg-toggle-track" />
  </label>
);

const NumField = ({
  label, hint, value, onChange, suffix = "", min = 0, max = 100, disabled,
}: { label: string; hint?: string; value: number | string; onChange: (v: string) => void; suffix?: string; min?: number; max?: number; disabled?: boolean }) => (
  <div className="cfg-field">
    <label className="cfg-field-label">{label}</label>
    <div className="cfg-field-inp-wrap">
      <input
        type="number" step="0.01" min={min} max={max}
        value={value} disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className="cfg-field-inp"
      />
      {suffix && <span className="cfg-field-suffix">{suffix}</span>}
    </div>
    {hint && <p className="cfg-field-hint">{hint}</p>}
  </div>
);

const SelectField = ({
  label, hint, value, onChange, options, disabled,
}: { label: string; hint?: string; value: string; onChange: (v: string) => void; options: GlAccount[]; disabled?: boolean }) => (
  <div className="cfg-field">
    <label className="cfg-field-label">{label}</label>
    <select className="cfg-field-sel" value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>
      {options.map(o => <option key={o.code} value={o.code}>{o.code} — {o.name}</option>)}
      {options.length === 0 && <option value={value}>{value}</option>}
    </select>
    {hint && <p className="cfg-field-hint">{hint}</p>}
  </div>
);

const SectionCard = ({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) => (
  <div className="cfg-section-card">
    <div className="cfg-section-hd">
      <span className="cfg-section-icon">{icon}</span>
      <h3 className="cfg-section-title">{title}</h3>
    </div>
    {children}
  </div>
);

// ── main component ────────────────────────────────────────────────────────────
export default function Configurations() {
  const [tab, setTab] = useState<Tab>("loan");
  const [loanCfg, setLoanCfg] = useState<LoanCfg>(DEFAULT_LOAN);
  const [bioCfg, setBioCfg]   = useState<BioCfg>(DEFAULT_BIO);
  const [orgCfg, setOrgCfg]   = useState<OrgCfg>(DEFAULT_ORG);
  const [glAccounts, setGlAccounts] = useState<GlAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [alert, setAlert] = useState<{ isOpen: boolean; title: string; message: string; type: any }>({ isOpen: false, title: "", message: "", type: "success" });
  const [dirty, setDirty] = useState<Record<Tab, boolean>>({ loan: false, access: false, payroll_gl: false, biometric: false, system: false });
  // Logo upload state
  const [logoFile, setLogoFile]       = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoDragging, setLogoDragging] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const toast = (msg: string, type: "success" | "error" = "success") =>
    setAlert({ isOpen: true, title: type === "success" ? "Saved" : "Error", message: msg, type });

  // ── load all configs on mount ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [loanRes, bioRes, acctRes] = await Promise.allSettled([
          axios.get(`${API}/loan-settings`, { headers: auth() }),
          axios.get(`${API}/biometric/config`, { headers: auth() }),
          axios.get(`${API}/payroll/payment-accounts`, { headers: auth() }),
        ]);
        if (loanRes.status === "fulfilled") {
          const d = loanRes.value.data.data;
          setLoanCfg({ ...DEFAULT_LOAN, ...d });
          setOrgCfg({ ...DEFAULT_ORG, ...d });
          if (d.company_logo_url) setLogoPreview(d.company_logo_url);
        }
        if (bioRes.status  === "fulfilled") {
          const bioData = { ...DEFAULT_BIO, ...bioRes.value.data.data };
          setBioCfg(bioData);
          localStorage.setItem("bio_agent_url", bioData.agent_websocket_url || "ws://localhost:9000");
        }
        if (acctRes.status === "fulfilled") setGlAccounts(acctRes.value.data.accounts || []);
      } finally { setLoading(false); }
    })();
  }, []);

  const markDirty = (t: Tab) => setDirty(d => ({ ...d, [t]: true }));

  const setL = (patch: Partial<LoanCfg>, t: Tab) => { setLoanCfg(c => ({ ...c, ...patch })); markDirty(t); };
  const setB = (patch: Partial<BioCfg>)           => { setBioCfg(c => ({ ...c, ...patch })); markDirty("biometric"); };
  const setO = (patch: Partial<OrgCfg>)           => { setOrgCfg(c => ({ ...c, ...patch })); markDirty("system"); };

  // ── logo file pick ────────────────────────────────────────────────────────
  const onLogoFile = (file: File) => {
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    markDirty("system");
  };

  // ── save ──────────────────────────────────────────────────────────────────
  const save = async () => {
    setSaving(true);
    const errors: string[] = [];
    try {
      // 1. Upload logo first if a new file was chosen
      let newLogoUrl = orgCfg.company_logo_url;
      if (logoFile) {
        const fd = new FormData();
        fd.append("logo", logoFile);
        const res = await axios.post(`${API}/loan-settings/logo`, fd, {
          headers: { ...auth(), "Content-Type": "multipart/form-data" },
        });
        newLogoUrl = res.data.data?.company_logo_url ?? newLogoUrl;
        setLogoFile(null);
        setLogoPreview(newLogoUrl);
      }

      // 2. All scalar settings — loan policy + access + payroll GL + org
      if (dirty.loan || dirty.access || dirty.payroll_gl || dirty.system) {
        await axios.put(`${API}/loan-settings`, {
          // Loan policy
          penalty_rate:                  loanCfg.penalty_rate,
          default_interest_rate:         loanCfg.default_interest_rate,
          default_processing_fee_rate:   loanCfg.default_processing_fee_rate,
          // Access control
          compliance_roles:              loanCfg.compliance_roles,
          payroll_access_roles:          loanCfg.payroll_access_roles,
          // Payroll GL
          salary_bank_account_code:      loanCfg.salary_bank_account_code,
          salary_cash_account_code:      loanCfg.salary_cash_account_code,
          paye_payable_account_code:     loanCfg.paye_payable_account_code,
          nssf_payable_account_code:     loanCfg.nssf_payable_account_code,
          // Organisation identity
          company_name:                  orgCfg.company_name,
          company_branch:                orgCfg.company_branch,
          company_tagline:               orgCfg.company_tagline,
          company_address:               orgCfg.company_address,
          company_phone:                 orgCfg.company_phone,
          company_email:                 orgCfg.company_email,
          company_website:               orgCfg.company_website,
          company_registration_no:       orgCfg.company_registration_no,
          company_tin:                   orgCfg.company_tin,
          // Display / regional
          currency_code:                 orgCfg.currency_code,
          date_format:                   orgCfg.date_format,
          timezone:                      orgCfg.timezone,
          fiscal_year_start_month:       orgCfg.fiscal_year_start_month,
          brand_color:                   orgCfg.brand_color,
        }, { headers: auth() });

        localStorage.setItem("compliance_roles",    JSON.stringify(loanCfg.compliance_roles));
        localStorage.setItem("payroll_access_roles", JSON.stringify(loanCfg.payroll_access_roles));
        // Persist org identity for receipts/print and fire update event
        setOrgSettings({ ...orgCfg, company_logo_url: newLogoUrl });
        dispatchOrgUpdate();
      }

      // 3. Biometric config
      if (dirty.biometric) {
        await axios.put(`${API}/biometric/config`, bioCfg, { headers: auth() });
        localStorage.setItem("bio_agent_url", bioCfg.agent_websocket_url || "ws://localhost:9000");
      }

      setDirty({ loan: false, access: false, payroll_gl: false, biometric: false, system: false });
      toast("All configurations saved successfully.");
    } catch (e: any) {
      errors.push(e?.response?.data?.message || String(e));
      toast(errors.join("; "), "error");
    } finally { setSaving(false); }
  };

  const hasDirty = Object.values(dirty).some(Boolean);

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "loan",       label: "Loan Policy",    icon: "📜" },
    { key: "access",     label: "Access Control", icon: "🔐" },
    { key: "payroll_gl", label: "Payroll GL",     icon: "🏦" },
    { key: "biometric",  label: "Biometric",      icon: "🔏" },
    { key: "system",     label: "Organisation",   icon: "🏢" },
  ];

  if (loading) return (
    <div className="cfg-page">
      <PageHeader icon="⚙️" title="Configurations" subtitle="Global system settings" />
      <div className="cfg-loading"><div className="cfg-spinner" /><p>Loading configurations…</p></div>
    </div>
  );

  return (
    <div className="cfg-page">
      <AlertModal isOpen={alert.isOpen} title={alert.title} message={alert.message} type={alert.type}
        onClose={() => setAlert(a => ({ ...a, isOpen: false }))} />

      <PageHeader
        icon="⚙️"
        title="Configurations"
        subtitle="Global system settings — loan policy, access control, payroll GL, biometric & system"
        tabs={TABS}
        activeTab={tab}
        onTabChange={t => setTab(t as Tab)}
      >
        {hasDirty && (
          <div className="cfg-unsaved-badge">● Unsaved changes</div>
        )}
        <button className="cfg-save-btn" onClick={save} disabled={saving || !hasDirty}>
          {saving ? "Saving…" : "💾 Save Changes"}
        </button>
      </PageHeader>

      <div className="cfg-body">

        {/* ══ LOAN POLICY ═══════════════════════════════════════════════════ */}
        {tab === "loan" && (
          <div className="cfg-tab-content">
            <SectionCard icon="📊" title="Interest & Fee Rates">
              <div className="cfg-field-grid cfg-field-grid--3">
                <NumField
                  label="Default Interest Rate" suffix="% / month"
                  hint="Applied to all new loans unless overridden per loan product."
                  value={loanCfg.default_interest_rate}
                  onChange={v => setL({ default_interest_rate: v }, "loan")}
                />
                <NumField
                  label="Late Payment Penalty Rate" suffix="% / month"
                  hint="Charged on overdue principal balance from day after due date."
                  value={loanCfg.penalty_rate}
                  onChange={v => setL({ penalty_rate: v }, "loan")}
                />
                <NumField
                  label="Processing Fee Rate" suffix="% of principal"
                  hint="One-time fee deducted at disbursement. Set to 0 to disable."
                  value={loanCfg.default_processing_fee_rate}
                  onChange={v => setL({ default_processing_fee_rate: v }, "loan")}
                />
              </div>
            </SectionCard>

            <SectionCard icon="📋" title="Tanzania Statutory Rates (reference)">
              <div className="cfg-info-grid">
                {[
                  { label: "NSSF Employee Contribution", value: "10% of gross salary" },
                  { label: "NSSF Employer Contribution", value: "10% of gross salary" },
                  { label: "PAYE Band 1 (≤ 270,000)",    value: "0%" },
                  { label: "PAYE Band 2 (270k – 520k)",  value: "9%" },
                  { label: "PAYE Band 3 (520k – 760k)",  value: "20%" },
                  { label: "PAYE Band 4 (760k – 1M)",    value: "25%" },
                  { label: "PAYE Band 5 (> 1,000,000)",  value: "30%" },
                  { label: "NHIF (≤ 100,000)",            value: "TZS 1,500" },
                  { label: "NHIF (100k – 200k)",          value: "TZS 2,500" },
                  { label: "NHIF (> 500k)",               value: "TZS 7,000+" },
                ].map(r => (
                  <div key={r.label} className="cfg-info-row">
                    <span className="cfg-info-label">{r.label}</span>
                    <span className="cfg-info-val">{r.value}</span>
                  </div>
                ))}
              </div>
              <p className="cfg-info-note">ℹ️ These statutory rates are calculated automatically by the payroll engine. The bands above are for reference only and cannot be edited here.</p>
            </SectionCard>
          </div>
        )}

        {/* ══ ACCESS CONTROL ════════════════════════════════════════════════ */}
        {tab === "access" && (
          <div className="cfg-tab-content">
            <SectionCard icon="🔒" title="Compliance & Regulator Reports">
              <p className="cfg-section-desc">Roles that can view BOT regulator reports, loan lifecycle, and write-off records.</p>
              <RoleCheckGrid
                value={loanCfg.compliance_roles}
                onChange={v => setL({ compliance_roles: v }, "access")}
              />
            </SectionCard>

            <SectionCard icon="💼" title="Payroll Management">
              <p className="cfg-section-desc">Roles that can create, approve, post and pay salary runs. Employees outside this list see only their own salary slip.</p>
              <RoleCheckGrid
                value={loanCfg.payroll_access_roles}
                onChange={v => setL({ payroll_access_roles: v }, "access")}
              />
            </SectionCard>

            <SectionCard icon="👆" title="Biometric Scanner Operators">
              <p className="cfg-section-desc">Roles allowed to operate the fingerprint scanner during loan disbursement.</p>
              <RoleCommaGrid
                value={bioCfg.allowed_roles}
                onChange={v => setB({ allowed_roles: v })}
              />
            </SectionCard>

            <SectionCard icon="🚨" title="Biometric Exception Authorizers">
              <p className="cfg-section-desc">Roles allowed to authorize a biometric exception (bypass when scanner fails or person cannot scan).</p>
              <RoleCommaGrid
                value={bioCfg.exception_roles}
                onChange={v => setB({ exception_roles: v })}
              />
            </SectionCard>
          </div>
        )}

        {/* ══ PAYROLL GL ACCOUNTS ═══════════════════════════════════════════ */}
        {tab === "payroll_gl" && (
          <div className="cfg-tab-content">
            <SectionCard icon="💳" title="Default Salary Payment Accounts">
              <p className="cfg-section-desc">
                These accounts are pre-filled in the payment modal when processing payroll.
                The cashier can override at the time of payment. The journal entry will be:
                <strong> Dr 2200 Accrued Salaries Payable / Cr Selected Account</strong>.
              </p>
              <div className="cfg-field-grid cfg-field-grid--2">
                <SelectField
                  label="Default Bank Transfer Account"
                  hint="Pre-filled when cashier selects 'Bank Transfer' payment method."
                  value={loanCfg.salary_bank_account_code}
                  options={glAccounts}
                  onChange={v => setL({ salary_bank_account_code: v }, "payroll_gl")}
                />
                <SelectField
                  label="Default Cash Payment Account"
                  hint="Pre-filled when cashier selects 'Cash' payment method."
                  value={loanCfg.salary_cash_account_code}
                  options={glAccounts}
                  onChange={v => setL({ salary_cash_account_code: v }, "payroll_gl")}
                />
              </div>
            </SectionCard>

            <SectionCard icon="🧾" title="Statutory Deduction Payable Accounts">
              <p className="cfg-section-desc">
                GL liability accounts where PAYE and NSSF deductions are parked until remittance to TRA/NSSF.
              </p>
              <div className="cfg-field-grid cfg-field-grid--2">
                <SelectField
                  label="PAYE Tax Payable Account"
                  hint="Dr this account when remitting PAYE to Tanzania Revenue Authority."
                  value={loanCfg.paye_payable_account_code}
                  options={[...glAccounts, { id: 0, code: "2210", name: "PAYE Tax Payable" }, { id: 0, code: "2220", name: "NSSF Payable" }].filter((v, i, a) => a.findIndex(x => x.code === v.code) === i)}
                  onChange={v => setL({ paye_payable_account_code: v }, "payroll_gl")}
                />
                <SelectField
                  label="NSSF Contributions Payable Account"
                  hint="Dr this account when remitting NSSF contributions to the fund."
                  value={loanCfg.nssf_payable_account_code}
                  options={[...glAccounts, { id: 0, code: "2210", name: "PAYE Tax Payable" }, { id: 0, code: "2220", name: "NSSF Payable" }].filter((v, i, a) => a.findIndex(x => x.code === v.code) === i)}
                  onChange={v => setL({ nssf_payable_account_code: v }, "payroll_gl")}
                />
              </div>
            </SectionCard>

            <SectionCard icon="📒" title="Journal Posting Preview">
              <div className="cfg-je-preview">
                <div className="cfg-je-row cfg-je-row--hd"><span>Account</span><span>Debit</span><span>Credit</span></div>
                <div className="cfg-je-row cfg-je-row--event"><span style={{ gridColumn: "1/-1" }}>📋 EVENT 1 — Post Payroll (approve → posted)</span></div>
                <div className="cfg-je-row"><span>5010 — Salaries Expense</span><span className="cfg-je-dr">Gross Salary</span><span>—</span></div>
                <div className="cfg-je-row"><span>2200 — Accrued Salaries Payable</span><span>—</span><span className="cfg-je-cr">Gross Salary</span></div>
                <div className="cfg-je-row cfg-je-row--event"><span>💳 EVENT 2 — Pay Salaries (posted → paid)</span></div>
                <div className="cfg-je-row"><span>2200 — Accrued Salaries Payable</span><span className="cfg-je-dr">Net Salary</span><span>—</span></div>
                <div className="cfg-je-row"><span>{loanCfg.salary_bank_account_code} — {glAccounts.find(a => a.code === loanCfg.salary_bank_account_code)?.name ?? "Bank Account"}</span><span>—</span><span className="cfg-je-cr">Net Salary</span></div>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ══ BIOMETRIC ═════════════════════════════════════════════════════ */}
        {tab === "biometric" && (
          <div className="cfg-tab-content">
            <SectionCard icon="🎯" title="Quality & Matching Thresholds">
              <div className="cfg-field-grid cfg-field-grid--3">
                <NumField
                  label="Minimum Fingerprint Quality" suffix="%"
                  hint="Scans scoring below this are rejected immediately. Recommended: 60–75%."
                  value={bioCfg.min_quality_score} min={0} max={100}
                  onChange={v => setB({ min_quality_score: +v })}
                />
                <NumField
                  label="Minimum Similarity Score" suffix="%"
                  hint="Match threshold for 1:1 identity verification. Recommended: 75–85%."
                  value={bioCfg.min_similarity_score} min={0} max={100}
                  onChange={v => setB({ min_similarity_score: +v })}
                />
                <NumField
                  label="Maximum Retry Attempts" suffix="tries"
                  hint="Operator retries before an exception is required to proceed."
                  value={bioCfg.max_retry_attempts} min={1} max={10}
                  onChange={v => setB({ max_retry_attempts: +v })}
                />
              </div>
            </SectionCard>

            <SectionCard icon="⚡" title="Module Behaviour">
              <div className="cfg-toggle-list">
                <div className="cfg-toggle-row">
                  <div className="cfg-toggle-info">
                    <div className="cfg-toggle-label">Required for Loan Disbursement</div>
                    <div className="cfg-toggle-hint">If OFF, cashier can disburse without biometric verification. Not recommended in production.</div>
                  </div>
                  <Toggle checked={bioCfg.required_for_disbursement} onChange={v => setB({ required_for_disbursement: v })} />
                </div>
                <div className="cfg-toggle-row">
                  <div className="cfg-toggle-info">
                    <div className="cfg-toggle-label">Check Duplicates on Enrollment</div>
                    <div className="cfg-toggle-hint">Run a 1:N search before enrolling a new fingerprint. Prevents one person from registering under multiple identities.</div>
                  </div>
                  <Toggle checked={bioCfg.check_duplicates_on_enroll} onChange={v => setB({ check_duplicates_on_enroll: v })} />
                </div>
              </div>
            </SectionCard>

            <SectionCard icon="📡" title="Scanner Connection">
              <div className="cfg-field-grid cfg-field-grid--1" style={{ marginBottom: 16 }}>
                <div className="cfg-field">
                  <label className="cfg-field-label">Agent WebSocket URL</label>
                  <div className="cfg-field-inp-wrap">
                    <input
                      type="text"
                      className="cfg-field-inp cfg-mono"
                      value={bioCfg.agent_websocket_url}
                      placeholder="ws://localhost:9000"
                      onChange={e => setB({ agent_websocket_url: e.target.value })}
                    />
                  </div>
                  <p className="cfg-field-hint">
                    WebSocket address of the biometric agent running on the cashier's local PC.
                    Change only the port if your agent uses a non-default port (e.g. <code>ws://localhost:9001</code>).
                    Leave the host as <code>localhost</code> — the agent always runs on the operator's machine, not the server.
                  </p>
                </div>
              </div>
              <div className="cfg-info-grid">
                {[
                  { label: "Protocol",              value: "JSON over WebSocket" },
                  { label: "Fallback",              value: "Simulation mode (no hardware)" },
                  { label: "Encryption (template)", value: "AES-256-CBC, stored encrypted" },
                  { label: "Template exposure",     value: "Never in API responses (hidden field)" },
                  { label: "Audit log",             value: "Immutable — no edit/delete" },
                ].map(r => (
                  <div key={r.label} className="cfg-info-row">
                    <span className="cfg-info-label">{r.label}</span>
                    <span className="cfg-info-val cfg-mono">{r.value}</span>
                  </div>
                ))}
              </div>
              <p className="cfg-info-note">ℹ️ Protocol, encryption, and audit log settings are fixed security properties and cannot be changed from here.</p>
            </SectionCard>
          </div>
        )}

        {/* ══ ORGANISATION ══════════════════════════════════════════════════ */}
        {tab === "system" && (
          <div className="cfg-tab-content cfg-org-grid">

            {/* ── COL 1 : Logo + Print Preview ── */}
            <div className="cfg-org-col">

              <div className="cfg-section-card">
                <div className="cfg-section-hd">
                  <span className="cfg-section-icon">🖼️</span>
                  <h3 className="cfg-section-title">Brand Logo</h3>
                </div>
                <p className="cfg-section-desc">Appears on salary slips, loan receipts, repayment confirmations, and printed reports.</p>

                {/* Current logo preview */}
                <div className="cfg-logo-preview cfg-logo-preview--lg">
                  {logoPreview
                    ? <img src={logoPreview} alt="Logo preview" className="cfg-logo-img" />
                    : <div className="cfg-logo-placeholder">🏢<span>No logo set</span></div>
                  }
                </div>

                {/* Drop zone */}
                <div
                  className={`cfg-logo-dropzone ${logoDragging ? "cfg-logo-dropzone--over" : ""}`}
                  onClick={() => logoInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setLogoDragging(true); }}
                  onDragLeave={() => setLogoDragging(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setLogoDragging(false);
                    const f = e.dataTransfer.files[0];
                    if (f && f.type.startsWith("image/")) onLogoFile(f);
                  }}
                >
                  <div className="cfg-logo-dz-icon">📤</div>
                  <div className="cfg-logo-dz-text">
                    <strong>Click to browse</strong> or drag & drop<br />
                    <span>PNG, JPG, SVG, WebP — max 2 MB</span>
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    style={{ display: "none" }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) onLogoFile(f); }}
                  />
                </div>
                {(logoPreview || logoFile) && (
                  <button className="cfg-logo-remove-btn" style={{ marginTop: 8, width: "100%" }} onClick={() => {
                    setLogoFile(null);
                    setLogoPreview(null);
                    setO({ company_logo_url: null });
                    if (logoInputRef.current) logoInputRef.current.value = "";
                  }}>✕ Remove logo</button>
                )}
              </div>

              {/* Live receipt print-header preview */}
              <div className="cfg-section-card" style={{ padding: 0, overflow: "hidden" }}>
                <div className="cfg-logo-rp-label">Receipt / Print Header Preview</div>
                <div className="cfg-logo-rp-box">
                  {logoPreview && <img src={logoPreview} alt="" className="cfg-logo-rp-img" />}
                  <div className="cfg-logo-rp-name" style={{ color: orgCfg.brand_color }}>{orgCfg.company_name || "Company Name"}</div>
                  {orgCfg.company_tagline && <div className="cfg-logo-rp-tagline">{orgCfg.company_tagline}</div>}
                  {orgCfg.company_address && <div className="cfg-logo-rp-line">{orgCfg.company_address}</div>}
                  {(orgCfg.company_phone || orgCfg.company_email) && (
                    <div className="cfg-logo-rp-line">{[orgCfg.company_phone, orgCfg.company_email].filter(Boolean).join("  ·  ")}</div>
                  )}
                  {(orgCfg.company_registration_no || orgCfg.company_tin) && (
                    <div className="cfg-logo-rp-line" style={{ color: "#94a3b8", fontSize: 10 }}>
                      {[orgCfg.company_registration_no && `Reg: ${orgCfg.company_registration_no}`, orgCfg.company_tin && `TIN: ${orgCfg.company_tin}`].filter(Boolean).join("  ·  ")}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* ── COL 2 : Organisation Identity ── */}
            <div className="cfg-org-col">
              <div className="cfg-section-card" style={{ flex: 1 }}>
                <div className="cfg-section-hd">
                  <span className="cfg-section-icon">🏦</span>
                  <h3 className="cfg-section-title">Organisation Identity</h3>
                </div>
                <div className="cfg-field-grid" style={{ gap: 14 }}>
                  <div className="cfg-field">
                    <label className="cfg-field-label">Organisation Name *</label>
                    <input className="cfg-field-inp" value={orgCfg.company_name}
                      onChange={e => setO({ company_name: e.target.value })}
                      placeholder="e.g. Faida Microfinance Ltd" />
                    <p className="cfg-field-hint">Appears on all receipts, salary slips, emails, and reports.</p>
                  </div>
                  <div className="cfg-field">
                    <label className="cfg-field-label">Branch Name</label>
                    <input className="cfg-field-inp" value={orgCfg.company_branch}
                      onChange={e => setO({ company_branch: e.target.value })}
                      placeholder="e.g. Dar es Salaam Branch" />
                    <p className="cfg-field-hint">Pre-fills the Branch field on Branch Reports. Staff can still edit it per report.</p>
                  </div>
                  <div className="cfg-field">
                    <label className="cfg-field-label">Tagline / Slogan</label>
                    <input className="cfg-field-inp" value={orgCfg.company_tagline}
                      onChange={e => setO({ company_tagline: e.target.value })}
                      placeholder="e.g. Empowering Communities Through Finance" />
                  </div>
                  <div className="cfg-field">
                    <label className="cfg-field-label">Physical Address</label>
                    <textarea className="cfg-field-inp cfg-field-textarea" rows={2} value={orgCfg.company_address}
                      onChange={e => setO({ company_address: e.target.value })}
                      placeholder="e.g. Plot 12, Uhuru Street, Dar es Salaam" />
                  </div>
                  <div className="cfg-org-half-grid">
                    <div className="cfg-field">
                      <label className="cfg-field-label">Phone</label>
                      <input className="cfg-field-inp" value={orgCfg.company_phone}
                        onChange={e => setO({ company_phone: e.target.value })}
                        placeholder="+255 xxx xxx xxx" />
                    </div>
                    <div className="cfg-field">
                      <label className="cfg-field-label">Email</label>
                      <input className="cfg-field-inp" type="email" value={orgCfg.company_email}
                        onChange={e => setO({ company_email: e.target.value })}
                        placeholder="info@company.co.tz" />
                    </div>
                  </div>
                  <div className="cfg-field">
                    <label className="cfg-field-label">Website</label>
                    <input className="cfg-field-inp" type="url" value={orgCfg.company_website}
                      onChange={e => setO({ company_website: e.target.value })}
                      placeholder="https://www.company.co.tz" />
                  </div>
                  <div className="cfg-org-half-grid">
                    <div className="cfg-field">
                      <label className="cfg-field-label">Registration No.</label>
                      <input className="cfg-field-inp" value={orgCfg.company_registration_no}
                        onChange={e => setO({ company_registration_no: e.target.value })}
                        placeholder="e.g. 00000000-A" />
                      <p className="cfg-field-hint">BRELA number — printed on official documents.</p>
                    </div>
                    <div className="cfg-field">
                      <label className="cfg-field-label">TIN Number</label>
                      <input className="cfg-field-inp" value={orgCfg.company_tin}
                        onChange={e => setO({ company_tin: e.target.value })}
                        placeholder="e.g. 100-000-000" />
                      <p className="cfg-field-hint">TRA Tax Identification Number.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── COL 3 : Display/Regional + SMTP + Cache ── */}
            <div className="cfg-org-col">

              <div className="cfg-section-card">
                <div className="cfg-section-hd">
                  <span className="cfg-section-icon">🌍</span>
                  <h3 className="cfg-section-title">Display & Regional</h3>
                </div>
                <div className="cfg-field-grid" style={{ gap: 14 }}>
                  <div className="cfg-field">
                    <label className="cfg-field-label">Currency</label>
                    <select className="cfg-field-sel" value={orgCfg.currency_code} onChange={e => setO({ currency_code: e.target.value })}>
                      <option value="TZS">TZS — Tanzanian Shilling</option>
                      <option value="USD">USD — US Dollar</option>
                      <option value="KES">KES — Kenyan Shilling</option>
                      <option value="UGX">UGX — Ugandan Shilling</option>
                      <option value="RWF">RWF — Rwandan Franc</option>
                      <option value="ZAR">ZAR — South African Rand</option>
                    </select>
                    <p className="cfg-field-hint">Used on all financial displays and receipts.</p>
                  </div>
                  <div className="cfg-org-half-grid">
                    <div className="cfg-field">
                      <label className="cfg-field-label">Date Format</label>
                      <select className="cfg-field-sel" value={orgCfg.date_format} onChange={e => setO({ date_format: e.target.value })}>
                        <option value="d/m/Y">DD/MM/YYYY</option>
                        <option value="Y-m-d">YYYY-MM-DD</option>
                        <option value="d M Y">DD MMM YYYY</option>
                        <option value="d F Y">DD Month YYYY</option>
                        <option value="m/d/Y">MM/DD/YYYY</option>
                      </select>
                    </div>
                    <div className="cfg-field">
                      <label className="cfg-field-label">Fiscal Year Start</label>
                      <select className="cfg-field-sel" value={orgCfg.fiscal_year_start_month}
                        onChange={e => setO({ fiscal_year_start_month: +e.target.value })}>
                        {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => (
                          <option key={i+1} value={i+1}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="cfg-field">
                    <label className="cfg-field-label">Timezone</label>
                    <select className="cfg-field-sel" value={orgCfg.timezone} onChange={e => setO({ timezone: e.target.value })}>
                      <option value="Africa/Dar_es_Salaam">Africa/Dar_es_Salaam (UTC+3)</option>
                      <option value="Africa/Nairobi">Africa/Nairobi (UTC+3)</option>
                      <option value="Africa/Kampala">Africa/Kampala (UTC+3)</option>
                      <option value="Africa/Kigali">Africa/Kigali (UTC+2)</option>
                      <option value="Africa/Johannesburg">Africa/Johannesburg (UTC+2)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                  <div className="cfg-field">
                    <label className="cfg-field-label">Brand / Accent Colour</label>
                    <div className="cfg-color-row">
                      <input type="color" className="cfg-color-swatch" value={orgCfg.brand_color}
                        onChange={e => setO({ brand_color: e.target.value })} />
                      <input className="cfg-field-inp cfg-color-hex" value={orgCfg.brand_color}
                        onChange={e => setO({ brand_color: e.target.value })}
                        placeholder="#1e5fae" maxLength={20} />
                    </div>
                    <p className="cfg-field-hint">Used in printed headers and receipt accents.</p>
                  </div>
                </div>
              </div>

              <div className="cfg-section-card">
                <div className="cfg-section-hd">
                  <span className="cfg-section-icon">📧</span>
                  <h3 className="cfg-section-title">Email (SMTP)</h3>
                </div>
                <div className="cfg-info-grid">
                  {[
                    { label: "Mailer",       value: "SMTP (.env)" },
                    { label: "From Name",    value: "APP_NAME" },
                    { label: "From Email",   value: "MAIL_FROM_ADDRESS" },
                    { label: "Salary Slips", value: "Auto-sent on mark-paid" },
                    { label: "Encryption",   value: "TLS" },
                  ].map(r => (
                    <div key={r.label} className="cfg-info-row">
                      <span className="cfg-info-label">{r.label}</span>
                      <span className="cfg-info-val cfg-mono">{r.value}</span>
                    </div>
                  ))}
                </div>
                <p className="cfg-info-note">ℹ️ SMTP credentials live in <code>.env</code> — not editable here.</p>
              </div>

              <div className="cfg-section-card">
                <div className="cfg-section-hd">
                  <span className="cfg-section-icon">🗄️</span>
                  <h3 className="cfg-section-title">Cache & System</h3>
                </div>
                <div className="cfg-info-grid">
                  {[
                    { label: "Cache key",       value: "loan_settings.current" },
                    { label: "Cleared on save", value: "Yes — automatically" },
                    { label: "Logo storage",    value: "public/logos/" },
                    { label: "Client cache",    value: "org_settings (localStorage)" },
                  ].map(r => (
                    <div key={r.label} className="cfg-info-row">
                      <span className="cfg-info-label">{r.label}</span>
                      <span className="cfg-info-val cfg-mono">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        )}

      </div>

      <style>{`
        /* ── layout ── */
        .cfg-page { flex:1; min-height:0; background:#f1f5f9; display:flex; flex-direction:column; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
        .cfg-body { flex:1; overflow-y:auto; padding:20px 22px 48px; }
        .cfg-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; height:300px; gap:16px; color:#64748b; font-size:14px; }
        .cfg-spinner { width:36px; height:36px; border:3px solid #e2e8f0; border-top-color:#1e5fae; border-radius:50%; animation:cfg-spin .8s linear infinite; }
        @keyframes cfg-spin { to { transform:rotate(360deg); } }

        /* ── header actions ── */
        .cfg-save-btn { padding:8px 18px; border:none; border-radius:9px; background:#1e5fae; color:white; font-weight:800; font-size:13px; cursor:pointer; }
        .cfg-save-btn:disabled { opacity:.45; cursor:not-allowed; }
        .cfg-save-btn:not(:disabled):hover { background:#102a43; }
        .cfg-unsaved-badge { font-size:11px; font-weight:700; color:#d97706; background:#fef3c7; border:1px solid #fcd34d; border-radius:20px; padding:3px 10px; }

        /* ── tab content ── */
        .cfg-tab-content { display:flex; flex-direction:column; gap:16px; max-width:1100px; margin:0 auto; }
        /* ── org 3-col grid ── */
        .cfg-org-grid { display:grid !important; grid-template-columns:280px 1fr 280px; gap:16px; align-items:start; max-width:1200px; }
        .cfg-org-col { display:flex; flex-direction:column; gap:16px; }
        .cfg-org-half-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        @media (max-width:1024px) { .cfg-org-grid { grid-template-columns:1fr 1fr; } }
        @media (max-width:700px)  { .cfg-org-grid { grid-template-columns:1fr; } }

        /* ── section card ── */
        .cfg-section-card { background:white; border-radius:16px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.04); padding:20px 22px 22px; }
        .cfg-section-hd { display:flex; align-items:center; gap:10px; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid #f1f5f9; }
        .cfg-section-icon { font-size:20px; }
        .cfg-section-title { margin:0; font-size:14px; font-weight:800; color:#0f172a; }
        .cfg-section-desc { font-size:12px; color:#64748b; margin:0 0 14px; line-height:1.6; }

        /* ── field grid ── */
        .cfg-field-grid { display:grid; gap:18px; }
        .cfg-field-grid--2 { grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); }
        .cfg-field-grid--3 { grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); }
        .cfg-field { display:flex; flex-direction:column; gap:6px; }
        .cfg-field-label { font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:.04em; }
        .cfg-field-inp-wrap { position:relative; display:flex; align-items:center; }
        .cfg-field-inp { width:100%; padding:10px 44px 10px 12px; border:1.5px solid #e2e8f0; border-radius:10px; font-size:15px; font-weight:700; color:#0f172a; box-sizing:border-box; }
        .cfg-field-inp:focus { outline:none; border-color:#1e5fae; box-shadow:0 0 0 3px #1e5fae1a; }
        .cfg-field-inp:disabled { background:#f8fafc; color:#94a3b8; cursor:not-allowed; }
        .cfg-field-suffix { position:absolute; right:12px; font-size:12px; font-weight:700; color:#94a3b8; pointer-events:none; }
        .cfg-field-sel { width:100%; padding:10px 12px; border:1.5px solid #e2e8f0; border-radius:10px; font-size:13px; color:#0f172a; }
        .cfg-field-sel:focus { outline:none; border-color:#1e5fae; }
        .cfg-field-hint { font-size:11px; color:#94a3b8; margin:0; line-height:1.5; }

        /* ── role pills ── */
        .cfg-role-grid { display:flex; flex-wrap:wrap; gap:8px; }
        .cfg-role-pill { display:flex; align-items:center; gap:6px; padding:7px 13px; border:1.5px solid #e2e8f0; border-radius:10px; background:white; font-size:12px; font-weight:700; color:#64748b; cursor:pointer; transition:all .15s; user-select:none; }
        .cfg-role-pill input { display:none; }
        .cfg-role-pill--on { border-color:#1e5fae; background:#eff6ff; color:#1e5fae; }
        .cfg-role-pill--disabled { opacity:.5; cursor:not-allowed; }

        /* ── toggle ── */
        .cfg-toggle-list { display:flex; flex-direction:column; gap:0; }
        .cfg-toggle-row { display:flex; align-items:center; justify-content:space-between; gap:24px; padding:14px 0; border-bottom:1px solid #f1f5f9; }
        .cfg-toggle-row:last-child { border-bottom:none; }
        .cfg-toggle-info { flex:1; }
        .cfg-toggle-label { font-size:13px; font-weight:700; color:#0f172a; }
        .cfg-toggle-hint { font-size:11px; color:#94a3b8; margin-top:2px; line-height:1.5; }
        .cfg-toggle { position:relative; display:inline-block; width:44px; height:24px; flex-shrink:0; cursor:pointer; }
        .cfg-toggle input { opacity:0; width:0; height:0; }
        .cfg-toggle-track { position:absolute; inset:0; background:#e2e8f0; border-radius:24px; transition:background .2s; }
        .cfg-toggle input:checked + .cfg-toggle-track { background:#059669; }
        .cfg-toggle-track::after { content:""; position:absolute; left:3px; top:3px; width:18px; height:18px; background:white; border-radius:50%; transition:transform .2s; box-shadow:0 1px 3px rgba(0,0,0,0.2); }
        .cfg-toggle input:checked + .cfg-toggle-track::after { transform:translateX(20px); }

        /* ── info grid ── */
        .cfg-info-grid { display:flex; flex-direction:column; gap:0; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; margin-bottom:12px; }
        .cfg-info-row { display:flex; justify-content:space-between; align-items:center; padding:9px 14px; font-size:12px; border-bottom:1px solid #f1f5f9; }
        .cfg-info-row:last-child { border-bottom:none; }
        .cfg-info-row:nth-child(even) { background:#fafafa; }
        .cfg-info-label { color:#64748b; font-weight:600; }
        .cfg-info-val { color:#0f172a; font-weight:700; text-align:right; }
        .cfg-mono { font-family:monospace; font-size:11px; }
        .cfg-info-note { font-size:11px; color:#6b7280; font-style:italic; line-height:1.6; margin:0; }
        .cfg-info-note code { background:#f1f5f9; border-radius:4px; padding:1px 5px; font-size:11px; }

        /* ── logo upload ── */
        .cfg-logo-area { display:flex; align-items:flex-start; gap:20px; flex-wrap:wrap; margin-bottom:20px; }
        .cfg-logo-dropzone--full { flex:none; width:100%; }
        .cfg-logo-preview { width:140px; height:100px; border:2px dashed #e2e8f0; border-radius:12px; display:flex; align-items:center; justify-content:center; background:#f8fafc; flex-shrink:0; overflow:hidden; }
        .cfg-logo-preview--lg { width:100%; height:120px; margin-bottom:12px; }
        .cfg-logo-img { max-width:130px; max-height:90px; object-fit:contain; }
        .cfg-logo-placeholder { display:flex; flex-direction:column; align-items:center; gap:4px; color:#94a3b8; font-size:28px; }
        .cfg-logo-placeholder span { font-size:11px; font-weight:600; }
        .cfg-logo-dropzone { flex:1; min-width:200px; border:2px dashed #cbd5e1; border-radius:12px; padding:20px; display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; background:#f8fafc; transition:border-color .15s,background .15s; text-align:center; }
        .cfg-logo-dropzone:hover, .cfg-logo-dropzone--over { border-color:#1e5fae; background:#eff6ff; }
        .cfg-logo-dz-icon { font-size:28px; }
        .cfg-logo-dz-text { font-size:13px; color:#475569; line-height:1.6; }
        .cfg-logo-dz-text strong { color:#0f172a; }
        .cfg-logo-dz-text span { font-size:11px; color:#94a3b8; }
        .cfg-logo-remove-btn { align-self:flex-end; background:none; border:1.5px solid #fca5a5; color:#ef4444; border-radius:8px; padding:5px 12px; font-size:11px; font-weight:700; cursor:pointer; }
        .cfg-logo-remove-btn:hover { background:#fee2e2; }
        /* Receipt preview */
        .cfg-logo-receipt-preview { border:1.5px solid #e2e8f0; border-radius:10px; overflow:hidden; }
        .cfg-logo-rp-label { background:#f1f5f9; padding:7px 14px; font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:.04em; border-bottom:1px solid #e2e8f0; }
        .cfg-logo-rp-box { padding:16px; text-align:center; background:white; border-bottom:2px solid #e2e8f0; }
        .cfg-logo-rp-img { height:52px; object-fit:contain; margin-bottom:6px; display:block; margin-inline:auto; }
        .cfg-logo-rp-name { font-size:16px; font-weight:900; color:#102a43; }
        .cfg-logo-rp-tagline { font-size:11px; color:#64748b; margin-top:2px; }
        .cfg-logo-rp-line { font-size:11px; color:#475569; margin-top:3px; }
        /* Colour picker */
        .cfg-color-row { display:flex; align-items:center; gap:10px; }
        .cfg-color-swatch { width:44px; height:44px; border:2px solid #e2e8f0; border-radius:10px; cursor:pointer; padding:0; background:none; }
        .cfg-color-hex { flex:1; }
        /* Textarea */
        .cfg-field-textarea { resize:vertical; font-size:13px; }

        /* ── GL journal preview ── */
        .cfg-je-preview { border:1px solid #bbf7d0; border-radius:10px; overflow:hidden; background:#f0fdf4; }
        .cfg-je-row { display:grid; grid-template-columns:1fr 140px 140px; padding:8px 14px; font-size:12px; border-bottom:1px solid #dcfce7; color:#166534; }
        .cfg-je-row:last-child { border-bottom:none; }
        .cfg-je-row--hd { background:#dcfce7; font-weight:800; font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:#065f46; }
        .cfg-je-row--event { background:#f0fdf4; grid-template-columns:1fr; font-weight:700; color:#065f46; border-top:2px solid #bbf7d0; font-size:11px; }
        .cfg-je-dr { color:#1e5fae; font-weight:800; }
        .cfg-je-cr { color:#059669; font-weight:800; }
      `}</style>
    </div>
  );
}
