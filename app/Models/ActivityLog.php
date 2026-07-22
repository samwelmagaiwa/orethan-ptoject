<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ActivityLog extends Model
{
    protected $fillable = [
        'user_id', 'user_name', 'user_role',
        'action', 'module', 'record_id', 'record_label',
        'description', 'ip_address',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
