<?php
/**
 * Sokchad — Auth API (Email + Password)
 * ======================================
 * Replaces Supabase Auth with a self-hosted JWT solution.
 *
 * ENDPOINTS:
 *   POST /auth_email.php  { action: "signup", email, password, name, username, phone, role }
 *   POST /auth_email.php  { action: "login",  email, password }
 *
 * RESPONSE (success):
 *   { success: true, data: { token: "jwt...", user: { id, email, username, name, phone, role, ... } } }
 *
 * RESPONSE (error):
 *   { success: false, error: "message" }
 *
 * DEPLOY: public_html/api/auth_email.php
 */

require_once __DIR__ . '/config/database.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    errorResponse('Method not allowed. Use POST.', 405);
}

$body = getRequestBody();
$action = trim($body['action'] ?? '');

if ($action === 'signup') {
    handleSignup($body);
} elseif ($action === 'login') {
    handleLogin($body);
} else {
    errorResponse('Invalid action. Use "signup" or "login".');
}

// ============================================================
// SIGNUP
// ============================================================
function handleSignup(array $body): void {
    $db = getDB();

    $email    = strtolower(trim($body['email'] ?? ''));
    $password = $body['password'] ?? '';
    $name     = trim($body['name'] ?? $body['fullName'] ?? $body['full_name'] ?? '');
    $username = trim($body['username'] ?? $name);
    $phone    = trim($body['phone'] ?? '');
    $role     = trim($body['role'] ?? 'buyer');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        errorResponse('Invalid email address.');
    }
    if (strlen($password) < 6) {
        errorResponse('Password must be at least 6 characters.');
    }
    if (strlen($name) < 2) {
        errorResponse('Name is required (min 2 characters).');
    }
    if (strlen($username) < 2) {
        errorResponse('Username is required.');
    }
    // Normalize role
    if (!in_array($role, ['buyer', 'seller'])) {
        $role = 'buyer';
    }

    // Check duplicates
    $chk = $db->prepare("SELECT id FROM users WHERE email = :email OR username = :username LIMIT 1");
    $chk->execute([':email' => $email, ':username' => $username]);
    if ($chk->fetch()) {
        // Determine which field collides
        $chkEmail = $db->prepare("SELECT id FROM users WHERE email = :email LIMIT 1");
        $chkEmail->execute([':email' => $email]);
        if ($chkEmail->fetch()) {
            errorResponse('This email is already registered.', 409);
        }
        errorResponse('This username is already taken.', 409);
    }

    // Hash password
    $hash = password_hash($password, PASSWORD_BCRYPT);

    // Generate seller_id for sellers
    $sellerId = null;
    if ($role === 'seller') {
        $sellerId = 'Sok-' . str_pad((string)random_int(10000, 99999), 5, '0', STR_PAD_LEFT);
    }

    try {
        $stmt = $db->prepare("
            INSERT INTO users (full_name, username, email, phone, password_hash, role, seller_id, created_at)
            VALUES (:full_name, :username, :email, :phone, :hash, :role, :seller_id, NOW())
        ");
        $stmt->execute([
            ':full_name' => $name,
            ':username'  => $username,
            ':email'     => $email,
            ':phone'     => $phone,
            ':hash'      => $hash,
            ':role'      => $role,
            ':seller_id' => $sellerId,
        ]);
        $userId = (int)$db->lastInsertId();
    } catch (PDOException $e) {
        if (str_contains($e->getMessage(), 'Duplicate')) {
            errorResponse('Email or username already taken.', 409);
        }
        errorResponse('Registration failed: ' . $e->getMessage(), 500);
    }

    // Fetch created user
    $user = fetchUserById($userId);
    $token = encodeJWT(['user_id' => $userId, 'email' => $email, 'role' => $role]);

    successResponse(['token' => $token, 'user' => $user], 'Account created.');
}

// ============================================================
// LOGIN
// ============================================================
function handleLogin(array $body): void {
    $db = getDB();

    $email    = strtolower(trim($body['email'] ?? ''));
    $password = $body['password'] ?? '';

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        errorResponse('Invalid email address.');
    }
    if ($password === '') {
        errorResponse('Password is required.');
    }

    // Rate limit by email
    $key = 'login:' . $email;
    if (!checkRateLimit($key, 10, 60)) {
        errorResponse('Too many login attempts. Please wait a minute.', 429);
    }

    $stmt = $db->prepare("SELECT * FROM users WHERE email = :email LIMIT 1");
    $stmt->execute([':email' => $email]);
    $row = $stmt->fetch();

    if (!$row) {
        errorResponse('Invalid email or password.', 401);
    }

    if ((int)($row['is_banned'] ?? 0) === 1) {
        // Check if temporary ban expired
        if (!empty($row['banned_until'])) {
            $until = strtotime($row['banned_until']);
            if ($until && $until > time()) {
                errorResponse('This account is banned until ' . $row['banned_until'], 403);
            } else {
                // Ban expired — unban automatically
                $db->prepare("UPDATE users SET is_banned = 0, banned_until = NULL WHERE id = :id")->execute([':id' => $row['id']]);
                $row['is_banned'] = 0;
            }
        } else {
            errorResponse('This account has been banned.', 403);
        }
    }

    $hash = $row['password_hash'] ?? '';
    if ($hash === '' || !password_verify($password, $hash)) {
        errorResponse('Invalid email or password.', 401);
    }

    $user = mapUserRow($row);
    $token = encodeJWT(['user_id' => (int)$row['id'], 'email' => $row['email'], 'role' => $row['role']]);

    successResponse(['token' => $token, 'user' => $user], 'Login successful.');
}

// ============================================================
// HELPERS
// ============================================================
function fetchUserById(int $id): array {
    $db = getDB();
    $stmt = $db->prepare("SELECT * FROM users WHERE id = :id LIMIT 1");
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();
    if (!$row) errorResponse('User not found after creation.', 500);
    return mapUserRow($row);
}

function mapUserRow(array $row): array {
    return [
        'id'          => (int)$row['id'],
        'full_name'   => $row['full_name'] ?? '',
        'username'    => $row['username'] ?? '',
        'name'        => $row['full_name'] ?? $row['username'] ?? '',
        'email'       => $row['email'] ?? '',
        'phone'       => $row['phone'] ?? '',
        'role'        => $row['role'] ?? 'buyer',
        'isSeller'    => ($row['role'] ?? '') === 'seller',
        'is_seller'   => ($row['role'] ?? '') === 'seller',
        'avatar_url'  => $row['avatar_url'] ?? '',
        'avatar'      => $row['avatar_url'] ?? '',
        'cover_url'   => $row['cover_url'] ?? '',
        'coverImage'  => $row['cover_url'] ?? '',
        'is_verified' => (bool)($row['is_verified'] ?? 0),
        'isVerified'  => (bool)($row['is_verified'] ?? 0),
        'is_banned'   => (bool)($row['is_banned'] ?? 0),
        'seller_id'   => $row['seller_id'] ?? '',
        'sellerId'    => $row['seller_id'] ?? '',
        'numericId'   => $row['seller_id'] ?? '',
        'rating'      => (float)($row['rating'] ?? 0),
        'total_sales' => (int)($row['total_sales'] ?? 0),
        'location'    => $row['location'] ?? '',
        'bio'         => $row['bio'] ?? '',
        'created_at'  => $row['created_at'] ?? '',
    ];
}
