import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { User, Building2, CreditCard, Calendar, Calculator, Banknote, FileText, Check, ShieldCheck, ArrowLeft, TrendingUp } from "lucide-react";
import axios from "axios";
import AlertModal from "../components/AlertModal";

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

    const buildVoucherBody = () => `<h2>Borrower Information</h2><table><tr><td>Customer Name</td><td>${loan.name}</td></tr><tr><td>Customer Number</td><td>${preview.customer_number}</td></tr><tr><td>Loan Account Number</td><td>${accountNumber}</td></tr><tr><td>Loan Product</td><td>${preview.product_name}</td></tr><tr><td>Loan Officer</td><td>${preview.officer_name}</td></tr><tr><td>Branch</td><td>${preview.branch}</td></tr></table><h2>Loan Charges</h2><table><tr><td>Approved Loan Amount</td><td>${fmt(approvedAmount)}</td></tr><tr><td>Processing Fee</td><td>${fmt(processingFee)}</td></tr><tr><td>Insurance Fee</td><td>${fmt(insuranceFee)}</td></tr><tr><td>Other Charges</td><td>${fmt(otherCharges)}</td></tr><tr><td>Total Charges</td><td>${fmt(totalCharges)}</td></tr></table><div class="net-box"><span>Net Disbursement</span><div>${fmt(netAmount)}</div></div><h2>Payment Information</h2><table><tr><td>Payment Method</td><td>${methodLabel}</td></tr>${transactionRef ? `<tr><td>Transaction Reference</td><td>${transactionRef}</td></tr>` : ""}<tr><td>Disbursement Date</td><td>${fmtDate(disbursementDate)}</td></tr><tr><td>Narration</td><td>${narration}</td></tr></table>`;

    const buildAgreementBody = () => `<h2>Loan Agreement Summary</h2><table><tr><td>Customer Name</td><td>${loan.name}</td></tr><tr><td>Loan Account Number</td><td>${accountNumber}</td></tr><tr><td>Approved Amount</td><td>${fmt(approvedAmount)}</td></tr><tr><td>Interest Rate</td><td>${summary?.interest_rate}% / monthly</td></tr><tr><td>Loan Period</td><td>${summary?.term_months} Months</td></tr><tr><td>Repayment Frequency</td><td>${summary?.frequency}</td></tr><tr><td>Number of Installments</td><td>${summary?.total_installments}</td></tr><tr><td>Monthly Installment</td><td>${fmt(summary?.installment_amount)}</td></tr><tr><td>First Payment Date</td><td>${fmtDate(summary?.first_payment_date)}</td></tr><tr><td>Final Payment Date</td><td>${fmtDate(summary?.final_payment_date)}</td></tr></table><div class="sign-grid"><div class="sign-box">Customer Signature</div><div class="sign-box">Loan Officer Signature</div></div>`;

    const printDoc = (title: string, body: string) => {
        const win = window.open("", "_blank", "width=800,height=1000");
        if (!win) return;
        win.document.write(`<html><head><title>${title}</title><style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');body{font-family:'Inter', sans-serif;padding:60px;color:#0f172a;background:#fff; line-height:1.5}h1{font-size:28px;font-weight:800;margin:0}h2{font-size:14px;text-transform:uppercase;letter-spacing:0.05em;color:#1e3a8a;margin:40px 0 16px;background:#f8fafc;padding:8px 12px;border-radius:8px}table{width:100%;border-collapse:collapse;margin-bottom:16px}td{padding:14px 12px;font-size:14px;border-bottom:1px solid #f1f5f9}td:first-child{color:#64748b;font-weight:500;width:40%} td:last-child{text-align:right;font-weight:700;color:#0f172a}.net-box{background:#0f172a;padding:24px;border-radius:16px;display:flex;justify-content:space-between;margin:32px 0;color:white;font-weight:800}.sign-grid{margin-top:100px;display:grid;grid-template-columns:1fr 1fr;gap:60px}.sign-box{border-top:1px solid #0f172a;padding-top:12px;font-size:13px;text-align:center}</style></head><body>${body}</body></html>`);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 500);
    };

    if (loading) return <div style={{minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f7fa", fontSize: "16px", color: "#4a5568"}}>Loading...</div>;
    if (!loan) return <div style={{minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f7fa"}}>Record not found</div>;

    return (
        <div style={{minHeight: "100vh", background: "linear-gradient(135deg, #f5f7fa 0%, #e9ecef 100%)", padding: "30px 20px", fontFamily: "'Segoe UI', sans-serif"}}>
            <AlertModal isOpen={alert.isOpen} title={alert.title} message={alert.message} type={alert.type} onClose={() => { if (alert.type === "success") navigate("/finance/customers"); setAlert({ ...alert, isOpen: false }); }} />

            <div style={{maxWidth: "1400px", margin: "0 auto"}}>
                <div style={{display: "flex", alignItems: "center", gap: "20px", marginBottom: "30px"}}>
                    <button onClick={() => navigate(-1)} style={{background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px"}}>
                        <ArrowLeft size={18} /> Back
                    </button>
                    <h1 style={{fontSize: "32px", fontWeight: 700, margin: 0, color: "#1a202c"}}>Loan Disbursement</h1>
                </div>

                {/* ROW 1: 3 COLUMNS */}
                <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", marginBottom: "20px"}}>
                    {/* BORROWER INFORMATION */}
                    <div style={{background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)"}}>
                        <h3 style={{display: "flex", alignItems: "center", gap: "12px", fontSize: "16px", fontWeight: 700, color: "#2d3748", margin: "0 0 16px 0", paddingBottom: "16px", borderBottom: "2px solid #f0f4f8"}}>
                            <User size={18} /> Borrower Information
                        </h3>
                        <div style={{display: "flex", justifyContent: "space-between", gap: "16px", paddingBottom: "12px", borderBottom: "1px solid #f0f4f8"}}><span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Customer Name:</span><span style={{fontSize: "14px", fontWeight: 600, color: "#2d3748"}}>{loan.name}</span></div>
                        <div style={{display: "flex", justifyContent: "space-between", gap: "16px", paddingBottom: "12px", paddingTop: "12px", borderBottom: "1px solid #f0f4f8"}}><span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Customer Number:</span><span style={{fontSize: "14px", fontWeight: 600, color: "#2d3748"}}>{preview.customer_number}</span></div>
                        <div style={{display: "flex", justifyContent: "space-between", gap: "16px", paddingBottom: "12px", paddingTop: "12px", borderBottom: "1px solid #f0f4f8"}}><span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Loan Account Number:</span><span style={{fontSize: "12px", fontWeight: 600, color: "#1a202c", fontFamily: "monospace", background: "#f7fafc", padding: "4px 8px", borderRadius: "4px"}}>{accountNumber}</span></div>
                        <div style={{display: "flex", justifyContent: "space-between", gap: "16px", paddingBottom: "12px", paddingTop: "12px", borderBottom: "1px solid #f0f4f8"}}><span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Loan Product:</span><span style={{fontSize: "14px", fontWeight: 600, color: "#2d3748"}}>{preview.product_name}</span></div>
                        <div style={{display: "flex", justifyContent: "space-between", gap: "16px", paddingBottom: "12px", paddingTop: "12px", borderBottom: "1px solid #f0f4f8"}}><span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Loan Officer:</span><span style={{fontSize: "14px", fontWeight: 600, color: "#2d3748"}}>{preview.officer_name}</span></div>
                        <div style={{display: "flex", justifyContent: "space-between", gap: "16px", paddingBottom: "12px", paddingTop: "12px", borderBottom: "1px solid #f0f4f8"}}><span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Branch:</span><span style={{fontSize: "14px", fontWeight: 600, color: "#2d3748"}}>{preview.branch}</span></div>
                        <div style={{display: "flex", justifyContent: "space-between", gap: "16px", paddingTop: "12px"}}><span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Loan Status:</span><span style={{fontSize: "12px", fontWeight: 600, background: "#e6fffa", color: "#0f766e", padding: "4px 12px", borderRadius: "20px"}}>{alreadyDisbursed ? "Disbursed" : "Ready for Disbursement"}</span></div>
                    </div>

                    {/* LOAN DETAILS */}
                    <div style={{background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)"}}>
                        <h3 style={{display: "flex", alignItems: "center", gap: "12px", fontSize: "16px", fontWeight: 700, color: "#2d3748", margin: "0 0 16px 0", paddingBottom: "16px", borderBottom: "2px solid #f0f4f8"}}>
                            <TrendingUp size={18} /> Loan Details
                        </h3>
                        <div style={{display: "flex", justifyContent: "space-between", gap: "16px", paddingBottom: "12px", borderBottom: "1px solid #f0f4f8"}}><span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Approved Amount:</span><span style={{fontSize: "14px", fontWeight: 600, color: "#2d3748"}}>{fmt(approvedAmount)}</span></div>
                        <div style={{display: "flex", justifyContent: "space-between", gap: "16px", paddingBottom: "12px", paddingTop: "12px", borderBottom: "1px solid #f0f4f8"}}><span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Interest Rate:</span><span style={{fontSize: "14px", fontWeight: 600, color: "#2d3748"}}>{summary?.interest_rate}% / monthly</span></div>
                        <div style={{display: "flex", justifyContent: "space-between", gap: "16px", paddingBottom: "12px", paddingTop: "12px", borderBottom: "1px solid #f0f4f8"}}><span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Loan Period:</span><span style={{fontSize: "14px", fontWeight: 600, color: "#2d3748"}}>{summary?.term_months} Months</span></div>
                        <div style={{display: "flex", justifyContent: "space-between", gap: "16px", paddingBottom: "12px", paddingTop: "12px", borderBottom: "1px solid #f0f4f8"}}><span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Repayment Frequency:</span><span style={{fontSize: "14px", fontWeight: 600, color: "#2d3748"}}>{summary?.frequency}</span></div>
                        <div style={{display: "flex", justifyContent: "space-between", gap: "16px", paddingBottom: "12px", paddingTop: "12px", borderBottom: "1px solid #f0f4f8"}}><span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Number of Installments:</span><span style={{fontSize: "14px", fontWeight: 600, color: "#2d3748"}}>{summary?.total_installments}</span></div>
                        <div style={{display: "flex", justifyContent: "space-between", gap: "16px", paddingBottom: "12px", paddingTop: "12px", borderBottom: "1px solid #f0f4f8"}}><span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>First Installment Date:</span><span style={{fontSize: "14px", fontWeight: 600, color: "#2d3748"}}>{fmtDate(summary?.first_payment_date)}</span></div>
                        <div style={{display: "flex", justifyContent: "space-between", gap: "16px", paddingTop: "12px"}}><span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Maturity Date:</span><span style={{fontSize: "14px", fontWeight: 600, color: "#2d3748"}}>{fmtDate(summary?.final_payment_date)}</span></div>
                    </div>

                    {/* PAYMENT INFORMATION */}
                    <div style={{background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)"}}>
                        <h3 style={{display: "flex", alignItems: "center", gap: "12px", fontSize: "16px", fontWeight: 700, color: "#2d3748", margin: "0 0 16px 0", paddingBottom: "16px", borderBottom: "2px solid #f0f4f8"}}>
                            <CreditCard size={18} /> Payment Information
                        </h3>
                        <div style={{display: "flex", flexDirection: "column", gap: "12px", paddingBottom: "12px", borderBottom: "1px solid #f0f4f8"}}>
                            <span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Payment Method</span>
                            <select value={method} onChange={(e) => { setMethod(e.target.value); setPayDetails({}); }} style={{width: "100%", padding: "10px 12px", border: "1px solid #cbd5e0", borderRadius: "6px", fontSize: "13px", fontFamily: "inherit"}}>
                                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                        {method === "cash" && (
                            <>
                                <div style={{display: "flex", flexDirection: "column", gap: "6px", paddingBottom: "12px", paddingTop: "12px", borderBottom: "1px solid #f0f4f8"}}>
                                    <span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Cashier</span>
                                    <input type="text" value={payDetails.cashier || ""} onChange={e => setDetail("cashier", e.target.value)} placeholder="Name" style={{width: "100%", padding: "10px 12px", border: "1px solid #cbd5e0", borderRadius: "6px", fontSize: "13px", fontFamily: "inherit"}} />
                                </div>
                                <div style={{display: "flex", flexDirection: "column", gap: "6px", paddingTop: "12px"}}>
                                    <span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Cash Drawer</span>
                                    <input type="text" value={payDetails.cash_drawer || ""} onChange={e => setDetail("cash_drawer", e.target.value)} placeholder="e.g. D10" style={{width: "100%", padding: "10px 12px", border: "1px solid #cbd5e0", borderRadius: "6px", fontSize: "13px", fontFamily: "inherit"}} />
                                </div>
                            </>
                        )}
                        {(method === "bank_transfer" || method === "cheque") && (
                            <>
                                <div style={{display: "flex", flexDirection: "column", gap: "6px", paddingBottom: "12px", paddingTop: "12px", borderBottom: "1px solid #f0f4f8"}}>
                                    <span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Financial Institution</span>
                                    <input type="text" value={payDetails.bank_name || ""} onChange={e => setDetail("bank_name", e.target.value)} placeholder="Bank name" style={{width: "100%", padding: "10px 12px", border: "1px solid #cbd5e0", borderRadius: "6px", fontSize: "13px", fontFamily: "inherit"}} />
                                </div>
                                <div style={{display: "flex", flexDirection: "column", gap: "6px", paddingTop: "12px"}}>
                                    <span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Account / Cheque Ref</span>
                                    <input type="text" value={payDetails.account_number || payDetails.cheque_number || ""} onChange={e => setDetail(method === "cheque" ? "cheque_number" : "account_number", e.target.value)} placeholder="Reference" style={{width: "100%", padding: "10px 12px", border: "1px solid #cbd5e0", borderRadius: "6px", fontSize: "13px", fontFamily: "inherit"}} />
                                </div>
                            </>
                        )}
                        {MOBILE_METHODS.includes(method) && (
                            <>
                                <div style={{display: "flex", flexDirection: "column", gap: "6px", paddingBottom: "12px", paddingTop: "12px", borderBottom: "1px solid #f0f4f8"}}>
                                    <span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Subscriber Wallet</span>
                                    <input type="text" value={payDetails.phone_number || ""} onChange={e => setDetail("phone_number", e.target.value)} placeholder="255..." style={{width: "100%", padding: "10px 12px", border: "1px solid #cbd5e0", borderRadius: "6px", fontSize: "13px", fontFamily: "inherit"}} />
                                </div>
                                <div style={{display: "flex", flexDirection: "column", gap: "6px", paddingTop: "12px"}}>
                                    <span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Transaction ID</span>
                                    <input type="text" value={transactionRef} onChange={e => setTransactionRef(e.target.value)} placeholder="Ref" style={{width: "100%", padding: "10px 12px", border: "1px solid #cbd5e0", borderRadius: "6px", fontSize: "13px", fontFamily: "inherit"}} />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* ROW 2: LOAN CHARGES - FULL WIDTH */}
                <div style={{background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", marginBottom: "20px"}}>
                    <h3 style={{display: "flex", alignItems: "center", gap: "12px", fontSize: "16px", fontWeight: 700, color: "#2d3748", margin: "0 0 16px 0", paddingBottom: "16px", borderBottom: "2px solid #f0f4f8"}}>
                        <Calculator size={18} /> Loan Charges
                    </h3>
                    <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px"}}>
                        <div style={{display: "flex", justifyContent: "space-between", padding: "12px", background: "#f7fafc", borderRadius: "6px"}}><span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Approved Loan Amount:</span><span style={{fontSize: "14px", fontWeight: 700, color: "#2d3748"}}>{fmt(approvedAmount)}</span></div>
                        <div style={{display: "flex", justifyContent: "space-between", padding: "12px", background: "#f7fafc", borderRadius: "6px"}}><span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Processing Fee:</span><span style={{fontSize: "14px", fontWeight: 700, color: "#2d3748"}}>{fmt(processingFee)}</span></div>
                        <div style={{display: "flex", justifyContent: "space-between", padding: "12px", background: "#f7fafc", borderRadius: "6px"}}><span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Insurance Fee:</span><span style={{fontSize: "14px", fontWeight: 700, color: "#2d3748"}}>{fmt(insuranceFee)}</span></div>
                        <div style={{display: "flex", justifyContent: "space-between", padding: "12px", background: "#f7fafc", borderRadius: "6px"}}><span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Other Charges:</span><span style={{fontSize: "14px", fontWeight: 700, color: "#2d3748"}}>{fmt(otherCharges)}</span></div>
                        <div style={{display: "flex", justifyContent: "space-between", padding: "12px", background: "#f7fafc", borderRadius: "6px"}}><span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Total Charges:</span><span style={{fontSize: "14px", fontWeight: 700, color: "#2d3748"}}>{fmt(totalCharges)}</span></div>
                        <div style={{display: "flex", justifyContent: "space-between", padding: "16px", background: "linear-gradient(135deg, #e6f7ff 0%, #e6fffa 100%)", borderRadius: "6px", border: "2px solid #667eea", gridColumn: "1/3"}}><span style={{fontSize: "13px", fontWeight: 700, color: "#2d3748"}}>Net Disbursement Amount:</span><span style={{fontSize: "16px", fontWeight: 800, color: "#0d5c3f"}}>{fmt(netAmount)}</span></div>
                    </div>
                </div>

                {/* ROW 3: DISBURSEMENT INFO + REPAYMENT SUMMARY */}
                <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px"}}>
                    {/* DISBURSEMENT INFORMATION */}
                    <div style={{background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)"}}>
                        <h3 style={{display: "flex", alignItems: "center", gap: "12px", fontSize: "16px", fontWeight: 700, color: "#2d3748", margin: "0 0 16px 0", paddingBottom: "16px", borderBottom: "2px solid #f0f4f8"}}>
                            <Calendar size={18} /> Disbursement Information
                        </h3>
                        <div style={{display: "flex", flexDirection: "column", gap: "6px", paddingBottom: "12px", borderBottom: "1px solid #f0f4f8"}}>
                            <span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Disbursement Date</span>
                            <input type="date" value={disbursementDate} onChange={e => setDisbursementDate(e.target.value)} style={{width: "100%", padding: "10px 12px", border: "1px solid #cbd5e0", borderRadius: "6px", fontSize: "13px", fontFamily: "inherit"}} />
                        </div>
                        <div style={{display: "flex", justifyContent: "space-between", gap: "16px", paddingBottom: "12px", paddingTop: "12px", borderBottom: "1px solid #f0f4f8"}}><span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Voucher Number</span><span style={{fontSize: "14px", fontWeight: 600, color: "#2d3748"}}>Auto Generated</span></div>
                        <div style={{display: "flex", justifyContent: "space-between", gap: "16px", paddingBottom: "12px", paddingTop: "12px", borderBottom: "1px solid #f0f4f8"}}><span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Receipt Number</span><span style={{fontSize: "14px", fontWeight: 600, color: "#2d3748"}}>Auto Generated</span></div>
                        <div style={{display: "flex", flexDirection: "column", gap: "6px", paddingTop: "12px"}}>
                            <span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Narration</span>
                            <textarea value={narration} onChange={e => setNarration(e.target.value)} style={{width: "100%", padding: "10px 12px", border: "1px solid #cbd5e0", borderRadius: "6px", fontSize: "13px", fontFamily: "inherit", minHeight: "60px", resize: "vertical"}} />
                        </div>
                    </div>

                    {/* REPAYMENT SUMMARY */}
                    <div style={{background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)"}}>
                        <h3 style={{display: "flex", alignItems: "center", gap: "12px", fontSize: "16px", fontWeight: 700, color: "#2d3748", margin: "0 0 16px 0", paddingBottom: "16px", borderBottom: "2px solid #f0f4f8"}}>
                            <Banknote size={18} /> Repayment Summary
                        </h3>
                        <div style={{display: "flex", justifyContent: "space-between", gap: "16px", paddingBottom: "12px", borderBottom: "1px solid #f0f4f8"}}><span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Total Installments:</span><span style={{fontSize: "14px", fontWeight: 600, color: "#2d3748"}}>{summary?.total_installments}</span></div>
                        <div style={{display: "flex", justifyContent: "space-between", gap: "16px", paddingBottom: "12px", paddingTop: "12px", borderBottom: "1px solid #f0f4f8"}}><span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Monthly Installment:</span><span style={{fontSize: "14px", fontWeight: 600, color: "#2d3748"}}>{fmt(summary?.installment_amount)}</span></div>
                        <div style={{display: "flex", justifyContent: "space-between", gap: "16px", paddingBottom: "12px", paddingTop: "12px", borderBottom: "1px solid #f0f4f8"}}><span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>First Payment Date:</span><span style={{fontSize: "14px", fontWeight: 600, color: "#2d3748"}}>{fmtDate(summary?.first_payment_date)}</span></div>
                        <div style={{display: "flex", justifyContent: "space-between", gap: "16px", paddingTop: "12px"}}><span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Final Payment Date:</span><span style={{fontSize: "14px", fontWeight: 600, color: "#2d3748"}}>{fmtDate(summary?.final_payment_date)}</span></div>
                    </div>
                </div>

                {/* ROW 4: VERIFICATION CHECKLIST - FULL WIDTH */}
                <div style={{background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", marginBottom: "20px"}}>
                    <h3 style={{display: "flex", alignItems: "center", gap: "12px", fontSize: "16px", fontWeight: 700, color: "#2d3748", margin: "0 0 16px 0", paddingBottom: "16px", borderBottom: "2px solid #f0f4f8"}}>
                        <ShieldCheck size={18} /> Verification Checklist
                    </h3>
                    <div style={{display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px"}}>
                        {CHECKLIST.map((c) => (
                            <label key={c.key} style={{display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: checks[c.key] ? "#e6fffa" : "#f7fafc", borderRadius: "6px", cursor: "pointer", border: checks[c.key] ? "1px solid #10b981" : "1px solid #e2e8f0", transition: "all 0.2s"}}>
                                <input type="checkbox" checked={!!checks[c.key]} onChange={e => setChecks({ ...checks, [c.key]: e.target.checked })} style={{width: "18px", height: "18px", cursor: "pointer", accentColor: "#667eea"}} />
                                <span style={{fontSize: "13px", fontWeight: 500, color: checks[c.key] ? "#065f46" : "#2d3748"}}>{c.label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* ROW 5: CONFIRMATION - FULL WIDTH */}
                <div style={{background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", marginBottom: "20px"}}>
                    <h3 style={{display: "flex", alignItems: "center", gap: "12px", fontSize: "16px", fontWeight: 700, color: "#2d3748", margin: "0 0 16px 0", paddingBottom: "16px", borderBottom: "2px solid #f0f4f8"}}>
                        <FileText size={18} /> Confirmation
                    </h3>
                    <div style={{display: "flex", flexDirection: "column", gap: "6px", paddingBottom: "12px", borderBottom: "1px solid #f0f4f8"}}>
                        <span style={{fontSize: "13px", fontWeight: 600, color: "#4a5568"}}>Password / PIN Confirmation</span>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" style={{width: "100%", padding: "10px 12px", border: "1px solid #cbd5e0", borderRadius: "6px", fontSize: "13px", fontFamily: "inherit"}} />
                    </div>
                    <label style={{display: "flex", alignItems: "flex-start", gap: "12px", marginTop: "16px", cursor: "pointer"}}>
                        <input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} style={{width: "18px", height: "18px", marginTop: "2px", cursor: "pointer", accentColor: "#667eea", flexShrink: 0}} />
                        <span style={{fontSize: "13px", fontWeight: 500, color: "#4a5568", lineHeight: "1.4"}}>I confirm that all loan information has been verified and the customer has received the funds.</span>
                    </label>
                </div>

                {/* ACTION BUTTONS */}
                <div style={{display: "flex", gap: "12px", justifyContent: "flex-end", paddingTop: "20px", borderTop: "2px solid #e2e8f0"}}>
                    <button onClick={() => navigate(-1)} style={{padding: "11px 24px", border: "1px solid #cbd5e0", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer", background: "white", color: "#4a5568", transition: "all 0.3s"}}>Cancel</button>
                    <button onClick={() => printDoc("Voucher", buildVoucherBody())} style={{padding: "11px 24px", border: "1px solid #cbd5e0", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer", background: "#edf2f7", color: "#2d3748", transition: "all 0.3s"}}>Preview Voucher</button>
                    <button onClick={() => printDoc("Agreement", buildAgreementBody())} style={{padding: "11px 24px", border: "1px solid #cbd5e0", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer", background: "#edf2f7", color: "#2d3748", transition: "all 0.3s"}}>Print Agreement</button>
                    <button onClick={handleDisburse} disabled={!canDisburse || submitting} style={{padding: "11px 24px", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: canDisburse ? "pointer" : "not-allowed", background: canDisburse ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "#cbd5e0", color: canDisburse ? "white" : "#718096", transition: "all 0.3s", boxShadow: canDisburse ? "0 4px 15px rgba(102, 126, 234, 0.4)" : "none"}}>
                        {submitting ? "Processing..." : "Disburse Loan"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DisburseLoan;
