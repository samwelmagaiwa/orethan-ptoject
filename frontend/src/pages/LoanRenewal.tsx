import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE = '/api/v1';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const fmt = (n: number) => 'TZS ' + Math.round(n ?? 0).toLocaleString();

interface Guarantor { name: string; phone: string; id_no?: string; address?: string; }
interface PrefillData {
  loan_id: number; loan_number: string; name: string; phone: string; type: string;
  previous_amount: number; suggested_amount: number;
  interest_rate?: number; loan_term?: number; repayment_period?: string; purpose?: string;
  customer?: { id: number; full_name: string; phone: string; national_id?: string };
  guarantors: Guarantor[];
  repayment_history: { total_paid: number; on_time: boolean; completed_at?: string };
}

export default function LoanRenewal() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [prefill, setPrefill] = useState<PrefillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [amount, setAmount]           = useState('');
  const [term, setTerm]               = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [purpose, setPurpose]         = useState('');
  const [repayPeriod, setRepayPeriod] = useState('monthly');

  useEffect(() => {
    axios.get(`${API_BASE}/loans/${id}/renewal-prefill`, { headers: authHeaders() })
      .then(r => {
        const d: PrefillData = r.data.data;
        setPrefill(d);
        setAmount(String(d.suggested_amount));
        setTerm(String(d.loan_term ?? 12));
        setInterestRate(String(d.interest_rate ?? ''));
        setPurpose(d.purpose ?? '');
        setRepayPeriod(d.repayment_period ?? 'monthly');
      })
      .catch(e => setError(e.response?.data?.message ?? 'Imeshindwa kupakia data ya mkopo'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async () => {
    if (!prefill) return;
    if (!amount || Number(amount) <= 0) { setError('Tafadhali ingiza kiasi cha mkopo'); return; }
    setSaving(true); setError('');
    try {
      const details = {
        loan_term: Number(term),
        interest_rate: Number(interestRate),
        purpose,
        repayment_period: repayPeriod,
        renewed_from_loan_id: prefill.loan_id,
      };
      const payload = {
        name: prefill.name,
        phone: prefill.phone,
        amount: Number(amount),
        type: prefill.type,
        customer_id: prefill.customer?.id,
        details,
      };
      const res = await axios.post(`${API_BASE}/loans`, payload, { headers: authHeaders() });
      const newId = res.data.data?.id ?? res.data.id;
      setSuccess(`Mkopo mpya umeundwa! Nambari: ${res.data.data?.loan_account_number ?? ''}`);
      setTimeout(() => navigate('/repayments'), 2000);
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Imeshindwa kuunda mkopo mpya');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ fontFamily: 'Inter,system-ui,sans-serif', background: '#f0f4f8', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0a1628,#102a43,#1a3050)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '2px solid rgba(0,0,0,.4)', boxShadow: '0 2px 12px rgba(0,0,0,.3)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>← Rudi</button>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>🔄 Ongeza Mkopo Mpya (Renewal)</div>
      </div>

      <div style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto' }}>
        {loading && <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>⏳ Inapakia...</div>}
        {error && !loading && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', color: '#dc2626', fontWeight: 600, marginBottom: 16 }}>{error}</div>}
        {success && <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 10, padding: '12px 16px', color: '#059669', fontWeight: 700, marginBottom: 16 }}>{success}</div>}

        {prefill && (
          <>
            {/* Previous loan summary */}
            <div style={{ background: 'linear-gradient(135deg,#0a1628,#102a43)', borderRadius: 16, padding: '20px 24px', marginBottom: 20, border: '1px solid rgba(255,255,255,.08)' }}>
              <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .6, marginBottom: 12 }}>Mkopo wa Awali — {prefill.loan_number}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                {[
                  { label: 'Kiasi cha Awali', value: fmt(prefill.previous_amount), color: '#94a3b8' },
                  { label: 'Imelipwa Jumla', value: fmt(prefill.repayment_history.total_paid), color: '#34d399' },
                  { label: 'Ilikamilika', value: prefill.repayment_history.completed_at ?? '—', color: '#38bdf8' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'rgba(255,255,255,.06)', borderRadius: 10, padding: '10px 14px', borderLeft: `3px solid ${s.color}` }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .4 }}>{s.label}</div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: s.color, marginTop: 4 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer & Guarantors info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#102a43', marginBottom: 12, borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>👤 Mteja</div>
                {[
                  { label: 'Jina', value: prefill.customer?.full_name ?? prefill.name },
                  { label: 'Simu', value: prefill.customer?.phone ?? prefill.phone },
                  { label: 'Kitambulisho', value: prefill.customer?.national_id ?? '—' },
                ].map(f => (
                  <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f8fafc', fontSize: 13 }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>{f.label}</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{f.value}</span>
                  </div>
                ))}
              </div>

              <div style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#102a43', marginBottom: 12, borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>🤝 Wadhamini</div>
                {prefill.guarantors.length === 0 && <div style={{ color: '#94a3b8', fontSize: 12 }}>Hakuna wadhamini wa awali</div>}
                {prefill.guarantors.map((g, i) => (
                  <div key={i} style={{ marginBottom: 8, padding: '8px 10px', background: '#f8fafc', borderRadius: 8, borderLeft: '3px solid #4f46e5' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{g.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{g.phone} {g.id_no ? `· ID: ${g.id_no}` : ''}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* New loan form */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '24px 24px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,.07)' }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#102a43', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                ✏️ Maelezo ya Mkopo Mpya
                <span style={{ background: '#d1fae5', color: '#059669', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, border: '1px solid #6ee7b7' }}>Imejazwa awali</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Kiasi cha Mkopo (TZS) *</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #4f46e5', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', fontWeight: 700, color: '#102a43', outline: 'none', boxSizing: 'border-box' }} />
                  <div style={{ fontSize: 11, color: '#059669', marginTop: 4 }}>💡 Mapendekezo: {fmt(prefill.suggested_amount)} (10% zaidi)</div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Muda wa Mkopo (Miezi)</label>
                  <input type="number" value={term} onChange={e => setTerm(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Kiwango cha Riba (%)</label>
                  <input type="number" value={interestRate} onChange={e => setInterestRate(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Mzunguko wa Malipo</label>
                  <select value={repayPeriod} onChange={e => setRepayPeriod(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                    <option value="monthly">Kila Mwezi</option>
                    <option value="weekly">Kila Wiki</option>
                    <option value="daily">Kila Siku</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Madhumuni ya Mkopo</label>
                  <textarea value={purpose} onChange={e => setPurpose(e.target.value)} rows={2}
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button onClick={() => navigate(-1)} style={{ padding: '10px 24px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#475569' }}>
                  Ghairi
                </button>
                <button onClick={handleSubmit} disabled={saving} style={{ padding: '10px 28px', background: 'linear-gradient(135deg,#059669,#047857)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 2px 8px rgba(5,150,105,.3)', opacity: saving ? .7 : 1 }}>
                  {saving ? '⏳ Inawasilisha...' : '✅ Wasilisha Mkopo Mpya'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
