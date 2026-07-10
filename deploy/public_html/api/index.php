<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// ── Server path resolution ─────────────────────────────────────────────────
// On the production server this file lives at:
//   public_html/api/index.php
// The Laravel backend root is at:
//   backend/   (sibling of public_html, two levels up from here)
// So: __DIR__/../../backend = the Laravel root
$backendPath = __DIR__ . '/../../backend';

if (file_exists($maintenance = $backendPath . '/storage/framework/maintenance.php')) {
    require $maintenance;
}

require $backendPath . '/vendor/autoload.php';

/** @var Application $app */
$app = require_once $backendPath . '/bootstrap/app.php';

$app->handleRequest(Request::capture());
