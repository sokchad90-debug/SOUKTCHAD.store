<?php
/**
 * Sokchad - Conversations API
 * ===========================
 * ENDPOINTS:
 *   GET  /api_conversations.php            → List conversations for authenticated user
 *   GET  /api_conversations.php?id=xxx     → Single conversation with messages
 *   POST /api_conversations.php            → Start conversation { seller_id, product_id, message }
 */

require_once __DIR__ . '/config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGetConversations();
        break;
    case 'POST':
        handleCreateConversation();
        break;
    default:
        errorResponse('Method not allowed.', 405);
}

function handleGetConversations(): void {
    $auth = authenticateUser();
    $userId = (int)$auth['user_id'];
    $db = getDB();

    $id = getQueryParam('id');
    if ($id) {
        $stmt = $db->prepare("
            SELECT c.*,
                   buyer.username AS buyer_name,
                   seller.username AS seller_name,
                   seller.full_name AS seller_store,
                   p.title_en AS product_title_en,
                   p.title_ar AS product_title_ar,
                   p.price AS product_price,
                   (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order ASC LIMIT 1) AS product_image
            FROM conversations c
            LEFT JOIN users buyer ON c.buyer_id = buyer.id
            LEFT JOIN users seller ON c.seller_id = seller.id
            LEFT JOIN products p ON c.product_id = p.id
            WHERE c.id = :id AND (c.buyer_id = :uid1 OR c.seller_id = :uid2)
        ");
        $stmt->execute([':id' => (int)$id, ':uid1' => $userId, ':uid2' => $userId]);
        $conv = $stmt->fetch();
        if (!$conv) errorResponse('Conversation not found.', 404);

        $mStmt = $db->prepare("
            SELECT m.*, sender.username AS sender_name
            FROM messages m
            LEFT JOIN users sender ON m.sender_id = sender.id
            WHERE m.conversation_id = :cid
            ORDER BY m.created_at ASC
        ");
        $mStmt->execute([':cid' => (int)$conv['id']]);
        $conv['messages'] = $mStmt->fetchAll();
        jsonResponse(['success' => true, 'data' => $conv]);
    }

    $stmt = $db->prepare("
        SELECT c.*,
               CASE WHEN c.buyer_id = :uid THEN 'buyer' ELSE 'seller' END AS my_role,
               buyer.username AS buyer_name,
               seller.username AS seller_name,
               seller.full_name AS seller_store,
               p.title_en AS product_title_en,
               p.title_ar AS product_title_ar,
               p.price AS product_price,
               (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order ASC LIMIT 1) AS product_image
        FROM conversations c
        LEFT JOIN users buyer ON c.buyer_id = buyer.id
        LEFT JOIN users seller ON c.seller_id = seller.id
        LEFT JOIN products p ON c.product_id = p.id
        WHERE c.buyer_id = :uid OR c.seller_id = :uid2
        ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
        LIMIT 100
    ");
    $stmt->execute([':uid' => $userId, ':uid2' => $userId]);
    jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
}

function handleCreateConversation(): void {
    $auth = authenticateUser();
    $userId = (int)$auth['user_id'];
    $db = getDB();

    $body = getRequestBody();
    $sellerId = (int)($body['seller_id'] ?? 0);
    $productId = isset($body['product_id']) && $body['product_id'] !== '' ? (int)$body['product_id'] : null;
    $message = trim((string)($body['message'] ?? ''));

    if (!$sellerId) errorResponse("Field 'seller_id' is required.");
    if ($sellerId === $userId) errorResponse('You cannot start a conversation with yourself.');
    if ($message === '') errorResponse("Field 'message' is required.");

    $sellerStmt = $db->prepare("SELECT id FROM users WHERE id = :id");
    $sellerStmt->execute([':id' => $sellerId]);
    if (!$sellerStmt->fetch()) errorResponse('Seller not found.', 404);

    // Reuse existing conversation for same buyer+seller+product when possible
    $findStmt = $db->prepare("
        SELECT id FROM conversations
        WHERE buyer_id = :b AND seller_id = :s AND (product_id <=> :p)
        LIMIT 1
    ");
    $findStmt->execute([':b' => $userId, ':s' => $sellerId, ':p' => $productId]);
    $existing = $findStmt->fetch();

    if ($existing) {
        $convId = (int)$existing['id'];
    } else {
        $ins = $db->prepare("
            INSERT INTO conversations (buyer_id, seller_id, product_id, last_message, last_message_at)
            VALUES (:b, :s, :p, :lm, NOW())
        ");
        $ins->execute([':b' => $userId, ':s' => $sellerId, ':p' => $productId, ':lm' => mb_substr($message, 0, 500)]);
        $convId = (int)$db->lastInsertId();
    }

    $msgIns = $db->prepare("INSERT INTO messages (conversation_id, sender_id, text) VALUES (:c, :s, :t)");
    $msgIns->execute([':c' => $convId, ':s' => $userId, ':t' => $message]);
    $msgId = (int)$db->lastInsertId();

    // Touch conversation
    $upd = $db->prepare("UPDATE conversations SET last_message = :lm, last_message_at = NOW() WHERE id = :id");
    $upd->execute([':lm' => mb_substr($message, 0, 500), ':id' => $convId]);

    $fetch = $db->prepare("SELECT * FROM messages WHERE id = :id");
    $fetch->execute([':id' => $msgId]);

    jsonResponse([
        'success' => true,
        'data' => [
            'conversation_id' => $convId,
            'id'              => (string)$convId,
            'message'         => $fetch->fetch(),
        ],
    ], 201);
}
