<?php
/**
 * Sokchad — Admin Users API (SECURED)
 * ====================================
 * SQL Injection FIXED — all queries use Prepared Statements.
 */

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGetUsers();
        break;
    case 'PUT':
        handleUpdateUser();
        break;
    case 'DELETE':
        handleDeleteUser();
        break;
    default:
        errorResponse('Method not allowed', 405);
}

function handleGetUsers(): void {
    $auth = requirePermission('manage_users');
    $db = getDB();

    $userId = getQueryParam('id');
    if ($userId) {
        $stmt = $db->prepare("SELECT id, full_name, username, email, phone, role, avatar_url, cover_url, is_verified, verified_until, is_banned, banned_until, seller_id, rating, total_sales, total_purchases, location, bio, language_pref, created_at FROM users WHERE id = :id");
        $stmt->execute([':id' => (int)$userId]);
        $user = $stmt->fetch();
        if (!$user) errorResponse('User not found', 404);
        successResponse($user);
    }

    $page = max(1, (int)getQueryParam('page', 1));
    $limit = min(100, max(1, (int)getQueryParam('limit', 50)));
    $offset = ($page - 1) * $limit;
    $role = getQueryParam('role');
    $search = getQueryParam('search');

    $where = [];
    $params = [];

    if ($role) {
        $where[] = 'role = :role';
        $params[':role'] = $role;
    }
    if ($search) {
        $where[] = '(username LIKE :search OR email LIKE :search2 OR full_name LIKE :search3)';
        $params[':search'] = "%$search%";
        $params[':search2'] = "%$search%";
        $params[':search3'] = "%$search%";
    }

    $whereSQL = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $countStmt = $db->prepare("SELECT COUNT(*) FROM users $whereSQL");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $stmt = $db->prepare("SELECT id, full_name, username, email, phone, role, avatar_url, is_verified, is_banned, seller_id, rating, total_sales, total_purchases, location, created_at FROM users $whereSQL ORDER BY created_at DESC LIMIT :limit OFFSET :offset");
    $params[':limit'] = $limit;
    $params[':offset'] = $offset;
    $stmt->execute($params);
    $users = $stmt->fetchAll();

    jsonResponse([
        'success' => true,
        'data' => $users,
        'page' => $page,
        'per_page' => $limit,
        'total' => $total,
        'total_pages' => (int)ceil($total / $limit),
    ]);
}

function handleUpdateUser(): void {
    $auth = requirePermission('manage_users');
    $userId = $auth['user_id'];
    $role = $auth['role'];
    $db = getDB();

    $targetId = getQueryParam('id');
    if (!$targetId) errorResponse('User ID is required.');

    $body = getRequestBody();
    $updates = [];
    $params = [':id' => (int)$targetId];

    // Ban / unban — SECURED with prepared statements
    if (isset($body['is_banned'])) {
        $banned = (bool)$body['is_banned'];
        $banUntil = $body['banned_until'] ?? null;
        if ($banned) {
            $updates[] = "is_banned = 1";
            if ($banUntil) {
                $updates[] = "banned_until = :ban_until";
                $params[':ban_until'] = $banUntil;
            } else {
                $updates[] = "banned_until = NULL";
            }
        } else {
            $updates[] = "is_banned = 0, banned_until = NULL";
        }
    }

    // Verify / unverify — SECURED
    if (isset($body['is_verified'])) {
        $verified = (bool)$body['is_verified'];
        $verifyUntil = $body['verified_until'] ?? null;
        if ($verified) {
            $updates[] = "is_verified = 1";
            if ($verifyUntil) {
                $updates[] = "verified_until = :verify_until";
                $params[':verify_until'] = $verifyUntil;
            } else {
                $updates[] = "verified_until = DATE_ADD(NOW(), INTERVAL 365 DAY)";
            }
        } else {
            $updates[] = "is_verified = 0, verified_until = NULL";
        }
    }

    // Change role (super_admin only) — SECURED
    if (isset($body['role']) && $role === 'super_admin') {
        $validRoles = ['buyer', 'seller', 'admin', 'super_admin', 'staff'];
        if (!in_array($body['role'], $validRoles)) {
            errorResponse('Invalid role.');
        }
        $updates[] = "role = :role";
        $params[':role'] = $body['role'];
    } elseif (isset($body['role']) && $role !== 'super_admin') {
        errorResponse('Only super_admin can change user roles.', 403);
    }

    if (empty($updates)) {
        errorResponse('No updates provided.');
    }

    $updateSQL = "UPDATE users SET " . implode(', ', $updates) . ", updated_at = NOW() WHERE id = :id";
    $stmt = $db->prepare($updateSQL);
    $stmt->execute($params);

    if ($stmt->rowCount() === 0) {
        errorResponse('User not found or no changes made.', 404);
    }

    successResponse(['id' => $targetId], 'User updated successfully.');
}

function handleDeleteUser(): void {
    $auth = requireAdmin();
    if ($auth['role'] !== 'super_admin') {
        errorResponse('Only super_admin can delete users.', 403);
    }

    $db = getDB();
    $targetId = getQueryParam('id');
    if (!$targetId) errorResponse('User ID is required.');

    if ((int)$targetId === $auth['user_id']) {
        errorResponse('You cannot delete your own account.', 400);
    }

    $stmt = $db->prepare("DELETE FROM users WHERE id = :id");
    $stmt->execute([':id' => (int)$targetId]);

    if ($stmt->rowCount() === 0) {
        errorResponse('User not found.', 404);
    }

    successResponse(['id' => $targetId], 'User deleted.');
}