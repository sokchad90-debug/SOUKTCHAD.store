<?php
/**
 * Sokchad — Comprehensive Health Check
 * Returns 200 if all checks pass, 503 if any fail.
 */

header('Content-Type: application/json');

$checks = [
    'php'         => true,
    'db'          => false,
    'uploads_dir' => false,
    'jwt'         => false,
    'rate_limit'  => false,
];
$messages = [];

// Check PHP
$checks['php'] = version_compare(PHP_VERSION, '8.0.0', '>=');

// Check DB
try {
    require_once __DIR__ . '/config/database.php';
    $db = getDB();
    $db->query('SELECT 1');
    $checks['db'] = true;
} catch (Exception $e) {
    $messages[] = 'DB: ' . substr($e->getMessage(), 0, 100);
}

// Check uploads directory
$uploadDir = env('UPLOAD_DIR', '/var/www/uploads');
$checks['uploads_dir'] = is_dir($uploadDir) && is_writable($uploadDir);
if (!$checks['uploads_dir']) {
    $messages[] = 'Uploads directory not writable: ' . $uploadDir;
    // Try to create it
    @mkdir($uploadDir, 0755, true);
    $checks['uploads_dir'] = is_dir($uploadDir) && is_writable($uploadDir);
}

// Check JWT secret
$jwtSecret = env('JWT_SECRET', '');
$checks['jwt'] = !empty($jwtSecret) && strlen($jwtSecret >= 32);
if (!$checks['jwt']) {
    $messages[] = 'JWT_SECRET is too short or empty. Set a 64+ char random string in .env';
}

// Check rate limit dir writable
$rateLimitDir = sys_get_temp_dir() . '/sokchad_rate_limit/';
$checks['rate_limit'] = is_writable(dirname($rateLimitDir));
if (!$checks['rate_limit']) {
    $messages[] = 'Rate limit directory not writable: ' . dirname($rateLimitDir);
}

$healthy = !in_array(false, $checks, true);

http_response_code($healthy ? 200 : 503);

echo json_encode([
    'status'    => $healthy ? 'healthy' : 'unhealthy',
    'checks'    => $checks,
    'messages'  => $messages,
    'php_version' => PHP_VERSION,
    'timestamp' => date('c'),
    'version'   => '1.0.0',
], JSON_PRETTY_PRINT);