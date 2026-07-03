import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

interface Officer {
  user_id: number; name: string; role: string;
  total_submitted: number; total_disbursed: number; total_rejected: number;
  total_amount: number; overdue_count: number; disbursement_rate: number;
  total_collected: number; repayment_count: number; collection_score: string;
}

interface Summary {
  total_officers: number; total_submitted: number; total_disbursed: number;
  total_amount: number; total_collected: number; avg_disbursement_rate: number;
}

interface OfficerDetail {
  user: { id: number; name: string; role: string };
  period: { from: string; to: string };
  kpis: {
    total_submitted: number; total_disbursed: number; total_rejected: number;
    total_amount: number; total_collected: number; overdue_count: number;
    disbursement_rate: number; collection_rate: number;
  };
  monthly_trend: { month: string; count: number; amount: number }[];
}

const SCORE_COLOR: Record<string, string> = { A: '#059669', B: '#0ea5e9', C: '#f59e0b', D: '#ef4444', E: '#7c3aed', '—': '#9ca3af' };
const SCORE_BG: Record<string, string> = { A: '#d1fae5', B: '#e0f2fe', C: '#fef9c3', D: '#fee2e2', E: '#f5f3ff', '—': '#f1f5f9' };
const ROLE_LABEL: Record<string, string> = {
  loan_officer: 'Afisa Mkopo', loan_manager: 'Meneja Mkopo',
  finance_officer: 'Afisa Fedha', general_manager: 'Mkurugenzi Mkuu', managing_director: 'Mkurugenzi', admin: 'Admin',
};

const fmt = (n: number) => 'TZS ' + n.toLocaleString();
const pct = (n: number) => `${n.toFixed(1)}%`;

function GradeBadge({ score }: { score: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: SCORE_BG[score] ?? '#f1f5f9', color: SCORE_COLOR[score] ?? '#9ca3af', fontWeight: 800, fontSize: 16 }}>
      {score}
    </span>
  );
}

function ProgressBar({ value, max = 100, color = '#4f7c3f' }: { value: number; max?: number; color?: string }) {
  const pctVal = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 6, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pctVal}%`, background: color, borderRadius: 4, transition: 'width .5s' }} />
    </div>
  );
}

export default function StaffPerformance() {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [detail, setDetail] = useState<OfficerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sortKey, setSortKey] = useState<keyof Officer>('total_amount');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchData = useCallback(() => {
    setLoading(true);
    axios.get('/api/v1/staff/performance', { params: { from, to } })
      .then(r => { setOfficers(r.data.data.officers ?? []); setSummary(r.data.data.summary ?? null); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openDetail = (userId: number) => {
    setDetailLoading(true);
    axios.get(`/api/v1/staff/performance/${userId}`, { params: { from, to } })
      .then(r => setDetail(r.data.data))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  };

  const toggleSort = (key: keyof Officer) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = [...officers].sort((a, b) => {
    const av = a[sortKey] as number, bv = b[sortKey] as number;
    return sortDir === 'asc' ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
  });

  const maxAmount = Math.max(...officers.map(o => o.total_amount), 1);

  const summaryCards = summary ? [
    { label: 'Maafisa', value: summary.total_officers, sub: 'waliofanya kazi', color: '#6366f1', bg: '#ede9fe' },
    { label: 'Zilizowekwa', value: summary.total_submitted, sub: 'maombi', color: '#0ea5e9', bg: '#e0f2fe' },
    { label: 'Zilitolewa', value: summary.total_disbursed, sub: 'mikopo', color: '#059669', bg: '#d1fae5' },
    { label: fmt(summary.total_amount), value: null, sub: 'jumla ya mikopo', color: '#f59e0b', bg: '#fef9c3' },
  ] : [];

  const colHeaders: [string, keyof Officer][] = [
    ['Jina', 'name'], ['Wadhifu', 'role'], ['Zilizowekwa', 'total_submitted'],
    ['Zilitolewa', 'total_disbursed'], ['Kiwango', 'disbursement_rate'],
    ['Kiasi (TZS)', 'total_amount'], ['Zilizokusanywa', 'total_collected'],
    ['Vilivyochelewa', 'overdue_count'], ['Mkusanyiko', 'collection_score'],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8f7f4', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '18px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>📊 Utendaji wa Wafanyakazi</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Viashiria vya Utendaji (KPIs) kwa Maafisa wa Mikopo</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13 }} />
          <span style={{ color: '#64748b' }}>—</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13 }} />
          <button onClick={fetchData} style={{ padding: '7px 16px', background: '#4f7c3f', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Tafuta</button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, padding: '18px 28px 0', flexShrink: 0 }}>
          {summaryCards.map((s, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ background: s.bg, color: s.color, borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: s.value !== null ? 18 : 11 }}>
                  {s.value !== null ? s.value : s.label}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{s.value !== null ? s.label : ''}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{s.sub}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Average disbursement rate */}
      {summary && (
        <div style={{ padding: '14px 28px 0', flexShrink: 0 }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: '12px 18px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 13, color: '#64748b', minWidth: 200 }}>Wastani wa Kiwango cha Utoaji</div>
            <div style={{ flex: 1 }}><ProgressBar value={summary.avg_disbursement_rate} /></div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#4f7c3f', minWidth: 50 }}>{pct(summary.avg_disbursement_rate)}</div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 28px 28px' }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Inapakia takwimu...</div>
          ) : officers.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Hakuna data kwa kipindi hiki</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '11px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, width: 30 }}>#</th>
                  {colHeaders.map(([label, key]) => (
                    <th key={key} onClick={() => toggleSort(key)} style={{ padding: '11px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      {label} {sortKey === key ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((o, i) => (
                  <tr key={o.user_id} onClick={() => openDetail(o.user_id)} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa', cursor: 'pointer' }}>
                    <td style={{ padding: '11px 14px', color: '#9ca3af', fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: '#1e293b' }}>{o.name}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ background: '#ede9fe', color: '#6366f1', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>{ROLE_LABEL[o.role] ?? o.role}</span>
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'center' }}>{o.total_submitted}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'center', color: '#059669', fontWeight: 600 }}>{o.total_disbursed}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 60 }}><ProgressBar value={o.disbursement_rate} color={o.disbursement_rate >= 75 ? '#059669' : '#f59e0b'} /></div>
                        <span style={{ minWidth: 40, textAlign: 'right', fontSize: 12 }}>{pct(o.disbursement_rate)}</span>
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <div>{fmt(o.total_amount)}</div>
                      <div style={{ marginTop: 3 }}><ProgressBar value={o.total_amount} max={maxAmount} color='#6366f1' /></div>
                    </td>
                    <td style={{ padding: '11px 14px', color: '#0ea5e9', fontWeight: 500 }}>{fmt(o.total_collected)}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                      {o.overdue_count > 0 ? <span style={{ color: '#ef4444', fontWeight: 700 }}>{o.overdue_count}</span> : <span style={{ color: '#059669' }}>0</span>}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'center' }}><GradeBadge score={o.collection_score} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Grade legend */}
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          {[['A','90%+'],['B','75%+'],['C','60%+'],['D','40%+'],['E','<40%']].map(([g, r]) => (
            <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <GradeBadge score={g} />
              <span style={{ color: '#64748b' }}>{r} mkusanyiko</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detail slide-in */}
      {(detail || detailLoading) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setDetail(null)}>
          <div style={{ width: 480, background: '#fff', height: '100%', overflow: 'auto', padding: 28, boxShadow: '-4px 0 24px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            {detailLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Inapakia...</div>
            ) : detail ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 18, color: '#1e293b' }}>{detail.user.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{ROLE_LABEL[detail.user.role] ?? detail.user.role} · {detail.period.from} — {detail.period.to}</div>
                  </div>
                  <button onClick={() => setDetail(null)} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#64748b' }}>×</button>
                </div>

                {/* KPI Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  {[
                    ['Zilizowekwa', detail.kpis.total_submitted, '#6366f1', '#ede9fe'],
                    ['Zilitolewa', detail.kpis.total_disbursed, '#059669', '#d1fae5'],
                    ['Zilikataliwa', detail.kpis.total_rejected, '#ef4444', '#fee2e2'],
                    ['Vilivyochelewa', detail.kpis.overdue_count, '#f59e0b', '#fef9c3'],
                  ].map(([l, v, c, bg]) => (
                    <div key={l as string} style={{ background: bg as string, borderRadius: 10, padding: '14px 16px', border: `1px solid ${c}33` }}>
                      <div style={{ fontWeight: 800, fontSize: 24, color: c as string }}>{v as number}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{l}</div>
                    </div>
                  ))}
                </div>

                {/* Rates */}
                <div style={{ background: '#f8f7f4', borderRadius: 10, padding: 14, marginBottom: 20 }}>
                  {[
                    ['Kiwango cha Utoaji', detail.kpis.disbursement_rate, '#059669'],
                    ['Kiwango cha Mkusanyiko', detail.kpis.collection_rate, '#0ea5e9'],
                  ].map(([l, v, c]) => (
                    <div key={l as string} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span style={{ color: '#64748b' }}>{l}</span>
                        <span style={{ fontWeight: 700, color: c as string }}>{pct(v as number)}</span>
                      </div>
                      <ProgressBar value={v as number} color={c as string} />
                    </div>
                  ))}
                </div>

                {/* Amounts */}
                <div style={{ marginBottom: 20 }}>
                  {[
                    ['Jumla ya Mikopo', fmt(detail.kpis.total_amount)],
                    ['Jumla ya Makusanyo', fmt(detail.kpis.total_collected)],
                  ].map(([l, v]) => (
                    <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                      <span style={{ color: '#64748b' }}>{l}</span>
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* Monthly trend */}
                {detail.monthly_trend.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#64748b', marginBottom: 10 }}>MWENENDO WA KILA MWEZI</div>
                    {detail.monthly_trend.map(m => (
                      <div key={m.month} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, fontSize: 12 }}>
                        <span style={{ minWidth: 60, color: '#64748b' }}>{m.month}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3 }}>
                            <div style={{ height: '100%', borderRadius: 3, background: '#4f7c3f', width: `${Math.min(100, (m.count / (Math.max(...detail.monthly_trend.map(x => x.count)) || 1)) * 100)}%` }} />
                          </div>
                        </div>
                        <span style={{ fontWeight: 600, minWidth: 20, textAlign: 'right' }}>{m.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
