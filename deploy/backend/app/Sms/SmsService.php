<?php

namespace App\Sms;

use App\Models\Loan;
use App\Models\SmsLog;
use Illuminate\Support\Facades\Log;

/**
 * Single entry point the rest of the app talks to for customer SMS.
 * Resolves the phone number, renders the right Swahili template, sends via
 * the configured gateway, and always logs the attempt to sms_logs.
 *
 * Sending an SMS NEVER throws -- a gateway outage must not roll back a loan
 * disbursement or repayment. Every method returns an SmsResult so a caller
 * that needs to react to delivery (e.g. a "Send Reminder" button reporting
 * back to the staff member) can inspect it; automated triggers fired from
 * inside a bigger transaction (disbursement, repayment) are free to ignore
 * the return value and treat this as fire-and-forget.
 */
class SmsService
{
    public function __construct(protected SmsGatewayInterface $gateway)
    {
    }

    public function sendDisbursementNotice(Loan $loan): SmsResult
    {
        $loan->loadMissing('customer', 'disbursement');

        return $this->dispatch(
            type: 'disbursement',
            phone: $this->resolvePhone($loan),
            message: SmsTemplates::disbursement(
                $loan->name,
                $loan->loan_account_number ?? ('LN-' . $loan->id),
                (float) ($loan->disbursement?->net_amount ?? $loan->amount),
                $loan->next_payment_date,
            ),
            customerId: $loan->customer_id,
            loanId: $loan->id,
        );
    }

    public function sendRepaymentReceipt(array $receipt): SmsResult
    {
        return $this->dispatch(
            type: 'repayment',
            phone: $receipt['phone'] ?? null,
            message: SmsTemplates::repaymentReceived(
                $receipt['customer_name'] ?? 'Mteja',
                $receipt['loan_number'] ?? '--',
                (float) ($receipt['amount_paid'] ?? 0),
                (float) ($receipt['balance_after'] ?? 0),
                $receipt['next_due_date'] ?? null,
                (bool) ($receipt['fully_paid'] ?? false),
            ),
            customerId: $receipt['customer_id'] ?? null,
            loanId: $receipt['loan_id'] ?? null,
        );
    }

    public function sendLoanApproved(Loan $loan): SmsResult
    {
        $loan->loadMissing('customer');

        return $this->dispatch(
            type: 'loan_approved',
            phone: $this->resolvePhone($loan),
            message: SmsTemplates::loanApproved($loan->name, (float) $loan->amount),
            customerId: $loan->customer_id,
            loanId: $loan->id,
        );
    }

    public function sendPaymentReminder(Loan $loan, float $amountDue, ?string $dueDate): SmsResult
    {
        $loan->loadMissing('customer');

        return $this->dispatch(
            type: 'payment_reminder',
            phone: $this->resolvePhone($loan),
            message: SmsTemplates::paymentReminder(
                $loan->name,
                $loan->loan_account_number ?? ('LN-' . $loan->id),
                $amountDue,
                $dueDate,
            ),
            customerId: $loan->customer_id,
            loanId: $loan->id,
        );
    }

    public function sendPaymentOverdue(Loan $loan, float $amountOverdue, int $daysOverdue): SmsResult
    {
        $loan->loadMissing('customer');

        return $this->dispatch(
            type: 'payment_overdue',
            phone: $this->resolvePhone($loan),
            message: SmsTemplates::paymentOverdue(
                $loan->name,
                $loan->loan_account_number ?? ('LN-' . $loan->id),
                $amountOverdue,
                $daysOverdue,
            ),
            customerId: $loan->customer_id,
            loanId: $loan->id,
        );
    }

    /**
     * Notifies every guarantor on file for this loan that the client has
     * missed a repayment, once a missed installment is detected. Returns
     * one SmsResult per guarantor actually found and sent to (empty array
     * if the loan has no guarantor name+phone on record -- e.g. Employee
     * Loans, which collect no guarantor details at all).
     *
     * @return SmsResult[]
     */
    public function sendGuarantorOverdueNotices(Loan $loan, float $penaltyPercentage): array
    {
        $loan->loadMissing('customer');

        $results = [];
        foreach ($this->extractGuarantors($loan) as $guarantor) {
            $results[] = $this->dispatch(
                type: 'guarantor_overdue',
                phone: $guarantor['phone'],
                message: SmsTemplates::guarantorOverdueNotice($guarantor['name'], $loan->name, $penaltyPercentage),
                customerId: $loan->customer_id,
                loanId: $loan->id,
            );
        }

        return $results;
    }

    /**
     * Pre-due reminder: $daysLeft=3 → 3-day warning; $daysLeft=0 → due-today alert.
     */
    public function sendPaymentReminderPreDue(Loan $loan, \App\Models\LoanSchedule $schedule, int $daysLeft): SmsResult
    {
        $loan->loadMissing('customer');
        $loanNo  = $loan->loan_account_number ?? ('LN-' . $loan->id);
        $dueDate = $schedule->due_date instanceof \Carbon\Carbon
            ? $schedule->due_date->toDateString()
            : (string) $schedule->due_date;

        $message = $daysLeft > 0
            ? SmsTemplates::paymentReminder3Days($loan->name, $loanNo, (float) $schedule->total_amount, $dueDate)
            : SmsTemplates::paymentReminderToday($loan->name, $loanNo, (float) $schedule->total_amount, $dueDate);

        return $this->dispatch(
            type: $daysLeft > 0 ? 'payment_reminder_3days' : 'payment_reminder_today',
            phone: $this->resolvePhone($loan),
            message: $message,
            customerId: $loan->customer_id,
            loanId: $loan->id,
        );
    }

    /**
     * Daily guarantor penalty-update SMS; one result per guarantor found.
     *
     * @return SmsResult[]
     */
    public function sendGuarantorPenaltyUpdate(Loan $loan, \App\Models\LoanSchedule $schedule): array
    {
        $loan->loadMissing('customer');
        $loanNo        = $loan->loan_account_number ?? ('LN-' . $loan->id);
        $overdueAmount = max(0.0, (float) $schedule->total_amount - (float) $schedule->amount_paid);

        $results = [];
        foreach ($this->extractGuarantors($loan) as $guarantor) {
            $results[] = $this->dispatch(
                type: 'guarantor_penalty_update',
                phone: $guarantor['phone'],
                message: SmsTemplates::guarantorPenaltyUpdate(
                    $guarantor['name'],
                    $loan->name,
                    $loanNo,
                    $overdueAmount,
                    (float) $schedule->penalty_amount,
                    (int)   $schedule->penalty_days,
                ),
                customerId: $loan->customer_id,
                loanId: $loan->id,
            );
        }
        return $results;
    }

    /** SMS to the next approver when a payment request is submitted or advanced. */
    public function sendPaymentRequestPending(\App\Models\User $approver, \App\Models\PaymentRequest $pr): SmsResult
    {
        return $this->dispatch(
            type: 'payment_request_pending',
            phone: $approver->phone ?? null,
            message: SmsTemplates::paymentRequestPending($approver->name, $pr->applicant_name, (float) $pr->final_amount, $pr->payable_to),
            customerId: null,
            loanId: null,
            paymentRequestId: $pr->id,
        );
    }

    /** SMS to the applicant when their payment request is fully disbursed. */
    public function sendPaymentRequestDisbursed(\App\Models\User $applicant, \App\Models\PaymentRequest $pr): SmsResult
    {
        return $this->dispatch(
            type: 'payment_request_disbursed',
            phone: $applicant->phone ?? null,
            message: SmsTemplates::paymentRequestDisbursed($applicant->name, (float) $pr->final_amount, $pr->payable_to),
            customerId: null,
            loanId: null,
            paymentRequestId: $pr->id,
        );
    }

    /** SMS to the applicant when their payment request is rejected. */
    public function sendPaymentRequestRejected(\App\Models\User $applicant, \App\Models\PaymentRequest $pr, string $reason): SmsResult
    {
        return $this->dispatch(
            type: 'payment_request_rejected',
            phone: $applicant->phone ?? null,
            message: SmsTemplates::paymentRequestRejected($applicant->name, (float) $pr->amount, $reason),
            customerId: null,
            loanId: null,
            paymentRequestId: $pr->id,
        );
    }

    /** SMS to the next approver when a leave request is submitted or advanced. */
    public function sendLeaveRequestPending(\App\Models\User $approver, \App\Models\LeaveRequest $lr): SmsResult
    {
        $from = $lr->from_date instanceof \Carbon\Carbon ? $lr->from_date->format('d/m/Y') : (string) $lr->from_date;
        $to   = $lr->to_date instanceof \Carbon\Carbon   ? $lr->to_date->format('d/m/Y')   : (string) $lr->to_date;
        return $this->dispatch(
            type: 'leave_request_pending',
            phone: $approver->phone ?? null,
            message: SmsTemplates::leaveRequestPending($approver->name, $lr->employee_name, $lr->absence_type, $from, $to),
            customerId: null,
            loanId: null,
            leaveRequestId: $lr->id,
        );
    }

    /** SMS to the applicant when their leave is fully authorized. */
    public function sendLeaveRequestAuthorized(\App\Models\User $applicant, \App\Models\LeaveRequest $lr): SmsResult
    {
        $from = $lr->from_date instanceof \Carbon\Carbon ? $lr->from_date->format('d/m/Y') : (string) $lr->from_date;
        $to   = $lr->to_date instanceof \Carbon\Carbon   ? $lr->to_date->format('d/m/Y')   : (string) $lr->to_date;
        return $this->dispatch(
            type: 'leave_request_authorized',
            phone: $applicant->phone ?? null,
            message: SmsTemplates::leaveRequestAuthorized($applicant->name, $from, $to),
            customerId: null,
            loanId: null,
            leaveRequestId: $lr->id,
        );
    }

    /** SMS to the applicant when their leave request is rejected. */
    public function sendLeaveRequestRejected(\App\Models\User $applicant, \App\Models\LeaveRequest $lr, string $reason): SmsResult
    {
        return $this->dispatch(
            type: 'leave_request_rejected',
            phone: $applicant->phone ?? null,
            message: SmsTemplates::leaveRequestRejected($applicant->name, $reason),
            customerId: null,
            loanId: null,
            leaveRequestId: $lr->id,
        );
    }

    /** SMS to Loan Manager(s) when a Branch Report is submitted for approval. */
    public function sendBranchReportPending(\App\Models\User $lm, \App\Models\BranchReport $report, \App\Models\User $submitter): SmsResult
    {
        $period = \Carbon\Carbon::parse($report->period_start)->format('d/m/Y');
        return $this->dispatch(
            type: 'branch_report_pending',
            phone: $lm->phone ?? null,
            message: SmsTemplates::branchReportPending(
                $lm->name,
                $submitter->name,
                $report->branch ?? '--',
                $report->report_type,
                $period,
            ),
            customerId: null,
            loanId: null,
            branchReportId: $report->id,
        );
    }

    /** SMS to the original submitter when their Branch Report is rejected. */
    public function sendBranchReportRejected(\App\Models\User $submitter, \App\Models\BranchReport $report, string $rejectorName, string $reason): SmsResult
    {
        $period = \Carbon\Carbon::parse($report->period_start)->format('d/m/Y');
        return $this->dispatch(
            type: 'branch_report_rejected',
            phone: $submitter->phone ?? null,
            message: SmsTemplates::branchReportRejected(
                $submitter->name,
                $report->branch ?? '--',
                $report->report_type,
                $period,
                $rejectorName,
                $reason,
            ),
            customerId: null,
            loanId: null,
            branchReportId: $report->id,
        );
    }

    /** SMS to the original submitter when their Branch Report is approved. */
    public function sendBranchReportApproved(\App\Models\User $submitter, \App\Models\BranchReport $report, string $approverName): SmsResult
    {
        $period = \Carbon\Carbon::parse($report->period_start)->format('d/m/Y');
        return $this->dispatch(
            type: 'branch_report_approved',
            phone: $submitter->phone ?? null,
            message: SmsTemplates::branchReportApproved(
                $submitter->name,
                $report->branch ?? '--',
                $report->report_type,
                $period,
                $approverName,
            ),
            customerId: null,
            loanId: null,
            branchReportId: $report->id,
        );
    }

    /**
     * Generic send for ad-hoc messages (user management, system notifications).
     * Uses type 'system' for logging.
     */
    public function send(string $phone, string $message): SmsResult
    {
        return $this->dispatch(
            type: 'system',
            phone: $phone,
            message: $message,
            customerId: null,
            loanId: null,
        );
    }

    /**
     * OTP via SMS -- used for forgot-password and first-login verification.
     * $context: 'forgot_password' | 'first_login'
     */
    public function sendOtp(\App\Models\User $user, string $otp, string $context = 'otp'): SmsResult
    {
        $phone = $user->phone ?? null;
        return $this->dispatch(
            type: 'otp_' . $context,
            phone: $phone,
            message: SmsTemplates::otp($user->name, $otp, $context),
            customerId: null,
            loanId: null,
        );
    }

    /** SMS to the borrower confirming their loan application was received. */
    public function sendLoanApplicationReceived(Loan $loan): SmsResult
    {
        $loan->loadMissing('customer');
        return $this->dispatch(
            type: 'loan_application_received',
            phone: $this->resolvePhone($loan),
            message: SmsTemplates::loanApplicationReceived(
                $loan->name,
                $loan->loan_account_number ?? ('LN-' . $loan->id),
                (float) $loan->amount,
            ),
            customerId: $loan->customer_id,
            loanId: $loan->id,
        );
    }

    /**
     * Notify all users of a given role that a loan needs their review.
     * Sends one SMS per matching user who has a phone number.
     *
     * @return SmsResult[]
     */
    public function notifyRoleAboutLoan(string $role, Loan $loan, string $templateMethod): array
    {
        $loanNo = $loan->loan_account_number ?? ('LN-' . $loan->id);
        $amount = (float) $loan->amount;
        $applicant = $loan->name;

        $results = [];
        $users = \App\Models\User::where('role', $role)->whereNotNull('phone')->get();
        foreach ($users as $user) {
            $message = SmsTemplates::$templateMethod($user->name, $applicant, $amount, $loanNo);
            $results[] = $this->dispatch(
                type: "loan_pending_{$role}",
                phone: $user->phone,
                message: $message,
                customerId: $loan->customer_id,
                loanId: $loan->id,
            );
        }
        return $results;
    }

    /** SMS to the borrower when their loan application is rejected at any stage. */
    public function sendLoanRejected(Loan $loan, string $reason = ''): SmsResult
    {
        $loan->loadMissing('customer');
        return $this->dispatch(
            type: 'loan_rejected',
            phone: $this->resolvePhone($loan),
            message: SmsTemplates::loanRejected(
                $loan->name,
                $loan->loan_account_number ?? ('LN-' . $loan->id),
                $reason,
            ),
            customerId: $loan->customer_id,
            loanId: $loan->id,
        );
    }

    /**
     * Reads guarantor name+phone pairs out of the loan's free-form `details`
     * JSON. Field prefix differs by loan type: PersonalLoan.tsx writes
     * wdhamini1/2*, GroupLoan.tsx writes mdhamini1/2* -- both follow the same
     * {prefix}{n}JinaKamili / {prefix}{n}Simu naming. Employee Loans collect
     * no guarantor details, so this returns an empty array for those.
     *
     * @return array<int, array{name: string, phone: string}>
     */
    protected function extractGuarantors(Loan $loan): array
    {
        $details = $loan->details ?? [];
        $prefix = $loan->type === 'group' ? 'mdhamini' : 'wdhamini';

        $guarantors = [];
        foreach ([1, 2] as $n) {
            $name = $details["{$prefix}{$n}JinaKamili"] ?? null;
            $phone = $details["{$prefix}{$n}Simu"] ?? null;
            if ($name && $phone) {
                $guarantors[] = ['name' => $name, 'phone' => $phone];
            }
        }

        return $guarantors;
    }

    protected function resolvePhone(Loan $loan): ?string
    {
        return $loan->customer?->phone_number ?: $loan->phone;
    }

    protected function dispatch(
        string $type,
        ?string $phone,
        string $message,
        ?int $customerId,
        ?int $loanId,
        ?int $paymentRequestId = null,
        ?int $leaveRequestId = null,
        ?int $branchReportId = null,
    ): SmsResult {
        $normalized = PhoneNumber::normalize($phone, config('sms.country_code', '255'));

        if (!PhoneNumber::isValid($normalized)) {
            $result = SmsResult::failed('Invalid or missing phone number');
            $this->log($type, $phone ?? 'unknown', $message, $result, $customerId, $loanId, $paymentRequestId, $leaveRequestId, $branchReportId);
            return $result;
        }

        if (!config('sms.enabled', true)) {
            $result = SmsResult::disabled();
            $this->log($type, $normalized, $message, $result, $customerId, $loanId, $paymentRequestId, $leaveRequestId, $branchReportId);
            return $result;
        }

        try {
            $result = $this->gateway->send($normalized, $message);
        } catch (\Throwable $e) {
            Log::error("SmsService [{$type}] send error: " . $e->getMessage());
            $result = SmsResult::failed($e->getMessage());
        }

        $this->log($type, $normalized, $message, $result, $customerId, $loanId, $paymentRequestId, $leaveRequestId, $branchReportId);
        return $result;
    }

    protected function log(
        string $type,
        string $phone,
        string $message,
        SmsResult $result,
        ?int $customerId,
        ?int $loanId,
        ?int $paymentRequestId = null,
        ?int $leaveRequestId = null,
        ?int $branchReportId = null,
    ): void {
        try {
            $status = match(true) {
                $result->success   => 'sent',
                $result->disabled  => 'disabled',
                default            => 'failed',
            };

            SmsLog::create([
                'customer_id'         => $customerId,
                'loan_id'             => $loanId,
                'payment_request_id'  => $paymentRequestId,
                'leave_request_id'    => $leaveRequestId,
                'branch_report_id'    => $branchReportId,
                'phone'               => $phone,
                'type'                => $type,
                'message'             => $message,
                'status'              => $status,
                'provider_message_id' => $result->providerMessageId,
                'provider_response'   => $result->rawResponse,
                'error'               => $result->error,
            ]);
        } catch (\Throwable $e) {
            // Logging the SMS attempt must never itself break the caller.
            Log::error('SmsService failed to write sms_logs row: ' . $e->getMessage());
        }

        if (!$result->success) {
            Log::warning("SMS [{$type}] to {$phone} failed: " . ($result->error ?? 'unknown error'));
        }
    }
}
