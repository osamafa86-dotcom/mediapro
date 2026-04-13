<?php
/**
 * ميديا برو — سكربت المراقبة التلقائية
 * يعمل كـ Cron Job كل 5 دقائق
 * يراقب المنصات ويكتشف النشر الجديد تلقائياً
 *
 * Cron: */5 * * * * /usr/local/bin/php /home/z4sww4p4xieh/public_html/mediapro.emdatra.org/monitor.php >> /dev/null 2>&1
 */

// منع الوصول من المتصفح
if (php_sapi_name() !== 'cli' && !isset($_GET['cron_key'])) {
    // السماح بالوصول عبر cron_key للاختبار
    http_response_code(403);
    die('Access denied');
}

// إعدادات التشغيل
set_time_limit(300); // 5 دقائق كحد أقصى
date_default_timezone_set('Asia/Riyadh');

require_once __DIR__ . '/config.php';

$db = getDB();
$now = date('Y-m-d H:i:s');
$today = date('Y-m-d');

logMsg("=== بدء المراقبة: $now ===");

// جلب المنصات النشطة
$platforms = $db->query("SELECT * FROM platforms WHERE status = 'active'")->fetchAll();
logMsg("عدد المنصات النشطة: " . count($platforms));

foreach ($platforms as $platform) {
    try {
        $lastPublish = checkPlatform($platform);

        if ($lastPublish && $lastPublish !== $platform['last_publish_at']) {
            // تم اكتشاف نشر جديد!
            $db->prepare("UPDATE platforms SET last_publish_at = ? WHERE id = ?")
               ->execute([$lastPublish, $platform['id']]);

            logMsg("[{$platform['name']}] نشر جديد اكتشف: $lastPublish");

            // إغلاق أي فترة توقف مفتوحة
            closeIdlePeriod($db, $platform['id'], $lastPublish);

            // تسجيل في سجل النشر
            $db->prepare("INSERT INTO publish_logs (platform_id, content_title, content_type, published_at) VALUES (?, ?, 'post', ?)")
               ->execute([$platform['id'], 'نشر تلقائي - مكتشف', $lastPublish]);
        } else {
            // لا يوجد نشر جديد — تحقق من الخمول
            $minutesSince = minutesSince($platform['last_publish_at']);
            $threshold = (int)$platform['idle_threshold'];

            if ($minutesSince >= $threshold) {
                // المنصة خاملة — سجّل فترة التوقف
                openIdlePeriod($db, $platform['id'], $platform['last_publish_at'], $threshold, $today);
                logMsg("[{$platform['name']}] خاملة منذ {$minutesSince} دقيقة");
            }
        }
    } catch (Exception $e) {
        logMsg("[{$platform['name']}] خطأ: " . $e->getMessage());
    }
}

// تحديث مدة فترات التوقف المفتوحة
$db->query("UPDATE idle_logs SET duration_minutes = TIMESTAMPDIFF(MINUTE, started_at, NOW()) WHERE ended_at IS NULL");

logMsg("=== انتهاء المراقبة ===\n");

// =============================================
// دوال فحص المنصات
// =============================================

function checkPlatform($platform) {
    $type = $platform['platform_type'];
    $url = $platform['account_url'] ?? '';

    switch ($type) {
        case 'telegram':
            return checkTelegram($url);
        case 'facebook':
            return checkFacebook($platform);
        case 'instagram':
            return checkInstagram($platform);
        case 'youtube':
            return checkYoutube($url);
        case 'twitter':
            return checkTwitter($platform);
        default:
            return null; // المنصات غير المدعومة
    }
}

/**
 * مراقبة تلغرام — قنوات عامة
 * يقرأ صفحة القناة العامة ويستخرج وقت آخر منشور
 */
function checkTelegram($url) {
    if (empty($url)) return null;

    // استخراج اسم القناة من الرابط
    $channel = '';
    if (preg_match('/t\.me\/(?:s\/)?([a-zA-Z0-9_]+)/', $url, $m)) {
        $channel = $m[1];
    } elseif (preg_match('/^@?([a-zA-Z0-9_]+)$/', trim($url), $m)) {
        $channel = $m[1];
    }

    if (empty($channel)) return null;

    $pageUrl = "https://t.me/s/$channel";
    $html = fetchUrl($pageUrl);
    if (!$html) return null;

    // استخراج تاريخ آخر رسالة
    // <time datetime="2024-01-15T10:30:00+00:00" class="time">
    if (preg_match_all('/<time[^>]*datetime="([^"]+)"/', $html, $matches)) {
        $dates = $matches[1];
        if (!empty($dates)) {
            $lastDate = end($dates);
            $timestamp = strtotime($lastDate);
            if ($timestamp) {
                return date('Y-m-d H:i:s', $timestamp);
            }
        }
    }

    return null;
}

/**
 * مراقبة فيسبوك — عبر Graph API
 * يحتاج: Page Access Token
 */
function checkFacebook($platform) {
    $url = $platform['account_url'] ?? '';
    if (empty($url)) return null;

    global $db;
    $token = getSetting('facebook_access_token');
    if (empty($token)) return null;

    // استخراج Page ID من الرابط
    $pageId = '';
    if (preg_match('/facebook\.com\/(?:pages\/[^\/]+\/)?(\d+)/', $url, $m)) {
        $pageId = $m[1];
    } elseif (preg_match('/facebook\.com\/([a-zA-Z0-9.]+)/', $url, $m)) {
        $pageId = $m[1];
    }

    if (empty($pageId)) return null;

    $apiUrl = "https://graph.facebook.com/v18.0/{$pageId}/posts?fields=created_time&limit=1&access_token={$token}";
    $response = fetchUrl($apiUrl);
    if (!$response) return null;

    $data = json_decode($response, true);
    if (isset($data['data'][0]['created_time'])) {
        return date('Y-m-d H:i:s', strtotime($data['data'][0]['created_time']));
    }

    return null;
}

/**
 * مراقبة إنستغرام — عبر Graph API
 * يحتاج: Instagram Business Account + Facebook Access Token
 */
function checkInstagram($platform) {
    $url = $platform['account_url'] ?? '';
    if (empty($url)) return null;

    global $db;
    $token = getSetting('instagram_access_token');
    if (empty($token)) return null;

    // استخراج IG User ID (يحتاج إعداد مسبق)
    $igUserId = getSetting('ig_user_' . $platform['id']);
    if (empty($igUserId)) return null;

    $apiUrl = "https://graph.facebook.com/v18.0/{$igUserId}/media?fields=timestamp&limit=1&access_token={$token}";
    $response = fetchUrl($apiUrl);
    if (!$response) return null;

    $data = json_decode($response, true);
    if (isset($data['data'][0]['timestamp'])) {
        return date('Y-m-d H:i:s', strtotime($data['data'][0]['timestamp']));
    }

    return null;
}

/**
 * مراقبة يوتيوب — عبر RSS Feed (مجاني بدون API key)
 */
function checkYoutube($url) {
    if (empty($url)) return null;

    // استخراج Channel ID
    $channelId = '';
    if (preg_match('/youtube\.com\/channel\/([a-zA-Z0-9_-]+)/', $url, $m)) {
        $channelId = $m[1];
    } elseif (preg_match('/youtube\.com\/@([a-zA-Z0-9_-]+)/', $url, $m)) {
        // Handle @username format - need to convert to channel ID
        // For now, try RSS with username
        $rssUrl = "https://www.youtube.com/feeds/videos.xml?user=" . $m[1];
        $xml = fetchUrl($rssUrl);
        if ($xml) {
            return parseYoutubeRss($xml);
        }
        return null;
    }

    if (empty($channelId)) return null;

    $rssUrl = "https://www.youtube.com/feeds/videos.xml?channel_id=$channelId";
    $xml = fetchUrl($rssUrl);
    if (!$xml) return null;

    return parseYoutubeRss($xml);
}

function parseYoutubeRss($xml) {
    // تعطيل أخطاء XML
    libxml_use_internal_errors(true);
    $feed = simplexml_load_string($xml);
    if ($feed === false) return null;

    $ns = $feed->getNamespaces(true);
    $entries = $feed->entry;

    if (isset($entries[0])) {
        $published = (string)$entries[0]->published;
        if ($published) {
            return date('Y-m-d H:i:s', strtotime($published));
        }
    }

    return null;
}

/**
 * مراقبة تويتر — يحتاج Bearer Token
 */
function checkTwitter($platform) {
    $url = $platform['account_url'] ?? '';
    if (empty($url)) return null;

    global $db;
    $token = getSetting('twitter_bearer_token');
    if (empty($token)) return null;

    // استخراج username
    $username = '';
    if (preg_match('/(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/', $url, $m)) {
        $username = $m[1];
    }

    if (empty($username)) return null;

    $apiUrl = "https://api.twitter.com/2/tweets/search/recent?query=from:{$username}&max_results=10&tweet.fields=created_at";
    $response = fetchUrl($apiUrl, [
        "Authorization: Bearer $token"
    ]);
    if (!$response) return null;

    $data = json_decode($response, true);
    if (isset($data['data'][0]['created_at'])) {
        return date('Y-m-d H:i:s', strtotime($data['data'][0]['created_at']));
    }

    return null;
}

// =============================================
// دوال مساعدة
// =============================================

function fetchUrl($url, $headers = []) {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; MediaProMonitor/1.0)',
    ]);

    if (!empty($headers)) {
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode >= 200 && $httpCode < 300) {
        return $response;
    }

    return null;
}

function minutesSince($datetime) {
    if (empty($datetime)) return 9999;
    $diff = time() - strtotime($datetime);
    return max(0, floor($diff / 60));
}

function openIdlePeriod($db, $platformId, $lastPublishAt, $threshold, $today) {
    // تحقق من وجود فترة توقف مفتوحة
    $stmt = $db->prepare("SELECT id FROM idle_logs WHERE platform_id = ? AND ended_at IS NULL LIMIT 1");
    $stmt->execute([$platformId]);

    if (!$stmt->fetch()) {
        // إنشاء فترة توقف جديدة
        $startedAt = date('Y-m-d H:i:s', strtotime($lastPublishAt) + ($threshold * 60));
        $duration = minutesSince($startedAt);

        $db->prepare("INSERT INTO idle_logs (platform_id, started_at, duration_minutes, date) VALUES (?, ?, ?, ?)")
           ->execute([$platformId, $startedAt, $duration, $today]);
    }
}

function closeIdlePeriod($db, $platformId, $endedAt) {
    $stmt = $db->prepare("SELECT id, started_at FROM idle_logs WHERE platform_id = ? AND ended_at IS NULL");
    $stmt->execute([$platformId]);
    $idle = $stmt->fetch();

    if ($idle) {
        $duration = floor((strtotime($endedAt) - strtotime($idle['started_at'])) / 60);
        $db->prepare("UPDATE idle_logs SET ended_at = ?, duration_minutes = ? WHERE id = ?")
           ->execute([$endedAt, max(0, $duration), $idle['id']]);
    }
}

function logMsg($msg) {
    $logFile = __DIR__ . '/monitor_log.txt';
    $time = date('Y-m-d H:i:s');
    file_put_contents($logFile, "[$time] $msg\n", FILE_APPEND);
}
