<?php
/**
 * Sokchad — Admin Staff API (SECURED)
 * ====================================
 * SQL Injection FIXED — all queries use Prepared Statements.
 */

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleListStaff();
        break;
    case 'POST':
        handleCreateStaff();
        break;
    case 'PUT':
        handleUpdateStaff();
        break;
    case 'DELETE':
        handleDeleteStaff();
        break;
    default:
        errorResponse('Method not allowed', 405);
}

function handleListStaff(): void {
    $auth = requireAdmin();
    $db = getDB();

    $stmt = $db->query("SELECT id, user_id, name, email, permissions, is_active, created_at FROM admin_staff ORDER BY created_at DESC");
    $staff = $stmt->fetchAll();
    successResponse($staff);
}

function handleCreateStaff(): void {
    $auth = requireAdmin();
    if ($auth['role'] !== 'super_admin') {
        errorResponse('Only super_admin can create staff.', 403);
    }

    $db = getDB();
    $body = getRequestBody();

    $required = ['email', 'password', 'name', 'permissions'];
    foreach ($required as $field) {
        if (empty($body[$field])) errorResponse("Field '$field' is required.");
    }

    $email = trim($body['email']);
    $name = trim($body['name']);
    $password = $body['password'];
    $permissions = is_array($body['permissions']) ? json_encode($body['permissions']) : '[]';

    // Check if email already exists — SECURED
    $checkStmt = $db->prepare("SELECT id FROM admin_staff WHERE email = :email");
    $checkStmt->execute([':email' => $email]);
    if ($checkStmt->fetch()) {
        errorResponse('A staff member with this email already exists.', 409);
    }

    $hashed = password_hash($password, PASSWORD_BCRYPT);

    // Insert — SECURED
    $stmt = $db->prepare("
        INSERT INTO admin_staff (user_id, name, email, password_hash, permissions, is_active, created_at)
        VALUES (:user_id, :name, :email, :password, :permissions, 1, NOW())
    ");
    $stmt->execute([
        ':user_id' => $auth['user_id'],
        ':name' => $name,
        ':email' => $email,
        ':password' => $hashed,
        ':permissions' => $permissions,
    ]);

    $newId = $db->lastInsertId();
    successResponse(['id' => $newId, 'name' => $name, 'email' => $email, 'permissions' => json_decode($permissions)], 'Staff member created.');
}

function handleUpdateStaff(): void {
    $auth = requireAdmin();
    if ($auth['role'] !== 'super_admin') {
        errorResponse('Only super_admin can update staff.', 403);
    }

    $db = getDB();
    $staffId = getQueryParam('id');
    if (!$staffId) errorResponse('Staff ID is required.');

    $body = getRequestBody();
    $updates = [];
    $params = [':id' => (int)$staffId];

    if (isset($body['permissions'])) {
        $permissions = is_array($body['permissions']) ? json_encode($body['permissions']) : $body['permissions'];
        $updates[] = "permissions = :permissions";
        $params[':permissions'] = $permissions;
    }
    if (isset($body['is_active'])) {
        $updates[] = "is_active = :is_active";
        $params[':is_active'] = (bool)$body['is_active'] ? 1 : 0;
    }
    if (isset($body['name'])) {
        $updates[] = "name = :name";
        $params[':name'] = trim($body['name']);
    }
    if (isset($body['password'])) {
        $hashed = password_hash($body['password'], PASSWORD_BCRYPT);
        $updates[] = "password_hash = :password";
        $params[':password'] = $hashed;
    }

    if (empty($updates)) errorResponse('No updates provided.');

    $updateSQL = "UPDATE admin_staff SET " . implode(', ', $updates) . " WHERE id = :id";
    $stmt = $db->prepare($updateSQL);
    $stmt->execute($params);

    if ($stmt->rowCount() === 0) {
        errorResponse('Staff member not found or no changes.', 404);
    }

    successResponse(['id' => $staffId], 'Staff updated.');
}

function handleDeleteStaff(): void {
    $auth = requireAdmin();
    if ($auth['role'] !== 'super_admin') {
        errorResponse('Only super_admin can delete staff.', 403);
    }

    $db = getDB();
    $staffId = getQueryParam('id');
    if (!$staffId) errorResponse('Staff ID is required.');

    $stmt = $db->prepare("DELETE FROM admin_staff WHERE id = :id");
    $stmt->execute([':id' => (int)$staffId]);

    if ($stmt->rowCount() === 0) {
        errorResponse('Staff member not found.', 404);
    }

    successResponse(['id' => $staffId], 'Staff member removed.');
}