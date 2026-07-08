<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoanRestructure extends Model
{
    protected $fillable = [
        'loan_id', 'type', 'amount', 'balance_before', 'balance_after',
        'details', 'notes', 'journal_entry_id', 'performed_by',
    ];

    protected $casts = [
        'details' => 'array',
        'amount' => 'decimal:2',
        'balance_before' => 'decimal:2',
        'balance_after' => 'decimal:2',
    ];

    public function loan()
    {
        return $this->belongsTo(Loan::class);
    }

    public function performer()
    {
        return $this->belongsTo(User::class, 'performed_by');
    }
}
