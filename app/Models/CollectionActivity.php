<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CollectionActivity extends Model
{
    protected $fillable = [
        'loan_id',
        'customer_id',
        'stage',
        'contact_method',
        'officer_name',
        'notes',
        'promised_amount',
        'promised_date',
        'expected_payment_date',
        'promise_status',
        'next_action_date',
        'recovery_status',
        'created_by',
    ];

    protected $casts = [
        'promised_amount' => 'decimal:2',
        'promised_date' => 'date',
        'expected_payment_date' => 'date',
        'next_action_date' => 'date',
    ];

    public function loan()
    {
        return $this->belongsTo(Loan::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
