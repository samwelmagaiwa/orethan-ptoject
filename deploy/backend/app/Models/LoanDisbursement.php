<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoanDisbursement extends Model
{
    protected $fillable = [
        'loan_id',
        'disbursement_date',
        'amount',
        'processing_fee',
        'insurance_fee',
        'other_charges',
        'total_charges',
        'net_amount',
        'voucher_number',
        'receipt_number',
        'method',
        'transaction_reference',
        'payment_details',
        'narration',
        'branch',
        'disbursed_by',
    ];

    protected $casts = [
        'disbursement_date' => 'date',
        'payment_details' => 'array',
        'amount' => 'decimal:2',
        'processing_fee' => 'decimal:2',
        'insurance_fee' => 'decimal:2',
        'other_charges' => 'decimal:2',
        'total_charges' => 'decimal:2',
        'net_amount' => 'decimal:2',
    ];

    public function loan()
    {
        return $this->belongsTo(Loan::class);
    }

    public function disbursedBy()
    {
        return $this->belongsTo(User::class, 'disbursed_by');
    }
}
