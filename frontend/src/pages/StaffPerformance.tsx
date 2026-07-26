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

const GRADE_COLOR: Record<string, string> = { A:'#059669', B:'#0ea5e9', C:'#f59e0b', D:'#ef4444', E:'#7c3aed', '—':'#9ca3af' };
const GRADE_BG:    Record<string, string> = { A:'#d1fae5', B:'#e0f2fe', C:'#fef9c3', D:'#fee2e2', E:'#f5f3ff', '—':'#f1f5f9' };
const ROLE_LABEL:  Record<string, string> = {
  loan_officer:'Loan Officer', loan_manager:'Loan Manager',
  finance_officer:'Finance Officer', general_manager:'General Manager',
  managing_director:'Managing Director', admin:'Administrator',
};
const AVATAR_PALETTE = [
  ['#6366f1','#ede9fe'],['#0ea5e9','#e0f2fe'],['#059669','#d1fae5'],
  ['#f59e0b','#fef9c3'],['#dc2626','#fee2e2'],['#7c3aed','#f5f3ff'],
  ['#0891b2','#cffafe'],['#16a34a','#dcfce7'],
];

const fmt  = (n: number) => 'TZS ' + Math.round(n).toLocaleString();
const pct  = (n: number) => `${n.toFixed(1)}%`;
const initials = (name: string) => name.trim().split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);

const today = () => new Date().toISOString().slice(0,10);
const yearStart = () => { const d=new Date(); d.setMonth(0,1); return d.toISOString().slice(0,10); };
const monthStart = () => { const d=new Date(); d.setDate(1); return d.toISOString().slice(0,10); };
const quarterStart = () => { const d=new Date(); d.setMonth(Math.floor(d.getMonth()/3)*3,1); return d.toISOString().slice(0,10); };

function Avatar({ name, idx, size=44 }: { name:string; idx:number; size?:number }) {
  const [fg,bg] = AVATAR_PALETTE[idx % AVATAR_PALETTE.length];
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:bg, color:fg, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:size*.33, flexShrink:0, border:`2px solid ${fg}44`, letterSpacing:-.5 }}>
      {initials(name)}
    </div>
  );
}

function Bar({ value, max=100, color='#4f46e5', h=6 }: { value:number; max?:number; color?:string; h?:number }) {
  const w = max>0 ? Math.min(100,(value/max)*100) : 0;
  return (
    <div style={{ height:h, background:'#e2e8f0', borderRadius:h, overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${w}%`, background:color, borderRadius:h, transition:'width .6s ease' }}/>
    </div>
  );
}

function GradePill({ grade }: { grade:string }) {
  const c = GRADE_COLOR[grade]??'#9ca3af', bg = GRADE_BG[grade]??'#f1f5f9';
  return (
    <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:32, height:32, borderRadius:'50%', background:bg, color:c, fontWeight:900, fontSize:14, border:`2px solid ${c}`, boxShadow:`0 0 0 3px ${c}22` }}>
      {grade}
    </span>
  );
}

const QUICK_FILTERS = [
  { label:'Mwezi Huu', from:monthStart, to:today },
  { label:'Robo', from:quarterStart, to:today },
  { label:'Mwaka', from:yearStart, to:today },
  { label:'Wakati Wote', from:()=>'2020-01-01', to:today },
];

export default function StaffPerformance() {
  const [officers, setOfficers]     = useState<Officer[]>([]);
  const [summary, setSummary]       = useState<Summary|null>(null);
  const [loading, setLoading]       = useState(true);
  const [from, setFrom]             = useState(yearStart);
  const [to, setTo]                 = useState(today);
  const [activeQ, setActiveQ]       = useState(2); // "Mwaka" selected by default
  const [detail, setDetail]         = useState<OfficerDetail|null>(null);
  const [detailLoad, setDetailLoad] = useState(false);
  const [sortKey, setSortKey]       = useState<keyof Officer>('total_amount');
  const [sortDir, setSortDir]       = useState<'asc'|'desc'>('desc');
  const [me, setMe]                 = useState<{id:number;role:string;name:string}|null>(null);
  const [myDetail, setMyDetail]     = useState<OfficerDetail|null>(null);

  useEffect(() => {
    try { const u=localStorage.getItem('user'); if(u) setMe(JSON.parse(u)); } catch{}
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    axios.get('/api/v1/staff/performance', { params:{from,to} })
      .then(r => { setOfficers(r.data.data.officers??[]); setSummary(r.data.data.summary??null); })
      .catch(()=>{})
      .finally(()=>setLoading(false));
  }, [from,to]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!me || me.role !== 'loan_officer') return;
    axios.get(`/api/v1/staff/performance/${me.id}`, { params:{from,to} })
      .then(r=>setMyDetail(r.data.data)).catch(()=>{});
  }, [me, from, to]);

  const openDetail = (id: number) => {
    setDetailLoad(true);
    setDetail(null);
    axios.get(`/api/v1/staff/performance/${id}`, { params:{from,to} })
      .then(r=>setDetail(r.data.data)).catch(()=>setDetail(null))
      .finally(()=>setDetailLoad(false));
  };

  const applyQuick = (i: number) => {
    setActiveQ(i);
    setFrom(QUICK_FILTERS[i].from());
    setTo(QUICK_FILTERS[i].to());
  };

  const sorted = [...officers].sort((a,b) => {
    const av=a[sortKey] as number, bv=b[sortKey] as number;
    return sortDir==='asc' ? (av<bv?-1:1) : (av>bv?-1:1);
  });

  const top3    = [...officers].sort((a,b)=>b.total_amount-a.total_amount).slice(0,3);
  const maxAmt  = Math.max(...officers.map(o=>o.total_amount),1);
  const isOfficer = me?.role === 'loan_officer';

  const col = (key: keyof Officer, label: string) => (
    <th className="sth" onClick={()=>{ setSortKey(key); setSortDir(d=>sortKey===key?(d==='asc'?'desc':'asc'):'desc'); }}>
      {label}{sortKey===key ? (sortDir==='desc'?' ↓':' ↑') : ''}
    </th>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100%', background:'#eef2f7', fontFamily:'Inter,system-ui,sans-serif' }}>
      <style>{`
        /* ── Header bar (matches payroll tab-bar style) ── */
        .sp-hero { display:flex; align-items:center; gap:0; padding:0 20px; background:linear-gradient(135deg,#0a1628 0%,#102a43 50%,#1a3050 100%); position:sticky; top:0; z-index:10; border-bottom:2px solid rgba(0,0,0,.4); overflow-x:auto; flex-shrink:0; min-height:52px; box-shadow:0 2px 12px rgba(0,0,0,.3); }
        .sp-hero::-webkit-scrollbar { display:none; }
        .sp-hero-dots { display:none; }
        /* ── Quick filters ────────────────────── */
        .sp-qbtn { padding:0 18px; background:transparent; color:rgba(255,255,255,.55); border:none; border-bottom:3px solid transparent; margin-bottom:-2px; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; transition:all .18s; letter-spacing:.2px; display:flex; align-items:center; height:52px; white-space:nowrap; }
        .sp-qbtn:hover { background:rgba(255,255,255,.06); color:rgba(255,255,255,.85); border-bottom-color:rgba(255,255,255,.15); }
        .sp-qbtn.active { color:#f59e0b; border-bottom-color:#f59e0b; background:rgba(255,255,255,.06); }
        /* ── Podium cards ─────────────────────── */
        .sp-pod { border-radius:18px; display:flex; flex-direction:column; align-items:center; padding:22px 16px 18px; gap:10px; cursor:pointer; transition:transform .2s,box-shadow .2s; position:relative; }
        .sp-pod:hover { transform:translateY(-4px); }
        .sp-pod-1 { background:linear-gradient(135deg,#fffbeb,#fef3c7); border:2px solid #f59e0b; box-shadow:0 8px 32px rgba(245,158,11,.25); min-width:160px; }
        .sp-pod-2 { background:#fff; border:1.5px solid #e2e8f0; box-shadow:0 4px 20px rgba(0,0,0,.08); min-width:140px; }
        .sp-pod-3 { background:#fff; border:1.5px solid #e2e8f0; box-shadow:0 4px 16px rgba(0,0,0,.07); min-width:130px; }
        /* ── Stat cards ───────────────────────── */
        .sp-stat { background:#fff; border-radius:14px; padding:16px 18px; border:1px solid #e2e8f0; box-shadow:0 1px 4px rgba(0,0,0,.06); }
        /* ── Table ────────────────────────────── */
        .sth { padding:11px 14px; text-align:left; color:#64748b; font-weight:700; font-size:11px; letter-spacing:.4px; text-transform:uppercase; cursor:pointer; white-space:nowrap; user-select:none; background:#f8fafc; }
        .sth:hover { color:#1e293b; }
        .str { transition:background .12s; cursor:pointer; }
        .str:hover { background:#f0f4ff !important; }
        /* ── Detail panel ─────────────────────── */
        .sp-overlay { position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:400; display:flex; justify-content:flex-end; backdrop-filter:blur(3px); }
        .sp-panel { width:480px; max-width:100vw; background:#f0f4f8; height:100%; overflow:auto; box-shadow:-16px 0 60px rgba(0,0,0,.3); display:flex; flex-direction:column; }
        .sp-panel-head { background:linear-gradient(135deg,#0a1628 0%,#102a43 55%,#1a3050 100%); padding:28px 24px 24px; flex-shrink:0; position:relative; overflow:hidden; }
        .sp-panel-head::after { content:''; position:absolute; inset:0; background:radial-gradient(ellipse 80% 80% at 90% -10%,rgba(79,70,229,.35) 0%,transparent 65%); pointer-events:none; }
        .sp-panel-kpi-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:14px 14px 0; }
        .sp-kpi-card { border-radius:12px; padding:10px 14px; display:flex; align-items:center; gap:12px; border-left:4px solid; border-top:1px solid; border-right:1px solid; border-bottom:1px solid; }
        .sp-rates-box { margin:14px 18px 0; background:#fff; border-radius:14px; padding:18px 18px 6px; box-shadow:0 1px 4px rgba(0,0,0,.07); border:1px solid #e2e8f0; }
        .sp-totals-box { margin:12px 18px 0; border-radius:14px; overflow:hidden; border:1px solid #e2e8f0; box-shadow:0 1px 4px rgba(0,0,0,.06); }
        .sp-total-row { display:flex; justify-content:space-between; align-items:center; padding:13px 18px; background:#fff; border-bottom:1px solid #f1f5f9; font-size:13px; }
        .sp-total-row:last-child { border-bottom:none; }
        .sp-trend-box { margin:12px 18px 18px; background:#fff; border-radius:14px; padding:18px; border:1px solid #e2e8f0; box-shadow:0 1px 4px rgba(0,0,0,.06); }
      `}</style>

      {/* ── HEADER BAR (payroll-style) ────────────────────── */}
      <div className="sp-hero">
        {/* Title */}
        <div style={{ display:'flex', alignItems:'center', gap:10, paddingRight:18, borderRight:'1px solid rgba(255,255,255,.12)', flexShrink:0 }}>
          <div style={{ background:'rgba(245,158,11,.2)', borderRadius:8, padding:'5px 7px', border:'1px solid rgba(245,158,11,.3)', display:'flex', alignItems:'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <div style={{ color:'#fff', fontWeight:800, fontSize:13, letterSpacing:.1, lineHeight:1.2 }}>Loan Officer Performance</div>
            <div style={{ color:'rgba(255,255,255,.45)', fontSize:10, fontWeight:500, lineHeight:1.2 }}>Leaderboard ya Maafisa · mchezo wa ushindani</div>
          </div>
        </div>
        {/* Quick filter tabs */}
        {QUICK_FILTERS.map((q,i)=>(
          <button key={q.label} className={`sp-qbtn${activeQ===i?' active':''}`} onClick={()=>applyQuick(i)}>{q.label}</button>
        ))}
        {/* Spacer */}
        <div style={{ flex:1 }}/>
        {/* Date pickers + search */}
        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
          <input type="date" value={from} onChange={e=>{setFrom(e.target.value);setActiveQ(-1);}} style={{ padding:'5px 8px', border:'1px solid rgba(255,255,255,.2)', borderRadius:8, fontSize:12, fontFamily:'inherit', background:'rgba(255,255,255,.08)', color:'#fff', colorScheme:'dark', outline:'none' }}/>
          <span style={{ color:'rgba(255,255,255,.3)', fontSize:14 }}>–</span>
          <input type="date" value={to} onChange={e=>{setTo(e.target.value);setActiveQ(-1);}} style={{ padding:'5px 8px', border:'1px solid rgba(255,255,255,.2)', borderRadius:8, fontSize:12, fontFamily:'inherit', background:'rgba(255,255,255,.08)', color:'#fff', colorScheme:'dark', outline:'none' }}/>
          <button onClick={load} style={{ padding:'7px 18px', background:'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'#fff', border:'none', borderRadius:8, fontWeight:700, cursor:'pointer', fontSize:13, fontFamily:'inherit', boxShadow:'0 2px 10px rgba(79,70,229,.4)', transition:'all .15s' }}>Tafuta</button>
        </div>

      </div>

      {/* ── Podium ──────────────────────────────────────────── */}
      {!loading && top3.length > 1 && (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'flex-end', gap:12, padding:'28px 28px 0', background:'#eef2f7' }}>
          {top3[1] && (
            <div className="sp-pod sp-pod-2" onClick={()=>openDetail(top3[1].user_id)} style={{ order:1 }}>
              <div style={{ fontSize:26 }}>🥈</div>
              <Avatar name={top3[1].name} idx={1} size={50} />
              <div style={{ color:'#334155', fontWeight:700, fontSize:13, textAlign:'center', lineHeight:1.2 }}>{top3[1].name}</div>
              <div style={{ background:'rgba(100,116,139,.15)', color:'#475569', borderRadius:20, padding:'2px 10px', fontSize:10, fontWeight:700, textAlign:'center' }}>{fmt(top3[1].total_amount)}</div>
              <GradePill grade={top3[1].collection_score}/>
            </div>
          )}
          {top3[0] && (
            <div className="sp-pod sp-pod-1" onClick={()=>openDetail(top3[0].user_id)} style={{ order:2, transform:'translateY(-16px)' }}>
              <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:'linear-gradient(135deg,#f59e0b,#fbbf24)', borderRadius:20, padding:'2px 10px', fontSize:10, fontWeight:800, color:'#78350f', whiteSpace:'nowrap' }}>★ #1 BORA</div>
              <div style={{ fontSize:32 }}>🥇</div>
              <Avatar name={top3[0].name} idx={0} size={62} />
              <div style={{ color:'#92400e', fontWeight:800, fontSize:14, textAlign:'center', lineHeight:1.2 }}>{top3[0].name}</div>
              <div style={{ background:'rgba(245,158,11,.2)', color:'#92400e', borderRadius:20, padding:'3px 12px', fontSize:11, fontWeight:800 }}>{fmt(top3[0].total_amount)}</div>
              <div style={{ fontSize:11, color:'#b45309' }}>{pct(top3[0].disbursement_rate)} utoaji</div>
              <GradePill grade={top3[0].collection_score}/>
            </div>
          )}
          {top3[2] && (
            <div className="sp-pod sp-pod-3" onClick={()=>openDetail(top3[2].user_id)} style={{ order:3 }}>
              <div style={{ fontSize:24 }}>🥉</div>
              <Avatar name={top3[2].name} idx={2} size={44} />
              <div style={{ color:'#374151', fontWeight:700, fontSize:12, textAlign:'center', lineHeight:1.2 }}>{top3[2].name}</div>
              <div style={{ background:'rgba(217,119,6,.12)', color:'#92400e', borderRadius:20, padding:'2px 10px', fontSize:10, fontWeight:700 }}>{fmt(top3[2].total_amount)}</div>
              <GradePill grade={top3[2].collection_score}/>
            </div>
          )}
        </div>
      )}

      {/* ── My personal stats (officer own view) ─────────── */}
      {isOfficer && myDetail && (
        <div style={{ padding:'0 28px 4px' }}>
          <div style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)', borderRadius:16, padding:'20px 24px', boxShadow:'0 4px 20px rgba(79,70,229,.3)', marginTop:-4 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <Avatar name={myDetail.user.name} idx={0} size={44} />
              <div>
                <div style={{ fontWeight:800, fontSize:16, color:'#fff' }}>Takwimu Zangu — {myDetail.user.name}</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,.6)' }}>{myDetail.period.from} — {myDetail.period.to}</div>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:10 }}>
              {[
                { l:'Zilizowekwa', v:myDetail.kpis.total_submitted, c:'#818cf8' },
                { l:'Zilitolewa', v:myDetail.kpis.total_disbursed, c:'#34d399' },
                { l:'Zilikataliwa', v:myDetail.kpis.total_rejected, c:'#f87171' },
                { l:'Vilivyochelewa', v:myDetail.kpis.overdue_count, c:'#fbbf24' },
                { l:'Utoaji %', v:pct(myDetail.kpis.disbursement_rate), c:'#7dd3fc' },
                { l:'Mkusanyiko %', v:pct(myDetail.kpis.collection_rate), c:'#c4b5fd' },
              ].map(s=>(
                <div key={s.l} style={{ background:'rgba(255,255,255,.1)', borderRadius:10, padding:'10px 12px', border:'1px solid rgba(255,255,255,.15)' }}>
                  <div style={{ fontWeight:900, fontSize:20, color:s.c }}>{s.v}</div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', marginTop:2 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Summary cards ────────────────────────────────── */}
      {summary && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, padding:'16px 28px 0' }}>
          {[
            { l:'Maafisa', v:summary.total_officers, icon:'👥', c:'#6366f1', bar:'#ede9fe' },
            { l:'Maombi Yote', v:summary.total_submitted, icon:'📋', c:'#0ea5e9', bar:'#dbeafe' },
            { l:'Mikopo Ilitolewa', v:summary.total_disbursed, icon:'✅', c:'#059669', bar:'#dcfce7' },
            { l:'Jumla ya Mikopo', v:fmt(summary.total_amount), icon:'💰', c:'#f59e0b', bar:'#fef9c3' },
            { l:'Makusanyo', v:fmt(summary.total_collected), icon:'📥', c:'#7c3aed', bar:'#f5f3ff' },
          ].map(s=>(
            <div key={s.l} className="sp-stat" style={{ borderLeft:`3px solid ${s.c}` }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ background:s.bar, borderRadius:10, width:40, height:40, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{s.icon}</div>
                <div>
                  <div style={{ fontWeight:800, fontSize:typeof s.v==='number'?22:13, color:s.c, lineHeight:1.1 }}>{s.v}</div>
                  <div style={{ fontSize:11, color:'#94a3b8', fontWeight:600, marginTop:2 }}>{s.l}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Avg disbursement rate bar ─────────────────────── */}
      {summary && (
        <div style={{ padding:'12px 28px 0' }}>
          <div className="sp-stat" style={{ display:'flex', alignItems:'center', gap:16 }}>
            <span style={{ fontSize:14, color:'#64748b', fontWeight:600, minWidth:220, whiteSpace:'nowrap' }}>📊 Wastani wa Kiwango cha Utoaji</span>
            <div style={{ flex:1 }}><Bar value={summary.avg_disbursement_rate} color='#059669' h={10}/></div>
            <span style={{ fontWeight:900, fontSize:18, color:'#059669', minWidth:55, textAlign:'right' }}>{pct(summary.avg_disbursement_rate)}</span>
          </div>
        </div>
      )}

      {/* ── Leaderboard table ─────────────────────────────── */}
      <div style={{ flex:1, padding:'16px 28px 32px' }}>
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,.06)' }}>
          {/* Table header */}
          <div style={{ padding:'14px 20px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', gap:10, background:'linear-gradient(90deg,#f8fafc,#f1f5f9)' }}>
            <span style={{ fontSize:18 }}>📊</span>
            <span style={{ fontWeight:800, fontSize:15, color:'#0f172a', letterSpacing:-.2 }}>Orodha ya Maafisa</span>
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ background:'#4f46e5', color:'#fff', borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700 }}>{officers.length} maafisa</span>
            </div>
          </div>

          {loading ? (
            <div style={{ padding:72, textAlign:'center' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>⏳</div>
              <div style={{ color:'#94a3b8', fontWeight:600 }}>Inapakia takwimu...</div>
            </div>
          ) : officers.length === 0 ? (
            <div style={{ padding:72, textAlign:'center' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📭</div>
              <div style={{ color:'#94a3b8', fontWeight:600, fontSize:15 }}>Hakuna data kwa kipindi hiki</div>
              <div style={{ color:'#cbd5e1', fontSize:12, marginTop:6 }}>Badilisha kipindi cha tarehe au bonyeza "Wakati Wote"</div>
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ borderBottom:'2px solid #e2e8f0' }}>
                    <th className="sth" style={{ width:48, cursor:'default' }}>#</th>
                    {col('name','Afisa')}
                    {col('total_submitted','Maombi')}
                    {col('total_disbursed','Ilitolewa')}
                    {col('disbursement_rate','Utoaji %')}
                    {col('total_amount','Kiasi')}
                    {col('total_collected','Makusanyo')}
                    {col('overdue_count','Vilivyochelewa')}
                    <th className="sth" style={{ textAlign:'center', cursor:'default' }}>Daraja</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((o,i) => {
                    const rank = officers.indexOf(o)+1;
                    const isMe = me?.id===o.user_id;
                    const rankIcon = rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':null;
                    return (
                      <tr key={o.user_id} className="str" onClick={()=>openDetail(o.user_id)}
                        style={{ borderBottom:'1px solid #f8fafc', background:isMe?'#f0f4ff':i%2===0?'#fff':'#fafbff' }}>
                        <td style={{ padding:'12px 14px', fontWeight:800, textAlign:'center' }}>
                          {rankIcon
                            ? <span style={{ fontSize:20 }}>{rankIcon}</span>
                            : <span style={{ color:'#cbd5e1', fontSize:13 }}>{rank}</span>}
                        </td>
                        <td style={{ padding:'12px 14px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <Avatar name={o.name} idx={i} size={38} />
                            <div>
                              <div style={{ fontWeight:700, color:'#0f172a', fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
                                {o.name}
                                {isMe && <span style={{ background:'#4f46e5', color:'#fff', borderRadius:20, padding:'0 7px', fontSize:9, fontWeight:800, lineHeight:'16px' }}>MIMI</span>}
                              </div>
                              <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>{ROLE_LABEL[o.role]??o.role}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding:'12px 14px', textAlign:'center', fontWeight:700, color:'#4f46e5', fontSize:16 }}>{o.total_submitted}</td>
                        <td style={{ padding:'12px 14px', textAlign:'center' }}>
                          <span style={{ background:'#d1fae5', color:'#059669', borderRadius:20, padding:'3px 10px', fontWeight:700, fontSize:12 }}>{o.total_disbursed}</span>
                        </td>
                        <td style={{ padding:'12px 14px', minWidth:120 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ flex:1 }}><Bar value={o.disbursement_rate} color={o.disbursement_rate>=75?'#059669':o.disbursement_rate>=50?'#f59e0b':'#ef4444'} h={8}/></div>
                            <span style={{ fontSize:11, fontWeight:700, minWidth:42, textAlign:'right', color:o.disbursement_rate>=75?'#059669':o.disbursement_rate>=50?'#f59e0b':'#ef4444' }}>{pct(o.disbursement_rate)}</span>
                          </div>
                        </td>
                        <td style={{ padding:'12px 14px' }}>
                          <div style={{ fontWeight:700, fontSize:12, color:'#1e293b' }}>{fmt(o.total_amount)}</div>
                          <div style={{ marginTop:4 }}><Bar value={o.total_amount} max={maxAmt} color='#6366f1' h={4}/></div>
                        </td>
                        <td style={{ padding:'12px 14px', color:'#0ea5e9', fontWeight:600, fontSize:12, whiteSpace:'nowrap' }}>{fmt(o.total_collected)}</td>
                        <td style={{ padding:'12px 14px', textAlign:'center' }}>
                          {o.overdue_count>0
                            ? <span style={{ background:'#fee2e2', color:'#dc2626', borderRadius:20, padding:'3px 10px', fontWeight:700, fontSize:12 }}>{o.overdue_count}</span>
                            : <span style={{ background:'#d1fae5', color:'#059669', borderRadius:20, padding:'3px 10px', fontWeight:700, fontSize:12 }}>✓ 0</span>}
                        </td>
                        <td style={{ padding:'12px 14px', textAlign:'center' }}><GradePill grade={o.collection_score}/></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Grade legend */}
          {!loading && officers.length > 0 && (
            <div style={{ padding:'12px 20px', borderTop:'1px solid #f1f5f9', display:'flex', gap:12, flexWrap:'wrap', alignItems:'center', background:'#fafbff' }}>
              <span style={{ fontSize:11, color:'#94a3b8', fontWeight:700, letterSpacing:.5, textTransform:'uppercase' }}>Daraja la Mkusanyiko:</span>
              {[['A','90%+'],['B','75%+'],['C','60%+'],['D','40%+'],['E','<40%']].map(([g,r])=>(
                <div key={g} style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <span style={{ background:GRADE_BG[g], color:GRADE_COLOR[g], borderRadius:'50%', width:22, height:22, display:'inline-flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:11, border:`1.5px solid ${GRADE_COLOR[g]}` }}>{g}</span>
                  <span style={{ fontSize:11, color:'#64748b' }}>{r}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Detail slide-in panel ─────────────────────────── */}
      {(detail || detailLoad) && (
        <div className="sp-overlay" onClick={()=>setDetail(null)}>
          <div className="sp-panel" onClick={e=>e.stopPropagation()}>
            {detailLoad ? (
              <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, color:'#94a3b8' }}>
                <div style={{ fontSize:40 }}>⏳</div><div>Inapakia...</div>
              </div>
            ) : detail ? (
              <>
                {/* ── Panel header ── */}
                <div className="sp-panel-head">
                  <div style={{ position:'relative', zIndex:1, display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                      <div style={{ width:62, height:62, borderRadius:'50%', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:22, color:'#fff', border:'3px solid rgba(255,255,255,.25)', boxShadow:'0 4px 16px rgba(79,70,229,.4)', flexShrink:0 }}>
                        {initials(detail.user.name)}
                      </div>
                      <div>
                        <div style={{ fontWeight:900, fontSize:20, color:'#fff', letterSpacing:-.3 }}>{detail.user.name}</div>
                        <div style={{ fontSize:12, color:'rgba(255,255,255,.6)', marginTop:3, display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ background:'rgba(79,70,229,.35)', border:'1px solid rgba(99,102,241,.5)', borderRadius:20, padding:'1px 9px', fontSize:10, fontWeight:700, color:'#a5b4fc' }}>{ROLE_LABEL[detail.user.role]??detail.user.role}</span>
                        </div>
                        <div style={{ fontSize:10, color:'rgba(255,255,255,.35)', marginTop:6, fontFamily:'monospace', letterSpacing:.3 }}>{detail.period.from} — {detail.period.to}</div>
                      </div>
                    </div>
                    <button onClick={()=>setDetail(null)} style={{ background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.2)', color:'rgba(255,255,255,.8)', width:36, height:36, borderRadius:'50%', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .15s' }}>×</button>
                  </div>
                  {/* ── Rate strips inside header ── */}
                  <div style={{ position:'relative', zIndex:1, marginTop:20, display:'flex', gap:10 }}>
                    {[
                      { label:'Kiwango cha Utoaji',     value:pct(detail.kpis.disbursement_rate), color:'#34d399', borderL:'#34d399', bg:'rgba(52,211,153,.1)' },
                      { label:'Kiwango cha Mkusanyo',   value:pct(detail.kpis.collection_rate),   color:'#38bdf8', borderL:'#38bdf8', bg:'rgba(56,189,248,.1)' },
                    ].map(s=>(
                      <div key={s.label} style={{ flex:1, background:s.bg, borderLeft:`3px solid ${s.borderL}`, borderTop:'1px solid rgba(255,255,255,.1)', borderRight:'1px solid rgba(255,255,255,.1)', borderBottom:'1px solid rgba(255,255,255,.1)', borderRadius:'0 10px 10px 0', padding:'10px 14px' }}>
                        <div style={{ fontSize:20, fontWeight:900, color:s.color, letterSpacing:-.5 }}>{s.value}</div>
                        <div style={{ fontSize:10, color:'rgba(255,255,255,.5)', fontWeight:600, marginTop:3, textTransform:'uppercase', letterSpacing:.5 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── KPI cards ── */}
                <div className="sp-panel-kpi-grid">
                  {([
                    { icon:'📋', label:'Maombi Yote',    value:detail.kpis.total_submitted, color:'#4f46e5', bg:'#f5f3ff', borderL:'#4f46e5', borderO:'#c4b5fd' },
                    { icon:'✅', label:'Zilitolewa',      value:detail.kpis.total_disbursed,  color:'#059669', bg:'#f0fdf4', borderL:'#059669', borderO:'#6ee7b7' },
                    { icon:'❌', label:'Zilikataliwa',    value:detail.kpis.total_rejected,   color:'#dc2626', bg:'#fff5f5', borderL:'#dc2626', borderO:'#fca5a5' },
                    { icon:'⚠️', label:'Vilivyochelewa', value:detail.kpis.overdue_count,    color:'#d97706', bg:'#fffbeb', borderL:'#f59e0b', borderO:'#fcd34d' },
                  ]).map(k=>(
                    <div key={k.label} className="sp-kpi-card" style={{ background:k.bg, borderLeftColor:k.borderL, borderTopColor:k.borderO, borderRightColor:k.borderO, borderBottomColor:k.borderO }}>
                      <div style={{ fontSize:18, lineHeight:1 }}>{k.icon}</div>
                      <div>
                        <div style={{ fontWeight:900, fontSize:22, color:k.color, lineHeight:1, letterSpacing:-.5 }}>{k.value}</div>
                        <div style={{ fontSize:10, color:'#64748b', fontWeight:700, marginTop:2, whiteSpace:'nowrap' }}>{k.label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── Rate bars ── */}
                <div className="sp-rates-box">
                  <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', letterSpacing:.8, textTransform:'uppercase', marginBottom:14 }}>Viwango vya Utendaji</div>
                  {([
                    ['Kiwango cha Utoaji',     detail.kpis.disbursement_rate, '#059669'],
                    ['Kiwango cha Mkusanyiko', detail.kpis.collection_rate,   '#0ea5e9'],
                  ] as const).map(([l,v,c])=>(
                    <div key={l} style={{ marginBottom:14 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:6 }}>
                        <span style={{ color:'#475569', fontWeight:600 }}>{l}</span>
                        <span style={{ fontWeight:900, color:c, fontSize:15 }}>{pct(v)}</span>
                      </div>
                      <Bar value={v} color={c} h={9}/>
                    </div>
                  ))}
                </div>

                {/* ── Totals ── */}
                <div className="sp-totals-box">
                  {([
                    ['💼', 'Jumla ya Mikopo',    fmt(detail.kpis.total_amount),     '#102a43'],
                    ['📥', 'Jumla ya Makusanyo', fmt(detail.kpis.total_collected),  '#059669'],
                  ] as const).map(([icon,l,v,c])=>(
                    <div key={l} className="sp-total-row">
                      <span style={{ color:'#64748b', fontWeight:600, display:'flex', alignItems:'center', gap:8 }}><span>{icon}</span>{l}</span>
                      <span style={{ fontWeight:900, color:c, fontSize:14 }}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* ── Monthly trend ── */}
                {detail.monthly_trend.length>0 && (
                  <div className="sp-trend-box">
                    <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', letterSpacing:.8, textTransform:'uppercase', marginBottom:14 }}>Mwenendo wa Kila Mwezi</div>
                    {detail.monthly_trend.map(m=>{
                      const mc=Math.max(...detail.monthly_trend.map(x=>x.count),1);
                      return (
                        <div key={m.month} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, fontSize:12 }}>
                          <span style={{ minWidth:58, color:'#64748b', fontWeight:700, fontFamily:'monospace' }}>{m.month}</span>
                          <div style={{ flex:1 }}><Bar value={m.count} max={mc} color='#4f46e5' h={8}/></div>
                          <span style={{ fontWeight:900, minWidth:24, textAlign:'right', color:'#4f46e5' }}>{m.count}</span>
                        </div>
                      );
                    })}
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
