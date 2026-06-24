<?php

namespace App\Services;

use App\Models\Loan;
use App\Models\Customer;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class LoanService
{
    /**
     * Handle loan submission logic.
     */
    public function createLoan(array $data)
    {
        return DB::transaction(function () use ($data) {
            // Find or create customer
            $customer = Customer::firstOrCreate(
                ['phone_number' => $data['phone']],
                [
                    'full_name' => $data['name'],
                    'email' => $data['details']['baruaPepe'] ?? null,
                    'nida_number' => $data['details']['nambaYaNida'] ?? $data['details']['nambaYaKitambulisho'] ?? null,
                    'id_type' => $data['details']['ainaYaKitambulisho'] ?? null,
                    'id_number' => $data['details']['nambaYaKitambulisho'] ?? null,
                    'date_of_birth' => $data['details']['tareheYaKuzaliwa'] ?? null,
                    'gender' => $data['details']['jinsia'] ?? null,
                    'region' => $data['details']['mahaliUnapoishiMkoa'] ?? $data['details']['mkoa'] ?? null,
                    'district' => $data['details']['mahaliUnapoishiWilaya'] ?? $data['details']['wilaya'] ?? null,
                    'ward' => $data['details']['mahaliUnapoishiKata'] ?? $data['details']['kata'] ?? null,
                    'street' => $data['details']['mahaliUnapoishiMtaa'] ?? $data['details']['kijijiMtaa'] ?? $data['details']['kijijiBarabara'] ?? null,
                    'residency_type' => $data['details']['umilikiWaMakazi'] ?? null,
                ]
            );

            // Create loan
            $loan = Loan::create([
                'name' => $data['name'],
                'phone' => $data['phone'],
                'amount' => $data['amount'],
                'type' => $data['type'],
                'status' => 'manager_review',
                'details' => $data['details'] ?? null,
                'passport_photo' => $data['passport_photo'] ?? null,
                'guarantor_1_photo' => $data['guarantor_1_photo'] ?? null,
                'guarantor_2_photo' => $data['guarantor_2_photo'] ?? null,
                'customer_id' => $customer->id,
                'user_id' => $data['user_id'] ?? null,
            ]);

            // Create initial approval record for audit trail
            \App\Models\LoanApproval::create([
                'loan_id' => $loan->id,
                'user_id' => $data['user_id'] ?? 1,
                'status' => 'loan_officer',
                'comments' => "Loan application submitted by officer",
            ]);

            return $loan;

        });
    }

    /**
     * Handle loan approval logic.
     */
    public function approveLoan($loan, array $data, $user)
    {
        return DB::transaction(function () use ($loan, $data, $user) {
            $oldStatus = $loan->status;

            if ($loan->status == 'manager_review') {
                $loan->status = 'gm_review';
            } elseif ($loan->status == 'gm_review') {
                $loan->status = 'md_review';
            } elseif ($loan->status == 'md_review') {
                $loan->status = 'approved';
                $loan->approved_at = now();
                $loan->payment_status = 'pending';
                $loan->remaining_balance = $loan->amount;
                $loan->total_paid = 0;
            }

            $loan->approved_by = $user->name ?? 'System';
            $loan->save();

            // Record in approvals table
            \App\Models\LoanApproval::create([
                'loan_id' => $loan->id,
                'user_id' => $user->id ?? 1,
                'status' => $loan->status,
                'comments' => $data['comments'] ?? "",
            ]);

            return $loan;
        });
    }

    /**
     * Handle loan rejection logic.
     */
    public function rejectLoan($loan, array $data, $user)
    {
        return DB::transaction(function () use ($loan, $data, $user) {
            if ($loan->status == 'manager_review') {
                $loan->status = 'loan_officer';
            } elseif ($loan->status == 'gm_review') {
                $loan->status = 'manager_review';
            } elseif ($loan->status == 'md_review') {
                $loan->status = 'gm_review';
            }

            $loan->rejection_reason = $data['reason'];
            $loan->save();

            // Record in approvals table
            \App\Models\LoanApproval::create([
                'loan_id' => $loan->id,
                'user_id' => $user->id ?? 1,
                'status' => 'rejected',
                'comments' => $data['reason'],
                'rejection_reason' => $data['reason'],
            ]);

            return $loan;
        });
    }
    /**
     * Handle loan disbursement and immediate activation.
     *
     * After a Finance Officer/Cashier disburses an MD-approved loan, the loan is
     * "activated" — we automatically create the disbursement record and generate:
     *   - Loan Account (unique account number)
     *   - Repayment Schedule (starting from the disbursement date)
     *   - First Due Date (next_payment_date)
     *   - Outstanding Balance (remaining_balance = principal)
     *   - Status = disbursed (Active)
     */
    public function disburseLoan(Loan $loan, array $data, $user)
    {
        return DB::transaction(function () use ($loan, $data, $user) {
            // Only MD-approved loans can be disbursed
            if ($loan->status !== 'approved') {
                throw new \Exception('Only approved loans can be disbursed');
            }

            // Lock against double disbursement / double activation
            if ($loan->disbursed_at || $loan->disbursement()->exists()) {
                throw new \Exception('This loan has already been disbursed');
            }

            $disbursementDate = $data['disbursement_date'];

            // Charges & net amount (calculated server-side, never trusted from client)
            $processingFee = round((float) ($data['processing_fee'] ?? 0), 2);
            $insuranceFee = round((float) ($data['insurance_fee'] ?? 0), 2);
            $otherCharges = round((float) ($data['other_charges'] ?? 0), 2);
            $totalCharges = round($processingFee + $insuranceFee + $otherCharges, 2);
            $grossAmount = round((float) $data['amount'], 2);
            $netAmount = round($grossAmount - $totalCharges, 2);

            if ($netAmount < 0) {
                throw new \Exception('Total charges cannot exceed the loan amount');
            }

            // Auto-generated voucher & receipt numbers (one disbursement per loan -> unique)
            $seq = str_pad((string) $loan->id, 5, '0', STR_PAD_LEFT);
            $stamp = \Carbon\Carbon::parse($disbursementDate)->format('Ymd');
            $voucherNumber = 'VCH-' . $stamp . '-' . $seq;
            $receiptNumber = 'RCP-' . $stamp . '-' . $seq;

            // 1. Record the disbursement transaction (the ledger entry at this app's maturity)
            $disbursement = \App\Models\LoanDisbursement::create([
                'loan_id' => $loan->id,
                'disbursement_date' => $disbursementDate,
                'amount' => $grossAmount,
                'processing_fee' => $processingFee,
                'insurance_fee' => $insuranceFee,
                'other_charges' => $otherCharges,
                'total_charges' => $totalCharges,
                'net_amount' => $netAmount,
                'voucher_number' => $voucherNumber,
                'receipt_number' => $receiptNumber,
                'method' => $data['method'],
                'transaction_reference' => $data['transaction_reference'] ?? null,
                'payment_details' => $data['payment_details'] ?? null,
                'narration' => $data['narration'] ?? ('Loan Disbursement for ' . $loan->product_name),
                'branch' => $data['branch'] ?? null,
                'disbursed_by' => $user->id ?? 1,
            ]);

            // 2. Generate Repayment Schedule from the disbursement date (using captured interest rate)
            $interestRate = (float) ($loan->details['kiwakocha_Riba'] ?? 3) / 100;
            $loan->generateSchedule($loan->termMonths(), $interestRate, $loan->repaymentFrequency(), $disbursementDate);

            // 3. Activate the loan account
            $firstSchedule = $loan->schedules()->orderBy('due_date', 'asc')->first();

            $loan->disbursed_at = $disbursementDate;
            $loan->status = 'disbursed'; // Active
            $loan->payment_status = 'pending';
            $loan->total_paid = 0;
            $loan->remaining_balance = round($loan->amount); // Outstanding Balance = principal
            $loan->next_payment_date = $firstSchedule?->due_date; // First Due Date
            $loan->monthly_payment = $firstSchedule ? round($firstSchedule->total_amount) : null;
            $loan->save();

            // 4. Assign the Loan Account number (needs the persisted id)
            if (!$loan->loan_account_number) {
                $loan->loan_account_number = $loan->generateAccountNumber();
                $loan->save();
            }

            // 5. Record the audit trail (who/when/what/branch)
            \App\Models\AuditLog::record(
                'loan.disbursed',
                $user,
                $loan,
                'Loan ' . $loan->loan_account_number . ' disbursed and activated',
                [
                    'voucher_number' => $voucherNumber,
                    'receipt_number' => $receiptNumber,
                    'gross_amount' => $grossAmount,
                    'total_charges' => $totalCharges,
                    'net_amount' => $netAmount,
                    'method' => $data['method'],
                ],
                $data['branch'] ?? null
            );

            return $loan->fresh(['schedules', 'disbursement']);
        });
    }

    /**
     * Handle loan repayment.
     */
    public function recordRepayment(Loan $loan, array $data, $user)
    {
        return DB::transaction(function () use ($loan, $data, $user) {
            $amount = round($data['amount']);
            $currentPaid = round($loan->total_paid ?? 0);
            $remaining = round($loan->remaining_balance ?? ($loan->amount - $currentPaid));

            if ($amount > $remaining) {
                throw new \Exception("Payment amount $amount exceeds remaining balance $remaining");
            }

            $repayment = \App\Models\Repayment::create([
                'loan_id' => $loan->id,
                'amount' => $amount,
                'payment_date' => $data['payment_date'],
                'payment_method' => $data['payment_method'],
                'transaction_id' => $data['transaction_id'] ?? null,
                'collector_name' => $data['received_by'] ?? ($user->name ?? null),
                'notes' => $data['notes'] ?? null,
                'receipt_number' => 'RCP-' . strtoupper(uniqid()),
                'status' => 'completed',
                'recorded_by' => $user->id ?? 1,
            ]);

            $loan->total_paid = round(($loan->total_paid ?? 0) + $amount);
            $loan->remaining_balance = round($loan->amount - $loan->total_paid);

            if ($loan->remaining_balance <= 0) {
                $loan->payment_status = 'completed';
                $loan->status = 'completed';
                $loan->completed_at = now();
            } else {
                $loan->payment_status = 'partial';
            }

            $loan->save();

            // Update schedules
            $this->updateSchedules($loan, $amount);

            return [
                'repayment' => $repayment,
                'loan' => $loan->fresh()
            ];
        });
    }

    /**
     * Reverse a previously recorded repayment (requires authorization note).
     */
    public function reverseRepayment(\App\Models\Repayment $repayment, array $data, $user)
    {
        return DB::transaction(function () use ($repayment, $data, $user) {
            if ($repayment->status === 'reversed') {
                throw new \Exception('This repayment has already been reversed');
            }

            $loan = $repayment->loan;
            $amount = round($repayment->amount);

            $loan->total_paid = max(0, round(($loan->total_paid ?? 0) - $amount));
            $loan->remaining_balance = round($loan->amount - $loan->total_paid);

            if ($loan->status === 'completed' && $loan->remaining_balance > 0) {
                $loan->status = 'disbursed';
                $loan->completed_at = null;
            }
            $loan->payment_status = $loan->total_paid > 0 ? 'partial' : 'pending';
            $loan->save();

            $this->updateSchedules($loan, -$amount);

            $repayment->status = 'reversed';
            $repayment->reversal_reason = $data['reason'];
            $repayment->authorized_by = $data['authorized_by'];
            $repayment->reversed_by = $user->id ?? null;
            $repayment->reversed_at = now();
            $repayment->save();

            return [
                'repayment' => $repayment,
                'loan' => $loan->fresh()
            ];
        });
    }

    protected function updateSchedules(Loan $loan, $paidAmount)
    {
        $schedules = $loan->schedules()->where('status', '!=', 'paid')->orderBy('due_date', 'asc')->get();
        foreach ($schedules as $schedule) {
            if ($paidAmount <= 0)
                break;

            $remainingOnSchedule = $schedule->total_amount - ($schedule->amount_paid ?? 0);
            $paymentToApply = min($paidAmount, $remainingOnSchedule);

            $schedule->amount_paid = ($schedule->amount_paid ?? 0) + $paymentToApply;
            if ($schedule->amount_paid >= $schedule->total_amount) {
                $schedule->status = 'paid';
            }
            $schedule->save();

            $paidAmount -= $paymentToApply;
        }
    }
}
