<?php
/**
 * seller_delivery_cities.php — Cities a seller delivers to.
 *
 * GET                → own cities (JWT)
 * GET ?seller_id=X   → public: a seller's cities (buyers)
 * PUT                → replace all { cities: ["N'Djamena", ...] }
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/config/database.php';

function ensureDeliveryCitiesTable($db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS seller_delivery_cities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        seller_id INT NOT NULL,
        city_name VARCHAR(100) NOT NULL,
        UNIQUE KEY uq_seller_city (seller_id, city_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $db = getDB();
    ensureDeliveryCitiesTable($db);
    $sellerIdParam = isset($_GET['seller_id']) ? (int)$_GET['seller_id'] : 0;

    if ($sellerIdParam > 0) {
        $stmt = $db->prepare("SELECT city_name FROM seller_delivery_cities WHERE seller_id = :sid ORDER BY id ASC");
        $stmt->execute([':sid' => $sellerIdParam]);
        successResponse(array_map(fn($r) => ['city_name' => $r['city_name']], $stmt->fetchAll()), 'OK');
    }

    $auth = authenticateUser();
    $stmt = $db->prepare("SELECT city_name FROM seller_delivery_cities WHERE seller_id = :uid ORDER BY id ASC");
    $stmt->execute([':uid' => (int)$auth['user_id']]);
    successResponse(array_map(fn($r) => ['city_name' => $r['city_name']], $stmt->fetchAll()), 'OK');
}

if ($method === 'PUT') {
    $auth = authenticateUser();
    $uid = (int)$auth['user_id'];
    $body = getRequestBody();
    $cities = $body['cities'] ?? null;
    if (!is_array($cities)) errorResponse("Field 'cities' must be an array.");

    $db = getDB();
    ensureDeliveryCitiesTable($db);
    $db->beginTransaction();
    try {
        $del = $db->prepare("DELETE FROM seller_delivery_cities WHERE seller_id = :uid");
        $del->execute([':uid' => $uid]);
        $ins = $db->prepare("INSERT IGNORE INTO seller_delivery_cities (seller_id, city_name) VALUES (:uid, :city)");
        foreach ($cities as $c) {
            $city = trim((string)$c);
            if ($city === '' || mb_strlen($city) > 100) continue;
            $ins->execute([':uid' => $uid, ':city' => $city]);
        }
        $db->commit();
    } catch (PDOException $e) {
        $db->rollBack();
        errorResponse('Failed to save delivery cities: ' . $e->getMessage(), 500);
    }
    successResponse(null, 'Delivery cities updated.');
}

errorResponse('Method not allowed. Use GET or PUT.', 405);
