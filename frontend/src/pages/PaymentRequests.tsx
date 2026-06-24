import { useEffect, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Send, CheckCircle2, XCircle, Clock, X, Inbox, PlusCircle, Paperclip, ShieldCheck, User, ClipboardList, Wallet, Banknote, CreditCard, PenLine, ArrowRight } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
const fmt = (v: any, cur = "TZS") => `${cur} ${Math.round(Number(v) || 0).toLocaleString()}`;
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

const ACTIVITY_TYPES = [
  "Loan", "Duties", "Tax", "Transportation", "Permits", "Bank charges", "Postage Charges",
  "Office cleaning & maintenance", "Office equipment repairs", "Utilities", "ICT & Software bills", "Rents fees", "Other",
];

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  manager_review: { label: "Awaiting Loan Manager", bg: "#eef2ff", color: "#4f46e5" },
  gm_review: { label: "Awaiting General Manager", bg: "#fff7ed", color: "#ea580c" },
  md_review: { label: "Awaiting Managing Director", bg: "#fdf4ff", color: "#a21caf" },
  authorized: { label: "Authorized", bg: "#ecfdf5", color: "#059669" },
  rejected: { label: "Rejected", bg: "#fef2f2", color: "#dc2626" },
};

const CARD: React.CSSProperties = { background: "white", borderRadius: 14, border: "1px solid #eef1f6", boxShadow: "0 6px 18px rgba(15,23,42,0.07)" };
const inp: React.CSSProperties = { width: "100%", padding: "0.65rem 0.8rem", borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", outline: "none", fontWeight: 600, fontSize: "0.85rem", color: "#1e293b", boxSizing: "border-box", fontFamily: "inherit" };

const PaymentRequests = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user?.role;
  const [tab, setTab] = useState<"new" | "list">("list");
  const [requests, setRequests] = useState<any[]>([]);
  const [scope, setScope] = useState<"queue" | "mine" | "all">("queue");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  // Form state
  const blank = {
    applicant_name: user?.name || "", department: "", section: "", activity_type: "Loan", activity_detail: "",
    loan_applicant_name: "", invoice_path: "", mode_of_payment: "cash", payable_to: "", currency: "TZS",
    amount: "", amount_in_words: "", applicant_signature: user?.name || "", applicant_date: new Date().toISOString().slice(0, 10),
  };
  const [form, setForm] = useState<any>(blank);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Approval state
  const [adjustedAmount, setAdjustedAmount] = useState("");
  const [comments, setComments] = useState("");
  const [acting, setActing] = useState(false);

  const headers = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const canDecide = (status: string) => {
    if (role === "admin") return true;
    if (status === "manager_review") return role === "loan_manager";
    if (status === "gm_review") return role === "general_manager";
    if (status === "md_review") return role === "managing_director";
    return false;
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/payment-requests`, { headers: headers(), params: { scope } });
      setRequests(res.data.requests || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [scope]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const uploadInvoice = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post(`${API_BASE}/payment-requests/upload-invoice`, fd, { headers: { ...headers(), "Content-Type": "multipart/form-data" } });
      set("invoice_path", res.data.path);
    } catch (e) { console.error(e); alert("Upload failed"); } finally { setUploading(false); }
  };

  const submit = async () => {
    if (!form.applicant_name || !form.payable_to || !form.amount) { alert("Please fill applicant, payable to and amount."); return; }
    setSubmitting(true);
    try {
      await axios.post(`${API_BASE}/payment-requests`, { ...form, amount: Number(form.amount) }, { headers: headers() });
      setForm(blank);
      setTab("list"); setScope("mine");
      await load();
      alert("Payment request submitted.");
    } catch (e: any) { console.error(e); alert(e?.response?.data?.message || "Submit failed"); } finally { setSubmitting(false); }
  };

  const openDetail = (r: any) => { setSelected(r); setAdjustedAmount(""); setComments(""); };

  const approve = async () => {
    if (!selected) return;
    setActing(true);
    try {
      await axios.post(`${API_BASE}/payment-requests/${selected.id}/approve`, {
        adjusted_amount: adjustedAmount ? Number(adjustedAmount) : null, comments,
      }, { headers: headers() });
      setSelected(null); await load();
    } catch (e: any) { alert(e?.response?.data?.message || "Action failed"); } finally { setActing(false); }
  };

  const reject = async () => {
    if (!selected || !comments.trim()) { alert("Please provide a reason in comments to reject."); return; }
    setActing(true);
    try {
      await axios.post(`${API_BASE}/payment-requests/${selected.id}/reject`, { reason: comments }, { headers: headers() });
      setSelected(null); await load();
    } catch (e: any) { alert(e?.response?.data?.message || "Action failed"); } finally { setActing(false); }
  };

  return (
    <div style={{ minHeight: "100vh", maxWidth: "100%", overflowX: "hidden", boxSizing: "border-box", background: "#fdfbf7", padding: "0.7rem 1rem 1.5rem", fontFamily: "'Plus Jakarta Sans','Inter',sans-serif", color: "#1e293b" }}>

      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <FileText size={22} style={{ color: "#4f46e5" }} />
        <h1 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0, color: "#0f172a" }}>Request Form for Payment</h1>
        <div style={{ marginLeft: "auto", display: "flex", background: "#f1f5f9", padding: 4, borderRadius: 10, gap: 3 }}>
          {([["list", "Requests", Inbox], ["new", "New Request", PlusCircle]] as const).map(([k, lbl, Icon]) => (
            <button key={k} onClick={() => setTab(k)} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", borderRadius: 8, border: "none", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", background: tab === k ? "white" : "transparent", color: tab === k ? "#4f46e5" : "#64748b", boxShadow: tab === k ? "0 1px 4px rgba(15,23,42,0.1)" : "none" }}>
              <Icon size={15} /> {lbl}
            </button>
          ))}
        </div>
      </div>

      {tab === "new" ? (
        <div style={{ ...CARD, width: "100%", overflow: "hidden", padding: 0 }}>
          {/* HERO HEADER */}
          <div style={{ position: "relative", background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 55%, #9333ea 100%)", padding: "1.7rem 1.8rem", color: "white", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -40, right: -20, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
            <div style={{ position: "absolute", bottom: -60, right: 80, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(255,255,255,0.18)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <FileText size={26} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 900, letterSpacing: "-0.02em" }}>Request Form for Payment</h2>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", opacity: 0.9, fontWeight: 500 }}>Complete the form below — it routes automatically through the approval chain.</p>
              </div>
            </div>
            {/* Approval chain pills */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1.1rem", flexWrap: "wrap" }}>
              {["You", "Loan Manager", "General Manager", "Managing Director"].map((s, i) => (
                <span key={s} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ background: "rgba(255,255,255,0.16)", padding: "0.25rem 0.7rem", borderRadius: 20, fontSize: "0.68rem", fontWeight: 700 }}>{s}</span>
                  {i < 3 && <ArrowRight size={13} style={{ opacity: 0.7 }} />}
                </span>
              ))}
            </div>
          </div>

          <div style={{ padding: "1.6rem 1.8rem" }}>
            {/* SECTION 1: APPLICANT */}
            <Section icon={<User size={16} />} title="Applicant Information" hint="01 – 03">
              <div className="pr-grid3">
                <Field label="Full Name of Applicant" required><input className="pr-input" style={inp} value={form.applicant_name} onChange={(e) => set("applicant_name", e.target.value)} /></Field>
                <Field label="Department"><input className="pr-input" style={inp} value={form.department} onChange={(e) => set("department", e.target.value)} /></Field>
                <Field label="Section"><input className="pr-input" style={inp} value={form.section} onChange={(e) => set("section", e.target.value)} /></Field>
              </div>
            </Section>

            {/* SECTION 2: ACTIVITY */}
            <Section icon={<ClipboardList size={16} />} title="Payment Activity" hint="04 – 06">
              <div className="pr-grid3">
                <Field label="Type of Activity for Payment" required>
                  <select className="pr-input" style={inp} value={form.activity_type} onChange={(e) => set("activity_type", e.target.value)}>
                    {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Name of Loan Applicant"><input className="pr-input" style={inp} value={form.loan_applicant_name} onChange={(e) => set("loan_applicant_name", e.target.value)} placeholder="(if applicable)" /></Field>
                <Field label="Other Invoice (attach)">
                  <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.62rem 1rem", borderRadius: 10, border: `1.5px dashed ${form.invoice_path ? "#10b981" : "#cbd5e1"}`, background: form.invoice_path ? "#ecfdf5" : "#f8fafc", cursor: "pointer", fontSize: "0.8rem", fontWeight: 700, color: form.invoice_path ? "#059669" : "#475569", transition: "all 0.2s", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <Paperclip size={16} /> {uploading ? "Uploading..." : form.invoice_path ? "Attached ✓" : "Choose file"}
                    <input type="file" hidden accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => e.target.files?.[0] && uploadInvoice(e.target.files[0])} />
                  </label>
                </Field>
                <div className="pr-span-all">
                  <Field label="Activity Details"><textarea className="pr-input" style={{ ...inp, resize: "vertical" }} rows={2} placeholder="State details..." value={form.activity_detail} onChange={(e) => set("activity_detail", e.target.value)} /></Field>
                </div>
              </div>
            </Section>

            {/* SECTION 3: PAYMENT DETAILS */}
            <Section icon={<Wallet size={16} />} title="Payment Details" hint="07 – 08">
              <Field label="Mode of Payment" required>
                <div className="pr-grid3">
                  {[["cash", "Cash", <Banknote size={18} />], ["cheque", "Cheque", <FileText size={18} />], ["bank_transfer", "Bank Transfer", <CreditCard size={18} />]].map(([v, l, ic]: any) => {
                    const on = form.mode_of_payment === v;
                    return (
                      <button key={v} type="button" onClick={() => set("mode_of_payment", v)}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem", padding: "0.85rem 1rem", borderRadius: 12, border: on ? "2px solid #4f46e5" : "1.5px solid #e2e8f0", background: on ? "#eef2ff" : "white", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", color: on ? "#4f46e5" : "#64748b", transition: "all 0.2s", boxShadow: on ? "0 4px 12px rgba(79,70,229,0.18)" : "none" }}>
                        <span style={{ display: "flex", color: on ? "#4f46e5" : "#94a3b8" }}>{ic}</span> {l}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <div className="pr-grid3" style={{ marginTop: "1.1rem" }}>
                <Field label="Payable To" required><input className="pr-input" style={inp} placeholder="Beneficiary name..." value={form.payable_to} onChange={(e) => set("payable_to", e.target.value)} /></Field>
                <Field label="Currency">
                  <select className="pr-input" style={inp} value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                    <option value="TZS">TZS</option><option value="USD">USD</option>
                  </select>
                </Field>
                <Field label="Amount in Figures" required><input type="number" className="pr-input" style={{ ...inp, fontWeight: 800 }} placeholder="0" value={form.amount} onChange={(e) => set("amount", e.target.value)} /></Field>
                <div style={{ gridColumn: "span 2" }}>
                  <Field label="Amount Payable (in words)"><textarea className="pr-input" style={{ ...inp, resize: "vertical", minHeight: 92 }} rows={3} placeholder="e.g. One million Tanzanian shillings only..." value={form.amount_in_words} onChange={(e) => set("amount_in_words", e.target.value)} /></Field>
                </div>
                <div>
                  <label style={lblStyle}>Total Amount Requested</label>
                  <div style={{ background: "linear-gradient(135deg,#eef2ff,#faf5ff)", border: "1px solid #e0e7ff", borderRadius: 12, padding: "0.9rem 1rem", minHeight: 92, display: "flex", flexDirection: "column", justifyContent: "center", gap: "0.3rem" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.66rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.4px" }}><Wallet size={14} style={{ color: "#4f46e5" }} /> Total</span>
                    <span style={{ fontSize: "1.35rem", fontWeight: 900, color: "#4f46e5", letterSpacing: "-0.02em", wordBreak: "break-word" }}>{fmt(form.amount, form.currency)}</span>
                  </div>
                </div>
              </div>
            </Section>

            {/* SECTION 4: SIGNATURE */}
            <Section icon={<PenLine size={16} />} title="Applicant Authorization" hint="09" last>
              <div className="pr-grid3">
                <div style={{ gridColumn: "span 2" }}>
                  <Field label="Applicant Signature (name)"><input className="pr-input" style={inp} placeholder="Type your full name" value={form.applicant_signature} onChange={(e) => set("applicant_signature", e.target.value)} /></Field>
                </div>
                <Field label="Date"><input type="date" className="pr-input" style={inp} value={form.applicant_date} onChange={(e) => set("applicant_date", e.target.value)} /></Field>
              </div>
            </Section>

            {/* FOOTER ACTIONS */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.7rem", marginTop: "1.6rem", paddingTop: "1.3rem", borderTop: "1px solid #f1f5f9", flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.74rem", color: "#94a3b8", fontWeight: 600 }}>
                <ShieldCheck size={15} style={{ color: "#10b981" }} /> Submitting routes this request to the Loan Manager for review.
              </span>
              <div style={{ display: "flex", gap: "0.7rem" }}>
                <button onClick={() => setForm(blank)} style={{ padding: "0.75rem 1.5rem", borderRadius: 12, background: "#f1f5f9", border: "none", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", color: "#64748b" }}>Clear</button>
                <button onClick={submit} disabled={submitting} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1.8rem", borderRadius: 12, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", border: "none", fontWeight: 800, fontSize: "0.85rem", cursor: "pointer", color: "white", boxShadow: "0 8px 20px rgba(79,70,229,0.35)" }}>
                  <Send size={16} /> {submitting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.8rem" }}>
            {([["queue", "My Approval Queue"], ["mine", "My Requests"], ["all", "All"]] as const).map(([k, lbl]) => (
              <button key={k} onClick={() => setScope(k)} style={{ padding: "0.45rem 1rem", borderRadius: 8, border: "1px solid #e2e8f0", background: scope === k ? "#4f46e5" : "white", color: scope === k ? "white" : "#64748b", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer" }}>{lbl}</button>
            ))}
          </div>

          <div style={{ ...CARD, padding: "1.3rem" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Applicant", "Activity", "Payable To", "Amount", "Status", "Date", ""].map((h, i) => (
                      <th key={h} style={{ textAlign: i === 6 ? "right" : "left", padding: "0 0.7rem 0.9rem", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#94a3b8", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => {
                    const sm = STATUS_META[r.status] || STATUS_META.manager_review;
                    return (
                      <tr key={r.id} className="pr-row">
                        <td style={{ padding: "0.85rem 0.7rem", fontWeight: 700, color: "#1e293b", fontSize: "0.85rem" }}>{r.applicant_name}</td>
                        <td style={{ padding: "0.85rem 0.7rem", fontSize: "0.8rem", color: "#64748b" }}>{r.activity_type}</td>
                        <td style={{ padding: "0.85rem 0.7rem", fontSize: "0.8rem", color: "#475569" }}>{r.payable_to}</td>
                        <td style={{ padding: "0.85rem 0.7rem", fontWeight: 800, color: "#0f172a", fontSize: "0.82rem", whiteSpace: "nowrap" }}>{fmt(r.final_amount ?? r.amount, r.currency)}</td>
                        <td style={{ padding: "0.85rem 0.7rem" }}><span style={{ background: sm.bg, color: sm.color, padding: "3px 10px", borderRadius: 20, fontSize: "0.66rem", fontWeight: 800, whiteSpace: "nowrap" }}>{sm.label}</span></td>
                        <td style={{ padding: "0.85rem 0.7rem", fontSize: "0.76rem", color: "#94a3b8", whiteSpace: "nowrap" }}>{fmtDate(r.created_at)}</td>
                        <td style={{ padding: "0.85rem 0.7rem", textAlign: "right" }}>
                          <button onClick={() => openDetail(r)} style={{ padding: "0.4rem 0.9rem", borderRadius: 8, background: "#eef2ff", border: "none", color: "#4f46e5", fontWeight: 700, fontSize: "0.7rem", cursor: "pointer" }}>
                            {canDecide(r.status) ? "Review" : "View"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {requests.length === 0 && !loading && (
                    <tr><td colSpan={7} style={{ textAlign: "center", padding: "3rem", color: "#94a3b8", fontWeight: 600 }}>No payment requests found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* DETAIL / APPROVAL MODAL */}
      <AnimatePresence>
        {selected && (
          <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", backdropFilter: "blur(10px)", background: "rgba(0,0,0,0.6)" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ width: "100%", maxWidth: 640, maxHeight: "90vh", borderRadius: 18, background: "white", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 25px 60px rgba(0,0,0,0.4)" }}>
              <div style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)", padding: "1.2rem 1.5rem", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 900, margin: 0 }}>Payment Request #{selected.id}</h2>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", opacity: 0.9, fontWeight: 600 }}>{STATUS_META[selected.status]?.label}</p>
                </div>
                <button onClick={() => setSelected(null)} style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.2)", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} /></button>
              </div>
              <div style={{ padding: "1.3rem 1.5rem", overflowY: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.7rem 1.2rem", fontSize: "0.82rem" }}>
                  <Info label="Applicant" value={selected.applicant_name} />
                  <Info label="Department" value={selected.department} />
                  <Info label="Section" value={selected.section} />
                  <Info label="Activity" value={selected.activity_type} />
                  <Info label="Loan Applicant" value={selected.loan_applicant_name} />
                  <Info label="Mode of Payment" value={String(selected.mode_of_payment).replace("_", " ")} />
                  <Info label="Payable To" value={selected.payable_to} />
                  <Info label="Amount Requested" value={fmt(selected.amount, selected.currency)} />
                  <Info label="Current Amount" value={fmt(selected.final_amount ?? selected.amount, selected.currency)} />
                  {selected.invoice_path && <Info label="Invoice" value={<a href={selected.invoice_path} target="_blank" rel="noreferrer" style={{ color: "#4f46e5", fontWeight: 700 }}>Open</a>} />}
                </div>
                {selected.activity_detail && <p style={{ marginTop: "0.8rem", fontSize: "0.8rem", color: "#475569", background: "#f8fafc", padding: "0.7rem", borderRadius: 8 }}>{selected.activity_detail}</p>}
                {selected.amount_in_words && <p style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "#64748b", fontStyle: "italic" }}>"{selected.amount_in_words}"</p>}

                {/* Approval trail */}
                <div style={{ marginTop: "1.2rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <ApprovalRow title="Loan Manager / Head of Loan Dept" name={selected.manager_name} decision={selected.manager_decision} date={selected.manager_date} comments={selected.manager_comments} />
                  <ApprovalRow title="General Manager / Head of HR & Admin" name={selected.gm_name} decision={selected.gm_decision} date={selected.gm_date} comments={selected.gm_comments} />
                  <ApprovalRow title="Managing Director (Authorisation)" name={selected.md_name} decision={selected.status === "authorized" ? "authorized" : null} date={selected.md_date} comments={selected.md_comments} />
                </div>
                {selected.status === "rejected" && (
                  <p style={{ marginTop: "0.8rem", fontSize: "0.8rem", color: "#dc2626", background: "#fef2f2", padding: "0.7rem", borderRadius: 8, fontWeight: 600 }}>Rejected: {selected.rejection_reason}</p>
                )}

                {/* Approval actions */}
                {canDecide(selected.status) && (
                  <div style={{ marginTop: "1.2rem", borderTop: "1px solid #f1f5f9", paddingTop: "1.2rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.7rem", fontWeight: 800, color: "#0f172a", fontSize: "0.85rem" }}>
                      <ShieldCheck size={16} style={{ color: "#4f46e5" }} /> Your Decision
                    </div>
                    {selected.status !== "md_review" && (
                      <input type="number" style={{ ...inp, marginBottom: "0.5rem" }} placeholder={`Adjust amount (optional, current ${fmt(selected.final_amount ?? selected.amount, selected.currency)})`} value={adjustedAmount} onChange={(e) => setAdjustedAmount(e.target.value)} />
                    )}
                    <textarea style={{ ...inp, resize: "vertical" }} rows={2} placeholder="Comments / reason..." value={comments} onChange={(e) => setComments(e.target.value)} />
                    <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.8rem" }}>
                      <button onClick={reject} disabled={acting} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", padding: "0.75rem", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer" }}><XCircle size={16} /> Not Approved</button>
                      <button onClick={approve} disabled={acting} style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", padding: "0.75rem", borderRadius: 10, background: "#4f46e5", border: "none", color: "white", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer", boxShadow: "0 4px 12px rgba(79,70,229,0.3)" }}>
                        <CheckCircle2 size={16} /> {acting ? "Processing..." : selected.status === "md_review" ? "Authorize Payment" : "Approve"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .pr-row { border-bottom: 1px solid #f1f5f9; transition: background 0.15s; }
        .pr-row:hover { background: #fdfbf7; }
        .pr-input { transition: border-color 0.18s, box-shadow 0.18s, background 0.18s; }
        .pr-input:focus { border-color: #6366f1 !important; background: #fff !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
        .pr-grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.1rem; }
        .pr-span-all { grid-column: 1 / -1; }
        @media (max-width: 900px) { .pr-grid3 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 600px) { .pr-grid3 { grid-template-columns: 1fr; } }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 6px; }
      `}</style>
    </div>
  );
};

const lblStyle: React.CSSProperties = { display: "block", fontSize: "0.68rem", fontWeight: 700, color: "#64748b", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.4px" };

const Section = ({ icon, title, hint, last, children }: { icon: React.ReactNode; title: string; hint?: string; last?: boolean; children: React.ReactNode }) => (
  <div style={{ paddingBottom: last ? 0 : "1.5rem", marginBottom: last ? 0 : "1.5rem", borderBottom: last ? "none" : "1px solid #f1f5f9" }}>
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: "#eef2ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "#0f172a" }}>{title}</h3>
      {hint && <span style={{ marginLeft: "auto", fontSize: "0.66rem", fontWeight: 700, color: "#cbd5e1", letterSpacing: "1px" }}>{hint}</span>}
    </div>
    {children}
  </div>
);

const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div>
    <label style={lblStyle}>{label} {required && <span style={{ color: "#ef4444" }}>*</span>}</label>
    {children}
  </div>
);

const Info = ({ label, value }: { label: string; value: any }) => (
  <div>
    <span style={{ display: "block", fontSize: "0.62rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</span>
    <span style={{ fontWeight: 700, color: "#1e293b" }}>{value || "—"}</span>
  </div>
);

const ApprovalRow = ({ title, name, decision, date, comments }: any) => {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    approved: { label: "Approved", bg: "#ecfdf5", color: "#059669" },
    adjusted: { label: "Adjusted", bg: "#fffbeb", color: "#d97706" },
    authorized: { label: "Authorized", bg: "#ecfdf5", color: "#059669" },
    not_approved: { label: "Not Approved", bg: "#fef2f2", color: "#dc2626" },
  };
  const m = decision ? map[decision] : null;
  return (
    <div style={{ background: "#f8fafc", borderRadius: 10, padding: "0.7rem 0.9rem", border: "1px solid #eef1f6" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#475569" }}>{title}</span>
        {m ? <span style={{ background: m.bg, color: m.color, padding: "2px 9px", borderRadius: 20, fontSize: "0.64rem", fontWeight: 800 }}>{m.label}</span>
          : <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "#94a3b8", fontSize: "0.64rem", fontWeight: 700 }}><Clock size={11} /> Pending</span>}
      </div>
      {name && <div style={{ marginTop: "0.35rem", fontSize: "0.72rem", color: "#64748b" }}>{name} • {fmtDate(date)}</div>}
      {comments && <div style={{ marginTop: "0.25rem", fontSize: "0.74rem", color: "#334155" }}>{comments}</div>}
    </div>
  );
};

export default PaymentRequests;
