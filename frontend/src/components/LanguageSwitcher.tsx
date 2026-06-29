import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Check } from "lucide-react";

const LANGUAGES = [
  { code: "en", flag: "🇬🇧" },
  { code: "sw", flag: "🇹🇿" },
] as const;

const LanguageSwitcher = () => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

  const select = (code: string) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={t("language.label")}
        style={{ display: "flex", alignItems: "center", gap: "0.4rem", height: 40, padding: "0 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", cursor: "pointer", color: "#475569", fontWeight: 700, fontSize: "0.78rem" }}
      >
        <Globe size={17} />
        <span>{current.flag} {t(`language.${current.code === "en" ? "english" : "swahili"}`)}</span>
      </button>

      {open && (
        <div style={{ position: "absolute", top: 48, right: 0, width: 190, background: "white", borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 20px 45px rgba(15,23,42,0.18)", zIndex: 200, overflow: "hidden", padding: "0.4rem" }}>
          {LANGUAGES.map((lang) => {
            const active = i18n.language === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => select(lang.code)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.55rem 0.7rem", borderRadius: 10, background: active ? "#eff6ff" : "transparent", border: "none", cursor: "pointer", fontSize: "0.82rem", fontWeight: 700, color: active ? "#1d4ed8" : "#334155" }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#f1f5f9"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: "1rem" }}>{lang.flag}</span>
                <span style={{ flex: 1, textAlign: "left" }}>{t(`language.${lang.code === "en" ? "english" : "swahili"}`)}</span>
                {active && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
