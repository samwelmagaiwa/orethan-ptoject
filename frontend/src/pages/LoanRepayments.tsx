import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import AlertModal from "../components/AlertModal";
import { printReceipt, type ReceiptData } from "../utils/receipt";
import { API_BASE, fmtLoanId } from "../lib/api";

// INLINE SVG ICONS
const IconArrowLeft = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>;
const IconPhone = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.11 11.9a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>;
const IconFingerprint = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12a10 10 0 0 1 18 0"/><path d="M7 12a5 5 0 0 1 5-5"/><path d="M12 7V3"/><path d="M12 21v-4"/><path d="M12 12v3"/></svg>;
const IconMapPin = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IconHistory = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><polyline points="3 3 3 8 8 8" /><path d="M12 7v5l4 2" /></svg>;
const IconDollarSign = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;
const IconCreditCardSmall = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>;
const IconTrendingDown = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 17L13.5 8.5L8.5 13.5L2 7"/><polyline points="16 17 22 17 22 11"/></svg>;

const fmtAmt = (v: any) => `TZS ${Number(v || 0).toLocaleString()}`;

const LoanRepayments: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<any>(null);
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [repaying, setRepaying] = useState(false);

  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [transactionId, setTransactionId] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState<"success" | "error" | "info" | "warning">("info");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  useEffect(() => { fetchCustomerAndLoans(); }, [id]);

  const fetchCustomerAndLoans = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE}/customers/${id}`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      setCustomer(res.data);
      if (res.data.loans.length > 0) {
        // prefer an active loan with outstanding balance; fall back to first loan
        setSelectedLoan(
          res.data.loans.find((l: any) => l.status === "disbursed" && Number(l.remaining_balance) > 0) ||
          res.data.loans.find((l: any) => Number(l.remaining_balance) > 0) ||
          res.data.loans[0]
        );
      }
    } catch (err) {
      console.error(err);
      setModalMessage("Imeshindwa kupata taarifa za mteja");
      setModalType("error");
      setShowModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan || !amount) return;
    if (Number(amount) > Number(selectedLoan.remaining_balance)) {
      setModalMessage(`Kiasi kinachozidi deni lililobaki (${fmtAmt(selectedLoan.remaining_balance)})`);
      setModalType("warning");
      setShowModal(true);
      return;
    }
    setRepaying(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(`${API_BASE}/loans/${selectedLoan.id}/repay`, {
        amount: Number(amount),
        payment_date: paymentDate,
        payment_method: method,
        notes,
        transaction_id: transactionId
      }, { headers: { Authorization: token ? `Bearer ${token}` : "" } });

      const rcpt = res.data?.data?.receipt;
      if (rcpt) setReceipt(rcpt);
      setModalMessage("Malipo yamefanikiwa kurekodiwa!");
      setModalType("success");
      setShowModal(true);
      setAmount(""); setNotes(""); setTransactionId("");
      fetchCustomerAndLoans();
    } catch (err: any) {
      console.error(err);
      setModalMessage(err.response?.data?.error || "Imeshindwa kurekodi malipo");
      setModalType("error");
      setShowModal(true);
    } finally {
      setRepaying(false);
    }
  };

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#fffcf6", gap: 20 }}>
      <div className="lr-spinner" />
      <div style={{ color: "#8a7338", fontSize: "1.1rem", fontWeight: 800, letterSpacing: 1 }}>INAPAKIA...</div>
      <style>{`.lr-spinner{width:60px;height:60px;border:4px solid #f5efe0;border-top:4px solid #e2bc8a;border-radius:50%;animation:lr-spin 1s linear infinite}@keyframes lr-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const activeLoan = selectedLoan;
  const pct = activeLoan && activeLoan.amount > 0
    ? Math.min(100, Math.round((Number(activeLoan.total_paid) / activeLoan.amount) * 100))
    : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#fffcf6", padding: "0 0 48px", fontFamily: "'Inter',sans-serif" }}>
      <AlertModal isOpen={showModal} message={modalMessage} type={modalType} onClose={() => setShowModal(false)} />

      {/* RECEIPT POPUP */}
      {receipt && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", backdropFilter: "blur(8px)", background: "rgba(0,0,0,0.55)" }}>
          <div style={{ width: "100%", maxWidth: 440, borderRadius: 20, background: "white", overflow: "hidden", boxShadow: "0 25px 60px rgba(0,0,0,0.4)" }}>
            <div style={{ background: "linear-gradient(135deg,#059669,#065f46)", padding: "1.6rem 1.5rem", color: "white", textAlign: "center" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 900, margin: 0 }}>Payment Recorded</h2>
              <p style={{ margin: "0.3rem 0 0", fontSize: "0.82rem", opacity: 0.9, fontWeight: 600 }}>
                TZS {Math.round(receipt.amount_paid).toLocaleString()} · {receipt.receipt_number}
              </p>
            </div>
            <div style={{ padding: "1.4rem 1.5rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.7rem" }}>
                <button onClick={() => printReceipt(receipt, "a4")} style={rcptBtn("#102a43")}>🖨 A4 Receipt</button>
                <button onClick={() => printReceipt(receipt, "a4")} style={rcptBtn("#1d8ad1")}>⬇ Download PDF</button>
                <button onClick={() => printReceipt(receipt, "80mm")} style={rcptBtn("#475569")}>🖨 Thermal 80mm</button>
                <button onClick={() => printReceipt(receipt, "58mm")} style={rcptBtn("#475569")}>🖨 Thermal 58mm</button>
              </div>
              <button onClick={() => setReceipt(null)} style={{ width: "100%", marginTop: "0.9rem", padding: "0.7rem", borderRadius: 12, background: "#f8f1de", border: "none", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", color: "#8a7338" }}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* STICKY HEADER */}
      <div className="ph-bar">
        <div className="ph-inner">
          <div className="ph-brand"><IconCreditCardSmall /><span>Loan Repayment</span></div>
        </div>
        <div className="ph-actions">
          <button onClick={() => navigate(-1)} style={{ background: "rgba(226,188,138,0.15)", border: "1px solid rgba(226,188,138,0.3)", borderRadius: 8, padding: "6px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#e2bc8a" }}>
            <IconArrowLeft /> Back
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 20px 40px" }}>
        <div style={{ background: "white", borderRadius: 20, border: "1px solid #efe6d0", boxShadow: "0 20px 50px rgba(74,60,26,0.12)" }}>

          {/* ── NAVY HEADER ── */}
          <div style={{ background: "linear-gradient(135deg,#102a43 0%,#1d3a5f 55%,#2c5282 100%)", padding: "1.5rem 1.7rem 1.7rem", color: "white", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(226,188,138,0.12)" }} />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.62rem", fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: "#e2bc8a", background: "rgba(226,188,138,0.15)", padding: "4px 10px", borderRadius: 20, marginBottom: 10 }}>
              💳 Loan Repayment
            </span>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ margin: "0.35rem 0 0", fontSize: "1.1rem", color: "white", fontWeight: 800 }}>{customer?.full_name || "Record Payment"}</p>
              {customer && (
                <span style={{ background: "rgba(226,188,138,0.2)", color: "#e2bc8a", padding: "4px 14px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 700 }}>{customer.phone_number}</span>
              )}
            </div>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg,#e2bc8a,#c19a6b 50%,#e2bc8a)" }} />
          </div>

          {/* ── PROFILE INFO STRIP ── */}
          <div style={{ padding: "1.2rem 1.7rem", background: "white", borderBottom: "1px solid #efe6d0" }}>
            <div className="lr-profile-strip">
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: "0 0 auto" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#102a43,#1d3a5f)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", fontWeight: 800, color: "#e2bc8a", flexShrink: 0 }}>
                  {customer?.full_name?.charAt(0) || "?"}
                </div>
                <div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#102a43" }}>{customer?.full_name}</div>
                  <span style={{ display: "inline-block", background: "rgba(226,188,138,0.15)", color: "#8a7338", padding: "2px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700, marginTop: 3 }}>Loan Customer</span>
                </div>
              </div>
              <div className="lr-strip-div" />
              <div className="lr-info-grid">
                <div className="lr-info-item"><span className="lr-info-icon"><IconPhone /></span><div><div className="lr-info-label">Simu</div><div className="lr-info-val">{customer?.phone_number || "—"}</div></div></div>
                <div className="lr-info-item"><span className="lr-info-icon"><IconFingerprint /></span><div><div className="lr-info-label">NIDA</div><div className="lr-info-val">{customer?.nida_number || "N/A"}</div></div></div>
                <div className="lr-info-item"><span className="lr-info-icon"><IconMapPin /></span><div><div className="lr-info-label">Mahali</div><div className="lr-info-val">{[customer?.street, customer?.ward].filter(Boolean).join(", ") || "—"}</div></div></div>
                <div className="lr-info-item"><span className="lr-info-icon"><IconTrendingDown /></span><div><div className="lr-info-label">Mikopo Yote</div><div className="lr-info-val">{customer?.loans?.length ?? 0} loan{customer?.loans?.length !== 1 ? "s" : ""}</div></div></div>
              </div>
            </div>
          </div>

          {/* ── SELECTED LOAN SUMMARY STRIP (navy) ── */}
          {activeLoan && (
            <div style={{ background: "#102a43", padding: "1rem 1.7rem", display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginRight: "1rem" }}>
                <IconTrendingDown />
                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#e2bc8a", textTransform: "uppercase", letterSpacing: "1px" }}>
                  {activeLoan.type?.replace(/_/g, " ")} · Loan #{fmtLoanId(activeLoan.id)}
                </span>
              </div>
              <div className="lr-fin-strip">
                <div className="lr-fin-item"><span className="lr-fin-label">Kiasi</span><span className="lr-fin-val">{fmtAmt(activeLoan.amount)}</span></div>
                <div className="lr-fin-sep" />
                <div className="lr-fin-item"><span className="lr-fin-label">Deni Lililobaki</span><span className="lr-fin-val lr-fin-val--large">{fmtAmt(activeLoan.remaining_balance)}</span></div>
                <div className="lr-fin-sep" />
                <div className="lr-fin-item"><span className="lr-fin-label">Malimbikizo</span><span className="lr-fin-val" style={{ color: activeLoan.arrears > 0 ? "#fca5a5" : "#e2bc8a" }}>{fmtAmt(activeLoan.arrears)}</span></div>
                <div className="lr-fin-sep" />
                <div className="lr-fin-item">
                  <span className="lr-fin-label">Maendeleo</span>
                  <span className="lr-fin-val" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ display: "inline-block", width: 80, height: 6, background: "rgba(255,255,255,0.15)", borderRadius: 10, overflow: "hidden" }}>
                      <span style={{ display: "block", width: `${pct}%`, height: "100%", background: pct >= 80 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444", borderRadius: 10 }} />
                    </span>
                    {pct}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── LOAN SELECTOR (if multiple) ── */}
          {customer?.loans?.length > 1 && (
            <div style={{ background: "#f8f1de", borderBottom: "1px solid #efe6d0", padding: "0.8rem 1.7rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#8a7338", textTransform: "uppercase", letterSpacing: "0.8px", flexShrink: 0 }}>Chagua Mkopo:</span>
              {customer.loans.map((loan: any) => (
                <button
                  key={loan.id}
                  onClick={() => setSelectedLoan(loan)}
                  style={{
                    padding: "5px 14px", borderRadius: 20,
                    border: selectedLoan?.id === loan.id ? "2px solid #e2bc8a" : "1px solid #efe6d0",
                    background: selectedLoan?.id === loan.id ? "#102a43" : "white",
                    color: selectedLoan?.id === loan.id ? "#e2bc8a" : "#8a7338",
                    fontWeight: 700, fontSize: "0.75rem", cursor: "pointer", transition: "all 0.15s",
                    whiteSpace: "nowrap"
                  }}
                >
                  {loan.type?.replace(/_/g, " ")} #{fmtLoanId(loan.id)} · {fmtAmt(loan.remaining_balance)}
                </button>
              ))}
            </div>
          )}

          {/* ── MAIN BODY: FORM + HISTORY ── */}
          <div style={{ background: "#fffcf6" }}>
            <div className="lr-body-grid">

              {/* LEFT: PAYMENT FORM */}
              <div style={{ padding: "1.5rem 1.7rem", borderRight: "1px solid #efe6d0" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#8a7338", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "1.2rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <IconDollarSign /> Rekodi Malipo
                </div>

                {/* Fully-paid guard */}
                {Number(selectedLoan?.remaining_balance ?? 0) <= 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem 1.5rem", textAlign: "center", background: "#ecfdf5", borderRadius: 14, border: "1px solid #a7f3d0" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>✅</div>
                    <div style={{ fontSize: "1rem", fontWeight: 800, color: "#059669", marginBottom: "0.35rem" }}>Mkopo Umelipwa Kabisa</div>
                    <div style={{ fontSize: "0.82rem", color: "#065f46", fontWeight: 600 }}>Loan Fully Paid — no outstanding balance.</div>
                    {customer?.loans?.filter((l: any) => Number(l.remaining_balance) > 0).length > 0 && (
                      <div style={{ marginTop: "1.2rem", fontSize: "0.78rem", color: "#047857" }}>
                        Use the loan selector above to switch to an active loan.
                      </div>
                    )}
                  </div>
                ) : (
                <form onSubmit={handleRepay} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                  <div className="lr-form-grid">
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                      <label className="lr-label">Kiasi cha Fedha (TZS)</label>
                      <input
                        type="number" required placeholder="0"
                        value={amount} onChange={(e) => setAmount(e.target.value)}
                        className="lr-input"
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                      <label className="lr-label">Tarehe ya Malipo</label>
                      <input
                        type="date" required
                        value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
                        className="lr-input"
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                      <label className="lr-label">Njia ya Malipo</label>
                      <select value={method} onChange={(e) => setMethod(e.target.value)} className="lr-input">
                        <option value="cash">Cash</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="mobile_money">Mobile Money (M-Pesa / AirtelMoney / TigoPesa)</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                      <label className="lr-label">Transaction ID (Kama ipo)</label>
                      <input
                        type="text" placeholder="Reference number..."
                        value={transactionId} onChange={(e) => setTransactionId(e.target.value)}
                        className="lr-input"
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                    <label className="lr-label">Maelezo ya Ziada</label>
                    <textarea
                      placeholder="Notes..."
                      value={notes} onChange={(e) => setNotes(e.target.value)}
                      className="lr-input"
                      style={{ minHeight: 90, resize: "vertical" }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={repaying || !selectedLoan}
                    style={{
                      padding: "1rem 1.5rem", borderRadius: 14,
                      background: "linear-gradient(135deg,#102a43,#1d3a5f)",
                      color: "#e2bc8a", fontSize: "0.95rem", fontWeight: 700,
                      border: "1px solid rgba(226,188,138,0.4)",
                      cursor: repaying ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem",
                      opacity: repaying ? 0.7 : 1, transition: "opacity 0.2s"
                    }}
                  >
                    {repaying ? "Inatuma..." : <><IconDollarSign /> Kamilisha Malipo</>}
                  </button>
                </form>
                )}
              </div>

              {/* RIGHT: REPAYMENT HISTORY */}
              <div style={{ padding: "1.5rem 1.7rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#8a7338", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "1.2rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <IconHistory /> Historia ya Malipo
                  {selectedLoan?.repayments?.length > 0 && (
                    <span style={{ marginLeft: "auto", background: "rgba(226,188,138,0.15)", color: "#8a7338", padding: "2px 10px", borderRadius: 20, fontSize: "0.68rem", fontWeight: 800 }}>
                      {selectedLoan.repayments.length} record{selectedLoan.repayments.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {!selectedLoan?.repayments || selectedLoan.repayments.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#7a6a4a" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "0.6rem" }}>📋</div>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>Hakuna malipo yaliyorekodiwa</div>
                    <div style={{ fontSize: "0.78rem", color: "#b0a080", marginTop: 4 }}>No repayments recorded for this loan.</div>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="lr-hist-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Kiasi</th>
                          <th>Tarehe</th>
                          <th>Njia</th>
                          <th>Receipt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedLoan.repayments.map((r: any, idx: number) => (
                          <tr key={r.id} className={idx % 2 === 0 ? "lr-row-even" : "lr-row-odd"}>
                            <td><span className="lr-row-num">{idx + 1}</span></td>
                            <td><span style={{ fontWeight: 800, color: "#102a43", whiteSpace: "nowrap" }}>{fmtAmt(r.amount)}</span></td>
                            <td><span style={{ fontSize: "0.78rem", color: "#5a4e38", whiteSpace: "nowrap" }}>{new Date(r.payment_date).toLocaleDateString("en-GB")}</span></td>
                            <td>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#f8f1de", color: "#8a7338", padding: "3px 10px", borderRadius: 20, fontSize: "0.68rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                                {r.payment_method?.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td><span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#8a7338" }}>{r.receipt_number || "—"}</span></td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="lr-tfoot-row">
                          <td colSpan={1} style={{ paddingLeft: "0.8rem", fontSize: "0.72rem", fontWeight: 800, color: "#8a7338", textTransform: "uppercase" }}>Jumla</td>
                          <td style={{ fontWeight: 800, fontSize: "0.82rem", color: "#102a43", whiteSpace: "nowrap" }}>
                            {fmtAmt(selectedLoan.repayments.reduce((s: number, r: any) => s + Number(r.amount), 0))}
                          </td>
                          <td colSpan={3} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      <style>{`
        /* ── Sticky header ── */
        .ph-bar{display:flex;align-items:stretch;background:#0d2137;position:sticky;top:0;z-index:100;border-bottom:2px solid #e2bc8a;min-height:50px}
        .ph-inner{display:flex;align-items:flex-end;gap:4px;padding:10px 14px 0;flex:1;overflow-x:auto;scrollbar-width:none}
        .ph-brand{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;color:#e2bc8a;white-space:nowrap;padding-bottom:10px;flex-shrink:0}
        .ph-actions{display:flex;align-items:center;gap:8px;padding:6px 14px;flex-shrink:0;border-left:1px solid rgba(226,188,138,0.3);background:#0d2137}

        /* ── Profile strip ── */
        .lr-profile-strip{display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap}
        .lr-strip-div{width:1px;height:48px;background:#efe6d0;flex-shrink:0}
        .lr-info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0.65rem 1.5rem;flex:1}
        .lr-info-item{display:flex;align-items:flex-start;gap:0.45rem}
        .lr-info-icon{color:#8a7338;margin-top:2px;flex-shrink:0}
        .lr-info-label{font-size:0.63rem;font-weight:700;color:#9fb3c8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:1px}
        .lr-info-val{font-size:0.82rem;font-weight:600;color:#3f3318}

        /* ── Fin summary strip ── */
        .lr-fin-strip{display:flex;align-items:center;flex:1;flex-wrap:wrap}
        .lr-fin-item{display:flex;flex-direction:column;padding:0.3rem 1.2rem;gap:3px}
        .lr-fin-sep{width:1px;height:36px;background:rgba(226,188,138,0.25);flex-shrink:0}
        .lr-fin-label{font-size:0.63rem;font-weight:700;color:#9fb3c8;text-transform:uppercase;letter-spacing:0.8px}
        .lr-fin-val{font-size:0.9rem;font-weight:800;color:#e2bc8a}
        .lr-fin-val--large{font-size:1rem}

        /* ── Body grid ── */
        .lr-body-grid{display:grid;grid-template-columns:1fr 1fr;min-height:400px}
        @media(max-width:900px){.lr-body-grid{grid-template-columns:1fr}}

        /* ── Form ── */
        .lr-form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem}
        .lr-label{font-size:0.82rem;font-weight:700;color:#7a6a4a}
        .lr-input{padding:0.75rem 1rem;border-radius:10px;border:1px solid #e3d7b0;font-size:0.92rem;background:#fffcf6;outline:none;font-family:inherit;width:100%;box-sizing:border-box}
        .lr-input:focus{border-color:#e2bc8a;box-shadow:0 0 0 3px rgba(226,188,138,0.15)}

        /* ── History table ── */
        .lr-hist-table{width:100%;border-collapse:collapse;font-family:'Inter',sans-serif}
        .lr-hist-table thead tr{background:#f8f1de;border-bottom:2px solid #e2bc8a}
        .lr-hist-table thead th{padding:0.7rem 0.75rem;text-align:left;font-size:0.6rem;font-weight:800;text-transform:uppercase;letter-spacing:1.1px;color:#8a7338;white-space:nowrap;border-right:1px solid #efe6d0}
        .lr-hist-table thead th:last-child{border-right:none}
        .lr-hist-table tbody td{padding:0.8rem 0.75rem;vertical-align:middle;border-bottom:1px solid #f0e8d0;border-right:1px solid #f5efe0}
        .lr-hist-table tbody td:last-child{border-right:none}
        .lr-row-even{background:#ffffff}
        .lr-row-odd{background:#fffcf6}
        .lr-hist-table tbody tr:hover{background:#fdf5e3}
        .lr-row-num{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:#102a43;color:#e2bc8a;font-size:0.68rem;font-weight:800}
        .lr-tfoot-row{background:linear-gradient(135deg,#102a43,#1d3a5f)}
        .lr-tfoot-row td{padding:0.75rem 0.75rem;border-top:2px solid #e2bc8a;border-right:1px solid rgba(226,188,138,0.2)}
        .lr-tfoot-row td:last-child{border-right:none}

        /* ── Mobile ── */
        @media(max-width:640px){
          .lr-strip-div{display:none}
          .lr-profile-strip{gap:0.75rem}
          .lr-fin-item{padding:0.3rem 0.7rem}
          .lr-body-grid>div:first-child{border-right:none;border-bottom:1px solid #efe6d0}
        }
      `}</style>
    </div>
  );
};

const rcptBtn = (bg: string): React.CSSProperties => ({
  display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
  padding: "0.75rem", borderRadius: 12, background: bg, border: "none", color: "white",
  fontWeight: 700, fontSize: "0.8rem", cursor: "pointer",
});

export default LoanRepayments;
