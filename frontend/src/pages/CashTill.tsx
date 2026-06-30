import { useEffect, useState } from "react";
import axios from "axios";
import AlertModal from "../components/AlertModal";
import ConfirmModal from "../components/ConfirmModal";
import GetHelp from "../components/GetHelp";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
const fmt = (v: any) => `TZS ${Number(v || 0).toLocaleString()}`;

interface Snapshot {
  open: boolean;
  session?: { id: number; opening_float: number; opened_at: string };
  opening_float?: number;
  cash_in?: number;
  cash_out?: number;
  expected_close?: number;
}
interface SessionRow {
  id: number;
  status: string;
  opening_float: number;
  cash_in: number;
  cash_out: number;
  expected_close: number;
  counted_close?: number;
  variance?: number;
  opened_at: string;
  closed_at?: string;
  user?: { name: string };
}

const CashTill = () => {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<SessionRow[]>([]);
  const [openingFloat, setOpeningFloat] = useState<string>("");
  const [counted, setCounted] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: "", message: "", type: "info" as any });
  const [confirm, setConfirm] = useState<any>({ isOpen: false, title: "", message: "", type: "info", onConfirm: () => {} });

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const load = async () => {
    try {
      const [s, h] = await Promise.all([
        axios.get(`${API_BASE}/till/status`, { headers: authHeaders() }),
        axios.get(`${API_BASE}/till/history`, { headers: authHeaders() }),
      ]);
      setSnap(s.data.data);
      setHistory(h.data.data || []);
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Failed to load till", type: "error" });
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const openTill = async () => {
    const f = Number(openingFloat);
    if (f < 0 || openingFloat === "") { setModal({ isOpen: true, title: "Invalid", message: "Enter the opening float.", type: "error" }); return; }
    setBusy(true);
    try {
      await axios.post(`${API_BASE}/till/open`, { opening_float: f, notes }, { headers: authHeaders() });
      setOpeningFloat(""); setNotes("");
      await load();
      setModal({ isOpen: true, title: "Till Opened", message: `Drawer opened with ${fmt(f)}.`, type: "success" });
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Could not open till", type: "error" });
    } finally { setBusy(false); }
  };

  const doClose = async () => {
    setBusy(true);
    try {
      const res = await axios.post(`${API_BASE}/till/close`, { counted_amount: Number(counted), notes }, { headers: authHeaders() });
      const v = Number(res.data.data.variance);
      setCounted(""); setNotes("");
      await load();
      setModal({
        isOpen: true,
        title: "Till Closed",
        message: v === 0 ? "Drawer balanced perfectly — no variance." : `Closed with a ${v > 0 ? "overage" : "shortage"} of ${fmt(Math.abs(v))}.`,
        type: v === 0 ? "success" : "warning",
      });
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Could not close till", type: "error" });
    } finally { setBusy(false); }
  };

  const closeTill = () => {
    if (counted === "") { setModal({ isOpen: true, title: "Count Required", message: "Enter the counted cash amount.", type: "error" }); return; }
    const variance = Number(counted) - Number(snap?.expected_close || 0);
    setConfirm({
      isOpen: true, title: "Close Till", type: variance === 0 ? "info" : "warning",
      message: `Expected ${fmt(snap?.expected_close)}, counted ${fmt(counted)} — variance ${fmt(variance)}. Close the drawer?`,
      onConfirm: () => { setConfirm((p: any) => ({ ...p, isOpen: false })); doClose(); },
    });
  };

  const expected = Number(snap?.expected_close || 0);

  return (
    <div className="ct-wrap">
      <style>{styles}</style>
      <div className="ct-sticky-top">
        <div className="ct-head">
          <h1>Cashier Till</h1>
          <p>Open the drawer with a float, transact cash, then count and close — variance is flagged automatically.</p>
        </div>

        <GetHelp
          title="How to use the Cashier Till"
          intro="Every cashier opens one till session at the start of the shift and closes it at the end. The system automatically tracks cash in (repayments you record as 'cash') and cash out (cash disbursements you process) — the physical count at close reveals any shortage or overage."
          steps={[
            { title: "1. Open the drawer", text: "At the start of your shift, enter the cash float you are starting with (the amount physically in the drawer right now) and click Open Drawer.", example: "Opening float: TZS 100,000 — the float received from yesterday's close or petty cash." },
            { title: "2. Transact normally", text: "Record cash repayments and process cash disbursements through the normal loan pages — the till tracks them automatically. You don't need to come back here during the shift." },
            { title: "3. Check the board mid-shift", text: "Refresh this page any time to see the live position: opening float + cash in (collections) − cash out (disbursements) = expected amount in the drawer right now." },
            { title: "4. Count and close", text: "At the end of the shift, physically count the cash in the drawer. Enter the exact count in the Close Till box and click Count & Close Drawer.", example: "Expected TZS 340,000, you count TZS 338,500 → variance = −TZS 1,500 (shortage — investigate before locking up)." },
            { title: "5. Review history", text: "The Session History table shows all your past sessions. Admins see all cashiers. A zero variance means the drawer balanced perfectly." },
          ]}
          tip="Close the till every day even if there are no transactions — a zero-transaction close confirms the drawer was balanced and undisturbed."
        />
      </div>

      {snap?.open ? (
        <>
          <div className="ct-board">
            <div className="ct-stat"><span>Opening Float</span><strong>{fmt(snap.opening_float)}</strong></div>
            <div className="ct-stat ct-in"><span>Cash In (repayments)</span><strong>+{fmt(snap.cash_in)}</strong></div>
            <div className="ct-stat ct-out"><span>Cash Out (disbursed)</span><strong>−{fmt(snap.cash_out)}</strong></div>
            <div className="ct-stat ct-exp"><span>Expected in Drawer</span><strong>{fmt(expected)}</strong></div>
          </div>

          <div className="ct-card">
            <h3>Close Till</h3>
            <div className="ct-form">
              <label>Counted cash<input type="number" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="0" /></label>
              <label className="ct-full">Notes<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional — explain any variance" /></label>
            </div>
            {counted !== "" && (
              <p className={`ct-variance ${Number(counted) - expected === 0 ? "ok" : "bad"}`}>
                Variance: {fmt(Number(counted) - expected)} {Number(counted) - expected === 0 ? "(balanced)" : Number(counted) - expected > 0 ? "(overage)" : "(shortage)"}
              </p>
            )}
            <button className="ct-btn danger" onClick={closeTill} disabled={busy}>Count &amp; Close Drawer</button>
          </div>
        </>
      ) : (
        <div className="ct-card">
          <h3>Open Till</h3>
          <div className="ct-form">
            <label>Opening float (cash on hand)<input type="number" value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} placeholder="0" /></label>
            <label className="ct-full">Notes<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></label>
          </div>
          <button className="ct-btn" onClick={openTill} disabled={busy}>Open Drawer</button>
        </div>
      )}

      {history.length > 0 && (
        <div className="ct-card">
          <h3>Session History</h3>
          <div className="ct-table-wrap">
            <table className="ct-table">
              <thead><tr><th>Opened</th><th>Cashier</th><th>Float</th><th>In</th><th>Out</th><th>Expected</th><th>Counted</th><th>Variance</th><th>Status</th></tr></thead>
              <tbody>
                {history.map((s) => (
                  <tr key={s.id}>
                    <td>{new Date(s.opened_at).toLocaleString()}</td>
                    <td>{s.user?.name || "—"}</td>
                    <td>{fmt(s.opening_float)}</td>
                    <td className="ct-in-t">+{fmt(s.cash_in)}</td>
                    <td className="ct-out-t">−{fmt(s.cash_out)}</td>
                    <td>{fmt(s.expected_close)}</td>
                    <td>{s.counted_close != null ? fmt(s.counted_close) : "—"}</td>
                    <td className={s.variance == null ? "" : Number(s.variance) === 0 ? "ct-ok" : "ct-bad"}>{s.variance != null ? fmt(s.variance) : "—"}</td>
                    <td><span className={`ct-badge ct-${s.status}`}>{s.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AlertModal isOpen={modal.isOpen} title={modal.title} message={modal.message} type={modal.type} onClose={() => setModal({ ...modal, isOpen: false })} />
      <ConfirmModal isOpen={confirm.isOpen} title={confirm.title} message={confirm.message} type={confirm.type} onConfirm={confirm.onConfirm} onCancel={() => setConfirm((p: any) => ({ ...p, isOpen: false }))} />
    </div>
  );
};

const styles = `
.ct-wrap { max-width: 1100px; margin: 0 auto; padding: 8px 4px 48px; }
.ct-sticky-top { position: sticky; top: 0; z-index: 5; background: #f8fafc; padding-bottom: 6px; }
.ct-table-scroll { max-height: 50vh; overflow-y: auto; }
.ct-table-scroll thead th { position: sticky; top: 0; z-index: 2; background: white; }
.ct-head h1 { font-size: 24px; color: #102a43; margin: 0 0 4px; }
.ct-head p { color: #627d98; margin: 0 0 18px; font-size: 14px; }
.ct-board { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 18px; }
.ct-stat { background: #fff; border: 1px solid #e6ebf1; border-radius: 14px; padding: 16px 18px; }
.ct-stat span { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; color: #829ab1; margin-bottom: 6px; }
.ct-stat strong { font-size: 20px; color: #243b53; }
.ct-in strong { color: #1f9254; }
.ct-out strong { color: #c0392b; }
.ct-exp { background: #102a43; }
.ct-exp span { color: #9fb3c8; }
.ct-exp strong { color: #fff; }
.ct-card { background: #fff; border: 1px solid #e6ebf1; border-radius: 14px; padding: 20px; margin-bottom: 18px; box-shadow: 0 1px 3px rgba(16,42,67,.05); }
.ct-card h3 { margin: 0 0 14px; color: #102a43; font-size: 16px; }
.ct-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
.ct-form label { display: flex; flex-direction: column; font-size: 13px; font-weight: 600; color: #486581; gap: 6px; }
.ct-form input { padding: 10px 12px; border: 1px solid #d2dbe6; border-radius: 9px; font-size: 14px; }
.ct-full { grid-column: 1 / -1; }
.ct-variance { font-size: 14px; font-weight: 700; margin: 14px 0 4px; }
.ct-variance.ok { color: #1f9254; }
.ct-variance.bad { color: #c0392b; }
.ct-btn { margin-top: 16px; background: #1f9254; color: #fff; border: none; padding: 12px 26px; border-radius: 10px; font-weight: 700; cursor: pointer; }
.ct-btn.danger { background: #c0392b; }
.ct-btn:disabled { opacity: .5; cursor: not-allowed; }
.ct-table-wrap { overflow-x: auto; max-height: 50vh; overflow-y: auto; }
.ct-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.ct-table th { text-align: left; padding: 9px; border-bottom: 2px solid #e6ebf1; color: #627d98; font-size: 11px; text-transform: uppercase; white-space: nowrap; }
.ct-table td { padding: 9px; border-bottom: 1px solid #f0f3f7; color: #334e68; white-space: nowrap; }
.ct-in-t { color: #1f9254; }
.ct-out-t { color: #c0392b; }
.ct-ok { color: #1f9254; font-weight: 700; }
.ct-bad { color: #c0392b; font-weight: 700; }
.ct-badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: capitalize; }
.ct-open { background: #e3f0ff; color: #1e5fae; }
.ct-closed { background: #eef1f4; color: #627d98; }
`;

export default CashTill;
