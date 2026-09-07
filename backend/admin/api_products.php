<?php
/**
 * Sokchad — Admin Products API
 * ============================
 * Manage products: list, delete, feature/unfeature, pin.
 *
 * ENDPOINTS:
 *   GET    /admin/api_products.php              → List all products (paginated, filterable)
 *   DELETE /admin/api_products.php?id=xxx       → Delete product
 *   PUT    /admin/api_products.php?id=xxx       → Update (pin, feature, status)
 *
 * PERMISSIONS:
 *   - manage_sellers: full access
 */

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleListProducts();
        break;
    case 'PUT':
        handleUpdateProduct();
        break;
    case 'DELETE':
        handleDeleteProduct();
        break;
    default:
        errorResponse('Method not allowed', 405);
}

function handleListProducts(): void {
    $auth = requirePermission('manage_sellers');
    $db = getDB();

    $page = max(1, (int)getQueryParam('page', 1));
    $limit = min(100, max(1, (int)getQueryParam('limit', 50)));
    $offset = ($page - 1) * $limit;
    $status = getQueryParam('status');
    $categoryId = getQueryParam('category_id');
    $search = getQueryParam('search');

    $where = [];
    $params = [];

    if ($status) {
        $where[] = 'p.status = :status';
        $params[':status'] = $status;
    }
    if ($categoryId) {
        $where[] = 'p.category_id = :cat';
        $params[':cat'] = $categoryId;
    }
    if ($search) {
        $where[] = '(p.title_en LIKE :s OR p.title_fr LIKE :s2 OR p.title_ar LIKE :s3 OR seller.username LIKE :s4)';
        $params[':s'] = "%$search%";
        $params[':s2'] = "%$search%";
        $params[':s3'] = "%$search%";
        $params[':s4'] = "%$search%";
    }

    $whereSQL = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $countStmt = $db->prepare("SELECT COUNT(*) FROM products p LEFT JOIN users seller ON p.seller_id = seller.id $whereSQL");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $stmt = $db->prepare("
        SELECT p.*, seller.username AS seller_name, seller.is_verified AS seller_verified,
               c.name_en AS category_name
        FROM products p
        LEFT JOIN users seller ON p.seller_id = seller.id
        LEFT JOIN categories c ON p.category_id = c.id
        $whereSQL
        ORDER BY p.created_at DESC
        LIMIT :limit OFFSET :offset
    ");
    $params[':limit'] = $limit;
    $params[':offset'] = $offset;
    $stmt->execute($params);
    $products = $stmt->fetchAll();

    jsonResponse([
        'success' => true,
        'data' => $products,
        'page' => $page,
        'per_page' => $limit,
        'total' => $total,
        'total_pages' => (int)ceil($total / $limit),
    ]);
}

function handleUpdateProduct(): void {
    $auth = requirePermission('manage_sellers');
    $db = getDB();

    $productId = getQueryParam('id');
    if (!$productId) errorResponse('Product ID is required.');

    $body = getRequestBody();
    $updates = [];

    if (isset($body['is_pinned'])) {
        $updates[] = "is_pinned = " . ((bool)$body['is_pinned'] ? '1' : '0');
    }
    if (isset($body['is_featured'])) {
        $updates[] = "is_featured = " . ((bool)$body['is_featured'] ? '1' : '0');
    }
    if (isset($body['status'])) {
        $validStatuses = ['active', 'inactive', 'sold', 'banned'];
        if (!in_array($body['status'], $validStatuses)) {
            errorResponse('Invalid status.');
        }
        $updates[] = "status = " . $db->quote($body['status']);
    }

    if (empty($updates)) errorResponse('No updates provided.');

    $updateSQL = "UPDATE products SET " . implode(', ', $updates) . ", updated_at = NOW() WHERE id = :id";
    $stmt = $db->prepare($updateSQL);
    $stmt->bindValue(':id', (int)$productId);
    $stmt->execute();

    if ($stmt->rowCount() === 0) {
        errorResponse('Product not found or no changes.', 404);
    }

    successResponse(['id' => $productId], 'Product updated.');
}

function handleDeleteProduct(): void {
    $auth = requirePermission('manage_sellers');
    $db = getDB();

    $productId = getQueryParam('id');
    if (!$productId) errorResponse('Product ID is required.');

    $stmt = $db->prepare("DELETE FROM products WHERE id = :id");
    $stmt->execute([':id' => (int)$productId]);

    if ($stmt->rowCount() === 0) {
        errorResponse('Product not found.', 404);
    }

    successResponse(['id' => $productId], 'Product deleted.');
}