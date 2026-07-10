interface Props {
  secondsLeft: number;
  totalWarnSeconds: number;
  onStay: () => void;
  onLogout: () => void;
}

export default function SessionWarningModal({ secondsLeft, totalWarnSeconds, onStay, onLogout }: Props) {
  const pct = (secondsLeft / totalWarnSeconds) * 100;
  const isUrgent = secondsLeft <= 10;
  const isCritical = secondsLeft <= 5;

  // Circular SVG ring
  const R = 44;
  const circ = 2 * Math.PI * R;
  const dash = circ * (pct / 100);

  const ringColor = secondsLeft > (totalWarnSeconds * 0.5)
    ? "#f59e0b"
    : secondsLeft > 10
    ? "#ef4444"
    : "#dc2626";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "rgba(10,18,35,0.72)",
      backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
    }}>
      <div style={{
        background: "linear-gradient(160deg,#0f172a 0%,#1e293b 100%)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 28,
        padding: "2.4rem 2.2rem 2rem",
        width: "100%",
        maxWidth: 400,
        textAlign: "center",
        boxShadow: "0 40px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
        animation: "swm-pop .28s cubic-bezier(.34,1.56,.64,1)",
        boxSizing: "border-box",
      }}>

        {/* Circular countdown timer */}
        <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto 1.4rem" }}>
          {/* Glow behind ring */}
          <div style={{
            position: "absolute", inset: 8, borderRadius: "50%",
            background: isCritical
              ? "radial-gradient(circle,rgba(220,38,38,0.25),transparent 70%)"
              : isUrgent
              ? "radial-gradient(circle,rgba(239,68,68,0.2),transparent 70%)"
              : "radial-gradient(circle,rgba(245,158,11,0.18),transparent 70%)",
            transition: "background 0.5s",
          }} />

          <svg width="120" height="120" style={{ transform: "rotate(-90deg)" }}>
            {/* Track */}
            <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
            {/* Progress */}
            <circle
              cx="60" cy="60" r={R} fill="none"
              stroke={ringColor}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              style={{ transition: "stroke-dasharray 1s linear, stroke 0.4s", filter: `drop-shadow(0 0 6px ${ringColor})` }}
            />
          </svg>

          {/* Center number */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            animation: isCritical ? "swm-pulse 0.5s ease-in-out infinite alternate" : "none",
          }}>
            <span style={{
              fontSize: 34, fontWeight: 900, lineHeight: 1,
              color: isCritical ? "#fca5a5" : isUrgent ? "#fca5a5" : "#fcd34d",
              fontVariantNumeric: "tabular-nums",
              transition: "color 0.3s",
            }}>{secondsLeft}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: "0.08em", marginTop: 2 }}>
              SEC{secondsLeft !== 1 ? "S" : ""}
            </span>
          </div>
        </div>

        {/* Title */}
        <h2 style={{
          margin: "0 0 0.5rem",
          fontSize: "1.2rem", fontWeight: 900,
          color: "#f8fafc",
          letterSpacing: "-0.02em",
        }}>
          Session Expiring Soon
        </h2>

        {/* Subtitle */}
        <p style={{
          margin: "0 0 0.3rem",
          color: "rgba(255,255,255,0.55)",
          fontSize: "0.84rem",
          lineHeight: 1.6,
        }}>
          You will be logged out in{" "}
          <span style={{ color: isCritical ? "#fca5a5" : "#fcd34d", fontWeight: 800 }}>
            {secondsLeft} second{secondsLeft !== 1 ? "s" : ""}
          </span>{" "}
          due to inactivity.
        </p>

        {/* Thin progress bar */}
        <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 3, margin: "1.2rem 0 1.6rem", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 3,
            background: `linear-gradient(90deg, ${ringColor}, ${ringColor}cc)`,
            width: `${pct}%`,
            transition: "width 1s linear, background 0.4s",
            boxShadow: `0 0 8px ${ringColor}`,
          }} />
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: "0.7rem" }}>
          <button
            onClick={onStay}
            style={{
              flex: 1, padding: "0.85rem 0.5rem", borderRadius: 14, border: "none",
              background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
              color: "white", fontWeight: 800, fontSize: "0.9rem",
              cursor: "pointer", letterSpacing: "0.01em",
              boxShadow: "0 8px 24px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
              transition: "filter 0.15s, transform 0.15s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.12)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = ""; (e.currentTarget as HTMLButtonElement).style.transform = ""; }}
          >
            Stay Logged In
          </button>
          <button
            onClick={onLogout}
            style={{
              flex: 1, padding: "0.85rem 0.5rem", borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.65)", fontWeight: 700, fontSize: "0.9rem",
              cursor: "pointer",
              transition: "background 0.15s, color 0.15s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.65)"; }}
          >
            Log Out
          </button>
        </div>

        <style>{`
          @keyframes swm-pop {
            from { transform: scale(0.82) translateY(20px); opacity: 0; }
            to   { transform: scale(1) translateY(0); opacity: 1; }
          }
          @keyframes swm-pulse {
            from { transform: scale(1); }
            to   { transform: scale(1.08); }
          }
        `}</style>
      </div>
    </div>
  );
}
