import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Globe, Check } from "lucide-react";

const LANGUAGES = [
  { code: "en", flag: "🇬🇧" },
  { code: "sw", flag: "🇹🇿" },
] as const;

const LanguageSwitcher = () => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onClickOut = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current && !btnRef.current.contains(target)) {
        // also check if click was inside the portal dropdown
        const portal = document.getElementById("lang-switcher-portal");
        if (!portal || !portal.contains(target)) setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOut);
    return () => document.removeEventListener("mousedown", onClickOut);
  }, []);

  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setOpen(o => !o);
  };

  const current = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

  const select = (code: string) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  const dropdown = open ? (
    <div
      id="lang-switcher-portal"
      style={{ position: "fixed", top: dropPos.top, right: dropPos.right, width: 190, background: "white", borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 20px 45px rgba(15,23,42,0.18)", zIndex: 99999, overflow: "hidden", padding: "0.4rem" }}
    >
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
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        title={t("language.label")}
        style={{ display: "flex", alignItems: "center", gap: "0.4rem", height: 40, padding: "0 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", cursor: "pointer", color: "#475569", fontWeight: 700, fontSize: "0.78rem" }}
      >
        <Globe size={17} />
        <span>{current.flag} {t(`language.${current.code === "en" ? "english" : "swahili"}`)}</span>
      </button>
      {createPortal(dropdown, document.body)}
    </>
  );
};

export default LanguageSwitcher;
