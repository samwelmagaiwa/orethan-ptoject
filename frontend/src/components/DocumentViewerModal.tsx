import { X, Download } from "lucide-react";
import { resolveFileUrl } from "../utils/resolveFileUrl";

interface Props {
  isOpen: boolean;
  url: string | null;
  name?: string | null;
  mimeType?: string | null;
  note?: string | null;
  onClose: () => void;
}

const isPdf = (url: string, mimeType?: string | null) =>
  (mimeType || "").includes("pdf") || url.toLowerCase().endsWith(".pdf");

const DocumentViewerModal = ({ isOpen, url, name, mimeType, note, onClose }: Props) => {
  if (!isOpen || !url) return null;
  const resolved = resolveFileUrl(url);
  const pdf = isPdf(resolved, mimeType);

  return (
    <div className="dvm-overlay" onClick={onClose}>
      <div className="dvm-content" onClick={(e) => e.stopPropagation()}>
        <div className="dvm-header">
          <span className="dvm-title">{name || "Nyaraka"}</span>
          <div className="dvm-actions">
            <a className="dvm-download" href={resolved} target="_blank" rel="noopener noreferrer" download>
              <Download size={15} /> Pakua
            </a>
            <button type="button" className="dvm-close" onClick={onClose}><X size={18} /></button>
          </div>
        </div>
        <div className="dvm-body">
          {pdf ? (
            <iframe src={resolved} title={name || "Nyaraka"} className="dvm-frame" />
          ) : (
            <img src={resolved} alt={name || "Nyaraka"} className="dvm-image" />
          )}
        </div>
        {note && (
          <div className="dvm-note">
            <span className="dvm-note-label">Maelezo ya Picha (Note)</span>
            <p className="dvm-note-text">{note}</p>
          </div>
        )}
      </div>

      <style>{`
        .dvm-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 24px; }
        .dvm-content { background: #fff; border-radius: 16px; width: 900px; max-width: 96%; height: 88vh; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.35); }
        .dvm-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: #102a43; color: #fff; flex-shrink: 0; }
        .dvm-title { font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-right: 12px; }
        .dvm-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .dvm-download { display: flex; align-items: center; gap: 5px; background: rgba(255,255,255,0.12); color: #fff; border: 1px solid rgba(255,255,255,0.25); padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; text-decoration: none; }
        .dvm-download:hover { background: rgba(255,255,255,0.22); }
        .dvm-close { background: transparent; border: none; color: #fff; cursor: pointer; display: flex; align-items: center; padding: 4px; border-radius: 6px; }
        .dvm-close:hover { background: rgba(255,255,255,0.15); }
        .dvm-body { flex: 1; overflow: auto; background: #f1f5f9; display: flex; align-items: flex-start; justify-content: center; }
        .dvm-frame { width: 100%; height: 100%; border: none; }
        .dvm-image { max-width: 100%; height: auto; display: block; margin: 0 auto; }
        .dvm-note { flex-shrink: 0; padding: 12px 18px; background: #fffbeb; border-top: 1px solid #fde68a; max-height: 25%; overflow-y: auto; }
        .dvm-note-label { display: block; font-size: 10px; font-weight: 800; color: #92400e; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 4px; }
        .dvm-note-text { font-size: 13px; color: #1e293b; margin: 0; line-height: 1.4; white-space: pre-wrap; }
      `}</style>
    </div>
  );
};

export default DocumentViewerModal;
