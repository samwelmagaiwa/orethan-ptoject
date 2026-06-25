import { useEffect, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Inbox, PlusCircle, X, CheckCircle2, XCircle, Clock, Lock, UserCheck } from "lucide-react";
import SuccessModal from "../components/SuccessModal";
import DelegationForm from "../components/DelegationForm";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: "Awaiting Acknowledgement", bg: "#fff7ed", color: "#ea580c" },
  acknowledged: { label: "Acknowledged / Imekubaliwa", bg: "#ecfdf5", color: "#059669" },
  declined: { label: "Declined / Imekataliwa", bg: "#fef2f2", color: "#dc2626" },
};

const inp: React.CSSProperties = { width: "100%", padding: "0.7rem 0.9rem", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", outline: "none", fontWeight: 600, fontSize: "0.9rem", color: "#1e293b", boxSizing: "border-box", fontFamily: "inherit" };

const Delegations = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const canDelegate = ["managing_director", "general_manager", "loan_manager", "admin"].includes(user?.role);
  const hasOversight = ["managing_director", "general_manager"].includes(user?.role);
  const [tab, setTab] = useState<"new" | "list">(canDelegate ? "new" : "list");
  const [scope, setScope] = useState<"mine" | "assigned" | "oversight" | "all">(canDelegate ? "mine" : "assigned");
  const [list, setList] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [success, setSuccess] = useState({ open: false, title: "", message: "" });

  const [ackPin, setAckPin] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [acting, setActing] = useState(false);

  const headers = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const load = async () => {
    try {
      const res = await axios.get(`${API_BASE}/delegations`, { headers: headers(), params: { scope } });
      setList(res.data.delegations || []);
    } catch (e) { console.error(e); }
  };
  useEffect(() => { load(); }, [scope]);

  const openDetail = (d: any) => { setSelected(d); setAckPin(""); setDeclineReason(""); };

  const adminDelete = async (id: number) => {
    if (!window.confirm("Delete this delegation permanently?")) return;
    try {
      await axios.delete(`${API_BASE}/delegations/${id}`, { headers: headers() });
      await load();
    } catch (e: any) { alert(e?.response?.data?.message || "Delete failed"); }
  };
  const canAct = (d: any) => d.status === "pending" && (d.delegate_id === user?.id || user?.role === "admin");

  const acknowledge = async () => {
    if (!ackPin.trim()) { alert("Enter your password/PIN to acknowledge."); return; }
    setActing(true);
    try {
      await axios.post(`${API_BASE}/delegations/${selected.id}/acknowledge`, { password: ackPin }, { headers: headers() });
      setSelected(null); await load();
      setSuccess({ open: true, title: "Delegation Acknowledged", message: "You have accepted the delegated authority. The acting role is now in effect for the stated period." });
    } catch (e: any) { alert(e?.response?.data?.message || "Action failed"); } finally { setActing(false); }
  };

  const decline = async () => {
    if (!declineReason.trim()) { alert("Provide a reason to decline."); return; }
    if (!ackPin.trim()) { alert("Enter your password/PIN to confirm."); return; }
    setActing(true);
    try {
      await axios.post(`${API_BASE}/delegations/${selected.id}/decline`, { reason: declineReason, password: ackPin }, { headers: headers() });
      setSelected(null); await load();
    } catch (e: any) { alert(e?.response?.data?.message || "Action failed"); } finally { setActing(false); }
  };

  const onFormSuccess = async (msg: string) => {
    setTab("list"); setScope("mine");
    await load();
    setSuccess({ open: true, title: "Delegation Submitted", message: msg });
  };

  return (
    <div style={{ minHeight: "100vh", maxWidth: "100%", overflowX: "hidden", boxSizing: "border-box", background: "#fdfbf7", padding: "0.7rem 1rem 1.5rem", fontFamily: "'Plus Jakarta Sans','Inter',sans-serif", color: "#1e293b" }}>

      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <UserCheck size={22} style={{ color: "#4f46e5" }} />
        <h1 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "#0f172a" }}>Office Delegation / Kukaimisha Ofisi na Madaraka</h1>
        <div style={{ marginLeft: "auto", display: "flex", background: "#f1f5f9", padding: 4, borderRadius: 10, gap: 3 }}>
          {([["list", "Delegations", Inbox], ...(canDelegate ? [["new", "New Delegation", PlusCircle]] : [])] as const).map(([k, l, Icon]: any) => (
            <button key={k} onClick={() => setTab(k)} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", borderRadius: 8, border: "none", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", background: tab === k ? "white" : "transparent", color: tab === k ? "#4f46e5" : "#64748b", boxShadow: tab === k ? "0 1px 4px rgba(15,23,42,0.1)" : "none" }}>
              <Icon size={15} /> {l}
            </button>
          ))}
        </div>
      </div>

      {tab === "new" && canDelegate ? (
        <div style={{ background: "#e8f0fe", borderRadius: 14, padding: "0.5rem" }}>
          <DelegationForm onSuccess={onFormSuccess} />
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.8rem" }}>
            {([["assigned", "Assigned to Me"], ...(canDelegate ? [["mine", "Created by Me"]] : []), ...(hasOversight ? [["oversight", "Oversight (View)"]] : []), ["all", "All"]] as const).map(([k, l]: any) => (
              <button key={k} onClick={() => setScope(k)} style={{ padding: "0.45rem 1rem", borderRadius: 8, border: "1px solid #e2e8f0", background: scope === k ? "#4f46e5" : "white", color: scope === k ? "white" : "#64748b", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer" }}>{l}</button>
            ))}
          </div>
          <div style={{ background: "white", borderRadius: 14, border: "1px solid #eef1f6", boxShadow: "0 6px 18px rgba(15,23,42,0.07)", padding: "1.3rem" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>{["Delegator", "Delegate", "Acting As", "Period", "Status", ""].map((h, i) => (
                    <th key={h} style={{ textAlign: i === 5 ? "right" : "left", padding: "0 0.7rem 0.9rem", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#94a3b8", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {list.map((d) => {
                    const sm = STATUS_META[d.status] || STATUS_META.pending;
                    return (
                      <tr key={d.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "0.85rem 0.7rem", fontWeight: 700, color: "#1e293b", fontSize: "0.84rem" }}>{d.delegator_name}<div style={{ fontSize: "0.66rem", color: "#94a3b8", fontWeight: 600 }}>{d.delegator_title}</div></td>
                        <td style={{ padding: "0.85rem 0.7rem", fontSize: "0.82rem", color: "#475569" }}>{d.delegate_name}</td>
                        <td style={{ padding: "0.85rem 0.7rem", fontSize: "0.8rem", color: "#64748b" }}>{d.acting_title}</td>
                        <td style={{ padding: "0.85rem 0.7rem", fontSize: "0.78rem", color: "#475569", whiteSpace: "nowrap" }}>{fmtDate(d.from_date)} – {fmtDate(d.to_date)}</td>
                        <td style={{ padding: "0.85rem 0.7rem" }}><span style={{ background: sm.bg, color: sm.color, padding: "3px 10px", borderRadius: 20, fontSize: "0.64rem", fontWeight: 800, whiteSpace: "nowrap" }}>{sm.label}</span></td>
                        <td style={{ padding: "0.85rem 0.7rem", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                            <button onClick={() => openDetail(d)} style={{ padding: "0.4rem 0.9rem", borderRadius: 8, background: "#eef2ff", border: "none", color: "#4f46e5", fontWeight: 700, fontSize: "0.7rem", cursor: "pointer" }}>{canAct(d) ? "Review" : "View"}</button>
                            {user?.role === "admin" && (
                              <button onClick={() => adminDelete(d.id)} style={{ padding: "0.4rem 0.8rem", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontWeight: 700, fontSize: "0.7rem", cursor: "pointer" }}>Delete</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {list.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: "3rem", color: "#94a3b8", fontWeight: 600 }}>No delegations found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* DETAIL MODAL */}
      <AnimatePresence>
        {selected && (
          <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", backdropFilter: "blur(10px)", background: "rgba(0,0,0,0.6)" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ width: "100%", maxWidth: 620, maxHeight: "90vh", borderRadius: 18, background: "white", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 25px 60px rgba(0,0,0,0.4)" }}>
              <div style={{ background: "linear-gradient(135deg,#102a43,#1d3a5f)", padding: "1.3rem 1.5rem", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ fontSize: "1.05rem", fontWeight: 900, margin: 0 }}>Delegation of Office &amp; Authority</h2>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.76rem", opacity: 0.9, fontWeight: 600 }}>{STATUS_META[selected.status]?.label}</p>
                </div>
                <button onClick={() => setSelected(null)} style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.2)", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} /></button>
              </div>
              <div style={{ padding: "1.3rem 1.5rem", overflowY: "auto" }}>
                <div style={{ background: "#f8fafc", border: "1px solid #eef1f6", borderRadius: 12, padding: "1rem 1.1rem", fontSize: "0.85rem", color: "#334155", lineHeight: 1.6, marginBottom: "1.1rem" }}>
                  <strong style={{ color: "#0f172a" }}>{selected.delegator_name}</strong> ({selected.delegator_title}) delegates authority to <strong style={{ color: "#0f172a" }}>{selected.delegate_name}</strong>{selected.delegate_role ? ` (${String(selected.delegate_role).replace(/_/g, " ")})` : ""} as <strong style={{ color: "#4f46e5" }}>{selected.acting_title}</strong> from <strong>{fmtDate(selected.from_date)}</strong> to <strong>{fmtDate(selected.to_date)}</strong>.
                </div>
                <Field label="Reason / Sababu" value={selected.reason} />
                <Field label="Responsibilities & Authority / Madaraka" value={selected.responsibilities} />
                {selected.limitations && <Field label="Limitations / Mipaka" value={selected.limitations} />}
                {selected.handover_notes && <Field label="Handover Notes / Makabidhiano" value={selected.handover_notes} />}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
                  <SigBox label={`${selected.delegator_title} (Delegator)`} name={selected.delegator_name} date={selected.delegator_date} img={selected.delegator_signature_img} />
                  <SigBox label={`${selected.acting_title} (Delegate)`} name={selected.delegate_name} date={selected.delegate_date} img={selected.delegate_signature_img} pending={selected.status === "pending"} />
                </div>

                {selected.status === "declined" && (
                  <p style={{ marginTop: "1rem", fontSize: "0.8rem", color: "#dc2626", background: "#fef2f2", padding: "0.7rem", borderRadius: 8, fontWeight: 600 }}>Declined: {selected.decline_reason}</p>
                )}

                {canAct(selected) && (
                  <div style={{ marginTop: "1.2rem", borderTop: "1px solid #f1f5f9", paddingTop: "1.2rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.7rem", fontWeight: 800, color: "#0f172a", fontSize: "0.85rem" }}>
                      <ShieldCheck size={16} style={{ color: "#4f46e5" }} /> Acknowledge this delegation
                    </div>
                    <textarea style={{ ...inp, resize: "vertical", marginBottom: "0.5rem" }} rows={2} placeholder="Reason (required only if declining)..." value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} />
                    <div style={{ position: "relative" }}>
                      <Lock size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                      <input type="password" style={{ ...inp, paddingLeft: "2.2rem" }} placeholder="Enter your password / PIN" value={ackPin} onChange={(e) => setAckPin(e.target.value)} />
                    </div>
                    <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.8rem" }}>
                      <button onClick={decline} disabled={acting} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", padding: "0.75rem", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer" }}><XCircle size={16} /> Decline</button>
                      <button onClick={acknowledge} disabled={acting} style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", padding: "0.75rem", borderRadius: 10, background: "#059669", border: "none", color: "white", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer", boxShadow: "0 4px 12px rgba(5,150,105,0.3)" }}>
                        <CheckCircle2 size={16} /> {acting ? "Processing..." : "Accept Delegation"}
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
    </div>
  );
};

const Field = ({ label, value }: { label: string; value: any }) => (
  <div style={{ marginBottom: "0.7rem" }}>
    <span style={{ display: "block", fontSize: "0.62rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</span>
    <span style={{ fontWeight: 600, color: "#1e293b", fontSize: "0.85rem", whiteSpace: "pre-wrap" }}>{value || "—"}</span>
  </div>
);

const SigBox = ({ label, name, date, img, pending }: any) => (
  <div style={{ background: "#f8fafc", border: "1px solid #eef1f6", borderRadius: 10, padding: "0.7rem 0.9rem", textAlign: "center" }}>
    <div style={{ height: 42, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      {img ? <img src={img} alt="signature" style={{ height: 40, maxWidth: 140, objectFit: "contain" }} /> : pending ? <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "#94a3b8", fontSize: "0.66rem", fontWeight: 700 }}><Clock size={11} /> Pending</span> : null}
    </div>
    <div style={{ borderTop: "1.5px solid #0f172a", paddingTop: "8px", marginTop: "4px", fontSize: "0.68rem", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</div>
    {name && <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "3px" }}>{name}{date ? " · " + fmtDate(date) : ""}</div>}
  </div>
);

export default Delegations;
