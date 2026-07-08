<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PayrollItem extends Model
{
    protected $fillable = [
        'payroll_id', 'employee_id', 'gross_salary', 'total_earnings', 'total_deductions',
        'net_salary', 'payment_status', 'payment_method', 'payment_date', 'payment_reference',
        'email_sent_at', 'email_status',
    ];

    protected $casts = [
        'gross_salary' => 'float',
        'total_earnings' => 'float',
        'total_deductions' => 'float',
        'net_salary' => 'float',
        'payment_date'  => 'date',
        'email_sent_at' => 'datetime',
    ];

    public function payroll() { return $this->belongsTo(Payroll::class); }
    public function employee() { return $this->belongsTo(Employee::class); }
    public function details() { return $this->hasMany(PayrollItemDetail::class); }
}
