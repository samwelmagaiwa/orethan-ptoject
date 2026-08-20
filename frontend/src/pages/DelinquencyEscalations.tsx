import { useEffect, useState } from "react";
import axios from "axios";

const API_BASE = "/api/v1";
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

interface EscalationRow {
  id: number;
  loan_id: number;
  loan_number: string;
  borrower: string;
  phone: string;
  loan_status: string;
  outstanding: number;
  days_overdue: number;
  escalation_level: string;
  escalated_to: string;
  notes: string;
  escalated_at: string;
  escalation_date: string;
}

const LEVEL_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  loan_manager:       { bg: "#fef3c7", color: "#92400e", label: "Loan Manager" },
  general_manager:    { bg: "#dbeafe", color: "#1e40af", label: "General Manager" },
  managing_director:  { bg: "#fce7f3", color: "#9d174d", label: "Managing Director" },
};

const money = (n: number) =>
  "TZS " + Math.round(n).toLocaleString("en-TZ");

export default function DelinquencyEscalations() {
  const [rows, setRows]     = useState<EscalationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");
  const [search, setSearch] = useState("");
  const [level, setLevel]   = useState("");
  const [from, setFrom]     = useState("");
  const [to, setTo]         = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const params: Record<string, string> = {};
      if (level) params.level = level;
      if (from)  params.from  = from;
      if (to)    params.to    = to;
      const res = await axios.get(`${API_BASE}/escalations`, { headers: authHeaders(), params });
      setRows(res.data?.data?.escalations ?? []);
    } catch {
      setError("Imeshindwa kupakia data. Jaribu tena.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r =>
    !search ||
    r.borrower?.toLowerCase().includes(search.toLowerCase()) ||
    r.loan_number?.toLowerCase().includes(search.toLowerCase()) ||
    r.phone?.includes(search)
  );

  const levelCounts = {
    loan_manager:      rows.filter(r => r.escalation_level === "loan_manager").length,
    general_manager:   rows.filter(r => r.escalation_level === "general_manager").length,
    managing_director: rows.filter(r => r.escalation_level === "managing_director").length,
  };

  return (
    <div style={{ fontFamily: "inherit", minHeight: "100vh", background: "#f1f5f9" }}>
      {/* Header */}
      <div style={{ background: "#f1f5f9", display: "flex", alignItems: "stretch", borderBottom: "2px solid #e2e8f0", position: "sticky", top: 0, zIndex: 10, minHeight: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 20px", flex: 1 }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: "#102a43" }}>Usimamizi wa Mikopo Yenye Tatizo</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>Mikopo iliyopanda kwa ngazi ya ufuatiliaji</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", borderLeft: "1px solid #e2e8f0", background: "#f1f5f9" }}>
          <button onClick={() => window.print()} style={{ background: "#fff", border: "1px solid #e2e8f0", color: "#102a43", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>🖨️ Chapisha</button>
        </div>
      </div>

      <div style={{ padding: "20px 24px", maxWidth: 1200, margin: "0 auto" }}>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
          {(["loan_manager","general_manager","managing_director"] as const).map(lvl => {
            const s = LEVEL_STYLE[lvl];
            return (
              <div key={lvl} style={{ background: "#fff", borderRadius: 12, padding: "16px 20px", border: `1px solid ${s.bg}`, borderLeft: `4px solid ${s.color}`, cursor: "pointer" }}
                onClick={() => setLevel(level === lvl ? "" : lvl)}>
                <div style={{ fontSize: 11, fontWeight: 700, color: s.color, textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: "#1e293b", marginTop: 4 }}>{levelCounts[lvl]}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>kesi {level === lvl ? "— bonyeza kufuta filter" : ""}</div>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div style={{ background: "#fff", borderRadius: 12, padding: "14px 18px", marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
          <input
            placeholder="🔍 Tafuta jina / namba ya mkopo / simu"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 220, border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}
          />
          <select value={level} onChange={e => setLevel(e.target.value)}
            style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13, background: "#fff" }}>
            <option value="">Ngazi zote</option>
            <option value="loan_manager">Loan Manager</option>
            <option value="general_manager">General Manager</option>
            <option value="managing_director">Managing Director</option>
          </select>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", fontSize: 13 }} />
          <span style={{ color: "#94a3b8", fontSize: 13 }}>→</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", fontSize: 13 }} />
          <button onClick={load}
            style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
            Tafuta
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>Inapakia...</div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: 40, color: "#dc2626" }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontWeight: 600 }}>Hakuna mikopo yenye tatizo</div>
            <div style={{ fontSize: 13 }}>Mikopo yote iko sawa kwa sasa</div>
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                    {["#","Namba ya Mkopo","Mkopaji","Simu","Siku Zilizopita","Salio","Ngazi","Aliyepelekewa","Tarehe","Maelezo"].map(h => (
                      <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontWeight: 700, color: "#374151", whiteSpace: "nowrap", fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const ls = LEVEL_STYLE[r.escalation_level] ?? { bg: "#f1f5f9", color: "#475569", label: r.escalation_level };
                    return (
                      <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 ? "#fafafa" : "#fff" }}>
                        <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{i + 1}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap" }}>{r.loan_number}</td>
                        <td style={{ padding: "10px 14px", color: "#1e293b" }}>{r.borrower}</td>
                        <td style={{ padding: "10px 14px", color: "#475569" }}>{r.phone}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <span style={{ background: r.days_overdue >= 60 ? "#fce7f3" : r.days_overdue >= 30 ? "#dbeafe" : "#fef3c7", color: r.days_overdue >= 60 ? "#9d174d" : r.days_overdue >= 30 ? "#1e40af" : "#92400e", padding: "3px 10px", borderRadius: 20, fontWeight: 700, fontSize: 12 }}>
                            {r.days_overdue} siku
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", color: "#dc2626", fontWeight: 600, whiteSpace: "nowrap" }}>{money(r.outstanding)}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ background: ls.bg, color: ls.color, padding: "3px 10px", borderRadius: 20, fontWeight: 700, fontSize: 11, whiteSpace: "nowrap" }}>{ls.label}</span>
                        </td>
                        <td style={{ padding: "10px 14px", color: "#374151" }}>{r.escalated_to}</td>
                        <td style={{ padding: "10px 14px", color: "#64748b", whiteSpace: "nowrap" }}>{r.escalation_date}</td>
                        <td style={{ padding: "10px 14px", color: "#64748b", maxWidth: 300, wordBreak: "break-word" }}>{r.notes}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "10px 18px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", fontSize: 12, color: "#64748b" }}>
              Inaonyesha rekodi {filtered.length} kati ya {rows.length}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          button { display: none !important; }
          div[style*="sticky"] { position: static !important; }
        }
      `}</style>
    </div>
  );
}
