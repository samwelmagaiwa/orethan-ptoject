<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Employee extends Model
{
    protected $fillable = [
        'user_id', 'employee_id', 'full_name', 'department', 'designation',
        'branch', 'employment_type', 'basic_salary', 'bank_name', 'bank_account',
        'tin_number', 'nssf_number', 'nhif_number', 'phone', 'email', 'hire_date', 'active',
    ];

    protected $casts = [
        'basic_salary' => 'float',
        'active' => 'boolean',
        'hire_date' => 'date',
    ];

    public function user() { return $this->belongsTo(User::class); }
    public function payrollItems() { return $this->hasMany(PayrollItem::class); }
}
