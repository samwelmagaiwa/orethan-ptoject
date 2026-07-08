import type { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface Props {
  actions?: ReactNode;
}

const TABS = [
  { key: "chart-of-accounts",   emoji: "📊", labelKey: "sidebar.chartOfAccounts"   },
  { key: "journal-entries",     emoji: "📓", labelKey: "sidebar.journalEntries"     },
  { key: "general-ledger",      emoji: "📖", labelKey: "sidebar.generalLedger"      },
  { key: "trial-balance",       emoji: "⚖️",  labelKey: "sidebar.trialBalance"       },
  { key: "income-statement",    emoji: "📈", labelKey: "sidebar.incomeStatement"    },
  { key: "balance-sheet",       emoji: "🏛️",  labelKey: "sidebar.balanceSheet"       },
  { key: "cash-book",           emoji: "💵", labelKey: "sidebar.cashBook"           },
  { key: "bank-reconciliation", emoji: "🏦", labelKey: "sidebar.bankReconciliation" },
];

const AccountingNav = ({ actions }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const active = TABS.find(tab => location.pathname.includes(tab.key))?.key ?? "";

  return (
    <>
      <style>{css}</style>
      <div className="acct-nav">
        <div className="acct-nav__scroll">
          {/* Brand pill */}
          <div className="acct-nav__brand">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <span>Accounting</span>
          </div>
          <div className="acct-nav__sep" />
          {/* Tabs */}
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={`acct-nav__tab${active === tab.key ? " acct-nav__tab--active" : ""}`}
              onClick={() => navigate(`/accounting/${tab.key}`)}
              title={t(tab.labelKey)}
            >
              <span className="acct-nav__emoji">{tab.emoji}</span>
              <span className="acct-nav__label">{t(tab.labelKey)}</span>
            </button>
          ))}
        </div>
        {actions && <div className="acct-nav__actions">{actions}</div>}
      </div>
    </>
  );
};

const css = `
.acct-nav {
  display: flex;
  align-items: stretch;
  background: #f1f5f9;
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 2px solid #e2e8f0;
  min-height: 50px;
}
.acct-nav__scroll {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  padding: 10px 14px 0;
  overflow-x: auto;
  flex: 1;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.acct-nav__scroll::-webkit-scrollbar { display: none; }
.acct-nav__brand {
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
.acct-nav__sep {
  width: 1px;
  height: 24px;
  background: #cbd5e1;
  margin: 0 8px 10px;
  flex-shrink: 0;
}
.acct-nav__tab {
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
.acct-nav__tab:hover:not(.acct-nav__tab--active) { background: #e2e8f0; color: #334e68; }
.acct-nav__tab--active {
  background: #fff;
  color: #102a43;
  box-shadow: 0 -2px 0 #1e5fae inset;
}
.acct-nav__emoji { font-size: 14px; line-height: 1; }
.acct-nav__label { font-size: 12.5px; }
.acct-nav__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  flex-shrink: 0;
  border-left: 1px solid #e2e8f0;
  background: #f1f5f9;
}
@media (max-width: 900px) {
  .acct-nav__label { display: none; }
  .acct-nav__tab { padding: 8px 10px; }
  .acct-nav__emoji { font-size: 16px; }
}
`;

export default AccountingNav;
