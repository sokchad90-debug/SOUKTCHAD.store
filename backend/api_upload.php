<?php
/**
 * Sokchad — File Upload API (SECURED)
 * ====================================
 * Handles image uploads for avatars, verification, branding.
 * Validates type, size, extension. Generates secure random filenames.
 *
 * ENDPOINT: POST /api_upload.php
 * AUTH: JWT required
 * BODY: multipart/form-data with 'file' field
 */

require_once __DIR__ . '/config/database.php';

// Security headers
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

// Must be POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    errorResponse('Method not allowed. Use POST.', 405);
}

// Rate limit upload
$key = 'upload:' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
if (!checkRateLimit($key, 20, 60)) {
    errorResponse('Upload rate limit exceeded. Please wait.', 429);
}

$auth = authenticateUser();

// Check file uploaded
if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    $errorMsg = match($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE) {
        UPLOAD_ERR_INI_SIZE => 'File exceeds server limit.',
        UPLOAD_ERR_PARTIAL => 'File was only partially uploaded.',
        UPLOAD_ERR_NO_FILE => 'No file uploaded.',
        UPLOAD_ERR_NO_TMP_DIR => 'Missing temp directory.',
        UPLOAD_ERR_CANT_WRITE => 'Failed to write file.',
        default => 'Upload error.'
    };
    errorResponse($errorMsg);
}

$file = $_FILES['file'];

// Validate type
$allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$detectedType = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!in_array($detectedType, $allowedTypes)) {
    errorResponse('Invalid file type. Only JPEG, PNG, GIF, WEBP allowed.');
}

// Validate size (max 10MB)
$maxSize = 10 * 1024 * 1024;
if ($file['size'] > $maxSize) {
    errorResponse('File too large. Max 10MB.');
}

// Validate extension
$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$allowedExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
if (!in_array($ext, $allowedExt)) {
    errorResponse('Invalid file extension.');
}

// Generate secure random filename
$filename = uniqid('img_', true) . '_' . bin2hex(random_bytes(8)) . '.' . $ext;

// Get upload directory from env
$uploadDir = env('UPLOAD_DIR', '/var/www/uploads');
$targetPath = rtrim($uploadDir, '/') . '/' . $filename;

// Create directory if not exists
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// Move file
if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
    errorResponse('Failed to save file.');
}

// Set permissions
chmod($targetPath, 0644);

// Build URL — use the same scheme the request came in over (the API is served
// over plain HTTP on the emulator/host, so a hardcoded https:// produces a
// broken image URL the app can never load).
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || ($_SERVER['SERVER_PORT'] ?? '') == '443'
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? 'sokchad.com';
$baseUrl = $scheme . '://' . $host . '/uploads/';
$fileUrl = $baseUrl . $filename;

successResponse([
    'url' => $fileUrl,
    'filename' => $filename,
    'size' => $file['size'],
    'type' => $detectedType,
], 'File uploaded successfully.');