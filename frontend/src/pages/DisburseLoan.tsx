import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    User,
    Wallet,
    CreditCard,
    Calendar,
    ShieldCheck,
    FileText,
    ChevronRight,
    Lock,
    ArrowLeft,
    Printer,
    Eye,
    Zap,
    Banknote,
    MessageSquare,
    Calculator,
    Smartphone,
    Building2,
    Check,
    TrendingUp,
    Activity,
    Shield
} from "lucide-react";
import axios from "axios";
import AlertModal from "../components/AlertModal";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

const PAYMENT_METHODS = [
    { value: "cash", label: "Cash", icon: <Banknote size={18} /> },
    { value: "bank_transfer", label: "Bank Transfer", icon: <CreditCard size={18} /> },
    { value: "mpesa", label: "M-Pesa", icon: <Zap size={18} /> },
    { value: "airtel_money", label: "Airtel Money", icon: <Zap size={18} /> },
    { value: "tigo_pesa", label: "Tigo Pesa", icon: <Zap size={18} /> },
    { value: "halopesa", label: "HaloPesa", icon: <Zap size={18} /> },
    { value: "cheque", label: "Cheque", icon: <FileText size={18} /> },
];

const MOBILE_METHODS = ["mpesa", "airtel_money", "tigo_pesa", "halopesa"];

const fmt = (n: any) => "TZS " + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' }) : "—");

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

const DataBlock = ({ label, value, icon }: any) => (
    <div className="p-data-block">
        <span className="lbl">{icon} {label}</span>
        <span className="val">{value || "—"}</span>
    </div>
);

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
        <div className="p-v2-loader">
            <div className="p-v2-loader-content">
                <motion.div
                    animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="p-v2-spinner"
                >
                    <Shield size={40} className="p-text-emerald" />
                </motion.div>
                <motion.span
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity }}
                >
                    Initializing Secure Portal...
                </motion.span>
            </div>
        </div>
    );

    if (!loan) return <div className="p-v2-loader">Disbursement record not found.</div>;

    const staggerContainer = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemFade = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
    };

    return (
        <div className="p-v2-wrapper">
            {/* DYNAMIC MESH BACKGROUND */}
            <div className="p-v2-mesh">
                <div className="mesh-blob blob-1"></div>
                <div className="mesh-blob blob-2"></div>
                <div className="mesh-blob blob-3"></div>
            </div>

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

            <nav className="p-v2-nav">
                <div className="p-v2-nav-content">
                    <div className="p-v2-nav-left">
                        <button className="p-v2-icon-btn" onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
                        <div className="p-v2-nav-divider"></div>
                        <span className="p-v2-breadcrumb">OPERATIONS / <strong className="p-text-gold">DISBURSEMENT</strong></span>
                    </div>
                </div>
            </nav>

            <motion.div
                className="p-v2-container"
                variants={staggerContainer}
                initial="hidden"
                animate="show"
            >
                {/* HERO SECTION - REFINED */}
                <motion.header variants={itemFade} className="p-v2-hero">
                    <div className="p-v2-hero-glass">
                        <div className="p-v2-hero-left">
                            <div className="p-v2-badge">
                                <Activity size={14} className="p-text-emerald" />
                                <span>{alreadyDisbursed ? 'DISBURSED' : 'READY FOR DISBURSEMENT'}</span>
                            </div>
                            <h1 className="p-v2-cust-name">{loan.name}</h1>
                            <div className="p-v2-acc-ref">
                                <TrendingUp size={14} className="p-text-slate-400" />
                                <code>{accountNumber}</code>
                            </div>
                        </div>
                        <div className="p-v2-hero-right">
                            <div className="p-v2-main-stat">
                                <label>NET DISBURSEMENT</label>
                                <div className="p-v2-stat-val">
                                    <span className="p-v2-currency">TZS</span>
                                    <h2 className="p-v2-amount">{Number(netAmount).toLocaleString()}</h2>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.header>

                <div className="p-v2-layout">
                    <main className="p-v2-main">
                        {/* CONTEXT SECTION */}
                        <motion.section variants={itemFade} className="p-v2-card">
                            <div className="p-v2-card-header">
                                <div className="p-v2-card-icon"><User size={20} /></div>
                                <h3>Borrower Identity & Product</h3>
                            </div>
                            <div className="p-v2-info-grid cols-3">
                                <DataBlock label="Customer Name" value={loan.name} icon={<User size={14} />} />
                                <DataBlock label="Customer Number" value={preview.customer_number} icon={<User size={14} />} />
                                <DataBlock label="Loan Account Number" value={accountNumber} icon={<CreditCard size={14} />} />
                                <DataBlock label="Loan Product" value={preview.product_name} icon={<Building2 size={14} />} />
                                <DataBlock label="Loan Officer" value={preview.officer_name} icon={<User size={14} />} />
                                <DataBlock label="Branch" value={preview.branch} icon={<Building2 size={14} />} />
                                <DataBlock label="Loan Status" value={alreadyDisbursed ? "Disbursed" : "Ready for Disbursement"} icon={<Activity size={14} />} />
                            </div>
                        </motion.section>

                        {/* LOAN DETAILS */}
                        <motion.section variants={itemFade} className="p-v2-card">
                            <div className="p-v2-card-header">
                                <div className="p-v2-card-icon"><TrendingUp size={20} /></div>
                                <h3>Loan Details</h3>
                            </div>
                            <div className="p-v2-info-grid cols-3">
                                <DataBlock label="Approved Amount" value={fmt(approvedAmount)} icon={<Banknote size={14} />} />
                                <DataBlock label="Interest Rate" value={`${summary?.interest_rate}% / monthly`} icon={<TrendingUp size={14} />} />
                                <DataBlock label="Loan Period" value={`${summary?.term_months} Months`} icon={<Calendar size={14} />} />
                                <DataBlock label="Repayment Frequency" value={summary?.frequency} icon={<Calendar size={14} />} />
                                <DataBlock label="Number of Installments" value={summary?.total_installments} icon={<Calculator size={14} />} />
                                <DataBlock label="First Installment Date" value={fmtDate(summary?.first_payment_date)} icon={<Calendar size={14} />} />
                                <DataBlock label="Maturity Date" value={fmtDate(summary?.final_payment_date)} icon={<Calendar size={14} />} />
                            </div>
                        </motion.section>

                        {/* CHARGES SECTION */}
                        <motion.section variants={itemFade} className="p-v2-card p-v2-card-featured">
                            <div className="p-v2-card-header">
                                <div className="p-v2-card-icon"><Wallet size={20} /></div>
                                <h3>Financial Adjustments</h3>
                                <div className="p-v2-header-badge">EDITABLE</div>
                            </div>
                            <div className="p-v2-edit-grid">
                                <div className="p-v2-input-group">
                                    <label>Processing Fee</label>
                                    <div className="p-v2-input-wrapper">
                                        <input type="number" value={processingFee} onChange={e => setProcessingFee(e.target.value)} />
                                        <span className="unit">TZS</span>
                                    </div>
                                </div>
                                <div className="p-v2-input-group">
                                    <label>Insurance Premium</label>
                                    <div className="p-v2-input-wrapper">
                                        <input type="number" value={insuranceFee} onChange={e => setInsuranceFee(e.target.value)} />
                                        <span className="unit">TZS</span>
                                    </div>
                                </div>
                                <div className="p-v2-input-group full">
                                    <label>Other Statutory Charges</label>
                                    <div className="p-v2-input-wrapper">
                                        <input type="number" value={otherCharges} onChange={e => setOtherCharges(e.target.value)} />
                                        <span className="unit">TZS</span>
                                    </div>
                                </div>
                            </div>
                            <div className="p-v2-calc-tray">
                                <div className="p-v2-calc-row">
                                    <span>Principal Approved</span>
                                    <span>{fmt(approvedAmount)}</span>
                                </div>
                                <div className="p-v2-calc-row text-error">
                                    <span>Cumulative Deductions</span>
                                    <span>-{fmt(totalCharges)}</span>
                                </div>
                                <div className="p-v2-calc-row p-v2-calc-final">
                                    <span>Final Net Amount</span>
                                    <span className="p-text-emerald-glow">{fmt(netAmount)}</span>
                                </div>
                            </div>
                        </motion.section>

                        {/* PAYMENT METHOD */}
                        <motion.section variants={itemFade} className="p-v2-card">
                            <div className="p-v2-card-header">
                                <div className="p-v2-card-icon"><CreditCard size={20} /></div>
                                <h3>Settlement Method</h3>
                            </div>
                            <div className="p-v2-method-selector">
                                {PAYMENT_METHODS.map(m => (
                                    <button
                                        key={m.value}
                                        className={`p-v2-method-btn ${method === m.value ? 'active' : ''}`}
                                        onClick={() => { setMethod(m.value); setPayDetails({}); }}
                                    >
                                        <div className="icon-box">{m.icon}</div>
                                        <span>{m.label}</span>
                                        {method === m.value && <motion.div layoutId="v2pill" className="p-v2-method-bg" />}
                                    </button>
                                ))}
                            </div>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={method}
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    className="p-v2-dynamic-form"
                                >
                                    <div className="p-v2-edit-grid">
                                        {method === "cash" && (
                                            <>
                                                <div className="p-v2-input-group">
                                                    <label>Authorized Cashier</label>
                                                    <input type="text" value={payDetails.cashier || ""} onChange={e => setDetail("cashier", e.target.value)} placeholder="Name" />
                                                </div>
                                                <div className="p-v2-input-group">
                                                    <label>Drawer / Vault Reference</label>
                                                    <input type="text" value={payDetails.cash_drawer || ""} onChange={e => setDetail("cash_drawer", e.target.value)} placeholder="e.g. D10" />
                                                </div>
                                            </>
                                        )}
                                        {(method === "bank_transfer" || method === "cheque") && (
                                            <>
                                                <div className="p-v2-input-group">
                                                    <label>Financial Institution</label>
                                                    <input type="text" value={payDetails.bank_name || ""} onChange={e => setDetail("bank_name", e.target.value)} />
                                                </div>
                                                <div className="p-v2-input-group">
                                                    <label>Account / Cheque Ref</label>
                                                    <input type="text" value={payDetails.account_number || payDetails.cheque_number || ""} onChange={e => setDetail(method === "cheque" ? "cheque_number" : "account_number", e.target.value)} />
                                                </div>
                                            </>
                                        )}
                                        {MOBILE_METHODS.includes(method) && (
                                            <>
                                                <div className="p-v2-input-group">
                                                    <label>Subscriber Wallet</label>
                                                    <div className="p-v2-field-icon">
                                                        <Smartphone size={16} />
                                                        <input type="text" value={payDetails.phone_number || ""} onChange={e => setDetail("phone_number", e.target.value)} placeholder="255..." />
                                                    </div>
                                                </div>
                                                <div className="p-v2-input-group">
                                                    <label>Transaction ID</label>
                                                    <input type="text" value={transactionRef} onChange={e => setTransactionRef(e.target.value)} placeholder="Ref" />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        </motion.section>

                        {/* DISBURSEMENT INFORMATION */}
                        <motion.section variants={itemFade} className="p-v2-card">
                            <div className="p-v2-card-header">
                                <div className="p-v2-card-icon"><Calendar size={20} /></div>
                                <h3>Disbursement Information</h3>
                            </div>
                            <div className="p-v2-edit-grid">
                                <div className="p-v2-input-group">
                                    <label>Disbursement Date</label>
                                    <input type="date" value={disbursementDate} onChange={e => setDisbursementDate(e.target.value)} />
                                </div>
                                <div className="p-v2-input-group full">
                                    <label>Narration</label>
                                    <input type="text" value={narration} onChange={e => setNarration(e.target.value)} placeholder="Loan disbursement narration" />
                                </div>
                            </div>
                            <div className="p-v2-divider"></div>
                            <div className="p-v2-info-grid">
                                <DataBlock label="Voucher Number" value="Auto Generated" icon={<FileText size={14} />} />
                                <DataBlock label="Receipt Number" value="Auto Generated" icon={<FileText size={14} />} />
                            </div>
                        </motion.section>

                        {/* REPAYMENT SUMMARY */}
                        <motion.section variants={itemFade} className="p-v2-card">
                            <div className="p-v2-card-header">
                                <div className="p-v2-card-icon"><Calculator size={20} /></div>
                                <h3>Repayment Summary</h3>
                            </div>
                            <div className="p-v2-info-grid cols-3">
                                <DataBlock label="Total Installments" value={summary?.total_installments} icon={<Calculator size={14} />} />
                                <DataBlock label="Monthly Installment" value={fmt(summary?.installment_amount)} icon={<Banknote size={14} />} />
                                <DataBlock label="First Payment Date" value={fmtDate(summary?.first_payment_date)} icon={<Calendar size={14} />} />
                                <DataBlock label="Final Payment Date" value={fmtDate(summary?.final_payment_date)} icon={<Calendar size={14} />} />
                            </div>
                        </motion.section>
                    </main>

                    <aside className="p-v2-sidebar">
                        <div className="p-v2-sticky-rail">
                            {/* SECURITY GATE */}
                            <motion.div variants={itemFade} className="p-v2-security-card">
                                <div className="p-v2-security-header">
                                    <Shield size={22} className="p-text-emerald-glow-icon" />
                                    <h3>Verification Gate</h3>
                                </div>
                                <div className="p-v2-checklist">
                                    {CHECKLIST.map(c => (
                                        <label key={c.key} className={`p-v2-check-item ${checks[c.key] ? 'checked' : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={!!checks[c.key]}
                                                onChange={e => setChecks({ ...checks, [c.key]: e.target.checked })}
                                            />
                                            <div className="custom-box">
                                                {checks[c.key] && <Check size={12} />}
                                            </div>
                                            <span>{c.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </motion.div>

                            {/* AUTH CARD */}
                            <motion.div variants={itemFade} className="p-v2-auth-card">
                                <div className="p-v2-auth-header">
                                    <Lock size={18} className="p-text-gold" />
                                    <span>SYSTEM AUTHORIZATION</span>
                                </div>
                                <div className="p-v2-auth-field">
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="Admin PIN Access"
                                    />
                                </div>
                                <label className="p-v2-confirm">
                                    <input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} />
                                    <div className="p-v2-mini-box"></div>
                                    <span>Funds confirm recorded</span>
                                </label>
                                <button
                                    className={`p-v2-action-btn ${canDisburse ? 'available' : ''}`}
                                    disabled={!canDisburse || submitting}
                                    onClick={handleDisburse}
                                >
                                    {submitting ? 'VALIDATING...' : 'AUTHORIZE DISBURSEMENT'}
                                    <ChevronRight size={18} />
                                </button>
                            </motion.div>

                            <div className="p-v2-util-grid">
                                <button className="p-v2-util-btn" onClick={() => printDoc("Voucher", buildVoucherBody())}>PREVIEW VOUCHER</button>
                                <button className="p-v2-util-btn" onClick={() => printDoc("Agreement", buildAgreementBody())}>PRINT AGREEMENT</button>
                            </div>
                        </div>
                    </aside>
                </div>
            </motion.div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');

                .p-v2-wrapper {
                    min-height: 100vh;
                    background: #020617;
                    font-family: 'Outfit', sans-serif;
                    color: #fff;
                    position: relative;
                    overflow-x: hidden;
                    padding-bottom: 80px;
                }

                /* MESH BACKGROUND */
                .p-v2-mesh {
                    position: fixed;
                    inset: 0;
                    z-index: 0;
                    overflow: hidden;
                    pointer-events: none;
                }
                .mesh-blob {
                    position: absolute;
                    width: 600px;
                    height: 600px;
                    border-radius: 50%;
                    filter: blur(120px);
                    opacity: 0.15;
                }
                .blob-1 { background: #1e3a8a; top: -10%; left: -10%; }
                .blob-2 { background: #064e3b; bottom: -10%; right: -10%; }
                .blob-3 { background: #312e81; top: 30%; left: 50%; width: 400px; height: 400px; }

                /* NAVIGATION */
                .p-v2-nav { position: relative; z-index: 10; height: 70px; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(2,6,23,0.5); backdrop-filter: blur(10px); display: flex; align-items: center; }
                .p-v2-nav-content { max-width: 1300px; margin: 0 auto; width: 100%; padding: 0 32px; display: flex; justify-content: space-between; }
                .p-v2-nav-left { display: flex; align-items: center; gap: 20px; }
                .p-v2-icon-btn { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); color: #fff; width: 36px; height: 36px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
                .p-v2-nav-divider { width: 1px; height: 20px; background: rgba(255,255,255,0.1); }
                .p-v2-breadcrumb { font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.15em; }

                /* CONTAINER */
                .p-v2-container { max-width: 1300px; margin: 40px auto 0; padding: 0 32px; position: relative; z-index: 1; }

                /* HERO */
                .p-v2-hero { margin-bottom: 40px; }
                .p-v2-hero-glass { 
                    background: rgba(255,255,255,0.02); 
                    backdrop-filter: blur(20px); 
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 32px;
                    padding: 48px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    box-shadow: 0 20px 40px -10px rgba(0,0,0,0.5);
                }
                .p-v2-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(16,185,129,0.1); color: #10b981; padding: 6px 14px; border-radius: 100px; font-size: 10px; font-weight: 800; letter-spacing: 0.1em; margin-bottom: 20px; border: 1px solid rgba(16,185,129,0.2); }
                .p-v2-cust-name { font-size: 48px; font-weight: 800; margin: 0 0 16px; letter-spacing: -0.04em; background: linear-gradient(to bottom, #fff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                .p-v2-acc-ref { display: flex; align-items: center; gap: 10px; opacity: 0.6; }
                .p-v2-acc-ref code { font-family: ui-monospace, monospace; font-size: 14px; color: #fff; }

                .p-v2-main-stat { text-align: right; }
                .p-v2-main-stat label { font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.2em; display: block; margin-bottom: 8px; }
                .p-v2-stat-val { display: flex; align-items: baseline; gap: 12px; justify-content: flex-end; }
                .p-v2-currency { font-size: 20px; font-weight: 700; color: #f59e0b; }
                .p-v2-amount { font-size: 64px; font-weight: 800; margin: 0; letter-spacing: -0.05em; color: #fff; }

                /* LAYOUT */
                .p-v2-layout { display: grid; grid-template-columns: 1fr 420px; gap: 40px; }

                /* CARDS */
                .p-v2-card { 
                    background: rgba(255,255,255,0.02); 
                    backdrop-filter: blur(12px); 
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 24px;
                    padding: 40px;
                    margin-bottom: 40px;
                    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .p-v2-card:hover { transform: translateY(-5px); border-color: rgba(255,255,255,0.1); }
                .p-v2-card-header { display: flex; align-items: center; gap: 16px; margin-bottom: 32px; }
                .p-v2-card-icon { width: 44px; height: 44px; background: rgba(255,255,255,0.05); border-radius: 14px; display: flex; align-items: center; justify-content: center; color: #fff; }
                .p-v2-card-header h3 { font-size: 20px; font-weight: 700; margin: 0; }
                .p-v2-header-badge { font-size: 10px; font-weight: 800; background: #f59e0b; color: #020617; padding: 4px 10px; border-radius: 100px; letter-spacing: 0.1em; }

                .p-v2-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
                .p-v2-info-grid.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
                .p-v2-divider { height: 1px; background: rgba(255,255,255,0.05); margin: 32px 0; }

                /* DATA BLOCK */
                .p-data-block { display: flex; flex-direction: column; gap: 6px; }
                .p-data-block .lbl { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; display: flex; align-items: center; gap: 6px; }
                .p-data-block .val { font-size: 15px; font-weight: 600; color: #f8fafc; }

                /* EDIT GRID */
                .p-v2-edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
                .p-v2-edit-grid .full { grid-column: span 2; }
                .p-v2-input-group { display: flex; flex-direction: column; gap: 10px; }
                .p-v2-input-group label { font-size: 12px; font-weight: 600; color: #94a3b8; }
                .p-v2-input-wrapper { position: relative; }
                .p-v2-input-wrapper input, .p-v2-input-group input { 
                    background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); 
                    border-radius: 16px; padding: 14px 18px; color: #fff; width: 100%; font-size: 15px; font-weight: 600; outline: none; transition: all 0.3s;
                }
                .p-v2-input-wrapper input:focus, .p-v2-input-group input:focus { border-color: #3b82f6; box-shadow: 0 0 15px -3px rgba(59,130,246,0.3); background: rgba(0,0,0,0.4); }
                .p-v2-input-wrapper .unit { position: absolute; right: 18px; top: 50%; transform: translateY(-50%); font-size: 11px; font-weight: 700; color: #475569; }

                .p-v2-calc-tray { margin-top: 40px; background: rgba(0,0,0,0.2); padding: 32px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.03); }
                .p-v2-calc-row { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 14px; font-weight: 600; color: #64748b; }
                .p-v2-calc-final { border-top: 1px dashed rgba(255,255,255,0.1); margin-top: 24px; padding-top: 24px; color: #fff; }
                .p-text-emerald-glow { font-size: 28px; font-weight: 800; color: #10b981; text-shadow: 0 0 20px rgba(16,185,129,0.3); }

                /* METHOD SELECTOR */
                .p-v2-method-selector { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 32px; }
                .p-v2-method-btn { 
                    position: relative; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); 
                    padding: 14px 20px; border-radius: 18px; color: #94a3b8; display: flex; align-items: center; gap: 12px; 
                    cursor: pointer; font-family: inherit; transition: all 0.3s; overflow: hidden;
                }
                .p-v2-method-btn span { position: relative; z-index: 1; font-size: 13px; font-weight: 700; }
                .p-v2-method-btn .icon-box { position: relative; z-index: 1; width: 32px; height: 32px; background: rgba(255,255,255,0.03); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
                .p-v2-method-btn.active { color: #fff; border-color: rgba(255,255,255,0.1); }
                .p-v2-method-bg { position: absolute; inset: 0; background: linear-gradient(135deg, #1e3a8a, #0f172a); z-index: 0; }

                .p-v2-dynamic-form { background: rgba(0,0,0,0.15); padding: 32px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.02); }

                /* SIDEBAR */
                .p-v2-sticky-rail { position: sticky; top: 110px; }

                .p-v2-security-card { 
                    background: rgba(255,255,255,0.02); backdrop-filter: blur(20px); 
                    border: 1px solid rgba(255,255,255,0.05); border-radius: 28px; padding: 32px; margin-bottom: 24px;
                }
                .p-v2-security-header { display: flex; align-items: center; gap: 14px; margin-bottom: 28px; }
                .p-v2-security-header h3 { font-size: 16px; font-weight: 700; margin: 0; opacity: 0.9; }

                .p-v2-checklist { display: flex; flex-direction: column; gap: 12px; }
                .p-v2-check-item { display: flex; align-items: center; gap: 14px; padding: 14px 18px; background: rgba(255,255,255,0.02); border-radius: 16px; cursor: pointer; border: 1px solid transparent; transition: all 0.2s; }
                .p-v2-check-item.checked { background: rgba(16,185,129,0.05); border-color: rgba(16,185,129,0.2); }
                .p-v2-check-item input { display: none; }
                .p-v2-check-item .custom-box { width: 22px; height: 22px; border-radius: 7px; border: 2px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.2); color: #10b981; }
                .p-v2-check-item.checked .custom-box { border-color: #10b981; background: #10b981; color: #fff; box-shadow: 0 0 10px rgba(16,185,129,0.4); }
                .p-v2-check-item span { font-size: 13px; font-weight: 600; color: #64748b; }
                .p-v2-check-item.checked span { color: #f8fafc; }

                .p-v2-auth-card { 
                    background: linear-gradient(165deg, #0f172a, #020617);
                    border: 1px solid rgba(255,255,255,0.08); border-radius: 28px; padding: 32px; box-shadow: 0 30px 60px -15px rgba(0,0,0,0.8);
                }
                .p-v2-auth-header { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; font-size: 10px; font-weight: 800; letter-spacing: 0.2em; color: #475569; }
                .p-v2-auth-field input { 
                    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); 
                    width: 100%; border-radius: 16px; padding: 18px; color: #fff; font-size: 16px; text-align: center; letter-spacing: 4px; outline: none; transition: all 0.3s;
                }
                .p-v2-auth-field input:focus { border-color: #f59e0b; box-shadow: 0 0 20px -5px rgba(245,158,11,0.3); }

                .p-v2-confirm { display: flex; align-items: center; gap: 10px; margin: 24px 0; cursor: pointer; }
                .p-v2-confirm input { display: none; }
                .p-v2-mini-box { width: 14px; height: 14px; border: 1.5px solid #334155; border-radius: 4px; }
                .p-v2-confirm input:checked + .p-v2-mini-box { background: #f59e0b; border-color: #f59e0b; box-shadow: 0 0 10px rgba(245,158,11,0.4); }
                .p-v2-confirm span { font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.05em; }

                .p-v2-action-btn { 
                    width: 100%; padding: 20px; border-radius: 18px; border: none; background: rgba(255,255,255,0.05); 
                    color: #475569; font-weight: 800; font-size: 14px; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: center; gap: 12px; cursor: not-allowed; transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .p-v2-action-btn.available { background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff; cursor: pointer; box-shadow: 0 15px 30px -10px rgba(245,158,11,0.5); }
                .p-v2-action-btn.available:hover { transform: scale(1.02); filter: brightness(1.1); }

                .p-v2-util-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 24px; }
                .p-v2-util-btn { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 12px; color: #94a3b8; font-size: 10px; font-weight: 800; letter-spacing: 0.1em; cursor: pointer; transition: all 0.2s; }
                .p-v2-util-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }

                .p-text-gold { color: #f59e0b; }
                .p-text-emerald { color: #10b981; }
                .p-text-emerald-glow-icon { color: #10b981; filter: drop-shadow(0 0 8px rgba(16,185,129,0.5)); }
                .text-error { color: #ef4444; }

                /* LOADER */
                .p-v2-loader { height: 100vh; display: flex; align-items: center; justify-content: center; background: #020617; }
                .p-v2-loader-content { display: flex; flex-direction: column; align-items: center; gap: 24px; color: #64748b; font-size: 12px; font-weight: 700; letter-spacing: 0.2em; }
                .p-v2-spinner { width: 80px; height: 80px; background: rgba(255,255,255,0.02); display: flex; align-items: center; justify-content: center; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05); }

                @media (max-width: 1100px) {
                    .p-v2-layout { grid-template-columns: 1fr; }
                    .p-v2-info-grid.cols-3 { grid-template-columns: 1fr 1fr; }
                    .p-v2-hero-glass { flex-direction: column; text-align: center; gap: 32px; padding: 40px 24px; }
                    .p-v2-main-stat { text-align: center; }
                    .p-v2-stat-val { justify-content: center; }
                    .p-v2-amount { font-size: 48px; }
                }
            `}</style>
        </div>
    );
};

export default DisburseLoan;
