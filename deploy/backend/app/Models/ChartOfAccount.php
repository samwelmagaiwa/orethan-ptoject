<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChartOfAccount extends Model
{
    protected $fillable = [
        'code',
        'name',
        'type',
        'normal_balance',
        'parent_id',
        'is_cash_account',
        'is_system',
        'is_active',
        'description',
    ];

    protected $casts = [
        'is_cash_account' => 'boolean',
        'is_system' => 'boolean',
        'is_active' => 'boolean',
    ];

    const TYPES = ['asset', 'liability', 'equity', 'income', 'expense'];

    public function parent()
    {
        return $this->belongsTo(ChartOfAccount::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(ChartOfAccount::class, 'parent_id');
    }

    public function journalEntryLines()
    {
        return $this->hasMany(JournalEntryLine::class);
    }

    /**
     * Net balance of this account from posted journal entry lines, optionally
     * constrained to a date range. Sign follows the account's normal_balance
     * (a debit-normal account with more debits than credits returns a positive
     * number, and vice-versa for credit-normal accounts).
     */
    public function balance(?string $asOf = null, ?string $from = null): float
    {
        $query = $this->journalEntryLines()
            ->whereHas('journalEntry', function ($q) use ($asOf, $from) {
                $q->where('status', 'posted');
                if ($asOf) {
                    $q->whereDate('entry_date', '<=', $asOf);
                }
                if ($from) {
                    $q->whereDate('entry_date', '>=', $from);
                }
            });

        $totals = $query->selectRaw('COALESCE(SUM(debit),0) as total_debit, COALESCE(SUM(credit),0) as total_credit')->first();
        $debit = (float) ($totals->total_debit ?? 0);
        $credit = (float) ($totals->total_credit ?? 0);

        return $this->normal_balance === 'debit' ? round($debit - $credit, 2) : round($credit - $debit, 2);
    }
}
