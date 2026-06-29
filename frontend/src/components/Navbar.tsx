import type { FC } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import NotificationBell from "./NotificationBell";
import UserMenu from "./UserMenu";
import LanguageSwitcher from "./LanguageSwitcher";

const pageTitleKeys: Record<string, string> = {
  "/dashboard": "dashboard",
  "/personal-loan": "personalLoan",
  "/group-loan": "groupLoan",
  "/employee-loan": "employeeLoan",
  "/loan-manager": "loanManager",
  "/general-manager": "generalManager",
  "/managing-director": "managingDirector",
  "/repayment-tracker": "repaymentTracker",
  "/users": "users",
};

const Navbar: FC = () => {
  const location = useLocation();
  const { t } = useTranslation();
  const titleKey = pageTitleKeys[location.pathname] || "dashboard";
  const subtitle = t(`navbar.pageTitles.${titleKey}`);

  return (
    <div className="nb">
      <div className="nb__left">
        <div className="nb__title">{t("navbar.appTitle")}</div>
        <div className="nb__subtitle">{subtitle}</div>
      </div>

      <div id="navbar-portal" className="nb__portal"></div>

      <div className="nb__right">
        <LanguageSwitcher />
        <NotificationBell />
        <UserMenu />
      </div>

      <style>{`
        .nb {
          position: sticky;
          top: 0; left: 0; right: 0;
          height: 80px;
          background: #ffffff;
          color: #1e293b;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 28px;
          border-bottom: 1px solid #e2e8f0;
          z-index: 99;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .nb__left { display: flex; flex-direction: column; gap: 2px; }
        .nb__title { font-size: 16px; font-weight: 800; color: #102a43; }
        .nb__subtitle { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }

        .nb__portal { flex: 1; display: flex; justify-content: flex-end; align-items: center; margin: 0 24px; }

        .nb__right { display: flex; align-items: center; gap: 24px; }

        .nb__steps { display: flex; gap: 10px; align-items: center; }
        .nb__step {
          width: 32px; height: 32px;
          border-radius: 50%;
          border: 2px solid #e2e8f0;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700; color: #94a3b8;
          transition: all 0.2s;
        }
        .nb__step--active {
          background: #102a43;
          border-color: #102a43;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(16, 42, 67, 0.2);
        }

        .nb__logout {
          display: flex; align-items: center; gap: 8px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 8px 18px;
          color: #1e293b;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
          transition: all 0.2s;
          font-family: inherit;
        }
        .nb__logout:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
          color: #0f172a;
        }
      `}</style>
    </div>
  );
};

export default Navbar;