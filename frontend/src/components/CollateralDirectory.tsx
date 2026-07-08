import { useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { Camera, Trash2, Eye, Loader2, Image as ImageIcon, X } from "lucide-react";
import DocumentViewerModal from "./DocumentViewerModal";
import ConfirmModal from "./ConfirmModal";
import { resolveFileUrl } from "../utils/resolveFileUrl";
import { API_BASE } from "../lib/api";


export interface CollateralAssetLink {
  id: string;
  jina: string;
  thamaniSoko: string;
  thamaniDhamana: string;
}

export interface CollateralPhoto {
  url: string;
  name: string;
  mimeType: string;
  items: CollateralAssetLink[];
}

/** One option sourced from the FOMU YA KUWEKA REHANI MALI (Chattel Form) item list. */
export interface ChattelOption {
  jina: string;
  thamaniSoko: string;
  thamaniDhamana: string;
}

interface Props {
  photos: CollateralPhoto[];
  onChange?: (photos: CollateralPhoto[]) => void;
  /** Used to label the directory, e.g. the applicant's name once filled in. */
  clientName?: string;
  /** Approver view: hide upload/delete/add-asset, show linked assets as static text. */
  readOnly?: boolean;
  /** Mali list from FOMU YA KUWEKA REHANI MALI, used to populate the selection popup. */
  chattelOptions?: ChattelOption[];
}

const formatMoney = (v: string) => {
  const n = Number(v);
  if (!n) return "";
  return n.toLocaleString("en-US");
};

const newAssetLink = (): CollateralAssetLink => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  jina: "",
  thamaniSoko: "",
  thamaniDhamana: "",
});

const AssetPickerModal = ({
  options,
  onSelect,
  onClose,
}: {
  options: ChattelOption[];
  onSelect: (option: ChattelOption) => void;
  onClose: () => void;
}) => {
  const { t } = useTranslation("miscModals");
  const valid = options.filter((o) => o.jina.trim());
  return (
    <div className="cdir-picker-overlay" onClick={onClose}>
      <div className="cdir-picker-card" onClick={(e) => e.stopPropagation()}>
        <div className="cdir-picker-header">
          <div>
            <p className="cdir-picker-title">{t("collateral.picker.title")}</p>
            <p className="cdir-picker-subtitle">
              {t("collateral.picker.subtitle")}
            </p>
          </div>
          <button type="button" className="cdir-picker-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="cdir-picker-body">
          {valid.length === 0 ? (
            <div className="cdir-picker-empty">
              <p>{t("collateral.picker.emptyTitle")}</p>
              <span>{t("collateral.picker.emptyHint")}</span>
            </div>
          ) : (
            valid.map((opt, i) => (
              <button type="button" key={i} className="cdir-picker-option" onClick={() => onSelect(opt)}>
                <span className="cdir-picker-option-name">{opt.jina}</span>
                <span className="cdir-picker-option-values">
                  <span>{t("collateral.picker.marketValue")}: <strong>{opt.thamaniSoko ? `TZS ${formatMoney(opt.thamaniSoko)}` : "-"}</strong></span>
                  <span className="cdir-picker-option-green">{t("collateral.picker.collateralValue")}: <strong>{opt.thamaniDhamana ? `TZS ${formatMoney(opt.thamaniDhamana)}` : "-"}</strong></span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const CollateralDirectory = ({ photos, onChange, clientName, readOnly = false, chattelOptions = [] }: Props) => {
  const { t } = useTranslation("miscModals");
  const [uploading, setUploading] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState<CollateralPhoto | null>(null);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);
  const [pickerTarget, setPickerTarget] = useState<{ photoIndex: number; itemId: string } | null>(null);

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
      onChange?.([...photos, { url: document_url, name, mimeType: mime_type, items: [newAssetLink()] }]);
    } catch (err) {
      console.error("Collateral photo upload failed", err);
      alert(t("collateral.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    onChange?.(photos.filter((_, i) => i !== index));
  };

  const applyAssetSelection = (photoIndex: number, itemId: string, option: ChattelOption) => {
    onChange?.(
      photos.map((p, i) =>
        i === photoIndex
          ? {
              ...p,
              items: p.items.map((it) =>
                it.id === itemId
                  ? { ...it, jina: option.jina, thamaniSoko: option.thamaniSoko, thamaniDhamana: option.thamaniDhamana }
                  : it
              ),
            }
          : p
      )
    );
    setPickerTarget(null);
  };

  return (
    <div className="cdir">
      <div className="cdir-header">
        <div>
          <p className="cdir-title">{t("collateral.directoryTitle")}{clientName ? ` -- ${clientName.toUpperCase()}` : ""}</p>
          <p className="cdir-hint">{t("collateral.directoryHint")}</p>
        </div>
        {!readOnly && (
          <label className="cdir-add-btn">
            {uploading ? <Loader2 size={16} className="cdir-spin" /> : <Camera size={16} />}
            {t("collateral.addPhoto")}
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
          <p>{t("collateral.emptyTitle")}</p>
          <span>{readOnly ? t("collateral.emptyHintReadOnly") : t("collateral.emptyHintEditable")}</span>
        </div>
      ) : (
        <div className="cdir-grid">
          {photos.map((photo, index) => (
            <div key={index} className="cdir-card">
              <div className="cdir-thumb" onClick={() => setViewerPhoto(photo)}>
                <img src={resolveFileUrl(photo.url)} alt={photo.name} />
                <span className="cdir-view-overlay"><Eye size={16} /> {t("collateral.view")}</span>
              </div>

              <div className="cdir-assets">
                {(photo.items || []).map((item) => (
                  <div key={item.id} className={`cdir-asset-row ${!item.jina ? "cdir-asset-row-empty" : ""}`}>
                    <button
                      type="button"
                      className="cdir-asset-name"
                      disabled={readOnly}
                      onClick={() => !readOnly && setPickerTarget({ photoIndex: index, itemId: item.id })}
                    >
                      <span className="cdir-asset-label">{t("collateral.assetName")}</span>
                      <span className={item.jina ? "cdir-asset-value" : "cdir-asset-placeholder"}>
                        {item.jina || (readOnly ? "-" : t("collateral.selectAsset"))}
                      </span>
                    </button>
                    <div className="cdir-asset-value-col">
                      <span className="cdir-asset-label">{t("collateral.marketValue")}</span>
                      <span className={item.thamaniSoko ? "cdir-asset-money cdir-asset-money-green" : "cdir-asset-money"}>{item.thamaniSoko ? formatMoney(item.thamaniSoko) : "-"}</span>
                    </div>
                    <div className="cdir-asset-value-col">
                      <span className="cdir-asset-label">{t("collateral.collateralValue")}</span>
                      <span className={item.thamaniDhamana ? "cdir-asset-money cdir-asset-money-green" : "cdir-asset-money"}>{item.thamaniDhamana ? formatMoney(item.thamaniDhamana) : "-"}</span>
                    </div>
                  </div>
                ))}
                {(photo.items || []).length === 0 && (
                  <p className="cdir-asset-none">{t("collateral.noAssetLinked")}</p>
                )}
              </div>

              {!readOnly && (
                <button type="button" className="cdir-delete-btn" onClick={() => setConfirmDeleteIndex(index)}>
                  <Trash2 size={13} /> {t("collateral.deletePhoto")}
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
        items={viewerPhoto?.items}
        onClose={() => setViewerPhoto(null)}
      />

      <ConfirmModal
        isOpen={confirmDeleteIndex !== null}
        title={t("collateral.confirmDeleteTitle")}
        message={t("collateral.confirmDeleteMessage")}
        type="danger"
        confirmText={t("collateral.confirmDeleteYes")}
        cancelText={t("collateral.confirmDeleteCancel")}
        onConfirm={() => {
          if (confirmDeleteIndex !== null) removePhoto(confirmDeleteIndex);
          setConfirmDeleteIndex(null);
        }}
        onCancel={() => setConfirmDeleteIndex(null)}
      />

      {pickerTarget && (
        <AssetPickerModal
          options={chattelOptions}
          onSelect={(opt) => applyAssetSelection(pickerTarget.photoIndex, pickerTarget.itemId, opt)}
          onClose={() => setPickerTarget(null)}
        />
      )}

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

        .cdir-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media (max-width: 1100px) { .cdir-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 720px) { .cdir-grid { grid-template-columns: 1fr; } }

        .cdir-card { border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 10px; background: #fff; display: flex; flex-direction: column; gap: 8px; }
        .cdir-thumb { position: relative; width: 100%; height: 150px; border-radius: 8px; overflow: hidden; cursor: pointer; background: #f1f5f9; }
        .cdir-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cdir-view-overlay {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 5px;
          background: rgba(15, 23, 42, 0.55); color: #fff; font-size: 0.72rem; font-weight: 700; opacity: 0;
          transition: opacity 0.15s;
        }
        .cdir-thumb:hover .cdir-view-overlay { opacity: 1; }

        .cdir-assets { display: flex; flex-direction: column; gap: 6px; }
        .cdir-asset-row {
          display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 6px; align-items: stretch;
          border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; background: #f8fafc;
        }
        .cdir-asset-row-empty { border-color: #fca5a5; border-style: dashed; background: #fff5f5; }
        .cdir-asset-name {
          display: flex; flex-direction: column; gap: 2px; text-align: left; background: transparent; border: none;
          cursor: pointer; padding: 2px 4px; border-radius: 4px;
        }
        .cdir-asset-name:hover:not(:disabled) { background: #e2e8f0; }
        .cdir-asset-name:disabled { cursor: default; }
        .cdir-asset-label { font-size: 0.62rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.3px; }
        .cdir-asset-value { font-size: 0.76rem; font-weight: 700; color: #102a43; }
        .cdir-asset-placeholder { font-size: 0.76rem; font-weight: 700; color: #dc2626; }
        .cdir-asset-value-col { display: flex; flex-direction: column; gap: 2px; padding: 2px 4px; }
        .cdir-asset-money { font-size: 0.76rem; font-weight: 800; color: #94a3b8; }
        .cdir-asset-money-green { color: #16a34a; }
        .cdir-asset-none { font-size: 0.72rem; color: #94a3b8; margin: 0; font-style: italic; }

        .cdir-delete-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 5px; background: #fee2e2;
          color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; padding: 5px 0; font-size: 0.72rem;
          font-weight: 700; cursor: pointer;
        }
        .cdir-delete-btn:hover { background: #fecaca; }

        .cdir-picker-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); display: flex; align-items: center; justify-content: center; z-index: 2100; padding: 24px; }
        .cdir-picker-card { background: #fff; border-radius: 16px; width: 520px; max-width: 96%; max-height: 80vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.35); }
        .cdir-picker-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; padding: 16px 18px; background: #102a43; color: #fff; flex-shrink: 0; }
        .cdir-picker-title { font-size: 0.85rem; font-weight: 800; margin: 0 0 4px; letter-spacing: 0.3px; }
        .cdir-picker-subtitle { font-size: 0.72rem; margin: 0; color: #cbd5e1; }
        .cdir-picker-close { background: transparent; border: none; color: #fff; cursor: pointer; display: flex; align-items: center; padding: 4px; border-radius: 6px; flex-shrink: 0; }
        .cdir-picker-close:hover { background: rgba(255,255,255,0.15); }
        .cdir-picker-body { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
        .cdir-picker-option {
          display: flex; flex-direction: column; gap: 4px; text-align: left; background: #f8fafc; border: 1px solid #e2e8f0;
          border-radius: 8px; padding: 10px 12px; cursor: pointer;
        }
        .cdir-picker-option:hover { background: #e0f2fe; border-color: #7dd3fc; }
        .cdir-picker-option-name { font-size: 0.82rem; font-weight: 800; color: #102a43; }
        .cdir-picker-option-values { display: flex; gap: 16px; flex-wrap: wrap; font-size: 0.72rem; color: #475569; }
        .cdir-picker-option-green { color: #16a34a; }
        .cdir-picker-empty { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 30px 16px; text-align: center; color: #94a3b8; }
        .cdir-picker-empty p { margin: 0; font-weight: 700; color: #64748b; font-size: 0.82rem; }
        .cdir-picker-empty span { font-size: 0.74rem; }
      `}</style>
    </div>
  );
};

export default CollateralDirectory;
