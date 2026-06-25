import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";

interface Props {
  open: boolean;
  title?: string;
  message?: string;
  onClose: () => void;
  accent?: string;
}

const SuccessModal = ({ open, title = "Success", message = "", onClose, accent = "#059669" }: Props) => (
  <AnimatePresence>
    {open && (
      <div style={{ position: "fixed", inset: 0, zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", backdropFilter: "blur(10px)", background: "rgba(2,6,23,0.6)" }}>
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          style={{ width: "100%", maxWidth: 400, borderRadius: 20, background: "white", overflow: "hidden", boxShadow: "0 30px 70px rgba(0,0,0,0.45)", fontFamily: "'Plus Jakarta Sans','Inter',sans-serif", textAlign: "center" }}
        >
          <div style={{ position: "relative", padding: "2rem 1.6rem 1.4rem" }}>
            <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: "50%", background: "#f1f5f9", border: "none", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 14 }}
              style={{ width: 76, height: 76, borderRadius: "50%", background: `${accent}1a`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}
            >
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 8px 20px ${accent}55` }}>
                <CheckCircle2 size={32} color="white" strokeWidth={2.5} />
              </div>
            </motion.div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 900, color: "#0f172a", margin: "0 0 0.5rem" }}>{title}</h2>
            <p style={{ fontSize: "0.88rem", color: "#64748b", margin: 0, lineHeight: 1.5, fontWeight: 500 }}>{message}</p>
            <button onClick={onClose} style={{ marginTop: "1.4rem", width: "100%", padding: "0.8rem", borderRadius: 12, background: accent, border: "none", color: "white", fontWeight: 800, fontSize: "0.88rem", cursor: "pointer", boxShadow: `0 6px 16px ${accent}40` }}>
              Done
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export default SuccessModal;
