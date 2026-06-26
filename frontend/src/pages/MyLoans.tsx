import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import LoanDetailsModal from "../components/LoanDetailsModal";
import HistoryModal from "../components/HistoryModal";
import ConfirmModal from "../components/ConfirmModal";
import AlertModal from "../components/AlertModal";

interface Loan {
  id: number;
  name: string;
  amount: number | string;
  type: string;
  status: string;
  phone?: string;
  details?: Record<string, any>;
  rejection_metadata?: {
    reason: string;
    rejector_name: string;
    rejector_role: string;
    date: string;
  };
  approvals?: any[];
  created_at?: string;
}

const MyLoans = () => {
  const navigate = useNavigate();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [loanToDelete, setLoanToDelete] = useState<Loan | null>(null);

  const [showAlert, setShowAlert] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");
  const [alertType, setAlertType] = useState<'success' | 'error' | 'info' | 'warning'>('info');

  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchLoans();

    // Close menu when clicking outside
    const handleClickOutside = () => setActiveMenu(null);
    document.addEventListener('click', handleClickOutside);
    // Reposition is stale once the page scrolls/resizes -- just close the menu.
    const handleReposition = () => setActiveMenu(null);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, []);

  // Keep the current page in range whenever the page size or the underlying list changes.
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredLoans.length / entriesPerPage));
    if (currentPage > maxPage) setCurrentPage(maxPage);
  }, [loans.length, entriesPerPage, currentPage, search]);

  const toggleMenu = (loanId: number, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (activeMenu === loanId) {
      setActiveMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 170;
    const estimatedMenuHeight = 16 + 4 * 42 + 20; // 4 fixed actions: View / Fungua Mapendekezo / Edit / Delete
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= estimatedMenuHeight + 8
      ? rect.bottom + 8
      : Math.max(8, rect.top - estimatedMenuHeight - 8);
    const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
    setMenuPos({ top, left });
    setActiveMenu(loanId);
  };

  const fetchLoans = () => {
    const token = localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
    setLoading(true);
    axios
      .get(`${API_BASE}/loans/my-applications`, { headers })
      .then((res) => {
        setLoans(res.data);
      })
      .catch((err) => console.log(err))
      .finally(() => setLoading(false));
  };

  const filteredLoans = loans.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filteredLoans.length / entriesPerPage));
  const pagedLoans = filteredLoans.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  const viewDetails = (loan: Loan) => {
    setSelectedLoan(loan);
    setShowDetailsModal(true);
    setActiveMenu(null);
  };

  const openHistory = (loan: Loan) => {
    setSelectedLoan(loan);
    setShowHistoryModal(true);
    setActiveMenu(null);
  };

  const handleEdit = (loan: Loan) => {
    const route = loan.type === 'personal' ? '/personal-loan' : '/group-loan';
    navigate(`${route}?edit=${loan.id}`);
  };

  const handleDelete = (loan: Loan) => {
    setLoanToDelete(loan);
    setShowDeleteModal(true);
    setActiveMenu(null);
  };

  const confirmDelete = () => {
    if (!loanToDelete) return;

    const token = localStorage.getItem("token");
    const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
    axios.delete(`${API_BASE}/loans/${loanToDelete.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(() => {
        fetchLoans();
        setShowDeleteModal(false);
        setLoanToDelete(null);
      })
      .catch(err => {
        setAlertMsg("Error deleting loan: " + err.message);
        setAlertType('error');
        setShowAlert(true);
      });
  };

  return (
    <div className="loan-manager-page">

      <div className="stats-row">
        <div className="stat-box">
          <div className="stat-label">Total Applications</div>
          <div className="stat-number">{loans.length}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Approved</div>
          <div className="stat-number">{loans.filter(l => l.status === 'approved' || l.status === 'disbursed').length}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Pending Approval</div>
          <div className="stat-number">{loans.filter(l => l.status !== 'approved' && l.status !== 'disbursed' && l.status !== 'completed' && l.status !== 'rejected').length}</div>
        </div>
      </div>

      <div className="table-container full-width">
        <div className="entries-filter-row">
          <label className="entries-filter">
            Show
            <select value={entriesPerPage} onChange={(e) => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            entries
          </label>
          <div className="filter-right-group">
            <input
              type="text"
              className="search-input"
              placeholder="Search by client name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            />
            <button className="refresh-button" onClick={fetchLoans}>
              Reload
            </button>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Loading applications...</div>
        ) : loans.length === 0 ? (
          <div className="empty-state">
            <p>No applications found</p>
            <span>You haven't submitted any applications yet</span>
          </div>
        ) : filteredLoans.length === 0 ? (
          <div className="empty-state">
            <p>No matching applications</p>
            <span>No client name matches "{search}"</span>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Client Name</th>
                  <th>Loan Amount</th>
                  <th>Loan Type</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center', width: '80px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedLoans.map((loan, index) => (
                  <tr key={loan.id}>
                    <td className="col-number">{(currentPage - 1) * entriesPerPage + index + 1}</td>
                    <td>
                      <div className="client-info">
                        <span className="client-name">{loan.name}</span>
                      </div>
                    </td>
                    <td className="col-amount">TZS {Number(loan.amount).toLocaleString()}</td>
                    <td><span className="loan-type-badge">{loan.type}</span></td>
                    <td>
                      <span className={`status-badge status-${loan.status.replace('_', '-')}`} style={{
                        color: (loan.status === 'approved' || loan.status === 'disbursed') ? '#16a34a' : 'inherit',
                        fontWeight: (loan.status === 'approved' || loan.status === 'disbursed') ? '700' : '500',
                        border: (loan.status === 'approved' || loan.status === 'disbursed') ? '1px solid #16a34a' : 'none',
                        padding: (loan.status === 'approved' || loan.status === 'disbursed') ? '3px 10px' : '4px 12px'
                      }}>
                        {loan.status === 'loan_officer' ? 'RETURNED FOR CORRECTION' :
                          loan.status === 'manager_review' ? <span style={{ color: '#f59e0b', fontWeight: '700' }}>PENDING LM</span> :

                            loan.status === 'gm_review' ? (
                              <span>
                                <span style={{ color: '#16a34a', fontWeight: '700' }}>LM APPROVED</span>
                                <span style={{ color: '#94a3b8', margin: '0 4px' }}>|</span>
                                <span style={{ color: '#f59e0b', fontWeight: '700' }}>PENDING GM</span>
                              </span>
                            ) :
                              loan.status === 'md_review' ? (
                                <span>
                                  <span style={{ color: '#16a34a', fontWeight: '700' }}>GM APPROVED</span>
                                  <span style={{ color: '#94a3b8', margin: '0 4px' }}>|</span>
                                  <span style={{ color: '#f59e0b', fontWeight: '700' }}>PENDING MD</span>
                                </span>
                              ) :
                                loan.status === 'approved' ? 'APPROVED' :
                                  loan.status === 'disbursed' ? 'DISBURSED' :
                                    loan.status.replace(/_/g, ' ').toUpperCase()}

                      </span>
                      {loan.rejection_metadata && (
                        <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px', maxWidth: '180px' }}>
                          Sababu: {loan.rejection_metadata.reason}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', position: 'relative' }}>
                      <button
                        className="action-menu-trigger"
                        onClick={(e) => toggleMenu(loan.id, e)}
                      >
                        <div className="dots-vertical">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </button>

                      {activeMenu === loan.id && menuPos && createPortal(
                        <div className="action-dropdown" style={{ top: menuPos.top, left: menuPos.left }}>
                          <button onClick={() => viewDetails(loan)}>
                            View
                          </button>
                          <button onClick={() => openHistory(loan)} style={{ color: '#2563eb', fontWeight: '600' }}>
                            Fungua Mapendekezo
                          </button>
                          <button
                            disabled={loan.status !== 'loan_officer'}
                            className={loan.status !== 'loan_officer' ? 'muted' : ''}
                            onClick={() => handleEdit(loan)}
                          >
                            Edit
                          </button>
                          <button
                            disabled={loan.status !== 'loan_officer'}
                            className={`text-danger ${loan.status !== 'loan_officer' ? 'muted' : ''}`}
                            onClick={() => handleDelete(loan)}
                          >
                            Delete
                          </button>
                        </div>,
                        document.body
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredLoans.length > 0 && (
          <div className="pagination-row">
            <span className="pagination-info">
              Showing {(currentPage - 1) * entriesPerPage + 1}–{Math.min(currentPage * entriesPerPage, filteredLoans.length)} of {filteredLoans.length}
            </span>
            <div className="pagination-buttons">
              <button disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>Previous</button>
              <span className="pagination-page">{currentPage} / {totalPages}</span>
              <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      <LoanDetailsModal
        show={showDetailsModal}
        loan={selectedLoan}
        onClose={() => setShowDetailsModal(false)}
      />

      {/* History Modal for Officer */}
      <HistoryModal
        isOpen={showHistoryModal}
        loan={selectedLoan}
        onClose={() => setShowHistoryModal(false)}
      />

      <ConfirmModal
        isOpen={showDeleteModal}
        title="Futa Ombi la Mkopo"
        message={`Je, una uhakika unataka kufuta ombi la mkopo la ${loanToDelete?.name}? Kitendo hiki hakiwezi kurudishwa.`}
        type="danger"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteModal(false)}
      />

      <AlertModal
        isOpen={showAlert}
        message={alertMsg}
        type={alertType}
        onClose={() => setShowAlert(false)}
      />

      <style>{`
        .loan-manager-page {
          padding: 0 10px 20px 10px;
          margin-top: -24px; /* Perfectly negate the 24px layout padding */
          min-height: 100vh;
          background: #f5efe0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .page-header {
          display: flex;
          justify-content: flex-end; /* Align to right since text is gone */
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 16px;
          width: 100%;
        }

        .page-header.compact {
          margin-bottom: 12px;
        }

        .refresh-button {
          background: #fdfbf5;
          color: #5c4a1f;
          border: 1px solid #cbb88a;
          padding: 8px 20px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .refresh-button:hover {
          background: #efe6d0;
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
          padding: 0 0 8px 0; /* Zero top padding to "touch" the layout boundary */
        }

        .stat-box {
          background: #fdfbf5;
          border-radius: 12px;
          padding: 24px;
          border: 1px solid #e3d7b0;
          border-left: 4px solid #8a7338; /* Olive accent border */
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .stat-box:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }

        .stat-label {
          font-size: 13px;
          font-weight: 600;
          color: #8a7a52;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
        }

        .stat-number {
          font-size: 32px;
          font-weight: 800;
          color: #4a3c1a;
          line-height: 1;
        }

        .table-container {
          background: #fdfbf5;
          border-radius: 16px;
          padding: 24px;
          border: 1px solid #e3d7b0;
          width: 100%;
        }

        .table-container.full-width {
           max-width: none;
           width: 100%;
        }

        .table-container h2 {
          font-size: 18px;
          font-weight: 600;
          color: #4a3c1a;
          margin: 0 0 20px 0;
        }

        .entries-filter-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 16px;
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

        .filter-right-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .search-input {
          padding: 7px 12px;
          border: 1px solid #cbb88a;
          border-radius: 6px;
          background: #fdfbf5;
          color: #3f3318;
          font-size: 13px;
          width: 220px;
        }

        .search-input::placeholder {
          color: #b3a276;
        }

        .search-input:focus {
          outline: none;
          border-color: #8a7338;
          box-shadow: 0 0 0 2px rgba(138, 115, 56, 0.15);
        }

        .table-wrapper {
          overflow-x: auto;
          min-height: 400px; /* Ensure enough space for dropdowns */
          padding-bottom: 100px; /* Extra space at the bottom */
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th {
          text-align: left;
          padding: 8px 16px;
          background: #efe6d0;
          color: #5c4a1f;
          font-size: 13px;
          font-weight: 700;
          border-bottom: 1px solid #ddd0a0;
        }

        td {
          padding: 7px 16px;
          border-bottom: 1px solid #f0e8d4;
          font-size: 14px;
          color: #3f3318;
          line-height: 1.3;
        }

        tr:nth-child(even) {
          background: #faf6ea;
        }

        tr:hover {
          background: #f3ecd6 !important;
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

        .action-menu-trigger {
          background: none;
          border: none;
          padding: 8px;
          cursor: pointer;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
          margin: 0 auto;
        }

        .action-menu-trigger:hover {
          background: #efe6d0;
        }

        .dots-vertical {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .dots-vertical span {
          width: 4px;
          height: 4px;
          background: #8a7a52;
          border-radius: 50%;
        }

        .action-dropdown {
          position: fixed;
          background: #fdfbf5;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          border: 1px solid #e3d7b0;
          z-index: 1000;
          min-width: 170px;
          padding: 6px;
          display: flex;
          flex-direction: column;
          animation: slideIn 0.2s ease;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .action-dropdown button {
          background: none;
          border: none;
          padding: 10px 14px;
          text-align: left;
          font-size: 13px;
          font-weight: 500;
          color: #5c4a1f;
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .action-dropdown button:hover {
          background: #efe6d0;
          color: #4a3c1a;
        }

        .action-dropdown button.text-danger {
          color: #ef4444;
        }

        .action-dropdown button.muted {
          opacity: 0.5;
          cursor: not-allowed;
          background: #f3ecd6;
          filter: grayscale(1);
        }

        .action-dropdown button.text-danger:hover {
           background: #fef2f2;
        }

        .col-number {
          width: 50px;
          color: #8a7a52;
        }

        .col-amount {
          font-weight: 500;
          color: #4a3c1a;
        }

        .client-info {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .client-name {
          font-weight: 500;
        }

        .loan-type-badge {
          background: #efe6d0;
          padding: 4px 10px;
          border-radius: 30px;
          font-size: 12px;
          font-weight: 500;
          color: #7a6a3f;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 30px;
          font-size: 12px;
          font-weight: 500;
        }

        .status-manager-review, .status-gm-review, .status-md-review {
          background: #fef3c7;
          color: #b45309;
        }
        
        .status-approved, .status-disbursed {
           background: #dcfce7;
           color: #166534;
        }
        
        .status-rejected {
           background: #fee2e2;
           color: #991b1b;
        }

        .status-loan-officer {
           background: #ffedd5;
           color: #9a3412;
           border: 1px solid #fed7aa;
        }

        /* MODALS */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          background: white;
          border-radius: 24px;
          padding: 28px;
          width: 500px;
          max-width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        .modal-large {
          width: 800px;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e2e8f0;
        }

        .modal-header h2 {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 28px;
          cursor: pointer;
          color: #94a3b8;
          line-height: 1;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
        }

        .btn-secondary {
          background: #e2e8f0;
          border: none;
          padding: 8px 18px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-secondary:hover {
          background: #cbd5e1;
        }

        .details-section {
          margin-bottom: 24px;
        }

        .details-section h3 {
          font-size: 16px;
          font-weight: 600;
          color: #0f172a;
          margin: 0 0 16px 0;
          padding-bottom: 8px;
          border-bottom: 1px solid #e2e8f0;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }

        .two-columns {
          grid-template-columns: repeat(2, 1fr);
        }

        .detail-item {
          background: #f8fafc;
          padding: 12px;
          border-radius: 12px;
        }

        .detail-item span {
          display: block;
          font-size: 11px;
          color: #64748b;
          margin-bottom: 4px;
        }

        .detail-item strong {
          font-size: 14px;
          color: #0f172a;
          word-break: break-word;
        }

        .rejection-box {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 12px;
          padding: 16px;
          margin-top: 16px;
        }

        .rejection-box h3 {
          font-size: 13px;
          font-weight: 600;
          color: #dc2626;
          margin: 0 0 8px 0;
        }

        .rejection-box p {
          font-size: 13px;
          color: #7f1d1d;
          margin: 0;
        }

        @media (max-width: 768px) {
          .loan-manager-page {
            padding: 70px 16px 16px 16px;
          }
          .stats-row {
            grid-template-columns: 1fr;
            position: relative;
          }
          .two-columns {
            grid-template-columns: 1fr;
          }
          .modal-large {
            width: 95%;
          }
        }
      `}</style>
    </div>
  );
};

export default MyLoans;