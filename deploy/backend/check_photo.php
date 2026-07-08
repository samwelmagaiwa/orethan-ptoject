<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Loan;

$latestLoan = Loan::orderBy('id', 'desc')->first();

if ($latestLoan) {
    echo "Latest Loan ID: " . $latestLoan->id . "\n";
    echo "Passport Photo Column: " . ($latestLoan->passport_photo ?? 'NULL') . "\n";
    echo "Details Passport Photo: " . ($latestLoan->details['passportPhotoUrl'] ?? 'NULL') . "\n";
} else {
    echo "No loans found.\n";
}
