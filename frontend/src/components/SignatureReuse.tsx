import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PenLine, AlertTriangle } from "lucide-react";

/**
 * Shows the saved signature that will be re-applied when the user enters
 * their password during an approval. Prompts to create one if missing.
 */
const SignatureReuse = ({ signature }: { signature?: string | null }) => {
  const navigate = useNavigate();
  const { t } = useTranslation("miscModals");

  if (!signature) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "0.7rem 0.9rem", marginBottom: "0.6rem", fontSize: "0.76rem", fontWeight: 600, color: "#92400e" }}>
        <AlertTriangle size={16} style={{ flexShrink: 0 }} />
        <span>{t("signatureReuse.noSignatureYet")}{" "}
          <button onClick={() => navigate("/profile")} style={{ background: "none", border: "none", color: "#b45309", fontWeight: 800, textDecoration: "underline", cursor: "pointer", padding: 0, fontSize: "0.76rem" }}>{t("signatureReuse.setYourSignature")}</button>
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", background: "#f8fafc", border: "1px solid #eef1f6", borderRadius: 10, padding: "0.6rem 0.9rem", marginBottom: "0.6rem" }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.66rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.4px" }}>
          <PenLine size={13} style={{ color: "#4f46e5" }} /> {t("signatureReuse.signatureToBeApplied")}
        </div>
        <div style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 600, marginTop: 2 }}>{t("signatureReuse.reuseHint")}</div>
      </div>
      <img src={signature} alt={t("signatureReuse.savedSignatureAlt")} style={{ height: 44, maxWidth: 150, objectFit: "contain", background: "#fff", border: "1px solid #eef1f6", borderRadius: 8, padding: "2px 6px" }} />
    </div>
  );
};

export default SignatureReuse;
