<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CustomerBiometric extends Model
{
    protected $table = 'customer_biometrics';

    protected $fillable = [
        'customer_id',
        'finger_position',
        'template',
        'image_b64',
        'device_serial',
        'captured_by',
    ];

    protected $hidden = ['template']; // raw template excluded from list/index responses

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }
}
