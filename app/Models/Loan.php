<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\LoanSchedule;

class Loan extends Model
{
    protected $fillable = [
        'name',
        'phone',
        'amount',
        'type',
        'status',
        'details',
        'passport_photo',
        'guarantor_1_photo',
        'guarantor_2_photo',
        'rejection_reason',
        'approved_by',
        'approved_at',
        'total_paid',
        'remaining_balance',
        'monthly_payment',
        'payment_status',
        'next_payment_date',
        'customer_id',
        'user_id',
    ];

    protected $casts = [
        'details' => 'array',
        'approved_at' => 'datetime',
        'next_payment_date' => 'date',
    ];

    // Relationships
    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function repayments()
    {
        return $this->hasMany(Repayment::class);
    }

    public function approvals()
    {
        return $this->hasMany(LoanApproval::class);
    }

    public function disbursement()
    {
        return $this->hasOne(LoanDisbursement::class);
    }

    public function schedules()
    {
        return $this->hasMany(LoanSchedule::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // Auto-generate repayment schedule
    public function generateSchedule($months = 12, $interestRate = 0.03, $frequency = 'Monthly')
    {
        $this->schedules()->delete();

        $installmentsPerMonth = match ($frequency) {
            'Weekly' => 4.33,
            'Bi-Weekly' => 2.165,
            'Daily' => 30.0,
            'Quarterly' => 1 / 3,
            default => 1.0,
        };

        $totalInstallments = max(1, (int) round($months * $installmentsPerMonth));
        $principalPerInstallment = $this->amount / $totalInstallments;
        $balance = $this->amount;
        $dueDate = $this->approved_at ? \Carbon\Carbon::parse($this->approved_at) : now();

        for ($i = 1; $i <= $totalInstallments; $i++) {
            $interest = $balance * ($interestRate / $installmentsPerMonth);
            $balance -= $principalPerInstallment;

            // Increment date based on frequency
            $dueDate = match ($frequency) {
                'Weekly' => $dueDate->addWeek(),
                'Bi-Weekly' => $dueDate->addWeeks(2),
                'Daily' => $dueDate->addDay(),
                'Quarterly' => $dueDate->addMonths(3),
                default => $dueDate->addMonth(),
            };

            LoanSchedule::create([
                'loan_id' => $this->id,
                'installment_number' => $i,
                'due_date' => $dueDate->toDateString(),
                'principal_amount' => $principalPerInstallment,
                'interest_amount' => $interest,
                'total_amount' => $principalPerInstallment + $interest,
                'balance_remaining' => max(0, $balance),
                'status' => 'pending',
            ]);
        }
    }

    // Calculate remaining balance
    public function calculateRemainingBalance()
    {
        $totalPaid = $this->repayments()->sum('amount');
        $this->total_paid = $totalPaid;
        $this->remaining_balance = $this->amount - $totalPaid;

        if ($this->remaining_balance <= 0) {
            $this->payment_status = 'completed';
            $this->status = 'completed';
        } elseif ($totalPaid > 0) {
            $this->payment_status = 'partial';
        }

        $this->save();

        return $this->remaining_balance;
    }

    // Helper methods
    public function getPaymentProgressPercentage()
    {
        if ($this->amount <= 0)
            return 0;
        return round(($this->total_paid / $this->amount) * 100, 2);
    }

    public function isFullyPaid()
    {
        return $this->remaining_balance <= 0;
    }

    // Arrears is the sum of (total_amount - amount_paid) for all overdue installments
    public function getArrearsAmount()
    {
        return $this->schedules()
            ->where('due_date', '<', now()->toDateString())
            ->where('status', '!=', 'paid')
            ->get()
            ->sum(function ($schedule) {
                return $schedule->total_amount - $schedule->amount_paid;
            });
    }

    // Penalty logic: e.g., 10% of overdue amount if overdue by more than X days
    public function calculatePenalty()
    {
        $arrears = $this->getArrearsAmount();
        if ($arrears <= 0)
            return 0;

        // Simple example: 2% weekly penalty on arrears
        return $arrears * 0.02;
    }
}