<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BranchReport extends Model
{
    protected $table = 'branch_reports';

    protected $fillable = [
        'branch', 'department', 'section', 'report_type',
        'period_start', 'period_end',
        'submitted_by', 'submitted_by_name',
        'operations', 'financials', 'balances',
        'loan_officers', 'expected_loans', 'status',
        'approval_status', 'approved_by', 'approved_by_name', 'approved_at',
        'lo_signed', 'lm_signed',
        'gl_journal_entry_id',
        'returned_to_stage', 'returned_by_name', 'return_reason', 'returned_at',
    ];

    protected $casts = [
        'operations'     => 'array',
        'financials'     => 'array',
        'balances'       => 'array',
        'loan_officers'  => 'array',
        'expected_loans' => 'array',
        'period_start'   => 'date',
        'period_end'     => 'date',
        'approved_at'    => 'datetime',
        'lo_signed'      => 'boolean',
        'lm_signed'      => 'boolean',
        'returned_at'    => 'datetime',
    ];
}
