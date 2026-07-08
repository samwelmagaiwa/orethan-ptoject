<?php
// TEMPORARY DIAGNOSTIC — DELETE AFTER USE
error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: text/plain');

$backendPath = dirname(dirname(__DIR__)) . '/backend';

echo "=== PATH CHECK ===\n";
echo "__DIR__:      " . __DIR__ . "\n";
echo "backendPath:  " . $backendPath . "\n\n";

$checks = [
    'vendor/autoload.php',
    'bootstrap/app.php',
    '.env',
];
foreach ($checks as $f) {
    $full = $backendPath . '/' . $f;
    echo "$f: " . (file_exists($full) ? "YES" : "NO — MISSING") . "\n";
}

echo "\n=== PHP ===\n";
echo "PHP version: " . PHP_VERSION . "\n";

echo "\n=== AUTOLOAD ===\n";
$autoload = $backendPath . '/vendor/autoload.php';
if (file_exists($autoload)) {
    try { require $autoload; echo "autoload: OK\n"; }
    catch (Throwable $e) { echo "ERROR: " . $e->getMessage() . "\n"; }
} else { echo "SKIPPED\n"; }

echo "\n=== BOOTSTRAP ===\n";
$boot = $backendPath . '/bootstrap/app.php';
if (file_exists($autoload) && file_exists($boot)) {
    try {
        $app = require_once $boot;
        echo "bootstrap: OK\n";
        echo "App class: " . get_class($app) . "\n";
    } catch (Throwable $e) {
        echo "ERROR: " . $e->getMessage() . "\n";
        echo "In: " . $e->getFile() . ":" . $e->getLine() . "\n";
    }
} else { echo "SKIPPED\n"; }

echo "\nDONE\n";
