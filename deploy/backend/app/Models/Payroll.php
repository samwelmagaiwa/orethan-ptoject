<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Payroll extends Model
{
    protected $fillable = [
        'payroll_no', 'month', 'year', 'pay_date', 'status', 'notes',
        'created_by', 'approved_by', 'approved_at',
        'gl_post_journal_id', 'gl_pay_journal_id',
    ];

    protected $casts = [
        'pay_date'            => 'date',
        'approved_at'         => 'datetime',
        'gl_post_journal_id'  => 'integer',
        'gl_pay_journal_id'   => 'integer',
    ];

    public function items() { return $this->hasMany(PayrollItem::class); }
    public function creator() { return $this->belongsTo(User::class, 'created_by'); }
    public function approver() { return $this->belongsTo(User::class, 'approved_by'); }
}
