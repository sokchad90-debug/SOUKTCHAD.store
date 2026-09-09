<?php
/**
 * Sokchad — Admin Stats API
 * =========================
 * Returns dashboard statistics for admin panel.
 * Requires: admin / super_admin / staff role
 *
 * ENDPOINT: GET /admin/api_stats.php
 */

require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    errorResponse('Method not allowed', 405);
}

$auth = requireAdmin();
$db = getDB();

// Total sellers
$sellerCount = (int)$db->query("SELECT COUNT(*) FROM users WHERE role = 'seller'")->fetchColumn();

// Total buyers
$buyerCount = (int)$db->query("SELECT COUNT(*) FROM users WHERE role = 'buyer'")->fetchColumn();

// Total products
$productCount = (int)$db->query("SELECT COUNT(*) FROM products WHERE status = 'active'")->fetchColumn();

// Total orders
$orderCount = (int)$db->query("SELECT COUNT(*) FROM orders")->fetchColumn();

// Open disputes
$disputeCount = (int)$db->query("SELECT COUNT(*) FROM orders WHERE status = 'disputed'")->fetchColumn();

// Total revenue
$totalRevenue = (int)$db->query("
    SELECT COALESCE(SUM(amount), 0) FROM orders WHERE status IN ('confirmed', 'completed')
")->fetchColumn();

// Staff count
$staffCount = (int)$db->query("SELECT COUNT(*) FROM admin_staff")->fetchColumn();

// Banned users
$bannedCount = (int)$db->query("SELECT COUNT(*) FROM users WHERE is_banned = 1")->fetchColumn();

// Recent orders
$recentOrders = $db->query("
    SELECT o.id, o.amount, o.status, o.created_at,
           p.title_en AS product_title,
           buyer.username AS buyer_name,
           seller.username AS seller_name
    FROM orders o
    LEFT JOIN products p ON o.product_id = p.id
    LEFT JOIN users buyer ON o.buyer_id = buyer.id
    LEFT JOIN users seller ON o.seller_id = seller.id
    ORDER BY o.created_at DESC
    LIMIT 10
")->fetchAll();

// Order status distribution
$statusDist = [];
$distStmt = $db->query("SELECT status, COUNT(*) AS count FROM orders GROUP BY status");
while ($row = $distStmt->fetch()) {
    $statusDist[$row['status']] = (int)$row['count'];
}

successResponse([
    'sellers'           => $sellerCount,
    'buyers'            => $buyerCount,
    'products'          => $productCount,
    'orders'            => $orderCount,
    'disputes'          => $disputeCount,
    'total_revenue'     => $totalRevenue,
    'staff'             => $staffCount,
    'banned_users'      => $bannedCount,
    'recent_orders'     => $recentOrders,
    'order_status_dist' => $statusDist,
]);