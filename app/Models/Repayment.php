<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Repayment extends Model
{
    protected $fillable = [
        'loan_id',
        'repayment_schedule_id',
        'amount',
        'interest_amount',
        'principal_amount',
        'penalty_amount',
        'payment_date',
        'payment_method',
        'transaction_id',
        'receipt_number',
        'collector_name',
        'notes',
        'status',
        'recorded_by',
        'reversal_reason',
        'authorized_by',
        'reversed_by',
        'reversed_at',
    ];

    protected $casts = [
        'payment_date' => 'date',
        'amount' => 'decimal:2',
        'interest_amount' => 'decimal:2',
        'principal_amount' => 'decimal:2',
        'penalty_amount' => 'decimal:2',
        'reversed_at' => 'datetime',
    ];

    public function loan()
    {
        return $this->belongsTo(Loan::class);
    }

    public function repaymentSchedule()
    {
        return $this->belongsTo(RepaymentSchedule::class);
    }

    public function recordedBy()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function getTotalAmountAttribute()
    {
        return $this->principal_amount + $this->interest_amount + $this->penalty_amount;
    }
}
