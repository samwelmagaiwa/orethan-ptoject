import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import type { FC } from "react";
import logo from "../assets/logo.png";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

const Sidebar: FC<SidebarProps> = ({ isCollapsed, setIsCollapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  const [user, setUser] = useState<User | null>(null);
  const [showLoans, setShowLoans] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [userCount, setUserCount] = useState<number | null>(null);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
      const res = await axios.get(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(res.data);
    } catch (err) {
      localStorage.removeItem("token");
      navigate("/login");
    }
  };

  const handleUsersClick = async () => {
    setShowUsers(!showUsers);
    const token = localStorage.getItem("token");
    try {
      const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
      const res = await axios.get(`${API_BASE}/users/count`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setUserCount(res.data.count);
    } catch (err) {
      console.log(err);
    }
  };

  const handleLogout = async () => {
    const token = localStorage.getItem("token");
    if (token) {
      const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
      await axios.post(`${API_BASE}/logout`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    }
    localStorage.removeItem("token");
    navigate("/login");
  };

  const userRole = user?.role;
  const canAccessLoansForm = userRole === "admin" || userRole === "loan_officer";
  const canAccessUsers = userRole === "admin";
  const canAccessRepayment = userRole === "admin" || userRole === "loan_manager" || userRole === "general_manager" || userRole === "loan_officer" || userRole === "managing_director" || userRole === "finance_officer";
  const canAccessApprovals = userRole === "admin" || userRole === "loan_manager" || userRole === "general_manager" || userRole === "managing_director";
  const canAccessManagement = canAccessApprovals;
  const canAccessFinance = userRole === "admin" || userRole === "finance_officer";

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : "A";
  const userDisplayRole = user?.role?.replace(/_/g, " ")?.replace(/\b\w/g, c => c.toUpperCase()) || "Administrator";

  return (
    <div className={`sd ${isCollapsed ? "sd--c" : ""}`}>

      {/* ── Logo + Hamburger ── */}
      <div className="sd-logo">
        <div className="sd-logo__brand">
          <div className="sd-logo__icon">
            <img src={logo} alt="Orethan" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        </div>
        <button className="sd-logo__menu" onClick={() => setIsCollapsed(!isCollapsed)} title={isCollapsed ? "Expand" : "Collapse"}>
          {isCollapsed ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          )}
        </button>
      </div>

      <div className="sd-scroll">
        {/* ── User Profile ── */}
        <div className="sd-user">
          <div className="sd-user__avatar">{userInitial}</div>
          {!isCollapsed && user && (
            <div className="sd-user__info">
              <span className="sd-user__name">{user.name}</span>
              <span className="sd-user__role">{userDisplayRole}</span>
            </div>
          )}
          {!isCollapsed && <span className="sd-user__chevron">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </span>}
        </div>

        {/* ── Navigation ── */}
        <nav className="sd-nav">
          {/* Internal */}
          {(canAccessUsers || canAccessRepayment) && (
            <>
              <div className="sd-sec">{!isCollapsed ? "INTERNAL" : "─"}</div>
              {canAccessRepayment && (
                <div className={`sd-item ${isActive("/repayment-tracker") ? "sd-item--active" : ""}`} onClick={() => navigate("/repayment-tracker")} title="Dashboard">
                  <span className="sd-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg></span>
                  {!isCollapsed && <span className="sd-item__text">Dashboard</span>}
                </div>
              )}
              {canAccessUsers && (
                <>
                  <div className="sd-item" onClick={handleUsersClick} title="Users">
                    <span className="sd-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg></span>
                    {!isCollapsed && <span className="sd-item__text">Users</span>}
                    {!isCollapsed && userCount !== null && <span className="sd-badge">{userCount}</span>}
                    {!isCollapsed && <span className={`sd-item__arrow ${showUsers ? "sd-item__arrow--open" : ""}`}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg></span>}
                  </div>
                  {showUsers && !isCollapsed && (
                    <div className="sd-sub"><div className="sd-sub__link" onClick={() => navigate("/users")}>View Users</div></div>
                  )}
                </>
              )}
            </>
          )}

          {/* Loan Operations */}
          {canAccessLoansForm && (
            <>
              <div className="sd-sec">{!isCollapsed ? "LOAN OPERATIONS" : "─"}</div>
              <div className="sd-item" onClick={() => setShowLoans(!showLoans)} title="Loans Form">
                <span className="sd-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg></span>
                {!isCollapsed && <span className="sd-item__text">Loans Form</span>}
                {!isCollapsed && <span className={`sd-item__arrow ${showLoans ? "sd-item__arrow--open" : ""}`}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg></span>}
              </div>
              {showLoans && !isCollapsed && (
                <div className="sd-sub">
                  <div className="sd-sub__link" onClick={() => navigate("/personal-loan")}>Personal Loan</div>
                  <div className="sd-sub__link" onClick={() => navigate("/group-loan")}>Group Loan</div>
                  <div className="sd-sub__link" style={{ color: '#60a5fa', fontWeight: '500' }} onClick={() => navigate("/my-applications")}>My Applications</div>
                </div>
              )}
            </>
          )}

          {/* Finance (Disbursement & Cashiering) */}
          {canAccessFinance && (
            <>
              <div className="sd-sec">{!isCollapsed ? "FINANCE" : "─"}</div>
              {userRole === "finance_officer" || userRole === "admin" ? (
                <div className={`sd-item ${isActive("/finance/customers") ? "sd-item--active" : ""}`} onClick={() => navigate(userRole === "finance_officer" ? "/finance/customers" : "/customers")} title="Disburse & Record Payments">
                  <span className="sd-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg></span>
                  {!isCollapsed && <span className="sd-item__text">Disburse & Payments</span>}
                </div>
              ) : null}
            </>
          )}

          {/* Management & Approvals */}
          {canAccessApprovals && (
            <>
              <div className="sd-sec">{!isCollapsed ? "APPROVALS" : "─"}</div>
              {userRole === "loan_manager" || userRole === "admin" ? (
                <div className={`sd-item ${isActive("/loan-manager") ? "sd-item--active" : ""}`} onClick={() => navigate("/loan-manager")} title="Loan Manager">
                  <span className="sd-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="16 11 18 13 22 9" /></svg></span>
                  {!isCollapsed && <span className="sd-item__text">Manager Review</span>}
                </div>
              ) : null}
              {userRole === "general_manager" || userRole === "admin" ? (
                <div className={`sd-item ${isActive("/general-manager") ? "sd-item--active" : ""}`} onClick={() => navigate("/general-manager")} title="General Manager">
                  <span className="sd-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg></span>
                  {!isCollapsed && <span className="sd-item__text">GM Review</span>}
                </div>
              ) : null}
              {userRole === "managing_director" || userRole === "admin" ? (
                <div className={`sd-item ${isActive("/managing-director") ? "sd-item--active" : ""}`} onClick={() => navigate("/managing-director")} title="Managing Director">
                  <span className="sd-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /><path d="M12 11h.01" /><path d="M10 13l2 2 4-4" /></svg></span>
                  {!isCollapsed && <span className="sd-item__text">MD Auth</span>}
                </div>
              ) : null}
            </>
          )}

          {/* Management */}
          {canAccessManagement && (
            <>
              <div className="sd-sec">{!isCollapsed ? "MANAGEMENT" : "─"}</div>
              <div className={`sd-item ${isActive("/customers") || location.pathname.includes("/customers") ? "sd-item--active" : ""}`} onClick={() => {
                const prefix = userRole === 'loan_manager' ? 'lm' :
                  userRole === 'general_manager' ? 'gm' :
                    userRole === 'managing_director' ? 'md' :
                      userRole === 'loan_officer' ? 'officer' :
                        userRole === 'finance_officer' ? 'finance' : '';
                navigate(prefix ? `/${prefix}/customers` : "/customers");
              }} title="Wateja">
                <span className="sd-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg></span>
                {!isCollapsed && <span className="sd-item__text">Wateja (Customers)</span>}
              </div>
            </>
          )}
        </nav>

        {/* ── Footer ── */}
        <div className="sd-footer">
          <div className="sd-sec">{!isCollapsed ? "PREFERENCES" : "─"}</div>
          <div className="sd-item" onClick={handleLogout} title="Log Out">
            <span className="sd-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg></span>
            {!isCollapsed && <span className="sd-item__text">Log Out</span>}
          </div>
        </div>
      </div>

      <style>{`
        .sd {
          width: 260px;
          height: 100vh;
          background: linear-gradient(180deg, #0f2540 0%, #102a43 45%, #0c2138 100%);
          color: #cbd5e1;
          position: fixed;
          top: 0; left: 0;
          display: flex;
          flex-direction: column;
          z-index: 100;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 6px 0 30px rgba(0,0,0, 0.25);
        }
        .sd--c { width: 80px; }

        /* ─── LOGO AREA ─── */
        .sd-logo {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          height: 80px;
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          border-right: 1px solid #e2e8f0;
          flex-shrink: 0;
        }
        .sd-logo__brand { display: flex; align-items: center; gap: 10px; }
        .sd--c .sd-logo__brand { display: none; }
        .sd-logo__icon {
          width: 220px; height: 100px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          overflow: hidden;
        }
        .sd-logo__text { display: flex; flex-direction: column; }
        .sd-logo__title { font-size: 15px; font-weight: 800; color: #1e293b; line-height: 1.1; }
        .sd-logo__sub { font-size: 11px; color: #64748b; font-weight: 500; }
        
        .sd-logo__menu {
          background: linear-gradient(135deg, #1e3a5f 0%, #102a43 100%);
          border: 1px solid #102a43;
          cursor: pointer; padding: 8px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
          color: #ffffff;
          margin-left: auto;
          box-shadow: 0 4px 12px rgba(16, 42, 67, 0.15);
        }
        .sd-logo__menu:hover { background: linear-gradient(135deg, #2563eb 0%, #1e4e8c 100%); color: #ffffff; transform: scale(1.06); box-shadow: 0 6px 16px rgba(37, 99, 235, 0.35); }
        .sd--c .sd-logo { justify-content: center; padding: 0; }
        .sd--c .sd-logo__menu { margin: 0 auto; }

        .sd-scroll { flex: 1; overflow-y: auto; overflow-x: hidden; }

        /* ─── USER PROFILE ─── */
        .sd-user {
          display: flex; align-items: center; gap: 10px;
          padding: 14px 16px;
          margin: 20px 14px 10px 14px;
          background: linear-gradient(135deg, rgba(255,255,255, 0.1) 0%, rgba(255,255,255, 0.04) 100%);
          border: 1px solid rgba(255,255,255, 0.1);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 14px -4px rgba(0,0,0,0.2);
        }
        .sd-user:hover { transform: translateY(-1px); background: rgba(255,255,255, 0.13); border-color: rgba(255,255,255,0.28); }
        .sd--c .sd-user { justify-content: center; padding: 12px; margin: 20px 8px 10px 8px; }
        .sd-user__avatar {
          width: 38px; height: 38px;
          border-radius: 50%;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 15px; color: white;
          flex-shrink: 0;
          box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35), 0 0 0 3px rgba(16, 185, 129, 0.12);
        }
        .sd-user__info { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
        .sd-user__name { font-size: 13px; font-weight: 600; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sd-user__role { font-size: 11px; color: #94a3b8; margin-top: 1px; }
        .sd-user__chevron { color: #64748b; display: flex; flex-shrink: 0; }

        /* ─── NAVIGATION ─── */
        .sd-sec {
          font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.3);
          letter-spacing: 1.4px; padding: 18px 20px 6px 20px;
          text-transform: uppercase;
        }
        .sd--c .sd-sec { text-align: center; padding: 14px 0 4px 0; font-size: 9px; color: rgba(255,255,255,0.1); }

        .sd-item {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 20px;
          margin: 1px 10px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.18s;
          white-space: nowrap;
          position: relative;
        }
        .sd--c .sd-item { justify-content: center; padding: 12px 0; margin: 1px 8px; }
        .sd-item:hover { background: rgba(255,255,255, 0.07); }

        .sd-item--active {
          background: linear-gradient(135deg, rgba(56, 189, 248, 0.16) 0%, rgba(37, 99, 235, 0.1) 100%);
          box-shadow: inset 3px 0 0 #38bdf8;
        }
        .sd--c .sd-item--active { box-shadow: inset 0 -3px 0 #38bdf8; }

        .sd-item__icon {
          width: 20px; height: 20px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; color: #94a3b8;
          transition: color 0.15s;
        }
        .sd-item:hover .sd-item__icon { color: #38bdf8; }
        .sd-item--active .sd-item__icon { color: #38bdf8; }
        .sd-item__text { flex: 1; font-size: 13.5px; font-weight: 500; color: #e2e8f0; }
        .sd-item--active .sd-item__text { color: #ffffff; font-weight: 600; }
        .sd-item__arrow {
          color: #64748b; display: flex; align-items: center;
          transition: transform 0.2s ease;
        }
        .sd-item__arrow--open { transform: rotate(180deg); color: #38bdf8; }

        .sd-badge {
          background: #2563eb; color: white;
          font-size: 10px; font-weight: 700;
          padding: 1px 6px; border-radius: 8px;
        }

        .sd-sub { padding: 4px 10px 6px 44px; background: rgba(0,0,0,0.12); margin: 0 10px 4px 10px; border-radius: 8px; }
        .sd-sub__link {
          padding: 7px 12px; font-size: 13px; color: #94a3b8;
          cursor: pointer; border-radius: 6px; transition: all 0.15s;
        }
        .sd-sub__link:hover { color: #ffffff; background: rgba(56, 189, 248, 0.12); }

        .sd-footer { margin-top: 20px; border-top: 1px solid rgba(255,255,255, 0.08); padding-bottom: 20px; padding-top: 4px; }
        .sd-footer .sd-item:hover { background: rgba(239, 68, 68, 0.12); }
        .sd-footer .sd-item:hover .sd-item__icon { color: #f87171; }
        .sd-footer .sd-item:hover .sd-item__text { color: #fca5a5; }

        .sd-scroll::-webkit-scrollbar { width: 3px; }
        .sd-scroll::-webkit-scrollbar-track { background: transparent; }
        .sd-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255, 0.1); border-radius: 3px; }
      `}</style>
    </div>
  );
};

export default Sidebar;