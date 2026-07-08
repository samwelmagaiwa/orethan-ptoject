<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BiometricTemplate extends Model
{
    protected $fillable = [
        'profile_id', 'finger_name', 'fingerprint_template',
        'quality_score', 'device_serial', 'is_active',
    ];

    protected $hidden = ['fingerprint_template']; // never expose raw template in JSON

    protected $casts = ['is_active' => 'boolean', 'quality_score' => 'integer'];

    public function profile() { return $this->belongsTo(BiometricProfile::class, 'profile_id'); }
}
