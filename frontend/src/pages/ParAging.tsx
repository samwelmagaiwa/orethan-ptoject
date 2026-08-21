import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = '/api/v1';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const fmt = (n: number) => 'TZS ' + Math.round(n ?? 0).toLocaleString();
const pct = (n: number) => `${(n ?? 0).toFixed(1)}%`;

interface BucketLoan {
  loan_id: number; loan_number: string; borrower: string; phone: string;
  officer: string; amount: number; outstanding: number; dpd: number;
  overdue_since: string; status: string;
}
interface Bucket {
  label: string; count: number; outstanding: number; par_pct: number; loans: BucketLoan[];
}
interface ParAgingData {
  total_outstanding_portfolio: number; total_at_risk: number;
  total_at_risk_count: number; buckets: Record<string, Bucket>; as_of: string;
}

const BUCKET_COLORS: Record<string, { bg: string; border: string; text: string; bar: string; badge: string }> = {
  '1_30':  { bg: '#fefce8', border: '#fbbf24', text: '#92400e', bar: '#f59e0b', badge: '#fef3c7' },
  '31_60': { bg: '#fff7ed', border: '#f97316', text: '#9a3412', bar: '#ea580c', badge: '#ffedd5' },
  '61_90': { bg: '#fef2f2', border: '#f87171', text: '#991b1b', bar: '#dc2626', badge: '#fee2e2' },
  '90+':   { bg: '#fdf4ff', border: '#c026d3', text: '#701a75', bar: '#a21caf', badge: '#fae8ff' },
};

export default function ParAging() {
  const [data, setData]     = useState<ParAgingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [drill, setDrill]   = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<keyof BucketLoan>('dpd');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    setLoading(true);
    axios.get(`${API_BASE}/reports/risk/par-aging`, { headers: authHeaders() })
      .then(r => setData(r.data.data))
      .catch(() => setError('Imeshindwa kupakia data ya PAR'))
      .finally(() => setLoading(false));
  }, []);

  const bucketKeys = ['1_30', '31_60', '61_90', '90+'];
  const maxCount = data ? Math.max(...bucketKeys.map(k => data.buckets[k]?.count ?? 0), 1) : 1;
  const maxAmt   = data ? Math.max(...bucketKeys.map(k => data.buckets[k]?.outstanding ?? 0), 1) : 1;

  const drillBucket = drill && data ? data.buckets[drill] : null;
  const drillLoans  = drillBucket ? [...drillBucket.loans]
    .filter(l => !search || l.borrower.toLowerCase().includes(search.toLowerCase()) || l.loan_number.toLowerCase().includes(search.toLowerCase()) || l.officer.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortKey] as number | string, bv = b[sortKey] as number | string;
      return sortDir === 'asc' ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    }) : [];

  const thSort = (key: keyof BucketLoan, label: string) => (
    <th onClick={() => { setSortKey(key); setSortDir(d => sortKey === key ? (d === 'asc' ? 'desc' : 'asc') : 'desc'); }}
      style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: .4, cursor: 'pointer', whiteSpace: 'nowrap', background: '#f8fafc' }}>
      {label}{sortKey === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
    </th>
  );

  return (
    <div className="par-print-root" style={{ padding: '0', fontFamily: 'Inter,system-ui,sans-serif', background: '#f0f4f8', minHeight: '100%' }}>
      <style>{`
        /* @page must be top-level — cannot be nested inside @media print */
        @page { size:A4 landscape; margin:12mm 14mm; }

        @media print {
          /* Hide all app chrome */
          .no-print,
          .par-cards-grid,
          .par-summary-strip,
          .par-page-header,
          .nb, .nb__left, .nb__right, .nb__portal,
          [class^="sd-"], [class*=" sd-"] { display:none!important; }

          /* Override App layout wrappers — remove height:100vh and overflow:hidden
             so all table rows render and are not clipped */
          html, body {
            background:#fff!important; margin:0!important; padding:0!important;
            height:auto!important; overflow:visible!important;
          }
          #root,
          #root > div,
          #root > div > div {
            display:block!important; width:100%!important;
            height:auto!important; max-height:none!important;
            overflow:visible!important; position:static!important;
            margin:0!important; padding:0!important;
            background:#fff!important; flex:none!important;
          }

          /* Report container */
          .par-print-root {
            display:block!important; width:100%!important;
            padding:0!important; background:#fff!important;
            margin:0!important; min-height:unset!important;
          }
          .par-print-root > div { padding:0!important; }

          /* Print header */
          .par-print-header { display:block!important; margin-bottom:14px!important; }

          /* Table: full width, no scroll clipping */
          .par-drill-table {
            box-shadow:none!important; border:1.5px solid #cbd5e1!important;
            border-radius:4px!important; width:100%!important;
            overflow:visible!important;
          }
          .par-drill-table > div {
            overflow:visible!important; width:100%!important;
          }
          .par-drill-table table {
            table-layout:auto!important; font-size:10.5px!important;
            width:100%!important; border-collapse:collapse!important;
          }
          .par-drill-table colgroup { display:none!important; }
          .par-drill-table td, .par-drill-table th {
            white-space:normal!important; word-break:break-word!important;
            padding:7px 10px!important;
          }
          .par-drill-row:hover { background:transparent!important; }
          tr { break-inside:avoid; }
        }

        /* Hidden on screen, shown on print */
        .par-print-header { display:none; }

        .par-card { transition:box-shadow .15s,transform .15s; }
        .par-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,.13)!important; }
        .par-drill-row:hover { background:#f0f4ff!important; }
      `}</style>

      {/* Print-only header */}
      <div className="par-print-header" style={{ borderBottom: '2px solid #102a43', paddingBottom: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18, color: '#102a43' }}>Orethan Microfinance</div>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#334155', marginTop: 2 }}>PAR Aging Ladder — Portfolio At Risk Report</div>
            {drill && drillBucket && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Bucket: {drillBucket.label} · {drillBucket.count} mikopo · {fmt(drillBucket.outstanding)}</div>}
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: '#64748b' }}>
            <div>Kuhusu: {data?.as_of ?? '—'}</div>
            <div>Imechapishwa: {new Date().toLocaleDateString('sw-TZ', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="par-page-header" style={{ background: '#f1f5f9', display: 'flex', alignItems: 'stretch', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10, minHeight: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', flex: 1 }}>
          <span style={{ fontSize: 18 }}>📊</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#102a43' }}>PAR Aging Ladder</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Portfolio At Risk · Uchambuzi wa Mikopo Iliyochelewa</div>
          </div>
          {data && <span style={{ marginLeft: 10, fontSize: 11, color: '#94a3b8' }}>Kuhusu: {data.as_of}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', borderLeft: '1px solid #e2e8f0', background: '#f1f5f9' }} className="no-print">
          <button onClick={() => window.print()} style={{ padding: '6px 14px', background: '#fff', color: '#102a43', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>🖨 Chapisha</button>
        </div>
      </div>

      <div style={{ padding: '24px 28px' }}>
        {loading && <div style={{ textAlign: 'center', padding: 80, color: '#64748b' }}>⏳ Inapakia...</div>}
        {error   && <div style={{ textAlign: 'center', padding: 40, color: '#dc2626' }}>{error}</div>}

        {data && (
          <>
            {/* Summary strip */}
            <div className="par-summary-strip" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Mkoba Wote', value: fmt(data.total_outstanding_portfolio), icon: '💼', color: '#102a43', bg: '#e0e7ef' },
                { label: 'Yenye Hatari (PAR)', value: fmt(data.total_at_risk), icon: '⚠️', color: '#dc2626', bg: '#fee2e2' },
                { label: 'Mikopo Yenye Hasara', value: `${data.total_at_risk_count} mikopo`, icon: '📋', color: '#d97706', bg: '#fef3c7' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, border: `1px solid ${s.color}22`, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
                  <span style={{ fontSize: 28 }}>{s.icon}</span>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 18, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bucket cards */}
            <div className="par-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
              {bucketKeys.map(key => {
                const b = data.buckets[key];
                const c = BUCKET_COLORS[key];
                const active = drill === key;
                if (!b) return null;
                return (
                  <div key={key} className="par-card" onClick={() => setDrill(active ? null : key)} style={{ background: active ? c.border : '#fff', borderRadius: 16, padding: '20px 18px', border: `2px solid ${active ? c.border : c.border + '60'}`, boxShadow: active ? `0 8px 28px ${c.bar}44` : '0 2px 8px rgba(0,0,0,.06)', cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <span style={{ background: active ? 'rgba(255,255,255,.25)' : c.badge, color: active ? '#fff' : c.text, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 800, border: `1px solid ${active ? 'rgba(255,255,255,.3)' : c.border}` }}>{b.label}</span>
                      <span style={{ fontWeight: 900, fontSize: 22, color: active ? '#fff' : c.text }}>{b.count}</span>
                    </div>
                    {/* Count bar */}
                    <div style={{ height: 6, background: active ? 'rgba(255,255,255,.25)' : '#e2e8f0', borderRadius: 6, marginBottom: 10, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(b.count / maxCount) * 100}%`, background: active ? '#fff' : c.bar, borderRadius: 6, transition: 'width .6s ease' }} />
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: active ? '#fff' : c.text, marginBottom: 2 }}>{fmt(b.outstanding)}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: active ? 'rgba(255,255,255,.7)' : '#64748b', fontWeight: 600 }}>Karatasi ya Hatari</span>
                      <span style={{ fontWeight: 800, fontSize: 13, color: active ? '#fff' : c.bar }}>PAR {pct(b.par_pct)}</span>
                    </div>
                    {/* Amount bar */}
                    <div style={{ height: 4, background: active ? 'rgba(255,255,255,.2)' : '#e2e8f0', borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(b.outstanding / maxAmt) * 100}%`, background: active ? 'rgba(255,255,255,.6)' : c.bar, borderRadius: 4, transition: 'width .6s ease' }} />
                    </div>
                    <div style={{ marginTop: 8, fontSize: 10, color: active ? 'rgba(255,255,255,.65)' : '#94a3b8', textAlign: 'center' }}>{active ? '▲ Bonyeza kufunga' : '▼ Bonyeza kuona mikopo'}</div>
                  </div>
                );
              })}
            </div>

            {/* Drill-down table */}
            {drill && drillBucket && (
              <div className="par-drill-table" style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,.08)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>Mikopo: {drillBucket.label}</span>
                    <span style={{ marginLeft: 10, background: BUCKET_COLORS[drill].badge, color: BUCKET_COLORS[drill].text, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, border: `1px solid ${BUCKET_COLORS[drill].border}` }}>{drillBucket.count} mikopo · {fmt(drillBucket.outstanding)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} className="no-print">
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tafuta mkopaji / nambari / afisa..." style={{ padding: '7px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', outline: 'none', width: 240 }} />
                    <button onClick={() => setDrill(null)} style={{ padding: '7px 14px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>✕ Funga</button>
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: 160 }} />
                      <col style={{ width: 150 }} />
                      <col style={{ width: 110 }} />
                      <col style={{ width: 110 }} />
                      <col style={{ width: 110 }} />
                      <col style={{ width: 110 }} />
                      <col style={{ width: 130 }} />
                      <col style={{ width: 100 }} />
                    </colgroup>
                    <thead>
                      <tr>
                        {thSort('loan_number', 'Nambari ya Mkopo')}
                        {thSort('borrower', 'Mkopaji')}
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: .4, background: '#f8fafc' }}>Simu</th>
                        {thSort('officer', 'Afisa')}
                        {thSort('amount', 'Mkopo')}
                        {thSort('outstanding', 'Baki')}
                        {thSort('dpd', 'Siku Zilizopita')}
                        {thSort('overdue_since', 'Tangu')}
                      </tr>
                    </thead>
                    <tbody>
                      {drillLoans.length === 0 && (
                        <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Hakuna mikopo inayolingana</td></tr>
                      )}
                      {drillLoans.map((l, i) => (
                        <tr key={l.loan_id} className="par-drill-row" style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#4f46e5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.loan_number}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.borrower}</td>
                          <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.phone}</td>
                          <td style={{ padding: '10px 14px', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.officer}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: '#102a43', whiteSpace: 'nowrap' }}>{fmt(l.amount)}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 800, color: '#dc2626', whiteSpace: 'nowrap' }}>{fmt(l.outstanding)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span style={{ background: BUCKET_COLORS[drill].badge, color: BUCKET_COLORS[drill].text, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 800, border: `1px solid ${BUCKET_COLORS[drill].border}` }}>{l.dpd}d</span>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>
                            {l.overdue_since ? l.overdue_since.toString().slice(0, 10) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
