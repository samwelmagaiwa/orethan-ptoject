<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DelinquencyEscalation extends Model
{
    protected $fillable = [
        'loan_id', 'days_overdue', 'escalation_level',
        'escalated_to', 'notes', 'escalated_at', 'escalation_date',
    ];

    protected $casts = [
        'escalated_at'    => 'datetime',
        'escalation_date' => 'date',
    ];

    public function loan()
    {
        return $this->belongsTo(Loan::class);
    }

    public function recipient()
    {
        return $this->belongsTo(User::class, 'escalated_to');
    }
}
