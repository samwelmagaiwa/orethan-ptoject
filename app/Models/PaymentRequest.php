<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentRequest extends Model
{
    protected $fillable = [
        'applicant_name', 'department', 'section', 'activity_type', 'activity_detail',
        'loan_applicant_name', 'invoice_path', 'mode_of_payment', 'payable_to', 'currency',
        'amount', 'amount_in_words', 'applicant_signature', 'applicant_date',
        'status', 'final_amount',
        'manager_name', 'manager_decision', 'manager_adjusted_amount', 'manager_comments', 'manager_date',
        'gm_name', 'gm_decision', 'gm_adjusted_amount', 'gm_comments', 'gm_date',
        'md_name', 'md_comments', 'md_date',
        'cashier_name', 'cashier_comments', 'cashier_reference', 'cashier_date',
        'rejection_reason', 'created_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'final_amount' => 'decimal:2',
        'manager_adjusted_amount' => 'decimal:2',
        'gm_adjusted_amount' => 'decimal:2',
        'applicant_date' => 'date',
        'manager_date' => 'datetime',
        'gm_date' => 'datetime',
        'md_date' => 'datetime',
        'cashier_date' => 'datetime',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
