<?php

namespace App\Sms;

/** Outcome of a single SMS send attempt, independent of which gateway sent it. */
class SmsResult
{
    public function __construct(
        public readonly bool $success,
        public readonly ?string $providerMessageId = null,
        public readonly ?string $rawResponse = null,
        public readonly ?string $error = null,
    ) {
    }

    public static function ok(?string $providerMessageId, ?string $rawResponse): self
    {
        return new self(true, $providerMessageId, $rawResponse, null);
    }

    public static function failed(?string $error, ?string $rawResponse = null): self
    {
        return new self(false, null, $rawResponse, $error);
    }
}
