import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

interface GroupLoan {
  id: number;
  loan_account_number: string;
  name: string;
  amount: number;
  status: string;
  group_name?: string;
  member_count?: number;
  chairman?: string;
  secretary?: string;
  treasurer?: string;
  registration_no?: string;
  created_at: string;
  groupMembers?: Member[];
}

interface Member {
  id: number;
  loan_id: number;
  full_name: string;
  role: 'chairman' | 'secretary' | 'treasurer' | 'member';
  phone: string | null;
  nida_number: string | null;
  gender: string | null;
  occupation: string | null;
  monthly_income: number | null;
  share_amount: number | null;
  kyc_status: 'pending' | 'verified' | 'rejected';
  notes: string | null;
}

interface Performance {
  total_expected: number; total_paid: number; collection_rate: number;
  days_overdue: number; last_payment_date: string | null; repayments_count: number;
}

interface GroupDetail {
  loan: GroupLoan; members: Member[];
  group_info: Record<string, string | number>;
  performance: Performance;
}

interface PortfolioStats {
  total_groups: number; active_groups: number; closed_groups: number;
  overdue_groups: number; total_disbursed: number; total_repaid: number; collection_rate: number;
}

const STATUS_COLOR: Record<string, string> = {
  disbursed: '#059669', active: '#0ea5e9', pending: '#f59e0b', approved: '#6366f1',
  rejected: '#ef4444', fully_paid: '#94a3b8', manager_review: '#f97316', gm_review: '#8b5cf6', md_review: '#ec4899',
};
const STATUS_BG: Record<string, string> = {
  disbursed: '#d1fae5', active: '#e0f2fe', pending: '#fef9c3', approved: '#ede9fe',
  rejected: '#fee2e2', fully_paid: '#f1f5f9', manager_review: '#fff7ed', gm_review: '#f5f3ff', md_review: '#fdf2f8',
};
const KYC_COLOR: Record<string, string> = { pending: '#f59e0b', verified: '#059669', rejected: '#ef4444' };
const ROLE_COLOR: Record<string, string> = { chairman: '#6366f1', secretary: '#0ea5e9', treasurer: '#059669', member: '#64748b' };

const fmt = (n: number) => 'TZS ' + n.toLocaleString();
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('sw-TZ') : '--';

export default function GroupManagement() {
  const [groups, setGroups] = useState<GroupLoan[]>([]);
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [memberForm, setMemberForm] = useState<Record<string, string> | null>(null);
  const [editMemberId, setEditMemberId] = useState<number | null>(null);
  const [savingMember, setSavingMember] = useState(false);
  const [memberError, setMemberError] = useState('');

  const fetchStats = useCallback(() => {
    axios.get('/api/v1/groups/performance').then(r => setStats(r.data.data)).catch(() => {});
  }, []);

  const fetchGroups = useCallback(() => {
    setLoading(true);
    const params: Record<string, string | number> = { page };
    if (search) params.search = search;
    if (filterStatus) params.status = filterStatus;
    axios.get('/api/v1/groups', { params })
      .then(r => { const d = r.data.data; setGroups(d.data ?? []); setLastPage(d.last_page ?? 1); })
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, [search, filterStatus, page]);

  useEffect(() => { fetchGroups(); fetchStats(); }, [fetchGroups, fetchStats]);

  const openDetail = (id: number) => {
    setDetailLoading(true);
    axios.get(`/api/v1/groups/${id}`)
      .then(r => setDetail(r.data.data))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  };

  const openAddMember = (loanId: number) => {
    setEditMemberId(null);
    setMemberForm({ loan_id: loanId.toString(), role: 'member', kyc_status: 'pending' });
    setMemberError('');
  };

  const openEditMember = (m: Member) => {
    setEditMemberId(m.id);
    setMemberForm({
      full_name: m.full_name, role: m.role, phone: m.phone ?? '', nida_number: m.nida_number ?? '',
      gender: m.gender ?? '', occupation: m.occupation ?? '', monthly_income: m.monthly_income?.toString() ?? '',
      share_amount: m.share_amount?.toString() ?? '', kyc_status: m.kyc_status, notes: m.notes ?? '',
      loan_id: m.loan_id.toString(),
    });
    setMemberError('');
  };

  const saveMember = async () => {
    if (!memberForm?.full_name?.trim()) { setMemberError('Jina linahitajika'); return; }
    setSavingMember(true);
    try {
      if (editMemberId) {
        await axios.put(`/api/v1/groups/members/${editMemberId}`, memberForm);
      } else {
        await axios.post(`/api/v1/groups/${memberForm.loan_id}/members`, memberForm);
      }
      setMemberForm(null);
      if (detail) openDetail(detail.loan.id);
    } catch (e: any) {
      setMemberError(e?.response?.data?.message ?? 'Hitilafu imetokea');
    } finally {
      setSavingMember(false);
    }
  };

  const deleteMember = async (id: number) => {
    if (!confirm('Futa mwanachama huyu?')) return;
    await axios.delete(`/api/v1/groups/members/${id}`).catch(() => {});
    if (detail) openDetail(detail.loan.id);
  };

  const setMF = (k: string, v: string) => setMemberForm(f => f ? { ...f, [k]: v } : f);

  const portalCards = stats ? [
    { label: 'Vikundi Vyote', value: stats.total_groups, color: '#6366f1', bg: '#ede9fe' },
    { label: 'Vinavyoendelea', value: stats.active_groups, color: '#059669', bg: '#d1fae5' },
    { label: 'Vilivyofungwa', value: stats.closed_groups, color: '#94a3b8', bg: '#f1f5f9' },
    { label: 'Vilivyochelewa', value: stats.overdue_groups, color: '#ef4444', bg: '#fee2e2' },
  ] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8f7f4', fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        .ph-bar{display:flex;align-items:stretch;background:#f1f5f9;position:sticky;top:0;z-index:100;border-bottom:2px solid #e2e8f0;min-height:50px}
        .ph-inner{display:flex;align-items:flex-end;gap:4px;padding:10px 14px 0;flex:1;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none}
        .ph-inner::-webkit-scrollbar{display:none}
        .ph-brand{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;color:#102a43;white-space:nowrap;padding-bottom:10px;flex-shrink:0}
        .ph-actions{display:flex;align-items:center;gap:8px;padding:6px 14px;flex-shrink:0;border-left:1px solid #e2e8f0;background:#f1f5f9}
      `}</style>
      <div className="ph-bar">
        <div className="ph-inner">
          <div className="ph-brand">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span>Group Management</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, padding: '18px 28px 0', flexShrink: 0 }}>
          {portalCards.map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: s.bg, color: s.color, borderRadius: 8, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{s.label}</div>
            </div>
          ))}
          <div style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Mkusanyiko wa Malipo</div>
            <div style={{ height: 8, background: '#f1f5f9', borderRadius: 8 }}>
              <div style={{ height: '100%', borderRadius: 8, background: stats.collection_rate >= 80 ? '#059669' : stats.collection_rate >= 60 ? '#f59e0b' : '#ef4444', width: `${Math.min(100, stats.collection_rate)}%`, transition: 'width .5s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 12 }}>
              <span style={{ color: '#64748b' }}>{fmt(stats.total_repaid)} / {fmt(stats.total_disbursed)}</span>
              <span style={{ fontWeight: 700, color: '#1e293b' }}>{stats.collection_rate}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, padding: '16px 28px', flexShrink: 0 }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Tafuta kundi, nambari ya mkopo..." style={{ flex: 1, padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} style={{ padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
          <option value="">Hali Zote</option>
          <option value="pending">Inasubiri</option>
          <option value="manager_review">Mapitio ya LM</option>
          <option value="approved">Imeidhinishwa</option>
          <option value="disbursed">Imetolewa</option>
          <option value="fully_paid">Imelipwa</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 28px 28px' }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Inapakia vikundi...</div>
          ) : groups.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Hakuna vikundi vilivyopatikana</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                  {['Nambari ya Mkopo', 'Jina la Kikundi', 'Mwenyekiti', 'Wanachama', 'Kiasi', 'Hali', 'Tarehe'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((g, i) => (
                  <tr key={g.id} onClick={() => openDetail(g.id)} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa', cursor: 'pointer' }}>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: '#4f7c3f' }}>{g.loan_account_number}</td>
                    <td style={{ padding: '11px 14px', fontWeight: 500, color: '#1e293b' }}>{g.group_name ?? g.name}</td>
                    <td style={{ padding: '11px 14px', color: '#64748b' }}>{g.chairman ?? '--'}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ background: '#ede9fe', color: '#6366f1', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{g.member_count ?? g.groupMembers?.length ?? 0}</span>
                    </td>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: '#1e293b' }}>{fmt(g.amount)}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ background: STATUS_BG[g.status] ?? '#f1f5f9', color: STATUS_COLOR[g.status] ?? '#64748b', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                        {g.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', color: '#9ca3af' }}>{fmtDate(g.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {lastPage > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
            {Array.from({ length: lastPage }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: p === page ? '#4f7c3f' : '#fff', color: p === page ? '#fff' : '#374151', fontWeight: 600, cursor: 'pointer' }}>{p}</button>
            ))}
          </div>
        )}
      </div>

      {/* Detail slide-in */}
      {(detail || detailLoading) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setDetail(null)}>
          <div style={{ width: 540, background: '#fff', height: '100%', overflow: 'auto', padding: 28, boxShadow: '-4px 0 24px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            {detailLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Inapakia...</div>
            ) : detail ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 18, color: '#1e293b' }}>{detail.group_info.name as string}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{detail.loan.loan_account_number} · {detail.group_info.registration_no}</div>
                  </div>
                  <button onClick={() => setDetail(null)} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#64748b' }}>×</button>
                </div>

                {/* Performance */}
                <div style={{ background: '#f8f7f4', borderRadius: 12, padding: 16, marginBottom: 18 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#64748b', marginBottom: 10 }}>UTENDAJI WA MALIPO</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
                    {[
                      ['Kilichotarajiwa', fmt(detail.performance.total_expected)],
                      ['Kilicholipwa', fmt(detail.performance.total_paid)],
                      ['Mkusanyiko', `${detail.performance.collection_rate}%`],
                    ].map(([l, v]) => (
                      <div key={l as string} style={{ background: '#fff', borderRadius: 8, padding: 10, textAlign: 'center', border: '1px solid #e5e7eb' }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{v}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, height: 8, background: '#e5e7eb', borderRadius: 8 }}>
                    <div style={{ height: '100%', borderRadius: 8, background: detail.performance.collection_rate >= 80 ? '#059669' : '#f59e0b', width: `${Math.min(100, detail.performance.collection_rate)}%` }} />
                  </div>
                </div>

                {/* Group info */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#64748b', marginBottom: 8 }}>MAELEZO YA KIKUNDI</div>
                  {[
                    ['Mwenyekiti', detail.group_info.chairman], ['Katibu', detail.group_info.secretary],
                    ['Mhazini', detail.group_info.treasurer], ['Wanachama W', detail.group_info.male_members],
                    ['Wanachama K', detail.group_info.female_members], ['Mara za Mkutano', detail.group_info.meeting_freq],
                    ['Anwani', detail.group_info.address],
                  ].map(([l, v]) => (
                    <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                      <span style={{ color: '#64748b' }}>{l}</span>
                      <span style={{ fontWeight: 500, color: '#1e293b' }}>{v || '--'}</span>
                    </div>
                  ))}
                </div>

                {/* Members */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#64748b' }}>WANACHAMA ({detail.members.length})</div>
                    <button onClick={() => openAddMember(detail.loan.id)} style={{ padding: '5px 12px', border: '1px solid #4f7c3f', borderRadius: 6, color: '#4f7c3f', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Ongeza</button>
                  </div>
                  {detail.members.map(m => (
                    <div key={m.id} style={{ background: '#f8f7f4', borderRadius: 10, padding: '12px 14px', marginBottom: 8, border: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{m.full_name}</div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                            <span style={{ background: ROLE_COLOR[m.role] + '22', color: ROLE_COLOR[m.role], padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{m.role}</span>
                            <span style={{ background: KYC_COLOR[m.kyc_status] + '22', color: KYC_COLOR[m.kyc_status], padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>KYC: {m.kyc_status}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEditMember(m)} style={{ padding: '3px 8px', border: '1px solid #d1d5db', borderRadius: 5, background: '#fff', fontSize: 11, cursor: 'pointer' }}>Hariri</button>
                          <button onClick={() => deleteMember(m.id)} style={{ padding: '3px 8px', border: '1px solid #fca5a5', borderRadius: 5, background: '#fff', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}>Futa</button>
                        </div>
                      </div>
                      {(m.phone || m.occupation) && (
                        <div style={{ marginTop: 6, fontSize: 12, color: '#64748b', display: 'flex', gap: 12 }}>
                          {m.phone && <span>📞 {m.phone}</span>}
                          {m.occupation && <span>💼 {m.occupation}</span>}
                          {m.monthly_income && <span>💰 {fmt(m.monthly_income)}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                  {detail.members.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: 13 }}>Hakuna wanachama waliowekwa bado</div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Member form modal */}
      {memberForm !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 520, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 48px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 17, color: '#1e293b' }}>{editMemberId ? 'Hariri Mwanachama' : 'Ongeza Mwanachama'}</div>
              <button onClick={() => setMemberForm(null)} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>
            {memberError && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: 7, marginBottom: 12, fontSize: 13 }}>{memberError}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                ['full_name', 'Jina Kamili *'], ['phone', 'Simu'], ['nida_number', 'NIDA'],
                ['occupation', 'Kazi'], ['monthly_income', 'Mapato/Mwezi (TZS)'], ['share_amount', 'Hisa (TZS)'],
              ].map(([k, l]) => (
                <div key={k}>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 3 }}>{l}</label>
                  <input value={memberForm[k] ?? ''} onChange={e => setMF(k, e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              ))}
              {[
                ['role', 'Wadhifu', ['chairman', 'secretary', 'treasurer', 'member'], ['Mwenyekiti', 'Katibu', 'Mhazini', 'Mwanachama']],
                ['gender', 'Jinsia', ['Mwanaume', 'Mwanamke'], []],
                ['kyc_status', 'Hali ya KYC', ['pending', 'verified', 'rejected'], ['Inasubiri', 'Imehakikiwa', 'Imekataliwa']],
              ].map(([k, l, opts, labels]) => (
                <div key={k as string}>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 3 }}>{l}</label>
                  <select value={memberForm[k as string] ?? ''} onChange={e => setMF(k as string, e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13 }}>
                    <option value="">-- Chagua --</option>
                    {(opts as string[]).map((o, i) => <option key={o} value={o}>{(labels as string[])[i] || o}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 3 }}>Maelezo</label>
              <textarea value={memberForm.notes ?? ''} onChange={e => setMF('notes', e.target.value)} rows={2} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
              <button onClick={() => setMemberForm(null)} style={{ flex: 1, padding: 10, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontWeight: 600, cursor: 'pointer' }}>Ghairi</button>
              <button onClick={saveMember} disabled={savingMember} style={{ flex: 1, padding: 10, border: 'none', borderRadius: 8, background: '#4f7c3f', color: '#fff', fontWeight: 600, cursor: savingMember ? 'not-allowed' : 'pointer', opacity: savingMember ? 0.7 : 1 }}>
                {savingMember ? 'Inahifadhi...' : 'Hifadhi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
