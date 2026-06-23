<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoanApproval extends Model
{
    protected $fillable = [
        'loan_id',
        'user_id',
        'status',
        'comments',
        'rejection_reason',
        'digital_signature',
    ];

    public function loan()
    {
        return $this->belongsTo(Loan::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
