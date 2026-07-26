<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Loan;
use App\Models\LoanApproval;
use App\Models\LoanDisbursement;
use App\Models\Repayment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class HistoricalLoanService
{
    public function __construct(
        protected AccountingService $accounting,
        protected \App\Sms\SmsService $sms
    ) {}

    /**
     * Import a historical (pre-system) loan into the system.
     *
     * Accepted $data keys:
     *   customer_id?         int     — existing customer (optional)
     *   customer_name        string
     *   customer_phone       string
     *   amount               float   — original principal
     *   interest_rate        float   — annual % (e.g. 3.0)
     *   term_months          int
     *   repayment_frequency  string  — Monthly | Weekly | Bi-Weekly | Daily | Quarterly
     *   disbursed_at         string  — Y-m-d (original disbursement date)
     *   employment           string? — 'Ndio' | 'Hapana'
     *   guarantor_1_name?    string
     *   guarantor_1_phone?   string
     *   guarantor_2_name?    string
     *   guarantor_2_phone?   string
     *   payments             array   — [{date: Y-m-d, amount: float}] already-made payments
     */
    public function import(array $data, User $submitter): Loan
    {
        $loan = DB::transaction(function () use ($data, $submitter) {
            // 1. Resolve customer
            $customer = $this->resolveCustomer($data);

            // 2. Build details JSON — mirrors PersonalLoan form so all downstream
            //    logic (guarantor SMS, schedule, account number) works identically.
            $details = [
                'kwaTarakimu'         => $data['term_months'],
                'kiwakocha_Riba'      => $data['interest_rate'],
                'repayment_frequency' => $data['repayment_frequency'],
                'umeajiriwa'          => $data['employment'] ?? 'Hapana',
                // Guarantors (prefix wdhamini so SmsService::extractGuarantors picks them up)
                'wdhamini1JinaKamili' => $data['guarantor_1_name'] ?? null,
                'wdhamini1Simu'       => $data['guarantor_1_phone'] ?? null,
                'wdhamini2JinaKamili' => $data['guarantor_2_name'] ?? null,
                'wdhamini2Simu'       => $data['guarantor_2_phone'] ?? null,
            ];

            $disbursedAt = Carbon::parse($data['disbursed_at']);

            // 3. Create loan in disbursed state (bypasses approval flow)
            $loan = Loan::create([
                'name'              => $customer->full_name,
                'phone'             => $customer->phone_number,
                'amount'            => $data['amount'],
                'type'              => 'individual',
                'status'            => 'disbursed',
                'payment_status'    => 'pending',
                'is_historical'     => true,
                'approved_at'       => $disbursedAt,
                'disbursed_at'      => $disbursedAt,
                'approved_by'       => $submitter->name,
                'customer_id'       => $customer->id,
                'user_id'           => $submitter->id,
                'details'           => $details,
                'remaining_balance' => $data['amount'],
                'total_paid'        => 0,
            ]);

            // Generate account number (uses created_at — the import timestamp — as origination date)
            $loan->loan_account_number = $loan->generateAccountNumber();
            $loan->save();

            // 4. Create disbursement record (required by finance/repayment pages)
            $seq   = str_pad((string) $loan->id, 5, '0', STR_PAD_LEFT);
            $stamp = $disbursedAt->format('Ymd');
            LoanDisbursement::create([
                'loan_id'           => $loan->id,
                'disbursement_date' => $disbursedAt->toDateString(),
                'amount'            => $data['amount'],
                'net_amount'        => $data['amount'],
                'total_charges'     => 0,
                'processing_fee'    => 0,
                'insurance_fee'     => 0,
                'other_charges'     => 0,
                'method'            => 'historical',
                'voucher_number'    => 'HIST-' . $stamp . '-' . $seq,
                'receipt_number'    => 'HIST-RCP-' . $stamp . '-' . $seq,
                'narration'         => 'Historical loan import — pre-system record',
                'disbursed_by'      => $submitter->id,
            ]);

            // 5. Generate full repayment schedule from original disbursement date
            $interestRate = (float) $data['interest_rate'] / 100;
            $loan->generateSchedule(
                (int) $data['term_months'],
                $interestRate,
                $data['repayment_frequency'],
                $disbursedAt
            );

            // 6. Apply each historical payment: mark schedules paid, create Repayment records.
            //    No GL posting here — the opening balance entry (step 8) covers the net balance.
            $totalPaid = 0.0;
            foreach (($data['payments'] ?? []) as $payment) {
                $amount = (float) $payment['amount'];
                if ($amount <= 0) continue;
                $this->applyHistoricalPayment($loan, $payment['date'], $amount, $submitter);
                $totalPaid += $amount;
            }

            // 7. Recalculate loan totals from actual unpaid schedule balances
            //    (uses total_amount − amount_paid per installment so interest is included)
            $remaining = (float) $loan->schedules()
                ->where('status', '!=', 'paid')
                ->sum(DB::raw('total_amount - COALESCE(amount_paid, 0)'));
            $remaining = round(max(0, $remaining), 2);

            $loan->total_paid        = round($totalPaid, 2);
            $loan->remaining_balance = $remaining;

            if ($remaining <= 0) {
                $loan->payment_status = 'completed';
                $loan->status         = 'completed';
                $loan->completed_at   = now();
            } elseif ($totalPaid > 0) {
                $loan->payment_status = 'partial';
            }

            // Set next due date from first pending schedule row
            $next = $loan->schedules()->where('status', '!=', 'paid')->orderBy('due_date')->first();
            $loan->next_payment_date = $next?->due_date;
            $loan->monthly_payment   = $next ? round($next->total_amount) : null;
            $loan->save();

            // 8. GL opening balance: Dr Loans Receivable / Cr Retained Earnings
            //    Only post if there is an outstanding balance (fully-paid historical
            //    loans need no GL entry since no receivable remains).
            if ($remaining > 0) {
                $this->accounting->postHistoricalLoanOpening($loan, $remaining, $submitter);
            }

            // 9. Single audit-trail row marking this as a historical import
            LoanApproval::create([
                'loan_id'  => $loan->id,
                'user_id'  => $submitter->id,
                'status'   => 'disbursed',
                'comments' => 'Historical loan imported by ' . $submitter->name,
            ]);

            return $loan->fresh();
        });

        // 10. Notify all staff roles (not the customer) — after commit so a gateway
        //     hiccup never rolls back the import.
        $this->sms->sendHistoricalLoanStaffNotice($loan, $submitter);

        return $loan;
    }

    /**
     * Apply one historical payment: create Repayment record and mark
     * schedule installments paid in due-date order.
     * No GL entry — the opening-balance post already reflects the net balance.
     */
    protected function applyHistoricalPayment(Loan $loan, string $paymentDate, float $amount, User $submitter): void
    {
        $stamp = Carbon::parse($paymentDate)->format('Ymd');

        $repayment = Repayment::create([
            'loan_id'        => $loan->id,
            'amount'         => round($amount),
            'payment_date'   => $paymentDate,
            'payment_method' => 'historical',
            'collector_name' => $submitter->name,
            'notes'          => 'Historical payment imported',
            'status'         => 'completed',
            'recorded_by'    => $submitter->id,
        ]);

        $seq = str_pad((string) $repayment->id, 5, '0', STR_PAD_LEFT);
        $repayment->receipt_number = 'HIST-RCP-' . $stamp . '-' . $seq;

        // Derive principal/interest split for reporting (mirrors LoanService::updateSchedules)
        $remaining        = $amount;
        $principalApplied = 0.0;

        $schedules = $loan->schedules()->where('status', '!=', 'paid')->orderBy('due_date')->get();
        foreach ($schedules as $schedule) {
            if ($remaining <= 0) break;

            $owed  = $schedule->total_amount - ($schedule->amount_paid ?? 0);
            $apply = min($remaining, $owed);

            if ($schedule->total_amount > 0) {
                $principalApplied += $apply * ((float) $schedule->principal_amount / (float) $schedule->total_amount);
            }

            $schedule->amount_paid = ($schedule->amount_paid ?? 0) + $apply;
            if ($schedule->amount_paid >= $schedule->total_amount) {
                $schedule->status = 'paid';
            }
            $schedule->save();
            $remaining -= $apply;
        }

        $repayment->principal_amount = round($principalApplied, 2);
        $repayment->interest_amount  = round($amount - $principalApplied, 2);
        $repayment->save();
    }

    protected function resolveCustomer(array $data): Customer
    {
        if (!empty($data['customer_id'])) {
            $customer = Customer::find($data['customer_id']);
            if ($customer) return $customer;
        }

        return Customer::firstOrCreate(
            ['phone_number' => $data['customer_phone']],
            ['full_name'    => $data['customer_name']]
        );
    }
}
