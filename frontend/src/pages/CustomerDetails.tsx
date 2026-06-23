import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import AlertModal from "../components/AlertModal";

// INLINE SVG ICONS
const IconArrowLeft = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>;
const IconMapPin = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IconPhone = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const IconFingerprint = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12a10 10 0 0 1 18 0"/><path d="M7 12a5 5 0 0 1 5-5"/><path d="M12 12a5 5 0 0 1 5-5"/><path d="M12 7V3"/><path d="M12 21v-4"/><path d="M12 12v3"/><path d="M12 15a3 3 0 0 1 3-3"/></svg>;
const IconShield = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IconCreditCard = ({ size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
const IconHistory = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/><path d="M12 7v5l4 2"/></svg>;
const IconFileText = ({ size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
const IconTrendingDown = ({ size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 17L13.5 8.5L8.5 13.5L2 7"/><polyline points="16 17 22 17 22 11"/></svg>;

interface Loan {
  id: number;
  type: string;
  amount: number;
  remaining_balance: number;
  total_paid: number;
  status: string;
  created_at: string;
  arrears: number;
  penalty: number;
  repayments: any[];
  schedules: any[];
}

interface Customer {
  id: number;
  full_name: string;
  phone_number: string;
  email: string;
  nida_number: string;
  region: string;
  district: string;
  ward: string;
  street: string;
  residency_type: string;
  gender: string;
  date_of_birth: string;
  loans: Loan[];
}

const CustomerDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState<"success" | "error" | "info" | "warning">("info");

  useEffect(() => {
    fetchCustomerDetails();
  }, [id]);

  const fetchCustomerDetails = async () => {
    try {
      const token = localStorage.getItem("token");
      const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
      const res = await axios.get(`${API_BASE}/customers/${id}`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      setCustomer(res.data);
    } catch (err) {
      console.error(err);
      setModalMessage("Imeshindwa kupata taarifa za mteja");
      setModalType("error");
      setShowModal(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
      <div className="loader"></div>
    </div>
  );

  if (!customer) return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Mteja hajapatikana</h2>
      <button onClick={() => navigate("/customers")} style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '1rem' }}>
        Rudi Nyuma
      </button>
    </div>
  );

  return (
    <div className="customer-details-page" style={{ padding: '2rem', background: '#f8fafc', minHeight: '100vh' }}>
      <AlertModal 
        isOpen={showModal} 
        message={modalMessage} 
        type={modalType} 
        onClose={() => setShowModal(false)} 
      />

      {/* TOP NAVIGATION */}
      <button 
        onClick={() => navigate("/customers")}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem', 
          background: 'none', 
          border: 'none', 
          color: '#64748b', 
          fontWeight: '600', 
          cursor: 'pointer',
          marginBottom: '1.5rem',
          transition: 'color 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.color = '#1e293b'}
        onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
      >
        <IconArrowLeft /> Rudi kwa Wateja
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem' }}>
        
        {/* LEFT COLUMN: PROFILE CARD */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ 
            background: 'white', 
            borderRadius: '24px', 
            padding: '2rem', 
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
            textAlign: 'center'
          }}>
            <div style={{ 
              width: '100px', 
              height: '100px', 
              borderRadius: '30px', 
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: '2.5rem',
              fontWeight: '800',
              color: 'white',
              margin: '0 auto 1.5rem auto',
              boxShadow: '0 10px 15px -3px rgb(37 99 235 / 0.3)'
            }}>
              {customer.full_name.charAt(0)}
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1e293b', marginBottom: '0.25rem' }}>{customer.full_name}</h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Mteja wa Mkopo</p>
            
            <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: '#475569' }}>
                <IconPhone />
                <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>{customer.phone_number}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: '#475569' }}>
                <IconFingerprint />
                <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>NIDA: {customer.nida_number || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: '#475569' }}>
                <IconMapPin />
                <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>{customer.street}, {customer.ward}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: '#475569' }}>
                <IconShield />
                <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>{customer.residency_type} Resident</span>
              </div>
            </div>
          </div>

          {/* QUICK STATS */}
          <div style={{ 
            background: '#1e293b', 
            borderRadius: '24px', 
            padding: '1.5rem', 
            color: 'white',
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <IconTrendingDown size={16} /> Muhtasari wa Fedha
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Jumla ya Mikopo</span>
                <span style={{ fontWeight: '700' }}>{customer.loans.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Madeni Amilifu</span>
                <span style={{ fontWeight: '700' }}>{customer.loans.filter(l => l.status === 'disbursed').length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #334155', paddingTop: '1rem' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Deni Lililobaki</span>
                <span style={{ fontWeight: '800', fontSize: '1.1rem', color: '#38bdf8' }}>
                  Tsh {customer.loans.reduce((sum, l) => sum + Number(l.remaining_balance), 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: LOAN HISTORY & DETAILS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div style={{ 
            background: 'white', 
            borderRadius: '24px', 
            padding: '2rem', 
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1e293b', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <IconHistory /> Historia ya Mikopo
            </h3>

            {customer.loans.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                Hakuna mikopo iliyorekodiwa kwa mteja huyu.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                {customer.loans.map((loan) => (
                  <div key={loan.id} style={{ 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '16px', 
                    padding: '1.5rem',
                    transition: 'all 0.2s',
                  }} className="loan-card-hover">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {loan.type.replace(/_/g, ' ')}
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1e293b' }}>
                          Tsh {loan.amount.toLocaleString()}
                        </div>
                      </div>
                      <span style={{ 
                        padding: '0.4rem 0.8rem', 
                        borderRadius: '10px', 
                        fontSize: '0.75rem', 
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        background: loan.status === 'disbursed' ? '#eff6ff' : loan.status === 'completed' ? '#f0fdf4' : '#f1f5f9',
                        color: loan.status === 'disbursed' ? '#2563eb' : loan.status === 'completed' ? '#16a34a' : '#475569',
                      }}>
                        {loan.status}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Deni Lililobaki</span>
                        <span style={{ fontWeight: '700', color: '#1e293b' }}>Tsh {Number(loan.remaining_balance).toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Malimbikizo (Arrears)</span>
                        <span style={{ fontWeight: '700', color: loan.arrears > 0 ? '#e11d48' : '#16a34a' }}>
                          Tsh {Number(loan.arrears).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Baki ya Adhabu</span>
                         <span style={{ fontWeight: '700', color: loan.penalty > 0 ? '#f59e0b' : '#16a34a' }}>
                          Tsh {Number(loan.penalty).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Tarehe</span>
                        <span style={{ fontWeight: '700', color: '#1e293b' }}>{new Date(loan.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* PROGRESS BAR */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.4rem' }}>
                        <span style={{ color: '#64748b' }}>Maendeleo ya Marejesho</span>
                        <span style={{ fontWeight: '700', color: '#2563eb' }}>
                           {loan.amount > 0 ? Math.round((Number(loan.total_paid) / loan.amount) * 100) : 0}%
                        </span>
                      </div>
                      <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${loan.amount > 0 ? Math.round((Number(loan.total_paid) / loan.amount) * 100) : 0}%`, 
                          height: '100%', 
                          background: '#2563eb',
                          borderRadius: '10px'
                        }}></div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button 
                        onClick={() => window.location.href = `/loans/${loan.id}/schedule`}
                        style={{ 
                          flex: 1,
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          gap: '0.5rem', 
                          padding: '0.7rem', 
                          borderRadius: '12px', 
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          color: '#475569',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        <IconFileText /> Schedule
                      </button>
                      <button 
                         onClick={() => navigate(`/customers/${customer.id}/repayments`)}
                        style={{ 
                          flex: 1,
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          gap: '0.5rem', 
                          padding: '0.7rem', 
                          borderRadius: '12px', 
                          background: '#2563eb',
                          border: 'none',
                          color: 'white',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        <IconCreditCard /> Record Repayment
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .loader {
          width: 48px;
          height: 48px;
          border: 5px solid #E2E8F0;
          border-bottom-color: #2563eb;
          border-radius: 50%;
          display: inline-block;
          box-sizing: border-box;
          animation: rotation 1s linear infinite;
        }
        @keyframes rotation {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .loan-card-hover:hover {
          border-color: #2563eb !important;
          box-shadow: 0 4px 6px -1px rgb(37 99 235 / 0.1);
        }
      `}</style>
    </div>
  );
};

export default CustomerDetails;
