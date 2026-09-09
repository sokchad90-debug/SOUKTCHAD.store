<?php
/**
 * Sokchad — Seller Follow Stats
 * GET /seller_stats.php?id=<sellerId>
 * Response: { success: true, data: { seller_id, followers, products, sales } }
 * Note: follows table is created on-demand if missing (idempotent).
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

    // Ensure follows table exists (idempotent)
    $db->exec("CREATE TABLE IF NOT EXISTS follows (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        seller_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_seller (user_id, seller_id),
        KEY idx_seller (seller_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $sellerId = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if ($sellerId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing or invalid seller id']);
        exit;
    }

    $followers = (int)$db->prepare("SELECT COUNT(*) FROM follows WHERE seller_id = :s")
        ->execute([':s' => $sellerId]) ?: 0;
    // re-run properly since PDO exec pattern above doesn't return count
    $st = $db->prepare("SELECT COUNT(*) AS c FROM follows WHERE seller_id = :s");
    $st->execute([':s' => $sellerId]);
    $followers = (int)($st->fetch(PDO::FETCH_ASSOC)['c'] ?? 0);

    $st = $db->prepare("SELECT COUNT(*) AS c FROM products WHERE seller_id = :s");
    $st->execute([':s' => $sellerId]);
    $products = (int)($st->fetch(PDO::FETCH_ASSOC)['c'] ?? 0);

    $sales = 0;
    try {
        $st = $db->prepare("SELECT COUNT(*) AS c FROM orders WHERE seller_id = :s AND status IN ('confirmed','shipped','delivered','completed')");
        $st->execute([':s' => $sellerId]);
        $sales = (int)($st->fetch(PDO::FETCH_ASSOC)['c'] ?? 0);
    } catch (Exception $e) { $sales = 0; }

    echo json_encode(['success' => true, 'data' => [
        'seller_id' => $sellerId,
        'followers' => $followers,
        'products'  => $products,
        'sales'     => $sales,
    ]]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error', 'details' => substr($e->getMessage(), 0, 200)]);
}
