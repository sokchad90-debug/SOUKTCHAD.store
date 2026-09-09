<?php
/**
 * Sokchad — Admin Orders & Disputes API
 * ======================================
 * Manage orders, resolve disputes, cancel orders.
 *
 * ENDPOINTS:
 *   GET  /admin/api_orders.php              → List all orders (filterable)
 *   GET  /admin/api_orders.php?id=xxx       → Get single order
 *   GET  /admin/api_orders.php?scope=disputes → List disputed orders
 *   PUT  /admin/api_orders.php?id=xxx       → Update order (confirm, cancel, resolve dispute)
 *
 * PERMISSIONS:
 *   - manage_disputes: resolve disputes
 *   - super_admin: cancel any order
 */

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGetOrders();
        break;
    case 'PUT':
        handleUpdateOrder();
        break;
    default:
        errorResponse('Method not allowed', 405);
}

function handleGetOrders(): void {
    $auth = requireAdmin();
    $db = getDB();

    $scope = getQueryParam('scope');
    $orderId = getQueryParam('id');

    // Get single order
    if ($orderId) {
        $stmt = $db->prepare("
            SELECT o.*, p.title_en AS product_title,
                   buyer.username AS buyer_name, buyer.phone AS buyer_contact,
                   seller.username AS seller_name, seller.seller_id AS seller_code,
                   pm.name AS payment_method_name
            FROM orders o
            LEFT JOIN products p ON o.product_id = p.id
            LEFT JOIN users buyer ON o.buyer_id = buyer.id
            LEFT JOIN users seller ON o.seller_id = seller.id
            LEFT JOIN payment_methods pm ON o.payment_method_id = pm.id
            WHERE o.id = :id
        ");
        $stmt->execute([':id' => (int)$orderId]);
        $order = $stmt->fetch();
        if (!$order) errorResponse('Order not found', 404);
        successResponse($order);
    }

    // Disputed orders
    if ($scope === 'disputes') {
        $stmt = $db->query("
            SELECT o.*, p.title_en AS product_title,
                   buyer.username AS buyer_name,
                   seller.username AS seller_name
            FROM orders o
            LEFT JOIN products p ON o.product_id = p.id
            LEFT JOIN users buyer ON o.buyer_id = buyer.id
            LEFT JOIN users seller ON o.seller_id = seller.id
            WHERE o.status = 'disputed'
            ORDER BY o.updated_at DESC
        ");
        successResponse($stmt->fetchAll());
    }

    // All orders (paginated)
    $page = max(1, (int)getQueryParam('page', 1));
    $limit = min(100, max(1, (int)getQueryParam('limit', 50)));
    $offset = ($page - 1) * $limit;
    $status = getQueryParam('status');

    $where = [];
    $params = [];
    if ($status) {
        $where[] = 'o.status = :status';
        $params[':status'] = $status;
    }
    $whereSQL = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $countStmt = $db->prepare("SELECT COUNT(*) FROM orders o $whereSQL");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $stmt = $db->prepare("
        SELECT o.*, p.title_en AS product_title,
               buyer.username AS buyer_name, seller.username AS seller_name,
               pm.name AS payment_method_name
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.id
        LEFT JOIN users buyer ON o.buyer_id = buyer.id
        LEFT JOIN users seller ON o.seller_id = seller.id
        LEFT JOIN payment_methods pm ON o.payment_method_id = pm.id
        $whereSQL
        ORDER BY o.created_at DESC
        LIMIT :limit OFFSET :offset
    ");
    $params[':limit'] = $limit;
    $params[':offset'] = $offset;
    $stmt->execute($params);

    jsonResponse([
        'success' => true,
        'data' => $stmt->fetchAll(),
        'page' => $page,
        'per_page' => $limit,
        'total' => $total,
        'total_pages' => (int)ceil($total / $limit),
    ]);
}

function handleUpdateOrder(): void {
    $auth = requireAdmin();
    $db = getDB();

    $orderId = getQueryParam('id');
    if (!$orderId) errorResponse('Order ID is required.');

    $body = getRequestBody();
    $action = $body['action'] ?? '';

    $stmt = $db->prepare("SELECT * FROM orders WHERE id = :id");
    $stmt->execute([':id' => (int)$orderId]);
    $order = $stmt->fetch();
    if (!$order) errorResponse('Order not found.', 404);

    switch ($action) {
        case 'resolve_dispute':
            requirePermission('manage_disputes');
            $resolution = $body['resolution'] ?? 'completed';
            $notes = $body['notes'] ?? '';
            $updateStmt = $db->prepare("UPDATE orders SET status = :status, updated_at = NOW() WHERE id = :id");
            $updateStmt->execute([':status' => $resolution, ':id' => (int)$orderId]);
            // Log resolution
            $logStmt = $db->prepare("UPDATE disputes SET status = 'resolved', admin_notes = :notes, resolved_by = :admin_id WHERE order_id = :order_id");
            $logStmt->execute([':notes' => $notes, ':admin_id' => $auth['user_id'], ':order_id' => (int)$orderId]);
            successResponse(['id' => $orderId, 'status' => $resolution], 'Dispute resolved.');
            break;

        case 'cancel':
            if ($auth['role'] !== 'super_admin') {
                errorResponse('Only super_admin can cancel orders.', 403);
            }
            $updateStmt = $db->prepare("UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = :id");
            $updateStmt->execute([':id' => (int)$orderId]);
            successResponse(['id' => $orderId, 'status' => 'cancelled'], 'Order cancelled.');
            break;

        case 'confirm':
            $updateStmt = $db->prepare("UPDATE orders SET status = 'confirmed', updated_at = NOW() WHERE id = :id");
            $updateStmt->execute([':id' => (int)$orderId]);
            successResponse(['id' => $orderId, 'status' => 'confirmed'], 'Order confirmed.');
            break;

        default:
            errorResponse("Invalid action. Use: 'resolve_dispute', 'cancel', or 'confirm'.");
    }
}