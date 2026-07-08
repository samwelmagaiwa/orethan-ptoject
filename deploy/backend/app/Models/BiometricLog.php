<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BiometricLog extends Model
{
    public $timestamps = false; // immutable — use logged_at only

    protected $fillable = [
        'profile_id', 'loan_id', 'action', 'person_type', 'person_id',
        'finger_name', 'verification_result', 'similarity_score', 'quality_score',
        'device_id', 'operator_id', 'branch', 'ip_address', 'machine_name', 'notes', 'logged_at',
    ];

    protected $casts = [
        'logged_at' => 'datetime',
        'similarity_score' => 'integer',
        'quality_score' => 'integer',
    ];

    public function profile() { return $this->belongsTo(BiometricProfile::class, 'profile_id'); }
    public function operator() { return $this->belongsTo(User::class, 'operator_id'); }

    // Prevent any modification after creation
    public static function boot()
    {
        parent::boot();
        static::updating(fn() => false);
        static::deleting(fn() => false);
    }
}
