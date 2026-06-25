import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Send, CheckCircle2, XCircle, Clock, X, Inbox, PlusCircle, ShieldCheck, ArrowRight, Info as InfoIcon, Pencil, Lock, UserCheck } from "lucide-react";
import SignaturePad from "../components/SignaturePad";
import SuccessModal from "../components/SuccessModal";

const PENDING_STATUSES = ["manager_review", "gm_review", "md_review"];

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

const ABSENCE_TYPES: Record<string, string> = {
  sick: "Sick / Ugonjwa",
  bereavement: "Bereavement / Msiba",
  unpaid: "Time off without pay / Likizo bila malipo",
  personal: "Personal leave / Likizo binafsi",
  maternity: "Maternity/Paternity / Likizo ya Uzazi",
  other: "Others / Nyinginezo",
};

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  manager_review: { label: "Awaiting Manager / Inasubiri Meneja", bg: "#eef2ff", color: "#4f46e5" },
  gm_review: { label: "Awaiting General Manager", bg: "#fff7ed", color: "#ea580c" },
  md_review: { label: "Awaiting Employer / Mwajiri", bg: "#fdf4ff", color: "#a21caf" },
  authorized: { label: "Approved / Imekubaliwa", bg: "#ecfdf5", color: "#059669" },
  rejected: { label: "Rejected / Imekataliwa", bg: "#fef2f2", color: "#dc2626" },
};

const CARD: React.CSSProperties = { background: "white", borderRadius: 14, border: "1px solid #eef1f6", boxShadow: "0 6px 18px rgba(15,23,42,0.07)" };
const inp: React.CSSProperties = { width: "100%", padding: "0.7rem 0.9rem", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", outline: "none", fontWeight: 600, fontSize: "0.9rem", color: "#1e293b", boxSizing: "border-box", fontFamily: "inherit" };

const LeaveRequests = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user?.role;
  const isMD = role === "managing_director";
  const [tab, setTab] = useState<"new" | "list">("list");
  const [requests, setRequests] = useState<any[]>([]);
  const [scope, setScope] = useState<"queue" | "mine" | "all">("queue");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  const today = new Date().toISOString().slice(0, 10);
  const blank = {
    employee_name: user?.name || "", department: "", manager: "", absence_type: "sick", absence_other: "",
    from_date: today, to_date: today, reason: "", employee_signature: user?.name || "", employee_signature_img: user?.signature || "", employee_date: today,
  };
  const [form, setForm] = useState<any>(blank);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingReq, setPendingReq] = useState<any>(null);
  const [success, setSuccess] = useState<{ open: boolean; title: string; message: string }>({ open: false, title: "", message: "" });
  const [formError, setFormError] = useState("");

  const [comments, setComments] = useState("");
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
    return false;
  };
  const canEdit = (r: any) => r.status === "rejected" && (r.created_by === user?.id || role === "admin");

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/leave-requests`, { headers: headers(), params: { scope } });
      setRequests(res.data.requests || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [scope]);
  useEffect(() => { checkPending(); }, []);

  const checkPending = async () => {
    try {
      const res = await axios.get(`${API_BASE}/leave-requests`, { headers: headers(), params: { scope: "mine" } });
      const mine = res.data.requests || [];
      setPendingReq(mine.find((r: any) => PENDING_STATUSES.includes(r.status)) || null);
    } catch { /* ignore */ }
  };

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const blockedByPending = !editingId && !!pendingReq;

  const submit = async () => {
    setFormError("");
    if (!form.employee_name || !form.from_date || !form.to_date) { setFormError("Please fill employee name and dates."); return; }
    if (blockedByPending) { setFormError("You already have a pending request. Wait until it is approved or rejected."); return; }
    setSubmitting(true);
    try {
      const wasEditing = !!editingId;
      if (editingId) {
        await axios.put(`${API_BASE}/leave-requests/${editingId}`, form, { headers: headers() });
      } else {
        await axios.post(`${API_BASE}/leave-requests`, form, { headers: headers() });
      }
      setForm(blank); setEditingId(null);
      setTab("list"); setScope("mine");
      await load(); await checkPending();
      setSuccess({
        open: true,
        title: wasEditing ? "Request Resubmitted" : "Request Submitted",
        message: wasEditing
          ? "Your leave request has been updated and resubmitted to your Manager for approval."
          : "Your leave request has been submitted and routed to your Manager for approval.",
      });
    } catch (e: any) { console.error(e); setFormError(e?.response?.data?.message || "Submit failed"); } finally { setSubmitting(false); }
  };

  const startEdit = (r: any) => {
    setForm({
      employee_name: r.employee_name || "", department: r.department || "", manager: r.manager || "",
      absence_type: r.absence_type || "sick", absence_other: r.absence_other || "",
      from_date: r.from_date?.slice(0, 10) || today, to_date: r.to_date?.slice(0, 10) || today,
      reason: r.reason || "", employee_signature: r.employee_signature || user?.name || "",
      employee_signature_img: r.employee_signature_img || user?.signature || "",
      employee_date: r.employee_date?.slice(0, 10) || today,
    });
    setEditingId(r.id); setSelected(null); setTab("new");
  };

  const openDetail = (r: any) => { setSelected(r); setComments(""); setPin(""); };

  const approve = async () => {
    if (!selected) return;
    if (!pin.trim()) { alert("Enter your password/PIN to sign this approval."); return; }
    setActing(true);
    try {
      await axios.post(`${API_BASE}/leave-requests/${selected.id}/approve`, { comments, password: pin }, { headers: headers() });
      setSelected(null); setPin(""); await load();
    } catch (e: any) { alert(e?.response?.data?.message || "Action failed"); } finally { setActing(false); }
  };

  const reject = async () => {
    if (!selected || !comments.trim()) { alert("Please provide a reason in comments to reject."); return; }
    if (!pin.trim()) { alert("Enter your password/PIN to confirm."); return; }
    setActing(true);
    try {
      await axios.post(`${API_BASE}/leave-requests/${selected.id}/reject`, { reason: comments, password: pin }, { headers: headers() });
      setSelected(null); setPin(""); await load();
    } catch (e: any) { alert(e?.response?.data?.message || "Action failed"); } finally { setActing(false); }
  };

  return (
    <div style={{ minHeight: "100vh", maxWidth: "100%", overflowX: "hidden", boxSizing: "border-box", background: "#fdfbf7", padding: "0.7rem 1rem 1.5rem", fontFamily: "'Plus Jakarta Sans','Inter',sans-serif", color: "#1e293b" }}>

      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <CalendarDays size={22} style={{ color: "#4f46e5" }} />
        <h1 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0, color: "#0f172a" }}>Leave Request Form / Fomu ya Maombi ya Likizo</h1>
        <div style={{ marginLeft: "auto", display: "flex", background: "#f1f5f9", padding: 4, borderRadius: 10, gap: 3 }}>
          {([["list", "Requests", Inbox], ["new", "New Request", PlusCircle]] as const).map(([k, lbl, Icon]) => (
            <button key={k} onClick={() => setTab(k)} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", borderRadius: 8, border: "none", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", background: tab === k ? "white" : "transparent", color: tab === k ? "#4f46e5" : "#64748b", boxShadow: tab === k ? "0 1px 4px rgba(15,23,42,0.1)" : "none" }}>
              <Icon size={15} /> {lbl}
            </button>
          ))}
        </div>
      </div>

      {tab === "new" && isMD ? (
        <div className="prf-page">
          <div className="prf-card" style={{ textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0.5rem auto 1rem" }}>
              <UserCheck size={32} style={{ color: "#4f46e5" }} />
            </div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 900, color: "#0f172a", margin: "0 0 0.5rem" }}>Kukaimisha Ofisi na Madaraka kwa Muda</h2>
            <p style={{ fontSize: "0.86rem", color: "#64748b", maxWidth: 520, margin: "0 auto 1.3rem", lineHeight: 1.6 }}>
              As the Managing Director, when you are away from office you don't file a normal leave request — instead you delegate your office and authority to a staff member of your choice. Use the Office Delegation form to select the acting officer and define the authority being handed over.
            </p>
            <button onClick={() => navigate("/delegations")} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.85rem 1.8rem", borderRadius: 10, background: "#102a43", border: "none", fontWeight: 800, fontSize: "0.9rem", cursor: "pointer", color: "white", boxShadow: "0 6px 16px rgba(16,42,67,0.3)" }}>
              Open Delegation Form <ArrowRight size={17} />
            </button>
          </div>
        </div>
      ) : tab === "new" ? (
        <div className="prf-page">
          <div className="prf-card">
            {editingId && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "0.6rem 0.9rem", marginBottom: "1rem", fontSize: "0.8rem", fontWeight: 700, color: "#92400e" }}>
                <Pencil size={15} /> Editing rejected request #{editingId} — it will restart the approval flow on resubmit.
              </div>
            )}
            {blockedByPending && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "0.8rem 1rem", marginBottom: "1rem", fontSize: "0.82rem", fontWeight: 700, color: "#b91c1c" }}>
                <ShieldCheck size={16} /> You already have a pending leave request (#{pendingReq?.id} · {STATUS_META[pendingReq?.status]?.label}). You can submit a new one once it is approved or rejected.
              </div>
            )}
            {/* Approval chain strip */}
            <div className="prf-chain">
              {["You", "Manager", "General Manager", "Employer"].map((s, i) => (
                <span key={s} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span className="prf-chain-pill">{s}</span>
                  {i < 3 && <ArrowRight size={13} style={{ color: "#94a3b8" }} />}
                </span>
              ))}
            </div>

            {/* SECTION 1: LEAVE INFORMATION */}
            <Section num={1} title="LEAVE INFORMATION / TAARIFA ZA LIKIZO">
              <div className="pr-grid3">
                <Field label="Employee Name / Jina la Mfanyakazi" required><input className="pr-input" style={inp} value={form.employee_name} onChange={(e) => set("employee_name", e.target.value)} /></Field>
                <Field label="Department / Idara"><input className="pr-input" style={inp} value={form.department} onChange={(e) => set("department", e.target.value)} /></Field>
                <Field label="Manager / Mkuu wa Kazi"><input className="pr-input" style={inp} value={form.manager} onChange={(e) => set("manager", e.target.value)} /></Field>
              </div>
            </Section>

            {/* SECTION 2: TYPE & DATES */}
            <Section num={2} title="TYPE OF ABSENCE & DATES / AINA YA LIKIZO NA TAREHE">
              <div className="pr-grid3">
                <Field label="Type of Absence / Chagua Aina ya Likizo" required>
                  <select className="pr-input" style={inp} value={form.absence_type} onChange={(e) => set("absence_type", e.target.value)}>
                    {Object.entries(ABSENCE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label="From / Kuanzia" required><input type="date" className="pr-input" style={inp} value={form.from_date} onChange={(e) => set("from_date", e.target.value)} /></Field>
                <Field label="To / Mpaka" required><input type="date" className="pr-input" style={inp} value={form.to_date} onChange={(e) => set("to_date", e.target.value)} /></Field>
                {form.absence_type === "other" && (
                  <div className="pr-span-all">
                    <Field label="Please specify / Tafadhali ainisha"><input className="pr-input" style={inp} value={form.absence_other} onChange={(e) => set("absence_other", e.target.value)} placeholder="Specify other reason..." /></Field>
                  </div>
                )}
                <div className="pr-span-all">
                  <Field label="Reasons for Absence / Sababu za Kutokuwepo"><textarea className="pr-input" style={{ ...inp, resize: "vertical" }} rows={3} placeholder="Explain the reason for the leave..." value={form.reason} onChange={(e) => set("reason", e.target.value)} /></Field>
                </div>
              </div>
              <div style={{ marginTop: "0.9rem", display: "flex", gap: "0.6rem", alignItems: "flex-start", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "0.8rem 1rem" }}>
                <InfoIcon size={16} style={{ color: "#d97706", flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: "0.76rem", color: "#92400e", fontWeight: 600, lineHeight: 1.45 }}>
                  You must seek approval for leaves other than sick leave, 2 days prior to your first day of absence. / Lazima kuomba kibali kwa ajili ya likizo, isipokuwa likizo ya ugonjwa, siku 2 kabla ya siku yako ya kwanza ya kutokuwepo kazini.
                </span>
              </div>
            </Section>

            {/* SECTION 3: EMPLOYEE AUTHORIZATION */}
            <Section num={3} title="EMPLOYEE AUTHORIZATION / SAHIHI YA MFANYAKAZI">
              <div className="pr-grid3">
                <Field label="Employee's Signature / Sahihi ya Mfanyakazi"><input className="pr-input" style={inp} placeholder="Type your full name" value={form.employee_signature} onChange={(e) => set("employee_signature", e.target.value)} /></Field>
                <Field label="Date / Tarehe"><input type="date" className="pr-input" style={inp} value={form.employee_date} onChange={(e) => set("employee_date", e.target.value)} /></Field>
                <div className="pr-span-all">
                  <SignaturePad label="Signature (draw) / Sahihi" value={form.employee_signature_img || undefined} savedSignature={user?.signature} onChange={(d) => set("employee_signature_img", d || "")} height={130} />
                </div>
              </div>
            </Section>

            {formError && (
              <div style={{ marginTop: "1rem", fontSize: "0.8rem", fontWeight: 700, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "0.7rem 0.9rem" }}>{formError}</div>
            )}

            {/* FOOTER ACTIONS */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.7rem", marginTop: "0.5rem", paddingTop: "1.3rem", borderTop: "1px solid #e2e8f0", flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.76rem", color: "#94a3b8", fontWeight: 600 }}>
                <ShieldCheck size={15} style={{ color: "#10b981" }} /> Submitting routes this request to your Manager for approval.
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
                    {["Employee", "Type", "From", "To", "Status", "Submitted", ""].map((h, i) => (
                      <th key={h} style={{ textAlign: i === 6 ? "right" : "left", padding: "0 0.7rem 0.9rem", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#94a3b8", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => {
                    const sm = STATUS_META[r.status] || STATUS_META.manager_review;
                    return (
                      <tr key={r.id} className="pr-row">
                        <td style={{ padding: "0.85rem 0.7rem", fontWeight: 700, color: "#1e293b", fontSize: "0.85rem" }}>{r.employee_name}</td>
                        <td style={{ padding: "0.85rem 0.7rem", fontSize: "0.78rem", color: "#64748b" }}>{ABSENCE_TYPES[r.absence_type] || r.absence_type}</td>
                        <td style={{ padding: "0.85rem 0.7rem", fontSize: "0.78rem", color: "#475569", whiteSpace: "nowrap" }}>{fmtDate(r.from_date)}</td>
                        <td style={{ padding: "0.85rem 0.7rem", fontSize: "0.78rem", color: "#475569", whiteSpace: "nowrap" }}>{fmtDate(r.to_date)}</td>
                        <td style={{ padding: "0.85rem 0.7rem" }}><span style={{ background: sm.bg, color: sm.color, padding: "3px 10px", borderRadius: 20, fontSize: "0.64rem", fontWeight: 800, whiteSpace: "nowrap" }}>{sm.label}</span></td>
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
                    <tr><td colSpan={7} style={{ textAlign: "center", padding: "3rem", color: "#94a3b8", fontWeight: 600 }}>No leave requests found</td></tr>
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
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 900, margin: 0 }}>Leave Request #{selected.id}</h2>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", opacity: 0.9, fontWeight: 600 }}>{STATUS_META[selected.status]?.label}</p>
                </div>
                <button onClick={() => setSelected(null)} style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.2)", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} /></button>
              </div>
              <div style={{ padding: "1.3rem 1.5rem", overflowY: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.7rem 1.2rem", fontSize: "0.82rem" }}>
                  <Info label="Employee" value={selected.employee_name} />
                  <Info label="Department" value={selected.department} />
                  <Info label="Manager" value={selected.manager} />
                  <Info label="Type of Absence" value={ABSENCE_TYPES[selected.absence_type] || selected.absence_type} />
                  <Info label="From" value={fmtDate(selected.from_date)} />
                  <Info label="To" value={fmtDate(selected.to_date)} />
                  {selected.absence_other && <Info label="Specified" value={selected.absence_other} />}
                </div>
                {selected.reason && <p style={{ marginTop: "0.8rem", fontSize: "0.8rem", color: "#475569", background: "#f8fafc", padding: "0.7rem", borderRadius: 8 }}>{selected.reason}</p>}

                {/* Approval trail */}
                <div style={{ marginTop: "1.2rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <ApprovalRow title="Manager / Supervisor" name={selected.manager_name} decision={selected.manager_decision} date={selected.manager_date} comments={selected.manager_comments} signature={selected.manager_signature_img} />
                  <ApprovalRow title="General Manager / HR" name={selected.gm_name} decision={selected.gm_decision} date={selected.gm_date} comments={selected.gm_comments} signature={selected.gm_signature_img} />
                  <ApprovalRow title="Employer (Authorisation)" name={selected.md_name} decision={selected.status === "authorized" ? "authorized" : null} date={selected.md_date} comments={selected.md_comments} signature={selected.md_signature_img} />
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

                {/* Approval actions */}
                {canDecide(selected.status) && (
                  <div style={{ marginTop: "1.2rem", borderTop: "1px solid #f1f5f9", paddingTop: "1.2rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.7rem", fontWeight: 800, color: "#0f172a", fontSize: "0.85rem" }}>
                      <ShieldCheck size={16} style={{ color: "#4f46e5" }} /> Your Decision / Uamuzi Wako
                    </div>
                    <textarea style={{ ...inp, resize: "vertical", marginBottom: "0.5rem" }} rows={2} placeholder="Comments / Maoni..." value={comments} onChange={(e) => setComments(e.target.value)} />
                    {!user?.signature && (
                      <div style={{ marginBottom: "0.5rem", fontSize: "0.72rem", color: "#d97706", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "0.5rem 0.7rem", fontWeight: 600 }}>
                        Tip: set your signature in <strong>My Signature</strong> so it appears on the signed document.
                      </div>
                    )}
                    <div style={{ position: "relative" }}>
                      <Lock size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                      <input type="password" style={{ ...inp, paddingLeft: "2.2rem" }} placeholder="Enter your password / PIN to sign" value={pin} onChange={(e) => setPin(e.target.value)} />
                    </div>
                    <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.8rem" }}>
                      <button onClick={reject} disabled={acting} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", padding: "0.75rem", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer" }}><XCircle size={16} /> Rejected / Imekataliwa</button>
                      <button onClick={approve} disabled={acting} style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", padding: "0.75rem", borderRadius: 10, background: "#4f46e5", border: "none", color: "white", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer", boxShadow: "0 4px 12px rgba(79,70,229,0.3)" }}>
                        <CheckCircle2 size={16} /> {acting ? "Processing..." : selected.status === "md_review" ? "Authorize / Idhinisha" : "Approved / Imekubaliwa"}
                      </button>
                    </div>
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "0.5rem" }}>
        <div style={{ flex: 1 }}>
          {name && <div style={{ marginTop: "0.35rem", fontSize: "0.72rem", color: "#64748b" }}>{name} • {fmtDate(date)}</div>}
          {comments && <div style={{ marginTop: "0.25rem", fontSize: "0.74rem", color: "#334155" }}>{comments}</div>}
        </div>
        {signature && <img src={signature} alt="signature" style={{ height: 38, maxWidth: 130, objectFit: "contain" }} />}
      </div>
    </div>
  );
};

export default LeaveRequests;
