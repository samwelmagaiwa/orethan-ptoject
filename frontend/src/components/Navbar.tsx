import type { FC } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/personal-loan": "FOMU YA MAOMBI YA MKOPO BINAFSI",
  "/group-loan": "FOMU YA MAOMBI YA MKOPO WA KIKUNDI",
  "/employee-loan": "FOMU YA MAOMBI YA MKOPO WA MFANYAKAZI",
  "/loan-manager": "Loan Manager",
  "/general-manager": "General Manager",
  "/managing-director": "Managing Director",
  "/repayment-tracker": "Repayment Tracker",
  "/users": "Users",
};

const Navbar: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const subtitle = pageTitles[location.pathname] || "Dashboard";

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="nb">
      <div className="nb__left">
        <div className="nb__title">Microfinance System</div>
        <div className="nb__subtitle">{subtitle}</div>
      </div>

      <div id="navbar-portal" className="nb__portal"></div>

      <div className="nb__right">
        <button className="nb__logout" onClick={handleLogout}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          Logout
        </button>
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