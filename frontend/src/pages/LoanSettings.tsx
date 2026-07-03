import { useEffect, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import AlertModal from "../components/AlertModal";
import GetHelp from "../components/GetHelp"
import type { HelpStep } from "../components/GetHelp";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

interface BranchPerms {
  submit:        string[];
  view_all:      string[];
  print:         string[];
  approve:       string[];
  delete:        string[];
  skip_approval: string[];
}

interface Settings {
  penalty_rate: string | number;
  default_interest_rate: string | number;
  default_processing_fee_rate: string | number;
  compliance_roles?: string[];
  payroll_access_roles?: string[];
  branch_report_roles?: string[];
  branch_report_permissions?: BranchPerms;
}

const DEFAULT_BR_PERMS: BranchPerms = {
  submit:        ["loan_officer","loan_manager","finance_officer","general_manager","managing_director","admin"],
  view_all:      ["loan_manager","general_manager","managing_director","admin"],
  print:         ["loan_officer","loan_manager","finance_officer","general_manager","managing_director","admin"],
  approve:       ["loan_manager","admin"],
  delete:        ["admin"],
  skip_approval: [],
};

const ALL_ROLES = [
  { value: "admin", label: "Admin" },
  { value: "loan_manager", label: "Loan Manager" },
  { value: "general_manager", label: "General Manager" },
  { value: "managing_director", label: "Managing Director" },
  { value: "finance_officer", label: "Finance Officer" },
];

// Branch Report can be granted to all staff including Loan Officers
const ALL_STAFF_ROLES = [
  { value: "loan_officer",      label: "Loan Officer" },
  { value: "loan_manager",      label: "Loan Manager" },
  { value: "finance_officer",   label: "Finance Officer" },
  { value: "general_manager",   label: "General Manager" },
  { value: "managing_director", label: "Managing Director" },
  { value: "admin",             label: "Admin" },
];

const LoanSettings = () => {
  const { t } = useTranslation("common");
  const [form, setForm] = useState<Settings>({ penalty_rate: "", default_interest_rate: "", default_processing_fee_rate: "", compliance_roles: ["admin", "general_manager", "managing_director"], payroll_access_roles: ["admin", "finance_officer", "general_manager", "managing_director"], branch_report_roles: ["loan_officer","loan_manager","finance_officer","general_manager","managing_director","admin"], branch_report_permissions: { ...DEFAULT_BR_PERMS } });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: "", message: "", type: "info" as any });

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/loan-settings`, { headers: authHeaders() });
      const d = res.data.data || {};
      setForm({
        ...d,
        branch_report_permissions: d.branch_report_permissions
          ? { ...DEFAULT_BR_PERMS, ...d.branch_report_permissions }
          : { ...DEFAULT_BR_PERMS },
      });
    } catch (err: any) {
      setModal({ isOpen: true, title: t("loanSettings.page.errorTitle"), message: err.response?.data?.message || t("loanSettings.page.errorLoad"), type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await axios.put(`${API_BASE}/loan-settings`, {
        penalty_rate: form.penalty_rate,
        default_interest_rate: form.default_interest_rate,
        default_processing_fee_rate: form.default_processing_fee_rate,
        compliance_roles: form.compliance_roles,
        payroll_access_roles: form.payroll_access_roles,
        branch_report_roles: form.branch_report_roles,
        branch_report_permissions: form.branch_report_permissions,
      }, { headers: authHeaders() });
      localStorage.setItem("compliance_roles", JSON.stringify(form.compliance_roles));
      localStorage.setItem("payroll_access_roles", JSON.stringify(form.payroll_access_roles));
      localStorage.setItem("branch_report_roles", JSON.stringify(form.branch_report_roles));
      localStorage.setItem("branch_report_permissions", JSON.stringify(form.branch_report_permissions));
      const d = res.data.data || {};
      setForm({
        ...d,
        branch_report_permissions: d.branch_report_permissions
          ? { ...DEFAULT_BR_PERMS, ...d.branch_report_permissions }
          : { ...DEFAULT_BR_PERMS },
      });
      setModal({ isOpen: true, title: t("loanSettings.page.savedTitle"), message: t("loanSettings.page.savedMsg"), type: "success" });
    } catch (err: any) {
      setModal({ isOpen: true, title: t("loanSettings.page.errorTitle"), message: err.response?.data?.message || t("loanSettings.page.errorSave"), type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof Settings, label: string, hint: string) => (
    <div className="ls-field">
      <label>{label}</label>
      <div className="ls-input-wrap">
        <input
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={form[key]}
          onChange={e => setForm({ ...form, [key]: e.target.value })}
        />
        <span className="ls-percent">%</span>
      </div>
      <p className="ls-hint">{hint}</p>
    </div>
  );

  return (
    <div className="ls-page">
      <AlertModal isOpen={modal.isOpen} title={modal.title} message={modal.message} type={modal.type} onClose={() => setModal({ ...modal, isOpen: false })} />

      <div className="ls-card">
        <div className="ls-accent-bar" />
        <div className="ls-sticky-top">
          <div className="ls-header">
            <div>
              <h1>{t("loanSettings.page.title")}</h1>
              <p>{t("loanSettings.page.subtitle")}</p>
            </div>
          </div>

          <GetHelp
            title={t("loanSettings.help.title")}
            intro={t("loanSettings.help.intro")}
            steps={t("loanSettings.help.steps", { returnObjects: true }) as HelpStep[]}
            tip={t("loanSettings.help.tip")}
          />
        </div>

        {loading ? (
          <div className="ls-empty">{t("loanSettings.page.loading")}</div>
        ) : (
          <>
            <div className="ls-grid">
              {field("penalty_rate", t("loanSettings.page.penaltyLabel"), t("loanSettings.page.penaltyHint"))}
              {field("default_interest_rate", t("loanSettings.page.interestLabel"), t("loanSettings.page.interestHint"))}
              {field("default_processing_fee_rate", t("loanSettings.page.processingLabel"), t("loanSettings.page.processingHint"))}
            </div>

            <div className="ls-section">
              <h2 className="ls-section-title">{t("loanSettings.page.complianceTitle")}</h2>
              <p className="ls-section-desc">{t("loanSettings.page.complianceDesc")}</p>
              <div className="ls-roles-grid">
                {ALL_ROLES.map(r => (
                  <label key={r.value} className="ls-role-check">
                    <input
                      type="checkbox"
                      checked={(form.compliance_roles || []).includes(r.value)}
                      onChange={e => {
                        const current = form.compliance_roles || [];
                        setForm({
                          ...form,
                          compliance_roles: e.target.checked
                            ? [...current, r.value]
                            : current.filter(v => v !== r.value),
                        });
                      }}
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="ls-section">
              <h2 className="ls-section-title">{t("loanSettings.page.payrollTitle")}</h2>
              <p className="ls-section-desc">{t("loanSettings.page.payrollDesc")}</p>
              <div className="ls-roles-grid">
                {ALL_ROLES.map(r => (
                  <label key={r.value} className="ls-role-check">
                    <input
                      type="checkbox"
                      checked={(form.payroll_access_roles || []).includes(r.value)}
                      onChange={e => {
                        const current = form.payroll_access_roles || [];
                        setForm({
                          ...form,
                          payroll_access_roles: e.target.checked
                            ? [...current, r.value]
                            : current.filter(v => v !== r.value),
                        });
                      }}
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="ls-section">
              <h2 className="ls-section-title">📋 {t("loanSettings.page.branchReportTitle")}</h2>
              <p className="ls-section-desc">{t("loanSettings.page.branchReportDesc")}</p>

              {/* Permissions Matrix */}
              <div className="ls-perm-table-wrap">
                <table className="ls-perm-table">
                  <thead>
                    <tr>
                      <th className="ls-perm-th ls-perm-action-col">Ruhusa / Kitendo</th>
                      {ALL_STAFF_ROLES.map(r => (
                        <th key={r.value} className="ls-perm-th ls-perm-role-col">{r.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Row 0: Navigation access (branch_report_roles) */}
                    {([
                      { key: "nav",           label: "🔑 Upatikanaji wa Menyu",        desc: "Kuona kiungo cha Ripoti ya Tawi kwenye sidebar",                           color: "#6366f1", field: "branch_report_roles" as const },
                      { key: "submit",        label: "📝 Kuwasilisha Ripoti",           desc: "Kuunda na kuwasilisha ripoti mpya",                                        color: "#059669", field: "submit"        as const },
                      { key: "skip_approval", label: "⚡ Ruka Idhini ya LM",           desc: "Ripoti ya jukumu hili inaidhinishwa moja kwa moja bila kupitia LM",        color: "#7c3aed", field: "skip_approval" as const },
                      { key: "view_all",      label: "👁 Kuona Ripoti Zote",            desc: "Kuona ripoti za matawi yote (si za kwake tu)",                            color: "#0ea5e9", field: "view_all"      as const },
                      { key: "print",         label: "🖨 Kuchapisha",                   desc: "Kuchapisha au kupakua ripoti",                                             color: "#f59e0b", field: "print"         as const },
                      { key: "approve",       label: "✅ Kuidhinisha (Saini ya LM)",    desc: "Kuidhinisha ripoti zilizo pending — LM hutumia nywila kama saini",         color: "#16a34a", field: "approve"       as const },
                      { key: "delete",        label: "🗑 Kufuta",                       desc: "Kufuta ripoti zilizopo kabisa kutoka mfumo",                               color: "#dc2626", field: "delete"        as const },
                    ] as const).map((row, ri) => (
                      <tr key={row.key} className={`ls-perm-row ${ri % 2 === 0 ? "ls-perm-row--even" : ""}`}>
                        <td className="ls-perm-action-td">
                          <div style={{ fontWeight: 700, fontSize: "12.5px", color: row.color }}>{row.label}</div>
                          <div style={{ fontSize: "10.5px", color: "#94a3b8", marginTop: 2 }}>{row.desc}</div>
                        </td>
                        {ALL_STAFF_ROLES.map(role => {
                          const isNav = row.field === "branch_report_roles";
                          const list: string[] = isNav
                            ? (form.branch_report_roles || [])
                            : ((form.branch_report_permissions || DEFAULT_BR_PERMS)[row.field as keyof BranchPerms] || []);
                          const checked = list.includes(role.value);
                          const toggle = (on: boolean) => {
                            if (isNav) {
                              const cur = form.branch_report_roles || [];
                              setForm({ ...form, branch_report_roles: on ? [...cur, role.value] : cur.filter(v => v !== role.value) });
                            } else {
                              const cur = { ...DEFAULT_BR_PERMS, ...(form.branch_report_permissions || {}) };
                              const key = row.field as keyof BranchPerms;
                              setForm({ ...form, branch_report_permissions: { ...cur, [key]: on ? [...cur[key], role.value] : cur[key].filter((v: string) => v !== role.value) } });
                            }
                          };
                          return (
                            <td key={role.value} className="ls-perm-cell">
                              <label className="ls-perm-check" style={{ "--chk-color": row.color } as React.CSSProperties}>
                                <input type="checkbox" checked={checked} onChange={e => toggle(e.target.checked)} />
                                <span className="ls-perm-tick">{checked ? "✓" : ""}</span>
                              </label>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(form.branch_report_roles || []).length === 0 && (
                <p style={{ fontSize: "11.5px", color: "#dc2626", marginTop: "12px", fontWeight: 600 }}>
                  ⚠ Hakuna jukumu lililochaguliwa kwa Upatikanaji wa Menyu — hakuna mtumiaji atakayeweza kufikia Ripoti ya Tawi.
                </p>
              )}
            </div>

            <button className="ls-save-btn" onClick={save} disabled={saving}>
              {saving ? t("loanSettings.page.saving") : t("loanSettings.page.saveBtn")}
            </button>
          </>
        )}
      </div>

      <style>{`
        .ls-page { flex: 1; min-height: 0; overflow-x: hidden; background: #f1f5f9; padding: 14px 18px 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .ls-card { max-width: 1100px; margin: 0 auto; background: white; border-radius: 20px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; position: relative; overflow: clip; }
        .ls-accent-bar { position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg, #102a43 0%, #1e5fae 45%, #e2bc8a 100%); }
        .ls-sticky-top { position: sticky; top: 0; z-index: 5; background: white; padding-bottom: 4px; }
        .ls-header { margin: 6px 0 28px; }
        .ls-header h1 { font-size: 22px; font-weight: 700; color: #102a43; margin: 0 0 6px; }
        .ls-header p { font-size: 13px; color: #64748b; margin: 0; max-width: 640px; line-height: 1.5; }
        .ls-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; margin-bottom: 26px; }
        @media (max-width: 900px) { .ls-grid { grid-template-columns: 1fr; } }
        .ls-field { display: flex; flex-direction: column; gap: 8px; }
        .ls-field label { font-size: 12px; font-weight: 700; color: #334155; }
        .ls-input-wrap { position: relative; display: flex; align-items: center; }
        .ls-input-wrap input { width: 100%; padding: 12px 36px 12px 14px; border: 1.5px solid #e2e8f0; border-radius: 12px; font-size: 16px; font-weight: 700; color: #102a43; box-sizing: border-box; }
        .ls-input-wrap input:focus { outline: none; border-color: #1e5fae; box-shadow: 0 0 0 3px rgba(30,95,174,0.12); }
        .ls-percent { position: absolute; right: 14px; font-size: 14px; font-weight: 700; color: #94a3b8; }
        .ls-hint { font-size: 11.5px; color: #94a3b8; margin: 0; line-height: 1.5; }
        .ls-save-btn { background: #102a43; color: white; border: none; padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; }
        .ls-save-btn:hover:not(:disabled) { background: #1e5fae; }
        .ls-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .ls-empty { text-align: center; padding: 40px; color: #64748b; }
        .ls-section { margin-bottom: 26px; padding-top: 22px; border-top: 1px solid #e2e8f0; }
        .ls-section-title { font-size: 15px; font-weight: 700; color: #102a43; margin: 0 0 6px; }
        .ls-section-desc { font-size: 12px; color: #64748b; margin: 0 0 14px; }
        .ls-roles-grid { display: flex; flex-wrap: wrap; gap: 12px; }
        .ls-role-check { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #334155; cursor: pointer; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 14px; }
        .ls-role-check input { accent-color: #1e5fae; width: 16px; height: 16px; cursor: pointer; }
        .ls-role-check--branch input { accent-color: #059669; }
        .ls-role-check--branch { border-color: #bbf7d0; background: #f0fdf4; color: #065f46; }

        /* Permissions matrix table */
        .ls-perm-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid #e2e8f0; margin-top: 8px; }
        .ls-perm-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        .ls-perm-th { padding: 10px 14px; background: #f1f5f9; font-weight: 700; font-size: 11.5px; color: #475569; text-align: center; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
        .ls-perm-th.ls-perm-action-col { text-align: left; min-width: 200px; }
        .ls-perm-role-col { min-width: 80px; }
        .ls-perm-row { border-bottom: 1px solid #f1f5f9; }
        .ls-perm-row--even { background: #fafbfc; }
        .ls-perm-row:last-child { border-bottom: none; }
        .ls-perm-action-td { padding: 10px 14px; vertical-align: top; }
        .ls-perm-cell { padding: 10px; text-align: center; vertical-align: middle; }
        .ls-perm-check { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; border: 2px solid #cbd5e1; cursor: pointer; background: #fff; transition: background .15s, border-color .15s; }
        .ls-perm-check:has(input:checked) { background: var(--chk-color, #1e5fae); border-color: var(--chk-color, #1e5fae); }
        .ls-perm-check input { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
        .ls-perm-tick { font-size: 13px; font-weight: 800; color: #fff; line-height: 1; user-select: none; pointer-events: none; }
      `}</style>
    </div>
  );
};

export default LoanSettings;

