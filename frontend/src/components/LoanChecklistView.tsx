import React, { useState } from "react";
import { Eye, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SECTIONS, SECTIONS_BY_CATEGORY, type LoanCategory } from "./LoanChecklist";
import DocumentViewerModal from "./DocumentViewerModal";
import { resolveFileUrl } from "../utils/resolveFileUrl";

type ItemState = { checked?: boolean; skip?: boolean; attachmentUrl?: string; attachmentName?: string; attachmentType?: string };

interface Props {
  /** loan type as stored on the loan record */
  type?: string;
  /** loan.details — used to derive the category and the saved checklist */
  details?: Record<string, any> | null;
}

/** Derive the checklist category from the loan type / details (mirrors the forms). */
const deriveCategory = (type?: string, details?: Record<string, any> | null): LoanCategory => {
  if (type === "group") return "group";
  if (type === "employee") return "employee";
  // personal / business forms pick employee when the applicant is employed
  return details?.umeajiriwa === "Ndio" ? "employee" : "business";
};

/**
 * Read-only rendering of the documentation checklist the loan officer cross-checked
 * before submitting. Shows every item as Confirmed (provided/auto-verified) or
 * Bypassed ("Proceed without"), so approvers can review before approving.
 */
const LoanChecklistView: React.FC<Props> = ({ type, details }) => {
  const { t } = useTranslation("historyModals");
  const [viewerDoc, setViewerDoc] = useState<{ url: string; name: string; mimeType: string } | null>(null);
  const data: Record<string, ItemState> | undefined = details?.documentation_checklist;
  if (!data || typeof data !== "object" || Object.keys(data).length === 0) return null;

  const category = deriveCategory(type, details);
  const sectionKeys = SECTIONS_BY_CATEGORY[category];

  const allItems = sectionKeys.flatMap((s) => SECTIONS[s].items);
  const allKeys = allItems.map((i) => i.key);
  const bypassed = allKeys.filter((k) => data[k]?.skip).length;
  const confirmed = allKeys.filter((k) => data[k]?.checked && !data[k]?.skip).length;
  const missing = allKeys.filter((k) => !data[k]?.checked && !data[k]?.skip).length;

  const attachments = allItems
    .filter((item) => !!data[item.key]?.attachmentUrl)
    .map((item) => ({
      key: item.key,
      label: item.label,
      url: data[item.key].attachmentUrl as string,
      name: data[item.key].attachmentName || t(item.label),
      mimeType: data[item.key].attachmentType || "",
    }));
  const isImage = (mimeType: string, url: string) => mimeType.includes("image") || /\.(jpe?g|png|gif|webp)$/i.test(url);

  return (
    <div className="pdf-section ckv-section">
      <div className="pdf-section-title">{t("checklistView.heading")}</div>

      <div className="ckv-summary no-print">
        <span className="ckv-pill ckv-pill--ok">{t("checklistView.summary.confirmed", { count: confirmed })}</span>
        {bypassed > 0 && <span className="ckv-pill ckv-pill--skip">{t("checklistView.summary.bypassed", { count: bypassed })}</span>}
        {missing > 0 && <span className="ckv-pill ckv-pill--miss">{t("checklistView.summary.missing", { count: missing })}</span>}
      </div>

      {attachments.length > 0 && (
        <div className="ckv-gallery no-print">
          <div className="ckv-gallery-title">{t("checklistView.gallery.title", { count: attachments.length })}</div>
          <div className="ckv-gallery-grid">
            {attachments.map((att) => (
              <button
                type="button"
                key={att.key}
                className="ckv-gallery-card"
                onClick={() => setViewerDoc({ url: att.url, name: att.name, mimeType: att.mimeType })}
              >
                <div className="ckv-gallery-thumb">
                  {isImage(att.mimeType, att.url) ? (
                    <img src={resolveFileUrl(att.url)} alt={t(att.label)} />
                  ) : (
                    <FileText size={28} />
                  )}
                </div>
                <span className="ckv-gallery-label">{t(att.label)}</span>
                <span className="ckv-gallery-view"><Eye size={11} /> {t("checklistView.actions.view")}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="ckv-body">
        {sectionKeys.map((sk) => {
          const sec = SECTIONS[sk];
          return (
            <div key={sk} className="ckv-group">
              <div className="ckv-group-title">{t(sec.title)}</div>
              {sec.items.map((item) => {
                const st = data[item.key] || {};
                const status = st.skip ? "skip" : st.checked ? "ok" : "miss";
                return (
                  <div key={item.key} className={`ckv-row ckv-row--${status}`}>
                    <span className="ckv-label">{t(item.label)}</span>
                    <span className="ckv-row-right">
                      {st.attachmentUrl && (
                        <button
                          type="button"
                          className="ckv-view-btn no-print"
                          title={t("checklistView.actions.viewDocument")}
                          onClick={() => setViewerDoc({ url: st.attachmentUrl!, name: st.attachmentName || t(item.label), mimeType: st.attachmentType || "" })}
                        >
                          <Eye size={11} /> {t("checklistView.actions.view")}
                        </button>
                      )}
                      <span className={`ckv-tag ckv-tag--${status}`}>
                        {status === "ok" ? t("checklistView.status.confirmed") : status === "skip" ? t("checklistView.status.bypassed") : t("checklistView.status.missing")}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <style>{`
        .ckv-summary { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 60px 0; }
        .ckv-pill { font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 20px; }
        .ckv-pill--ok { background: #dcfce7; color: #166534; }
        .ckv-pill--skip { background: #fef3c7; color: #b45309; }
        .ckv-pill--miss { background: #fee2e2; color: #991b1b; }

        .ckv-gallery { padding: 14px 60px 0; }
        .ckv-gallery-title { font-size: 11px; font-weight: 900; color: #102a43; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 10px; }
        .ckv-gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; }
        .ckv-gallery-card { display: flex; flex-direction: column; align-items: center; gap: 6px; background: #fff; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 10px 8px; cursor: pointer; text-align: center; transition: all 0.15s; }
        .ckv-gallery-card:hover { border-color: #1e5fae; box-shadow: 0 4px 12px rgba(30, 95, 174, 0.12); transform: translateY(-1px); }
        .ckv-gallery-thumb { width: 100%; height: 64px; border-radius: 6px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #64748b; overflow: hidden; }
        .ckv-gallery-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .ckv-gallery-label { font-size: 10.5px; font-weight: 700; color: #1e293b; line-height: 1.25; }
        .ckv-gallery-view { display: inline-flex; align-items: center; gap: 3px; font-size: 9px; font-weight: 800; color: #1e5fae; }

        .ckv-body { padding: 14px 60px 24px; column-count: 2; column-gap: 28px; }
        .ckv-group { break-inside: avoid; margin-bottom: 16px; }
        .ckv-group-title { font-size: 11px; font-weight: 900; color: #0f172a; background: #f1f5f9; padding: 6px 10px; border-radius: 4px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.3px; }
        .ckv-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 8px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 5px; }
        .ckv-row--ok { background: #f0fdf4; border-color: #bbf7d0; }
        .ckv-row--skip { background: #fffbeb; border-color: #fde68a; }
        .ckv-row--miss { background: #fef2f2; border-color: #fecaca; }
        .ckv-label { font-size: 12px; font-weight: 600; color: #1e293b; line-height: 1.3; }
        .ckv-row-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .ckv-view-btn { display: inline-flex; align-items: center; gap: 3px; background: #dbeafe; border: 1px solid #bfdbfe; color: #1d4ed8; font-size: 9px; font-weight: 800; padding: 2px 7px; border-radius: 20px; cursor: pointer; }
        .ckv-view-btn:hover { background: #bfdbfe; }
        .ckv-tag { font-size: 9px; font-weight: 900; white-space: nowrap; flex-shrink: 0; letter-spacing: 0.2px; }
        .ckv-tag--ok { color: #16a34a; }
        .ckv-tag--skip { color: #b45309; }
        .ckv-tag--miss { color: #dc2626; }

        @media (max-width: 900px) { .ckv-body { column-count: 1; } }
        @media print { .ckv-body { column-count: 2; } .ckv-summary { display: none !important; } }
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

export default LoanChecklistView;
