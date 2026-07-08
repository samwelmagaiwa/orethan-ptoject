import type { FC, ReactNode } from "react";

interface Tab {
  key: string;
  label: string;
  icon?: string;
}

interface Props {
  icon?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  tabs?: Tab[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
}

const PageHeader: FC<Props> = ({ icon, title, subtitle, children, tabs, activeTab, onTabChange }) => (
  <>
    <div className="phd-bar">
      <div className="phd-scroll">
        {/* Brand pill */}
        <div className="phd-brand">
          {icon && <span className="phd-icon">{icon}</span>}
          <div>
            <div className="phd-title">{title}</div>
            {subtitle && <div className="phd-sub">{subtitle}</div>}
          </div>
        </div>
        {/* Tabs inline in same bar */}
        {tabs && tabs.length > 0 && (
          <>
            <div className="phd-sep" />
            {tabs.map(tab => (
              <button
                key={tab.key}
                className={`phd-tab ${activeTab === tab.key ? "phd-tab--active" : ""}`}
                onClick={() => onTabChange?.(tab.key)}
              >
                {tab.icon && <span>{tab.icon}</span>} {tab.label}
              </button>
            ))}
          </>
        )}
      </div>
      {children && <div className="phd-actions">{children}</div>}
    </div>
    <style>{`
      .phd-bar {
        display: flex;
        align-items: stretch;
        background: #f1f5f9;
        border-bottom: 2px solid #e2e8f0;
        position: sticky;
        top: 0;
        z-index: 10;
        min-height: 50px;
      }
      .phd-scroll {
        display: flex;
        align-items: flex-end;
        gap: 4px;
        padding: 10px 14px 0;
        overflow-x: auto;
        flex: 1;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .phd-scroll::-webkit-scrollbar { display: none; }
      .phd-brand {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-bottom: 10px;
        flex-shrink: 0;
      }
      .phd-icon {
        font-size: 18px;
        flex-shrink: 0;
        line-height: 1;
      }
      .phd-title {
        font-size: 13px;
        font-weight: 800;
        color: #102a43;
        white-space: nowrap;
        line-height: 1.2;
      }
      .phd-sub {
        font-size: 10px;
        color: #64748b;
        font-weight: 500;
        margin-top: 1px;
        white-space: nowrap;
      }
      .phd-sep {
        width: 1px;
        height: 24px;
        background: #cbd5e1;
        margin: 0 8px 10px;
        flex-shrink: 0;
      }
      .phd-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 14px;
        flex-shrink: 0;
        border-left: 1px solid #e2e8f0;
        background: #f1f5f9;
        flex-wrap: wrap;
      }
      .phd-tab {
        display: flex;
        align-items: center;
        gap: 5px;
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
        font-family: inherit;
      }
      .phd-tab--active {
        background: white;
        color: #102a43;
        box-shadow: 0 -2px 0 #1e5fae inset;
      }
      .phd-tab:hover:not(.phd-tab--active) {
        background: #e2e8f0;
        color: #334155;
      }
      @media (max-width: 640px) {
        .phd-actions { flex-basis: 100%; border-left: none; border-top: 1px solid #e2e8f0; justify-content: flex-start; }
      }
    `}</style>
  </>
);

export default PageHeader;
