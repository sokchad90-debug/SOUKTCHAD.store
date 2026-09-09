<?php
/**
 * Sokchad - Statistics API
 * ========================
 * Returns dashboard statistics for sellers and admins.
 * 
 * ENDPOINTS:
 *   GET /api_stats.php                → Seller's own stats (revenue, orders, category breakdown)
 *   GET /api_stats.php?scope=admin    → Admin dashboard stats (requires admin role)
 * 
 * DEPLOYMENT:
 *   Upload to: public_html/api/api_stats.php
 *   URL:       https://yourdomain.com/api/api_stats.php
 */

require_once __DIR__ . '/config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    errorResponse('Method not allowed', 405);
}

$auth  = authenticateUser();
$userId = $auth['user_id'];
$role   = $auth['role'] ?? 'buyer';
$scope  = getQueryParam('scope', 'seller');

if ($scope === 'admin') {
    handleAdminStats($userId, $role);
} else {
    handleSellerStats($userId);
}

// ============================================================
// SELLER STATISTICS
// ============================================================
function handleSellerStats(int $userId): void {
    $db = getDB();

    // Total revenue (confirmed + completed orders)
    $revStmt = $db->prepare("
        SELECT COALESCE(SUM(amount), 0) AS total_revenue
        FROM orders
        WHERE seller_id = :uid AND status IN ('confirmed', 'completed')
    ");
    $revStmt->execute([':uid' => $userId]);
    $totalRevenue = (int)$revStmt->fetchColumn();

    // Order counts by status
    $statusStmt = $db->prepare("
        SELECT status, COUNT(*) AS count
        FROM orders
        WHERE seller_id = :uid
        GROUP BY status
    ");
    $statusStmt->execute([':uid' => $userId]);
    $statusCounts = [];
    while ($row = $statusStmt->fetch()) {
        $statusCounts[$row['status']] = (int)$row['count'];
    }

    // Total orders
    $totalOrders = array_sum($statusCounts);

    // Products count
    $prodStmt = $db->prepare("SELECT COUNT(*) FROM products WHERE seller_id = :uid AND status = 'active'");
    $prodStmt->execute([':uid' => $userId]);
    $totalProducts = (int)$prodStmt->fetchColumn();

    // Category breakdown
    $catStmt = $db->prepare("
        SELECT c.id, c.name_en, c.name_fr, c.name_ar, c.color, COUNT(p.id) AS product_count
        FROM products p
        JOIN categories c ON p.category_id = c.id
        WHERE p.seller_id = :uid AND p.status = 'active'
        GROUP BY c.id
        ORDER BY product_count DESC
    ");
    $catStmt->execute([':uid' => $userId]);
    $categoryBreakdown = $catStmt->fetchAll();

    // Average rating
    $ratingStmt = $db->prepare("
        SELECT COALESCE(AVG(rating), 0) AS avg_rating, COUNT(*) AS review_count
        FROM reviews
        WHERE seller_id = :uid
    ");
    $ratingStmt->execute([':uid' => $userId]);
    $ratingData = $ratingStmt->fetch();

    successResponse([
        'total_revenue'      => $totalRevenue,
        'total_orders'       => $totalOrders,
        'total_products'     => $totalProducts,
        'order_status'       => $statusCounts,
        'category_breakdown' => $categoryBreakdown,
        'avg_rating'         => round((float)$ratingData['avg_rating'], 2),
        'review_count'       => (int)$ratingData['review_count'],
    ]);
}

// ============================================================
// ADMIN STATISTICS
// ============================================================
function handleAdminStats(int $userId, string $role): void {
    if (!in_array($role, ['admin', 'super_admin', 'staff'])) {
        errorResponse('Admin access required.', 403);
    }

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

    // Total revenue (platform-wide, confirmed+completed)
    $totalRevenue = (int)$db->query("
        SELECT COALESCE(SUM(amount), 0) FROM orders WHERE status IN ('confirmed', 'completed')
    ")->fetchColumn();

    // Staff count
    $staffCount = (int)$db->query("SELECT COUNT(*) FROM admin_staff")->fetchColumn();

    // Banned users
    $bannedCount = (int)$db->query("SELECT COUNT(*) FROM users WHERE is_banned = 1")->fetchColumn();

    // Recent orders (last 10)
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
        'sellers'          => $sellerCount,
        'buyers'           => $buyerCount,
        'products'         => $productCount,
        'orders'           => $orderCount,
        'disputes'         => $disputeCount,
        'total_revenue'    => $totalRevenue,
        'staff'            => $staffCount,
        'banned_users'     => $bannedCount,
        'recent_orders'    => $recentOrders,
        'order_status_dist' => $statusDist,
    ]);
}
