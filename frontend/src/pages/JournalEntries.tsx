import { Fragment, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import AlertModal from "../components/AlertModal";
import ConfirmModal from "../components/ConfirmModal";
import ExportButtons from "../components/ExportButtons";
import GetHelp, { type HelpStep } from "../components/GetHelp";
import AccountingNav from "../components/AccountingNav";
import { printDocument } from "../utils/printDoc";
import { API_BASE } from "../lib/api";


const fmt = (v: any) => Number(v || 0).toLocaleString();

// Quick-entry templates for the most common MANUAL journal entries. Each picks
// two accounts by their Chart-of-Accounts code and the side each sits on;
// applying one fills the line editor so the operator only types the amount.
// (Loan disbursements/repayments are auto-posted elsewhere — these are for the
// day-to-day non-loan transactions: capital, rent, salaries, transfers, etc.)
const JE_TEMPLATES: { label: string; description: string; lines: { code: string; side: "debit" | "credit" }[] }[] = [
  { label: "Capital Injection", description: "Owner/shareholder capital deposited to bank", lines: [{ code: "1020", side: "debit" }, { code: "3010", side: "credit" }] },
  { label: "Pay Rent", description: "Office rent paid from bank", lines: [{ code: "5020", side: "debit" }, { code: "1020", side: "credit" }] },
  { label: "Pay Salaries", description: "Staff salaries paid from bank", lines: [{ code: "5010", side: "debit" }, { code: "1020", side: "credit" }] },
  { label: "Pay Utilities", description: "Electricity / water / internet paid from bank", lines: [{ code: "5030", side: "debit" }, { code: "1020", side: "credit" }] },
  { label: "Bank Charges", description: "Bank fees deducted by the bank", lines: [{ code: "5060", side: "debit" }, { code: "1020", side: "credit" }] },
  { label: "Cash → Bank", description: "Deposit cash on hand into the bank", lines: [{ code: "1020", side: "debit" }, { code: "1010", side: "credit" }] },
  { label: "Bank → Cash", description: "Withdraw cash from the bank", lines: [{ code: "1010", side: "debit" }, { code: "1020", side: "credit" }] },
  { label: "Record Other Income", description: "Miscellaneous income received in cash", lines: [{ code: "1010", side: "debit" }, { code: "4040", side: "credit" }] },
];

interface Line {
  id?: number;
  chart_of_account_id: number | "";
  debit: string;
  credit: string;
  description: string;
}

interface Entry {
  id: number;
  entry_number: string;
  entry_date: string;
  description: string;
  status: "posted" | "reversed";
  lines: { id: number; debit: number; credit: number; description?: string; account: { id: number; code: string; name: string } }[];
  reversalEntry?: { id: number; entry_number: string; entry_date: string } | null;
}

const JournalEntries = () => {
  const navigate = useNavigate();
  const { t } = useTranslation("accounting");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [accounts, setAccounts] = useState<{ id: number; code: string; name: string }[]>([]);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { chart_of_account_id: "", debit: "", credit: "", description: "" },
    { chart_of_account_id: "", debit: "", credit: "", description: "" },
  ]);
  const [modal, setModal] = useState({ isOpen: false, title: "", message: "", type: "info" as any });
  const [confirm, setConfirm] = useState({ isOpen: false, title: "", message: "", onConfirm: () => { }, type: "info" as any });

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const load = async () => {
    setLoading(true);
    try {
      const [entriesRes, accountsRes] = await Promise.all([
        axios.get(`${API_BASE}/accounting/journal-entries`, { headers: authHeaders() }),
        axios.get(`${API_BASE}/accounting/chart-of-accounts`, { params: { active_only: true }, headers: authHeaders() }),
      ]);
      setEntries(entriesRes.data.data?.data || []);
      setAccounts(accountsRes.data.data || []);
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Failed to load Journal Entries", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const exportRows = () => {
    const rows: Record<string, unknown>[] = [];
    entries.forEach(e => e.lines.forEach(l => rows.push({
      "Entry No.": e.entry_number, Date: e.entry_date, Status: e.status,
      "Entry Description": e.description, Account: `${l.account.code} — ${l.account.name}`,
      "Line Description": l.description || "", Debit: l.debit, Credit: l.credit,
    })));
    return rows;
  };

  const handlePrint = () => {
    const rowsHtml = entries.map(e => `
      <tr><td colspan="4" style="background:#f8fafc;font-weight:700">${e.entry_number} — ${e.entry_date} — ${e.description} (${e.status})</td></tr>
      ${e.lines.map(l => `<tr><td></td><td>${l.account.code} — ${l.account.name}</td><td style="text-align:right">${Number(l.debit) > 0 ? fmt(l.debit) : "—"}</td><td style="text-align:right">${Number(l.credit) > 0 ? fmt(l.credit) : "—"}</td></tr>`).join("")}
    `).join("");
    const body = `<table><thead><tr><th></th><th>Account</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
    printDocument("Journal Entries", body);
  };

  // A line counts only when it has an account AND exactly one side filled
  // (a debit OR a credit — never both, never neither). The XOR below excludes
  // both the "both sides on one line" mistake and empty rows.
  const validLines = lines.filter(l => l.chart_of_account_id && ((Number(l.debit) > 0) !== (Number(l.credit) > 0)));
  // Lines the operator wrongly put a debit AND a credit on (the common mistake).
  const bothSidesLines = lines.filter(l => l.chart_of_account_id && Number(l.debit) > 0 && Number(l.credit) > 0);
  const totalDebit = validLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = validLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const isBalanced = validLines.length >= 2 && bothSidesLines.length === 0 && totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.01;

  const resetForm = () => {
    setEntryDate(new Date().toISOString().slice(0, 10));
    setDescription("");
    setLines([
      { chart_of_account_id: "", debit: "", credit: "", description: "" },
      { chart_of_account_id: "", debit: "", credit: "", description: "" },
    ]);
  };

  const updateLine = (index: number, field: keyof Line, value: any) => {
    setLines(prev => prev.map((l, i) => {
      if (i !== index) return l;
      const next = { ...l, [field]: value };
      // One side per line: typing a debit clears the credit and vice versa, so a
      // single account line can never carry both (which would be meaningless).
      if (field === "debit" && Number(value) > 0) next.credit = "";
      if (field === "credit" && Number(value) > 0) next.debit = "";
      return next;
    }));
  };

  // Fill the line editor from a quick template (accounts + sides preset).
  const applyTemplate = (tpl: typeof JE_TEMPLATES[number]) => {
    const byCode = (code: string) => accounts.find(a => a.code === code);
    const missing = tpl.lines.filter(l => !byCode(l.code));
    if (missing.length) {
      setModal({ isOpen: true, title: "Account Missing", message: "This template needs accounts that aren't in your Chart of Accounts. Add them first.", type: "warning" });
      return;
    }
    setLines(tpl.lines.map(l => ({
      chart_of_account_id: byCode(l.code)!.id,
      debit: "",
      credit: "",
      description: "",
    })));
    if (!description.trim()) setDescription(tpl.description);
  };

  const submit = async () => {
    if (!description.trim()) {
      setModal({ isOpen: true, title: "Missing Information", message: "Please enter a description for this entry.", type: "warning" });
      return;
    }
    if (bothSidesLines.length > 0) {
      setModal({ isOpen: true, title: "One Side Per Line", message: "A line can have EITHER a debit OR a credit — not both on the same account. Put the debit on one account and the credit on a different account.", type: "warning" });
      return;
    }
    if (validLines.length < 2) {
      setModal({ isOpen: true, title: "Need At Least 2 Lines", message: "Double-entry needs at least two lines: one account to DEBIT and a different account to CREDIT. Pick an account on each line and enter an amount on one side only.", type: "warning" });
      return;
    }
    if (!isBalanced) {
      setModal({ isOpen: true, title: "Not Balanced", message: `Total debit (${fmt(totalDebit)}) must equal total credit (${fmt(totalCredit)}). Adjust the amounts so both sides match.`, type: "warning" });
      return;
    }
    try {
      await axios.post(`${API_BASE}/accounting/journal-entries`, {
        entry_date: entryDate,
        description,
        lines: validLines.map(l => ({
          chart_of_account_id: l.chart_of_account_id,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description || "",
        })),
      }, { headers: authHeaders() });
      setShowModal(false);
      resetForm();
      load();
      setModal({ isOpen: true, title: "Posted", message: "Journal Entry posted successfully", type: "success" });
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Failed to post entry", type: "error" });
    }
  };

  // Loan-loss provisioning: preview the required adjustment, then post it.
  const runProvisioning = async () => {
    try {
      const res = await axios.get(`${API_BASE}/accounting/provisioning/preview`, { headers: authHeaders() });
      const p = res.data.data;
      if (Math.abs(p.adjustment) < 0.01) {
        setModal({ isOpen: true, title: "Provisioning Up To Date", message: `Required provision (${fmt(p.required_provision)}) already matches the allowance — nothing to post.`, type: "info" });
        return;
      }
      const verb = p.adjustment > 0 ? "charge" : "release";
      setConfirm({
        isOpen: true,
        title: "Post Loan-Loss Provision",
        message: `Required provision: ${fmt(p.required_provision)} | Current allowance: ${fmt(p.current_allowance)}. This will ${verb} ${fmt(Math.abs(p.adjustment))} to the General Ledger. Continue?`,
        type: "info",
        onConfirm: async () => {
          setConfirm(prev => ({ ...prev, isOpen: false }));
          try {
            const r = await axios.post(`${API_BASE}/accounting/provisioning/run`, {}, { headers: authHeaders() });
            load();
            setModal({ isOpen: true, title: "Provision Posted", message: r.data.message || "Provision posted", type: "success" });
          } catch (err: any) {
            setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Provisioning failed", type: "error" });
          }
        },
      });
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Failed to preview provisioning", type: "error" });
    }
  };

  // Daily interest accrual: preview the day's accrual, then post it.
  const runAccrual = async () => {
    try {
      const res = await axios.get(`${API_BASE}/accounting/interest-accrual/preview`, { headers: authHeaders() });
      const p = res.data.data;
      if (!p.loan_count || p.total_interest < 0.01) {
        setModal({ isOpen: true, title: "Nothing to Accrue", message: `No interest to accrue for ${p.date}${p.already_accrued_loans ? ` (${p.already_accrued_loans} loan(s) already accrued today)` : ""}.`, type: "info" });
        return;
      }
      setConfirm({
        isOpen: true,
        title: "Post Daily Interest Accrual",
        message: `Accrue ${fmt(p.total_interest)} of interest across ${p.loan_count} loan(s) for ${p.date}? Posts Dr Interest Receivable / Cr Interest Income.`,
        type: "info",
        onConfirm: async () => {
          setConfirm(prev => ({ ...prev, isOpen: false }));
          try {
            const r = await axios.post(`${API_BASE}/accounting/interest-accrual/run`, {}, { headers: authHeaders() });
            load();
            setModal({ isOpen: true, title: "Interest Accrued", message: r.data.message || "Interest accrued", type: "success" });
          } catch (err: any) {
            setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Accrual failed", type: "error" });
          }
        },
      });
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Failed to preview accrual", type: "error" });
    }
  };

  const viewReversal = (reversalEntryId: number) => {
    const el = document.getElementById(`je-row-${reversalEntryId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightId(reversalEntryId);
      setTimeout(() => setHighlightId(null), 2500);
    } else {
      setModal({ isOpen: true, title: "Not on This Page", message: "The reversal entry exists but isn't in the currently loaded list — search by its entry number to find it.", type: "info" });
    }
  };

  const reverseEntry = (entry: Entry) => {
    setConfirm({
      isOpen: true,
      title: "Reverse Journal Entry",
      message: `Reverse ${entry.entry_number}? This posts a mirror-image entry and marks the original as reversed.`,
      type: "danger",
      onConfirm: async () => {
        setConfirm(prev => ({ ...prev, isOpen: false }));
        try {
          await axios.post(`${API_BASE}/accounting/journal-entries/${entry.id}/reverse`, {}, { headers: authHeaders() });
          load();
        } catch (err: any) {
          setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Reversal failed", type: "error" });
        }
      },
    });
  };

  return (
    <div className="je-page">
      <AlertModal isOpen={modal.isOpen} title={modal.title} message={modal.message} type={modal.type} onClose={() => setModal({ ...modal, isOpen: false })} />
      <ConfirmModal isOpen={confirm.isOpen} title={confirm.title} message={confirm.message} type={confirm.type} onConfirm={confirm.onConfirm} onCancel={() => setConfirm({ ...confirm, isOpen: false })} />

      <AccountingNav />

      <div className="je-card">
        <div className="je-accent-bar" />
        <div className="je-sticky-top" style={{ top: 44 }}>
          <GetHelp
            title={t("journal.help.title")}
            intro={t("journal.help.intro")}
            steps={t("journal.help.steps", { returnObjects: true }) as HelpStep[]}
            tip={t("journal.help.tip")}
            actions={
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <ExportButtons getRows={exportRows} filename="journal-entries" sheetName="Journal Entries" onPrint={handlePrint} disabled={!entries.length} />
                <button className="je-prov-btn" onClick={runAccrual} title="Post today's interest accrual">Accrue</button>
                <button className="je-prov-btn" onClick={runProvisioning} title="Post the loan-loss provision">Provision</button>
                <button className="je-add-btn" onClick={() => { resetForm(); setShowModal(true); }}>{t("journal.newEntry")}</button>
              </div>
            }
          />
        </div>

        {loading ? (
          <div className="je-empty">{t("common.loading")}</div>
        ) : (
          <div className="je-table-scroll">
            <table>
              <thead>
                <tr><th>{t("common.entryNo")}</th><th>{t("common.date")}</th><th>{t("common.description")}</th><th>{t("common.debit")}</th><th>{t("common.credit")}</th><th>{t("common.status")}</th><th></th></tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr><td colSpan={7} className="je-empty">{t("journal.noEntries")}</td></tr>
                ) : entries.map(entry => {
                  const debit = entry.lines.reduce((s, l) => s + Number(l.debit), 0);
                  const credit = entry.lines.reduce((s, l) => s + Number(l.credit), 0);
                  return (
                    <Fragment key={entry.id}>
                      <tr id={`je-row-${entry.id}`} className={`je-row ${highlightId === entry.id ? "je-row--highlight" : ""}`} onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>
                        <td className="je-number">{entry.entry_number}</td>
                        <td>{entry.entry_date}</td>
                        <td>{entry.description}</td>
                        <td>{fmt(debit)}</td>
                        <td>{fmt(credit)}</td>
                        <td>
                          <span className={`je-status ${entry.status}`}>{entry.status}</span>
                          {entry.status === "reversed" && entry.reversalEntry && (
                            <button className="je-view-reversal-btn" onClick={(e) => { e.stopPropagation(); viewReversal(entry.reversalEntry!.id); }} title={`Jump to ${entry.reversalEntry.entry_number}`}>
                              {t("journal.viewReversal")}
                            </button>
                          )}
                        </td>
                        <td>{entry.status === "posted" && <button className="je-reverse-btn" onClick={(e) => { e.stopPropagation(); reverseEntry(entry); }}>{t("journal.reverse")}</button>}</td>
                      </tr>
                      {expanded === entry.id && (
                        <tr className="je-detail-row">
                          <td colSpan={7}>
                            <table className="je-lines-table">
                              <thead><tr><th>{t("common.account")}</th><th>{t("common.description")}</th><th>{t("common.debit")}</th><th>{t("common.credit")}</th></tr></thead>
                              <tbody>
                                {entry.lines.map(line => (
                                  <tr key={line.id}>
                                    <td className="je-account-link" onClick={() => navigate(`/accounting/general-ledger?account_id=${line.account.id}`)}>{line.account.code} — {line.account.name}</td>
                                    <td>{line.description || "—"}</td>
                                    <td>{Number(line.debit) > 0 ? fmt(line.debit) : "—"}</td>
                                    <td>{Number(line.credit) > 0 ? fmt(line.credit) : "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="je-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="je-modal-content" onClick={e => e.stopPropagation()}>
            <h2>{t("journal.newEntryTitle")}</h2>

            <div className="je-guide">
              <strong>{t("journal.guideTitle")}</strong>
              <ol>
                <li>{t("journal.guideStep1")}</li>
                <li>{t("journal.guideStep2")}</li>
                <li>{t("journal.guideStep3")}</li>
              </ol>
              <div className="je-guide-eg">{t("journal.guideExample")}</div>
            </div>

            <div className="je-templates">
              <span className="je-templates-label">{t("journal.quickTemplates")}</span>
              {JE_TEMPLATES.map(tpl => (
                <button key={tpl.label} type="button" className="je-template-btn" title={tpl.description} onClick={() => applyTemplate(tpl)}>
                  {tpl.label}
                </button>
              ))}
            </div>

            <div className="je-modal-form">
              <table className="je-header-fields">
                <tbody>
                  <tr>
                    <td><strong>{t("common.date")}</strong><br /><input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} /></td>
                    <td colSpan={2}><strong>{t("common.description")}</strong><br /><input type="text" placeholder={t("journal.descExample")} value={description} onChange={e => setDescription(e.target.value)} /></td>
                  </tr>
                </tbody>
              </table>

              <table className="je-line-editor">
                <thead><tr><th>{t("common.account")}</th><th>{t("common.debit")}</th><th>{t("common.credit")}</th><th>{t("common.description")}</th><th></th></tr></thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i}>
                      <td>
                        <select value={line.chart_of_account_id} onChange={e => updateLine(i, "chart_of_account_id", Number(e.target.value))}>
                          <option value="">{t("bank.selectAccount")}</option>
                          {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                        </select>
                      </td>
                      <td><input type="number" value={line.debit} onChange={e => updateLine(i, "debit", e.target.value)} /></td>
                      <td><input type="number" value={line.credit} onChange={e => updateLine(i, "credit", e.target.value)} /></td>
                      <td><input type="text" value={line.description} onChange={e => updateLine(i, "description", e.target.value)} /></td>
                      <td>
                        {lines.length > 2 && <button className="je-remove-line-btn" onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}>Ã--</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button className="je-add-line-btn" onClick={() => setLines(prev => [...prev, { chart_of_account_id: "", debit: "", credit: "", description: "" }])}>{t("journal.addLine")}</button>

              <div className={`je-balance-check ${isBalanced ? "ok" : "off"}`}>
                {t("common.debit")}: {fmt(totalDebit)} &nbsp;|&nbsp; {t("common.credit")}: {fmt(totalCredit)} &nbsp;
                {isBalanced ? t("journal.balancedReady") :
                  bothSidesLines.length > 0 ? t("journal.errBothSides") :
                    validLines.length < 2 ? t("journal.errNeedTwo") :
                      t("journal.errNotBalanced")}
              </div>
            </div>
            <div className="je-modal-actions">
              <button className="je-cancel-btn" onClick={() => setShowModal(false)}>{t("common.cancel")}</button>
              <button className="je-save-btn" onClick={submit} disabled={!isBalanced}>{t("journal.postEntry")}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .je-page { flex: 1; min-height: 0; overflow-x: hidden; background: #f1f5f9; padding: 14px 18px 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .je-card { max-width: 1900px; margin: 0 auto; background: white; border-radius: 20px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; position: relative; overflow: clip; }
        .je-accent-bar { position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg, #102a43 0%, #1e5fae 45%, #22c55e 100%); }
        .je-sticky-top { position: sticky; top: 0; z-index: 5; background: white; padding-bottom: 4px; }
        .je-table-scroll { overflow-x: auto; }
        .je-header { display: flex; justify-content: space-between; align-items: center; margin: 6px 0 20px; flex-wrap: wrap; gap: 16px; }
        .je-header h1 { font-size: 22px; font-weight: 700; color: #102a43; margin: 0 0 4px; }
        .je-header p { font-size: 13px; color: #64748b; margin: 0; }
        .je-add-btn { background: #102a43; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .je-add-btn:hover { background: #1e5fae; }
        .je-prov-btn { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .je-prov-btn:hover { background: #dcfce7; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 12px 10px; background: #f8fafc; color: #334155; font-size: 12px; font-weight: 700; border-bottom: 1px solid #e2e8f0; }
        td { padding: 12px 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b; }
        .je-row { cursor: pointer; transition: background 0.3s; }
        .je-row:hover { background: #f8fafc; }
        .je-row--highlight { background: #fef9c3 !important; }
        .je-number { font-weight: 700; font-family: monospace; color: #102a43; }
        .je-status { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .je-status.posted { background: #ecfdf5; color: #059669; }
        .je-status.reversed { background: #fef2f2; color: #dc2626; }
        .je-reverse-btn { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; padding: 5px 12px; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; }
        .je-view-reversal-btn { display: block; margin-top: 6px; background: none; border: none; color: #1e5fae; font-size: 10.5px; font-weight: 700; cursor: pointer; padding: 0; text-decoration: underline; }
        .je-view-reversal-btn:hover { color: #102a43; }
        .je-detail-row td { background: #f8fafc; padding: 14px; }
        .je-lines-table { width: 100%; }
        .je-lines-table th { background: #eef2f7; font-size: 11px; }
        .je-lines-table td { font-size: 12px; border-bottom: 1px solid #e2e8f0; }
        .je-account-link { color: #1e5fae; font-weight: 600; cursor: pointer; }
        .je-account-link:hover { text-decoration: underline; }
        .je-empty { text-align: center; padding: 40px; color: #64748b; }
        .je-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .je-modal-content { background: white; border-radius: 20px; padding: 26px; width: 760px; max-width: 94%; max-height: 90vh; overflow-y: auto; }
        .je-modal-content h2 { font-size: 18px; font-weight: 700; color: #102a43; margin: 0 0 14px; }
        .je-guide { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 12px 16px; margin-bottom: 12px; }
        .je-guide strong { font-size: 12.5px; color: #1e40af; }
        .je-guide ol { margin: 8px 0 0; padding-left: 18px; }
        .je-guide li { font-size: 12px; color: #334155; line-height: 1.55; margin-bottom: 2px; }
        .je-guide b { color: #102a43; }
        .je-guide-eg { margin-top: 8px; font-size: 11.5px; color: #475569; font-style: italic; border-top: 1px dashed #bfdbfe; padding-top: 8px; }
        .je-templates { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; margin-bottom: 16px; }
        .je-templates-label { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; margin-right: 2px; }
        .je-template-btn { background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; padding: 6px 11px; border-radius: 20px; font-size: 11.5px; font-weight: 700; cursor: pointer; transition: all 0.15s; }
        .je-template-btn:hover { background: #dcfce7; border-color: #86efac; }
        .je-modal-form { display: flex; flex-direction: column; gap: 14px; }
        .je-header-fields { border-collapse: collapse; margin-bottom: 4px; }
        .je-header-fields td { padding: 6px 10px 6px 0; border: none; }
        .je-header-fields strong { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; display: block; margin-bottom: 6px; }
        .je-header-fields input { width: 100%; padding: 9px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; box-sizing: border-box; }
        .je-line-editor th { font-size: 11px; padding: 8px; }
        .je-line-editor td { padding: 6px; }
        .je-line-editor select, .je-line-editor input { width: 100%; padding: 7px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; }
        .je-remove-line-btn { background: #fee2e2; color: #dc2626; border: none; border-radius: 6px; width: 26px; height: 26px; font-size: 14px; cursor: pointer; }
        .je-add-line-btn { align-self: flex-start; background: #f1f5f9; border: 1px dashed #cbd5e1; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; color: #334155; cursor: pointer; }
        .je-balance-check { padding: 10px 14px; border-radius: 10px; font-size: 13px; font-weight: 700; }
        .je-balance-check.ok { background: #ecfdf5; color: #059669; }
        .je-balance-check.off { background: #fef2f2; color: #dc2626; }
        .je-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
        .je-cancel-btn { background: #e2e8f0; border: none; padding: 9px 18px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .je-save-btn { background: #102a43; color: white; border: none; padding: 9px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .je-save-btn:hover:not(:disabled) { background: #1e5fae; }
        .je-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
};

export default JournalEntries;

