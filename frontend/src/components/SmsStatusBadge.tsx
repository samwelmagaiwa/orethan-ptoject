interface Props {
  status?: string | null; // "sent" | "failed" | null (no SMS sent yet for this loan)
  type?: string | null;
}

const SMS_TYPE_LABELS: Record<string, string> = {
  disbursement: "Disbursement",
  repayment: "Repayment Receipt",
  loan_approved: "Loan Approved",
  payment_reminder: "Payment Reminder",
  payment_overdue: "Payment Overdue",
  guarantor_overdue: "Guarantor Notice",
};

/** Shows the most recent automated SMS attempt for a loan -- sent, failed, or none yet. */
const SmsStatusBadge = ({ status, type }: Props) => {
  const label = type ? (SMS_TYPE_LABELS[type] || type) : "";

  if (!status) {
    return (
      <span className="smsb smsb--none" title="No SMS has been sent for this loan yet">
        -- No SMS
      </span>
    );
  }

  if (status === "sent") {
    return (
      <span className="smsb smsb--sent" title={label || "SMS sent"}>
        ✓ Sent{label ? ` · ${label}` : ""}
      </span>
    );
  }

  return (
    <span className="smsb smsb--failed" title={label || "SMS failed"}>
      ✗ Failed{label ? ` · ${label}` : ""}
    </span>
  );
};

export default SmsStatusBadge;

export const smsStatusBadgeStyles = `
  .smsb { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 14px; font-size: 0.66rem; font-weight: 800; white-space: nowrap; }
  .smsb--sent { background: #ecfdf5; color: #059669; }
  .smsb--failed { background: #fef2f2; color: #dc2626; }
  .smsb--none { background: #f1f5f9; color: #94a3b8; }
`;
