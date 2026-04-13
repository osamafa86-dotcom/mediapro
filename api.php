<?php
/**
 * ميديا برو — واجهة API
 * كل عمليات CRUD للنظام
 */
require_once __DIR__ . '/config.php';
requireAuth();

header('Content-Type: application/json; charset=utf-8');

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$userId = $_SESSION['user_id'];
$roleN  = $_SESSION['role_name'] ?? 'employee';

// =============================================
// التوجيه الرئيسي
// =============================================
switch ($action) {

    // ===== لوحة المعلومات =====
    case 'dashboard_stats':
        $stats = [];
        $stats['employees']   = $db->query("SELECT COUNT(*) FROM users WHERE status='active'")->fetchColumn();
        $stats['tasks_total'] = $db->query("SELECT COUNT(*) FROM tasks")->fetchColumn();
        $stats['tasks_done']  = $db->query("SELECT COUNT(*) FROM tasks WHERE status='completed'")->fetchColumn();
        $stmt = $db->prepare("SELECT COUNT(DISTINCT user_id) FROM attendance WHERE date=? AND check_in IS NOT NULL");
        $stmt->execute([date('Y-m-d')]);
        $stats['present_today'] = $stmt->fetchColumn();
        $stats['leave_pending']    = $db->query("SELECT COUNT(*) FROM leaves WHERE status='pending'")->fetchColumn();
        $stats['pending_salaries'] = $db->query("SELECT COUNT(*) FROM salaries WHERE status='pending'")->fetchColumn();
        $stats['clients']       = $db->query("SELECT COUNT(*) FROM clients WHERE status='active'")->fetchColumn();
        $stats['invoices_due']  = $db->query("SELECT COALESCE(SUM(amount),0) FROM invoices WHERE status='pending'")->fetchColumn();

        // أحدث النشاطات
        $stats['recent_activity'] = $db->query("
            SELECT a.action, a.details, a.created_at, u.full_name
            FROM audit_log a LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.created_at DESC LIMIT 10
        ")->fetchAll();

        jsonResponse(['data' => $stats]);

    // ===== أفضل الموظفين =====
    case 'get_top_employees':
        $stmt = $db->query("
            SELECT u.id, u.full_name AS name, u.avatar_initials AS initials,
                   d.name AS department,
                   COALESCE(e.overall_rating, 0) * 20 AS performance
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN evaluations e ON u.id = e.user_id
            WHERE u.status = 'active'
            ORDER BY e.overall_rating DESC, u.full_name ASC
            LIMIT 5
        ");
        jsonResponse(['data' => $stmt->fetchAll()]);

    // ===== الإشعارات =====
    case 'get_notifications':
        $stmt = $db->prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30");
        $stmt->execute([$userId]);
        jsonResponse(['data' => $stmt->fetchAll()]);

    // ===== لوحتي الشخصية =====
    case 'my_dashboard':
        $my = [];
        $today = date('Y-m-d');
        $month = date('Y-m');

        // حضوري اليوم
        $my['attendance_today'] = $db->prepare("SELECT * FROM attendance WHERE user_id=? AND date=?");
        $my['attendance_today']->execute([$userId, $today]);
        $my['attendance_today'] = $my['attendance_today']->fetch() ?: null;

        // مهامي
        $stmt = $db->prepare("SELECT * FROM tasks WHERE assigned_to=? AND status != 'completed' ORDER BY priority DESC, deadline ASC LIMIT 10");
        $stmt->execute([$userId]);
        $my['my_tasks'] = $stmt->fetchAll();

        // إجازاتي
        $stmt = $db->prepare("SELECT * FROM leaves WHERE user_id=? ORDER BY created_at DESC LIMIT 5");
        $stmt->execute([$userId]);
        $my['my_leaves'] = $stmt->fetchAll();

        // تقييمي
        $stmt = $db->prepare("SELECT * FROM evaluations WHERE user_id=? ORDER BY month DESC LIMIT 1");
        $stmt->execute([$userId]);
        $my['last_eval'] = $stmt->fetch() ?: null;

        // ساعات العمل هذا الشهر
        $stmt = $db->prepare("SELECT COALESCE(SUM(total_hours),0) as hours FROM attendance WHERE user_id=? AND date LIKE ?");
        $stmt->execute([$userId, $month . '%']);
        $my['month_hours'] = $stmt->fetch()['hours'];

        jsonResponse($my);

    // =============================================
    // الحضور
    // =============================================
    case 'attendance_checkin':
        $today = date('Y-m-d');
        $now   = date('Y-m-d H:i:s');

        // تحقق من عدم وجود تسجيل سابق
        $stmt = $db->prepare("SELECT id FROM attendance WHERE user_id=? AND date=?");
        $stmt->execute([$userId, $today]);
        if ($stmt->fetch()) jsonResponse(['error' => 'سبق تسجيل الحضور اليوم'], 400);

        $workStart = getSetting('work_start_time', '09:00');
        $tolerance = (int)getSetting('late_tolerance_minutes', '10');
        $lateTime  = date('H:i', strtotime($workStart) + $tolerance * 60);
        $currentTime = date('H:i');
        $status = ($currentTime > $lateTime) ? 'late' : 'present';

        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        $device = $_POST['device_info'] ?? $_SERVER['HTTP_USER_AGENT'] ?? '';
        $lat = $_POST['lat'] ?? null;
        $lng = $_POST['lng'] ?? null;
        $securityStatus = 'verified';
        $securityNotes  = '';

        // تحقق IP
        $stmt = $db->prepare("SELECT allowed_ips FROM users WHERE id=?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        if (!empty($user['allowed_ips'])) {
            $allowedIPs = explode(',', $user['allowed_ips']);
            if (!in_array($ip, array_map('trim', $allowedIPs))) {
                $securityStatus = 'warning';
                $securityNotes = 'IP غير معروف: ' . $ip;
            }
        }

        $stmt = $db->prepare("INSERT INTO attendance (user_id, check_in, status, ip_address, device_info, location_lat, location_lng, security_status, security_notes, date)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$userId, $now, $status, $ip, $device, $lat, $lng, $securityStatus, $securityNotes, $today]);

        auditLog('check_in', "تسجيل حضور - $status");
        jsonResponse(['success' => true, 'status' => $status, 'time' => $now, 'security' => $securityStatus]);

    case 'attendance_checkout':
        $today = date('Y-m-d');
        $now   = date('Y-m-d H:i:s');

        $stmt = $db->prepare("SELECT * FROM attendance WHERE user_id=? AND date=? AND check_out IS NULL");
        $stmt->execute([$userId, $today]);
        $record = $stmt->fetch();
        if (!$record) jsonResponse(['error' => 'لا يوجد تسجيل حضور مفتوح'], 400);

        $checkIn = new DateTime($record['check_in']);
        $checkOut = new DateTime($now);
        $diff = $checkIn->diff($checkOut);
        $hours = round($diff->h + $diff->i / 60, 2);

        $idle = (int)($_POST['idle_minutes'] ?? 0);

        $stmt = $db->prepare("UPDATE attendance SET check_out=?, total_hours=?, idle_minutes=? WHERE id=?");
        $stmt->execute([$now, $hours, $idle, $record['id']]);

        auditLog('check_out', "تسجيل انصراف - $hours ساعات");
        jsonResponse(['success' => true, 'hours' => $hours]);

    case 'attendance_list':
        $dateFrom = $_GET['from'] ?? date('Y-m-01');
        $dateTo   = $_GET['to']   ?? date('Y-m-d');
        $empId    = $_GET['user_id'] ?? null;

        $sql = "SELECT a.*, u.full_name, u.avatar_initials, u.avatar_color, d.name as department
                FROM attendance a
                JOIN users u ON a.user_id = u.id
                LEFT JOIN departments d ON u.department_id = d.id
                WHERE a.date BETWEEN ? AND ?";
        $params = [$dateFrom, $dateTo];

        if ($empId) {
            $sql .= " AND a.user_id = ?";
            $params[] = $empId;
        } elseif ($roleN === 'employee') {
            $sql .= " AND a.user_id = ?";
            $params[] = $userId;
        }
        $sql .= " ORDER BY a.date DESC, a.check_in DESC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        jsonResponse($stmt->fetchAll());

    case 'attendance_idle_update':
        $today = date('Y-m-d');
        $idle  = (int)($_POST['idle_minutes'] ?? 0);
        $actStatus = 'active';
        $maxIdle = (int)getSetting('idle_max_minutes', '15');
        if ($idle > $maxIdle) $actStatus = 'danger';
        elseif ($idle > ($maxIdle / 2)) $actStatus = 'idle';

        $stmt = $db->prepare("UPDATE attendance SET idle_minutes=?, activity_status=? WHERE user_id=? AND date=? AND check_out IS NULL");
        $stmt->execute([$idle, $actStatus, $userId, $today]);
        jsonResponse(['status' => $actStatus]);

    // =============================================
    // المهام / سير العمل
    // =============================================
    case 'tasks_list':
        $stage  = $_GET['stage'] ?? null;
        $status = $_GET['status'] ?? null;
        $assignee = $_GET['assigned_to'] ?? null;

        $sql = "SELECT t.*, u.full_name as assignee_name, u.avatar_initials, u.avatar_color,
                       c.full_name as creator_name
                FROM tasks t
                LEFT JOIN users u ON t.assigned_to = u.id
                LEFT JOIN users c ON t.created_by = c.id
                WHERE 1=1";
        $params = [];

        if ($stage)    { $sql .= " AND t.stage = ?";       $params[] = $stage; }
        if ($status)   { $sql .= " AND t.status = ?";      $params[] = $status; }
        if ($assignee) { $sql .= " AND t.assigned_to = ?";  $params[] = $assignee; }
        if ($roleN === 'employee') { $sql .= " AND t.assigned_to = ?"; $params[] = $userId; }

        $sql .= " ORDER BY FIELD(t.priority,'urgent','high','medium','low'), t.deadline ASC";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        jsonResponse($stmt->fetchAll());

    case 'task_create':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        $title    = clean($_POST['title'] ?? '');
        $desc     = clean($_POST['description'] ?? '');
        $assigned = $_POST['assigned_to'] ?? null;
        $dept     = $_POST['department_id'] ?? null;
        $stage    = $_POST['stage'] ?? 'content_prep';
        $priority = $_POST['priority'] ?? 'medium';
        $taskType = clean($_POST['task_type'] ?? '');
        $deadline = $_POST['deadline'] ?? null;

        if (empty($title)) jsonResponse(['error' => 'عنوان المهمة مطلوب'], 400);

        $stmt = $db->prepare("INSERT INTO tasks (title, description, assigned_to, created_by, department_id, stage, priority, task_type, deadline)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$title, $desc, $assigned, $userId, $dept, $stage, $priority, $taskType, $deadline]);
        $taskId = $db->lastInsertId();

        // حركة المهمة
        $db->prepare("INSERT INTO task_movements (task_id, from_user, to_user, to_stage, action) VALUES (?,?,?,?,?)")
           ->execute([$taskId, $userId, $assigned, $stage, 'إنشاء مهمة جديدة']);

        if ($assigned) createNotification($assigned, 'مهمة جديدة', "تم تكليفك بمهمة: $title", 'task', '#workflow');

        auditLog('task_create', "إنشاء مهمة: $title");
        jsonResponse(['success' => true, 'id' => $taskId]);

    case 'task_update':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        $taskId   = (int)($_POST['id'] ?? 0);
        $fields   = [];
        $params   = [];

        foreach (['title','description','assigned_to','stage','priority','progress','status','deadline','task_type'] as $f) {
            if (isset($_POST[$f])) {
                $fields[] = "$f = ?";
                $params[] = $_POST[$f];
            }
        }
        if (empty($fields)) jsonResponse(['error' => 'لا توجد بيانات للتحديث'], 400);

        // إذا تم إكمال المهمة
        if (isset($_POST['status']) && $_POST['status'] === 'completed') {
            $fields[] = "completed_at = NOW()";
        }

        $params[] = $taskId;
        $stmt = $db->prepare("UPDATE tasks SET " . implode(', ', $fields) . " WHERE id = ?");
        $stmt->execute($params);

        // سجل الحركة
        if (isset($_POST['stage'])) {
            $db->prepare("INSERT INTO task_movements (task_id, from_user, to_stage, action) VALUES (?,?,?,?)")
               ->execute([$taskId, $userId, $_POST['stage'], 'نقل المهمة']);
        }

        auditLog('task_update', "تحديث مهمة #$taskId");
        jsonResponse(['success' => true]);

    case 'task_delete':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireRole(['admin','supervisor']);
        $taskId = (int)($_POST['id'] ?? 0);
        if ($taskId <= 0) jsonResponse(['error' => 'معرف مهمة غير صالح'], 400);
        $db->prepare("DELETE FROM tasks WHERE id=?")->execute([$taskId]);
        auditLog('task_delete', "حذف مهمة #$taskId");
        jsonResponse(['success' => true]);

    // =============================================
    // الموظفون
    // =============================================
    case 'employees_list':
        $dept = $_GET['department_id'] ?? null;
        // لا نُرجع password أو remember_token أبداً
        $sql = "SELECT u.id, u.full_name, u.email, u.phone, u.avatar_initials, u.avatar_color,
                       u.job_title, u.base_salary, u.allowances, u.hire_date, u.status,
                       u.is_online, u.last_activity, u.department_id, u.role_id,
                       u.annual_leave_balance, u.sick_leave_balance, u.emergency_leave_balance,
                       r.name_ar as role_ar, r.name as role_name, d.name as department_name
                FROM users u
                LEFT JOIN roles r ON u.role_id = r.id
                LEFT JOIN departments d ON u.department_id = d.id
                WHERE 1=1";
        $params = [];
        if ($dept) { $sql .= " AND u.department_id = ?"; $params[] = $dept; }
        $sql .= " ORDER BY u.full_name";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        // حماية إضافية: إخفاء الرواتب عن الموظف العادي
        $rows = $stmt->fetchAll();
        if ($roleN === 'employee') {
            foreach ($rows as &$r) {
                if ((int)$r['id'] !== (int)$userId) {
                    unset($r['base_salary'], $r['allowances']);
                }
            }
        }
        jsonResponse($rows);

    case 'employee_create':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireRole(['admin','supervisor']);

        $name  = clean($_POST['full_name'] ?? '');
        $email = clean($_POST['email'] ?? '');
        $pass  = password_hash($_POST['password'] ?? '123456', PASSWORD_BCRYPT);
        $phone = clean($_POST['phone'] ?? '');
        $dept  = $_POST['department_id'] ?? null;
        $role  = $_POST['role_id'] ?? 3;
        $job   = clean($_POST['job_title'] ?? '');
        $salary= $_POST['base_salary'] ?? 0;
        $allow = $_POST['allowances'] ?? 0;
        $hire  = $_POST['hire_date'] ?? date('Y-m-d');

        // الأحرف الأولى
        $parts = explode(' ', $name);
        $initials = '';
        foreach (array_slice($parts, 0, 2) as $p) $initials .= mb_substr($p, 0, 1);

        $stmt = $db->prepare("INSERT INTO users (full_name, email, password, phone, avatar_initials, department_id, role_id, job_title, base_salary, allowances, hire_date)
                              VALUES (?,?,?,?,?,?,?,?,?,?,?)");
        $stmt->execute([$name, $email, $pass, $phone, $initials, $dept, $role, $job, $salary, $allow, $hire]);

        auditLog('employee_create', "إضافة موظف: $name");
        jsonResponse(['success' => true, 'id' => $db->lastInsertId()]);

    case 'employee_update':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireRole(['admin','supervisor']);
        $empId  = (int)($_POST['id'] ?? 0);
        $fields = [];
        $params = [];

        foreach (['full_name','email','phone','department_id','role_id','job_title','base_salary','allowances','status'] as $f) {
            if (isset($_POST[$f])) {
                $fields[] = "$f = ?";
                $params[] = $_POST[$f];
            }
        }
        if (isset($_POST['password']) && !empty($_POST['password'])) {
            $fields[] = "password = ?";
            $params[] = password_hash($_POST['password'], PASSWORD_BCRYPT);
        }

        $params[] = $empId;
        $stmt = $db->prepare("UPDATE users SET " . implode(', ', $fields) . " WHERE id = ?");
        $stmt->execute($params);

        auditLog('employee_update', "تحديث موظف #$empId");
        jsonResponse(['success' => true]);

    case 'departments_list':
        $depts = $db->query("SELECT d.*, (SELECT COUNT(*) FROM users WHERE department_id = d.id AND status='active') as employee_count FROM departments d ORDER BY d.name")->fetchAll();
        jsonResponse($depts);

    case 'roles_list':
        jsonResponse($db->query("SELECT * FROM roles ORDER BY id")->fetchAll());

    // =============================================
    // الرواتب
    // =============================================
    case 'salaries_list':
        $month = $_GET['month'] ?? date('Y-m');
        $sql = "SELECT s.*, u.full_name, u.avatar_initials, u.avatar_color, u.job_title, d.name as department
                FROM salaries s
                JOIN users u ON s.user_id = u.id
                LEFT JOIN departments d ON u.department_id = d.id
                WHERE s.month = ?";
        $params = [$month];
        if ($roleN === 'employee') {
            $sql .= " AND s.user_id = ?";
            $params[] = $userId;
        }
        $sql .= " ORDER BY u.full_name";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        jsonResponse($stmt->fetchAll());

    case 'salary_generate':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireRole(['admin']);
        $month = $_POST['month'] ?? date('Y-m');

        $employees = $db->query("SELECT id, base_salary, allowances FROM users WHERE status='active'")->fetchAll();
        $count = 0;
        foreach ($employees as $emp) {
            // تحقق من عدم وجود كشف سابق
            $stmt = $db->prepare("SELECT id FROM salaries WHERE user_id=? AND month=?");
            $stmt->execute([$emp['id'], $month]);
            if ($stmt->fetch()) continue;

            $net = $emp['base_salary'] + $emp['allowances'];
            $stmt = $db->prepare("INSERT INTO salaries (user_id, month, base_salary, allowances, net_salary) VALUES (?,?,?,?,?)");
            $stmt->execute([$emp['id'], $month, $emp['base_salary'], $emp['allowances'], $net]);
            $count++;
        }
        auditLog('salary_generate', "توليد كشوفات شهر $month لـ $count موظف");
        jsonResponse(['success' => true, 'generated' => $count]);

    case 'salary_update':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireRole(['admin']);
        $id       = (int)($_POST['id'] ?? 0);
        $bonuses  = (float)($_POST['bonuses'] ?? 0);
        $deducts  = (float)($_POST['deductions'] ?? 0);
        $status   = $_POST['status'] ?? 'pending';

        $stmt = $db->prepare("SELECT base_salary, allowances FROM salaries WHERE id=?");
        $stmt->execute([$id]);
        $sal = $stmt->fetch();
        if (!$sal) jsonResponse(['error' => 'كشف غير موجود'], 404);

        $net = $sal['base_salary'] + $sal['allowances'] + $bonuses - $deducts;
        $paidAt = ($status === 'paid') ? date('Y-m-d H:i:s') : null;

        $stmt = $db->prepare("UPDATE salaries SET bonuses=?, deductions=?, net_salary=?, status=?, paid_at=? WHERE id=?");
        $stmt->execute([$bonuses, $deducts, $net, $status, $paidAt, $id]);

        auditLog('salary_update', "تحديث كشف راتب #$id");
        jsonResponse(['success' => true, 'net_salary' => $net]);

    // =============================================
    // التقييمات
    // =============================================
    case 'evaluations_list':
        $month = $_GET['month'] ?? date('Y-m');
        $sql = "SELECT e.*, u.full_name, u.avatar_initials, u.avatar_color, u.job_title,
                       ev.full_name as evaluator_name
                FROM evaluations e
                JOIN users u ON e.user_id = u.id
                LEFT JOIN users ev ON e.evaluator_id = ev.id
                WHERE e.month = ?";
        $params = [$month];
        if ($roleN === 'employee') { $sql .= " AND e.user_id = ?"; $params[] = $userId; }
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        jsonResponse($stmt->fetchAll());

    case 'evaluation_save':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireRole(['admin','supervisor']);

        $empId  = (int)($_POST['user_id'] ?? 0);
        $month  = $_POST['month'] ?? date('Y-m');
        $quality = (float)($_POST['work_quality'] ?? 0);
        $commit  = (float)($_POST['commitment'] ?? 0);
        $prod    = (float)($_POST['productivity'] ?? 0);
        $overall = round(($quality + $commit + $prod) / 3, 1);
        $notes   = clean($_POST['notes'] ?? '');

        // حفظ أو تحديث
        $stmt = $db->prepare("SELECT id FROM evaluations WHERE user_id=? AND month=?");
        $stmt->execute([$empId, $month]);
        $exists = $stmt->fetch();

        if ($exists) {
            $stmt = $db->prepare("UPDATE evaluations SET work_quality=?, commitment=?, productivity=?, overall_rating=?, notes=?, evaluator_id=? WHERE id=?");
            $stmt->execute([$quality, $commit, $prod, $overall, $notes, $userId, $exists['id']]);
        } else {
            $stmt = $db->prepare("INSERT INTO evaluations (user_id, evaluator_id, month, work_quality, commitment, productivity, overall_rating, notes)
                                  VALUES (?,?,?,?,?,?,?,?)");
            $stmt->execute([$empId, $userId, $month, $quality, $commit, $prod, $overall, $notes]);
        }

        createNotification($empId, 'تقييم جديد', "تم تقييم أدائك لشهر $month", 'evaluation');
        auditLog('evaluation_save', "تقييم موظف #$empId لشهر $month");
        jsonResponse(['success' => true, 'overall' => $overall]);

    // =============================================
    // الإجازات
    // =============================================
    case 'leaves_list':
        $sql = "SELECT l.*, u.full_name, u.avatar_initials, u.avatar_color,
                       ap.full_name as approved_by_name
                FROM leaves l
                JOIN users u ON l.user_id = u.id
                LEFT JOIN users ap ON l.approved_by = ap.id
                WHERE 1=1";
        $params = [];
        if ($roleN === 'employee') { $sql .= " AND l.user_id = ?"; $params[] = $userId; }
        if (isset($_GET['status'])) { $sql .= " AND l.status = ?"; $params[] = $_GET['status']; }
        $sql .= " ORDER BY l.created_at DESC";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        jsonResponse($stmt->fetchAll());

    case 'leave_request':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        $type   = $_POST['leave_type'] ?? 'annual';
        $start  = $_POST['start_date'] ?? '';
        $end    = $_POST['end_date'] ?? '';
        $reason = clean($_POST['reason'] ?? '');

        // قائمة بيضاء صارمة لمنع حقن SQL عبر اسم العمود
        $allowedTypes = ['annual','sick','emergency','unpaid'];
        if (!in_array($type, $allowedTypes, true)) {
            jsonResponse(['error' => 'نوع إجازة غير صالح'], 400);
        }

        if (empty($start) || empty($end)) jsonResponse(['error' => 'يرجى تحديد التواريخ'], 400);

        try {
            $d1 = new DateTime($start);
            $d2 = new DateTime($end);
        } catch (Exception $e) {
            jsonResponse(['error' => 'تاريخ غير صالح'], 400);
        }
        if ($d2 < $d1) jsonResponse(['error' => 'تاريخ النهاية قبل تاريخ البداية'], 400);
        $days = $d1->diff($d2)->days + 1;

        // تحقق من الرصيد — الآن اسم العمود من قائمة بيضاء مُتحقَّق منها
        if ($type !== 'unpaid') {
            $balField = $type . '_leave_balance';
            $stmt = $db->prepare("SELECT $balField FROM users WHERE id=?");
            $stmt->execute([$userId]);
            $balance = (int)$stmt->fetchColumn();
            if ($days > $balance) {
                jsonResponse(['error' => "رصيد الإجازات غير كافٍ (المتبقي: $balance يوم)"], 400);
            }
        }

        $stmt = $db->prepare("INSERT INTO leaves (user_id, leave_type, start_date, end_date, days, reason) VALUES (?,?,?,?,?,?)");
        $stmt->execute([$userId, $type, $start, $end, $days, $reason]);

        auditLog('leave_request', "طلب إجازة $type من $start إلى $end");
        jsonResponse(['success' => true, 'days' => $days]);

    case 'leave_action':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireRole(['admin','supervisor']);

        $leaveId = (int)($_POST['id'] ?? 0);
        $action  = $_POST['leave_action'] ?? ''; // approved / rejected

        // قائمة بيضاء لقيم الإجراء
        if (!in_array($action, ['approved','rejected'], true)) {
            jsonResponse(['error' => 'إجراء غير صالح'], 400);
        }

        $stmt = $db->prepare("SELECT * FROM leaves WHERE id=?");
        $stmt->execute([$leaveId]);
        $leave = $stmt->fetch();
        if (!$leave) jsonResponse(['error' => 'طلب غير موجود'], 404);

        $db->prepare("UPDATE leaves SET status=?, approved_by=?, approved_at=NOW() WHERE id=?")
           ->execute([$action, $userId, $leaveId]);

        // خصم الرصيد إذا تمت الموافقة — قائمة بيضاء صارمة لاسم العمود
        $allowedTypes = ['annual','sick','emergency'];
        if ($action === 'approved' && in_array($leave['leave_type'], $allowedTypes, true)) {
            $balField = $leave['leave_type'] . '_leave_balance';
            $db->prepare("UPDATE users SET $balField = GREATEST($balField - ?, 0) WHERE id=?")
               ->execute([$leave['days'], $leave['user_id']]);
        }

        $statusAr = $action === 'approved' ? 'الموافقة على' : 'رفض';
        createNotification($leave['user_id'], "طلب إجازة", "تم $statusAr طلب إجازتك", 'leave');
        auditLog('leave_action', "$statusAr إجازة #$leaveId");
        jsonResponse(['success' => true]);

    // =============================================
    // التقويم التحريري
    // =============================================
    case 'calendar_events':
        $month = $_GET['month'] ?? date('Y-m');
        // دمج المهام + الإجازات + مواعيد المشاريع
        $events = [];

        // المهام بمواعيد
        $stmt = $db->prepare("SELECT t.id, t.title, t.deadline as date, t.priority,
                              'task' as event_type, u.full_name as assignee
                              FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id
                              WHERE t.deadline LIKE ? AND t.status != 'cancelled'");
        $stmt->execute([$month . '%']);
        $events = array_merge($events, $stmt->fetchAll());

        // الإجازات المعتمدة
        $stmt = $db->prepare("SELECT l.id, CONCAT('إجازة: ', u.full_name) as title, l.start_date as date,
                              'low' as priority, 'leave' as event_type, u.full_name as assignee
                              FROM leaves l JOIN users u ON l.user_id = u.id
                              WHERE l.status = 'approved' AND l.start_date LIKE ?");
        $stmt->execute([$month . '%']);
        $events = array_merge($events, $stmt->fetchAll());

        // مواعيد المشاريع
        $stmt = $db->prepare("SELECT p.id, p.title, p.deadline as date, 'high' as priority,
                              'project' as event_type, c.name as assignee
                              FROM projects p JOIN clients c ON p.client_id = c.id
                              WHERE p.deadline LIKE ? AND p.status = 'active'");
        $stmt->execute([$month . '%']);
        $events = array_merge($events, $stmt->fetchAll());

        jsonResponse($events);

    // =============================================
    // الرسائل / القنوات
    // =============================================
    case 'channels_list':
        $channels = $db->prepare("
            SELECT c.*,
            (SELECT COUNT(*) FROM channel_members WHERE channel_id = c.id) as member_count,
            (SELECT content FROM messages WHERE channel_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
            (SELECT created_at FROM messages WHERE channel_id = c.id ORDER BY created_at DESC LIMIT 1) as last_msg_time
            FROM channels c
            INNER JOIN channel_members cm ON c.id = cm.channel_id AND cm.user_id = ?
            ORDER BY last_msg_time DESC
        ");
        $channels->execute([$userId]);
        jsonResponse($channels->fetchAll());

    case 'channel_messages':
        $channelId = (int)($_GET['channel_id'] ?? 0);
        $limit  = (int)($_GET['limit'] ?? 50);
        $offset = (int)($_GET['offset'] ?? 0);

        $stmt = $db->prepare("
            SELECT m.*, u.full_name, u.avatar_initials, u.avatar_color
            FROM messages m JOIN users u ON m.user_id = u.id
            WHERE m.channel_id = ?
            ORDER BY m.created_at ASC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute([$channelId, $limit, $offset]);
        jsonResponse($stmt->fetchAll());

    case 'message_send':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        $channelId = (int)($_POST['channel_id'] ?? 0);
        $content   = clean($_POST['content'] ?? '');
        $mentions  = $_POST['mentions'] ?? '[]';

        if (empty($content)) jsonResponse(['error' => 'الرسالة فارغة'], 400);

        $stmt = $db->prepare("INSERT INTO messages (channel_id, user_id, content, mentions) VALUES (?,?,?,?)");
        $stmt->execute([$channelId, $userId, $content, $mentions]);

        // إشعار المذكورين
        $mentionList = json_decode($mentions, true);
        if (is_array($mentionList)) {
            foreach ($mentionList as $mId) {
                createNotification($mId, 'ذُكرت في رسالة', mb_substr($content, 0, 100), 'message', '#messages');
            }
        }

        jsonResponse(['success' => true, 'id' => $db->lastInsertId()]);

    case 'message_react':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        $msgId = (int)($_POST['message_id'] ?? 0);
        $emoji = $_POST['emoji'] ?? '👍';

        $stmt = $db->prepare("SELECT reactions FROM messages WHERE id=?");
        $stmt->execute([$msgId]);
        $msg = $stmt->fetch();
        $reactions = json_decode($msg['reactions'] ?? '{}', true) ?: [];
        if (!isset($reactions[$emoji])) $reactions[$emoji] = [];

        if (in_array($userId, $reactions[$emoji])) {
            $reactions[$emoji] = array_values(array_diff($reactions[$emoji], [$userId]));
            if (empty($reactions[$emoji])) unset($reactions[$emoji]);
        } else {
            $reactions[$emoji][] = $userId;
        }

        $db->prepare("UPDATE messages SET reactions=? WHERE id=?")->execute([json_encode($reactions), $msgId]);
        jsonResponse(['success' => true, 'reactions' => $reactions]);

    case 'channel_create':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        $name = clean($_POST['name'] ?? '');
        $desc = clean($_POST['description'] ?? '');
        if (empty($name)) jsonResponse(['error' => 'اسم القناة مطلوب'], 400);

        $stmt = $db->prepare("INSERT INTO channels (name, description, created_by) VALUES (?,?,?)");
        $stmt->execute([$name, $desc, $userId]);
        $chId = $db->lastInsertId();

        // إضافة المنشئ كعضو
        $db->prepare("INSERT INTO channel_members (channel_id, user_id) VALUES (?,?)")->execute([$chId, $userId]);

        jsonResponse(['success' => true, 'id' => $chId]);

    // =============================================
    // العملاء والمشاريع
    // =============================================
    case 'clients_list':
        $clients = $db->query("
            SELECT c.*,
            (SELECT COUNT(*) FROM projects WHERE client_id = c.id) as project_count,
            (SELECT COALESCE(SUM(amount),0) FROM invoices WHERE client_id = c.id AND status='paid') as total_paid,
            (SELECT COALESCE(SUM(amount),0) FROM invoices WHERE client_id = c.id AND status='pending') as total_pending
            FROM clients c ORDER BY c.name
        ")->fetchAll();
        jsonResponse($clients);

    case 'client_save':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        $id   = (int)($_POST['id'] ?? 0);
        $name = clean($_POST['name'] ?? '');
        $desc = clean($_POST['description'] ?? '');
        $emoji = $_POST['logo_emoji'] ?? '🏢';
        $contact_name  = clean($_POST['contact_name'] ?? '');
        $contact_email = clean($_POST['contact_email'] ?? '');
        $contact_phone = clean($_POST['contact_phone'] ?? '');

        if ($id > 0) {
            $stmt = $db->prepare("UPDATE clients SET name=?, description=?, logo_emoji=?, contact_name=?, contact_email=?, contact_phone=? WHERE id=?");
            $stmt->execute([$name, $desc, $emoji, $contact_name, $contact_email, $contact_phone, $id]);
        } else {
            $stmt = $db->prepare("INSERT INTO clients (name, description, logo_emoji, contact_name, contact_email, contact_phone) VALUES (?,?,?,?,?,?)");
            $stmt->execute([$name, $desc, $emoji, $contact_name, $contact_email, $contact_phone]);
            $id = $db->lastInsertId();
        }
        auditLog('client_save', "حفظ عميل: $name");
        jsonResponse(['success' => true, 'id' => $id]);

    case 'projects_list':
        $clientId = $_GET['client_id'] ?? null;
        $sql = "SELECT p.*, c.name as client_name, c.logo_emoji
                FROM projects p JOIN clients c ON p.client_id = c.id WHERE 1=1";
        $params = [];
        if ($clientId) { $sql .= " AND p.client_id=?"; $params[] = $clientId; }
        $sql .= " ORDER BY p.deadline ASC";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        jsonResponse($stmt->fetchAll());

    case 'project_save':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        $id       = (int)($_POST['id'] ?? 0);
        $clientId = (int)($_POST['client_id'] ?? 0);
        $title    = clean($_POST['title'] ?? '');
        $desc     = clean($_POST['description'] ?? '');
        $progress = (int)($_POST['progress'] ?? 0);
        $deadline = $_POST['deadline'] ?? null;
        $budget   = (float)($_POST['budget'] ?? 0);
        $status   = $_POST['status'] ?? 'active';

        if ($id > 0) {
            $stmt = $db->prepare("UPDATE projects SET client_id=?, title=?, description=?, progress=?, deadline=?, budget=?, status=? WHERE id=?");
            $stmt->execute([$clientId, $title, $desc, $progress, $deadline, $budget, $status, $id]);
        } else {
            $stmt = $db->prepare("INSERT INTO projects (client_id, title, description, progress, deadline, budget, status) VALUES (?,?,?,?,?,?,?)");
            $stmt->execute([$clientId, $title, $desc, $progress, $deadline, $budget, $status]);
            $id = $db->lastInsertId();
        }
        auditLog('project_save', "حفظ مشروع: $title");
        jsonResponse(['success' => true, 'id' => $id]);

    case 'invoices_list':
        $clientId = $_GET['client_id'] ?? null;
        $sql = "SELECT i.*, c.name as client_name, p.title as project_title
                FROM invoices i
                JOIN clients c ON i.client_id = c.id
                LEFT JOIN projects p ON i.project_id = p.id WHERE 1=1";
        $params = [];
        if ($clientId) { $sql .= " AND i.client_id=?"; $params[] = $clientId; }
        $sql .= " ORDER BY i.due_date DESC";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        jsonResponse($stmt->fetchAll());

    case 'invoice_save':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        $id        = (int)($_POST['id'] ?? 0);
        $clientId  = (int)($_POST['client_id'] ?? 0);
        $projectId = $_POST['project_id'] ?? null;
        $amount    = (float)($_POST['amount'] ?? 0);
        $dueDate   = $_POST['due_date'] ?? null;
        $status    = $_POST['status'] ?? 'pending';
        $paidAt    = ($status === 'paid') ? date('Y-m-d H:i:s') : null;

        if ($id > 0) {
            $stmt = $db->prepare("UPDATE invoices SET client_id=?, project_id=?, amount=?, due_date=?, status=?, paid_at=? WHERE id=?");
            $stmt->execute([$clientId, $projectId, $amount, $dueDate, $status, $paidAt, $id]);
        } else {
            $stmt = $db->prepare("INSERT INTO invoices (client_id, project_id, amount, due_date, status, paid_at) VALUES (?,?,?,?,?,?)");
            $stmt->execute([$clientId, $projectId, $amount, $dueDate, $status, $paidAt]);
            $id = $db->lastInsertId();
        }
        jsonResponse(['success' => true, 'id' => $id]);

    // =============================================
    // تتبع الوقت
    // =============================================
    case 'timer_start':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        $taskId = $_POST['task_id'] ?? null;
        $desc   = clean($_POST['description'] ?? '');

        // إيقاف أي مؤقت قيد التشغيل
        $db->prepare("UPDATE time_entries SET is_running=0, end_time=NOW(), duration_seconds=TIMESTAMPDIFF(SECOND, start_time, NOW()) WHERE user_id=? AND is_running=1")
           ->execute([$userId]);

        $stmt = $db->prepare("INSERT INTO time_entries (user_id, task_id, start_time, description, is_running, date) VALUES (?,?,NOW(),?,1,CURDATE())");
        $stmt->execute([$userId, $taskId, $desc]);
        jsonResponse(['success' => true, 'id' => $db->lastInsertId()]);

    case 'timer_stop':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        $stmt = $db->prepare("UPDATE time_entries SET is_running=0, end_time=NOW(), duration_seconds=TIMESTAMPDIFF(SECOND, start_time, NOW()) WHERE user_id=? AND is_running=1");
        $stmt->execute([$userId]);
        jsonResponse(['success' => true]);

    case 'time_entries_list':
        $date = $_GET['date'] ?? date('Y-m-d');
        $uid  = $_GET['user_id'] ?? $userId;
        if ($roleN === 'employee') $uid = $userId;

        $stmt = $db->prepare("
            SELECT te.*, t.title as task_title
            FROM time_entries te
            LEFT JOIN tasks t ON te.task_id = t.id
            WHERE te.user_id = ? AND te.date = ?
            ORDER BY te.start_time DESC
        ");
        $stmt->execute([$uid, $date]);
        jsonResponse($stmt->fetchAll());

    case 'timer_running':
        $stmt = $db->prepare("SELECT te.*, t.title as task_title FROM time_entries te LEFT JOIN tasks t ON te.task_id = t.id WHERE te.user_id=? AND te.is_running=1");
        $stmt->execute([$userId]);
        jsonResponse($stmt->fetch() ?: ['running' => false]);

    // =============================================
    // مكتبة الوسائط
    // =============================================
    case 'media_list':
        $type = $_GET['type'] ?? null;
        $sql  = "SELECT mf.*, u.full_name as uploader FROM media_files mf LEFT JOIN users u ON mf.uploaded_by = u.id WHERE 1=1";
        $params = [];
        if ($type) { $sql .= " AND mf.file_type=?"; $params[] = $type; }
        $sql .= " ORDER BY mf.created_at DESC";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $files = $stmt->fetchAll();
        foreach ($files as &$f) $f['file_size_formatted'] = formatFileSize($f['file_size']);
        jsonResponse($files);

    case 'media_upload':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        if (empty($_FILES['file'])) jsonResponse(['error' => 'لا يوجد ملف'], 400);

        $result = uploadFile($_FILES['file'], 'media');
        if (isset($result['error'])) jsonResponse(['error' => $result['error']], 400);

        $tags = $_POST['tags'] ?? '[]';
        $stmt = $db->prepare("INSERT INTO media_files (filename, original_name, file_type, file_size, mime_type, file_path, tags, uploaded_by) VALUES (?,?,?,?,?,?,?,?)");
        $stmt->execute([$result['filename'], $result['original_name'], $result['file_type'], $result['file_size'], $result['mime_type'], $result['file_path'], $tags, $userId]);

        auditLog('media_upload', "رفع ملف: " . $result['original_name']);
        jsonResponse(['success' => true, 'id' => $db->lastInsertId(), 'file' => $result]);

    case 'media_delete':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireRole(['admin','supervisor']);
        $id = (int)($_POST['id'] ?? 0);
        if ($id <= 0) jsonResponse(['error' => 'معرف ملف غير صالح'], 400);
        $stmt = $db->prepare("SELECT file_path FROM media_files WHERE id=?");
        $stmt->execute([$id]);
        $file = $stmt->fetch();
        if ($file && file_exists(UPLOAD_DIR . $file['file_path'])) {
            unlink(UPLOAD_DIR . $file['file_path']);
        }
        $db->prepare("DELETE FROM media_files WHERE id=?")->execute([$id]);
        auditLog('media_delete', "حذف ملف وسائط #$id");
        jsonResponse(['success' => true]);

    // =============================================
    // قاعدة المعرفة
    // =============================================
    case 'knowledge_list':
        $category = $_GET['category'] ?? null;
        $sql = "SELECT ka.*, u.full_name as author FROM knowledge_articles ka LEFT JOIN users u ON ka.author_id = u.id WHERE ka.status='published'";
        $params = [];
        if ($category) { $sql .= " AND ka.category=?"; $params[] = $category; }
        $sql .= " ORDER BY ka.created_at DESC";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        jsonResponse($stmt->fetchAll());

    case 'knowledge_save':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        $id       = (int)($_POST['id'] ?? 0);
        $title    = clean($_POST['title'] ?? '');
        $content  = $_POST['content'] ?? '';
        $category = clean($_POST['category'] ?? '');
        $tags     = $_POST['tags'] ?? '[]';

        if ($id > 0) {
            $stmt = $db->prepare("UPDATE knowledge_articles SET title=?, content=?, category=?, tags=? WHERE id=?");
            $stmt->execute([$title, $content, $category, $tags, $id]);
        } else {
            $stmt = $db->prepare("INSERT INTO knowledge_articles (title, content, category, tags, author_id) VALUES (?,?,?,?,?)");
            $stmt->execute([$title, $content, $category, $tags, $userId]);
            $id = $db->lastInsertId();
        }
        auditLog('knowledge_save', "حفظ مقال: $title");
        jsonResponse(['success' => true, 'id' => $id]);

    // =============================================
    // الإشعارات
    // =============================================
    case 'notifications_list':
        $stmt = $db->prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 30");
        $stmt->execute([$userId]);
        jsonResponse($stmt->fetchAll());

    case 'notifications_read':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        $notifId = $_POST['id'] ?? null;
        if ($notifId) {
            $db->prepare("UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?")->execute([$notifId, $userId]);
        } else {
            $db->prepare("UPDATE notifications SET is_read=1 WHERE user_id=?")->execute([$userId]);
        }
        jsonResponse(['success' => true]);

    case 'notifications_count':
        $stmt = $db->prepare("SELECT COUNT(*) FROM notifications WHERE user_id=? AND is_read=0");
        $stmt->execute([$userId]);
        jsonResponse(['count' => $stmt->fetchColumn()]);

    // =============================================
    // التقارير
    // =============================================
    case 'reports_attendance':
        $month = $_GET['month'] ?? date('Y-m');
        $stmt = $db->prepare("
            SELECT u.full_name, u.department_id, d.name as department,
                   COUNT(CASE WHEN a.status='present' THEN 1 END) as present_days,
                   COUNT(CASE WHEN a.status='late' THEN 1 END) as late_days,
                   COUNT(CASE WHEN a.status='absent' THEN 1 END) as absent_days,
                   ROUND(AVG(a.total_hours),1) as avg_hours,
                   SUM(a.idle_minutes) as total_idle
            FROM users u
            LEFT JOIN attendance a ON u.id = a.user_id AND a.date LIKE ?
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE u.status='active'
            GROUP BY u.id
            ORDER BY present_days DESC
        ");
        $stmt->execute([$month . '%']);
        jsonResponse($stmt->fetchAll());

    case 'reports_tasks':
        $stmt = $db->query("
            SELECT u.full_name,
                   COUNT(t.id) as total_tasks,
                   COUNT(CASE WHEN t.status='completed' THEN 1 END) as completed,
                   COUNT(CASE WHEN t.status='in_progress' THEN 1 END) as in_progress,
                   COUNT(CASE WHEN t.deadline < CURDATE() AND t.status!='completed' THEN 1 END) as overdue,
                   ROUND(AVG(t.progress),0) as avg_progress
            FROM users u
            LEFT JOIN tasks t ON u.id = t.assigned_to
            WHERE u.status='active'
            GROUP BY u.id
            ORDER BY completed DESC
        ");
        jsonResponse($stmt->fetchAll());

    case 'reports_financial':
        $year = $_GET['year'] ?? date('Y');
        $stmt = $db->prepare("
            SELECT month,
                   SUM(base_salary) as total_base,
                   SUM(allowances) as total_allowances,
                   SUM(bonuses) as total_bonuses,
                   SUM(deductions) as total_deductions,
                   SUM(net_salary) as total_net
            FROM salaries WHERE month LIKE ?
            GROUP BY month ORDER BY month
        ");
        $stmt->execute([$year . '%']);
        jsonResponse($stmt->fetchAll());

    // =============================================
    // الإعدادات
    // =============================================
    case 'settings_get':
        $settings = $db->query("SELECT setting_key, setting_value FROM settings")->fetchAll();
        $map = [];
        foreach ($settings as $s) $map[$s['setting_key']] = $s['setting_value'];
        jsonResponse($map);

    case 'settings_save':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireRole(['admin']);
        foreach ($_POST as $key => $value) {
            if ($key === 'action') continue;
            saveSetting(clean($key), clean($value));
        }
        auditLog('settings_save', 'تحديث إعدادات النظام');
        jsonResponse(['success' => true]);

    // =============================================
    // مراقبة النشر على المنصات
    // =============================================

    // ===== قائمة المنصات مع حالة النشر =====
    case 'platforms_list':
        $filter = $_GET['filter'] ?? 'all'; // all, active, idle, stopped
        $type = $_GET['type'] ?? '';
        $idleMinutes = (int)getSetting('publish_idle_minutes', 15);

        $sql = "SELECT p.*, u.full_name AS assigned_name,
                    TIMESTAMPDIFF(MINUTE, p.last_publish_at, NOW()) AS minutes_since_publish,
                    (SELECT COUNT(*) FROM publish_logs pl WHERE pl.platform_id = p.id AND DATE(pl.published_at) = CURDATE()) AS today_posts
                FROM platforms p
                LEFT JOIN users u ON p.assigned_to = u.id
                WHERE p.status != 'archived'";

        if ($type) $sql .= " AND p.platform_type = " . $db->quote($type);

        if ($filter === 'idle') {
            $sql .= " AND TIMESTAMPDIFF(MINUTE, p.last_publish_at, NOW()) >= " . $idleMinutes;
        } elseif ($filter === 'active') {
            $sql .= " AND TIMESTAMPDIFF(MINUTE, p.last_publish_at, NOW()) < " . $idleMinutes;
        }

        $sql .= " ORDER BY p.last_publish_at ASC";
        $platforms = $db->query($sql)->fetchAll();

        // إضافة حالة كل منصة
        foreach ($platforms as &$p) {
            $mins = (int)$p['minutes_since_publish'];
            $threshold = (int)$p['idle_threshold'];
            if ($p['status'] === 'paused') {
                $p['publish_status'] = 'paused';
            } elseif ($mins < $threshold) {
                $p['publish_status'] = 'active';
            } elseif ($mins < $threshold * 2) {
                $p['publish_status'] = 'idle';
            } else {
                $p['publish_status'] = 'stopped';
            }
        }
        unset($p);

        // إحصائيات سريعة
        $stats = [
            'total' => count($platforms),
            'active' => count(array_filter($platforms, function($p) { return $p['publish_status'] === 'active'; })),
            'idle' => count(array_filter($platforms, function($p) { return $p['publish_status'] === 'idle'; })),
            'stopped' => count(array_filter($platforms, function($p) { return $p['publish_status'] === 'stopped'; })),
            'paused' => count(array_filter($platforms, function($p) { return $p['publish_status'] === 'paused'; })),
            'today_total_posts' => array_sum(array_column($platforms, 'today_posts'))
        ];

        jsonResponse(['platforms' => $platforms, 'stats' => $stats]);

    // ===== إضافة/تعديل منصة =====
    case 'platform_save':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireRole(['admin', 'supervisor']);

        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $id = (int)($input['id'] ?? 0);
        $name = clean($input['name'] ?? '');
        $type = clean($input['platform_type'] ?? '');
        $icon = $input['icon'] ?? '📱';
        $url = clean($input['account_url'] ?? '');
        $assignedTo = (int)($input['assigned_to'] ?? 0) ?: null;
        $threshold = (int)($input['idle_threshold'] ?? 15);
        $status = $input['status'] ?? 'active';
        $lastPublish = !empty($input['last_publish_at']) ? str_replace('T', ' ', $input['last_publish_at']) . ':00' : null;

        if (empty($name) || empty($type)) {
            jsonResponse(['error' => 'اسم المنصة ونوعها مطلوبان'], 400);
        }

        if ($id > 0) {
            if ($lastPublish) {
                $stmt = $db->prepare("UPDATE platforms SET name=?, platform_type=?, icon=?, account_url=?, assigned_to=?, idle_threshold=?, status=?, last_publish_at=? WHERE id=?");
                $stmt->execute([$name, $type, $icon, $url, $assignedTo, $threshold, $status, $lastPublish, $id]);
            } else {
                $stmt = $db->prepare("UPDATE platforms SET name=?, platform_type=?, icon=?, account_url=?, assigned_to=?, idle_threshold=?, status=? WHERE id=?");
                $stmt->execute([$name, $type, $icon, $url, $assignedTo, $threshold, $status, $id]);
            }
            auditLog('platform_update', "تعديل منصة: $name");
        } else {
            $publishAt = $lastPublish ? $lastPublish : date('Y-m-d H:i:s');
            $stmt = $db->prepare("INSERT INTO platforms (name, platform_type, icon, account_url, assigned_to, idle_threshold, status, last_publish_at) VALUES (?,?,?,?,?,?,?,?)");
            $stmt->execute([$name, $type, $icon, $url, $assignedTo, $threshold, $status, $publishAt]);
            $id = $db->lastInsertId();
            auditLog('platform_create', "إضافة منصة جديدة: $name");
        }
        jsonResponse(['success' => true, 'id' => $id]);

    // ===== حذف منصة =====
    case 'platform_delete':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        requireRole(['admin']);
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $id = (int)($input['id'] ?? 0);
        $db->prepare("DELETE FROM platforms WHERE id=?")->execute([$id]);
        auditLog('platform_delete', "حذف منصة رقم: $id");
        jsonResponse(['success' => true]);

    // ===== تسجيل نشر جديد =====
    case 'publish_log':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $platformId = (int)($input['platform_id'] ?? 0);
        $title = clean($input['content_title'] ?? '');
        $contentType = $input['content_type'] ?? 'post';
        $notes = clean($input['notes'] ?? '');

        if (!$platformId) {
            jsonResponse(['error' => 'يرجى اختيار المنصة'], 400);
        }

        $stmt = $db->prepare("INSERT INTO publish_logs (platform_id, user_id, content_title, content_type, notes, published_at) VALUES (?,?,?,?,?,NOW())");
        $stmt->execute([$platformId, $userId, $title, $contentType, $notes]);

        // تحديث وقت آخر نشر في المنصة
        $db->prepare("UPDATE platforms SET last_publish_at = NOW() WHERE id=?")->execute([$platformId]);

        auditLog('publish_log', "تسجيل نشر على المنصة رقم: $platformId - $title");
        jsonResponse(['success' => true]);

    // ===== سجل النشر لمنصة معينة =====
    case 'publish_history':
        $platformId = (int)($_GET['platform_id'] ?? 0);
        $date = $_GET['date'] ?? date('Y-m-d');

        $sql = "SELECT pl.*, u.full_name AS publisher_name, p.name AS platform_name
                FROM publish_logs pl
                LEFT JOIN users u ON pl.user_id = u.id
                LEFT JOIN platforms p ON pl.platform_id = p.id";
        $params = [];

        if ($platformId) {
            $sql .= " WHERE pl.platform_id = ?";
            $params[] = $platformId;
            if ($date) {
                $sql .= " AND DATE(pl.published_at) = ?";
                $params[] = $date;
            }
        } else {
            if ($date) {
                $sql .= " WHERE DATE(pl.published_at) = ?";
                $params[] = $date;
            }
        }
        $sql .= " ORDER BY pl.published_at DESC LIMIT 100";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        jsonResponse(['data' => $stmt->fetchAll()]);

    // ===== المنصات المتوقفة (للإشعارات) =====
    case 'platforms_alerts':
        $idleMinutes = (int)getSetting('publish_idle_minutes', 15);
        $stmt = $db->query("SELECT p.*, u.full_name AS assigned_name,
                    TIMESTAMPDIFF(MINUTE, p.last_publish_at, NOW()) AS minutes_since_publish
                FROM platforms p
                LEFT JOIN users u ON p.assigned_to = u.id
                WHERE p.status = 'active'
                    AND TIMESTAMPDIFF(MINUTE, p.last_publish_at, NOW()) >= p.idle_threshold
                ORDER BY minutes_since_publish DESC");
        jsonResponse(['alerts' => $stmt->fetchAll()]);

    // ===== تقرير التوقف اليومي =====
    case 'idle_report':
        $date = $_GET['date'] ?? date('Y-m-d');
        $platformId = (int)($_GET['platform_id'] ?? 0);

        $sql = "SELECT il.*, p.name AS platform_name, p.platform_type, p.icon, p.idle_threshold,
                       u.full_name AS assigned_name
                FROM idle_logs il
                JOIN platforms p ON il.platform_id = p.id
                LEFT JOIN users u ON p.assigned_to = u.id
                WHERE il.date = ?";
        $params = [$date];

        if ($platformId) {
            $sql .= " AND il.platform_id = ?";
            $params[] = $platformId;
        }
        $sql .= " ORDER BY il.started_at DESC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $logs = $stmt->fetchAll();

        // ملخص لكل منصة
        $sql2 = "SELECT p.id, p.name, p.platform_type, p.icon, u.full_name AS assigned_name,
                    COUNT(il.id) AS idle_count,
                    COALESCE(SUM(il.duration_minutes), 0) AS total_idle_minutes,
                    MAX(il.duration_minutes) AS max_idle_minutes
                 FROM platforms p
                 LEFT JOIN idle_logs il ON p.id = il.platform_id AND il.date = ?
                 LEFT JOIN users u ON p.assigned_to = u.id
                 WHERE p.status = 'active'
                 GROUP BY p.id
                 ORDER BY total_idle_minutes DESC";
        $stmt2 = $db->prepare($sql2);
        $stmt2->execute([$date]);
        $summary = $stmt2->fetchAll();

        // إحصائيات عامة
        $totalPlatforms = count($summary);
        $platformsWithIdle = count(array_filter($summary, function($s) { return $s['idle_count'] > 0; }));
        $totalIdleEvents = array_sum(array_column($summary, 'idle_count'));
        $totalIdleMinutes = array_sum(array_column($summary, 'total_idle_minutes'));

        jsonResponse([
            'logs' => $logs,
            'summary' => $summary,
            'stats' => [
                'date' => $date,
                'total_platforms' => $totalPlatforms,
                'platforms_with_idle' => $platformsWithIdle,
                'total_idle_events' => $totalIdleEvents,
                'total_idle_minutes' => $totalIdleMinutes,
                'compliance_rate' => $totalPlatforms > 0 ? round((($totalPlatforms - $platformsWithIdle) / $totalPlatforms) * 100) : 100
            ]
        ]);

    // ===== تقرير أسبوعي/شهري =====
    case 'idle_report_range':
        $from = $_GET['from'] ?? date('Y-m-d', strtotime('-7 days'));
        $to = $_GET['to'] ?? date('Y-m-d');

        $stmt = $db->prepare("SELECT p.id, p.name, p.platform_type, p.icon, u.full_name AS assigned_name,
                    COUNT(il.id) AS idle_count,
                    COALESCE(SUM(il.duration_minutes), 0) AS total_idle_minutes,
                    MAX(il.duration_minutes) AS max_idle_minutes,
                    ROUND(AVG(il.duration_minutes), 0) AS avg_idle_minutes
                 FROM platforms p
                 LEFT JOIN idle_logs il ON p.id = il.platform_id AND il.date BETWEEN ? AND ?
                 LEFT JOIN users u ON p.assigned_to = u.id
                 WHERE p.status = 'active'
                 GROUP BY p.id
                 ORDER BY total_idle_minutes DESC");
        $stmt->execute([$from, $to]);
        jsonResponse(['data' => $stmt->fetchAll(), 'from' => $from, 'to' => $to]);

    // ===== حالة المراقبة =====
    case 'monitor_status':
        $logFile = __DIR__ . '/monitor_log.txt';
        $lastLines = [];
        if (file_exists($logFile)) {
            $lines = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            $lastLines = array_slice($lines, -20);
        }
        $lastRun = '';
        foreach (array_reverse($lastLines) as $line) {
            if (strpos($line, 'بدء المراقبة') !== false) {
                preg_match('/\[(.*?)\]/', $line, $m);
                $lastRun = $m[1] ?? '';
                break;
            }
        }
        jsonResponse([
            'last_run' => $lastRun,
            'log' => $lastLines,
            'is_active' => !empty($lastRun) && (time() - strtotime($lastRun)) < 600
        ]);

    // ===== سجل التدقيق =====
    case 'audit_log':
        requireRole(['admin']);
        $limit = (int)($_GET['limit'] ?? 100);
        $stmt = $db->prepare("SELECT a.*, u.full_name FROM audit_log a LEFT JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC LIMIT ?");
        $stmt->execute([$limit]);
        jsonResponse($stmt->fetchAll());

    // ===== تسجيل الخروج =====
    case 'logout':
        $db->prepare("UPDATE users SET is_online=0 WHERE id=?")->execute([$userId]);
        auditLog('logout', 'تسجيل خروج');
        session_destroy();
        jsonResponse(['success' => true]);

    // ===== الحالة الافتراضية =====
    default:
        jsonResponse(['error' => 'إجراء غير معروف: ' . $action], 404);
}
