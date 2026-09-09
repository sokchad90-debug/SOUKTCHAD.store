<?php
/**
 * Sokchad — Follows API
 * GET  /follows.php?seller_id=X   → { following, notifications_enabled } for current user
 * POST /follows.php  { seller_id }→ toggle follow/unfollow → { following: bool }
 * PUT  /follows.php  { seller_id, notifications_enabled } → update notification pref
 * Auth: Bearer JWT required (like auth_email.php verify pattern).
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/config/database.php';

function ensureFollowsTable(PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS follows (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        seller_id INT NOT NULL,
        notifications_enabled TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_seller (user_id, seller_id),
        KEY idx_seller (seller_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

function requireUserId(PDO $db): int {
    $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (!preg_match('/Bearer\s+(\S+)/i', $hdr, $m)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Authentication required. Please log in.']);
        exit;
    }
    $payload = decodeJWT($m[1]);
    $uid = (int)($payload['sub'] ?? $payload['user_id'] ?? 0);
    if ($uid <= 0) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Invalid or expired token']);
        exit;
    }
    return $uid;
}

try {
    $db = getDB();
    ensureFollowsTable($db);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $uid = requireUserId($db);
        $sid = (int)($_GET['seller_id'] ?? 0);
        if ($sid <= 0) { http_response_code(400); echo json_encode(['success' => false, 'error' => 'Missing seller_id']); exit; }

        $st = $db->prepare("SELECT notifications_enabled FROM follows WHERE user_id = :u AND seller_id = :s");
        $st->execute([':u' => $uid, ':s' => $sid]);
        $row = $st->fetch(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'data' => [
            'following' => (bool)$row,
            'notifications_enabled' => $row ? (bool)(int)$row['notifications_enabled'] : false,
        ]]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $uid = requireUserId($db);
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $sid = (int)($body['seller_id'] ?? 0);
        if ($sid <= 0) { http_response_code(400); echo json_encode(['success' => false, 'error' => 'Missing seller_id']); exit; }

        $st = $db->prepare("SELECT id FROM follows WHERE user_id = :u AND seller_id = :s");
        $st->execute([':u' => $uid, ':s' => $sid]);
        if ($st->fetch()) {
            $db->prepare("DELETE FROM follows WHERE user_id = :u AND seller_id = :s")->execute([':u' => $uid, ':s' => $sid]);
            echo json_encode(['success' => true, 'data' => ['following' => false]]);
        } else {
            $db->prepare("INSERT IGNORE INTO follows (user_id, seller_id) VALUES (:u, :s)")->execute([':u' => $uid, ':s' => $sid]);
            echo json_encode(['success' => true, 'data' => ['following' => true]]);
        }
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $uid = requireUserId($db);
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $sid = (int)($body['seller_id'] ?? 0);
        $notif = !empty($body['notifications_enabled']) ? 1 : 0;
        if ($sid <= 0) { http_response_code(400); echo json_encode(['success' => false, 'error' => 'Missing seller_id']); exit; }

        $db->prepare("UPDATE follows SET notifications_enabled = :n WHERE user_id = :u AND seller_id = :s")
           ->execute([':n' => $notif, ':u' => $uid, ':s' => $sid]);
        echo json_encode(['success' => true]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error', 'details' => substr($e->getMessage(), 0, 200)]);
}
