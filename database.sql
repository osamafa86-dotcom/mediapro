-- =============================================
-- ميديا برو — قاعدة البيانات
-- نظام إدارة الشركة الإعلامية
-- =============================================

CREATE DATABASE IF NOT EXISTS mediapro_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mediapro_db;

-- ===== جدول الأقسام =====
CREATE TABLE departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    manager_id INT NULL,
    employee_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ===== جدول الأدوار =====
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    name_ar VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ===== جدول المستخدمين/الموظفين =====
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    avatar_initials VARCHAR(10),
    avatar_color VARCHAR(100) DEFAULT 'linear-gradient(135deg,#4f46e5,#7c3aed)',
    department_id INT,
    role_id INT DEFAULT 3,
    job_title VARCHAR(100),
    base_salary DECIMAL(10,2) DEFAULT 0,
    allowances DECIMAL(10,2) DEFAULT 0,
    hire_date DATE,
    status ENUM('active','inactive','suspended') DEFAULT 'active',
    is_online TINYINT(1) DEFAULT 0,
    last_activity DATETIME,
    device_fingerprint VARCHAR(255),
    allowed_ips TEXT,
    annual_leave_balance INT DEFAULT 30,
    sick_leave_balance INT DEFAULT 12,
    emergency_leave_balance INT DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ===== جدول الحضور =====
CREATE TABLE attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    check_in DATETIME,
    check_out DATETIME,
    total_hours DECIMAL(5,2),
    status ENUM('present','late','absent','leave') DEFAULT 'present',
    ip_address VARCHAR(45),
    device_info VARCHAR(255),
    location_lat DECIMAL(10,8),
    location_lng DECIMAL(11,8),
    security_status ENUM('verified','warning','rejected') DEFAULT 'verified',
    security_notes TEXT,
    idle_minutes INT DEFAULT 0,
    activity_status ENUM('active','idle','danger') DEFAULT 'active',
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_date (user_id, date),
    INDEX idx_date (date)
) ENGINE=InnoDB;

-- ===== جدول المهام =====
CREATE TABLE tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assigned_to INT,
    created_by INT,
    department_id INT,
    stage ENUM('content_prep','design_production','review','publishing') DEFAULT 'content_prep',
    priority ENUM('low','medium','high','urgent') DEFAULT 'medium',
    progress INT DEFAULT 0,
    task_type VARCHAR(50),
    deadline DATE,
    completed_at DATETIME,
    status ENUM('pending','in_progress','review','completed','cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    INDEX idx_stage (stage),
    INDEX idx_assigned (assigned_to)
) ENGINE=InnoDB;

-- ===== جدول حركة المهام (سير العمل) =====
CREATE TABLE task_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    from_user INT,
    to_user INT,
    from_stage VARCHAR(50),
    to_stage VARCHAR(50),
    action VARCHAR(100),
    notes TEXT,
    attachments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (from_user) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (to_user) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ===== جدول تتبع الوقت =====
CREATE TABLE time_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    task_id INT,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    duration_seconds INT DEFAULT 0,
    description VARCHAR(255),
    is_running TINYINT(1) DEFAULT 0,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
    INDEX idx_user_date (user_id, date)
) ENGINE=InnoDB;

-- ===== جدول الرواتب =====
CREATE TABLE salaries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    month VARCHAR(7) NOT NULL,
    base_salary DECIMAL(10,2),
    allowances DECIMAL(10,2) DEFAULT 0,
    bonuses DECIMAL(10,2) DEFAULT 0,
    deductions DECIMAL(10,2) DEFAULT 0,
    net_salary DECIMAL(10,2),
    status ENUM('pending','approved','paid') DEFAULT 'pending',
    paid_at DATETIME,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_month (user_id, month)
) ENGINE=InnoDB;

-- ===== جدول التقييمات =====
CREATE TABLE evaluations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    evaluator_id INT,
    month VARCHAR(7) NOT NULL,
    work_quality DECIMAL(2,1) DEFAULT 0,
    commitment DECIMAL(2,1) DEFAULT 0,
    productivity DECIMAL(2,1) DEFAULT 0,
    overall_rating DECIMAL(2,1) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (evaluator_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ===== جدول الإجازات =====
CREATE TABLE leaves (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    leave_type ENUM('annual','sick','emergency','unpaid') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days INT NOT NULL,
    reason TEXT,
    status ENUM('pending','approved','rejected') DEFAULT 'pending',
    approved_by INT,
    approved_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ===== جدول الرسائل/القنوات =====
CREATE TABLE channels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_direct TINYINT(1) DEFAULT 0,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE channel_members (
    channel_id INT,
    user_id INT,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (channel_id, user_id),
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    channel_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    mentions JSON,
    attachments JSON,
    reactions JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_channel (channel_id)
) ENGINE=InnoDB;

-- ===== جدول العملاء =====
CREATE TABLE clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    logo_emoji VARCHAR(10) DEFAULT '🏢',
    logo_color VARCHAR(100),
    contact_name VARCHAR(100),
    contact_email VARCHAR(150),
    contact_phone VARCHAR(20),
    satisfaction_rate INT DEFAULT 0,
    status ENUM('active','inactive','archived') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ===== جدول مشاريع العملاء =====
CREATE TABLE projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    progress INT DEFAULT 0,
    deadline DATE,
    budget DECIMAL(10,2) DEFAULT 0,
    status ENUM('active','completed','on_hold','cancelled') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ===== جدول الفواتير =====
CREATE TABLE invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    project_id INT,
    amount DECIMAL(10,2) NOT NULL,
    due_date DATE,
    status ENUM('paid','pending','overdue') DEFAULT 'pending',
    paid_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ===== جدول مكتبة الوسائط =====
CREATE TABLE media_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),
    file_type ENUM('image','video','design','document') NOT NULL,
    file_size BIGINT DEFAULT 0,
    mime_type VARCHAR(100),
    file_path VARCHAR(500),
    tags JSON,
    uploaded_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_type (file_type)
) ENGINE=InnoDB;

-- ===== جدول قاعدة المعرفة =====
CREATE TABLE knowledge_articles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content LONGTEXT,
    category VARCHAR(100),
    tags JSON,
    author_id INT,
    status ENUM('draft','published','archived') DEFAULT 'published',
    views INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ===== جدول سجل التدقيق =====
CREATE TABLE audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- ===== جدول الإشعارات =====
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255),
    message TEXT,
    type VARCHAR(50),
    is_read TINYINT(1) DEFAULT 0,
    link VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_read (user_id, is_read)
) ENGINE=InnoDB;

-- ===== جدول إعدادات النظام =====
CREATE TABLE settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================
-- البيانات الافتراضية
-- =============================================

-- الأقسام
INSERT INTO departments (name, description) VALUES
('التحرير', 'قسم التحرير وكتابة المحتوى'),
('التصوير', 'قسم التصوير الفوتوغرافي والفيديو'),
('المونتاج', 'قسم المونتاج والإنتاج المرئي'),
('السوشال ميديا', 'قسم إدارة منصات التواصل الاجتماعي'),
('التسويق', 'قسم التسويق والإعلان'),
('الإدارة', 'قسم الإدارة العامة');

-- الأدوار
INSERT INTO roles (name, name_ar, description, permissions) VALUES
('admin', 'مدير عام', 'صلاحيات كاملة', '{"all": true}'),
('supervisor', 'مشرف قسم', 'إدارة فريق القسم', '{"dashboard":true,"attendance_dept":true,"tasks_approve":true,"tasks_create":true,"evaluate":true,"leaves_approve":true,"reports_dept":true}'),
('employee', 'موظف', 'الوصول لبياناته فقط', '{"my_dashboard":true,"my_attendance":true,"my_tasks":true,"my_salary":true,"messages":true,"knowledge":true}'),
('viewer', 'مراقب', 'عرض فقط', '{"dashboard":true,"reports":true}');

-- المستخدمين (كلمة المرور: 123456)
INSERT INTO users (full_name, email, password, avatar_initials, avatar_color, department_id, role_id, job_title, base_salary, allowances, hire_date, status) VALUES
('محمد أحمد', 'admin@mediapro.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'م أ', 'linear-gradient(135deg,#4f46e5,#7c3aed)', 6, 1, 'مدير عام', 2200, 300, '2022-01-01', 'active'),
('أحمد العلي', 'ahmed@mediapro.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'أ ع', 'linear-gradient(135deg,#4f46e5,#7c3aed)', 1, 3, 'محرر أول', 1800, 150, '2022-03-15', 'active'),
('لينا محمود', 'lina@mediapro.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ل م', 'linear-gradient(135deg,#8b5cf6,#ec4899)', 4, 3, 'مديرة المحتوى', 2000, 150, '2022-05-01', 'active'),
('عمر القاسم', 'omar@mediapro.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ع ق', 'linear-gradient(135deg,#10b981,#06b6d4)', 3, 3, 'مونتير رئيسي', 1700, 150, '2022-06-01', 'active'),
('سارة الخالدي', 'sara@mediapro.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'س خ', 'linear-gradient(135deg,#f59e0b,#ef4444)', 4, 3, 'صانعة محتوى', 1500, 150, '2023-01-15', 'active'),
('نور الدين', 'nour@mediapro.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ن د', 'linear-gradient(135deg,#06b6d4,#0ea5e9)', 2, 3, 'مصور رئيسي', 1600, 200, '2022-08-01', 'active'),
('ماجد حسن', 'majed@mediapro.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'م ح', 'linear-gradient(135deg,#ef4444,#dc2626)', 2, 3, 'مصور', 1400, 150, '2023-03-01', 'active'),
('رنا العبدالله', 'rana@mediapro.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ر ع', 'linear-gradient(135deg,#ec4899,#f43f5e)', 5, 3, 'مديرة تسويق', 1900, 150, '2022-09-01', 'active');

-- القنوات
INSERT INTO channels (name, description, is_direct) VALUES
('عام', 'القناة العامة لفريق ميديا برو', 0),
('حملة-رمضان', 'نقاشات حملة رمضان الإعلانية', 0),
('فريق-التحرير', 'قناة فريق التحرير', 0),
('فريق-المونتاج', 'قناة فريق المونتاج', 0),
('السوشال-ميديا', 'قناة فريق السوشال ميديا', 0),
('إشعارات-المهام', 'إشعارات تلقائية لحركة المهام', 0);

-- العملاء
INSERT INTO clients (name, description, logo_emoji, satisfaction_rate) VALUES
('شركة تقنية المستقبل', 'إنتاج محتوى + إدارة سوشال ميديا', '🏢', 92),
('مجموعة الصحة الذهبية', 'حملات إعلانية + فيديوهات توعوية', '🏥', 88),
('مجمع النخبة التجاري', 'تصوير منتجات + حملة رمضان', '🏬', 95),
('جامعة المعرفة', 'محتوى تعليمي + بودكاست', '🎓', 90);

-- الإعدادات
INSERT INTO settings (setting_key, setting_value) VALUES
('work_start_time', '09:00'),
('work_end_time', '17:00'),
('late_tolerance_minutes', '10'),
('idle_max_minutes', '15'),
('work_days', 'sun,mon,tue,wed,thu'),
('ip_verification', '1'),
('device_fingerprint', '1'),
('geolocation', '1'),
('vpn_detection', '1'),
('idle_detection', '1'),
('random_screenshot', '0'),
('single_session', '1'),
('suspicious_reporting', '1'),
('publish_idle_minutes', '15');

-- =============================================
-- جداول مراقبة النشر على المنصات
-- =============================================

-- ===== جدول المنصات =====
CREATE TABLE platforms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    platform_type VARCHAR(50) NOT NULL COMMENT 'facebook, telegram, whatsapp, twitter, instagram, youtube, tiktok, snapchat, other',
    icon VARCHAR(10) DEFAULT '📱',
    account_url VARCHAR(500),
    assigned_to INT,
    idle_threshold INT DEFAULT 15 COMMENT 'دقائق الخمول قبل التنبيه',
    status ENUM('active','paused','archived') DEFAULT 'active',
    last_publish_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_type (platform_type),
    INDEX idx_last_publish (last_publish_at)
) ENGINE=InnoDB;

-- ===== جدول سجل النشر =====
CREATE TABLE publish_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    platform_id INT NOT NULL,
    user_id INT,
    content_title VARCHAR(255),
    content_type ENUM('post','story','reel','video','article','message','ad','other') DEFAULT 'post',
    notes TEXT,
    published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (platform_id) REFERENCES platforms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_platform (platform_id),
    INDEX idx_published (published_at)
) ENGINE=InnoDB;

-- بيانات تجريبية للمنصات
INSERT INTO platforms (name, platform_type, icon, assigned_to, idle_threshold, status, last_publish_at) VALUES
('فيسبوك - الصفحة الرئيسية', 'facebook', '📘', 3, 15, 'active', NOW() - INTERVAL 5 MINUTE),
('فيسبوك - مجموعة العملاء', 'facebook', '📘', 3, 15, 'active', NOW() - INTERVAL 45 MINUTE),
('إنستغرام - الحساب الرسمي', 'instagram', '📸', 5, 15, 'active', NOW() - INTERVAL 3 MINUTE),
('إنستغرام - القصص', 'instagram', '📸', 5, 15, 'active', NOW() - INTERVAL 120 MINUTE),
('تويتر - الحساب الرسمي', 'twitter', '🐦', 3, 15, 'active', NOW() - INTERVAL 10 MINUTE),
('تويتر - حساب الأخبار', 'twitter', '🐦', 2, 15, 'active', NOW() - INTERVAL 200 MINUTE),
('تلغرام - القناة الرئيسية', 'telegram', '✈️', 2, 15, 'active', NOW() - INTERVAL 8 MINUTE),
('تلغرام - قناة العروض', 'telegram', '✈️', 5, 15, 'active', NOW() - INTERVAL 30 MINUTE),
('تلغرام - مجموعة النقاش', 'telegram', '✈️', 2, 15, 'active', NOW() - INTERVAL 60 MINUTE),
('واتساب - البث الرسمي', 'whatsapp', '💬', 3, 15, 'active', NOW() - INTERVAL 2 MINUTE),
('واتساب - مجموعة VIP', 'whatsapp', '💬', 5, 15, 'active', NOW() - INTERVAL 90 MINUTE),
('يوتيوب - القناة الرئيسية', 'youtube', '▶️', 4, 30, 'active', NOW() - INTERVAL 1440 MINUTE),
('تيك توك - الحساب الرسمي', 'tiktok', '🎵', 5, 20, 'active', NOW() - INTERVAL 25 MINUTE),
('سناب شات - الحساب الرسمي', 'snapchat', '👻', 5, 15, 'active', NOW() - INTERVAL 180 MINUTE),
('لينكدإن - صفحة الشركة', 'linkedin', '💼', 8, 60, 'active', NOW() - INTERVAL 300 MINUTE),
('فيسبوك - حملة رمضان', 'facebook', '📘', 3, 15, 'active', NOW() - INTERVAL 12 MINUTE),
('إنستغرام - حساب المنتجات', 'instagram', '📸', 5, 15, 'active', NOW() - INTERVAL 50 MINUTE),
('تويتر - خدمة العملاء', 'twitter', '🐦', 8, 10, 'active', NOW() - INTERVAL 7 MINUTE),
('تلغرام - بوت الخدمات', 'telegram', '✈️', 4, 15, 'active', NOW() - INTERVAL 150 MINUTE),
('واتساب - الدعم الفني', 'whatsapp', '💬', 8, 10, 'active', NOW() - INTERVAL 4 MINUTE);

-- ===== جدول سجل التوقف =====
CREATE TABLE idle_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    platform_id INT NOT NULL,
    started_at DATETIME NOT NULL COMMENT 'بداية فترة التوقف',
    ended_at DATETIME DEFAULT NULL COMMENT 'نهاية التوقف (NULL = لا زال متوقف)',
    duration_minutes INT DEFAULT 0,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (platform_id) REFERENCES platforms(id) ON DELETE CASCADE,
    INDEX idx_platform_date (platform_id, date),
    INDEX idx_date (date),
    INDEX idx_open (platform_id, ended_at)
) ENGINE=InnoDB
