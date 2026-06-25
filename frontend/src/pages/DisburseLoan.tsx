import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { User, Building2, CreditCard, Calendar, Calculator, Banknote, FileText, Check, ShieldCheck, ArrowLeft, TrendingUp } from "lucide-react";
import axios from "axios";
import AlertModal from "../components/AlertModal";
import { letterheadBlock, watermarkBlock, triggerPrint } from "../utils/printDoc";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
const PAYMENT_METHODS = [{ value: "cash", label: "Cash" }, { value: "bank_transfer", label: "Bank Transfer" }, { value: "mpesa", label: "M-Pesa" }, { value: "airtel_money", label: "Airtel Money" }, { value: "tigo_pesa", label: "Tigo Pesa" }, { value: "halopesa", label: "HaloPesa" }, { value: "cheque", label: "Cheque" }];
const MOBILE_METHODS = ["mpesa", "airtel_money", "tigo_pesa", "halopesa"];
const fmt = (n: any) => "TZS " + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
const buildAccountNumber = (loan: any, dateStr: string) => {
    if (!loan) return "—";
    if (loan.loan_account_number) return loan.loan_account_number;
    const [y, m, d] = (dateStr || "").split("-");
    if (!y || !m || !d) return "—";
    const seq = String(loan.id).padStart(5, "0");
    const type = String(loan.type || "").toLowerCase();
    const umeajiriwa = loan.details?.umeajiriwa;
    let prefix = "BSN";
    if (type === "group") prefix = "GRP";
    else if (type === "employee" || umeajiriwa === "Ndio") prefix = "EMPL";
    return `${prefix}-ZKM-${d}-${m}-${y}-${seq}`.toUpperCase();
};
const CHECKLIST = [{ key: "identity_verified", label: "Customer Identity Verified" }, { key: "agreement_signed", label: "Loan Agreement Signed" }, { key: "guarantor_signed", label: "Guarantor Signed" }, { key: "charges_confirmed", label: "Charges Confirmed" }, { key: "customer_present", label: "Customer Present" }, { key: "payment_verified", label: "Payment Details Verified" }];

const DisburseLoan = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [preview, setPreview] = useState<any>(null);
    const [alert, setAlert] = useState({ isOpen: false, title: "", message: "", type: "info" as any });
    const [processingFee, setProcessingFee] = useState("0");
    const [insuranceFee, setInsuranceFee] = useState("0");
    const [otherCharges, setOtherCharges] = useState("0");
    const [capturedProcessingFeePercent, setCapturedProcessingFeePercent] = useState("0");
    const [method, setMethod] = useState("cash");
    const [payDetails, setPayDetails] = useState<Record<string, string>>({});
    const [transactionRef, setTransactionRef] = useState("");
    const [disbursementDate, setDisbursementDate] = useState(new Date().toISOString().slice(0, 10));
    const [narration, setNarration] = useState("");
    const [checks, setChecks] = useState<Record<string, boolean>>({});
    const [confirm, setConfirm] = useState(false);
    const [password, setPassword] = useState("");

    useEffect(() => { fetchPreview(); }, [id]);

    const fetchPreview = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/loans/${id}/disbursement-preview`);
            setPreview(res.data);
            setNarration(`Loan Disbursement for ${res.data.product_name}`);
            const feePercent = res.data.loan?.details?.adaYaUchakataji || "0";
            setCapturedProcessingFeePercent(feePercent);
            const loanAmount = Number(res.data.loan?.amount || 0);
            const calculatedFee = Math.round((loanAmount * Number(feePercent)) / 100);
            setProcessingFee(calculatedFee.toString());
        } catch (err: any) {
            setAlert({ isOpen: true, title: "Error", message: err?.response?.data?.message || "Failed to load loan", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const loan = preview?.loan;
    const summary = preview?.repayment_summary;
    const alreadyDisbursed = preview?.already_disbursed;
    const accountNumber = buildAccountNumber(loan, disbursementDate);
    const approvedAmount = Number(loan?.amount || 0);
    const totalCharges = Number(processingFee || 0) + Number(insuranceFee || 0) + Number(otherCharges || 0);
    const netAmount = approvedAmount - totalCharges;
    const allChecked = CHECKLIST.every((c) => checks[c.key]);
    const canDisburse = !alreadyDisbursed && allChecked && confirm && password.trim().length > 0 && netAmount >= 0 && !submitting;
    const setDetail = (k: string, v: string) => setPayDetails((p) => ({ ...p, [k]: v }));

    const handleDisburse = async () => {
        if (!canDisburse) return;
        setSubmitting(true);
        try {
            await axios.post(`${API_BASE}/loans/${id}/disburse`, {
                disbursement_date: disbursementDate,
                amount: approvedAmount,
                processing_fee: Number(processingFee || 0),
                insurance_fee: Number(insuranceFee || 0),
                other_charges: Number(otherCharges || 0),
                method,
                transaction_reference: transactionRef || null,
                payment_details: method === "cash" ? { cashier: payDetails.cashier || "", cash_drawer: payDetails.cash_drawer || "" } : payDetails,
                narration,
                branch: preview?.branch || null,
                verification: { ...checks },
                confirm: true,
                password,
            });
            setAlert({ isOpen: true, title: "Disbursement Successful", message: `The loan for ${loan.name} has been successfully disbursed and activated.`, type: "success" });
        } catch (err: any) {
            setAlert({ isOpen: true, title: "Error", message: err?.response?.data?.message || "Disbursement failed", type: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    const methodLabel = PAYMENT_METHODS.find((m) => m.value === method)?.label || method;

    const buildVoucherBody = () => {
        const metaCell = (label, value, mono = false) => `
          <div style="padding:14px 18px">
            <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;font-weight:700">${label}</div>
            <div style="font-size:13px;font-weight:800;color:#0f172a;margin-top:5px;${mono ? "font-family:ui-monospace,monospace;letter-spacing:0.5px" : ""}">${value}</div>
          </div>`;
        const sectionTitle = (t, n) => `
          <div style="display:flex;align-items:center;gap:11px;margin:13px 0 7px">
            <span style="width:27px;height:27px;border-radius:8px;background:linear-gradient(135deg,#102a43,#1d3a5f);color:#fff;font-size:12px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(16,42,67,0.25)">${n}</span>
            <span style="font-size:15px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#102a43">${t}</span>
            <span style="flex:1;height:3px;border-radius:3px;background:linear-gradient(90deg,#7cb342 0%,#1d8ad1 45%,rgba(29,138,209,0) 100%)"></span>
          </div>`;
        const kv = (k, v, mono = false) => `<tr><td style="padding:11px 0;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;width:46%">${k}</td><td style="padding:11px 0;font-size:13px;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;${mono ? "font-family:ui-monospace,monospace" : ""}">${v}</td></tr>`;
        // Clean stacked label/value for the 3-column layout (no card box)
        const block = (label, value, opts = {}) => `
          <div style="padding:5px 0;border-bottom:1px solid #f1f5f9">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:700">${label}</div>
            <div style="font-size:12.5px;font-weight:700;color:${opts.color || "#0f172a"};margin-top:2px;${opts.mono ? "font-family:ui-monospace,monospace;letter-spacing:0.3px" : ""}">${value}</div>
          </div>`;
        const grid3 = (cells) => `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px 24px">${cells.join("")}</div>`;
        return `
<div style="max-width:700px;margin:0 auto;color:#0f172a">
  <!-- Title row -->
  <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2.5px solid #102a43;padding-bottom:14px">
    <div>
      <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#64748b;font-weight:700">Loan Disbursement</div>
      <div style="font-size:27px;font-weight:800;color:#102a43;letter-spacing:-0.5px;margin-top:2px">Payment Voucher</div>
    </div>
    <div style="border:2px solid #102a43;color:#102a43;font-size:11px;font-weight:800;letter-spacing:2px;padding:7px 16px;border-radius:6px;text-transform:uppercase">Official</div>
  </div>

  <!-- Meta strip (no colored background) -->
  <div style="display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:1px;background:#e2e8f0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin:16px 0 2px">
    <div style="background:#fff">${metaCell("Reference No", accountNumber, true)}</div>
    <div style="background:#fff">${metaCell("Effective Date", fmtDate(disbursementDate))}</div>
    <div style="background:#fff">${metaCell("Issue Branch", preview.branch)}</div>
  </div>

  ${sectionTitle("Borrower Information", 1)}
  ${grid3([
            block("Customer Full Name", loan.name),
            block("Client Identification", preview.customer_number, { mono: true }),
            block("Loan Product Type", preview.product_name),
            block("Relationship Officer", preview.officer_name),
        ])}

  ${sectionTitle("Financial Authorization", 2)}
  ${grid3([
            block("Approved Capital", fmt(approvedAmount)),
            block(`Processing Fee (${capturedProcessingFeePercent}%)`, fmt(processingFee)),
            block("Insurance (Credit Life)", fmt(insuranceFee)),
            block("Facility Charges", fmt(otherCharges)),
            block("Total Statutory Deductions", "– " + fmt(totalCharges), { color: "#b91c1c" }),
        ])}

  <!-- Net payable: clean bordered highlight (no blue/gradient) -->
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
            transactionRef ? block("Transaction Reference", transactionRef, { mono: true }) : block("Transaction Reference", "—"),
            block("Instruction Narration", narration),
        ])}

  <!-- Signatures -->
  <div style="margin-top:34px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:36px">
    <div style="text-align:center"><div style="border-top:1.5px solid #0f172a;padding-top:10px;font-size:10px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1px">Prepared / Cashier</div></div>
    <div style="text-align:center"><div style="border-top:1.5px solid #0f172a;padding-top:10px;font-size:10px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1px">Authorized By</div></div>
    <div style="text-align:center"><div style="border-top:1.5px solid #0f172a;padding-top:10px;font-size:10px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1px">Received By (Client)</div></div>
  </div>

  <div style="margin-top:24px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px dashed #e2e8f0;padding-top:14px;font-style:italic">Valid only when officially stamped and authorized · REF: ${accountNumber} · Generated ${new Date().toLocaleString("en-GB")}</div>
</div>`;
    };

    const buildAgreementBody = () => `
<div style="position:relative;max-width:700px;margin:0 auto;border:2px solid #5b21b6;border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,0.05)">
  <div style="background:linear-gradient(135deg,#5b21b6 0%,#7c3aed 100%);padding:40px 48px;color:white;position:relative">
    <div style="position:absolute;top:10px;right:20px;font-size:75px;font-weight:900;opacity:0.1;color:white">CONTRACT</div>
    <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;opacity:0.7;margin-bottom:8px">Financial Service Agreement</div>
    <div style="font-size:28px;font-weight:800;letter-spacing:-0.5px">Loan Facility Agreement</div>
    <div style="margin-top:24px;display:flex;gap:40px">
      <div><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;opacity:0.6">Contract No</div><div style="font-size:14px;font-weight:700;margin-top:4px;font-family:monospace">${accountNumber}</div></div>
      <div><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;opacity:0.6">Primary Borrower</div><div style="font-size:14px;font-weight:700;margin-top:4px">${loan.name}</div></div>
    </div>
  </div>
  <div style="padding:40px 48px">
    <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#7c3aed;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #f5f3ff">Agreed Facility Terms</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:32px"><tbody>
      <tr><td style="padding:12px 0;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;width:40%">Disbursed Principal</td><td style="padding:12px 0;font-size:13px;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right">${fmt(approvedAmount)}</td></tr>
      <tr><td style="padding:12px 0;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9">Interest Rate (Fix)</td><td style="padding:12px 0;font-size:13px;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right">${summary?.interest_rate}% / Monthly</td></tr>
      <tr><td style="padding:12px 0;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9">Tenure Period</td><td style="padding:12px 0;font-size:13px;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right">${summary?.term_months} Months</td></tr>
      <tr><td style="padding:12px 0;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9">Repayment Mode</td><td style="padding:12px 0;font-size:13px;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right">${summary?.frequency}</td></tr>
      <tr><td style="padding:12px 0;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9">Total Installments</td><td style="padding:12px 0;font-size:13px;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right">${summary?.total_installments} Units</td></tr>
      <tr style="background:#f5f3ff"><td style="padding:14px 12px;font-size:13px;font-weight:800;color:#5b21b6;border-radius:10px 0 0 10px">Scheduled Installment</td><td style="padding:14px 12px;font-size:16px;font-weight:900;color:#5b21b6;text-align:right;border-radius:0 10px 10px 0">${fmt(summary?.installment_amount)}</td></tr>
    </tbody></table>
    <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#059669;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #f0fdf4">Critical Timeline</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px">
      <div style="background:#f0fdf4;padding:24px;border-radius:16px;border:1px solid #bbf7d0;box-shadow:0 4px 12px rgba(5,150,105,0.05)"><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:700">Commencement Date</div><div style="font-size:18px;font-weight:900;color:#059669;margin-top:8px">${fmtDate(summary?.first_payment_date)}</div></div>
      <div style="background:#fff1f2;padding:24px;border-radius:16px;border:1px solid #fecaca;box-shadow:0 4px 12px rgba(225,29,72,0.05)"><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:700">Maturity Date</div><div style="font-size:18px;font-weight:900;color:#e11d48;margin-top:8px">${fmtDate(summary?.final_payment_date)}</div></div>
    </div>
    <div style="margin-top:80px;display:grid;grid-template-columns:1fr 1fr;gap:60px">
      <div style="text-align:center"><div style="border-top:2px solid #0f172a;padding-top:16px;font-size:10px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1px">Client Signature</div></div>
      <div style="text-align:center"><div style="border-top:2px solid #0f172a;padding-top:16px;font-size:10px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1px">Branch Manager</div></div>
    </div>
    <div style="margin-top:40px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px dashed #e2e8f0;padding-top:20px;font-style:italic">This agreement is legally binding. Reference: ${accountNumber} Generated on ${new Date().toLocaleString("en-GB")}</div>
  </div>
</div>`;

    const printDoc = (title: string, body: string) => {
        const win = window.open("", "_blank", "width=850,height=1000");
        if (!win) return;
        win.document.write(`<html><head><title>${title}</title><style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;padding:32px 40px;color:#0f172a;background:#f8fafc;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}@media print{body{padding:0;background:#fff}}</style></head><body>${watermarkBlock()}<div style="max-width:700px;margin:0 auto;position:relative;z-index:1">${letterheadBlock()}<div style="height:12px"></div>${body}</div></body></html>`);
        win.document.close();
        triggerPrint(win);
    };

    if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f7fa", fontSize: "16px", color: "#4a5568" }}>Loading...</div>;
    if (!loan) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f7fa" }}>Record not found</div>;

    return (
        <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "40px 20px", fontFamily: "'Inter', sans-serif" }}>
            <AlertModal isOpen={alert.isOpen} title={alert.title} message={alert.message} type={alert.type} onClose={() => { if (alert.type === "success") navigate("/finance/customers"); setAlert({ ...alert, isOpen: false }); }} />

            <div style={{ maxWidth: "1100px", margin: "0 auto", background: "white", borderRadius: "16px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)", overflow: "hidden", border: "1px solid #f1f5f9" }}>
                {/* HEADER */}
                <div style={{ display: "flex", alignItems: "center", gap: "20px", padding: "24px 40px", borderBottom: "4px solid #3b82f6", background: "#ffffff" }}>
                    <button onClick={() => navigate(-1)} style={{ background: "#f1f5f9", border: "none", borderRadius: "10px", width: "40px", height: "40px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                        <ArrowLeft size={20} />
                    </button>
                    <h1 style={{ fontSize: "24px", fontWeight: 800, margin: 0, color: "#0f172a", letterSpacing: "-0.5px" }}>Loan Disbursement</h1>
                    <div style={{ marginLeft: "auto", background: "#f0fdf4", color: "#059669", padding: "8px 20px", borderRadius: "100px", fontSize: "13px", fontWeight: "bold", border: "1px solid #10b98120" }}>
                        REF: {accountNumber}
                    </div>
                </div>

                <div style={{ padding: "40px" }}>
                    {/* SECTION 1: MASTER INFO */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "40px" }}>
                        <div>
                            <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: 800, color: "#3b82f6", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 20px 0", paddingBottom: "12px", borderBottom: "1px solid #e0e7ff" }}>
                                <User size={18} /> Borrower Information
                            </h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px dashed #cbd5e1" }}><span style={{ fontSize: "13px", color: "#64748b" }}>Name:</span><span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{loan.name}</span></div>
                                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px dashed #cbd5e1" }}><span style={{ fontSize: "13px", color: "#64748b" }}>Customer ID:</span><span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{preview.customer_number}</span></div>
                                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px dashed #cbd5e1" }}><span style={{ fontSize: "13px", color: "#64748b" }}>Account:</span><span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", fontFamily: "monospace", letterSpacing: "1px" }}>{accountNumber}</span></div>
                                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px dashed #cbd5e1" }}><span style={{ fontSize: "13px", color: "#64748b" }}>Branch:</span><span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{preview.branch}</span></div>
                                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: "13px", color: "#64748b" }}>Status:</span><span style={{ fontSize: "12px", fontWeight: 700, color: alreadyDisbursed ? "#b91c1c" : "#059669" }}>{alreadyDisbursed ? "Disbursed" : "Ready"}</span></div>
                            </div>
                        </div>

                        <div>
                            <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: 800, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 20px 0", paddingBottom: "12px", borderBottom: "1px solid #ede9fe" }}>
                                <TrendingUp size={18} /> Product Terms
                            </h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px dashed #cbd5e1" }}><span style={{ fontSize: "13px", color: "#64748b" }}>Product:</span><span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{preview.product_name}</span></div>
                                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px dashed #cbd5e1" }}><span style={{ fontSize: "13px", color: "#64748b" }}>Amount:</span><span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{fmt(approvedAmount)}</span></div>
                                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px dashed #cbd5e1" }}><span style={{ fontSize: "13px", color: "#64748b" }}>Interest Rate:</span><span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{summary?.interest_rate}% / mo</span></div>
                                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px dashed #cbd5e1" }}><span style={{ fontSize: "13px", color: "#64748b" }}>Duration:</span><span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{summary?.term_months} Months</span></div>
                            </div>
                        </div>

                        <div>
                            <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: 800, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 20px 0", paddingBottom: "12px", borderBottom: "1px solid #fef3c7" }}>
                                <Banknote size={18} /> Schedule
                            </h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px dashed #cbd5e1" }}><span style={{ fontSize: "13px", color: "#64748b" }}>Frequency:</span><span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{summary?.frequency}</span></div>
                                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px dashed #cbd5e1" }}><span style={{ fontSize: "13px", color: "#64748b" }}>Installment:</span><span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{fmt(summary?.installment_amount)} <span style={{ color: "#94a3b8", fontWeight: 500 }}>({summary?.total_installments}x)</span></span></div>
                                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px dashed #cbd5e1" }}><span style={{ fontSize: "13px", color: "#64748b" }}>First Date:</span><span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{fmtDate(summary?.first_payment_date)}</span></div>
                                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px dashed #cbd5e1" }}><span style={{ fontSize: "13px", color: "#64748b" }}>Maturity:</span><span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{fmtDate(summary?.final_payment_date)}</span></div>
                            </div>
                        </div>
                    </div>

                    <hr style={{ border: "none", borderTop: "2px solid #f1f5f9", margin: "40px 0" }} />

                    {/* LOWER SECTIONS: 3-COLUMN GRID */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "30px" }}>

                        {/* COLUMN 1: FINANCIAL EXECUTION */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                            <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: 800, color: "#10b981", textTransform: "uppercase", letterSpacing: "1px", margin: 0, paddingBottom: "12px", borderBottom: "1px solid #d1fae5" }}>
                                <Calculator size={18} /> Financial Execution
                            </h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "16px", borderBottom: "1px dashed #cbd5e1" }}>
                                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#475569" }}>Approved Amount</span>
                                    <span style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>{fmt(approvedAmount)}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "12px", borderBottom: "1px dashed #cbd5e1" }}>
                                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#475569" }}>Processing Fee <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 500 }}>({capturedProcessingFeePercent}%)</span></span>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 700 }}>TZS</span>
                                        <input type="number" value={processingFee} onChange={e => setProcessingFee(e.target.value)} style={{ width: "90px", padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: "8px", textAlign: "right", fontSize: "13px", outline: "none" }} onFocus={(e) => e.target.style.borderColor = "#3b82f6"} onBlur={(e) => e.target.style.borderColor = "#e2e8f0"} />
                                    </div>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "12px", borderBottom: "1px dashed #cbd5e1" }}>
                                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#475569" }}>Insurance Fee</span>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 700 }}>TZS</span>
                                        <input type="number" value={insuranceFee} onChange={e => setInsuranceFee(e.target.value)} style={{ width: "90px", padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: "8px", textAlign: "right", fontSize: "13px", outline: "none" }} onFocus={(e) => e.target.style.borderColor = "#3b82f6"} onBlur={(e) => e.target.style.borderColor = "#e2e8f0"} />
                                    </div>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "12px", borderBottom: "1px dashed #cbd5e1" }}>
                                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#475569" }}>Other Charges</span>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 700 }}>TZS</span>
                                        <input type="number" value={otherCharges} onChange={e => setOtherCharges(e.target.value)} style={{ width: "90px", padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: "8px", textAlign: "right", fontSize: "13px", outline: "none" }} onFocus={(e) => e.target.style.borderColor = "#3b82f6"} onBlur={(e) => e.target.style.borderColor = "#e2e8f0"} />
                                    </div>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "12px", borderBottom: "1px dashed #cbd5e1" }}>
                                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#e11d48" }}>Sum of Deductions</span>
                                    <span style={{ fontSize: "14px", fontWeight: 800, color: "#e11d48" }}>{fmt(totalCharges)}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "16px", borderBottom: "2px solid #10b981" }}>
                                    <span style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.5px" }}>Net Payout</span>
                                    <span style={{ fontSize: "16px", fontWeight: 900, color: "#10b981" }}>{fmt(netAmount)}</span>
                                </div>
                                <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px dashed #cbd5e1", display: "flex", flexDirection: "column", gap: "16px" }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Disbursement Date</span>
                                        <input type="date" value={disbursementDate} onChange={e => setDisbursementDate(e.target.value)} style={{ padding: "12px 16px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "14px", fontWeight: 600, outline: "none", color: "#0f172a" }} onFocus={(e) => e.target.style.borderColor = "#3b82f6"} onBlur={(e) => e.target.style.borderColor = "#e2e8f0"} />
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Official Narration</span>
                                        <textarea value={narration} onChange={e => setNarration(e.target.value)} rows={2} style={{ padding: "12px 16px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "13px", resize: "none", outline: "none", color: "#0f172a", fontFamily: "inherit" }} onFocus={(e) => e.target.style.borderColor = "#3b82f6"} onBlur={(e) => e.target.style.borderColor = "#e2e8f0"} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* COLUMN 2: PAYOUT & DOCS */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "32px", borderLeft: "1px dashed #e2e8f0", borderRight: "1px dashed #e2e8f0", padding: "0 24px" }}>
                            {/* Payout Method */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                                <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: "1px", margin: 0, paddingBottom: "12px", borderBottom: "1px solid #e2e8f0" }}>
                                    <CreditCard size={18} /> Payout Method
                                </h3>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Selected Channel</span>
                                    <select value={method} onChange={(e) => { setMethod(e.target.value); setPayDetails({}); }} style={{ width: "100%", padding: "12px 16px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "14px", fontWeight: 600, outline: "none", color: "#0f172a" }} onFocus={(e) => e.target.style.borderColor = "#3b82f6"} onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}>
                                        {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                                    </select>
                                </div>
                                {method === "cash" && (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>Cashier Name</span><input type="text" value={payDetails.cashier || ""} onChange={e => setDetail("cashier", e.target.value)} style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "13px" }} /></div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>Cash Drawer</span><input type="text" value={payDetails.cash_drawer || ""} onChange={e => setDetail("cash_drawer", e.target.value)} style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "13px" }} /></div>
                                    </div>
                                )}
                                {(method === "bank_transfer" || method === "cheque") && (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>Institution</span><input type="text" value={payDetails.bank_name || ""} onChange={e => setDetail("bank_name", e.target.value)} style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "13px" }} /></div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>Ref Number</span><input type="text" value={payDetails.account_number || payDetails.cheque_number || ""} onChange={e => setDetail(method === "cheque" ? "cheque_number" : "account_number", e.target.value)} style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "13px" }} /></div>
                                    </div>
                                )}
                                {MOBILE_METHODS.includes(method) && (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>Phone No</span><input type="text" value={payDetails.phone_number || ""} onChange={e => setDetail("phone_number", e.target.value)} style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "13px" }} /></div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>Trace ID</span><input type="text" value={transactionRef} onChange={e => setTransactionRef(e.target.value)} style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "13px" }} /></div>
                                    </div>
                                )}
                            </div>

                            {/* Admin PIN */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                                <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "1px", margin: 0, paddingBottom: "12px", borderBottom: "1px solid #e2e8f0" }}>
                                    <ShieldCheck size={18} /> Admin Authorization
                                </h3>
                                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                        <span style={{ fontSize: "12px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px" }}>Admin PIN / Password</span>
                                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ width: "100%", padding: "14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", color: "#0f172a", fontSize: "16px", letterSpacing: "2px", outline: "none" }} onFocus={(e) => e.target.style.borderColor = "#3b82f6"} onBlur={(e) => e.target.style.borderColor = "#e2e8f0"} />
                                    </div>
                                    <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer", padding: "14px", background: confirm ? "#eff6ff" : "#f8fafc", borderRadius: "8px", border: confirm ? "1px solid #3b82f6" : "1px dashed #cbd5e1" }}>
                                        <input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} style={{ width: "18px", height: "18px", marginTop: "2px", accentColor: "#3b82f6" }} />
                                        <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b", lineHeight: "1.4" }}>I confirm details are correct for net amount of {fmt(netAmount)}.</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* COLUMN 3: AUTHORIZATION */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                            <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "1px", margin: 0, paddingBottom: "12px", borderBottom: "1px solid #e2e8f0" }}>
                                <ShieldCheck size={20} /> Final Authorization
                            </h3>

                            <div>
                                <span style={{ display: "block", fontSize: "12px", fontWeight: 800, color: "#94a3b8", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>Verification Checklist</span>
                                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                    {CHECKLIST.map((c) => (
                                        <label key={c.key} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", background: checks[c.key] ? "#f0fdf4" : "#f8fafc", borderRadius: "8px", cursor: "pointer", border: checks[c.key] ? "1px solid #10b981" : "1px solid #e2e8f0", transition: "all 0.2s" }}>
                                            <input type="checkbox" checked={!!checks[c.key]} onChange={e => setChecks({ ...checks, [c.key]: e.target.checked })} style={{ width: "16px", height: "16px", accentColor: "#10b981" }} />
                                            <span style={{ fontSize: "12px", fontWeight: 600, color: checks[c.key] ? "#065f46" : "#475569" }}>{c.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>


                        </div>
                    </div>

                </div>

                {/* ACTION BUTTONS */}
                <div style={{ background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)", padding: "28px 40px", display: "flex", gap: "16px", justifyContent: "space-between", alignItems: "center", borderTop: "2px solid #e2e8f0" }}>
                    <div style={{ display: "flex", gap: "14px" }}>
                        <button onClick={() => printDoc("Voucher", buildVoucherBody())}
                            style={{ padding: "14px 28px", border: "1px solid #c7d2fe", borderRadius: "12px", fontSize: "13px", fontWeight: 700, cursor: "pointer", background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)", color: "#4338ca", display: "flex", alignItems: "center", gap: "10px", transition: "all 0.3s ease", boxShadow: "0 2px 8px rgba(99,102,241,0.1)" }}
                            onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(99,102,241,0.25)"; e.currentTarget.style.background = "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)"; }}
                            onMouseOut={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(99,102,241,0.1)"; e.currentTarget.style.background = "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)"; }}>
                            <FileText size={16} /> Voucher
                        </button>
                        <button onClick={() => printDoc("Agreement", buildAgreementBody())}
                            style={{ padding: "14px 28px", border: "1px solid #bbf7d0", borderRadius: "12px", fontSize: "13px", fontWeight: 700, cursor: "pointer", background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)", color: "#15803d", display: "flex", alignItems: "center", gap: "10px", transition: "all 0.3s ease", boxShadow: "0 2px 8px rgba(34,197,94,0.1)" }}
                            onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(34,197,94,0.25)"; e.currentTarget.style.background = "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)"; }}
                            onMouseOut={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(34,197,94,0.1)"; e.currentTarget.style.background = "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)"; }}>
                            <FileText size={16} /> Agreement
                        </button>
                    </div>
                    <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                        <button onClick={() => navigate(-1)}
                            style={{ padding: "14px 28px", border: "1px solid #e2e8f0", borderRadius: "12px", fontSize: "13px", fontWeight: 700, cursor: "pointer", background: "white", color: "#64748b", transition: "all 0.3s ease" }}
                            onMouseOver={(e) => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.color = "#dc2626"; e.currentTarget.style.borderColor = "#fecaca"; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = "#64748b"; e.currentTarget.style.borderColor = "#e2e8f0"; }}>
                            Discard
                        </button>
                        <button onClick={handleDisburse} disabled={!canDisburse || submitting}
                            style={{ padding: "14px 36px", border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", cursor: canDisburse ? "pointer" : "not-allowed", background: canDisburse ? "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)" : "#cbd5e1", color: canDisburse ? "white" : "#94a3b8", transition: "all 0.3s ease", boxShadow: canDisburse ? "0 6px 20px rgba(59, 130, 246, 0.4)" : "none", display: "flex", alignItems: "center", gap: "10px" }}
                            onMouseOver={(e) => { if (canDisburse) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 10px 30px rgba(59, 130, 246, 0.5)"; e.currentTarget.style.background = "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)"; } }}
                            onMouseOut={(e) => { if (canDisburse) { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(59, 130, 246, 0.4)"; e.currentTarget.style.background = "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"; } }}>
                            {submitting ? "Processing..." : "💰 Disburse Funds"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DisburseLoan;
