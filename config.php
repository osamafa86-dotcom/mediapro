<?php
/**
 * ميديا برو — ملف الإعدادات
 * MediaPro Configuration File
 */

// ===== إعدادات الأخطاء (الإنتاج) =====
// عرض الأخطاء مغلق للمستخدمين، تُكتب في ملف log خارج مجلد public
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/private_errors.log');
error_reporting(E_ALL);

// ===== إعدادات قاعدة البيانات =====
define('DB_HOST', 'localhost');
define('DB_NAME', 'mediapro_db');
define('DB_USER', 'osama');           // غيّر اسم المستخدم
define('DB_PASS', 'KMN5TfkD&=CZ');               // غيّر كلمة المرور
define('DB_CHARSET', 'utf8mb4');

// ===== إعدادات التطبيق =====
define('APP_NAME', 'ميديا برو');
define('APP_VERSION', '1.0.0');
define('APP_URL', 'https://mediapro.emdatra.org');  // غيّر الرابط
define('UPLOAD_DIR', __DIR__ . '/uploads/');
define('MAX_UPLOAD_SIZE', 50 * 1024 * 1024); // 50MB

// ===== إعدادات الجلسة =====
ini_set('session.cookie_httponly', 1);
ini_set('session.use_strict_mode', 1);
ini_set('session.use_only_cookies', 1);
ini_set('session.cookie_samesite', 'Lax');
// فعِّل secure cookie تلقائياً عند الاتصال عبر HTTPS
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
        || (($_SERVER['SERVER_PORT'] ?? '') == 443);
if ($isHttps) ini_set('session.cookie_secure', 1);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// ===== المنطقة الزمنية =====
date_default_timezone_set('Asia/Riyadh');

// ===== اتصال قاعدة البيانات (PDO) =====
function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            die(json_encode(['error' => 'فشل الاتصال بقاعدة البيانات']));
        }
    }
    return $pdo;
}

// ===== دوال مساعدة =====

/** إرسال رد JSON */
function jsonResponse($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/** تنظيف المدخلات */
function clean($input) {
    return htmlspecialchars(trim($input), ENT_QUOTES, 'UTF-8');
}

/** التحقق من تسجيل الدخول */
function requireAuth() {
    if (!isset($_SESSION['user_id'])) {
        if (isApiRequest()) {
            jsonResponse(['error' => 'غير مصرّح'], 401);
        }
        header('Location: login.php');
        exit;
    }
}

/** هل الطلب من API */
function isApiRequest() {
    return (
        strpos($_SERVER['REQUEST_URI'], '/api.php') !== false ||
        (!empty($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest') ||
        strpos($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json') !== false
    );
}

/** التحقق من الصلاحيات */
function hasPermission($permission) {
    if (!isset($_SESSION['permissions'])) return false;
    $perms = $_SESSION['permissions'];
    if (isset($perms['all']) && $perms['all'] === true) return true;
    return isset($perms[$permission]) && $perms[$permission];
}

/** التحقق من الدور */
function requireRole($roles) {
    if (!is_array($roles)) $roles = [$roles];
    if (!in_array($_SESSION['role_name'] ?? '', $roles)) {
        if (isApiRequest()) {
            jsonResponse(['error' => 'ليس لديك صلاحية'], 403);
        }
        die('ليس لديك صلاحية للوصول');
    }
}

/** إنشاء سجل تدقيق */
function auditLog($action, $details = '') {
    $db = getDB();
    $stmt = $db->prepare("INSERT INTO audit_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)");
    $stmt->execute([
        $_SESSION['user_id'] ?? null,
        $action,
        $details,
        $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'
    ]);
}

/** إنشاء إشعار */
function createNotification($userId, $title, $message, $type = 'info', $link = '') {
    $db = getDB();
    $stmt = $db->prepare("INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$userId, $title, $message, $type, $link]);
}

/** الحصول على إعداد */
function getSetting($key, $default = '') {
    $db = getDB();
    $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = ?");
    $stmt->execute([$key]);
    $row = $stmt->fetch();
    return $row ? $row['setting_value'] : $default;
}

/** حفظ إعداد */
function saveSetting($key, $value) {
    $db = getDB();
    $stmt = $db->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
                          ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
    $stmt->execute([$key, $value]);
}

/** رفع ملف */
function uploadFile($file, $subdir = '') {
    // التحقق من صحة الرفع أولاً
    if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
        return ['error' => 'رفع غير صالح'];
    }
    if (!empty($file['error'])) {
        return ['error' => 'خطأ في الرفع (كود: ' . (int)$file['error'] . ')'];
    }

    $dir = UPLOAD_DIR . ($subdir ? preg_replace('/[^a-zA-Z0-9_-]/', '', $subdir) . '/' : '');
    if (!is_dir($dir)) mkdir($dir, 0755, true);

    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    // أُزيلت svg لأنها تحمل خطر XSS؛ أُزيلت zip لأنها تتيح اختباء ملفات PHP
    $allowed = ['jpg','jpeg','png','gif','webp','mp4','mov','avi','pdf','doc','docx','xls','xlsx','psd','ai'];
    if (!in_array($ext, $allowed)) {
        return ['error' => 'نوع الملف غير مسموح'];
    }
    if ($file['size'] > MAX_UPLOAD_SIZE) {
        return ['error' => 'حجم الملف كبير جداً'];
    }

    // تحقق من MIME الفعلي (ليس فقط الامتداد)
    $realMime = '';
    if (function_exists('finfo_file')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $realMime = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
    }
    $expectedMimes = [
        'jpg'  => ['image/jpeg'], 'jpeg' => ['image/jpeg'],
        'png'  => ['image/png'], 'gif'  => ['image/gif'], 'webp' => ['image/webp'],
        'mp4'  => ['video/mp4'], 'mov'  => ['video/quicktime'],
        'avi'  => ['video/x-msvideo','video/avi'],
        'pdf'  => ['application/pdf'],
        'doc'  => ['application/msword'],
        'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        'xls'  => ['application/vnd.ms-excel'],
        'xlsx' => ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        'psd'  => ['image/vnd.adobe.photoshop','application/octet-stream'],
        'ai'   => ['application/postscript','application/pdf','application/octet-stream'],
    ];
    if ($realMime && isset($expectedMimes[$ext]) && !in_array($realMime, $expectedMimes[$ext], true)) {
        return ['error' => 'محتوى الملف لا يطابق الامتداد'];
    }

    $filename = uniqid('mp_') . '_' . time() . '.' . $ext;
    $path = $dir . $filename;

    if (move_uploaded_file($file['tmp_name'], $path)) {
        @chmod($path, 0644);
        $type = 'document';
        if (in_array($ext, ['jpg','jpeg','png','gif','webp'])) $type = 'image';
        elseif (in_array($ext, ['mp4','mov','avi'])) $type = 'video';
        elseif (in_array($ext, ['psd','ai'])) $type = 'design';

        return [
            'filename' => $filename,
            'original_name' => $file['name'],
            'file_type' => $type,
            'file_size' => $file['size'],
            'mime_type' => $realMime ?: $file['type'],
            'file_path' => ($subdir ? $subdir . '/' : '') . $filename
        ];
    }
    return ['error' => 'فشل في رفع الملف'];
}

/** تنسيق حجم الملف */
function formatFileSize($bytes) {
    if ($bytes >= 1073741824) return number_format($bytes / 1073741824, 1) . ' GB';
    if ($bytes >= 1048576) return number_format($bytes / 1048576, 1) . ' MB';
    if ($bytes >= 1024) return number_format($bytes / 1024, 1) . ' KB';
    return $bytes . ' B';
}
