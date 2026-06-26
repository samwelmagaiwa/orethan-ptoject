<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BankReconciliationItem extends Model
{
    protected $fillable = [
        'bank_reconciliation_id',
        'type',
        'description',
        'amount',
        'date',
    ];

    protected $casts = [
        'date' => 'date',
        'amount' => 'float',
    ];

    public function reconciliation()
    {
        return $this->belongsTo(BankReconciliation::class, 'bank_reconciliation_id');
    }
}
