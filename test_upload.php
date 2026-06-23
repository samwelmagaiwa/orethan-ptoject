<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use App\Models\Loan;
use App\Http\Requests\StoreLoanRequest;
use App\Services\LoanService;

// Create a dummy file
$fileContent = "dummy image data";
$tempFile = tempnam(sys_get_temp_dir(), 'test');
file_put_contents($tempFile, $fileContent);
$file = new UploadedFile($tempFile, 'test.jpg', 'image/jpeg', null, true);

$path = $file->store('passports', 'public');
$url = Storage::url($path);

echo "Simulated Upload URL: " . $url . "\n";

// Mocking the store request
$data = [
    'name' => 'Test User',
    'phone' => '1234567890',
    'amount' => 1000,
    'type' => 'personal',
    'passport_photo' => $url,
    'details' => ['baruaPepe' => 'test@test.com'],
];

$service = new LoanService();
$loan = $service->createLoan($data);

echo "Created Loan ID: " . $loan->id . "\n";
echo "Saved Passport Photo: " . $loan->passport_photo . "\n";
