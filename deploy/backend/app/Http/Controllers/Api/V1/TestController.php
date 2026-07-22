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

    /** GET /test/otp-diag?email=xxx@xxx.com — simulates full OTP flow for a user */
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

        $diag = [
            'user' => [
                'id'          => $user->id,
                'name'        => $user->name,
                'email'       => $user->email,
                'role'        => $user->role,
                'phone'       => $user->phone ?? 'NULL — this is why SMS fails',
                'first_login' => $user->first_login,
            ],
            'phone_check' => null,
            'sms_result'  => null,
        ];

        $normalized = PhoneNumber::normalize($user->phone, config('sms.country_code', '255'));
        $diag['phone_check'] = [
            'raw'        => $user->phone,
            'normalized' => $normalized,
            'valid'      => PhoneNumber::isValid($normalized),
        ];

        // Simulate the exact sendOtp call
        $otp = '999999'; // test OTP
        $result = app(SmsService::class)->sendOtp($user, $otp, 'first_login');

        $diag['sms_result'] = [
            'success'      => $result->success,
            'disabled'     => $result->disabled,
            'error'        => $result->error,
            'shootId'      => $result->providerMessageId,
            'raw_response' => $result->rawResponse,
        ];

        // Also show what message was actually sent
        $diag['message_sent'] = \App\Sms\SmsTemplates::otp($user->name, '999999', 'first_login');
        $diag['message_length'] = strlen($diag['message_sent']);

        // Last 5 sms_logs for this user's phone
        $diag['recent_sms_logs'] = DB::table('sms_logs')
            ->where('phone', 'like', '%' . substr($user->phone ?? '', -7) . '%')
            ->orderByDesc('created_at')
            ->limit(5)
            ->get(['id', 'type', 'phone', 'status', 'error', 'created_at']);

        return response()->json($diag);
    }
}