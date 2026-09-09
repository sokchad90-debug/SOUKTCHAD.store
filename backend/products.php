<?php
/**
 * Sokchad — Products API
 * ======================
 * Handles product listing, creation, and updates.
 *
 * ENDPOINTS:
 *   GET  /products.php                          → List products (filtered, paginated)
 *   GET  /products.php?id=xxx                   → Get single product
 *   POST /products.php                          → Create product (auth required, seller only)
 *   PUT  /products.php?id=xxx                   → Update product (auth required, owner only)
 *
 * QUERY PARAMS (GET list):
 *   category, search, sort (newest|cheapest|expensive|most_viewed), status, limit, page
 *
 * POST BODY:
 *   title_en, title_fr, title_ar, description_en/fr/ar, price, category_id, condition,
 *   location, status, image/images, stock, max_order_qty, discount_percent, discount_until
 *
 * DEPLOY: public_html/api/products.php
 */

require_once __DIR__ . '/config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'OPTIONS') {
    http_response_code(200);
    exit;
}

switch ($method) {
    case 'GET':
        handleGetProducts();
        break;
    case 'POST':
        handleCreateProduct();
        break;
    case 'PUT':
        handleUpdateProduct();
        break;
    default:
        errorResponse('Method not allowed', 405);
}

// ============================================================
// GET — List or single
// ============================================================
function handleGetProducts(): void {
    $db = getDB();

    $productId = getQueryParam('id');
    if ($productId !== null && $productId !== '') {
        // Single product
        $stmt = $db->prepare("
            SELECT p.*,
                   u.username AS seller_name, u.avatar_url AS seller_avatar,
                   u.is_verified AS seller_verified, u.seller_id AS seller_code,
                   u.location AS seller_location, u.rating AS seller_rating,
                   u.total_sales AS seller_total_sales
            FROM products p
            LEFT JOIN users u ON p.seller_id = u.id
            WHERE p.id = :id
            LIMIT 1
        ");
        $stmt->execute([':id' => (int)$productId]);
        $row = $stmt->fetch();
        if (!$row) errorResponse('Product not found.', 404);

        // Fetch images
        $row['images'] = fetchProductImages((int)$row['id']);
        // Fallback: if no product_images rows, use legacy `images` column if present
        if (empty($row['images']) && !empty($row['images_legacy'] ?? '')) {
            $row['images'] = array_filter(array_map('trim', explode(',', $row['images_legacy'])));
        }
        successResponse(formatProductRow($row));
    }

    // List
    $category = getQueryParam('category');
    $search   = getQueryParam('search');
    $sort     = getQueryParam('sort', 'newest');
    $status   = getQueryParam('status', 'active');
    $limit    = min(100, max(1, (int)(getQueryParam('limit', 50) ?? 50)));
    $page     = max(1, (int)(getQueryParam('page', 1) ?? 1));
    $offset   = ($page - 1) * $limit;

    $where  = [];
    $params = [];

    if ($status && $status !== 'all') {
        $where[] = 'p.status = :status';
        $params[':status'] = $status;
    }
    if ($category && $category !== 'all') {
        $where[] = 'p.category_id = :cat';
        $params[':cat'] = $category;
    }
    if ($search && trim($search) !== '') {
        $where[] = '(p.title_en LIKE :search OR p.title_fr LIKE :search2 OR p.title_ar LIKE :search3 OR p.description_en LIKE :search4)';
        $like = '%' . trim($search) . '%';
        $params[':search']  = $like;
        $params[':search2'] = $like;
        $params[':search3'] = $like;
        $params[':search4'] = $like;
    }

    $whereSQL = empty($where) ? '1=1' : implode(' AND ', $where);

    // Sort
    $orderBy = 'p.created_at DESC';
    if ($sort === 'cheapest')  $orderBy = 'p.price ASC';
    elseif ($sort === 'expensive') $orderBy = 'p.price DESC';
    elseif ($sort === 'most_viewed') $orderBy = 'p.views DESC';

    // Count
    $countStmt = $db->prepare("SELECT COUNT(*) FROM products p WHERE $whereSQL");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    // Fetch
    $stmt = $db->prepare("
        SELECT p.*,
               u.username AS seller_name, u.avatar_url AS seller_avatar, u.is_verified AS seller_verified
        FROM products p
        LEFT JOIN users u ON p.seller_id = u.id
        WHERE $whereSQL
        ORDER BY $orderBy
        LIMIT :limit OFFSET :offset
    ");
    foreach ($params as $k => $v) $stmt->bindValue($k, $v);
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $rows = $stmt->fetchAll();

    // Attach images + format
    $items = [];
    foreach ($rows as $row) {
        $row['images'] = fetchProductImages((int)$row['id']);
        $items[] = formatProductRow($row);
    }

    jsonResponse([
        'success' => true,
        'data' => [
            'items' => $items,
            'total' => $total,
            'page'  => $page,
            'per_page' => $limit,
            'total_pages' => (int)ceil($total / $limit),
        ],
        // Also expose flat array for backward compat (productService handles both)
        'items' => $items,
    ]);
}

// ============================================================
// POST — Create
// ============================================================
function handleCreateProduct(): void {
    $auth = authenticateUser();
    $userId = (int)$auth['user_id'];
    $db = getDB();

    // Only sellers can create
    $role = $auth['role'] ?? 'buyer';
    if ($role === 'buyer') {
        // Check DB role too (token may be stale)
        $chk = $db->prepare("SELECT role FROM users WHERE id = :id LIMIT 1");
        $chk->execute([':id' => $userId]);
        $dbRole = $chk->fetchColumn();
        if ($dbRole === 'buyer') {
            errorResponse('Only seller accounts can create products.', 403);
        }
    }

    $body = getRequestBody();

    $titleEn = trim($body['title_en'] ?? '');
    $price   = (int)($body['price'] ?? 0);
    $catId   = trim($body['category_id'] ?? 'other');

    if ($titleEn === '') errorResponse('title_en is required.');
    if ($price < 0) errorResponse('Price must be >= 0.');

    // Collect fields
    $fields = [
        'seller_id'       => $userId,
        'title_en'        => $titleEn,
        'title_fr'        => trim($body['title_fr'] ?? ''),
        'title_ar'        => trim($body['title_ar'] ?? ''),
        'description_en'  => trim($body['description_en'] ?? ''),
        'description_fr'  => trim($body['description_fr'] ?? ''),
        'description_ar'  => trim($body['description_ar'] ?? ''),
        'price'           => $price,
        'category_id'     => $catId,
        'condition'       => in_array(($body['condition'] ?? 'new'), ['new','used','like_new'], true) ? $body['condition'] : 'new',
        'location'        => trim($body['location'] ?? ''),
        'status'          => 'active',
        'is_pinned'       => 0,
        'views'           => 0,
    ];

    // Optional: stock, max_order_qty, discount, currency
    $hasStockCol = columnExists('products', 'stock');
    $hasMaxQtyCol = columnExists('products', 'max_order_qty');
    $hasDiscountCol = columnExists('products', 'discount_percent');

    try {
        // Build dynamic INSERT
        $cols = array_keys($fields);
        $extraCols = [];
        $extraVals = [];

        if ($hasStockCol && isset($body['stock'])) {
            $extraCols[] = 'stock';
            $extraVals[':stock'] = (int)$body['stock'];
        }
        if ($hasMaxQtyCol && isset($body['max_order_qty'])) {
            $extraCols[] = 'max_order_qty';
            $extraVals[':max_order_qty'] = (int)$body['max_order_qty'];
        }
        if ($hasDiscountCol) {
            if (isset($body['discount_percent'])) {
                $extraCols[] = 'discount_percent';
                $extraVals[':discount_percent'] = max(0, min(30, (int)$body['discount_percent']));
            }
            if (!empty($body['discount_until'])) {
                $extraCols[] = 'discount_until';
                $extraVals[':discount_until'] = $body['discount_until'];
            }
        }

        $allCols = array_merge($cols, $extraCols);
        $placeholders = array_map(fn($c) => ":$c", $cols);
        foreach ($extraCols as $c) $placeholders[] = ":$c";

        $quotedCols = array_map(function($c){ return '`' . str_replace('`','',$c) . '`'; }, $allCols);
        $sql = "INSERT INTO products (" . implode(', ', $quotedCols) . ") VALUES (" . implode(', ', $placeholders) . ")";
        $stmt = $db->prepare($sql);

        $params = [];
        foreach ($fields as $k => $v) $params[":$k"] = $v;
        foreach ($extraVals as $k => $v) $params[$k] = $v;

        $stmt->execute($params);
        $newId = (int)$db->lastInsertId();

        // Save images
        $images = [];
        if (!empty($body['images'])) {
            if (is_string($body['images'])) {
                $images = array_filter(array_map('trim', explode(',', $body['images'])));
            } elseif (is_array($body['images'])) {
                $images = array_filter(array_map('trim', $body['images']));
            }
        } elseif (!empty($body['image'])) {
            $images = [trim($body['image'])];
        }

        // Filter: skip empty, limit 5, skip file:// URIs that would be broken
        // But still save http/https URLs. For file:// we store as-is (will 404, but better than losing)
        $images = array_slice(array_filter($images, fn($u) => $u !== ''), 0, 5);

        if (!empty($images)) {
            $imgStmt = $db->prepare("INSERT INTO product_images (product_id, image_url, sort_order) VALUES (:pid, :url, :ord)");
            foreach ($images as $idx => $url) {
                $imgStmt->execute([':pid' => $newId, ':url' => $url, ':ord' => $idx]);
            }
        }

        // Fetch created product
        $fetch = $db->prepare("
            SELECT p.*, u.username AS seller_name, u.avatar_url AS seller_avatar, u.is_verified AS seller_verified
            FROM products p LEFT JOIN users u ON p.seller_id = u.id WHERE p.id = :id LIMIT 1
        ");
        $fetch->execute([':id' => $newId]);
        $row = $fetch->fetch();
        $row['images'] = fetchProductImages($newId);

        successResponse(formatProductRow($row), 'Product created.');

    } catch (PDOException $e) {
        errorResponse('Failed to create product: ' . $e->getMessage(), 500);
    }
}

// ============================================================
// PUT — Update
// ============================================================
function handleUpdateProduct(): void {
    $auth = authenticateUser();
    $userId = (int)$auth['user_id'];
    $role   = $auth['role'] ?? 'buyer';
    $db = getDB();

    $productId = getQueryParam('id');
    if (!$productId) errorResponse('Product ID is required.');

    // Check ownership (admin can update any)
    $chk = $db->prepare("SELECT seller_id FROM products WHERE id = :id LIMIT 1");
    $chk->execute([':id' => (int)$productId]);
    $owner = $chk->fetchColumn();
    if ($owner === false) errorResponse('Product not found.', 404);
    if ((int)$owner !== $userId && !in_array($role, ['admin','super_admin','staff'])) {
        errorResponse('Not authorized to update this product.', 403);
    }

    $body = getRequestBody();
    if (empty($body)) errorResponse('No fields to update.');

    $allowed = [
        'title_en','title_fr','title_ar','description_en','description_fr','description_ar',
        'price','category_id','condition','location','status','is_pinned','pinned_until',
        'is_featured','views','stock','max_order_qty','discount_percent','discount_until'
    ];

    $sets = [];
    $params = [':id' => (int)$productId];

    foreach ($body as $k => $v) {
        // Map app-shaped fields
        if ($k === 'categoryId') $k = 'category_id';
        if ($k === ' DiscountPercent') $k = 'discount_percent';

        if (!in_array($k, $allowed)) continue;
        // Skip columns that don't exist in DB
        if (in_array($k, ['stock','max_order_qty','discount_percent','discount_until','is_featured']) && !columnExists('products', $k)) {
            continue;
        }
        $sets[] = "`$k` = :$k";
        $params[":$k"] = $v;
    }

    // Handle images update
    $images = null;
    if (isset($body['images']) || isset($body['image'])) {
        if (isset($body['images'])) {
            $images = is_string($body['images']) ? array_filter(array_map('trim', explode(',', $body['images']))) : (is_array($body['images']) ? $body['images'] : []);
        } elseif (isset($body['image'])) {
            $images = [trim($body['image'])];
        }
    }

    if (empty($sets) && $images === null) {
        errorResponse('No valid fields to update.');
    }

    try {
        if (!empty($sets)) {
            $sql = "UPDATE products SET " . implode(', ', $sets) . " WHERE id = :id";
            $db->prepare($sql)->execute($params);
        }

        if ($images !== null) {
            // Replace images
            $db->prepare("DELETE FROM product_images WHERE product_id = :pid")->execute([':pid' => (int)$productId]);
            $images = array_slice(array_filter($images, fn($u) => trim($u) !== ''), 0, 5);
            if (!empty($images)) {
                $imgStmt = $db->prepare("INSERT INTO product_images (product_id, image_url, sort_order) VALUES (:pid, :url, :ord)");
                foreach ($images as $idx => $url) {
                    $imgStmt->execute([':pid' => (int)$productId, ':url' => trim($url), ':ord' => $idx]);
                }
            }
        }

        // Fetch updated
        $fetch = $db->prepare("
            SELECT p.*, u.username AS seller_name, u.avatar_url AS seller_avatar, u.is_verified AS seller_verified
            FROM products p LEFT JOIN users u ON p.seller_id = u.id WHERE p.id = :id LIMIT 1
        ");
        $fetch->execute([':id' => (int)$productId]);
        $row = $fetch->fetch();
        $row['images'] = fetchProductImages((int)$productId);

        successResponse(formatProductRow($row), 'Product updated.');

    } catch (PDOException $e) {
        errorResponse('Update failed: ' . $e->getMessage(), 500);
    }
}

// ============================================================
// HELPERS
// ============================================================
function fetchProductImages(int $productId): array {
    $db = getDB();
    try {
        $stmt = $db->prepare("SELECT image_url FROM product_images WHERE product_id = :pid ORDER BY sort_order ASC");
        $stmt->execute([':pid' => $productId]);
        return array_column($stmt->fetchAll(), 'image_url');
    } catch (PDOException $e) {
        return [];
    }
}

function formatProductRow(array $row): array {
    // Normalize all snake_case DB columns to the app's expected camelCase + originals
    $images = $row['images'] ?? [];
    // If images empty and row has legacy `image` column
    if (empty($images) && !empty($row['image'] ?? '')) {
        $images = array_filter(array_map('trim', explode(',', $row['image'])));
    }

    return [
        'id'               => (int)$row['id'],
        'seller_id'        => (int)($row['seller_id'] ?? 0),
        'title_en'         => $row['title_en'] ?? '',
        'title_fr'         => $row['title_fr'] ?? '',
        'title_ar'         => $row['title_ar'] ?? '',
        'description_en'   => $row['description_en'] ?? '',
        'description_fr'   => $row['description_fr'] ?? '',
        'description_ar'   => $row['description_ar'] ?? '',
        'price'            => (int)($row['price'] ?? 0),
        'category_id'      => $row['category_id'] ?? 'other',
        'condition'        => $row['condition'] ?? 'new',
        'location'         => $row['location'] ?? '',
        'is_pinned'        => (bool)($row['is_pinned'] ?? 0),
        'pinned_until'     => $row['pinned_until'] ?? null,
        'is_featured'      => (bool)($row['is_featured'] ?? 0),
        'status'           => $row['status'] ?? 'active',
        'views'            => (int)($row['views'] ?? 0),
        'created_at'       => $row['created_at'] ?? '',
        'updated_at'       => $row['updated_at'] ?? '',
        'images'           => $images,
        'image'            => $images[0] ?? '',
        // Extra denormalized (for productService dbRowToProduct)
        'sellerName'       => $row['seller_name'] ?? '',
        'seller_name'      => $row['seller_name'] ?? '',
        'sellerAvatar'     => $row['seller_avatar'] ?? '',
        'seller_avatar'    => $row['seller_avatar'] ?? '',
        'seller_verified'  => (bool)($row['seller_verified'] ?? 0),
        'cover_image'      => $images[0] ?? '',
        // Extended columns if present
        'stock'            => isset($row['stock']) ? (int)$row['stock'] : null,
        'max_order_qty'    => isset($row['max_order_qty']) ? (int)$row['max_order_qty'] : null,
        'discount_percent' => isset($row['discount_percent']) ? (int)$row['discount_percent'] : null,
        'discount_until'   => $row['discount_until'] ?? null,
    ];
}

function columnExists(string $table, string $column): bool {
    static $cache = [];
    $key = "$table.$column";
    if (isset($cache[$key])) return $cache[$key];
    try {
        $db = getDB();
        $stmt = $db->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :col");
        $stmt->execute([':table' => $table, ':col' => $column]);
        $cache[$key] = (int)$stmt->fetchColumn() > 0;
    } catch (Exception $e) {
        $cache[$key] = false;
    }
    return $cache[$key];
}
