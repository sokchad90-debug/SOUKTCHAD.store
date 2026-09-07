<?php
/**
 * Sokchad — Database Configuration (VPS-Ready)
 * ==============================================
 * Reads ALL credentials from environment variables (.env file or Docker env).
 * No hardcoded values — works on any VPS without code changes.
 *
 * Environment variables (set in .env or docker-compose.yml):
 *   DB_HOST, DB_NAME, DB_USER, DB_PASS, DB_PORT
 *   JWT_SECRET
 *   CORS_ALLOWED_ORIGINS (comma-separated)
 *   UPLOAD_DIR
 */

// ============================================================
// ENVIRONMENT LOADER — reads .env if present (non-Docker)
// ============================================================
function loadEnv(string $path): void {
    if (!file_exists($path)) return;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (str_starts_with(trim($line), '#')) continue;
        [$key, $value] = explode('=', $line, 2) + [null, null];
        if ($key === null) continue;
        $key = trim($key);
        $value = trim($value, '"\'');
        if (!array_key_exists($key, $_ENV)) $_ENV[$key] = $value;
        if (!getenv($key)) putenv("$key=$value");
    }
}

// Load .env from backend root or parent
loadEnv(__DIR__ . '/../.env');
loadEnv(__DIR__ . '/../../.env');

function env(string $key, string $default = ''): string {
    $val = getenv($key);
    if ($val === false) $val = $_ENV[$key] ?? $default;
    return $val ?: $default;
}

// ============================================================
// RATE LIMITING — Prevent brute force & DDoS
// ============================================================
function checkRateLimit(string $key, int $maxAttempts = 30, int $windowSeconds = 60): bool {
    $cacheDir = sys_get_temp_dir() . '/sokchad_rate_limit/';
    if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);
    $cacheFile = $cacheDir . md5($key);
    if (!file_exists($cacheFile)) {
        file_put_contents($cacheFile, json_encode(['count' => 1, 'first_attempt' => time(), 'last_attempt' => time()]));
        return true;
    }
    $data = json_decode(file_get_contents($cacheFile), true);
    $now = time();
    if ($now - $data['first_attempt'] > $windowSeconds) {
        file_put_contents($cacheFile, json_encode(['count' => 1, 'first_attempt' => $now, 'last_attempt' => $now]));
        return true;
    }
    if ($data['count'] >= $maxAttempts) return false;
    $data['count']++;
    $data['last_attempt'] = $now;
    file_put_contents($cacheFile, json_encode($data));
    return true;
}

// ============================================================
// INPUT VALIDATION
// ============================================================
function validateInt($value, int $min = 1, int $max = PHP_INT_MAX): int {
    $int = filter_var($value, FILTER_VALIDATE_INT);
    if ($int === false || $int < $min || $int > $max) {
        errorResponse("Invalid integer value. Must be between $min and $max.");
    }
    return $int;
}

function validateString(string $value, int $maxLength = 255): string {
    $value = trim($value);
    if (empty($value)) errorResponse('String cannot be empty.');
    if (strlen($value) > $maxLength) errorResponse("String too long. Max $maxLength characters.");
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

function validateEmail(string $email): string {
    $email = filter_var($email, FILTER_VALIDATE_EMAIL);
    if (!$email) errorResponse('Invalid email address.');
    return $email;
}

function validatePhone(string $phone): string {
    if (!preg_match('/^[0-9\+\-\s\(\)]{10,20}$/', $phone)) errorResponse('Invalid phone number format.');
    return preg_replace('/[^0-9\+]/', '', $phone);
}

// ============================================================
// SECURITY LOGGING
// ============================================================
function logSecurityEvent(string $event, array $context = []): void {
    $logDir = env('LOG_DIR', '/var/log/sokchad');
    if (!is_dir($logDir)) @mkdir($logDir, 0755, true);
    $logEntry = sprintf(
        "[%s] %s | IP: %s | UA: %s | Context: %s\n",
        date('Y-m-d H:i:s'),
        $event,
        $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
        json_encode($context)
    );
    @file_put_contents($logDir . '/security.log', $logEntry, FILE_APPEND);
}

// ============================================================
// DATABASE CREDENTIALS — from environment
// ============================================================
define('DB_HOST', env('DB_HOST', 'db'));
define('DB_NAME', env('DB_NAME', 'sokchad'));
define('DB_USER', env('DB_USER', 'sokchad'));
define('DB_PASS', env('DB_PASS', 'sokchad_secret'));
define('DB_PORT', env('DB_PORT', '3306'));
define('DB_CHARSET', 'utf8mb4');

// ============================================================
// JWT SECRET — from environment
// ============================================================
define('JWT_SECRET', env('JWT_SECRET', 'default_dev_only_change_in_prod_09b1708f2f6b806fcc8688a489a98d9d5679e9b418fab8b849dc749bac499a24'));
define('JWT_EXPIRY', 86400 * 7); // 7 days

// ============================================================
// CORS HEADERS — read allowed origins from environment
// ============================================================
$ALLOWED_ORIGINS = array_filter(array_map('trim', explode(',', env('CORS_ALLOWED_ORIGINS', 'https://sokchad.com,http://localhost:8081,http://localhost:19006,http://localhost:19000,exp://localhost:8081'))));

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (!empty($origin) && in_array($origin, $ALLOWED_ORIGINS)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
} elseif (!empty($origin)) {
    // Unknown origin with a value — reject
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Origin not allowed.']);
    exit;
}
// If origin is empty (mobile app), allow silently

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Max-Age: 3600');

// Security headers
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: geolocation=(), microphone=(), camera=()');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ============================================================
// PDO CONNECTION
// ============================================================
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error'   => 'Database connection failed. Check DB credentials.'
            ]);
            error_log('DB Connection Error: ' . $e->getMessage());
            exit();
        }
    }
    return $pdo;
}

// ============================================================
// HELPERS
// ============================================================
function jsonResponse(array $data, int $statusCode = 200): void {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit();
}

function successResponse($data, string $message = 'OK'): void {
    jsonResponse(['success' => true, 'data' => $data, 'message' => $message]);
}

function errorResponse(string $error, int $statusCode = 400): void {
    jsonResponse(['success' => false, 'error' => $error], $statusCode);
}

// ============================================================
// JWT ENCODE/DECODE
// ============================================================
function encodeJWT(array $payload): string {
    $header = base64url_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload['exp'] = time() + JWT_EXPIRY;
    $payloadEncoded = base64url_encode(json_encode($payload));
    $signature = base64url_encode(
        hash_hmac('sha256', "$header.$payloadEncoded", JWT_SECRET, true)
    );
    return "$header.$payloadEncoded.$signature";
}

function decodeJWT(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $payload, $signature] = $parts;
    $expectedSig = base64url_encode(
        hash_hmac('sha256', "$header.$payload", JWT_SECRET, true)
    );
    if (!hash_equals($expectedSig, $signature)) return null;
    $data = json_decode(base64url_decode($payload), true);
    if (!$data) return null;
    if (isset($data['exp']) && $data['exp'] < time()) return null;
    return $data;
}

function base64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): string {
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', 3 - (3 + strlen($data)) % 4));
}

// ============================================================
// AUTHENTICATE USER FROM JWT (with Rate Limiting)
// ============================================================
function authenticateUser(): array {
    // Rate limit by IP
    $key = 'auth:' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    if (!checkRateLimit($key, 30, 60)) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', ['ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown']);
        errorResponse('Rate limit exceeded. Please wait.', 429);
    }

    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (empty($header) || !str_starts_with($header, 'Bearer ')) {
        errorResponse('Authentication required. Please log in.', 401);
    }
    $token = substr($header, 7);
    $payload = decodeJWT($token);
    if (!$payload || !isset($payload['user_id'])) {
        errorResponse('Invalid or expired token. Please log in again.', 401);
    }
    return $payload;
}

// ============================================================
// REQUEST BODY & QUERY PARAMS
// ============================================================
function getRequestBody(): array {
    $body = file_get_contents('php://input');
    $data = json_decode($body, true);
    return is_array($data) ? $data : [];
}

function getQueryParam(string $key, $default = null) {
    return $_GET[$key] ?? $default;
}