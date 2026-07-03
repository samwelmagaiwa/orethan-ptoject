import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { User, CreditCard, Calculator, Banknote, FileText, ShieldCheck, ArrowLeft, TrendingUp, X, Fingerprint } from "lucide-react";
import axios from "axios";
import AlertModal from "../components/AlertModal";
import { letterheadBlock, watermarkBlock, triggerPrint } from "../utils/printDoc";
import { BiometricScanner } from "../components/BiometricScanner";

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

const FINGERS = [
    { value: "right_thumb",  label: "Right Thumb" },
    { value: "right_index",  label: "Right Index" },
    { value: "right_middle", label: "Right Middle" },
    { value: "right_ring",   label: "Right Ring" },
    { value: "right_little", label: "Right Little" },
    { value: "left_thumb",   label: "Left Thumb" },
    { value: "left_index",   label: "Left Index" },
    { value: "left_middle",  label: "Left Middle" },
    { value: "left_ring",    label: "Left Ring" },
    { value: "left_little",  label: "Left Little" },
    { value: "skip",         label: "— Skip (no fingerprint) —" },
];

const BioCard = ({ role, roleKey, name, ok, finger, capturedImage, sessionId, onCapture, onError }: {
    role: string; roleKey: string; name: string; ok: boolean; finger: string;
    capturedImage?: string; sessionId: string;
    onCapture: (r: import("../components/BiometricScanner").ScanResult) => void;
    onError: (msg: string) => void;
}) => {
    const skipped = finger === "skip";
    const borderColor = ok ? "#86efac" : skipped ? "#fcd34d" : "#e2e8f0";
    const bg = ok ? "#f0fdf4" : skipped ? "#fffbeb" : "#fafafa";
    const fingerLabel = FINGERS.find(f => f.value === finger)?.label ?? finger;

    return (
        <div style={{ border: `2px solid ${borderColor}`, borderRadius: "14px", padding: "16px 12px 20px", background: bg, transition: "all 0.3s", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "100%", textAlign: "center" }}>
                <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", color: "#64748b" }}>{role}</div>
                <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", marginTop: "3px" }}>{name}</div>
            </div>

            {/* Finger label badge (read-only — controlled by shared selector above) */}
            {!skipped && (
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#7c3aed", background: "#faf5ff", border: "1px solid #ddd6fe", borderRadius: "20px", padding: "3px 12px" }}>
                    {fingerLabel}
                </div>
            )}

            {skipped && (
                <div style={{ padding: "18px 0", textAlign: "center" }}>
                    <div style={{ fontSize: "28px", marginBottom: "6px" }}>⏭️</div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#92400e" }}>Fingerprint skipped</div>
                    <div style={{ fontSize: "11px", color: "#b45309", marginTop: "3px" }}>Supervisor override required</div>
                </div>
            )}

            {/* Captured fingerprint image preview */}
            {ok && !skipped && capturedImage && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#059669" }}>✓ {fingerLabel} verified</div>
                    <img
                        src={`data:image/bmp;base64,${capturedImage}`}
                        alt="fingerprint"
                        style={{ width: "90px", height: "90px", objectFit: "cover", borderRadius: "8px", border: "2px solid #86efac", background: "#000" }}
                    />
                </div>
            )}
            {ok && !skipped && !capturedImage && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#059669", marginTop: "4px" }}>
                    ✓ {fingerLabel} verified
                </div>
            )}

            {!skipped && (
                <BiometricScanner
                    finger={finger}
                    minQuality={60}
                    onCapture={onCapture}
                    onError={onError}
                    disabled={ok}
                    label={fingerLabel}
                    role={roleKey}
                    personName={name}
                    sessionId={sessionId}
                />
            )}
        </div>
    );
};

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
    const [confirm, setConfirm] = useState(false);
    const [password, setPassword] = useState("");
    const [borrowerOk, setBorrowerOk] = useState(false);
    const [guarantor1Ok, setGuarantor1Ok] = useState(false);
    const [guarantor2Ok, setGuarantor2Ok] = useState(false);
    const [borrowerFinger, setBorrowerFinger] = useState("right_thumb");
    const [guarantor1Finger, setGuarantor1Finger] = useState("right_thumb");
    const [guarantor2Finger, setGuarantor2Finger] = useState("right_thumb");
    // Shared session ID — all three scanners send this so the agent can cross-check
    const sessionId = useMemo(() => crypto.randomUUID(), []);
    // Captured fingerprint data: { template, image (base64 BMP), finger }
    const [borrowerBio, setBorrowerBio] = useState<{ template: string; image: string; finger: string } | null>(null);
    const [guarantor1Bio, setGuarantor1Bio] = useState<{ template: string; image: string; finger: string } | null>(null);
    const [guarantor2Bio, setGuarantor2Bio] = useState<{ template: string; image: string; finger: string } | null>(null);

    const getLoggedInUserName = () => {
        try {
            const stored = localStorage.getItem("user");
            if (stored) {
                const u = JSON.parse(stored);
                return u.name || "";
            }
        } catch { /* ignore parsing errors */ }
        return "";
    };

    useEffect(() => { fetchPreview(); }, [id]);

    // Cashier processing the disbursement is always the logged-in user —
    // capture their name automatically instead of asking them to type it.
    useEffect(() => {
        const name = getLoggedInUserName();
        if (name) setPayDetails((p) => ({ ...p, cashier: p.cashier || name }));
    }, []);

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
    const hasGuarantor1 = !!loan?.details?.wdhamini1JinaKamili;
    const hasGuarantor2 = !!loan?.details?.wdhamini2JinaKamili;
    const biometricsComplete = borrowerOk && (!hasGuarantor1 || guarantor1Ok) && (!hasGuarantor2 || guarantor2Ok);
    const canDisburse = !alreadyDisbursed && confirm && password.trim().length > 0 && netAmount >= 0 && !submitting && biometricsComplete;
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
                confirm: true,
                password,
            });

            // Save biometrics to DB (fire-and-forget — don't block success on this)
            const customerId = preview?.customer_id ?? loan?.customer_id;
            if (customerId) {
                const bios = [
                    { bio: borrowerBio, finger: borrowerFinger },
                    { bio: guarantor1Bio, finger: guarantor1Finger },
                    { bio: guarantor2Bio, finger: guarantor2Finger },
                ];
                for (const { bio, finger } of bios) {
                    if (bio?.template) {
                        axios.post(`${API_BASE}/biometrics/store`, {
                            customer_id: customerId,
                            finger_position: finger,
                            template: bio.template,
                            image_b64: bio.image || null,
                            device_serial: null,
                        }).catch(() => { /* silent — biometric save failure is non-fatal */ });
                    }
                }
            }

            setAlert({ isOpen: true, title: "Disbursement Successful", message: `The loan for ${loan.name} has been successfully disbursed and activated.`, type: "success" });
        } catch (err: any) {
            setAlert({ isOpen: true, title: "Error", message: err?.response?.data?.message || "Disbursement failed", type: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    const methodLabel = PAYMENT_METHODS.find((m) => m.value === method)?.label || method;

    const buildVoucherBody = () => {
        const metaCell = (label: string, value: string, mono = false) => `
          <div style="padding:14px 18px">
            <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;font-weight:700">${label}</div>
            <div style="font-size:13px;font-weight:800;color:#0f172a;margin-top:5px;${mono ? "font-family:ui-monospace,monospace;letter-spacing:0.5px" : ""}">${value}</div>
          </div>`;
        const sectionTitle = (title: string, n: number) => `
          <div style="display:flex;align-items:center;gap:11px;margin:13px 0 7px">
            <span style="width:27px;height:27px;border-radius:8px;background:linear-gradient(135deg,#102a43,#1d3a5f);color:#fff;font-size:12px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(16,42,67,0.25)">${n}</span>
            <span style="font-size:15px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#102a43">${title}</span>
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

  <!-- Biometric Confirmation -->
  ${(borrowerBio?.image || guarantor1Bio?.image || guarantor2Bio?.image) ? `
  ${sectionTitle("Biometric Confirmation", 4)}
  <div style="display:flex;gap:32px;align-items:flex-start;margin:12px 0 20px">
    ${borrowerBio?.image ? `
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
      <img src="data:image/bmp;base64,${borrowerBio.image}" style="width:90px;height:90px;object-fit:cover;border:2px solid #059669;border-radius:8px;background:#000" />
      <div style="font-size:9px;font-weight:800;color:#059669;text-transform:uppercase;letter-spacing:0.8px">Borrower</div>
      <div style="font-size:9px;color:#64748b">${loan.name}</div>
      <div style="font-size:8px;color:#94a3b8">${FINGERS.find(f => f.value === borrowerBio.finger)?.label ?? borrowerBio.finger}</div>
    </div>` : ""}
    ${guarantor1Bio?.image ? `
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
      <img src="data:image/bmp;base64,${guarantor1Bio.image}" style="width:90px;height:90px;object-fit:cover;border:2px solid #059669;border-radius:8px;background:#000" />
      <div style="font-size:9px;font-weight:800;color:#059669;text-transform:uppercase;letter-spacing:0.8px">Guarantor 1</div>
      <div style="font-size:9px;color:#64748b">${loan.details.wdhamini1JinaKamili}</div>
      <div style="font-size:8px;color:#94a3b8">${FINGERS.find(f => f.value === guarantor1Bio.finger)?.label ?? guarantor1Bio.finger}</div>
    </div>` : ""}
    ${guarantor2Bio?.image ? `
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
      <img src="data:image/bmp;base64,${guarantor2Bio.image}" style="width:90px;height:90px;object-fit:cover;border:2px solid #059669;border-radius:8px;background:#000" />
      <div style="font-size:9px;font-weight:800;color:#059669;text-transform:uppercase;letter-spacing:0.8px">Guarantor 2</div>
      <div style="font-size:9px;color:#64748b">${loan.details.wdhamini2JinaKamili}</div>
      <div style="font-size:8px;color:#94a3b8">${FINGERS.find(f => f.value === guarantor2Bio.finger)?.label ?? guarantor2Bio.finger}</div>
    </div>` : ""}
  </div>` : ""}

  <!-- Signatures -->
  <div style="margin-top:34px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:36px">
    <div style="text-align:center"><div style="height:42px"></div><div style="border-top:1.5px solid #0f172a;padding-top:10px;font-size:10px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1px">Prepared / Cashier</div></div>
    <div style="text-align:center"><div style="height:42px"></div><div style="border-top:1.5px solid #0f172a;padding-top:10px;font-size:10px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1px">Authorized By</div></div>
    <div style="text-align:center"><div style="height:42px;display:flex;align-items:flex-end;justify-content:center">${loan?.details?.mwombajiAmesainiFomuNgumu ? `<span style="font-size:11px;font-weight:900;color:#059669;letter-spacing:0.5px">[ IMEWEKWA ]</span>` : ""}</div><div style="border-top:1.5px solid #0f172a;padding-top:10px;font-size:10px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1px">Received By (Client)</div></div>
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
    <div style="margin-top:70px;display:grid;grid-template-columns:1fr 1fr;gap:60px">
      <div style="text-align:center"><div style="height:46px;display:flex;align-items:flex-end;justify-content:center">${loan?.details?.mwombajiAmesainiFomuNgumu ? `<span style="font-size:12px;font-weight:900;color:#059669;letter-spacing:0.5px">[ IMEWEKWA ]</span>` : ""}</div><div style="border-top:2px solid #0f172a;padding-top:14px;font-size:10px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1px">Client Signature</div></div>
      <div style="text-align:center"><div style="height:46px"></div><div style="border-top:2px solid #0f172a;padding-top:14px;font-size:10px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1px">Branch Manager</div></div>
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

                    {/* BIOMETRIC VERIFICATION */}
                    <div style={{ marginBottom: "40px" }}>
                        <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: 800, color: biometricsComplete ? "#059669" : "#7c3aed", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 6px 0", paddingBottom: "12px", borderBottom: `2px solid ${biometricsComplete ? "#d1fae5" : "#ede9fe"}` }}>
                            <Fingerprint size={18} />
                            Biometric Verification
                            {biometricsComplete && <span style={{ marginLeft: "auto", fontSize: "12px", background: "#d1fae5", color: "#059669", padding: "3px 12px", borderRadius: "20px", fontWeight: 700 }}>✓ All Verified</span>}
                            {!biometricsComplete && <span style={{ marginLeft: "auto", fontSize: "12px", background: "#ede9fe", color: "#7c3aed", padding: "3px 12px", borderRadius: "20px", fontWeight: 700 }}>Required before disbursement</span>}
                        </h3>

                        {/* Shared finger selector — all participants use the same finger so duplicate detection works */}
                        <div style={{ display: "flex", alignItems: "center", gap: "14px", background: "#faf5ff", border: "1.5px solid #ddd6fe", borderRadius: "10px", padding: "12px 18px", margin: "12px 0 20px 0" }}>
                            <Fingerprint size={16} color="#7c3aed" />
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "#7c3aed", whiteSpace: "nowrap" }}>Finger for all participants:</span>
                            <select
                                value={borrowerFinger}
                                onChange={e => {
                                    const f = e.target.value;
                                    // Sync to all roles and reset captured state
                                    setBorrowerFinger(f);  setGuarantor1Finger(f); setGuarantor2Finger(f);
                                    if (f === "skip") {
                                        setBorrowerOk(true); setGuarantor1Ok(true); setGuarantor2Ok(true);
                                        setBorrowerBio(null); setGuarantor1Bio(null); setGuarantor2Bio(null);
                                    } else {
                                        setBorrowerOk(false); setGuarantor1Ok(false); setGuarantor2Ok(false);
                                        setBorrowerBio(null); setGuarantor1Bio(null); setGuarantor2Bio(null);
                                    }
                                }}
                                style={{ flex: 1, padding: "7px 12px", border: "1.5px solid #c4b5fd", borderRadius: "8px", fontSize: "13px", fontWeight: 700, color: "#5b21b6", background: "#fff", outline: "none", cursor: "pointer" }}
                            >
                                {FINGERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                            <span style={{ fontSize: "11px", color: "#94a3b8", whiteSpace: "nowrap" }}>Same finger required to detect duplicates</span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: `repeat(${1 + (hasGuarantor1 ? 1 : 0) + (hasGuarantor2 ? 1 : 0)}, 1fr)`, gap: "20px" }}>
                            {/* Borrower */}
                            <BioCard
                                role="Borrower" roleKey="borrower" name={loan?.name}
                                ok={borrowerOk} finger={borrowerFinger}
                                capturedImage={borrowerBio?.image} sessionId={sessionId}
                                onCapture={r => { setBorrowerOk(true); setBorrowerBio({ template: r.template, image: r.image, finger: borrowerFinger }); }}
                                onError={msg => { setBorrowerOk(false); setAlert({ isOpen: true, title: "Biometric Error", message: msg, type: "error" }); }}
                            />
                            {/* Guarantor 1 */}
                            {hasGuarantor1 && (
                                <BioCard
                                    role="Guarantor 1" roleKey="guarantor1" name={loan.details.wdhamini1JinaKamili}
                                    ok={guarantor1Ok} finger={guarantor1Finger}
                                    capturedImage={guarantor1Bio?.image} sessionId={sessionId}
                                        onCapture={r => { setGuarantor1Ok(true); setGuarantor1Bio({ template: r.template, image: r.image, finger: guarantor1Finger }); }}
                                    onError={msg => { setGuarantor1Ok(false); setAlert({ isOpen: true, title: "Biometric Error", message: msg, type: "error" }); }}
                                />
                            )}
                            {/* Guarantor 2 */}
                            {hasGuarantor2 && (
                                <BioCard
                                    role="Guarantor 2" roleKey="guarantor2" name={loan.details.wdhamini2JinaKamili}
                                    ok={guarantor2Ok} finger={guarantor2Finger}
                                    capturedImage={guarantor2Bio?.image} sessionId={sessionId}
                                        onCapture={r => { setGuarantor2Ok(true); setGuarantor2Bio({ template: r.template, image: r.image, finger: guarantor2Finger }); }}
                                    onError={msg => { setGuarantor2Ok(false); setAlert({ isOpen: true, title: "Biometric Error", message: msg, type: "error" }); }}
                                />
                            )}
                        </div>
                    </div>

                    {/* LOWER SECTIONS: 2-COLUMN GRID */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}>

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
                                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#475569" }}>Processing Fee <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 500 }}>({capturedProcessingFeePercent}% · auto)</span></span>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 700 }}>TZS</span>
                                        <input type="number" value={processingFee} readOnly title="Auto-calculated from the loan calculator" style={{ width: "90px", padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: "8px", textAlign: "right", fontSize: "13px", outline: "none", background: "#f1f5f9", color: "#64748b", cursor: "not-allowed", fontWeight: 700 }} />
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
                        <div style={{ display: "flex", flexDirection: "column", gap: "32px", borderLeft: "1px dashed #e2e8f0", padding: "0 24px" }}>
                            {/* Payout Method */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                                <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: "1px", margin: 0, paddingBottom: "12px", borderBottom: "1px solid #e2e8f0" }}>
                                    <CreditCard size={18} /> Payout Method
                                </h3>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Selected Channel</span>
                                    <select value={method} onChange={(e) => { const newMethod = e.target.value; setMethod(newMethod); setPayDetails(newMethod === "cash" ? { cashier: getLoggedInUserName() } : {}); }} style={{ width: "100%", padding: "12px 16px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "14px", fontWeight: 600, outline: "none", color: "#0f172a" }} onFocus={(e) => e.target.style.borderColor = "#3b82f6"} onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}>
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

                            {/* Cashier PIN */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "20px", opacity: biometricsComplete ? 1 : 0.4, pointerEvents: biometricsComplete ? "auto" : "none", transition: "opacity 0.3s" }}>
                                <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "1px", margin: 0, paddingBottom: "12px", borderBottom: "1px solid #e2e8f0" }}>
                                    <ShieldCheck size={18} /> Cashier Authorization
                                    {!biometricsComplete && <span style={{ marginLeft: "auto", fontSize: "11px", color: "#94a3b8", fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>🔒 Complete biometrics first</span>}
                                </h3>
                                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                        <span style={{ fontSize: "12px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px" }}>Your PIN / Password</span>
                                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ width: "100%", padding: "14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", color: "#0f172a", fontSize: "16px", letterSpacing: "2px", outline: "none" }} onFocus={(e) => e.target.style.borderColor = "#3b82f6"} onBlur={(e) => e.target.style.borderColor = "#e2e8f0"} />
                                    </div>
                                    <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer", padding: "14px", background: confirm ? "#eff6ff" : "#f8fafc", borderRadius: "8px", border: confirm ? "1px solid #3b82f6" : "1px dashed #cbd5e1" }}>
                                        <input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} style={{ width: "18px", height: "18px", marginTop: "2px", accentColor: "#3b82f6" }} />
                                        <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b", lineHeight: "1.4" }}>I confirm details are correct for net amount of {fmt(netAmount)}.</span>
                                    </label>
                                </div>

                                {/* ACTION BUTTONS — same row, beneath the confirmation field */}
                                <div style={{ display: "flex", gap: "6px" }}>
                                    <button onClick={() => printDoc("Voucher", buildVoucherBody())}
                                        style={{ flex: 1, padding: "8px 4px", border: "1.5px solid #c7d2fe", borderRadius: "10px", fontSize: "9.5px", fontWeight: 800, letterSpacing: "0.3px", cursor: "pointer", background: "linear-gradient(145deg, #eef2ff 0%, #dde3ff 100%)", color: "#4338ca", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "3px", minHeight: "46px", transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)", boxShadow: "0 3px 10px rgba(99,102,241,0.16)" }}
                                        onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-3px) scale(1.02)"; e.currentTarget.style.boxShadow = "0 10px 22px rgba(99,102,241,0.32)"; e.currentTarget.style.background = "linear-gradient(145deg, #e0e7ff 0%, #c7d2fe 100%)"; }}
                                        onMouseOut={(e) => { e.currentTarget.style.transform = "translateY(0) scale(1)"; e.currentTarget.style.boxShadow = "0 3px 10px rgba(99,102,241,0.16)"; e.currentTarget.style.background = "linear-gradient(145deg, #eef2ff 0%, #dde3ff 100%)"; }}>
                                        <FileText size={13} strokeWidth={2.2} />
                                        Voucher
                                    </button>
                                    <button onClick={() => printDoc("Agreement", buildAgreementBody())}
                                        style={{ flex: 1, padding: "8px 4px", border: "1.5px solid #a7f3d0", borderRadius: "10px", fontSize: "9.5px", fontWeight: 800, letterSpacing: "0.3px", cursor: "pointer", background: "linear-gradient(145deg, #f0fdf4 0%, #ccfbe8 100%)", color: "#15803d", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "3px", minHeight: "46px", transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)", boxShadow: "0 3px 10px rgba(16,185,129,0.16)" }}
                                        onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-3px) scale(1.02)"; e.currentTarget.style.boxShadow = "0 10px 22px rgba(16,185,129,0.32)"; e.currentTarget.style.background = "linear-gradient(145deg, #dcfce7 0%, #a7f3d0 100%)"; }}
                                        onMouseOut={(e) => { e.currentTarget.style.transform = "translateY(0) scale(1)"; e.currentTarget.style.boxShadow = "0 3px 10px rgba(16,185,129,0.16)"; e.currentTarget.style.background = "linear-gradient(145deg, #f0fdf4 0%, #ccfbe8 100%)"; }}>
                                        <FileText size={13} strokeWidth={2.2} />
                                        Agreement
                                    </button>
                                    <button onClick={() => navigate(-1)}
                                        style={{ flex: 1, padding: "8px 4px", border: "1.5px solid #e2e8f0", borderRadius: "10px", fontSize: "9.5px", fontWeight: 800, letterSpacing: "0.3px", cursor: "pointer", background: "linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%)", color: "#64748b", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "3px", minHeight: "46px", transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)", boxShadow: "0 3px 10px rgba(100,116,139,0.12)" }}
                                        onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-3px) scale(1.02)"; e.currentTarget.style.boxShadow = "0 10px 22px rgba(220,38,38,0.22)"; e.currentTarget.style.background = "linear-gradient(145deg, #fef2f2 0%, #fee2e2 100%)"; e.currentTarget.style.color = "#dc2626"; e.currentTarget.style.borderColor = "#fecaca"; }}
                                        onMouseOut={(e) => { e.currentTarget.style.transform = "translateY(0) scale(1)"; e.currentTarget.style.boxShadow = "0 3px 10px rgba(100,116,139,0.12)"; e.currentTarget.style.background = "linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%)"; e.currentTarget.style.color = "#64748b"; e.currentTarget.style.borderColor = "#e2e8f0"; }}>
                                        <X size={13} strokeWidth={2.2} />
                                        Discard
                                    </button>
                                    <button onClick={handleDisburse} disabled={!canDisburse || submitting}
                                        style={{ flex: 1.5, padding: "8px 4px", border: "none", borderRadius: "10px", fontSize: "10px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.4px", cursor: canDisburse ? "pointer" : "not-allowed", background: canDisburse ? "linear-gradient(145deg, #3b82f6 0%, #1d4ed8 100%)" : "linear-gradient(145deg, #e2e8f0 0%, #cbd5e1 100%)", color: canDisburse ? "white" : "#94a3b8", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "3px", minHeight: "46px", transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)", boxShadow: canDisburse ? "0 6px 18px rgba(37,99,235,0.45)" : "none" }}
                                        onMouseOver={(e) => { if (canDisburse) { e.currentTarget.style.transform = "translateY(-3px) scale(1.03)"; e.currentTarget.style.boxShadow = "0 12px 26px rgba(37,99,235,0.55)"; e.currentTarget.style.background = "linear-gradient(145deg, #2563eb 0%, #1e3a8a 100%)"; } }}
                                        onMouseOut={(e) => { if (canDisburse) { e.currentTarget.style.transform = "translateY(0) scale(1)"; e.currentTarget.style.boxShadow = "0 6px 18px rgba(37,99,235,0.45)"; e.currentTarget.style.background = "linear-gradient(145deg, #3b82f6 0%, #1d4ed8 100%)"; } }}>
                                        <span style={{ fontSize: "13px", lineHeight: 1 }}>{submitting ? "⏳" : "💰"}</span>
                                        {submitting ? "Processing" : "Disburse"}
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>

                </div>
            </div>
        </div>
    );
};

export default DisburseLoan;
