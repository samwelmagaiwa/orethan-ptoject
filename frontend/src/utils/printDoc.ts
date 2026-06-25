import logo from "../assets/logo.png";

// Orethan Microfinance official letterhead used on all printed documents
export const ORETHAN_CONTACTS = {
  box: "P.O.BOX 77286, Mbagala-zakhiem ground",
  email: "orethantanzanialimited@gmail.com",
  phone: "+255 769 337 774  /  +255 702 519 104",
};

const row = (svg: string, text: string) => `
  <div style="display:flex;align-items:center;gap:10px;font-size:13.5px;color:#0f172a">
    <span style="width:26px;height:26px;border-radius:50%;background:#1d8ad1;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${svg}</span>
    <span>${text}</span>
  </div>`;

const ICON_MAIL = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg>`;
const ICON_AT = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>`;
const ICON_PHONE = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;

/**
 * Official letterhead block with inline styles — portable into any print window.
 */
export const letterheadBlock = () => `
  <div style="display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap">
    <img src="${logo}" style="height:88px;width:auto;object-fit:contain" alt="Orethan Microfinance" />
    <div style="display:flex;flex-direction:column;gap:9px">
      ${row(ICON_MAIL, ORETHAN_CONTACTS.box)}
      ${row(ICON_AT, ORETHAN_CONTACTS.email)}
      ${row(ICON_PHONE, `<strong>Mobile:</strong> ${ORETHAN_CONTACTS.phone}`)}
    </div>
  </div>
  <div style="display:flex;margin:14px 0 4px;height:7px;border-radius:4px;overflow:hidden">
    <span style="flex:1;background:linear-gradient(90deg,#7cb342,#aed581)"></span>
    <span style="flex:1;background:linear-gradient(90deg,#1565c0,#1d8ad1)"></span>
  </div>
`;

const letterheadHtml = letterheadBlock;

/**
 * Faint centered logo watermark — sits behind the document content.
 */
export const watermarkBlock = () => `
  <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-28deg);opacity:0.05;z-index:0;pointer-events:none">
    <img src="${logo}" style="width:560px;max-width:80vw" alt="" />
  </div>
`;

const baseStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; padding: 40px 48px; color: #0f172a; background: #fff; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* Letterhead */
  .lh { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
  .lh-logo { height: 92px; width: auto; object-fit: contain; }
  .lh-contacts { display: flex; flex-direction: column; gap: 10px; }
  .lh-row { display: flex; align-items: center; gap: 12px; font-size: 14px; color: #0f172a; }
  .lh-ic { width: 28px; height: 28px; border-radius: 50%; background: #1d8ad1; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .lh-bars { display: flex; margin: 14px 0 4px; height: 7px; border-radius: 4px; overflow: hidden; }
  .lh-bar-green { flex: 1; background: linear-gradient(90deg, #7cb342, #aed581); }
  .lh-bar-blue { flex: 1; background: linear-gradient(90deg, #1565c0, #1d8ad1); }
  .doc-title { text-align: center; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; margin: 26px 0 22px; color: #102a43; }

  /* Generic content */
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #1e3a8a; margin: 28px 0 12px; background: #f1f5f9; padding: 8px 12px; border-radius: 6px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  td { padding: 11px 12px; font-size: 13.5px; border-bottom: 1px solid #f1f5f9; }
  td:first-child { color: #64748b; font-weight: 500; width: 42%; }
  td:last-child { text-align: right; font-weight: 700; color: #0f172a; }
  .net-box { background: #102a43; padding: 20px 24px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin: 22px 0; color: #fff; font-weight: 800; font-size: 18px; }
  .net-box span { opacity: 0.75; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; }
  .sign-grid { margin-top: 80px; display: grid; grid-template-columns: 1fr 1fr; gap: 60px; }
  .sign-box { border-top: 1px solid #0f172a; padding-top: 10px; font-size: 13px; text-align: center; font-weight: 600; }
  .doc-footer { margin-top: 60px; border-top: 1px solid #e2e8f0; padding-top: 18px; font-size: 11px; color: #94a3b8; text-align: center; }
  @media print { body { padding: 24px 32px; } }
`;

/**
 * Open a print window with the Orethan letterhead + the provided body HTML.
 */
export function printDocument(title: string, bodyHtml: string, ref?: string) {
  const win = window.open("", "_blank", "width=860,height=1120");
  if (!win) return;
  win.document.write(`<html><head><title>${title}</title><style>${baseStyles}</style></head><body>
    ${watermarkBlock()}
    <div style="position:relative;z-index:1">
      ${letterheadHtml()}
      <div class="doc-title">${title}</div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;margin-bottom:18px;font-weight:600">
        <span>Date: ${new Date().toLocaleDateString("en-GB")}</span>
        ${ref ? `<span>Ref: ${ref}</span>` : ""}
      </div>
      ${bodyHtml}
      <div class="doc-footer">This is a system generated document. &copy; ${new Date().getFullYear()} Orethan Microfinance. All rights reserved.</div>
    </div>
  </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 450);
}
