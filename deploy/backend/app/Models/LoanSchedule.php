<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoanSchedule extends Model
{
    protected $fillable = [
        'loan_id',
        'installment_number',
        'due_date',
        'principal_amount',
        'interest_amount',
        'total_amount',
        'balance_remaining',
        'amount_paid',
        'status',
        'guarantor_notified_at',
        'penalty_amount',
        'penalty_days',
        'penalty_accrued_date',
        'guarantor_penalty_date',
        'reminder_3day_sent_at',
        'reminder_due_sent_at',
    ];

    protected $casts = [
        'due_date'               => 'date',
        'principal_amount'       => 'decimal:2',
        'interest_amount'        => 'decimal:2',
        'total_amount'           => 'decimal:2',
        'balance_remaining'      => 'decimal:2',
        'amount_paid'            => 'decimal:2',
        'penalty_amount'         => 'decimal:2',
        'penalty_days'           => 'integer',
        'guarantor_notified_at'  => 'datetime',
        'reminder_3day_sent_at'  => 'datetime',
        'reminder_due_sent_at'   => 'datetime',
    ];

    public function loan()
    {
        return $this->belongsTo(Loan::class);
    }
}
