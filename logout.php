<?php
require_once __DIR__ . '/config.php';
if (isset($_SESSION['user_id'])) {
    $db = getDB();
    $db->prepare("UPDATE users SET is_online = 0 WHERE id = ?")->execute([$_SESSION['user_id']]);
    auditLog('logout', 'تسجيل خروج');
}
session_destroy();
header('Location: login.php');
exit;
