<?php

return [
    /*
    |--------------------------------------------------------------------------
    | SMS Gateway (Kilakona / messaging.kilakona.co.tz)
    |--------------------------------------------------------------------------
    | Customer-facing SMS notifications. Set SMS_ENABLED=false in .env to mute
    | all outbound SMS (e.g. local development) without touching any code —
    | every send still gets logged to sms_logs as "failed: gateway disabled".
    */
    'enabled'    => env('SMS_ENABLED', true),
    'api_url'    => env('SMS_API_URL', 'https://messaging.kilakona.co.tz/api/v1/vendor/message/send'),
    'api_key'    => env('SMS_API_KEY'),
    'secret_key' => env('SMS_SECRET_KEY'),
    'sender_id'  => env('SMS_SENDER_ID', 'HARUSI'),

    // Tanzanian numbers are normalized to this MSISDN country code before sending.
    'country_code' => env('SMS_COUNTRY_CODE', '255'),
];
