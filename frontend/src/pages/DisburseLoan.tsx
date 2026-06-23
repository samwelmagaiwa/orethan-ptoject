import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    User,
    Building2,
    CreditCard,
    Calendar,
    Calculator,
    Banknote,
    FileText,
    Check,
    Activity,
    ShieldCheck,
    TrendingUp,
    Smartphone,
    ArrowLeft,
} from "lucide-react";
import axios from "axios";
import AlertModal from "../components/AlertModal";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

const PAYMENT_METHODS = [
    { value: "cash", label: "Cash" },
    { value: "bank_transfer", label: "Bank Transfer" },
    { value: "mpesa", label: "M-Pesa" },
    { value: "airtel_money", label: "Airtel Money" },
    { value: "tigo_pesa", label: "Tigo Pesa" },
    { value: "halopesa", label: "HaloPesa" },
    { value: "cheque", label: "Cheque" },
];

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

const CHECKLIST = [
    { key: "identity_verified", label: "Customer Identity Verified" },
    { key: "agreement_signed", label: "Loan Agreement Signed" },
    { key: "guarantor_signed", label: "Guarantor Signed" },
    { key: "charges_confirmed", label: "Charges Confirmed" },
    { key: "customer_present", label: "Customer Present" },
    { key: "payment_verified", label: "Payment Details Verified" },
];

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

    useEffect(() => {
        fetchPreview();
    }, [id]);

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
            setAlert({
                isOpen: true,
                title: "Disbursement Successful",
                message: `The loan for ${loan.name} has been successfully disbursed and activated.`,
                type: "success",
            });
        } catch (err: any) {
            setAlert({ isOpen: true, title: "Error", message: err?.response?.data?.message || "Disbursement failed", type: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    const methodLabel = PAYMENT_METHODS.find((m) => m.value === method)?.label || method;

    const buildVoucherBody = () => `
        <h2>Borrower Information</h2>
        <table>
            <tr><td>Customer Name</td><td>${loan.name}</td></tr>
            <tr><td>Customer Number</td><td>${preview.customer_number}</td></tr>
            <tr><td>Loan Account Number</td><td>${accountNumber}</td></tr>
            <tr><td>Loan Product</td><td>${preview.product_name}</td></tr>
            <tr><td>Loan Officer</td><td>${preview.officer_name}</td></tr>
            <tr><td>Branch</td><td>${preview.branch}</td></tr>
        </table>
        <h2>Loan Charges</h2>
        <table>
            <tr><td>Approved Loan Amount</td><td>${fmt(approvedAmount)}</td></tr>
            <tr><td>Processing Fee</td><td>${fmt(processingFee)}</td></tr>
            <tr><td>Insurance Fee</td><td>${fmt(insuranceFee)}</td></tr>
            <tr><td>Other Charges</td><td>${fmt(otherCharges)}</td></tr>
            <tr><td>Total Charges</td><td>${fmt(totalCharges)}</td></tr>
        </table>
        <div class="net-box"><span>Net Disbursement</span><div>${fmt(netAmount)}</div></div>
        <h2>Payment Information</h2>
        <table>
            <tr><td>Payment Method</td><td>${methodLabel}</td></tr>
            ${transactionRef ? `<tr><td>Transaction Reference</td><td>${transactionRef}</td></tr>` : ""}
            <tr><td>Disbursement Date</td><td>${fmtDate(disbursementDate)}</td></tr>
            <tr><td>Narration</td><td>${narration}</td></tr>
        </table>
    `;

    const buildAgreementBody = () => `
        <h2>Loan Agreement Summary</h2>
        <table>
            <tr><td>Customer Name</td><td>${loan.name}</td></tr>
            <tr><td>Loan Account Number</td><td>${accountNumber}</td></tr>
            <tr><td>Approved Amount</td><td>${fmt(approvedAmount)}</td></tr>
            <tr><td>Interest Rate</td><td>${summary?.interest_rate}% / monthly</td></tr>
            <tr><td>Loan Period</td><td>${summary?.term_months} Months</td></tr>
            <tr><td>Repayment Frequency</td><td>${summary?.frequency}</td></tr>
            <tr><td>Number of Installments</td><td>${summary?.total_installments}</td></tr>
            <tr><td>Monthly Installment</td><td>${fmt(summary?.installment_amount)}</td></tr>
            <tr><td>First Payment Date</td><td>${fmtDate(summary?.first_payment_date)}</td></tr>
            <tr><td>Final Payment Date</td><td>${fmtDate(summary?.final_payment_date)}</td></tr>
        </table>
        <div class="sign-grid">
            <div class="sign-box">Customer Signature</div>
            <div class="sign-box">Loan Officer Signature</div>
        </div>
    `;

    const printDoc = (title: string, body: string) => {
        const win = window.open("", "_blank", "width=800,height=1000");
        if (!win) return;
        win.document.write(`<html><head><title>${title}</title><style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            body{font-family:'Inter', sans-serif;padding:60px;color:#0f172a;background:#fff; line-height:1.5}
            .header-info{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;border-bottom:2px solid #0f172a;padding-bottom:20px}
            h1{font-size:28px;font-weight:800;margin:0;letter-spacing:-0.03em;text-transform:uppercase}
            .doc-type{font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.1em}
            h2{font-size:14px;text-transform:uppercase;letter-spacing:0.05em;color:#1e3a8a;margin:40px 0 16px;display:flex;align-items:center;gap:8px;background:#f8fafc;padding:8px 12px;border-radius:8px}
            table{width:100%;border-collapse:collapse;margin-bottom:16px}
            td{padding:14px 12px;font-size:14px;border-bottom:1px solid #f1f5f9}
            td:first-child{color:#64748b;font-weight:500;width:40%} td:last-child{text-align:right;font-weight:700;color:#0f172a}
            .net-box{background:#0f172a;padding:24px;border-radius:16px;font-size:20px;font-weight:800;display:flex;justify-content:space-between;margin-top:32px;color:white;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1)}
            .net-box span{opacity:0.7;font-size:14px;text-transform:uppercase;letter-spacing:0.05em}
            .footer{margin-top:80px;font-size:11px;color:#94a3b8;text-align:center;border-top:1px solid #f1f5f9;padding-top:32px}
            .sign-grid{margin-top:100px;display:grid;grid-template-columns:1fr 1fr;gap:60px}
            .sign-box{border-top:1px solid #0f172a;padding-top:12px;font-size:13px;text-align:center;font-weight:600}
            .watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:120px;color:rgba(0,0,0,0.03);font-weight:900;z-index:-1;pointer-events:none;white-space:nowrap}
        </style></head><body>
        <div class="watermark">ORETHAN MICROFINANCE</div>
        <div class="header-info">
            <div>
                <h1>ORETHAN</h1>
                <div class="doc-type">${title}</div>
            </div>
            <div style="text-align:right">
                <div style="font-weight:700;font-size:14px">Date: ${new Date().toLocaleDateString('en-GB')}</div>
                <div style="font-size:12px;color:#64748b">Ref: ${accountNumber}</div>
            </div>
        </div>
        ${body}
        <div class="footer">This is a system generated document. All rights reserved &copy; ${new Date().getFullYear()} Orethan Microfinance.</div>
        </body></html>`);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 500);
    };

    if (loading) return (
        <div className="disburse-loader">
            <div className="spinner"></div>
            <p>Loading disbursement data...</p>
        </div>
    );

    if (!loan) return <div className="disburse-loader">Disbursement record not found.</div>;

    return (
        <div className="disburse-wrapper">
            <AlertModal
                isOpen={alert.isOpen}
                title={alert.title}
                message={alert.message}
                type={alert.type}
                onClose={() => {
                    if (alert.type === "success") navigate("/finance/customers");
                    setAlert({ ...alert, isOpen: false });
                }}
            />

            <div className="disburse-header">
                <button className="disburse-back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={18} /> Back
                </button>
                <h1>Loan Disbursement</h1>
            </div>

            <div className="disburse-grid">
                {/* BORROWER INFORMATION */}
                <div className="disburse-card">
                    <h3 className="card-title">
                        <User size={18} /> Borrower Information
                    </h3>
                    <div className="card-row">
                        <span className="card-label">Customer Name:</span>
                        <span className="card-value">{loan.name}</span>
                    </div>
                    <div className="card-row">
                        <span className="card-label">Customer Number:</span>
                        <span className="card-value">{preview.customer_number}</span>
                    </div>
                    <div className="card-row">
                        <span className="card-label">Loan Account Number:</span>
                        <span className="card-value mono">{accountNumber}</span>
                    </div>
                    <div className="card-row">
                        <span className="card-label">Loan Product:</span>
                        <span className="card-value">{preview.product_name}</span>
                    </div>
                    <div className="card-row">
                        <span className="card-label">Loan Officer:</span>
                        <span className="card-value">{preview.officer_name}</span>
                    </div>
                    <div className="card-row">
                        <span className="card-label">Branch:</span>
                        <span className="card-value">{preview.branch}</span>
                    </div>
                    <div className="card-row">
                        <span className="card-label">Loan Status:</span>
                        <span className="card-value status-ready">{alreadyDisbursed ? "Disbursed" : "Ready for Disbursement"}</span>
                    </div>
                </div>

                {/* LOAN DETAILS */}
                <div className="disburse-card">
                    <h3 className="card-title">
                        <TrendingUp size={18} /> Loan Details
                    </h3>
                    <div className="card-row">
                        <span className="card-label">Approved Amount:</span>
                        <span className="card-value">{fmt(approvedAmount)}</span>
                    </div>
                    <div className="card-row">
                        <span className="card-label">Interest Rate:</span>
                        <span className="card-value">{summary?.interest_rate}% / monthly</span>
                    </div>
                    <div className="card-row">
                        <span className="card-label">Loan Period:</span>
                        <span className="card-value">{summary?.term_months} Months</span>
                    </div>
                    <div className="card-row">
                        <span className="card-label">Repayment Frequency:</span>
                        <span className="card-value">{summary?.frequency}</span>
                    </div>
                    <div className="card-row">
                        <span className="card-label">Number of Installments:</span>
                        <span className="card-value">{summary?.total_installments}</span>
                    </div>
                    <div className="card-row">
                        <span className="card-label">First Installment Date:</span>
                        <span className="card-value">{fmtDate(summary?.first_payment_date)}</span>
                    </div>
                    <div className="card-row">
                        <span className="card-label">Maturity Date:</span>
                        <span className="card-value">{fmtDate(summary?.final_payment_date)}</span>
                    </div>
                </div>

                {/* LOAN CHARGES */}
                <div className="disburse-card full-width">
                    <h3 className="card-title">
                        <Calculator size={18} /> Loan Charges
                    </h3>
                    <div className="charges-grid">
                        <div className="charge-row">
                            <span className="charge-label">Approved Loan Amount:</span>
                            <span className="charge-value">{fmt(approvedAmount)}</span>
                        </div>
                        <div className="charge-row">
                            <span className="charge-label">Processing Fee:</span>
                            <span className="charge-value">{fmt(processingFee)}</span>
                        </div>
                        <div className="charge-row">
                            <span className="charge-label">Insurance Fee:</span>
                            <span className="charge-value">{fmt(insuranceFee)}</span>
                        </div>
                        <div className="charge-row">
                            <span className="charge-label">Other Charges:</span>
                            <span className="charge-value">{fmt(otherCharges)}</span>
                        </div>
                        <div className="charge-row">
                            <span className="charge-label">Total Charges:</span>
                            <span className="charge-value">{fmt(totalCharges)}</span>
                        </div>
                        <div className="charge-row highlight">
                            <span className="charge-label">Net Disbursement Amount:</span>
                            <span className="charge-value">{fmt(netAmount)}</span>
                        </div>
                    </div>
                </div>

                {/* PAYMENT INFORMATION */}
                <div className="disburse-card">
                    <h3 className="card-title">
                        <CreditCard size={18} /> Payment Information
                    </h3>
                    <div className="card-row">
                        <span className="card-label">Payment Method</span>
                        <select value={method} onChange={(e) => { setMethod(e.target.value); setPayDetails({}); }} className="card-select">
                            {PAYMENT_METHODS.map((m) => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>

                    {method === "cash" && (
                        <>
                            <div className="card-row">
                                <span className="card-label">Cashier</span>
                                <input type="text" value={payDetails.cashier || ""} onChange={e => setDetail("cashier", e.target.value)} placeholder="Name" className="card-input" />
                            </div>
                            <div className="card-row">
                                <span className="card-label">Cash Drawer</span>
                                <input type="text" value={payDetails.cash_drawer || ""} onChange={e => setDetail("cash_drawer", e.target.value)} placeholder="e.g. D10" className="card-input" />
                            </div>
                        </>
                    )}

                    {(method === "bank_transfer" || method === "cheque") && (
                        <>
                            <div className="card-row">
                                <span className="card-label">Financial Institution</span>
                                <input type="text" value={payDetails.bank_name || ""} onChange={e => setDetail("bank_name", e.target.value)} placeholder="Bank name" className="card-input" />
                            </div>
                            <div className="card-row">
                                <span className="card-label">Account / Cheque Ref</span>
                                <input type="text" value={payDetails.account_number || payDetails.cheque_number || ""} onChange={e => setDetail(method === "cheque" ? "cheque_number" : "account_number", e.target.value)} placeholder="Reference" className="card-input" />
                            </div>
                        </>
                    )}

                    {MOBILE_METHODS.includes(method) && (
                        <>
                            <div className="card-row">
                                <span className="card-label">Subscriber Wallet</span>
                                <input type="text" value={payDetails.phone_number || ""} onChange={e => setDetail("phone_number", e.target.value)} placeholder="255..." className="card-input" />
                            </div>
                            <div className="card-row">
                                <span className="card-label">Transaction ID</span>
                                <input type="text" value={transactionRef} onChange={e => setTransactionRef(e.target.value)} placeholder="Ref" className="card-input" />
                            </div>
                        </>
                    )}
                </div>

                {/* DISBURSEMENT INFORMATION */}
                <div className="disburse-card">
                    <h3 className="card-title">
                        <Calendar size={18} /> Disbursement Information
                    </h3>
                    <div className="card-row">
                        <span className="card-label">Disbursement Date</span>
                        <input type="date" value={disbursementDate} onChange={e => setDisbursementDate(e.target.value)} className="card-input" />
                    </div>
                    <div className="card-row">
                        <span className="card-label">Voucher Number</span>
                        <span className="card-value">Auto Generated</span>
                    </div>
                    <div className="card-row">
                        <span className="card-label">Receipt Number</span>
                        <span className="card-value">Auto Generated</span>
                    </div>
                    <div className="card-row full">
                        <span className="card-label">Narration</span>
                        <textarea value={narration} onChange={e => setNarration(e.target.value)} className="card-textarea" rows={3}></textarea>
                    </div>
                </div>

                {/* REPAYMENT SUMMARY */}
                <div className="disburse-card">
                    <h3 className="card-title">
                        <Banknote size={18} /> Repayment Summary
                    </h3>
                    <div className="card-row">
                        <span className="card-label">Total Installments:</span>
                        <span className="card-value">{summary?.total_installments}</span>
                    </div>
                    <div className="card-row">
                        <span className="card-label">Monthly Installment:</span>
                        <span className="card-value">{fmt(summary?.installment_amount)}</span>
                    </div>
                    <div className="card-row">
                        <span className="card-label">First Payment Date:</span>
                        <span className="card-value">{fmtDate(summary?.first_payment_date)}</span>
                    </div>
                    <div className="card-row">
                        <span className="card-label">Final Payment Date:</span>
                        <span className="card-value">{fmtDate(summary?.final_payment_date)}</span>
                    </div>
                </div>

                {/* VERIFICATION CHECKLIST */}
                <div className="disburse-card">
                    <h3 className="card-title">
                        <ShieldCheck size={18} /> Verification Checklist
                    </h3>
                    <div className="checklist">
                        {CHECKLIST.map((c) => (
                            <label key={c.key} className="checklist-item">
                                <input
                                    type="checkbox"
                                    checked={!!checks[c.key]}
                                    onChange={e => setChecks({ ...checks, [c.key]: e.target.checked })}
                                />
                                <span>{c.label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* CONFIRMATION */}
                <div className="disburse-card full-width">
                    <h3 className="card-title">
                        <FileText size={18} /> Confirmation
                    </h3>
                    <div className="card-row">
                        <span className="card-label">Password / PIN Confirmation</span>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            className="card-input"
                        />
                    </div>
                    <label className="confirmation-check">
                        <input
                            type="checkbox"
                            checked={confirm}
                            onChange={e => setConfirm(e.target.checked)}
                        />
                        <span>I confirm that all loan information has been verified and the customer has received the funds.</span>
                    </label>
                </div>
            </div>

            <div className="disburse-actions">
                <button className="btn-cancel" onClick={() => navigate(-1)}>Cancel</button>
                <button className="btn-secondary" onClick={() => printDoc("Voucher", buildVoucherBody())}>Preview Voucher</button>
                <button className="btn-secondary" onClick={() => printDoc("Agreement", buildAgreementBody())}>Print Agreement</button>
                <button className={`btn-primary ${canDisburse ? "active" : "disabled"}`} disabled={!canDisburse || submitting} onClick={handleDisburse}>
                    {submitting ? "Processing..." : "Disburse Loan"}
                </button>
            </div>

            <style>{`
                .disburse-wrapper {
                    min-height: 100vh;
                    background: linear-gradient(135deg, #f5f7fa 0%, #e9ecef 100%);
                    padding: 30px 20px;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                }

                .disburse-header {
                    max-width: 1200px;
                    margin: 0 auto 30px;
                    display: flex;
                    align-items: center;
                    gap: 20px;
                }

                .disburse-header h1 {
                    font-size: 32px;
                    font-weight: 700;
                    margin: 0;
                    color: #1a202c;
                }

                .disburse-back-btn {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 8px 12px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    cursor: pointer;
                    font-weight: 500;
                    color: #4a5568;
                    transition: all 0.2s;
                }

                .disburse-back-btn:hover {
                    background: #f7fafc;
                    border-color: #cbd5e0;
                }

                .disburse-grid {
                    max-width: 1200px;
                    margin: 0 auto 40px;
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
                    gap: 20px;
                }

                .disburse-card {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 24px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                    transition: all 0.2s;
                }

                .disburse-card:hover {
                    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
                    border-color: #cbd5e0;
                }

                .disburse-card.full-width {
                    grid-column: 1 / -1;
                }

                .card-title {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-size: 16px;
                    font-weight: 700;
                    color: #2d3748;
                    margin: 0 0 16px 0;
                    padding-bottom: 16px;
                    border-bottom: 2px solid #f0f4f8;
                }

                .card-title svg {
                    color: #667eea;
                    flex-shrink: 0;
                }

                .card-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                    padding: 12px 0;
                    border-bottom: 1px solid #f0f4f8;
                }

                .card-row:last-child {
                    border-bottom: none;
                }

                .card-row.full {
                    flex-direction: column;
                    align-items: flex-start;
                }

                .card-label {
                    font-size: 13px;
                    font-weight: 600;
                    color: #4a5568;
                    min-width: 140px;
                }

                .card-value {
                    font-size: 14px;
                    font-weight: 600;
                    color: #2d3748;
                    text-align: right;
                }

                .card-value.mono {
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    background: #f7fafc;
                    padding: 4px 8px;
                    border-radius: 4px;
                    color: #1a202c;
                }

                .card-value.status-ready {
                    background: #e6fffa;
                    color: #0f766e;
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                }

                .card-input, .card-select, .card-textarea {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1px solid #cbd5e0;
                    border-radius: 6px;
                    font-size: 13px;
                    font-family: inherit;
                    transition: all 0.2s;
                }

                .card-input:focus, .card-select:focus, .card-textarea:focus {
                    outline: none;
                    border-color: #667eea;
                    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                    background: #f8fafb;
                }

                .card-textarea {
                    resize: vertical;
                    min-height: 80px;
                }

                .charges-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }

                .charge-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px;
                    background: #f7fafc;
                    border-radius: 6px;
                    font-size: 13px;
                }

                .charge-label {
                    font-weight: 600;
                    color: #4a5568;
                }

                .charge-value {
                    font-weight: 700;
                    color: #2d3748;
                    text-align: right;
                }

                .charge-row.highlight {
                    grid-column: 1 / -1;
                    background: linear-gradient(135deg, #e6f7ff 0%, #e6fffa 100%);
                    border: 2px solid #667eea;
                    padding: 16px;
                }

                .charge-row.highlight .charge-label {
                    color: #2d3748;
                    font-weight: 700;
                }

                .charge-row.highlight .charge-value {
                    color: #0d5c3f;
                    font-size: 16px;
                }

                .checklist {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .checklist-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    background: #f7fafc;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .checklist-item:hover {
                    background: #edf2f7;
                }

                .checklist-item input {
                    width: 18px;
                    height: 18px;
                    cursor: pointer;
                    accent-color: #667eea;
                }

                .checklist-item span {
                    font-size: 13px;
                    font-weight: 500;
                    color: #2d3748;
                }

                .confirmation-check {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 12px 0;
                    cursor: pointer;
                }

                .confirmation-check input {
                    width: 18px;
                    height: 18px;
                    margin-top: 2px;
                    cursor: pointer;
                    accent-color: #667eea;
                    flex-shrink: 0;
                }

                .confirmation-check span {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    line-height: 1.4;
                }

                .disburse-actions {
                    max-width: 1200px;
                    margin: 0 auto;
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    padding-top: 20px;
                    border-top: 2px solid #e2e8f0;
                }

                .btn-cancel, .btn-secondary, .btn-primary {
                    padding: 11px 24px;
                    border: none;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.3s;
                }

                .btn-cancel {
                    background: white;
                    color: #4a5568;
                    border: 1px solid #cbd5e0;
                }

                .btn-cancel:hover {
                    background: #f7fafc;
                    border-color: #a0aec0;
                }

                .btn-secondary {
                    background: #edf2f7;
                    color: #2d3748;
                }

                .btn-secondary:hover {
                    background: #e2e8f0;
                }

                .btn-primary {
                    background: #cbd5e0;
                    color: #718096;
                    cursor: not-allowed;
                }

                .btn-primary.active {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    cursor: pointer;
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                }

                .btn-primary.active:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
                }

                .btn-primary.disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .disburse-loader {
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 20px;
                    background: linear-gradient(135deg, #f5f7fa 0%, #e9ecef 100%);
                    font-size: 16px;
                    color: #4a5568;
                    font-weight: 500;
                }

                .spinner {
                    width: 50px;
                    height: 50px;
                    border: 4px solid #e2e8f0;
                    border-top-color: #667eea;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                @media (max-width: 900px) {
                    .disburse-grid {
                        grid-template-columns: 1fr;
                    }
                    .charges-grid {
                        grid-template-columns: 1fr;
                    }
                    .disburse-actions {
                        flex-wrap: wrap;
                    }
                }
            `}</style>
        </div>
    );
};

export default DisburseLoan;
