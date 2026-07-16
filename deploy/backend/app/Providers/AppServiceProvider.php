<?php

namespace App\Providers;

use App\Sms\KilakonaGateway;
use App\Sms\SmsGatewayInterface;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(SmsGatewayInterface::class, KilakonaGateway::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
