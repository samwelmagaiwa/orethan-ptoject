import { useState } from "react";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { exportToCsv, exportToExcel } from "../utils/exportData";

interface Props {
  /** Returns the current rows to export -- called fresh on each click so it always reflects the latest filtered/loaded data. */
  getRows: () => Record<string, unknown>[];
  filename: string;
  sheetName?: string;
  onPrint?: () => void;
  disabled?: boolean;
}

/**
 * Shared CSV / Excel / Print action row for accounting & report pages.
 * Visibility is already controlled by whichever role-gate renders the page
 * itself (admin / finance officer / managing director / general manager),
 * so no extra permission check is needed here.
 */
const ExportButtons = ({ getRows, filename, sheetName, onPrint, disabled }: Props) => {
  const [exporting, setExporting] = useState(false);

  const handleExcel = async () => {
    setExporting(true);
    try {
      await exportToExcel(filename, sheetName || filename, getRows());
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="export-buttons">
      <button type="button" className="export-btn" disabled={disabled} onClick={() => exportToCsv(filename, getRows())}>
        <Download size={14} /><span className="export-btn__label">CSV</span>
      </button>
      <button type="button" className="export-btn" disabled={disabled || exporting} onClick={handleExcel}>
        <FileSpreadsheet size={14} /><span className="export-btn__label">{exporting ? "Exporting…" : "Excel"}</span>
      </button>
      {onPrint && (
        <button type="button" className="export-btn" disabled={disabled} onClick={onPrint}>
          <Printer size={14} /><span className="export-btn__label">Print</span>
        </button>
      )}
      <style>{`
        .export-buttons { display: flex; gap: 8px; flex-wrap: nowrap; align-items: center; }
        .export-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; color: #334155; font-size: 12.5px; font-weight: 700; cursor: pointer; transition: all 0.15s; white-space: nowrap; flex-shrink: 0; }
        .export-btn:hover:not(:disabled) { background: #102a43; color: #fff; border-color: #102a43; }
        .export-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .export-btn__label { display: inline; }
        @media (max-width: 640px) {
          .export-buttons { gap: 6px; }
          .export-btn { padding: 6px 9px; font-size: 11.5px; gap: 4px; }
        }
        @media (max-width: 480px) {
          .export-btn { padding: 6px 7px; font-size: 11px; gap: 3px; }
          .export-btn__label { display: none; }
        }
      `}</style>
    </div>
  );
};

export default ExportButtons;
