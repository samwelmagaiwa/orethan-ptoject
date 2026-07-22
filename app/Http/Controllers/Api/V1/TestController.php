<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Sms\KilakonaGateway;
use App\Sms\PhoneNumber;
use App\Sms\SmsService;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;

class TestController extends Controller
{
    public function index()
    {
        return response()->json(['message' => 'OK']);
    }

    /** GET /test/sms-diag?phone=0617919104 — tests the full SMS stack from the server */
    public function smsDiag(Request $request)
    {
        $phone = $request->query('phone', '0617919104');

        $apiUrl    = config('sms.api_url');
        $apiKey    = config('sms.api_key');
        $apiSecret = config('sms.secret_key');
        $senderId  = config('sms.sender_id');
        $enabled   = config('sms.enabled');
        $normalized = PhoneNumber::normalize($phone, config('sms.country_code', '255'));
        $valid      = PhoneNumber::isValid($normalized);

        $diag = [
            'env_check' => [
                'SMS_ENABLED'    => $enabled,
                'SMS_API_URL'    => $apiUrl,
                'SMS_API_KEY'    => $apiKey ? substr($apiKey, 0, 3) . '***' : 'EMPTY',
                'SMS_SECRET_KEY' => $apiSecret ? substr($apiSecret, 0, 3) . '***' : 'EMPTY',
                'SMS_SENDER_ID'  => $senderId,
            ],
            'phone_check' => [
                'input'      => $phone,
                'normalized' => $normalized,
                'valid'      => $valid,
            ],
        ];

        if (!$apiKey || !$apiSecret) {
            return response()->json(array_merge($diag, ['result' => 'FAIL: credentials empty']));
        }

        if (!$valid) {
            return response()->json(array_merge($diag, ['result' => 'FAIL: phone invalid after normalization']));
        }

        // Attempt actual send
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
                    'message'     => 'Test SMS from Orethan server. Ignore.',
                    'contacts'    => $normalized,
                ]);

            $diag['http_status']   = $response->status();
            $diag['raw_response']  = $response->body();
            $diag['parsed']        = $response->json();
            $diag['result']        = $response->successful() && ($response->json('success') === true)
                ? 'SUCCESS: SMS sent'
                : 'FAIL: gateway rejected';
        } catch (\Throwable $e) {
            $diag['result']    = 'EXCEPTION: ' . get_class($e);
            $diag['exception'] = $e->getMessage();
        }

        return response()->json($diag);
    }

    /** GET /test/otp-diag?email=xxx@xxx.com — directly tests OTP message against Kilakona */
    public function otpDiag(Request $request)
    {
        $email = $request->query('email');
        if (!$email) {
            return response()->json(['error' => 'Pass ?email=user@example.com']);
        }

        $user = User::where('email', $email)->first();
        if (!$user) {
            return response()->json(['error' => 'User not found']);
        }

        $apiUrl    = config('sms.api_url');
        $apiKey    = config('sms.api_key');
        $apiSecret = config('sms.secret_key');
        $senderId  = config('sms.sender_id');
        $phone     = PhoneNumber::normalize($user->phone, config('sms.country_code', '255'));

        // Build the exact OTP message the system would send
        $message = "Orethan: Nambari yako ya OTP ni 999999. Halali kwa dakika 10. Usimwambie mtu. - Orethan Microfinance";

        $diag = [
            'user_phone'     => $user->phone,
            'normalized'     => $phone,
            'message'        => $message,
            'message_length' => strlen($message),
            'api_url'        => $apiUrl,
            'sender_id'      => $senderId,
            'api_key_prefix' => $apiKey ? substr($apiKey, 0, 3) . '***' : 'EMPTY',
        ];

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

            $diag['http_status']  = $response->status();
            $diag['raw_response'] = $response->body();
            $diag['parsed']       = $response->json();
            $diag['result']       = ($response->successful() && ($response->json('success') === true))
                ? 'SUCCESS'
                : 'FAILED';
        } catch (\Throwable $e) {
            $diag['result']    = 'EXCEPTION';
            $diag['exception'] = get_class($e) . ': ' . $e->getMessage();
        }

        return response()->json($diag);
    }
}