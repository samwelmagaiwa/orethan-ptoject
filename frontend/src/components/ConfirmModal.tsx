import React from 'react';
import { useTranslation } from 'react-i18next';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText,
    cancelText,
    type = 'info'
}) => {
    const { t } = useTranslation();
    if (!isOpen) return null;

    const getTypeStyles = () => {
        switch (type) {
            case 'danger': return { icon: '🗑️', color: '#ef4444', bgColor: '#fef2f2', btnClass: 'btn-danger-premium' };
            case 'warning': return { icon: '⚠️', color: '#f59e0b', bgColor: '#fffbeb', btnClass: 'btn-warning-premium' };
            default: return { icon: '❓', color: '#2563eb', bgColor: '#eff6ff', btnClass: 'btn-info-premium' };
        }
    };

    const { icon, color, bgColor, btnClass } = getTypeStyles();

    return (
        <div className="confirm-overlay-premium" onClick={onCancel}>
            <div className="confirm-card-premium animate-pop-premium" onClick={(e) => e.stopPropagation()}>
                <div className="confirm-header-premium">
                    <div className="confirm-icon-box" style={{ backgroundColor: bgColor, color: color }}>
                        <span className="icon-emoji">{icon}</span>
                    </div>
                </div>

                <div className="confirm-body-premium">
                    <h2>{title}</h2>
                    <p>{message}</p>
                </div>

                <div className="confirm-footer-premium">
                    <button className="confirm-btn-secondary" onClick={onCancel}>
                        {cancelText ?? t("modal.confirmNo")}
                    </button>
                    <button className={`confirm-btn-primary ${btnClass}`} onClick={onConfirm}>
                        {confirmText ?? t("modal.confirmYes")}
                    </button>
                </div>
            </div>

            <style>{`
                .confirm-overlay-premium {
                    position: fixed;
                    inset: 0;
                    background: rgba(15, 23, 42, 0.7);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    padding: 20px;
                    animation: fadeInPremium 0.3s ease-out;
                }

                .confirm-card-premium {
                    background: #ffffff;
                    width: 100%;
                    max-width: 420px;
                    border-radius: 28px;
                    padding: 40px;
                    box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.3);
                    text-align: center;
                    position: relative;
                    overflow: hidden;
                }

                .confirm-icon-box {
                    width: 80px;
                    height: 80px;
                    border-radius: 24px;
                    margin: 0 auto 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: transform 0.3s;
                }

                .confirm-icon-box:hover {
                    transform: scale(1.1) rotate(5deg);
                }

                .icon-emoji {
                    font-size: 34px;
                }

                .confirm-body-premium h2 {
                    margin: 0 0 12px 0;
                    color: #0f172a;
                    font-size: 24px;
                    font-weight: 800;
                    letter-spacing: -0.5px;
                }

                .confirm-body-premium p {
                    color: #64748b;
                    font-size: 16px;
                    line-height: 1.6;
                    margin: 0 0 36px 0;
                    font-weight: 500;
                }

                .confirm-footer-premium {
                    display: flex;
                    gap: 16px;
                }

                .confirm-btn-secondary, .confirm-btn-primary {
                    flex: 1;
                    padding: 14px;
                    border-radius: 16px;
                    font-weight: 700;
                    font-size: 15px;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    border: none;
                }

                .confirm-btn-secondary {
                    background: #f1f5f9;
                    color: #475569;
                }

                .confirm-btn-secondary:hover {
                    background: #e2e8f0;
                    transform: translateY(-2px);
                }

                .confirm-btn-primary {
                    color: white;
                    box-shadow: 0 8px 20px -6px rgba(0, 0, 0, 0.2);
                }

                .btn-danger-premium { background: #ef4444; }
                .btn-warning-premium { background: #f59e0b; }
                .btn-info-premium { background: #2563eb; }

                .confirm-btn-primary:hover {
                    transform: translateY(-3px);
                    filter: brightness(1.1);
                    box-shadow: 0 12px 25px -8px rgba(0, 0, 0, 0.3);
                }

                .animate-pop-premium {
                    animation: popUpPremium 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                }

                @keyframes fadeInPremium {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes popUpPremium {
                    from { opacity: 0; transform: scale(0.6) translateY(40px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default ConfirmModal;
