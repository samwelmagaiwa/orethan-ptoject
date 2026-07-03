<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GroupMember extends Model
{
    protected $fillable = [
        'loan_id', 'full_name', 'role', 'phone', 'nida_number', 'gender',
        'occupation', 'monthly_income', 'region', 'district', 'ward', 'street',
        'photo_path', 'kyc_status', 'share_amount', 'notes',
    ];

    protected $casts = [
        'monthly_income' => 'decimal:2',
        'share_amount'   => 'decimal:2',
    ];

    public function loan() { return $this->belongsTo(Loan::class); }
}
