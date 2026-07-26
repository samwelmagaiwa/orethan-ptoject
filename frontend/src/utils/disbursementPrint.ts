import axios from "axios";
import { letterheadBlock, watermarkBlock, triggerPrint } from "./printDoc";
import { API_BASE } from "../lib/api";

const fmt = (n: any) =>
  "TZS " + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: any) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

function openPrint(title: string, body: string) {
  const win = window.open("", "_blank", "width=850,height=1000");
  if (!win) return;
  win.document.write(
    `<html><head><title>${title}</title><style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Inter',sans-serif;padding:32px 40px;color:#0f172a;background:#f8fafc;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      @media print{body{padding:0;background:#fff}}
    </style></head><body>
      ${watermarkBlock()}
      <div style="max-width:700px;margin:0 auto;position:relative;z-index:1">
        ${letterheadBlock()}
        <div style="height:12px"></div>
        ${body}
      </div>
    </body></html>`
  );
  win.document.close();
  triggerPrint(win);
}

function buildVoucherBody(data: any): string {
  const { loan, preview, disbursement } = data;
  const kitabuNo      = disbursement?.voucher_number || "—";
  const approvedAmount = Number(loan.amount || 0);
  const processingFee = Number(disbursement?.processing_fee || 0);
  const insuranceFee  = Number(disbursement?.insurance_fee  || 0);
  const otherCharges  = Number(disbursement?.other_charges  || 0);
  const totalCharges  = processingFee + insuranceFee + otherCharges;
  const netAmount     = Number(disbursement?.net_amount ?? (approvedAmount - totalCharges));
  const methodLabel   = disbursement?.method?.replace(/_/g, " ")?.replace(/\b\w/g, (c: string) => c.toUpperCase()) || "—";
  const transactionRef = disbursement?.transaction_reference || "—";
  const narration     = disbursement?.narration || "—";
  const disbDate      = disbursement?.disbursement_date || loan.disbursed_at;
  const feePercent    = loan.details?.adaYaUchakataji || "0";

  const metaCell = (label: string, value: string, mono = false) => `
    <div style="padding:14px 18px">
      <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;font-weight:700">${label}</div>
      <div style="font-size:13px;font-weight:800;color:#0f172a;margin-top:5px;${mono ? "font-family:ui-monospace,monospace;letter-spacing:0.5px" : ""}">${value}</div>
    </div>`;
  const sectionTitle = (t: string, n: number) => `
    <div style="display:flex;align-items:center;gap:11px;margin:13px 0 7px">
      <span style="width:27px;height:27px;border-radius:8px;background:linear-gradient(135deg,#102a43,#1d3a5f);color:#fff;font-size:12px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;">${n}</span>
      <span style="font-size:15px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#102a43">${t}</span>
      <span style="flex:1;height:3px;border-radius:3px;background:linear-gradient(90deg,#7cb342 0%,#1d8ad1 45%,rgba(29,138,209,0) 100%)"></span>
    </div>`;
  const block = (label: string, value: string, opts: { color?: string; mono?: boolean } = {}) => `
    <div style="padding:5px 0;border-bottom:1px solid #f1f5f9">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:700">${label}</div>
      <div style="font-size:12.5px;font-weight:700;color:${opts.color || "#0f172a"};margin-top:2px;${opts.mono ? "font-family:ui-monospace,monospace;letter-spacing:0.3px" : ""}">${value}</div>
    </div>`;
  const grid3 = (cells: string[]) => `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px 24px">${cells.join("")}</div>`;

  return `
<div style="max-width:700px;margin:0 auto;color:#0f172a">
  <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2.5px solid #102a43;padding-bottom:14px">
    <div>
      <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#64748b;font-weight:700">Loan Disbursement</div>
      <div style="font-size:27px;font-weight:800;color:#102a43;letter-spacing:-0.5px;margin-top:2px">Payment Voucher</div>
    </div>
    <div style="border:2px solid #102a43;color:#102a43;font-size:11px;font-weight:800;letter-spacing:2px;padding:7px 16px;border-radius:6px;text-transform:uppercase">Official</div>
  </div>
  <div style="display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:1px;background:#e2e8f0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin:16px 0 2px">
    <div style="background:#fff">${metaCell("Kitabu NO", kitabuNo, true)}</div>
    <div style="background:#fff">${metaCell("Effective Date", fmtDate(disbDate))}</div>
    <div style="background:#fff">${metaCell("Issue Branch", preview?.branch || "—")}</div>
  </div>
  ${sectionTitle("Borrower Information", 1)}
  ${grid3([
    block("Customer Full Name", loan.name || "—"),
    block("Client Identification", preview?.customer_number || "—", { mono: true }),
    block("Loan Product Type", preview?.product_name || "—"),
    block("Relationship Officer", preview?.officer_name || "—"),
  ])}
  ${sectionTitle("Financial Authorization", 2)}
  ${grid3([
    block("Approved Capital", fmt(approvedAmount)),
    block(`Processing Fee (${feePercent}%)`, fmt(processingFee)),
    block("Insurance (Credit Life)", fmt(insuranceFee)),
    block("Facility Charges", fmt(otherCharges)),
    block("Total Statutory Deductions", "— " + fmt(totalCharges), { color: "#b91c1c" }),
  ])}
  <div style="display:flex;justify-content:space-between;align-items:center;border:1.5px solid #102a43;border-left:6px solid #102a43;border-radius:12px;padding:12px 22px;margin:12px 0">
    <div>
      <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:2px;color:#64748b;font-weight:700">Net Payable Amount</div>
      <div style="font-size:12px;color:#94a3b8;font-weight:600;margin-top:3px">Amount disbursed to the borrower</div>
    </div>
    <div style="font-size:28px;font-weight:900;color:#102a43;letter-spacing:-0.5px">${fmt(netAmount)}</div>
  </div>
  ${sectionTitle("Execution Details", 3)}
  ${grid3([
    block("Disbursement Channel", methodLabel),
    block("Transaction Reference", transactionRef, { mono: true }),
    block("Instruction Narration", narration),
  ])}
  <div style="margin-top:34px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:36px">
    <div style="text-align:center"><div style="height:42px"></div><div style="border-top:1.5px solid #0f172a;padding-top:10px;font-size:10px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1px">Prepared / Cashier</div></div>
    <div style="text-align:center"><div style="height:42px"></div><div style="border-top:1.5px solid #0f172a;padding-top:10px;font-size:10px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1px">Authorized By</div></div>
    <div style="text-align:center"><div style="height:42px;display:flex;align-items:flex-end;justify-content:center">${loan?.details?.mwombajiAmesainiFomuNgumu ? `<span style="font-size:11px;font-weight:900;color:#059669;letter-spacing:0.5px">[ IMEWEKWA ]</span>` : ""}</div><div style="border-top:1.5px solid #0f172a;padding-top:10px;font-size:10px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1px">Received By (Client)</div></div>
  </div>
  <div style="margin-top:24px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px dashed #e2e8f0;padding-top:14px;font-style:italic">Valid only when officially stamped and authorized · Kitabu NO: ${kitabuNo} · Generated ${new Date().toLocaleString("en-GB")}</div>
</div>`;
}

function buildAgreementBody(data: any): string {
  const { loan, preview, disbursement, summary } = data;
  const accountNumber  = loan.loan_account_number || "—";
  const approvedAmount = Number(loan.amount || 0);
  const fmtDate2 = fmtDate;

  return `
<div style="position:relative;max-width:700px;margin:0 auto;border:2px solid #5b21b6;border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,0.05)">
  <div style="background:linear-gradient(135deg,#5b21b6 0%,#7c3aed 100%);padding:40px 48px;color:white;position:relative">
    <div style="position:absolute;top:10px;right:20px;font-size:75px;font-weight:900;opacity:0.1;color:white">CONTRACT</div>
    <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;opacity:0.7;margin-bottom:8px">Financial Service Agreement</div>
    <div style="font-size:28px;font-weight:800;letter-spacing:-0.5px">Loan Facility Agreement</div>
    <div style="margin-top:24px;display:flex;gap:40px">
      <div><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;opacity:0.6">Contract No</div><div style="font-size:14px;font-weight:700;margin-top:4px;font-family:monospace">${accountNumber}</div></div>
      <div><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;opacity:0.6">Primary Borrower</div><div style="font-size:14px;font-weight:700;margin-top:4px">${loan.name || "—"}</div></div>
    </div>
  </div>
  <div style="padding:40px 48px">
    <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#7c3aed;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #f5f3ff">Agreed Facility Terms</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:32px"><tbody>
      <tr><td style="padding:12px 0;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;width:40%">Disbursed Principal</td><td style="padding:12px 0;font-size:13px;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right">${fmt(approvedAmount)}</td></tr>
      <tr><td style="padding:12px 0;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9">Interest Rate (Fix)</td><td style="padding:12px 0;font-size:13px;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right">${summary?.interest_rate || "—"}% / Monthly</td></tr>
      <tr><td style="padding:12px 0;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9">Tenure Period</td><td style="padding:12px 0;font-size:13px;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right">${summary?.term_months || "—"} Months</td></tr>
      <tr><td style="padding:12px 0;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9">Repayment Mode</td><td style="padding:12px 0;font-size:13px;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right">${summary?.frequency || "—"}</td></tr>
      <tr><td style="padding:12px 0;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9">Total Installments</td><td style="padding:12px 0;font-size:13px;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right">${summary?.total_installments || "—"} Units</td></tr>
      <tr style="background:#f5f3ff"><td style="padding:14px 12px;font-size:13px;font-weight:800;color:#5b21b6;border-radius:10px 0 0 10px">Scheduled Installment</td><td style="padding:14px 12px;font-size:16px;font-weight:900;color:#5b21b6;text-align:right;border-radius:0 10px 10px 0">${fmt(summary?.installment_amount)}</td></tr>
    </tbody></table>
    <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#059669;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #f0fdf4">Critical Timeline</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px">
      <div style="background:#f0fdf4;padding:24px;border-radius:16px;border:1px solid #bbf7d0"><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:700">Commencement Date</div><div style="font-size:18px;font-weight:900;color:#059669;margin-top:8px">${fmtDate2(summary?.first_payment_date)}</div></div>
      <div style="background:#fff1f2;padding:24px;border-radius:16px;border:1px solid #fecaca"><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:700">Maturity Date</div><div style="font-size:18px;font-weight:900;color:#e11d48;margin-top:8px">${fmtDate2(summary?.final_payment_date)}</div></div>
    </div>
    <div style="margin-top:70px;display:grid;grid-template-columns:1fr 1fr;gap:60px">
      <div style="text-align:center"><div style="height:46px;display:flex;align-items:flex-end;justify-content:center">${loan?.details?.mwombajiAmesainiFomuNgumu ? `<span style="font-size:12px;font-weight:900;color:#059669;">[ IMEWEKWA ]</span>` : ""}</div><div style="border-top:2px solid #0f172a;padding-top:14px;font-size:10px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1px">Client Signature</div></div>
      <div style="text-align:center"><div style="height:46px"></div><div style="border-top:2px solid #0f172a;padding-top:14px;font-size:10px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1px">Branch Manager</div></div>
    </div>
    <div style="margin-top:40px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px dashed #e2e8f0;padding-top:20px;font-style:italic">This agreement is legally binding. Reference: ${accountNumber} Generated on ${new Date().toLocaleString("en-GB")}</div>
  </div>
</div>`;
}

/**
 * Fetch disbursement preview for a loan and open a print window.
 * Works for both the cashier at disbursement time and MD/GM viewing later.
 */
export async function printDisbursementDoc(loanId: number | string, type: "voucher" | "agreement") {
  try {
    const token = localStorage.getItem("token");
    const res = await axios.get(`${API_BASE}/loans/${loanId}/disbursement-preview`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const preview = res.data;
    const loan = preview.loan;
    const disbursement = loan?.disbursement;
    const summary = preview.repayment_summary;
    const data = { loan, preview, disbursement, summary };

    if (type === "voucher") {
      openPrint("Payment Voucher", buildVoucherBody(data));
    } else {
      openPrint("Loan Facility Agreement", buildAgreementBody(data));
    }
  } catch {
    alert("Failed to load disbursement data for printing.");
  }
}
