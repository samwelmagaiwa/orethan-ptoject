import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Check, ShieldCheck, AlertTriangle, RotateCcw, Paperclip, Eye, Loader2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import DocumentViewerModal from "./DocumentViewerModal";
import ConfirmModal from "./ConfirmModal";
import { API_BASE } from "../lib/api";


export type LoanCategory = "business" | "group" | "employee";
type ItemState = { checked: boolean; skip: boolean; attachmentUrl?: string; attachmentName?: string; attachmentType?: string };
export type ChecklistState = Record<string, ItemState>;

interface Props {
  category: LoanCategory;
  verified: Record<string, boolean>;            // keys auto-verified from the filled form
  onChange: (r: { state: ChecklistState; allResolved: boolean }) => void;
}

// NOTE: `title`/`label` below are i18next keys (namespace "historyModals"), not display
// text. Render with t(section.title) / t(item.label) -- see LoanChecklist and
// LoanChecklistView, which both consume this shared map.
export const SECTIONS: Record<string, { title: string; items: { key: string; label: string; noUpload?: boolean }[] }> = {
  identification: {
    title: "checklist.sections.identification.title",
    items: [
      { key: "id_doc", label: "checklist.items.idDoc" },
      { key: "passport_photo", label: "checklist.items.passportPhoto" },
      { key: "proof_residence", label: "checklist.items.proofResidence" },
    ],
  },
  tax: {
    title: "checklist.sections.tax.title",
    items: [
      { key: "tin", label: "checklist.items.tin" },
      { key: "tax_clearance", label: "checklist.items.taxClearance" },
      { key: "business_license", label: "checklist.items.businessLicense" },
      { key: "incorporation", label: "checklist.items.incorporation" },
    ],
  },
  financial: {
    title: "checklist.sections.financial.title",
    items: [
      { key: "bank_statements", label: "checklist.items.bankStatements" },
      { key: "salary_slips", label: "checklist.items.salarySlips" },
      { key: "employment_contract", label: "checklist.items.employmentContract" },
      { key: "other_income", label: "checklist.items.otherIncome" },
    ],
  },
  collateral: {
    title: "checklist.sections.collateral.title",
    items: [
      { key: "title_deed", label: "checklist.items.titleDeed" },
      { key: "valuation", label: "checklist.items.valuation" },
      { key: "chattel", label: "checklist.items.chattel" },
      { key: "alt_mortgage", label: "checklist.items.altMortgage" },
      { key: "insurance", label: "checklist.items.insurance" },
    ],
  },
  guarantor: {
    title: "checklist.sections.guarantor.title",
    items: [
      { key: "guarantor_id", label: "checklist.items.guarantorId" },
      { key: "guarantor_residence", label: "checklist.items.guarantorResidence" },
      { key: "guarantor_photos", label: "checklist.items.guarantorPhotos" },
    ],
  },
  loan_forms: {
    title: "checklist.sections.loanForms.title",
    items: [
      // These are in-form declarations/checkboxes, not scannable documents --
      // verification-only, no upload affordance (matches original behaviour).
      { key: "application_form", label: "checklist.items.applicationForm", noUpload: true },
      { key: "two_guarantors_signed", label: "checklist.items.twoGuarantorsSigned", noUpload: true },
      { key: "loan_agreement", label: "checklist.items.loanAgreement", noUpload: true },
      { key: "credit_consent", label: "checklist.items.creditConsent", noUpload: true },
      { key: "terms_ack", label: "checklist.items.termsAck", noUpload: true },
    ],
  },
};

export const SECTIONS_BY_CATEGORY: Record<LoanCategory, string[]> = {
  business: ["identification", "tax", "collateral", "guarantor", "loan_forms"],
  group: ["identification", "tax", "collateral", "guarantor", "loan_forms"],
  employee: ["identification", "financial", "guarantor", "loan_forms"],
};

const LoanChecklist = ({ category, verified, onChange }: Props) => {
  const { t } = useTranslation("historyModals");
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

  const toggleSkip = (k: string) => setState((p) => {
    const skip = !p[k].skip;
    return { ...p, [k]: { ...p[k], checked: skip ? false : p[k].checked, skip } };
  });

  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [viewerDoc, setViewerDoc] = useState<{ url: string; name: string; mimeType: string } | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

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
      alert(t("checklist.alerts.uploadFailed"));
    } finally {
      setUploadingKey(null);
    }
  };

  const removeAttachment = (key: string) => {
    setState((p) => ({
      ...p,
      [key]: { ...p[key], checked: false, attachmentUrl: undefined, attachmentName: undefined, attachmentType: undefined },
    }));
  };

  const totalUnresolved = allKeys.filter((k) => !(verified[k] || state[k]?.checked || state[k]?.skip)).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: totalUnresolved ? "#fffbeb" : "#ecfdf5", border: `1px solid ${totalUnresolved ? "#fde68a" : "#a7f3d0"}`, borderRadius: 10, padding: "0.7rem 1rem", marginBottom: "1rem", fontSize: "0.82rem", fontWeight: 600, color: totalUnresolved ? "#92400e" : "#047857" }}>
        {totalUnresolved
          ? <><AlertTriangle size={16} /> {t("checklist.banner.unresolved", { count: totalUnresolved })}</>
          : <><ShieldCheck size={16} /> {t("checklist.banner.allResolved")}</>}
      </div>

      {sectionKeys.map((sk) => {
        const sec = SECTIONS[sk];
        return (
          <div key={sk} style={{ marginBottom: "1.2rem" }}>
            <div className="ckl-banner">{t(sec.title)}</div>
            <div className="ckl-grid">
              {sec.items.map((item) => {
                const isVerified = !!verified[item.key];
                const st = state[item.key] || { checked: false, skip: false };
                const resolved = isVerified || st.checked || st.skip;
                return (
                  <div key={item.key} className="ckl-item" style={{
                    borderColor: isVerified ? "#10b981" : st.skip ? "#f59e0b" : st.checked ? "#3b82f6" : (resolved ? "#e2e8f0" : "#fca5a5"),
                    background: isVerified ? "#ecfdf5" : st.skip ? "#fffbeb" : st.checked ? "#eff6ff" : "#fff",
                  }}>
                    <label className="ckl-check" style={{ cursor: "default" }}>
                      <input type="checkbox" checked={isVerified || st.checked} disabled readOnly />
                      <span className={`ckl-box ${(isVerified || st.checked) ? "on" : ""}`}>{(isVerified || st.checked) && <Check size={12} />}</span>
                      <span className="ckl-label">{t(item.label)}</span>
                    </label>
                    <div className="ckl-foot">
                      <div className="ckl-doc-actions">
                        {!item.noUpload && (
                          <label
                            className={`ckl-doc-btn ${st.skip ? "ckl-doc-btn--muted" : ""}`}
                            title={st.skip ? t("checklist.titles.skippedFirst") : st.attachmentUrl ? t("checklist.titles.replaceDocument") : t("checklist.titles.uploadDocument")}
                          >
                            {uploadingKey === item.key ? <Loader2 size={12} className="ckl-spin" /> : <Paperclip size={12} />}
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              hidden
                              disabled={uploadingKey === item.key || st.skip}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUpload(item.key, file);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        )}
                        {st.attachmentUrl && (
                            <>
                              <button
                                type="button"
                                className="ckl-doc-btn ckl-doc-btn--view"
                                title={t("checklist.titles.viewDocument")}
                                onClick={() => setViewerDoc({ url: st.attachmentUrl!, name: st.attachmentName || t(item.label), mimeType: st.attachmentType || "" })}
                              >
                                <Eye size={12} />
                              </button>
                              <button
                                type="button"
                                className="ckl-doc-btn ckl-doc-btn--delete"
                                title={t("checklist.titles.deleteDocument")}
                                onClick={() => setConfirmDeleteKey(item.key)}
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                      </div>
                      {isVerified ? (
                        <span className="ckl-tag ckl-tag--ok"><ShieldCheck size={11} /> {t("checklist.tags.autoVerified")}</span>
                      ) : st.checked && st.attachmentUrl ? (
                        <span className="ckl-tag ckl-tag--ok"><Check size={11} /> {t("checklist.tags.uploaded")}</span>
                      ) : st.skip ? (
                        <button type="button" className="ckl-skipbtn ckl-skipbtn--on" onClick={() => toggleSkip(item.key)}><RotateCcw size={11} /> {t("checklist.actions.bypassedUndo")}</button>
                      ) : (
                        <button type="button" className="ckl-skipbtn" onClick={() => toggleSkip(item.key)}>{t("checklist.actions.proceedWithout")}</button>
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
        .ckl-doc-btn--delete { background: #fee2e2; border-color: #fecaca; color: #dc2626; }
        .ckl-doc-btn--delete:hover { background: #fecaca; }
        .ckl-doc-btn--muted { opacity: 0.4; cursor: not-allowed; pointer-events: none; background: #f1f5f9; color: #94a3b8; }
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

      <ConfirmModal
        isOpen={!!confirmDeleteKey}
        title={t("checklist.confirmDelete.title")}
        message={t("checklist.confirmDelete.message")}
        type="danger"
        confirmText={t("checklist.confirmDelete.confirm")}
        cancelText={t("checklist.confirmDelete.cancel")}
        onConfirm={() => {
          if (confirmDeleteKey) removeAttachment(confirmDeleteKey);
          setConfirmDeleteKey(null);
        }}
        onCancel={() => setConfirmDeleteKey(null)}
      />
    </div>
  );
};

export default LoanChecklist;
