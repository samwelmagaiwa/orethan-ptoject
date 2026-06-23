import { useEffect, useState, useRef } from "react";
import axios from "axios";
import LoanDetailsModal from "../components/LoanDetailsModal";
import AlertModal from "../components/AlertModal";
import ConfirmModal from "../components/ConfirmModal";
import ApproveModal from "../components/ApproveModal";
import HistoryModal from "../components/HistoryModal";

interface Loan {
  id: number;
  name: string;
  amount: number;
  type: string;
  status: string;
  phone?: string;
  rejection_reason?: string;
  details?: any;
  created_at?: string;
  active_loans_count?: number;
  total_remaining_balance?: number;
  total_arrears?: number;
}

const GeneralManager = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<'down' | 'up'>('down');
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: "", message: "", type: 'info' as any });
  const [confirm, setConfirm] = useState({ isOpen: false, title: "", message: "", onConfirm: () => { }, type: 'info' as any });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    fetchLoans();
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
      const res = await axios.get(
        `${API_BASE}/loans/gm`,
        { headers: getAuthHeaders() }
      );
      setLoans(res.data);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusStep = (status: string) => {
    switch (status) {
      case 'loan_officer': return 0;
      case 'manager_review': return 1;
      case 'gm_review': return 2;
      case 'md_review': return 3;
      case 'approved': return 4;
      case 'disbursed':
      case 'completed': return 5;
      default: return 0;
    }
  };

  const toggleDropdown = (id: number, event: React.MouseEvent) => {
    if (activeDropdown === id) {
      setActiveDropdown(null);
    } else {
      const buttonRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const spaceBelow = windowHeight - buttonRect.bottom;
      setDropdownPosition(spaceBelow < 200 ? 'up' : 'down');
      setActiveDropdown(id);
    }
    event.stopPropagation();
  };

  const approveLoan = (loan: Loan) => {
    setSelectedLoan(loan);
    setShowApproveModal(true);
    setActiveDropdown(null);
  };

  const submitApproval = async (comments: string) => {
    setSubmitting(true);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
      await axios.post(
        `${API_BASE}/loans/${selectedLoan?.id}/approve`,
        { comments: comments },
        { headers: getAuthHeaders() }
      );
      setModal({ isOpen: true, title: "Imefanikiwa", message: "Mkopo umeidhinishwa na kutumwa kwa Managing Director", type: 'success' });
      setShowApproveModal(false);
      fetchLoans();
      setActiveDropdown(null);
    } catch (error) {
      console.log(error);
      setModal({ isOpen: true, title: "Hitilafu", message: "Imeshindwa kuidhinisha mkopo", type: 'error' });
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
      setModal({ isOpen: true, title: "Taarifa", message: "Tafadhali weka sababu ya kukataa.", type: 'warning' });
      return;
    }

    try {
      const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
      setSubmitting(true);
      await axios.post(
        `${API_BASE}/loans/${selectedLoan?.id}/reject`,
        { reason: rejectReason },
        { headers: getAuthHeaders() }
      );
      setModal({ isOpen: true, title: "Imefanikiwa", message: "Ombi limekataliwa na kurudishwa kwa Loan Manager", type: 'warning' });
      setShowRejectModal(false);
      fetchLoans();
    } catch (error) {
      console.log(error);
      setModal({ isOpen: true, title: "Hitilafu", message: "Imeshindwa kukataa ombi", type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

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

  const deleteLoan = (id: number) => {
    setConfirm({
      isOpen: true,
      title: "Futa Mkopo",
      message: "Je, una uhakika unataka kufuta kabisa ombi hili la mkopo?",
      type: 'danger',
      onConfirm: () => {
        setConfirm(prev => ({ ...prev, isOpen: false }));
        setSubmitting(true);
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

        axios
          .delete(`${API_BASE}/loans/${id}`, { headers })
          .then(() => {
            setModal({ isOpen: true, title: "Imefanikiwa", message: "Mkopo umefutwa kikamilifu", type: 'success' });
            fetchLoans();
            setActiveDropdown(null);
          })
          .catch((err) => {
            console.log(err);
            setModal({ isOpen: true, title: "Hitilafu", message: "Imefeli kufuta mkopo", type: 'error' });
          })
          .finally(() => setSubmitting(false));
      }
    });
  };

  return (
    <div className="gm-page">
      <AlertModal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onClose={() => setModal({ ...modal, isOpen: false })}
      />
      <ConfirmModal
        isOpen={confirm.isOpen}
        title={confirm.title}
        message={confirm.message}
        type={confirm.type}
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm({ ...confirm, isOpen: false })}
      />
      <ApproveModal
        isOpen={showApproveModal}
        loan={selectedLoan}
        onConfirm={submitApproval}
        onCancel={() => setShowApproveModal(false)}
        submitting={submitting}
      />
      <div className="stats-row">
        <div className="stat-box">
          <div className="stat-label">Total Handled</div>
          <div className="stat-number">{loans.length}</div>
        </div>
        <div className="stat-box" style={{ borderLeftColor: '#3b82f6' }}>
          <div className="stat-label">Current Role</div>
          <div className="stat-number" style={{ fontSize: '24px' }}>General Manager</div>
        </div>
        <div className="stat-box" style={{ borderLeftColor: '#f59e0b' }}>
          <div className="stat-label">Action Required</div>
          <div className="stat-number">{loans.filter(l => l.status === 'gm_review').length}</div>
        </div>
      </div>

      <div className="table-container full-width">
        <div className="table-header-premium">
          <div className="header-title-group">
            <h2>Loan Applications (GM Desk)</h2>
            {loans.length > 0 && (
              <div className="workflow-stepper header-stepper">
                {[
                  { label: 'Officer', role: 'Loan Officer' },
                  { label: 'LM', role: 'Loan Manager' },
                  { label: 'GM', role: 'General Manager' },
                  { label: 'MD', role: 'Managing Director' },
                  { label: 'Final', role: 'Complete' }
                ].map((step, i) => {
                  const targetLoan = selectedLoan || loans[0];
                  const currentStep = getStatusStep(targetLoan.status);
                  const isCompleted = i < currentStep;
                  const isActive = i === currentStep;
                  const isReturned = targetLoan.status === 'loan_officer' && (targetLoan as any).rejection_metadata;

                  return (
                    <div key={i} className={`step-item ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''} ${isActive && isReturned ? 'returned' : ''}`}>
                      <div className="step-circle" title={step.role}>
                        {isCompleted ? '✓' : i + 1}
                      </div>
                      <div className="step-label">{step.label}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <button className="refresh-btn-header" onClick={fetchLoans}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
            Refresh Applications
          </button>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Mteja</th>
                <th>Namba ya Simu</th>
                <th>Mikopo (Active)</th>
                <th>Deni Lililobaki</th>
                <th>Arrears</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Hatua</th>
              </tr>
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
                    <td><div className="skeleton-bar" style={{ width: '70px' }}></div></td>
                    <td><div className="skeleton-bar" style={{ width: '90px' }}></div></td>
                    <td><div className="skeleton-bar" style={{ width: '80px' }}></div></td>
                    <td><div className="skeleton-bar" style={{ width: '100px' }}></div></td>
                    <td style={{ textAlign: 'right' }}><div className="skeleton-bar" style={{ width: '40px', marginLeft: 'auto' }}></div></td>
                  </tr>
                ))
              ) : loans.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <p>No loan requests</p>
                      <span>No pending applications to review</span>
                    </div>
                  </td>
                </tr>
              ) : (
                loans.map((loan, index) => (
                  <tr
                    key={loan.id}
                    onClick={() => setSelectedLoan(loan)}
                    className={selectedLoan?.id === loan.id ? 'selected-row' : ''}
                  >
                    <td className="col-number">{index + 1}</td>
                    <td>
                      <div className="client-info">
                        <div className="avatar">{loan.name.charAt(0)}</div>
                        <span className="client-name">{loan.name}</span>
                      </div>
                    </td>
                    <td>{loan.phone || "N/A"}</td>
                    <td>
                      <div className="status-container">
                        <span className="active-count">{loan.active_loans_count || 0} Amilifu</span>
                      </div>
                    </td>
                    <td className="col-amount">TZS {Number(loan.total_remaining_balance || 0).toLocaleString()}</td>
                    <td>
                      <span className={`arrears-badge ${Number(loan.total_arrears || 0) > 0 ? 'has-arrears' : 'no-arrears'}`}>
                        {Number(loan.total_arrears || 0) > 0 ? `TZS ${Number(loan.total_arrears).toLocaleString()}` : 'Hakuna'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge status-${loan.status.replace('_', '-')}`} style={{
                        color: (loan.status === 'approved' || loan.status === 'disbursed') ? '#16a34a' : 'inherit',
                        fontWeight: (loan.status === 'approved' || loan.status === 'disbursed') ? '700' : '500',
                        border: (loan.status === 'approved' || loan.status === 'disbursed') ? '1px solid #16a34a' : 'none',
                        padding: (loan.status === 'approved' || loan.status === 'disbursed') ? '3px 10px' : '4px 12px'
                      }}>
                        {loan.status === 'gm_review' ? 'PENDING GM' :
                          loan.status === 'md_review' ? (
                            <span>
                              <span style={{ color: '#16a34a', fontWeight: '700' }}>GM APPROVED</span>
                              <span style={{ color: '#94a3b8', margin: '0 4px' }}>|</span>
                              <span style={{ color: '#f59e0b', fontWeight: '700' }}>PENDING MD</span>
                            </span>
                          ) :
                            (loan.status === 'manager_review' && (loan as any).rejection_metadata?.rejector_role === 'general_manager') ? (
                              <span style={{ color: '#ef4444', fontWeight: '800' }}>REJECTED</span>
                            ) :
                              loan.status === 'approved' ? 'APPROVED' :
                                loan.status === 'disbursed' ? 'DISBURSED' :
                                  loan.status === 'loan_officer' ? 'RETURNED FOR CORRECTION' :
                                    loan.status === 'manager_review' ? <span style={{ color: '#f59e0b', fontWeight: '700' }}>PENDING LM</span> :
                                      loan.status.replace(/_/g, ' ').toUpperCase()}


                      </span>
                      {(loan.status === 'manager_review' || loan.status === 'loan_officer') && (loan as any).rejection_metadata && (
                        <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px', maxWidth: '180px' }}>
                          Sababu: {(loan as any).rejection_metadata.reason}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', position: 'relative' }}>
                      <button className="dots-button" onClick={(e) => toggleDropdown(loan.id, e)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg>
                      </button>

                      {activeDropdown === loan.id && (
                        <div ref={dropdownRef} className={`action-dropdown ${dropdownPosition}`}>
                          {loan.status === 'gm_review' ? (
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
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showRejectModal && (
        <div className="reject-overlay-premium" onClick={() => setShowRejectModal(false)}>
          <div className="reject-card-premium animate-pop-premium" onClick={(e) => e.stopPropagation()}>
            <div className="reject-header-premium">
              <div className="reject-icon-box">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 15h2M12 9v4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
              </div>
              <h2>Reject Loan Application</h2>
              <p>Please provide a reason for returning this application for corrections. It will be returned to the Loan Manager.</p>
            </div>

            <div className="reject-client-info">
              <div className="info-item">
                <span>Client</span>
                <strong>{selectedLoan?.name}</strong>
              </div>
              <div className="info-item">
                <span>Amount</span>
                <strong>TZS {Number(selectedLoan?.amount).toLocaleString()}</strong>
              </div>
            </div>

            <textarea
              placeholder="Provide clear reasons for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="reject-textarea-premium"
            />

            <div className="reject-footer-premium">
              <button className="reject-btn-cancel" onClick={() => setShowRejectModal(false)} disabled={submitting}>
                Cancel
              </button>
              <button className="reject-btn-confirm" onClick={submitRejection} disabled={submitting}>
                {submitting ? 'Processing...' : 'Return for Corrections'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* DETAILS MODAL */}
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
        .gm-page {
          padding: 0 10px 20px 10px;
          margin-top: -24px;
          min-height: 100vh;
          background: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
          background: #f8fafc;
          padding: 0 0 20px 0;
        }

        .stat-box {
          background: white;
          border-radius: 12px;
          padding: 24px;
          border: 1px solid #e2e8f0;
          border-left: 4px solid #0f172a;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          transition: transform 0.2s;
        }

        .stat-box:hover {
          transform: translateY(-2px);
        }

        .stat-label {
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
        }

        .stat-number {
          font-size: 32px;
          font-weight: 800;
          color: #0f172a;
        }

        .table-container {
          background: white;
          border-radius: 12px;
          padding: 24px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .table-container.full-width {
           max-width: none;
           width: 100%;
        }

        .table-header-premium {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
        }

        .header-title-group {
          display: flex;
          align-items: center;
        }

        .header-stepper {
           margin-left: 30px;
        }

        .table-header-premium h2 {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .refresh-btn-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
        }

        .refresh-btn-header:hover {
          background: #f1f5f9;
          color: #0f172a;
        }

        .table-wrapper {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th {
          text-align: left;
          padding: 12px 16px;
          background: #f8fafc;
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          border-bottom: 1px solid #e2e8f0;
        }

        td {
          padding: 16px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 14px;
          color: #1e293b;
        }

        tr:hover {
          background: #fdfbf7;
          cursor: pointer;
        }

        tr.selected-row {
          background: #f1f5f9 !important;
          box-shadow: inset 4px 0 0 #0f172a;
        }

        .avatar {
          width: 32px;
          height: 32px;
          background: #0f172a;
          color: white;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
        }

        .client-info {
          display: flex;
          align-items: center;
          gap: 12px;
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

        .dots-button {
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .dots-button:hover {
          background: #f1f5f9;
          color: #0f172a;
        }

        .action-dropdown {
          position: absolute;
          right: 0;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
          z-index: 100;
          width: 160px;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .status-badge {
          display: inline-block;
          font-size: 11px;
          border-radius: 30px;
        }

        /* STEPPER STYLES */
        .workflow-stepper {
          display: flex;
          gap: 12px;
          align-items: center;
          justify-content: center;
        }

        .step-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          min-width: 60px;
        }

        .step-item:not(:last-child)::after {
          content: '';
          position: absolute;
          top: 15px;
          left: calc(50% + 15px);
          width: calc(100% - 15px);
          height: 3px;
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
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: white;
          border: 3px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          color: #94a3b8;
          position: relative;
          z-index: 2;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .step-label {
          font-size: 10px;
          font-weight: 700;
          color: #94a3b8;
          margin-top: 6px;
          text-transform: uppercase;
          text-align: center;
          white-space: nowrap;
        }

        .step-item.completed .step-circle {
          background: #16a34a;
          border-color: #16a34a;
          color: white;
          box-shadow: 0 0 15px rgba(22, 163, 74, 0.3);
        }

        .step-item.completed .step-label {
          color: #16a34a;
        }

        .step-item.active .step-circle {
          border-color: #facc15;
          color: #854d0e;
          background: #fef9c3;
          box-shadow: 0 0 15px rgba(250, 204, 21, 0.4);
          transform: scale(1.1);
        }

        .step-item:not(.completed) .step-circle {
          border-color: #fde047;
          background: #fefce8;
        }

        .step-item.active .step-label {
          color: #854d0e;
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

        .empty-state {
          text-align: center;
          padding: 40px;
          color: #64748b;
        }

        /* PREMIUM REJECT MODAL STYLES */
        .reject-overlay-premium {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10002;
          padding: 20px;
        }

        .reject-card-premium {
          background: white;
          width: 100%;
          max-width: 480px;
          border-radius: 28px;
          padding: 40px;
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.3);
        }

        @keyframes pop {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        .animate-pop-premium {
          animation: pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>
    </div >
  );
};

export default GeneralManager;