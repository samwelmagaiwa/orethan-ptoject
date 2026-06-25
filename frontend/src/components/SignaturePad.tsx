import { useEffect, useRef, useState } from "react";
import { Eraser, Check, Upload } from "lucide-react";

interface Props {
  value?: string;                         // existing data URL
  onChange?: (dataUrl: string | null) => void;
  height?: number;
  label?: string;
  savedSignature?: string | null;         // user's profile signature, for quick "use saved" + initial preview
}

/**
 * Reusable signature pad with a live preview pane.
 * Left = drawing field, Right = preview of the captured/saved signature.
 * Emits a transparent PNG data URL via onChange.
 */
const SignaturePad = ({ value, onChange, height = 150, label, savedSignature }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(!!value);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || savedSignature || null);

  // Set up canvas size (handles HiDPI) and restore any existing value once.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    if (value) loadImage(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    drawing.current = true;
    last.current = pos(e);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!hasInk) setHasInk(true);
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    emit();
  };

  const emit = () => {
    const url = canvasRef.current!.toDataURL("image/png");
    setPreviewUrl(url);
    onChange?.(url);
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    setPreviewUrl(null);
    onChange?.(null);
  };

  const loadImage = (src: string) => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const ratio = window.devicePixelRatio || 1;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width / ratio;
      const h = canvas.height / ratio;
      const scale = Math.min(w / img.width, h / img.height, 1);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      setHasInk(true);
      emit();
    };
    img.src = src;
  };

  return (
    <div>
      {label && <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "#64748b", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.6px" }}>{label}</label>}

      <div className="sp-wrap">
        {/* LEFT: drawing field */}
        <div className="sp-pad">
          <div style={{ position: "relative", border: `1.5px dashed ${hasInk ? "#10b981" : "#cbd5e1"}`, borderRadius: 10, background: "#fff", overflow: "hidden" }}>
            <canvas
              ref={canvasRef}
              style={{ width: "100%", height, display: "block", touchAction: "none", cursor: "crosshair" }}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerLeave={end}
            />
            {!hasInk && (
              <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: "#cbd5e1", fontSize: "0.85rem", fontWeight: 600, pointerEvents: "none" }}>
                ✍ Sign here
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
            <button type="button" onClick={clear} style={btn("#fef2f2", "#dc2626", "#fecaca")}><Eraser size={13} /> Clear</button>
            {savedSignature && (
              <button type="button" onClick={() => loadImage(savedSignature)} style={btn("#eef2ff", "#4f46e5", "#e0e7ff")}><Upload size={13} /> Use saved</button>
            )}
            {hasInk && <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.72rem", fontWeight: 700, color: "#059669", marginLeft: "auto" }}><Check size={13} /> Captured</span>}
          </div>
        </div>

        {/* RIGHT: preview pane */}
        <div className="sp-preview">
          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "0.35rem" }}>Preview</div>
          <div style={{ height, borderRadius: 10, border: "1px solid #eef1f6", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: "0.6rem", boxSizing: "border-box" }}>
            {previewUrl
              ? <img src={previewUrl} alt="signature preview" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              : <span style={{ color: "#cbd5e1", fontSize: "0.78rem", fontWeight: 600 }}>No signature yet</span>}
          </div>
        </div>
      </div>

      <style>{`
        .sp-wrap { display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-start; }
        .sp-pad { flex: 1 1 300px; min-width: 0; }
        .sp-preview { flex: 1 1 220px; min-width: 0; }
      `}</style>
    </div>
  );
};

const btn = (bg: string, color: string, border: string): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.35rem 0.7rem",
  borderRadius: 8, background: bg, color, border: `1px solid ${border}`, fontWeight: 700,
  fontSize: "0.72rem", cursor: "pointer",
});

export default SignaturePad;
