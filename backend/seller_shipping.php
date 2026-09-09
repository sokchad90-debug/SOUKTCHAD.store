<?php
/**
 * seller_shipping.php — Seller's accepted shipping companies.
 *
 * GET  (self)                  → list current seller's shipping companies (JWT)
 * GET  ?seller_id=X           → public: a seller's shipping companies (for buyers)
 * GET  ?action=available      → list all active shipping companies (JWT)
 * POST                        → add one  { shipping_company_id }
 * PUT                         → replace all { shipping_company_ids: [...] }
 * DELETE ?shipping_company_id=X → remove one
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/config/database.php';

function ensureShippingTables($db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS shipping_companies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        logo_url VARCHAR(500) DEFAULT '',
        phone VARCHAR(30) DEFAULT '',
        tracking_url VARCHAR(500) DEFAULT '',
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $db->exec("CREATE TABLE IF NOT EXISTS seller_shipping_companies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        seller_id INT NOT NULL,
        shipping_company_id INT NOT NULL,
        UNIQUE KEY uq_seller_company (seller_id, shipping_company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

$db = getDB();
ensureShippingTables($db);
$method = $_SERVER['REQUEST_METHOD'];

// ----------------------- GET -----------------------
if ($method === 'GET') {
    // List ALL available shipping companies (for seller to choose from)
    if (isset($_GET['action']) && $_GET['action'] === 'available') {
        $auth = authenticateUser();
        $stmt = $db->prepare("SELECT id, name, logo_url, phone, tracking_url, description FROM shipping_companies WHERE is_active = 1 ORDER BY sort_order ASC, name ASC");
        $stmt->execute();
        successResponse($stmt->fetchAll(), 'OK');
    }

    $sellerIdParam = isset($_GET['seller_id']) ? (int)$_GET['seller_id'] : 0;

    if ($sellerIdParam > 0) {
        // Public request — get a specific seller's shipping companies
        $stmt = $db->prepare(
            "SELECT sc.id, sc.name, sc.logo_url, sc.phone, sc.tracking_url
             FROM seller_shipping_companies ssc
             LEFT JOIN shipping_companies sc ON ssc.shipping_company_id = sc.id
             WHERE ssc.seller_id = :uid AND sc.is_active = 1
             ORDER BY sc.sort_order ASC, sc.name ASC"
        );
        $stmt->execute([':uid' => $sellerIdParam]);
        successResponse($stmt->fetchAll(), 'OK');
    }

    // Authenticated — get own shipping companies
    $auth = authenticateUser();
    $uid = (int)$auth['user_id'];
    $stmt = $db->prepare(
        "SELECT sc.id, sc.name, sc.logo_url, sc.phone, sc.tracking_url
         FROM seller_shipping_companies ssc
         LEFT JOIN shipping_companies sc ON ssc.shipping_company_id = sc.id
         WHERE ssc.seller_id = :uid
         ORDER BY sc.sort_order ASC, sc.name ASC"
    );
    $stmt->execute([':uid' => $uid]);
    successResponse($stmt->fetchAll(), 'OK');
}

// ----------------------- POST (add single) -----------------------
if ($method === 'POST') {
    $auth = authenticateUser();
    $uid = (int)$auth['user_id'];
    $body = getRequestBody();
    $companyId = (int)($body['shipping_company_id'] ?? 0);
    if ($companyId <= 0) errorResponse('Missing shipping_company_id');

    $stmt = $db->prepare("INSERT IGNORE INTO seller_shipping_companies (seller_id, shipping_company_id) VALUES (:uid, :cid)");
    $stmt->execute([':uid' => $uid, ':cid' => $companyId]);
    successResponse(null, 'Shipping company added.');
}

// ----------------------- PUT (replace all) -----------------------
if ($method === 'PUT') {
    $auth = authenticateUser();
    $uid = (int)$auth['user_id'];
    $body = getRequestBody();
    $ids = $body['shipping_company_ids'] ?? [];
    if (!is_array($ids)) errorResponse('shipping_company_ids must be an array');

    $del = $db->prepare("DELETE FROM seller_shipping_companies WHERE seller_id = :uid");
    $del->execute([':uid' => $uid]);

    $ins = $db->prepare("INSERT IGNORE INTO seller_shipping_companies (seller_id, shipping_company_id) VALUES (:uid, :cid)");
    foreach ($ids as $cid) {
        $cidInt = (int)$cid;
        if ($cidInt > 0) {
            $ins->execute([':uid' => $uid, ':cid' => $cidInt]);
        }
    }
    successResponse(null, 'Shipping companies updated.');
}

// ----------------------- DELETE -----------------------
if ($method === 'DELETE') {
    $auth = authenticateUser();
    $uid = (int)$auth['user_id'];
    $companyId = isset($_GET['shipping_company_id']) ? (int)$_GET['shipping_company_id'] : 0;
    if ($companyId > 0) {
        $stmt = $db->prepare("DELETE FROM seller_shipping_companies WHERE seller_id = :uid AND shipping_company_id = :cid");
        $stmt->execute([':uid' => $uid, ':cid' => $companyId]);
        successResponse(null, 'Shipping company removed.');
    }
    errorResponse('Missing shipping_company_id');
}

errorResponse('Method not allowed', 405);
