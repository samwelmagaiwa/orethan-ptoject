import React from "react";
import { SECTIONS, SECTIONS_BY_CATEGORY, type LoanCategory } from "./LoanChecklist";

type ItemState = { checked?: boolean; skip?: boolean };

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
  const data: Record<string, ItemState> | undefined = details?.documentation_checklist;
  if (!data || typeof data !== "object" || Object.keys(data).length === 0) return null;

  const category = deriveCategory(type, details);
  const sectionKeys = SECTIONS_BY_CATEGORY[category];

  const allKeys = sectionKeys.flatMap((s) => SECTIONS[s].items.map((i) => i.key));
  const bypassed = allKeys.filter((k) => data[k]?.skip).length;
  const confirmed = allKeys.filter((k) => data[k]?.checked && !data[k]?.skip).length;
  const missing = allKeys.filter((k) => !data[k]?.checked && !data[k]?.skip).length;

  return (
    <div className="pdf-section ckv-section">
      <div className="pdf-section-title">ORODHA YA UHAKIKI WA NYARAKA (DOCUMENTATION CHECKLIST)</div>

      <div className="ckv-summary no-print">
        <span className="ckv-pill ckv-pill--ok">{confirmed} Zimethibitishwa / Confirmed</span>
        {bypassed > 0 && <span className="ckv-pill ckv-pill--skip">{bypassed} Zimerukwa / Proceed-without</span>}
        {missing > 0 && <span className="ckv-pill ckv-pill--miss">{missing} Hazijajazwa / Missing</span>}
      </div>

      <div className="ckv-body">
        {sectionKeys.map((sk) => {
          const sec = SECTIONS[sk];
          return (
            <div key={sk} className="ckv-group">
              <div className="ckv-group-title">{sec.title}</div>
              {sec.items.map((item) => {
                const st = data[item.key] || {};
                const status = st.skip ? "skip" : st.checked ? "ok" : "miss";
                return (
                  <div key={item.key} className={`ckv-row ckv-row--${status}`}>
                    <span className="ckv-label">{item.label}</span>
                    <span className={`ckv-tag ckv-tag--${status}`}>
                      {status === "ok" ? "✓ IMETHIBITISHWA" : status === "skip" ? "↷ IMERUKWA (Proceed without)" : "✕ HAIJAJAZWA"}
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

        .ckv-body { padding: 14px 60px 24px; column-count: 2; column-gap: 28px; }
        .ckv-group { break-inside: avoid; margin-bottom: 16px; }
        .ckv-group-title { font-size: 11px; font-weight: 900; color: #0f172a; background: #f1f5f9; padding: 6px 10px; border-radius: 4px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.3px; }
        .ckv-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 8px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 5px; }
        .ckv-row--ok { background: #f0fdf4; border-color: #bbf7d0; }
        .ckv-row--skip { background: #fffbeb; border-color: #fde68a; }
        .ckv-row--miss { background: #fef2f2; border-color: #fecaca; }
        .ckv-label { font-size: 12px; font-weight: 600; color: #1e293b; line-height: 1.3; }
        .ckv-tag { font-size: 9px; font-weight: 900; white-space: nowrap; flex-shrink: 0; letter-spacing: 0.2px; }
        .ckv-tag--ok { color: #16a34a; }
        .ckv-tag--skip { color: #b45309; }
        .ckv-tag--miss { color: #dc2626; }

        @media (max-width: 900px) { .ckv-body { column-count: 1; } }
        @media print { .ckv-body { column-count: 2; } .ckv-summary { display: none !important; } }
      `}</style>
    </div>
  );
};

export default LoanChecklistView;
