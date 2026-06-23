import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import AlertModal from "../components/AlertModal";
import ConfirmModal from "../components/ConfirmModal";
import LoanDetailsModal from "../components/LoanDetailsModal";
import ApproveModal from "../components/ApproveModal";
import HistoryModal from "../components/HistoryModal";

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
}

const Customers: React.FC = () => {
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

            const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
            const userRes = await axios.get(`${API_BASE}/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const userData = userRes.data;
            setUser(userData);

            if (userData.role === "admin") {
                await fetchCustomers();
            } else {
                await fetchManagerLoans(userData.role);
            }
        } catch (err) {
            console.error(err);
            setModalMessage("Imeshindwa kupata taarifa");
            setModalType("error");
            setShowModal(true);
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomers = async () => {
        const token = localStorage.getItem("token");
        const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
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

        const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
        const res = await axios.get(`${API_BASE}/${endpoint}`, {
            headers: { Authorization: token ? `Bearer ${token}` : "" }
        });
        const pendingLoans = res.data.filter((l: any) => l.status !== 'approved' && l.status !== 'disbursed' && l.status !== 'completed');
        setLoans(res.data);
        setLoanStats({
            pending: pendingLoans.length,
            total_value: pendingLoans.reduce((acc: number, l: any) => acc + Number(l.amount), 0)
        });
    };

    const filteredCustomers = (customers || []).filter(c =>
        c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone_number.includes(searchQuery)
    );

    const filteredLoans = (loans || []).filter(l =>
        l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.phone.includes(searchQuery)
    );

    const dropdownRef = useRef<HTMLDivElement>(null);
    const [dropdownPosition, setDropdownPosition] = useState("dropdown-bottom");
    const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [rejectReason, setRejectReason] = useState("");

    const toggleDropdown = (id: number, e: React.MouseEvent, index: number, total: number) => {
        e.stopPropagation();
        if (activeDropdown === id) {
            setActiveDropdown(null);
        } else {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const isBottomRow = (index >= total - 2 && total > 2) || spaceBelow < 220;
            setDropdownPosition(isBottomRow ? "dropdown-top" : "dropdown-bottom");
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
            const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
            await axios.post(`${API_BASE}/loans/${selectedLoan?.id}/approve`, {
                comments: comments
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setModalMessage("Mkopo umeidhinishwa kikamilifu!");
            setModalType("success");
            setShowModal(true);
            setShowApproveModal(false);
            fetchManagerLoans(user!.role);
            setActiveDropdown(null);
        } catch (err) {
            console.error(err);
            setModalMessage("Imeshindwa kuidhinisha mkopo");
            setModalType("error");
            setShowModal(true);
        } finally {
            setSubmitting(false);
        }
    };

    const openRejectModal = (loan: Loan) => {
        setSelectedLoan(loan);
        setRejectReason("");
        setShowRejectModal(true);
        setActiveDropdown(null);
    };

    const submitRejection = async () => {
        if (!rejectReason.trim()) {
            setModalMessage("Tafadhali weka sababu ya kukataa.");
            setModalType("warning");
            setShowModal(true);
            return;
        }
        setSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
            await axios.post(`${API_BASE}/loans/${selectedLoan?.id}/reject`, {
                reason: rejectReason
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setModalMessage("Ombi limekataliwa.");
            setModalType("warning");
            setShowModal(true);
            setShowRejectModal(false);
            fetchManagerLoans(user!.role);
        } catch (err) {
            console.error(err);
            setModalMessage("Imeshindwa kukataa ombi");
            setModalType("error");
            setShowModal(true);
        } finally {
            setSubmitting(false);
        }
    };

    const deleteLoan = (id: number) => {
        setConfirmModal({
            isOpen: true,
            title: "Futa Mkopo",
            message: "Je, una uhakika unataka kufuta kabisa ombi hili la mkopo?",
            type: 'danger',
            onConfirm: () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                setSubmitting(true);
                const token = localStorage.getItem("token");
                const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
                axios.delete(`${API_BASE}/loans/${id}`, {
                    headers: { Authorization: token ? `Bearer ${token}` : "" }
                })
                    .then(() => {
                        setModalMessage("Mkopo umefutwa kikamilifu");
                        setModalType("success");
                        setShowModal(true);
                        fetchManagerLoans(user!.role);
                        setActiveDropdown(null);
                    })
                    .catch((err) => {
                        console.error(err);
                        setModalMessage("Imefeli kufuta mkopo");
                        setModalType("error");
                        setShowModal(true);
                    })
                    .finally(() => setSubmitting(false));
            }
        });
    };

    return (
        <div className="customers-page">
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
                {user?.role === "admin" ? (
                    <>
                        <div className="stat-box accent-blue">
                            <div className="stat-icon-circle"><IconWallet /></div>
                            <div className="stat-box-text">
                                <div className="stat-label">Jumla ya Mikopo (Deni)</div>
                                <div className="stat-number">TZS {stats.total_loaned.toLocaleString()}</div>
                            </div>
                        </div>
                        <div className="stat-box accent-red">
                            <div className="stat-icon-circle"><IconAlertTriangle /></div>
                            <div className="stat-box-text">
                                <div className="stat-label">Malimbikizo (Arrears)</div>
                                <div className="stat-number" style={{ color: '#ef4444' }}>TZS {stats.total_arrears.toLocaleString()}</div>
                            </div>
                        </div>
                        <div className="stat-box accent-green">
                            <div className="stat-icon-circle"><IconUsers /></div>
                            <div className="stat-box-text">
                                <div className="stat-label">Wateja Amilifu</div>
                                <div className="stat-number">{stats.active_customers}</div>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="stat-box accent-blue">
                            <div className="stat-icon-circle"><IconClock /></div>
                            <div className="stat-box-text">
                                <div className="stat-label">Maombi Yanayosubiri</div>
                                <div className="stat-number">{loanStats.pending}</div>
                            </div>
                        </div>
                        <div className="stat-box accent-green">
                            <div className="stat-icon-circle"><IconWallet /></div>
                            <div className="stat-box-text">
                                <div className="stat-label">Thamani ya Maombi</div>
                                <div className="stat-number">TZS {loanStats.total_value.toLocaleString()}</div>
                            </div>
                        </div>
                        <div className="stat-box accent-purple">
                            <div className="stat-icon-circle"><IconUsers /></div>
                            <div className="stat-box-text">
                                <div className="stat-label">Wateja (Active)</div>
                                <div className="stat-number">{stats.active_customers || 0}</div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* TABLE CONTAINER */}
            <div className="table-container full-width">
                <div className="table-header-premium" style={{ justifyContent: 'flex-end' }}>
                    <div className="search-wrapper">
                        <div className="search-icon">
                            <IconSearch />
                        </div>
                        <input
                            type="text"
                            placeholder={user?.role === "admin" ? "Tafuta mteja..." : "Tafuta mwombaji..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="table-wrapper">
                    <table>
                        <thead>
                            {user?.role === "admin" ? (
                                <tr>
                                    <th>Mteja</th>
                                    <th>Namba ya Simu</th>
                                    <th style={{ whiteSpace: 'nowrap' }}>Mikopo (Active)</th>
                                    <th>Deni Lililobaki</th>
                                    <th>Arrears</th>
                                    <th style={{ textAlign: 'right' }}>Hatua</th>
                                </tr>
                            ) : (
                                <tr>
                                    <th>#</th>
                                    <th>Mwombaji</th>
                                    <th>Simu</th>
                                    <th>Kiasi</th>
                                    <th>Aina</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Hatua</th>
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
                            ) : user?.role === "admin" ? (
                                filteredCustomers.length === 0 ? (
                                    <tr><td colSpan={6} className="table-empty">Hakuna mteja aliyepatikana.</td></tr>
                                ) : (
                                    filteredCustomers.map((customer) => (
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
                                                    <span className="active-count">{customer.active_loans_count} Amilifu</span>
                                                </div>
                                            </td>
                                            <td className="col-amount">TZS {Number(customer.total_remaining_balance).toLocaleString()}</td>
                                            <td>
                                                <span className={`arrears-badge ${Number(customer.total_arrears) > 0 ? 'has-arrears' : 'no-arrears'}`}>
                                                    {Number(customer.total_arrears) > 0 ? `TZS ${Number(customer.total_arrears).toLocaleString()}` : 'Hakuna'}
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
                                                                        user?.role === 'loan_officer' ? 'officer' : '';
                                                            window.location.href = prefix ? `/${prefix}/customers/${customer.id}` : `/customers/${customer.id}`;
                                                        }}
                                                    >
                                                        <IconEye size={16} /> Profile
                                                    </button>
                                                    <button
                                                        className="btn-repay"
                                                        onClick={() => {
                                                            const prefix = user?.role === 'loan_manager' ? 'lm' :
                                                                user?.role === 'general_manager' ? 'gm' :
                                                                    user?.role === 'managing_director' ? 'md' :
                                                                        user?.role === 'loan_officer' ? 'officer' : '';
                                                            window.location.href = prefix ? `/${prefix}/customers/${customer.id}/repayments` : `/customers/${customer.id}/repayments`;
                                                        }}
                                                    >
                                                        <IconCreditCard /> Repay
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )
                            ) : (
                                filteredLoans.length === 0 ? (
                                    <tr><td colSpan={7} className="table-empty">Hakuna maombi yanayosubiri.</td></tr>
                                ) : (
                                    filteredLoans.map((loan, index) => (
                                        <tr
                                            key={loan.id}
                                            onClick={() => setSelectedLoan(loan)}
                                            className={selectedLoan?.id === loan.id ? 'selected-row' : ''}
                                        >
                                            <td>{index + 1}</td>
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
                                                    {loan.status === 'manager_review' ? (
                                                        (loan as any).rejection_metadata?.rejector_role === 'general_manager' ? (
                                                            <span style={{ color: '#ef4444', fontWeight: '800' }}>REJECTED</span>
                                                        ) : <span style={{ color: '#f59e0b', fontWeight: '700' }}>PENDING LM</span>
                                                    ) :
                                                        loan.status === 'gm_review' ? (
                                                            (loan as any).rejection_metadata?.rejector_role === 'managing_director' ? (
                                                                <span style={{ color: '#ef4444', fontWeight: '800' }}>REJECTED</span>
                                                            ) : (
                                                                <span>
                                                                    <span style={{ color: '#16a34a', fontWeight: '700' }}>LM APPROVED</span>
                                                                    <span style={{ color: '#94a3b8', margin: '0 4px' }}>|</span>
                                                                    <span style={{ color: '#f59e0b', fontWeight: '700' }}>PENDING GM</span>
                                                                </span>
                                                            )
                                                        ) :
                                                            loan.status === 'md_review' ? (
                                                                <span>
                                                                    <span style={{ color: '#16a34a', fontWeight: '700' }}>GM APPROVED</span>
                                                                    <span style={{ color: '#94a3b8', margin: '0 4px' }}>|</span>
                                                                    <span style={{ color: '#f59e0b', fontWeight: '700' }}>PENDING MD</span>
                                                                </span>
                                                            ) :
                                                                (loan.status === 'loan_officer' && (loan as any).rejection_metadata?.rejector_role === 'loan_manager') ? (
                                                                    <span style={{ color: '#ef4444', fontWeight: '800' }}>REJECTED</span>
                                                                ) :
                                                                    loan.status === 'approved' ? 'APPROVED' :
                                                                        loan.status === 'disbursed' ? 'DISBURSED' :
                                                                            loan.status.replace(/_/g, ' ').toUpperCase()}

                                                </span>
                                                {loan.rejection_reason && (loan.status === 'loan_officer') && (
                                                    <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px', fontWeight: '500' }}>
                                                        Sababu: {loan.rejection_reason}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'right', position: 'relative' }}>
                                                <button className="dots-button" onClick={(e) => toggleDropdown(loan.id, e, index, filteredLoans.length)}>
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg>
                                                </button>

                                                {activeDropdown === loan.id && (
                                                    <div ref={dropdownRef} className={`action-dropdown ${dropdownPosition}`}>
                                                        {((user?.role === 'admin') ||
                                                            (user?.role === 'loan_manager' && loan.status === 'manager_review') ||
                                                            (user?.role === 'general_manager' && loan.status === 'gm_review') ||
                                                            (user?.role === 'managing_director' && loan.status === 'md_review')) ? (
                                                            <>
                                                                <button
                                                                    onClick={() => approveLoan(loan)}
                                                                    className={`approve-action ${submitting ? 'muted' : ''}`}
                                                                    disabled={submitting}
                                                                >
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                                    Approve
                                                                </button>
                                                                <button onClick={() => viewDetails(loan)} disabled={submitting}>
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                                                    View Details
                                                                </button>
                                                                <button
                                                                    onClick={() => openRejectModal(loan)}
                                                                    className={`reject-action ${submitting ? 'muted' : ''}`}
                                                                    disabled={submitting}
                                                                >
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                                    Reject
                                                                </button>
                                                                <button
                                                                    onClick={() => deleteLoan(loan.id)}
                                                                    className={`reject-action ${submitting ? 'muted' : ''}`}
                                                                    disabled={submitting}
                                                                    style={{ color: '#ef4444' }}
                                                                >
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                                                    Delete Loan
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button onClick={() => viewDetails(loan)} disabled={submitting}>
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                                                    View Details
                                                                </button>
                                                                <button onClick={() => viewHistory(loan)} disabled={submitting}>
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                                                                    Angalia Mapendekezo
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )
                            )}
                        </tbody>
                    </table>
                </div>
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
                        <h2>Reject Loan Application</h2>
                        <div className="modal-info">
                            <p><strong>Client:</strong> {selectedLoan?.name}</p>
                            <p><strong>Requested:</strong> TZS {Number(selectedLoan?.amount).toLocaleString()}</p>
                        </div>
                        <textarea
                            placeholder="Enter rejection reason..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={4}
                        />
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setShowRejectModal(false)} disabled={submitting}>Cancel</button>
                            <button className="btn-danger" onClick={submitRejection} disabled={submitting}>
                                {submitting ? 'Returning...' : 'Return for Corrections'}
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
                    background: linear-gradient(180deg, #f1f5f9 0%, #f8fafc 280px);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .stats-row {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 24px;
                    margin-bottom: 32px;
                    width: 100%;
                    position: sticky;
                    top: 0px;
                    z-index: 10;
                    background: linear-gradient(180deg, #f1f5f9 0%, #f8fafc 100%);
                    padding: 4px 0 20px 0;
                }

                .stat-box {
                    background: white;
                    border-radius: 18px;
                    padding: 22px 24px;
                    border: 1px solid #e2e8f0;
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
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 8px;
                }

                .stat-number {
                    font-size: 26px;
                    font-weight: 800;
                    color: #0f172a;
                    letter-spacing: -0.01em;
                }

                .table-container {
                    background: white;
                    border-radius: 20px;
                    padding: 26px;
                    border: 1px solid #e2e8f0;
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
                    margin-bottom: 24px;
                    flex-wrap: wrap;
                    gap: 16px;
                    padding-bottom: 22px;
                    border-bottom: 1px solid #f1f5f9;
                }

                .header-title-group {
                    display: flex;
                    align-items: center;
                    gap: 30px;
                }

                .header-stepper {
                    margin-top: 5px;
                }

                .table-header-premium h2 {
                    font-size: 19px;
                    font-weight: 800;
                    color: #0f172a;
                    margin: 0;
                    letter-spacing: -0.01em;
                }

                .search-wrapper {
                    position: relative;
                    width: 320px;
                }

                .search-icon {
                    position: absolute;
                    left: 14px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #94a3b8;
                    transition: color 0.2s;
                }

                .search-wrapper input {
                    width: 100%;
                    padding: 11px 14px 11px 42px;
                    border-radius: 12px;
                    border: 1.5px solid #e2e8f0;
                    background: #f8fafc;
                    font-size: 14px;
                    outline: none;
                    transition: all 0.2s;
                    box-sizing: border-box;
                }

                .search-wrapper input:focus {
                    border-color: #2563eb;
                    background: white;
                    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
                }

                .search-wrapper input:focus + .search-icon,
                .search-wrapper:has(input:focus) .search-icon {
                    color: #2563eb;
                }

                .table-wrapper {
                    overflow-x: auto;
                    padding-bottom: 120px;
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
                    background: #f8fafc;
                    color: #64748b;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    border-bottom: 1.5px solid #e2e8f0;
                }

                th:first-child {
                    border-top-left-radius: 12px;
                }

                th:last-child {
                    border-top-right-radius: 12px;
                }

                td {
                    padding: 16px;
                    border-bottom: 1px solid #f1f5f9;
                    font-size: 14px;
                    color: #1e293b;
                    transition: background 0.15s;
                }

                tr:nth-child(even) {
                    background: #fbfcfe;
                }

                tr:hover td {
                    background: #f0f5ff !important;
                    cursor: pointer;
                }

                tr.selected-row td {
                    background: #eef2ff !important;
                    box-shadow: inset 3px 0 0 #2563eb;
                }

                .client-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .avatar {
                    width: 38px;
                    height: 38px;
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    color: white;
                    border-radius: 11px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 15px;
                    box-shadow: 0 4px 10px -2px rgba(37, 99, 235, 0.4);
                    flex-shrink: 0;
                }

                .client-name {
                    font-weight: 600;
                    color: #0f172a;
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
                    color: #0f172a;
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
                    border: 1px solid #e2e8f0;
                }

                .btn-profile {
                    background: white;
                    color: #1e293b;
                }

                .btn-profile:hover {
                    background: #f8fafc;
                    border-color: #cbd5e1;
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

                .dots-button {
                    background: none;
                    border: none;
                    color: #94a3b8;
                    cursor: pointer;
                    padding: 6px;
                    border-radius: 8px;
                    transition: all 0.2s;
                }

                .dots-button:hover {
                    background: #f1f5f9;
                    color: #1e293b;
                }

                .action-dropdown {
                    position: absolute;
                    right: 0;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
                    z-index: 100;
                    width: 170px;
                    padding: 8px;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .dropdown-bottom {
                    top: 100%;
                    margin-top: 8px;
                }

                .dropdown-top {
                    bottom: 100%;
                    margin-bottom: 8px;
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
                    color: #475569;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: left;
                }

                .action-dropdown button:hover:not(:disabled) {
                    background: #f8fafc;
                    color: #0f172a;
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

                /* STEPPER STYLES */
                .workflow-stepper {
                    display: flex;
                    gap: 12px;
                    align-items: center;
                }

                .step-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    position: relative;
                    min-width: 50px;
                }

                .step-item:not(:last-child)::after {
                    content: '';
                    position: absolute;
                    top: 12px;
                    left: calc(50% + 12px);
                    width: calc(100% - 12px);
                    height: 2px;
                    background: #e2e8f0;
                    z-index: 1;
                }

                .step-item.completed:not(:last-child)::after {
                    background: #16a34a;
                }

                .step-item.active:not(:last-child)::after {
                    background: #facc15;
                }

                .step-circle {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: white;
                    border: 2px solid #e2e8f0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 10px;
                    font-weight: 700;
                    color: #94a3b8;
                    position: relative;
                    z-index: 2;
                    transition: all 0.3s;
                }

                .step-label {
                    font-size: 9px;
                    font-weight: 700;
                    color: #94a3b8;
                    margin-top: 4px;
                    text-transform: uppercase;
                    text-align: center;
                }

                .step-item.completed .step-circle {
                    background: #16a34a;
                    border-color: #16a34a;
                    color: white;
                }

                .step-item.completed .step-label {
                    color: #16a34a;
                }

                .step-item.active .step-circle {
                    border-color: #facc15;
                    color: #854d0e;
                    background: #fef9c3;
                    transform: scale(1.1);
                }

                .step-item:not(.completed) .step-circle {
                    border-color: #fde047;
                    background: #fefce8;
                }

                .step-item.active .step-label {
                    color: #854d0e;
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
                    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
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
