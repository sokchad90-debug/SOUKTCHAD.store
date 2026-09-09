<?php
/**
 * seller_delivery_methods.php — Delivery methods a seller accepts.
 *
 * GET                → own methods (JWT) / ?seller_id=X public
 * PUT                → replace all { delivery_method_ids: ["home", "pickup", ...] }
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/config/database.php';

function ensureDeliveryMethodsTable($db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS seller_delivery_methods (
        id INT AUTO_INCREMENT PRIMARY KEY,
        seller_id INT NOT NULL,
        method_id VARCHAR(50) NOT NULL,
        UNIQUE KEY uq_seller_method (seller_id, method_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $db = getDB();
    ensureDeliveryMethodsTable($db);
    $sellerIdParam = isset($_GET['seller_id']) ? (int)$_GET['seller_id'] : 0;

    if ($sellerIdParam > 0) {
        $stmt = $db->prepare("SELECT method_id FROM seller_delivery_methods WHERE seller_id = :sid ORDER BY id ASC");
        $stmt->execute([':sid' => $sellerIdParam]);
        successResponse(array_map(fn($r) => ['method_id' => $r['method_id']], $stmt->fetchAll()), 'OK');
    }

    $auth = authenticateUser();
    $stmt = $db->prepare("SELECT method_id FROM seller_delivery_methods WHERE seller_id = :uid ORDER BY id ASC");
    $stmt->execute([':uid' => (int)$auth['user_id']]);
    successResponse(array_map(fn($r) => ['method_id' => $r['method_id']], $stmt->fetchAll()), 'OK');
}

if ($method === 'PUT') {
    $auth = authenticateUser();
    $uid = (int)$auth['user_id'];
    $body = getRequestBody();
    $ids = $body['delivery_method_ids'] ?? null;
    if (!is_array($ids)) errorResponse("Field 'delivery_method_ids' must be an array.");

    $db = getDB();
    ensureDeliveryMethodsTable($db);
    $db->beginTransaction();
    try {
        $del = $db->prepare("DELETE FROM seller_delivery_methods WHERE seller_id = :uid");
        $del->execute([':uid' => $uid]);
        $ins = $db->prepare("INSERT IGNORE INTO seller_delivery_methods (seller_id, method_id) VALUES (:uid, :mid)");
        foreach ($ids as $mid) {
            $mid = trim((string)$mid);
            if ($mid === '' || strlen($mid) > 50) continue;
            $ins->execute([':uid' => $uid, ':mid' => $mid]);
        }
        $db->commit();
    } catch (PDOException $e) {
        $db->rollBack();
        errorResponse('Failed to save delivery methods: ' . $e->getMessage(), 500);
    }
    successResponse(null, 'Delivery methods updated.');
}

errorResponse('Method not allowed. Use GET or PUT.', 405);
