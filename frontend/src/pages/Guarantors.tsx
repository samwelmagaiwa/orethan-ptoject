import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

interface Guarantor {
  id: number;
  guarantor_number: string;
  loan_id: number;
  full_name: string;
  relationship: string | null;
  phone: string | null;
  nida_number: string | null;
  gender: string | null;
  employment_status: string | null;
  employer_name: string | null;
  monthly_income: number | null;
  region: string | null;
  district: string | null;
  ward: string | null;
  status: 'active' | 'released' | 'defaulted';
  notes: string | null;
  loan?: { id: number; loan_account_number: string; amount: number; status: string };
  created_at: string;
}

interface Stats { total: number; active: number; released: number; defaulted: number }

const STATUS_COLORS: Record<string, string> = {
  active: '#059669', released: '#0ea5e9', defaulted: '#ef4444',
};
const STATUS_BG: Record<string, string> = {
  active: '#d1fae5', released: '#e0f2fe', defaulted: '#fee2e2',
};

const fmt = (n: number) => 'TZS ' + n.toLocaleString();
const fmtDate = (d: string) => new Date(d).toLocaleDateString('sw-TZ');

export default function Guarantors() {
  const [guarantors, setGuarantors] = useState<Guarantor[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, released: 0, defaulted: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState<Guarantor | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const fetchStats = useCallback(() => {
    axios.get('/api/v1/guarantors/stats').then(r => setStats(r.data.data)).catch(() => {});
  }, []);

  const fetchGuarantors = useCallback(() => {
    setLoading(true);
    const params: Record<string, string | number> = { page };
    if (search) params.search = search;
    if (filterStatus) params.status = filterStatus;
    axios.get('/api/v1/guarantors', { params })
      .then(r => {
        const d = r.data.data;
        setGuarantors(d.data ?? []);
        setLastPage(d.last_page ?? 1);
      })
      .catch(() => setGuarantors([]))
      .finally(() => setLoading(false));
  }, [search, filterStatus, page]);

  useEffect(() => { fetchGuarantors(); fetchStats(); }, [fetchGuarantors, fetchStats]);

  const openNew = () => {
    setEditingId(null);
    setForm({ status: 'active' });
    setError('');
    setShowForm(true);
  };

  const openEdit = (g: Guarantor) => {
    setEditingId(g.id);
    setForm({
      full_name: g.full_name,
      relationship: g.relationship ?? '',
      phone: g.phone ?? '',
      nida_number: g.nida_number ?? '',
      gender: g.gender ?? '',
      employment_status: g.employment_status ?? '',
      employer_name: g.employer_name ?? '',
      monthly_income: g.monthly_income?.toString() ?? '',
      region: g.region ?? '',
      district: g.district ?? '',
      ward: g.ward ?? '',
      status: g.status,
      notes: g.notes ?? '',
      loan_id: g.loan_id.toString(),
    });
    setError('');
    setShowForm(true);
  };

  const save = async () => {
    if (!form.full_name?.trim()) { setError('Jina linahitajika'); return; }
    if (!editingId && !form.loan_id) { setError('Nambari ya mkopo inahitajika'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await axios.put(`/api/v1/guarantors/${editingId}`, form);
      } else {
        await axios.post('/api/v1/guarantors', form);
      }
      setShowForm(false);
      fetchGuarantors();
      fetchStats();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Hitilafu imetokea';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async (id: number) => {
    if (!confirm('Futa mdhamini huyu?')) return;
    await axios.delete(`/api/v1/guarantors/${id}`).catch(() => {});
    fetchGuarantors(); fetchStats();
    if (selected?.id === id) setSelected(null);
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const statCards = [
    { label: 'Wote', value: stats.total, color: '#6366f1', bg: '#ede9fe' },
    { label: 'Hai', value: stats.active, color: STATUS_COLORS.active, bg: STATUS_BG.active },
    { label: 'Walioachiliwa', value: stats.released, color: STATUS_COLORS.released, bg: STATUS_BG.released },
    { label: 'Waliokosea', value: stats.defaulted, color: STATUS_COLORS.defaulted, bg: STATUS_BG.defaulted },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8f7f4', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '18px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>📋 Wadhamini</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Usimamizi wa Wadhamini wa Mikopo</div>
        </div>
        <button onClick={openNew} style={{ background: '#4f7c3f', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
          + Ongeza Mdhamini
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, padding: '20px 28px 0', flexShrink: 0 }}>
        {statCards.map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ background: s.bg, color: s.color, borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>{s.value}</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, padding: '16px 28px', flexShrink: 0 }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Tafuta jina, simu, NIDA..." style={{ flex: 1, padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} style={{ padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
          <option value="">Hali Zote</option>
          <option value="active">Hai</option>
          <option value="released">Aliyeachiliwa</option>
          <option value="defaulted">Mkosaji</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 28px 28px' }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Inapakia...</div>
          ) : guarantors.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Hakuna wadhamini waliopatikana</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                  {['Nambari', 'Jina Kamili', 'Uhusiano', 'Simu', 'Mkopo', 'Hali', 'Tarehe', ''].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {guarantors.map((g, i) => (
                  <tr key={g.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa', cursor: 'pointer' }} onClick={() => setSelected(g)}>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: '#4f7c3f' }}>{g.guarantor_number}</td>
                    <td style={{ padding: '11px 14px', fontWeight: 500, color: '#1e293b' }}>{g.full_name}</td>
                    <td style={{ padding: '11px 14px', color: '#64748b' }}>{g.relationship ?? '—'}</td>
                    <td style={{ padding: '11px 14px', color: '#64748b' }}>{g.phone ?? '—'}</td>
                    <td style={{ padding: '11px 14px', color: '#6366f1', fontWeight: 500 }}>{g.loan?.loan_account_number ?? `#${g.loan_id}`}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ background: STATUS_BG[g.status], color: STATUS_COLORS[g.status], padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                        {g.status === 'active' ? 'Hai' : g.status === 'released' ? 'Aliyeachiliwa' : 'Mkosaji'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', color: '#9ca3af' }}>{fmtDate(g.created_at)}</td>
                    <td style={{ padding: '11px 14px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEdit(g)} style={{ padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', fontSize: 12, cursor: 'pointer' }}>Hariri</button>
                        <button onClick={() => doDelete(g.id)} style={{ padding: '4px 10px', border: '1px solid #fca5a5', borderRadius: 6, background: '#fff', color: '#ef4444', fontSize: 12, cursor: 'pointer' }}>Futa</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {lastPage > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
            {Array.from({ length: lastPage }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: p === page ? '#4f7c3f' : '#fff', color: p === page ? '#fff' : '#374151', fontWeight: 600, cursor: 'pointer' }}>{p}</button>
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setSelected(null)}>
          <div style={{ width: 420, background: '#fff', height: '100%', overflow: 'auto', padding: 28, boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#1e293b' }}>Maelezo ya Mdhamini</div>
              <button onClick={() => setSelected(null)} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#4f7c3f' }}>{selected.full_name}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{selected.guarantor_number}</div>
            </div>
            {[
              ['Uhusiano', selected.relationship],
              ['Simu', selected.phone],
              ['NIDA', selected.nida_number],
              ['Jinsia', selected.gender],
              ['Hali ya Ajira', selected.employment_status],
              ['Mwajiri', selected.employer_name],
              ['Mapato ya Kila Mwezi', selected.monthly_income ? fmt(selected.monthly_income) : null],
              ['Mkoa', selected.region],
              ['Wilaya', selected.district],
              ['Kata', selected.ward],
              ['Mkopo', selected.loan?.loan_account_number],
            ].map(([label, value]) => value ? (
              <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                <span style={{ color: '#64748b' }}>{label}</span>
                <span style={{ color: '#1e293b', fontWeight: 500 }}>{value}</span>
              </div>
            ) : null)}
            {selected.notes && (
              <div style={{ marginTop: 16, padding: 12, background: '#fffbeb', border: '1px solid #fef08a', borderRadius: 8, fontSize: 13, color: '#92400e' }}>{selected.notes}</div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => { setSelected(null); openEdit(selected); }} style={{ flex: 1, padding: '10px', border: '1px solid #4f7c3f', borderRadius: 8, color: '#4f7c3f', background: '#fff', fontWeight: 600, cursor: 'pointer' }}>Hariri</button>
              <button onClick={() => doDelete(selected.id)} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 8, background: '#ef4444', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Futa</button>
            </div>
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 600, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#1e293b' }}>{editingId ? 'Hariri Mdhamini' : 'Ongeza Mdhamini'}</div>
              <button onClick={() => setShowForm(false)} style={{ border: 'none', background: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>
            {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {!editingId && <Field label="ID ya Mkopo" value={form.loan_id ?? ''} onChange={v => set('loan_id', v)} placeholder="e.g. 42" />}
              <Field label="Jina Kamili *" value={form.full_name ?? ''} onChange={v => set('full_name', v)} />
              <Field label="Uhusiano" value={form.relationship ?? ''} onChange={v => set('relationship', v)} placeholder="Ndugu, Rafiki..." />
              <Field label="Simu" value={form.phone ?? ''} onChange={v => set('phone', v)} />
              <Field label="Namba ya NIDA" value={form.nida_number ?? ''} onChange={v => set('nida_number', v)} />
              <SelectField label="Jinsia" value={form.gender ?? ''} onChange={v => set('gender', v)} options={['Mwanaume', 'Mwanamke']} />
              <Field label="Hali ya Ajira" value={form.employment_status ?? ''} onChange={v => set('employment_status', v)} placeholder="Mwajiriwa, Mfanyabiashara..." />
              <Field label="Mwajiri" value={form.employer_name ?? ''} onChange={v => set('employer_name', v)} />
              <Field label="Mapato ya Kila Mwezi (TZS)" value={form.monthly_income ?? ''} onChange={v => set('monthly_income', v)} type="number" />
              <Field label="Mkoa" value={form.region ?? ''} onChange={v => set('region', v)} />
              <Field label="Wilaya" value={form.district ?? ''} onChange={v => set('district', v)} />
              <Field label="Kata" value={form.ward ?? ''} onChange={v => set('ward', v)} />
              <SelectField label="Hali" value={form.status ?? 'active'} onChange={v => set('status', v)} options={['active', 'released', 'defaulted']} labels={['Hai', 'Aliyeachiliwa', 'Mkosaji']} />
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>Maelezo</label>
              <textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} rows={3} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontWeight: 600, cursor: 'pointer' }}>Ghairi</button>
              <button onClick={save} disabled={saving} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 8, background: '#4f7c3f', color: '#fff', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Inahifadhi...' : 'Hifadhi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>{label}</label>
      <input type={type ?? 'text'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
    </div>
  );
}

function SelectField({ label, value, onChange, options, labels }: { label: string; value: string; onChange: (v: string) => void; options: string[]; labels?: string[] }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
        <option value="">-- Chagua --</option>
        {options.map((o, i) => <option key={o} value={o}>{labels?.[i] ?? o}</option>)}
      </select>
    </div>
  );
}
