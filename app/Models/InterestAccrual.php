<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InterestAccrual extends Model
{
    protected $fillable = ['loan_id', 'accrual_date', 'outstanding', 'amount', 'journal_entry_id'];

    protected $casts = [
        'accrual_date' => 'date',
        'outstanding' => 'decimal:2',
        'amount' => 'decimal:2',
    ];

    public function loan()
    {
        return $this->belongsTo(Loan::class);
    }
}
