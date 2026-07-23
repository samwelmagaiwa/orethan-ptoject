<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\LoanSchedule;
use App\Models\GroupMember;
use App\Models\Guarantor;

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
        'loan_account_number',
        'disbursed_at',
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
        'disbursed_at' => 'datetime',
        'next_payment_date' => 'date',
    ];

    // Fixed branch/institution code used in every account number
    const BRANCH_CODE = 'ZKM';

    /**
     * Build a unique loan account number whose prefix reflects the loan category:
     *
     *   - Group loan                 => GRP-ZKM-D-M-YEAR-00id   (e.g. GRP-ZKM-23-06-2026-00015)
     *   - Employed applicant (Ndio)  => EMPL-ZKM-D-M-YEAR-00id  (e.g. EMPL-ZKM-23-06-2026-00015)
     *   - Not employed (Hapana)      => BSN-ZKM-D-M-YEAR-00id   (business; default)
     *
     * Employment is the single source of truth: "employed" (Ndio) => EMPL,
     * "not employed" (hajaajiriwa) => the loan is for business, hence BSN.
     */
    public function generateAccountNumber()
    {
        $date = $this->disbursed_at ?? $this->created_at ?? now();
        $day = $date->format('d');
        $month = $date->format('m');
        $year = $date->format('Y');
        $seq = str_pad((string) $this->id, 5, '0', STR_PAD_LEFT);

        $type = strtolower((string) $this->type);
        $umeajiriwa = $this->details['umeajiriwa'] ?? null;

        // Group loans: GRP-ZKM-d-m-year-00id
        if ($type === 'group') {
            return strtoupper('GRP-' . self::BRANCH_CODE . '-' . $day . '-' . $month . '-' . $year . '-' . $seq);
        }

        // Employed applicant (Ndio): EMPL-ZKM-D-M-YEAR-00id
        if ($umeajiriwa === 'Ndio') {
            return strtoupper('EMPL-' . self::BRANCH_CODE . '-' . $day . '-' . $month . '-' . $year . '-' . $seq);
        }

        // Self-employed / business (Hapana), and the safe default: BSN-ZKM-D-M-YEAR-00id
        return strtoupper('BSN-' . self::BRANCH_CODE . '-' . $day . '-' . $month . '-' . $year . '-' . $seq);
    }

    /**
     * Human-readable loan/application reference (available before disbursement).
     * Format: LN-YYYYMMDD-00id, e.g. LN-20260623-00015
     */
    public function getLoanNumberAttribute()
    {
        $date = $this->created_at ?? now();
        return 'LN-' . $date->format('Ymd') . '-' . str_pad((string) $this->id, 5, '0', STR_PAD_LEFT);
    }

    /**
     * Friendly product name derived from type + employment status.
     */
    public function getProductNameAttribute()
    {
        $type = strtolower((string) $this->type);
        if ($type === 'group') {
            return 'Group Loan';
        }
        if ($type === 'employee' || ($this->details['umeajiriwa'] ?? null) === 'Ndio') {
            return 'Employee Loan';
        }
        return 'Business Loan';
    }

    /**
     * Loan term (in months) and repayment frequency, read from the application details.
     */
    public function termMonths()
    {
        return (int) ($this->details['kwaTarakimu'] ?? 12);
    }

    public function repaymentFrequency()
    {
        return $this->details['repayment_frequency'] ?? 'Monthly';
    }

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

    public function nextInstallment()
    {
        // The "!= paid" filter must live inside the ofMany() closure, not chained
        // after oldestOfMany() — otherwise the MIN(due_date) subquery is computed
        // across ALL schedule rows (including paid ones) before the filter is
        // applied outside, which can wrongly pick an already-paid earliest row
        // and return nothing once the outer filter excludes it.
        return $this->hasOne(LoanSchedule::class)->ofMany(
            ['due_date' => 'min'],
            function ($query) {
                $query->where('status', '!=', 'paid');
            }
        );
    }

    public function collectionActivities()
    {
        return $this->hasMany(CollectionActivity::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function groupMembers()
    {
        return $this->hasMany(GroupMember::class);
    }

    public function guarantors()
    {
        return $this->hasMany(Guarantor::class);
    }

    /**
     * Build (without persisting) the amortization rows for this loan.
     * Used both to persist the schedule and to preview it before disbursement.
     */
    public function buildScheduleRows($months = 12, $interestRate = null, $frequency = 'Monthly', $startDate = null)
    {
        // Falls back to the admin-configured default rate (Loan Settings)
        // rather than a hardcoded percentage — callers normally pass an
        // explicit rate captured at calculator/disbursement time, this only
        // matters if one is ever omitted.
        $interestRate ??= LoanSetting::current()->defaultInterestRateFraction();

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
        $dueDate = $startDate
            ? \Carbon\Carbon::parse($startDate)
            : ($this->approved_at ? \Carbon\Carbon::parse($this->approved_at) : now());

        $rows = [];
        for ($i = 1; $i <= $totalInstallments; $i++) {
            $interest = $balance * ($interestRate / $installmentsPerMonth);
            $balance -= $principalPerInstallment;

            $dueDate = match ($frequency) {
                'Weekly' => $dueDate->addWeek(),
                'Bi-Weekly' => $dueDate->addWeeks(2),
                'Daily' => $dueDate->addDay(),
                'Quarterly' => $dueDate->addMonths(3),
                default => $dueDate->addMonth(),
            };

            $rows[] = [
                'installment_number' => $i,
                'due_date' => $dueDate->toDateString(),
                'principal_amount' => round($principalPerInstallment, 2),
                'interest_amount' => round($interest, 2),
                'total_amount' => round($principalPerInstallment + $interest, 2),
                'balance_remaining' => round(max(0, $balance), 2),
                'status' => 'pending',
            ];
        }

        return $rows;
    }

    // Auto-generate (persist) repayment schedule
    public function generateSchedule($months = 12, $interestRate = null, $frequency = 'Monthly', $startDate = null)
    {
        $this->schedules()->delete();

        foreach ($this->buildScheduleRows($months, $interestRate, $frequency, $startDate) as $row) {
            $this->schedules()->create($row);
        }
    }

    /**
     * Repayment summary (counts, installment amount, first/last dates) for previews.
     */
    public function scheduleSummary($interestRate = null, $startDate = null)
    {
        $rows = $this->buildScheduleRows($this->termMonths(), $interestRate, $this->repaymentFrequency(), $startDate);
        if (empty($rows)) {
            return [
                'total_installments' => 0,
                'installment_amount' => 0,
                'first_payment_date' => null,
                'final_payment_date' => null,
            ];
        }

        return [
            'total_installments' => count($rows),
            'installment_amount' => $rows[0]['total_amount'],
            'first_payment_date' => $rows[0]['due_date'],
            'final_payment_date' => $rows[count($rows) - 1]['due_date'],
        ];
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

    // Penalty on overdue arrears, at the admin-configured rate (Loan Settings)
    public function calculatePenalty()
    {
        $arrears = $this->getArrearsAmount();
        if ($arrears <= 0)
            return 0;

        return $arrears * LoanSetting::current()->penaltyRateFraction();
    }
}