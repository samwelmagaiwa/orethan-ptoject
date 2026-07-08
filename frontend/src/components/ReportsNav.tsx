import type { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";

interface Props {
  actions?: ReactNode;
}

const TABS = [
  { path: "/reports/risk",      emoji: "⚠️",  label: "Risk Reports"      },
  { path: "/reports/financial", emoji: "📊", label: "Financial Reports"  },
];

const ReportsNav = ({ actions }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();

  const active = TABS.find(t => location.pathname.startsWith(t.path))?.path ?? "";

  return (
    <>
      <style>{css}</style>
      <div className="rn-nav">
        <div className="rn-nav__scroll">
          {/* Brand pill */}
          <div className="rn-nav__brand">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            <span>Reports</span>
          </div>
          <div className="rn-nav__sep" />
          {TABS.map(tab => (
            <button
              key={tab.path}
              className={`rn-nav__tab${active === tab.path ? " rn-nav__tab--active" : ""}`}
              onClick={() => navigate(tab.path)}
              title={tab.label}
            >
              <span className="rn-nav__emoji">{tab.emoji}</span>
              <span className="rn-nav__label">{tab.label}</span>
            </button>
          ))}
        </div>
        {actions && <div className="rn-nav__actions">{actions}</div>}
      </div>
    </>
  );
};

const css = `
.rn-nav {
  display: flex;
  align-items: stretch;
  background: #f1f5f9;
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 2px solid #e2e8f0;
  min-height: 50px;
}
.rn-nav__scroll {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  padding: 10px 14px 0;
  overflow-x: auto;
  flex: 1;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.rn-nav__scroll::-webkit-scrollbar { display: none; }
.rn-nav__brand {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 800;
  color: #102a43;
  white-space: nowrap;
  padding-bottom: 10px;
  flex-shrink: 0;
}
.rn-nav__sep {
  width: 1px;
  height: 24px;
  background: #cbd5e1;
  margin: 0 8px 10px;
  flex-shrink: 0;
}
.rn-nav__tab {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 14px;
  border: none;
  border-radius: 8px 8px 0 0;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  background: transparent;
  color: #64748b;
  transition: all .15s;
  white-space: nowrap;
  flex-shrink: 0;
  line-height: 1;
  font-family: inherit;
}
.rn-nav__tab:hover:not(.rn-nav__tab--active) { background: #e2e8f0; color: #334e68; }
.rn-nav__tab--active {
  background: #fff;
  color: #102a43;
  box-shadow: 0 -2px 0 #1e5fae inset;
}
.rn-nav__emoji { font-size: 14px; line-height: 1; }
.rn-nav__label { font-size: 12.5px; }
.rn-nav__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  flex-shrink: 0;
  border-left: 1px solid #e2e8f0;
  background: #f1f5f9;
}
@media (max-width: 640px) {
  .rn-nav__label { display: none; }
  .rn-nav__tab { padding: 8px 10px; }
  .rn-nav__emoji { font-size: 16px; }
}
`;

export default ReportsNav;
