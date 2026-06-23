import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import AlertModal from "../components/AlertModal";

// INLINE SVG ICONS
const IconArrowLeft = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>;
const IconCreditCard = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>;
const IconHistory = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><polyline points="3 3 3 8 8 8" /><path d="M12 7v5l4 2" /></svg>;
const IconDollarSign = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;

const LoanRepayments: React.FC = () => {
  const { id } = useParams(); // customer ID
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<any>(null);
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [repaying, setRepaying] = useState(false);

  // Form state
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [transactionId, setTransactionId] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState<"success" | "error" | "info" | "warning">("info");

  useEffect(() => {
    fetchCustomerAndLoans();
  }, [id]);

  const fetchCustomerAndLoans = async () => {
    try {
      const token = localStorage.getItem("token");
      const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
      const res = await axios.get(`${API_BASE}/customers/${id}`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      setCustomer(res.data);
      if (res.data.loans.length > 0) {
        setSelectedLoan(res.data.loans.find((l: any) => l.status === 'disbursed') || res.data.loans[0]);
      }
    } catch (err) {
      console.error(err);
      setModalMessage("Imeshindwa kupata taarifa za mteja");
      setModalType("error");
      setShowModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan || !amount) return;

    if (Number(amount) > Number(selectedLoan.remaining_balance)) {
      setModalMessage(`Kiasi kinachozidi deni lililobaki (Tsh ${Number(selectedLoan.remaining_balance).toLocaleString()})`);
      setModalType("warning");
      setShowModal(true);
      return;
    }

    setRepaying(true);
    try {
      const token = localStorage.getItem("token");
      const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
      await axios.post(`${API_BASE}/loans/${selectedLoan.id}/repay`, {
        amount: Number(amount),
        payment_date: paymentDate,
        payment_method: method,
        notes: notes,
        transaction_id: transactionId
      }, {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });

      setModalMessage("Malipo yamefanikiwa kurekodiwa!");
      setModalType("success");
      setShowModal(true);

      // Reset form
      setAmount("");
      setNotes("");
      setTransactionId("");

      // Refresh data
      fetchCustomerAndLoans();
    } catch (err: any) {
      console.error(err);
      setModalMessage(err.response?.data?.error || "Imeshindwa kurekodi malipo");
      setModalType("error");
      setShowModal(true);
    } finally {
      setRepaying(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc', gap: '20px' }}>
      <div className="shimmer-spinner"></div>
      <div style={{ color: '#64748b', fontSize: '1.1rem', fontWeight: '800', letterSpacing: '1px' }}>INAPAKIA...</div>
      <style>{`
        .shimmer-spinner {
          width: 60px;
          height: 60px;
          border: 4px solid #e2e8f0;
          border-top: 4px solid #2563eb;
          border-radius: 50%;
          animation: spin-premium 1s linear infinite;
          box-shadow: 0 0 15px rgba(37, 99, 235, 0.2);
        }
        @keyframes spin-premium {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  return (
    <div className="repayment-page" style={{ padding: '2rem', background: '#f8fafc', minHeight: '100vh' }}>
      <AlertModal
        isOpen={showModal}
        message={modalMessage}
        type={modalType}
        onClose={() => setShowModal(false)}
      />

      <button onClick={() => navigate(`/customers/${id}`)} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <IconArrowLeft /> Rudi kwa Mteja
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '2rem' }}>

        {/* LEFT: FORM & LOAN SELECTOR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          <div style={{ background: 'white', borderRadius: '24px', padding: '2rem', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1e293b', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <IconCreditCard /> Rekodi Malipo kwa {customer?.full_name}
            </h2>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', color: '#64748b', marginBottom: '1rem' }}>CHAGUA MKOPO</label>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {customer.loans.map((loan: any) => (
                  <button
                    key={loan.id}
                    onClick={() => setSelectedLoan(loan)}
                    style={{
                      padding: '1rem',
                      borderRadius: '16px',
                      border: selectedLoan?.id === loan.id ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: selectedLoan?.id === loan.id ? '#eff6ff' : 'white',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      minWidth: '200px'
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>{loan.type.replace(/_/g, ' ')}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1e293b' }}>Tsh {loan.amount.toLocaleString()}</div>
                    <div style={{ fontSize: '0.8rem', color: loan.status === 'disbursed' ? '#2563eb' : '#16a34a', fontWeight: '600' }}>
                      Baki: Tsh {Number(loan.remaining_balance).toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleRepay}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Kiasi cha Fedha (Tsh)</label>
                  <input
                    type="number"
                    required
                    placeholder="Weka kiasi..."
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={{ padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Tarehe ya Malipo</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    style={{ padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Njia ya Malipo</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    style={{ padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem' }}
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="mobile_money">Mobile Money (M-Pesa/AirtelMoney/TigoPesa)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Transaction ID (Kama ipo)</label>
                  <input
                    type="text"
                    placeholder="Reference number..."
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    style={{ padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Maelezo ya Ziada</label>
                <textarea
                  placeholder="Notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', minHeight: '100px', fontSize: '1rem' }}
                />
              </div>

              <button
                type="submit"
                disabled={repaying || !selectedLoan}
                style={{
                  width: '100%',
                  padding: '1.2rem',
                  borderRadius: '16px',
                  background: '#2563eb',
                  color: 'white',
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  border: 'none',
                  cursor: repaying ? 'not-allowed' : 'pointer',
                  boxShadow: '0 10px 15px -3px rgb(37 99 235 / 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.8rem',
                  opacity: repaying ? 0.7 : 1
                }}
              >
                {repaying ? "Inatuma..." : <><IconDollarSign /> Kamilisha Malipo</>}
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT: HISTORY */}
        <div>
          <div style={{ background: 'white', borderRadius: '24px', padding: '1.5rem', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1e293b', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <IconHistory /> Historia ya Malipo
            </h3>

            {!selectedLoan?.repayments || selectedLoan.repayments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                Hakuna malipo yaliyorekodiwa kwa mkopo huu.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {selectedLoan.repayments.map((r: any) => (
                  <div key={r.id} style={{ padding: '1rem', border: '1px solid #f1f5f9', borderRadius: '12px', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: '700', color: '#1e293b' }}>Tsh {Number(r.amount).toLocaleString()}</span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(r.payment_date).toLocaleDateString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: '#64748b' }}>{r.payment_method.replace('_', ' ')}</span>
                      <span style={{ color: '#2563eb', fontWeight: '600' }}>{r.receipt_number}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoanRepayments;
