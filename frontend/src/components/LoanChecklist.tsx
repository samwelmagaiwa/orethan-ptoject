import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Check, ShieldCheck, AlertTriangle, RotateCcw, Paperclip, Eye, Loader2 } from "lucide-react";
import DocumentViewerModal from "./DocumentViewerModal";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

export type LoanCategory = "business" | "group" | "employee";
type ItemState = { checked: boolean; skip: boolean; attachmentUrl?: string; attachmentName?: string; attachmentType?: string };
export type ChecklistState = Record<string, ItemState>;

interface Props {
  category: LoanCategory;
  verified: Record<string, boolean>;            // keys auto-verified from the filled form
  onChange: (r: { state: ChecklistState; allResolved: boolean }) => void;
}

export const SECTIONS: Record<string, { title: string; items: { key: string; label: string }[] }> = {
  identification: {
    title: "1. PERSONAL IDENTIFICATION",
    items: [
      { key: "id_doc", label: "National ID / Passport / Voter ID" },
      { key: "passport_photo", label: "Passport-size Photo" },
      { key: "proof_residence", label: "Proof of Residence (Ward Letter / Local Govt Introduction)" },
    ],
  },
  tax: {
    title: "2. TAX & LEGAL COMPLIANCE",
    items: [
      { key: "tin", label: "TIN Certificate" },
      { key: "tax_clearance", label: "Tax Clearance Certificate" },
      { key: "business_license", label: "Business License" },
      { key: "incorporation", label: "Certificate of Incorporation (for companies)" },
    ],
  },
  financial: {
    title: "3. FINANCIAL DOCUMENTS",
    items: [
      { key: "bank_statements", label: "Bank Statements (last 6–12 months)" },
      { key: "salary_slips", label: "Salary Slips (last 3–6 months)" },
      { key: "employment_contract", label: "Employment Contract / Offer Letter" },
      { key: "other_income", label: "Proof of Other Income (if any)" },
    ],
  },
  collateral: {
    title: "5. COLLATERAL DOCUMENTS",
    items: [
      { key: "title_deed", label: "Title Deed / Ownership Documents" },
      { key: "valuation", label: "Valuation Report" },
      { key: "chattel", label: "Chattel Mortgage Form (movable assets)" },
      { key: "alt_mortgage", label: "Alternative Mortgage Documents (if applicable)" },
      { key: "insurance", label: "Insurance Cover for Collateral" },
    ],
  },
  guarantor: {
    title: "6. GUARANTOR DOCUMENTS",
    items: [
      { key: "guarantor_id", label: "Guarantor ID Copy" },
      { key: "guarantor_residence", label: "Guarantor Proof of Residence" },
      { key: "guarantor_photos", label: "Guarantor Passport Photos" },
    ],
  },
  loan_forms: {
    title: "7. LOAN APPLICATION FORMS",
    items: [
      { key: "application_form", label: "Completed Loan Application Form" },
      { key: "two_guarantors_signed", label: "Form Signed by Two Guarantors" },
      { key: "loan_agreement", label: "Signed Loan Agreement" },
      { key: "credit_consent", label: "Credit Reference / Credit Report Consent" },
      { key: "terms_ack", label: "Terms & Conditions Acknowledgment" },
    ],
  },
};

export const SECTIONS_BY_CATEGORY: Record<LoanCategory, string[]> = {
  business: ["identification", "tax", "collateral", "guarantor", "loan_forms"],
  group: ["identification", "tax", "collateral", "guarantor", "loan_forms"],
  employee: ["identification", "financial", "guarantor", "loan_forms"],
};

const LoanChecklist = ({ category, verified, onChange }: Props) => {
  const sectionKeys = SECTIONS_BY_CATEGORY[category];
  const allKeys = sectionKeys.flatMap((s) => SECTIONS[s].items.map((i) => i.key));

  const [state, setState] = useState<ChecklistState>(() => {
    const init: ChecklistState = {};
    allKeys.forEach((k) => { init[k] = { checked: !!verified[k], skip: false }; });
    return init;
  });

  // Keep auto-verified items ticked if the form data becomes available later.
  useEffect(() => {
    setState((prev) => {
      const next = { ...prev };
      let changed = false;
      allKeys.forEach((k) => {
        if (verified[k] && !next[k]?.checked) { next[k] = { checked: true, skip: false }; changed = true; }
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(verified)]);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    const allResolved = allKeys.every((k) => verified[k] || state[k]?.checked || state[k]?.skip);
    onChangeRef.current({ state, allResolved });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, JSON.stringify(verified)]);

  const toggleCheck = (k: string) => setState((p) => ({ ...p, [k]: { ...p[k], checked: !p[k].checked, skip: false } }));
  const toggleSkip = (k: string) => setState((p) => {
    const skip = !p[k].skip;
    return { ...p, [k]: { ...p[k], checked: skip ? false : p[k].checked, skip } };
  });

  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [viewerDoc, setViewerDoc] = useState<{ url: string; name: string; mimeType: string } | null>(null);

  const handleUpload = async (key: string, file: File) => {
    setUploadingKey(key);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_key", key);
      const token = localStorage.getItem("token");
      const res = await axios.post(`${API_BASE}/upload/document`, formData, {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      const { document_url, name, mime_type } = res.data;
      setState((p) => ({
        ...p,
        [key]: { ...p[key], checked: true, skip: false, attachmentUrl: document_url, attachmentName: name, attachmentType: mime_type },
      }));
    } catch (err) {
      console.error("Document upload failed", err);
      alert("Imeshindwa kupakia nyaraka. Tafadhali jaribu tena.");
    } finally {
      setUploadingKey(null);
    }
  };

  const totalUnresolved = allKeys.filter((k) => !(verified[k] || state[k]?.checked || state[k]?.skip)).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: totalUnresolved ? "#fffbeb" : "#ecfdf5", border: `1px solid ${totalUnresolved ? "#fde68a" : "#a7f3d0"}`, borderRadius: 10, padding: "0.7rem 1rem", marginBottom: "1rem", fontSize: "0.82rem", fontWeight: 600, color: totalUnresolved ? "#92400e" : "#047857" }}>
        {totalUnresolved
          ? <><AlertTriangle size={16} /> {totalUnresolved} document(s) not yet confirmed. Tick the ones you have, or use “Proceed without” to bypass missing items.</>
          : <><ShieldCheck size={16} /> All documents confirmed or bypassed — you can submit the request.</>}
      </div>

      {sectionKeys.map((sk) => {
        const sec = SECTIONS[sk];
        return (
          <div key={sk} style={{ marginBottom: "1.2rem" }}>
            <div className="ckl-banner">{sec.title}</div>
            <div className="ckl-grid">
              {sec.items.map((item) => {
                const isVerified = !!verified[item.key];
                const st = state[item.key] || { checked: false, skip: false };
                const resolved = isVerified || st.checked || st.skip;
                return (
                  <div key={item.key} className="ckl-item" style={{
                    borderColor: isVerified ? "#10b981" : st.skip ? "#f59e0b" : st.checked ? "#3b82f6" : (resolved ? "#e2e8f0" : "#fca5a5"),
                    background: isVerified ? "#ecfdf5" : st.skip ? "#fffbeb" : "#fff",
                  }}>
                    <label className="ckl-check" style={{ cursor: isVerified || st.skip ? "default" : "pointer" }}>
                      <input type="checkbox" checked={isVerified || st.checked} disabled={isVerified || st.skip} onChange={() => toggleCheck(item.key)} />
                      <span className={`ckl-box ${(isVerified || st.checked) ? "on" : ""}`}>{(isVerified || st.checked) && <Check size={12} />}</span>
                      <span className="ckl-label">{item.label}</span>
                    </label>
                    <div className="ckl-foot">
                      <div className="ckl-doc-actions">
                        <label className="ckl-doc-btn" title={st.attachmentUrl ? "Badilisha Nyaraka" : "Pakia Nyaraka (PDF/Picha)"}>
                          {uploadingKey === item.key ? <Loader2 size={12} className="ckl-spin" /> : <Paperclip size={12} />}
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            hidden
                            disabled={uploadingKey === item.key}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUpload(item.key, file);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {st.attachmentUrl && (
                          <button
                            type="button"
                            className="ckl-doc-btn ckl-doc-btn--view"
                            title="Tazama Nyaraka"
                            onClick={() => setViewerDoc({ url: st.attachmentUrl!, name: st.attachmentName || item.label, mimeType: st.attachmentType || "" })}
                          >
                            <Eye size={12} />
                          </button>
                        )}
                      </div>
                      {isVerified ? (
                        <span className="ckl-tag ckl-tag--ok"><ShieldCheck size={11} /> Auto-verified</span>
                      ) : st.skip ? (
                        <button type="button" className="ckl-skipbtn ckl-skipbtn--on" onClick={() => toggleSkip(item.key)}><RotateCcw size={11} /> Bypassed — undo</button>
                      ) : (
                        <button type="button" className="ckl-skipbtn" onClick={() => toggleSkip(item.key)}>Proceed without</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <style>{`
        .ckl-banner { background: #102a43; color: #fff; padding: 0.6rem 1rem; border-radius: 6px; font-weight: 800; font-size: 0.78rem; letter-spacing: 0.5px; margin-bottom: 0.8rem; }
        .ckl-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 0.8rem; }
        .ckl-item { border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 0.7rem 0.8rem; display: flex; flex-direction: column; justify-content: space-between; gap: 0.5rem; transition: all 0.15s; }
        .ckl-check { display: flex; align-items: flex-start; gap: 0.55rem; }
        .ckl-check input { display: none; }
        .ckl-box { width: 20px; height: 20px; border-radius: 6px; border: 2px solid #cbd5e1; background: #fff; display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; margin-top: 1px; }
        .ckl-box.on { background: #10b981; border-color: #10b981; }
        .ckl-label { font-size: 0.78rem; font-weight: 600; color: #1e293b; line-height: 1.35; }
        .ckl-foot { display: flex; justify-content: space-between; align-items: center; gap: 0.4rem; }
        .ckl-doc-actions { display: flex; align-items: center; gap: 0.3rem; }
        .ckl-doc-btn { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 6px; background: #f1f5f9; border: 1px solid #e2e8f0; color: #475569; cursor: pointer; flex-shrink: 0; }
        .ckl-doc-btn:hover { background: #e2e8f0; }
        .ckl-doc-btn--view { background: #dbeafe; border-color: #bfdbfe; color: #1d4ed8; }
        .ckl-doc-btn--view:hover { background: #bfdbfe; }
        .ckl-spin { animation: ckl-spin 0.8s linear infinite; }
        @keyframes ckl-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .ckl-tag { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.64rem; font-weight: 800; padding: 2px 8px; border-radius: 20px; }
        .ckl-tag--ok { background: #d1fae5; color: #059669; }
        .ckl-skipbtn { background: #f1f5f9; border: 1px solid #e2e8f0; color: #64748b; font-size: 0.64rem; font-weight: 700; padding: 3px 9px; border-radius: 20px; cursor: pointer; }
        .ckl-skipbtn:hover { background: #e2e8f0; }
        .ckl-skipbtn--on { display: inline-flex; align-items: center; gap: 0.25rem; background: #fef3c7; border-color: #fde68a; color: #b45309; }
        @media (max-width: 900px) { .ckl-grid { grid-template-columns: repeat(2, minmax(0,1fr)); } }
        @media (max-width: 600px) { .ckl-grid { grid-template-columns: 1fr; } }
      `}</style>

      <DocumentViewerModal
        isOpen={!!viewerDoc}
        url={viewerDoc?.url ?? null}
        name={viewerDoc?.name}
        mimeType={viewerDoc?.mimeType}
        onClose={() => setViewerDoc(null)}
      />
    </div>
  );
};

export default LoanChecklist;
