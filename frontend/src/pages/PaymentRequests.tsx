import { useEffect, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Send, CheckCircle2, XCircle, Clock, X, Inbox, PlusCircle, Paperclip, ShieldCheck, Wallet, Banknote, CreditCard, ArrowRight, Pencil, Printer, Lock } from "lucide-react";
import { printDocument } from "../utils/printDoc";
import SignaturePad from "../components/SignaturePad";
import SuccessModal from "../components/SuccessModal";

const PENDING_STATUSES = ["manager_review", "gm_review", "md_review", "awaiting_disbursement"];

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
const fmt = (v: any, cur = "TZS") => `${cur} ${Math.round(Number(v) || 0).toLocaleString()}`;
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

// Signature cell for printed documents: stamped image (if any) over a ruled line
const sigCell = (role: string, name?: string, date?: string, img?: string) => `
  <div style="text-align:center">
    <div style="height:46px;display:flex;align-items:flex-end;justify-content:center">
      ${img ? `<img src="${img}" style="height:44px;max-width:150px;object-fit:contain" />` : ""}
    </div>
    <div style="border-top:1.5px solid #0f172a;padding-top:8px;font-size:9.5px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:0.5px">${role}</div>
    ${name ? `<div style="font-size:9px;color:#64748b;margin-top:3px">${name}${date ? " · " + new Date(date).toLocaleDateString("en-GB") : ""}</div>` : ""}
  </div>`;

const ACTIVITY_TYPES = [
  "Loan", "Duties", "Tax", "Transportation", "Permits", "Bank charges", "Postage Charges",
  "Office cleaning & maintenance", "Office equipment repairs", "Utilities", "ICT & Software bills", "Rents fees", "Other",
];

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  manager_review: { label: "Awaiting Loan Manager", bg: "#eef2ff", color: "#4f46e5" },
  gm_review: { label: "Awaiting General Manager", bg: "#fff7ed", color: "#ea580c" },
  md_review: { label: "Awaiting Managing Director", bg: "#fdf4ff", color: "#a21caf" },
  awaiting_disbursement: { label: "Awaiting Cashier Payout", bg: "#ecfeff", color: "#0891b2" },
  disbursed: { label: "Disbursed / Paid", bg: "#ecfdf5", color: "#059669" },
  authorized: { label: "Authorized", bg: "#ecfdf5", color: "#059669" },
  rejected: { label: "Rejected", bg: "#fef2f2", color: "#dc2626" },
};

const CARD: React.CSSProperties = { background: "white", borderRadius: 14, border: "1px solid #eef1f6", boxShadow: "0 6px 18px rgba(15,23,42,0.07)" };
const inp: React.CSSProperties = { width: "100%", padding: "0.7rem 0.9rem", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", outline: "none", fontWeight: 600, fontSize: "0.9rem", color: "#1e293b", boxSizing: "border-box", fontFamily: "inherit" };

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
    amount: "", amount_in_words: "", applicant_signature: user?.name || "", applicant_signature_img: user?.signature || "", applicant_date: new Date().toISOString().slice(0, 10),
  };
  const [form, setForm] = useState<any>(blank);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingReq, setPendingReq] = useState<any>(null);
  const [success, setSuccess] = useState<{ open: boolean; title: string; message: string }>({ open: false, title: "", message: "" });
  const [formError, setFormError] = useState("");

  // Approval state
  const [adjustedAmount, setAdjustedAmount] = useState("");
  const [comments, setComments] = useState("");
  const [cashierRef, setCashierRef] = useState("");
  const [pin, setPin] = useState("");
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
    if (status === "awaiting_disbursement") return role === "finance_officer";
    return false;
  };
  const canEdit = (r: any) => r.status === "rejected" && (r.created_by === user?.id || role === "admin");

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/payment-requests`, { headers: headers(), params: { scope } });
      setRequests(res.data.requests || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [scope]);
  useEffect(() => { checkPending(); }, []);

  const checkPending = async () => {
    try {
      const res = await axios.get(`${API_BASE}/payment-requests`, { headers: headers(), params: { scope: "mine" } });
      const mine = res.data.requests || [];
      setPendingReq(mine.find((r: any) => PENDING_STATUSES.includes(r.status)) || null);
    } catch { /* ignore */ }
  };

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

  const blockedByPending = !editingId && !!pendingReq;

  const submit = async () => {
    setFormError("");
    if (!form.applicant_name || !form.payable_to || !form.amount) { setFormError("Please fill applicant, payable to and amount."); return; }
    if (blockedByPending) { setFormError("You already have a pending request. Wait until it is completed or rejected."); return; }
    setSubmitting(true);
    try {
      const wasEditing = !!editingId;
      if (editingId) {
        await axios.put(`${API_BASE}/payment-requests/${editingId}`, { ...form, amount: Number(form.amount) }, { headers: headers() });
      } else {
        await axios.post(`${API_BASE}/payment-requests`, { ...form, amount: Number(form.amount) }, { headers: headers() });
      }
      setForm(blank); setEditingId(null);
      setTab("list"); setScope("mine");
      await load(); await checkPending();
      setSuccess({
        open: true,
        title: wasEditing ? "Request Resubmitted" : "Request Submitted",
        message: wasEditing
          ? "Your payment request has been updated and resubmitted to the Loan Manager for review."
          : "Your payment request has been submitted and routed to the Loan Manager for approval.",
      });
    } catch (e: any) { console.error(e); setFormError(e?.response?.data?.message || "Submit failed"); } finally { setSubmitting(false); }
  };

  const startEdit = (r: any) => {
    setForm({
      applicant_name: r.applicant_name || "", department: r.department || "", section: r.section || "",
      activity_type: r.activity_type || "Loan", activity_detail: r.activity_detail || "",
      loan_applicant_name: r.loan_applicant_name || "", invoice_path: r.invoice_path || "",
      mode_of_payment: r.mode_of_payment || "cash", payable_to: r.payable_to || "", currency: r.currency || "TZS",
      amount: r.amount ?? "", amount_in_words: r.amount_in_words || "",
      applicant_signature: r.applicant_signature || user?.name || "", applicant_date: r.applicant_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    });
    setEditingId(r.id); setSelected(null); setTab("new");
  };

  const openDetail = (r: any) => { setSelected(r); setAdjustedAmount(""); setComments(""); setCashierRef(""); setPin(""); };

  const printVoucher = (r: any) => {
    const body = `
      <h2>Payee Information</h2>
      <table>
        <tr><td>Payable To</td><td>${r.payable_to}</td></tr>
        <tr><td>Applicant</td><td>${r.applicant_name}</td></tr>
        <tr><td>Department / Section</td><td>${[r.department, r.section].filter(Boolean).join(" / ") || "—"}</td></tr>
        <tr><td>Activity</td><td>${r.activity_type}${r.activity_detail ? " — " + r.activity_detail : ""}</td></tr>
        <tr><td>Mode of Payment</td><td>${String(r.mode_of_payment).replace("_", " ")}</td></tr>
        ${r.cashier_reference ? `<tr><td>Transaction Reference</td><td>${r.cashier_reference}</td></tr>` : ""}
      </table>
      <div class="net-box"><span>Amount Paid</span><div>${fmt(r.final_amount ?? r.amount, r.currency)}</div></div>
      ${r.amount_in_words ? `<p style="font-style:italic;color:#475569;font-size:13px">Amount in words: ${r.amount_in_words}</p>` : ""}
      <h2>Authorized Signatures</h2>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-top:34px">
        ${sigCell("Loan Manager", r.manager_name, r.manager_date, r.manager_signature_img)}
        ${sigCell("General Manager", r.gm_name, r.gm_date, r.gm_signature_img)}
        ${sigCell("Managing Director", r.md_name, r.md_date, r.md_signature_img)}
        ${sigCell("Cashier / Finance", r.cashier_name, r.cashier_date, r.cashier_signature_img)}
      </div>`;
    printDocument("Payment Voucher", body, `PV-${String(r.id).padStart(5, "0")}`);
  };

  const approve = async () => {
    if (!selected) return;
    if (!pin.trim()) { alert("Enter your password/PIN to sign this approval."); return; }
    setActing(true);
    try {
      await axios.post(`${API_BASE}/payment-requests/${selected.id}/approve`, {
        adjusted_amount: adjustedAmount ? Number(adjustedAmount) : null, comments, cashier_reference: cashierRef || null, password: pin,
      }, { headers: headers() });
      setSelected(null); setPin(""); await load();
    } catch (e: any) { alert(e?.response?.data?.message || "Action failed"); } finally { setActing(false); }
  };

  const reject = async () => {
    if (!selected || !comments.trim()) { alert("Please provide a reason in comments to reject."); return; }
    if (!pin.trim()) { alert("Enter your password/PIN to confirm."); return; }
    setActing(true);
    try {
      await axios.post(`${API_BASE}/payment-requests/${selected.id}/reject`, { reason: comments, password: pin }, { headers: headers() });
      setSelected(null); setPin(""); await load();
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
        <div className="prf-page">
          <div className="prf-card">
            {editingId && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "0.6rem 0.9rem", marginBottom: "1rem", fontSize: "0.8rem", fontWeight: 700, color: "#92400e" }}>
                <Pencil size={15} /> Editing rejected request #{editingId} — it will restart the approval flow on resubmit.
              </div>
            )}
            {blockedByPending && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "0.8rem 1rem", marginBottom: "1rem", fontSize: "0.82rem", fontWeight: 700, color: "#b91c1c" }}>
                <ShieldCheck size={16} /> You already have a pending request (#{pendingReq?.id} · {STATUS_META[pendingReq?.status]?.label}). You can submit a new one once it is completed or rejected.
              </div>
            )}
            {/* Approval chain strip */}
            <div className="prf-chain">
              {["You", "Loan Manager", "General Manager", "Managing Director", "Cashier Payout"].map((s, i, arr) => (
                <span key={s} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span className="prf-chain-pill">{s}</span>
                  {i < arr.length - 1 && <ArrowRight size={13} style={{ color: "#94a3b8" }} />}
                </span>
              ))}
            </div>

            {/* SECTION 1: APPLICANT */}
            <Section num={1} title="APPLICANT INFORMATION">
              <div className="pr-grid3">
                <Field label="Full Name of Applicant" required><input className="pr-input" style={inp} value={form.applicant_name} onChange={(e) => set("applicant_name", e.target.value)} /></Field>
                <Field label="Department"><input className="pr-input" style={inp} value={form.department} onChange={(e) => set("department", e.target.value)} /></Field>
                <Field label="Section"><input className="pr-input" style={inp} value={form.section} onChange={(e) => set("section", e.target.value)} /></Field>
              </div>
            </Section>

            {/* SECTION 2: ACTIVITY */}
            <Section num={2} title="PAYMENT ACTIVITY">
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
            <Section num={3} title="PAYMENT DETAILS">
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
              <div className="pr-grid3" style={{ marginTop: "0.6rem" }}>
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
            <Section num={4} title="APPLICANT AUTHORIZATION">
              <div className="pr-grid3">
                <Field label="Applicant Signature (name)"><input className="pr-input" style={inp} placeholder="Type your full name" value={form.applicant_signature} onChange={(e) => set("applicant_signature", e.target.value)} /></Field>
                <Field label="Date"><input type="date" className="pr-input" style={inp} value={form.applicant_date} onChange={(e) => set("applicant_date", e.target.value)} /></Field>
                <div className="pr-span-all">
                  <SignaturePad label="Signature (draw)" value={form.applicant_signature_img || undefined} savedSignature={user?.signature} onChange={(d) => set("applicant_signature_img", d || "")} height={130} />
                </div>
              </div>
            </Section>

            {formError && (
              <div style={{ marginTop: "1rem", fontSize: "0.8rem", fontWeight: 700, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "0.7rem 0.9rem" }}>{formError}</div>
            )}

            {/* FOOTER ACTIONS */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.7rem", marginTop: "0.5rem", paddingTop: "1.3rem", borderTop: "1px solid #e2e8f0", flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.76rem", color: "#94a3b8", fontWeight: 600 }}>
                <ShieldCheck size={15} style={{ color: "#10b981" }} /> After MD approval, the Cashier disburses the payment to the applicant.
              </span>
              <div style={{ display: "flex", gap: "0.7rem" }}>
                <button onClick={() => { setForm(blank); setEditingId(null); setFormError(""); }} style={{ padding: "0.8rem 1.6rem", borderRadius: 8, background: "#94a3b8", border: "none", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", color: "white" }}>{editingId ? "Cancel" : "Clear"}</button>
                <button onClick={submit} disabled={submitting || blockedByPending} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.8rem 2rem", borderRadius: 8, background: blockedByPending ? "#cbd5e1" : "#102a43", border: "none", fontWeight: 800, fontSize: "0.85rem", cursor: blockedByPending ? "not-allowed" : "pointer", color: "white", boxShadow: blockedByPending ? "none" : "0 6px 16px rgba(16,42,67,0.3)" }}>
                  <Send size={16} /> {submitting ? "Submitting..." : editingId ? "Resubmit Request" : "Submit Request"}
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
                          <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                            {canEdit(r) && (
                              <button onClick={() => startEdit(r)} style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.4rem 0.8rem", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a", color: "#d97706", fontWeight: 700, fontSize: "0.7rem", cursor: "pointer" }}>
                                <Pencil size={12} /> Edit
                              </button>
                            )}
                            <button onClick={() => openDetail(r)} style={{ padding: "0.4rem 0.9rem", borderRadius: 8, background: "#eef2ff", border: "none", color: "#4f46e5", fontWeight: 700, fontSize: "0.7rem", cursor: "pointer" }}>
                              {canDecide(r.status) ? "Review" : "View"}
                            </button>
                          </div>
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
                {selected.status === "disbursed" && (
                  <button onClick={() => printVoucher(selected)} style={{ marginTop: "0.9rem", display: "flex", alignItems: "center", gap: "0.45rem", padding: "0.6rem 1.1rem", borderRadius: 10, background: "#102a43", border: "none", color: "white", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}>
                    <Printer size={15} /> Print Payment Voucher
                  </button>
                )}

                {/* Approval trail */}
                <div style={{ marginTop: "1.2rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <ApprovalRow title="Loan Manager / Head of Loan Dept" name={selected.manager_name} decision={selected.manager_decision} date={selected.manager_date} comments={selected.manager_comments} signature={selected.manager_signature_img} />
                  <ApprovalRow title="General Manager / Head of HR & Admin" name={selected.gm_name} decision={selected.gm_decision} date={selected.gm_date} comments={selected.gm_comments} signature={selected.gm_signature_img} />
                  <ApprovalRow title="Managing Director (Authorisation)" name={selected.md_name} decision={selected.md_date ? "approved" : null} date={selected.md_date} comments={selected.md_comments} signature={selected.md_signature_img} />
                  <ApprovalRow title="Cashier / Finance (Disbursement)" name={selected.cashier_name} decision={selected.status === "disbursed" ? "disbursed" : null} date={selected.cashier_date} comments={selected.cashier_comments || (selected.cashier_reference ? `Ref: ${selected.cashier_reference}` : null)} signature={selected.cashier_signature_img} />
                </div>
                {selected.status === "rejected" && (
                  <div style={{ marginTop: "0.8rem" }}>
                    <p style={{ fontSize: "0.8rem", color: "#dc2626", background: "#fef2f2", padding: "0.7rem", borderRadius: 8, fontWeight: 600, margin: 0 }}>Rejected: {selected.rejection_reason}</p>
                    {canEdit(selected) && (
                      <button onClick={() => startEdit(selected)} style={{ marginTop: "0.7rem", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", padding: "0.75rem", borderRadius: 10, background: "#d97706", border: "none", color: "white", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer" }}>
                        <Pencil size={15} /> Edit & Resubmit
                      </button>
                    )}
                  </div>
                )}

                {/* Approval / Disbursement actions */}
                {canDecide(selected.status) && (
                  <div style={{ marginTop: "1.2rem", borderTop: "1px solid #f1f5f9", paddingTop: "1.2rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.7rem", fontWeight: 800, color: "#0f172a", fontSize: "0.85rem" }}>
                      <ShieldCheck size={16} style={{ color: "#4f46e5" }} /> {selected.status === "awaiting_disbursement" ? "Cashier Disbursement" : "Your Decision"}
                    </div>
                    {!user?.signature && (
                      <div style={{ marginBottom: "0.6rem", fontSize: "0.72rem", color: "#d97706", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "0.5rem 0.7rem", fontWeight: 600 }}>
                        Tip: set your signature in <strong>My Signature</strong> so it appears on the signed document.
                      </div>
                    )}
                    {selected.status === "awaiting_disbursement" ? (
                      <>
                        <input type="text" style={{ ...inp, marginBottom: "0.5rem" }} placeholder="Transaction / Voucher reference (optional)" value={cashierRef} onChange={(e) => setCashierRef(e.target.value)} />
                        <textarea style={{ ...inp, resize: "vertical", marginBottom: "0.5rem" }} rows={2} placeholder="Disbursement notes..." value={comments} onChange={(e) => setComments(e.target.value)} />
                        <div style={{ position: "relative" }}>
                          <Lock size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                          <input type="password" style={{ ...inp, paddingLeft: "2.2rem" }} placeholder="Enter your password / PIN to sign" value={pin} onChange={(e) => setPin(e.target.value)} />
                        </div>
                        <button onClick={approve} disabled={acting} style={{ marginTop: "0.8rem", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", padding: "0.8rem", borderRadius: 10, background: "#0891b2", border: "none", color: "white", fontWeight: 800, fontSize: "0.85rem", cursor: "pointer", boxShadow: "0 4px 12px rgba(8,145,178,0.3)" }}>
                          <Banknote size={16} /> {acting ? "Processing..." : `Disburse ${fmt(selected.final_amount ?? selected.amount, selected.currency)}`}
                        </button>
                      </>
                    ) : (
                      <>
                        {selected.status !== "md_review" && (
                          <input type="number" style={{ ...inp, marginBottom: "0.5rem" }} placeholder={`Adjust amount (optional, current ${fmt(selected.final_amount ?? selected.amount, selected.currency)})`} value={adjustedAmount} onChange={(e) => setAdjustedAmount(e.target.value)} />
                        )}
                        <textarea style={{ ...inp, resize: "vertical", marginBottom: "0.5rem" }} rows={2} placeholder="Comments / reason..." value={comments} onChange={(e) => setComments(e.target.value)} />
                        <div style={{ position: "relative" }}>
                          <Lock size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                          <input type="password" style={{ ...inp, paddingLeft: "2.2rem" }} placeholder="Enter your password / PIN to sign" value={pin} onChange={(e) => setPin(e.target.value)} />
                        </div>
                        <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.8rem" }}>
                          <button onClick={reject} disabled={acting} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", padding: "0.75rem", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer" }}><XCircle size={16} /> Not Approved</button>
                          <button onClick={approve} disabled={acting} style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", padding: "0.75rem", borderRadius: 10, background: "#4f46e5", border: "none", color: "white", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer", boxShadow: "0 4px 12px rgba(79,70,229,0.3)" }}>
                            <CheckCircle2 size={16} /> {acting ? "Processing..." : selected.status === "md_review" ? "Authorize Payment" : "Approve"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <SuccessModal open={success.open} title={success.title} message={success.message} onClose={() => setSuccess({ ...success, open: false })} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .pr-row { border-bottom: 1px solid #f1f5f9; transition: background 0.15s; }
        .pr-row:hover { background: #fdfbf7; }
        .pr-input { transition: border-color 0.18s, box-shadow 0.18s, background 0.18s; }
        .pr-input:focus { border-color: #6366f1 !important; background: #fff !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
        .pr-grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.6rem 1.3rem; }
        .pr-span-all { grid-column: 1 / -1; }
        @media (max-width: 900px) { .pr-grid3 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 600px) { .pr-grid3 { grid-template-columns: 1fr; } }

        .prf-page { background: #e8f0fe; border-radius: 14px; padding: 0.5rem; }
        .prf-card { background: #fff; border-radius: 14px; box-shadow: 0 10px 28px rgba(15,23,42,0.08); padding: 1.7rem 1.9rem; }
        .prf-banner { background: #102a43; color: #fff; padding: 0.7rem 1.2rem; border-radius: 8px; font-weight: 800; font-size: 0.85rem; letter-spacing: 0.6px; margin-bottom: 0.8rem; box-shadow: 0 4px 12px rgba(16,42,67,0.18); }
        .prf-chain { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.4rem; }
        .prf-chain-pill { background: #eef2ff; color: #4f46e5; padding: 0.3rem 0.85rem; border-radius: 20px; font-size: 0.72rem; font-weight: 700; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 6px; }
      `}</style>
    </div>
  );
};

const lblStyle: React.CSSProperties = { display: "block", fontSize: "0.7rem", fontWeight: 700, color: "#64748b", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.6px" };

const Section = ({ num, title, children }: { num: number; title: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: "1rem" }}>
    <div className="prf-banner">SECTION {num}: {title}</div>
    <div style={{ padding: "0.2rem 0.2rem 0" }}>{children}</div>
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

const ApprovalRow = ({ title, name, decision, date, comments, signature }: any) => {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    approved: { label: "Approved", bg: "#ecfdf5", color: "#059669" },
    adjusted: { label: "Adjusted", bg: "#fffbeb", color: "#d97706" },
    authorized: { label: "Authorized", bg: "#ecfdf5", color: "#059669" },
    disbursed: { label: "Disbursed", bg: "#ecfeff", color: "#0891b2" },
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "0.5rem" }}>
        <div style={{ flex: 1 }}>
          {name && <div style={{ marginTop: "0.35rem", fontSize: "0.72rem", color: "#64748b" }}>{name} • {fmtDate(date)}</div>}
          {comments && <div style={{ marginTop: "0.25rem", fontSize: "0.74rem", color: "#334155" }}>{comments}</div>}
        </div>
        {signature && <img src={signature} alt="signature" style={{ height: 38, maxWidth: 130, objectFit: "contain", filter: "contrast(1.1)" }} />}
      </div>
    </div>
  );
};

export default PaymentRequests;
