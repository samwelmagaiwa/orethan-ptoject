import { useState } from "react";
import axios from "axios";
import { Camera, Trash2, Eye, Loader2, Image as ImageIcon } from "lucide-react";
import DocumentViewerModal from "./DocumentViewerModal";
import ConfirmModal from "./ConfirmModal";
import { resolveFileUrl } from "../utils/resolveFileUrl";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

export interface CollateralPhoto {
  url: string;
  name: string;
  mimeType: string;
  note: string;
}

interface Props {
  photos: CollateralPhoto[];
  onChange?: (photos: CollateralPhoto[]) => void;
  /** Used to label the directory, e.g. the applicant's name once filled in. */
  clientName?: string;
  /** Approver view: hide upload/delete/edit-note, show notes as static text. */
  readOnly?: boolean;
}

const CollateralDirectory = ({ photos, onChange, clientName, readOnly = false }: Props) => {
  const [uploading, setUploading] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState<CollateralPhoto | null>(null);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_key", "collateral");
      const token = localStorage.getItem("token");
      const res = await axios.post(`${API_BASE}/upload/document`, formData, {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      const { document_url, name, mime_type } = res.data;
      onChange?.([...photos, { url: document_url, name, mimeType: mime_type, note: "" }]);
    } catch (err) {
      console.error("Collateral photo upload failed", err);
      alert("Imeshindwa kupakia picha. Tafadhali jaribu tena.");
    } finally {
      setUploading(false);
    }
  };

  const updateNote = (index: number, note: string) => {
    onChange?.(photos.map((p, i) => (i === index ? { ...p, note } : p)));
  };

  const removePhoto = (index: number) => {
    onChange?.(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="cdir">
      <div className="cdir-header">
        <div>
          <p className="cdir-title">DIRECTORI YA DHAMANA YA MTEJA{clientName ? ` — ${clientName.toUpperCase()}` : ""}</p>
          <p className="cdir-hint">Pakia picha za mali zote zilizopigwa picha shambani/eneo la mteja kama dhamana ya mkopo. Andika maelezo mafupi ya kila picha.</p>
        </div>
        {!readOnly && (
          <label className="cdir-add-btn">
            {uploading ? <Loader2 size={16} className="cdir-spin" /> : <Camera size={16} />}
            ONGEZA PICHA
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>

      {photos.length === 0 ? (
        <div className="cdir-empty">
          <ImageIcon size={32} />
          <p>Hakuna picha za dhamana zilizopakiwa bado.</p>
          <span>{readOnly ? "Hakuna picha za dhamana zilizopakiwa na mhusika." : "Bonyeza “ONGEZA PICHA” kupakia picha za mali za mteja."}</span>
        </div>
      ) : (
        <div className="cdir-grid">
          {photos.map((photo, index) => (
            <div key={index} className="cdir-card">
              <div className="cdir-thumb" onClick={() => setViewerPhoto(photo)}>
                <img src={resolveFileUrl(photo.url)} alt={photo.name} />
                <span className="cdir-view-overlay"><Eye size={16} /> Tazama</span>
              </div>
              {readOnly ? (
                photo.note && <p className="cdir-note-static"><span>Maelezo:</span> {photo.note}</p>
              ) : (
                <textarea
                  className="cdir-note-input"
                  placeholder="Andika maelezo ya mali hii (mfano: Pikipiki, namba ya usajili T123ABC)..."
                  value={photo.note}
                  onChange={(e) => updateNote(index, e.target.value)}
                  rows={2}
                />
              )}
              {!readOnly && (
                <button type="button" className="cdir-delete-btn" onClick={() => setConfirmDeleteIndex(index)}>
                  <Trash2 size={13} /> Futa Picha
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <DocumentViewerModal
        isOpen={!!viewerPhoto}
        url={viewerPhoto?.url ?? null}
        name={viewerPhoto?.name}
        mimeType={viewerPhoto?.mimeType}
        note={viewerPhoto?.note}
        onClose={() => setViewerPhoto(null)}
      />

      <ConfirmModal
        isOpen={confirmDeleteIndex !== null}
        title="Futa Picha ya Dhamana"
        message="Una hakika unataka kufuta picha hii ya dhamana? Maelezo yake yataondolewa pia."
        type="danger"
        confirmText="Ndio, Futa"
        cancelText="Ghairi"
        onConfirm={() => {
          if (confirmDeleteIndex !== null) removePhoto(confirmDeleteIndex);
          setConfirmDeleteIndex(null);
        }}
        onCancel={() => setConfirmDeleteIndex(null)}
      />

      <style>{`
        .cdir-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
        .cdir-title { font-size: 0.82rem; font-weight: 800; color: #102a43; margin: 0 0 4px; letter-spacing: 0.3px; }
        .cdir-hint { font-size: 0.78rem; color: #64748b; margin: 0; max-width: 560px; }
        .cdir-add-btn {
          display: inline-flex; align-items: center; gap: 6px; background: #102a43; color: #fff;
          padding: 9px 16px; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer;
          flex-shrink: 0; white-space: nowrap;
        }
        .cdir-add-btn:hover { background: #1e5fae; }
        .cdir-spin { animation: cdir-spin 0.8s linear infinite; }
        @keyframes cdir-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .cdir-empty {
          display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 40px 20px;
          color: #94a3b8; text-align: center; border: 2px dashed #cbd5e1; border-radius: 12px;
        }
        .cdir-empty p { margin: 4px 0 0; font-weight: 700; color: #64748b; font-size: 0.85rem; }
        .cdir-empty span { font-size: 0.75rem; }

        .cdir-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 16px; }
        .cdir-card { border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 10px; background: #fff; display: flex; flex-direction: column; gap: 8px; }
        .cdir-thumb { position: relative; width: 100%; height: 130px; border-radius: 8px; overflow: hidden; cursor: pointer; background: #f1f5f9; }
        .cdir-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cdir-view-overlay {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 5px;
          background: rgba(15, 23, 42, 0.55); color: #fff; font-size: 0.72rem; font-weight: 700; opacity: 0;
          transition: opacity 0.15s;
        }
        .cdir-thumb:hover .cdir-view-overlay { opacity: 1; }
        .cdir-note-input {
          width: 100%; resize: vertical; min-height: 44px; border: 1px solid #e2e8f0; border-radius: 6px;
          padding: 6px 8px; font-size: 0.76rem; font-family: inherit; color: #1e293b; box-sizing: border-box;
        }
        .cdir-note-input:focus { outline: none; border-color: #1e5fae; box-shadow: 0 0 0 2px rgba(30, 95, 174, 0.12); }
        .cdir-note-static { font-size: 0.76rem; color: #1e293b; margin: 0; line-height: 1.4; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 6px 8px; }
        .cdir-note-static span { font-weight: 800; color: #92400e; }
        .cdir-delete-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 5px; background: #fee2e2;
          color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; padding: 5px 0; font-size: 0.72rem;
          font-weight: 700; cursor: pointer;
        }
        .cdir-delete-btn:hover { background: #fecaca; }
      `}</style>
    </div>
  );
};

export default CollateralDirectory;
