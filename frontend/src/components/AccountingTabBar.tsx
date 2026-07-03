import { useNavigate, useLocation } from "react-router-dom";
import type { FC, ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  children?: ReactNode;
  activePath?: string;
}

const TABS = [
  { id: "coa",     path: "/accounting/chart-of-accounts",  icon: "🗂️", key: "chartOfAccounts" },
  { id: "journal", path: "/accounting/journal-entries",     icon: "📝", key: "journalEntries" },
  { id: "ledger",  path: "/accounting/general-ledger",      icon: "📖", key: "generalLedger" },
  { id: "trial",   path: "/accounting/trial-balance",       icon: "⚖️", key: "trialBalance" },
  { id: "income",  path: "/accounting/income-statement",    icon: "📊", key: "incomeStatement" },
  { id: "balance", path: "/accounting/balance-sheet",       icon: "🏛️", key: "balanceSheet" },
  { id: "cash",    path: "/accounting/cash-book",           icon: "💵", key: "cashBook" },
  { id: "bank",    path: "/accounting/bank-reconciliation", icon: "🏦", key: "bankReconciliation" },
];

const AccountingTabBar: FC<Props> = ({ children, activePath }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation("common");
  const currentPath = activePath || location.pathname;

  return (
    <>
      <div className="acc-tab-bar">
        <div className="acc-tab-scroll">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`acc-tab ${currentPath === tab.path ? "acc-tab--active" : ""}`}
              onClick={() => navigate(tab.path)}
            >
              {tab.icon} {t(`sidebar.${tab.key}`)}
            </button>
          ))}
        </div>
        {children && (
          <div className="acc-tab-actions">
            {children}
          </div>
        )}
      </div>
      <style>{`
        .acc-tab-bar {
          display: flex;
          align-items: stretch;
          background: #f1f5f9;
          position: sticky;
          top: 0;
          z-index: 10;
          border-bottom: 2px solid #e2e8f0;
          min-height: 50px;
        }
        .acc-tab-scroll {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          padding: 12px 14px 0;
          overflow-x: auto;
          flex: 1;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .acc-tab-scroll::-webkit-scrollbar {
          display: none;
        }
        .acc-tab-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          flex-shrink: 0;
          border-left: 1px solid #e2e8f0;
          background: #f1f5f9;
        }
        .acc-tab {
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
        .acc-tab--active {
          background: white;
          color: #102a43;
          box-shadow: 0 -2px 0 #1e5fae inset;
        }
        .acc-tab:hover:not(.acc-tab--active) {
          background: #e2e8f0;
          color: #334155;
        }
      `}</style>
    </>
  );
};

export default AccountingTabBar;
