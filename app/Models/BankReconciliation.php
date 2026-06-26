<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BankReconciliation extends Model
{
    protected $fillable = [
        'chart_of_account_id',
        'statement_date',
        'statement_balance',
        'book_balance',
        'adjusted_balance',
        'difference',
        'status',
        'notes',
        'reconciled_by',
        'reconciled_at',
    ];

    protected $casts = [
        'statement_date' => 'date',
        'reconciled_at' => 'datetime',
    ];

    public function account()
    {
        return $this->belongsTo(ChartOfAccount::class, 'chart_of_account_id');
    }

    public function items()
    {
        return $this->hasMany(BankReconciliationItem::class);
    }

    public function reconciler()
    {
        return $this->belongsTo(User::class, 'reconciled_by');
    }
}
