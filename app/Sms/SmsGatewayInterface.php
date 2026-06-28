<?php

namespace App\Sms;

/**
 * Contract for an outbound SMS gateway. Swapping providers (e.g. moving off
 * NextSMS) only ever means writing a new class against this interface and
 * rebinding it in AppServiceProvider — nothing outside app/Sms/ should ever
 * know which gateway is actually in use.
 */
interface SmsGatewayInterface
{
    /** $phone must already be normalized (e.g. 255743519104). */
    public function send(string $phone, string $message): SmsResult;
}
