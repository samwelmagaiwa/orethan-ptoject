import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = '/api/v1';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const fmt = (n: number) => 'TZS ' + Math.round(n ?? 0).toLocaleString();

interface Branch {
  id: number; name: string; code: string; region?: string; address?: string;
  phone?: string; manager_name?: string; is_active: boolean;
  users_count: number; officers_count: number;
}
interface BranchStats {
  branch: Branch; officers_count: number; total_loans: number; active_loans: number;
  active_portfolio: number; overdue_count: number; completed_loans: number; total_collected: number;
}
interface UserRow { id: number; name: string; role: string; branch_id?: number; }

const EMPTY: Partial<Branch> = { name: '', code: '', region: '', address: '', phone: '', manager_name: '', is_active: true };

export default function Branches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers]       = useState<UserRow[]>([]);
  const [stats, setStats]       = useState<BranchStats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [form, setForm]         = useState<Partial<Branch>>(EMPTY);
  const [editId, setEditId]     = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [assignBranch, setAssignBranch] = useState<number | null>(null);
  const [assignUser, setAssignUser]     = useState('');
  const [statsId, setStatsId]   = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      axios.get(`${API_BASE}/branches`, { headers: authHeaders() }),
      axios.get(`${API_BASE}/users`, { headers: authHeaders() }),
    ]).then(([br, ur]) => {
      setBranches(br.data.data ?? []);
      setUsers(ur.data.data ?? ur.data ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openStats = (id: number) => {
    setStatsId(id);
    axios.get(`${API_BASE}/branches/${id}/stats`, { headers: authHeaders() })
      .then(r => setStats(r.data.data)).catch(() => setStats(null));
  };

  const save = async () => {
    if (!form.name || !form.code) { setError('Jina na Msimbo zinahitajika'); return; }
    setSaving(true); setError('');
    try {
      if (editId) {
        await axios.put(`${API_BASE}/branches/${editId}`, form, { headers: authHeaders() });
      } else {
        await axios.post(`${API_BASE}/branches`, form, { headers: authHeaders() });
      }
      setShowForm(false); setForm(EMPTY); setEditId(null); load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Imeshindwa kuhifadhi');
    } finally { setSaving(false); }
  };

  const del = async (id: number) => {
    if (!confirm('Una uhakika?')) return;
    await axios.delete(`${API_BASE}/branches/${id}`, { headers: authHeaders() }).catch(() => {});
    load();
  };

  const doAssign = async () => {
    if (!assignBranch || !assignUser) return;
    await axios.put(`${API_BASE}/branches/${assignBranch}/assign-user`, { user_id: Number(assignUser) }, { headers: authHeaders() }).catch(() => {});
    setAssignBranch(null); setAssignUser(''); load();
  };

  return (
    <div style={{ fontFamily: 'Inter,system-ui,sans-serif', background: '#f0f4f8', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0a1628,#102a43,#1a3050)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '2px solid rgba(0,0,0,.4)', boxShadow: '0 2px 12px rgba(0,0,0,.3)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <div style={{ background: 'rgba(79,70,229,.25)', borderRadius: 8, padding: '6px 8px', border: '1px solid rgba(79,70,229,.4)', fontSize: 18 }}>🏢</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>Matawi / Mikoa</div>
            <div style={{ color: 'rgba(255,255,255,.45)', fontSize: 10, fontWeight: 500 }}>Usimamizi wa Matawi na Makundi ya Maafisa</div>
          </div>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY); }}
          style={{ padding: '7px 18px', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
          + Tawi Jipya
        </button>
      </div>

      <div style={{ padding: '24px 28px' }}>
        {loading && <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>⏳ Inapakia...</div>}
        {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 16px', color: '#dc2626', fontWeight: 600, marginBottom: 16 }}>{error}</div>}

        {/* Branch cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16, marginBottom: 28 }}>
          {branches.map(b => (
            <div key={b.id} style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: `2px solid ${b.is_active ? '#4f46e5' : '#e2e8f0'}`, boxShadow: '0 2px 8px rgba(0,0,0,.07)', opacity: b.is_active ? 1 : .65 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16, color: '#0f172a' }}>{b.name}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ background: '#ede9fe', color: '#4f46e5', borderRadius: 20, padding: '1px 9px', fontSize: 11, fontWeight: 700, border: '1px solid #c4b5fd' }}>{b.code}</span>
                    {b.region && <span style={{ background: '#f0f4f8', color: '#64748b', borderRadius: 20, padding: '1px 9px', fontSize: 11, fontWeight: 600 }}>{b.region}</span>}
                    {!b.is_active && <span style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 20, padding: '1px 9px', fontSize: 11, fontWeight: 700 }}>Imefungwa</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setEditId(b.id); setForm(b); setShowForm(true); }} style={{ padding: '5px 10px', background: '#f0f4ff', border: '1px solid #c4b5fd', color: '#4f46e5', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✏️</button>
                  <button onClick={() => setAssignBranch(b.id)} style={{ padding: '5px 10px', background: '#f0fdf4', border: '1px solid #6ee7b7', color: '#059669', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>👤+</button>
                  <button onClick={() => openStats(b.id)} style={{ padding: '5px 10px', background: '#fffbeb', border: '1px solid #fcd34d', color: '#d97706', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>📊</button>
                  <button onClick={() => del(b.id)} style={{ padding: '5px 10px', background: '#fff5f5', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>🗑</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Maafisa', value: b.officers_count, color: '#4f46e5' },
                  { label: 'Watumiaji Wote', value: b.users_count, color: '#059669' },
                  b.phone ? { label: 'Simu', value: b.phone, color: '#0ea5e9' } : null,
                  b.manager_name ? { label: 'Meneja', value: b.manager_name, color: '#d97706' } : null,
                ].filter(Boolean).map((s: any) => (
                  <div key={s.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '6px 10px', borderLeft: `3px solid ${s.color}` }}>
                    <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4 }}>{s.label}</div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Users list with branch assignment */}
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,.07)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
            Maafisa na Matawi Yao ({users.length})
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Jina', 'Jukumu', 'Tawi'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: .4, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => {
                  const br = branches.find(b => b.id === (u as any).branch_id);
                  return (
                    <tr key={u.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{u.name}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b', textTransform: 'capitalize' }}>{u.role?.replace(/_/g, ' ')}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {br ? (
                          <span style={{ background: '#ede9fe', color: '#4f46e5', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, border: '1px solid #c4b5fd' }}>{br.name}</span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 11 }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }} onClick={() => setShowForm(false)}>
          <div style={{ background: '#fff', borderRadius: 18, padding: '28px 28px', width: 480, maxWidth: '95vw', boxShadow: '0 24px 60px rgba(0,0,0,.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 900, fontSize: 16, color: '#102a43', marginBottom: 20 }}>{editId ? '✏️ Hariri Tawi' : '+ Tawi Jipya'}</div>
            {error && <div style={{ background: '#fee2e2', borderRadius: 8, padding: '8px 12px', color: '#dc2626', fontSize: 12, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {([
                ['name', 'Jina la Tawi *', 'text'],
                ['code', 'Msimbo *', 'text'],
                ['region', 'Mkoa', 'text'],
                ['phone', 'Simu', 'text'],
                ['manager_name', 'Jina la Meneja', 'text'],
                ['address', 'Anwani', 'text'],
              ] as const).map(([key, label]) => (
                <div key={key} style={{ gridColumn: key === 'address' ? '1/-1' : 'auto' }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4 }}>{label}</label>
                  <input value={(form as any)[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="is_active" checked={form.is_active ?? true} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                <label htmlFor="is_active" style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Tawi hai (Active)</label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '9px 20px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 9, fontWeight: 700, cursor: 'pointer' }}>Ghairi</button>
              <button onClick={save} disabled={saving} style={{ padding: '9px 24px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, cursor: 'pointer', opacity: saving ? .7 : 1 }}>{saving ? 'Inahifadhi...' : 'Hifadhi'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign user modal */}
      {assignBranch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setAssignBranch(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px', width: 360, boxShadow: '0 20px 50px rgba(0,0,0,.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#102a43', marginBottom: 16 }}>👤 Weka Mtumiaji kwa Tawi</div>
            <select value={assignUser} onChange={e => setAssignUser(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 13, fontFamily: 'inherit', background: '#fff', marginBottom: 16, outline: 'none' }}>
              <option value="">— Chagua Mtumiaji —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role?.replace(/_/g, ' ')})</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setAssignBranch(null)} style={{ padding: '8px 18px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Ghairi</button>
              <button onClick={doAssign} style={{ padding: '8px 20px', background: 'linear-gradient(135deg,#059669,#047857)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Weka</button>
            </div>
          </div>
        </div>
      )}

      {/* Stats modal */}
      {statsId && stats && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setStatsId(null); setStats(null); }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: '28px', width: 500, maxWidth: '95vw', boxShadow: '0 24px 60px rgba(0,0,0,.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 900, fontSize: 17, color: '#102a43', marginBottom: 18 }}>📊 {stats.branch.name} — Takwimu</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { label: 'Maafisa',       value: stats.officers_count,  color: '#4f46e5', bg: '#ede9fe' },
                { label: 'Mikopo Yote',   value: stats.total_loans,     color: '#0ea5e9', bg: '#e0f2fe' },
                { label: 'Mikopo Hai',    value: stats.active_loans,    color: '#059669', bg: '#d1fae5' },
                { label: 'Yenye Tatizo',  value: stats.overdue_count,   color: '#dc2626', bg: '#fee2e2' },
                { label: 'Imekamilika',   value: stats.completed_loans, color: '#94a3b8', bg: '#f1f5f9' },
                { label: 'Mkoba Hai',     value: fmt(stats.active_portfolio), color: '#d97706', bg: '#fef3c7' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '12px 14px', border: `1px solid ${s.color}22` }}>
                  <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4 }}>{s.label}</div>
                  <div style={{ fontWeight: 900, fontSize: 18, color: s.color, marginTop: 4 }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, background: '#d1fae5', borderRadius: 10, padding: '12px 16px', border: '1px solid #6ee7b7' }}>
              <div style={{ fontSize: 10, color: '#065f46', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4 }}>Jumla Iliyokusanywa</div>
              <div style={{ fontWeight: 900, fontSize: 20, color: '#059669' }}>{fmt(stats.total_collected)}</div>
            </div>
            <button onClick={() => { setStatsId(null); setStats(null); }} style={{ marginTop: 16, width: '100%', padding: '10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>Funga</button>
          </div>
        </div>
      )}
    </div>
  );
}
