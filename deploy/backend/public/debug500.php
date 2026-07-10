<?php
// TEMPORARY DEBUG — DELETE AFTER USE
error_reporting(E_ALL);
ini_set('display_errors', 1);

$backendPath = __DIR__ . '/../../backend';

echo "<h2>Paths</h2>";
echo "__DIR__: $__DIR__<br>";
echo "backendPath: $backendPath<br>";
echo "vendor/autoload.php: " . (file_exists($backendPath.'/vendor/autoload.php') ? 'YES ✅' : 'NO ❌') . "<br>";
echo "bootstrap/app.php: "   . (file_exists($backendPath.'/bootstrap/app.php')   ? 'YES ✅' : 'NO ❌') . "<br>";
echo ".env: "                 . (file_exists($backendPath.'/.env')                ? 'YES ✅' : 'NO ❌') . "<br>";

if (!str_starts_with($_SERVER['REQUEST_URI'] ?? '', '/api')) {
    $_SERVER['REQUEST_URI'] = '/api' . ($_SERVER['REQUEST_URI'] ?? '/');
}

if (!file_exists($backendPath.'/vendor/autoload.php')) {
    die("<br><b>Cannot continue — vendor/autoload.php not found at $backendPath</b>");
}

require $backendPath . '/vendor/autoload.php';

try {
    $app = require_once $backendPath . '/bootstrap/app.php';
    echo "<h2>Bootstrap OK ✅</h2>";
} catch (\Throwable $e) {
    die("<b>Bootstrap failed:</b> " . $e->getMessage() . "<pre>" . $e->getTraceAsString() . "</pre>");
}

// Check DB
try {
    $dotenv = Dotenv\Dotenv::createImmutable($backendPath);
    $dotenv->safeLoad();

    $pdo = new PDO(
        'mysql:host=' . ($_ENV['DB_HOST'] ?? '127.0.0.1') . ';dbname=' . ($_ENV['DB_DATABASE'] ?? ''),
        $_ENV['DB_USERNAME'] ?? '',
        $_ENV['DB_PASSWORD'] ?? ''
    );
    echo "<h2>DB Connection OK ✅</h2>";

    $cols = $pdo->query("SHOW COLUMNS FROM loan_settings LIKE 'session_timeout_minutes'")->fetchAll();
    echo "<b>session_timeout_minutes column:</b> " . (count($cols) ? "EXISTS ✅" : "MISSING ❌ — run: php artisan migrate") . "<br>";
} catch (\Throwable $e) {
    echo "<h2>DB Error ❌</h2><b>" . $e->getMessage() . "</b><br>";
}

// Show last Laravel log lines
$logFile = $backendPath . '/storage/logs/laravel.log';
if (file_exists($logFile)) {
    $lines = array_slice(file($logFile), -50);
    echo "<h2>Last Laravel log lines:</h2><pre>" . htmlspecialchars(implode('', $lines)) . "</pre>";
} else {
    echo "<br><b>No log file at:</b> $logFile";
}
