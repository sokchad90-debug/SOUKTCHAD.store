<?php
/**
 * Sokchad - Buyer Statistics API
 * ==============================
 * Returns order statistics for the authenticated buyer.
 *
 * ENDPOINT:
 *   GET /api_buyer_stats.php   → Buyer's order stats (completed, pending, cancelled, success rate, etc.)
 *
 * RESPONSE JSON:
 *   {
 *     "success": true,
 *     "data": {
 *       "completed_count":    int,
 *       "total_count":         int,
 *       "pending_count":       int,
 *       "cancelled_count":     int,
 *       "success_rate":        float,   // completed / (completed + cancelled + disputed) * 100, rounded
 *       "unique_sellers":      int,     // count of distinct sellers the buyer has ordered from
 *       "last_completed_date":  string|null,  // ISO timestamp of most recent completed order
 *       "is_trusted":          bool     // completed_count >= 50 AND success_rate >= 75
 *     }
 *   }
 *
 * DEPLOYMENT:
 *   Upload to: /opt/data/projects/sokchad-app/backend/api_buyer_stats.php
 *   URL:       https://souktchad.shop/api/api_buyer_stats.php
 */

require_once __DIR__ . '/config/database.php';

// Only GET is allowed
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    errorResponse('Method not allowed', 405);
}

// Authenticate via JWT Bearer token
$auth   = authenticateUser();
$userId = $auth['user_id'];

handleBuyerStats($userId);

// ============================================================
// BUYER STATISTICS
// ============================================================
function handleBuyerStats(int $userId): void {
    $db = getDB();

    // ----- Order counts grouped by status (buyer_id = user) -----
    $statusStmt = $db->prepare("
        SELECT status, COUNT(*) AS count
        FROM orders
        WHERE buyer_id = :uid
        GROUP BY status
    ");
    $statusStmt->execute([':uid' => $userId]);

    $statusCounts = [];
    while ($row = $statusStmt->fetch()) {
        $statusCounts[$row['status']] = (int)$row['count'];
    }

    $completedCount = $statusCounts['completed'] ?? 0;
    $pendingCount   = $statusCounts['pending']   ?? 0;
    $cancelledCount = $statusCounts['cancelled'] ?? 0;
    $disputedCount  = $statusCounts['disputed']  ?? 0;
    $confirmedCount = $statusCounts['confirmed'] ?? 0;
    $deliveredCount = $statusCounts['delivered'] ?? 0;
    $totalCount     = array_sum($statusCounts);

    // ----- Success rate -----
    // success_rate = completed / (completed + cancelled + disputed) * 100, rounded
    $rateDenominator = $completedCount + $cancelledCount + $disputedCount;
    $successRate = 0.0;
    if ($rateDenominator > 0) {
        $successRate = round(($completedCount / $rateDenominator) * 100, 2);
    }

    // ----- Unique sellers the buyer has ordered from -----
    $sellersStmt = $db->prepare("
        SELECT COUNT(DISTINCT seller_id) AS unique_sellers
        FROM orders
        WHERE buyer_id = :uid
    ");
    $sellersStmt->execute([':uid' => $userId]);
    $uniqueSellers = (int)$sellersStmt->fetchColumn();

    // ----- Last completed order date -----
    // The orders table has no `completed_at` column, so we use updated_at
    // (set when status last changed) and fall back to created_at.
    $lastCompletedStmt = $db->prepare("
        SELECT updated_at, created_at
        FROM orders
        WHERE buyer_id = :uid AND status = 'completed'
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
    ");
    $lastCompletedStmt->execute([':uid' => $userId]);
    $lastCompletedRow = $lastCompletedStmt->fetch();
    $lastCompletedDate = null;
    if ($lastCompletedRow) {
        $lastCompletedDate = $lastCompletedRow['updated_at'] ?: $lastCompletedRow['created_at'];
    }

    // ----- is_trusted flag -----
    $isTrusted = ($completedCount >= 50) && ($successRate >= 75);

    successResponse([
        'completed_count'    => $completedCount,
        'total_count'        => $totalCount,
        'pending_count'      => $pendingCount,
        'cancelled_count'    => $cancelledCount,
        'disputed_count'     => $disputedCount,
        'confirmed_count'    => $confirmedCount,
        'delivered_count'    => $deliveredCount,
        'success_rate'       => $successRate,
        'unique_sellers'     => $uniqueSellers,
        'last_completed_date' => $lastCompletedDate,
        'is_trusted'         => $isTrusted,
    ]);
}