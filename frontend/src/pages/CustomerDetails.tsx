import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import AlertModal from "../components/AlertModal";
import { API_BASE, fmtLoanId } from "../lib/api";

// INLINE SVG ICONS
const IconArrowLeft = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>;
const IconMapPin = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IconPhone = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const IconFingerprint = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12a10 10 0 0 1 18 0"/><path d="M7 12a5 5 0 0 1 5-5"/><path d="M12 12a5 5 0 0 1 5-5"/><path d="M12 7V3"/><path d="M12 21v-4"/><path d="M12 12v3"/><path d="M12 15a3 3 0 0 1 3-3"/></svg>;
const IconShield = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IconCreditCard = ({ size = 16 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
const IconHistory = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/><path d="M12 7v5l4 2"/></svg>;
const IconFileText = ({ size = 16 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
const IconTrendingDown = ({ size = 16 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 17L13.5 8.5L8.5 13.5L2 7"/><polyline points="16 17 22 17 22 11"/></svg>;
const IconUser = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IconX = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

interface Loan {
  id: number;
  type: string;
  amount: number;
  remaining_balance: number;
  total_paid: number;
  status: string;
  created_at: string;
  arrears: number;
  penalty: number;
  repayments: any[];
  schedules: any[];
}

interface Customer {
  id: number;
  full_name: string;
  phone_number: string;
  email: string;
  nida_number: string;
  region: string;
  district: string;
  ward: string;
  street: string;
  residency_type: string;
  gender: string;
  date_of_birth: string;
  loans: Loan[];
}

const fmtAmt = (v: any) => `TZS ${Number(v || 0).toLocaleString()}`;

const CustomerDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Derive role prefix from current URL so navigation stays in the same role context
  // e.g. /finance/customers/1 → prefix "finance", /customers/1 → prefix ""
  const routePrefix = pathname.split('/').filter(Boolean)[0];
  const knownPrefixes = ['admin', 'finance', 'lm', 'gm', 'md', 'officer'];
  const prefix = knownPrefixes.includes(routePrefix) ? routePrefix : '';
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState<"success" | "error" | "info" | "warning">("info");

  // Admin role check
  const isAdmin = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}").role === "admin"; } catch { return false; } })();

  // Delete loan state
  const [deletingLoanId, setDeletingLoanId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; loan: Loan | null }>({ open: false, loan: null });

  // Schedule modal state
  const [schedModal, setSchedModal] = useState<{ open: boolean; loanId: number | null; name: string; loanNum: string }>({ open: false, loanId: null, name: "", loanNum: "" });
  const [schedRows, setSchedRows] = useState<any[]>([]);
  const [schedLoading, setSchedLoading] = useState(false);

  useEffect(() => {
    fetchCustomerDetails();
  }, [id]);

  const fetchCustomerDetails = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE}/customers/${id}`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      setCustomer(res.data);
    } catch (err) {
      console.error(err);
      setModalMessage("Imeshindwa kupata taarifa za mteja");
      setModalType("error");
      setShowModal(true);
    } finally {
      setLoading(false);
    }
  };

  const openSchedule = async (loan: Loan) => {
    setSchedModal({ open: true, loanId: loan.id, name: customer?.full_name || "", loanNum: `Loan #${fmtLoanId(loan.id)}` });
    setSchedRows([]);
    setSchedLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE}/loans/${loan.id}/schedule`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const raw = res.data?.data ?? res.data;
      setSchedRows(Array.isArray(raw) ? raw : []);
    } catch (err) {
      console.error(err);
    } finally {
      setSchedLoading(false);
    }
  };

  const handleDeleteLoan = async () => {
    if (!confirmDelete.loan) return;
    const loan = confirmDelete.loan;
    setConfirmDelete({ open: false, loan: null });
    setDeletingLoanId(loan.id);
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE}/loans/${loan.id}`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      setModalMessage(`Mkopo #${fmtLoanId(loan.id)} umefutwa.`);
      setModalType("success");
      setShowModal(true);
      fetchCustomerDetails();
    } catch (err: any) {
      setModalMessage(err.response?.data?.message || "Imeshindwa kufuta mkopo.");
      setModalType("error");
      setShowModal(true);
    } finally {
      setDeletingLoanId(null);
    }
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#fffcf6" }}>
      <div className="cd-loader"></div>
    </div>
  );

  if (!customer) return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h2>Mteja hajapatikana</h2>
      <button onClick={() => navigate("/customers")} style={{ padding: "0.5rem 1rem", background: "#102a43", color: "#e2bc8a", border: "none", borderRadius: "8px", cursor: "pointer", marginTop: "1rem" }}>
        Rudi Nyuma
      </button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#fffcf6", padding: "0 0 48px", fontFamily: "'Inter',sans-serif" }}>
      <AlertModal
        isOpen={showModal}
        message={modalMessage}
        type={modalType}
        onClose={() => setShowModal(false)}
      />

      {/* DELETE CONFIRM MODAL */}
      {confirmDelete.open && confirmDelete.loan && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", backdropFilter: "blur(8px)", background: "rgba(0,0,0,0.55)" }}>
          <div style={{ width: "100%", maxWidth: 420, borderRadius: 20, background: "white", overflow: "hidden", boxShadow: "0 25px 60px rgba(0,0,0,0.35)" }}>
            <div style={{ background: "linear-gradient(135deg,#7f1d1d,#dc2626)", padding: "1.4rem 1.6rem", color: "white" }}>
              <div style={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: "#fca5a5", marginBottom: 8 }}>⚠ Hatua Isiyoweza Kurudishwa</div>
              <div style={{ fontSize: "1rem", fontWeight: 800 }}>Futa Mkopo</div>
            </div>
            <div style={{ padding: "1.4rem 1.6rem" }}>
              <p style={{ fontSize: "0.88rem", color: "#3f3318", fontWeight: 600, marginBottom: "0.5rem" }}>
                Una uhakika wa kufuta mkopo huu?
              </p>
              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "0.8rem 1rem", marginBottom: "1.2rem" }}>
                <div style={{ fontSize: "0.78rem", color: "#7f1d1d", fontWeight: 700 }}>
                  {confirmDelete.loan.type?.replace(/_/g, " ")} — Loan #{fmtLoanId(confirmDelete.loan.id)}
                </div>
                <div style={{ fontSize: "0.82rem", color: "#991b1b", fontWeight: 800, marginTop: 4 }}>
                  {`TZS ${Number(confirmDelete.loan.amount).toLocaleString()}`} · Status: {confirmDelete.loan.status}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  onClick={() => setConfirmDelete({ open: false, loan: null })}
                  style={{ flex: 1, padding: "0.8rem", borderRadius: 12, background: "#f8f1de", border: "1px solid #efe6d0", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", color: "#8a7338" }}
                >
                  Ghairi
                </button>
                <button
                  onClick={handleDeleteLoan}
                  style={{ flex: 1, padding: "0.8rem", borderRadius: 12, background: "linear-gradient(135deg,#dc2626,#b91c1c)", border: "none", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", color: "white" }}
                >
                  Ndio, Futa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCHEDULE MODAL */}
      {schedModal.open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", backdropFilter: "blur(10px)", background: "rgba(0,0,0,0.6)" }}>
          <div style={{ width: "100%", maxWidth: 780, maxHeight: "85vh", borderRadius: 24, background: "#fffcf6", border: "1px solid #e3d7b0", boxShadow: "0 30px 70px rgba(74,60,26,0.35)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Modal header */}
            <div style={{ position: "relative", background: "linear-gradient(135deg,#102a43 0%,#1d3a5f 55%,#2c5282 100%)", padding: "1.5rem 1.7rem 1.7rem", color: "white", display: "flex", justifyContent: "space-between", alignItems: "flex-start", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(226,188,138,0.12)" }} />
              <div style={{ position: "relative", zIndex: 1 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.62rem", fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: "#e2bc8a", background: "rgba(226,188,138,0.15)", padding: "4px 10px", borderRadius: 20, marginBottom: 10 }}>
                  📅 Loan Repayment Plan
                </span>
                <p style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", color: "#cbd9ea", fontWeight: 700, letterSpacing: "0.3px" }}>
                  {schedModal.name} <span style={{ color: "#e2bc8a" }}>•</span> {schedModal.loanNum}
                </p>
              </div>
              <button
                onClick={() => setSchedModal({ open: false, loanId: null, name: "", loanNum: "" })}
                style={{ position: "relative", zIndex: 1, width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.25)", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                onMouseOver={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.26)"; }}
                onMouseOut={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; }}
              >
                <IconX />
              </button>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg,#e2bc8a,#c19a6b 50%,#e2bc8a)" }} />
            </div>
            {/* Modal body */}
            <div style={{ padding: "1.3rem 1.6rem 1.6rem", overflowY: "auto", background: "#fffcf6" }}>
              {schedLoading ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "#8a7338", fontWeight: 600 }}>Loading schedule...</div>
              ) : (
                <div style={{ borderRadius: 16, border: "1px solid #efe6d0", overflow: "hidden", background: "#ffffff" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8f1de" }}>
                        {["#", "Due Date", "Principal", "Interest", "Total", "Status"].map((h, i) => (
                          <th key={h} style={{ textAlign: i >= 2 && i <= 4 ? "right" : "left", padding: "0.85rem 0.9rem", fontSize: "0.62rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.2px", color: "#8a7338", borderBottom: "1.5px solid #efe6d0" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {schedRows.map((s: any, idx: number) => {
                        const principal = Number(s.principal_amount ?? s.principal ?? 0);
                        const interest = Number(s.interest_amount ?? s.interest ?? 0);
                        const total = Number(s.total_amount ?? (principal + interest));
                        const st = (s.status || "pending").toLowerCase();
                        const cfg = st === "paid"
                          ? { bg: "#ecfdf5", color: "#059669", dot: "#10b981", label: "Paid" }
                          : st === "overdue"
                            ? { bg: "#fef2f2", color: "#dc2626", dot: "#ef4444", label: "Overdue" }
                            : { bg: "#fff7e6", color: "#b45309", dot: "#f59e0b", label: "Pending" };
                        return (
                          <tr key={s.id || idx}
                            style={{ background: idx % 2 === 0 ? "#ffffff" : "#fffcf6", borderBottom: "1px solid #f5efe0", transition: "background 0.15s" }}
                            onMouseOver={(e) => { e.currentTarget.style.background = "#fbf3e0"; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = idx % 2 === 0 ? "#ffffff" : "#fffcf6"; }}>
                            <td style={{ padding: "0.85rem 0.9rem" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 30, height: 24, padding: "0 8px", borderRadius: 8, background: "#102a43", color: "#e2bc8a", fontWeight: 800, fontSize: "0.74rem" }}>#{s.installment_number ?? (idx + 1)}</span>
                            </td>
                            <td style={{ padding: "0.85rem 0.9rem", fontSize: "0.8rem", color: "#7a6a4a", fontWeight: 600 }}>{s.due_date ? new Date(s.due_date).toLocaleDateString("en-GB") : "—"}</td>
                            <td style={{ padding: "0.85rem 0.9rem", textAlign: "right", fontWeight: 700, color: "#3f3318", fontSize: "0.82rem" }}>{fmtAmt(principal)}</td>
                            <td style={{ padding: "0.85rem 0.9rem", textAlign: "right", fontWeight: 700, color: "#8a7a52", fontSize: "0.82rem" }}>{fmtAmt(interest)}</td>
                            <td style={{ padding: "0.85rem 0.9rem", textAlign: "right", fontWeight: 900, color: "#102a43", fontSize: "0.86rem" }}>{fmtAmt(total)}</td>
                            <td style={{ padding: "0.85rem 0.9rem" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: cfg.bg, color: cfg.color, padding: "5px 12px", borderRadius: 20, fontSize: "0.68rem", fontWeight: 800, wordBreak: "break-word" }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, display: "inline-block" }} />
                                {cfg.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {schedRows.length === 0 && !schedLoading && (
                        <tr><td colSpan={6} style={{ textAlign: "center", padding: "2.5rem", color: "#8a7338", fontWeight: 600 }}>No schedule generated yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PH-BAR STICKY HEADER */}
      <div className="ph-bar">
        <div className="ph-inner">
          <div className="ph-brand">
            <IconUser />
            <span>Customer Profile</span>
          </div>
        </div>
        <div className="ph-actions">
          <button
            onClick={() => navigate(-1)}
            style={{ background: "rgba(226,188,138,0.15)", border: "1px solid rgba(226,188,138,0.3)", borderRadius: "8px", padding: "6px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 700, color: "#e2bc8a" }}
          >
            <IconArrowLeft /> Back
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 20px 40px" }}>

        {/* MAIN CARD */}
        <div style={{ background: "white", borderRadius: 20, border: "1px solid #efe6d0", boxShadow: "0 20px 50px rgba(74,60,26,0.12)", overflow: "hidden" }}>

          {/* CARD HEADER — navy gradient */}
          <div style={{ background: "linear-gradient(135deg,#102a43 0%,#1d3a5f 55%,#2c5282 100%)", padding: "1.5rem 1.7rem 1.7rem", color: "white", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(226,188,138,0.12)" }} />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.62rem", fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: "#e2bc8a", background: "rgba(226,188,138,0.15)", padding: "4px 10px", borderRadius: 20, marginBottom: 10 }}>
              👤 Customer Profile
            </span>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ margin: "0.35rem 0 0", fontSize: "1.1rem", color: "white", fontWeight: 800 }}>{customer.full_name}</p>
              <span style={{ background: "rgba(226,188,138,0.2)", color: "#e2bc8a", padding: "4px 14px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 700 }}>{customer.phone_number}</span>
            </div>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg,#e2bc8a,#c19a6b 50%,#e2bc8a)" }} />
          </div>

          {/* CARD BODY — unified single column */}
          <div style={{ background: "#fffcf6" }}>

            {/* ── PROFILE INFO STRIP ── */}
            <div style={{ padding: "1.2rem 1.7rem", background: "white", borderBottom: "1px solid #efe6d0" }}>
              <div className="cd-profile-strip">
                {/* Avatar + name */}
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: "0 0 auto" }}>
                  <div style={{ width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg,#102a43,#1d3a5f)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", fontWeight: 800, color: "#e2bc8a", flexShrink: 0 }}>
                    {customer.full_name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#102a43" }}>{customer.full_name}</div>
                    <span style={{ display: "inline-block", background: "rgba(226,188,138,0.15)", color: "#8a7338", padding: "2px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700, marginTop: 3 }}>Loan Customer</span>
                  </div>
                </div>

                {/* Divider */}
                <div className="cd-strip-div" />

                {/* Contact details */}
                <div className="cd-info-grid">
                  <div className="cd-info-item">
                    <span className="cd-info-icon"><IconPhone /></span>
                    <div>
                      <div className="cd-info-label">Simu</div>
                      <div className="cd-info-val">{customer.phone_number}</div>
                    </div>
                  </div>
                  <div className="cd-info-item">
                    <span className="cd-info-icon"><IconFingerprint /></span>
                    <div>
                      <div className="cd-info-label">NIDA</div>
                      <div className="cd-info-val">{customer.nida_number || "N/A"}</div>
                    </div>
                  </div>
                  <div className="cd-info-item">
                    <span className="cd-info-icon"><IconMapPin /></span>
                    <div>
                      <div className="cd-info-label">Mahali</div>
                      <div className="cd-info-val">{[customer.street, customer.ward].filter(Boolean).join(", ") || "—"}</div>
                    </div>
                  </div>
                  <div className="cd-info-item">
                    <span className="cd-info-icon"><IconShield /></span>
                    <div>
                      <div className="cd-info-label">Makazi</div>
                      <div className="cd-info-val">{customer.residency_type ? `${customer.residency_type} Resident` : "—"}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── FINANCIAL SUMMARY STRIP ── */}
            <div style={{ background: "#102a43", padding: "1rem 1.7rem", display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginRight: "1rem" }}>
                <IconTrendingDown size={16} />
                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#e2bc8a", textTransform: "uppercase", letterSpacing: "1px" }}>Muhtasari wa Fedha</span>
              </div>
              <div className="cd-fin-strip">
                <div className="cd-fin-item">
                  <span className="cd-fin-label">Jumla ya Mikopo</span>
                  <span className="cd-fin-val">{customer.loans.length}</span>
                </div>
                <div className="cd-fin-sep" />
                <div className="cd-fin-item">
                  <span className="cd-fin-label">Madeni Amilifu</span>
                  <span className="cd-fin-val">{customer.loans.filter(l => l.status === "disbursed").length}</span>
                </div>
                <div className="cd-fin-sep" />
                <div className="cd-fin-item">
                  <span className="cd-fin-label">Deni Lililobaki</span>
                  <span className="cd-fin-val cd-fin-val--large">{fmtAmt(customer.loans.reduce((sum, l) => sum + Number(l.remaining_balance), 0))}</span>
                </div>
              </div>
            </div>

            {/* ── LOAN HISTORY TABLE ── flush, no gap */}
            <div>
              {/* Table card — no border-radius top, connects directly to fin strip */}
              <div style={{ background: "white", borderTop: "none", overflow: "hidden" }}>

                  {/* Table header bar */}
                  <div style={{ background: "linear-gradient(135deg,#102a43,#1d3a5f)", padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <span style={{ background: "rgba(226,188,138,0.18)", borderRadius: 8, padding: "6px 8px", display: "flex", alignItems: "center" }}>
                        <IconHistory />
                      </span>
                      <div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", letterSpacing: "0.2px" }}>Historia ya Mikopo</div>
                        <div style={{ fontSize: "0.72rem", color: "#9fb3c8", fontWeight: 600, marginTop: 1 }}>Loan History</div>
                      </div>
                    </div>
                    <span style={{ background: "rgba(226,188,138,0.18)", color: "#e2bc8a", padding: "4px 12px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.5px" }}>
                      {customer.loans.length} record{customer.loans.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {customer.loans.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "4rem 2rem", color: "#7a6a4a" }}>
                      <div style={{ fontSize: "2.5rem", marginBottom: "0.8rem" }}>📋</div>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Hakuna mikopo iliyorekodiwa</div>
                      <div style={{ fontSize: "0.8rem", marginTop: "0.3rem", color: "#b0a080" }}>No loans recorded for this customer.</div>
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table className="cd-loan-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Aina / Type</th>
                            <th>Kiasi</th>
                            <th>Deni Lililobaki</th>
                            <th>Malimbikizo</th>
                            <th>Adhabu</th>
                            <th>Tarehe</th>
                            <th>Maendeleo</th>
                            <th>Hali</th>
                            <th>Vitendo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customer.loans.map((loan, idx) => {
                            const pct = loan.amount > 0 ? Math.min(100, Math.round((Number(loan.total_paid) / loan.amount) * 100)) : 0;
                            const st = loan.status;
                            const stCfg = st === "completed" || st === "paid"
                              ? { bg: "#ecfdf5", color: "#059669", dot: "#10b981", label: "Completed" }
                              : st === "disbursed" || st === "approved_by_md" || st === "approved"
                                ? { bg: "#fff7e6", color: "#b45309", dot: "#f59e0b", label: st === "disbursed" ? "Active" : "Approved" }
                                : st === "written_off"
                                  ? { bg: "#f1f5f9", color: "#64748b", dot: "#94a3b8", label: "Written Off" }
                                  : st === "defaulted"
                                    ? { bg: "#fef2f2", color: "#dc2626", dot: "#ef4444", label: "Defaulted" }
                                    : { bg: "#f8f1de", color: "#8a7338", dot: "#c19a6b", label: st.replace(/_/g, " ") };
                            const pctColor = pct >= 80 ? "#059669" : pct >= 40 ? "#b45309" : "#dc2626";
                            return (
                              <tr key={loan.id} className={`cd-loan-row ${idx % 2 === 0 ? "cd-row-even" : "cd-row-odd"}`}>
                                {/* # */}
                                <td style={{ paddingLeft: "1rem" }}>
                                  <span className="cd-row-num">{idx + 1}</span>
                                </td>

                                {/* Type */}
                                <td>
                                  <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#102a43", textTransform: "capitalize" }}>
                                    {loan.type.replace(/_/g, " ")}
                                  </div>
                                  <div style={{ fontSize: "0.68rem", color: "#8a7338", fontWeight: 600, marginTop: 2 }}>Loan #{fmtLoanId(loan.id)}</div>
                                </td>

                                {/* Amount */}
                                <td>
                                  <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "#102a43", wordBreak: "break-word" }}>{fmtAmt(loan.amount)}</div>
                                </td>

                                {/* Remaining balance */}
                                <td>
                                  <div style={{ fontWeight: 700, fontSize: "0.82rem", color: loan.remaining_balance > 0 ? "#102a43" : "#059669", wordBreak: "break-word" }}>
                                    {fmtAmt(loan.remaining_balance)}
                                  </div>
                                </td>

                                {/* Arrears */}
                                <td>
                                  <div style={{ fontWeight: 700, fontSize: "0.82rem", color: loan.arrears > 0 ? "#dc2626" : "#059669", wordBreak: "break-word" }}>
                                    {fmtAmt(loan.arrears)}
                                  </div>
                                </td>

                                {/* Penalty */}
                                <td>
                                  <div style={{ fontWeight: 700, fontSize: "0.82rem", color: loan.penalty > 0 ? "#b45309" : "#059669", wordBreak: "break-word" }}>
                                    {fmtAmt(loan.penalty)}
                                  </div>
                                </td>

                                {/* Date */}
                                <td>
                                  <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#5a4e38", wordBreak: "break-word" }}>
                                    {new Date(loan.created_at).toLocaleDateString("en-GB")}
                                  </div>
                                </td>

                                {/* Progress */}
                                <td>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <div style={{ flex: 1, height: 7, background: "#f5efe0", borderRadius: 10, overflow: "hidden" }}>
                                      <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg,${pctColor},${pctColor}cc)`, borderRadius: 10, transition: "width 0.4s" }} />
                                    </div>
                                    <span style={{ fontSize: "0.72rem", fontWeight: 800, color: pctColor, minWidth: 28, textAlign: "right" }}>{pct}%</span>
                                  </div>
                                </td>

                                {/* Status */}
                                <td>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: stCfg.bg, color: stCfg.color, padding: "4px 10px", borderRadius: 20, fontSize: "0.68rem", fontWeight: 800, whiteSpace: "nowrap" }}>
                                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: stCfg.dot, display: "inline-block", flexShrink: 0 }} />
                                    {stCfg.label}
                                  </span>
                                </td>

                                {/* Actions */}
                                <td style={{ paddingRight: "1rem" }}>
                                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                    <button
                                      onClick={() => openSchedule(loan)}
                                      className="cd-act-btn cd-act-btn--ghost"
                                      title="View repayment schedule"
                                    >
                                      <IconFileText size={14} />
                                    </button>
                                    <button
                                      onClick={() => navigate(prefix ? `/${prefix}/customers/${customer.id}/repayments` : `/customers/${customer.id}/repayments`)}
                                      className="cd-act-btn cd-act-btn--primary"
                                      title="Record repayment"
                                    >
                                      <IconCreditCard size={14} />
                                    </button>
                                    {isAdmin && (
                                      <button
                                        onClick={() => setConfirmDelete({ open: true, loan })}
                                        className="cd-act-btn cd-act-btn--danger"
                                        title="Delete loan"
                                        disabled={deletingLoanId === loan.id}
                                        style={{ opacity: deletingLoanId === loan.id ? 0.5 : 1 }}
                                      >
                                        {deletingLoanId === loan.id
                                          ? <span style={{ width: 14, height: 14, border: "2px solid #fff", borderTop: "2px solid transparent", borderRadius: "50%", display: "inline-block", animation: "cd-spin 0.7s linear infinite" }} />
                                          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                                        }
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>

                        {/* Summary footer row */}
                        <tfoot>
                          <tr className="cd-tfoot-row">
                            <td colSpan={2} style={{ paddingLeft: "1rem", fontSize: "0.75rem", fontWeight: 800, color: "#8a7338", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                              Jumla / Total
                            </td>
                            <td style={{ fontWeight: 800, fontSize: "0.84rem", color: "#102a43", wordBreak: "break-word" }}>
                              {fmtAmt(customer.loans.reduce((s, l) => s + Number(l.amount), 0))}
                            </td>
                            <td style={{ fontWeight: 800, fontSize: "0.84rem", color: "#102a43", wordBreak: "break-word" }}>
                              {fmtAmt(customer.loans.reduce((s, l) => s + Number(l.remaining_balance), 0))}
                            </td>
                            <td style={{ fontWeight: 800, fontSize: "0.84rem", color: "#dc2626", wordBreak: "break-word" }}>
                              {fmtAmt(customer.loans.reduce((s, l) => s + Number(l.arrears), 0))}
                            </td>
                            <td style={{ fontWeight: 800, fontSize: "0.84rem", color: "#b45309", wordBreak: "break-word" }}>
                              {fmtAmt(customer.loans.reduce((s, l) => s + Number(l.penalty), 0))}
                            </td>
                            <td colSpan={4} />
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

        /* ── Loader ── */
        .cd-loader{width:48px;height:48px;border:5px solid #f5efe0;border-bottom-color:#e2bc8a;border-radius:50%;display:inline-block;box-sizing:border-box;animation:cd-spin 1s linear infinite}
        @keyframes cd-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}

        /* ── Profile strip ── */
        .cd-profile-strip{display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap}
        .cd-strip-div{width:1px;height:48px;background:#efe6d0;flex-shrink:0}
        .cd-info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.75rem 1.5rem;flex:1}
        .cd-info-item{display:flex;align-items:flex-start;gap:0.5rem}
        .cd-info-icon{color:#8a7338;margin-top:2px;flex-shrink:0}
        .cd-info-label{font-size:0.64rem;font-weight:700;color:#9fb3c8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:2px}
        .cd-info-val{font-size:0.82rem;font-weight:600;color:#3f3318}

        /* ── Financial summary strip ── */
        .cd-fin-strip{display:flex;align-items:center;flex:1;flex-wrap:wrap}
        .cd-fin-item{display:flex;flex-direction:column;padding:0.3rem 1.5rem;gap:3px}
        .cd-fin-sep{width:1px;height:36px;background:rgba(226,188,138,0.25);flex-shrink:0}
        .cd-fin-label{font-size:0.65rem;font-weight:700;color:#9fb3c8;text-transform:uppercase;letter-spacing:0.8px}
        .cd-fin-val{font-size:0.92rem;font-weight:800;color:#e2bc8a}
        .cd-fin-val--large{font-size:1rem}

        /* ── Loan table ── */
        .cd-loan-table{width:100%;border-collapse:collapse;font-family:'Inter',sans-serif}
        .cd-loan-table thead tr{background:#f8f1de;border-bottom:2px solid #e2bc8a}
        .cd-loan-table thead th{padding:0.75rem 0.8rem;text-align:left;font-size:0.62rem;font-weight:800;text-transform:uppercase;letter-spacing:1.1px;color:#8a7338;white-space:nowrap;border-right:1px solid #efe6d0}
        .cd-loan-table thead th:last-child{border-right:none}
        .cd-loan-table tbody td{padding:0.9rem 0.8rem;vertical-align:middle;border-bottom:1px solid #f0e8d0;border-right:1px solid #f5efe0}
        .cd-loan-table tbody td:last-child{border-right:none}
        .cd-row-even{background:#ffffff}
        .cd-row-odd{background:#fffcf6}
        .cd-loan-row{transition:background 0.15s}
        .cd-loan-row:hover{background:#fdf5e3 !important}
        .cd-loan-row:hover td{border-right-color:#e8d8b0}
        .cd-row-num{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;background:#102a43;color:#e2bc8a;font-size:0.7rem;font-weight:800}
        .cd-tfoot-row{background:linear-gradient(135deg,#102a43,#1d3a5f)}
        .cd-tfoot-row td{padding:0.85rem 0.8rem;border-top:2px solid #e2bc8a;border-right:1px solid rgba(226,188,138,0.2)}
        .cd-tfoot-row td:last-child{border-right:none}

        /* ── Buttons ── */
        .cd-act-btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;padding:7px 9px;border-radius:8px;font-size:0.72rem;font-weight:700;cursor:pointer;white-space:nowrap;border:none;transition:all 0.15s}
        .cd-act-btn--ghost{background:#f8f1de;color:#8a7338;border:1px solid #efe6d0}
        .cd-act-btn--ghost:hover{background:#f0e4c4;border-color:#e2bc8a}
        .cd-act-btn--primary{background:linear-gradient(135deg,#102a43,#1d3a5f);color:#e2bc8a}
        .cd-act-btn--primary:hover{background:linear-gradient(135deg,#1d3a5f,#2c5282)}
        .cd-act-btn--danger{background:#fef2f2;color:#dc2626;border:1px solid #fca5a5}
        .cd-act-btn--danger:hover{background:#fee2e2;border-color:#ef4444}

        /* ── Mobile ── */
        @media (max-width:640px){
          .cd-loan-table thead th,.cd-loan-table tbody td{padding:0.65rem 0.5rem}
          .cd-act-btn span{display:none}
          .cd-act-btn{padding:6px}
          .cd-strip-div{display:none}
          .cd-profile-strip{gap:0.75rem}
          .cd-fin-item{padding:0.3rem 0.8rem}
        }

        /* ── PRINT / PDF ── */
        @media print {
          @page { size: A4 landscape; margin: 1.2cm 1.5cm; }
          .ph-bar,.cd-act-btn { display: none !important; }
          body, html { overflow: visible !important; }
          .cd-profile-strip { flex-wrap: nowrap !important; }
          .cd-strip-div { display: block !important; }
          .cd-fin-strip { flex-wrap: nowrap !important; }
          .cd-loan-table { font-size: 0.7rem !important; }
          .cd-loan-table thead th,
          .cd-loan-table tbody td,
          .cd-tfoot-row td { padding: 0.4rem 0.45rem !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
};

export default CustomerDetails;
