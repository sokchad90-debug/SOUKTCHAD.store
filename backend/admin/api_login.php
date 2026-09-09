<?php
/**
 * Sokchad — Admin Panel Login API
 * Authenticates admin users and returns JWT token.
 */

require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    errorResponse('Method not allowed', 405);
}

$body = getRequestBody();
$email = trim($body['email'] ?? '');
$password = $body['password'] ?? '';

if (empty($email) || empty($password)) {
    errorResponse('Email and password required.');
}

// Rate limit login attempts
$key = 'login:' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
if (!checkRateLimit($key, 5, 60)) {
    logSecurityEvent('LOGIN_RATE_LIMIT', ['email' => $email, 'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown']);
    errorResponse('Too many login attempts. Please wait 60 seconds.', 429);
}

$db = getDB();

// Check admin_staff table
$stmt = $db->prepare("SELECT * FROM admin_staff WHERE email = :email AND is_active = 1 LIMIT 1");
$stmt->execute([':email' => $email]);
$staff = $stmt->fetch();

if (!$staff || !password_verify($password, $staff['password_hash'])) {
    logSecurityEvent('LOGIN_FAILED', ['email' => $email, 'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown']);
    errorResponse('Invalid credentials.', 401);
}

// Check if user is also in users table with admin role
$userStmt = $db->prepare("SELECT id, role FROM users WHERE email = :email LIMIT 1");
$userStmt->execute([':email' => $email]);
$user = $userStmt->fetch();

$role = $user['role'] ?? 'staff';
$userId = $user['id'] ?? (int)$staff['user_id'];

// Generate JWT
$token = encodeJWT([
    'user_id' => $userId,
    'email' => $email,
    'role' => $role,
    'permissions' => json_decode($staff['permissions'], true) ?: [],
]);

logSecurityEvent('LOGIN_SUCCESS', ['email' => $email, 'role' => $role]);

successResponse([
    'token' => $token,
    'user' => [
        'id' => $userId,
        'name' => $staff['name'],
        'email' => $email,
        'role' => $role,
        'permissions' => json_decode($staff['permissions'], true) ?: [],
    ],
], 'Login successful.');