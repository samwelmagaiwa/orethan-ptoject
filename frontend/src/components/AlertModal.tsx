import React from 'react';
import { useTranslation } from 'react-i18next';

interface AlertModalProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
  title?: string;
  type?: 'success' | 'error' | 'info' | 'warning';
}

const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  message,
  onClose,
  title,
  type = 'info'
}) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'success': return { icon: '✅', color: '#10b981', bgColor: '#ecfdf5' };
      case 'error': return { icon: '❌', color: '#ef4444', bgColor: '#fef2f2' };
      case 'warning': return { icon: '⚠️', color: '#f59e0b', bgColor: '#fffbeb' };
      default: return { icon: 'ℹ️', color: '#3b82f6', bgColor: '#eff6ff' };
    }
  };

  const { icon, color, bgColor } = getTypeStyles();

  return (
    <div className="alert-overlay-premium" onClick={onClose}>
      <div className="alert-card-premium animate-pop-premium" onClick={(e) => e.stopPropagation()}>
        <div className="alert-header-premium">
          <div className="alert-icon-box" style={{ backgroundColor: bgColor, color: color }}>
            <span className="icon-emoji">{icon}</span>
          </div>
        </div>

        <div className="alert-body-premium">
          {title ? <h2>{title}</h2> : null}
          <p style={{ whiteSpace: 'pre-line' }}>{message}</p>
        </div>

        <div className="alert-footer-premium">
          <button
            className="alert-btn-premium"
            style={{ backgroundColor: color }}
            onClick={onClose}
          >
            {t("modal.ok")}
          </button>
        </div>
      </div>

      <style>{`
                .alert-overlay-premium {
                    position: fixed;
                    inset: 0;
                    background: rgba(15, 23, 42, 0.7);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10001;
                    padding: 20px;
                    animation: fadeInPremium 0.3s ease-out;
                }

                .alert-card-premium {
                    background: #ffffff;
                    width: 100%;
                    max-width: 400px;
                    border-radius: 28px;
                    padding: 40px;
                    box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.3);
                    text-align: center;
                }

                .alert-icon-box {
                    width: 80px;
                    height: 80px;
                    border-radius: 24px;
                    margin: 0 auto 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .icon-emoji {
                    font-size: 34px;
                }

                .alert-body-premium h2 {
                    margin: 0 0 12px 0;
                    color: #0f172a;
                    font-size: 24px;
                    font-weight: 800;
                    letter-spacing: -0.5px;
                }

                .alert-body-premium p {
                    color: #64748b;
                    font-size: 16px;
                    line-height: 1.6;
                    margin: 0 0 32px 0;
                    font-weight: 500;
                }

                .alert-footer-premium {
                    display: flex;
                    justify-content: center;
                }

                .alert-btn-premium {
                    width: 100%;
                    padding: 14px;
                    border-radius: 16px;
                    color: white;
                    font-weight: 700;
                    font-size: 15px;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    border: none;
                    box-shadow: 0 8px 20px -6px rgba(0, 0, 0, 0.2);
                }

                .alert-btn-premium:hover {
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

export default AlertModal;
