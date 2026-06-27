import React from 'react';
import logo from '../assets/logo.png';
import LoanChecklistView from './LoanChecklistView';
import CollateralDirectory from './CollateralDirectory';

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
  if (!show || !loan) return null;

  // Helper to format currency
  const formatMoney = (val: any) => {
    if (!val || val === 0 || val === "0") return <RedDash />;
    return `TZS ${Number(val).toLocaleString()}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const renderVal = (val: any) => {
    if (val === undefined || val === null || val === "" || val === "-") return <RedDash />;
    return val;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large animate-slide-up print-container" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-icon no-print fixed-close" onClick={onClose} title="Funga">
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
                  <div className="form-title">FOMU KAMILI YA MAOMBI YA MKOPO</div>
                  <div className="pdf-meta no-print">
                    <div className={`status-pill status-${loan.status.replace('_', '-')}`}>
                      {loan.status.replace(/_/g, ' ')}
                    </div>
                    <span className="meta-id">ID: #{loan.id}</span>
                    <span className="meta-date">Iliyowasilishwa: {loan.created_at ? new Date(loan.created_at).toLocaleDateString() : <RedDash />}</span>
                  </div>
                </div>
                <div className="header-right">
                  <div className="header-action-row no-print">
                    <button className="btn-print-mini" onClick={handlePrint}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                      Chapisha PDF
                    </button>
                  </div>
                  <div className="form-code">{loan.details?.fomuNo || "FO-LN-001"}</div>
                </div>
              </div>
            </div>

            {/* SEHEMU 1: TAARIFA BINAFSI */}
            <div className="pdf-section">
              <div className="pdf-section-title">SEHEMU 1: TAARIFA BINAFSI ZA MWOMBAJI</div>

              <div className="pdf-grid-12">
                <div className="pdf-cell col-2 photo-cell">
                  {(() => {
                    const photoUrl = loan.passport_photo || loan.details?.passportPhotoUrl;
                    if (!photoUrl) return <div className="photo-placeholder">PHOTO HERE</div>;

                    const finalUrl = photoUrl.startsWith('http') ? photoUrl : `http://127.0.0.1:8000${photoUrl}`;
                    return <img src={finalUrl} alt="Passport" className="pdf-passport-img" />;
                  })()}
                </div>
                <div className="pdf-cell col-10">
                  <div className="pdf-inner-grid">
                    <div className="pdf-item col-8">
                      <span>Jina Kamili la Mwombaji</span>
                      <strong>
                        {renderVal(loan.name || loan.details?.jinaKamiliLaMwombaji)}
                        {loan.details?.jinaMaarufu && <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px', fontWeight: 'bold' }}>(@{loan.details.jinaMaarufu})</span>}
                      </strong>
                    </div>
                    <div className="pdf-item col-4"><span>Jinsia</span><strong>{renderVal(loan.details?.jinsia)}</strong></div>

                    <div className="pdf-item col-4"><span>Tarehe ya Kuzaliwa</span><strong>{renderVal(loan.details?.tareheYaKuzaliwa)}</strong></div>
                    <div className="pdf-item col-4"><span>Namba ya Simu</span><strong>{renderVal(loan.phone || loan.details?.nambaYaSimu)}</strong></div>
                    <div className="pdf-item col-4"><span>Barua Pepe</span><strong>{renderVal(loan.details?.baruaPepe)}</strong></div>

                    <div className="pdf-item col-4"><span>Aina ya Kitambulisho</span><strong>{renderVal(loan.details?.ainaYaKitambulisho)}</strong></div>
                    <div className="pdf-item col-4"><span>Namba ya Kitambulisho</span><strong>{renderVal(loan.details?.nambaYaKitambulisho)}</strong></div>
                    <div className="pdf-item col-4"><span>Uraia / Hali ya Ndoa</span><strong>{renderVal(loan.details?.uraia || "Mtanzania")} / {renderVal(loan.details?.haliYaNdoa)}</strong></div>
                    <div className="pdf-item col-4"><span>Umiliki wa Makazi</span><strong>{renderVal(loan.details?.umilikiWaMakazi)} {loan.details?.umilikiWaMakazi === "Mengine (Eleza)" ? `(${renderVal(loan.details?.umilikiWaMakaziMengine)})` : ""}</strong></div>
                    <div className="pdf-item col-4"><span>Sahihi ya Mwombaji (Fomu Ngumu)</span><strong className={loan.details?.mwombajiAmesainiFomuNgumu ? "text-success" : ""}>{loan.details?.mwombajiAmesainiFomuNgumu ? "NDIYO / IMEWEKWA" : "HAPANA"}</strong></div>
                    <div className="pdf-item col-8"><span>Dole Gumba la Mwombaji (Fomu Ngumu)</span><strong className={(loan.details?.mwombajiAmewekaDoleGumba || loan.details?.mwombajiAmewekaDoleGumba2) ? "text-success" : ""}>{loan.details?.mwombajiAmewekaDoleGumba || loan.details?.mwombajiAmewekaDoleGumba2 ? "NDIYO / IMEWEKWA" : "HAPANA"}</strong></div>
                  </div>
                </div>
              </div>

              {loan.type === 'group' && (
                <div className="pdf-inner-grid border-top bg-light-gray no-border-bottom">
                  <div className="pdf-item col-3"><span>Mwenyekiti wa Kikundi</span><strong>{renderVal(loan.details?.jinaLaMwenyekiti)}</strong></div>
                  <div className="pdf-item col-3"><span>Katibu wa Kikundi</span><strong>{renderVal(loan.details?.jinaLaKatibu)}</strong></div>
                  <div className="pdf-item col-3"><span>Usajili (#/Tarehe)</span><strong>{renderVal(loan.details?.nambaYaUsajiliWaKikundi)} / {renderVal(loan.details?.tareheYaUsajiri || loan.details?.tareheYaUsajili)}</strong></div>
                  <div className="pdf-item col-3"><span>Wanachama (ME/KE)</span><strong>{loan.details?.idadiYaWanachamaMe || 0} / {loan.details?.idadiYaWanachamaKe || 0}</strong></div>
                  <div className="pdf-item col-6"><span>Anuani ya Kikundi</span><strong>{renderVal(loan.details?.anuaniYaMakaziYaKikundi)} ({renderVal(loan.details?.mudaKikundiKimekaaKatikaAnuaniHii)})</strong></div>
                  <div className="pdf-item col-6"><span>Simu za Kikundi</span><strong>{renderVal(loan.details?.simu1)} / {renderVal(loan.details?.simu2)}</strong></div>
                </div>
              )}

              <div className="pdf-inner-grid border-top">
                <div className="pdf-item col-4">
                  <span>Jina la Mume/Mke</span>
                  <strong>
                    {renderVal(loan.details?.jinaKamiliLaMumeMke)}
                    {(loan.details?.jinaMaarufuMtaani || loan.details?.maarufuMtaani) && <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '5px' }}>(@{loan.details?.jinaMaarufuMtaani || loan.details?.maarufuMtaani})</span>}
                  </strong>
                </div>
                <div className="pdf-item col-4"><span>Namba ya Simu</span><strong>{renderVal(loan.details?.simuYaMumeMke)}</strong></div>
                <div className="pdf-item col-4"><span>Kazi / Kitambulisho</span><strong>{renderVal(loan.details?.kaziYaMumeMke)} {loan.details?.nambaYaKitambulishoMumeMke ? `(${loan.details.ainaYaKitambulishoMumeMke}: ${loan.details.nambaYaKitambulishoMumeMke})` : ""}</strong></div>
                <div className="pdf-item col-4"><span>Mwajiri wa Mume/Mke</span><strong>{renderVal(loan.details?.jinaLaMwajiriWaMumeMke)}</strong></div>
                <div className="pdf-item col-8"><span>Simu ya Ofisi (Mume/Mke)</span><strong>{renderVal(loan.details?.simuYaOfisiYaMumeMke)}</strong></div>
              </div>

              <div className="pdf-sub-title">MAHALI UNAPOISHI KWA SASA</div>
              <div className="pdf-inner-grid">
                <div className="pdf-item col-3"><span>Mkoa / Wilaya</span><strong>{renderVal(loan.details?.mahaliUnapoishiMkoa || loan.details?.mkoa)} / {renderVal(loan.details?.mahaliUnapoishiWilaya || loan.details?.wilaya)}</strong></div>
                <div className="pdf-item col-3"><span>Kata / Mtaa</span><strong>{renderVal(loan.details?.mahaliUnapoishiKata || loan.details?.kata)} / {renderVal(loan.details?.mahaliUnapoishiMtaa || loan.details?.kijijiMtaa || loan.details?.eneoUnaioishi)}</strong></div>
                <div className="pdf-item col-3"><span>Namba ya Nyumba</span><strong>{renderVal(loan.details?.nambaYaNyumba)}</strong></div>
                <div className="pdf-item col-3"><span>Umeishi Hapo</span><strong>{renderVal(loan.details?.umeishiHapoTanguMiezi)} Miezi</strong></div>
              </div>
            </div>

            {/* SEHEMU 2: KAZI NA BIASHARA */}
            <div className="pdf-section">
              <div className="pdf-section-title">SEHEMU 2: TAARIFA ZA KAZI / BIASHARA</div>
              <div className="pdf-inner-grid">
                <div className="pdf-item col-4"><span>Aina ya Kazi/Ajira</span><strong>{loan.details?.jinaLaMradi ? `MRADI: ${loan.details.ainaYaMradi}` : (loan.details?.umeajiriwa === "Ndio" ? "AJIRA RASMI" : "BIASHARA / KUJIAJIRI")}</strong></div>
                <div className="pdf-item col-4"><span>Mwajiri / Biashara / Mradi</span><strong>{renderVal(loan.details?.jinaLaKampuniYaMwajiri || loan.details?.jinaLaBiashara || loan.details?.jinaLaMradi)}</strong></div>
                <div className="pdf-item col-4"><span>Wadhifa / Aina ya Kazi</span><strong>{renderVal(loan.details?.wadhifa || loan.details?.ainaYaBiashara || loan.details?.ainaYaMradi)}</strong></div>

                <div className="pdf-item col-3"><span>Mshahara / Kipato (Tsh)</span><strong>{formatMoney(loan.details?.mshaharaKwaMwezi || loan.details?.wastaniKipatoKwaMwezi || loan.details?.wastaniWaKipatoKwaMwezi)}</strong></div>
                <div className="pdf-item col-3"><span>Matumizi / Mwezi (Tsh)</span><strong>{formatMoney(loan.details?.wastaniMatumiziKwaMwezi || loan.details?.wastaniWaMatumiziKwaMwezi)}</strong></div>
                <div className="pdf-item col-3"><span>Tangu Lini / Aina ya Ajira</span><strong>{renderVal(loan.details?.tareheYaKuanzaKazi || loan.details?.umfanyaBiasharaTanguLini || loan.details?.mradiUmeanzaLini)} {loan.details?.ainaYaAjira ? `(${loan.details.ainaYaAjira})` : ""}</strong></div>
                <div className="pdf-item col-3"><span>Anuani ya Eneo</span><strong>{renderVal(loan.details?.anuaniYaOfisiYaMwajiri || loan.details?.mahaliBiasharaIlipo || loan.details?.mahaliMradiUpoMkoa)}</strong></div>

                {loan.details?.umeajiriwa === "Ndio" && (
                  <div className="pdf-item col-12"><span>Maelezo ya Mkataba</span><strong>Mkataba Unaisha: {renderVal(loan.details?.tareheYaKumalizaMkataba)} | Tarehe ya Kustaafu: {renderVal(loan.details?.tareheYaKustaafu)}</strong></div>
                )}

                {loan.details?.umeajiriwa === "Hapana" && loan.details?.jinaMmilikiEneoBiashara && (
                  <div className="pdf-item col-12"><span>Maelezo ya Eneo la Biashara</span><strong>Mmiliki: {loan.details?.jinaMmilikiEneoBiashara} | Simu Mmiliki: {renderVal(loan.details?.nambaSimuMmilikiEneo)} | Muda wa Mkataba: {renderVal(loan.details?.mudaMkatabaEneoBiashara)}</strong></div>
                )}

                {loan.type === 'group' && (
                  <div className="pdf-item col-12"><span>Maelezo ya Mikopo ya Kikundi</span><strong>Kimewahi Kukopa: {renderVal(loan.details?.kikundiKimewahiKukopa)} | Kiasi Kinachodaiwa: {formatMoney(loan.details?.kiasiKikundiKinadaiwa)}</strong></div>
                )}
              </div>
            </div>

            {/* SEHEMU 3: TAARIFA ZA MKOPO */}
            <div className="pdf-section">
              <div className="pdf-section-title">SEHEMU 3: TAARIFA ZA MKOPO NA MAREJESHO</div>
              <div className="pdf-inner-grid">
                <div className="pdf-item col-4 bg-highlight"><span>Kiasi Kinachoombwa</span><strong>{formatMoney(loan.amount || loan.details?.kiasiMkopo || loan.details?.kiasiChaMkopo)}</strong></div>
                <div className="pdf-item col-8 bg-highlight"><span>Kiasi kwa Maneno</span><strong>{renderVal(loan.details?.kwaManeno)}</strong></div>

                <div className="pdf-item col-3"><span>Lengo la Mkopo</span><strong>{renderVal(loan.details?.malengoMkopo || loan.details?.malengoYaMkopo)}</strong></div>
                <div className="pdf-item col-3"><span>Muda wa Mkopo</span><strong>{renderVal(loan.details?.mudaKulipaMkopo || loan.details?.mudaWaLipaMkopo)}</strong></div>
                <div className="pdf-item col-3"><span>Mzunguko / Chanzo</span><strong>{loan.details?.repaymentFrequency || "Monthly"} / {renderVal(loan.details?.chanzoMapato || loan.details?.chanzoChaMapato)}</strong></div>
                <div className="pdf-item col-3"><span>Rejesho Tarajiwa</span><strong>{formatMoney(loan.details?.kiasiRejeshoBilaMatatizo || loan.details?.kiasiGaniChaRejesho)}</strong></div>
              </div>

              {loan.details?.historia1JinaTaasisi && (
                <div className="pdf-table-container">
                  <p className="table-caption">HISTORIA YA MIKOPO YA NYUMA</p>
                  <table className="pdf-table">
                    <thead><tr><th>Taasisi ya Fedha</th><th>Kiasi</th><th>Muda</th><th>Baki la Deni</th></tr></thead>
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
              <div className="pdf-section-title">SEHEMU 4: DHAMANA NA WADHAMINI</div>

              <table className="pdf-table">
                <thead><tr><th>Aina ya Dhamana</th><th>Namba (Hat/Kadi)</th><th>Umiliki</th><th>Thamani (Tsh)</th><th>Hali / Muonekano</th></tr></thead>
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
                      <div className="pdf-sub-title">TAARIFA ZA MDHAMINI {i}</div>
                      <div className="pdf-inner-grid">
                        <div className="pdf-item col-6"><span>Jina Kamili</span><strong>{renderVal(loan.details?.[`${p}JinaKamili`])}</strong></div>
                        <div className="pdf-item col-6" style={{ borderLeft: '1px solid #1a1a1a', padding: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', overflow: 'hidden' }}>
                          {(() => {
                            const photoUrl = loan?.[`guarantor_${i}_photo`] || loan.details?.[`guarantor${i}PhotoUrl`];
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
                                PHOTO HERE
                              </div>
                            );
                            const finalUrl = photoUrl.startsWith('http') ? photoUrl : `http://127.0.0.1:8000${photoUrl}`;
                            return <img src={finalUrl} alt={`Guarantor ${i}`} style={{ width: '100%', aspectRatio: '1.2', objectFit: 'cover', border: '1px solid #ddd' }} />;
                          })()}
                        </div>
                        <div className="pdf-item col-6"><span>Namba ya Simu</span><strong>{renderVal(loan.details?.[`${p}Simu`])}</strong></div>
                        <div className="pdf-item col-6"><span>Uhusiano</span><strong>{renderVal(loan.details?.[`${p}UhusianoWenu`])}</strong></div>
                        <div className="pdf-item col-6"><span>Kazi / Biashara</span><strong>{renderVal(loan.details?.[`${p}KaziAnayofanya`])}</strong></div>
                        <div className="pdf-item col-6"><span>Anuani ya Eneo</span><strong>{renderVal(loan.details?.[`${p}MahaliAnapoishi`])}</strong></div>
                        <div className="pdf-item col-6"><span>Nyumba / Makazi</span><strong># {renderVal(loan.details?.[`${p}NambaNyumba`])} ({renderVal(loan.details?.[`${p}AmepangaKwake`])}</strong></div>
                        <div className="pdf-item col-6"><span>Mwajiri / Ofisi</span><strong>{renderVal(loan.details?.[`${p}JinaKampuniBiashara`])} ({renderVal(loan.details?.[`${p}MahaliOfisiYake`])}</strong></div>
                        <div className="pdf-item col-6"><span>Sahihi Mdhamini</span><strong className={loan.details?.[`mdhamini${i}AmesainiFomuNgumu`] ? "text-success" : ""}>{loan.details?.[`mdhamini${i}AmesainiFomuNgumu`] ? "NDIYO / IMEWEKWA" : "HAPANA"}</strong></div>
                        <div className="pdf-item col-6"><span>Dole Gumba Mdhamini</span><strong className={loan.details?.[`mdhamini${i}AmewekaDoleGumba`] ? "text-success" : ""}>{loan.details?.[`mdhamini${i}AmewekaDoleGumba`] ? "NDIYO / IMEWEKWA" : "HAPANA"}</strong></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>


            {/* CHATTEL FORM */}
            {loan.details?.chattelItems && (
              <div className="pdf-section chattel-break">
                <div className="pdf-section-title">REHANI MALI (CHATTEL MORTGAGE)</div>
                <table className="pdf-table">
                  <thead><tr><th>Maelezo ya Mali</th><th>Thamani Soko</th><th>Thamani Dhamana (70%)</th></tr></thead>
                  <tbody>
                    {loan.details.chattelItems.map((item: any, idx: number) => (
                      <tr key={idx}><td>{item.jina} - {item.maelezo}</td><td>{formatMoney(item.thamaniSoko)}</td><td>{formatMoney(item.thamaniDhamana)}</td></tr>
                    ))}
                  </tbody>
                </table>
                <div className="pdf-inner-grid">
                  <div className="pdf-item col-4"><span>Jina la Mmiliki</span><strong>{loan.details.chattelOwnerName}</strong></div>
                  <div className="pdf-item col-4"><span>Jina la Mume/Mke</span><strong>{renderVal(loan.details.chattelSpouseName)}</strong></div>
                  <div className="pdf-item col-4"><span>Sahihi Mmiliki</span><strong className={loan.details.chattelOwnerSigned ? "text-success" : ""}>{loan.details.chattelOwnerSigned ? "[ IMEWEKWA ]" : <RedDash />}</strong></div>

                  <div className="pdf-item col-4"><span>Shahidi</span><strong>{renderVal(loan.details.chattelWitnessName)}</strong></div>
                  <div className="pdf-item col-4"><span>Uhusiano Shahidi</span><strong>{renderVal(loan.details.chattelWitnessRelationship)}</strong></div>
                  <div className="pdf-item col-4"><span>Sahihi Shahidi</span><strong className={loan.details.chattelWitnessSigned ? "text-success" : ""}>{loan.details.chattelWitnessSigned ? "[ IMEWEKWA ]" : <RedDash />}</strong></div>

                  <div className="pdf-item col-4"><span>Afisa Mikopo</span><strong>{renderVal(loan.details.chattelOfficerName)}</strong></div>
                  <div className="pdf-item col-4"><span>Tarehe ya Afisa</span><strong>{renderVal(loan.details.chattelOfficerDate)}</strong></div>
                  <div className="pdf-item col-4"><span>Sahihi Afisa</span><strong className={loan.details.chattelOfficerSigned ? "text-success" : ""}>{loan.details.chattelOfficerSigned ? "[ IMEWEKWA ]" : <RedDash />}</strong></div>

                  <div className="pdf-item col-4"><span>Mwenyekiti</span><strong>{renderVal(loan.details.chattelChairmanName)}</strong></div>
                  <div className="pdf-item col-4"><span>Tarehe ya M/Kiti</span><strong>{renderVal(loan.details.chattelChairmanDate)}</strong></div>
                  <div className="pdf-item col-4"><span>Gundi/Muhuri</span><strong className={loan.details.chattelChairmanStamp ? "text-success" : ""}>{loan.details.chattelChairmanStamp ? "[ IMEWEKWA ]" : <RedDash />}</strong></div>
                </div>
              </div>
            )}

            {/* DECLARATION */}
            <div className="pdf-section declaration-page">
              <div className="pdf-section-title">TAMKO LA MWOMBAJI NA DHIBITISHO</div>
              <p className="declaration-text">
                Mimi, <strong>{loan.name}</strong>, nathibitisha kuwa taarifa zote nilizotoa hapa juu ni za kweli na ni sawa kwa uelewa wangu.
                Ninakubaliana na masharti yote ya ORETHAN MICROFINANCE kuhusiana na mkopo huu.
              </p>
              <div className="pdf-inner-grid signature-grid">
                <div className="pdf-item col-4 no-border-right">
                  <span>Sahihi ya Mwombaji</span>
                  <div className="signature-line">
                    <strong className="text-success">{loan.details?.mwombajiAmesainiFomuNgumu ? "[ IMEWEKWA ]" : ""}</strong>
                  </div>
                </div>
                <div className="pdf-item col-4 no-border-right"><span>Tarehe</span> <div className="signature-line"><strong>{loan.created_at ? new Date(loan.created_at).toLocaleDateString() : <RedDash />}</strong></div></div>
                <div className="pdf-item col-4 no-border-right border-bottom">
                  <span>Alama ya Dole Gumba</span>
                  <div className="thumbprint-box">
                    {loan.details?.mwombajiAmewekaDoleGumba || loan.details?.mwombajiAmewekaDoleGumba2 ? <div className="thumbprint-indicator">IMEWEKWA</div> : null}
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
          @page { margin: 2mm; size: auto; }
          body * { visibility: hidden !important; }
          .modal-overlay { 
            visibility: visible !important; 
            background: white !important; 
            backdrop-filter: none !important; 
            position: absolute !important; 
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            display: block !important; 
          }
          .modal-content.modal-large.print-container { 
            visibility: visible !important;
            position: static !important; 
            width: 100% !important; 
            height: auto !important;
            margin: 0 !important; 
            padding: 0 !important;
            overflow: visible !important;
            display: block !important;
            box-shadow: none !important;
          }
          .modal-content.modal-large.print-container * { visibility: visible !important; }
          .no-print { display: none !important; }
          .pdf-form-body { 
            padding: 0 !important; 
            background: white !important; 
            overflow: visible !important; 
            height: auto !important;
            display: block !important;
            width: 100% !important;
          }
          .pdf-document-paper { 
            max-width: none !important; width: 100% !important; 
            box-shadow: none !important; padding: 0 !important; 
            margin: 0 !important;
            border: none !important;
          }
          .pdf-section { page-break-inside: avoid; border-top: 2px solid #000 !important; }
          .pdf-section:first-child { border-top: none !important; }
          
          .pdf-section-title, .pdf-section-title * {
             color: #000 !important;
             background: #f1f1f1 !important;
             font-weight: 900 !important;
             font-size: 18px !important;
             border-bottom: 2px solid #000 !important;
             -webkit-print-color-adjust: exact;
             print-color-adjust: exact;
          }

          /* Shrink the header so it doesn't eat up most of page 1 and push
             SEHEMU 1 (and everything after it) onto a near-blank page 2. */
          .pdf-page-header { padding: 6px 30px !important; }
          .logo-image-main { height: 70px !important; max-width: 130px !important; }
          .form-title { font-size: 18px !important; padding-bottom: 2px !important; }
          .form-code { font-size: 11px !important; }
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
