import React from 'react';
import { useTranslation } from 'react-i18next';
import logo from '../assets/logo.png';
import LoanChecklistView from './LoanChecklistView';
import CollateralDirectory from './CollateralDirectory';
import { resolveStorageUrl } from '../lib/api';

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

const LoanDetailsModal: React.FC<LoanDetailsModalProps> = ({ show, loan, onClose }) => {
  const { t } = useTranslation('loanModals');
  if (!show || !loan) return null;

  // Helper to format currency
  const formatMoney = (val: any) => {
    if (!val || val === 0 || val === "0") return <RedDash />;
    return `TZS ${Number(val).toLocaleString()}`;
  };

  const handlePrint = () => {
    const el = document.querySelector('.pdf-document-paper') as HTMLElement | null;
    if (!el) { window.print(); return; }

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { window.print(); return; }

    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((s) => s.outerHTML)
      .join('\n');

    win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Loan Application</title>
${styles}
<style>
  @page { margin: 8mm; size: A4 portrait; }
  html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
  .pdf-document-paper { max-width: 100% !important; width: 100% !important; box-shadow: none !important; margin: 0 !important; padding: 0 !important; border: 1px solid #000 !important; }
  /* Cancel the parent page's print-hide rule that was copied with the styles */
  @media print {
    html, body { height: auto !important; overflow: visible !important; }
    body * { visibility: visible !important; }
    .modal-overlay, .modal-content, .pdf-form-body { position: static !important; height: auto !important; overflow: visible !important; display: block !important; }
  }
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
</style>
</head>
<body>
${el.outerHTML}
</body>
</html>`);
    win.document.close();
    win.focus();
    win.addEventListener('afterprint', () => win.close());
    setTimeout(() => win.print(), 800);
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
          <div className="pdf-document-paper">
            {/* PDF HEADER */}
            <div className="pdf-page-header">
              <div className="header-top-row">
                <div className="header-left">
                  <img src={logo} alt="ORETHAN MICROFINANCE" className="logo-image-main" />
                </div>
                <div className="header-center">
                  <div className="form-title">{t('loanDetails.header.formTitle')}</div>
                  <div className="pdf-meta no-print">
                    <div className={`status-pill status-${loan.status.replace('_', '-')}`}>
                      {loan.status.replace(/_/g, ' ')}
                    </div>
                    <span className="meta-id">ID: #{String(loan.id).padStart(5,'0')}</span>
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

                    return <img src={resolveStorageUrl(photoUrl)} alt={t('loanDetails.photo.passportAlt')} className="pdf-passport-img" />;
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
                            return <img src={resolveStorageUrl(photoUrl)} alt={t('loanDetails.photo.guarantorAlt', { number: i })} style={{ width: '100%', aspectRatio: '1.2', objectFit: 'cover', border: '1px solid #ddd' }} />;
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
        @media print {
          @page { margin: 8mm; size: A4 portrait; }
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;

          /* Reset body and html so fixed/flex containers don't trap content */
          html, body { height: auto !important; overflow: visible !important; }

          /* Hide everything then show only the print container */
          body * { visibility: hidden !important; }
          .modal-overlay {
            visibility: visible !important;
            background: white !important;
            backdrop-filter: none !important;
            /* MUST be static — fixed elements don't paginate across pages */
            position: static !important;
            width: 100% !important;
            height: auto !important;
            display: block !important;
          }
          .modal-content.modal-large.print-container {
            visibility: visible !important;
            position: static !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            display: block !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .modal-content.modal-large.print-container * { visibility: visible !important; }
          .no-print { display: none !important; }

          /* Scrolling wrapper must be static and auto-height for pagination */
          .pdf-form-body {
            padding: 0 !important;
            background: white !important;
            overflow: visible !important;
            height: auto !important;
            min-height: 0 !important;
            flex: none !important;
            display: block !important;
            width: 100% !important;
          }
          .pdf-document-paper {
            max-width: 100% !important;
            width: 100% !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            border: 1px solid #000 !important;
          }

          .pdf-section { page-break-inside: avoid; border-top: 2px solid #000 !important; }
          .pdf-section:first-child { border-top: none !important; }
          .pdf-section-title, .pdf-section-title * {
            color: #000 !important; background: #e8e8e8 !important;
            font-weight: 900 !important; font-size: 10px !important;
            border-bottom: 1px solid #000 !important;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }

          /* Header */
          .pdf-page-header { padding: 4px 8px !important; }
          .logo-image-main { height: 50px !important; max-width: 90px !important; }
          .form-title { font-size: 12px !important; padding-bottom: 2px !important; }
          .form-code { font-size: 8px !important; }

          /* Section titles / sub-titles */
          .pdf-section-title { padding: 4px 8px !important; font-size: 10px !important; }
          .pdf-sub-title { padding: 3px 8px !important; font-size: 8px !important; }

          /* Passport photo column */
          .photo-cell { width: 100px !important; padding: 4px !important; flex-shrink: 0 !important; }
          .pdf-passport-img { width: 100% !important; }
          .photo-placeholder { height: 130px !important; font-size: 10px !important; }

          /* Grid cells */
          .pdf-inner-grid { display: grid !important; grid-template-columns: repeat(12, 1fr) !important; }
          .pdf-item { padding: 3px 5px !important; overflow: hidden !important; word-break: break-word !important; }
          .pdf-item:first-child { padding-left: 10px !important; }
          .pdf-item.col-12 { padding-left: 10px !important; }
          .pdf-item span { font-size: 7px !important; }
          .pdf-item strong { font-size: 9px !important; min-height: 14px !important; }

          /* Tables */
          .pdf-table-container { padding: 0 10px !important; margin: 8px 0 !important; }
          .pdf-table th { font-size: 7px !important; padding: 2px 4px !important; }
          .pdf-table td { font-size: 8px !important; padding: 2px 4px !important; }

          /* Guarantors */
          .pdf-guarantors-row { display: grid !important; grid-template-columns: 1fr 1fr !important; }

          /* Declarations & signatures */
          .declaration-text { padding: 8px 10px !important; font-size: 8px !important; }
          .pdf-document-paper .signature-grid { padding: 0 10px 15px !important; }
          .signature-line { height: 18px !important; margin-top: 6px !important; }
          .thumbprint-box { width: 35px !important; height: 50px !important; }
        }

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

        .header-action-row { margin-bottom: 10px; display: flex; justify-content: flex-end; }
        .btn-print-mini {
          background: #2563eb; color: white; border: none; padding: 12px 24px;
          border-radius: 10px; font-weight: 800; cursor: pointer; display: flex; gap: 10px; align-items: center;
          font-size: 15px; transition: background 0.2s; white-space: nowrap; min-width: 150px; justify-content: center;
          box-shadow: 0 4px 12px rgba(37,99,235,0.3);
        }
        .btn-print-mini:hover { background: #1d4ed8; box-shadow: 0 6px 16px rgba(37,99,235,0.4); transform: translateY(-1px); }

        .pdf-form-body {
          padding: 60px 10%; overflow-y: scroll; background: #f8fafc; color: #1a1a1a;
          flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; align-items: center;
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
