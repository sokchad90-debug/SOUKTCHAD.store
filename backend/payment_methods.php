<?php
/**
 * Sokchad — Payment Methods API
 * GET /payment_methods.php → all active payment methods
 * Response: { success: true, data: [ { id, name, logo_url, color, instructions } ] }
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
    $rows = $db->query("SELECT id, name, logo_url, color, instructions
                        FROM payment_methods
                        WHERE is_active = 1
                        ORDER BY id ASC")->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'data' => $rows]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error', 'details' => substr($e->getMessage(), 0, 200)]);
}
