<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// ── Server path resolution ─────────────────────────────────────────────────
// This file lives at: public_html/api/index.php
// Laravel backend root is at: backend/ (two levels up)
$backendPath = __DIR__ . '/../../backend';

// ── LiteSpeed path fix ────────────────────────────────────────────────────
// Routes are registered with apiPrefix:'' so they are at /v1/...
// Browser calls /api/v1/login → LiteSpeed routes to public_html/api/
// REQUEST_URI may still contain /api/ prefix — strip it so Laravel matches.
if (isset($_SERVER['REQUEST_URI']) && str_starts_with($_SERVER['REQUEST_URI'], '/api/')) {
    $_SERVER['REQUEST_URI'] = substr($_SERVER['REQUEST_URI'], 4); // /api/v1/x → /v1/x
}
// ──────────────────────────────────────────────────────────────────────────

if (file_exists($maintenance = $backendPath . '/storage/framework/maintenance.php')) {
    require $maintenance;
}

require $backendPath . '/vendor/autoload.php';

/** @var Application $app */
$app = require_once $backendPath . '/bootstrap/app.php';

$app->handleRequest(Request::capture());
