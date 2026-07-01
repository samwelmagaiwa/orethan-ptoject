import { useState, ReactNode } from "react";

export interface HelpStep {
  title: string;
  text: string;
  example?: string;
}
interface GetHelpProps {
  title?: string;
  intro?: string;
  steps: HelpStep[];
  tip?: string;
  children?: ReactNode;
}

/**
 * Collapsible "Get Help" panel: a single button that expands into a numbered
 * step-by-step walkthrough (with optional worked examples) for the page it's
 * placed on. Closed by default so it never crowds the page.
 */
const GetHelp = ({ title = "How to use this page", intro, steps, tip, children }: GetHelpProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="gh-wrap">
      <button className="gh-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="gh-toggle__icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 2-3 4" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </span>
        <span>Get Help</span>
        <span className={`gh-toggle__chevron ${open ? "gh-toggle__chevron--open" : ""}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </span>
      </button>

      {open && (
        <div className="gh-panel">
          <h4>{title}</h4>
          {intro && <p className="gh-intro">{intro}</p>}
          <ol className="gh-steps">
            {steps.map((s, i) => (
              <li key={i}>
                <strong>{s.title}</strong>
                <p>{s.text}</p>
                {s.example && <div className="gh-example"><span>Example:</span> {s.example}</div>}
              </li>
            ))}
          </ol>
          {children}
          {tip && <div className="gh-tip"><strong>Tip:</strong> {tip}</div>}
        </div>
      )}

      <style>{`
        .gh-wrap { margin-bottom: 16px; }
        .gh-toggle { display: inline-flex; align-items: center; gap: 8px; background: #eef4ff; color: #1e5fae; border: 1px solid #c9dcfb; padding: 9px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .gh-toggle:hover { background: #e0ecff; }
        .gh-toggle__icon { display: flex; }
        .gh-toggle__chevron { display: flex; transition: transform .15s ease; }
        .gh-toggle__chevron--open { transform: rotate(180deg); }
        .gh-panel { margin-top: 10px; background: #fbfdff; border: 1px solid #d8e6fb; border-radius: 14px; padding: 18px 22px; animation: gh-fade .15s ease; }
        @keyframes gh-fade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .gh-panel h4 { margin: 0 0 6px; color: #102a43; font-size: 16px; }
        .gh-intro { margin: 0 0 14px; color: #486581; font-size: 13.5px; line-height: 1.5; }
        .gh-steps { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 12px; }
        .gh-steps li strong { color: #243b53; font-size: 13.5px; }
        .gh-steps li p { margin: 3px 0 0; color: #627d98; font-size: 13px; line-height: 1.5; }
        .gh-example { margin-top: 6px; background: #f0f6ff; border-left: 3px solid #1e5fae; padding: 7px 10px; border-radius: 6px; font-size: 12.5px; color: #334e68; }
        .gh-example span { font-weight: 700; color: #1e5fae; }
        .gh-tip { margin-top: 16px; background: #fff8e6; border: 1px solid #f5dfa3; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #7a5c00; }
      `}</style>
    </div>
  );
};

export default GetHelp;
