import { useEffect, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import AlertModal from "../components/AlertModal";
import ConfirmModal from "../components/ConfirmModal";
import GetHelp, { type HelpStep } from "../components/GetHelp";
import { API_BASE } from "../lib/api";
import { Search, CreditCard, Calendar, DollarSign } from "lucide-react";

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

type TabType = "till" | "repay" | "schedule";

const CashTill = () => {
  const { t } = useTranslation("common");
  const [activeTab, setActiveTab] = useState<TabType>("till");

  // --- TILL STATE ---
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<SessionRow[]>([]);
  const [openingFloat, setOpeningFloat] = useState<string>("");
  const [counted, setCounted] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: "", message: "", type: "info" as any });
  const [confirm, setConfirm] = useState<any>({ isOpen: false, title: "", message: "", type: "info", onConfirm: () => { } });

  // --- REPAY TAB STATE ---
  const [repaySearch, setRepaySearch] = useState("");
  const [repaySearchResults, setRepaySearchResults] = useState<any[]>([]);
  const [repaySearching, setRepaySearching] = useState(false);
  const [repayCustomer, setRepayCustomer] = useState<any>(null);
  const [repaySelectedLoan, setRepaySelectedLoan] = useState<any>(null);
  const [repayAmount, setRepayAmount] = useState("");
  const [repayDate, setRepayDate] = useState(new Date().toISOString().split("T")[0]);
  const [repayMethod, setRepayMethod] = useState("cash");
  const [repayNotes, setRepayNotes] = useState("");
  const [repayTxId, setRepayTxId] = useState("");
  const [repaying, setRepaying] = useState(false);

  // --- SCHEDULE TAB STATE ---
  const [schedSearch, setSchedSearch] = useState("");
  const [schedSchedule, setSchedSchedule] = useState<any[]>([]);
  const [schedLoading, setSchedLoading] = useState(false);
  const [schedLoanId, setSchedLoanId] = useState<number | null>(null);

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
    const countedNum = Number(counted);
    if (countedNum > 9_999_999_999_999) { setModal({ isOpen: true, title: "Amount Too Large", message: "Counted cash cannot exceed TZS 9,999,999,999,999. Please check the value entered.", type: "error" }); return; }
    const variance = countedNum - Number(snap?.expected_close || 0);
    setConfirm({
      isOpen: true, title: "Close Till", type: variance === 0 ? "info" : "warning",
      message: `Expected ${fmt(snap?.expected_close)}, counted ${fmt(counted)} — variance ${fmt(variance)}. Close the drawer?`,
      onConfirm: () => { setConfirm((p: any) => ({ ...p, isOpen: false })); doClose(); },
    });
  };

  // --- REPAY TAB LOGIC ---
  const handleRepaySearch = async () => {
    if (!repaySearch.trim()) return;
    setRepaySearching(true);
    setRepaySearchResults([]);
    setRepayCustomer(null);
    setRepaySelectedLoan(null);
    try {
      const res = await axios.get(`${API_BASE}/customers?search=${encodeURIComponent(repaySearch)}`, { headers: authHeaders() });
      setRepaySearchResults(res.data.data || res.data || []);
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Search failed", type: "error" });
    } finally {
      setRepaySearching(false);
    }
  };

  const selectRepayCustomer = async (c: any) => {
    try {
      const res = await axios.get(`${API_BASE}/customers/${c.id}`, { headers: authHeaders() });
      setRepayCustomer(res.data);
      setRepaySearchResults([]);
      setRepaySearch("");
      const active = res.data.loans?.find((l: any) => l.status === "disbursed") || res.data.loans?.[0] || null;
      setRepaySelectedLoan(active);
    } catch {
      setModal({ isOpen: true, title: "Error", message: "Could not load customer details", type: "error" });
    }
  };

  const handleRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repaySelectedLoan || !repayAmount) return;
    if (Number(repayAmount) > Number(repaySelectedLoan.remaining_balance)) {
      setModal({ isOpen: true, title: "Warning", message: `Amount exceeds remaining balance (TZS ${Number(repaySelectedLoan.remaining_balance).toLocaleString()})`, type: "warning" });
      return;
    }
    setRepaying(true);
    try {
      await axios.post(`${API_BASE}/loans/${repaySelectedLoan.id}/repay`, {
        amount: Number(repayAmount),
        payment_date: repayDate,
        payment_method: repayMethod,
        notes: repayNotes,
        transaction_id: repayTxId,
      }, { headers: authHeaders() });
      setModal({ isOpen: true, title: "Success", message: "Payment recorded successfully!", type: "success" });
      setRepayAmount(""); setRepayNotes(""); setRepayTxId("");
      // refresh customer
      if (repayCustomer) selectRepayCustomer(repayCustomer);
      await load();
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.error || "Could not record payment", type: "error" });
    } finally {
      setRepaying(false);
    }
  };

  // --- SCHEDULE TAB LOGIC ---
  const handleSchedSearch = async () => {
    if (!schedSearch.trim()) return;
    setSchedLoading(true);
    setSchedSchedule([]);
    try {
      // Try as loan ID first
      const loanId = parseInt(schedSearch);
      if (!isNaN(loanId)) {
        const res = await axios.get(`${API_BASE}/loans/${loanId}/schedule`, { headers: authHeaders() });
        setSchedSchedule(res.data.data || res.data || []);
        setSchedLoanId(loanId);
      } else {
        setModal({ isOpen: true, title: "Invalid", message: "Please enter a numeric Loan ID", type: "error" });
      }
    } catch (err: any) {
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Could not fetch schedule", type: "error" });
    } finally {
      setSchedLoading(false);
    }
  };

  const expected = Number(snap?.expected_close || 0);

  const statusColor = (s: string) => {
    if (s === "paid") return { bg: "#ecfdf5", color: "#059669", dot: "#10b981", label: "Paid" };
    if (s === "overdue") return { bg: "#fef2f2", color: "#dc2626", dot: "#ef4444", label: "Overdue" };
    if (s === "partial") return { bg: "#fff7e6", color: "#b45309", dot: "#f59e0b", label: "Partial" };
    return { bg: "#fff7e6", color: "#b45309", dot: "#f59e0b", label: s || "Pending" };
  };

  return (
    <div className="ct-wrap">
      <style>{styles}</style>
      <div className="ph-bar" style={{ position: 'sticky', top: 0, zIndex: 5 }}>
        <div className="ph-inner">
          <div className="ph-brand">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            <span>Cashier Till</span>
          </div>
          <div className="ph-sep"></div>
          <button
            className={`ph-tab${activeTab === "till" ? " ph-tab--active" : ""}`}
            onClick={() => setActiveTab("till")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            Till Management
          </button>
          <button
            className={`ph-tab${activeTab === "repay" ? " ph-tab--active" : ""}`}
            onClick={() => setActiveTab("repay")}
          >
            <CreditCard size={13} />
            Repay Loan
          </button>
          <button
            className={`ph-tab${activeTab === "schedule" ? " ph-tab--active" : ""}`}
            onClick={() => setActiveTab("schedule")}
          >
            <Calendar size={13} />
            Schedule
          </button>
        </div>
        <div className="ph-actions">
          <GetHelp
            title={t("cashTill.help.title")}
            intro={t("cashTill.help.intro")}
            steps={t("cashTill.help.steps", { returnObjects: true }) as HelpStep[]}
            tip={t("cashTill.help.tip")}
          />
        </div>
      </div>

      {/* ===== TILL TAB ===== */}
      {activeTab === "till" && (
        <>
          {snap?.open ? (
            <>
              <div className="ct-board">
                <div className="ct-stat"><span>Opening Float</span><strong>{fmt(snap.opening_float)}</strong></div>
                <div className="ct-stat ct-in"><span>Cash In (repayments)</span><strong>+{fmt(snap.cash_in)}</strong></div>
                <div className="ct-stat ct-out"><span>Cash Out (disbursed)</span><strong>{fmt(snap.cash_out)}</strong></div>
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
                        <td className="ct-out-t">{fmt(s.cash_out)}</td>
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
        </>
      )}

      {/* ===== REPAY LOAN TAB ===== */}
      {activeTab === "repay" && (
        <div className="ct-tab-content">
          {/* Customer Search */}
          {!repayCustomer && (
            <div className="ct-card">
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}><CreditCard size={16} /> Repay Loan</h3>
              <p style={{ color: "#627d98", fontSize: "14px", margin: "0 0 16px" }}>Search for a customer by name or phone number to record a repayment.</p>
              <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
                <input
                  value={repaySearch}
                  onChange={(e) => setRepaySearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRepaySearch()}
                  placeholder="Customer name or phone..."
                  style={{ flex: 1, padding: "10px 14px", borderRadius: "10px", border: "1px solid #e3d7b0", fontSize: "14px", background: "#fffcf6", outline: "none" }}
                />
                <button
                  onClick={handleRepaySearch}
                  disabled={repaySearching}
                  style={{ padding: "10px 20px", borderRadius: "10px", background: "linear-gradient(135deg,#102a43,#1d3a5f)", color: "#e2bc8a", border: "1px solid rgba(226,188,138,0.4)", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "14px" }}
                >
                  <Search size={14} /> {repaySearching ? "Searching..." : "Search"}
                </button>
              </div>

              {repaySearchResults.length > 0 && (
                <div style={{ border: "1px solid #efe6d0", borderRadius: "12px", overflow: "hidden" }}>
                  {repaySearchResults.map((c: any) => (
                    <div
                      key={c.id}
                      onClick={() => selectRepayCustomer(c)}
                      style={{ padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid #f5efe0", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.15s", background: "#fffcf6", borderRadius: "0" }}
                      onMouseOver={(e) => (e.currentTarget.style.background = "#fbf3e0")}
                      onMouseOut={(e) => (e.currentTarget.style.background = "#fffcf6")}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: "#102a43", fontSize: "14px" }}>{c.full_name}</div>
                        <div style={{ fontSize: "12px", color: "#7a6a4a" }}>{c.phone_number}</div>
                      </div>
                      <span style={{ fontSize: "12px", color: "#8a7338", fontWeight: 600 }}>Select →</span>
                    </div>
                  ))}
                </div>
              )}
              {repaySearchResults.length === 0 && repaySearch && !repaySearching && (
                <p style={{ color: "#829ab1", fontSize: "13px" }}>No customers found. Try a different search term.</p>
              )}
            </div>
          )}

          {/* Repayment Form */}
          {repayCustomer && (
            <div className="ct-card" style={{ border: "1px solid #efe6d0", borderRadius: 16, overflow: "hidden", padding: 0 }}>
              {/* Customer header — navy gradient */}
              <div style={{ background: "linear-gradient(135deg,#102a43 0%,#1d3a5f 55%,#2c5282 100%)", padding: "1rem 1.2rem", position: "relative", overflow: "hidden", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(226,188,138,0.12)" }} />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: "#e2bc8a", marginBottom: 4 }}>Selected Customer</div>
                  <div style={{ fontSize: "1rem", fontWeight: 800, color: "white" }}>{repayCustomer.full_name}</div>
                </div>
                <button
                  onClick={() => { setRepayCustomer(null); setRepaySelectedLoan(null); }}
                  style={{ position: "relative", zIndex: 1, background: "rgba(226,188,138,0.15)", border: "1px solid rgba(226,188,138,0.3)", borderRadius: "8px", padding: "6px 14px", cursor: "pointer", fontSize: "13px", fontWeight: 700, color: "#e2bc8a" }}
                >
                  ← Change
                </button>
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,#e2bc8a,#c19a6b 50%,#e2bc8a)" }} />
              </div>

              <div style={{ padding: "1.2rem" }}>
                {/* Loan Selector */}
                {repayCustomer.loans?.length > 0 ? (
                  <>
                    <label style={{ fontSize: "13px", fontWeight: 700, color: "#7a6a4a", display: "block", marginBottom: "8px" }}>Select Loan</label>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px" }}>
                      {repayCustomer.loans.map((loan: any) => (
                        <button
                          key={loan.id}
                          onClick={() => setRepaySelectedLoan(loan)}
                          style={{
                            padding: "10px 14px", borderRadius: "12px", textAlign: "left", cursor: "pointer", transition: "all 0.15s",
                            border: repaySelectedLoan?.id === loan.id ? "2px solid #e2bc8a" : "1px solid #efe6d0",
                            background: repaySelectedLoan?.id === loan.id ? "#fffcf6" : "white",
                            minWidth: "160px",
                          }}
                        >
                          <div style={{ fontSize: "11px", color: "#8a7338", fontWeight: 700, textTransform: "uppercase" }}>{loan.type?.replace(/_/g, " ")}</div>
                          <div style={{ fontWeight: 800, color: "#102a43", fontSize: "15px" }}>TZS {Number(loan.amount).toLocaleString()}</div>
                          <div style={{ fontSize: "12px", color: "#e2bc8a", fontWeight: 600 }}>Balance: TZS {Number(loan.remaining_balance).toLocaleString()}</div>
                          <div style={{ fontSize: "11px", marginTop: "2px" }}>
                            <span style={{ background: "rgba(226,188,138,0.15)", color: "#8a7338", padding: "2px 8px", borderRadius: "99px", fontWeight: 700 }}>{loan.status}</span>
                          </div>
                        </button>
                      ))}
                    </div>

                    {repaySelectedLoan && (
                      <form onSubmit={handleRepay}>
                        <div className="ct-form">
                          <label>
                            Amount (TZS)
                            <input type="number" required value={repayAmount} onChange={(e) => setRepayAmount(e.target.value)} placeholder="0" min="1" max={repaySelectedLoan.remaining_balance} style={{ border: "1px solid #e3d7b0", background: "#fffcf6", borderRadius: "10px", padding: "10px 12px", fontSize: "14px" }} />
                          </label>
                          <label>
                            Payment Date
                            <input type="date" required value={repayDate} onChange={(e) => setRepayDate(e.target.value)} style={{ border: "1px solid #e3d7b0", background: "#fffcf6", borderRadius: "10px", padding: "10px 12px", fontSize: "14px" }} />
                          </label>
                          <label>
                            Payment Method
                            <select value={repayMethod} onChange={(e) => setRepayMethod(e.target.value)} style={{ padding: "10px 12px", border: "1px solid #e3d7b0", borderRadius: "10px", fontSize: "14px", background: "#fffcf6" }}>
                              <option value="cash">Cash</option>
                              <option value="bank_transfer">Bank Transfer</option>
                              <option value="mobile_money">Mobile Money</option>
                            </select>
                          </label>
                          <label>
                            Transaction ID
                            <input type="text" value={repayTxId} onChange={(e) => setRepayTxId(e.target.value)} placeholder="Reference (optional)" style={{ border: "1px solid #e3d7b0", background: "#fffcf6", borderRadius: "10px", padding: "10px 12px", fontSize: "14px" }} />
                          </label>
                          <label className="ct-full">
                            Notes
                            <input value={repayNotes} onChange={(e) => setRepayNotes(e.target.value)} placeholder="Optional notes" style={{ border: "1px solid #e3d7b0", background: "#fffcf6", borderRadius: "10px", padding: "10px 12px", fontSize: "14px" }} />
                          </label>
                        </div>
                        <button type="submit" disabled={repaying} style={{ marginTop: "16px", width: "100%", padding: "12px 26px", borderRadius: "12px", background: "linear-gradient(135deg,#102a43,#1d3a5f)", color: "#e2bc8a", border: "1px solid rgba(226,188,138,0.4)", fontWeight: 700, cursor: repaying ? "not-allowed" : "pointer", fontSize: "15px", opacity: repaying ? 0.7 : 1 }}>
                          {repaying ? "Processing..." : "Record Payment"}
                        </button>
                      </form>
                    )}
                  </>
                ) : (
                  <p style={{ color: "#7a6a4a", fontSize: "14px" }}>This customer has no loans.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== SCHEDULE TAB ===== */}
      {activeTab === "schedule" && (
        <div className="ct-tab-content">
          <div className="ct-card">
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}><Calendar size={16} /> Loan Schedule</h3>
            <p style={{ color: "#627d98", fontSize: "14px", margin: "0 0 16px" }}>Enter a Loan ID to view its repayment schedule.</p>
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              <input
                value={schedSearch}
                onChange={(e) => setSchedSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSchedSearch()}
                placeholder="Loan ID (e.g. 42)..."
                style={{ flex: 1, padding: "10px 14px", borderRadius: "10px", border: "1px solid #e3d7b0", fontSize: "14px", background: "#fffcf6", outline: "none" }}
              />
              <button
                onClick={handleSchedSearch}
                disabled={schedLoading}
                style={{ padding: "10px 20px", borderRadius: "10px", background: "linear-gradient(135deg,#102a43,#1d3a5f)", color: "#e2bc8a", border: "1px solid rgba(226,188,138,0.4)", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "14px" }}
              >
                <Search size={14} /> {schedLoading ? "Loading..." : "Fetch Schedule"}
              </button>
            </div>

            {schedSchedule.length > 0 && (
              <>
                <div style={{ marginBottom: "12px", fontSize: "13px", color: "#7a6a4a", fontWeight: 600 }}>
                  Loan #{schedLoanId} — {schedSchedule.length} instalments
                </div>
                <div style={{ borderRadius: 16, border: "1px solid #efe6d0", overflow: "hidden", background: "white" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8f1de" }}>
                        {["#", "Due Date", "Principal", "Interest", "Total", "Status"].map((h, i) => (
                          <th key={h} style={{ textAlign: i >= 2 && i <= 4 ? "right" : "left", padding: "0.85rem 0.9rem", fontSize: "0.62rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.2px", color: "#8a7338", borderBottom: "1.5px solid #efe6d0" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {schedSchedule.map((row: any, idx: number) => {
                        const principal = Number(row.principal_amount ?? row.principal ?? 0);
                        const interest = Number(row.interest_amount ?? row.interest ?? 0);
                        const total = Number(row.total_amount ?? (principal + interest));
                        const sc = statusColor(row.status);
                        return (
                          <tr key={row.id || idx}
                            style={{ background: idx % 2 === 0 ? "#ffffff" : "#fffcf6", borderBottom: "1px solid #f5efe0", transition: "background 0.15s" }}
                            onMouseOver={(e) => { e.currentTarget.style.background = "#fbf3e0"; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = idx % 2 === 0 ? "#ffffff" : "#fffcf6"; }}>
                            <td style={{ padding: "0.85rem 0.9rem" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 30, height: 24, padding: "0 8px", borderRadius: 8, background: "#102a43", color: "#e2bc8a", fontWeight: 800, fontSize: "0.74rem" }}>#{row.installment_number ?? (idx + 1)}</span>
                            </td>
                            <td style={{ padding: "0.85rem 0.9rem", fontSize: "0.8rem", color: "#7a6a4a", fontWeight: 600 }}>{row.due_date ? new Date(row.due_date).toLocaleDateString("en-GB") : "—"}</td>
                            <td style={{ padding: "0.85rem 0.9rem", textAlign: "right", fontWeight: 700, color: "#3f3318", fontSize: "0.82rem" }}>{fmt(principal)}</td>
                            <td style={{ padding: "0.85rem 0.9rem", textAlign: "right", fontWeight: 700, color: "#8a7a52", fontSize: "0.82rem" }}>{fmt(interest)}</td>
                            <td style={{ padding: "0.85rem 0.9rem", textAlign: "right", fontWeight: 900, color: "#102a43", fontSize: "0.86rem" }}>{fmt(total)}</td>
                            <td style={{ padding: "0.85rem 0.9rem" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: sc.bg, color: sc.color, padding: "5px 12px", borderRadius: 20, fontSize: "0.68rem", fontWeight: 800, whiteSpace: "nowrap" }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot, display: "inline-block" }} />
                                {sc.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {schedSchedule.length === 0 && !schedLoading && schedSearch && (
              <p style={{ color: "#829ab1", fontSize: "13px" }}>No schedule found. Check the Loan ID and try again.</p>
            )}
          </div>
        </div>
      )}

      <AlertModal isOpen={modal.isOpen} title={modal.title} message={modal.message} type={modal.type} onClose={() => setModal({ ...modal, isOpen: false })} />
      <ConfirmModal isOpen={confirm.isOpen} title={confirm.title} message={confirm.message} type={confirm.type} onConfirm={confirm.onConfirm} onCancel={() => setConfirm((p: any) => ({ ...p, isOpen: false }))} />
    </div>
  );
};

const styles = `
.ph-bar{display:flex;align-items:stretch;background:#0d2137;border-bottom:2px solid #e2bc8a;min-height:50px}
.ph-inner{display:flex;align-items:flex-end;gap:4px;padding:10px 14px 0;flex:1;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none}
.ph-inner::-webkit-scrollbar{display:none}
.ph-brand{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;color:#e2bc8a;white-space:nowrap;padding-bottom:10px;flex-shrink:0}
.ph-sep{width:1px;height:24px;background:rgba(226,188,138,0.3);margin:0 8px 10px;flex-shrink:0}
.ph-tab{display:flex;align-items:center;gap:6px;white-space:nowrap;padding:8px 16px;border:none;border-radius:8px 8px 0 0;font-size:13px;font-weight:700;cursor:pointer;background:transparent;color:rgba(226,188,138,0.6);transition:all .15s;flex-shrink:0;font-family:inherit}
.ph-tab--active{background:rgba(226,188,138,0.12);color:#e2bc8a;box-shadow:0 -2px 0 #e2bc8a inset}
.ph-tab:hover:not(.ph-tab--active){background:rgba(226,188,138,0.08);color:#e2bc8a}
.ph-actions{display:flex;align-items:center;gap:8px;padding:6px 14px;flex-shrink:0;border-left:1px solid rgba(226,188,138,0.3);background:#0d2137}
.ct-wrap { flex: 1; min-height: 0; overflow-x: hidden; background: #fffcf6; padding: 14px 18px 48px; }
.ct-tab-content { }
.ct-sticky-top { position: sticky; top: 0; z-index: 5; background: #f8fafc; padding-bottom: 8px; }
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
.ct-table-wrap { overflow-x: auto; }
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
