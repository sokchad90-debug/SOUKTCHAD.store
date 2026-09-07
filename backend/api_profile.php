<?php
/**
 * Sokchad — User Profile API
 * ==========================
 * Handles user profile operations (replaces direct Supabase access).
 *
 * ENDPOINTS:
 *   GET  /api_profile.php              → Get current user's profile
 *   PUT  /api_profile.php              → Update profile (avatar, cover, name, phone, bio)
 *   GET  /api_profile.php?id=xxx       → Get another user's public profile
 *
 * SECURITY:
 *   - JWT authentication required for all endpoints
 *   - Users can only update their own profile
 */

require_once __DIR__ . '/config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGetProfile();
        break;
    case 'PUT':
        handleUpdateProfile();
        break;
    default:
        errorResponse('Method not allowed', 405);
}

function handleGetProfile(): void {
    $auth = authenticateUser();
    $db = getDB();

    $userId = getQueryParam('id', $auth['user_id']);

    $stmt = $db->prepare("
        SELECT id, full_name, username, email, phone, role, avatar_url, cover_url,
               is_verified, verified_until, is_banned, banned_until,
               seller_id, rating, total_sales, total_purchases,
               location, bio, language_pref, created_at
        FROM users WHERE id = :id
    ");
    $stmt->execute([':id' => (int)$userId]);
    $profile = $stmt->fetch();

    if (!$profile) {
        errorResponse('Profile not found.', 404);
    }

    // If requesting own profile, include staff permissions
    if ((int)$userId === $auth['user_id'] && in_array($auth['role'] ?? '', ['admin', 'staff'])) {
        $staffStmt = $db->prepare("SELECT permissions, is_active FROM admin_staff WHERE user_id = :uid LIMIT 1");
        $staffStmt->execute([':uid' => $auth['user_id']]);
        $staff = $staffStmt->fetch();
        if ($staff) {
            $profile['staff_permissions'] = json_decode($staff['permissions'], true);
            $profile['staff_active'] = (bool)$staff['is_active'];
        }
    }

    successResponse($profile);
}

function handleUpdateProfile(): void {
    $auth = authenticateUser();
    $userId = $auth['user_id'];
    $db = getDB();

    $body = getRequestBody();
    $allowed = ['full_name', 'username', 'phone', 'avatar_url', 'cover_url', 'location', 'bio', 'language_pref'];
    $updates = [];
    $params = [':id' => $userId];

    foreach ($allowed as $field) {
        if (array_key_exists($field, $body)) {
            $updates[] = "$field = :$field";
            $params[":$field"] = $body[$field];
        }
    }

    if (empty($updates)) {
        errorResponse('No updatable fields provided.');
    }

    // Validate username uniqueness if changing
    if (isset($body['username'])) {
        $checkStmt = $db->prepare("SELECT id FROM users WHERE username = :username AND id != :id");
        $checkStmt->execute([':username' => $body['username'], ':id' => $userId]);
        if ($checkStmt->fetch()) {
            errorResponse('Username already taken.', 409);
        }
    }

    $updateSQL = "UPDATE users SET " . implode(', ', $updates) . ", updated_at = NOW() WHERE id = :id";
    $stmt = $db->prepare($updateSQL);
    $stmt->execute($params);

    successResponse(['id' => $userId], 'Profile updated.');
}