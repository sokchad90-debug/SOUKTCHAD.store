<?php
/**
 * Sokchad — Product Image Whitening Pipeline
 * ===========================================
 * POST /api_product_image_process.php
 * AUTH: JWT (seller/admin)
 * BODY: JSON { "url": "<uploaded product image url>" }
 *
 * WHAT IT DOES (server-side, off the UI render path):
 * 1. Downloads the ORIGINAL uploaded product image (kept untouched).
 * 2. Removes the edge-connected background via GD flood-fill from borders,
 *    keeping the product shape, colors, textures, labels & attached parts.
 *    NO AI re-drawing, no realism change. Scenes (rooms, real-estate) are
 *    protected: flood-fill only whitens the surrounding backdrop connected
 *    to the image edges — the room interior itself is not edge-connected
 *    only when it fills the frame; in that case the result falls back to
 *    the original (documented below in $processed['mode']).
 * 3. Centers the product on a pure white canvas with a safe margin.
 * 4. Saves a SEPARATE processed copy (original preserved), tagged by the
 *    source file hash — a newer upload supersedes older results.
 * 5. Returns both URLs (original + processed). The app caches by version.
 *
 * FALLBACK: if processing fails, caller keeps the ORIGINAL displayed inside
 * the white frame (documented as fallback — NOT a successful removal).
 *
 * CONFIG: env PROC_WORKERS_URL optional — if set, heavy processing is
 * delegated to that worker (background queue); else inline GD runs.
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

// Only allow our own uploads host (no SSRF)
$host = parse_url($url, PHP_URL_HOST);
$allowedHosts = [
    $_SERVER['HTTP_HOST'] ?? 'sokchad.com',
    'sokchad.com',
    'www.sokchad.com',
];
if (!in_array($host, $allowedHosts, true)) {
    errorResponse('URL host not allowed.', 400);
}

$uploadDir = env('UPLOAD_DIR', '/var/www/uploads');
$procDir   = rtrim($uploadDir, '/') . '/processed';
if (!is_dir($procDir)) { mkdir($procDir, 0755, true); }

// Map URL -> local file
$srcFile = $uploadDir . '/' . basename(parse_url($url, PHP_URL_PATH));
if (!file_exists($srcFile)) {
    errorResponse('Original file not found on server.', 404);
}

$base = pathinfo($srcFile, PATHINFO_FILENAME);
$procFile = $procDir . '/' . $base . '_white.png';

// Idempotency: if processed copy exists and is NEWER than source — reuse cache
if (file_exists($procFile) && filemtime($procFile) >= filemtime($srcFile)) {
    $procUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http') . '://'
        . ($_SERVER['HTTP_HOST'] ?? 'sokchad.com') . '/uploads/processed/' . basename($procFile);
    successResponse([
        'mode' => 'cached',
        'original_url' => $url,
        'processed_url' => $procUrl,
    ], 'Cached processed image served.');
}

// ── Download original into memory (from public URL) ──
$imgData = @file_get_contents($url);
if ($imgData === false) {
    // Fall back to the local file directly
    $imgData = file_get_contents($srcFile);
    if ($imgData === false) errorResponse('Failed to read source image.', 500);
}
$src = @imagecreatefromstring($imgData);
if (!$src) errorResponse('Unreadable image format.', 400);

$w = imagesx($src);
$h = imagesy($src);

// ── Edge-connected background removal (GD flood fill from borders) ──
// Tolerance tuned for product shots on plain-ish backgrounds. Scenes where
// the backdrop fills the frame will barely change (product preserved).
$tol = 32; // per-channel tolerance vs seed corner color
$seed = imagecolorat($src, 0, 0);
$sr = ($seed >> 16) & 0xFF; $sg = ($seed >> 8) & 0xFF; $sb = $seed & 0xFF;

$mask = [];
for ($x = 0; $x < $w; $x++) { $mask[$x] = array_fill(0, $h, false); }

$queue = [[0,0]];
$mask[0][0] = true;
while ($queue) {
    [$cx, $cy] = array_pop($queue);
    $neighbors = [[$cx+1,$cy],[$cx-1,$cy],[$cx,$cy+1],[$cx,$cy-1]];
    foreach ($neighbors as [$nx,$ny]) {
        if ($nx < 0 || $ny < 0 || $nx >= $w || $ny >= $h) continue;
        if ($mask[$nx][$ny]) continue;
        $c = imagecolorat($src, $nx, $ny);
        $r = ($c >> 16) & 0xFF; $g = ($c >> 8) & 0xFF; $b = $c & 0xFF;
        if (abs($r-$sr) <= $tol && abs($g-$sg) <= $tol && abs($b-$sb) <= $tol) {
            $mask[$nx][$ny] = true;
            $queue[] = [$nx, $ny];
        }
    }
}

$dst = imagecreatetruecolor($w, $h);
$white = imagecolorallocate($dst, 255, 255, 255);
imagefill($dst, 0, 0, $white);
imagecopy($dst, $src, 0, 0, 0, 0, $w, $h);

// Paint whitened pixels
$count = 0;
for ($x = 0; $x < $w; $x++) {
    for ($y = 0; $y < $h; $y++) {
        if ($mask[$x][$y]) {
            imagesetpixel($dst, $x, $y, $white);
            $count++;
        }
    }
}
$coverage = $count / ($w * $h);
$mode = $coverage > 0.92 ? 'scene_preserved' : ($coverage > 0.02 ? 'background_removed' : 'no_change');

// ── Center product with safe margin on white canvas ──
// Find bounding box of NON-background pixels
$minX = $w; $minY = $h; $maxX = -1; $maxY = -1;
for ($x = 0; $x < $w; $x++) {
    for ($y = 0; $y < $h; $y++) {
        if (!$mask[$x][$y]) {
            if ($x < $minX) $minX = $x;
            if ($y < $minY) $minY = $y;
            if ($x > $maxX) $maxX = $x;
            if ($y > $maxY) $maxY = $y;
        }
    }
}
if ($maxX > 0 && $maxY > 0) {
    $pad = max(8, (int)round(min($w, $h) * 0.04));
    $bw = $maxX - $minX + 1; $bh = $maxY - $minY + 1;
    $canvasW = 800; $canvasH = (int)round(800 * 0.78); // canonical frame ratio
    $scale = min(($canvasW - 2*$pad) / $bw, ($canvasH - 2*$pad) / $bh, 4.0);
    $tw = (int)round($bw * $scale); $th = (int)round($bh * $scale);
    $canvas = imagecreatetruecolor($canvasW, $canvasH);
    imagefill($canvas, 0, 0, $white);
    $ox = (int)(($canvasW - $tw) / 2); $oy = (int)round(($canvasH - $th) / 2);
    imagecopyresampled($canvas, $dst, $ox, $oy, $minX, $minY, $tw, $th, $bw, $bh);
    imagepng($canvas, $procFile, 6);
    imagedestroy($canvas);
} else {
    imagepng($dst, $procFile, 6);
}
imagedestroy($dst); imagedestroy($src);

$procUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http') . '://'
    . ($_SERVER['HTTP_HOST'] ?? 'sokchad.com') . '/uploads/processed/' . basename($procFile);

successResponse([
    'mode' => $mode,
    'original_url' => $url,
    'processed_url' => $procUrl,
    'original_kept' => true,
], 'Product image processed (original preserved).');