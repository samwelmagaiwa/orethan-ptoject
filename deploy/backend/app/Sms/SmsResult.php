<?php

namespace App\Sms;

/** Outcome of a single SMS send attempt, independent of which gateway sent it. */
class SmsResult
{
    public function __construct(
        public readonly bool $success,
        public readonly bool $disabled = false,
        public readonly ?string $providerMessageId = null,
        public readonly ?string $rawResponse = null,
        public readonly ?string $error = null,
    ) {
    }

    public static function ok(?string $providerMessageId, ?string $rawResponse): self
    {
        return new self(true, false, $providerMessageId, $rawResponse, null);
    }

    public static function failed(?string $error, ?string $rawResponse = null): self
    {
        return new self(false, false, null, $rawResponse, $error);
    }

    /** Gateway is administratively disabled (SMS_ENABLED=false). Logged as 'disabled', not 'failed'. */
    public static function disabled(): self
    {
        return new self(false, true, null, null, 'SMS_ENABLED=false');
    }
}
