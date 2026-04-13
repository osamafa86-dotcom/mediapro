<?php
/**
 * ميديا برو — صفحة تسجيل الدخول
 */
require_once __DIR__ . '/config.php';

// إذا كان مسجل دخول بالفعل
if (isset($_SESSION['user_id'])) {
    header('Location: index.php');
    exit;
}

$error = '';

// ===== Rate Limiting =====
// تعقُّب المحاولات الفاشلة عبر جدول audit_log + IP
// الحد: 5 محاولات في آخر 10 دقائق
function tooManyAttempts($db, $ip) {
    $stmt = $db->prepare("
        SELECT COUNT(*) FROM audit_log
        WHERE action='login_failed'
          AND ip_address=?
          AND created_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE)
    ");
    $stmt->execute([$ip]);
    return (int)$stmt->fetchColumn() >= 5;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = clean($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

    if (empty($email) || empty($password)) {
        $error = 'يرجى إدخال البريد الإلكتروني وكلمة المرور';
    } elseif (tooManyAttempts(getDB(), $ip)) {
        $error = 'محاولات دخول كثيرة. يرجى المحاولة بعد 10 دقائق.';
        auditLog('login_blocked', "حظر IP: $ip");
    } else {
        $db = getDB();
        $stmt = $db->prepare("
            SELECT u.*, r.name AS role_name, r.name_ar AS role_ar, r.permissions,
                   d.name AS department_name
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE u.email = ? AND u.status = 'active'
        ");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if ($user && password_verify($password, $user['password'])) {
            // تجديد معرّف الجلسة لحماية من Session Fixation
            session_regenerate_id(true);

            // تسجيل الجلسة
            $_SESSION['user_id']        = $user['id'];
            $_SESSION['full_name']      = $user['full_name'];
            $_SESSION['email']          = $user['email'];
            $_SESSION['role_id']        = $user['role_id'];
            $_SESSION['role_name']      = $user['role_name'];
            $_SESSION['role_ar']        = $user['role_ar'];
            $_SESSION['department_id']  = $user['department_id'];
            $_SESSION['department']     = $user['department_name'];
            $_SESSION['avatar_initials']= $user['avatar_initials'];
            $_SESSION['avatar_color']   = $user['avatar_color'];
            $_SESSION['job_title']      = $user['job_title'];
            $_SESSION['permissions']    = json_decode($user['permissions'], true) ?: [];
            $_SESSION['login_time']     = time();

            // تحديث حالة الاتصال
            $db->prepare("UPDATE users SET is_online = 1, last_activity = NOW() WHERE id = ?")->execute([$user['id']]);

            // سجل التدقيق
            auditLog('login', 'تسجيل دخول ناجح');

            header('Location: index.php');
            exit;
        } else {
            // رسالة موحدة بدون إفشاء إذا كان البريد موجوداً
            $error = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
            auditLog('login_failed', "محاولة دخول فاشلة: $email");
        }
    }
}
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>تسجيل الدخول — ميديا برو</title>
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #4f46e5;
            --primary-rgb: 79,70,229;
            --primary-gradient: linear-gradient(135deg, #4f46e5, #7c3aed);
        }
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
            font-family: 'Tajawal', sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #f1f5f9;
        }
        .login-container {
            width: 100%;
            max-width: 440px;
            padding: 20px;
        }
        .login-card {
            background: rgba(30,41,59,0.8);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 24px;
            padding: 48px 40px;
            box-shadow: 0 25px 50px rgba(0,0,0,0.4);
        }
        .login-logo {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 14px;
            margin-bottom: 36px;
        }
        .logo-icon {
            width: 56px; height: 56px;
            background: var(--primary-gradient);
            border-radius: 16px;
            display: flex; align-items: center; justify-content: center;
            font-size: 26px; color: white;
            box-shadow: 0 8px 20px rgba(var(--primary-rgb), 0.4);
        }
        .logo-text h1 { font-size: 26px; font-weight: 800; color: white; }
        .logo-text span { font-size: 13px; color: #94a3b8; }
        .form-group { margin-bottom: 22px; }
        .form-group label {
            display: block; margin-bottom: 8px;
            font-size: 14px; font-weight: 600; color: #94a3b8;
        }
        .form-group input {
            width: 100%;
            padding: 14px 18px;
            background: rgba(15,23,42,0.6);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 14px;
            font-family: 'Tajawal', sans-serif;
            font-size: 15px;
            color: white;
            outline: none;
            transition: all 0.3s ease;
        }
        .form-group input:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.15);
        }
        .form-group input::placeholder { color: #475569; }
        .login-btn {
            width: 100%;
            padding: 15px;
            background: var(--primary-gradient);
            border: none;
            border-radius: 14px;
            color: white;
            font-family: 'Tajawal', sans-serif;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(var(--primary-rgb), 0.4);
            margin-top: 8px;
        }
        .login-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(var(--primary-rgb), 0.5);
        }
        .error-msg {
            background: rgba(239,68,68,0.15);
            border: 1px solid rgba(239,68,68,0.3);
            border-radius: 12px;
            padding: 12px 16px;
            color: #fca5a5;
            font-size: 14px;
            margin-bottom: 20px;
            text-align: center;
        }
        .demo-info {
            margin-top: 28px;
            padding: 18px;
            background: rgba(79,70,229,0.08);
            border: 1px solid rgba(79,70,229,0.2);
            border-radius: 14px;
            text-align: center;
        }
        .demo-info p { font-size: 13px; color: #94a3b8; margin-bottom: 6px; }
        .demo-info code {
            background: rgba(0,0,0,0.3);
            padding: 3px 10px;
            border-radius: 6px;
            font-size: 13px;
            color: #a5b4fc;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="login-card">
            <div class="login-logo">
                <div class="logo-icon">📺</div>
                <div class="logo-text">
                    <h1>ميديا برو</h1>
                    <span>نظام إدارة الشركة الإعلامية</span>
                </div>
            </div>

            <?php if ($error): ?>
                <div class="error-msg"><?= $error ?></div>
            <?php endif; ?>

            <form method="POST" action="">
                <div class="form-group">
                    <label>البريد الإلكتروني</label>
                    <input type="email" name="email" placeholder="example@mediapro.com"
                           value="<?= clean($_POST['email'] ?? '') ?>" required autofocus>
                </div>
                <div class="form-group">
                    <label>كلمة المرور</label>
                    <input type="password" name="password" placeholder="••••••••" required>
                </div>
                <button type="submit" class="login-btn">تسجيل الدخول</button>
            </form>
        </div>
    </div>
</body>
</html>
