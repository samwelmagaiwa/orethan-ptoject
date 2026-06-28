import { Fragment, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import AlertModal from "../components/AlertModal";
import ConfirmModal from "../components/ConfirmModal";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
const fmt = (v: any) => Number(v || 0).toLocaleString();

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
}

const JournalEntries = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [accounts, setAccounts] = useState<{ id: number; code: string; name: string }[]>([]);
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
  const [confirm, setConfirm] = useState({ isOpen: false, title: "", message: "", onConfirm: () => {}, type: "info" as any });

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

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const isBalanced = lines.length >= 2 && totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.01;

  const resetForm = () => {
    setEntryDate(new Date().toISOString().slice(0, 10));
    setDescription("");
    setLines([
      { chart_of_account_id: "", debit: "", credit: "", description: "" },
      { chart_of_account_id: "", debit: "", credit: "", description: "" },
    ]);
  };

  const updateLine = (index: number, field: keyof Line, value: any) => {
    setLines(prev => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  };

  const submit = async () => {
    if (!description) {
      setModal({ isOpen: true, title: "Missing Information", message: "Description is required", type: "warning" });
      return;
    }
    if (!isBalanced) {
      setModal({ isOpen: true, title: "Not Balanced", message: `Total debit (${fmt(totalDebit)}) must equal total credit (${fmt(totalCredit)})`, type: "warning" });
      return;
    }
    try {
      await axios.post(`${API_BASE}/accounting/journal-entries`, {
        entry_date: entryDate,
        description,
        lines: lines.filter(l => l.chart_of_account_id && (Number(l.debit) > 0 || Number(l.credit) > 0)),
      }, { headers: authHeaders() });
      setShowModal(false);
      resetForm();
      load();
      setModal({ isOpen: true, title: "Posted", message: "Journal Entry posted successfully", type: "success" });
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Failed to post entry", type: "error" });
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

      <div className="je-card">
        <div className="je-accent-bar" />
        <div className="je-header">
          <div>
            <h1>Journal Entries</h1>
            <p>General Ledger postings — auto-posted from disbursements/repayments, or entered manually</p>
          </div>
          <button className="je-add-btn" onClick={() => { resetForm(); setShowModal(true); }}>+ New Entry</button>
        </div>

        {loading ? (
          <div className="je-empty">Loading...</div>
        ) : (
          <table>
            <thead>
              <tr><th>Entry No.</th><th>Date</th><th>Description</th><th>Debit</th><th>Credit</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={7} className="je-empty">No journal entries yet</td></tr>
              ) : entries.map(entry => {
                const debit = entry.lines.reduce((s, l) => s + Number(l.debit), 0);
                const credit = entry.lines.reduce((s, l) => s + Number(l.credit), 0);
                return (
                  <Fragment key={entry.id}>
                    <tr className="je-row" onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>
                      <td className="je-number">{entry.entry_number}</td>
                      <td>{entry.entry_date}</td>
                      <td>{entry.description}</td>
                      <td>{fmt(debit)}</td>
                      <td>{fmt(credit)}</td>
                      <td><span className={`je-status ${entry.status}`}>{entry.status}</span></td>
                      <td>{entry.status === "posted" && <button className="je-reverse-btn" onClick={(e) => { e.stopPropagation(); reverseEntry(entry); }}>Reverse</button>}</td>
                    </tr>
                    {expanded === entry.id && (
                      <tr className="je-detail-row">
                        <td colSpan={7}>
                          <table className="je-lines-table">
                            <thead><tr><th>Account</th><th>Description</th><th>Debit</th><th>Credit</th></tr></thead>
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
        )}
      </div>

      {showModal && (
        <div className="je-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="je-modal-content" onClick={e => e.stopPropagation()}>
            <h2>New Journal Entry</h2>
            <div className="je-modal-form">
              <table className="je-header-fields">
                <tbody>
                  <tr>
                    <td><strong>Date</strong><br /><input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} /></td>
                    <td colSpan={2}><strong>Description</strong><br /><input type="text" placeholder="e.g. Office rent for June 2026" value={description} onChange={e => setDescription(e.target.value)} /></td>
                  </tr>
                </tbody>
              </table>

              <table className="je-line-editor">
                <thead><tr><th>Account</th><th>Debit</th><th>Credit</th><th>Description</th><th></th></tr></thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i}>
                      <td>
                        <select value={line.chart_of_account_id} onChange={e => updateLine(i, "chart_of_account_id", Number(e.target.value))}>
                          <option value="">Select account</option>
                          {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                        </select>
                      </td>
                      <td><input type="number" value={line.debit} onChange={e => updateLine(i, "debit", e.target.value)} /></td>
                      <td><input type="number" value={line.credit} onChange={e => updateLine(i, "credit", e.target.value)} /></td>
                      <td><input type="text" value={line.description} onChange={e => updateLine(i, "description", e.target.value)} /></td>
                      <td>
                        {lines.length > 2 && <button className="je-remove-line-btn" onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}>×</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button className="je-add-line-btn" onClick={() => setLines(prev => [...prev, { chart_of_account_id: "", debit: "", credit: "", description: "" }])}>+ Add Line</button>

              <div className={`je-balance-check ${isBalanced ? "ok" : "off"}`}>
                Debit: {fmt(totalDebit)} &nbsp;|&nbsp; Credit: {fmt(totalCredit)} &nbsp;
                {isBalanced ? "✓ Balanced" : "✗ Not balanced"}
              </div>
            </div>
            <div className="je-modal-actions">
              <button className="je-cancel-btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="je-save-btn" onClick={submit} disabled={!isBalanced}>Post Entry</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .je-page { min-height: 100vh; background: #f1f5f9; padding: 80px 28px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .je-card { max-width: 1900px; margin: 0 auto; background: white; border-radius: 20px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; position: relative; overflow: hidden; }
        .je-accent-bar { position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg, #102a43 0%, #1e5fae 45%, #22c55e 100%); }
        .je-header { display: flex; justify-content: space-between; align-items: center; margin: 6px 0 20px; flex-wrap: wrap; gap: 16px; }
        .je-header h1 { font-size: 22px; font-weight: 700; color: #102a43; margin: 0 0 4px; }
        .je-header p { font-size: 13px; color: #64748b; margin: 0; }
        .je-add-btn { background: #102a43; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .je-add-btn:hover { background: #1e5fae; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 12px 10px; background: #f8fafc; color: #334155; font-size: 12px; font-weight: 700; border-bottom: 1px solid #e2e8f0; }
        td { padding: 12px 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b; }
        .je-row { cursor: pointer; }
        .je-row:hover { background: #f8fafc; }
        .je-number { font-weight: 700; font-family: monospace; color: #102a43; }
        .je-status { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .je-status.posted { background: #ecfdf5; color: #059669; }
        .je-status.reversed { background: #fef2f2; color: #dc2626; }
        .je-reverse-btn { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; padding: 5px 12px; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; }
        .je-detail-row td { background: #f8fafc; padding: 14px; }
        .je-lines-table { width: 100%; }
        .je-lines-table th { background: #eef2f7; font-size: 11px; }
        .je-lines-table td { font-size: 12px; border-bottom: 1px solid #e2e8f0; }
        .je-account-link { color: #1e5fae; font-weight: 600; cursor: pointer; }
        .je-account-link:hover { text-decoration: underline; }
        .je-empty { text-align: center; padding: 40px; color: #64748b; }
        .je-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .je-modal-content { background: white; border-radius: 20px; padding: 26px; width: 760px; max-width: 94%; max-height: 90vh; overflow-y: auto; }
        .je-modal-content h2 { font-size: 18px; font-weight: 700; color: #102a43; margin: 0 0 18px; }
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
