import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = '/api/v1';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const fmt = (n: number) => 'TZS ' + Math.round(n ?? 0).toLocaleString();
const today = () => new Date().toISOString().slice(0, 10);

interface OfficerRow {
  user_id: number; name: string; role: string;
  expected_amount: number; due_count: number;
  actual_collected: number; repayment_count: number;
  penalty_collected: number; variance: number;
  collection_rate: number; status: 'full' | 'partial' | 'low';
}
interface Totals {
  expected_amount: number; actual_collected: number; penalty_collected: number;
  variance: number; collection_rate: number; officers_count: number;
}
interface EodData { date: string; officers: OfficerRow[]; totals: Totals; }

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string; border: string }> = {
  full:    { bg: '#d1fae5', text: '#059669', label: '✅ Imekamilika',  border: '#6ee7b7' },
  partial: { bg: '#fef3c7', text: '#d97706', label: '⚠️ Sehemu',      border: '#fcd34d' },
  low:     { bg: '#fee2e2', text: '#dc2626', label: '❌ Chini',        border: '#fca5a5' },
};

export default function EodCashReport() {
  const [date, setDate]     = useState(today());
  const [data, setData]     = useState<EodData | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<keyof OfficerRow>('actual_collected');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const load = () => {
    setLoading(true);
    axios.get(`${API_BASE}/reports/eod-cash`, { headers: authHeaders(), params: { date } })
      .then(r => setData(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const sorted = data ? [...data.officers].sort((a, b) => {
    const av = a[sortKey] as number, bv = b[sortKey] as number;
    return sortDir === 'asc' ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
  }) : [];

  const th = (key: keyof OfficerRow, label: string, right = false) => (
    <th onClick={() => { setSortKey(key); setSortDir(d => sortKey === key ? (d === 'asc' ? 'desc' : 'asc') : 'desc'); }}
      style={{ padding: '10px 14px', textAlign: right ? 'right' : 'left', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: .4, cursor: 'pointer', whiteSpace: 'nowrap', background: '#f8fafc' }}>
      {label}{sortKey === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
    </th>
  );

  const t = data?.totals;

  return (
    <div style={{ fontFamily: 'Inter,system-ui,sans-serif', background: '#f0f4f8', minHeight: '100%' }}>
      <style>{`
        @media print {
          .no-print { display:none!important; }
          body { background:#fff; }
          @page { margin:12mm; size:A4 landscape; }
        }
        .eod-row:hover { background:#f0f4ff!important; }
      `}</style>

      {/* Header */}
      <div style={{ background: '#f1f5f9', display: 'flex', alignItems: 'stretch', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10, minHeight: 50, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', flex: 1 }}>
          <span style={{ fontSize: 18 }}>🏦</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#102a43' }}>Ripoti ya Fedha ya Siku (EOD)</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Makusanyo halisi vs. yanayotarajiwa kwa kila afisa</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', borderLeft: '1px solid #e2e8f0', background: '#f1f5f9' }} className="no-print">
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, background: '#fff', color: '#102a43', outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={load} style={{ padding: '6px 16px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Tafuta</button>
          <button onClick={() => window.print()} style={{ padding: '6px 14px', background: '#fff', color: '#102a43', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>🖨 Chapisha</button>
        </div>
      </div>

      <div style={{ padding: '24px 28px' }}>
        {loading && <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>⏳ Inapakia...</div>}

        {data && (
          <>
            {/* Totals strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Inayotarajiwa',  value: fmt(t!.expected_amount),   icon: '📋', color: '#4f46e5', bg: '#ede9fe' },
                { label: 'Iliyokusanywa',  value: fmt(t!.actual_collected),   icon: '💰', color: '#059669', bg: '#d1fae5' },
                { label: 'Faini',          value: fmt(t!.penalty_collected),  icon: '⚖️', color: '#d97706', bg: '#fef3c7' },
                { label: 'Tofauti',        value: fmt(t!.variance),           icon: t!.variance >= 0 ? '📈' : '📉', color: t!.variance >= 0 ? '#059669' : '#dc2626', bg: t!.variance >= 0 ? '#d1fae5' : '#fee2e2' },
                { label: 'Kiwango (%)',    value: `${t!.collection_rate}%`,   icon: '📊', color: t!.collection_rate >= 90 ? '#059669' : t!.collection_rate >= 60 ? '#d97706' : '#dc2626', bg: '#f0f4f8' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: '16px 18px', border: `1px solid ${s.color}22`, boxShadow: '0 1px 4px rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 24 }}>{s.icon}</span>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 16, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Collection rate visual bar */}
            <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 6px rgba(0,0,0,.07)', border: '1px solid #e2e8f0', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#102a43' }}>
                <span>Kiwango cha Ukusanyaji wa Leo ({date})</span>
                <span style={{ color: t!.collection_rate >= 90 ? '#059669' : t!.collection_rate >= 60 ? '#d97706' : '#dc2626' }}>{t!.collection_rate}%</span>
              </div>
              <div style={{ height: 12, background: '#e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, t!.collection_rate)}%`, background: t!.collection_rate >= 90 ? 'linear-gradient(90deg,#059669,#34d399)' : t!.collection_rate >= 60 ? 'linear-gradient(90deg,#d97706,#fbbf24)' : 'linear-gradient(90deg,#dc2626,#f87171)', borderRadius: 12, transition: 'width .8s ease' }} />
              </div>
            </div>

            {/* Officer table */}
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,.08)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
                Utendaji wa Maafisa ({data.officers.length})
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {th('name', 'Afisa')}
                      {th('due_count', 'Malipo Yanay.', true)}
                      {th('expected_amount', 'Inayotarajiwa', true)}
                      {th('repayment_count', 'Malipo Halisi', true)}
                      {th('actual_collected', 'Iliyokusanywa', true)}
                      {th('penalty_collected', 'Faini', true)}
                      {th('variance', 'Tofauti', true)}
                      {th('collection_rate', 'Kiwango', true)}
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: .4, background: '#f8fafc' }}>Hali</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 && (
                      <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Hakuna data kwa tarehe hii</td></tr>
                    )}
                    {sorted.map((o, i) => {
                      const ss = STATUS_STYLE[o.status];
                      return (
                        <tr key={o.user_id} className="eod-row" style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '11px 14px' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{o.name}</div>
                            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'capitalize' }}>{o.role?.replace(/_/g, ' ')}</div>
                          </td>
                          <td style={{ padding: '11px 14px', textAlign: 'right', color: '#475569', fontWeight: 600 }}>{o.due_count}</td>
                          <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: '#4f46e5' }}>{fmt(o.expected_amount)}</td>
                          <td style={{ padding: '11px 14px', textAlign: 'right', color: '#475569', fontWeight: 600 }}>{o.repayment_count}</td>
                          <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>{fmt(o.actual_collected)}</td>
                          <td style={{ padding: '11px 14px', textAlign: 'right', color: '#d97706', fontWeight: 700 }}>{fmt(o.penalty_collected)}</td>
                          <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 800, color: o.variance >= 0 ? '#059669' : '#dc2626' }}>
                            {o.variance >= 0 ? '+' : ''}{fmt(o.variance)}
                          </td>
                          <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                            <div style={{ height: 6, background: '#e2e8f0', borderRadius: 6, overflow: 'hidden', width: 80, marginLeft: 'auto', marginBottom: 2 }}>
                              <div style={{ height: '100%', width: `${Math.min(100, o.collection_rate)}%`, background: o.collection_rate >= 90 ? '#059669' : o.collection_rate >= 60 ? '#f59e0b' : '#dc2626', borderRadius: 6 }} />
                            </div>
                            <span style={{ fontWeight: 800, fontSize: 12, color: o.collection_rate >= 90 ? '#059669' : o.collection_rate >= 60 ? '#d97706' : '#dc2626' }}>{o.collection_rate}%</span>
                          </td>
                          <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                            <span style={{ background: ss.bg, color: ss.text, border: `1px solid ${ss.border}`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{ss.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Totals footer */}
                    {sorted.length > 0 && (
                      <tr style={{ background: '#f0f4ff', borderTop: '2px solid #4f46e5' }}>
                        <td style={{ padding: '11px 14px', fontWeight: 900, color: '#102a43', fontSize: 12 }}>JUMLA ({t!.officers_count} Maafisa)</td>
                        <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 800, color: '#475569' }}>{data.officers.reduce((s, o) => s + o.due_count, 0)}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 900, color: '#4f46e5' }}>{fmt(t!.expected_amount)}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 800, color: '#475569' }}>{data.officers.reduce((s, o) => s + o.repayment_count, 0)}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 900, color: '#059669' }}>{fmt(t!.actual_collected)}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 900, color: '#d97706' }}>{fmt(t!.penalty_collected)}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 900, color: t!.variance >= 0 ? '#059669' : '#dc2626' }}>{t!.variance >= 0 ? '+' : ''}{fmt(t!.variance)}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 900, color: '#102a43' }}>{t!.collection_rate}%</td>
                        <td />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
