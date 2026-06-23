<?php

use Illuminate\Support\Facades\Route;
use App\Models\User;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\TestController;
use App\Http\Controllers\Api\V1\LoanController;
use App\Http\Controllers\Api\V1\CustomerController;

Route::prefix('v1')->group(function () {

    // ========== TEST ROUTES ==========
    Route::get('/test', [TestController::class, 'index']);



    // ========== AUTH ROUTES ==========
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/register', [AuthController::class, 'register']);

    // ========== PROTECTED AUTH ROUTES ==========
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
    });

    // ========== PUBLIC ROUTES (No authentication required) ==========

    // User count
    Route::get('/users/count', function () {
        return response()->json([
            'count' => User::count()
        ]);
    });

    // Loan statistics
    Route::get('/loans/stats', [LoanController::class, 'getStats']);

    // All loans
    Route::get('/loans/all', [LoanController::class, 'allLoans']);

    // ✅ ROUTES MAALUM ZIWE KABLA YA PARAMETER
    // ROUTE YA ACTIVE LOANS - Inaonyesha mikopo inayoendelea (ambayo haijakamilika)
    Route::get('/loans/active', [LoanController::class, 'activeLoans']);

    // ✅ ROUTE YA COMPLETED LOANS - Inaonyesha mikopo iliyokamilika (waliomaliza kulipa)
    // HII NDIO ROUTE MPYA ILIOONGEWA - Inahitajika kwa completed loans
    Route::get('/loans/completed', [LoanController::class, 'completedLoans']);


    // ✅ ROUTE YA UPLOAD PASSPORT PHOTO - Kwa ajili ya kupakia picha ya passport
    Route::post('/upload/passport', [LoanController::class, 'uploadPassport']);

    // ========== REPAYMENT ROUTES (Protected) ==========
    Route::middleware('auth:sanctum')->group(function () {
        // OFFICER APPLICATIONS
        Route::get('/loans/my-applications', [LoanController::class, 'myLoans']);

        // ROUTES ZA APPROVAL FLOW
        Route::get('/loans/manager', [LoanController::class, 'managerLoans']);
        Route::get('/loans/gm', [LoanController::class, 'gmLoans']);
        Route::get('/loans/md', [LoanController::class, 'mdLoans']);

        // FINANCE OFFICER VIEW (Loans approved and awaiting disbursement)
        Route::get('/loans/finance', [LoanController::class, 'financeLoans']);

        // SINGLE LOAN DETAILS
        Route::get('/loans/{id}', [LoanController::class, 'show']);
        Route::put('/loans/{id}', [LoanController::class, 'update']);
        Route::delete('/loans/{id}', [LoanController::class, 'destroy']);

        // ROUTE YA KUONA HISTORIA YA MALIPO YA MKOPO MMOJA
        Route::get('/loans/{id}/repayments', [LoanController::class, 'repaymentHistory']);

        // ROUTE YA KUREKODI MALIPO MPYA
        Route::post('/loans/{id}/repay', [LoanController::class, 'recordRepayment']);

        // ROUTE YA MUHTASARI WA MALIPO (TOTAL DISBURSED, REPAID, OUTSTANDING)
        Route::get('/repayments/summary', [LoanController::class, 'repaymentSummary']);

        // ROUTE YA KUTENGUA MALIPO (FINANCE OFFICER/CASHIER ONLY, WITH AUTHORIZATION)
        Route::post('/repayments/{repaymentId}/reverse', [LoanController::class, 'reverseRepayment']);
    });

    // ========== LOAN SUBMISSION & ACTIONS (Protected) ==========
    Route::middleware('auth:sanctum')->group(function () {
        // ROUTE YA KUTUMA MKOPO MPYA
        Route::post('/loans', [LoanController::class, 'store']);

        // ROUTE YA KUIDHINISHA MKOPO (APPROVE)
        Route::post('/loans/{id}/approve', [LoanController::class, 'approve']);

        // ROUTE YA KUKATA MKOPO (REJECT)
        Route::post('/loans/{id}/reject', [LoanController::class, 'reject']);

        // ROUTE YA KUTOA PESA (DISBURSE)
        Route::post('/loans/{id}/disburse', [LoanController::class, 'disburse']);

        // CUSTOMER ROUTES
        Route::get('/customers', [CustomerController::class, 'index']);
        Route::get('/customers/{id}', [CustomerController::class, 'show']);

        // User management
        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
        Route::put('/users/{id}', [UserController::class, 'update']);
        Route::delete('/users/{id}', [UserController::class, 'destroy']);

        // ========== DRAFT PERSISTENCE ROUTES ==========
        Route::get('/drafts/{type}', [\App\Http\Controllers\Api\V1\LoanDraftController::class, 'show']);
        Route::post('/drafts', [\App\Http\Controllers\Api\V1\LoanDraftController::class, 'save']);
        Route::delete('/drafts/{type}', [\App\Http\Controllers\Api\V1\LoanDraftController::class, 'destroy']);
    });

    // Location routes (Public)
    Route::get('/locations/regions', [\App\Http\Controllers\Api\V1\LocationController::class, 'getRegions']);
    Route::get('/locations/districts/{region_id}', [\App\Http\Controllers\Api\V1\LocationController::class, 'getDistricts']);
    Route::get('/locations/wards/{district_id}', [\App\Http\Controllers\Api\V1\LocationController::class, 'getWards']);
    Route::get('/locations/streets/{ward_id}', [\App\Http\Controllers\Api\V1\LocationController::class, 'getStreets']);

});

// ========== FALLBACK ROUTE FOR AUTH REDIRECTS ==========
// Hii inazuia error "Route [login] not defined"
Route::get('/login', function () {
    return response()->json([
        'message' => 'Unauthorized. Please login first.'
    ], 401);
})->name('login');