import React from 'react';
import { useTranslation } from 'react-i18next';

interface HistoryModalProps {
    isOpen: boolean;
    loan: any;
    onClose: () => void;
}

const RedDash = () => <span style={{ color: '#ef4444', fontWeight: 'bold' }}>-</span>;

const renderVal = (val: any) => {
    if (val === undefined || val === null || val === "" || val === "N/A" || val === "-") return <RedDash />;
    return val;
};

const HistoryModal: React.FC<HistoryModalProps> = ({
    isOpen,
    loan,
    onClose
}) => {
    const { t } = useTranslation("historyModals");
    if (!isOpen) return null;

    return (
        <div className="history-overlay-premium" onClick={onClose}>
            <div className="history-card-premium animate-pop-premium" onClick={(e) => e.stopPropagation()}>
                <div className="history-details-table-wrapper" style={{ marginTop: '-10px' }}>
                    <table className="history-details-table">
                        <thead>
                            <tr>
                                <th>{t("history.table.loanId")}</th>
                                <th>{t("history.table.applicant")}</th>
                                <th>{t("history.table.customerPhone")}</th>
                                <th>{t("history.table.loanOfficer")}</th>
                                <th>{t("history.table.loanAmount")}</th>
                                <th>{t("history.table.loanType")}</th>
                                <th>{t("history.table.currentStatus")}</th>
                                <th>{t("history.table.loanDuration")}</th>
                                <th>{t("history.table.expectedRepayment")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>#{loan?.id}</td>
                                <td>{loan?.name}</td>
                                <td>{loan?.phone}</td>
                                <td style={{ fontWeight: 600, color: '#2563eb' }}>{renderVal(loan?.user?.name)}</td>
                                <td>TZS {Number(loan?.amount || 0).toLocaleString()}</td>
                                <td style={{ textTransform: 'capitalize' }}>{renderVal(loan?.type)}</td>
                                <td>
                                    <span className={`status-pill status-${loan?.status?.replace('_', '-')}`}>
                                        {loan?.status?.replace(/_/g, ' ').toUpperCase() || t("history.status.pending")}
                                    </span>
                                </td>
                                <td>{renderVal(loan?.details?.kwaTarakimu)} {loan?.details?.kwaTarakimu ? t("history.units.months") : ""}</td>
                                <td className="extra-highlight">
                                    {loan?.details?.kiasiRejeshoBilaMatatizo || loan?.details?.kiasiGaniChaRejesho
                                        ? `TZS ${Number(loan.details.kiasiRejeshoBilaMatatizo || loan.details.kiasiGaniChaRejesho).toLocaleString()}`
                                        : <RedDash />}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="history-header-premium" style={{ marginBottom: '20px' }}>
                    <div className="history-header-row">
                        <h2>{t("history.heading.approvalStatus")}</h2>
                        <div className="inline-stepper-row">
                            {[
                                { label: t("history.steps.officer"), role: t("history.roles.loanOfficer"), status: 'loan_officer' },
                                { label: t("history.steps.lm"), role: t("history.roles.loanManager"), status: 'manager_review' },
                                { label: t("history.steps.gm"), role: t("history.roles.generalManager"), status: 'gm_review' },
                                { label: t("history.steps.md"), role: t("history.roles.managingDirector"), status: 'md_review' },
                                { label: t("history.steps.final"), role: t("history.roles.completed"), status: 'approved' }
                            ].map((s, i) => {
                                const stepOrder = ['loan_officer', 'manager_review', 'gm_review', 'md_review', 'approved'];
                                const currentIdx = stepOrder.indexOf(loan?.status);
                                const isCompleted = i < currentIdx;
                                const isActive = i === currentIdx;
                                const isReturned = loan?.status === 'loan_officer' && loan?.rejection_metadata;
                                return (
                                    <div key={i} className="inline-step-group">
                                        <div className={`inline-step-pill ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''} ${isActive && isReturned ? 'returned' : ''}`} title={s.role}>
                                            <span className="inline-step-circle">{isCompleted ? t("history.steps.completedMark") : i + 1}</span>
                                            <span className="inline-step-label">{s.label}</span>
                                        </div>
                                        {i < 4 && <span className="inline-step-connector" />}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="approval-history-container-premium">
                    {(() => {
                        const filtered = loan?.approvals?.filter((a: any) =>
                            a.comments &&
                            !a.comments.includes("Approved from") &&
                            !a.comments.includes("Rejected from")
                        ).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) || [];

                        if (filtered.length > 0) {
                            return (
                                <div className="timeline-container-premium">
                                    <div className="timeline-line-premium"></div>
                                    {filtered.map((approval: any, index: number) => {
                                        const isFirst = index === 0;
                                        const isLast = index === filtered.length - 1;
                                        return (
                                            <div key={approval.id} className={`timeline-item-premium ${isFirst ? 'first-step' : ''} ${isLast ? 'last-step' : ''}`}>
                                                <div className="timeline-marker-premium">
                                                    {isFirst ? t("history.timeline.first") : isLast ? t("history.timeline.now") : index + 1}
                                                </div>
                                                <div className={`history-item-premium ${approval.status === 'rejected' ? 'rejected' : 'approved'}`}>
                                                    <span className="h-role-badge">{approval.user.role.replace(/_/g, ' ').toUpperCase()}</span>
                                                    <span className="h-user">{approval.user.name}</span>
                                                    <span className={`h-action-pill ${approval.status}`}>
                                                        {approval.status === 'rejected' ? t("history.timeline.rejected") : t("history.timeline.recommended")}
                                                    </span>
                                                    <span className="h-comment-text">"{approval.comments}"</span>
                                                    <span className="h-date">{new Date(approval.created_at).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        }
                        return <div className="no-history-msg-premium">{t("history.empty.noHistory")}</div>;
                    })()}
                </div>

                <div className="history-footer-premium">
                    <button className="history-btn-close" onClick={onClose}>
                        {t("history.actions.close")}
                    </button>
                </div>
            </div>

            <style>{`
                .history-overlay-premium {
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

                /* INLINE HEADER ROW: title + stepper */
                .history-header-row {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 24px;
                    flex-wrap: wrap;
                }

                .history-header-row h2 {
                    margin: 0;
                    white-space: nowrap;
                }

                .inline-stepper-row {
                    display: flex;
                    align-items: center;
                    gap: 3px;
                }

                .inline-step-group {
                    display: flex;
                    align-items: center;
                    gap: 3px;
                }

                .inline-step-pill {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    padding: 3px 8px;
                    border-radius: 20px;
                    border: 1.5px solid #e2e8f0;
                    background: white;
                    font-size: 10px;
                    font-weight: 700;
                    color: #94a3b8;
                    white-space: nowrap;
                }

                .inline-step-circle {
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #f1f5f9;
                    border: 1.5px solid #e2e8f0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 9px;
                    font-weight: 800;
                    flex-shrink: 0;
                }

                .inline-step-label {
                    font-size: 10px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                }

                .inline-step-connector {
                    display: inline-block;
                    width: 16px;
                    height: 2px;
                    background: #e2e8f0;
                    flex-shrink: 0;
                }

                .inline-step-pill.completed {
                    border-color: #16a34a;
                    background: #f0fdf4;
                    color: #16a34a;
                }
                .inline-step-pill.completed .inline-step-circle {
                    background: #16a34a;
                    border-color: #16a34a;
                    color: white;
                }

                .inline-step-pill.active {
                    border-color: #f59e0b;
                    background: #fffbeb;
                    color: #b45309;
                }
                .inline-step-pill.active .inline-step-circle {
                    border-color: #f59e0b;
                    background: #fffbeb;
                    color: #b45309;
                }

                .inline-step-pill.returned.active {
                    border-color: #ef4444;
                    background: #fff5f5;
                    color: #ef4444;
                }
                .inline-step-pill.returned.active .inline-step-circle {
                    border-color: #ef4444;
                    background: #fff5f5;
                    color: #ef4444;
                }

                .history-card-premium {
                    background: #ffffff;
                    width: 100%;
                    max-width: 1600px;
                    max-height: 90vh;
                    overflow-y: auto;
                    border-radius: 28px;
                    padding: 40px 50px;
                    box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.3);
                    animation: popUpPremium 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                    position: relative;
                }

                .timeline-container-premium {
                    position: relative;
                    margin-top: 6px;
                    display: flex;
                    flex-direction: column;
                    gap: 0;
                }

                .timeline-line-premium {
                    position: absolute;
                    left: 50%;
                    transform: translateX(-50%);
                    top: 0;
                    bottom: 0;
                    width: 4px;
                    background: #e2e8f0;
                    border-radius: 2px;
                }

                .timeline-item-premium {
                    position: relative;
                    width: 50%;
                    margin-bottom: -15px;
                }

                .timeline-item-premium:nth-child(odd) {
                    align-self: flex-start;
                    padding-right: 60px;
                }

                .timeline-item-premium:nth-child(even) {
                    align-self: flex-end;
                    padding-left: 60px;
                }

                .timeline-marker-premium {
                    position: absolute;
                    top: 10px;
                    width: 80px;
                    height: 32px;
                    background: #f1f5f9;
                    border: 2px solid #e2e8f0;
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 11px;
                    font-weight: 800;
                    color: #64748b;
                    z-index: 5;
                }

                .timeline-item-premium:nth-child(odd) .timeline-marker-premium {
                    right: -40px;
                }

                .timeline-item-premium:nth-child(even) .timeline-marker-premium {
                    left: -40px;
                }

                .timeline-item-premium.first-step .timeline-marker-premium {
                    background: #ecfdf5;
                    border-color: #10b981;
                    color: #047857;
                    box-shadow: 0 0 15px rgba(16, 185, 129, 0.2);
                }

                .timeline-item-premium.last-step .timeline-marker-premium {
                    background: #eff6ff;
                    border-color: #3b82f6;
                    color: #1d4ed8;
                    box-shadow: 0 0 15px rgba(59, 130, 246, 0.2);
                }

                /* Connecting branches */
                .timeline-item-premium::before {
                    content: '';
                    position: absolute;
                    top: 26px;
                    width: 40px;
                    height: 2px;
                    background: #e2e8f0;
                }

                .timeline-item-premium:nth-child(odd)::before {
                    right: 40px;
                }

                .timeline-item-premium:nth-child(even)::before {
                    left: 40px;
                }

                .history-card-wrapper {
                    display: flex;
                    flex-direction: column;
                    gap: 1px;
                    flex: 1;
                    min-width: 0;
                }

                .history-item-premium {
                    background: #ffffff;
                    border-radius: 12px;
                    padding: 8px 14px;
                    border: 1px solid #e2e8f0;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.04);
                    position: relative;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    overflow: hidden;
                    width: 100%;
                }

                .history-item-premium:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 12px 25px rgba(0, 0, 0, 0.08);
                    z-index: 10;
                }

                .h-user {
                    font-weight: 700;
                    color: #1e293b;
                    font-size: 14px;
                    min-width: fit-content;
                }

                .h-comment-text {
                    color: #64748b;
                    font-size: 14px;
                    flex: 1;
                    min-width: 0;
                    white-space: nowrap;
                    overflow-x: auto;
                    scrollbar-width: thin;
                    scrollbar-color: #e2e8f0 transparent;
                }

                .h-date-outside {
                    font-size: 10px;
                    color: #94a3b8;
                    font-weight: 600;
                    text-align: right;
                    padding-right: 2px;
                    white-space: nowrap;
                }

                .h-date {
                    font-size: 11px;
                    color: #94a3b8;
                    margin-left: auto;
                    font-weight: 600;
                    flex-shrink: 0;
                    padding-left: 10px;
                }

                .h-role-badge {
                    padding: 4px 8px;
                    border-radius: 6px;
                    font-size: 10px;
                    font-weight: 700;
                    background: #f1f5f9;
                    color: #64748b;
                }

                .h-action-pill {
                    padding: 3px 10px;
                    border-radius: 10px;
                    font-size: 9px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    min-width: fit-content;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
                }

                /* Dynamic Status Colors for Action Pills */
                .h-action-pill.approved,
                .h-action-pill.gm_review, 
                .h-action-pill.md_review,
                .h-action-pill.manager_review {
                    background: #dbeafe;
                    color: #1e40af;
                    border: 1px solid #93c5fd;
                    box-shadow: 0 2px 6px rgba(37, 99, 235, 0.08);
                }

                .h-action-pill.rejected {
                    background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
                    color: #9f1239;
                    border: 1px solid #f43f5e30;
                }

                .last-step .history-item-premium {
                    border: 2px solid #3b82f6;
                    background: #f8fbff;
                }

                .first-step .history-item-premium {
                    border: 2px solid #10b981;
                }

                .history-details-table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: left;
                }

                .history-details-table th {
                    background: #f8fafc;
                    padding: 16px 20px;
                    color: #64748b;
                    font-size: 13px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.025em;
                    border-bottom: 1px solid #e2e8f0;
                }

                .history-details-table td {
                    padding: 16px 20px;
                    color: #0f172a;
                    font-size: 15px;
                    font-weight: 500;
                    border-bottom: 1px solid #f1f5f9;
                }

                .history-details-table tr:last-child td {
                    border-bottom: none;
                }

                .history-details-table th:not(:last-child),
                .history-details-table td:not(:last-child) {
                    border-right: 1px solid #f1f5f9;
                }

                .history-icon-box {
                    width: 70px;
                    height: 70px;
                    background: #eff6ff;
                    color: #2563eb;
                    border-radius: 20px;
                    margin: 0 auto 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.1);
                }

                .history-header-premium h2 {
                    margin: 10px 0 5px 0;
                    color: #0f172a;
                    font-size: 24px;
                    font-weight: 800;
                }

                .history-header-premium p {
                    color: #64748b;
                    font-size: 15px;
                    line-height: 1.5;
                    margin: 0;
                }

                .history-details-grid {
                    display: grid;
                    grid-template-columns: repeat(9, 1fr);
                    gap: 12px;
                    background: #f8fafc;
                    border-radius: 20px;
                    padding: 20px 24px;
                    margin-bottom: 24px;
                    border: 1px solid #e2e8f0;
                }

                .extra-highlight {
                    color: #1d4ed8 !important;
                    font-size: 17px !important;
                }

                .detail-item {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .detail-label {
                    font-size: 11px;
                    text-transform: uppercase;
                    color: #94a3b8;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                }

                .detail-value {
                    font-size: 15px;
                    color: #1e293b;
                    font-weight: 700;
                }

                .status-pill {
                    font-size: 11px;
                    font-weight: 800;
                    padding: 4px 10px;
                    border-radius: 6px;
                    background: #e2e8f0;
                    color: #475569;
                }

                .status-approved, .status-disbursed { background: #dcfce7; color: #166534; }
                .status-manager-review, .status-gm-review, .status-md-review { background: #fef3c7; color: #92400e; }

                .approval-history-container-premium {
                    background: #ffffff;
                    border: 2px solid #f1f5f9;
                    border-radius: 24px;
                    padding: 24px;
                    margin-bottom: 30px;
                    box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05);
                }

                .approval-history-list-premium {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    position: relative;
                }

                .history-item-premium {
                    position: relative;
                    padding-left: 20px;
                }

                .history-item-premium::before {
                    display: none;
                }

                .history-item-premium:last-child::before {
                    display: none;
                }

                .history-meta {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 10px;
                    flex-wrap: wrap;
                }

                .h-role-badge {
                    font-size: 10px;
                    font-weight: 800;
                    color: #2563eb;
                    background: #eff6ff;
                    padding: 3px 10px;
                    border-radius: 8px;
                    letter-spacing: 0.5px;
                    border: 1px solid #dbeafe;
                }

                .h-user {
                    font-size: 15px;
                    font-weight: 700;
                    color: #0f172a;
                }

                .h-date {
                    font-size: 12px;
                    color: #64748b;
                    margin-left: auto;
                }

                .h-comment-box {
                    font-size: 14px;
                    color: #334155;
                    line-height: 1.6;
                    padding: 16px;
                    background: #f8fafc;
                    border-radius: 16px;
                    border: 1px solid #f1f5f9;
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
                    position: relative;
                }

                .h-comment-box strong {
                    color: #64748b;
                    font-size: 12px;
                    margin-right: 4px;
                }
                
                .history-item-premium.approved .h-role-badge { background: #ecfdf5; color: #059669; border: 1px solid #d1fae5; }
                .history-item-premium.rejected .h-role-badge { background: #fef2f2; color: #dc2626; border: 1px solid #fee2e2; }
                .history-item-premium.rejected .h-comment-text {
                    color: #ef4444 !important;
                    font-weight: 600;
                }

                .h-divider-line {
                    display: none;
                }

                .no-history-msg-premium {
                    text-align: center;
                    padding: 60px;
                    color: #94a3b8;
                    font-size: 16px;
                    font-weight: 500;
                }

                .history-footer-premium {
                    display: flex;
                }

                .history-btn-close {
                    flex: 1;
                    padding: 18px;
                    border-radius: 20px;
                    font-weight: 700;
                    font-size: 16px;
                    cursor: pointer;
                    transition: all 0.3s;
                    border: none;
                    background: #0f172a;
                    color: white;
                    box-shadow: 0 10px 20px -5px rgba(15, 23, 42, 0.3);
                }

                .history-btn-close:hover {
                    background: #000;
                    transform: translateY(-3px);
                    box-shadow: 0 20px 30px -10px rgba(15, 23, 42, 0.4);
                }

                @keyframes popUpPremium {
                    from { opacity: 0; transform: scale(0.6) translateY(40px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default HistoryModal;
