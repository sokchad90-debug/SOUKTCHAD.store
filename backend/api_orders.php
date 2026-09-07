<?php
/**
 * Sokchad - Orders API
 * ====================
 * Handles creating and fetching orders.
 * 
 * ENDPOINTS:
 *   GET  /api_orders.php              → List orders for authenticated user (buyer or seller)
 *   GET  /api_orders.php?id=xxx       → Get single order by ID
 *   POST /api_orders.php              → Create a new order (buyer only)
 *   PUT  /api_orders.php?id=xxx       → Update order status (confirm, dispute, complete)
 * 
 * DEPLOYMENT:
 *   Upload to: public_html/api/api_orders.php
 *   URL:       https://yourdomain.com/api/api_orders.php
 * 
 * MYSQL TABLE REQUIRED:
 *   CREATE TABLE orders (
 *     id                INT AUTO_INCREMENT PRIMARY KEY,
 *     product_id        INT NOT NULL,
 *     buyer_id          INT NOT NULL,
 *     seller_id         INT NOT NULL,
 *     amount            INT NOT NULL,
 *     payment_method_id VARCHAR(50),
 *     reference_id      VARCHAR(100) DEFAULT '',
 *     buyer_phone       VARCHAR(20) DEFAULT '',
 *     status            ENUM('pending','confirmed','disputed','cancelled','delivered','completed') DEFAULT 'pending',
 *     created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *     updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 *     FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
 *     FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
 *     FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
 *     UNIQUE KEY unique_reference (reference_id)
 *   );
 */

require_once __DIR__ . '/config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {

    // ========================================================
    // GET — Fetch orders
    // ========================================================
    case 'GET':
        handleGetOrders();
        break;

    // ========================================================
    // POST — Create a new order
    // ========================================================
    case 'POST':
        handleCreateOrder();
        break;

    // ========================================================
    // PUT — Update order status
    // ========================================================
    case 'PUT':
        handleUpdateOrder();
        break;

    default:
        errorResponse('Method not allowed', 405);
}

// ============================================================
// GET ORDERS
// ============================================================
function handleGetOrders(): void {
    $auth = authenticateUser();
    $userId = $auth['user_id'];
    $db = getDB();

    // If specific order ID requested
    $orderId = getQueryParam('id');
    if ($orderId) {
        $stmt = $db->prepare("
            SELECT 
                o.*,
                p.title_en AS product_title_en,
                p.title_fr AS product_title_fr,
                p.title_ar AS product_title_ar,
                (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = o.product_id ORDER BY pi.sort_order ASC LIMIT 1) AS product_image,
                buyer.username AS buyer_name,
                buyer.phone AS buyer_contact,
                seller.username AS seller_name,
                seller.seller_id AS seller_code,
                pm.name AS payment_method_name,
                pm.color AS payment_method_color
            FROM orders o
            LEFT JOIN products p ON o.product_id = p.id
            LEFT JOIN users buyer ON o.buyer_id = buyer.id
            LEFT JOIN users seller ON o.seller_id = seller.id
            LEFT JOIN payment_methods pm ON o.payment_method_id = pm.id
            WHERE o.id = :id AND (o.buyer_id = :uid1 OR o.seller_id = :uid2)
        ");
        $stmt->execute([
            ':id'   => (int)$orderId,
            ':uid1' => $userId,
            ':uid2' => $userId,
        ]);
        $order = $stmt->fetch();

        if (!$order) {
            errorResponse('Order not found', 404);
        }

        successResponse($order);
    }

    // List all orders for the user (as buyer or seller)
    $role   = getQueryParam('role', 'all'); // 'buyer', 'seller', or 'all'
    $status = getQueryParam('status');       // optional: 'pending', 'confirmed', etc.
    $page   = max(1, (int)getQueryParam('page', 1));
    $limit  = min(50, max(1, (int)getQueryParam('limit', 20)));
    $offset = ($page - 1) * $limit;

    $where  = [];
    $params = [];

    if ($role === 'buyer') {
        $where[]           = 'o.buyer_id = :uid';
        $params[':uid']    = $userId;
    } elseif ($role === 'seller') {
        $where[]           = 'o.seller_id = :uid';
        $params[':uid']    = $userId;
    } else {
        $where[]           = '(o.buyer_id = :uid1 OR o.seller_id = :uid2)';
        $params[':uid1']   = $userId;
        $params[':uid2']   = $userId;
    }

    if ($status) {
        $where[]            = 'o.status = :status';
        $params[':status']  = $status;
    }

    $whereSQL = implode(' AND ', $where);

    // Count total
    $countStmt = $db->prepare("SELECT COUNT(*) FROM orders o WHERE $whereSQL");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    // Fetch paginated
    $stmt = $db->prepare("
        SELECT 
            o.*,
            p.title_en AS product_title_en,
            p.title_fr AS product_title_fr,
            p.title_ar AS product_title_ar,
            (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = o.product_id ORDER BY pi.sort_order ASC LIMIT 1) AS product_image,
            seller.username AS seller_name,
            pm.name AS payment_method_name
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.id
        LEFT JOIN users seller ON o.seller_id = seller.id
        LEFT JOIN payment_methods pm ON o.payment_method_id = pm.id
        WHERE $whereSQL
        ORDER BY o.created_at DESC
        LIMIT :limit OFFSET :offset
    ");
    $params[':limit']  = $limit;
    $params[':offset'] = $offset;
    $stmt->execute($params);
    $orders = $stmt->fetchAll();

    jsonResponse([
        'success'    => true,
        'data'       => $orders,
        'page'       => $page,
        'per_page'   => $limit,
        'total'      => $total,
        'total_pages' => (int)ceil($total / $limit),
    ]);
}

// ============================================================
// CREATE ORDER
// ============================================================
function handleCreateOrder(): void {
    $auth = authenticateUser();
    $userId = $auth['user_id'];
    $db = getDB();

    $body = getRequestBody();

    // Validate required fields
    $required = ['product_id', 'payment_method_id', 'reference_id', 'buyer_phone'];
    foreach ($required as $field) {
        if (empty($body[$field])) {
            errorResponse("Field '$field' is required.");
        }
    }

    $productId       = (int)$body['product_id'];
    $paymentMethodId = $body['payment_method_id'];
    $referenceId     = trim($body['reference_id']);
    $buyerPhone      = trim($body['buyer_phone']);

    // 1. Verify buyer is not a seller account
    $userStmt = $db->prepare("SELECT role FROM users WHERE id = :id");
    $userStmt->execute([':id' => $userId]);
    $userRow = $userStmt->fetch();
    if (!$userRow) {
        errorResponse('User not found.', 404);
    }
    if ($userRow['role'] === 'seller') {
        errorResponse('Seller accounts cannot purchase items.', 403);
    }

    // 2. Verify product exists and is active
    $prodStmt = $db->prepare("SELECT id, seller_id, price, status FROM products WHERE id = :id");
    $prodStmt->execute([':id' => $productId]);
    $product = $prodStmt->fetch();
    if (!$product) {
        errorResponse('Product not found.', 404);
    }
    if ($product['status'] !== 'active') {
        errorResponse('This product is no longer available.');
    }

    // 3. Prevent buying own product
    if ((int)$product['seller_id'] === $userId) {
        errorResponse('You cannot buy your own product.');
    }

    // 4. Check reference ID uniqueness
    if (!empty($referenceId)) {
        $refStmt = $db->prepare("SELECT id FROM orders WHERE reference_id = :ref");
        $refStmt->execute([':ref' => $referenceId]);
        if ($refStmt->fetch()) {
            errorResponse('Reference ID already used. Please enter a different one.');
        }
    }

    // 5. Verify payment method exists
    $pmStmt = $db->prepare("SELECT id FROM payment_methods WHERE id = :id AND is_active = 1");
    $pmStmt->execute([':id' => $paymentMethodId]);
    if (!$pmStmt->fetch()) {
        errorResponse('Invalid payment method.');
    }

    // 6. Insert the order
    $insertStmt = $db->prepare("
        INSERT INTO orders (product_id, buyer_id, seller_id, amount, payment_method_id, reference_id, buyer_phone, status)
        VALUES (:product_id, :buyer_id, :seller_id, :amount, :pm_id, :ref_id, :phone, 'pending')
    ");
    $insertStmt->execute([
        ':product_id' => $productId,
        ':buyer_id'   => $userId,
        ':seller_id'  => (int)$product['seller_id'],
        ':amount'     => (int)$product['price'],
        ':pm_id'      => $paymentMethodId,
        ':ref_id'     => $referenceId,
        ':phone'      => $buyerPhone,
    ]);

    $newOrderId = $db->lastInsertId();

    // 7. Fetch and return the created order
    $fetchStmt = $db->prepare("SELECT * FROM orders WHERE id = :id");
    $fetchStmt->execute([':id' => $newOrderId]);
    $newOrder = $fetchStmt->fetch();

    successResponse($newOrder, 'Order created successfully.');
}

// ============================================================
// UPDATE ORDER STATUS
// ============================================================
function handleUpdateOrder(): void {
    $auth = authenticateUser();
    $userId = $auth['user_id'];
    $userRole = $auth['role'] ?? 'buyer';
    $db = getDB();

    $orderId = getQueryParam('id');
    if (!$orderId) {
        errorResponse('Order ID is required.');
    }

    $body = getRequestBody();
    $action = $body['action'] ?? '';

    // Fetch the order
    $stmt = $db->prepare("SELECT * FROM orders WHERE id = :id");
    $stmt->execute([':id' => (int)$orderId]);
    $order = $stmt->fetch();

    if (!$order) {
        errorResponse('Order not found.', 404);
    }

    $isBuyer  = (int)$order['buyer_id'] === $userId;
    $isSeller = (int)$order['seller_id'] === $userId;
    $isAdmin  = in_array($userRole, ['admin', 'super_admin', 'staff']);

    switch ($action) {

        // Seller or Admin confirms payment received
        case 'confirm':
            if (!$isSeller && !$isAdmin) {
                errorResponse('Only the seller or admin can confirm orders.', 403);
            }
            if ($order['status'] !== 'pending') {
                errorResponse("Cannot confirm an order with status '{$order['status']}'.");
            }
            $updateStmt = $db->prepare("UPDATE orders SET status = 'confirmed', updated_at = NOW() WHERE id = :id");
            $updateStmt->execute([':id' => (int)$orderId]);
            successResponse(['id' => $orderId, 'status' => 'confirmed'], 'Order confirmed.');
            break;

        // Buyer marks item as received → completed
        case 'receive':
            if (!$isBuyer) {
                errorResponse('Only the buyer can mark items as received.', 403);
            }
            if (!in_array($order['status'], ['confirmed', 'delivered'])) {
                errorResponse("Cannot mark as received with status '{$order['status']}'.");
            }
            $updateStmt = $db->prepare("UPDATE orders SET status = 'completed', updated_at = NOW() WHERE id = :id");
            $updateStmt->execute([':id' => (int)$orderId]);

            // Increment buyer's completed purchases
            $db->prepare("UPDATE users SET total_purchases = total_purchases + 1 WHERE id = :id")
               ->execute([':id' => $userId]);

            successResponse(['id' => $orderId, 'status' => 'completed'], 'Item received. Order completed.');
            break;

        // Buyer or Admin raises a dispute
        case 'dispute':
            if (!$isBuyer && !$isAdmin) {
                errorResponse('Only the buyer or admin can raise disputes.', 403);
            }
            $reason = $body['reason'] ?? 'No reason provided';
            $updateStmt = $db->prepare("UPDATE orders SET status = 'disputed', updated_at = NOW() WHERE id = :id");
            $updateStmt->execute([':id' => (int)$orderId]);

            // Log dispute in disputes table
            $disputeStmt = $db->prepare("
                INSERT INTO disputes (order_id, reporter_id, reason, status)
                VALUES (:order_id, :reporter_id, :reason, 'open')
            ");
            $disputeStmt->execute([
                ':order_id'    => (int)$orderId,
                ':reporter_id' => $userId,
                ':reason'      => $reason,
            ]);

            successResponse(['id' => $orderId, 'status' => 'disputed'], 'Dispute raised.');
            break;

        // Admin cancels the order
        case 'cancel':
            if (!$isAdmin) {
                errorResponse('Only admin can cancel orders.', 403);
            }
            $updateStmt = $db->prepare("UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = :id");
            $updateStmt->execute([':id' => (int)$orderId]);
            successResponse(['id' => $orderId, 'status' => 'cancelled'], 'Order cancelled.');
            break;

        default:
            errorResponse("Invalid action. Use: 'confirm', 'receive', 'dispute', or 'cancel'.");
    }
}
