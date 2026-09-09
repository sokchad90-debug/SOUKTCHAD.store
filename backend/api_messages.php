<?php
/**
 * Sokchad - Messages API
 * ======================
 * ENDPOINT:
 *   POST /api_messages.php { conversation_id, text } → Send a message in a conversation
 *   GET  /api_messages.php?conversation_id=xxx       → List messages of a conversation
 */

require_once __DIR__ . '/config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGetMessages();
        break;
    case 'POST':
        handleSendMessage();
        break;
    default:
        errorResponse('Method not allowed.', 405);
}

function getParticipant(int $convId, int $userId): ?array {
    $db = getDB();
    $stmt = $db->prepare("SELECT id FROM conversations WHERE id = :id AND (buyer_id = :u1 OR seller_id = :u2)");
    $stmt->execute([':id' => $convId, ':u1' => $userId, ':u2' => $userId]);
    return $stmt->fetch() ?: null;
}

function handleGetMessages(): void {
    $auth = authenticateUser();
    $userId = (int)$auth['user_id'];
    $cid = (int)(getQueryParam('conversation_id') ?? 0);
    if (!$cid) errorResponse('conversation_id is required.');
    if (!getParticipant($cid, $userId)) errorResponse('Conversation not found.', 404);

    $db = getDB();
    $mStmt = $db->prepare("
        SELECT m.*, sender.username AS sender_name
        FROM messages m
        LEFT JOIN users sender ON m.sender_id = sender.id
        WHERE m.conversation_id = :cid
        ORDER BY m.created_at ASC
        LIMIT 300
    ");
    $mStmt->execute([':cid' => $cid]);
    jsonResponse(['success' => true, 'data' => $mStmt->fetchAll()]);
}

function handleSendMessage(): void {
    $auth = authenticateUser();
    $userId = (int)$auth['user_id'];
    $db = getDB();

    $body = getRequestBody();
    $cid = (int)($body['conversation_id'] ?? 0);
    $text = trim((string)($body['text'] ?? ''));

    if (!$cid) errorResponse("Field 'conversation_id' is required.");
    if ($text === '') errorResponse("Field 'text' is required.");
    if (!getParticipant($cid, $userId)) errorResponse('Conversation not found.', 404);

    $ins = $db->prepare("INSERT INTO messages (conversation_id, sender_id, text) VALUES (:c, :s, :t)");
    $ins->execute([':c' => $cid, ':s' => $userId, ':t' => $text]);

    $upd = $db->prepare("UPDATE conversations SET last_message = :lm, last_message_at = NOW() WHERE id = :id");
    $upd->execute([':lm' => mb_substr($text, 0, 500), ':id' => $cid]);

    $fetch = $db->prepare("SELECT * FROM messages WHERE id = :id");
    $fetch->execute([':id' => $db->lastInsertId()]);
    successResponse($fetch->fetch(), 'Message sent.');
}
