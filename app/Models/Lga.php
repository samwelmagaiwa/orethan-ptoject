<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Lga extends Model
{
    protected $fillable = ['name', 'state_id'];

    public function state()
    {
        return $this->belongsTo(State::class);
    }

    public function wards()
    {
        return $this->hasMany(Ward::class);
    }
}
