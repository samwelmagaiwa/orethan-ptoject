<?php

namespace App\Sms;

/** Normalizes Tanzanian phone numbers to the MSISDN format the gateway expects (255XXXXXXXXX). */
class PhoneNumber
{
    public static function normalize(?string $raw, string $countryCode = '255'): ?string
    {
        if (!$raw) {
            return null;
        }

        $digits = preg_replace('/\D+/', '', $raw);
        if ($digits === '' || $digits === null) {
            return null;
        }

        // 0743519104 -> 255743519104
        if (str_starts_with($digits, '0')) {
            return $countryCode . substr($digits, 1);
        }

        // 743519104 -> 255743519104
        if (strlen($digits) === 9) {
            return $countryCode . $digits;
        }

        // Already in 255743519104 form (or another country code the caller passed in).
        return $digits;
    }

    public static function isValid(?string $normalized): bool
    {
        return (bool) ($normalized && preg_match('/^\d{12}$/', $normalized));
    }
}
