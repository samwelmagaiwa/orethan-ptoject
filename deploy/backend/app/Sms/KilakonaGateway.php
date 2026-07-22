<?php

namespace App\Sms;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Gateway for Kilakona SMS (messaging.kilakona.co.tz).
 * Auth is via api_key + api_secret headers.
 * Tested live 2026-07-16 — sender ID must be pre-approved on the Kilakona dashboard.
 */
class KilakonaGateway implements SmsGatewayInterface
{
    public function send(string $phone, string $message): SmsResult
    {
        $apiUrl    = config('sms.api_url');
        $apiKey    = config('sms.api_key');
        $apiSecret = config('sms.secret_key');
        $senderId  = config('sms.sender_id');

        if (!$apiKey || !$apiSecret) {
            Log::error('KilakonaGateway: credentials missing — api_key=' . ($apiKey ? 'set' : 'EMPTY') . ' api_secret=' . ($apiSecret ? 'set' : 'EMPTY'));
            return SmsResult::failed('SMS gateway credentials are not configured');
        }

        Log::info('KilakonaGateway: sending to=' . $phone . ' url=' . $apiUrl . ' sender=' . $senderId);

        try {
            $response = Http::withHeaders([
                'api_key'    => $apiKey,
                'api_secret' => $apiSecret,
            ])
                ->asJson()
                ->timeout(20)
                ->post($apiUrl, [
                    'senderId'    => $senderId,
                    'messageType' => 'text',
                    'message'     => $message,
                    'contacts'    => $phone,
                ]);

            $body = $response->json();
            $raw  = $response->body();

            Log::info('KilakonaGateway: HTTP=' . $response->status() . ' raw=' . $raw);

            if (!$response->successful()) {
                Log::error('KilakonaGateway: HTTP error ' . $response->status() . ' — ' . $raw);
                return SmsResult::failed('Gateway returned HTTP ' . $response->status(), $raw);
            }

            if (!($body['success'] ?? false)) {
                Log::error('KilakonaGateway: rejected — ' . ($body['message'] ?? 'no message') . ' raw=' . $raw);
                return SmsResult::failed($body['message'] ?? 'Gateway rejected the message', $raw);
            }

            $shootId = $body['data']['shootId'] ?? null;
            Log::info('KilakonaGateway: success shootId=' . $shootId);

            return SmsResult::ok($shootId, $raw);
        } catch (\Throwable $e) {
            Log::error('KilakonaGateway: EXCEPTION ' . get_class($e) . ': ' . $e->getMessage());
            return SmsResult::failed($e->getMessage());
        }
    }
}
