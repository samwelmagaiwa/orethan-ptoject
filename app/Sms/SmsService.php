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
 * Sending an SMS NEVER throws — a gateway outage must not roll back a loan
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
                $receipt['loan_number'] ?? '—',
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
     * if the loan has no guarantor name+phone on record — e.g. Employee
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
     * Reads guarantor name+phone pairs out of the loan's free-form `details`
     * JSON. Field prefix differs by loan type: PersonalLoan.tsx writes
     * wdhamini1/2*, GroupLoan.tsx writes mdhamini1/2* — both follow the same
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

    protected function dispatch(string $type, ?string $phone, string $message, ?int $customerId, ?int $loanId): SmsResult
    {
        $normalized = PhoneNumber::normalize($phone, config('sms.country_code', '255'));

        if (!PhoneNumber::isValid($normalized)) {
            $result = SmsResult::failed('Invalid or missing phone number');
            $this->log($type, $phone ?? 'unknown', $message, $result, $customerId, $loanId);
            return $result;
        }

        if (!config('sms.enabled', true)) {
            $result = SmsResult::failed('SMS gateway disabled (SMS_ENABLED=false)');
            $this->log($type, $normalized, $message, $result, $customerId, $loanId);
            return $result;
        }

        try {
            $result = $this->gateway->send($normalized, $message);
        } catch (\Throwable $e) {
            Log::error("SmsService [{$type}] send error: " . $e->getMessage());
            $result = SmsResult::failed($e->getMessage());
        }

        $this->log($type, $normalized, $message, $result, $customerId, $loanId);
        return $result;
    }

    protected function log(string $type, string $phone, string $message, SmsResult $result, ?int $customerId, ?int $loanId): void
    {
        try {
            SmsLog::create([
                'customer_id' => $customerId,
                'loan_id' => $loanId,
                'phone' => $phone,
                'type' => $type,
                'message' => $message,
                'status' => $result->success ? 'sent' : 'failed',
                'provider_message_id' => $result->providerMessageId,
                'provider_response' => $result->rawResponse,
                'error' => $result->error,
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
