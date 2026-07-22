import { useEffect, useState } from "react";
import axios from "axios";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { API_BASE } from "../lib/api";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface LoanStats {
  manager_review: number;
  gm_review: number;
  md_review: number;
  approved: number;
  total: number;
}

interface DashboardData {
  usersCount: number;
  loanStats: LoanStats;
  isLoading: boolean;
  error: string | null;
}

const Dashboard: FC = () => {
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData>({
    usersCount: 0,
    loanStats: {
      manager_review: 0,
      gm_review: 0,
      md_review: 0,
      approved: 0,
      total: 0,
    },
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const usersRes = await axios.get(`${API_BASE}/users/count`, { headers });
      const loansRes = await axios.get(`${API_BASE}/loans/stats`, { headers });
      
      setData({
        usersCount: usersRes.data.count || 0,
        loanStats: loansRes.data,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      console.error("Error:", error);
      setData((prev) => ({
        ...prev,
        isLoading: false,
        error: t("errors.loadFailed"),
      }));
    }
  };

  const stats = [
    {
      key: "users",
      label: t("stats.totalUsers.label"),
      value: data.usersCount,
      hint: t("stats.totalUsers.hint"),
      color: "#3b82f6",
      progress: data.usersCount > 0 ? Math.min(100, Math.round((data.usersCount / 200) * 100)) : 0,
      route: "/users",
    },
    {
      key: "loans",
      label: t("stats.totalLoans.label"),
      value: data.loanStats.total,
      hint: t("stats.totalLoans.hint"),
      color: "#8b5cf6",
      progress: data.loanStats.total > 0 ? Math.min(100, Math.round((data.loanStats.total / 100) * 100)) : 0,
      route: "/loan-manager",
    },
    {
      key: "approved",
      label: t("stats.approvedLoans.label"),
      value: data.loanStats.approved,
      hint: t("stats.approvedLoans.hint"),
      color: "#10b981",
      progress: data.loanStats.total > 0 ? Math.round((data.loanStats.approved / data.loanStats.total) * 100) : 0,
      route: "/loan-manager",
    },
    {
      key: "pending",
      label: t("stats.pendingRequests.label"),
      value: data.loanStats.manager_review + data.loanStats.gm_review + data.loanStats.md_review,
      hint: t("stats.pendingRequests.hint"),
      color: "#f59e0b",
      progress: data.loanStats.total > 0
        ? Math.round(((data.loanStats.manager_review + data.loanStats.gm_review + data.loanStats.md_review) / data.loanStats.total) * 100)
        : 0,
      route: "/loan-manager",
    },
  ];

  const approvalRate = data.loanStats.total > 0 
    ? Math.round((data.loanStats.approved / data.loanStats.total) * 100) 
    : 0;

  const barChartData = {
    labels: [
      t("charts.roles.loanManager"),
      t("charts.roles.generalManager"),
      t("charts.roles.managingDirector"),
      t("charts.roles.approved"),
    ],
    datasets: [
      {
        label: t("charts.numberOfLoans"),
        data: [
          data.loanStats.manager_review,
          data.loanStats.gm_review,
          data.loanStats.md_review,
          data.loanStats.approved,
        ],
        backgroundColor: ["#f59e0b", "#3b82f6", "#8b5cf6", "#10b981"],
        borderRadius: 6,
      },
    ],
  };

  const pieChartData = {
    labels: [
      t("charts.stages.managerReview"),
      t("charts.stages.gmReview"),
      t("charts.stages.mdReview"),
      t("charts.roles.approved"),
    ],
    datasets: [
      {
        data: [
          data.loanStats.manager_review,
          data.loanStats.gm_review,
          data.loanStats.md_review,
          data.loanStats.approved,
        ],
        backgroundColor: ["#f59e0b", "#3b82f6", "#8b5cf6", "#10b981"],
        borderWidth: 0,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" as const, labels: { font: { size: 11 } } },
      tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${ctx.raw}` } },
    },
    scales: { y: { beginAtZero: true, grid: { color: "#e2e8f0" } } },
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" as const, labels: { font: { size: 11 } } },
      tooltip: { callbacks: { label: (ctx: any) => `${ctx.label}: ${ctx.raw}` } },
    },
  };

  return (
    <div className="dashboard">
      <div className="ph-bar">
        <div className="ph-inner">
          <div className="ph-brand">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            <span>{t("header.title")}</span>
          </div>
        </div>
        <div className="ph-actions">
          <button className="refresh-button" onClick={fetchDashboardData} disabled={data.isLoading}>
            {data.isLoading ? t("header.loading") : t("header.refresh")}
          </button>
        </div>
      </div>

      <div className="dashboard-inner">
      {data.error && (
        <div className="error-message">
          {data.error}
          <button onClick={fetchDashboardData}>{t("errors.retry")}</button>
        </div>
      )}

      <div className="stats-grid">
        {stats.map((s) => (
          <div key={s.key} className="stat-card" style={{ borderTopColor: s.color, cursor: "pointer" }} onClick={() => navigate(s.route)}>
            <div className="stat-card-header">
              <span className="stat-label">{s.label}</span>
              <span className="stat-hint">{s.hint}</span>
            </div>
            <div className="stat-value">{data.isLoading ? "..." : s.value.toLocaleString()}</div>
            <div className="stat-progress">
              <div className="stat-progress-bar" style={{ width: `${s.progress}%`, backgroundColor: s.color }}></div>
            </div>
          </div>
        ))}
      </div>

      <div className="charts-row">
        <div className="chart-container">
          <h3>{t("charts.distributionByStatus")}</h3>
          <div className="chart-wrapper">
            <Bar data={barChartData} options={barOptions} />
          </div>
        </div>
        <div className="chart-container">
          <h3>{t("charts.statusDistribution")}</h3>
          <div className="chart-wrapper">
            <Pie data={pieChartData} options={pieOptions} />
          </div>
        </div>
      </div>

      <div className="quick-stats">
        <div className="quick-stat">
          <div className="quick-stat-value">{data.isLoading ? "..." : `${approvalRate}%`}</div>
          <div className="quick-stat-label">{t("quickStats.approvalRate")}</div>
        </div>
        <div className="quick-stat">
          <div className="quick-stat-value">{data.isLoading ? "..." : data.loanStats.manager_review}</div>
          <div className="quick-stat-label">{t("quickStats.managerReview")}</div>
        </div>
        <div className="quick-stat">
          <div className="quick-stat-value">{data.isLoading ? "..." : data.loanStats.gm_review}</div>
          <div className="quick-stat-label">{t("quickStats.gmReview")}</div>
        </div>
        <div className="quick-stat">
          <div className="quick-stat-value">{data.isLoading ? "..." : data.loanStats.md_review}</div>
          <div className="quick-stat-label">{t("quickStats.mdReview")}</div>
        </div>
      </div>
      </div>{/* /dashboard-inner */}

      <style>{`
        .dashboard {
          padding: 0 0 28px;
          min-height: 100vh;
          background: #f1f5f9;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .ph-bar { display:flex; align-items:stretch; background:#f1f5f9; position:sticky; top:0; z-index:100; border-bottom:2px solid #e2e8f0; min-height:50px; }
        .ph-inner { display:flex; align-items:flex-end; gap:4px; padding:10px 14px 0; flex:1; overflow-x:auto; scrollbar-width:none; -ms-overflow-style:none; }
        .ph-inner::-webkit-scrollbar { display:none; }
        .ph-brand { display:flex; align-items:center; gap:7px; font-size:13px; font-weight:800; color:#102a43; white-space:nowrap; padding-bottom:10px; flex-shrink:0; }
        .ph-sep { width:1px; height:24px; background:#cbd5e1; margin:0 8px 10px; flex-shrink:0; }
        .ph-tab { display:flex; align-items:center; gap:6px; white-space:nowrap; padding:8px 16px; border:none; border-radius:8px 8px 0 0; font-size:13px; font-weight:700; cursor:pointer; background:transparent; color:#64748b; transition:all .15s; flex-shrink:0; font-family:inherit; }
        .ph-tab--active { background:white; color:#102a43; box-shadow:0 -2px 0 #1e5fae inset; }
        .ph-tab:hover:not(.ph-tab--active) { background:#e2e8f0; color:#334155; }
        .ph-actions { display:flex; align-items:center; gap:8px; padding:6px 14px; flex-shrink:0; border-left:1px solid #e2e8f0; background:#f1f5f9; }
        .dashboard-inner { padding: 24px 28px; }

        .dashboard-header {
          display: none;
        }

        .dashboard-header h1 {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 4px 0;
        }

        .dashboard-header p {
          color: #64748b;
          font-size: 14px;
          margin: 0;
        }

        .refresh-button {
          background: #0f172a;
          border: none;
          padding: 8px 20px;
          border-radius: 30px;
          color: white;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .refresh-button:hover {
          background: #1e293b;
        }

        .error-message {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 12px;
          padding: 12px 16px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #dc2626;
          font-size: 13px;
        }

        .error-message button {
          background: #dc2626;
          border: none;
          padding: 4px 12px;
          border-radius: 20px;
          color: white;
          cursor: pointer;
          font-size: 12px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 28px;
        }

        .stat-card {
          background: white;
          border-radius: 16px;
          padding: 18px;
          border-top: 3px solid;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
          border: 1px solid #e2e8f0;
          border-top-width: 3px;
        }

        .stat-card-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        .stat-label {
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-hint {
          font-size: 11px;
          color: #94a3b8;
        }

        .stat-value {
          font-size: 32px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 12px;
        }

        .stat-progress {
          background: #e2e8f0;
          border-radius: 20px;
          height: 6px;
          overflow: hidden;
        }

        .stat-progress-bar {
          height: 6px;
          border-radius: 20px;
          transition: width 0.3s;
        }

        .charts-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 28px;
        }

        .chart-container {
          background: white;
          border-radius: 16px;
          padding: 20px;
          border: 1px solid #e2e8f0;
        }

        .chart-container h3 {
          font-size: 15px;
          font-weight: 600;
          color: #0f172a;
          margin: 0 0 16px 0;
        }

        .chart-wrapper {
          height: 260px;
        }

        .quick-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }

        .quick-stat {
          background: white;
          border-radius: 16px;
          padding: 16px;
          text-align: center;
          border: 1px solid #e2e8f0;
        }

        .quick-stat-value {
          font-size: 28px;
          font-weight: 700;
          color: #0f172a;
        }

        .quick-stat-label {
          font-size: 12px;
          color: #64748b;
          margin-top: 6px;
        }

        @media (max-width: 1100px) {
          .stats-grid, .quick-stats {
            grid-template-columns: repeat(2, 1fr);
          }
          .charts-row {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .dashboard {
            padding: 70px 16px 16px 16px;
          }
          .stats-grid, .quick-stats {
            grid-template-columns: 1fr;
          }
          .dashboard-header {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
