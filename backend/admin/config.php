<?php
/**
 * Sokchad — Admin API Configuration (VPS-Ready)
 * ==============================================
 * Reads CORS origins from environment variables.
 * Shares database.php for DB/JWT helpers.
 */

require_once __DIR__ . '/../config/database.php';

// ============================================================
// ADMIN CORS — Restricted to admin panel domain only
// ============================================================
$ADMIN_ALLOWED_ORIGINS = array_filter(array_map('trim', explode(',', env('ADMIN_CORS_ALLOWED_ORIGINS', 'https://admin.sokchad.com,http://localhost:8081,http://localhost:19006'))));

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (!empty($origin) && in_array($origin, $ADMIN_ALLOWED_ORIGINS)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
} elseif (!empty($origin)) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Admin origin not allowed.']);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ============================================================
// ADMIN AUTHENTICATION GUARDS
// ============================================================
function requireAdmin(): array {
    $auth = authenticateUser();
    $role = $auth['role'] ?? 'buyer';
    if (!in_array($role, ['admin', 'super_admin', 'staff'])) {
        errorResponse('Admin access required. Your role: ' . $role, 403);
    }
    return $auth;
}

function requirePermission(string $permission): array {
    $auth = requireAdmin();
    if (($auth['role'] ?? '') === 'super_admin') return $auth;
    $permissions = $auth['permissions'] ?? [];
    if (!in_array($permission, $permissions)) {
        errorResponse("Missing permission: $permission", 403);
    }
    return $auth;
}