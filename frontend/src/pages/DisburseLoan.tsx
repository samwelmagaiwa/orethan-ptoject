import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

// Mirrors the backend Loan::generateAccountNumber() so the previewed account
// number matches exactly what will be persisted on disbursement.
// dateStr is yyyy-mm-dd (the selected disbursement date).
const buildAccountNumber = (loan: any, dateStr: string) => {
    if (!loan) return "—";
    if (loan.loan_account_number) return loan.loan_account_number; // already disbursed
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

    // Charges (editable)
    const [processingFee, setProcessingFee] = useState("0");
    const [insuranceFee, setInsuranceFee] = useState("0");
    const [otherCharges, setOtherCharges] = useState("0");

    // Payment
    const [method, setMethod] = useState("cash");
    const [payDetails, setPayDetails] = useState<Record<string, string>>({});
    const [transactionRef, setTransactionRef] = useState("");

    // Disbursement info
    const [disbursementDate, setDisbursementDate] = useState(new Date().toISOString().slice(0, 10));
    const [narration, setNarration] = useState("");

    // Verification + confirmation
    const [checks, setChecks] = useState<Record<string, boolean>>({});
    const [confirm, setConfirm] = useState(false);
    const [password, setPassword] = useState("");

    useEffect(() => {
        fetchPreview();
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const canDisburse =
        !alreadyDisbursed && allChecked && confirm && password.trim().length > 0 && netAmount >= 0 && !submitting;

    const setDetail = (k: string, v: string) => setPayDetails((p) => ({ ...p, [k]: v }));

    const buildPaymentDetails = () => {
        if (method === "cash") return { cashier: payDetails.cashier || "", cash_drawer: payDetails.cash_drawer || "" };
        if (method === "bank_transfer")
            return {
                bank_name: payDetails.bank_name || "",
                account_name: payDetails.account_name || "",
                account_number: payDetails.account_number || "",
            };
        if (MOBILE_METHODS.includes(method))
            return {
                mobile_network: PAYMENT_METHODS.find((m) => m.value === method)?.label || "",
                phone_number: payDetails.phone_number || "",
            };
        if (method === "cheque") return { cheque_number: payDetails.cheque_number || "", bank_name: payDetails.bank_name || "" };
        return {};
    };

    const handleDisburse = async () => {
        if (!canDisburse) return;
        setSubmitting(true);
        try {
            const res = await axios.post(`${API_BASE}/loans/${id}/disburse`, {
                disbursement_date: disbursementDate,
                amount: approvedAmount,
                processing_fee: Number(processingFee || 0),
                insurance_fee: Number(insuranceFee || 0),
                other_charges: Number(otherCharges || 0),
                method,
                transaction_reference: transactionRef || null,
                payment_details: buildPaymentDetails(),
                narration,
                branch: preview?.branch || null,
                verification: { ...checks },
                confirm: true,
                password,
            });
            const activated = res.data?.data || res.data;
            setAlert({
                isOpen: true,
                title: "Loan Activated",
                message:
                    `Disbursement successful — loan is now ACTIVE.\n\n` +
                    `Loan Account: ${activated?.loan_account_number || "—"}\n` +
                    `Voucher No: ${activated?.disbursement?.voucher_number || "—"}\n` +
                    `Receipt No: ${activated?.disbursement?.receipt_number || "—"}\n` +
                    `Net Disbursed: ${fmt(activated?.disbursement?.net_amount)}`,
                type: "success",
            });
        } catch (err: any) {
            const msg =
                err?.response?.data?.message ||
                Object.values(err?.response?.data?.errors || {})?.[0]?.[0] ||
                "Disbursement failed";
            setAlert({ isOpen: true, title: "Error", message: msg, type: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    const printDoc = (title: string, body: string) => {
        const win = window.open("", "_blank", "width=720,height=900");
        if (!win) return;
        win.document.write(`<html><head><title>${title}</title><style>
            body{font-family:Arial,sans-serif;padding:32px;color:#0f172a}
            h1{font-size:20px;margin:0 0 4px} h2{font-size:15px;margin:20px 0 8px;border-bottom:2px solid #0f172a;padding-bottom:4px}
            .sub{color:#64748b;font-size:12px;margin-bottom:16px}
            table{width:100%;border-collapse:collapse;margin-bottom:8px}
            td{padding:6px 0;font-size:13px;border-bottom:1px solid #eef2f7}
            td:first-child{color:#64748b} td:last-child{text-align:right;font-weight:700}
            .net{background:#ecfdf5;padding:10px 12px;border-radius:8px;font-size:15px;font-weight:800;display:flex;justify-content:space-between;margin-top:8px}
            .footer{margin-top:30px;font-size:11px;color:#94a3b8;text-align:center}
            .sign{margin-top:48px;display:flex;justify-content:space-between}
            .sign div{border-top:1px solid #475569;padding-top:6px;font-size:12px;width:40%;text-align:center}
        </style></head><body>${body}<div class="footer">Generated by Orethan Microfinance — ${new Date().toLocaleString()}</div></body></html>`);
        win.document.close();
        win.focus();
        win.print();
    };

    const previewVoucher = () => {
        if (!loan) return;
        printDoc(
            "Disbursement Voucher",
            `<h1>Disbursement Voucher</h1><div class="sub">PREVIEW — not yet disbursed</div>
            <h2>Borrower</h2><table>
              <tr><td>Customer</td><td>${loan.name}</td></tr>
              <tr><td>Customer No</td><td>${preview.customer_number || "—"}</td></tr>
              <tr><td>Loan Account No</td><td>${accountNumber}</td></tr>
              <tr><td>Product</td><td>${preview.product_name}</td></tr>
            </table>
            <h2>Charges</h2><table>
              <tr><td>Approved Amount</td><td>${fmt(approvedAmount)}</td></tr>
              <tr><td>Processing Fee</td><td>${fmt(processingFee)}</td></tr>
              <tr><td>Insurance Fee</td><td>${fmt(insuranceFee)}</td></tr>
              <tr><td>Other Charges</td><td>${fmt(otherCharges)}</td></tr>
              <tr><td>Total Charges</td><td>${fmt(totalCharges)}</td></tr>
            </table>
            <div class="net"><span>Net Disbursement</span><span>${fmt(netAmount)}</span></div>
            <h2>Payment</h2><table>
              <tr><td>Method</td><td>${PAYMENT_METHODS.find((m) => m.value === method)?.label}</td></tr>
              <tr><td>Disbursement Date</td><td>${fmtDate(disbursementDate)}</td></tr>
            </table>`
        );
    };

    const printAgreement = () => {
        if (!loan) return;
        printDoc(
            "Loan Agreement",
            `<h1>Loan Agreement</h1><div class="sub">${preview.product_name} — ${accountNumber}</div>
            <table>
              <tr><td>Customer</td><td>${loan.name}</td></tr>
              <tr><td>Customer No</td><td>${preview.customer_number || "—"}</td></tr>
              <tr><td>Loan Account No</td><td>${accountNumber}</td></tr>
              <tr><td>Approved Amount</td><td>${fmt(approvedAmount)}</td></tr>
              <tr><td>Interest Rate</td><td>${summary?.interest_rate}% per ${summary?.frequency?.toLowerCase()} period</td></tr>
              <tr><td>Loan Period</td><td>${summary?.term_months} Months</td></tr>
              <tr><td>Installments</td><td>${summary?.total_installments}</td></tr>
              <tr><td>Installment Amount</td><td>${fmt(summary?.installment_amount)}</td></tr>
              <tr><td>First Payment</td><td>${fmtDate(summary?.first_payment_date)}</td></tr>
              <tr><td>Final Payment</td><td>${fmtDate(summary?.final_payment_date)}</td></tr>
            </table>
            <p style="font-size:12px;color:#475569;line-height:1.6;margin-top:16px">
            The borrower agrees to repay the loan in full according to the repayment schedule above, including all
            applicable interest and charges. Failure to repay on time may attract penalties as per institution policy.</p>
            <div class="sign"><div>Borrower Signature</div><div>Loan Officer Signature</div></div>`
        );
    };

    if (loading) {
        return <div className="disburse-page"><div className="disb-loading">Loading disbursement…</div></div>;
    }

    if (!loan) {
        return <div className="disburse-page"><div className="disb-loading">Loan not found.</div></div>;
    }

    return (
        <div className="disburse-page">
            <AlertModal
                isOpen={alert.isOpen}
                title={alert.title}
                message={alert.message}
                type={alert.type}
                onClose={() => {
                    const wasSuccess = alert.type === "success";
                    setAlert({ ...alert, isOpen: false });
                    if (wasSuccess) navigate("/finance/customers");
                }}
            />

            <div className="disb-header">
                <h1>Loan Disbursement</h1>
                {alreadyDisbursed && <span className="disb-locked-badge">ALREADY DISBURSED — LOCKED</span>}
            </div>

            {/* 1. BORROWER INFORMATION */}
            <section className="disb-card">
                <h2 className="disb-section-title">Borrower Information</h2>
                <div className="disb-grid">
                    <Field label="Customer Name" value={loan.name} />
                    <Field label="Customer Number" value={preview.customer_number} />
                    <Field label="Loan Account Number" value={accountNumber} highlight />
                    <Field label="Loan Product" value={preview.product_name} />
                    <Field label="Loan Officer" value={preview.officer_name || "—"} />
                    <Field label="Branch" value={preview.branch} />
                    <Field label="Loan Status" value={alreadyDisbursed ? "Disbursed" : "Ready for Disbursement"} highlight />
                </div>
            </section>

            {/* 2. LOAN DETAILS */}
            <section className="disb-card">
                <h2 className="disb-section-title">Loan Details</h2>
                <div className="disb-grid">
                    <Field label="Approved Amount" value={fmt(approvedAmount)} />
                    <Field label="Interest Rate" value={`${summary?.interest_rate}% / ${summary?.frequency?.toLowerCase()}`} />
                    <Field label="Loan Period" value={`${summary?.term_months} Months`} />
                    <Field label="Repayment Frequency" value={summary?.frequency} />
                    <Field label="Number of Installments" value={summary?.total_installments} />
                    <Field label="First Installment Date" value={fmtDate(summary?.first_payment_date)} />
                    <Field label="Maturity Date" value={fmtDate(summary?.final_payment_date)} />
                </div>
            </section>

            {/* 3. LOAN CHARGES */}
            <section className="disb-card">
                <h2 className="disb-section-title">Loan Charges</h2>
                <div className="disb-charges">
                    <div className="disb-charge-row"><span>Approved Loan Amount</span><strong>{fmt(approvedAmount)}</strong></div>
                    <div className="disb-charge-row">
                        <label>Processing Fee</label>
                        <input type="number" min="0" value={processingFee} onChange={(e) => setProcessingFee(e.target.value)} />
                    </div>
                    <div className="disb-charge-row">
                        <label>Insurance Fee</label>
                        <input type="number" min="0" value={insuranceFee} onChange={(e) => setInsuranceFee(e.target.value)} />
                    </div>
                    <div className="disb-charge-row">
                        <label>Other Charges</label>
                        <input type="number" min="0" value={otherCharges} onChange={(e) => setOtherCharges(e.target.value)} />
                    </div>
                    <div className="disb-charge-row"><span>Total Charges</span><strong>{fmt(totalCharges)}</strong></div>
                    <div className={`disb-net ${netAmount < 0 ? "disb-net-error" : ""}`}>
                        <span>Net Disbursement Amount</span>
                        <strong>{fmt(netAmount)}</strong>
                    </div>
                    {netAmount < 0 && <div className="disb-error-text">Total charges cannot exceed the approved amount.</div>}
                </div>
            </section>

            {/* 4. PAYMENT INFORMATION */}
            <section className="disb-card">
                <h2 className="disb-section-title">Payment Information</h2>
                <div className="disb-field">
                    <label>Payment Method</label>
                    <select value={method} onChange={(e) => { setMethod(e.target.value); setPayDetails({}); }}>
                        {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>

                <div className="disb-grid" style={{ marginTop: 16 }}>
                    {method === "cash" && (
                        <>
                            <InputField label="Cashier" value={payDetails.cashier || ""} onChange={(v) => setDetail("cashier", v)} />
                            <InputField label="Cash Drawer" value={payDetails.cash_drawer || ""} onChange={(v) => setDetail("cash_drawer", v)} />
                        </>
                    )}
                    {method === "bank_transfer" && (
                        <>
                            <InputField label="Bank Name" value={payDetails.bank_name || ""} onChange={(v) => setDetail("bank_name", v)} />
                            <InputField label="Account Name" value={payDetails.account_name || ""} onChange={(v) => setDetail("account_name", v)} />
                            <InputField label="Account Number" value={payDetails.account_number || ""} onChange={(v) => setDetail("account_number", v)} />
                            <InputField label="Transaction Reference" value={transactionRef} onChange={setTransactionRef} />
                        </>
                    )}
                    {MOBILE_METHODS.includes(method) && (
                        <>
                            <InputField label="Mobile Network" value={PAYMENT_METHODS.find((m) => m.value === method)?.label || ""} onChange={() => {}} disabled />
                            <InputField label="Phone Number" value={payDetails.phone_number || ""} onChange={(v) => setDetail("phone_number", v)} />
                            <InputField label="Transaction Reference" value={transactionRef} onChange={setTransactionRef} />
                        </>
                    )}
                    {method === "cheque" && (
                        <>
                            <InputField label="Cheque Number" value={payDetails.cheque_number || ""} onChange={(v) => setDetail("cheque_number", v)} />
                            <InputField label="Bank Name" value={payDetails.bank_name || ""} onChange={(v) => setDetail("bank_name", v)} />
                            <InputField label="Transaction Reference" value={transactionRef} onChange={setTransactionRef} />
                        </>
                    )}
                </div>
            </section>

            {/* 5. DISBURSEMENT INFORMATION */}
            <section className="disb-card">
                <h2 className="disb-section-title">Disbursement Information</h2>
                <div className="disb-grid">
                    <div className="disb-field">
                        <label>Disbursement Date</label>
                        <input type="date" value={disbursementDate} onChange={(e) => setDisbursementDate(e.target.value)} />
                    </div>
                    <Field label="Voucher Number" value="Auto Generated" muted />
                    <Field label="Receipt Number" value="Auto Generated" muted />
                    <div className="disb-field" style={{ gridColumn: "span 2" }}>
                        <label>Narration</label>
                        <input type="text" value={narration} onChange={(e) => setNarration(e.target.value)} />
                    </div>
                </div>
            </section>

            {/* 6. REPAYMENT SUMMARY */}
            <section className="disb-card">
                <h2 className="disb-section-title">Repayment Summary</h2>
                <div className="disb-grid">
                    <Field label="Total Installments" value={summary?.total_installments} />
                    <Field label="Monthly Installment" value={fmt(summary?.installment_amount)} />
                    <Field label="First Payment Date" value={fmtDate(summary?.first_payment_date)} />
                    <Field label="Final Payment Date" value={fmtDate(summary?.final_payment_date)} />
                </div>
            </section>

            {/* 7. VERIFICATION CHECKLIST */}
            <section className="disb-card">
                <h2 className="disb-section-title">Verification Checklist</h2>
                <div className="disb-checklist">
                    {CHECKLIST.map((c) => (
                        <label key={c.key} className={`disb-check ${checks[c.key] ? "checked" : ""}`}>
                            <input
                                type="checkbox"
                                checked={!!checks[c.key]}
                                onChange={(e) => setChecks((p) => ({ ...p, [c.key]: e.target.checked }))}
                            />
                            <span>{c.label}</span>
                        </label>
                    ))}
                </div>
            </section>

            {/* 8. CONFIRMATION */}
            <section className="disb-card">
                <h2 className="disb-section-title">Confirmation</h2>
                <div className="disb-field" style={{ maxWidth: 360 }}>
                    <label>Password / PIN Confirmation</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" />
                </div>
                <label className={`disb-check ${confirm ? "checked" : ""}`} style={{ marginTop: 14 }}>
                    <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
                    <span>I confirm that all loan information has been verified and the customer has received the funds.</span>
                </label>
            </section>

            {/* 9. ACTIONS */}
            <div className="disb-actions">
                <button className="disb-btn cancel" onClick={() => navigate(-1)} disabled={submitting}>Cancel</button>
                <button className="disb-btn ghost" onClick={previewVoucher} disabled={submitting}>Preview Voucher</button>
                <button className="disb-btn ghost" onClick={printAgreement} disabled={submitting}>Print Agreement</button>
                <button className="disb-btn primary" onClick={handleDisburse} disabled={!canDisburse}>
                    {submitting ? "Disbursing…" : "Disburse Loan"}
                </button>
            </div>
            {!alreadyDisbursed && !canDisburse && (
                <div className="disb-hint">Complete all verification items, confirm, and enter your password to enable disbursement.</div>
            )}

            <style>{`
                .disburse-page { padding: 8px 4px 60px; max-width: 1100px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
                .disb-loading { padding: 60px; text-align: center; color: #64748b; font-size: 15px; }
                .disb-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
                .disb-header h1 { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.01em; }
                .disb-locked-badge { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 8px; letter-spacing: 0.04em; }

                .disb-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 22px 24px; margin-bottom: 18px; box-shadow: 0 6px 18px -10px rgba(15,23,42,0.12); }
                .disb-section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #1e3a8a; margin: 0 0 16px; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9; }

                .disb-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px 24px; }

                .disb-readonly { display: flex; flex-direction: column; gap: 4px; }
                .disb-readonly .lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #94a3b8; }
                .disb-readonly .val { font-size: 15px; font-weight: 700; color: #0f172a; }
                .disb-readonly .val.muted { color: #94a3b8; font-weight: 600; font-style: italic; }
                .disb-readonly .val.highlight { color: #16a34a; }

                .disb-field { display: flex; flex-direction: column; gap: 6px; }
                .disb-field label { font-size: 12px; font-weight: 700; color: #475569; }
                .disb-field input, .disb-field select { padding: 10px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 14px; outline: none; transition: all .2s; background: #fff; }
                .disb-field input:focus, .disb-field select:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
                .disb-field input:disabled { background: #f8fafc; color: #64748b; }

                .disb-charges { display: flex; flex-direction: column; gap: 10px; max-width: 520px; }
                .disb-charge-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
                .disb-charge-row label, .disb-charge-row span { font-size: 14px; color: #475569; font-weight: 600; }
                .disb-charge-row strong { font-size: 14px; color: #0f172a; font-weight: 800; }
                .disb-charge-row input { width: 180px; padding: 8px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 14px; text-align: right; outline: none; }
                .disb-charge-row input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
                .disb-net { display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg,#ecfdf5,#d1fae5); border: 1px solid #a7f3d0; border-radius: 12px; padding: 14px 18px; margin-top: 8px; }
                .disb-net span { font-size: 14px; font-weight: 800; color: #065f46; text-transform: uppercase; letter-spacing: .03em; }
                .disb-net strong { font-size: 20px; font-weight: 900; color: #047857; }
                .disb-net-error { background: #fef2f2; border-color: #fecaca; }
                .disb-net-error span, .disb-net-error strong { color: #b91c1c; }
                .disb-error-text { color: #ef4444; font-size: 12px; font-weight: 600; }

                .disb-checklist { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
                .disb-check { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px; cursor: pointer; transition: all .15s; font-size: 13.5px; color: #334155; font-weight: 600; }
                .disb-check:hover { border-color: #cbd5e1; background: #f8fafc; }
                .disb-check.checked { border-color: #16a34a; background: #f0fdf4; color: #166534; }
                .disb-check input { width: 18px; height: 18px; accent-color: #16a34a; flex-shrink: 0; margin-top: 1px; cursor: pointer; }

                .disb-actions { display: flex; gap: 12px; justify-content: flex-end; flex-wrap: wrap; margin-top: 24px; }
                .disb-btn { padding: 13px 22px; border-radius: 12px; font-size: 14px; font-weight: 700; cursor: pointer; border: none; transition: all .2s; }
                .disb-btn.cancel { background: #f1f5f9; color: #475569; border: 1.5px solid #e2e8f0; }
                .disb-btn.cancel:hover:not(:disabled) { background: #e2e8f0; }
                .disb-btn.ghost { background: #fff; color: #1e3a8a; border: 1.5px solid #bfdbfe; }
                .disb-btn.ghost:hover:not(:disabled) { background: #eff6ff; }
                .disb-btn.primary { background: linear-gradient(135deg,#16a34a,#15803d); color: #fff; box-shadow: 0 10px 20px -6px rgba(22,163,74,.4); }
                .disb-btn.primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 15px 28px -6px rgba(22,163,74,.5); }
                .disb-btn:disabled { opacity: .5; cursor: not-allowed; }
                .disb-hint { text-align: right; color: #94a3b8; font-size: 12px; margin-top: 8px; }

                @media (max-width: 720px) {
                    .disb-grid, .disb-checklist { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

// Read-only display field
const Field = ({ label, value, highlight, muted }: { label: string; value: any; highlight?: boolean; muted?: boolean }) => (
    <div className="disb-readonly">
        <span className="lbl">{label}</span>
        <span className={`val ${highlight ? "highlight" : ""} ${muted ? "muted" : ""}`}>{value ?? "—"}</span>
    </div>
);

// Editable input field
const InputField = ({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) => (
    <div className="disb-field">
        <label>{label}</label>
        <input type="text" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
);

export default DisburseLoan;
