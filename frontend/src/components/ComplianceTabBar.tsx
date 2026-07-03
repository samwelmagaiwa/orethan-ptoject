import { useNavigate, useLocation } from "react-router-dom";
import type { FC, ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  children?: ReactNode;
  activePath?: string;
}

const TABS = [
  { id: "regulator", path: "/reports/regulator", icon: "📊", key: "regulatorReports" },
  { id: "lifecycle", path: "/loan-lifecycle",    icon: "🔄", key: "loanLifecycle" },
];

const ComplianceTabBar: FC<Props> = ({ children, activePath }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation("common");
  const currentPath = activePath || location.pathname;

  return (
    <>
      <div className="cmp-tab-bar">
        <div className="cmp-tab-scroll">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`cmp-tab ${currentPath === tab.path ? "cmp-tab--active" : ""}`}
              onClick={() => navigate(tab.path)}
            >
              {tab.icon} {t(`sidebar.${tab.key}`)}
            </button>
          ))}
        </div>
        {children && (
          <div className="cmp-tab-actions">
            {children}
          </div>
        )}
      </div>
      <style>{`
        .cmp-tab-bar {
          display: flex;
          align-items: stretch;
          background: #f1f5f9;
          position: sticky;
          top: 0;
          z-index: 10;
          border-bottom: 2px solid #e2e8f0;
          min-height: 50px;
        }
        .cmp-tab-scroll {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          padding: 12px 14px 0;
          overflow-x: auto;
          flex: 1;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .cmp-tab-scroll::-webkit-scrollbar { display: none; }
        .cmp-tab-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          flex-shrink: 0;
          border-left: 1px solid #e2e8f0;
          background: #f1f5f9;
        }
        .cmp-tab {
          white-space: nowrap;
          padding: 8px 16px;
          border: none;
          border-radius: 8px 8px 0 0;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          background: transparent;
          color: #64748b;
          transition: all .15s;
          flex-shrink: 0;
        }
        .cmp-tab--active {
          background: white;
          color: #102a43;
          box-shadow: 0 -2px 0 #1e5fae inset;
        }
        .cmp-tab:hover:not(.cmp-tab--active) {
          background: #e2e8f0;
          color: #334155;
        }
      `}</style>
    </>
  );
};

export default ComplianceTabBar;
