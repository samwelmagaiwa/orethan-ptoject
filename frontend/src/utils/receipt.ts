import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import logo from "../assets/logo.png";
import { ORETHAN_CONTACTS, letterheadBlock, watermarkBlock, triggerPrint } from "./printDoc";

export interface ReceiptData {
  receipt_number: string;
  transaction_number: string;
  payment_date: string;
  payment_time?: string;
  customer_name: string;
  customer_number: string;
  loan_number: string;
  phone?: string;
  original_amount: number;
  balance_before: number;
  amount_paid: number;
  balance_after: number;
  next_due_date?: string | null;
  payment_method: string;
  received_by?: string;
  verification_code: string;
  fully_paid?: boolean;
}

export type ReceiptFormat = "a4" | "80mm" | "58mm";

const fmt = (n: any) => "TZS " + Math.round(Number(n) || 0).toLocaleString();
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");
const METHOD_LABEL: Record<string, string> = {
  cash: "Cash", bank_transfer: "Bank Transfer", mobile_money: "Mobile Money",
  mpesa: "M-Pesa", airtel_money: "Airtel Money", mixx_by_yas: "Mixx by Yas",
  tigo_pesa: "Tigo Pesa", halopesa: "HaloPesa",
};
const methodLabel = (m: string) => METHOD_LABEL[m] || m;

async function qrDataUrl(text: string, size: number) {
  try { return await QRCode.toDataURL(text, { margin: 1, width: size, errorCorrectionLevel: "M" }); }
  catch { return ""; }
}

function barcodeSvg(code: string, opts: { width?: number; height?: number } = {}) {
  try {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, code, { format: "CODE128", displayValue: false, height: opts.height ?? 46, width: opts.width ?? 1.6, margin: 0, lineColor: "#0f172a" });
    return new XMLSerializer().serializeToString(svg);
  } catch { return ""; }
}

const verifyPayload = (r: ReceiptData) =>
  `ORETHAN|${r.receipt_number}|${r.amount_paid}|${r.verification_code}`;

/* ─────────────── A4 / Standard receipt ─────────────── */
async function buildA4(r: ReceiptData) {
  const qr = await qrDataUrl(verifyPayload(r), 150);
  const bc = barcodeSvg(r.receipt_number, { height: 50 });
  const sectionTitle = (n: number, t: string) => `
    <div style="display:flex;align-items:center;gap:11px;margin:16px 0 8px">
      <span style="width:25px;height:25px;border-radius:7px;background:linear-gradient(135deg,#102a43,#1d3a5f);color:#fff;font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center">${n}</span>
      <span style="font-size:13px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#102a43">${t}</span>
      <span style="flex:1;height:2.5px;border-radius:3px;background:linear-gradient(90deg,#7cb342,#1d8ad1,rgba(29,138,209,0))"></span>
    </div>`;
  const block = (label: string, value: string, color = "#0f172a") => `
    <div style="padding:5px 0;border-bottom:1px solid #f1f5f9">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:700">${label}</div>
      <div style="font-size:12.5px;font-weight:700;color:${color};margin-top:2px">${value}</div>
    </div>`;
  const grid = (cells: string[], cols = 3) => `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:2px 22px">${cells.join("")}</div>`;

  const body = `
  <div style="max-width:700px;margin:0 auto;color:#0f172a">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2.5px solid #102a43;padding-bottom:12px">
      <div>
        <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#64748b;font-weight:700">Loan Repayment</div>
        <div style="font-size:26px;font-weight:800;color:#102a43;letter-spacing:-0.5px;margin-top:2px">Official Receipt</div>
      </div>
      ${r.fully_paid ? `<div style="border:2px solid #059669;color:#059669;font-size:11px;font-weight:800;letter-spacing:1.5px;padding:6px 14px;border-radius:6px;text-transform:uppercase">Loan Cleared</div>`
      : `<div style="border:2px solid #102a43;color:#102a43;font-size:11px;font-weight:800;letter-spacing:1.5px;padding:6px 14px;border-radius:6px;text-transform:uppercase">Paid</div>`}
    </div>

    ${sectionTitle(1, "Receipt Information")}
    ${grid([
      block("Receipt No", r.receipt_number),
      block("Transaction No", r.transaction_number),
      block("Payment Date", fmtDate(r.payment_date)),
      block("Payment Time", r.payment_time || "—"),
      block("Payment Method", methodLabel(r.payment_method)),
      block("Received By", r.received_by || "—"),
    ])}

    ${sectionTitle(2, "Customer Information")}
    ${grid([
      block("Customer Name", r.customer_name),
      block("Customer Number", r.customer_number),
      block("Loan Number", r.loan_number),
      block("Phone Number", r.phone || "—"),
    ])}

    ${sectionTitle(3, "Loan Summary")}
    ${grid([
      block("Original Loan Amount", fmt(r.original_amount)),
      block("Balance Before Payment", fmt(r.balance_before)),
      block("Amount Paid", fmt(r.amount_paid), "#059669"),
      block("New Outstanding Balance", fmt(r.balance_after), r.balance_after <= 0 ? "#059669" : "#b91c1c"),
      block("Next Due Date", r.fully_paid ? "— (Cleared)" : fmtDate(r.next_due_date)),
    ])}

    <!-- Amount paid highlight -->
    <div style="display:flex;justify-content:space-between;align-items:center;border:1.5px solid #102a43;border-left:6px solid #102a43;border-radius:12px;padding:14px 22px;margin:14px 0">
      <div>
        <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:2px;color:#64748b;font-weight:700">Amount Received</div>
        <div style="font-size:12px;color:#94a3b8;font-weight:600;margin-top:3px">Paid via ${methodLabel(r.payment_method)}</div>
      </div>
      <div style="font-size:28px;font-weight:900;color:#102a43;letter-spacing:-0.5px">${fmt(r.amount_paid)}</div>
    </div>

    <!-- Verification row: QR + barcode + code -->
    <div style="display:flex;align-items:center;gap:20px;margin-top:16px;padding:14px 18px;background:#f8fafc;border:1px solid #eef1f6;border-radius:12px">
      ${qr ? `<img src="${qr}" style="width:96px;height:96px" alt="QR" />` : ""}
      <div style="flex:1">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:700">Digital Verification Code</div>
        <div style="font-size:18px;font-weight:800;color:#102a43;font-family:ui-monospace,monospace;letter-spacing:2px;margin:2px 0 8px">${r.verification_code}</div>
        <div>${bc}</div>
      </div>
    </div>

    <!-- Footer -->
    <div style="margin-top:30px;display:grid;grid-template-columns:1fr 1fr;gap:36px">
      <div style="text-align:center"><div style="border-top:1.5px solid #0f172a;padding-top:10px;font-size:10px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1px">Received By: ${r.received_by || "Cashier"}</div></div>
      <div style="text-align:center"><div style="border-top:1.5px solid #0f172a;padding-top:10px;font-size:10px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1px">Customer Signature</div></div>
    </div>
    <div style="margin-top:20px;text-align:center">
      <div style="font-size:15px;font-weight:800;color:#059669">Thank You For Your Payment!</div>
      <div style="font-size:10px;color:#94a3b8;margin-top:6px;font-style:italic">Generated By: Microfinance System · ${new Date().toLocaleString("en-GB")}</div>
    </div>
  </div>`;

  return `<html><head><title>Receipt ${r.receipt_number}</title><style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',sans-serif;padding:30px 40px;color:#0f172a;background:#fff;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    @page{size:A4}
  </style></head><body>${watermarkBlock()}<div style="max-width:700px;margin:0 auto;position:relative;z-index:1">${letterheadBlock()}<div style="height:10px"></div>${body}</div></body></html>`;
}

/* ─────────────── Thermal receipt (58mm / 80mm) ─────────────── */
async function buildThermal(r: ReceiptData, mm: 58 | 80) {
  const widthPx = mm === 58 ? 210 : 300;
  const qr = await qrDataUrl(verifyPayload(r), mm === 58 ? 110 : 140);
  const bc = barcodeSvg(r.receipt_number, { height: 38, width: mm === 58 ? 1.1 : 1.5 });
  const line = (l: string, v: string, bold = false) =>
    `<div style="display:flex;justify-content:space-between;gap:8px;margin:2px 0"><span style="color:#444">${l}</span><span style="text-align:right;font-weight:${bold ? 800 : 600}">${v}</span></div>`;
  const hr = `<div style="border-top:1px dashed #000;margin:6px 0"></div>`;

  const body = `
    <div style="text-align:center">
      <img src="${logo}" style="height:46px;object-fit:contain" alt="" />
      <div style="font-weight:800;font-size:13px;margin-top:3px">ORETHAN MICROFINANCE</div>
      <div style="font-size:9px;color:#333;line-height:1.35">${ORETHAN_CONTACTS.box}<br/>${ORETHAN_CONTACTS.email}<br/>${ORETHAN_CONTACTS.phone}</div>
    </div>
    ${hr}
    <div style="text-align:center;font-weight:800;font-size:12px;letter-spacing:1px">PAYMENT RECEIPT</div>
    ${hr}
    ${line("Receipt", r.receipt_number)}
    ${line("Txn", r.transaction_number)}
    ${line("Date", fmtDate(r.payment_date))}
    ${line("Time", r.payment_time || "—")}
    ${line("Method", methodLabel(r.payment_method))}
    ${hr}
    ${line("Customer", r.customer_name)}
    ${line("Cust No", r.customer_number)}
    ${line("Loan No", r.loan_number)}
    ${r.phone ? line("Phone", r.phone) : ""}
    ${hr}
    ${line("Loan Amount", fmt(r.original_amount))}
    ${line("Bal. Before", fmt(r.balance_before))}
    ${line("AMOUNT PAID", fmt(r.amount_paid), true)}
    ${line("Bal. After", fmt(r.balance_after))}
    ${line("Next Due", r.fully_paid ? "CLEARED" : fmtDate(r.next_due_date))}
    ${hr}
    <div style="text-align:center;margin:6px 0">
      ${qr ? `<img src="${qr}" style="width:${mm === 58 ? 92 : 120}px;height:${mm === 58 ? 92 : 120}px" alt="" />` : ""}
      <div style="font-size:8px;color:#444;text-transform:uppercase;letter-spacing:1px;margin-top:2px">Verification Code</div>
      <div style="font-weight:800;font-family:ui-monospace,monospace;letter-spacing:1px;font-size:12px">${r.verification_code}</div>
      <div style="margin-top:4px">${bc}</div>
    </div>
    ${hr}
    <div style="text-align:center;font-size:10px">Received By: ${r.received_by || "Cashier"}</div>
    <div style="text-align:center;font-size:9px;color:#444">Generated By: Microfinance System</div>
    <div style="text-align:center;font-weight:800;font-size:11px;margin-top:6px">THANK YOU FOR YOUR PAYMENT!</div>
    <div style="height:10px"></div>
  `;

  return `<html><head><title>Receipt ${r.receipt_number}</title><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Courier New',monospace;width:${widthPx}px;margin:0 auto;padding:8px 10px;color:#000;font-size:11px;line-height:1.35;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    img{max-width:100%}
    @page{size:${mm}mm auto;margin:0}
  </style></head><body>${body}</body></html>`;
}

/**
 * Open a print window for the repayment receipt in the requested format.
 */
export async function printReceipt(receipt: ReceiptData, format: ReceiptFormat = "a4") {
  const html = format === "a4" ? await buildA4(receipt) : await buildThermal(receipt, format === "58mm" ? 58 : 80);
  const win = window.open("", "_blank", format === "a4" ? "width=860,height=1120" : "width=420,height=720");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  triggerPrint(win);
}
