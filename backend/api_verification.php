<?php
/**
 * Sokchad — Verification API
 * ==========================
 * Handles user verification requests (replaces direct Supabase access).
 *
 * ENDPOINTS:
 *   POST   /api_verification.php              → Submit verification request
 *   GET    /api_verification.php              → Get user's verification status
 *   GET    /api_verification.php?scope=all    → List all requests (admin only)
 *   PUT    /api_verification.php?id=xxx       → Approve/reject (admin only)
 *
 * SECURITY:
 *   - JWT authentication required
 *   - Image uploads go through PHP, NOT Supabase Storage
 */

require_once __DIR__ . '/config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGetVerification();
        break;
    case 'POST':
        handleSubmitVerification();
        break;
    case 'PUT':
        handleReviewVerification();
        break;
    default:
        errorResponse('Method not allowed', 405);
}

function handleGetVerification(): void {
    $auth = authenticateUser();
    $db = getDB();
    $scope = getQueryParam('scope');

    // Admin: list all requests
    if ($scope === 'all') {
        $role = $auth['role'] ?? 'buyer';
        if (!in_array($role, ['admin', 'super_admin', 'staff'])) {
            errorResponse('Admin access required.', 403);
        }
        $stmt = $db->query("
            SELECT v.*, u.username, u.email, u.phone
            FROM verification_requests v
            LEFT JOIN users u ON v.user_id = u.id
            ORDER BY v.created_at DESC
        ");
        successResponse($stmt->fetchAll());
    }

    // User: get own status
    $stmt = $db->prepare("
        SELECT * FROM verification_requests WHERE user_id = :uid ORDER BY created_at DESC LIMIT 1
    ");
    $stmt->execute([':uid' => $auth['user_id']]);
    $request = $stmt->fetch();

    // Also get user's verified status
    $userStmt = $db->prepare("SELECT is_verified, verified_until FROM users WHERE id = :id");
    $userStmt->execute([':id' => $auth['user_id']]);
    $user = $userStmt->fetch();

    successResponse([
        'is_verified' => (bool)($user['is_verified'] ?? false),
        'verified_until' => $user['verified_until'] ?? null,
        'latest_request' => $request ?: null,
    ]);
}

function handleSubmitVerification(): void {
    $auth = authenticateUser();
    $userId = $auth['user_id'];
    $db = getDB();

    $body = getRequestBody();

    // Required: image URLs (uploaded via /upload endpoint first)
    $required = ['id_front_url', 'id_back_url', 'selfie_url', 'receipt_url'];
    foreach ($required as $field) {
        if (empty($body[$field])) {
            errorResponse("Field '$field' is required. Upload the image first via /upload.");
        }
    }

    // Check if user already has a pending request
    $checkStmt = $db->prepare("SELECT id FROM verification_requests WHERE user_id = :uid AND status = 'pending'");
    $checkStmt->execute([':uid' => $userId]);
    if ($checkStmt->fetch()) {
        errorResponse('You already have a pending verification request.', 409);
    }

    $stmt = $db->prepare("
        INSERT INTO verification_requests (user_id, id_front_url, id_back_url, selfie_url, receipt_url, status, created_at)
        VALUES (:uid, :front, :back, :selfie, :receipt, 'pending', NOW())
    ");
    $stmt->execute([
        ':uid' => $userId,
        ':front' => $body['id_front_url'],
        ':back' => $body['id_back_url'],
        ':selfie' => $body['selfie_url'],
        ':receipt' => $body['receipt_url'],
    ]);

    successResponse(['id' => $db->lastInsertId()], 'Verification request submitted.');
}

function handleReviewVerification(): void {
    $auth = authenticateUser();
    $role = $auth['role'] ?? 'buyer';
    if (!in_array($role, ['admin', 'super_admin', 'staff'])) {
        errorResponse('Admin access required.', 403);
    }

    $db = getDB();
    $requestId = getQueryParam('id');
    if (!$requestId) errorResponse('Request ID is required.');

    $body = getRequestBody();
    $decision = $body['status'] ?? '';
    $notes = $body['admin_notes'] ?? '';

    if (!in_array($decision, ['approved', 'rejected'])) {
        errorResponse("Status must be 'approved' or 'rejected'.");
    }

    // Update request
    $stmt = $db->prepare("
        UPDATE verification_requests
        SET status = :status, admin_notes = :notes, reviewed_by = :admin_id, updated_at = NOW()
        WHERE id = :id
    ");
    $stmt->execute([
        ':status' => $decision,
        ':notes' => $notes,
        ':admin_id' => $auth['user_id'],
        ':id' => (int)$requestId,
    ]);

    if ($stmt->rowCount() === 0) {
        errorResponse('Verification request not found.', 404);
    }

    // If approved, update user's verified status
    if ($decision === 'approved') {
        $reqStmt = $db->prepare("SELECT user_id FROM verification_requests WHERE id = :id");
        $reqStmt->execute([':id' => (int)$requestId]);
        $req = $reqStmt->fetch();
        if ($req) {
            $verifyStmt = $db->prepare("
                UPDATE users SET is_verified = 1, verified_until = DATE_ADD(NOW(), INTERVAL 365 DAY), updated_at = NOW()
                WHERE id = :uid
            ");
            $verifyStmt->execute([':uid' => $req['user_id']]);
        }
    }

    successResponse(['id' => $requestId, 'status' => $decision], "Verification $decision.");
}