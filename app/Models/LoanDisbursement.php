<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoanDisbursement extends Model
{
    protected $fillable = [
        'loan_id',
        'disbursement_date',
        'amount',
        'method',
        'transaction_reference',
        'disbursed_by',
    ];

    protected $casts = [
        'disbursement_date' => 'date',
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
