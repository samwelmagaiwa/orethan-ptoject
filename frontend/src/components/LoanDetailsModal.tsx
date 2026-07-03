import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import staticLogo from '../assets/logo.png';
import LoanChecklistView from './LoanChecklistView';
import CollateralDirectory from './CollateralDirectory';
import { letterheadBlock, watermarkBlock, triggerPrint } from '../utils/printDoc';

// Common Loan interface that should match your types
interface User {
  id: number;
  name: string;
  role: string;
}

interface Approval {
  id: number;
  user: User;
  status: string;
  comments: string;
  created_at: string;
}

interface Loan {
  id: number;
  name: string;
  phone?: string | null;
  amount: number | string;
  type: string;
  status: string;
  details?: Record<string, any>;
  passport_photo?: string | null;
  guarantor_1_photo?: string | null;
  guarantor_2_photo?: string | null;
  rejection_metadata?: {
    reason: string;
    rejector_name: string;
    rejector_role: string;
    date: string;
  };
  approvals?: Approval[];
  created_at?: string;
}

const RedDash = () => <span style={{ color: '#ef4444', fontWeight: 'bold' }}>-</span>;

interface LoanDetailsModalProps {
  show: boolean;
  loan: Loan | null;
  onClose: () => void;
}

const LOAN_PRINT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; background: white; color: #1a1a1a;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 32px 40px; }
  @page { margin: 8mm; size: A4; }

  .pdf-section { margin-bottom: 0 !important; border-bottom: 1px solid #1a1a1a; page-break-inside: avoid; }
  .pdf-section:last-of-type { border-bottom: none; }
  .pdf-section-title { background: #f1f1f1; color: #000; padding: 14px 60px;
    font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.8px;
    border-bottom: 2px solid #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  .pdf-grid-12 { display: flex; }
  .photo-cell { border-right: 2px solid #1a1a1a; padding: 20px 20px 20px 60px; width: 240px; flex-shrink: 0; }
  .pdf-passport-img { width: 100%; aspect-ratio: 0.85; object-fit: cover; border: 1px solid #ddd; display: block; }
  .photo-placeholder { font-size: 14px; border: 2px dashed #ccc; height: 200px; display: flex;
    align-items: center; justify-content: center; color: #999; }

  .pdf-inner-grid { display: grid; grid-template-columns: repeat(12, 1fr); width: 100%; }
  .pdf-item { border-right: 1px solid #1a1a1a; border-bottom: 1px solid #1a1a1a;
    padding: 10px 16px; display: flex; flex-direction: column; gap: 4px; }
  .pdf-inner-grid .pdf-item:nth-child(4n), .pdf-inner-grid .pdf-item.col-12 { border-right: none; }
  .pdf-inner-grid .pdf-item:first-child { padding-left: 60px; }
  .pdf-inner-grid .pdf-item.col-12 { padding-left: 60px; }
  .pdf-grid-12 .pdf-item:last-child { border-right: none; }
  .pdf-item span { font-size: 10px; font-weight: 700; color: #666; text-transform: uppercase; }
  .pdf-item strong { font-size: 14px; min-height: 20px; font-weight: 800; color: #059669; }

  .col-2 { grid-column: span 2; } .col-3 { grid-column: span 3; } .col-4 { grid-column: span 4; }
  .col-6 { grid-column: span 6; } .col-8 { grid-column: span 8; }
  .col-10 { grid-column: span 10; } .col-12 { grid-column: span 12; border-right: none !important; }

  .pdf-sub-title { background: #f1f1f1; padding: 5px 60px; font-size: 11px;
    font-weight: 900; border-bottom: 1px solid #1a1a1a; text-transform: uppercase; }
  .pdf-table-container { padding: 0 60px; margin: 14px 0; }
  .table-caption { font-size: 11px; font-weight: 800; margin-bottom: 6px; color: #1a1a1a; }
  .pdf-table { width: 100%; border-collapse: collapse; }
  .pdf-table th { background: #f1f1f1; border: 1px solid #1a1a1a; padding: 7px 10px; font-size: 10px; text-align: left; }
  .pdf-table td { border: 1px solid #1a1a1a; padding: 7px 10px; font-size: 12px; color: #059669; font-weight: 700; }

  .pdf-guarantors-row { display: grid; grid-template-columns: 1fr 1fr; }
  .pdf-guarantor-box { border-right: 1px solid #1a1a1a; }
  .pdf-guarantor-box:last-child { border-right: none; }
  .pdf-guarantor-box .pdf-item:last-child { border-bottom: none; }

  .declaration-text { padding: 16px 60px; font-size: 12px; font-style: italic; line-height: 1.6; }
  .signature-grid { padding: 0 60px 32px 60px; }
  .signature-line { border-bottom: 1px dashed #000; margin-top: 10px; height: 24px;
    display: flex; align-items: flex-end; justify-content: center; }
  .signature-line strong { font-size: 12px !important; color: #059669 !important; }
  .thumbprint-box { width: 50px; height: 70px; border: 1px solid #000; margin-top: 5px;
    display: flex; align-items: center; justify-content: center; }
  .thumbprint-indicator { font-size: 8px; font-weight: 900; transform: rotate(-45deg); opacity: 0.8; color: #059669; }

  .text-success { color: #059669 !important; }
  .bg-highlight { background: #fffdf0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .bg-light-gray { background: #f8fafc; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-border-right { border-right: none !important; }
  .no-border-bottom { border-bottom: none !important; }
  .border-bottom { border-bottom: 1px solid #1a1a1a; }
  .border-top { border-top: 1px solid #1a1a1a; }
  .chattel-break { page-break-before: always; }
  .declaration-page { page-break-before: always; }
  img { max-width: 100%; }
`;

const LoanDetailsModal: React.FC<LoanDetailsModalProps> = ({ show, loan, onClose }) => {
  const { t } = useTranslation('loanModals');
  const paperRef = useRef<HTMLDivElement>(null);
  if (!show || !loan) return null;

  // Helper to format currency
  const formatMoney = (val: any) => {
    if (!val || val === 0 || val === "0") return <RedDash />;
    return `TZS ${Number(val).toLocaleString()}`;
  };

  const handlePrint = () => {
    const paper = paperRef.current;
    if (!paper) return;

    const clone = paper.cloneNode(true) as HTMLElement;
    // Remove static header — we replace with dynamic org letterhead
    clone.querySelector('.pdf-page-header')?.remove();
    // Remove interactive / screen-only elements
    clone.querySelectorAll('.no-print').forEach(el => el.remove());

    const formTitle = paper.querySelector('.form-title')?.textContent || 'LOAN APPLICATION FORM';
    const formCode  = paper.querySelector('.form-code')?.textContent  || '';

    const win = window.open('', '_blank', 'width=1060,height=1200');
    if (!win) return;

    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8" />
      <title>${formTitle}</title>
      <style>${LOAN_PRINT_CSS}</style>
    </head><body>
      ${watermarkBlock()}
      <div style="position:relative;z-index:1">
        ${letterheadBlock()}
        <div style="text-align:center;font-size:20px;font-weight:900;text-transform:uppercase;
          letter-spacing:0.06em;color:#102a43;margin:18px 0 4px;border-top:3px solid #1a1a1a;
          border-bottom:3px solid #1a1a1a;padding:10px 0">
          ${formTitle}
        </div>
        ${formCode ? `<div style="text-align:right;font-size:11px;font-weight:700;color:#64748b;margin-bottom:8px">Form No: ${formCode}</div>` : ''}
        ${clone.innerHTML}
        <div style="margin-top:24px;border-top:1px solid #e2e8f0;padding-top:12px;
          font-size:10px;color:#94a3b8;text-align:center">
          This is a system generated document. &copy; ${new Date().getFullYear()} — Printed ${new Date().toLocaleString('en-GB')}
        </div>
      </div>
    </body></html>`);
    win.document.close();
    triggerPrint(win);
  };

  const renderVal = (val: any) => {
    if (val === undefined || val === null || val === "" || val === "-") return <RedDash />;
    return val;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large animate-slide-up print-container" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-icon no-print fixed-close" onClick={onClose} title={t('loanDetails.actions.close')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <div className="pdf-form-body">
          <div className="pdf-document-paper" ref={paperRef}>
            {/* PDF HEADER — screen view only; print uses dynamic org letterhead */}
            <div className="pdf-page-header">
              <div className="header-top-row">
                <div className="header-left">
                  <img src={staticLogo} alt="ORETHAN MICROFINANCE" className="logo-image-main" />
                </div>
                <div className="header-center">
                  <div className="form-title">{t('loanDetails.header.formTitle')}</div>
                  <div className="pdf-meta no-print">
                    <div className={`status-pill status-${loan.status.replace('_', '-')}`}>
                      {loan.status.replace(/_/g, ' ')}
                    </div>
                    <span className="meta-id">ID: #{loan.id}</span>
                    <span className="meta-date">{t('loanDetails.header.submitted')}: {loan.created_at ? new Date(loan.created_at).toLocaleDateString() : <RedDash />}</span>
                  </div>
                </div>
                <div className="header-right">
                  <div className="header-action-row no-print">
                    <button className="btn-print-mini" onClick={handlePrint}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                      {t('loanDetails.actions.printPdf')}
                    </button>
                  </div>
                  <div className="form-code">{loan.details?.fomuNo || t('loanDetails.header.defaultFormCode')}</div>
                </div>
              </div>
            </div>

            {/* SEHEMU 1: TAARIFA BINAFSI */}
            <div className="pdf-section">
              <div className="pdf-section-title">{t('loanDetails.section1.title')}</div>

              <div className="pdf-grid-12">
                <div className="pdf-cell col-2 photo-cell">
                  {(() => {
                    const photoUrl = loan.passport_photo || loan.details?.passportPhotoUrl;
                    if (!photoUrl) return <div className="photo-placeholder">{t('loanDetails.photo.photoHere')}</div>;

                    const finalUrl = photoUrl.startsWith('http') ? photoUrl : `http://127.0.0.1:8000${photoUrl}`;
                    return <img src={finalUrl} alt={t('loanDetails.photo.passportAlt')} className="pdf-passport-img" />;
                  })()}
                </div>
                <div className="pdf-cell col-10">
                  <div className="pdf-inner-grid">
                    <div className="pdf-item col-8">
                      <span>{t('loanDetails.section1.fullName')}</span>
                      <strong>
                        {renderVal(loan.name || loan.details?.jinaKamiliLaMwombaji)}
                        {loan.details?.jinaMaarufu && <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px', fontWeight: 'bold' }}>(@{loan.details.jinaMaarufu})</span>}
                      </strong>
                    </div>
                    <div className="pdf-item col-4"><span>{t('loanDetails.section1.gender')}</span><strong>{renderVal(loan.details?.jinsia)}</strong></div>

                    <div className="pdf-item col-4"><span>{t('loanDetails.section1.dateOfBirth')}</span><strong>{renderVal(loan.details?.tareheYaKuzaliwa)}</strong></div>
                    <div className="pdf-item col-4"><span>{t('loanDetails.section1.phoneNumber')}</span><strong>{renderVal(loan.phone || loan.details?.nambaYaSimu)}</strong></div>
                    <div className="pdf-item col-4"><span>{t('loanDetails.section1.email')}</span><strong>{renderVal(loan.details?.baruaPepe)}</strong></div>

                    <div className="pdf-item col-4"><span>{t('loanDetails.section1.idType')}</span><strong>{renderVal(loan.details?.ainaYaKitambulisho)}</strong></div>
                    <div className="pdf-item col-4"><span>{t('loanDetails.section1.idNumber')}</span><strong>{renderVal(loan.details?.nambaYaKitambulisho)}</strong></div>
                    <div className="pdf-item col-4"><span>{t('loanDetails.section1.nationalityMaritalStatus')}</span><strong>{renderVal(loan.details?.uraia || t('loanDetails.section1.defaultNationality'))} / {renderVal(loan.details?.haliYaNdoa)}</strong></div>
                    <div className="pdf-item col-4"><span>{t('loanDetails.section1.residenceOwnership')}</span><strong>{renderVal(loan.details?.umilikiWaMakazi)} {loan.details?.umilikiWaMakazi === "Mengine (Eleza)" ? `(${renderVal(loan.details?.umilikiWaMakaziMengine)})` : ""}</strong></div>
                    <div className="pdf-item col-4"><span>{t('loanDetails.section1.applicantSignatureHardCopy')}</span><strong className={loan.details?.mwombajiAmesainiFomuNgumu ? "text-success" : ""}>{loan.details?.mwombajiAmesainiFomuNgumu ? t('loanDetails.section1.yesAffixed') : t('loanDetails.section1.no')}</strong></div>
                    <div className="pdf-item col-8"><span>{t('loanDetails.section1.applicantThumbprintHardCopy')}</span><strong className={(loan.details?.mwombajiAmewekaDoleGumba || loan.details?.mwombajiAmewekaDoleGumba2) ? "text-success" : ""}>{loan.details?.mwombajiAmewekaDoleGumba || loan.details?.mwombajiAmewekaDoleGumba2 ? t('loanDetails.section1.yesAffixed') : t('loanDetails.section1.no')}</strong></div>
                  </div>
                </div>
              </div>

              {loan.type === 'group' && (
                <div className="pdf-inner-grid border-top bg-light-gray no-border-bottom">
                  <div className="pdf-item col-3"><span>{t('loanDetails.section1.groupChairman')}</span><strong>{renderVal(loan.details?.jinaLaMwenyekiti)}</strong></div>
                  <div className="pdf-item col-3"><span>{t('loanDetails.section1.groupSecretary')}</span><strong>{renderVal(loan.details?.jinaLaKatibu)}</strong></div>
                  <div className="pdf-item col-3"><span>{t('loanDetails.section1.registrationNumberDate')}</span><strong>{renderVal(loan.details?.nambaYaUsajiliWaKikundi)} / {renderVal(loan.details?.tareheYaUsajiri || loan.details?.tareheYaUsajili)}</strong></div>
                  <div className="pdf-item col-3"><span>{t('loanDetails.section1.membersMaleFemale')}</span><strong>{loan.details?.idadiYaWanachamaMe || 0} / {loan.details?.idadiYaWanachamaKe || 0}</strong></div>
                  <div className="pdf-item col-6"><span>{t('loanDetails.section1.groupAddress')}</span><strong>{renderVal(loan.details?.anuaniYaMakaziYaKikundi)} ({renderVal(loan.details?.mudaKikundiKimekaaKatikaAnuaniHii)})</strong></div>
                  <div className="pdf-item col-6"><span>{t('loanDetails.section1.groupPhones')}</span><strong>{renderVal(loan.details?.simu1)} / {renderVal(loan.details?.simu2)}</strong></div>
                </div>
              )}

              <div className="pdf-inner-grid border-top">
                <div className="pdf-item col-4">
                  <span>{t('loanDetails.section1.spouseName')}</span>
                  <strong>
                    {renderVal(loan.details?.jinaKamiliLaMumeMke)}
                    {(loan.details?.jinaMaarufuMtaani || loan.details?.maarufuMtaani) && <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '5px' }}>(@{loan.details?.jinaMaarufuMtaani || loan.details?.maarufuMtaani})</span>}
                  </strong>
                </div>
                <div className="pdf-item col-4"><span>{t('loanDetails.section1.spousePhone')}</span><strong>{renderVal(loan.details?.simuYaMumeMke)}</strong></div>
                <div className="pdf-item col-4"><span>{t('loanDetails.section1.spouseOccupationId')}</span><strong>{renderVal(loan.details?.kaziYaMumeMke)} {loan.details?.nambaYaKitambulishoMumeMke ? `(${loan.details.ainaYaKitambulishoMumeMke}: ${loan.details.nambaYaKitambulishoMumeMke})` : ""}</strong></div>
                <div className="pdf-item col-4"><span>{t('loanDetails.section1.spouseEmployer')}</span><strong>{renderVal(loan.details?.jinaLaMwajiriWaMumeMke)}</strong></div>
                <div className="pdf-item col-8"><span>{t('loanDetails.section1.spouseOfficePhone')}</span><strong>{renderVal(loan.details?.simuYaOfisiYaMumeMke)}</strong></div>
              </div>

              <div className="pdf-sub-title">{t('loanDetails.section1.currentResidenceTitle')}</div>
              <div className="pdf-inner-grid">
                <div className="pdf-item col-3"><span>{t('loanDetails.section1.regionDistrict')}</span><strong>{renderVal(loan.details?.mahaliUnapoishiMkoa || loan.details?.mkoa)} / {renderVal(loan.details?.mahaliUnapoishiWilaya || loan.details?.wilaya)}</strong></div>
                <div className="pdf-item col-3"><span>{t('loanDetails.section1.wardStreet')}</span><strong>{renderVal(loan.details?.mahaliUnapoishiKata || loan.details?.kata)} / {renderVal(loan.details?.mahaliUnapoishiMtaa || loan.details?.kijijiMtaa || loan.details?.eneoUnaioishi)}</strong></div>
                <div className="pdf-item col-3"><span>{t('loanDetails.section1.houseNumber')}</span><strong>{renderVal(loan.details?.nambaYaNyumba)}</strong></div>
                <div className="pdf-item col-3"><span>{t('loanDetails.section1.livedThereFor')}</span><strong>{renderVal(loan.details?.umeishiHapoTanguMiezi)} {t('loanDetails.section1.months')}</strong></div>
              </div>
            </div>

            {/* SEHEMU 2: KAZI NA BIASHARA */}
            <div className="pdf-section">
              <div className="pdf-section-title">{t('loanDetails.section2.title')}</div>
              <div className="pdf-inner-grid">
                <div className="pdf-item col-4"><span>{t('loanDetails.section2.employmentType')}</span><strong>{loan.details?.jinaLaMradi ? t('loanDetails.section2.project', { type: loan.details.ainaYaMradi }) : (loan.details?.umeajiriwa === "Ndio" ? t('loanDetails.section2.formalEmployment') : t('loanDetails.section2.businessSelfEmployed'))}</strong></div>
                <div className="pdf-item col-4"><span>{t('loanDetails.section2.employerBusinessProject')}</span><strong>{renderVal(loan.details?.jinaLaKampuniYaMwajiri || loan.details?.jinaLaBiashara || loan.details?.jinaLaMradi)}</strong></div>
                <div className="pdf-item col-4"><span>{t('loanDetails.section2.positionBusinessType')}</span><strong>{renderVal(loan.details?.wadhifa || loan.details?.ainaYaBiashara || loan.details?.ainaYaMradi)}</strong></div>

                <div className="pdf-item col-3"><span>{t('loanDetails.section2.salaryIncome')}</span><strong>{formatMoney(loan.details?.mshaharaKwaMwezi || loan.details?.wastaniKipatoKwaMwezi || loan.details?.wastaniWaKipatoKwaMwezi)}</strong></div>
                <div className="pdf-item col-3"><span>{t('loanDetails.section2.monthlyExpenses')}</span><strong>{formatMoney(loan.details?.wastaniMatumiziKwaMwezi || loan.details?.wastaniWaMatumiziKwaMwezi)}</strong></div>
                <div className="pdf-item col-3"><span>{t('loanDetails.section2.sinceWhenEmploymentType')}</span><strong>{renderVal(loan.details?.tareheYaKuanzaKazi || loan.details?.umfanyaBiasharaTanguLini || loan.details?.mradiUmeanzaLini)} {loan.details?.ainaYaAjira ? `(${loan.details.ainaYaAjira})` : ""}</strong></div>
                <div className="pdf-item col-3"><span>{t('loanDetails.section2.areaAddress')}</span><strong>{renderVal(loan.details?.anuaniYaOfisiYaMwajiri || loan.details?.mahaliBiasharaIlipo || loan.details?.mahaliMradiUpoMkoa)}</strong></div>

                {loan.details?.umeajiriwa === "Ndio" && (
                  <div className="pdf-item col-12"><span>{t('loanDetails.section2.contractDetails')}</span><strong>{t('loanDetails.section2.contractEndsLabel')}: {renderVal(loan.details?.tareheYaKumalizaMkataba)} | {t('loanDetails.section2.retirementDateLabel')}: {renderVal(loan.details?.tareheYaKustaafu)}</strong></div>
                )}

                {loan.details?.umeajiriwa === "Hapana" && loan.details?.jinaMmilikiEneoBiashara && (
                  <div className="pdf-item col-12"><span>{t('loanDetails.section2.businessAreaDetails')}</span><strong>{t('loanDetails.section2.ownerLabel')}: {loan.details?.jinaMmilikiEneoBiashara} | {t('loanDetails.section2.ownerPhoneLabel')}: {renderVal(loan.details?.nambaSimuMmilikiEneo)} | {t('loanDetails.section2.contractDurationLabel')}: {renderVal(loan.details?.mudaMkatabaEneoBiashara)}</strong></div>
                )}

                {loan.type === 'group' && (
                  <div className="pdf-item col-12"><span>{t('loanDetails.section2.groupLoanDetails')}</span><strong>{t('loanDetails.section2.previouslyBorrowedLabel')}: {renderVal(loan.details?.kikundiKimewahiKukopa)} | {t('loanDetails.section2.amountOwedLabel')}: {formatMoney(loan.details?.kiasiKikundiKinadaiwa)}</strong></div>
                )}
              </div>
            </div>

            {/* SEHEMU 3: TAARIFA ZA MKOPO */}
            <div className="pdf-section">
              <div className="pdf-section-title">{t('loanDetails.section3.title')}</div>
              <div className="pdf-inner-grid">
                <div className="pdf-item col-4 bg-highlight"><span>{t('loanDetails.section3.amountRequested')}</span><strong>{formatMoney(loan.amount || loan.details?.kiasiMkopo || loan.details?.kiasiChaMkopo)}</strong></div>
                <div className="pdf-item col-8 bg-highlight"><span>{t('loanDetails.section3.amountInWords')}</span><strong>{renderVal(loan.details?.kwaManeno)}</strong></div>

                <div className="pdf-item col-3"><span>{t('loanDetails.section3.loanPurpose')}</span><strong>{renderVal(loan.details?.malengoMkopo || loan.details?.malengoYaMkopo)}</strong></div>
                <div className="pdf-item col-3"><span>{t('loanDetails.section3.loanDuration')}</span><strong>{renderVal(loan.details?.mudaKulipaMkopo || loan.details?.mudaWaLipaMkopo)}</strong></div>
                <div className="pdf-item col-3"><span>{t('loanDetails.section3.frequencySource')}</span><strong>{loan.details?.repaymentFrequency || t('loanDetails.section3.monthly')} / {renderVal(loan.details?.chanzoMapato || loan.details?.chanzoChaMapato)}</strong></div>
                <div className="pdf-item col-3"><span>{t('loanDetails.section3.expectedRepayment')}</span><strong>{formatMoney(loan.details?.kiasiRejeshoBilaMatatizo || loan.details?.kiasiGaniChaRejesho)}</strong></div>
              </div>

              {loan.details?.historia1JinaTaasisi && (
                <div className="pdf-table-container">
                  <p className="table-caption">{t('loanDetails.section3.creditHistoryTitle')}</p>
                  <table className="pdf-table">
                    <thead><tr><th>{t('loanDetails.section3.tableInstitution')}</th><th>{t('loanDetails.section3.tableAmount')}</th><th>{t('loanDetails.section3.tableDuration')}</th><th>{t('loanDetails.section3.tableBalanceOwed')}</th></tr></thead>
                    <tbody>
                      {[1, 2, 3].map(i => {
                        const p = `historia${i}`;
                        if (!loan.details?.[`${p}JinaTaasisi`]) return null;
                        return (
                          <tr key={i}>
                            <td>{loan.details[`${p}JinaTaasisi`]}</td>
                            <td>{formatMoney(loan.details[`${p}KiasiMkopo`])}</td>
                            <td>{loan.details[`${p}UlichukuaLini`]}</td>
                            <td>{formatMoney(loan.details[`${p}KiasiKilichobaki`])}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* SEHEMU 4: DHAMANA NA WADHAMINI */}
            <div className="pdf-section">
              <div className="pdf-section-title">{t('loanDetails.section4.title')}</div>

              <table className="pdf-table">
                <thead><tr><th>{t('loanDetails.section4.tableCollateralType')}</th><th>{t('loanDetails.section4.tableNumber')}</th><th>{t('loanDetails.section4.tableOwnership')}</th><th>{t('loanDetails.section4.tableValue')}</th><th>{t('loanDetails.section4.tableConditionAppearance')}</th></tr></thead>
                <tbody>
                  {loan.details?.dhamanaList?.map((d: any, idx: number) => (
                    <tr key={idx}><td>{d.aina}</td><td>{d.namba}</td><td>{d.umiliki}</td><td>{formatMoney(d.thamani)}</td><td>{renderVal(d.muonekano || d.muonekanoWaDhamana)}</td></tr>
                  ))}
                </tbody>
              </table>

              <div className="pdf-guarantors-row">
                {[1, 2].map(i => {
                  const p = `wdhamini${i}`;
                  return (
                    <div key={i} className="pdf-guarantor-box">
                      <div className="pdf-sub-title">{t('loanDetails.section4.guarantorInfoTitle', { number: i })}</div>
                      <div className="pdf-inner-grid">
                        <div className="pdf-item col-6"><span>{t('loanDetails.section4.fullName')}</span><strong>{renderVal(loan.details?.[`${p}JinaKamili`])}</strong></div>
                        <div className="pdf-item col-6" style={{ borderLeft: '1px solid #1a1a1a', padding: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', overflow: 'hidden' }}>
                          {(() => {
                            const photoUrl = (loan as any)?.[`guarantor_${i}_photo`] || loan.details?.[`guarantor${i}PhotoUrl`];
                            if (!photoUrl) return (
                              <div style={{
                                border: '2px dashed #ccc',
                                width: '100%',
                                aspectRatio: '1.2',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#999',
                                fontSize: '12px',
                                fontWeight: '800'
                              }}>
                                {t('loanDetails.photo.photoHere')}
                              </div>
                            );
                            const finalUrl = photoUrl.startsWith('http') ? photoUrl : `http://127.0.0.1:8000${photoUrl}`;
                            return <img src={finalUrl} alt={t('loanDetails.photo.guarantorAlt', { number: i })} style={{ width: '100%', aspectRatio: '1.2', objectFit: 'cover', border: '1px solid #ddd' }} />;
                          })()}
                        </div>
                        <div className="pdf-item col-6"><span>{t('loanDetails.section4.phoneNumber')}</span><strong>{renderVal(loan.details?.[`${p}Simu`])}</strong></div>
                        <div className="pdf-item col-6"><span>{t('loanDetails.section4.relationship')}</span><strong>{renderVal(loan.details?.[`${p}UhusianoWenu`])}</strong></div>
                        <div className="pdf-item col-6"><span>{t('loanDetails.section4.occupationBusiness')}</span><strong>{renderVal(loan.details?.[`${p}KaziAnayofanya`])}</strong></div>
                        <div className="pdf-item col-6"><span>{t('loanDetails.section4.areaAddress')}</span><strong>{renderVal(loan.details?.[`${p}MahaliAnapoishi`])}</strong></div>
                        <div className="pdf-item col-6"><span>{t('loanDetails.section4.houseResidence')}</span><strong># {renderVal(loan.details?.[`${p}NambaNyumba`])} ({renderVal(loan.details?.[`${p}AmepangaKwake`])}</strong></div>
                        <div className="pdf-item col-6"><span>{t('loanDetails.section4.employerOffice')}</span><strong>{renderVal(loan.details?.[`${p}JinaKampuniBiashara`])} ({renderVal(loan.details?.[`${p}MahaliOfisiYake`])}</strong></div>
                        <div className="pdf-item col-6"><span>{t('loanDetails.section4.guarantorSignature')}</span><strong className={loan.details?.[`mdhamini${i}AmesainiFomuNgumu`] ? "text-success" : ""}>{loan.details?.[`mdhamini${i}AmesainiFomuNgumu`] ? t('loanDetails.section4.yesAffixed') : t('loanDetails.section4.no')}</strong></div>
                        <div className="pdf-item col-6"><span>{t('loanDetails.section4.guarantorThumbprint')}</span><strong className={loan.details?.[`mdhamini${i}AmewekaDoleGumba`] ? "text-success" : ""}>{loan.details?.[`mdhamini${i}AmewekaDoleGumba`] ? t('loanDetails.section4.yesAffixed') : t('loanDetails.section4.no')}</strong></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>


            {/* CHATTEL FORM */}
            {loan.details?.chattelItems && (
              <div className="pdf-section chattel-break">
                <div className="pdf-section-title">{t('loanDetails.chattel.title')}</div>
                <table className="pdf-table">
                  <thead><tr><th>{t('loanDetails.chattel.tableDescription')}</th><th>{t('loanDetails.chattel.tableMarketValue')}</th><th>{t('loanDetails.chattel.tableCollateralValue')}</th></tr></thead>
                  <tbody>
                    {loan.details.chattelItems.map((item: any, idx: number) => (
                      <tr key={idx}><td>{item.jina} - {item.maelezo}</td><td>{formatMoney(item.thamaniSoko)}</td><td>{formatMoney(item.thamaniDhamana)}</td></tr>
                    ))}
                  </tbody>
                </table>
                <div className="pdf-inner-grid">
                  <div className="pdf-item col-4"><span>{t('loanDetails.chattel.ownerName')}</span><strong>{loan.details.chattelOwnerName}</strong></div>
                  <div className="pdf-item col-4"><span>{t('loanDetails.chattel.spouseName')}</span><strong>{renderVal(loan.details.chattelSpouseName)}</strong></div>
                  <div className="pdf-item col-4"><span>{t('loanDetails.chattel.ownerSignature')}</span><strong className={loan.details.chattelOwnerSigned ? "text-success" : ""}>{loan.details.chattelOwnerSigned ? t('loanDetails.chattel.affixed') : <RedDash />}</strong></div>

                  <div className="pdf-item col-4"><span>{t('loanDetails.chattel.witness')}</span><strong>{renderVal(loan.details.chattelWitnessName)}</strong></div>
                  <div className="pdf-item col-4"><span>{t('loanDetails.chattel.witnessRelationship')}</span><strong>{renderVal(loan.details.chattelWitnessRelationship)}</strong></div>
                  <div className="pdf-item col-4"><span>{t('loanDetails.chattel.witnessSignature')}</span><strong className={loan.details.chattelWitnessSigned ? "text-success" : ""}>{loan.details.chattelWitnessSigned ? t('loanDetails.chattel.affixed') : <RedDash />}</strong></div>

                  <div className="pdf-item col-4"><span>{t('loanDetails.chattel.loanOfficer')}</span><strong>{renderVal(loan.details.chattelOfficerName)}</strong></div>
                  <div className="pdf-item col-4"><span>{t('loanDetails.chattel.officerDate')}</span><strong>{renderVal(loan.details.chattelOfficerDate)}</strong></div>
                  <div className="pdf-item col-4"><span>{t('loanDetails.chattel.officerSignature')}</span><strong className={loan.details.chattelOfficerSigned ? "text-success" : ""}>{loan.details.chattelOfficerSigned ? t('loanDetails.chattel.affixed') : <RedDash />}</strong></div>

                  <div className="pdf-item col-4"><span>{t('loanDetails.chattel.chairman')}</span><strong>{renderVal(loan.details.chattelChairmanName)}</strong></div>
                  <div className="pdf-item col-4"><span>{t('loanDetails.chattel.chairmanDate')}</span><strong>{renderVal(loan.details.chattelChairmanDate)}</strong></div>
                  <div className="pdf-item col-4"><span>{t('loanDetails.chattel.stampSeal')}</span><strong className={loan.details.chattelChairmanStamp ? "text-success" : ""}>{loan.details.chattelChairmanStamp ? t('loanDetails.chattel.affixed') : <RedDash />}</strong></div>
                </div>
              </div>
            )}

            {/* DECLARATION */}
            <div className="pdf-section declaration-page">
              <div className="pdf-section-title">{t('loanDetails.declaration.title')}</div>
              <p className="declaration-text">
                {t('loanDetails.declaration.text', { name: loan.name })}
              </p>
              <div className="pdf-inner-grid signature-grid">
                <div className="pdf-item col-4 no-border-right">
                  <span>{t('loanDetails.declaration.applicantSignature')}</span>
                  <div className="signature-line">
                    <strong className="text-success">{loan.details?.mwombajiAmesainiFomuNgumu ? t('loanDetails.chattel.affixed') : ""}</strong>
                  </div>
                </div>
                <div className="pdf-item col-4 no-border-right"><span>{t('loanDetails.declaration.date')}</span> <div className="signature-line"><strong>{loan.created_at ? new Date(loan.created_at).toLocaleDateString() : <RedDash />}</strong></div></div>
                <div className="pdf-item col-4 no-border-right border-bottom">
                  <span>{t('loanDetails.declaration.thumbprintMark')}</span>
                  <div className="thumbprint-box">
                    {loan.details?.mwombajiAmewekaDoleGumba || loan.details?.mwombajiAmewekaDoleGumba2 ? <div className="thumbprint-indicator">{t('loanDetails.declaration.affixed')}</div> : null}
                  </div>
                </div>
              </div>
            </div>

            {/* DOCUMENTATION CHECKLIST cross-checked by the loan officer before submission */}
            <LoanChecklistView type={loan.type} details={loan.details} />

            {Array.isArray(loan.details?.collateralPhotos) && loan.details.collateralPhotos.length > 0 && (
              <div className="pdf-section">
                <CollateralDirectory
                  clientName={loan.name}
                  photos={loan.details.collateralPhotos}
                  readOnly
                />
              </div>
            )}

          </div>

          <style>{`
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(15, 23, 42, 0.98);
          backdrop-filter: blur(10px); display: flex; align-items: stretch; justify-content: stretch;
          z-index: 9999; padding: 0 !important; font-family: 'Inter', sans-serif;
        }
        
        .modal-content.modal-large {
          background: #ffffff; border-radius: 0 !important; 
          width: 100vw !important; height: 100vh !important;
          max-width: none !important; max-height: none !important;
          box-shadow: none; overflow: hidden; display: flex; flex-direction: column;
          margin: 0 !important; position: fixed; inset: 0;
        }

        .fixed-close {
          position: fixed; top: 15px; right: 15px; z-index: 10001;
          background: #ef4444; border: none; width: 44px; height: 44px; border-radius: 50%;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15); cursor: pointer; color: white;
          transition: all 0.2s; display: flex; align-items: center; justify-content: center;
        }
        .fixed-close:hover { transform: rotate(90deg) scale(1.1); background: #dc2626; }

        .pdf-meta { display: flex; align-items: center; gap: 15px; margin-top: 8px; }
        .meta-id, .meta-date { font-size: 11px; font-weight: 600; color: #64748b; }

        .header-action-row { margin-bottom: 15px; display: flex; justify-content: flex-end; }
        .btn-print-mini {
          background: #2563eb; color: white; border: none; padding: 8px 16px;
          border-radius: 8px; font-weight: 700; cursor: pointer; display: flex; gap: 8px; align-items: center;
          font-size: 13px; transition: background 0.2s;
        }
        .btn-print-mini:hover { background: #1d4ed8; }

        .pdf-form-body {
          padding: 60px 10%; overflow-y: auto; background: #f8fafc; color: #1a1a1a;
          flex-grow: 1; display: flex; flex-direction: column; align-items: center;
        }
        
        .pdf-document-paper {
          width: 100%; max-width: 1200px; background: white; 
          padding: 60px 0; box-shadow: 0 0 50px rgba(0,0,0,0.05); margin-bottom: 40px;
          border: 1px solid #1a1a1a;
        }

        .pdf-page-header {
          border-bottom: 3px solid #1a1a1a; padding: 10px 60px; margin-bottom: 0px;
        }

        .header-top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
        }

        .header-left { flex: 1; display: flex; justify-content: flex-start; }
        .header-center { flex: 2; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .header-right { flex: 1; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }

        .logo-image-main {
          height: 160px;
          max-width: 240px;
          width: auto;
          object-fit: contain;
        }

        .form-title { font-size: 26px; font-weight: 900; letter-spacing: -0.5px; border-bottom: 2px solid #1a1a1a; padding-bottom: 5px; }
        .form-code { font-size: 14px; font-weight: 800; color: #475569; }

        .pdf-section { margin-bottom: 0 !important; border-bottom: 1px solid #1a1a1a; }
        .pdf-section:last-of-type { border-bottom: none; }
        .pdf-section-title {
          background: #f1f1f1; color: #000; padding: 14px 60px;
          font-size: 18px; font-weight: 900; text-transform: uppercase;
          letter-spacing: 0.8px; border-bottom: 2px solid #000;
        }

        .pdf-grid-12 { display: flex; }
        .photo-cell { border-right: 2px solid #1a1a1a; padding: 20px 20px 20px 60px; width: 260px; flex-shrink: 0; }
        .pdf-passport-img { width: 100%; aspect-ratio: 0.85; object-fit: cover; border: 1px solid #ddd; }
        .photo-placeholder { font-size: 14px; border: 2px dashed #ccc; height: 220px; display: flex; align-items: center; justify-content: center; color: #999; }

        .pdf-inner-grid { display: grid; grid-template-columns: repeat(12, 1fr); width: 100%; }
        .pdf-item {
          border-right: 1px solid #1a1a1a; border-bottom: 1px solid #1a1a1a;
          padding: 12px 20px; display: flex; flex-direction: column; gap: 5px;
        }
        .pdf-inner-grid .pdf-item:nth-child(4n), .pdf-inner-grid .pdf-item.col-12 { border-right: none; }
        .pdf-inner-grid .pdf-item:first-child { padding-left: 60px; }
        .pdf-inner-grid .pdf-item.col-12 { padding-left: 60px; }
        .pdf-grid-12 .pdf-item:last-child { border-right: none; }
        .pdf-item span { font-size: 11px; font-weight: 700; color: #666; text-transform: uppercase; }
        .pdf-item strong { font-size: 16px; min-height: 22px; font-weight: 800; color: #059669; }

        .col-3 { grid-column: span 3; } .col-4 { grid-column: span 4; }
        .col-6 { grid-column: span 6; } .col-8 { grid-column: span 8; }
        .col-10 { grid-column: span 10; } .col-12 { grid-column: span 12; border-right: none !important; }

        .pdf-sub-title {
          background: #f1f1f1; padding: 5px 60px; font-size: 11px;
          font-weight: 900; border-bottom: 1px solid #1a1a1a;
          text-transform: uppercase;
        }

        .pdf-table-container { padding: 0 60px; margin: 20px 0; }
        .table-caption { font-size: 11px; font-weight: 800; margin-bottom: 8px; color: #1a1a1a; }

        .pdf-table { width: 100%; border-collapse: collapse; }
        .pdf-table th { background: #f1f1f1; border: 1px solid #1a1a1a; padding: 8px 12px; font-size: 10px; text-align: left; }
        .pdf-table td { border: 1px solid #1a1a1a; padding: 8px 12px; font-size: 12px; color: #059669; font-weight: 700; }

        .pdf-guarantors-row { display: grid; grid-template-columns: 1fr 1fr; }
        .pdf-guarantor-box { border-right: 1px solid #1a1a1a; }
        .pdf-guarantor-box:last-child { border-right: none; }
        .pdf-guarantor-box .pdf-item:last-child { border-bottom: none; }

        .declaration-text { padding: 20px 60px; font-size: 12px; font-style: italic; line-height: 1.6; }
        .pdf-document-paper .signature-grid { padding: 0 60px 40px 60px; }
        .signature-line { border-bottom: 1px dashed #000; margin-top: 10px; height: 25px; display: flex; align-items: flex-end; justify-content: center; }
        .signature-line strong { font-size: 13px !important; color: #059669 !important; }
        .thumbprint-box { width: 50px; height: 70px; border: 1px solid #000; margin-top: 5px; display: flex; align-items: center; justify-content: center; }
        .thumbprint-indicator { font-size: 8px; font-weight: 900; transform: rotate(-45deg); opacity: 0.8; color: #059669; }
        
        .text-success { color: #059669 !important; }
        
        .pdf-document-paper strong::after { content: none !important; }
        .pdf-document-paper .bg-highlight { background: #fffdf0; }
        .bg-light-gray { background: #f8fafc; }
        .no-border-right { border-right: none !important; }
        .no-border-bottom { border-bottom: none !important; }

        .animate-slide-up { animation: slideUp 0.4s ease-out; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

      `}</style>
        </div>
      </div>
    </div>
  );
};

export default LoanDetailsModal;
