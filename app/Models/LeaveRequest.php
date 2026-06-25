<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LeaveRequest extends Model
{
    protected $fillable = [
        'employee_name', 'department', 'manager', 'absence_type', 'absence_other',
        'from_date', 'to_date', 'reason', 'employee_signature', 'employee_date',
        'status',
        'manager_name', 'manager_decision', 'manager_comments', 'manager_date',
        'gm_name', 'gm_decision', 'gm_comments', 'gm_date',
        'md_name', 'md_comments', 'md_date',
        'rejection_reason', 'created_by',
    ];

    protected $casts = [
        'from_date' => 'date',
        'to_date' => 'date',
        'employee_date' => 'date',
        'manager_date' => 'datetime',
        'gm_date' => 'datetime',
        'md_date' => 'datetime',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
