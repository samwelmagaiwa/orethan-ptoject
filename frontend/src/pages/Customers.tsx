import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useTranslation } from "react-i18next";
import AlertModal from "../components/AlertModal";
import ConfirmModal from "../components/ConfirmModal";
import LoanDetailsModal from "../components/LoanDetailsModal";
import ApproveModal from "../components/ApproveModal";
import HistoryModal from "../components/HistoryModal";
import SmsStatusBadge, { smsStatusBadgeStyles } from "../components/SmsStatusBadge";
import { printDocument } from "../utils/printDoc";
import { API_BASE, fmtLoanId } from "../lib/api";

// INLINE SVG ICONS FOR PREMIUM LOOK
const IconSearch = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
const IconCreditCard = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>;
const IconEye = ({ size = 16 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
const IconClock = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
const IconWallet = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>;
const IconUsers = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
const IconAlertTriangle = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;

interface Customer {
    id: number;
    customer_number?: string | null;
    full_name: string;
    phone_number: string;
    email: string;
    nida_number: string;
    active_loans_count: number;
    total_loan_amount: number;
    total_remaining_balance: number;
    total_arrears: number;
}

interface User {
    id: number;
    name: string;
    role: string;
}

interface Loan {
    id: number;
    name: string;
    phone: string;
    amount: number;
    type: string;
    status: string;
    rejection_reason?: string;
    active_loans_count: number;
    total_remaining_balance: number;
    total_arrears: number;
    loan_account_number?: string | null;
    next_payment_date?: string | null;
    remaining_balance?: number | null;
    monthly_payment?: number | null;
    disbursed_at?: string | null;
    customer?: { customer_number?: string | null; nida_number?: string | null; email?: string | null } | null;
    disbursement?: { transaction_reference?: string | null } | null;
    sms_status?: string | null;
    sms_type?: string | null;
}

const Customers: React.FC = () => {
    const { t } = useTranslation("customers");
    const [user, setUser] = useState<User | null>(null);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [stats, setStats] = useState({
        total_loaned: 0,
        total_arrears: 0,
        active_customers: 0,
    });
    const [loanStats, setLoanStats] = useState({
        pending: 0,
        total_value: 0
    });
    const [searchQuery, setSearchQuery] = useState("");
    const [entriesPerPage, setEntriesPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [modalMessage, setModalMessage] = useState("");
    const [modalType, setModalType] = useState<"success" | "error" | "info" | "warning">("info");
    const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", onConfirm: () => { }, type: 'info' as 'danger' | 'warning' | 'info' });

    useEffect(() => {
        fetchUserAndData();
    }, []);

    const fetchUserAndData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            if (!token) return;

            const userRes = await axios.get(`${API_BASE}/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const userData = userRes.data;
            setUser(userData);

            if (userData.role === "admin" || userData.role === "finance_officer") {
                await fetchCustomers();
            } else {
                await fetchManagerLoans(userData.role);
            }
        } catch (err) {
            console.error(err);
            setModalMessage(t("alerts.fetchFailed"));
            setModalType("error");
            setShowModal(true);
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomers = async () => {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API_BASE}/customers`, {
            headers: { Authorization: token ? `Bearer ${token}` : "" }
        });
        setCustomers(res.data.customers);
        setStats(res.data.stats);
    };

    const fetchManagerLoans = async (role: string) => {
        const token = localStorage.getItem("token");
        let endpoint = "loans/manager";
        if (role === "general_manager") endpoint = "loans/gm";
        if (role === "managing_director") endpoint = "loans/md";
        if (role === "finance_officer") endpoint = "loans/finance";

        const res = await axios.get(`${API_BASE}/${endpoint}`, {
            headers: { Authorization: token ? `Bearer ${token}` : "" }
        });
        const pendingLoans = role === "finance_officer"
            ? res.data.filter((l: any) => l.status === 'approved')
            : res.data.filter((l: any) => l.status !== 'approved' && l.status !== 'disbursed' && l.status !== 'completed');
        setLoans(res.data);
        setLoanStats({
            pending: pendingLoans.length,
            total_value: pendingLoans.reduce((acc: number, l: any) => acc + Number(l.amount), 0)
        });
    };

    // Matches the search box against every field the user might reasonably type in:
    // customer number, loan account number, transaction reference, name, phone, email, NIDA.
    const matchesSearch = (...fields: (string | number | null | undefined)[]) => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        return fields.some(f => f !== null && f !== undefined && String(f).toLowerCase().includes(q));
    };

    const filteredCustomers = (customers || []).filter(c =>
        matchesSearch(c.full_name, c.phone_number, c.email, c.nida_number, c.customer_number, c.id)
    );

    const filteredLoans = (loans || []).filter(l =>
        matchesSearch(
            l.name, l.phone, l.loan_account_number, l.id,
            l.customer?.customer_number, l.customer?.email, l.customer?.nida_number,
            l.disbursement?.transaction_reference
        )
    );

    const currentListLength = (user?.role === "admin" || user?.role === "finance_officer") ? filteredCustomers.length : filteredLoans.length;
    const totalPages = Math.max(1, Math.ceil(currentListLength / entriesPerPage));
    const pagedCustomers = filteredCustomers.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);
    const pagedLoans = filteredLoans.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

    useEffect(() => {
        const maxPage = Math.max(1, Math.ceil(currentListLength / entriesPerPage));
        if (currentPage > maxPage) setCurrentPage(maxPage);
    }, [currentListLength, entriesPerPage, currentPage]);

    const renderLoanStatusLabel = (loan: Loan) => {
        if (loan.status === 'manager_review') {
            return (loan as any).rejection_metadata?.rejector_role === 'general_manager'
                ? <span style={{ color: '#ef4444', fontWeight: '800' }}>{t("status.rejected")}</span>
                : <span style={{ color: '#f59e0b', fontWeight: '700' }}>{t("status.pendingLm")}</span>;
        }
        if (loan.status === 'gm_review') {
            return (loan as any).rejection_metadata?.rejector_role === 'managing_director'
                ? <span style={{ color: '#ef4444', fontWeight: '800' }}>{t("status.rejected")}</span>
                : (
                    <span>
                        <span style={{ color: '#16a34a', fontWeight: '700' }}>{t("status.lmApproved")}</span>
                        <span style={{ color: '#94a3b8', margin: '0 4px' }}>|</span>
                        <span style={{ color: '#f59e0b', fontWeight: '700' }}>{t("status.pendingGm")}</span>
                    </span>
                );
        }
        if (loan.status === 'md_review') {
            return (
                <span>
                    <span style={{ color: '#16a34a', fontWeight: '700' }}>{t("status.gmApproved")}</span>
                    <span style={{ color: '#94a3b8', margin: '0 4px' }}>|</span>
                    <span style={{ color: '#f59e0b', fontWeight: '700' }}>{t("status.pendingMd")}</span>
                </span>
            );
        }
        if (loan.status === 'loan_officer' && (loan as any).rejection_metadata?.rejector_role === 'loan_manager') {
            return <span style={{ color: '#ef4444', fontWeight: '800' }}>{t("status.rejected")}</span>;
        }
        if (loan.status === 'approved') return t("status.approved");
        if (loan.status === 'disbursed') return t("status.active");
        return loan.status.replace(/_/g, ' ').toUpperCase();
    };

    const dropdownRef = useRef<HTMLDivElement>(null);
    const [dropdownCoords, setDropdownCoords] = useState({ top: 0, left: 0 });
    const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [showDisburseModal, setShowDisburseModal] = useState(false);
    const [disburseForm, setDisburseForm] = useState({ amount: "", method: "cash", disbursement_date: "", transaction_reference: "" });

    const getActionButtonCount = (loan: Loan) => {
        const isFinance = user?.role === 'finance_officer';
        const canApproveHere = (user?.role === 'admin') ||
            (user?.role === 'loan_manager' && loan.status === 'manager_review') ||
            (user?.role === 'general_manager' && loan.status === 'gm_review') ||
            (user?.role === 'managing_director' && loan.status === 'md_review');

        if (isFinance) return (loan.status === 'approved' || loan.status === 'disbursed') ? 2 : 1;
        if (canApproveHere) return 4;
        return 2;
    };

    const toggleDropdown = (id: number, e: React.MouseEvent, buttonCount: number) => {
        e.stopPropagation();
        if (activeDropdown === id) {
            setActiveDropdown(null);
        } else {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const dropdownHeight = 16 + buttonCount * 42 + 20;
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUpward = spaceBelow < dropdownHeight;
            setDropdownCoords({
                top: Math.max(8, openUpward ? rect.top - dropdownHeight - 8 : rect.bottom + 8),
                left: Math.min(Math.max(8, rect.right - 170), window.innerWidth - 170 - 8),
            });
            setActiveDropdown(id);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const viewDetails = (loan: Loan) => {
        setSelectedLoan(loan);
        setShowDetailsModal(true);
        setActiveDropdown(null);
    };

    const viewHistory = (loan: Loan) => {
        setSelectedLoan(loan);
        setShowHistoryModal(true);
        setActiveDropdown(null);
    };

    const approveLoan = (loan: Loan) => {
        setSelectedLoan(loan);
        setShowApproveModal(true);
        setActiveDropdown(null);
    };

    const submitApproval = async (comments: string) => {
        setSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            await axios.post(`${API_BASE}/loans/${selectedLoan?.id}/approve`, {
                comments: comments
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setModalMessage(t("alerts.approveSuccess"));
            setModalType("success");
            setShowModal(true);
            setShowApproveModal(false);
            fetchManagerLoans(user!.role);
            setActiveDropdown(null);
        } catch (err) {
            console.error(err);
            setModalMessage(t("alerts.approveFailed"));
            setModalType("error");
            setShowModal(true);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteCustomer = (customer: Customer) => {
        setConfirmModal({
            isOpen: true,
            title: "Futa Mteja",
            message: `Una uhakika unataka kufuta ${customer.full_name}? Hatua hii haiwezi kutenduliwa na itafuta mikopo yake yote.`,
            type: 'danger',
            onConfirm: async () => {
                setConfirmModal(m => ({ ...m, isOpen: false }));
                try {
                    const token = localStorage.getItem("token");
                    await axios.delete(`${API_BASE}/customers/${customer.id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setCustomers(prev => prev.filter(c => c.id !== customer.id));
                    setModalMessage("Mteja amefutwa.");
                    setModalType("success");
                    setShowModal(true);
                } catch (err: any) {
                    setModalMessage(err?.response?.data?.message || "Imeshindwa kufuta mteja.");
                    setModalType("error");
                    setShowModal(true);
                }
            },
        });
    };

    const openRejectModal = (loan: Loan) => {
        setSelectedLoan(loan);
        setRejectReason("");
        setShowRejectModal(true);
        setActiveDropdown(null);
    };

    const submitRejection = async () => {
        if (!rejectReason.trim()) {
            setModalMessage(t("alerts.rejectReasonRequired"));
            setModalType("warning");
            setShowModal(true);
            return;
        }
        setSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            await axios.post(`${API_BASE}/loans/${selectedLoan?.id}/reject`, {
                reason: rejectReason
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setModalMessage(t("alerts.rejectSuccess"));
            setModalType("warning");
            setShowModal(true);
            setShowRejectModal(false);
            fetchManagerLoans(user!.role);
        } catch (err) {
            console.error(err);
            setModalMessage(t("alerts.rejectFailed"));
            setModalType("error");
            setShowModal(true);
        } finally {
            setSubmitting(false);
        }
    };

    const openDisburseModal = (loan: Loan) => {
        setSelectedLoan(loan);
        setDisburseForm({
            amount: String(loan.amount),
            method: "cash",
            disbursement_date: new Date().toISOString().slice(0, 10),
            transaction_reference: "",
        });
        setShowDisburseModal(true);
        setActiveDropdown(null);
    };

    const submitDisbursement = async () => {
        if (!disburseForm.amount || !disburseForm.disbursement_date) {
            setModalMessage(t("alerts.disburseFieldsRequired"));
            setModalType("warning");
            setShowModal(true);
            return;
        }
        setSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            const res = await axios.post(`${API_BASE}/loans/${selectedLoan?.id}/disburse`, {
                amount: disburseForm.amount,
                method: disburseForm.method,
                disbursement_date: disburseForm.disbursement_date,
                transaction_reference: disburseForm.transaction_reference || null,
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const activated = res.data?.data || res.data;
            const acct = activated?.loan_account_number;
            const firstDue = activated?.next_payment_date
                ? new Date(activated.next_payment_date).toLocaleDateString()
                : "--";
            setModalMessage(
                t("alerts.disburseSuccess", {
                    account: acct || "--",
                    balance: Number(activated?.remaining_balance ?? selectedLoan?.amount ?? 0).toLocaleString(),
                    firstDue,
                })
            );
            setModalType("success");
            setShowModal(true);
            setShowDisburseModal(false);
            fetchManagerLoans(user!.role);
        } catch (err: any) {
            console.error(err);
            setModalMessage(err?.response?.data?.message || t("alerts.disburseFailed"));
            setModalType("error");
            setShowModal(true);
        } finally {
            setSubmitting(false);
        }
    };

    const printVoucher = (loan: Loan) => {
        setActiveDropdown(null);
        const bodyHtml = `
            <table>
                <tr><td>${t("voucher.accountNumber")}</td><td>${loan.loan_account_number || "--"}</td></tr>
                <tr><td>${t("voucher.loanId")}</td><td>#${fmtLoanId(loan.id)}</td></tr>
                <tr><td>${t("voucher.applicant")}</td><td>${loan.name}</td></tr>
                <tr><td>${t("voucher.phone")}</td><td>${loan.phone || "N/A"}</td></tr>
                <tr><td>${t("voucher.loanType")}</td><td style="text-transform:capitalize">${loan.type}</td></tr>
                <tr><td>${t("voucher.amountDisbursed")}</td><td>TZS ${Number(loan.amount).toLocaleString()}</td></tr>
                <tr><td>${t("voucher.remainingBalance")}</td><td>TZS ${Number(loan.remaining_balance ?? loan.amount).toLocaleString()}</td></tr>
                <tr><td>${t("voucher.firstPaymentDate")}</td><td>${loan.next_payment_date ? new Date(loan.next_payment_date).toLocaleDateString() : "--"}</td></tr>
                <tr><td>${t("voucher.loanStatus")}</td><td style="color:#16a34a;font-weight:700">${t("status.active")}</td></tr>
            </table>
        `;
        printDocument(t("voucher.title"), bodyHtml, `#${fmtLoanId(loan.id)}`);
    };

    const deleteLoan = (id: number) => {
        setConfirmModal({
            isOpen: true,
            title: t("confirm.deleteLoanTitle"),
            message: t("confirm.deleteLoanMessage"),
            type: 'danger',
            onConfirm: () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                setSubmitting(true);
                const token = localStorage.getItem("token");
                axios.delete(`${API_BASE}/loans/${id}`, {
                    headers: { Authorization: token ? `Bearer ${token}` : "" }
                })
                    .then(() => {
                        setModalMessage(t("alerts.deleteSuccess"));
                        setModalType("success");
                        setShowModal(true);
                        fetchManagerLoans(user!.role);
                        setActiveDropdown(null);
                    })
                    .catch((err) => {
                        console.error(err);
                        setModalMessage(t("alerts.deleteFailed"));
                        setModalType("error");
                        setShowModal(true);
                    })
                    .finally(() => setSubmitting(false));
            }
        });
    };

    return (
        <div className="customers-page">
            <style>{`
              .ph-bar{display:flex;align-items:stretch;background:#f1f5f9;position:sticky;top:0;z-index:100;border-bottom:2px solid #e2e8f0;min-height:50px}
              .ph-inner{display:flex;align-items:flex-end;gap:4px;padding:10px 14px 0;flex:1;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none}
              .ph-inner::-webkit-scrollbar{display:none}
              .ph-brand{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;color:#102a43;white-space:nowrap;padding-bottom:10px;flex-shrink:0}
              .ph-actions{display:flex;align-items:center;gap:8px;padding:6px 14px;flex-shrink:0;border-left:1px solid #e2e8f0;background:#f1f5f9}
            `}</style>
            <div className="ph-bar">
              <div className="ph-inner">
                <div className="ph-brand">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <span>Customers</span>
                </div>
              </div>
            </div>
            <AlertModal
                isOpen={showModal}
                message={modalMessage}
                type={modalType}
                onClose={() => setShowModal(false)}
            />

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />

            {/* STICKY STATS ROW */}
            <div className="stats-row">
                {(user?.role === "admin" || user?.role === "finance_officer") ? (
                    <>
                        <div className="stat-box accent-blue">
                            <div className="stat-icon-circle"><IconWallet /></div>
                            <div className="stat-box-text">
                                <div className="stat-label">{t("stats.totalLoaned")}</div>
                                <div className="stat-number">TZS {stats.total_loaned.toLocaleString()}</div>
                            </div>
                        </div>
                        <div className="stat-box accent-red">
                            <div className="stat-icon-circle"><IconAlertTriangle /></div>
                            <div className="stat-box-text">
                                <div className="stat-label">{t("stats.arrears")}</div>
                                <div className="stat-number" style={{ color: '#ef4444' }}>TZS {stats.total_arrears.toLocaleString()}</div>
                            </div>
                        </div>
                        <div className="stat-box accent-green">
                            <div className="stat-icon-circle"><IconUsers /></div>
                            <div className="stat-box-text">
                                <div className="stat-label">{t("stats.activeCustomers")}</div>
                                <div className="stat-number">{stats.active_customers}</div>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="stat-box accent-blue">
                            <div className="stat-icon-circle"><IconClock /></div>
                            <div className="stat-box-text">
                                <div className="stat-label">{t("stats.pendingApplications")}</div>
                                <div className="stat-number">{loanStats.pending}</div>
                            </div>
                        </div>
                        <div className="stat-box accent-green">
                            <div className="stat-icon-circle"><IconWallet /></div>
                            <div className="stat-box-text">
                                <div className="stat-label">{t("stats.applicationsValue")}</div>
                                <div className="stat-number">TZS {loanStats.total_value.toLocaleString()}</div>
                            </div>
                        </div>
                        <div className="stat-box accent-purple">
                            <div className="stat-icon-circle"><IconUsers /></div>
                            <div className="stat-box-text">
                                <div className="stat-label">{t("stats.activeCustomersShort")}</div>
                                <div className="stat-number">{stats.active_customers || 0}</div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* TABLE CONTAINER */}
            <div className="table-container full-width">
                <div className="table-header-premium">
                    <label className="entries-filter">
                        {t("filters.show")}
                        <select value={entriesPerPage} onChange={(e) => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                        {t("filters.entries")}
                    </label>
                    <div className="search-wrapper">
                        <div className="search-icon">
                            <IconSearch />
                        </div>
                        <input
                            type="text"
                            placeholder={(user?.role === "admin" || user?.role === "finance_officer") ? t("filters.searchPlaceholderAdmin") : t("filters.searchPlaceholderManager")}
                            title={t("filters.searchTitle")}
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                </div>

                <div className="table-wrapper">
                    <table>
                        <thead>
                            {(user?.role === "admin" || user?.role === "finance_officer") ? (
                                <tr>
                                    <th>{t("table.customer")}</th>
                                    <th>{t("table.phoneNumber")}</th>
                                    <th style={{ whiteSpace: 'nowrap' }}>{t("table.activeLoans")}</th>
                                    <th>{t("table.remainingBalance")}</th>
                                    <th>{t("table.arrears")}</th>
                                    <th style={{ textAlign: 'right' }}>{t("table.actions")}</th>
                                </tr>
                            ) : (
                                <tr>
                                    <th>#</th>
                                    <th>{t("table.accountNumber")}</th>
                                    <th>{t("table.applicant")}</th>
                                    <th>{t("table.phone")}</th>
                                    <th>{t("table.amount")}</th>
                                    <th>{t("table.type")}</th>
                                    <th>{t("table.status")}</th>
                                    <th>{t("table.smsStatus")}</th>
                                    <th style={{ textAlign: 'right' }}>{t("table.actions")}</th>
                                </tr>
                            )}
                        </thead>
                        <tbody>
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={`skeleton-${i}`} className="skeleton-row">
                                        <td><div className="skeleton-bar" style={{ width: '30px' }}></div></td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div className="skeleton-avatar"></div>
                                                <div className="skeleton-bar" style={{ width: '120px' }}></div>
                                            </div>
                                        </td>
                                        <td><div className="skeleton-bar" style={{ width: '100px' }}></div></td>
                                        <td><div className="skeleton-bar" style={{ width: '80px' }}></div></td>
                                        <td><div className="skeleton-bar" style={{ width: '60px' }}></div></td>
                                        <td><div className="skeleton-bar" style={{ width: '90px' }}></div></td>
                                        <td style={{ textAlign: 'right' }}><div className="skeleton-bar" style={{ width: '40px', marginLeft: 'auto' }}></div></td>
                                    </tr>
                                ))
                            ) : (user?.role === "admin" || user?.role === "finance_officer") ? (
                                filteredCustomers.length === 0 ? (
                                    <tr><td colSpan={6} className="table-empty">{t("empty.noCustomers")}</td></tr>
                                ) : (
                                    pagedCustomers.map((customer) => (
                                        <tr key={customer.id}>
                                            <td>
                                                <div className="client-info">
                                                    <div className="avatar">{customer.full_name.charAt(0)}</div>
                                                    <span className="client-name">{customer.full_name}</span>
                                                </div>
                                            </td>
                                            <td>{customer.phone_number}</td>
                                            <td>
                                                <div className="status-container">
                                                    <span className="active-count">{t("table.activeCount", { count: customer.active_loans_count })}</span>
                                                </div>
                                            </td>
                                            <td className="col-amount">TZS {Number(customer.total_remaining_balance).toLocaleString()}</td>
                                            <td>
                                                <span className={`arrears-badge ${Number(customer.total_arrears) > 0 ? 'has-arrears' : 'no-arrears'}`}>
                                                    {Number(customer.total_arrears) > 0 ? `TZS ${Number(customer.total_arrears).toLocaleString()}` : t("table.none")}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div className="action-buttons-cell">
                                                    <button
                                                        className="btn-profile"
                                                        onClick={() => {
                                                            const prefix = user?.role === 'loan_manager' ? 'lm' :
                                                                user?.role === 'general_manager' ? 'gm' :
                                                                    user?.role === 'managing_director' ? 'md' :
                                                                        user?.role === 'loan_officer' ? 'officer' :
                                                                            user?.role === 'finance_officer' ? 'finance' : '';
                                                            window.location.href = prefix ? `/${prefix}/customers/${customer.id}` : `/customers/${customer.id}`;
                                                        }}
                                                    >
                                                        <IconEye size={16} /> {t("actions.profile")}
                                                    </button>
                                                    <button
                                                        className="btn-repay"
                                                        onClick={() => {
                                                            const prefix = user?.role === 'loan_manager' ? 'lm' :
                                                                user?.role === 'general_manager' ? 'gm' :
                                                                    user?.role === 'managing_director' ? 'md' :
                                                                        user?.role === 'loan_officer' ? 'officer' :
                                                                            user?.role === 'finance_officer' ? 'finance' : '';
                                                            window.location.href = prefix ? `/${prefix}/customers/${customer.id}/repayments` : `/customers/${customer.id}/repayments`;
                                                        }}
                                                    >
                                                        <IconCreditCard /> {t("actions.repay")}
                                                    </button>
                                                    {user?.role === 'admin' && (
                                                        <button
                                                            className="btn-delete"
                                                            onClick={() => handleDeleteCustomer(customer)}
                                                            title="Futa mteja"
                                                        >
                                                            🗑️
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )
                            ) : (
                                filteredLoans.length === 0 ? (
                                    <tr><td colSpan={9} className="table-empty">{t("empty.noApplications")}</td></tr>
                                ) : (
                                    pagedLoans.map((loan, index) => (
                                        <tr
                                            key={loan.id}
                                            onClick={() => setSelectedLoan(loan)}
                                            className={selectedLoan?.id === loan.id ? 'selected-row' : ''}
                                        >
                                            <td>{(currentPage - 1) * entriesPerPage + index + 1}</td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '11px', color: '#4f7c3f', fontWeight: 700, whiteSpace: 'nowrap' }}>{loan.loan_account_number || '—'}</td>
                                            <td>
                                                <div className="client-info">
                                                    <div className="avatar">{loan.name.charAt(0)}</div>
                                                    <span className="client-name">{loan.name}</span>
                                                </div>
                                            </td>
                                            <td>{loan.phone || "N/A"}</td>
                                            <td className="col-amount">TZS {Number(loan.amount).toLocaleString()}</td>
                                            <td style={{ textTransform: 'capitalize' }}>{loan.type}</td>
                                            <td>
                                                <span className={`status-badge status-${loan.status.replace('_', '-')}`} style={{
                                                    color: (loan.status === 'approved' || loan.status === 'disbursed') ? '#16a34a' : 'inherit',
                                                    fontWeight: (loan.status === 'approved' || loan.status === 'disbursed') ? '700' : '500',
                                                    border: (loan.status === 'approved' || loan.status === 'disbursed') ? '1px solid #16a34a' : 'none',
                                                    padding: (loan.status === 'approved' || loan.status === 'disbursed') ? '3px 10px' : '4px 12px'
                                                }}>
                                                    {renderLoanStatusLabel(loan)}
                                                </span>
                                                {loan.rejection_reason && (loan.status === 'loan_officer') && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); viewHistory(loan); }}
                                                        style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 10px', fontSize: '10px', fontWeight: 700, color: '#fff', background: '#ef4444', border: 'none', borderRadius: '20px', cursor: 'pointer', letterSpacing: '0.5px', textTransform: 'uppercase', animation: 'rejectionPulse 1.8s ease-in-out infinite', boxShadow: '0 0 0 0 rgba(239,68,68,0.4)' }}
                                                    >
                                                        ↩ Rejection
                                                    </button>
                                                )}
                                            </td>
                                            <td><SmsStatusBadge status={loan.sms_status} type={loan.sms_type} /></td>
                                            <td style={{ textAlign: 'right', position: 'relative' }}>
                                                <button className="dots-button" onClick={(e) => toggleDropdown(loan.id, e, getActionButtonCount(loan))}>
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg>
                                                </button>

                                                {activeDropdown === loan.id && createPortal(
                                                    <div
                                                        ref={dropdownRef}
                                                        className="action-dropdown action-dropdown--fixed"
                                                        style={{ top: dropdownCoords.top, left: dropdownCoords.left }}
                                                    >
                                                        {(() => {
                                                            const isFinance = user?.role === 'finance_officer';
                                                            const canApproveHere = (user?.role === 'admin') ||
                                                                (user?.role === 'loan_manager' && loan.status === 'manager_review') ||
                                                                (user?.role === 'general_manager' && loan.status === 'gm_review') ||
                                                                (user?.role === 'managing_director' && loan.status === 'md_review');

                                                            if (isFinance) {
                                                                return (
                                                                    <>
                                                                        {loan.status === 'approved' && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    const base = user?.role === 'finance_officer' ? '/finance/disburse/' : '/disburse/';
                                                                                    window.location.href = base + loan.id;
                                                                                }}
                                                                                className={`approve-action ${submitting ? 'muted' : ''}`}
                                                                                disabled={submitting}
                                                                            >
                                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
                                                                                {t("actions.disburse")}
                                                                            </button>
                                                                        )}
                                                                        {loan.status === 'disbursed' && (
                                                                            <button onClick={() => printVoucher(loan)} disabled={submitting}>
                                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                                                                                {t("actions.printVoucher")}
                                                                            </button>
                                                                        )}
                                                                        <button onClick={() => viewDetails(loan)} disabled={submitting}>
                                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                                                            {t("actions.viewDetails")}
                                                                        </button>
                                                                    </>
                                                                );
                                                            }

                                                            if (canApproveHere) {
                                                                return (
                                                                    <>
                                                                        <button
                                                                            onClick={() => approveLoan(loan)}
                                                                            className={`approve-action ${submitting ? 'muted' : ''}`}
                                                                            disabled={submitting}
                                                                        >
                                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                                            {t("actions.approve")}
                                                                        </button>
                                                                        <button onClick={() => viewDetails(loan)} disabled={submitting}>
                                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                                                            {t("actions.viewDetails")}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => openRejectModal(loan)}
                                                                            className={`reject-action ${submitting ? 'muted' : ''}`}
                                                                            disabled={submitting}
                                                                        >
                                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                                            {t("actions.reject")}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => deleteLoan(loan.id)}
                                                                            className={`reject-action ${submitting ? 'muted' : ''}`}
                                                                            disabled={submitting}
                                                                            style={{ color: '#ef4444' }}
                                                                        >
                                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                                                            {t("actions.deleteLoan")}
                                                                        </button>
                                                                    </>
                                                                );
                                                            }

                                                            return (
                                                                <>
                                                                    <button onClick={() => viewDetails(loan)} disabled={submitting}>
                                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                                                        {t("actions.viewDetails")}
                                                                    </button>
                                                                    <button onClick={() => viewHistory(loan)} disabled={submitting}>
                                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                                                                        {t("actions.viewHistory")}
                                                                    </button>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>,
                                                    document.body
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && currentListLength > 0 && (
                    <div className="pagination-row">
                        <span className="pagination-info">
                            {t("pagination.showing", {
                                from: (currentPage - 1) * entriesPerPage + 1,
                                to: Math.min(currentPage * entriesPerPage, currentListLength),
                                total: currentListLength,
                            })}
                        </span>
                        <div className="pagination-buttons">
                            <button disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>{t("pagination.previous")}</button>
                            <span className="pagination-page">{currentPage} / {totalPages}</span>
                            <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>{t("pagination.next")}</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Approve Modal with Comments */}
            <ApproveModal
                isOpen={showApproveModal}
                loan={selectedLoan}
                onConfirm={submitApproval}
                onCancel={() => setShowApproveModal(false)}
                submitting={submitting}
            />

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>{t("rejectModal.title")}</h2>
                        <div className="modal-info">
                            <p><strong>{t("rejectModal.client")}:</strong> {selectedLoan?.name}</p>
                            <p><strong>{t("rejectModal.requested")}:</strong> TZS {Number(selectedLoan?.amount).toLocaleString()}</p>
                        </div>
                        <textarea
                            placeholder={t("rejectModal.reasonPlaceholder")}
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={4}
                        />
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setShowRejectModal(false)} disabled={submitting}>{t("rejectModal.cancel")}</button>
                            <button className="btn-danger" onClick={submitRejection} disabled={submitting}>
                                {submitting ? t("rejectModal.returning") : t("rejectModal.returnForCorrections")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Disburse Modal (Finance Officer / Cashier) */}
            {showDisburseModal && (
                <div className="modal-overlay" onClick={() => setShowDisburseModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>Toa Mkopo (Disburse)</h2>
                        <div className="modal-info">
                            <p><strong>Mwombaji:</strong> {selectedLoan?.name}</p>
                            <p><strong>Kiasi cha Mkopo:</strong> TZS {Number(selectedLoan?.amount).toLocaleString()}</p>
                        </div>
                        <label className="disburse-field-label">Kiasi cha Kutoa (TZS)</label>
                        <input
                            type="number"
                            value={disburseForm.amount}
                            onChange={(e) => setDisburseForm({ ...disburseForm, amount: e.target.value })}
                            className="disburse-input"
                        />
                        <label className="disburse-field-label">Tarehe ya Malipo</label>
                        <input
                            type="date"
                            value={disburseForm.disbursement_date}
                            onChange={(e) => setDisburseForm({ ...disburseForm, disbursement_date: e.target.value })}
                            className="disburse-input"
                        />
                        <label className="disburse-field-label">Njia ya Malipo</label>
                        <select
                            value={disburseForm.method}
                            onChange={(e) => setDisburseForm({ ...disburseForm, method: e.target.value })}
                            className="disburse-input"
                        >
                            <option value="cash">Cash</option>
                            <option value="bank_transfer">Bank Transfer</option>
                            <option value="mobile_money">Mobile Money</option>
                        </select>
                        <label className="disburse-field-label">Namba ya Muamala (si lazima)</label>
                        <input
                            type="text"
                            value={disburseForm.transaction_reference}
                            onChange={(e) => setDisburseForm({ ...disburseForm, transaction_reference: e.target.value })}
                            className="disburse-input"
                            placeholder="Mf. TXN12345"
                        />
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setShowDisburseModal(false)} disabled={submitting}>Ghairi</button>
                            <button className="btn-primary-disburse" onClick={submitDisbursement} disabled={submitting}>
                                {submitting ? 'Inatuma...' : 'Thibitisha Kutoa Mkopo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Details Modal */}
            <LoanDetailsModal
                show={showDetailsModal}
                loan={selectedLoan}
                onClose={() => setShowDetailsModal(false)}
            />

            {/* History Modal */}
            <HistoryModal
                isOpen={showHistoryModal}
                loan={selectedLoan}
                onClose={() => setShowHistoryModal(false)}
            />

            <style>{`
                .customers-page {
                    padding: 0 5px 20px 5px;
                    margin-top: -12px;
                    min-height: 100vh;
                    background: #f5efe0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .stats-row {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 24px;
                    margin-bottom: 12px;
                    width: 100%;
                    position: sticky;
                    top: 0px;
                    z-index: 10;
                    background: #f5efe0;
                    padding: 4px 0 8px 0;
                }

                .stat-box {
                    background: #fdfbf5;
                    border-radius: 18px;
                    padding: 22px 24px;
                    border: 1px solid #e3d7b0;
                    box-shadow: 0 4px 16px -4px rgba(15, 23, 42, 0.06);
                    transition: transform 0.25s ease, box-shadow 0.25s ease;
                    display: flex;
                    align-items: center;
                    gap: 18px;
                    position: relative;
                    overflow: hidden;
                }

                .stat-box::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 5px;
                    height: 100%;
                    background: var(--accent-color, #2563eb);
                }

                .stat-box:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 14px 28px -8px rgba(15, 23, 42, 0.14);
                }

                .stat-box.accent-blue { --accent-color: #2563eb; }
                .stat-box.accent-blue .stat-icon-circle { background: #eff6ff; color: #2563eb; }

                .stat-box.accent-green { --accent-color: #10b981; }
                .stat-box.accent-green .stat-icon-circle { background: #ecfdf5; color: #10b981; }

                .stat-box.accent-purple { --accent-color: #7c3aed; }
                .stat-box.accent-purple .stat-icon-circle { background: #f5f3ff; color: #7c3aed; }

                .stat-box.accent-red { --accent-color: #ef4444; }
                .stat-box.accent-red .stat-icon-circle { background: #fef2f2; color: #ef4444; }

                .stat-icon-circle {
                    width: 52px;
                    height: 52px;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .stat-box-text {
                    flex: 1;
                    min-width: 0;
                }

                .stat-label {
                    font-size: 12.5px;
                    font-weight: 700;
                    color: #8a7a52;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 8px;
                }

                .stat-number {
                    font-size: 26px;
                    font-weight: 800;
                    color: #4a3c1a;
                    letter-spacing: -0.01em;
                }

                .table-container {
                    background: #fdfbf5;
                    border-radius: 20px;
                    padding: 26px;
                    border: 1px solid #e3d7b0;
                    box-shadow: 0 12px 32px -12px rgba(15, 23, 42, 0.1);
                }

                .table-container.full-width {
                    max-width: none;
                    width: 100%;
                }

                .table-header-premium {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                    flex-wrap: wrap;
                    gap: 16px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid #f0e8d4;
                }

                .entries-filter {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 13px;
                    font-weight: 600;
                    color: #5c4a1f;
                }

                .entries-filter select {
                    padding: 5px 10px;
                    border: 1px solid #cbb88a;
                    border-radius: 6px;
                    background: #fdfbf5;
                    color: #5c4a1f;
                    font-size: 13px;
                    font-weight: 600;
                }

                .pagination-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 12px;
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 1px solid #e3d7b0;
                }

                .pagination-info {
                    font-size: 12px;
                    color: #8a7a52;
                }

                .pagination-buttons {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .pagination-buttons button {
                    background: #fdfbf5;
                    color: #5c4a1f;
                    border: 1px solid #cbb88a;
                    padding: 6px 16px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                }

                .pagination-buttons button:hover:not(:disabled) {
                    background: #efe6d0;
                }

                .pagination-buttons button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .pagination-page {
                    font-size: 12px;
                    font-weight: 700;
                    color: #5c4a1f;
                }

                @media (max-width: 900px) {
                    .table-header-premium {
                        align-items: stretch;
                    }
                    .search-wrapper {
                        width: 100% !important;
                        margin-left: 0 !important;
                    }
                    .stats-row { grid-template-columns: repeat(2, 1fr); gap: 14px; }
                }
                @media (max-width: 480px) {
                    .stats-row { grid-template-columns: 1fr; gap: 10px; }
                    .stat-box { padding: 14px 16px; }
                }

                .search-wrapper {
                    position: relative;
                    width: 280px;
                    margin-left: auto;
                    flex-shrink: 0;
                }

                .search-icon {
                    position: absolute;
                    left: 14px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #b3a276;
                    transition: color 0.2s;
                }

                .search-wrapper input {
                    width: 100%;
                    padding: 9px 14px 9px 42px;
                    border-radius: 12px;
                    border: 1.5px solid #e3d7b0;
                    background: #fdfbf5;
                    font-size: 14px;
                    color: #3f3318;
                    outline: none;
                    transition: all 0.2s;
                    box-sizing: border-box;
                }

                .search-wrapper input:focus {
                    border-color: #8a7338;
                    background: white;
                    box-shadow: 0 0 0 4px rgba(138, 115, 56, 0.1);
                }

                .search-wrapper input:focus + .search-icon,
                .search-wrapper:has(input:focus) .search-icon {
                    color: #8a7338;
                }

                .table-wrapper {
                    overflow-x: auto;
                    min-height: 300px;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    border-radius: 14px;
                }

                th {
                    text-align: left;
                    padding: 14px 16px;
                    background: #efe6d0;
                    color: #5c4a1f;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    border-bottom: 1.5px solid #ddd0a0;
                }

                th:first-child {
                    border-top-left-radius: 12px;
                }

                th:last-child {
                    border-top-right-radius: 12px;
                }

                td {
                    padding: 16px;
                    border-bottom: 1px solid #f0e8d4;
                    font-size: 14px;
                    color: #3f3318;
                    transition: background 0.15s;
                }

                tr:nth-child(even) {
                    background: #faf6ea;
                }

                tr:hover td {
                    background: #f3ecd6 !important;
                    cursor: pointer;
                }

                tr.selected-row td {
                    background: #efe6d0 !important;
                    box-shadow: inset 3px 0 0 #8a7338;
                }

                .client-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .avatar {
                    width: 38px;
                    height: 38px;
                    background: #5c4a1f;
                    color: white;
                    border-radius: 11px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 15px;
                    box-shadow: 0 4px 10px -2px rgba(92, 74, 31, 0.4);
                    flex-shrink: 0;
                }

                .client-name {
                    font-weight: 600;
                    color: #4a3c1a;
                }

                .active-count {
                    background: #f0fdf4;
                    color: #16a34a;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 700;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }

                .active-count::before {
                    content: '';
                    width: 6px;
                    height: 6px;
                    background: #16a34a;
                    border-radius: 50%;
                }

                .col-amount {
                    font-weight: 700;
                    color: #4a3c1a;
                }

                .arrears-badge {
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 700;
                }

                .no-arrears {
                    background: #f0fdf4;
                    color: #16a34a;
                }

                .has-arrears {
                    background: #fef2f2;
                    color: #ef4444;
                }

                .action-buttons-cell {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                }

                .btn-profile, .btn-repay {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 1px solid #e3d7b0;
                }

                .btn-profile {
                    background: #fdfbf5;
                    color: #5c4a1f;
                }

                .btn-profile:hover {
                    background: #efe6d0;
                    border-color: #cbb88a;
                }

                .btn-repay {
                    background: #2563eb;
                    color: white;
                    border: none;
                }

                .btn-repay:hover {
                    background: #1d4ed8;
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
                }

                .btn-delete {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 6px 10px;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: #fee2e2;
                    color: #dc2626;
                    border: 1px solid #fca5a5;
                }
                .btn-delete:hover {
                    background: #dc2626;
                    color: white;
                    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25);
                }

                .dots-button {
                    background: none;
                    border: none;
                    color: #8a7a52;
                    cursor: pointer;
                    padding: 6px;
                    border-radius: 8px;
                    transition: all 0.2s;
                }

                .dots-button:hover {
                    background: #efe6d0;
                    color: #4a3c1a;
                }

                .action-dropdown--fixed {
                    position: fixed;
                    background: #fdfbf5;
                    border: 1px solid #e3d7b0;
                    border-radius: 12px;
                    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1);
                    z-index: 10000;
                    width: 170px;
                    padding: 8px;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .action-dropdown button {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    width: 100%;
                    padding: 10px 12px;
                    border: none;
                    background: none;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 600;
                    color: #5c4a1f;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: left;
                }

                .action-dropdown button:hover:not(:disabled) {
                    background: #efe6d0;
                    color: #4a3c1a;
                }

                .action-dropdown button.approve-action {
                    color: #10b981;
                }

                .action-dropdown button.reject-action {
                    color: #ef4444;
                }

                .status-badge {
                    display: inline-block;
                    font-size: 11px;
                    border-radius: 30px;
                    white-space: nowrap;
                    letter-spacing: 0.03em;
                }

                .dots-button {
                    transform: scale(1);
                }

                .dots-button:hover {
                    transform: scale(1.05);
                }


                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(15, 23, 42, 0.7);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                }

                .modal-content {
                    background: white;
                    border-radius: 20px;
                    padding: 32px;
                    width: 400px;
                    max-width: calc(100vw - 32px);
                    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
                }
                @media (max-width: 480px) {
                    .modal-content { padding: 20px; border-radius: 14px; }
                }

                .modal-info {
                    background: #f8fafc;
                    padding: 16px;
                    border-radius: 12px;
                    margin: 16px 0;
                    font-size: 14px;
                }

                textarea {
                    width: 100%;
                    padding: 12px;
                    border-radius: 10px;
                    border: 1px solid #e2e8f0;
                    margin-bottom: 20px;
                    outline: none;
                    box-sizing: border-box;
                }

                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                }

                .btn-secondary, .btn-danger, .btn-primary-disburse {
                    padding: 10px 18px;
                    border-radius: 10px;
                    font-size: 13.5px;
                    font-weight: 700;
                    cursor: pointer;
                    border: none;
                    transition: all 0.2s;
                }

                .btn-secondary {
                    background: #f1f5f9;
                    color: #475569;
                }

                .btn-secondary:hover:not(:disabled) {
                    background: #e2e8f0;
                }

                .btn-danger {
                    background: #ef4444;
                    color: white;
                }

                .btn-danger:hover:not(:disabled) {
                    background: #dc2626;
                }

                .btn-primary-disburse {
                    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                    color: white;
                    box-shadow: 0 8px 16px -4px rgba(37, 99, 235, 0.35);
                }

                .btn-primary-disburse:hover:not(:disabled) {
                    background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
                }

                .btn-secondary:disabled, .btn-danger:disabled, .btn-primary-disburse:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .disburse-field-label {
                    display: block;
                    font-size: 11px;
                    font-weight: 700;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    margin: 12px 0 6px 0;
                }

                .disburse-input {
                    width: 100%;
                    padding: 10px 12px;
                    border-radius: 10px;
                    border: 1px solid #e2e8f0;
                    outline: none;
                    box-sizing: border-box;
                    font-size: 14px;
                    font-family: inherit;
                }

                .disburse-input:focus {
                    border-color: #2563eb;
                    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
                }

                /* SKELETON LOADING STYLES */
                .skeleton-row td {
                    padding: 16px 20px;
                    border-bottom: 1px solid #f1f5f9;
                }

                .skeleton-bar {
                    height: 12px;
                    background: #f1f5f9;
                    background-image: linear-gradient(
                        90deg, 
                        #f1f5f9 0px, 
                        #e2e8f0 40px, 
                        #f1f5f9 80px
                    );
                    background-size: 600px;
                    animation: shimmer-premium 2s infinite linear;
                    border-radius: 6px;
                }

                .skeleton-avatar {
                    width: 32px;
                    height: 32px;
                    border-radius: 10px;
                    background: #f1f5f9;
                    background-image: linear-gradient(
                        90deg, 
                        #f1f5f9 0px, 
                        #e2e8f0 40px, 
                        #f1f5f9 80px
                    );
                    background-size: 600px;
                    animation: shimmer-premium 2s infinite linear;
                }

                @keyframes shimmer-premium {
                    0% { background-position: -468px 0; }
                    100% { background-position: 468px 0; }
                }

                .table-loading {
                   display: none;
                }
            `}</style>
        </div>
    );
};

export default Customers;

