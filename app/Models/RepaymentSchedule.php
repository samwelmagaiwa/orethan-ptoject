<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RepaymentSchedule extends Model
{
    protected $fillable = [
        'loan_id',
        'installment_number',
        'due_date',
        'principal_amount',
        'interest_amount',
        'total_amount',
        'remaining_balance',
        'status',
        'paid_amount',
        'paid_date',
        'penalty_amount',
    ];

    protected $casts = [
        'due_date' => 'date',
        'paid_date' => 'date',
        'principal_amount' => 'decimal:2',
        'interest_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'remaining_balance' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'penalty_amount' => 'decimal:2',
    ];

    public function loan()
    {
        return $this->belongsTo(Loan::class);
    }

    public function repayments()
    {
        return $this->hasMany(Repayment::class);
    }

    public function isOverdue()
    {
        return $this->status === 'overdue' || ($this->status === 'pending' && $this->due_date < now()->toDateString());
    }

    public function getDaysOverdueAttribute()
    {
        if ($this->status === 'paid') {
            return 0;
        }

        return max(0, now()->diffInDays($this->due_date, false));
    }
}
