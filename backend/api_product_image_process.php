<?php
/**
 * Sokchad — Product Image Whitening Pipeline (worker-based)
 * =========================================================
 * POST /api_product_image_process.php   AUTH: JWT
 * BODY: { "url": "<uploaded product image url>" }
 *
 * Heavy processing runs OFF the UI render path via process_image_worker.py
 * (Pillow, inside the sokchad-api container). The ORIGINAL upload is kept
 * untouched; a separate processed copy (product centered on pure white with
 * safe margin) is saved next to it, cache-keyed by filename; a newer upload
 * supersedes older results. On any failure the ORIGINAL is served inside the
 * white frame as a documented FALLBACK (not a successful removal).
 */

require_once __DIR__ . '/config/database.php';

header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    errorResponse('Method not allowed. Use POST.', 405);
}

$auth = authenticateUser();
$in = json_decode(file_get_contents('php://input'), true);
$url = $in['url'] ?? '';
if (!$url || !filter_var($url, FILTER_VALIDATE_URL)) {
    errorResponse('Missing or invalid url.', 400);
}

// SSRF guard: only our uploads host
$host = parse_url($url, PHP_URL_HOST);
$allowedHosts = [
    $_SERVER['HTTP_HOST'] ?? 'sokchad.com',
    'sokchad.com', 'www.sokchad.com',
    'localhost', 'localhost:8080',
    '10.0.2.2', '10.0.2.2:8080',
];
if (!in_array($host, $allowedHosts, true)) {
    errorResponse('URL host not allowed.', 400);
}

$uploadDir = env('UPLOAD_DIR', '/var/www/uploads');
$procDir   = rtrim($uploadDir, '/') . '/processed';
if (!is_dir($procDir)) { @mkdir($procDir, 0755, true); }

$srcFile = $uploadDir . '/' . basename(parse_url($url, PHP_URL_PATH));
if (!file_exists($srcFile)) {
    errorResponse('Original file not found on server.', 404);
}

$base     = pathinfo($srcFile, PATHINFO_FILENAME);
$procFile = $procDir . '/' . $base . '_white.png';

// Idempotent cache: processed copy newer than source => reuse
if (file_exists($procFile) && filemtime($procFile) >= filemtime($srcFile)) {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $procUrl = $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'sokchad.com')
        . '/uploads/processed/' . basename($procFile);
    successResponse([
        'mode' => 'cached',
        'original_url' => $url,
        'processed_url' => $procUrl,
    ], 'Cached processed image served.');
}

// ── Run the Pillow worker (heavy work off the UI path) ──
$worker = __DIR__ . '/process_image_worker.py';
if (!file_exists($worker)) errorResponse('Worker script missing.', 500);

$cmd = 'python3 ' . escapeshellarg($worker) . ' ' . escapeshellarg($srcFile) . ' ' . escapeshellarg($procFile);
exec($cmd . ' 2>&1', $outLines, $exitCode);

if ($exitCode !== 0 || !file_exists($procFile)) {
    // FALLBACK: serve the ORIGINAL inside the white frame (documented fallback)
    successResponse([
        'mode' => 'fallback_original',
        'original_url' => $url,
        'processed_url' => $url,
        'error_output' => implode("\n", array_slice($outLines, -3)),
    ], 'Processing failed — serving original (fallback).');
}

$mode = 'background_removed';
foreach ($outLines as $line) {
    $j = json_decode($line, true);
    if (is_array($j) && isset($j['mode'])) { $mode = $j['mode']; break; }
}

$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$procUrl = $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'sokchad.com')
    . '/uploads/processed/' . basename($procFile);

successResponse([
    'mode' => $mode,
    'original_url' => $url,
    'processed_url' => $procUrl,
    'original_kept' => true,
], 'Product image processed (original preserved).');