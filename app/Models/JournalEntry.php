<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JournalEntry extends Model
{
    protected $fillable = [
        'entry_number',
        'entry_date',
        'reference_type',
        'reference_id',
        'description',
        'status',
        'created_by',
        'reversed_by',
        'reversed_at',
        'reversal_of_id',
    ];

    protected $casts = [
        'entry_date' => 'date',
        'reversed_at' => 'datetime',
    ];

    public function lines()
    {
        return $this->hasMany(JournalEntryLine::class)->orderBy('line_order');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reverser()
    {
        return $this->belongsTo(User::class, 'reversed_by');
    }

    public function reversalOf()
    {
        return $this->belongsTo(JournalEntry::class, 'reversal_of_id');
    }

    public function totalDebit(): float
    {
        return round((float) $this->lines->sum('debit'), 2);
    }

    public function totalCredit(): float
    {
        return round((float) $this->lines->sum('credit'), 2);
    }
}
