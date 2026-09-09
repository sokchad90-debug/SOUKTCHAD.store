<?php
/**
 * seller_shipping.php — Seller's accepted shipping companies.
 *
 * GET  (self)                  → list current seller's shipping companies
 * GET  ?seller_id=X           → public: list a seller's shipping companies (for buyers)
 * POST                        → add a shipping company (shipping_company_id)
 * DELETE ?shipping_company_id=X → remove a shipping company
 * PUT                         → replace all shipping companies (shipping_company_ids: array)
 */
require_once __DIR__ . '/config.php';

$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// ----------------------- GET -----------------------
if ($method === 'GET') {
    // List ALL available shipping companies (for seller to choose from)
    if (isset($_GET['action']) && $_GET['action'] === 'available') {
        $auth = requireAuth();
        $stmt = $db->prepare("SELECT id, name, logo_url, phone, tracking_url, description FROM shipping_companies WHERE is_active = 1 ORDER BY sort_order ASC, name ASC");
        $stmt->execute();
        json_response(true, $stmt->fetchAll(), 'OK', 200);
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
        json_response(true, $stmt->fetchAll(), 'OK', 200);
    }
    
    // Authenticated — get own shipping companies
    $auth = requireAuth();
    $uid = (int)$auth['user_id'];
    $stmt = $db->prepare(
        "SELECT sc.id, sc.name, sc.logo_url, sc.phone, sc.tracking_url
         FROM seller_shipping_companies ssc
         LEFT JOIN shipping_companies sc ON ssc.shipping_company_id = sc.id
         WHERE ssc.seller_id = :uid
         ORDER BY sc.sort_order ASC, sc.name ASC"
    );
    $stmt->execute([':uid' => $uid]);
    json_response(true, $stmt->fetchAll(), 'OK', 200);
}

// ----------------------- POST (add single) -----------------------
if ($method === 'POST') {
    $auth = requireAuth();
    $uid = (int)$auth['user_id'];
    $body = getRequestBody();
    $companyId = (int)($body['shipping_company_id'] ?? 0);
    if ($companyId <= 0) json_response(false, null, 'Missing shipping_company_id', 400);
    
    $stmt = $db->prepare("INSERT IGNORE INTO seller_shipping_companies (seller_id, shipping_company_id) VALUES (:uid, :cid)");
    $stmt->execute([':uid' => $uid, ':cid' => $companyId]);
    json_response(true, null, 'Shipping company added', 201);
}

// ----------------------- PUT (replace all) -----------------------
if ($method === 'PUT') {
    $auth = requireAuth();
    $uid = (int)$auth['user_id'];
    $body = getRequestBody();
    $ids = $body['shipping_company_ids'] ?? [];
    if (!is_array($ids)) json_response(false, null, 'shipping_company_ids must be an array', 400);
    
    $del = $db->prepare("DELETE FROM seller_shipping_companies WHERE seller_id = :uid");
    $del->execute([':uid' => $uid]);
    
    $ins = $db->prepare("INSERT IGNORE INTO seller_shipping_companies (seller_id, shipping_company_id) VALUES (:uid, :cid)");
    foreach ($ids as $cid) {
        $cidInt = (int)$cid;
        if ($cidInt > 0) {
            $ins->execute([':uid' => $uid, ':cid' => $cidInt]);
        }
    }
    json_response(true, null, 'Shipping companies updated', 200);
}

// ----------------------- DELETE -----------------------
if ($method === 'DELETE') {
    $auth = requireAuth();
    $uid = (int)$auth['user_id'];
    $companyId = isset($_GET['shipping_company_id']) ? (int)$_GET['shipping_company_id'] : 0;
    if ($companyId > 0) {
        $stmt = $db->prepare("DELETE FROM seller_shipping_companies WHERE seller_id = :uid AND shipping_company_id = :cid");
        $stmt->execute([':uid' => $uid, ':cid' => $companyId]);
        json_response(true, null, 'Shipping company removed', 200);
    }
    json_response(false, null, 'Missing shipping_company_id', 400);
}

json_response(false, null, 'Method not allowed', 405);