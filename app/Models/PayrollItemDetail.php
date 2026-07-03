<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PayrollItemDetail extends Model
{
    protected $fillable = ['payroll_item_id', 'component_id', 'amount'];
    protected $casts = ['amount' => 'float'];

    public function payrollItem() { return $this->belongsTo(PayrollItem::class); }
    public function component() { return $this->belongsTo(SalaryComponent::class, 'component_id'); }
}
