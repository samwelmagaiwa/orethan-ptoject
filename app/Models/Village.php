<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Village extends Model
{
    protected $fillable = ['name', 'ward_id'];

    public function ward()
    {
        return $this->belongsTo(Ward::class);
    }

    public function places()
    {
        return $this->hasMany(Place::class);
    }
}
