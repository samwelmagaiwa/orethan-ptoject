<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Server structure:
//   public_html/api/index.php  ← __DIR__
//   backend/                   ← ../../backend/ relative to here
$backendPath = dirname(dirname(__DIR__)) . '/backend';

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = $backendPath . '/storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
require $backendPath . '/vendor/autoload.php';

// Bootstrap Laravel and handle the request...
/** @var Application $app */
$app = require_once $backendPath . '/bootstrap/app.php';

$app->handleRequest(Request::capture());
