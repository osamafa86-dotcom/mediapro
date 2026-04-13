<?php require_once 'config.php'; requireAuth(); ?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ميديا برو - نظام إدارة الشركة الإعلامية</title>
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #4f46e5;
            --primary-rgb: 79,70,229;
            --primary-light: #eef2ff;
            --primary-dark: #4338ca;
            --primary-gradient: linear-gradient(135deg, #4f46e5, #7c3aed);
            --accent: #06b6d4;
            --accent-light: #ecfeff;
            --success: #10b981;
            --success-light: #d1fae5;
            --warning: #f59e0b;
            --warning-light: #fef3c7;
            --danger: #ef4444;
            --danger-light: #fee2e2;
            --info: #8b5cf6;
            --info-light: #ede9fe;
            --bg: #f8fafc;
            --bg-secondary: #f1f5f9;
            --white: #ffffff;
            --text: #0f172a;
            --text-secondary: #64748b;
            --text-tertiary: #94a3b8;
            --border: #e2e8f0;
            --border-light: #f1f5f9;
            --sidebar-bg: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
            --sidebar-text: #94a3b8;
            --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
            --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05);
            --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.05);
            --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04);
            --radius: 14px;
            --radius-sm: 10px;
            --radius-lg: 20px;
            --transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
        }
        [data-theme="dark"] {
            --bg:#0f172a;--bg-secondary:#1e293b;--white:#1e293b;--text:#f1f5f9;--text-secondary:#94a3b8;--text-tertiary:#64748b;--border:#334155;--border-light:#1e293b;
            --shadow:0 1px 3px rgba(0,0,0,0.3);--shadow-md:0 4px 6px rgba(0,0,0,0.3);--shadow-lg:0 10px 15px rgba(0,0,0,0.3);
            --primary-light:rgba(79,70,229,0.15);--success-light:rgba(16,185,129,0.15);--warning-light:rgba(245,158,11,0.15);--danger-light:rgba(239,68,68,0.15);--info-light:rgba(139,92,246,0.15);--accent-light:rgba(6,182,212,0.15);
        }
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Tajawal',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex;overflow-x:hidden}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}

        /* SIDEBAR */
        .sidebar{width:272px;background:var(--sidebar-bg);min-height:100vh;position:fixed;right:0;top:0;z-index:100;display:flex;flex-direction:column;transition:transform .4s cubic-bezier(.4,0,.2,1);border-left:1px solid rgba(255,255,255,.06)}
        .sidebar-header{padding:28px 22px 24px;border-bottom:1px solid rgba(255,255,255,.06)}
        .sidebar-logo{display:flex;align-items:center;gap:14px}
        .logo-icon{width:46px;height:46px;background:var(--primary-gradient);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px;color:white;box-shadow:0 4px 12px rgba(var(--primary-rgb),.4);position:relative;overflow:hidden}
        .logo-icon::after{content:'';position:absolute;top:-50%;right:-50%;width:100%;height:100%;background:linear-gradient(135deg,rgba(255,255,255,.3),transparent);border-radius:50%}
        .sidebar-logo h2{color:white;font-size:18px;font-weight:800}
        .sidebar-logo span{color:var(--sidebar-text);font-size:12px}
        .sidebar-nav{flex:1;padding:20px 14px;overflow-y:auto}
        .nav-section{margin-bottom:28px}
        .nav-section-title{color:rgba(148,163,184,.6);font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;padding:0 14px;margin-bottom:10px}
        .nav-item{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:10px;color:var(--sidebar-text);cursor:pointer;transition:var(--transition);font-size:14px;font-weight:500;margin-bottom:3px;position:relative}
        .nav-item:hover{background:rgba(255,255,255,.06);color:white}
        .nav-item.active{background:var(--primary-gradient);color:white;box-shadow:0 4px 12px rgba(var(--primary-rgb),.35)}
        .nav-icon{width:22px;text-align:center;font-size:17px;flex-shrink:0}
        .nav-badge{margin-right:auto;background:var(--danger);color:white;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:700;animation:pulse-badge 2s infinite}
        @keyframes pulse-badge{0%,100%{opacity:1}50%{opacity:.7}}
        .sidebar-footer{padding:18px 22px;border-top:1px solid rgba(255,255,255,.06);background:rgba(0,0,0,.15)}
        .user-info{display:flex;align-items:center;gap:12px}
        .user-avatar{width:40px;height:40px;border-radius:12px;background:var(--primary-gradient);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;box-shadow:0 2px 8px rgba(var(--primary-rgb),.3)}
        .user-info .name{color:white;font-size:14px;font-weight:700}
        .user-info .role{color:var(--sidebar-text);font-size:12px}
        .online-dot{width:8px;height:8px;background:var(--success);border-radius:50%;border:2px solid #0f172a;position:absolute;bottom:-1px;left:-1px}

        /* MAIN */
        .main-content{flex:1;margin-right:272px;min-height:100vh}
        .topbar{background:var(--white);padding:0 32px;height:72px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:50;backdrop-filter:blur(20px)}
        [data-theme="dark"] .topbar{background:rgba(30,41,59,.85)}
        .topbar-right{display:flex;align-items:center;gap:16px}
        .page-title{font-size:22px;font-weight:800;background:var(--primary-gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .breadcrumb{color:var(--text-secondary);font-size:13px;margin-top:2px}
        .topbar-left{display:flex;align-items:center;gap:10px}
        .search-box{display:flex;align-items:center;gap:10px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:10px 16px;width:300px;transition:var(--transition)}
        .search-box:focus-within{border-color:var(--primary);box-shadow:0 0 0 3px rgba(var(--primary-rgb),.1);background:var(--white)}
        .search-box input{border:none;background:none;outline:none;font-family:'Tajawal',sans-serif;font-size:14px;width:100%;color:var(--text)}
        .icon-btn{width:42px;height:42px;border-radius:12px;border:1px solid var(--border);background:var(--white);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;position:relative;transition:var(--transition)}
        .icon-btn:hover{background:var(--bg-secondary);transform:translateY(-1px);box-shadow:var(--shadow)}
        .notif-dot{position:absolute;top:9px;left:9px;width:9px;height:9px;background:var(--danger);border-radius:50%;border:2px solid var(--white);animation:pulse-badge 2s infinite}

        /* PAGE */
        .page-content{padding:28px 32px}
        .page{display:none}.page.active{display:block;animation:pageIn .5s cubic-bezier(.4,0,.2,1)}
        @keyframes pageIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}

        /* STATS */
        .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-bottom:28px}
        .stat-card{background:var(--white);border-radius:var(--radius);padding:22px;box-shadow:var(--shadow);display:flex;align-items:flex-start;justify-content:space-between;transition:var(--transition);border:1px solid var(--border-light);position:relative;overflow:hidden}
        .stat-card::before{content:'';position:absolute;top:0;right:0;width:100%;height:3px;background:var(--primary-gradient);opacity:0;transition:var(--transition)}
        .stat-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-lg)}.stat-card:hover::before{opacity:1}
        .stat-card:nth-child(1)::before{background:var(--primary-gradient)}
        .stat-card:nth-child(2)::before{background:linear-gradient(135deg,#10b981,#06b6d4)}
        .stat-card:nth-child(3)::before{background:linear-gradient(135deg,#f59e0b,#ef4444)}
        .stat-card:nth-child(4)::before{background:linear-gradient(135deg,#8b5cf6,#ec4899)}
        .stat-info h3{color:var(--text-secondary);font-size:13px;font-weight:500;margin-bottom:10px}
        .stat-value{font-size:30px;font-weight:900;letter-spacing:-.5px;line-height:1}
        .stat-change{font-size:12px;margin-top:8px;display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-weight:600}
        .stat-change.up{background:var(--success-light);color:var(--success)}
        .stat-change.down{background:var(--danger-light);color:var(--danger)}
        .stat-icon{width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0}
        .stat-icon.blue{background:var(--primary-light)}.stat-icon.green{background:var(--success-light)}
        .stat-icon.orange{background:var(--warning-light)}.stat-icon.purple{background:var(--info-light)}

        /* CARD */
        .card{background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow);margin-bottom:24px;border:1px solid var(--border-light);overflow:hidden;transition:var(--transition)}
        .card:hover{box-shadow:var(--shadow-md)}
        .card-header{padding:20px 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:12px}
        .card-header h3{font-size:16px;font-weight:700;display:flex;align-items:center;gap:8px}
        .card-body{padding:24px}
        .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:24px}

        /* TABLE */
        table{width:100%;border-collapse:collapse}
        table th{background:var(--bg-secondary);padding:14px 18px;text-align:right;font-size:12px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;white-space:nowrap}
        table td{padding:16px 18px;border-bottom:1px solid var(--border-light);font-size:14px;vertical-align:middle}
        table tr:last-child td{border-bottom:none}
        table tr{transition:var(--transition)}table tr:hover td{background:var(--bg-secondary)}

        /* BADGES */
        .badge{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700}
        .badge-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
        .badge.online{background:var(--success-light);color:var(--success)}.badge.online .badge-dot{background:var(--success);animation:pulse-dot 2s infinite}
        .badge.offline{background:var(--bg-secondary);color:var(--text-secondary)}
        .badge.late{background:var(--warning-light);color:var(--warning)}.badge.late .badge-dot{background:var(--warning)}
        .badge.absent{background:var(--danger-light);color:var(--danger)}.badge.absent .badge-dot{background:var(--danger)}
        .badge.completed{background:var(--success-light);color:var(--success)}.badge.in-progress{background:var(--primary-light);color:var(--primary)}
        .badge.pending{background:var(--warning-light);color:var(--warning)}.badge.paid{background:var(--success-light);color:var(--success)}
        .badge.unpaid{background:var(--danger-light);color:var(--danger)}.badge.overdue{background:var(--danger-light);color:var(--danger)}
        @keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}

        /* BUTTONS */
        .btn{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;border-radius:var(--radius-sm);font-family:'Tajawal',sans-serif;font-size:14px;font-weight:700;cursor:pointer;border:none;transition:var(--transition);white-space:nowrap}
        .btn-primary{background:var(--primary-gradient);color:white;box-shadow:0 4px 12px rgba(var(--primary-rgb),.3)}
        .btn-primary:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(var(--primary-rgb),.4)}
        .btn-success{background:linear-gradient(135deg,#10b981,#059669);color:white;box-shadow:0 4px 12px rgba(16,185,129,.3)}
        .btn-success:hover{transform:translateY(-2px)}
        .btn-outline{background:var(--white);color:var(--text);border:1px solid var(--border)}
        .btn-outline:hover{background:var(--bg-secondary);border-color:var(--primary);color:var(--primary)}
        .btn-sm{padding:6px 14px;font-size:13px;border-radius:8px}
        .btn-danger{background:linear-gradient(135deg,#ef4444,#dc2626);color:white}

        /* EMPLOYEE */
        .emp-info{display:flex;align-items:center;gap:12px}
        .emp-avatar{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:13px;flex-shrink:0}
        .emp-name{font-weight:700;font-size:14px}.emp-dept{color:var(--text-secondary);font-size:12px;margin-top:1px}

        /* PROGRESS */
        .progress-bar{width:100%;height:8px;background:var(--bg-secondary);border-radius:4px;overflow:hidden}
        .progress-fill{height:100%;border-radius:4px;transition:width 1s cubic-bezier(.4,0,.2,1);position:relative;overflow:hidden}
        .progress-fill::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent);animation:shimmer 2s infinite}
        @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
        .progress-fill.blue{background:var(--primary-gradient)}.progress-fill.green{background:linear-gradient(90deg,#10b981,#06b6d4)}
        .progress-fill.orange{background:linear-gradient(90deg,#f59e0b,#ef4444)}.progress-fill.purple{background:linear-gradient(90deg,#8b5cf6,#ec4899)}

        /* CLOCK */
        .clock-section{text-align:center;padding:40px;background:linear-gradient(135deg,rgba(var(--primary-rgb),.03),rgba(139,92,246,.03));position:relative}
        .clock-section::before{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(var(--primary-rgb),.06) 0%,transparent 70%);pointer-events:none}
        .current-time{font-size:64px;font-weight:900;background:var(--primary-gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:4px;font-variant-numeric:tabular-nums;letter-spacing:-2px;line-height:1.1}
        .current-date{color:var(--text-secondary);font-size:17px;margin-bottom:28px;font-weight:500}
        .clock-actions{display:flex;gap:16px;justify-content:center}
        .clock-btn{padding:16px 48px;border-radius:14px;font-family:'Tajawal',sans-serif;font-size:17px;font-weight:800;cursor:pointer;border:none;transition:var(--transition)}
        .clock-btn.check-in{background:linear-gradient(135deg,#10b981,#059669);color:white;box-shadow:0 6px 20px rgba(16,185,129,.35)}
        .clock-btn.check-in:hover{transform:translateY(-3px);box-shadow:0 8px 25px rgba(16,185,129,.45)}
        .clock-btn.check-out{background:linear-gradient(135deg,#ef4444,#dc2626);color:white;box-shadow:0 6px 20px rgba(239,68,68,.35)}
        .clock-btn.check-out:hover{transform:translateY(-3px)}
        .clock-btn:disabled{opacity:.4;cursor:not-allowed;transform:none!important;box-shadow:none!important}

        /* CHARTS */
        .bar-chart{display:flex;align-items:flex-end;gap:12px;height:220px;padding:20px 0}
        .bar-group{flex:1;display:flex;flex-direction:column;align-items:center;gap:10px}
        .bar-stack{display:flex;gap:4px;align-items:flex-end;height:100%}
        .bar{width:18px;border-radius:6px 6px 0 0;transition:height .8s cubic-bezier(.4,0,.2,1);cursor:pointer}
        .bar:hover{filter:brightness(1.15)}
        .bar-label{font-size:12px;color:var(--text-secondary);font-weight:600}
        .donut-wrapper{display:flex;align-items:center;gap:32px;padding:20px}
        .donut-chart{width:180px;height:180px;position:relative;flex-shrink:0}
        .donut-chart svg{transform:rotate(-90deg)}
        .donut-center{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center}
        .donut-center .perc{font-size:32px;font-weight:900;background:var(--primary-gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .donut-center span{font-size:12px;color:var(--text-secondary);display:block}
        .donut-legend{display:flex;flex-direction:column;gap:14px}
        .legend-item{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:500}
        .legend-dot{width:14px;height:14px;border-radius:5px;flex-shrink:0}
        .legend-item strong{margin-right:auto;font-weight:800}

        /* TASK */
        .task-item{padding:18px 20px;border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:14px;transition:var(--transition);position:relative}
        .task-item::before{content:'';position:absolute;top:0;right:0;bottom:0;width:4px;border-radius:0 4px 4px 0;background:var(--primary);opacity:0;transition:var(--transition)}
        .task-item:hover{border-color:var(--primary);box-shadow:0 0 0 3px rgba(var(--primary-rgb),.08);transform:translateX(-2px)}
        .task-item:hover::before{opacity:1}
        .task-item.overdue{border-color:rgba(239,68,68,.3)}.task-item.overdue::before{background:var(--danger);opacity:1}
        .task-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}
        .task-title{font-weight:700;font-size:15px}
        .task-meta{display:flex;gap:18px;align-items:center;color:var(--text-secondary);font-size:13px;flex-wrap:wrap}
        .task-progress{margin-top:12px;display:flex;align-items:center;gap:12px}
        .task-progress .progress-bar{flex:1}
        .task-progress .perc{font-size:14px;font-weight:800;color:var(--primary);min-width:40px}

        /* SALARY */
        .salary-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:28px}
        .salary-box{padding:28px 24px;border-radius:var(--radius);text-align:center;transition:var(--transition);position:relative;overflow:hidden}
        .salary-box:hover{transform:translateY(-4px)}
        .salary-box.total{background:var(--primary-gradient);color:white;box-shadow:0 8px 24px rgba(var(--primary-rgb),.3)}
        .salary-box.deductions{background:linear-gradient(135deg,#fef2f2,#fee2e2);color:var(--danger);border:1px solid rgba(239,68,68,.15)}
        .salary-box.bonuses{background:linear-gradient(135deg,#ecfdf5,#d1fae5);color:var(--success);border:1px solid rgba(16,185,129,.15)}
        [data-theme="dark"] .salary-box.deductions{background:var(--danger-light);border-color:rgba(239,68,68,.2)}
        [data-theme="dark"] .salary-box.bonuses{background:var(--success-light);border-color:rgba(16,185,129,.2)}
        .sal-label{font-size:14px;margin-bottom:8px;opacity:.85;font-weight:500}
        .sal-value{font-size:30px;font-weight:900;letter-spacing:-.5px}

        /* TABS */
        .tabs{display:flex;gap:4px;background:var(--bg-secondary);padding:4px;border-radius:12px;width:fit-content;border:1px solid var(--border-light)}
        .tab-btn{padding:9px 22px;border-radius:9px;font-family:'Tajawal',sans-serif;font-size:14px;font-weight:700;cursor:pointer;border:none;background:none;color:var(--text-secondary);transition:var(--transition)}
        .tab-btn.active{background:var(--white);color:var(--text);box-shadow:var(--shadow)}

        /* FILTERS */
        .filter-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
        .filter-select{padding:8px 16px;border:1px solid var(--border);border-radius:10px;font-family:'Tajawal',sans-serif;font-size:13px;background:var(--white);color:var(--text);cursor:pointer;outline:none;font-weight:600;transition:var(--transition)}
        .filter-select:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(var(--primary-rgb),.1)}

        .stars{display:flex;gap:2px}.star{font-size:16px}.star.filled{color:#f59e0b}.star.empty{color:var(--border)}

        /* QUICK ACTIONS */
        .quick-actions{display:flex;gap:12px;margin-bottom:28px;flex-wrap:wrap}
        .quick-action{display:flex;align-items:center;gap:10px;padding:12px 22px;background:var(--white);border:1px solid var(--border);border-radius:12px;cursor:pointer;font-family:'Tajawal',sans-serif;font-size:14px;font-weight:700;transition:var(--transition);color:var(--text)}
        .quick-action:hover{border-color:var(--primary);background:var(--primary-light);color:var(--primary);transform:translateY(-2px);box-shadow:var(--shadow-md)}

        /* TIMELINE */
        .timeline{position:relative;padding-right:32px}
        .timeline::before{content:'';position:absolute;right:11px;top:0;bottom:0;width:2px;background:linear-gradient(to bottom,var(--primary),var(--accent),transparent);border-radius:1px}
        .timeline-item{position:relative;padding-bottom:24px;padding-right:32px;transition:var(--transition)}
        .timeline-item:hover{transform:translateX(-4px)}
        .timeline-item::before{content:'';position:absolute;right:-27px;top:5px;width:12px;height:12px;border-radius:50%;background:var(--white);border:3px solid var(--primary);box-shadow:0 0 0 4px rgba(var(--primary-rgb),.1);transition:var(--transition)}
        .timeline-item:hover::before{background:var(--primary);box-shadow:0 0 0 6px rgba(var(--primary-rgb),.15)}
        .timeline-time{font-size:12px;color:var(--text-tertiary);font-weight:700}
        .timeline-text{font-size:14px;margin-top:4px;line-height:1.6}

        /* EMPLOYEE CARDS */
        .emp-profile-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px}
        .emp-profile-card{border:1px solid var(--border);border-radius:var(--radius);padding:24px;text-align:center;transition:var(--transition);background:var(--white);position:relative;overflow:hidden}
        .emp-profile-card::before{content:'';position:absolute;top:0;left:0;right:0;height:60px;background:var(--primary-gradient);opacity:.06;transition:var(--transition)}
        .emp-profile-card:hover{transform:translateY(-6px);box-shadow:var(--shadow-xl);border-color:var(--primary)}
        .emp-profile-card:hover::before{opacity:.12}
        .emp-avatar-lg{width:68px;height:68px;border-radius:18px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:22px;position:relative;z-index:1;box-shadow:0 4px 12px rgba(0,0,0,.15)}
        .emp-profile-card .emp-name{font-size:17px;font-weight:800}
        .emp-profile-card .emp-dept{margin-top:4px;font-size:13px;color:var(--text-secondary)}
        .emp-stats{display:flex;justify-content:center;gap:24px;margin-top:16px;padding-top:16px;border-top:1px solid var(--border)}
        .emp-stat-item{text-align:center}
        .emp-stat-val{font-size:20px;font-weight:900}
        .emp-stat-label{font-size:11px;color:var(--text-tertiary);font-weight:600;margin-top:2px}

        /* MODAL */
        .modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);z-index:200;align-items:center;justify-content:center}
        .modal-overlay.show{display:flex;animation:modalBgIn .3s}
        @keyframes modalBgIn{from{opacity:0}to{opacity:1}}
        .modal{background:var(--white);border-radius:var(--radius-lg);width:560px;max-width:92vw;max-height:88vh;overflow-y:auto;box-shadow:var(--shadow-xl);animation:modalIn .4s cubic-bezier(.4,0,.2,1)}
        @keyframes modalIn{from{opacity:0;transform:scale(.95) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
        .modal-header{padding:24px 28px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
        .modal-header h3{font-size:18px;font-weight:800}
        .modal-close{width:36px;height:36px;border-radius:10px;border:1px solid var(--border);background:var(--bg-secondary);cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;transition:var(--transition)}
        .modal-close:hover{background:var(--danger-light);color:var(--danger);border-color:var(--danger)}
        .modal-body{padding:28px}
        .form-group{margin-bottom:18px}
        .form-group label{display:block;font-size:14px;font-weight:700;margin-bottom:8px}
        .form-group input,.form-group select,.form-group textarea{width:100%;padding:12px 16px;border:1px solid var(--border);border-radius:10px;font-family:'Tajawal',sans-serif;font-size:14px;outline:none;transition:var(--transition);background:var(--white);color:var(--text)}
        .form-group input:focus,.form-group select:focus,.form-group textarea:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(var(--primary-rgb),.1)}
        .modal-footer{padding:18px 28px;border-top:1px solid var(--border);display:flex;gap:12px}

        /* NOTIFICATION */
        .notif-panel{display:none;position:absolute;top:54px;left:0;background:var(--white);border:1px solid var(--border);border-radius:var(--radius);width:360px;box-shadow:var(--shadow-xl);z-index:60;overflow:hidden}
        .notif-panel.show{display:block;animation:dropIn .3s cubic-bezier(.4,0,.2,1)}
        @keyframes dropIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        .notif-panel-header{padding:16px 20px;border-bottom:1px solid var(--border);font-weight:800;font-size:16px;display:flex;align-items:center;justify-content:space-between}
        .notif-count{background:var(--danger);color:white;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:700}
        .notif-item{padding:14px 20px;border-bottom:1px solid var(--border-light);font-size:13px;display:flex;gap:12px;cursor:pointer;transition:var(--transition)}
        .notif-item:hover{background:var(--bg-secondary)}.notif-item:last-child{border-bottom:none}
        .notif-icon-box{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
        .notif-text{font-weight:600}.notif-sub{color:var(--text-secondary);font-size:12px;margin-top:2px}

        /* SETTINGS */
        .setting-row{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:var(--bg-secondary);border-radius:10px;margin-bottom:8px;transition:var(--transition)}
        .setting-row:hover{background:var(--primary-light)}
        .setting-row span{font-weight:600}.setting-row .count{color:var(--text-secondary);font-size:13px}

        /* SECURITY FEATURES */
        .security-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-bottom:24px}
        .security-card{background:var(--white);border:1px solid var(--border);border-radius:var(--radius);padding:20px;transition:var(--transition);position:relative;overflow:hidden}
        .security-card:hover{box-shadow:var(--shadow-md);transform:translateY(-2px)}
        .security-card .sec-icon{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:14px}

        .sec-icon.blue{background:var(--primary-light);color:var(--primary)}
        .sec-icon.green{background:var(--success-light);color:var(--success)}
        .sec-icon.orange{background:var(--warning-light);color:var(--warning)}
        .security-card h4{font-size:15px;font-weight:800;margin-bottom:8px}
        .security-card p{font-size:13px;color:var(--text-secondary);line-height:1.6}

        @media (max-width: 1200px) {
            .stats-grid{grid-template-columns:repeat(2,1fr)}
            .grid-2{grid-template-columns:1fr}
        }
        @media (max-width: 768px) {
            .sidebar{transform:translateX(100%)}
            .main-content{margin-right:0}
            .sidebar.show{transform:translateX(0)}
            .stats-grid{grid-template-columns:1fr}
            .page-content{padding:20px 16px}
            .topbar{padding:0 16px;height:60px}
            .search-box{width:auto;flex:1}
        }
    </style>
</head>
<body data-theme="light">
    <!-- SIDEBAR -->
    <div class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <div class="sidebar-logo">
                <div class="logo-icon">📺</div>
                <div>
                    <h2>ميديا برو</h2>
                    <span>نظام الإدارة</span>
                </div>
            </div>
        </div>

        <nav class="sidebar-nav">
            <div class="nav-section">
                <div class="nav-section-title">الرئيسية</div>
                <div class="nav-item active" onclick="showPage('dashboard')">
                    <div class="nav-icon">📊</div>
                    <span>لوحة التحكم</span>
                </div>
                <div class="nav-item" onclick="showPage('my-dashboard')">
                    <div class="nav-icon">👤</div>
                    <span>لوحتي الشخصية</span>
                </div>
            </div>

            <div class="nav-section">
                <div class="nav-section-title">الموارد البشرية</div>
                <div class="nav-item" onclick="showPage('attendance')">
                    <div class="nav-icon">📋</div>
                    <span>الحضور والغياب</span>
                </div>
                <div class="nav-item" onclick="showPage('workflow')">
                    <div class="nav-icon">⚙️</div>
                    <span>سير العمل</span>
                </div>
                <div class="nav-item" onclick="showPage('performance')">
                    <div class="nav-icon">🎯</div>
                    <span>الأداء والتقييم</span>
                </div>
                <div class="nav-item" onclick="showPage('employees')">
                    <div class="nav-icon">👥</div>
                    <span>الموظفون</span>
                </div>
                <div class="nav-item" onclick="showPage('salaries')">
                    <div class="nav-icon">💰</div>
                    <span>الرواتب</span>
                </div>
                <div class="nav-item" onclick="showPage('leaves')">
                    <div class="nav-icon">🏖️</div>
                    <span>الإجازات</span>
                </div>
            </div>

            <div class="nav-section">
                <div class="nav-section-title">العمليات</div>
                <div class="nav-item" onclick="showPage('calendar')">
                    <div class="nav-icon">📅</div>
                    <span>التقويم</span>
                </div>
                <div class="nav-item" onclick="showPage('messages')">
                    <div class="nav-icon">💬</div>
                    <span>الرسائل</span>
                    <div class="nav-badge" id="msgBadge">3</div>
                </div>
                <div class="nav-item" onclick="showPage('timetracker')">
                    <div class="nav-icon">⏱️</div>
                    <span>تتبع الوقت</span>
                </div>
            </div>

            <div class="nav-section">
                <div class="nav-section-title">المحتوى والمعرفة</div>
                <div class="nav-item" onclick="showPage('media')">
                    <div class="nav-icon">🎬</div>
                    <span>المكتبة الإعلامية</span>
                </div>
                <div class="nav-item" onclick="showPage('knowledge')">
                    <div class="nav-icon">📚</div>
                    <span>قاعدة المعارف</span>
                </div>
                <div class="nav-item" onclick="showPage('clients')">
                    <div class="nav-icon">🤝</div>
                    <span>العملاء</span>
                </div>
            </div>

            <div class="nav-section">
                <div class="nav-section-title">الإدارة</div>
                <div class="nav-item" onclick="showPage('roles')">
                    <div class="nav-icon">🔐</div>
                    <span>الأدوار والصلاحيات</span>
                </div>
                <div class="nav-item" onclick="showPage('reports')">
                    <div class="nav-icon">📈</div>
                    <span>التقارير</span>
                </div>
                <div class="nav-item" onclick="showPage('security')">
                    <div class="nav-icon">🛡️</div>
                    <span>الأمان</span>
                </div>
                <div class="nav-item" onclick="showPage('settings')">
                    <div class="nav-icon">⚙️</div>
                    <span>الإعدادات</span>
                </div>
            </div>
        </nav>

        <div class="sidebar-footer">
            <div class="user-info">
                <div class="user-avatar" id="avatarInitials"><?= substr($_SESSION['full_name'], 0, 1) ?></div>
                <div>
                    <div class="name" id="userName"><?= $_SESSION['full_name'] ?></div>
                    <div class="role" id="userRole"><?= $_SESSION['role_ar'] ?? $_SESSION['role_name'] ?></div>
                </div>
                <div class="online-dot"></div>
            </div>
        </div>
    </div>

    <!-- MAIN CONTENT -->
    <div class="main-content">
        <!-- TOPBAR -->
        <div class="topbar">
            <div class="topbar-left">
                <button class="icon-btn" onclick="toggleSidebar()" style="display:none" id="sidebarToggle">☰</button>
                <div>
                    <div class="page-title" id="pageTitle">لوحة التحكم</div>
                    <div class="breadcrumb" id="breadcrumb">الرئيسية / لوحة التحكم</div>
                </div>
            </div>
            <div class="topbar-right">
                <div class="search-box">
                    <span>🔍</span>
                    <input type="text" placeholder="ابحث...">
                </div>
                <button class="icon-btn" onclick="toggleTheme()">🌙</button>
                <button class="icon-btn" onclick="toggleNotif()" id="notifBtn">
                    🔔
                    <span class="notif-dot" id="notifDot"></span>
                </button>
                <a href="logout.php" class="icon-btn" style="text-decoration:none">🚪</a>
            </div>
        </div>

        <!-- NOTIFICATION PANEL -->
        <div class="notif-panel" id="notifPanel">
            <div class="notif-panel-header">
                <span>التنبيهات</span>
                <span class="notif-count" id="notifCount">0</span>
            </div>
            <div id="notifList"></div>
        </div>

        <!-- PAGE CONTENT -->
        <div class="page-content">
            <!-- ===== DASHBOARD PAGE ===== -->
            <div class="page active" id="page-dashboard">
                <div class="stats-grid" id="statsContainer">
                    <div class="stat-card">
                        <div class="stat-info">
                            <h3>الموظفون النشطون</h3>
                            <div class="stat-value" id="stat-active-emps">24</div>
                            <div class="stat-change up">↑ 12% هذا الأسبوع</div>
                        </div>
                        <div class="stat-icon blue">👥</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-info">
                            <h3>المهام المكتملة</h3>
                            <div class="stat-value" id="stat-completed">156</div>
                            <div class="stat-change up">↑ 8% عن الشهر السابق</div>
                        </div>
                        <div class="stat-icon green">✅</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-info">
                            <h3>الرواتب المعلقة</h3>
                            <div class="stat-value" id="stat-pending-salary">3</div>
                            <div class="stat-change down">↓ 2 دفعة متبقية</div>
                        </div>
                        <div class="stat-icon orange">⏳</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-info">
                            <h3>الإجازات المتبقية</h3>
                            <div class="stat-value" id="stat-remaining-leaves">48</div>
                            <div class="stat-change up">↑ 16 يوم للربع الثاني</div>
                        </div>
                        <div class="stat-icon purple">🏖️</div>
                    </div>
                </div>

                <div class="grid-2">
                    <div class="card">
                        <div class="card-header"><h3>📊 الإحصائيات الشهرية</h3></div>
                        <div class="card-body">
                            <div class="bar-chart" id="monthlyChart">
                                <div class="bar-group">
                                    <div class="bar-stack">
                                        <div class="bar" style="height:45%;background:linear-gradient(180deg,#4f46e5,#7c3aed)"></div>
                                    </div>
                                    <div class="bar-label">يناير</div>
                                </div>
                                <div class="bar-group">
                                    <div class="bar-stack">
                                        <div class="bar" style="height:62%;background:linear-gradient(180deg,#4f46e5,#7c3aed)"></div>
                                    </div>
                                    <div class="bar-label">فبراير</div>
                                </div>
                                <div class="bar-group">
                                    <div class="bar-stack">
                                        <div class="bar" style="height:58%;background:linear-gradient(180deg,#4f46e5,#7c3aed)"></div>
                                    </div>
                                    <div class="bar-label">مارس</div>
                                </div>
                                <div class="bar-group">
                                    <div class="bar-stack">
                                        <div class="bar" style="height:72%;background:linear-gradient(180deg,#4f46e5,#7c3aed)"></div>
                                    </div>
                                    <div class="bar-label">إبريل</div>
                                </div>
                                <div class="bar-group">
                                    <div class="bar-stack">
                                        <div class="bar" style="height:68%;background:linear-gradient(180deg,#4f46e5,#7c3aed)"></div>
                                    </div>
                                    <div class="bar-label">مايو</div>
                                </div>
                                <div class="bar-group">
                                    <div class="bar-stack">
                                        <div class="bar" style="height:75%;background:linear-gradient(180deg,#4f46e5,#7c3aed)"></div>
                                    </div>
                                    <div class="bar-label">يونيو</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header"><h3>🎯 توزيع الأداء</h3></div>
                        <div class="card-body">
                            <div class="donut-wrapper">
                                <div class="donut-chart">
                                    <svg viewBox="0 0 100 100" style="width:100%;height:100%">
                                        <circle cx="50" cy="50" r="45" fill="none" stroke="#4f46e5" stroke-width="12" stroke-dasharray="282 376" stroke-linecap="round"/>
                                        <circle cx="50" cy="50" r="45" fill="none" stroke="#10b981" stroke-width="12" stroke-dasharray="75 376" stroke-dashoffset="-282" stroke-linecap="round"/>
                                        <circle cx="50" cy="50" r="45" fill="none" stroke="#f59e0b" stroke-width="12" stroke-dasharray="69 376" stroke-dashoffset="-357" stroke-linecap="round"/>
                                        <circle cx="50" cy="50" r="45" fill="none" stroke="#8b5cf6" stroke-width="12" stroke-dasharray="54 376" stroke-dashoffset="-426" stroke-linecap="round"/>
                                    </svg>
                                    <div class="donut-center">
                                        <div class="perc">75%</div>
                                        <span>الإنجاز الكلي</span>
                                    </div>
                                </div>
                                <div class="donut-legend">
                                    <div class="legend-item"><div class="legend-dot" style="background:#4f46e5"></div> الإدارة <strong>75%</strong></div>
                                    <div class="legend-item"><div class="legend-dot" style="background:#10b981"></div> التصوير <strong>20%</strong></div>
                                    <div class="legend-item"><div class="legend-dot" style="background:#f59e0b"></div> المونتاج <strong>18%</strong></div>
                                    <div class="legend-item"><div class="legend-dot" style="background:#8b5cf6"></div> السوشال ميديا <strong>14%</strong></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="grid-2">
                    <div class="card">
                        <div class="card-header"><h3>🕐 آخر النشاطات</h3></div>
                        <div class="card-body">
                            <div class="timeline" id="activityTimeline">
                                <div class="timeline-item"><div class="timeline-time">09:02 ص</div><div class="timeline-text">سجّل <strong>أحمد العلي</strong> دخوله — IP مطابق ✅</div></div>
                                <div class="timeline-item"><div class="timeline-time">09:15 ص</div><div class="timeline-text">تأخرت <strong>سارة الخالدي</strong> 15 دقيقة ⚠️</div></div>
                            </div>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-header"><h3>🏆 أفضل الموظفين أداءً</h3></div>
                        <div class="card-body" style="padding:0">
                            <table id="topEmployeesTable">
                                <thead><tr><th>الموظف</th><th>الإنجاز</th><th>التقييم</th></tr></thead>
                                <tbody id="topEmployeesList">
                                    <tr><td colspan="3" style="text-align:center;padding:20px">جاري التحميل...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ===== MY DASHBOARD PAGE ===== -->
            <div class="page" id="page-my-dashboard">
                <h2 style="margin-bottom:24px">لوحتي الشخصية</h2>
                <div class="card">
                    <div class="card-header"><h3>ملخص أدائي</h3></div>
                    <div class="card-body">
                        <div style="text-align:center;padding:40px">
                            <p style="color:var(--text-secondary)">معلومات أداء الموظف الشخصية</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ===== ATTENDANCE PAGE ===== -->
            <div class="page" id="page-attendance">
                <div class="clock-section">
                    <div class="current-time" id="currentTime">09:30:45</div>
                    <div class="current-date" id="currentDate">الخميس، 11 أبريل 2024</div>
                    <div class="clock-actions">
                        <button class="clock-btn check-in" onclick="checkIn()" id="checkInBtn">✅ تسجيل الدخول</button>
                        <button class="clock-btn check-out" onclick="checkOut()" id="checkOutBtn" disabled>❌ تسجيل الخروج</button>
                    </div>
                </div>
                <div class="card" style="margin-top:28px">
                    <div class="card-header"><h3>سجل الحضور</h3></div>
                    <div class="card-body" style="padding:0">
                        <table id="attendanceTable">
                            <thead><tr><th>التاريخ</th><th>الدخول</th><th>الخروج</th><th>الحالة</th></tr></thead>
                            <tbody id="attendanceList">
                                <tr><td colspan="4" style="text-align:center;padding:20px">جاري التحميل...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- ===== WORKFLOW PAGE ===== -->
            <div class="page" id="page-workflow">
                <div style="margin-bottom:24px">
                    <h2 style="margin-bottom:16px">سير العمل</h2>
                    <div class="tabs">
                        <button class="tab-btn active" onclick="switchWorkView('all')">الكل</button>
                        <button class="tab-btn" onclick="switchWorkView('my')">مهامي</button>
                        <button class="tab-btn" onclick="switchWorkView('team')">فريقي</button>
                    </div>
                </div>

                <div class="quick-actions">
                    <div class="quick-action" onclick="openModal('addTaskModal')">
                        <span>➕</span>
                        <span>إضافة مهمة جديدة</span>
                    </div>
                    <div class="quick-action" onclick="openModal('addProjectModal')">
                        <span>📁</span>
                        <span>مشروع جديد</span>
                    </div>
                </div>

                <div id="tasksList">
                    <div class="task-item">
                        <div class="task-header">
                            <span class="task-title">حملة رمضان 2024</span>
                            <span class="badge in-progress">قيد الإنجاز</span>
                        </div>
                        <div class="task-meta">
                            <span>👤 أحمد العلي</span>
                            <span>📅 تاريخ الاستحقاق: 20 أبريل</span>
                            <span>🏷️ تصميم</span>
                        </div>
                        <div class="task-progress">
                            <div class="progress-bar"><div class="progress-fill blue" style="width:75%"></div></div>
                            <span class="perc">75%</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ===== PERFORMANCE PAGE ===== -->
            <div class="page" id="page-performance">
                <h2 style="margin-bottom:24px">الأداء والتقييم</h2>
                <div class="grid-2">
                    <div class="card">
                        <div class="card-header"><h3>تقييمات الموظفين</h3></div>
                        <div class="card-body" style="padding:0">
                            <table id="performanceTable">
                                <thead><tr><th>الموظف</th><th>التقييم</th><th>الحالة</th></tr></thead>
                                <tbody id="performanceList">
                                    <tr><td colspan="3" style="text-align:center;padding:20px">جاري التحميل...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-header"><h3>ملخص الأداء</h3></div>
                        <div class="card-body">
                            <p style="color:var(--text-secondary);text-align:center;padding:40px">سيتم عرض ملخص الأداء هنا</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ===== EMPLOYEES PAGE ===== -->
            <div class="page" id="page-employees">
                <div style="margin-bottom:24px;display:flex;justify-content:space-between;align-items:center">
                    <h2>إدارة الموظفين</h2>
                    <button class="btn btn-primary" onclick="openModal('addEmployeeModal')">➕ موظف جديد</button>
                </div>

                <div class="emp-profile-grid" id="employeesGrid">
                    <div style="grid-column:1/-1;text-align:center;padding:40px">جاري التحميل...</div>
                </div>
            </div>

            <!-- ===== SALARIES PAGE ===== -->
            <div class="page" id="page-salaries">
                <h2 style="margin-bottom:24px">إدارة الرواتب</h2>
                <div class="salary-summary">
                    <div class="salary-box total">
                        <div class="sal-label">إجمالي الرواتب الشهرية</div>
                        <div class="sal-value" id="totalSalary">₪ 0</div>
                    </div>
                    <div class="salary-box deductions">
                        <div class="sal-label">الخصومات</div>
                        <div class="sal-value" id="totalDeductions">₪ 0</div>
                    </div>
                    <div class="salary-box bonuses">
                        <div class="sal-label">المكافآت والعلاوات</div>
                        <div class="sal-value" id="totalBonuses">₪ 0</div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header"><h3>كشف الرواتب</h3></div>
                    <div class="card-body" style="padding:0">
                        <table id="salariesTable">
                            <thead><tr><th>الموظف</th><th>الراتب الأساسي</th><th>العلاوات</th><th>الخصومات</th><th>الصافي</th><th>الحالة</th></tr></thead>
                            <tbody id="salariesList">
                                <tr><td colspan="6" style="text-align:center;padding:20px">جاري التحميل...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- ===== LEAVES PAGE ===== -->
            <div class="page" id="page-leaves">
                <h2 style="margin-bottom:24px">إدارة الإجازات</h2>
                <div class="card">
                    <div class="card-header">
                        <h3>طلبات الإجازات</h3>
                        <button class="btn btn-primary btn-sm" onclick="openModal('requestLeaveModal')">➕ طلب إجازة</button>
                    </div>
                    <div class="card-body" style="padding:0">
                        <table id="leavesTable">
                            <thead><tr><th>الموظف</th><th>نوع الإجازة</th><th>من</th><th>إلى</th><th>الحالة</th></tr></thead>
                            <tbody id="leavesList">
                                <tr><td colspan="5" style="text-align:center;padding:20px">جاري التحميل...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- ===== CALENDAR PAGE ===== -->
            <div class="page" id="page-calendar">
                <h2 style="margin-bottom:24px">التقويم</h2>
                <div class="card">
                    <div class="card-header"><h3>التقويم الشهري</h3></div>
                    <div class="card-body">
                        <p style="color:var(--text-secondary);text-align:center;padding:40px">تقويم الأحداث والأنشطة</p>
                    </div>
                </div>
            </div>

            <!-- ===== MESSAGES PAGE ===== -->
            <div class="page" id="page-messages">
                <h2 style="margin-bottom:24px">الرسائل والقنوات</h2>
                <div class="grid-2" style="grid-template-columns:300px 1fr;gap:0">
                    <div class="card" style="border-radius:14px 0 0 14px;margin:0">
                        <div class="card-header" style="border-bottom:1px solid var(--border)"><h3>القنوات</h3></div>
                        <div class="card-body" id="channelsList">
                            <div class="quick-action" style="width:100%;margin:0;padding:10px 0;justify-content:flex-start">
                                <span>📢 قناة عامة</span>
                            </div>
                            <div class="quick-action" style="width:100%;margin:0;padding:10px 0;justify-content:flex-start">
                                <span>👥 فريق التصميم</span>
                            </div>
                        </div>
                    </div>
                    <div class="card" style="border-radius:0 14px 14px 0;margin:0">
                        <div class="card-header" style="border-bottom:1px solid var(--border)"><h3>المحادثات</h3></div>
                        <div class="card-body" id="messagesList">
                            <p style="color:var(--text-secondary);text-align:center">اختر قناة للمراسلة</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ===== MEDIA LIBRARY PAGE ===== -->
            <div class="page" id="page-media">
                <div style="margin-bottom:24px;display:flex;justify-content:space-between;align-items:center">
                    <h2>المكتبة الإعلامية</h2>
                    <button class="btn btn-primary" onclick="openModal('uploadMediaModal')">📤 رفع ملف</button>
                </div>

                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px" id="mediaGrid">
                    <div style="grid-column:1/-1;text-align:center;padding:40px">جاري التحميل...</div>
                </div>
            </div>

            <!-- ===== KNOWLEDGE BASE PAGE ===== -->
            <div class="page" id="page-knowledge">
                <h2 style="margin-bottom:24px">قاعدة المعارف</h2>
                <div class="card">
                    <div class="card-header">
                        <h3>المقالات والموارد</h3>
                        <button class="btn btn-primary btn-sm" onclick="openModal('addKnowledgeModal')">➕ مقالة جديدة</button>
                    </div>
                    <div class="card-body" id="knowledgeList">
                        <p style="color:var(--text-secondary);text-align:center;padding:20px">جاري التحميل...</p>
                    </div>
                </div>
            </div>

            <!-- ===== TIME TRACKER PAGE ===== -->
            <div class="page" id="page-timetracker">
                <h2 style="margin-bottom:24px">تتبع الوقت</h2>
                <div class="card">
                    <div class="card-header"><h3>ساعة التتبع</h3></div>
                    <div class="card-body" style="text-align:center">
                        <div id="timerDisplay" style="font-size:48px;font-weight:900;margin-bottom:20px">00:00:00</div>
                        <div style="display:flex;gap:12px;justify-content:center">
                            <button class="btn btn-primary" onclick="toggleTimer()">▶️ ابدأ التتبع</button>
                            <button class="btn btn-outline" onclick="resetTimer()">🔄 إعادة تعيين</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ===== CLIENTS PAGE ===== -->
            <div class="page" id="page-clients">
                <div style="margin-bottom:24px;display:flex;justify-content:space-between;align-items:center">
                    <h2>إدارة العملاء</h2>
                    <button class="btn btn-primary" onclick="openModal('addClientModal')">➕ عميل جديد</button>
                </div>

                <div class="card">
                    <div class="card-body" style="padding:0">
                        <table id="clientsTable">
                            <thead><tr><th>اسم العميل</th><th>البريد الإلكتروني</th><th>الهاتف</th><th>المشاريع</th></tr></thead>
                            <tbody id="clientsList">
                                <tr><td colspan="4" style="text-align:center;padding:20px">جاري التحميل...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- ===== ROLES PAGE ===== -->
            <div class="page" id="page-roles">
                <h2 style="margin-bottom:24px">الأدوار والصلاحيات</h2>
                <div class="card">
                    <div class="card-header"><h3>إدارة الأدوار</h3></div>
                    <div class="card-body" id="rolesList">
                        <p style="color:var(--text-secondary);text-align:center;padding:20px">جاري التحميل...</p>
                    </div>
                </div>
            </div>

            <!-- ===== REPORTS PAGE ===== -->
            <div class="page" id="page-reports">
                <h2 style="margin-bottom:24px">التقارير</h2>
                <div class="quick-actions">
                    <div class="quick-action">📊 تقرير الأداء</div>
                    <div class="quick-action">💰 تقرير الرواتب</div>
                    <div class="quick-action">📋 تقرير الحضور</div>
                    <div class="quick-action">🏖️ تقرير الإجازات</div>
                </div>
                <div class="card">
                    <div class="card-body">
                        <p style="color:var(--text-secondary);text-align:center;padding:40px">اختر نوع التقرير المطلوب</p>
                    </div>
                </div>
            </div>

            <!-- ===== SECURITY PAGE ===== -->
            <div class="page" id="page-security">
                <h2 style="margin-bottom:24px">إعدادات الأمان</h2>
                <div class="security-grid">
                    <div class="security-card">
                        <div class="sec-icon blue">🔐</div>
                        <h4>كلمة المرور</h4>
                        <p>تحديث كلمة المرور بشكل دوري</p>
                        <button class="btn btn-primary btn-sm" style="margin-top:12px;width:100%">تحديث</button>
                    </div>
                    <div class="security-card">
                        <div class="sec-icon green">📱</div>
                        <h4>المصادقة الثنائية</h4>
                        <p>تفعيل المصادقة عبر الهاتف الذكي</p>
                        <button class="btn btn-primary btn-sm" style="margin-top:12px;width:100%">تفعيل</button>
                    </div>
                    <div class="security-card">
                        <div class="sec-icon orange">🖥️</div>
                        <h4>الأجهزة الموثوقة</h4>
                        <p>إدارة الأجهزة المصرح بها</p>
                        <button class="btn btn-primary btn-sm" style="margin-top:12px;width:100%">إدارة</button>
                    </div>
                </div>
            </div>

            <!-- ===== SETTINGS PAGE ===== -->
            <div class="page" id="page-settings">
                <h2 style="margin-bottom:24px">الإعدادات</h2>
                <div class="card">
                    <div class="card-header"><h3>الإعدادات العامة</h3></div>
                    <div class="card-body">
                        <div class="setting-row">
                            <span>🌙 الوضع الليلي</span>
                            <button class="btn btn-sm" onclick="toggleTheme()">تفعيل</button>
                        </div>
                        <div class="setting-row">
                            <span>🔔 التنبيهات</span>
                            <button class="btn btn-sm">تفعيل</button>
                        </div>
                        <div class="setting-row">
                            <span>🌐 اللغة</span>
                            <span class="count">العربية</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- MODALS -->
    <div class="modal-overlay" id="addTaskModal">
        <div class="modal">
            <div class="modal-header">
                <h3>إضافة مهمة جديدة</h3>
                <button class="modal-close" onclick="closeModal('addTaskModal')">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>عنوان المهمة</label>
                    <input type="text" placeholder="أدخل عنوان المهمة">
                </div>
                <div class="form-group">
                    <label>الوصف</label>
                    <textarea placeholder="أدخل وصف المهمة" rows="4"></textarea>
                </div>
                <div class="form-group">
                    <label>المسؤول</label>
                    <select>
                        <option>اختر موظفاً</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>تاريخ الاستحقاق</label>
                    <input type="date">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('addTaskModal')">إلغاء</button>
                <button class="btn btn-primary">حفظ المهمة</button>
            </div>
        </div>
    </div>

    <div class="modal-overlay" id="addEmployeeModal">
        <div class="modal">
            <div class="modal-header">
                <h3>إضافة موظف جديد</h3>
                <button class="modal-close" onclick="closeModal('addEmployeeModal')">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>الاسم الكامل</label>
                    <input type="text" placeholder="أدخل الاسم">
                </div>
                <div class="form-group">
                    <label>البريد الإلكتروني</label>
                    <input type="email" placeholder="أدخل البريد">
                </div>
                <div class="form-group">
                    <label>القسم</label>
                    <select>
                        <option>اختر القسم</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>المسمى الوظيفي</label>
                    <input type="text" placeholder="أدخل المسمى">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('addEmployeeModal')">إلغاء</button>
                <button class="btn btn-primary">حفظ الموظف</button>
            </div>
        </div>
    </div>

    <div class="modal-overlay" id="uploadMediaModal">
        <div class="modal">
            <div class="modal-header">
                <h3>رفع ملف إعلامي</h3>
                <button class="modal-close" onclick="closeModal('uploadMediaModal')">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>اختر الملف</label>
                    <input type="file" accept="image/*,video/*">
                </div>
                <div class="form-group">
                    <label>الوصف</label>
                    <textarea placeholder="أدخل وصف الملف" rows="3"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('uploadMediaModal')">إلغاء</button>
                <button class="btn btn-primary">رفع الملف</button>
            </div>
        </div>
    </div>

    <div class="modal-overlay" id="addClientModal">
        <div class="modal">
            <div class="modal-header">
                <h3>إضافة عميل جديد</h3>
                <button class="modal-close" onclick="closeModal('addClientModal')">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>اسم العميل</label>
                    <input type="text" placeholder="أدخل اسم العميل">
                </div>
                <div class="form-group">
                    <label>البريد الإلكتروني</label>
                    <input type="email" placeholder="أدخل البريد">
                </div>
                <div class="form-group">
                    <label>الهاتف</label>
                    <input type="tel" placeholder="أدخل الهاتف">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('addClientModal')">إلغاء</button>
                <button class="btn btn-primary">حفظ العميل</button>
            </div>
        </div>
    </div>

    <div class="modal-overlay" id="requestLeaveModal">
        <div class="modal">
            <div class="modal-header">
                <h3>طلب إجازة</h3>
                <button class="modal-close" onclick="closeModal('requestLeaveModal')">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>نوع الإجازة</label>
                    <select>
                        <option>سنوية</option>
                        <option>مرضية</option>
                        <option>بدون راتب</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>من التاريخ</label>
                    <input type="date">
                </div>
                <div class="form-group">
                    <label>إلى التاريخ</label>
                    <input type="date">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('requestLeaveModal')">إلغاء</button>
                <button class="btn btn-primary">إرسال الطلب</button>
            </div>
        </div>
    </div>

    <div class="modal-overlay" id="addKnowledgeModal">
        <div class="modal">
            <div class="modal-header">
                <h3>إضافة مقالة</h3>
                <button class="modal-close" onclick="closeModal('addKnowledgeModal')">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>العنوان</label>
                    <input type="text" placeholder="أدخل عنوان المقالة">
                </div>
                <div class="form-group">
                    <label>المحتوى</label>
                    <textarea placeholder="أدخل محتوى المقالة" rows="6"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('addKnowledgeModal')">إلغاء</button>
                <button class="btn btn-primary">حفظ المقالة</button>
            </div>
        </div>
    </div>

    <script>
        // API Helper Function
        async function api(action, params = {}) {
            try {
                const response = await fetch('api.php?action=' + action, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(params)
                });
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('API Error:', error);
                return { error: error.message };
            }
        }

        // Page Navigation
        function showPage(pageId) {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById('page-' + pageId).classList.add('active');
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            event.target.closest('.nav-item').classList.add('active');

            const titles = {
                'dashboard': 'لوحة التحكم',
                'my-dashboard': 'لوحتي الشخصية',
                'attendance': 'الحضور والغياب',
                'workflow': 'سير العمل',
                'performance': 'الأداء والتقييم',
                'employees': 'إدارة الموظفين',
                'salaries': 'إدارة الرواتب',
                'leaves': 'إدارة الإجازات',
                'calendar': 'التقويم',
                'messages': 'الرسائل والقنوات',
                'media': 'المكتبة الإعلامية',
                'knowledge': 'قاعدة المعارف',
                'timetracker': 'تتبع الوقت',
                'clients': 'إدارة العملاء',
                'roles': 'الأدوار والصلاحيات',
                'reports': 'التقارير',
                'security': 'إعدادات الأمان',
                'settings': 'الإعدادات'
            };
            document.getElementById('pageTitle').textContent = titles[pageId] || 'ميديا برو';
            document.getElementById('breadcrumb').textContent = 'الرئيسية / ' + titles[pageId];

            if (pageId === 'dashboard') loadDashboard();
            else if (pageId === 'attendance') loadAttendance();
            else if (pageId === 'workflow') loadTasks();
            else if (pageId === 'employees') loadEmployees();
            else if (pageId === 'salaries') loadSalaries();
            else if (pageId === 'leaves') loadLeaves();
            else if (pageId === 'messages') loadMessages();
            else if (pageId === 'media') loadMedia();
            else if (pageId === 'knowledge') loadKnowledge();
            else if (pageId === 'clients') loadClients();
        }

        // Update Clock
        function updateClock() {
            const now = new Date();
            const time = now.toLocaleTimeString('ar-SA', { hour12: true });
            const date = now.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            const el = document.getElementById('currentTime');
            if (el) el.textContent = time;

            const dateEl = document.getElementById('currentDate');
            if (dateEl) dateEl.textContent = date;
        }
        setInterval(updateClock, 1000);
        updateClock();

        // Attendance Functions
        async function checkIn() {
            const result = await api('attendance_checkin');
            if (!result.error) {
                document.getElementById('checkInBtn').disabled = true;
                document.getElementById('checkOutBtn').disabled = false;
                loadAttendance();
            }
        }

        async function checkOut() {
            const result = await api('attendance_checkout');
            if (!result.error) {
                document.getElementById('checkOutBtn').disabled = true;
                loadAttendance();
            }
        }

        async function loadAttendance() {
            const result = await api('get_attendance');
            if (result.data) {
                const tbody = document.getElementById('attendanceList');
                tbody.innerHTML = result.data.map(att => `
                    <tr>
                        <td>${att.date}</td>
                        <td>${att.check_in || '-'}</td>
                        <td>${att.check_out || '-'}</td>
                        <td><span class="badge ${att.status.toLowerCase()}">${att.status}</span></td>
                    </tr>
                `).join('');
            }
        }

        // Dashboard Functions
        async function loadDashboard() {
            const result = await api('dashboard_stats');
            if (result.data) {
                const stats = result.data;
                document.getElementById('stat-active-emps').textContent = stats.active_employees || 24;
                document.getElementById('stat-completed').textContent = stats.completed_tasks || 156;
                document.getElementById('stat-pending-salary').textContent = stats.pending_salaries || 3;
                document.getElementById('stat-remaining-leaves').textContent = stats.remaining_leaves || 48;
            }
            loadTopEmployees();
            loadNotifications();
        }

        async function loadTopEmployees() {
            const result = await api('get_top_employees');
            if (result.data) {
                const tbody = document.getElementById('topEmployeesList');
                tbody.innerHTML = result.data.slice(0, 3).map(emp => `
                    <tr>
                        <td>
                            <div class="emp-info">
                                <div class="emp-avatar" style="background:linear-gradient(135deg,#4f46e5,#7c3aed)">${emp.initials}</div>
                                <div>
                                    <div class="emp-name">${emp.name}</div>
                                    <div class="emp-dept">${emp.department}</div>
                                </div>
                            </div>
                        </td>
                        <td>
                            <div style="display:flex;align-items:center;gap:10px">
                                <div class="progress-bar" style="width:120px;flex:1">
                                    <div class="progress-fill green" style="width:${emp.performance}%"></div>
                                </div>
                                <span style="font-weight:800;font-size:13px">${emp.performance}%</span>
                            </div>
                        </td>
                        <td>
                            <div class="stars">
                                ${'<span class="star filled">★</span>'.repeat(5)}
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
        }

        // Task Functions
        async function loadTasks() {
            const result = await api('get_tasks');
            if (result.data) {
                const list = document.getElementById('tasksList');
                list.innerHTML = result.data.map(task => `
                    <div class="task-item ${task.status === 'Overdue' ? 'overdue' : ''}">
                        <div class="task-header">
                            <span class="task-title">${task.title}</span>
                            <span class="badge ${task.status.toLowerCase().replace(' ', '-')}">${task.status}</span>
                        </div>
                        <div class="task-meta">
                            <span>👤 ${task.assigned_to}</span>
                            <span>📅 تاريخ الاستحقاق: ${task.due_date}</span>
                            <span>🏷️ ${task.category}</span>
                        </div>
                        <div class="task-progress">
                            <div class="progress-bar"><div class="progress-fill blue" style="width:${task.progress}%"></div></div>
                            <span class="perc">${task.progress}%</span>
                        </div>
                    </div>
                `).join('');
            }
        }

        // Employee Functions
        async function loadEmployees() {
            const result = await api('get_employees');
            if (result.data) {
                const grid = document.getElementById('employeesGrid');
                grid.innerHTML = result.data.map(emp => `
                    <div class="emp-profile-card">
                        <div class="emp-avatar-lg" style="background:linear-gradient(135deg,#4f46e5,#7c3aed)">${emp.initials}</div>
                        <div class="emp-name">${emp.name}</div>
                        <div class="emp-dept">${emp.department}</div>
                        <div class="emp-stats">
                            <div class="emp-stat-item">
                                <div class="emp-stat-val">${emp.projects_count}</div>
                                <div class="emp-stat-label">مشاريع</div>
                            </div>
                            <div class="emp-stat-item">
                                <div class="emp-stat-val">${emp.tasks_count}</div>
                                <div class="emp-stat-label">مهام</div>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        }

        // Salary Functions
        async function loadSalaries() {
            const result = await api('get_salaries');
            if (result.data) {
                let total = 0, deductions = 0, bonuses = 0;
                const tbody = document.getElementById('salariesList');
                tbody.innerHTML = result.data.map(sal => {
                    total += sal.basic_salary || 0;
                    deductions += sal.deductions || 0;
                    bonuses += sal.bonuses || 0;
                    return `
                        <tr>
                            <td><strong>${sal.employee_name}</strong></td>
                            <td>₪ ${sal.basic_salary || 0}</td>
                            <td>₪ ${sal.bonuses || 0}</td>
                            <td>₪ ${sal.deductions || 0}</td>
                            <td>₪ ${(sal.basic_salary || 0) + (sal.bonuses || 0) - (sal.deductions || 0)}</td>
                            <td><span class="badge ${sal.status.toLowerCase()}">${sal.status}</span></td>
                        </tr>
                    `;
                }).join('');
                document.getElementById('totalSalary').textContent = '₪ ' + total;
                document.getElementById('totalDeductions').textContent = '₪ ' + deductions;
                document.getElementById('totalBonuses').textContent = '₪ ' + bonuses;
            }
        }

        // Leave Functions
        async function loadLeaves() {
            const result = await api('get_leaves');
            if (result.data) {
                const tbody = document.getElementById('leavesList');
                tbody.innerHTML = result.data.map(leave => `
                    <tr>
                        <td><strong>${leave.employee_name}</strong></td>
                        <td>${leave.leave_type}</td>
                        <td>${leave.from_date}</td>
                        <td>${leave.to_date}</td>
                        <td><span class="badge ${leave.status.toLowerCase()}">${leave.status}</span></td>
                    </tr>
                `).join('');
            }
        }

        // Message Functions
        async function loadMessages() {
            const result = await api('get_channels');
            if (result.data) {
                const channelsList = document.getElementById('channelsList');
                channelsList.innerHTML = result.data.map((ch, idx) => `
                    <div class="quick-action" style="width:100%;margin:0;padding:10px 0;justify-content:flex-start" onclick="loadChannelMessages('${ch.id}')">
                        <span>${ch.icon} ${ch.name}</span>
                    </div>
                `).join('');
            }
        }

        async function loadChannelMessages(channelId) {
            const result = await api('get_messages', { channel_id: channelId });
            if (result.data) {
                const list = document.getElementById('messagesList');
                list.innerHTML = result.data.map(msg => `
                    <div style="padding:10px 0;border-bottom:1px solid var(--border-light)">
                        <strong>${msg.sender}</strong>
                        <p style="color:var(--text-secondary);font-size:13px;margin-top:4px">${msg.content}</p>
                        <span style="color:var(--text-tertiary);font-size:11px">${msg.timestamp}</span>
                    </div>
                `).join('');
            }
        }

        // Media Functions
        async function loadMedia() {
            const result = await api('get_media');
            if (result.data) {
                const grid = document.getElementById('mediaGrid');
                grid.innerHTML = result.data.map(media => `
                    <div style="border:1px solid var(--border);border-radius:12px;padding:12px;text-align:center">
                        <div style="width:100%;height:140px;background:var(--bg-secondary);border-radius:8px;margin-bottom:10px;display:flex;align-items:center;justify-content:center;font-size:32px">
                            ${media.type.includes('image') ? '📷' : '🎬'}
                        </div>
                        <p style="font-size:13px;font-weight:600;margin-bottom:4px">${media.name}</p>
                        <span style="color:var(--text-secondary);font-size:12px">${media.size}</span>
                    </div>
                `).join('');
            }
        }

        // Knowledge Functions
        async function loadKnowledge() {
            const result = await api('get_knowledge');
            if (result.data) {
                const list = document.getElementById('knowledgeList');
                list.innerHTML = result.data.map(kb => `
                    <div style="padding:14px 0;border-bottom:1px solid var(--border-light)">
                        <strong>${kb.title}</strong>
                        <p style="color:var(--text-secondary);font-size:13px;margin-top:6px">${kb.content.substring(0, 100)}...</p>
                        <span style="color:var(--text-tertiary);font-size:11px">${kb.created_at}</span>
                    </div>
                `).join('');
            }
        }

        // Client Functions
        async function loadClients() {
            const result = await api('get_clients');
            if (result.data) {
                const tbody = document.getElementById('clientsList');
                tbody.innerHTML = result.data.map(client => `
                    <tr>
                        <td><strong>${client.name}</strong></td>
                        <td>${client.email}</td>
                        <td>${client.phone}</td>
                        <td>${client.projects_count}</td>
                    </tr>
                `).join('');
            }
        }

        // Notification Functions
        async function loadNotifications() {
            const result = await api('get_notifications');
            if (result.data) {
                const list = document.getElementById('notifList');
                document.getElementById('notifCount').textContent = result.data.length;
                list.innerHTML = result.data.map(notif => `
                    <div class="notif-item">
                        <div class="notif-icon-box" style="background:var(--primary-light);color:var(--primary)">${notif.icon || '📢'}</div>
                        <div>
                            <div class="notif-text">${notif.title}</div>
                            <div class="notif-sub">${notif.message}</div>
                        </div>
                    </div>
                `).join('');
            }
        }

        // Timer Functions
        let timerInterval, timerSeconds = 0;
        function toggleTimer() {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
                api('timer_stop', { seconds: timerSeconds });
            } else {
                api('timer_start');
                timerInterval = setInterval(() => {
                    timerSeconds++;
                    const h = Math.floor(timerSeconds / 3600).toString().padStart(2, '0');
                    const m = Math.floor((timerSeconds % 3600) / 60).toString().padStart(2, '0');
                    const s = (timerSeconds % 60).toString().padStart(2, '0');
                    document.getElementById('timerDisplay').textContent = h + ':' + m + ':' + s;
                }, 1000);
            }
        }

        function resetTimer() {
            if (timerInterval) clearInterval(timerInterval);
            timerSeconds = 0;
            document.getElementById('timerDisplay').textContent = '00:00:00';
        }

        // UI Functions
        function toggleTheme() {
            const html = document.documentElement;
            const theme = html.getAttribute('data-theme');
            html.setAttribute('data-theme', theme === 'light' ? 'dark' : 'light');
            localStorage.setItem('theme', theme === 'light' ? 'dark' : 'light');
        }

        function toggleSidebar() {
            document.getElementById('sidebar').classList.toggle('show');
        }

        function toggleNotif() {
            document.getElementById('notifPanel').classList.toggle('show');
        }

        function openModal(modalId) {
            document.getElementById(modalId).classList.add('show');
        }

        function closeModal(modalId) {
            document.getElementById(modalId).classList.remove('show');
        }

        function switchWorkView(view) {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            loadTasks();
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            const theme = localStorage.getItem('theme') || 'light';
            document.documentElement.setAttribute('data-theme', theme);
            loadDashboard();
        });

        // Close modal on overlay click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('show');
                }
            });
        });
    </script>
</body>
</html>
