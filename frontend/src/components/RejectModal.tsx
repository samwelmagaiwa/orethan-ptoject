import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, RotateCcw } from 'lucide-react';

interface RejectModalProps {
    isOpen: boolean;
    loan: any;
    onConfirm: (reason: string) => void;
    onCancel: () => void;
    submitting: boolean;
    /** Label shown on the confirm button. Defaults to "Return for Corrections" */
    confirmLabel?: string;
    /** Short description shown under the title */
    description?: string;
}

const RejectModal: React.FC<RejectModalProps> = ({
    isOpen,
    loan,
    onConfirm,
    onCancel,
    submitting,
    confirmLabel = 'Return for Corrections',
    description,
}) => {
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (isOpen) setReason('');
    }, [isOpen, loan?.id]);

    if (!isOpen) return null;

    const canSubmit = reason.trim().length >= 3;

    return (
        <div className="rm-overlay" onClick={onCancel}>
            <div className="rm-card" onClick={(e) => e.stopPropagation()}>

                {/* ── Header band ── */}
                <div className="rm-header-band">
                    <button className="rm-close-btn" onClick={onCancel} disabled={submitting}>
                        <X size={18} strokeWidth={2.5} />
                    </button>
                    <div className="rm-icon-ring">
                        <AlertTriangle size={28} strokeWidth={2.5} />
                    </div>
                    <h2 className="rm-title">Reject Loan Application</h2>
                    <p className="rm-subtitle">
                        {description ?? 'Provide a clear reason. The application will be returned to the responsible officer for corrections.'}
                    </p>
                </div>

                {/* ── Loan summary pills ── */}
                <div className="rm-loan-pills">
                    <div className="rm-pill">
                        <span className="rm-pill-label">Client</span>
                        <span className="rm-pill-value">{loan?.name}</span>
                    </div>
                    <div className="rm-pill">
                        <span className="rm-pill-label">Amount</span>
                        <span className="rm-pill-value rm-pill-amount">
                            TZS {Number(loan?.amount || 0).toLocaleString()}
                        </span>
                    </div>
                    <div className="rm-pill">
                        <span className="rm-pill-label">Loan ID</span>
                        <span className="rm-pill-value rm-pill-id">
                            #{String(loan?.id ?? '').padStart(5, '0')}
                        </span>
                    </div>
                </div>

                {/* ── Reason textarea ── */}
                <div className="rm-textarea-wrap">
                    <label className="rm-textarea-label">Reason for Rejection</label>
                    <textarea
                        className="rm-textarea"
                        placeholder="Provide clear reasons for rejection — e.g. missing documents, insufficient collateral, credit history issues..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={4}
                        autoFocus
                    />
                    <div className={`rm-char-hint ${reason.trim().length < 3 && reason.length > 0 ? 'rm-char-hint--warn' : ''}`}>
                        {reason.trim().length < 3 ? 'Minimum 3 characters required' : `${reason.length} characters`}
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="rm-footer">
                    <button className="rm-btn-cancel" onClick={onCancel} disabled={submitting}>
                        <X size={15} strokeWidth={2.5} />
                        Cancel
                    </button>
                    <button
                        className="rm-btn-confirm"
                        onClick={() => onConfirm(reason)}
                        disabled={submitting || !canSubmit}
                        style={{ opacity: submitting || !canSubmit ? 0.6 : 1 }}
                    >
                        <RotateCcw size={15} strokeWidth={2.5} />
                        {submitting ? 'Processing…' : confirmLabel}
                    </button>
                </div>
            </div>

            <style>{`
                .rm-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(15, 23, 42, 0.72);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10002;
                    padding: 20px;
                }

                .rm-card {
                    background: #fff;
                    width: 100%;
                    max-width: 500px;
                    border-radius: 24px;
                    overflow: hidden;
                    box-shadow: 0 30px 70px -15px rgba(185, 28, 28, 0.25),
                                0 0 0 1px rgba(185, 28, 28, 0.06);
                    animation: rmPop 0.38s cubic-bezier(0.34, 1.56, 0.64, 1);
                    position: relative;
                }

                @keyframes rmPop {
                    from { opacity: 0; transform: scale(0.65) translateY(30px); }
                    to   { opacity: 1; transform: scale(1)   translateY(0); }
                }

                /* ── Header band ── */
                .rm-header-band {
                    background: linear-gradient(135deg, #7f1d1d 0%, #b91c1c 60%, #dc2626 100%);
                    padding: 32px 28px 28px;
                    text-align: center;
                    position: relative;
                }

                .rm-close-btn {
                    position: absolute;
                    top: 14px;
                    right: 14px;
                    background: rgba(255,255,255,0.15);
                    border: none;
                    border-radius: 8px;
                    color: #fecaca;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .rm-close-btn:hover:not(:disabled) { background: rgba(255,255,255,0.25); }

                .rm-icon-ring {
                    width: 64px;
                    height: 64px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.15);
                    border: 2px solid rgba(255,255,255,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #fff;
                    margin: 0 auto 14px;
                    box-shadow: 0 0 0 8px rgba(255,255,255,0.06);
                    animation: rmIconPulse 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
                }

                @keyframes rmIconPulse {
                    from { transform: scale(0.3); opacity: 0; }
                    to   { transform: scale(1);   opacity: 1; }
                }

                .rm-title {
                    color: #fff;
                    font-size: 20px;
                    font-weight: 800;
                    margin: 0 0 6px;
                    letter-spacing: -0.01em;
                }

                .rm-subtitle {
                    color: #fecaca;
                    font-size: 13px;
                    line-height: 1.55;
                    margin: 0;
                }

                /* ── Pills ── */
                .rm-loan-pills {
                    display: flex;
                    gap: 8px;
                    padding: 16px 20px 0;
                    flex-wrap: wrap;
                }

                .rm-pill {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    background: #fef2f2;
                    border: 1px solid #fecaca;
                    border-radius: 10px;
                    padding: 8px 12px;
                    flex: 1;
                    min-width: 0;
                }

                .rm-pill-label {
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    color: #b91c1c;
                }

                .rm-pill-value {
                    font-size: 13.5px;
                    font-weight: 700;
                    color: #1e293b;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .rm-pill-amount { color: #b91c1c; }
                .rm-pill-id { font-family: 'SF Mono', 'Consolas', monospace; color: #64748b; }

                /* ── Textarea ── */
                .rm-textarea-wrap {
                    padding: 16px 20px 4px;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .rm-textarea-label {
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    color: #64748b;
                }

                .rm-textarea {
                    width: 100%;
                    border: 2px solid #fecaca;
                    border-radius: 12px;
                    padding: 12px 14px;
                    font-size: 14px;
                    color: #1e293b;
                    font-family: inherit;
                    outline: none;
                    resize: none;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    background: #fff;
                    box-sizing: border-box;
                }

                .rm-textarea:focus {
                    border-color: #dc2626;
                    box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.1);
                }

                .rm-char-hint {
                    font-size: 11px;
                    color: #94a3b8;
                    text-align: right;
                }
                .rm-char-hint--warn { color: #ef4444; }

                /* ── Footer ── */
                .rm-footer {
                    display: flex;
                    gap: 10px;
                    padding: 14px 20px 22px;
                }

                .rm-btn-cancel, .rm-btn-confirm {
                    flex: 1;
                    padding: 12px;
                    border-radius: 12px;
                    font-weight: 700;
                    font-size: 14px;
                    cursor: pointer;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 7px;
                    transition: all 0.22s ease;
                }

                .rm-btn-cancel {
                    background: #f1f5f9;
                    color: #475569;
                    border: 1.5px solid #e2e8f0;
                }
                .rm-btn-cancel:hover:not(:disabled) {
                    background: #e2e8f0;
                    transform: translateY(-1px);
                }

                .rm-btn-confirm {
                    background: linear-gradient(135deg, #b91c1c 0%, #dc2626 100%);
                    color: white;
                    box-shadow: 0 8px 18px -6px rgba(185, 28, 28, 0.45);
                }
                .rm-btn-confirm:hover:not(:disabled) {
                    background: linear-gradient(135deg, #991b1b 0%, #b91c1c 100%);
                    transform: translateY(-2px);
                    box-shadow: 0 12px 24px -6px rgba(185, 28, 28, 0.5);
                }
                .rm-btn-confirm:active:not(:disabled) { transform: translateY(0); }
                .rm-btn-confirm:disabled { cursor: not-allowed; }
                .rm-btn-cancel:disabled { opacity: 0.6; cursor: not-allowed; }
            `}</style>
        </div>
    );
};

export default RejectModal;
