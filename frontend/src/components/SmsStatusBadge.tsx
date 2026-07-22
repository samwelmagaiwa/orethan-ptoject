interface Props {
  status?: string | null;
  type?: string | null;
}

const SMS_TYPE_LABELS: Record<string, string> = {
  // Loan lifecycle
  disbursement:                    "Disbursement",
  repayment:                       "Repayment Receipt",
  loan_approved:                   "Loan Approved",
  loan_rejected:                   "Loan Rejected",
  loan_application_received:       "Application Received",
  // Reminders
  payment_reminder:                "Payment Reminder",
  payment_reminder_3days:          "Reminder (3 days)",
  payment_reminder_today:          "Reminder (due today)",
  payment_overdue:                 "Payment Overdue",
  // Guarantors
  guarantor_overdue:               "Guarantor Notice",
  guarantor_penalty_update:        "Guarantor Penalty",
  // Loan review pipeline
  loan_pending_loan_manager:       "Pending LM Review",
  loan_pending_general_manager:    "Pending GM Review",
  loan_pending_managing_director:  "Pending MD Review",
  // Payment requests
  payment_request_pending:         "Payment Req. Pending",
  payment_request_disbursed:       "Payment Req. Paid",
  payment_request_rejected:        "Payment Req. Rejected",
  // Leave requests
  leave_request_pending:           "Leave Pending",
  leave_request_authorized:        "Leave Authorized",
  leave_request_rejected:          "Leave Rejected",
  // Branch reports
  branch_report_pending:           "Report Pending",
  branch_report_approved:          "Report Approved",
  branch_report_rejected:          "Report Rejected",
  // OTP
  otp_first_login:                 "OTP (First Login)",
  otp_forgot_password:             "OTP (Password Reset)",
};

/** Shows the most recent automated SMS attempt for a loan/workflow item. */
const SmsStatusBadge = ({ status, type }: Props) => {
  const label = type ? (SMS_TYPE_LABELS[type] || type.replace(/_/g, " ")) : "";

  if (!status) {
    return (
      <span className="smsb smsb--none" title="No SMS has been sent yet">
        -- No SMS
      </span>
    );
  }

  if (status === "sent" || status === "delivered") {
    const confirmed = status === "delivered";
    return (
      <span className="smsb smsb--sent" title={confirmed ? `Delivered (confirmed)${label ? ` · ${label}` : ""}` : label || "SMS sent"}>
        ✓ {confirmed ? "Delivered ✓" : "Delivered"}{label ? ` · ${label}` : ""}
      </span>
    );
  }

  if (status === "disabled") {
    return (
      <span className="smsb smsb--none" title="SMS is disabled in system settings">
        -- Disabled
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
