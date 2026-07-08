<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SalaryComponent extends Model
{
    protected $fillable = [
        'code', 'name', 'type', 'taxable', 'statutory', 'active', 'default_amount', 'sort_order',
    ];

    protected $casts = [
        'taxable' => 'boolean',
        'statutory' => 'boolean',
        'active' => 'boolean',
        'default_amount' => 'float',
    ];

    public function details() { return $this->hasMany(PayrollItemDetail::class, 'component_id'); }
}
