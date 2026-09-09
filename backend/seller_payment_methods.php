<?php
/**
 * seller_payment_methods.php — Seller receiving numbers per payment method.
 *
 * GET                      → own numbers (JWT)
 * GET  ?seller_id=X        → public: a seller's numbers (for buyers at checkout)
 * POST                     → upsert one  { payment_method_id, receiving_number }
 * PUT                      → replace all { methods: [{method_id|payment_method_id, receiving_number}] }
 * DELETE ?payment_method_id=X → remove one
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

// ----------------------- GET -----------------------
if ($method === 'GET') {
    $sellerIdParam = isset($_GET['seller_id']) ? (int)$_GET['seller_id'] : 0;

    if ($sellerIdParam > 0) {
        // Public — buyer fetching a seller's receiving numbers
        $db = getDB();
        $stmt = $db->prepare(
            "SELECT spm.payment_method_id AS method_id, spm.payment_method_id AS methodId,
                    pm.name AS method_name, pm.name AS methodName,
                    pm.logo_url AS method_logo, pm.color AS method_color,
                    spm.receiving_number AS receiving_number, spm.receiving_number AS receivingNumber
             FROM seller_payment_methods spm
             LEFT JOIN payment_methods pm ON pm.id = spm.payment_method_id
             WHERE spm.seller_id = :sid
             ORDER BY spm.id ASC"
        );
        $stmt->execute([':sid' => $sellerIdParam]);
        successResponse($stmt->fetchAll(), 'OK');
    }

    // Own numbers (JWT)
    $auth = authenticateUser();
    $uid = (int)$auth['user_id'];
    $db = getDB();
    $stmt = $db->prepare(
        "SELECT spm.payment_method_id AS method_id, spm.payment_method_id AS methodId,
                pm.name AS method_name, pm.name AS methodName,
                pm.logo_url AS method_logo, pm.color AS method_color,
                spm.receiving_number AS receiving_number, spm.receiving_number AS receivingNumber
         FROM seller_payment_methods spm
         LEFT JOIN payment_methods pm ON pm.id = spm.payment_method_id
         WHERE spm.seller_id = :uid
         ORDER BY spm.id ASC"
    );
    $stmt->execute([':uid' => $uid]);
    successResponse($stmt->fetchAll(), 'OK');
}

// ----------------------- POST (upsert one) -----------------------
if ($method === 'POST') {
    $auth = authenticateUser();
    $uid = (int)$auth['user_id'];
    $body = getRequestBody();
    $pmId = trim($body['payment_method_id'] ?? $body['method_id'] ?? '');
    $num  = trim($body['receiving_number'] ?? '');
    if ($pmId === '') errorResponse("Field 'payment_method_id' is required.");
    if ($num === '') errorResponse("Field 'receiving_number' is required.");
    if (mb_strlen($num) > 30) errorResponse('Receiving number too long (max 30 chars).');

    $db = getDB();
    // Validate payment method exists
    $pmStmt = $db->prepare("SELECT id FROM payment_methods WHERE id = :id LIMIT 1");
    $pmStmt->execute([':id' => $pmId]);
    if (!$pmStmt->fetch()) errorResponse('Unknown payment method: ' . $pmId, 404);

    $stmt = $db->prepare(
        "INSERT INTO seller_payment_methods (seller_id, payment_method_id, receiving_number)
         VALUES (:uid, :pmid, :num)
         ON DUPLICATE KEY UPDATE receiving_number = VALUES(receiving_number)"
    );
    $stmt->execute([':uid' => $uid, ':pmid' => $pmId, ':num' => $num]);
    successResponse(['payment_method_id' => $pmId, 'receiving_number' => $num], 'Saved.');
}

// ----------------------- PUT (replace all) -----------------------
if ($method === 'PUT') {
    $auth = authenticateUser();
    $uid = (int)$auth['user_id'];
    $body = getRequestBody();
    $methods = $body['methods'] ?? null;
    if (!is_array($methods)) errorResponse("Field 'methods' must be an array of {method_id, receiving_number}.");

    $db = getDB();
    $db->beginTransaction();
    try {
        $del = $db->prepare("DELETE FROM seller_payment_methods WHERE seller_id = :uid");
        $del->execute([':uid' => $uid]);

        $ins = $db->prepare(
            "INSERT IGNORE INTO seller_payment_methods (seller_id, payment_method_id, receiving_number)
             VALUES (:uid, :pmid, :num)"
        );
        foreach ($methods as $m) {
            if (!is_array($m)) continue;
            $pmId = trim($m['method_id'] ?? $m['payment_method_id'] ?? $m['methodId'] ?? '');
            $num  = trim($m['receiving_number'] ?? $m['receivingNumber'] ?? '');
            if ($pmId === '' || $num === '') continue;
            $ins->execute([':uid' => $uid, ':pmid' => $pmId, ':num' => $num]);
        }
        $db->commit();
    } catch (PDOException $e) {
        $db->rollBack();
        errorResponse('Failed to save payment methods: ' . $e->getMessage(), 500);
    }
    successResponse(null, 'Payment methods updated.');
}

// ----------------------- DELETE (remove one) -----------------------
if ($method === 'DELETE') {
    $auth = authenticateUser();
    $uid = (int)$auth['user_id'];
    $pmId = trim($_GET['payment_method_id'] ?? '');
    if ($pmId === '') errorResponse("Missing 'payment_method_id'.");
    $db = getDB();
    $stmt = $db->prepare("DELETE FROM seller_payment_methods WHERE seller_id = :uid AND payment_method_id = :pmid");
    $stmt->execute([':uid' => $uid, ':pmid' => $pmId]);
    successResponse(null, 'Removed.');
}

errorResponse('Method not allowed. Use GET, POST, PUT or DELETE.', 405);
