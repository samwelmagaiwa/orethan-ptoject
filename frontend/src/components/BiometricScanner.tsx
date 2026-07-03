/**
 * BiometricScanner – core capture widget
 *
 * Works in two modes:
 *   1. SIMULATION (default) – generates a mock template and random quality/similarity
 *      scores so the UI can be exercised without physical hardware.
 *   2. AGENT (WebSocket) – connects to a local biometric agent running on the
 *      operator's PC (ws://localhost:9000) that drives the actual USB scanner.
 *      The agent must emit JSON messages:
 *        { type:"quality", score:87 }          – live quality as user places finger
 *        { type:"capture", template:"<b64>", quality:92 }  – final capture
 *        { type:"status",  text:"Place finger" }
 */
import { useState, useEffect, useRef, useCallback } from "react";

export type ScanResult = {
  template: string;       // base64 ANSI minutiae template
  image: string;          // base64 BMP fingerprint image (for voucher printing)
  quality_score: number;
  finger_name: string;
  device_serial: string;
  simulated: boolean;
};

interface Props {
  finger: string;                          // e.g. "right_thumb"
  minQuality: number;                      // reject below this
  agentUrl?: string;                       // ws:// agent url; absent = simulation
  onCapture: (result: ScanResult) => void;
  onError?: (msg: string) => void;
  disabled?: boolean;
  label?: string;
  role?: string;       // "borrower" | "guarantor1" | "guarantor2" — sent to agent for duplicate check
  personName?: string; // display name sent to agent for error messages
  sessionId?: string;  // shared UUID across all scanners on the same disbursement page
}

const FINGER_LABELS: Record<string, string> = {
  right_thumb:  "Right Thumb",
  left_thumb:   "Left Thumb",
  right_index:  "Right Index",
  left_index:   "Left Index",
  right_middle: "Right Middle",
  left_middle:  "Left Middle",
};

type Phase = "idle" | "scanning" | "success" | "rejected" | "error";

export const BiometricScanner = ({ finger, minQuality, agentUrl: agentUrlProp, onCapture, onError, disabled, label, role, personName, sessionId }: Props) => {
  // Use prop → localStorage → default ws://localhost:9000 (always attempt hardware connection)
  const agentUrl = agentUrlProp ?? localStorage.getItem("bio_agent_url") ?? "ws://localhost:9000";
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [quality, setQuality] = useState(0);
  const [statusText, setStatusText] = useState("Place finger on scanner");
  const [_simProgress, setSimProgress] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const simTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const agentConnected = useRef(false);

  // ── Build a deterministic-ish mock template (never a real image) ──────────
  const mockTemplate = () => {
    const bytes = new Uint8Array(512);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes));
  };

  // ── Simulation mode capture ───────────────────────────────────────────────
  const runSimulation = useCallback(() => {
    if (disabled) return;
    setPhase("scanning");
    setQuality(0);
    setSimProgress(0);
    setStatusText("Scanning… (simulation mode)");

    let tick = 0;
    const finalQuality = Math.floor(Math.random() * 25) + 75; // 75-99
    simTimer.current = setInterval(() => {
      tick++;
      const q = Math.min(Math.round((tick / 20) * finalQuality), finalQuality);
      setQuality(q);
      setSimProgress((tick / 20) * 100);

      if (tick >= 20) {
        clearInterval(simTimer.current!);
        if (q >= minQuality) {
          setPhase("success");
          setStatusText(`Captured — quality ${q}%`);
          onCapture({ template: mockTemplate(), image: "", quality_score: q, finger_name: finger, device_serial: "SIM-0001", simulated: true });
        } else {
          setPhase("rejected");
          setStatusText(`Quality ${q}% below minimum ${minQuality}%. Try again.`);
          onError?.(`Quality too low: ${q}%`);
        }
      }
    }, 100);
  }, [disabled, finger, minQuality, onCapture, onError]);

  // ── WebSocket agent mode (with auto-reconnect) ───────────────────────────
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destroyed = useRef(false);

  const connectWs = useCallback(() => {
    if (destroyed.current || !agentUrl) return;
    const ws = new WebSocket(agentUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      agentConnected.current = true;
      setStatusText("Scanner ready — place finger");
      ws.send(JSON.stringify({ cmd: "status" }));
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "quality") {
          setPhase("scanning");
          setQuality(msg.score);
          setStatusText(`Quality: ${msg.score}%`);
        } else if (msg.type === "capture") {
          const q = msg.quality as number;
          if (q >= minQuality) {
            setPhase("success");
            setStatusText(`Captured — quality ${q}%`);
            onCapture({ template: msg.template ?? "", image: msg.image ?? "", quality_score: q, finger_name: finger, device_serial: msg.device_serial ?? "UNKNOWN", simulated: msg.simulated ?? false });
          } else {
            setPhase("rejected");
            setStatusText(`Quality ${q}% below minimum ${minQuality}%. Retry.`);
            onError?.(`Quality too low: ${q}%`);
          }
        } else if (msg.type === "status") {
          setStatusText(msg.text);
          if (msg.device) setDeviceName(msg.simulated ? null : msg.device);
        } else if (msg.type === "devices") {
          if (msg.active_driver && !msg.simulated) setDeviceName(msg.active_driver);
        } else if (msg.type === "error") {
          setPhase("error");
          setStatusText(msg.text ?? "Scanner error");
          onError?.(msg.text);
        }
      } catch { /* ignore malformed */ }
    };

    ws.onerror = () => {
      agentConnected.current = false;
      setDeviceName(null);
    };

    ws.onclose = () => {
      agentConnected.current = false;
      setDeviceName(null);
      setStatusText("Connecting to scanner...");
      // Auto-reconnect every 3 s until component unmounts
      if (!destroyed.current) {
        reconnectTimer.current = setTimeout(connectWs, 3000);
      }
    };
  }, [agentUrl, finger, minQuality, onCapture, onError]);

  useEffect(() => {
    if (!agentUrl) return;
    destroyed.current = false;
    connectWs();
    return () => {
      destroyed.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [agentUrl, connectWs]);

  const reset = () => {
    clearInterval(simTimer.current!);
    setPhase("idle");
    setQuality(0);
    setSimProgress(0);
    setStatusText("Place finger on scanner");
  };

  const capture = () => {
    if (agentUrl && agentConnected.current && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ cmd: "capture", finger, role: role ?? "", name: personName ?? "", session_id: sessionId ?? "" }));
      setPhase("scanning");
    } else {
      runSimulation();
    }
  };

  const phaseColor: Record<Phase, string> = {
    idle:     "#6366f1",
    scanning: "#f59e0b",
    success:  "#059669",
    rejected: "#dc2626",
    error:    "#dc2626",
  };

  const col = phaseColor[phase];

  return (
    <div className="bscan-root">
      {/* Fingerprint SVG visual */}
      <div className="bscan-icon-wrap" style={{ borderColor: col }}>
        <svg className={`bscan-icon ${phase === "scanning" ? "bscan-icon--pulse" : ""}`} viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="48" stroke={col} strokeWidth="3" opacity="0.25" />
          {/* fingerprint ridge lines */}
          {[10, 16, 22, 28, 34, 40].map((r, i) => (
            <circle key={i} cx="50" cy="50" r={r} stroke={col} strokeWidth="2.5"
              strokeDasharray={phase === "scanning" ? `${r * 0.6} ${r * 0.2}` : undefined}
              opacity={phase === "success" ? 1 : 0.7}
              style={{ transition: "stroke 0.4s", animation: phase === "scanning" ? `bscan-spin ${1.5 + i * 0.1}s linear infinite` : undefined }}
            />
          ))}
          {phase === "success" && (
            <path d="M30 52 L44 66 L70 38" stroke="#059669" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {(phase === "rejected" || phase === "error") && (
            <>
              <line x1="34" y1="34" x2="66" y2="66" stroke="#dc2626" strokeWidth="5" strokeLinecap="round" />
              <line x1="66" y1="34" x2="34" y2="66" stroke="#dc2626" strokeWidth="5" strokeLinecap="round" />
            </>
          )}
        </svg>

        {/* quality ring */}
        {phase === "scanning" && (
          <svg className="bscan-ring" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="48" stroke="#e2e8f0" strokeWidth="4" fill="none" />
            <circle cx="50" cy="50" r="48" stroke={col} strokeWidth="4" fill="none"
              strokeDasharray={`${(quality / 100) * 301} 301`}
              strokeLinecap="round"
              style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dasharray 0.1s" }}
            />
          </svg>
        )}
      </div>

      {/* Finger label */}
      <div className="bscan-finger-label" style={{ color: col }}>
        {label ?? FINGER_LABELS[finger] ?? finger}
      </div>

      {/* Quality display */}
      {(phase === "scanning" || phase === "success") && (
        <div className="bscan-quality">
          <div className="bscan-quality-bar">
            <div className="bscan-quality-fill" style={{ width: `${quality}%`, background: col }} />
          </div>
          <span className="bscan-quality-pct" style={{ color: col }}>{quality}%</span>
        </div>
      )}

      {/* Status text */}
      <div className="bscan-status" style={{ color: phase === "idle" ? "#64748b" : col }}>
        {phase === "scanning" && <span className="bscan-dot" style={{ background: col }} />}
        {statusText}
      </div>

      {/* Mode / device badge */}
      {agentUrl && deviceName ? (
        <div className="bscan-mode-badge bscan-mode-badge--hw">🔌 {deviceName}</div>
      ) : !agentUrl ? (
        <div className="bscan-mode-badge">⚡ Simulation Mode</div>
      ) : null}

      {/* Controls */}
      {(phase === "idle" || phase === "rejected" || phase === "error") && (
        <button className="bscan-btn" style={{ background: col }} onClick={capture} disabled={!!disabled}>
          {phase === "idle" ? "📷 Capture Fingerprint" : "↻ Retry Scan"}
        </button>
      )}
      {phase === "scanning" && (
        <button className="bscan-btn bscan-btn--cancel" onClick={reset}>✕ Cancel</button>
      )}
      {phase === "success" && (
        <button className="bscan-btn bscan-btn--rescan" onClick={reset}>↻ Rescan</button>
      )}

      <style>{`
        .bscan-root { display:flex; flex-direction:column; align-items:center; gap:10px; padding:16px; }
        .bscan-icon-wrap { position:relative; width:110px; height:110px; border-radius:50%; border:3px solid; display:flex; align-items:center; justify-content:center; transition:border-color 0.3s; }
        .bscan-icon { width:80px; height:80px; }
        .bscan-icon--pulse { animation:bscan-pulse 1s ease-in-out infinite alternate; }
        .bscan-ring { position:absolute; inset:0; width:100%; height:100%; }
        .bscan-finger-label { font-size:13px; font-weight:800; letter-spacing:.03em; }
        .bscan-quality { display:flex; align-items:center; gap:8px; width:100%; max-width:160px; }
        .bscan-quality-bar { flex:1; height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden; }
        .bscan-quality-fill { height:100%; border-radius:3px; transition:width 0.1s; }
        .bscan-quality-pct { font-size:12px; font-weight:800; min-width:34px; }
        .bscan-status { font-size:12px; font-weight:600; text-align:center; display:flex; align-items:center; gap:6px; }
        .bscan-dot { width:8px; height:8px; border-radius:50%; display:inline-block; animation:bscan-blink 0.7s step-start infinite; }
        .bscan-mode-badge { font-size:10px; background:#fef3c7; color:#92400e; border:1px solid #fcd34d; border-radius:20px; padding:2px 8px; font-weight:700; }
        .bscan-mode-badge--hw { background:#dcfce7; color:#166534; border-color:#86efac; }
        .bscan-btn { padding:9px 20px; border:none; border-radius:10px; color:white; font-weight:800; font-size:13px; cursor:pointer; transition:opacity .15s; width:100%; max-width:200px; }
        .bscan-btn:disabled { opacity:.5; cursor:not-allowed; }
        .bscan-btn--cancel { background:#94a3b8 !important; }
        .bscan-btn--rescan { background:#e2e8f0 !important; color:#475569 !important; }
        @keyframes bscan-pulse { from { transform:scale(1); } to { transform:scale(1.04); } }
        @keyframes bscan-blink { 50% { opacity:0; } }
        @keyframes bscan-spin { from { stroke-dashoffset:0; } to { stroke-dashoffset:-100; } }
      `}</style>
    </div>
  );
};

export default BiometricScanner;
