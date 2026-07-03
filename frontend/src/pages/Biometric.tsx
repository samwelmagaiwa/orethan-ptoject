import { useEffect, useState } from "react";
import axios from "axios";
import PageHeader from "../components/PageHeader";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` });
const fmtDate = (d: any) => d ? new Date(d).toLocaleString() : "—";

type Tab = "dashboard" | "devices" | "profiles" | "logs" | "exceptions" | "config";

interface Stats { total_enrollments:number; total_verifications:number; successful_today:number; failed_today:number; exceptions_total:number; enrolled_profiles:number; devices_active:number; }
interface Device { id:number; device_name:string; device_model:string; manufacturer:string; serial_number:string; firmware_version?:string; sdk_version?:string; branch?:string; location?:string; status:string; registered_by?:{name:string}; }
interface LogRow { id:number; action:string; person_type?:string; person_id?:number; finger_name?:string; verification_result?:string; similarity_score?:number; quality_score?:number; device_id?:string; branch?:string; ip_address?:string; notes?:string; logged_at:string; operator?:{name:string}; loan_id?:number; }
interface Profile { id:number; person_type:string; person_id:number; status:string; enrollment_date?:string; fingers_enrolled:number; creator?:{name:string}; }
interface Cfg { min_quality_score:number; min_similarity_score:number; max_retry_attempts:number; required_for_disbursement:boolean; check_duplicates_on_enroll:boolean; allowed_roles:string; exception_roles:string; }

const ROLES = ["admin","finance_officer","loan_officer","loan_manager","general_manager","managing_director","cashier"];

const statusColor: Record<string,string> = { enrolled:"#059669", pending:"#f59e0b", suspended:"#dc2626" };
const resultColor: Record<string,string> = { success:"#059669", failure:"#dc2626", exception:"#d97706", duplicate:"#7c3aed", pending:"#6366f1" };
const deviceStatus: Record<string,string> = { active:"#059669", inactive:"#94a3b8", maintenance:"#d97706" };

const blankDevice = (): Partial<Device> => ({ device_name:"", device_model:"", manufacturer:"", serial_number:"", firmware_version:"", sdk_version:"", branch:"", location:"", status:"active" });

export default function Biometric() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user.role === "admin";

  const [tab, setTab] = useState<Tab>("dashboard");
  const [stats, setStats] = useState<Stats | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [profiles, setProfiles] = useState<any>(null);
  const [logs, setLogs] = useState<any>(null);
  const [_cfg, setCfg] = useState<Cfg | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<{ open:boolean; msg:string; type:"success"|"error" }>({ open:false, msg:"", type:"success" });

  // Device form
  const [devForm, setDevForm] = useState<Partial<Device>>(blankDevice());
  const [devEditing, setDevEditing] = useState<number|null>(null);
  const [devFormOpen, setDevFormOpen] = useState(false);

  // Config form
  const [cfgForm, setCfgForm] = useState<Cfg | null>(null);

  // Log filters
  const [logFilter, setLogFilter] = useState({ action:"", result:"", from:"", to:"" });

  const toast = (msg:string, type:"success"|"error" = "success") => { setModal({ open:true, msg, type }); setTimeout(() => setModal(m => ({ ...m, open:false })), 3500); };

  useEffect(() => { loadStats(); loadDevices(); loadProfiles(); loadLogs(); loadCfg(); }, []);
  useEffect(() => { loadLogs(); }, [logFilter]);

  const loadStats = async () => { try { const r = await axios.get(`${API}/biometric/stats`, { headers: auth() }); setStats(r.data); } catch {} };
  const loadDevices = async () => { try { const r = await axios.get(`${API}/biometric/devices`, { headers: auth() }); setDevices(r.data.data || []); } catch {} };
  const loadProfiles = async () => { try { const r = await axios.get(`${API}/biometric/profiles`, { headers: auth() }); setProfiles(r.data.data); } catch {} };
  const loadLogs = async () => {
    try {
      const r = await axios.get(`${API}/biometric/logs`, { headers: auth(), params: { ...logFilter, per_page: 60 } });
      setLogs(r.data);
    } catch {}
  };
  const loadCfg = async () => {
    try {
      const r = await axios.get(`${API}/biometric/config`, { headers: auth() });
      setCfg(r.data.data);
      setCfgForm(r.data.data);
    } catch {}
  };

  // ── Devices CRUD ─────────────────────────────────────────────────────────
  const saveDevice = async () => {
    setBusy(true);
    try {
      if (devEditing) {
        await axios.put(`${API}/biometric/devices/${devEditing}`, devForm, { headers: auth() });
        toast("Device updated");
      } else {
        await axios.post(`${API}/biometric/devices`, devForm, { headers: auth() });
        toast("Device registered");
      }
      setDevFormOpen(false); setDevEditing(null); setDevForm(blankDevice()); loadDevices(); loadStats();
    } catch (e:any) { toast(e?.response?.data?.message || "Save failed", "error"); }
    finally { setBusy(false); }
  };

  const deleteDevice = async (id:number) => {
    if (!confirm("Remove this device?")) return;
    try { await axios.delete(`${API}/biometric/devices/${id}`, { headers: auth() }); toast("Device removed"); loadDevices(); loadStats(); }
    catch (e:any) { toast(e?.response?.data?.message || "Delete failed", "error"); }
  };

  // ── Profile status ───────────────────────────────────────────────────────
  const changeProfileStatus = async (id:number, status:string) => {
    try {
      await axios.put(`${API}/biometric/profiles/${id}/status`, { status }, { headers: auth() });
      toast(`Profile ${status}`); loadProfiles();
    } catch (e:any) { toast(e?.response?.data?.message || "Failed", "error"); }
  };

  // ── Config save ──────────────────────────────────────────────────────────
  const saveCfg = async () => {
    if (!cfgForm) return;
    setBusy(true);
    try {
      await axios.put(`${API}/biometric/config`, cfgForm, { headers: auth() });
      toast("Configuration saved"); loadCfg();
    } catch (e:any) { toast(e?.response?.data?.message || "Save failed", "error"); }
    finally { setBusy(false); }
  };

  const TABS: { key:Tab; label:string; icon:string }[] = [
    { key:"dashboard",  label:"Dashboard",  icon:"📊" },
    { key:"devices",    label:"Devices",    icon:"🖨️" },
    { key:"profiles",   label:"Profiles",   icon:"👤" },
    { key:"logs",       label:"Audit Logs", icon:"📋" },
    { key:"exceptions", label:"Exceptions", icon:"⚠️" },
    { key:"config",     label:"Config",     icon:"⚙️" },
  ];

  return (
    <div className="bio-page">
      {modal.open && (
        <div className={`bio-toast bio-toast--${modal.type}`}>{modal.msg}</div>
      )}

      <PageHeader
        icon="🔏"
        title="Biometric Management"
        subtitle="Fingerprint enrollment, verification logs, devices & global configuration"
        tabs={TABS}
        activeTab={tab}
        onTabChange={t => setTab(t as Tab)}
      />

      <div className="bio-content">

        {/* ══ DASHBOARD ══════════════════════════════════════════════════════ */}
        {tab === "dashboard" && (
          <div className="bio-card">
            <div className="bio-kpi-grid">
              {[
                { label:"Enrolled Profiles",   value: stats?.enrolled_profiles,    icon:"👤", color:"#1e5fae" },
                { label:"Total Enrollments",   value: stats?.total_enrollments,    icon:"📝", color:"#059669" },
                { label:"Total Verifications", value: stats?.total_verifications,  icon:"🔍", color:"#6366f1" },
                { label:"Verified Today",      value: stats?.successful_today,     icon:"✅", color:"#059669" },
                { label:"Failed Today",        value: stats?.failed_today,         icon:"❌", color:"#dc2626" },
                { label:"Exceptions",          value: stats?.exceptions_total,     icon:"⚠️", color:"#d97706" },
                { label:"Active Devices",      value: stats?.devices_active,       icon:"🖨️", color:"#0891b2" },
              ].map(k => (
                <div key={k.label} className="bio-kpi" style={{ borderTop:`3px solid ${k.color}` }}>
                  <div className="bio-kpi-icon">{k.icon}</div>
                  <div className="bio-kpi-val" style={{ color: k.color }}>{k.value ?? "—"}</div>
                  <div className="bio-kpi-label">{k.label}</div>
                </div>
              ))}
            </div>

            <div className="bio-how-it-works">
              <h3>How Biometric Verification Works</h3>
              <div className="bio-flow">
                {[
                  { step:"1", icon:"🏦", title:"Loan Approved", desc:"Loan reaches awaiting disbursement status" },
                  { step:"2", icon:"👆", title:"Verify Borrower", desc:"Scan borrower's fingerprint — enroll if first time" },
                  { step:"3", icon:"✅", title:"Match Confirmed", desc:"Score ≥ threshold (default 75%) or exception granted" },
                  { step:"4", icon:"👥", title:"Verify Guarantor", desc:"Same process for the loan guarantor" },
                  { step:"5", icon:"💰", title:"Disbursement Unlocked", desc:"Cashier can now enter password and disburse" },
                ].map(s => (
                  <div key={s.step} className="bio-flow-step">
                    <div className="bio-flow-num">{s.step}</div>
                    <div className="bio-flow-icon">{s.icon}</div>
                    <div className="bio-flow-title">{s.title}</div>
                    <div className="bio-flow-desc">{s.desc}</div>
                    {s.step !== "5" && <div className="bio-flow-arrow">→</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ DEVICES ════════════════════════════════════════════════════════ */}
        {tab === "devices" && (
          <div className="bio-card">
            <div className="bio-card-hd">
              <h3>Scanner Devices</h3>
              {isAdmin && <button className="bio-btn bio-btn--primary" onClick={() => { setDevForm(blankDevice()); setDevEditing(null); setDevFormOpen(true); }}>+ Register Device</button>}
            </div>

            {devFormOpen && (
              <div className="bio-form-panel">
                <h4>{devEditing ? "Edit Device" : "Register New Device"}</h4>
                <div className="bio-form-grid">
                  {[
                    { key:"device_name", label:"Device Name", ph:"e.g. Digital Persona U.are.U 4500" },
                    { key:"device_model", label:"Model", ph:"U.are.U 4500" },
                    { key:"manufacturer", label:"Manufacturer", ph:"HID Global / Suprema / Futronic…" },
                    { key:"serial_number", label:"Serial Number *", ph:"SN12345678" },
                    { key:"firmware_version", label:"Firmware Version", ph:"3.2.1" },
                    { key:"sdk_version", label:"SDK Version", ph:"1.4.0" },
                    { key:"branch", label:"Branch", ph:"Main Branch" },
                    { key:"location", label:"Location / Desk", ph:"Cashier Desk 1" },
                  ].map(f => (
                    <div key={f.key} className="bio-form-field">
                      <label>{f.label}</label>
                      <input value={(devForm as any)[f.key] ?? ""} placeholder={f.ph}
                        onChange={e => setDevForm(p => ({ ...p, [f.key]: e.target.value }))} />
                    </div>
                  ))}
                  <div className="bio-form-field">
                    <label>Status</label>
                    <select value={devForm.status ?? "active"} onChange={e => setDevForm(p => ({ ...p, status: e.target.value }))}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>
                </div>
                <div className="bio-form-actions">
                  <button className="bio-btn bio-btn--outline" onClick={() => setDevFormOpen(false)}>Cancel</button>
                  <button className="bio-btn bio-btn--primary" onClick={saveDevice} disabled={busy}>{busy ? "Saving…" : "Save Device"}</button>
                </div>
              </div>
            )}

            <table className="bio-table">
              <thead><tr>
                <th>Name / Model</th><th>Manufacturer</th><th>Serial</th>
                <th>Firmware</th><th>Branch</th><th>Status</th><th>Registered By</th>
                {isAdmin && <th>Actions</th>}
              </tr></thead>
              <tbody>
                {devices.length === 0 && <tr><td colSpan={8} className="bio-tc">No devices registered yet</td></tr>}
                {devices.map(d => (
                  <tr key={d.id}>
                    <td><div className="bio-bold">{d.device_name}</div><div className="bio-sub">{d.device_model}</div></td>
                    <td>{d.manufacturer}</td>
                    <td className="bio-mono">{d.serial_number}</td>
                    <td>{d.firmware_version ?? "—"}</td>
                    <td>{d.branch ?? "—"}</td>
                    <td><span className="bio-badge" style={{ background: deviceStatus[d.status] + "22", color: deviceStatus[d.status] }}>{d.status}</span></td>
                    <td>{d.registered_by?.name ?? "—"}</td>
                    {isAdmin && (
                      <td>
                        <button className="bio-btn-sm bio-btn-sm--edit" onClick={() => { setDevForm(d); setDevEditing(d.id); setDevFormOpen(true); }}>Edit</button>
                        <button className="bio-btn-sm bio-btn-sm--del" onClick={() => deleteDevice(d.id)}>Remove</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ PROFILES ═══════════════════════════════════════════════════════ */}
        {tab === "profiles" && (
          <div className="bio-card">
            <div className="bio-card-hd"><h3>Biometric Profiles</h3></div>
            <table className="bio-table">
              <thead><tr>
                <th>Person Type</th><th>Person ID</th><th>Status</th>
                <th>Fingers Enrolled</th><th>Enrollment Date</th><th>Created By</th>
                {isAdmin && <th>Actions</th>}
              </tr></thead>
              <tbody>
                {(!profiles?.data || profiles.data.length === 0) && <tr><td colSpan={7} className="bio-tc">No profiles yet</td></tr>}
                {(profiles?.data || []).map((p: Profile) => (
                  <tr key={p.id}>
                    <td><span className="bio-type-pill">{p.person_type}</span></td>
                    <td className="bio-mono">#{p.person_id}</td>
                    <td><span className="bio-badge" style={{ background: statusColor[p.status] + "22", color: statusColor[p.status] }}>{p.status}</span></td>
                    <td><span className="bio-fingers">{p.fingers_enrolled} finger{p.fingers_enrolled !== 1 ? "s" : ""}</span></td>
                    <td>{fmtDate(p.enrollment_date)}</td>
                    <td>{p.creator?.name ?? "—"}</td>
                    {isAdmin && (
                      <td>
                        {p.status === "enrolled" && <button className="bio-btn-sm bio-btn-sm--del" onClick={() => changeProfileStatus(p.id, "suspended")}>Suspend</button>}
                        {p.status === "suspended" && <button className="bio-btn-sm bio-btn-sm--edit" onClick={() => changeProfileStatus(p.id, "enrolled")}>Reactivate</button>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ AUDIT LOGS ═════════════════════════════════════════════════════ */}
        {tab === "logs" && (
          <div className="bio-card">
            <div className="bio-card-hd">
              <h3>Immutable Audit Logs</h3>
              <div className="bio-log-filters">
                <select value={logFilter.action} onChange={e => setLogFilter(p => ({ ...p, action: e.target.value }))}>
                  <option value="">All actions</option>
                  {["enroll","verify","duplicate_check","exception","status_change"].map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <select value={logFilter.result} onChange={e => setLogFilter(p => ({ ...p, result: e.target.value }))}>
                  <option value="">All results</option>
                  {["success","failure","exception","duplicate","pending"].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <input type="date" value={logFilter.from} onChange={e => setLogFilter(p => ({ ...p, from: e.target.value }))} />
                <input type="date" value={logFilter.to}   onChange={e => setLogFilter(p => ({ ...p, to:   e.target.value }))} />
                <button className="bio-btn bio-btn--outline" onClick={loadLogs}>↻</button>
              </div>
            </div>

            <div className="bio-log-info">🔒 Audit logs are immutable — they cannot be edited or deleted.</div>

            <div className="bio-table-scroll">
              <table className="bio-table">
                <thead><tr>
                  <th>Time</th><th>Action</th><th>Person</th><th>Loan</th>
                  <th>Finger</th><th>Result</th><th>Score</th><th>Quality</th>
                  <th>Device</th><th>Operator</th><th>IP</th><th>Notes</th>
                </tr></thead>
                <tbody>
                  {(!logs?.data || logs.data.length === 0) && <tr><td colSpan={12} className="bio-tc">No logs found</td></tr>}
                  {(logs?.data || []).map((l: LogRow) => (
                    <tr key={l.id}>
                      <td className="bio-mono" style={{ whiteSpace:"nowrap" }}>{new Date(l.logged_at).toLocaleString()}</td>
                      <td><span className="bio-action-pill">{l.action?.replace(/_/g," ")}</span></td>
                      <td>{l.person_type ? <span>{l.person_type} #{l.person_id}</span> : "—"}</td>
                      <td>{l.loan_id ? `#${l.loan_id}` : "—"}</td>
                      <td>{l.finger_name?.replace(/_/g," ") ?? "—"}</td>
                      <td>{l.verification_result
                        ? <span className="bio-badge" style={{ background: resultColor[l.verification_result] + "22", color: resultColor[l.verification_result] }}>{l.verification_result}</span>
                        : "—"}</td>
                      <td>{l.similarity_score != null ? `${l.similarity_score}%` : "—"}</td>
                      <td>{l.quality_score != null ? `${l.quality_score}%` : "—"}</td>
                      <td className="bio-mono">{l.device_id ?? "—"}</td>
                      <td>{l.operator?.name ?? "—"}</td>
                      <td className="bio-mono">{l.ip_address ?? "—"}</td>
                      <td style={{ maxWidth:160, fontSize:11 }}>{l.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ EXCEPTIONS ═════════════════════════════════════════════════════ */}
        {tab === "exceptions" && (
          <div className="bio-card">
            <div className="bio-card-hd"><h3>Biometric Exceptions</h3></div>
            <p className="bio-exc-note">Exceptions allow loans to proceed when fingerprint verification is not possible. Every exception requires supervisor authorization and is permanently logged.</p>
            <div className="bio-table-scroll">
              <table className="bio-table">
                <thead><tr>
                  <th>Loan ID</th><th>Person</th><th>Reason</th>
                  <th>Notes</th><th>Authorized By</th><th>Operator</th><th>Date</th>
                </tr></thead>
                <tbody>
                  <tr><td colSpan={7} className="bio-tc">Use the Audit Logs tab (action = exception) to see all exception records</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ CONFIG ═════════════════════════════════════════════════════════ */}
        {tab === "config" && cfgForm && (
          <div className="bio-card">
            <div className="bio-card-hd">
              <h3>Global Biometric Configuration</h3>
              {isAdmin && <button className="bio-btn bio-btn--primary" onClick={saveCfg} disabled={busy}>{busy ? "Saving…" : "💾 Save Configuration"}</button>}
            </div>

            <div className="bio-cfg-grid">
              <div className="bio-cfg-section">
                <h4>Quality & Matching Thresholds</h4>
                <div className="bio-cfg-row">
                  <label>Minimum Fingerprint Quality (%)</label>
                  <input type="number" min={0} max={100} value={cfgForm.min_quality_score} onChange={e => setCfgForm(p => p ? { ...p, min_quality_score: +e.target.value } : p)} disabled={!isAdmin} />
                  <span className="bio-cfg-hint">Scans below this quality are rejected. Recommended: 60–75%</span>
                </div>
                <div className="bio-cfg-row">
                  <label>Minimum Similarity Score (%)</label>
                  <input type="number" min={0} max={100} value={cfgForm.min_similarity_score} onChange={e => setCfgForm(p => p ? { ...p, min_similarity_score: +e.target.value } : p)} disabled={!isAdmin} />
                  <span className="bio-cfg-hint">Match threshold for 1:1 verification. Recommended: 75–85%</span>
                </div>
                <div className="bio-cfg-row">
                  <label>Maximum Retry Attempts</label>
                  <input type="number" min={1} max={10} value={cfgForm.max_retry_attempts} onChange={e => setCfgForm(p => p ? { ...p, max_retry_attempts: +e.target.value } : p)} disabled={!isAdmin} />
                  <span className="bio-cfg-hint">How many times operator may retry before exception is required</span>
                </div>
              </div>

              <div className="bio-cfg-section">
                <h4>Module Behaviour</h4>
                <div className="bio-cfg-toggle-row">
                  <div>
                    <div className="bio-cfg-toggle-label">Required for Disbursement</div>
                    <div className="bio-cfg-toggle-hint">If OFF, disbursement is allowed without biometric (not recommended)</div>
                  </div>
                  <label className="bio-toggle">
                    <input type="checkbox" checked={cfgForm.required_for_disbursement}
                      onChange={e => setCfgForm(p => p ? { ...p, required_for_disbursement: e.target.checked } : p)} disabled={!isAdmin} />
                    <span className="bio-toggle-track" />
                  </label>
                </div>
                <div className="bio-cfg-toggle-row">
                  <div>
                    <div className="bio-cfg-toggle-label">Check Duplicates on Enrollment</div>
                    <div className="bio-cfg-toggle-hint">Perform 1:N duplicate search before allowing new enrollment</div>
                  </div>
                  <label className="bio-toggle">
                    <input type="checkbox" checked={cfgForm.check_duplicates_on_enroll}
                      onChange={e => setCfgForm(p => p ? { ...p, check_duplicates_on_enroll: e.target.checked } : p)} disabled={!isAdmin} />
                    <span className="bio-toggle-track" />
                  </label>
                </div>
              </div>

              <div className="bio-cfg-section">
                <h4>Role Access Control</h4>
                <div className="bio-cfg-row">
                  <label>Roles allowed to operate scanner</label>
                  <div className="bio-role-checks">
                    {ROLES.map(r => (
                      <label key={r} className="bio-role-check">
                        <input type="checkbox" disabled={!isAdmin}
                          checked={cfgForm.allowed_roles.split(",").map(s => s.trim()).includes(r)}
                          onChange={e => {
                            const cur = cfgForm.allowed_roles.split(",").map(s => s.trim()).filter(Boolean);
                            const next = e.target.checked ? [...cur, r] : cur.filter(x => x !== r);
                            setCfgForm(p => p ? { ...p, allowed_roles: next.join(",") } : p);
                          }} />
                        {r.replace(/_/g," ")}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="bio-cfg-row">
                  <label>Roles allowed to authorize exceptions</label>
                  <div className="bio-role-checks">
                    {ROLES.map(r => (
                      <label key={r} className="bio-role-check">
                        <input type="checkbox" disabled={!isAdmin}
                          checked={cfgForm.exception_roles.split(",").map(s => s.trim()).includes(r)}
                          onChange={e => {
                            const cur = cfgForm.exception_roles.split(",").map(s => s.trim()).filter(Boolean);
                            const next = e.target.checked ? [...cur, r] : cur.filter(x => x !== r);
                            setCfgForm(p => p ? { ...p, exception_roles: next.join(",") } : p);
                          }} />
                        {r.replace(/_/g," ")}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      <style>{`
        .bio-page { flex:1; min-height:0; background:#f1f5f9; display:flex; flex-direction:column; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
        .bio-content { flex:1; overflow-y:auto; padding:16px 18px 40px; }
        .bio-card { background:white; border-radius:16px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.05); padding:22px 24px; margin-bottom:16px; }
        .bio-card-hd { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:10px; }
        .bio-card-hd h3 { margin:0; font-size:15px; font-weight:800; color:#0f172a; }

        .bio-toast { position:fixed; top:20px; right:20px; z-index:9999; padding:12px 20px; border-radius:12px; font-weight:700; font-size:14px; color:white; box-shadow:0 8px 24px rgba(0,0,0,0.2); animation:bio-slide-in 0.3s ease; }
        .bio-toast--success { background:#059669; }
        .bio-toast--error { background:#dc2626; }
        @keyframes bio-slide-in { from { transform:translateX(120%); } to { transform:translateX(0); } }

        .bio-kpi-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:14px; margin-bottom:28px; }
        .bio-kpi { background:#f8fafc; border-radius:12px; padding:16px 14px; display:flex; flex-direction:column; align-items:center; text-align:center; gap:6px; }
        .bio-kpi-icon { font-size:22px; }
        .bio-kpi-val { font-size:26px; font-weight:800; }
        .bio-kpi-label { font-size:11px; color:#64748b; font-weight:600; }

        .bio-how-it-works { border-top:1px solid #f1f5f9; padding-top:20px; }
        .bio-how-it-works h3 { font-size:14px; font-weight:800; color:#0f172a; margin:0 0 16px; }
        .bio-flow { display:flex; align-items:flex-start; gap:8px; overflow-x:auto; padding-bottom:8px; }
        .bio-flow-step { display:flex; flex-direction:column; align-items:center; gap:6px; flex-shrink:0; width:120px; position:relative; }
        .bio-flow-num { width:26px; height:26px; border-radius:50%; background:#1e5fae; color:white; font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:center; }
        .bio-flow-icon { font-size:24px; }
        .bio-flow-title { font-size:12px; font-weight:800; color:#0f172a; text-align:center; }
        .bio-flow-desc { font-size:10px; color:#64748b; text-align:center; line-height:1.4; }
        .bio-flow-arrow { position:absolute; right:-14px; top:12px; font-size:18px; color:#94a3b8; }

        .bio-form-panel { background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:18px; margin-bottom:18px; }
        .bio-form-panel h4 { margin:0 0 14px; font-size:14px; font-weight:800; color:#0f172a; }
        .bio-form-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; margin-bottom:14px; }
        .bio-form-field { display:flex; flex-direction:column; gap:4px; }
        .bio-form-field label { font-size:11px; font-weight:700; color:#475569; }
        .bio-form-field input,.bio-form-field select { padding:8px 10px; border:1.5px solid #e2e8f0; border-radius:8px; font-size:13px; }
        .bio-form-actions { display:flex; gap:8px; justify-content:flex-end; }

        .bio-table-scroll { overflow-x:auto; }
        .bio-table { width:100%; border-collapse:collapse; font-size:12px; }
        .bio-table th { text-align:left; padding:10px 12px; background:#f8fafc; color:#64748b; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; border-bottom:2px solid #e2e8f0; white-space:nowrap; }
        .bio-table td { padding:10px 12px; border-bottom:1px solid #f1f5f9; color:#334155; vertical-align:middle; }
        .bio-table tr:hover td { background:#fafafa; }
        .bio-tc { text-align:center; color:#94a3b8; padding:24px; font-style:italic; }
        .bio-bold { font-weight:700; color:#0f172a; }
        .bio-sub { font-size:11px; color:#94a3b8; }
        .bio-mono { font-family:monospace; font-size:11px; }
        .bio-badge { padding:3px 8px; border-radius:20px; font-size:10px; font-weight:800; text-transform:uppercase; display:inline-block; }
        .bio-type-pill { background:#eef2ff; color:#4f46e5; border:1px solid #c7d2fe; border-radius:20px; padding:2px 8px; font-size:11px; font-weight:700; }
        .bio-action-pill { background:#f1f5f9; color:#334155; border-radius:6px; padding:2px 7px; font-size:11px; font-weight:600; }
        .bio-fingers { color:#1e5fae; font-weight:700; }

        .bio-btn { border:none; border-radius:9px; padding:8px 16px; font-weight:700; font-size:13px; cursor:pointer; }
        .bio-btn--primary { background:#1e5fae; color:white; }
        .bio-btn--outline { background:white; color:#475569; border:1.5px solid #e2e8f0; }
        .bio-btn--primary:disabled { opacity:.5; cursor:not-allowed; }
        .bio-btn-sm { border:none; border-radius:7px; padding:4px 10px; font-size:11px; font-weight:700; cursor:pointer; margin-right:4px; }
        .bio-btn-sm--edit { background:#eef2ff; color:#4f46e5; }
        .bio-btn-sm--del  { background:#fef2f2; color:#dc2626; }

        .bio-log-filters { display:flex; gap:8px; flex-wrap:wrap; }
        .bio-log-filters select,.bio-log-filters input { padding:6px 10px; border:1.5px solid #e2e8f0; border-radius:8px; font-size:12px; }
        .bio-log-info { background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:10px 14px; font-size:12px; color:#1e40af; font-weight:700; margin-bottom:14px; }
        .bio-exc-note { font-size:13px; color:#64748b; margin:0 0 16px; }

        .bio-cfg-grid { display:flex; flex-direction:column; gap:24px; }
        .bio-cfg-section { border:1px solid #e2e8f0; border-radius:12px; padding:18px; }
        .bio-cfg-section h4 { margin:0 0 16px; font-size:13px; font-weight:800; color:#0f172a; border-bottom:1px solid #f1f5f9; padding-bottom:10px; }
        .bio-cfg-row { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
        .bio-cfg-row label { font-size:12px; font-weight:700; color:#475569; }
        .bio-cfg-row input { width:100px; padding:8px 10px; border:1.5px solid #e2e8f0; border-radius:8px; font-size:14px; font-weight:800; }
        .bio-cfg-hint { font-size:11px; color:#94a3b8; }
        .bio-cfg-toggle-row { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:14px; }
        .bio-cfg-toggle-label { font-size:13px; font-weight:700; color:#0f172a; }
        .bio-cfg-toggle-hint { font-size:11px; color:#94a3b8; }
        .bio-toggle { position:relative; display:inline-block; width:44px; height:24px; flex-shrink:0; }
        .bio-toggle input { opacity:0; width:0; height:0; }
        .bio-toggle-track { position:absolute; inset:0; background:#e2e8f0; border-radius:24px; cursor:pointer; transition:background .2s; }
        .bio-toggle input:checked + .bio-toggle-track { background:#059669; }
        .bio-toggle-track::after { content:""; position:absolute; left:3px; top:3px; width:18px; height:18px; background:white; border-radius:50%; transition:transform .2s; }
        .bio-toggle input:checked + .bio-toggle-track::after { transform:translateX(20px); }
        .bio-role-checks { display:flex; flex-wrap:wrap; gap:8px; }
        .bio-role-check { display:flex; align-items:center; gap:5px; font-size:12px; font-weight:600; color:#334155; cursor:pointer; padding:5px 10px; border:1.5px solid #e2e8f0; border-radius:8px; }
        .bio-role-check input { cursor:pointer; }
      `}</style>
    </div>
  );
}
