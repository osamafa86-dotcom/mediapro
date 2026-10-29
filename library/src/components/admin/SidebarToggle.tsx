'use client';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useState } from 'react';
import { SIDEBAR_COOKIE } from '@/lib/sidebar';
import s from './admin.module.css';

/**
 * Folds the sidebar to a rail of icons so the work area takes the screen; the choice is a cookie, so the server
 * renders the same state on the next page (no flash). Desktop only: on a phone the sidebar is already a top bar.
 */
export function SidebarToggle({ initial, collapseLabel, expandLabel }: { initial: boolean; collapseLabel: string; expandLabel: string }) {
  const [collapsed, setCollapsed] = useState(initial);
  const label = collapsed ? expandLabel : collapseLabel;
  return (
    <button type="button" className={s.sidebarToggle} aria-label={label} title={label} aria-expanded={!collapsed} data-testid="sidebar-toggle"
      onClick={(e) => {
        const next = !collapsed;
        setCollapsed(next);
        const shell = e.currentTarget.closest('[data-shell]');
        if (next) shell?.setAttribute('data-collapsed', 'true'); else shell?.removeAttribute('data-collapsed');
        document.cookie = `${SIDEBAR_COOKIE}=${next ? 'collapsed' : 'open'}; path=/; max-age=31536000; samesite=lax`;
      }}>
      {/* the panel icons are drawn for a right-hand sidebar; Turkish (LTR) mirrors them in CSS */}
      {collapsed ? <PanelRightOpen size={18} aria-hidden /> : <PanelRightClose size={18} aria-hidden />}
    </button>
  );
}
