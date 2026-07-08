<?php

namespace App\Providers;

use App\Sms\NextSmsGateway;
use App\Sms\SmsGatewayInterface;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Swapping SMS providers later only means writing a new class against
        // SmsGatewayInterface and changing this one line.
        $this->app->bind(SmsGatewayInterface::class, NextSmsGateway::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
