import { useEffect, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("miscModals");
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const TITLES: Record<string, [string, string]> = {
    general_manager: [t("delegation.titles.generalManager"), t("delegation.titles.actingGeneralManager")],
    loan_manager: [t("delegation.titles.loanManager"), t("delegation.titles.actingLoanManager")],
    managing_director: [t("delegation.titles.managingDirector"), t("delegation.titles.actingManagingDirector")],
  };
  const [delegatorTitle, defaultActing] = TITLES[user?.role] || [t("delegation.titles.managingDirector"), t("delegation.titles.actingManagingDirector")];

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
    if (!form.delegate_id || !form.responsibilities || !form.from_date || !form.to_date) { setFormError(t("delegation.validation.requiredFields")); return; }
    if (!pin.trim()) { setFormError(t("delegation.validation.requirePin")); return; }
    setSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/delegations`, { ...form, password: pin }, { headers: headers() });
      setForm(blank); setPin("");
      onSuccess?.(res.data?.message || t("delegation.submitSuccess"));
    } catch (e: any) { setFormError(e?.response?.data?.message || t("delegation.submitFailed")); } finally { setSubmitting(false); }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 10px 28px rgba(15,23,42,0.08)", padding: "1.7rem 1.9rem" }}>
      <div style={{ background: "#102a43", color: "#fff", padding: "0.8rem 1.2rem", borderRadius: 8, fontWeight: 800, fontSize: "0.85rem", letterSpacing: "0.6px", marginBottom: "1rem", boxShadow: "0 4px 12px rgba(16,42,67,0.18)" }}>
        {t("delegation.formTitle")}
      </div>
      <p style={{ fontSize: "0.82rem", color: "#64748b", margin: "0 0 1.2rem", lineHeight: 1.5 }}>
        {t("delegation.intro.prefix")} <strong style={{ color: "#0f172a" }}>{user?.name}</strong> ({delegatorTitle}), {t("delegation.intro.suffix")}
      </p>

      <div className="dlg-grid3">
        <div>
          <label style={lbl}>{t("delegation.fields.yourRole")}</label>
          <input style={{ ...inp, background: "#f1f5f9", color: "#64748b", textTransform: "capitalize", cursor: "not-allowed", fontWeight: 700 }} value={String(user?.role || "").replace(/_/g, " ")} readOnly title={t("delegation.fields.yourRoleTitle")} />
        </div>
        <div>
          <label style={lbl}>{t("delegation.fields.delegateTo")} <span style={{ color: "#ef4444" }}>*</span></label>
          <select style={inp} value={form.delegate_id} onChange={(e) => set("delegate_id", e.target.value)}>
            <option value="">{t("delegation.fields.selectStaff")}</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name} ({String(s.role).replace(/_/g, " ")})</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>{t("delegation.fields.actingTitle")}</label>
          <input style={inp} value={form.acting_title} onChange={(e) => set("acting_title", e.target.value)} />
        </div>
        <div>
          <label style={lbl}>{t("delegation.fields.fromDate")} <span style={{ color: "#ef4444" }}>*</span></label>
          <input type="date" style={inp} value={form.from_date} onChange={(e) => set("from_date", e.target.value)} />
        </div>
        <div>
          <label style={lbl}>{t("delegation.fields.toDate")} <span style={{ color: "#ef4444" }}>*</span></label>
          <input type="date" style={inp} value={form.to_date} onChange={(e) => set("to_date", e.target.value)} />
        </div>
        <div>
          <label style={lbl}>{t("delegation.fields.reason")}</label>
          <input style={inp} value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder={t("delegation.fields.reasonPlaceholder")} />
        </div>
        <div>
          <label style={lbl}>{t("delegation.fields.responsibilities")} <span style={{ color: "#ef4444" }}>*</span></label>
          <textarea style={{ ...inp, resize: "vertical" }} rows={4} value={form.responsibilities} onChange={(e) => set("responsibilities", e.target.value)} placeholder={t("delegation.fields.responsibilitiesPlaceholder")} />
        </div>
        <div>
          <label style={lbl}>{t("delegation.fields.limitations")}</label>
          <textarea style={{ ...inp, resize: "vertical" }} rows={4} value={form.limitations} onChange={(e) => set("limitations", e.target.value)} placeholder={t("delegation.fields.limitationsPlaceholder")} />
        </div>
        <div>
          <label style={lbl}>{t("delegation.fields.handoverNotes")}</label>
          <textarea style={{ ...inp, resize: "vertical" }} rows={4} value={form.handover_notes} onChange={(e) => set("handover_notes", e.target.value)} placeholder={t("delegation.fields.handoverNotesPlaceholder")} />
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <SignaturePad label={`${delegatorTitle} ${t("delegation.fields.signatureSuffix")}`} value={form.delegator_signature_img || undefined} savedSignature={user?.signature} onChange={(d) => set("delegator_signature_img", d || "")} height={120} />
        </div>
        <div>
          <label style={lbl}>{t("delegation.fields.authorizePin")} <span style={{ color: "#ef4444" }}>*</span></label>
          <div style={{ position: "relative" }}>
            <Lock size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input type="password" style={{ ...inp, paddingLeft: "2.2rem" }} value={pin} onChange={(e) => setPin(e.target.value)} placeholder={t("delegation.fields.pinPlaceholder")} />
          </div>
        </div>
      </div>

      {formError && <div style={{ marginTop: "1rem", fontSize: "0.8rem", fontWeight: 700, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "0.7rem 0.9rem" }}>{formError}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.7rem", marginTop: "1.3rem", paddingTop: "1.2rem", borderTop: "1px solid #e2e8f0" }}>
        <button onClick={() => { setForm(blank); setPin(""); setFormError(""); }} style={{ padding: "0.8rem 1.6rem", borderRadius: 8, background: "#94a3b8", border: "none", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", color: "white" }}>{t("delegation.clear")}</button>
        <button onClick={submit} disabled={submitting} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.8rem 2rem", borderRadius: 8, background: "#102a43", border: "none", fontWeight: 800, fontSize: "0.85rem", cursor: "pointer", color: "white", boxShadow: "0 6px 16px rgba(16,42,67,0.3)" }}>
          <Send size={16} /> {submitting ? t("delegation.submitting") : t("delegation.delegateAuthority")}
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
