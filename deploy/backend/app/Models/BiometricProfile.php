<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BiometricProfile extends Model
{
    protected $fillable = ['person_type', 'person_id', 'status', 'enrollment_date', 'created_by'];

    protected $casts = ['enrollment_date' => 'datetime'];

    public function templates() { return $this->hasMany(BiometricTemplate::class, 'profile_id'); }
    public function activeTemplates() { return $this->hasMany(BiometricTemplate::class, 'profile_id')->where('is_active', true); }
    public function logs() { return $this->hasMany(BiometricLog::class, 'profile_id'); }
    public function creator() { return $this->belongsTo(User::class, 'created_by'); }

    public function getEnrolledFingersAttribute(): array
    {
        return $this->activeTemplates()->pluck('finger_name')->toArray();
    }
}
