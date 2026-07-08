<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Guarantor extends Model
{
    protected $fillable = [
        'loan_id', 'guarantor_number', 'full_name', 'relationship', 'phone',
        'nida_number', 'id_type', 'id_number', 'date_of_birth', 'gender',
        'employment_status', 'employer_name', 'employer_phone', 'employer_address',
        'monthly_income', 'region', 'district', 'ward', 'street', 'house_number',
        'photo_path', 'status', 'notes', 'created_by',
    ];

    protected $casts = ['monthly_income' => 'decimal:2'];

    public function loan() { return $this->belongsTo(Loan::class); }
    public function creator() { return $this->belongsTo(User::class, 'created_by'); }
}
