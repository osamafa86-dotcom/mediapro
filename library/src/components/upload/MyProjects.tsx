'use client';
import { CircleCheck, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, StatusBadge, type ProjectStatus } from '@/components/ui';
import { postJson } from '@/lib/client/api';
import s from './upload.module.css';

/** «المشاريع المسندة إليّ» + «جاهز للمراجعة» (Figma 41:2). The server refuses while uploads are open. */
export function MyProjectsPanel({ current, projects, canReady, openCount, hasAssets }: {
  current: string; projects: { id: string; title: string; status: ProjectStatus; statusLabel: string }[];
  canReady: boolean; openCount: number; hasAssets: boolean;
}) {
  const t = useTranslations('upload');
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const enabled = canReady && openCount === 0 && hasAssets && !busy;
  return (
    <aside className={s.side} aria-labelledby="h-mine">
      <h2 id="h-mine">{t('myProjects')}</h2>
      <ul>
        {projects.map((p) => (
          <li key={p.id}>
            <Link href={`/upload/${p.id}`} className={s.proj} aria-current={p.id === current ? 'page' : undefined}>
              <span className={s.thumb} aria-hidden><ImageIcon size={18} /></span>
              <span className={s.projText}><strong>{p.title}</strong><StatusBadge status={p.status} label={p.statusLabel} /></span>
            </Link>
          </li>
        ))}
      </ul>
      <Button variant="primary" icon={<CircleCheck size={16} />} isDisabled={!enabled} className={s.readyBtn} onPress={async () => {
        setBusy(true);
        const r = await postJson<{ status?: string }>(`/api/admin/projects/${current}/ready`, {});
        setBusy(false);
        setMsg(r.ok ? (r.data.status === 'published' ? t('readyPublished') : t('readyDone')) : null);
        router.refresh();
      }}>{t('ready')}</Button>
      {msg ? <p className={s.okText} role="status">{msg}</p> : <p className={s.hint}>{t('readyHint', { left: openCount })}</p>}
    </aside>
  );
}
