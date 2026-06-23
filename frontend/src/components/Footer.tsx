import type { FC } from "react";

const Footer: FC = () => {
  return (
    <div className="ft">
      <span className="ft__icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
      </span>
      <p className="ft__text">© 2026 Microfinance System. All rights reserved.</p>

      <style>{`
        .ft {
          height: 48px;
          background: #e8ecf1;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-top: 1px solid #d1d5db;
          width: 100%;
          font-size: 13px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .ft__icon { display: flex; align-items: center; }
        .ft__text { margin: 0; }
      `}</style>
    </div>
  );
};

export default Footer;