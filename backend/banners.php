<?php
/**
 * Sokchad — Ad Banners API
 * GET /banners.php            → active ad banners
 * GET /banners.php?country=TD → banners for one country (country codes stored in `countries` column, comma separated)
 * Response: { success: true, data: [ { id, title, image_url, link_url, sort_order } ] }
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

    // ad_banners schema may vary — introspect columns to stay robust
    $cols = [];
    $rs = $db->query("SHOW COLUMNS FROM ad_banners");
    foreach ($rs as $c) { $cols[] = $c['Field']; }

    $has = fn(string $c): bool => in_array($c, $cols, true);

    $sel = ['id'];
    foreach ([['title','title'], ['image_url','image_url'], ['image','image_url'], ['link_url','link_url'], ['link','link_url'], ['sort_order','sort_order'], ['is_active','is_active'], ['countries','countries']] as [$c, $as]) {
        if ($has($c) && !isset($used[$as])) { $sel[] = "$c AS $as"; $used[$as] = true; }
    }

    $sql = "SELECT " . implode(', ', $sel) . " FROM ad_banners";
    $params = [];
    if ($has('is_active')) { $sql .= " WHERE is_active = 1"; }
    $sql .= $has('sort_order') ? " ORDER BY sort_order ASC" : " ORDER BY id ASC";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $country = isset($_GET['country']) ? strtoupper(trim((string)$_GET['country'])) : '';
    $data = [];
    foreach ($rows as $r) {
        if ($country !== '' && isset($r['countries']) && $r['countries'] !== null && $r['countries'] !== '') {
            $list = array_map('trim', explode(',', strtoupper((string)$r['countries'])));
            if (!in_array($country, $list, true) && !in_array('ALL', $list, true)) continue;
        }
        $data[] = [
            'id'         => (string)$r['id'],
            'title'      => $r['title'] ?? '',
            'image_url'  => $r['image_url'] ?? '',
            'link_url'   => $r['link_url'] ?? '',
            'sort_order' => isset($r['sort_order']) ? (int)$r['sort_order'] : 0,
        ];
    }

    echo json_encode(['success' => true, 'data' => $data]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error', 'details' => substr($e->getMessage(), 0, 200)]);
}
