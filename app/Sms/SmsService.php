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
                $loan->loan_account_number,
                (float) $loan->amount,
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

    /**
     * Notify LM, GM, and MD that a repayment has been recorded.
     * Fired after every successful repayment so management sees real-time cash flow.
     */
    public function sendRepaymentNoticeToStaff(array $receipt): void
    {
        $roleLabels = [
            'loan_manager'      => 'Meneja wa Mikopo',
            'general_manager'   => 'Mkurugenzi Mkuu',
            'managing_director' => 'Mkurugenzi Mtendaji',
        ];

        $customerName = $receipt['customer_name'] ?? 'Mteja';
        $loanNumber   = $receipt['loan_number'] ?? '--';
        $amountPaid   = (float) ($receipt['amount_paid'] ?? 0);
        $balanceAfter = (float) ($receipt['balance_after'] ?? 0);
        $fullyPaid    = (bool) ($receipt['fully_paid'] ?? false);
        $loanId       = $receipt['loan_id'] ?? null;
        $customerId   = $receipt['customer_id'] ?? null;

        foreach ($roleLabels as $role => $label) {
            $users = \App\Models\User::where('role', $role)->whereNotNull('phone')->get();
            foreach ($users as $staffUser) {
                try {
                    $this->dispatch(
                        type: 'repayment_staff_notice',
                        phone: $staffUser->phone,
                        message: SmsTemplates::repaymentRecordedStaff($label, $customerName, $loanNumber, $amountPaid, $balanceAfter, $fullyPaid),
                        customerId: $customerId,
                        loanId: $loanId,
                    );
                } catch (\Throwable) {
                    // Staff SMS failure must never affect the repayment flow
                }
            }
        }
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
                $loan->loan_account_number,
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
                $loan->loan_account_number,
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
    public function sendGuarantorOverdueNotices(Loan $loan, float $dailyPenaltyAmount): array
    {
        $loan->loadMissing('customer');

        $remainingBalance = (float) $loan->remaining_balance;

        $results = [];
        foreach ($this->extractGuarantors($loan) as $guarantor) {
            $results[] = $this->dispatch(
                type: 'guarantor_overdue',
                phone: $guarantor['phone'],
                message: SmsTemplates::guarantorOverdueNotice($guarantor['name'], $loan->name, $dailyPenaltyAmount, $remainingBalance),
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
        $loanNo  = $loan->loan_account_number;
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
        $loanNo        = $loan->loan_account_number;
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
        $applicantRoleLabel = SmsTemplates::roleLabel($pr->applicant_role ?? 'loan_officer');
        return $this->dispatch(
            type: 'payment_request_pending',
            phone: $approver->phone ?? null,
            message: SmsTemplates::paymentRequestPending(
                SmsTemplates::roleLabel($approver->role),
                $applicantRoleLabel,
                (float) $pr->final_amount,
                $pr->payable_to,
            ),
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
            message: SmsTemplates::paymentRequestDisbursed(
                SmsTemplates::roleLabel($applicant->role),
                (float) $pr->final_amount,
                $pr->payable_to,
                $pr->voucher_number ?? $pr->cashier_reference ?? null,
                $pr->cashier_name ?? null,
            ),
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
            message: SmsTemplates::paymentRequestRejected(
                SmsTemplates::roleLabel($applicant->role),
                (float) $pr->amount,
                $reason,
            ),
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
        $employeeRoleLabel = $lr->employee_role ? SmsTemplates::roleLabel($lr->employee_role) : ($lr->employee_name ?? 'Mwajiriwa');
        return $this->dispatch(
            type: 'leave_request_pending',
            phone: $approver->phone ?? null,
            message: SmsTemplates::leaveRequestPending(
                SmsTemplates::roleLabel($approver->role),
                $employeeRoleLabel,
                $lr->absence_type,
                $from,
                $to,
            ),
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
            message: SmsTemplates::leaveRequestAuthorized(SmsTemplates::roleLabel($applicant->role), $from, $to),
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
            message: SmsTemplates::leaveRequestRejected(SmsTemplates::roleLabel($applicant->role), $reason),
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
                SmsTemplates::roleLabel($lm->role),
                SmsTemplates::roleLabel($submitter->role),
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
    public function sendBranchReportRejected(\App\Models\User $submitter, \App\Models\BranchReport $report, \App\Models\User $rejector, string $reason): SmsResult
    {
        $period = \Carbon\Carbon::parse($report->period_start)->format('d/m/Y');
        return $this->dispatch(
            type: 'branch_report_rejected',
            phone: $submitter->phone ?? null,
            message: SmsTemplates::branchReportRejected(
                SmsTemplates::roleLabel($submitter->role),
                $report->branch ?? '--',
                $report->report_type,
                $period,
                SmsTemplates::roleLabel($rejector->role),
                $reason,
            ),
            customerId: null,
            loanId: null,
            branchReportId: $report->id,
        );
    }

    /** SMS to the original submitter when their Branch Report is approved. */
    public function sendBranchReportApproved(\App\Models\User $submitter, \App\Models\BranchReport $report, \App\Models\User $approver): SmsResult
    {
        $period = \Carbon\Carbon::parse($report->period_start)->format('d/m/Y');
        return $this->dispatch(
            type: 'branch_report_approved',
            phone: $submitter->phone ?? null,
            message: SmsTemplates::branchReportApproved(
                SmsTemplates::roleLabel($submitter->role),
                $report->branch ?? '--',
                $report->report_type,
                $period,
                SmsTemplates::roleLabel($approver->role),
            ),
            customerId: null,
            loanId: null,
            branchReportId: $report->id,
        );
    }

    /** SMS when GM/MD returns an approved report to LM or original submitter. */
    public function sendBranchReportReturned(\App\Models\User $recipient, \App\Models\BranchReport $report, \App\Models\User $returner, string $stageLabel, string $reason): SmsResult
    {
        $period = \Carbon\Carbon::parse($report->period_start)->format('d/m/Y');
        return $this->dispatch(
            type: 'branch_report_returned',
            phone: $recipient->phone ?? null,
            message: SmsTemplates::branchReportReturned(
                SmsTemplates::roleLabel($recipient->role),
                $report->branch ?? '--',
                $report->report_type,
                $period,
                SmsTemplates::roleLabel($returner->role),
                $stageLabel,
                $reason,
            ),
            customerId: null,
            loanId: null,
            branchReportId: $report->id,
        );
    }

    /**
     * Notify all staff roles (not the customer) that a historical loan has been
     * imported into the system. Sends one SMS per staff user with a phone number.
     *
     * @return SmsResult[]
     */
    public function sendHistoricalLoanStaffNotice(Loan $loan, \App\Models\User $submitter): array
    {
        $loanNo      = $loan->loan_account_number;
        $disbursedAt = $loan->disbursed_at instanceof \Carbon\Carbon
            ? $loan->disbursed_at->toDateString()
            : (string) $loan->disbursed_at;

        $roleLabels = [
            'loan_officer'      => 'Afisa Mikopo',
            'loan_manager'      => 'Meneja wa Mikopo',
            'general_manager'   => 'Mkurugenzi Mkuu',
            'managing_director' => 'Mkurugenzi Mtendaji',
            'admin'             => 'Msimamizi',
        ];

        $staffRoles = ['loan_officer', 'loan_manager', 'general_manager', 'managing_director', 'admin'];
        $users      = \App\Models\User::whereIn('role', $staffRoles)->whereNotNull('phone')->get();

        $results = [];
        foreach ($users as $user) {
            $staffLabel = $roleLabels[$user->role] ?? ucfirst(str_replace('_', ' ', $user->role));
            $results[] = $this->dispatch(
                type: 'historical_loan_import',
                phone: $user->phone,
                message: SmsTemplates::historicalLoanStaffNotice(
                    $staffLabel,
                    $loan->name,
                    $loanNo,
                    (float) $loan->amount,
                    (float) $loan->remaining_balance,
                    $disbursedAt,
                    $roleLabels[$submitter->role] ?? ucfirst(str_replace('_', ' ', $submitter->role)),
                ),
                customerId: $loan->customer_id,
                loanId: $loan->id,
            );
        }
        return $results;
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
                $loan->loan_account_number,
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
        $loanNo = $loan->loan_account_number;
        $amount = (float) $loan->amount;
        $applicant = $loan->name;

        $roleLabels = [
            'loan_manager'      => 'Meneja wa Mikopo',
            'general_manager'   => 'Mkurugenzi Mkuu',
            'managing_director' => 'Mkurugenzi Mtendaji',
            'admin'             => 'Msimamizi',
            'loan_officer'      => 'Afisa Mikopo',
            'accountant'        => 'Mhasibu',
            'cashier'           => 'Kasisi',
        ];
        $roleLabel = $roleLabels[$role] ?? ucfirst(str_replace('_', ' ', $role));

        $results = [];
        $users = \App\Models\User::where('role', $role)->whereNotNull('phone')->get();
        foreach ($users as $user) {
            $message = SmsTemplates::$templateMethod($roleLabel, $applicant, $amount, $loanNo);
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
                $loan->loan_account_number,
                $reason,
            ),
            customerId: $loan->customer_id,
            loanId: $loan->id,
        );
    }

    /**
     * SMS to the staff member whose submission was returned for corrections.
     * $statusBeforeReject is the loan status BEFORE rejectLoan() changed it.
     *   manager_review → notify the loan officer ($loan->user)
     *   gm_review      → notify all users with role='manager'
     *   md_review      → notify all users with role='general_manager'
     */
    public function sendLoanReturnedToStaff(Loan $loan, string $statusBeforeReject, string $reason = ''): void
    {
        $loan->loadMissing('user');
        $loanNo = $loan->loan_account_number;
        $applicant = $loan->name;

        if ($statusBeforeReject === 'manager_review') {
            // Returned to the individual loan officer who submitted it
            $officer = $loan->user;
            if ($officer && $officer->phone) {
                $this->dispatch(
                    type: 'loan_returned_to_staff',
                    phone: $officer->phone,
                    message: SmsTemplates::loanReturnedToStaff(SmsTemplates::roleLabel($officer->role), $applicant, $loanNo, $reason),
                    customerId: $loan->customer_id,
                    loanId: $loan->id,
                );
            }
        } elseif ($statusBeforeReject === 'gm_review') {
            // Returned to all loan managers
            $users = \App\Models\User::where('role', 'loan_manager')->whereNotNull('phone')->get();
            foreach ($users as $u) {
                $this->dispatch(
                    type: 'loan_returned_to_staff',
                    phone: $u->phone,
                    message: SmsTemplates::loanReturnedToStaff(SmsTemplates::roleLabel($u->role), $applicant, $loanNo, $reason),
                    customerId: $loan->customer_id,
                    loanId: $loan->id,
                );
            }
        } elseif ($statusBeforeReject === 'md_review') {
            // Returned to all general managers
            $users = \App\Models\User::where('role', 'general_manager')->whereNotNull('phone')->get();
            foreach ($users as $u) {
                $this->dispatch(
                    type: 'loan_returned_to_staff',
                    phone: $u->phone,
                    message: SmsTemplates::loanReturnedToStaff(SmsTemplates::roleLabel($u->role), $applicant, $loanNo, $reason),
                    customerId: $loan->customer_id,
                    loanId: $loan->id,
                );
            }
        }
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

    /** Send a raw free-form message (used by escalation, admin notifications). */
    public function sendRaw(string $phone, string $message): void
    {
        if (empty(trim($phone))) return;
        $this->send($phone, $message);
    }
}
