import s from './ui.module.css';

export type ProjectStatus = 'draft' | 'uploading' | 'review' | 'published' | 'expired';

/** Dot + word, never colour alone (WCAG 1.4.1). */
export function StatusBadge({ status, label }: { status: ProjectStatus; label: string }) {
  return (
    <span className={[s.badge, s[`badge-${status}`]].join(' ')} data-status={status}>
      <span className={s.badgeDot} aria-hidden="true" />
      {label}
    </span>
  );
}
