import { useEffect, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import {
  RefreshCw, TrendingUp, DollarSign, PieChart as PieIcon,
  Users, CheckCircle2, AlertCircle,
  Search, Filter, ArrowUpRight, Clock, MoreVertical, Activity
} from "lucide-react";

interface Loan {
  id: number;
  name: string;
  amount: number;
  total_paid: number;
  remaining_balance: number;
  payment_status: string;
  status: string;
  completed_at?: string;
}

const RepaymentTracker = () => {
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [completedLoans, setCompletedLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const [repaymentAmount, setRepaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [transactionId, setTransactionId] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedLoanForRepayment, setSelectedLoanForRepayment] = useState<Loan | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const saved = localStorage.getItem("completedLoans");
    if (saved) { try { setCompletedLoans(JSON.parse(saved)); } catch (e) { console.error(e); } }
    await fetchActiveLoans();
  };

  const fetchActiveLoans = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
      const [loansRes, summaryRes] = await Promise.all([
        axios.get(`${API_BASE}/loans/active`, { headers }),
        axios.get(`${API_BASE}/repayments/summary`, { headers })
      ]);
      const allLoans = loansRes.data || [];
      const active: Loan[] = [];
      allLoans.forEach((loan: any) => {
        const bal = Math.round(loan.remaining_balance);
        if (bal <= 0) {
          if (!completedLoans.some(cl => cl.id === loan.id)) {
            const cl = { ...loan, remaining_balance: 0, total_paid: loan.amount, payment_status: 'completed', completed_at: new Date().toISOString() };
            setCompletedLoans(prev => { const u = [cl, ...prev]; localStorage.setItem("completedLoans", JSON.stringify(u)); return u; });
          }
        } else {
          active.push({ ...loan, amount: Math.round(loan.amount), total_paid: Math.round(loan.total_paid || 0), remaining_balance: bal });
        }
      });
      setActiveLoans(active);
      setSummary(summaryRes.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const submitRepayment = async () => {
    const amount = Math.round(parseFloat(repaymentAmount));
    if (isNaN(amount) || amount <= 0) return;
    try {
      const token = localStorage.getItem("token");
      const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
      await axios.post(`${API_BASE}/loans/${selectedLoanForRepayment?.id}/repay`, {
        amount, payment_date: paymentDate, payment_method: paymentMethod, transaction_id: transactionId, notes
      }, { headers: { Authorization: `Bearer ${token}` } });
      setShowRepaymentModal(false);
      await fetchActiveLoans();
    } catch (e: any) { console.error(e); }
  };

  const fmt = (val: any) => `TZS ${Math.round(Number(val)).toLocaleString()}`;
  const currentLoans = activeTab === 'active' ? activeLoans : completedLoans;
  const repRate = summary?.repayment_rate || 0;

  // Sparkline mini-data for each card
  const spark1 = [40, 45, 38, 52, 48, 60, 55, 62, 58, 70];
  const spark2 = [30, 35, 42, 38, 50, 48, 55, 52, 60, 58];
  const spark3 = [60, 55, 50, 58, 45, 48, 42, 40, 38, 35];
  const spark4 = [20, 25, 30, 28, 35, 40, 38, 42, 45, 50];
  const spark5 = [10, 12, 15, 14, 18, 20, 19, 22, 25, 24];
  const spark6 = [5, 8, 6, 10, 12, 14, 11, 15, 18, 20];

  const miniSparkline = (data: number[], color: string) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const w = 120; const h = 32;
    const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
    const areaPoints = points + ` ${w},${h} 0,${h}`;
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
        <defs>
          <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill={`url(#sg-${color.replace('#', '')})`} />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((v, i) => {
          const cx = (i / (data.length - 1)) * w;
          const cy = h - ((v - min) / range) * h;
          return i % 2 === 0 ? <circle key={i} cx={cx} cy={cy} r="2.5" fill={color} /> : null;
        })}
      </svg>
    );
  };

  const statCards = [
    { label: "TOTAL DISBURSED", value: fmt(summary?.total_disbursed || 0), icon: <DollarSign size={20} />, gradient: "linear-gradient(135deg, #6366f1, #818cf8)", spark: miniSparkline(spark1, "#818cf8") },
    { label: "TOTAL REPAID", value: fmt(summary?.total_repaid || 0), icon: <TrendingUp size={20} />, gradient: "linear-gradient(135deg, #10b981, #34d399)", spark: miniSparkline(spark2, "#34d399") },
    { label: "TOTAL OUTSTANDING", value: fmt(summary?.outstanding || 0), icon: <AlertCircle size={20} />, gradient: "linear-gradient(135deg, #f59e0b, #fbbf24)", spark: miniSparkline(spark3, "#fbbf24") },
    { label: "REPAYMENT RATE", value: `${repRate}%`, icon: <PieIcon size={20} />, gradient: "linear-gradient(135deg, #3b82f6, #60a5fa)", spark: miniSparkline(spark4, "#60a5fa") },
    { label: "ACTIVE CLIENTS", value: activeLoans.length, icon: <Users size={20} />, gradient: "linear-gradient(135deg, #8b5cf6, #a78bfa)", spark: miniSparkline(spark5, "#a78bfa") },
    { label: "COMPLETED", value: completedLoans.length, icon: <CheckCircle2 size={20} />, gradient: "linear-gradient(135deg, #f43f5e, #fb7185)", spark: miniSparkline(spark6, "#fb7185") },
  ];

  // Overview multi-line chart data
  const overviewData = [
    { name: 'Jan', Disbursed: 45000, Repaid: 30000, Outstanding: 15000, Rate: 67 },
    { name: 'Feb', Disbursed: 52000, Repaid: 38000, Outstanding: 14000, Rate: 73 },
    { name: 'Mar', Disbursed: 78000, Repaid: 55000, Outstanding: 23000, Rate: 71 },
    { name: 'Apr', Disbursed: 65000, Repaid: 48000, Outstanding: 17000, Rate: 74 },
    { name: 'May', Disbursed: 82000, Repaid: 62000, Outstanding: 20000, Rate: 76 },
    { name: 'Jun', Disbursed: summary?.total_disbursed || 90000, Repaid: summary?.total_repaid || 70000, Outstanding: summary?.outstanding || 20000, Rate: repRate || 78 },
  ];

  // Portfolio Health donut
  const healthData = [
    { name: 'Current', value: 78, color: '#10b981' },
    { name: 'At Risk', value: 15, color: '#f59e0b' },
    { name: 'Critical', value: 7, color: '#ef4444' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#fdfbf7', padding: '1rem 1rem', fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif", color: '#1e293b' }}>

      {/* ─── ACTIONS ─── */}
      <motion.div initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '1.5rem', gap: '0.8rem' }}>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={loadData}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.2rem', borderRadius: '8px', background: 'white', border: '1px solid #e2e8f0', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', color: '#475569', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <RefreshCw size={16} className={loading ? "rt-spin" : ""} /> Refresh
        </motion.button>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.4rem', borderRadius: '8px', background: '#6366f1', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', color: 'white', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
          <ArrowUpRight size={16} /> Export
        </motion.button>
      </motion.div>

      {/* ─── STAT CARDS — SINGLE ROW WITH VERTICAL DIVIDERS ─── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'stretch', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '2rem', overflow: 'hidden' }}>
        {statCards.map((card, i) => (
          <div key={i} className="rt-stat-card"
            style={{ flex: 1, padding: '1.4rem 1.2rem', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '0.8rem', borderLeft: i === 0 ? 'none' : '1px solid #e2e8f0', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.6rem' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b', margin: 0, marginBottom: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.label}</p>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.value}</h3>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: '10px', background: card.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
                {card.icon && <span style={{ transform: 'scale(0.9)' }}>{card.icon}</span>}
              </div>
            </div>
            <div style={{ opacity: 0.6 }}>
              {card.spark}
            </div>
          </div>
        ))}
      </motion.div>

      {/* ─── MAIN CONTENT ─── */}
      <div style={{ maxWidth: '100%', margin: '0 auto' }}>

        {/* ─── CHARTS ROW ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* Overview Area Chart */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            style={{ background: 'white', borderRadius: '12px', padding: '2rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={18} style={{ color: '#6366f1' }} />
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Overview</h2>
              </div>
              <select style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.4rem 0.8rem', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
                <option>Last 6 months</option>
                <option>Last 12 months</option>
                <option>This Year</option>
              </select>
            </div>
            <div style={{ height: 280, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={overviewData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gDisbursed" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gRepaid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gOutstanding" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} /><stop offset="100%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gRate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                  <RechartsTooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, color: '#1e293b', fontWeight: 700, fontSize: '0.8rem' }} formatter={(v: any) => fmt(v)} />
                  <Area type="monotone" dataKey="Disbursed" stroke="#6366f1" strokeWidth={2.5} fill="url(#gDisbursed)" dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="Repaid" stroke="#10b981" strokeWidth={2.5} fill="url(#gRepaid)" dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="Outstanding" stroke="#f59e0b" strokeWidth={2.5} fill="url(#gOutstanding)" dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="Rate" stroke="#3b82f6" strokeWidth={2} fill="url(#gRate)" dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '0.75rem' }}>
              {[{ l: 'Disbursed', c: '#6366f1' }, { l: 'Repaid', c: '#10b981' }, { l: 'Outstanding', c: '#f59e0b' }, { l: 'Repayment Rate', c: '#3b82f6' }].map(item => (
                <div key={item.l} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.c, display: 'inline-block' }}></span> {item.l}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Portfolio Health Donut */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            style={{ background: 'white', borderRadius: '12px', padding: '2rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PieIcon size={18} style={{ color: '#10b981' }} />
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Portfolio Health</h2>
              </div>
              <select style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.4rem 0.8rem', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
                <option>This Month</option>
                <option>Last Month</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ width: '55%', position: 'relative' }}>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={healthData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}>
                      {healthData.map((entry, index) => (<Cell key={index} fill={entry.color} stroke="none" />))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <span style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a' }}>{repRate || 78}%</span>
                  <br />
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981' }}>Healthy</span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                {healthData.map((item) => (
                  <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, display: 'inline-block' }}></span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>{item.name}</span>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* ─── TABLE SECTION ─── */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '2rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.2rem' }}>
            <div style={{ display: 'flex', background: '#f8fafc', padding: 4, borderRadius: 4 }}>
              <button onClick={() => setActiveTab('active')} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', borderRadius: 4, border: 'none', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', background: activeTab === 'active' ? 'white' : 'transparent', color: activeTab === 'active' ? '#4f46e5' : '#64748b', boxShadow: activeTab === 'active' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}>
                <Clock size={14} /> Active Loans
                <span style={{ background: activeTab === 'active' ? '#eef2ff' : '#f1f5f9', color: activeTab === 'active' ? '#6366f1' : '#94a3b8', padding: '1px 7px', borderRadius: 12, fontSize: '0.6rem', fontWeight: 700 }}>{activeLoans.length}</span>
              </button>
              <button onClick={() => setActiveTab('completed')} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', borderRadius: 4, border: 'none', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', background: activeTab === 'completed' ? 'white' : 'transparent', color: activeTab === 'completed' ? '#059669' : '#64748b', boxShadow: activeTab === 'completed' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}>
                <CheckCircle2 size={14} /> Completed
                <span style={{ background: activeTab === 'completed' ? '#ecfdf5' : '#f1f5f9', color: activeTab === 'completed' ? '#10b981' : '#94a3b8', padding: '1px 7px', borderRadius: 12, fontSize: '0.6rem', fontWeight: 700 }}>{completedLoans.length}</span>
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input type="text" placeholder="Search client..." style={{ padding: '0.55rem 0.8rem 0.55rem 2.2rem', borderRadius: 4, border: '1px solid #e2e8f0', background: '#f8fafc', outline: 'none', fontWeight: 600, fontSize: '0.8rem', color: '#1e293b', width: 200 }} />
              </div>
              <button style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.55rem 0.8rem', borderRadius: 4, background: 'white', border: '1px solid #e2e8f0', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', color: '#64748b' }}>
                <Filter size={14} /> Filter
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['#', 'Client Identity', 'Principal', 'Amortized', 'Balance', 'Efficiency', 'Status', 'Management'].map((h, i) => (
                    <th key={h} style={{ textAlign: i === 7 ? 'right' : 'left', padding: '0 0.8rem 1rem', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#94a3b8', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {currentLoans.map((loan, idx) => {
                    const progress = loan.amount > 0 ? (loan.total_paid / loan.amount) * 100 : 0;
                    return (
                      <motion.tr key={loan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: idx * 0.04 }} className="rt-table-row">
                        <td style={{ padding: '1rem 0.8rem', fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>{(idx + 1).toString().padStart(2, '0')}</td>
                        <td style={{ padding: '1rem 0.8rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                            <div className="rt-avatar" style={{ width: 36, height: 36, borderRadius: 4, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', color: '#64748b', border: '1px solid #e2e8f0' }}>
                              {loan.name.charAt(0)}
                            </div>
                            <div>
                              <p style={{ fontWeight: 700, color: '#1e293b', margin: 0, fontSize: '0.85rem' }}>{loan.name}</p>
                              <p style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', margin: 0 }}>LN-{loan.id}</p>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '1rem 0.8rem', fontWeight: 700, color: '#1e293b', fontSize: '0.85rem' }}>{fmt(loan.amount)}</td>
                        <td style={{ padding: '1rem 0.8rem', fontWeight: 700, color: '#10b981', fontSize: '0.85rem' }}>+{fmt(loan.total_paid || 0)}</td>
                        <td style={{ padding: '1rem 0.8rem', fontWeight: 800, color: '#0f172a', fontSize: '0.85rem' }}>{fmt(loan.remaining_balance)}</td>
                        <td style={{ padding: '1rem 0.8rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div style={{ width: 80, height: 5, borderRadius: 3, background: '#1e293b', overflow: 'hidden' }}>
                              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(progress, 100)}%` }} transition={{ duration: 0.8 }}
                                style={{ height: '100%', borderRadius: 3, background: progress >= 90 ? '#10b981' : progress >= 40 ? '#6366f1' : '#f59e0b' }} />
                            </div>
                            <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#e2e8f0' }}>{Math.round(progress)}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '1rem 0.8rem' }}>
                          <span style={{
                            display: 'inline-block', padding: '0.25rem 0.7rem', borderRadius: 16, fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px',
                            background: loan.payment_status === 'completed' ? 'rgba(16,185,129,0.15)' : loan.payment_status === 'overdue' ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)',
                            color: loan.payment_status === 'completed' ? '#34d399' : loan.payment_status === 'overdue' ? '#f87171' : '#a5b4fc'
                          }}>
                            {loan.payment_status || 'Current'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 0.8rem', textAlign: 'right' }}>
                          <div className="rt-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                            <button onClick={() => { setSelectedLoanForRepayment(loan); setShowRepaymentModal(true); }}
                              style={{ padding: '0.4rem 0.9rem', borderRadius: 10, background: '#6366f1', border: 'none', color: 'white', fontWeight: 700, fontSize: '0.65rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }} className="rt-btn-pay">
                              Add Payment
                            </button>
                            <button style={{ padding: '0.4rem', borderRadius: 8, background: '#1e293b', border: '1px solid #334155', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                              <MoreVertical size={14} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
                {currentLoans.length === 0 && !loading && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#475569', fontWeight: 600 }}>No loans found in this category</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── REPAYMENT MODAL ─── */}
        <AnimatePresence>
          {showRepaymentModal && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', backdropFilter: 'blur(10px)', background: 'rgba(0,0,0,0.6)' }}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                style={{ width: '100%', maxWidth: 500, borderRadius: 24, background: '#111827', boxShadow: '0 25px 60px rgba(0,0,0,0.5)', border: '1px solid #1e293b', overflow: 'hidden' }}>
                <div style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', padding: '1.5rem', color: 'white' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 900, margin: 0 }}>Post Repayment</h2>
                    <button onClick={() => setShowRepaymentModal(false)} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>✕</button>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.1rem' }}>{selectedLoanForRepayment?.name.charAt(0)}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '0.65rem', fontWeight: 700, opacity: 0.65, margin: 0, textTransform: 'uppercase' }}>Borrower</p>
                      <p style={{ fontWeight: 900, margin: 0 }}>{selectedLoanForRepayment?.name}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.65rem', fontWeight: 700, opacity: 0.65, margin: 0, textTransform: 'uppercase' }}>Balance</p>
                      <p style={{ fontWeight: 900, margin: 0 }}>{fmt(selectedLoanForRepayment?.remaining_balance)}</p>
                    </div>
                  </div>
                </div>
                <div style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', display: 'block', marginBottom: '0.4rem' }}>Amount</label>
                      <input type="number" value={repaymentAmount} onChange={(e) => setRepaymentAmount(e.target.value)} placeholder="0.00"
                        style={{ width: '100%', padding: '0.8rem', borderRadius: 12, background: '#0b1120', border: '1px solid #1e293b', outline: 'none', fontWeight: 800, fontSize: '0.9rem', color: '#e2e8f0', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', display: 'block', marginBottom: '0.4rem' }}>Date</label>
                      <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
                        style={{ width: '100%', padding: '0.8rem', borderRadius: 12, background: '#0b1120', border: '1px solid #1e293b', outline: 'none', fontWeight: 700, fontSize: '0.85rem', color: '#e2e8f0', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
                    {['cash', 'bank', 'mobile'].map(m => (
                      <button key={m} onClick={() => setPaymentMethod(m)}
                        style={{ flex: 1, padding: '0.75rem', borderRadius: 12, border: paymentMethod === m ? '2px solid #6366f1' : '1px solid #1e293b', background: paymentMethod === m ? 'rgba(99,102,241,0.1)' : '#0b1120', fontWeight: 700, textTransform: 'capitalize', cursor: 'pointer', color: paymentMethod === m ? '#a5b4fc' : '#64748b', fontSize: '0.8rem', transition: 'all 0.2s' }}>
                        {m}
                      </button>
                    ))}
                  </div>
                  <input type="text" placeholder="Reference / Transaction ID" value={transactionId} onChange={(e) => setTransactionId(e.target.value)}
                    style={{ width: '100%', padding: '0.8rem', borderRadius: 12, background: '#0b1120', border: '1px solid #1e293b', outline: 'none', fontWeight: 700, fontSize: '0.8rem', color: '#e2e8f0', marginTop: '0.8rem', boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1.5rem' }}>
                    <button onClick={() => setShowRepaymentModal(false)} style={{ flex: 1, padding: '0.85rem', borderRadius: 14, background: '#1e293b', border: 'none', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', color: '#94a3b8' }}>Discard</button>
                    <button onClick={submitRepayment} style={{ flex: 2, padding: '0.85rem', borderRadius: 14, background: '#6366f1', border: 'none', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', color: 'white', boxShadow: '0 6px 20px rgba(99,102,241,0.35)' }}>Confirm Payment</button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .rt-spin { animation: rt-spin 1s linear infinite; }
        @keyframes rt-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .rt-stat-card:hover { background: #fafbff; }
        .rt-table-row { border-bottom: 1px solid #f1f5f9; transition: all 0.15s; }
        .rt-table-row:hover { background: #fdfbf7; }
        .rt-table-row:hover .rt-avatar { background: white !important; color: #4f46e5 !important; border-color: #6366f1 !important; }
        .rt-table-row .rt-actions { opacity: 0; transition: opacity 0.2s; }
        .rt-table-row:hover .rt-actions { opacity: 1; }
        .rt-btn-pay:hover { background: #4f46e5 !important; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 5px; }
        select::-ms-expand { display: none; }
      `}</style>
      </div>
    </div>
  );
};

export default RepaymentTracker;