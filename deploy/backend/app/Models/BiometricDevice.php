<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BiometricDevice extends Model
{
    protected $fillable = [
        'device_name', 'device_model', 'manufacturer', 'serial_number',
        'firmware_version', 'sdk_version', 'branch', 'location', 'status', 'registered_by',
    ];

    public function registeredBy() { return $this->belongsTo(User::class, 'registered_by'); }
    public function logs() { return $this->hasMany(BiometricLog::class, 'device_id', 'serial_number'); }
}
