import React, { useEffect, useState, useCallback } from "react";
import logo from "../assets/logo.png";

interface LoadingScreenProps {
    onFinish: () => void;
    statusMessages?: string[];
}

const particleCount = 22;

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onFinish, statusMessages }) => {
    const [phase, setPhase] = useState<"in" | "hold" | "out">("in");
    const [progress, setProgress] = useState(0);
    const [tick, setTick] = useState(0);

    const defaultMessages = [
        "Inaanzisha mfumo...",
        "Inaunganisha seva...",
        "Inapakia data...",
        "Karibu!",
    ];

    const currentMessages = statusMessages && statusMessages.length > 0 ? statusMessages : defaultMessages;

    const handleFinish = useCallback(() => {
        onFinish();
    }, [onFinish]);

    useEffect(() => {
        const tickInterval = setInterval(() => setTick(t => t + 1), 1000);
        const progressInterval = setInterval(() => {
            setProgress(prev => (prev >= 100 ? 100 : prev + 1.8));
        }, 42);
        const holdTimer = setTimeout(() => setPhase("hold"), 400);
        const outTimer = setTimeout(() => setPhase("out"), 2600);
        const doneTimer = setTimeout(handleFinish, 3100);

        return () => {
            clearInterval(tickInterval);
            clearInterval(progressInterval);
            clearTimeout(holdTimer);
            clearTimeout(outTimer);
            clearTimeout(doneTimer);
        };
    }, [handleFinish]);

    // Deterministic particles to avoid hydration issues
    const particles = Array.from({ length: particleCount }, (_, i) => ({
        id: i,
        x: ((i * 137.5) % 100),
        y: ((i * 73.1) % 100),
        size: 2 + (i % 4),
        duration: 3 + (i % 4),
        delay: (i * 0.4) % 4,
        opacity: 0.15 + (i % 5) * 0.07,
    }));

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(160deg, #050e1f 0%, #0f2035 40%, #0d1b2e 70%, #050e1f 100%)",
            opacity: phase === "out" ? 0 : 1,
            transition: "opacity 0.5s ease-in-out",
            overflow: "hidden",
        }}>

            {/* ---- Animated particle field ---- */}
            {particles.map(p => (
                <div key={p.id} style={{
                    position: "absolute",
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    width: p.size,
                    height: p.size,
                    borderRadius: "50%",
                    background: "#60a5fa",
                    opacity: p.opacity,
                    animation: `particle-drift ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
                }} />
            ))}

            {/* ---- Large background glow orb ---- */}
            <div style={{
                position: "absolute",
                width: 600,
                height: 600,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(37,99,235,0.13) 0%, transparent 70%)",
                animation: "breathe 4s ease-in-out infinite",
            }} />

            {/* ---- Outer rotating dashed ring ---- */}
            <div style={{
                position: "absolute",
                width: 340,
                height: 340,
                borderRadius: "50%",
                border: "1.5px dashed rgba(96,165,250,0.2)",
                animation: "spin-cw 18s linear infinite",
            }} />

            {/* ---- Mid rotating solid ring ---- */}
            <div style={{
                position: "absolute",
                width: 268,
                height: 268,
                borderRadius: "50%",
                border: "1px solid rgba(59,130,246,0.3)",
                animation: "spin-ccw 10s linear infinite",
            }}>
                {/* Orbit dot */}
                <div style={{
                    position: "absolute",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "#3b82f6",
                    top: -5,
                    left: "50%",
                    transform: "translateX(-50%)",
                    boxShadow: "0 0 12px 4px rgba(59,130,246,0.8)",
                }} />
            </div>

            {/* ---- Inner glowing circle ---- */}
            <div style={{
                position: "absolute",
                width: 200,
                height: 200,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(16,42,67,0.95) 60%, rgba(16,42,67,0.6) 100%)",
                boxShadow: "0 0 60px 20px rgba(37,99,235,0.2), inset 0 0 40px rgba(37,99,235,0.1)",
            }} />

            {/* ---- LOGO ---- */}
            <div style={{
                position: "relative",
                zIndex: 10,
                opacity: phase === "in" ? 0 : 1,
                transform: phase === "in" ? "scale(0.5)" : "scale(1)",
                transition: "opacity 0.7s cubic-bezier(0.34,1.56,0.64,1), transform 0.7s cubic-bezier(0.34,1.56,0.64,1)",
            }}>
                <img
                    src={logo}
                    alt="ORETHAN Microfinance Logo"
                    style={{
                        width: 140,
                        height: 140,
                        objectFit: "contain",
                        filter: "drop-shadow(0 0 24px rgba(59,130,246,0.7)) drop-shadow(0 4px 30px rgba(0,0,0,0.6))",
                        animation: phase === "hold" ? "logo-float 3.5s ease-in-out infinite" : "none",
                    }}
                />
            </div>

            {/* ---- Brand text ---- */}
            <div style={{
                position: "relative",
                zIndex: 10,
                marginTop: 28,
                textAlign: "center",
                opacity: phase === "in" ? 0 : 1,
                transform: phase === "in" ? "translateY(20px)" : "translateY(0)",
                transition: "opacity 0.7s ease 0.25s, transform 0.7s ease 0.25s",
            }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <div style={{ width: 28, height: 1, background: "linear-gradient(90deg, transparent, #3b82f6)" }} />
                    <h1 style={{
                        fontFamily: "'Inter', 'Segoe UI', sans-serif",
                        fontSize: "2rem",
                        fontWeight: 900,
                        color: "#fff",
                        margin: 0,
                        letterSpacing: "0.12em",
                        textShadow: "0 0 24px rgba(96,165,250,0.5)",
                    }}>ORETHAN</h1>
                    <div style={{ width: 28, height: 1, background: "linear-gradient(270deg, transparent, #3b82f6)" }} />
                </div>
                <p style={{
                    fontFamily: "'Inter', 'Segoe UI', sans-serif",
                    fontSize: "0.68rem",
                    fontWeight: 500,
                    color: "rgba(148,163,184,0.75)",
                    margin: "6px 0 0",
                    letterSpacing: "0.35em",
                    textTransform: "uppercase",
                }}>
                    Microfinance
                </p>
            </div>

            {/* ---- Progress section ---- */}
            <div style={{
                position: "relative",
                zIndex: 10,
                marginTop: 44,
                width: 240,
                opacity: phase === "in" ? 0 : 1,
                transition: "opacity 0.6s ease 0.4s",
            }}>
                {/* Status message */}
                <p style={{
                    fontFamily: "'Inter', 'Segoe UI', sans-serif",
                    fontSize: "0.65rem",
                    color: "rgba(148,163,184,0.55)",
                    textAlign: "center",
                    margin: "0 0 10px",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    minHeight: "1em",
                    transition: "opacity 0.4s",
                }}>
                    {currentMessages[Math.min(tick, currentMessages.length - 1)]}
                </p>

                {/* Track */}
                <div style={{
                    width: "100%",
                    height: 4,
                    background: "rgba(255,255,255,0.07)",
                    borderRadius: 4,
                    overflow: "hidden",
                    position: "relative",
                }}>
                    {/* Fill */}
                    <div style={{
                        height: "100%",
                        width: `${progress}%`,
                        background: "linear-gradient(90deg, #1d4ed8, #3b82f6, #60a5fa)",
                        borderRadius: 4,
                        transition: "width 0.08s linear",
                        position: "relative",
                        overflow: "hidden",
                    }}>
                        {/* Shimmer */}
                        <div style={{
                            position: "absolute",
                            top: 0,
                            left: "-40%",
                            width: "40%",
                            height: "100%",
                            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
                            animation: "shimmer 1.6s ease-in-out infinite",
                        }} />
                    </div>
                    {/* Glow head */}
                    <div style={{
                        position: "absolute",
                        top: -3,
                        left: `calc(${progress}% - 4px)`,
                        width: 8,
                        height: 10,
                        borderRadius: "50%",
                        background: "#93c5fd",
                        boxShadow: "0 0 10px 4px rgba(147,197,253,0.8)",
                        transition: "left 0.08s linear",
                    }} />
                </div>

                {/* Percentage */}
                <p style={{
                    fontFamily: "'Inter', 'Segoe UI', sans-serif",
                    fontSize: "0.6rem",
                    color: "rgba(148,163,184,0.35)",
                    textAlign: "right",
                    margin: "6px 0 0",
                    letterSpacing: "0.1em",
                }}>
                    {Math.round(progress)}%
                </p>
            </div>

            {/* ---- Keyframes ---- */}
            <style>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50%       { transform: scale(1.08); opacity: 1; }
        }
        @keyframes spin-cw {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes spin-ccw {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
        @keyframes logo-float {
          0%, 100% { transform: translateY(0); filter: drop-shadow(0 0 24px rgba(59,130,246,0.7)) drop-shadow(0 4px 30px rgba(0,0,0,0.6)); }
          50%       { transform: translateY(-10px); filter: drop-shadow(0 0 36px rgba(96,165,250,0.9)) drop-shadow(0 12px 30px rgba(0,0,0,0.6)); }
        }
        @keyframes particle-drift {
          0%   { transform: translateY(0) scale(1); }
          100% { transform: translateY(-18px) scale(1.4); }
        }
        @keyframes shimmer {
          0%   { left: -40%; }
          100% { left: 140%; }
        }
      `}</style>
        </div>
    );
};

export default LoadingScreen;
