<?php
/**
 * Sokchad — Branding API
 * ======================
 * Handles store branding (logo, ad banners) — replaces direct Supabase access.
 *
 * ENDPOINTS:
 *   GET    /api_branding.php              → Get store logo + active banners
 *   POST   /api_branding.php              → Upload/update store logo (admin)
 *   GET    /api_branding.php?scope=banners → List all banners (admin)
 *   POST   /api_branding.php?action=banner → Create banner (admin)
 *   PUT    /api_branding.php?id=xxx       → Update banner (toggle, reorder)
 *   DELETE /api_branding.php?id=xxx       → Delete banner (admin)
 *
 * SECURITY:
 *   - GET (public): logo + active banners
 *   - POST/PUT/DELETE: admin/staff only
 */

require_once __DIR__ . '/config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGetBranding();
        break;
    case 'POST':
        handlePostBranding();
        break;
    case 'PUT':
        handleUpdateBanner();
        break;
    case 'DELETE':
        handleDeleteBanner();
        break;
    default:
        errorResponse('Method not allowed', 405);
}

function handleGetBranding(): void {
    $db = getDB();
    $scope = getQueryParam('scope');

    // Admin: list all banners
    if ($scope === 'all') {
        $auth = authenticateUser();
        $role = $auth['role'] ?? 'buyer';
        if (!in_array($role, ['admin', 'super_admin', 'staff'])) {
            errorResponse('Admin access required.', 403);
        }
        $stmt = $db->query("SELECT * FROM ad_banners ORDER BY sort_order ASC, created_at DESC");
        successResponse($stmt->fetchAll());
    }

    // Public: store logo + active banners
    $logoStmt = $db->query("SELECT value FROM store_settings WHERE `key` = 'store_logo' LIMIT 1");
    $logoRow = $logoStmt->fetch();
    $logo = $logoRow['value'] ?? '';

    $bannerStmt = $db->query("SELECT id, title, image_url, link, is_active, sort_order FROM ad_banners WHERE is_active = 1 ORDER BY sort_order ASC");
    $banners = $bannerStmt->fetchAll();

    successResponse([
        'store_logo' => $logo,
        'banners' => $banners,
    ]);
}

function handlePostBranding(): void {
    $auth = authenticateUser();
    $role = $auth['role'] ?? 'buyer';
    if (!in_array($role, ['admin', 'super_admin', 'staff'])) {
        errorResponse('Admin access required.', 403);
    }

    $db = getDB();
    $body = getRequestBody();
    $action = $body['action'] ?? 'logo';

    if ($action === 'logo') {
        // Update store logo (URL from /upload endpoint)
        $logoUrl = $body['logo_url'] ?? '';
        if (empty($logoUrl)) errorResponse('logo_url is required.');

        $stmt = $db->prepare("INSERT INTO store_settings (`key`, value) VALUES ('store_logo', :url) ON DUPLICATE KEY UPDATE value = :url2");
        $stmt->execute([':url' => $logoUrl, ':url2' => $logoUrl]);
        successResponse(['logo_url' => $logoUrl], 'Store logo updated.');
    }

    if ($action === 'banner') {
        // Create new banner
        $title = $body['title'] ?? '';
        $imageUrl = $body['image_url'] ?? '';
        $link = $body['link'] ?? null;
        if (empty($imageUrl)) errorResponse('image_url is required.');

        $stmt = $db->prepare("INSERT INTO ad_banners (title, image_url, link, is_active, sort_order, created_at) VALUES (:title, :url, :link, 1, 0, NOW())");
        $stmt->execute([':title' => $title, ':url' => $imageUrl, ':link' => $link]);
        successResponse(['id' => $db->lastInsertId()], 'Banner created.');
    }

    errorResponse('Invalid action. Use "logo" or "banner".');
}

function handleUpdateBanner(): void {
    $auth = authenticateUser();
    $role = $auth['role'] ?? 'buyer';
    if (!in_array($role, ['admin', 'super_admin', 'staff'])) {
        errorResponse('Admin access required.', 403);
    }

    $db = getDB();
    $bannerId = getQueryParam('id');
    if (!$bannerId) errorResponse('Banner ID is required.');

    $body = getRequestBody();
    $updates = [];

    if (isset($body['is_active'])) {
        $updates[] = "is_active = " . ((bool)$body['is_active'] ? '1' : '0');
    }
    if (isset($body['sort_order'])) {
        $updates[] = "sort_order = " . (int)$body['sort_order'];
    }
    if (isset($body['title'])) {
        $updates[] = "title = " . $db->quote($body['title']);
    }
    if (isset($body['link'])) {
        $updates[] = "link = " . $db->quote($body['link']);
    }

    if (empty($updates)) errorResponse('No updates provided.');

    $updateSQL = "UPDATE ad_banners SET " . implode(', ', $updates) . " WHERE id = :id";
    $stmt = $db->prepare($updateSQL);
    $stmt->bindValue(':id', (int)$bannerId);
    $stmt->execute();

    if ($stmt->rowCount() === 0) {
        errorResponse('Banner not found or no changes.', 404);
    }

    successResponse(['id' => $bannerId], 'Banner updated.');
}

function handleDeleteBanner(): void {
    $auth = authenticateUser();
    $role = $auth['role'] ?? 'buyer';
    if (!in_array($role, ['admin', 'super_admin', 'staff'])) {
        errorResponse('Admin access required.', 403);
    }

    $db = getDB();
    $bannerId = getQueryParam('id');
    if (!$bannerId) errorResponse('Banner ID is required.');

    $stmt = $db->prepare("DELETE FROM ad_banners WHERE id = :id");
    $stmt->execute([':id' => (int)$bannerId]);

    if ($stmt->rowCount() === 0) {
        errorResponse('Banner not found.', 404);
    }

    successResponse(['id' => $bannerId], 'Banner deleted.');
}