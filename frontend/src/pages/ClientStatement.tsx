import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE = '/api/v1';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const fmt = (n: number | null | undefined) => 'TZS ' + Math.round(n ?? 0).toLocaleString();
const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => { const d = new Date(); d.setMonth(0, 1); return d.toISOString().slice(0, 10); };

interface Tx {
  date: string; type: 'disbursement' | 'repayment' | 'penalty';
  description: string; debit: number; credit: number;
  loan_ref: string; receipt_no?: string;
}
interface Summary {
  total_loans: number; active_loans: number; total_disbursed: number;
  total_repaid: number; total_penalties: number; outstanding: number;
}
interface Customer {
  id: number; full_name: string; phone_number: string;
  national_id?: string; address?: string;
}
interface StatementData {
  customer: Customer; period_from: string | null; period_to: string;
  transactions: Tx[]; summary: Summary;
}

const TYPE_STYLE: Record<string, { color: string; label: string }> = {
  disbursement: { color: '#059669', label: 'Mkopo Uliotolewa' },
  repayment:    { color: '#0ea5e9', label: 'Malipo' },
  penalty:      { color: '#dc2626', label: 'Faini' },
};

export default function ClientStatement() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData]     = useState<StatementData | null>(null);
  const [loading, setLoading] = useState(false);
  const [from, setFrom]     = useState(yearStart());
  const [to, setTo]         = useState(today());
  const printRef            = useRef<HTMLDivElement>(null);

  const load = () => {
    if (!id) return;
    setLoading(true);
    axios.get(`${API_BASE}/customers/${id}/statement`, {
      headers: authHeaders(), params: { from, to }
    })
      .then(r => setData(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handlePrint = () => window.print();

  // Running balance calculation
  let balance = 0;
  const rows = (data?.transactions ?? []).map(tx => {
    balance += tx.credit - tx.debit;
    return { ...tx, balance };
  });

  return (
    <div style={{ fontFamily: 'Inter,system-ui,sans-serif', background: '#f0f4f8', minHeight: '100%' }}>
      <style>{`
        @media print {
          .no-print { display:none!important; }
          body, html { background:#fff!important; }
          .stmt-wrap { padding:0!important; background:#fff!important; }
          .stmt-card { box-shadow:none!important; border:1px solid #e2e8f0!important; }
          @page { margin:15mm; size:A4 portrait; }
        }
        .stmt-tx-row:hover { background:#f0f4ff!important; }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{ background: 'linear-gradient(135deg,#0a1628,#102a43,#1a3050)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '2px solid rgba(0,0,0,.4)', boxShadow: '0 2px 12px rgba(0,0,0,.3)', flexWrap: 'wrap' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>← Rudi</button>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 15, flex: 1 }}>📄 Taarifa ya Mteja</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ color: 'rgba(255,255,255,.6)', fontSize: 11, fontWeight: 600 }}>Tangu</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: '5px 8px', border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, fontSize: 12, background: 'rgba(255,255,255,.08)', color: '#fff', colorScheme: 'dark', outline: 'none', fontFamily: 'inherit' }} />
          <label style={{ color: 'rgba(255,255,255,.6)', fontSize: 11, fontWeight: 600 }}>Hadi</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: '5px 8px', border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, fontSize: 12, background: 'rgba(255,255,255,.08)', color: '#fff', colorScheme: 'dark', outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={load} style={{ padding: '6px 16px', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Tafuta</button>
          <button onClick={handlePrint} style={{ padding: '6px 16px', background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>🖨 Chapisha</button>
        </div>
      </div>

      <div className="stmt-wrap" style={{ padding: '24px 28px' }} ref={printRef}>
        {loading && <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>⏳ Inapakia...</div>}

        {data && (
          <>
            {/* Letterhead */}
            <div className="stmt-card" style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', boxShadow: '0 2px 12px rgba(0,0,0,.08)', border: '1px solid #e2e8f0', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #102a43', paddingBottom: 18, marginBottom: 20 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 20, color: '#102a43', letterSpacing: -.5 }}>TAARIFA YA MTEJA</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    Kipindi: {data.period_from ?? 'Mwanzo'} — {data.period_to}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Tarehe ya Kuchapishwa</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#102a43' }}>{new Date().toLocaleDateString('sw-TZ')}</div>
                </div>
              </div>

              {/* Customer info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Jina Kamili', value: data.customer.full_name },
                  { label: 'Simu', value: data.customer.phone_number },
                  { label: 'Kitambulisho', value: data.customer.national_id ?? '—' },
                  { label: 'Anwani', value: data.customer.address ?? '—' },
                ].map(f => (
                  <div key={f.label} style={{ borderLeft: '3px solid #4f46e5', paddingLeft: 10 }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4 }}>{f.label}</div>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, marginTop: 2 }}>{f.value}</div>
                  </div>
                ))}
              </div>

              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {[
                  { label: 'Mikopo Yote', value: data.summary.total_loans, fmt: false, color: '#4f46e5', bg: '#ede9fe' },
                  { label: 'Mikopo Hai', value: data.summary.active_loans, fmt: false, color: '#059669', bg: '#d1fae5' },
                  { label: 'Jumla Ilitolewa', value: data.summary.total_disbursed, fmt: true, color: '#0ea5e9', bg: '#e0f2fe' },
                  { label: 'Jumla Imelipwa', value: data.summary.total_repaid, fmt: true, color: '#059669', bg: '#d1fae5' },
                  { label: 'Faini Zote', value: data.summary.total_penalties, fmt: true, color: '#dc2626', bg: '#fee2e2' },
                  { label: 'Baki Inayodaiwa', value: data.summary.outstanding, fmt: true, color: '#d97706', bg: '#fef3c7' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '10px 14px', border: `1px solid ${s.color}22` }}>
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .3 }}>{s.label}</div>
                    <div style={{ fontWeight: 900, fontSize: 16, color: s.color, marginTop: 4 }}>
                      {s.fmt ? fmt(s.value as number) : s.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Transaction table */}
            <div className="stmt-card" style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,.08)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
                Historia ya Miamala ({rows.length})
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Tarehe', 'Aina', 'Maelezo', 'Mkopo wa Ref.', 'Nambari ya Risiti', 'Deni (Dr)', 'Mkopo (Cr)', 'Salio'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: .4, whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Hakuna miamala katika kipindi hiki</td></tr>
                    )}
                    {rows.map((tx, i) => {
                      const ts = TYPE_STYLE[tx.type] ?? { color: '#64748b', label: tx.type };
                      return (
                        <tr key={i} className="stmt-tx-row" style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>{tx.date}</td>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{ background: ts.color + '18', color: ts.color, borderRadius: 12, padding: '2px 8px', fontSize: 10, fontWeight: 700, border: `1px solid ${ts.color}44`, whiteSpace: 'nowrap' }}>{ts.label}</span>
                          </td>
                          <td style={{ padding: '9px 12px', color: '#374151', maxWidth: 200 }}>{tx.description}</td>
                          <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 11, color: '#4f46e5', fontWeight: 700 }}>{tx.loan_ref}</td>
                          <td style={{ padding: '9px 12px', color: '#64748b', fontSize: 11 }}>{tx.receipt_no ?? '—'}</td>
                          <td style={{ padding: '9px 12px', fontWeight: 700, color: '#dc2626', textAlign: 'right', whiteSpace: 'nowrap' }}>{tx.debit > 0 ? fmt(tx.debit) : '—'}</td>
                          <td style={{ padding: '9px 12px', fontWeight: 700, color: '#059669', textAlign: 'right', whiteSpace: 'nowrap' }}>{tx.credit > 0 ? fmt(tx.credit) : '—'}</td>
                          <td style={{ padding: '9px 12px', fontWeight: 800, color: tx.balance >= 0 ? '#0f172a' : '#dc2626', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(tx.balance)}</td>
                        </tr>
                      );
                    })}
                    {/* Totals row */}
                    {rows.length > 0 && (
                      <tr style={{ background: '#f0f4ff', borderTop: '2px solid #4f46e5' }}>
                        <td colSpan={5} style={{ padding: '10px 12px', fontWeight: 800, fontSize: 12, color: '#102a43' }}>JUMLA</td>
                        <td style={{ padding: '10px 12px', fontWeight: 900, color: '#dc2626', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(data.summary.total_repaid + data.summary.total_penalties)}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 900, color: '#059669', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(data.summary.total_disbursed)}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 900, color: '#102a43', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(data.summary.outstanding)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 10, color: '#94a3b8' }}>
              Taarifa hii ilitolewa tarehe {new Date().toLocaleDateString('sw-TZ')} · Taarifa hii ni ya msingi tu na haihitajiki kuthibitishwa
            </div>
          </>
        )}
      </div>
    </div>
  );
}
