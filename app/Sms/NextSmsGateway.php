<?php

namespace App\Sms;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Gateway for the NextSMS / messaging-service.co.tz "single text" endpoint.
 * Auth is HTTP Basic (api_key as username, secret_key as password) — verified
 * directly against the live endpoint before this was wired into the app.
 */
class NextSmsGateway implements SmsGatewayInterface
{
    public function send(string $phone, string $message): SmsResult
    {
        $apiUrl = config('sms.api_url');
        $apiKey = config('sms.api_key');
        $secretKey = config('sms.secret_key');
        $senderId = config('sms.sender_id');

        if (!$apiKey || !$secretKey) {
            return SmsResult::failed('SMS gateway credentials are not configured');
        }

        // ============================================================
        // SMS SENDING TEMPORARILY DISABLED (no real messages go out).
        // To re-enable, delete the two lines just below and uncomment
        // the real-send block underneath them.
        // ============================================================
        Log::info("SMS sending is disabled — would have sent to {$phone}: {$message}");
        return SmsResult::ok(null, 'SMS sending disabled (commented out in NextSmsGateway)');

        /*
        try {
            $response = Http::withBasicAuth($apiKey, $secretKey)
                ->asJson()
                ->timeout(15)
                ->post($apiUrl, [
                    'from' => $senderId,
                    'to' => $phone,
                    'text' => $message,
                ]);

            $body = $response->json();
            $raw = $response->body();

            if (!$response->successful()) {
                return SmsResult::failed('Gateway returned HTTP ' . $response->status(), $raw);
            }

            $firstMessage = $body['messages'][0] ?? null;
            $groupName = strtoupper((string) ($firstMessage['status']['groupName'] ?? ''));

            if (in_array($groupName, ['REJECTED', 'FAILED'], true)) {
                return SmsResult::failed('Gateway rejected the message: ' . $groupName, $raw);
            }

            return SmsResult::ok(
                $firstMessage['messageId'] ?? null,
                $raw
            );
        } catch (\Throwable $e) {
            Log::error('NextSmsGateway send error: ' . $e->getMessage());
            return SmsResult::failed($e->getMessage());
        }
        */
    }
}
