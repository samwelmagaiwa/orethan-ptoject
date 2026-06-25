import { useEffect, useState } from "react";
import axios from "axios";
import { Send, Lock } from "lucide-react";
import SignaturePad from "./SignaturePad";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

const inp: React.CSSProperties = { width: "100%", padding: "0.7rem 0.9rem", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", outline: "none", fontWeight: 600, fontSize: "0.9rem", color: "#1e293b", boxSizing: "border-box", fontFamily: "inherit" };
const lbl: React.CSSProperties = { display: "block", fontSize: "0.7rem", fontWeight: 700, color: "#64748b", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.5px" };

interface Props {
  onSuccess?: (msg: string) => void;
}

/**
 * Full "Kukaimisha Ofisi na Madaraka kwa Muda" form, used by MD and GM
 * inline on the Leave page and on the Delegations page.
 */
const DelegationForm = ({ onSuccess }: Props) => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isGM = user?.role === "general_manager";
  const delegatorTitle = isGM ? "General Manager" : "Managing Director";
  const defaultActing = isGM ? "Acting General Manager" : "Acting Managing Director";

  const today = new Date().toISOString().slice(0, 10);
  const blank = { delegate_id: "", acting_title: defaultActing, reason: "", from_date: today, to_date: today, responsibilities: "", limitations: "", handover_notes: "", delegator_signature_img: user?.signature || "", delegator_date: today };
  const [form, setForm] = useState<any>(blank);
  const [staff, setStaff] = useState<any[]>([]);
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const headers = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    axios.get(`${API_BASE}/delegations/staff`, { headers: headers() }).then((r) => setStaff(r.data.staff || [])).catch(() => {});
  }, []);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const submit = async () => {
    setFormError("");
    if (!form.delegate_id || !form.responsibilities || !form.from_date || !form.to_date) { setFormError("Please select the staff, period and responsibilities being delegated."); return; }
    if (!pin.trim()) { setFormError("Enter your password/PIN to sign and authorize the delegation."); return; }
    setSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/delegations`, { ...form, password: pin }, { headers: headers() });
      setForm(blank); setPin("");
      onSuccess?.(res.data?.message || "Your office delegation has been sent to the selected staff. They will be notified to acknowledge it.");
    } catch (e: any) { setFormError(e?.response?.data?.message || "Submit failed"); } finally { setSubmitting(false); }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 10px 28px rgba(15,23,42,0.08)", padding: "1.7rem 1.9rem" }}>
      <div style={{ background: "#102a43", color: "#fff", padding: "0.8rem 1.2rem", borderRadius: 8, fontWeight: 800, fontSize: "0.85rem", letterSpacing: "0.6px", marginBottom: "1rem", boxShadow: "0 4px 12px rgba(16,42,67,0.18)" }}>
        FOMU YA KUKAIMISHA OFISI NA MADARAKA KWA MUDA
      </div>
      <p style={{ fontSize: "0.82rem", color: "#64748b", margin: "0 0 1.2rem", lineHeight: 1.5 }}>
        Mimi <strong style={{ color: "#0f172a" }}>{user?.name}</strong> ({delegatorTitle}), kwa kuwa nitakuwa nje ya ofisi, nakaimisha ofisi na madaraka yangu kwa mtumishi niliyemchagua hapa chini kwa kipindi kilichoainishwa.
      </p>

      <div className="dlg-grid3">
        <div>
          <label style={lbl}>Your Role / Cheo Chako</label>
          <input style={{ ...inp, background: "#f1f5f9", color: "#64748b", textTransform: "capitalize", cursor: "not-allowed", fontWeight: 700 }} value={String(user?.role || "").replace(/_/g, " ")} readOnly title="Your role (auto)" />
        </div>
        <div>
          <label style={lbl}>Delegate To / Mkaimishwa <span style={{ color: "#ef4444" }}>*</span></label>
          <select style={inp} value={form.delegate_id} onChange={(e) => set("delegate_id", e.target.value)}>
            <option value="">— Select staff —</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name} ({String(s.role).replace(/_/g, " ")})</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Acting Title / Cheo cha Kukaimu</label>
          <input style={inp} value={form.acting_title} onChange={(e) => set("acting_title", e.target.value)} />
        </div>
        <div>
          <label style={lbl}>From / Kuanzia <span style={{ color: "#ef4444" }}>*</span></label>
          <input type="date" style={inp} value={form.from_date} onChange={(e) => set("from_date", e.target.value)} />
        </div>
        <div>
          <label style={lbl}>To / Mpaka <span style={{ color: "#ef4444" }}>*</span></label>
          <input type="date" style={inp} value={form.to_date} onChange={(e) => set("to_date", e.target.value)} />
        </div>
        <div>
          <label style={lbl}>Reason for absence / Sababu ya kutokuwepo</label>
          <input style={inp} value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="e.g. Official travel, leave..." />
        </div>
        <div>
          <label style={lbl}>Responsibilities &amp; Authority / Madaraka <span style={{ color: "#ef4444" }}>*</span></label>
          <textarea style={{ ...inp, resize: "vertical" }} rows={4} value={form.responsibilities} onChange={(e) => set("responsibilities", e.target.value)} placeholder="Duties & decision-making authority being delegated..." />
        </div>
        <div>
          <label style={lbl}>Limitations / Mipaka (optional)</label>
          <textarea style={{ ...inp, resize: "vertical" }} rows={4} value={form.limitations} onChange={(e) => set("limitations", e.target.value)} placeholder="e.g. Approvals up to TZS 5,000,000; no new hires..." />
        </div>
        <div>
          <label style={lbl}>Handover Notes / Makabidhiano (optional)</label>
          <textarea style={{ ...inp, resize: "vertical" }} rows={4} value={form.handover_notes} onChange={(e) => set("handover_notes", e.target.value)} placeholder="Pending matters, key contacts, ongoing items..." />
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <SignaturePad label={`${delegatorTitle} Signature / Sahihi`} value={form.delegator_signature_img || undefined} savedSignature={user?.signature} onChange={(d) => set("delegator_signature_img", d || "")} height={120} />
        </div>
        <div>
          <label style={lbl}>Authorize with Password / PIN <span style={{ color: "#ef4444" }}>*</span></label>
          <div style={{ position: "relative" }}>
            <Lock size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input type="password" style={{ ...inp, paddingLeft: "2.2rem" }} value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Password / PIN to sign" />
          </div>
        </div>
      </div>

      {formError && <div style={{ marginTop: "1rem", fontSize: "0.8rem", fontWeight: 700, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "0.7rem 0.9rem" }}>{formError}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.7rem", marginTop: "1.3rem", paddingTop: "1.2rem", borderTop: "1px solid #e2e8f0" }}>
        <button onClick={() => { setForm(blank); setPin(""); setFormError(""); }} style={{ padding: "0.8rem 1.6rem", borderRadius: 8, background: "#94a3b8", border: "none", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", color: "white" }}>Clear</button>
        <button onClick={submit} disabled={submitting} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.8rem 2rem", borderRadius: 8, background: "#102a43", border: "none", fontWeight: 800, fontSize: "0.85rem", cursor: "pointer", color: "white", boxShadow: "0 6px 16px rgba(16,42,67,0.3)" }}>
          <Send size={16} /> {submitting ? "Submitting..." : "Delegate Authority"}
        </button>
      </div>

      <style>{`
        .dlg-grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.7rem 1.2rem; }
        @media (max-width: 900px) { .dlg-grid3 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 600px) { .dlg-grid3 { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
};

export default DelegationForm;
