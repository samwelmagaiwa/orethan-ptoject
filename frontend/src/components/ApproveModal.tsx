import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, X, Check } from 'lucide-react';
import { fmtLoanId } from '../lib/api';

interface ApproveModalProps {
    isOpen: boolean;
    loan: any;
    onConfirm: (comments: string) => void;
    onCancel: () => void;
    submitting: boolean;
}

const RedDash = () => <span style={{ color: '#ef4444', fontWeight: 'bold' }}>-</span>;

const renderVal = (val: any) => {
    if (val === undefined || val === null || val === "" || val === "N/A" || val === "-") return <RedDash />;
    return val;
};

const ApproveModal: React.FC<ApproveModalProps> = ({
    isOpen,
    loan,
    onConfirm,
    onCancel,
    submitting
}) => {
    const { t } = useTranslation('loanModals');
    const [step, setStep] = useState<'history' | 'confirm' | 'comment'>('history');
    const [comments, setComments] = useState("");

    // Reset step and comments every time the modal opens for a fresh loan
    useEffect(() => {
        if (isOpen) {
            setStep('history');
            setComments('');
        }
    }, [isOpen, loan?.id]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (comments.trim().length < 3) return;
        onConfirm(comments);
    };

    return (
        <div className="approve-overlay-premium" onClick={onCancel}>
            <div className="approve-card-premium animate-pop-premium" onClick={(e) => e.stopPropagation()}>
                <div className="approve-details-table-wrapper">
                    <div className="approve-details-header-band">
                        <span className="approve-details-badge">
                            <ShieldCheck size={15} strokeWidth={2.5} />
                        </span>
                        <span>{t('approve.table.title')}</span>
                    </div>
                    <table className="approve-details-table">
                        <thead>
                            <tr>
                                <th>{t('approve.table.loanId')}</th>
                                <th>{t('approve.table.applicant')}</th>
                                <th>{t('approve.table.customerPhone')}</th>
                                <th>{t('approve.table.loanOfficer')}</th>
                                <th>{t('approve.table.loanAmount')}</th>
                                <th>{t('approve.table.loanType')}</th>
                                <th>{t('approve.table.currentStatus')}</th>
                                <th>{t('approve.table.loanDuration')}</th>
                                <th>{t('approve.table.expectedRepayment')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="cell-id">#{loan?.id ? fmtLoanId(loan.id) : '—'}</td>
                                <td className="cell-name">{loan?.name}</td>
                                <td>{loan?.phone}</td>
                                <td style={{ fontWeight: 600, color: '#2b2d42' }}>{renderVal(loan?.user?.name)}</td>
                                <td className="cell-amount">
                                    TZS {Number(loan?.amount || 0).toLocaleString()}
                                    {loan?.details?.adjusted_by && (
                                        <div style={{ fontSize:'10px', color:'#b45309', fontWeight:700, marginTop:'2px', display:'flex', alignItems:'center', gap:'3px' }}>
                                            <span>📐</span>
                                            <span style={{ background:'#fef3c7', border:'1px solid #fcd34d', borderRadius:'8px', padding:'0 5px' }}>Adjusted by {loan.details.adjusted_by}</span>
                                        </div>
                                    )}
                                </td>
                                <td style={{ textTransform: 'capitalize' }}>{renderVal(loan?.type)}</td>
                                <td>
                                    <span className={`status-pill status-${loan?.status?.replace('_', '-')}`}>
                                        {loan?.status?.replace(/_/g, ' ').toUpperCase() || t('approve.table.defaultStatus')}
                                    </span>
                                </td>
                                <td>{renderVal(loan?.details?.kwaTarakimu)} {loan?.details?.kwaTarakimu ? t('approve.table.months') : ""}</td>
                                <td className="extra-highlight">
                                    {loan?.details?.kiasiRejeshoBilaMatatizo || loan?.details?.kiasiGaniChaRejesho
                                        ? `TZS ${Number(loan.details.kiasiRejeshoBilaMatatizo || loan.details.kiasiGaniChaRejesho).toLocaleString()}`
                                        : <RedDash />}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="approve-header-premium" style={{ marginBottom: '20px' }}>
                    {step === 'history' ? (
                        <div className="history-header-row">
                            <h2>{t('approve.header.approvalStatusTitle')}</h2>
                            <div className="inline-stepper-row">
                                {[
                                    { label: t('approve.stepper.officerLabel'), role: t('approve.stepper.officerRole'), status: 'loan_officer' },
                                    { label: t('approve.stepper.lmLabel'), role: t('approve.stepper.lmRole'), status: 'manager_review' },
                                    { label: t('approve.stepper.gmLabel'), role: t('approve.stepper.gmRole'), status: 'gm_review' },
                                    { label: t('approve.stepper.mdLabel'), role: t('approve.stepper.mdRole'), status: 'md_review' },
                                    { label: t('approve.stepper.finalLabel'), role: t('approve.stepper.finalRole'), status: 'approved' }
                                ].map((s, i) => {
                                    const stepOrder = ['loan_officer', 'manager_review', 'gm_review', 'md_review', 'approved'];
                                    const currentIdx = stepOrder.indexOf(loan?.status);
                                    const isCompleted = i < currentIdx;
                                    const isActive = i === currentIdx;
                                    const isReturned = loan?.status === 'loan_officer' && loan?.rejection_metadata;
                                    return (
                                        <div key={i} className="inline-step-group">
                                            <div className={`inline-step-pill ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''} ${isActive && isReturned ? 'returned' : ''}`} title={s.role}>
                                                <span className="inline-step-circle">{isCompleted ? t('approve.stepper.completed') : i + 1}</span>
                                                <span className="inline-step-label">{s.label}</span>
                                            </div>
                                            {i < 4 && <span className="inline-step-connector" />}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <h2>{step === 'confirm' ? t('approve.header.approveLoanTitle') : t('approve.header.addCommentTitle')}</h2>
                    )}
                    {step !== 'history' && (
                        <p>
                            {step === 'confirm' ? t('approve.header.confirmQuestion') :
                                t('approve.header.commentPrompt')}
                        </p>
                    )}
                </div>

                {step === 'history' ? (
                    <div className="approval-history-container">
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
                                                        {isFirst ? t('approve.history.first') : isLast ? t('approve.history.now') : index + 1}
                                                    </div>
                                                    <div className={`history-item-premium ${approval.status === 'rejected' ? 'rejected' : 'approved'}`}>
                                                        <span className="h-role-badge">{approval.user.role.replace(/_/g, ' ').toUpperCase()}</span>
                                                        <span className="h-user">{approval.user.name}</span>
                                                        <span className={`h-action-pill ${approval.status}`}>
                                                            {approval.status === 'rejected' ? t('approve.history.rejected') : t('approve.history.recommended')}
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
                            return (
                                <div className="no-history-msg">
                                    {t('approve.history.noHistory')}
                                </div>
                            );
                        })()}
                    </div>
                ) : step === 'confirm' ? (
                    <div className="confirm-step-body">
                        <div className="confirm-step-icon">
                            <ShieldCheck size={32} strokeWidth={2} />
                        </div>
                        <p className="confirm-step-note">
                            {t('approve.confirmStep.note')}
                        </p>
                    </div>
                ) : (
                    <textarea
                        placeholder={t('approve.textarea.placeholder')}
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        rows={4}
                        className="approve-textarea-premium"
                        autoFocus
                    />
                )}

                <div className="approve-footer-premium">
                    <button className="approve-btn-cancel" onClick={onCancel} disabled={submitting}>
                        <X size={16} strokeWidth={2.5} />
                        {step === 'confirm' ? t('approve.actions.noCancel') : t('approve.actions.cancel')}
                    </button>
                    {step === 'history' ? (
                        <button
                            className="approve-btn-confirm"
                            onClick={() => setStep('confirm')}
                        >
                            {t('approve.actions.continue')}
                        </button>
                    ) : step === 'confirm' ? (
                        <button
                            className="approve-btn-confirm"
                            onClick={() => setStep('comment')}
                        >
                            <Check size={16} strokeWidth={2.5} />
                            {t('approve.actions.yesContinue')}
                        </button>
                    ) : (
                        <button
                            className="approve-btn-confirm"
                            onClick={handleConfirm}
                            disabled={submitting || comments.trim().length < 3}
                            style={{ opacity: (submitting || comments.trim().length < 3) ? 0.6 : 1 }}
                        >
                            {submitting ? t('approve.actions.submitting') : t('approve.actions.completeApproval')}
                        </button>
                    )}
                </div>
            </div>

            <style>{`
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

                .approve-overlay-premium {
                    position: fixed;
                    inset: 0;
                    background: rgba(15, 23, 42, 0.7);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10001;
                    padding: 20px;
                }

                .approve-card-premium {
                    background: #ffffff;
                    width: 100%;
                    max-width: 1600px;
                    max-height: 90vh;
                    overflow-y: auto;
                    border-radius: 28px;
                    padding: 40px 50px;
                    box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(15, 23, 42, 0.04);
                    animation: popUpPremium 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                    position: relative;
                }

                .approve-header-premium {
                    text-align: center;
                    margin-bottom: 28px;
                }

                .approve-details-table-wrapper {
                    background: #ffffff;
                    border-radius: 20px;
                    margin-bottom: 32px;
                    border: 1px solid #e2e8f0;
                    overflow: hidden;
                    box-shadow: 0 10px 25px -8px rgba(15, 23, 42, 0.08);
                }

                .approve-details-header-band {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 14px 22px;
                    background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
                    color: #e0e7ff;
                    font-size: 13px;
                    font-weight: 700;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                }

                .approve-details-badge {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.15);
                    color: #93c5fd;
                    flex-shrink: 0;
                }

                .approve-details-table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: left;
                }

                .approve-details-table th {
                    background: #f8fafc;
                    padding: 16px 20px;
                    color: #64748b;
                    font-size: 12px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    border-bottom: 1px solid #e2e8f0;
                }

                .approve-details-table td {
                    padding: 18px 20px;
                    color: #0f172a;
                    font-size: 15px;
                    font-weight: 500;
                    border-bottom: 1px solid #f1f5f9;
                    transition: background 0.2s;
                }

                .approve-details-table tbody tr:hover td {
                    background: #f8fafc;
                }

                .approve-details-table tr:last-child td {
                    border-bottom: none;
                }

                .approve-details-table th:not(:last-child),
                .approve-details-table td:not(:last-child) {
                    border-right: 1px solid #f1f5f9;
                }

                .cell-id {
                    font-weight: 800;
                    color: #1e3a8a;
                    font-family: 'SF Mono', 'Consolas', monospace;
                }

                .cell-name {
                    font-weight: 700;
                    color: #0f172a;
                }

                .cell-amount {
                    font-weight: 800;
                    color: #0f172a;
                    font-size: 15.5px;
                }

                .approve-header-premium h2 {
                    margin: 10px 0 5px 0;
                    color: #0f172a;
                    font-size: 26px;
                    font-weight: 800;
                    letter-spacing: -0.01em;
                }

                .approve-header-premium p {
                    color: #64748b;
                    font-size: 15px;
                    line-height: 1.5;
                    margin: 0;
                }

                .confirm-step-body {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 16px;
                    padding: 32px 0 8px;
                }

                .confirm-step-icon {
                    width: 64px;
                    height: 64px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
                    color: #16a34a;
                    box-shadow: 0 8px 20px -6px rgba(22, 163, 74, 0.35), inset 0 0 0 1px rgba(22, 163, 74, 0.15);
                    animation: confirmIconPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
                }

                @keyframes confirmIconPop {
                    from { opacity: 0; transform: scale(0.4); }
                    to { opacity: 1; transform: scale(1); }
                }

                .confirm-step-note {
                    color: #475569;
                    font-size: 15.5px;
                    text-align: center;
                    max-width: 420px;
                    line-height: 1.6;
                    margin: 0;
                }

                .timeline-container-premium {
                    position: relative;
                    margin-top: 10px;
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
                    padding: 16px 14px 8px;
                    border: 1px solid #e2e8f0;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.04);
                    position: relative;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    overflow: visible;
                    width: 100%;
                    margin-top: 12px;
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
                    position: absolute;
                    top: -11px;
                    left: 12px;
                    padding: 2px 10px;
                    border-radius: 10px;
                    font-size: 9px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    white-space: nowrap;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.10);
                    z-index: 2;
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

                .history-item-premium.approved .h-role-badge { background: #ecfdf5; color: #059669; border: 1px solid #d1fae5; }
                .history-item-premium.rejected .h-role-badge { background: #fef2f2; color: #dc2626; border: 1px solid #fee2e2; }
                .history-item-premium.rejected .h-comment-text {
                    color: #ef4444 !important;
                    font-weight: 600;
                }

                .extra-highlight {
                    color: #1d4ed8 !important;
                    font-size: 17px !important;
                }

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

                .approve-textarea-premium {
                    width: 100%;
                    border: 2px solid #e2e8f0;
                    border-radius: 16px;
                    padding: 16px;
                    font-size: 15px;
                    color: #1e293b;
                    outline: none;
                    resize: none;
                    transition: all 0.3s;
                    margin-bottom: 30px;
                    font-family: inherit;
                }

                .approve-textarea-premium:focus {
                    border-color: #16a34a;
                    box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.1);
                    background: #fff;
                }

                .approve-footer-premium {
                    display: flex;
                    gap: 16px;
                    margin-top: 8px;
                }

                .approve-btn-cancel, .approve-btn-confirm {
                    flex: 1;
                    padding: 14px;
                    border-radius: 16px;
                    font-weight: 700;
                    font-size: 15px;
                    cursor: pointer;
                    transition: all 0.25s ease;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }

                .approve-btn-cancel {
                    background: #f1f5f9;
                    color: #475569;
                    border: 1.5px solid #e2e8f0;
                }

                .approve-btn-cancel:hover:not(:disabled) {
                    background: #e2e8f0;
                    border-color: #cbd5e1;
                    transform: translateY(-1px);
                }

                .approve-btn-cancel:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .approve-btn-confirm {
                    background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
                    color: white;
                    box-shadow: 0 10px 20px -6px rgba(22, 163, 74, 0.4);
                }

                .approve-btn-confirm:hover:not(:disabled) {
                    background: linear-gradient(135deg, #15803d 0%, #14532d 100%);
                    transform: translateY(-2px);
                    box-shadow: 0 15px 28px -6px rgba(22, 163, 74, 0.45);
                }

                .approve-btn-confirm:active:not(:disabled) {
                    transform: translateY(0);
                }

                .approve-btn-confirm:disabled {
                    cursor: not-allowed;
                }

                @keyframes popUpPremium {
                    from { opacity: 0; transform: scale(0.6) translateY(40px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }

                .approval-history-container {
                    background: #ffffff;
                    border: 2px solid #f1f5f9;
                    border-radius: 24px;
                    padding: 20px;
                    margin-bottom: 24px;
                    box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05);
                }

                .approval-history-list-compact {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                    position: relative;
                }

                .history-item-compact {
                    position: relative;
                    padding-left: 16px;
                }

                .history-item-compact::before {
                    display: none;
                }

                .history-item-compact:last-child::before {
                    display: none;
                }

                .history-meta {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 6px;
                    flex-wrap: wrap;
                }

                .h-role {
                    font-size: 9px;
                    font-weight: 800;
                    color: #2563eb;
                    background: #eff6ff;
                    padding: 2px 8px;
                    border-radius: 6px;
                    letter-spacing: 0.3px;
                    border: 1px solid #dbeafe;
                }

                .h-user {
                    font-size: 13px;
                    font-weight: 700;
                    color: #0f172a;
                }

                .h-date {
                    font-size: 11px;
                    color: #64748b;
                    margin-left: auto;
                }

                .h-comment {
                    font-size: 13px;
                    color: #334155;
                    line-height: 1.5;
                    padding: 12px;
                    background: #f8fafc;
                    border-radius: 12px;
                    border: 1px solid #f1f5f9;
                }

                .history-item-compact.approved .h-role { background: #ecfdf5; color: #059669; border-color: #d1fae5; }
                .history-item-compact.rejected .h-role { background: #fef2f2; color: #dc2626; border-color: #fee2e2; }

                .h-divider {
                    display: none;
                }

                .no-history-msg {
                    text-align: center;
                    padding: 40px;
                    color: #94a3b8;
                    font-size: 14px;
                }
            `}</style>
        </div>
    );
};

export default ApproveModal;
