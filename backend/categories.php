<?php
/**
 * Sokchad — Categories API
 * GET /categories.php            → all active categories (flat, sorted)
 * GET /categories.php?parent=X   → children of category X
 * Response shape: { success: true, data: [ { id, name_en, name_fr, name_ar, name: {en,fr,ar}, icon, color, sort_order, is_active, parent_id, has_children } ] }
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

    $parent = isset($_GET['parent']) ? trim((string)$_GET['parent']) : '';

    if ($parent !== '' && strtolower($parent) !== 'all') {
        $stmt = $db->prepare("SELECT id, name_en, name_fr, name_ar, icon, color, sort_order, is_active
                              FROM categories
                              WHERE is_active = 1 AND parent_id = :p
                              ORDER BY sort_order ASC, name_en ASC");
        $stmt->execute([':p' => $parent]);
    } else {
        $stmt = $db->query("SELECT id, name_en, name_fr, name_ar, icon, color, sort_order, is_active
                            FROM categories
                            WHERE is_active = 1
                            ORDER BY sort_order ASC, name_en ASC");
    }

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Detect children for has_children flag (single query, cheap at this scale)
    $childMap = [];
    try {
        $crs = $db->query("SELECT parent_id, COUNT(*) AS c FROM categories WHERE parent_id IS NOT NULL AND parent_id <> '' GROUP BY parent_id");
        foreach ($crs as $r) { $childMap[$r['parent_id']] = (int)$r['c'] > 0; }
    } catch (Exception $e) { /* parent_id column may not exist yet — ignore */ }

    $data = [];
    foreach ($rows as $r) {
        $data[] = [
            'id'           => (string)$r['id'],
            'name_en'      => $r['name_en'],
            'name_fr'      => $r['name_fr'],
            'name_ar'      => $r['name_ar'],
            'name'         => ['en' => $r['name_en'], 'fr' => $r['name_fr'], 'ar' => $r['name_ar']],
            'icon'         => $r['icon'],
            'color'        => $r['color'],
            'sort_order'   => (int)$r['sort_order'],
            'is_active'    => (int)$r['is_active'],
            'has_children' => $childMap[$r['id']] ?? false,
        ];
    }

    echo json_encode(['success' => true, 'data' => $data]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error', 'details' => substr($e->getMessage(), 0, 200)]);
}
