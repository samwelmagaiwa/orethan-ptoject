import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { FC } from "react";
import staticLogo from "../assets/logo.png";
import { useOrgSettings } from "../utils/orgSettings";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  sidebar_permissions?: Record<string, boolean> | null;
  full_sidebar_access?: boolean;
}

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

const Sidebar: FC<SidebarProps> = ({ isCollapsed, setIsCollapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const org = useOrgSettings();
  const logoSrc = org.company_logo_url || staticLogo;
  const orgName = org.company_name || "Orethan Microfinance";
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  const [user, setUser] = useState<User | null>(null);
  const [showLoans, setShowLoans] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showFinance, setShowFinance] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [showAccounting, setShowAccounting] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showConfigs, setShowConfigs] = useState(false);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [complianceRoles, setComplianceRoles] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("compliance_roles") || "null") || ["admin", "general_manager", "managing_director"]; } catch { return ["admin", "general_manager", "managing_director"]; }
  });
  const [payrollRoles, setPayrollRoles] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("payroll_access_roles") || "null") || ["admin", "finance_officer", "general_manager", "managing_director"]; } catch { return ["admin", "finance_officer", "general_manager", "managing_director"]; }
  });
  const [branchReportRoles, setBranchReportRoles] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("branch_report_roles") || "null") || ["loan_officer","loan_manager","finance_officer","general_manager","managing_director","admin"]; } catch { return ["loan_officer","loan_manager","finance_officer","general_manager","managing_director","admin"]; }
  });
  const [hasEmployeeRecord, setHasEmployeeRecord] = useState(false);

  useEffect(() => {
    fetchCurrentUser();
    fetchSettings();
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const fetchSettings = async () => {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
      const res = await axios.get(`${API_BASE}/loan-settings`);
      const data = res.data.data || {};
      const compRoles: string[] = data.compliance_roles || ["admin", "general_manager", "managing_director"];
      const payRoles: string[] = data.payroll_access_roles || ["admin", "finance_officer", "general_manager", "managing_director"];
      const brRoles: string[] = data.branch_report_roles || ["loan_officer","loan_manager","finance_officer","general_manager","managing_director","admin"];
      const brPerms = data.branch_report_permissions || {
        submit:   ["loan_officer","loan_manager","finance_officer","general_manager","managing_director","admin"],
        view_all: ["loan_manager","general_manager","managing_director","admin"],
        print:    ["loan_officer","loan_manager","finance_officer","general_manager","managing_director","admin"],
        approve:  ["loan_manager","admin"],
        delete:   ["admin"],
      };
      setComplianceRoles(compRoles);
      setPayrollRoles(payRoles);
      setBranchReportRoles(brRoles);
      localStorage.setItem("compliance_roles", JSON.stringify(compRoles));
      localStorage.setItem("payroll_access_roles", JSON.stringify(payRoles));
      localStorage.setItem("branch_report_roles", JSON.stringify(brRoles));
      localStorage.setItem("branch_report_permissions", JSON.stringify(brPerms));
    } catch { /* keep cached values */ }
  };

  const fetchCurrentUser = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
      const res = await axios.get(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(res.data);
      setHasEmployeeRecord(!!res.data.has_employee_record);
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

  // Per-user sidebar overrides set by an admin (see Users management page) take
  // priority over the role defaults below. Admins always see everything, no
  // matter what overrides exist on their own account.
  const isAllowed = (key: string, roleDefault: boolean) => {
    if (userRole === "admin" || user?.full_sidebar_access) return true;
    const overrides = user?.sidebar_permissions;
    if (overrides && Object.prototype.hasOwnProperty.call(overrides, key)) return !!overrides[key];
    return roleDefault;
  };

  const canAccessDashboard = isAllowed("dashboard", true);
  const canAccessFinanceCollections = isAllowed("finance_collections", true);
  const canAccessRequests = isAllowed("requests", true);
  const canAccessProfile = isAllowed("profile", true);
  const canAccessLogout = isAllowed("logout", true);
  const canAccessLoansForm = isAllowed("loans_form", userRole === "admin" || userRole === "loan_officer");
  const canAccessUsers = isAllowed("users", userRole === "admin");
  const canAccessLoanSettings = isAllowed("loan_settings", userRole === "admin");
  const canAccessManagerReview = isAllowed("manager_review", userRole === "loan_manager" || userRole === "admin");
  const canAccessGmReview = isAllowed("gm_review", userRole === "general_manager" || userRole === "admin");
  const canAccessMdAuth = isAllowed("md_auth", userRole === "managing_director" || userRole === "admin");
  const canAccessApprovals = canAccessManagerReview || canAccessGmReview || canAccessMdAuth;
  const canAccessManagement = isAllowed("wateja", userRole === "admin" || userRole === "loan_manager" || userRole === "general_manager" || userRole === "managing_director");
  const canAccessAccounting = isAllowed("accounting", userRole === "admin" || userRole === "finance_officer" || userRole === "managing_director" || userRole === "general_manager");
  const canAccessDisbursePayments = isAllowed("disburse_payments", userRole === "finance_officer" || userRole === "admin");
  const canAccessCashTill = isAllowed("cash_till", userRole === "finance_officer" || userRole === "admin");
  const canAccessComplianceSection = !!userRole && complianceRoles.includes(userRole);
  const canAccessRegulatorReports = isAllowed("regulator_reports", canAccessComplianceSection);
  const canManageLoanLifecycle = isAllowed("loan_lifecycle", canAccessComplianceSection);
  const canAccessPayrollMgmt = !!userRole && (userRole === "admin" || payrollRoles.includes(userRole));
  const canSeePayroll = canAccessPayrollMgmt || hasEmployeeRecord;
  const canAccessBranchReport = isAllowed("branch_report", !!userRole && branchReportRoles.includes(userRole));
  const canAccessGuarantors = userRole === 'admin' || userRole === 'loan_manager' || userRole === 'loan_officer';
  const canAccessGroupMgmt = userRole === 'admin' || userRole === 'loan_manager' || userRole === 'general_manager' || userRole === 'managing_director';
  const canAccessStaffPerf = userRole === 'admin' || userRole === 'loan_manager' || userRole === 'general_manager' || userRole === 'managing_director';

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : "A";
  const userDisplayRole = (user?.role && i18n.exists(`roles.${user.role}`))
    ? t(`roles.${user.role}`)
    : user?.role?.replace(/_/g, " ")?.replace(/\b\w/g, c => c.toUpperCase()) || t("sidebar.administrator");

  const isMobileViewport = () => window.innerWidth <= 768;

  return (
    <>
      {/* ── Mobile-only hamburger trigger — hidden while the drawer is open
          since the drawer's own logo-area button closes it instead. ── */}
      {!mobileOpen && (
        <button className="sd-mobile-toggle" onClick={() => setMobileOpen(true)} title={t("sidebar.openMenu")} aria-label={t("sidebar.openMenu")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
        </button>
      )}

      {mobileOpen && <div className="sd-mobile-backdrop" onClick={() => setMobileOpen(false)} />}

      <div className={`sd ${isCollapsed ? "sd--c" : ""} ${mobileOpen ? "sd--mobile-open" : ""}`}>

      {/* ── Logo + Hamburger ── */}
      <div className="sd-logo">
        <div className="sd-logo__brand">
          <div className="sd-logo__icon">
            <img src={logoSrc} alt={orgName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        </div>
        <button className="sd-logo__menu" onClick={() => (isMobileViewport() ? setMobileOpen(false) : setIsCollapsed(!isCollapsed))} title={isCollapsed ? t("sidebar.expand") : t("sidebar.collapse")}>
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
          {/* Internal — visibility now follows per-user sidebar overrides too */}
          <>
              {(canAccessDashboard || canAccessFinanceCollections || canAccessRequests || canAccessUsers || canAccessLoanSettings) && (
                <div className="sd-sec">{!isCollapsed ? t("sidebar.sections.internal") : "─"}</div>
              )}
              {canAccessDashboard && (
                <div className={`sd-item ${isActive("/repayment-tracker") ? "sd-item--active" : ""}`} onClick={() => navigate("/repayment-tracker")} title={t("sidebar.dashboard")}>
                  <span className="sd-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg></span>
                  {!isCollapsed && <span className="sd-item__text">{t("sidebar.dashboard")}</span>}
                </div>
              )}
              {canAccessFinanceCollections && (
                <>
                  {/* Finance & Collections dropdown */}
                  <div className={`sd-item ${(isActive("/overdue-management") || isActive("/finance/customers") || isActive("/customers")) ? "sd-item--active" : ""}`} onClick={() => setShowFinance(!showFinance)} title={t("sidebar.financeCollections")}>
                    <span className="sd-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg></span>
                    {!isCollapsed && <span className="sd-item__text">{t("sidebar.financeCollections")}</span>}
                    {!isCollapsed && <span className={`sd-item__arrow ${showFinance ? "sd-item__arrow--open" : ""}`}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg></span>}
                  </div>
                  {(showFinance || isActive("/overdue-management") || isActive("/finance/customers") || isActive("/customers")) && !isCollapsed && (
                    <div className="sd-sub">
                      <div className={`sd-sub__link ${isActive("/overdue-management") ? "sd-sub__link--active" : ""}`} onClick={() => navigate("/overdue-management")}>{t("sidebar.overdueManagement")}</div>
                      {canAccessDisbursePayments && (
                        <div className={`sd-sub__link ${(isActive("/finance/customers") || isActive("/customers")) ? "sd-sub__link--active" : ""}`} onClick={() => navigate(userRole === "finance_officer" ? "/finance/customers" : "/customers")}>{t("sidebar.disbursePayments")}</div>
                      )}
                      {canAccessCashTill && (
                        <div className={`sd-sub__link ${isActive("/cash-till") ? "sd-sub__link--active" : ""}`} onClick={() => navigate("/cash-till")}>{t("sidebar.cashTill")}</div>
                      )}
                    </div>
                  )}
                </>
              )}

              {canAccessRequests && (
                <>
                  {/* Requests dropdown */}
                  <div className={`sd-item ${(isActive("/payment-requests") || isActive("/leave-requests")) ? "sd-item--active" : ""}`} onClick={() => setShowRequests(!showRequests)} title={t("sidebar.requests")}>
                    <span className="sd-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg></span>
                    {!isCollapsed && <span className="sd-item__text">{t("sidebar.requests")}</span>}
                    {!isCollapsed && <span className={`sd-item__arrow ${showRequests ? "sd-item__arrow--open" : ""}`}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg></span>}
                  </div>
                  {(showRequests || isActive("/payment-requests") || isActive("/leave-requests")) && !isCollapsed && (
                    <div className="sd-sub">
                      <div className={`sd-sub__link ${isActive("/payment-requests") ? "sd-sub__link--active" : ""}`} onClick={() => navigate("/payment-requests")}>{t("sidebar.paymentRequests")}</div>
                      <div className={`sd-sub__link ${isActive("/leave-requests") ? "sd-sub__link--active" : ""}`} onClick={() => navigate("/leave-requests")}>{t("sidebar.leaveRequests")}</div>
                      <div className={`sd-sub__link ${isActive("/delegations") ? "sd-sub__link--active" : ""}`} onClick={() => navigate("/delegations")}>{t("sidebar.officeDelegation")}</div>
                    </div>
                  )}
                </>
              )}
              {canAccessUsers && (
                <>
                  <div className="sd-item" onClick={handleUsersClick} title={t("sidebar.users")}>
                    <span className="sd-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg></span>
                    {!isCollapsed && <span className="sd-item__text">{t("sidebar.users")}</span>}
                    {!isCollapsed && userCount !== null && <span className="sd-badge">{userCount}</span>}
                    {!isCollapsed && <span className={`sd-item__arrow ${showUsers ? "sd-item__arrow--open" : ""}`}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg></span>}
                  </div>
                  {showUsers && !isCollapsed && (
                    <div className="sd-sub"><div className="sd-sub__link" onClick={() => navigate("/users")}>{t("sidebar.viewUsers")}</div></div>
                  )}
                </>
              )}
            </>

          {/* Loan Operations */}
          {canAccessLoansForm && (
            <>
              <div className="sd-sec">{!isCollapsed ? t("sidebar.sections.loanOperations") : "─"}</div>
              <div className="sd-item" onClick={() => setShowLoans(!showLoans)} title={t("sidebar.loansForm")}>
                <span className="sd-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg></span>
                {!isCollapsed && <span className="sd-item__text">{t("sidebar.loansForm")}</span>}
                {!isCollapsed && <span className={`sd-item__arrow ${showLoans ? "sd-item__arrow--open" : ""}`}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg></span>}
              </div>
              {showLoans && !isCollapsed && (
                <div className="sd-sub">
                  <div className="sd-sub__link" onClick={() => navigate("/personal-loan")}>{t("sidebar.personalLoan")}</div>
                  <div className="sd-sub__link" onClick={() => navigate("/group-loan")}>{t("sidebar.groupLoan")}</div>
                  <div className="sd-sub__link" style={{ color: '#60a5fa', fontWeight: '500' }} onClick={() => navigate("/my-applications")}>{t("sidebar.myApplications")}</div>
                </div>
              )}
            </>
          )}

          {/* Management & Approvals */}
          {canAccessApprovals && (
            <>
              <div className="sd-sec">{!isCollapsed ? t("sidebar.sections.approvals") : "─"}</div>
              {canAccessManagerReview ? (
                <div className={`sd-item ${(isActive("/lm/customers") || isActive("/customers") || location.pathname.includes("/customers")) ? "sd-item--active" : ""}`} onClick={() => navigate(userRole === "loan_manager" ? "/lm/customers" : "/customers")} title={t("sidebar.managerReview")}>
                  <span className="sd-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg></span>
                  {!isCollapsed && <span className="sd-item__text">{t("sidebar.managerReview")}</span>}
                </div>
              ) : null}
              {canAccessGmReview ? (
                <div className={`sd-item ${isActive("/general-manager") ? "sd-item--active" : ""}`} onClick={() => navigate("/general-manager")} title={t("sidebar.gmReview")}>
                  <span className="sd-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg></span>
                  {!isCollapsed && <span className="sd-item__text">{t("sidebar.gmReview")}</span>}
                </div>
              ) : null}
              {canAccessMdAuth ? (
                <div className={`sd-item ${isActive("/managing-director") ? "sd-item--active" : ""}`} onClick={() => navigate("/managing-director")} title={t("sidebar.mdAuth")}>
                  <span className="sd-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /><path d="M12 11h.01" /><path d="M10 13l2 2 4-4" /></svg></span>
                  {!isCollapsed && <span className="sd-item__text">{t("sidebar.mdAuth")}</span>}
                </div>
              ) : null}
            </>
          )}

          {/* Management — skip for any role that already has a dedicated approval page (LM/GM/MD/admin) */}
          {canAccessManagement && !canAccessApprovals && (
            <>
              <div className="sd-sec">{!isCollapsed ? t("sidebar.sections.management") : "─"}</div>
              <div className={`sd-item ${isActive("/customers") || location.pathname.includes("/customers") ? "sd-item--active" : ""}`} onClick={() => {
                const prefix = userRole === 'loan_manager' ? 'lm' :
                  userRole === 'general_manager' ? 'gm' :
                    userRole === 'managing_director' ? 'md' :
                      userRole === 'loan_officer' ? 'officer' :
                        userRole === 'finance_officer' ? 'finance' : '';
                navigate(prefix ? `/${prefix}/customers` : "/customers");
              }} title={t("sidebar.customers")}>
                <span className="sd-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg></span>
                {!isCollapsed && <span className="sd-item__text">{t("sidebar.customers")}</span>}
              </div>
            </>
          )}

          {/* Compliance — Regulator reporting & loan restructuring (LM / GM / MD / Admin) */}
          {(canAccessRegulatorReports || canManageLoanLifecycle) && (
            <>
              <div className="sd-sec">{!isCollapsed ? t("sidebar.sections.compliance") : "─"}</div>
              {canAccessRegulatorReports && (
                <div className={`sd-item ${isActive("/reports/regulator") ? "sd-item--active" : ""}`} onClick={() => navigate("/reports/regulator")} title={t("sidebar.regulatorReports")}>
                  <span className="sd-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><rect x="7" y="11" width="3" height="6" /><rect x="12" y="7" width="3" height="10" /><rect x="17" y="13" width="3" height="4" /></svg></span>
                  {!isCollapsed && <span className="sd-item__text">{t("sidebar.regulatorReports")}</span>}
                </div>
              )}
              {canManageLoanLifecycle && (
                <div className={`sd-item ${isActive("/loan-lifecycle") ? "sd-item--active" : ""}`} onClick={() => navigate("/loan-lifecycle")} title={t("sidebar.loanLifecycle")}>
                  <span className="sd-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /></svg></span>
                  {!isCollapsed && <span className="sd-item__text">{t("sidebar.loanLifecycle")}</span>}
                </div>
              )}
            </>
          )}

          {/* Payroll / HR — dynamic via admin-configured payroll_access_roles, plus any user with an employee record */}
          {canSeePayroll && (
            <>
              <div className="sd-sec">{!isCollapsed ? t("sidebar.payrollMgmt") : "─"}</div>
              <div className={`sd-item ${isActive("/payroll") ? "sd-item--active" : ""}`} onClick={() => navigate("/payroll")} title={canAccessPayrollMgmt ? t("sidebar.payrollMgmt") : t("sidebar.mySalarySlip")}>
                <span className="sd-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg></span>
                {!isCollapsed && <span className="sd-item__text">{canAccessPayrollMgmt ? t("sidebar.payrollMgmt") : t("sidebar.mySalarySlip")}</span>}
              </div>
            </>
          )}

          {/* ── Configurations dropdown — Settings + Biometric ────────── */}
          {(canAccessLoanSettings || userRole === "admin" || userRole === "finance_officer") && (
            <>
              <div className="sd-sec">{!isCollapsed ? t("sidebar.configurations") : "─"}</div>
              <div
                className={`sd-item ${(isActive("/configurations") || isActive("/biometric")) ? "sd-item--active" : ""}`}
                onClick={() => { if (isCollapsed) navigate("/configurations"); else setShowConfigs(s => !s); }}
                title={t("sidebar.configurations")}
              >
                <span className="sd-item__icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                </span>
                {!isCollapsed && <span className="sd-item__text">{t("sidebar.configurations")}</span>}
                {!isCollapsed && (
                  <span className={`sd-item__arrow ${showConfigs || isActive("/configurations") || isActive("/biometric") ? "sd-item__arrow--open" : ""}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </span>
                )}
              </div>
              {(showConfigs || isActive("/configurations") || isActive("/biometric")) && !isCollapsed && (
                <div className="sd-sub">
                  {canAccessLoanSettings && (
                    <div className={`sd-sub__link ${isActive("/configurations") ? "sd-sub__link--active" : ""}`} onClick={() => navigate("/configurations")}>
                      ⚙️ {t("sidebar.globalSettings")}
                    </div>
                  )}
                  {(userRole === "admin" || userRole === "finance_officer") && (
                    <div className={`sd-sub__link ${isActive("/biometric") ? "sd-sub__link--active" : ""}`} onClick={() => navigate("/biometric")}>
                      🔏 {t("sidebar.biometric")}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Accounting Module — Admin / Finance Officer / Managing Director */}
          {canAccessAccounting && (
            <>
              <div className="sd-sec">{!isCollapsed ? t("sidebar.sections.accounting") : "─"}</div>
              <div className={`sd-item ${isActive("/accounting") ? "sd-item--active" : ""}`} onClick={() => setShowAccounting(!showAccounting)} title={t("sidebar.accounting")}>
                <span className="sd-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg></span>
                {!isCollapsed && <span className="sd-item__text">{t("sidebar.accounting")}</span>}
                {!isCollapsed && <span className={`sd-item__arrow ${showAccounting ? "sd-item__arrow--open" : ""}`}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg></span>}
              </div>
              {(showAccounting || isActive("/accounting")) && !isCollapsed && (
                <div className="sd-sub">
                  <div className={`sd-sub__link ${isActive("/accounting/chart-of-accounts") ? "sd-sub__link--active" : ""}`} onClick={() => navigate("/accounting/chart-of-accounts")}>{t("sidebar.chartOfAccounts")}</div>
                  <div className={`sd-sub__link ${isActive("/accounting/journal-entries") ? "sd-sub__link--active" : ""}`} onClick={() => navigate("/accounting/journal-entries")}>{t("sidebar.journalEntries")}</div>
                  <div className={`sd-sub__link ${isActive("/accounting/general-ledger") ? "sd-sub__link--active" : ""}`} onClick={() => navigate("/accounting/general-ledger")}>{t("sidebar.generalLedger")}</div>
                  <div className={`sd-sub__link ${isActive("/accounting/trial-balance") ? "sd-sub__link--active" : ""}`} onClick={() => navigate("/accounting/trial-balance")}>{t("sidebar.trialBalance")}</div>
                  <div className={`sd-sub__link ${isActive("/accounting/income-statement") ? "sd-sub__link--active" : ""}`} onClick={() => navigate("/accounting/income-statement")}>{t("sidebar.incomeStatement")}</div>
                  <div className={`sd-sub__link ${isActive("/accounting/balance-sheet") ? "sd-sub__link--active" : ""}`} onClick={() => navigate("/accounting/balance-sheet")}>{t("sidebar.balanceSheet")}</div>
                  <div className={`sd-sub__link ${isActive("/accounting/cash-book") ? "sd-sub__link--active" : ""}`} onClick={() => navigate("/accounting/cash-book")}>{t("sidebar.cashBook")}</div>
                  <div className={`sd-sub__link ${isActive("/accounting/bank-reconciliation") ? "sd-sub__link--active" : ""}`} onClick={() => navigate("/accounting/bank-reconciliation")}>{t("sidebar.bankReconciliation")}</div>
                </div>
              )}
            </>
          )}

          {/* Reports — visible to accounting users AND anyone with branch report access */}
          {(canAccessAccounting || canAccessBranchReport) && (
            <>
              <div className="sd-sec">{!isCollapsed ? t("sidebar.sections.reports") : "─"}</div>
              <div className={`sd-item ${isActive("/reports") || isActive("/branch-report") ? "sd-item--active" : ""}`} onClick={() => setShowReports(!showReports)} title={t("sidebar.reports")}>
                <span className="sd-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M18.7 8l-5.1 5.1-2.8-2.8L7 14" /></svg></span>
                {!isCollapsed && <span className="sd-item__text">{t("sidebar.reports")}</span>}
                {!isCollapsed && <span className={`sd-item__arrow ${showReports || isActive("/branch-report") ? "sd-item__arrow--open" : ""}`}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg></span>}
              </div>
              {(showReports || isActive("/reports") || isActive("/branch-report")) && !isCollapsed && (
                <div className="sd-sub">
                  {canAccessAccounting && (
                    <>
                      <div className={`sd-sub__link ${isActive("/reports/risk") ? "sd-sub__link--active" : ""}`} onClick={() => navigate("/reports/risk")}>{t("sidebar.riskReports")}</div>
                      <div className={`sd-sub__link ${isActive("/reports/financial") ? "sd-sub__link--active" : ""}`} onClick={() => navigate("/reports/financial")}>{t("sidebar.financialReports")}</div>
                    </>
                  )}
                  {canAccessBranchReport && (
                    <div className={`sd-sub__link ${isActive("/branch-report") ? "sd-sub__link--active" : ""}`} onClick={() => navigate("/branch-report")}>
                      📋 {t("sidebar.branchReport")}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {/* ── TOOLS SECTION: Guarantors, Groups, Staff Performance ── */}
          {(canAccessGuarantors || canAccessGroupMgmt || canAccessStaffPerf) && (
            <>
              <div className="sd-sec">{!isCollapsed ? t("sidebar.sections.tools") : "─"}</div>
              {canAccessGuarantors && (
                <div className={`sd-item ${isActive("/guarantors") ? "sd-item--active" : ""}`} onClick={() => navigate("/guarantors")} title={t("sidebar.guarantors")}>
                  <span className="sd-item__icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </span>
                  {!isCollapsed && <span className="sd-item__text">{t("sidebar.guarantors")}</span>}
                </div>
              )}
              {canAccessGroupMgmt && (
                <div className={`sd-item ${isActive("/groups") ? "sd-item--active" : ""}`} onClick={() => navigate("/groups")} title={t("sidebar.groupLoans")}>
                  <span className="sd-item__icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                      <circle cx="19" cy="7" r="2"/><path d="M23 21v-1.5a2 2 0 0 0-2-2h-2"/>
                    </svg>
                  </span>
                  {!isCollapsed && <span className="sd-item__text">{t("sidebar.groupLoans")}</span>}
                </div>
              )}
              {canAccessStaffPerf && (
                <div className={`sd-item ${isActive("/staff-performance") ? "sd-item--active" : ""}`} onClick={() => navigate("/staff-performance")} title={t("sidebar.staffPerformance")}>
                  <span className="sd-item__icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                  </span>
                  {!isCollapsed && <span className="sd-item__text">{t("sidebar.staffPerformance")}</span>}
                </div>
              )}
            </>
          )}
        </nav>

        {/* ── Footer ── */}
        <div className="sd-footer">
          {(canAccessProfile || canAccessLogout) && (
            <div className="sd-sec">{!isCollapsed ? t("sidebar.sections.preferences") : "─"}</div>
          )}
          {canAccessProfile && (
            <div className={`sd-item ${isActive("/profile") ? "sd-item--active" : ""}`} onClick={() => navigate("/profile")} title={t("sidebar.mySignature")}>
              <span className="sd-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" /></svg></span>
              {!isCollapsed && <span className="sd-item__text">{t("sidebar.mySignature")}</span>}
            </div>
          )}
          {canAccessLogout && (
            <div className="sd-item" onClick={handleLogout} title={t("sidebar.logOut")}>
              <span className="sd-item__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg></span>
              {!isCollapsed && <span className="sd-item__text">{t("sidebar.logOut")}</span>}
            </div>
          )}
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
        .sd-sub__link--active { color: #ffffff; background: rgba(56, 189, 248, 0.18); font-weight: 600; }

        .sd-footer { margin-top: 20px; border-top: 1px solid rgba(255,255,255, 0.08); padding-bottom: 20px; padding-top: 4px; }
        .sd-footer .sd-item:hover { background: rgba(239, 68, 68, 0.12); }
        .sd-footer .sd-item:hover .sd-item__icon { color: #f87171; }
        .sd-footer .sd-item:hover .sd-item__text { color: #fca5a5; }

        .sd-scroll::-webkit-scrollbar { width: 3px; }
        .sd-scroll::-webkit-scrollbar-track { background: transparent; }
        .sd-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255, 0.1); border-radius: 3px; }

        /* ─── MOBILE / TABLET DRAWER ─── */
        .sd-mobile-toggle {
          display: none;
          position: fixed;
          top: 14px; left: 14px;
          z-index: 250;
          width: 42px; height: 42px;
          border-radius: 12px;
          background: #102a43;
          color: #fff;
          border: none;
          align-items: center; justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(0,0,0,0.25);
        }
        .sd-mobile-backdrop {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 99;
        }
        @media (max-width: 768px) {
          .sd-mobile-toggle { display: flex; }
          .sd-mobile-backdrop { display: block; }
          .sd, .sd--c {
            width: 260px;
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
            z-index: 200;
          }
          .sd--mobile-open, .sd--c.sd--mobile-open {
            transform: translateX(0);
          }
          .sd--c .sd-logo__brand { display: flex; }
          .sd--c .sd-sec { text-align: left; padding: 18px 20px 6px 20px; font-size: 10px; color: rgba(255,255,255,0.3); }
          .sd--c .sd-item { justify-content: flex-start; padding: 10px 20px; margin: 1px 10px; }
          .sd--c .sd-user { justify-content: flex-start; padding: 14px 16px; margin: 20px 14px 10px 14px; }
        }
      `}</style>
    </div>
    </>
  );
};

export default Sidebar;