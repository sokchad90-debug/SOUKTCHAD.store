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

    // Accept multiple field name variants (mobile app sends different names)
    // product_id variants: product_id, productId, id
    $rawProductId = $body['product_id'] ?? $body['productId'] ?? $body['id'] ?? null;
    // payment_method variants: payment_method_id, paymentMethodId, payment_method
    $paymentMethodId = $body['payment_method_id'] ?? $body['paymentMethodId'] ?? $body['payment_method'] ?? null;
    // reference_id variants: reference_id, referenceId, reference, screenshotUri, transferMessage
    $referenceId = trim($body['reference_id'] ?? $body['referenceId'] ?? $body['reference'] ?? $body['screenshotUri'] ?? $body['transferMessage'] ?? '');
    // buyer_phone variants: buyer_phone, buyerPhone, phone, buyer_phone_number
    $buyerPhone = trim($body['buyer_phone'] ?? $body['buyerPhone'] ?? $body['phone'] ?? $body['buyer_phone_number'] ?? '');
    // Extra fields from new checkout flow
    $buyerCity  = trim($body['buyer_city'] ?? $body['buyerCity'] ?? $body['city'] ?? '');
    $shippingId = trim($body['shipping_id'] ?? $body['shippingId'] ?? $body['shipping'] ?? '');
    $quantity   = max(1, (int)($body['quantity'] ?? 1));
    $clientAmount = isset($body['amount']) ? (int)$body['amount'] : null;

    // Validate product_id
    if ($rawProductId === null || $rawProductId === '') {
        errorResponse("Field 'product_id' is required.");
    }
    // Handle local-only product IDs like "p1700000000000" — these were created before DB sync
    // Try to extract numeric part; if it's a pure local ID, tell buyer to retry after sync
    if (is_string($rawProductId) && str_starts_with($rawProductId, 'p')) {
        // Try to find product by matching local ID pattern in DB (unlikely to exist)
        // Instead return a clear error so app can show "Product not yet synced"
        errorResponse('This product is not yet synchronized. Please pull to refresh and try again.', 422);
    }
    $productId = (int)$rawProductId;
    if ($productId <= 0) errorResponse('Invalid product_id.');

    if (empty($paymentMethodId)) errorResponse("Field 'payment_method_id' is required.");
    if ($referenceId === '') {
        // Generate a fallback reference if buyer didn't provide one (quantity flow)
        $referenceId = 'REF-' . strtoupper(bin2hex(random_bytes(4))) . '-' . time();
    }
    if ($buyerPhone === '') {
        // Use buyer_city + shipping as phone fallback (new checkout sends city/shipping separately)
        if ($buyerCity !== '') {
            $buyerPhone = $buyerCity;
            if ($shippingId !== '') $buyerPhone .= '|' . $shippingId;
            if ($quantity > 1) $buyerPhone .= '|qty:' . $quantity;
        } else {
            $buyerPhone = 'N/A';
        }
    }

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

    // 5. Verify payment method exists — allow any payment_method_id to pass if payment_methods table is empty/seed missing
    // (checkout shows all active methods; if seller hasn't configured one, we still want order to succeed)
    $pmStmt = $db->prepare("SELECT id FROM payment_methods WHERE id = :id AND is_active = 1");
    $pmStmt->execute([':id' => $paymentMethodId]);
    $pmRow = $pmStmt->fetch();
    if (!$pmRow) {
        // Check if ANY payment method exists — if table is empty, accept the order anyway
        $anyPm = $db->query("SELECT COUNT(*) FROM payment_methods WHERE is_active = 1")->fetchColumn();
        if ((int)$anyPm > 0) {
            errorResponse('Invalid payment method: ' . $paymentMethodId);
        }
        // Table empty -> accept any payment_method_id (backward compat)
    }

    // 6. Insert the order — use client amount if provided (includes discount + quantity), otherwise DB price
    $finalAmount = $clientAmount !== null && $clientAmount > 0 ? $clientAmount : (int)$product['price'];
    // If quantity was sent, amount should already be unitPrice * quantity; otherwise use product price
    $insertStmt = $db->prepare("
        INSERT INTO orders (product_id, buyer_id, seller_id, amount, payment_method_id, reference_id, buyer_phone, status)
        VALUES (:product_id, :buyer_id, :seller_id, :amount, :pm_id, :ref_id, :phone, 'pending')
    ");
    $insertStmt->execute([
        ':product_id' => $productId,
        ':buyer_id'   => $userId,
        ':seller_id'  => (int)$product['seller_id'],
        ':amount'     => $finalAmount,
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
