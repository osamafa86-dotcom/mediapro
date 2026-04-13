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

        /* ===== مراقبة النشر - Publish Monitor ===== */
        .pm-stats-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px;margin-bottom:24px}
        .pm-stat-card{background:var(--white);border-radius:var(--radius);padding:20px;text-align:center;border:1px solid var(--border);transition:var(--transition)}
        .pm-stat-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md)}
        .pm-stat-card .pm-stat-number{font-size:32px;font-weight:800;margin:8px 0 4px}
        .pm-stat-card .pm-stat-label{font-size:13px;color:var(--text-secondary)}
        .pm-stat-card.total .pm-stat-number{color:var(--primary)}
        .pm-stat-card.active-stat .pm-stat-number{color:var(--success)}
        .pm-stat-card.idle-stat .pm-stat-number{color:var(--warning)}
        .pm-stat-card.stopped-stat .pm-stat-number{color:var(--danger)}
        .pm-stat-card.posts-stat .pm-stat-number{color:var(--info)}

        .pm-toolbar{display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap}
        .pm-toolbar .filter-select{padding:10px 16px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--white);font-family:'Tajawal',sans-serif;font-size:14px;color:var(--text);cursor:pointer}
        .pm-toolbar .btn{white-space:nowrap}
        .pm-auto-refresh{display:flex;align-items:center;gap:6px;margin-right:auto;font-size:13px;color:var(--text-secondary)}
        .pm-auto-refresh input[type="checkbox"]{width:16px;height:16px;accent-color:var(--primary)}

        .pm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
        .pm-card{background:var(--white);border-radius:var(--radius);padding:20px;border:2px solid var(--border);transition:var(--transition);position:relative;overflow:hidden}
        .pm-card:hover{box-shadow:var(--shadow-md);transform:translateY(-2px)}
        .pm-card.status-active{border-color:var(--success)}
        .pm-card.status-idle{border-color:var(--warning);animation:pm-pulse 2s ease-in-out infinite}
        .pm-card.status-stopped{border-color:var(--danger);animation:pm-pulse 1.5s ease-in-out infinite}
        .pm-card.status-paused{border-color:var(--text-tertiary);opacity:0.7}

        .pm-card-header{display:flex;align-items:center;gap:12px;margin-bottom:14px}
        .pm-card-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0}
        .pm-card-icon.facebook{background:rgba(24,119,242,0.1)}
        .pm-card-icon.instagram{background:rgba(225,48,108,0.1)}
        .pm-card-icon.twitter{background:rgba(29,155,240,0.1)}
        .pm-card-icon.telegram{background:rgba(0,136,204,0.1)}
        .pm-card-icon.whatsapp{background:rgba(37,211,102,0.1)}
        .pm-card-icon.youtube{background:rgba(255,0,0,0.1)}
        .pm-card-icon.tiktok{background:rgba(0,0,0,0.1)}
        .pm-card-icon.snapchat{background:rgba(255,252,0,0.15)}
        .pm-card-icon.linkedin{background:rgba(0,119,181,0.1)}
        .pm-card-icon.other{background:rgba(107,114,128,0.1)}

        .pm-card-info h4{font-size:14px;font-weight:700;margin-bottom:3px;color:var(--text)}
        .pm-card-info span{font-size:12px;color:var(--text-secondary)}

        .pm-card-status{position:absolute;top:16px;left:16px;width:12px;height:12px;border-radius:50%}
        .pm-card-status.active{background:var(--success);box-shadow:0 0 8px rgba(16,185,129,0.5)}
        .pm-card-status.idle{background:var(--warning);box-shadow:0 0 8px rgba(245,158,11,0.5)}
        .pm-card-status.stopped{background:var(--danger);box-shadow:0 0 8px rgba(239,68,68,0.5)}
        .pm-card-status.paused{background:var(--text-tertiary)}

        .pm-card-body{display:flex;flex-direction:column;gap:10px}
        .pm-card-row{display:flex;justify-content:space-between;align-items:center;font-size:13px}
        .pm-card-row .label{color:var(--text-secondary)}
        .pm-card-row .value{font-weight:600;color:var(--text)}
        .pm-card-row .value.danger{color:var(--danger)}
        .pm-card-row .value.warning{color:var(--warning)}
        .pm-card-row .value.success{color:var(--success)}

        .pm-card-timer{text-align:center;padding:10px;border-radius:var(--radius-sm);margin-top:6px;font-size:20px;font-weight:800;letter-spacing:2px}
        .pm-card-timer.active{background:var(--success-light);color:var(--success)}
        .pm-card-timer.idle{background:var(--warning-light);color:var(--warning)}
        .pm-card-timer.stopped{background:var(--danger-light);color:var(--danger)}

        .pm-card-actions{display:flex;gap:8px;margin-top:10px}
        .pm-card-actions .btn{flex:1;padding:8px;font-size:12px;border-radius:8px}

        .pm-alert-banner{background:linear-gradient(135deg,#fef2f2,#fee2e2);border:1px solid rgba(239,68,68,0.3);border-radius:var(--radius);padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:14px}
        .pm-alert-banner .alert-icon{font-size:28px;animation:pm-shake 0.5s ease-in-out infinite alternate}
        .pm-alert-banner .alert-text{flex:1}
        .pm-alert-banner .alert-text strong{color:var(--danger);font-size:15px}
        .pm-alert-banner .alert-text p{color:var(--text-secondary);font-size:13px;margin-top:2px}

        @keyframes pm-pulse{0%,100%{opacity:1}50%{opacity:0.85}}
        @keyframes pm-shake{0%{transform:rotate(-5deg)}100%{transform:rotate(5deg)}}

        @media(max-width:1200px){.pm-stats-grid{grid-template-columns:repeat(3,1fr)}}
        @media(max-width:768px){.pm-stats-grid{grid-template-columns:repeat(2,1fr)}.pm-grid{grid-template-columns:1fr}}
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
                <div class="nav-item" onclick="showPage('publish-monitor')">
                    <div class="nav-icon">📡</div>
                    <span>مراقبة النشر</span>
                    <div class="nav-badge publish-alert-badge" id="publishAlertBadge" style="display:none;background:#ef4444">0</div>
                </div>
                <div class="nav-item" onclick="showPage('publish-report')">
                    <div class="nav-icon">📊</div>
                    <span>تقرير النشر</span>
                </div>
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
                    <div class="quick-action" onclick="alert('إدارة المشاريع قيد التطوير - سيتم تفعيلها قريباً')">
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

            <!-- ===== PUBLISH MONITOR PAGE ===== -->
            <div class="page" id="page-publish-monitor">
                <!-- تنبيه المنصات المتوقفة -->
                <div class="pm-alert-banner" id="pmAlertBanner" style="display:none">
                    <div class="alert-icon">🚨</div>
                    <div class="alert-text">
                        <strong>تنبيه! <span id="pmStoppedCount">0</span> منصات متوقفة عن النشر</strong>
                        <p>بعض المنصات تجاوزت الحد المسموح بدون نشر. يرجى المتابعة.</p>
                    </div>
                    <button class="btn btn-danger btn-sm" onclick="filterPlatforms('idle')">عرض المتوقفة</button>
                </div>

                <!-- حالة المراقبة التلقائية -->
                <div id="monitorStatusBarMain" style="background:var(--white);border:1px solid var(--border);border-radius:var(--radius);padding:14px 20px;margin-bottom:20px;display:flex;align-items:center;gap:12px">
                    <div id="monitorDotMain" style="width:10px;height:10px;border-radius:50%;background:var(--text-tertiary)"></div>
                    <span style="font-size:13px;color:var(--text-secondary)">المراقبة التلقائية: <strong id="monitorStatusTextMain">جاري التحقق...</strong></span>
                    <span style="font-size:12px;color:var(--text-tertiary);margin-right:auto" id="monitorLastRunMain"></span>
                    <a href="#" onclick="showPage('publish-report');return false" style="font-size:13px;color:var(--primary)">عرض التقرير</a>
                </div>

                <!-- إحصائيات -->
                <div class="pm-stats-grid">
                    <div class="pm-stat-card total">
                        <div class="pm-stat-label">إجمالي المنصات</div>
                        <div class="pm-stat-number" id="pmTotal">0</div>
                    </div>
                    <div class="pm-stat-card active-stat">
                        <div class="pm-stat-label">نشطة</div>
                        <div class="pm-stat-number" id="pmActive">0</div>
                    </div>
                    <div class="pm-stat-card idle-stat">
                        <div class="pm-stat-label">خاملة</div>
                        <div class="pm-stat-number" id="pmIdle">0</div>
                    </div>
                    <div class="pm-stat-card stopped-stat">
                        <div class="pm-stat-label">متوقفة</div>
                        <div class="pm-stat-number" id="pmStopped">0</div>
                    </div>
                    <div class="pm-stat-card posts-stat">
                        <div class="pm-stat-label">منشورات اليوم</div>
                        <div class="pm-stat-number" id="pmTodayPosts">0</div>
                    </div>
                </div>

                <!-- شريط الأدوات -->
                <div class="pm-toolbar">
                    <button class="btn btn-primary" onclick="openModal('addPlatformModal')">+ إضافة منصة</button>
                    <button class="btn btn-success" onclick="openModal('addPublishModal')">📝 تسجيل نشر</button>
                    <select class="filter-select" id="pmFilterType" onchange="loadPlatforms()">
                        <option value="">كل الأنواع</option>
                        <option value="facebook">فيسبوك</option>
                        <option value="instagram">إنستغرام</option>
                        <option value="twitter">تويتر</option>
                        <option value="telegram">تلغرام</option>
                        <option value="whatsapp">واتساب</option>
                        <option value="youtube">يوتيوب</option>
                        <option value="tiktok">تيك توك</option>
                        <option value="snapchat">سناب شات</option>
                        <option value="linkedin">لينكدإن</option>
                    </select>
                    <select class="filter-select" id="pmFilterStatus" onchange="loadPlatforms()">
                        <option value="all">كل الحالات</option>
                        <option value="active">نشطة فقط</option>
                        <option value="idle">خاملة/متوقفة</option>
                    </select>
                    <div class="pm-auto-refresh">
                        <input type="checkbox" id="pmAutoRefresh" checked onchange="toggleAutoRefresh()">
                        <label for="pmAutoRefresh">تحديث تلقائي (30 ثانية)</label>
                    </div>
                </div>

                <!-- شبكة المنصات -->
                <div class="pm-grid" id="pmPlatformsGrid">
                    <!-- يتم تعبئتها بـ JavaScript -->
                </div>
            </div>

            <!-- ===== PUBLISH REPORT PAGE ===== -->
            <div class="page" id="page-publish-report">
                <div class="pm-toolbar" style="margin-bottom:20px">
                    <h2 style="margin:0;flex:1">تقرير التزام النشر</h2>
                    <input type="date" id="reportDate" class="filter-select" onchange="loadIdleReport()">
                    <button type="button" class="btn btn-primary" onclick="loadIdleReport()">عرض التقرير</button>
                </div>

                <!-- حالة المراقبة -->
                <div id="monitorStatusBar" style="background:var(--white);border:1px solid var(--border);border-radius:var(--radius);padding:14px 20px;margin-bottom:20px;display:flex;align-items:center;gap:12px">
                    <div id="monitorDot" style="width:10px;height:10px;border-radius:50%;background:var(--text-tertiary)"></div>
                    <span style="font-size:13px;color:var(--text-secondary)">المراقبة التلقائية: <strong id="monitorStatusText">جاري التحقق...</strong></span>
                    <span style="font-size:12px;color:var(--text-tertiary);margin-right:auto" id="monitorLastRun"></span>
                </div>

                <!-- إحصائيات التقرير -->
                <div class="pm-stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:24px">
                    <div class="pm-stat-card active-stat">
                        <div class="pm-stat-label">نسبة الالتزام</div>
                        <div class="pm-stat-number" id="rptCompliance">--%</div>
                    </div>
                    <div class="pm-stat-card stopped-stat">
                        <div class="pm-stat-label">منصات تخلّفت</div>
                        <div class="pm-stat-number" id="rptIdlePlatforms">0</div>
                    </div>
                    <div class="pm-stat-card idle-stat">
                        <div class="pm-stat-label">مرات التوقف</div>
                        <div class="pm-stat-number" id="rptIdleEvents">0</div>
                    </div>
                    <div class="pm-stat-card posts-stat">
                        <div class="pm-stat-label">إجمالي دقائق التوقف</div>
                        <div class="pm-stat-number" id="rptIdleMinutes">0</div>
                    </div>
                </div>

                <!-- جدول ملخص المنصات -->
                <div class="card" style="margin-bottom:24px">
                    <div class="card-header"><h3>ملخص التزام المنصات</h3></div>
                    <div class="card-body" style="padding:0">
                        <table style="width:100%">
                            <thead>
                                <tr>
                                    <th style="text-align:right;padding:14px 16px">المنصة</th>
                                    <th style="text-align:right;padding:14px 16px">المسؤول</th>
                                    <th style="text-align:center;padding:14px 16px">مرات التوقف</th>
                                    <th style="text-align:center;padding:14px 16px">إجمالي التوقف</th>
                                    <th style="text-align:center;padding:14px 16px">أطول توقف</th>
                                    <th style="text-align:center;padding:14px 16px">الحالة</th>
                                </tr>
                            </thead>
                            <tbody id="rptSummaryTable"></tbody>
                        </table>
                    </div>
                </div>

                <!-- تفاصيل التوقفات -->
                <div class="card">
                    <div class="card-header"><h3>تفاصيل فترات التوقف</h3></div>
                    <div class="card-body" style="padding:0">
                        <table style="width:100%">
                            <thead>
                                <tr>
                                    <th style="text-align:right;padding:14px 16px">المنصة</th>
                                    <th style="text-align:center;padding:14px 16px">بداية التوقف</th>
                                    <th style="text-align:center;padding:14px 16px">نهاية التوقف</th>
                                    <th style="text-align:center;padding:14px 16px">المدة (دقيقة)</th>
                                </tr>
                            </thead>
                            <tbody id="rptDetailsTable"></tbody>
                        </table>
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
                    <input type="text" id="taskTitle" placeholder="أدخل عنوان المهمة">
                </div>
                <div class="form-group">
                    <label>الوصف</label>
                    <textarea id="taskDescription" placeholder="أدخل وصف المهمة" rows="4"></textarea>
                </div>
                <div class="form-group">
                    <label>المسؤول</label>
                    <select id="taskAssignee">
                        <option value="">اختر موظفاً</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>الأولوية</label>
                    <select id="taskPriority">
                        <option value="low">منخفضة</option>
                        <option value="medium" selected>متوسطة</option>
                        <option value="high">عالية</option>
                        <option value="urgent">عاجلة</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>تاريخ الاستحقاق</label>
                    <input type="date" id="taskDeadline">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('addTaskModal')">إلغاء</button>
                <button type="button" class="btn btn-primary" onclick="saveTask()">حفظ المهمة</button>
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
                    <input type="text" id="empFullName" placeholder="أدخل الاسم">
                </div>
                <div class="form-group">
                    <label>البريد الإلكتروني</label>
                    <input type="email" id="empEmail" placeholder="أدخل البريد">
                </div>
                <div class="form-group">
                    <label>كلمة المرور الأولية</label>
                    <input type="text" id="empPassword" placeholder="كلمة مرور افتراضية" value="123456">
                </div>
                <div class="form-group">
                    <label>الهاتف</label>
                    <input type="text" id="empPhone" placeholder="05xxxxxxxx">
                </div>
                <div class="form-group">
                    <label>القسم</label>
                    <select id="empDepartment">
                        <option value="">اختر القسم</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>الدور</label>
                    <select id="empRole">
                        <option value="3">موظف</option>
                        <option value="2">مشرف</option>
                        <option value="1">مدير</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>المسمى الوظيفي</label>
                    <input type="text" id="empJobTitle" placeholder="أدخل المسمى">
                </div>
                <div class="form-group">
                    <label>الراتب الأساسي</label>
                    <input type="text" id="empBaseSalary" value="0">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('addEmployeeModal')">إلغاء</button>
                <button type="button" class="btn btn-primary" onclick="saveEmployee()">حفظ الموظف</button>
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
                    <input type="file" id="mediaFile" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip">
                </div>
                <div class="form-group">
                    <label>الوسوم (اختياري، مفصولة بفواصل)</label>
                    <input type="text" id="mediaTags" placeholder="مثال: حملة, رمضان">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('uploadMediaModal')">إلغاء</button>
                <button type="button" class="btn btn-primary" onclick="uploadMedia()">رفع الملف</button>
            </div>
        </div>
    </div>

    <!-- مودال إضافة منصة -->
    <div class="modal-overlay" id="addPlatformModal">
        <div class="modal">
            <div class="modal-header">
                <h3 id="platformModalTitle">إضافة منصة جديدة</h3>
                <button class="modal-close" onclick="closeModal('addPlatformModal')">✕</button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="platformId" value="0">
                <div class="form-group">
                    <label>اسم المنصة / الحساب</label>
                    <input type="text" id="platformName" placeholder="مثال: فيسبوك - الصفحة الرئيسية">
                </div>
                <div class="form-group">
                    <label>نوع المنصة</label>
                    <select id="platformType">
                        <option value="facebook">فيسبوك</option>
                        <option value="instagram">إنستغرام</option>
                        <option value="twitter">تويتر / X</option>
                        <option value="telegram">تلغرام</option>
                        <option value="whatsapp">واتساب</option>
                        <option value="youtube">يوتيوب</option>
                        <option value="tiktok">تيك توك</option>
                        <option value="snapchat">سناب شات</option>
                        <option value="linkedin">لينكدإن</option>
                        <option value="other">أخرى</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>رابط الحساب (اختياري)</label>
                    <input type="text" id="platformUrl" placeholder="https://...">
                </div>
                <div class="form-group">
                    <label>المسؤول</label>
                    <select id="platformAssignee">
                        <option value="">بدون تعيين</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>حد الخمول (بالدقائق)</label>
                    <input type="text" id="platformThreshold" value="15">
                </div>
                <div class="form-group">
                    <label>آخر نشر فعلي (اختياري)</label>
                    <input type="datetime-local" id="platformLastPublish">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('addPlatformModal')">إلغاء</button>
                <button type="button" class="btn btn-primary" onclick="savePlatform()">حفظ المنصة</button>
            </div>
        </div>
    </div>

    <!-- مودال تسجيل نشر -->
    <div class="modal-overlay" id="addPublishModal">
        <div class="modal">
            <div class="modal-header">
                <h3>تسجيل نشر جديد</h3>
                <button class="modal-close" onclick="closeModal('addPublishModal')">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>المنصة</label>
                    <select id="publishPlatformId">
                        <option value="">اختر المنصة</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>عنوان المحتوى</label>
                    <input type="text" id="publishTitle" placeholder="مثال: بوست حملة رمضان">
                </div>
                <div class="form-group">
                    <label>نوع المحتوى</label>
                    <select id="publishContentType">
                        <option value="post">منشور</option>
                        <option value="story">قصة / ستوري</option>
                        <option value="reel">ريلز</option>
                        <option value="video">فيديو</option>
                        <option value="article">مقال</option>
                        <option value="message">رسالة</option>
                        <option value="ad">إعلان</option>
                        <option value="other">أخرى</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>ملاحظات (اختياري)</label>
                    <textarea id="publishNotes" placeholder="أي ملاحظات إضافية..." rows="3"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('addPublishModal')">إلغاء</button>
                <button type="button" class="btn btn-success" onclick="logPublish()">تسجيل النشر</button>
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
                    <label>اسم العميل / الشركة</label>
                    <input type="text" id="clientName" placeholder="أدخل اسم العميل">
                </div>
                <div class="form-group">
                    <label>وصف العميل (اختياري)</label>
                    <textarea id="clientDescription" placeholder="نبذة عن العميل" rows="2"></textarea>
                </div>
                <div class="form-group">
                    <label>اسم جهة الاتصال</label>
                    <input type="text" id="clientContactName" placeholder="الشخص المسؤول">
                </div>
                <div class="form-group">
                    <label>البريد الإلكتروني</label>
                    <input type="email" id="clientContactEmail" placeholder="email@example.com">
                </div>
                <div class="form-group">
                    <label>الهاتف</label>
                    <input type="tel" id="clientContactPhone" placeholder="05xxxxxxxx">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('addClientModal')">إلغاء</button>
                <button type="button" class="btn btn-primary" onclick="saveClient()">حفظ العميل</button>
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
                    <select id="leaveType">
                        <option value="annual">سنوية</option>
                        <option value="sick">مرضية</option>
                        <option value="emergency">طارئة</option>
                        <option value="unpaid">بدون راتب</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>من التاريخ</label>
                    <input type="date" id="leaveStartDate">
                </div>
                <div class="form-group">
                    <label>إلى التاريخ</label>
                    <input type="date" id="leaveEndDate">
                </div>
                <div class="form-group">
                    <label>السبب (اختياري)</label>
                    <textarea id="leaveReason" placeholder="اذكر السبب" rows="3"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('requestLeaveModal')">إلغاء</button>
                <button type="button" class="btn btn-primary" onclick="requestLeave()">إرسال الطلب</button>
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
                    <input type="text" id="knowledgeTitle" placeholder="أدخل عنوان المقالة">
                </div>
                <div class="form-group">
                    <label>التصنيف</label>
                    <input type="text" id="knowledgeCategory" placeholder="مثال: تدريب، إجراءات">
                </div>
                <div class="form-group">
                    <label>المحتوى</label>
                    <textarea id="knowledgeContent" placeholder="أدخل محتوى المقالة" rows="6"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('addKnowledgeModal')">إلغاء</button>
                <button type="button" class="btn btn-primary" onclick="saveKnowledge()">حفظ المقالة</button>
            </div>
        </div>
    </div>

    <script>
        // API Helper Function
        // يرسل البيانات كـ form-encoded حتى يقرأها $_POST في PHP
        // ويوحّد شكل الاستجابة: المصفوفات الخام تُغلَّف داخل {data: [...]}
        async function api(action, params = {}) {
            try {
                const body = new URLSearchParams();
                for (const [k, v] of Object.entries(params || {})) {
                    if (v === undefined || v === null) continue;
                    body.append(k, typeof v === 'object' ? JSON.stringify(v) : v);
                }
                const response = await fetch('api.php?action=' + encodeURIComponent(action), {
                    method: 'POST',
                    body: body
                });
                if (!response.ok) return { error: 'HTTP ' + response.status };
                const text = await response.text();
                let parsed;
                try { parsed = JSON.parse(text); } catch(e) { return { error: 'Invalid JSON' }; }
                // normalize raw arrays into { data: [...] }
                if (Array.isArray(parsed)) return { data: parsed };
                return parsed;
            } catch (error) {
                console.error('API Error:', error);
                return { error: error.message };
            }
        }

        // Page Navigation
        function showPage(pageId) {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            const target = document.getElementById('page-' + pageId);
            if (target) target.classList.add('active');
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            // حدد الـ nav-item الصحيح بناءً على pageId بدلاً من event.target
            // (حتى تعمل بشكل سليم حين يُستدعى showPage برمجياً)
            const navEl = document.querySelector(`.nav-item[onclick*="showPage('${pageId}')"]`);
            if (navEl) navEl.classList.add('active');
            else if (typeof event !== 'undefined' && event && event.target) {
                const byEv = event.target.closest('.nav-item');
                if (byEv) byEv.classList.add('active');
            }

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
                'publish-monitor': 'مراقبة النشر',
                'publish-report': 'تقرير النشر',
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
            else if (pageId === 'publish-monitor') loadPlatforms();
            else if (pageId === 'publish-report') initReport();
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
            const result = await api('attendance_list');
            if (result.data) {
                const tbody = document.getElementById('attendanceList');
                tbody.innerHTML = result.data.map(att => {
                    const status = att.status || 'present';
                    return `
                    <tr>
                        <td>${att.date}</td>
                        <td>${att.check_in || '-'}</td>
                        <td>${att.check_out || '-'}</td>
                        <td><span class="badge ${String(status).toLowerCase()}">${status}</span></td>
                    </tr>`;
                }).join('');
            }
        }

        // Dashboard Functions
        async function loadDashboard() {
            const result = await api('dashboard_stats');
            if (result.data) {
                const stats = result.data;
                document.getElementById('stat-active-emps').textContent = stats.employees ?? 0;
                document.getElementById('stat-completed').textContent = stats.tasks_done ?? 0;
                document.getElementById('stat-pending-salary').textContent = stats.pending_salaries ?? 0;
                document.getElementById('stat-remaining-leaves').textContent = stats.leave_pending ?? 0;
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
            const result = await api('tasks_list');
            if (result.data) {
                const list = document.getElementById('tasksList');
                list.innerHTML = result.data.map(task => {
                    const status = task.status || 'pending';
                    const progress = task.progress ?? 0;
                    return `
                    <div class="task-item ${status === 'overdue' ? 'overdue' : ''}">
                        <div class="task-header">
                            <span class="task-title">${task.title || ''}</span>
                            <span class="badge ${String(status).toLowerCase().replace(/[ _]/g, '-')}">${status}</span>
                        </div>
                        <div class="task-meta">
                            <span>👤 ${task.assignee_name || '-'}</span>
                            <span>📅 تاريخ الاستحقاق: ${task.deadline || '-'}</span>
                            <span>🏷️ ${task.task_type || '-'}</span>
                        </div>
                        <div class="task-progress">
                            <div class="progress-bar"><div class="progress-fill blue" style="width:${progress}%"></div></div>
                            <span class="perc">${progress}%</span>
                        </div>
                    </div>`;
                }).join('');
            }
        }

        // Employee Functions
        async function loadEmployees() {
            const result = await api('employees_list');
            if (result.data) {
                const grid = document.getElementById('employeesGrid');
                grid.innerHTML = result.data.map(emp => {
                    const bg = emp.avatar_color || 'linear-gradient(135deg,#4f46e5,#7c3aed)';
                    return `
                    <div class="emp-profile-card">
                        <div class="emp-avatar-lg" style="background:${bg}">${emp.avatar_initials || ''}</div>
                        <div class="emp-name">${emp.full_name || ''}</div>
                        <div class="emp-dept">${emp.department_name || '-'}</div>
                        <div class="emp-stats">
                            <div class="emp-stat-item">
                                <div class="emp-stat-val" style="font-size:13px">${emp.job_title || '-'}</div>
                                <div class="emp-stat-label">المسمى الوظيفي</div>
                            </div>
                            <div class="emp-stat-item">
                                <div class="emp-stat-val" style="font-size:13px">${emp.role_ar || '-'}</div>
                                <div class="emp-stat-label">الدور</div>
                            </div>
                        </div>
                    </div>`;
                }).join('');
            }
        }

        // Salary Functions
        async function loadSalaries() {
            const result = await api('salaries_list');
            if (result.data) {
                let total = 0, deductions = 0, bonuses = 0;
                const tbody = document.getElementById('salariesList');
                tbody.innerHTML = result.data.map(sal => {
                    const base = Number(sal.base_salary) || 0;
                    const bon  = Number(sal.bonuses)     || 0;
                    const ded  = Number(sal.deductions)  || 0;
                    const net  = sal.net_salary != null ? Number(sal.net_salary) : (base + bon - ded);
                    const status = sal.status || 'pending';
                    total      += base;
                    deductions += ded;
                    bonuses    += bon;
                    return `
                        <tr>
                            <td><strong>${sal.full_name || ''}</strong></td>
                            <td>₪ ${base}</td>
                            <td>₪ ${bon}</td>
                            <td>₪ ${ded}</td>
                            <td>₪ ${net}</td>
                            <td><span class="badge ${String(status).toLowerCase()}">${status}</span></td>
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
            const result = await api('leaves_list');
            if (result.data) {
                const tbody = document.getElementById('leavesList');
                tbody.innerHTML = result.data.map(leave => {
                    const status = leave.status || 'pending';
                    return `
                    <tr>
                        <td><strong>${leave.full_name || ''}</strong></td>
                        <td>${leave.leave_type || '-'}</td>
                        <td>${leave.start_date || '-'}</td>
                        <td>${leave.end_date || '-'}</td>
                        <td><span class="badge ${String(status).toLowerCase()}">${status}</span></td>
                    </tr>`;
                }).join('');
            }
        }

        // Message Functions
        async function loadMessages() {
            const result = await api('channels_list');
            if (result.data) {
                const channelsList = document.getElementById('channelsList');
                channelsList.innerHTML = result.data.map((ch, idx) => `
                    <div class="quick-action" style="width:100%;margin:0;padding:10px 0;justify-content:flex-start" onclick="loadChannelMessages('${ch.id}')">
                        <span>💬 ${ch.name || ''}</span>
                    </div>
                `).join('');
            }
        }

        async function loadChannelMessages(channelId) {
            const result = await api('channel_messages', { channel_id: channelId });
            if (result.data) {
                const list = document.getElementById('messagesList');
                list.innerHTML = result.data.map(msg => `
                    <div style="padding:10px 0;border-bottom:1px solid var(--border-light)">
                        <strong>${msg.full_name || ''}</strong>
                        <p style="color:var(--text-secondary);font-size:13px;margin-top:4px">${msg.content || ''}</p>
                        <span style="color:var(--text-tertiary);font-size:11px">${msg.created_at || ''}</span>
                    </div>
                `).join('');
            }
        }

        // Media Functions
        async function loadMedia() {
            const result = await api('media_list');
            if (result.data) {
                const grid = document.getElementById('mediaGrid');
                grid.innerHTML = result.data.map(media => {
                    const ftype = media.file_type || media.mime_type || '';
                    const icon = String(ftype).includes('image') ? '📷'
                               : String(ftype).includes('video') ? '🎬'
                               : String(ftype).includes('audio') ? '🎵'
                               : '📄';
                    return `
                    <div style="border:1px solid var(--border);border-radius:12px;padding:12px;text-align:center">
                        <div style="width:100%;height:140px;background:var(--bg-secondary);border-radius:8px;margin-bottom:10px;display:flex;align-items:center;justify-content:center;font-size:32px">
                            ${icon}
                        </div>
                        <p style="font-size:13px;font-weight:600;margin-bottom:4px">${media.original_name || ''}</p>
                        <span style="color:var(--text-secondary);font-size:12px">${media.file_size_formatted || ''}</span>
                    </div>`;
                }).join('');
            }
        }

        // Knowledge Functions
        async function loadKnowledge() {
            const result = await api('knowledge_list');
            if (result.data) {
                const list = document.getElementById('knowledgeList');
                list.innerHTML = result.data.map(kb => {
                    const content = kb.content || '';
                    const excerpt = content.length > 100 ? content.substring(0, 100) + '...' : content;
                    return `
                    <div style="padding:14px 0;border-bottom:1px solid var(--border-light)">
                        <strong>${kb.title || ''}</strong>
                        <p style="color:var(--text-secondary);font-size:13px;margin-top:6px">${excerpt}</p>
                        <span style="color:var(--text-tertiary);font-size:11px">${kb.created_at || ''}</span>
                    </div>`;
                }).join('');
            }
        }

        // Client Functions
        async function loadClients() {
            const result = await api('clients_list');
            if (result.data) {
                const tbody = document.getElementById('clientsList');
                tbody.innerHTML = result.data.map(client => `
                    <tr>
                        <td><strong>${client.name || ''}</strong></td>
                        <td>${client.contact_email || '-'}</td>
                        <td>${client.contact_phone || '-'}</td>
                        <td>${client.project_count ?? 0}</td>
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
                const iconByType = { task: '📋', leave: '🌴', message: '💬', salary: '💰', system: '⚙️' };
                list.innerHTML = result.data.map(notif => `
                    <div class="notif-item">
                        <div class="notif-icon-box" style="background:var(--primary-light);color:var(--primary)">${iconByType[notif.type] || '📢'}</div>
                        <div>
                            <div class="notif-text">${notif.title || ''}</div>
                            <div class="notif-sub">${notif.message || ''}</div>
                        </div>
                    </div>
                `).join('');
            }
        }

        // =============================================
        // Modal Save Functions — ربط الحفظ بالـ API
        // =============================================
        function val(id) {
            const el = document.getElementById(id);
            return el ? el.value.trim() : '';
        }

        async function saveTask() {
            const title = val('taskTitle');
            if (!title) { alert('الرجاء إدخال عنوان المهمة'); return; }
            const result = await api('task_create', {
                title: title,
                description: val('taskDescription'),
                assigned_to: val('taskAssignee'),
                priority: val('taskPriority'),
                deadline: val('taskDeadline')
            });
            if (result.error) { alert('خطأ: ' + result.error); return; }
            closeModal('addTaskModal');
            loadTasks();
        }

        async function saveEmployee() {
            const name = val('empFullName');
            const email = val('empEmail');
            if (!name || !email) { alert('الاسم والبريد الإلكتروني مطلوبان'); return; }
            const result = await api('employee_create', {
                full_name: name,
                email: email,
                password: val('empPassword') || '123456',
                phone: val('empPhone'),
                department_id: val('empDepartment'),
                role_id: val('empRole') || 3,
                job_title: val('empJobTitle'),
                base_salary: val('empBaseSalary') || 0
            });
            if (result.error) { alert('خطأ: ' + result.error); return; }
            closeModal('addEmployeeModal');
            loadEmployees();
        }

        async function uploadMedia() {
            const fileInput = document.getElementById('mediaFile');
            if (!fileInput || !fileInput.files[0]) { alert('الرجاء اختيار ملف'); return; }
            const fd = new FormData();
            fd.append('file', fileInput.files[0]);
            fd.append('tags', JSON.stringify(val('mediaTags').split(',').map(t => t.trim()).filter(Boolean)));
            try {
                const response = await fetch('api.php?action=media_upload', { method: 'POST', body: fd });
                const result = await response.json();
                if (result.error) { alert('خطأ: ' + result.error); return; }
                closeModal('uploadMediaModal');
                loadMedia();
            } catch (e) {
                alert('تعذر رفع الملف: ' + e.message);
            }
        }

        async function saveClient() {
            const name = val('clientName');
            if (!name) { alert('الرجاء إدخال اسم العميل'); return; }
            const result = await api('client_save', {
                name: name,
                description: val('clientDescription'),
                contact_name: val('clientContactName'),
                contact_email: val('clientContactEmail'),
                contact_phone: val('clientContactPhone')
            });
            if (result.error) { alert('خطأ: ' + result.error); return; }
            closeModal('addClientModal');
            loadClients();
        }

        async function requestLeave() {
            const start = val('leaveStartDate');
            const end = val('leaveEndDate');
            if (!start || !end) { alert('الرجاء تحديد التواريخ'); return; }
            const result = await api('leave_request', {
                leave_type: val('leaveType'),
                start_date: start,
                end_date: end,
                reason: val('leaveReason')
            });
            if (result.error) { alert('خطأ: ' + result.error); return; }
            closeModal('requestLeaveModal');
            loadLeaves();
        }

        async function saveKnowledge() {
            const title = val('knowledgeTitle');
            const content = val('knowledgeContent');
            if (!title || !content) { alert('العنوان والمحتوى مطلوبان'); return; }
            const result = await api('knowledge_save', {
                title: title,
                category: val('knowledgeCategory'),
                content: content
            });
            if (result.error) { alert('خطأ: ' + result.error); return; }
            closeModal('addKnowledgeModal');
            loadKnowledge();
        }

        // تحميل قوائم الأقسام/الموظفين لاستخدامها داخل الـ Modals
        async function loadDepartmentsInto(selectId) {
            const result = await api('departments_list');
            const select = document.getElementById(selectId);
            if (select && result.data) {
                select.innerHTML = '<option value="">اختر القسم</option>' +
                    result.data.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
            }
        }

        async function loadEmployeesInto(selectId) {
            const result = await api('employees_list');
            const select = document.getElementById(selectId);
            if (select && result.data) {
                select.innerHTML = '<option value="">اختر موظفاً</option>' +
                    result.data.map(e => `<option value="${e.id}">${e.full_name}</option>`).join('');
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
            const el = document.getElementById(modalId);
            if (!el) return;
            el.classList.add('show');
            // تحميل البيانات المطلوبة للـ Modal
            if (modalId === 'addTaskModal')      loadEmployeesInto('taskAssignee');
            if (modalId === 'addEmployeeModal')  loadDepartmentsInto('empDepartment');
        }

        function closeModal(modalId) {
            document.getElementById(modalId).classList.remove('show');
        }

        function switchWorkView(view) {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            loadTasks();
        }

        // =============================================
        // مراقبة النشر - Publish Monitor
        // =============================================
        let pmRefreshInterval = null;
        let pmPlatformsData = [];
        let pmAlertSound = null;
        let pmLastAlertCount = 0;

        const platformIcons = {
            facebook: '📘', instagram: '📸', twitter: '🐦', telegram: '✈️',
            whatsapp: '💬', youtube: '▶️', tiktok: '🎵', snapchat: '👻',
            linkedin: '💼', other: '📱'
        };

        function formatMinutes(mins) {
            if (mins < 1) return 'الآن';
            if (mins < 60) return mins + ' دقيقة';
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            if (h < 24) return h + ' ساعة' + (m > 0 ? ' و ' + m + ' د' : '');
            const d = Math.floor(h / 24);
            return d + ' يوم' + (h % 24 > 0 ? ' و ' + (h % 24) + ' س' : '');
        }

        function getStatusArabic(status) {
            const map = { active: 'نشطة', idle: 'خاملة', stopped: 'متوقفة', paused: 'مُعلّقة' };
            return map[status] || status;
        }

        function getTimerClass(status) {
            if (status === 'active') return 'active';
            if (status === 'idle') return 'idle';
            return 'stopped';
        }

        function getValueClass(status) {
            if (status === 'active') return 'success';
            if (status === 'idle') return 'warning';
            return 'danger';
        }

        async function loadPlatforms() {
            const type = document.getElementById('pmFilterType')?.value || '';
            const filter = document.getElementById('pmFilterStatus')?.value || 'all';

            const url = 'api.php?action=platforms_list&type=' + encodeURIComponent(type) + '&filter=' + encodeURIComponent(filter);
            let data;
            try {
                const response = await fetch(url);
                data = await response.json();
            } catch(e) { return; }

            if (data.platforms) {
                pmPlatformsData = data.platforms;
                const stats = data.stats;

                // تحديث الإحصائيات
                document.getElementById('pmTotal').textContent = stats.total;
                document.getElementById('pmActive').textContent = stats.active;
                document.getElementById('pmIdle').textContent = stats.idle;
                document.getElementById('pmStopped').textContent = stats.stopped;
                document.getElementById('pmTodayPosts').textContent = stats.today_total_posts;

                // تنبيه المنصات المتوقفة
                const alertCount = stats.idle + stats.stopped;
                const alertBanner = document.getElementById('pmAlertBanner');
                const alertBadge = document.getElementById('publishAlertBadge');

                if (alertCount > 0) {
                    alertBanner.style.display = 'flex';
                    document.getElementById('pmStoppedCount').textContent = alertCount;
                    alertBadge.style.display = 'flex';
                    alertBadge.textContent = alertCount;

                    // صوت تنبيه عند زيادة المنصات المتوقفة
                    if (alertCount > pmLastAlertCount && pmLastAlertCount > 0) {
                        playAlertSound();
                    }
                } else {
                    alertBanner.style.display = 'none';
                    alertBadge.style.display = 'none';
                }
                pmLastAlertCount = alertCount;

                // بناء بطاقات المنصات
                renderPlatformCards(data.platforms);

                // تحديث قائمة المنصات في مودال النشر
                updatePublishPlatformSelect(data.platforms);
            }
        }

        function renderPlatformCards(platforms) {
            const grid = document.getElementById('pmPlatformsGrid');
            if (platforms.length === 0) {
                grid.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-secondary);grid-column:1/-1"><p style="font-size:48px;margin-bottom:16px">📡</p><p style="font-size:16px">لا توجد منصات. أضف منصة جديدة للبدء.</p></div>';
                return;
            }

            grid.innerHTML = platforms.map(p => {
                const mins = parseInt(p.minutes_since_publish) || 0;
                const status = p.publish_status;
                const iconClass = p.platform_type || 'other';
                const icon = p.icon || platformIcons[p.platform_type] || '📱';

                return `
                <div class="pm-card status-${status}">
                    <div class="pm-card-status ${status}"></div>
                    <div class="pm-card-header">
                        <div class="pm-card-icon ${iconClass}">${icon}</div>
                        <div class="pm-card-info">
                            <h4>${p.name}</h4>
                            <span>${p.assigned_name || 'غير معيّن'}</span>
                        </div>
                    </div>
                    <div class="pm-card-body">
                        <div class="pm-card-row">
                            <span class="label">الحالة</span>
                            <span class="value ${getValueClass(status)}">${getStatusArabic(status)}</span>
                        </div>
                        <div class="pm-card-row">
                            <span class="label">آخر نشر</span>
                            <span class="value ${mins >= parseInt(p.idle_threshold) ? 'danger' : ''}">${formatMinutes(mins)}</span>
                        </div>
                        <div class="pm-card-row">
                            <span class="label">منشورات اليوم</span>
                            <span class="value">${p.today_posts || 0}</span>
                        </div>
                        <div class="pm-card-row">
                            <span class="label">حد الخمول</span>
                            <span class="value">${p.idle_threshold} دقيقة</span>
                        </div>
                        <div class="pm-card-timer ${getTimerClass(status)}">
                            ${mins < 60 ? mins + ':00' : Math.floor(mins/60) + ':' + String(mins%60).padStart(2,'0') + ':00'}
                        </div>
                    </div>
                    <div class="pm-card-actions">
                        <button class="btn btn-success btn-sm" onclick="quickPublish(${p.id}, '${p.name.replace(/'/g, "\\'")}')">📝 نشر</button>
                        <button class="btn btn-outline btn-sm" onclick="editPlatform(${p.id})">✏️ تعديل</button>
                        <button class="btn btn-danger btn-sm" onclick="deletePlatform(${p.id})">🗑️</button>
                    </div>
                </div>
                `;
            }).join('');
        }

        function updatePublishPlatformSelect(platforms) {
            const select = document.getElementById('publishPlatformId');
            if (!select) return;
            const currentVal = select.value;
            select.innerHTML = '<option value="">اختر المنصة</option>' +
                platforms.filter(p => p.status === 'active').map(p =>
                    `<option value="${p.id}">${p.icon || ''} ${p.name}</option>`
                ).join('');
            if (currentVal) select.value = currentVal;
        }

        function filterPlatforms(status) {
            const select = document.getElementById('pmFilterStatus');
            if (select) {
                select.value = status;
                loadPlatforms();
            }
        }

        async function savePlatform() {
            const data = {
                id: document.getElementById('platformId').value,
                name: document.getElementById('platformName').value,
                platform_type: document.getElementById('platformType').value,
                account_url: document.getElementById('platformUrl').value,
                assigned_to: document.getElementById('platformAssignee').value,
                idle_threshold: document.getElementById('platformThreshold').value,
                last_publish_at: document.getElementById('platformLastPublish').value
            };

            if (!data.name) { alert('يرجى إدخال اسم المنصة'); return; }

            const result = await api('platform_save', data);
            if (result.success) {
                closeModal('addPlatformModal');
                resetPlatformForm();
                loadPlatforms();
            } else {
                alert(result.error || 'حدث خطأ');
            }
        }

        function resetPlatformForm() {
            document.getElementById('platformId').value = '0';
            document.getElementById('platformName').value = '';
            document.getElementById('platformType').value = 'facebook';
            document.getElementById('platformUrl').value = '';
            document.getElementById('platformAssignee').value = '';
            document.getElementById('platformThreshold').value = '15';
            document.getElementById('platformLastPublish').value = '';
            document.getElementById('platformModalTitle').textContent = 'إضافة منصة جديدة';
        }

        function editPlatform(id) {
            const p = pmPlatformsData.find(x => x.id == id);
            if (!p) return;
            document.getElementById('platformId').value = p.id;
            document.getElementById('platformName').value = p.name;
            document.getElementById('platformType').value = p.platform_type;
            document.getElementById('platformUrl').value = p.account_url || '';
            document.getElementById('platformAssignee').value = p.assigned_to || '';
            document.getElementById('platformThreshold').value = p.idle_threshold;
            document.getElementById('platformLastPublish').value = p.last_publish_at ? p.last_publish_at.replace(' ', 'T').substring(0, 16) : '';
            document.getElementById('platformModalTitle').textContent = 'تعديل منصة: ' + p.name;
            openModal('addPlatformModal');
        }

        async function deletePlatform(id) {
            if (!confirm('هل أنت متأكد من حذف هذه المنصة؟')) return;
            const result = await api('platform_delete', { id });
            if (result.success) loadPlatforms();
            else alert(result.error || 'حدث خطأ');
        }

        function quickPublish(platformId, platformName) {
            document.getElementById('publishPlatformId').value = platformId;
            document.getElementById('publishTitle').value = '';
            document.getElementById('publishNotes').value = '';
            openModal('addPublishModal');
        }

        async function logPublish() {
            const data = {
                platform_id: document.getElementById('publishPlatformId').value,
                content_title: document.getElementById('publishTitle').value,
                content_type: document.getElementById('publishContentType').value,
                notes: document.getElementById('publishNotes').value
            };

            if (!data.platform_id) { alert('يرجى اختيار المنصة'); return; }

            const result = await api('publish_log', data);
            if (result.success) {
                closeModal('addPublishModal');
                loadPlatforms();
            } else {
                alert(result.error || 'حدث خطأ');
            }
        }

        function toggleAutoRefresh() {
            const checked = document.getElementById('pmAutoRefresh').checked;
            if (checked) {
                pmRefreshInterval = setInterval(loadPlatforms, 30000);
            } else {
                if (pmRefreshInterval) clearInterval(pmRefreshInterval);
                pmRefreshInterval = null;
            }
        }

        function playAlertSound() {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = 800;
                osc.type = 'sine';
                gain.gain.value = 0.3;
                osc.start();
                osc.stop(ctx.currentTime + 0.3);
                setTimeout(() => {
                    const osc2 = ctx.createOscillator();
                    const gain2 = ctx.createGain();
                    osc2.connect(gain2);
                    gain2.connect(ctx.destination);
                    osc2.frequency.value = 600;
                    osc2.type = 'sine';
                    gain2.gain.value = 0.3;
                    osc2.start();
                    osc2.stop(ctx.currentTime + 0.3);
                }, 350);
            } catch(e) {}
        }

        // تحديث قائمة الموظفين في مودال المنصة
        async function loadPlatformAssignees() {
            const result = await api('employees_list');
            const select = document.getElementById('platformAssignee');
            if (select && result.data) {
                select.innerHTML = '<option value="">بدون تعيين</option>' +
                    result.data.map(e => `<option value="${e.id}">${e.full_name}</option>`).join('');
            }
        }

        // تشغيل التحديث التلقائي عند فتح صفحة المراقبة
        function startPublishMonitor() {
            loadPlatforms();
            loadPlatformAssignees();
            loadMonitorStatusMain();
            if (document.getElementById('pmAutoRefresh')?.checked) {
                pmRefreshInterval = setInterval(loadPlatforms, 30000);
            }
        }

        // فحص المنصات المتوقفة بشكل دوري (حتى لو المستخدم في صفحة ثانية)
        setInterval(async () => {
            try {
                const resp = await fetch('api.php?action=platforms_alerts');
                const data = await resp.json();
                if (data.alerts && data.alerts.length > 0) {
                    const badge = document.getElementById('publishAlertBadge');
                    if (badge) {
                        badge.style.display = 'flex';
                        badge.textContent = data.alerts.length;
                    }
                }
            } catch(e) {}
        }, 60000);

        // =============================================
        // تقرير النشر
        // =============================================
        function initReport() {
            document.getElementById('reportDate').value = new Date().toISOString().split('T')[0];
            loadIdleReport();
            loadMonitorStatus();
        }

        async function loadIdleReport() {
            const date = document.getElementById('reportDate').value || new Date().toISOString().split('T')[0];
            const url = 'api.php?action=idle_report&date=' + encodeURIComponent(date);
            let data;
            try {
                const resp = await fetch(url);
                data = await resp.json();
            } catch(e) { return; }

            if (data.stats) {
                document.getElementById('rptCompliance').textContent = data.stats.compliance_rate + '%';
                document.getElementById('rptIdlePlatforms').textContent = data.stats.platforms_with_idle;
                document.getElementById('rptIdleEvents').textContent = data.stats.total_idle_events;
                document.getElementById('rptIdleMinutes').textContent = data.stats.total_idle_minutes;
            }

            if (data.summary) {
                const tbody = document.getElementById('rptSummaryTable');
                tbody.innerHTML = data.summary.map(function(s) {
                    const statusBadge = s.idle_count > 0
                        ? '<span class="badge" style="background:var(--danger-light);color:var(--danger)">' + s.idle_count + ' توقفات</span>'
                        : '<span class="badge" style="background:var(--success-light);color:var(--success)">ملتزم</span>';
                    return '<tr>' +
                        '<td style="padding:12px 16px"><strong>' + (s.icon || '') + ' ' + s.name + '</strong></td>' +
                        '<td style="padding:12px 16px">' + (s.assigned_name || 'غير معيّن') + '</td>' +
                        '<td style="text-align:center;padding:12px 16px;font-weight:700;color:' + (s.idle_count > 0 ? 'var(--danger)' : 'var(--success)') + '">' + s.idle_count + '</td>' +
                        '<td style="text-align:center;padding:12px 16px">' + s.total_idle_minutes + ' د</td>' +
                        '<td style="text-align:center;padding:12px 16px">' + (s.max_idle_minutes || 0) + ' د</td>' +
                        '<td style="text-align:center;padding:12px 16px">' + statusBadge + '</td>' +
                        '</tr>';
                }).join('');
            }

            if (data.logs) {
                const tbody = document.getElementById('rptDetailsTable');
                if (data.logs.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--text-secondary)">لا توجد فترات توقف في هذا اليوم</td></tr>';
                } else {
                    tbody.innerHTML = data.logs.map(function(l) {
                        const endTime = l.ended_at ? l.ended_at.substring(11, 16) : '<span style="color:var(--danger)">لا زال متوقف</span>';
                        return '<tr>' +
                            '<td style="padding:12px 16px"><strong>' + (l.icon || '') + ' ' + l.platform_name + '</strong></td>' +
                            '<td style="text-align:center;padding:12px 16px">' + l.started_at.substring(11, 16) + '</td>' +
                            '<td style="text-align:center;padding:12px 16px">' + endTime + '</td>' +
                            '<td style="text-align:center;padding:12px 16px;font-weight:700;color:' + (l.duration_minutes > 30 ? 'var(--danger)' : 'var(--warning)') + '">' + l.duration_minutes + ' دقيقة</td>' +
                            '</tr>';
                    }).join('');
                }
            }
        }

        async function loadMonitorStatusMain() {
            const url = 'api.php?action=monitor_status';
            let data;
            try { const resp = await fetch(url); data = await resp.json(); } catch(e) { return; }
            const dot = document.getElementById('monitorDotMain');
            const text = document.getElementById('monitorStatusTextMain');
            const lastRun = document.getElementById('monitorLastRunMain');
            if (!dot) return;
            if (data.is_active) {
                dot.style.background = 'var(--success)';
                text.textContent = 'تعمل';
                text.style.color = 'var(--success)';
            } else if (data.last_run) {
                dot.style.background = 'var(--warning)';
                text.textContent = 'متوقفة';
                text.style.color = 'var(--warning)';
            } else {
                dot.style.background = 'var(--danger)';
                text.textContent = 'غير مُفعّلة — يرجى إعداد Cron Job';
                text.style.color = 'var(--danger)';
            }
            if (data.last_run) lastRun.textContent = 'آخر فحص: ' + data.last_run;
        }

        async function loadMonitorStatus() {
            const url = 'api.php?action=monitor_status';
            let data;
            try {
                const resp = await fetch(url);
                data = await resp.json();
            } catch(e) { return; }

            const dot = document.getElementById('monitorDot');
            const text = document.getElementById('monitorStatusText');
            const lastRun = document.getElementById('monitorLastRun');

            if (data.is_active) {
                dot.style.background = 'var(--success)';
                dot.style.boxShadow = '0 0 8px rgba(16,185,129,0.5)';
                text.textContent = 'تعمل';
                text.style.color = 'var(--success)';
            } else if (data.last_run) {
                dot.style.background = 'var(--warning)';
                text.textContent = 'متوقفة';
                text.style.color = 'var(--warning)';
            } else {
                dot.style.background = 'var(--danger)';
                text.textContent = 'غير مُفعّلة';
                text.style.color = 'var(--danger)';
            }

            if (data.last_run) {
                lastRun.textContent = 'آخر فحص: ' + data.last_run;
            }
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
