<?php
/**
 * Sokchad — Followed Sellers' Products feed
 * GET /followed_products.php → products from sellers the current user follows
 * Auth: Bearer JWT required.
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed. Use GET.']);
    exit;
}

require_once __DIR__ . '/config/database.php';

try {
    $db = getDB();

    $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (!preg_match('/Bearer\s+(\S+)/i', $hdr, $m)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Authentication required. Please log in.']);
        exit;
    }
    $payload = decodeJWT($m[1]);
    $uid = (int)($payload['sub'] ?? $payload['user_id'] ?? 0);
    if ($uid <= 0) { http_response_code(401); echo json_encode(['success' => false, 'error' => 'Invalid or expired token']); exit; }

    $rows = $db->prepare("SELECT p.* FROM products p
                          INNER JOIN follows f ON f.seller_id = p.seller_id AND f.user_id = :u
                          ORDER BY p.created_at DESC LIMIT 100");
    $rows->execute([':u' => $uid]);
    $data = $rows->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'data' => $data]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error', 'details' => substr($e->getMessage(), 0, 200)]);
}
