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
  /** Right-side controls: buttons, date pickers, export buttons, etc. */
  children?: ReactNode;
  /** Optional sub-tab row below the title bar */
  tabs?: Tab[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
}

const PageHeader: FC<Props> = ({ icon, title, subtitle, children, tabs, activeTab, onTabChange }) => (
  <>
    <div className="phd-bar">
      <div className="phd-title-block">
        {icon && <span className="phd-icon">{icon}</span>}
        <div>
          <h1 className="phd-title">{title}</h1>
          {subtitle && <p className="phd-sub">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="phd-actions">{children}</div>}
    </div>
    {tabs && tabs.length > 0 && (
      <div className="phd-tab-row">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`phd-tab ${activeTab === tab.key ? "phd-tab--active" : ""}`}
            onClick={() => onTabChange?.(tab.key)}
          >
            {tab.icon && <span>{tab.icon}</span>} {tab.label}
          </button>
        ))}
      </div>
    )}
    <style>{`
      .phd-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        background: #f1f5f9;
        border-bottom: 2px solid #e2e8f0;
        padding: 10px 18px;
        position: sticky;
        top: 0;
        z-index: 10;
        min-height: 56px;
        flex-wrap: wrap;
      }
      .phd-title-block {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
        min-width: 0;
      }
      .phd-icon {
        font-size: 22px;
        flex-shrink: 0;
      }
      .phd-title {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 800;
        color: #0f172a;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .phd-sub {
        margin: 0;
        font-size: 11px;
        color: #64748b;
        font-weight: 500;
        margin-top: 1px;
      }
      .phd-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
        flex-wrap: wrap;
      }
      .phd-tab-row {
        display: flex;
        align-items: flex-end;
        gap: 4px;
        background: #f1f5f9;
        border-bottom: 2px solid #e2e8f0;
        padding: 8px 14px 0;
        position: sticky;
        top: 56px;
        z-index: 9;
        overflow-x: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .phd-tab-row::-webkit-scrollbar { display: none; }
      .phd-tab {
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
      .phd-tab--active {
        background: white;
        color: #102a43;
        box-shadow: 0 -2px 0 #1e5fae inset;
      }
      .phd-tab:hover:not(.phd-tab--active) {
        background: #e2e8f0;
        color: #334155;
      }
    `}</style>
  </>
);

export default PageHeader;
