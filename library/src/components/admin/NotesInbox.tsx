'use client';
import { ArrowUpRight, Check, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { thumbHashToDataURL } from 'thumbhash';
import type { Locale } from '@/i18n/config';
import { postJson } from '@/lib/client/api';
import { uploadOne } from '@/lib/client/upload-one';
import { clock } from '@/lib/clock';
import { formatRelative } from '@/lib/format';
import type { InboxItem, Note } from '@/lib/notes';
import s from './admin.module.css';
import d from './notes.module.css';

const bg = (hash: string | null) => {
  if (!hash) return undefined;
  try { return `url(${thumbHashToDataURL(Uint8Array.from(atob(hash), (c) => c.charCodeAt(0)))})`; } catch { return undefined; }
};

async function patch(id: string, body: Record<string, unknown>) {
  const csrf = document.cookie.split('; ').find((c) => /^(__Host-)?ml_csrf=/.test(c))?.split('=')[1] ?? '';
  const r = await fetch(`/api/admin/notes/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-csrf-token': decodeURIComponent(csrf) }, body: JSON.stringify(body) });
  return r.ok;
}

export function NotesInbox({ admin, state, assignee, items, counts, selectedId, thread, team }: {
  admin: boolean; state: 'open' | 'resolved'; assignee: string; items: InboxItem[]; counts: { open: number; resolved: number };
  selectedId: string | null; thread: Note[]; team: { id: string; name: string; role: string }[];
}) {
  const t = useTranslations('admin.notes');
  const tn = useTranslations('portal.notes');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const sel = items.find((i) => i.id === selectedId) ?? null;
  const note = thread.find((n) => n.id === selectedId) ?? null;
  const q = (patchQ: Record<string, string>) => {
    const u = new URLSearchParams({ state, ...(assignee ? { assignee } : {}), ...patchQ });
    for (const [k, v] of [...u]) if (!v) u.delete(k);
    return `/admin/notes?${u}`;
  };
  const groups = items.reduce<{ project: string; title: string; client: string; list: InboxItem[] }[]>((acc, i) => {
    const g = acc.find((x) => x.project === i.project_id);
    if (g) g.list.push(i); else acc.push({ project: i.project_id, title: i.project_title, client: i.client_name, list: [i] });
    return acc;
  }, []);
  const done = (text: string) => { setMsg(text); router.refresh(); };

  return (
    <div className={d.layout}>
      <section className={s.card} aria-label={t('title')} data-testid="notes-list">
        <div className={d.listHead}>
          <div className={d.tabs} role="tablist">
            <Link role="tab" aria-selected={state === 'open'} href={q({ state: 'open', id: '' })}>{t('open')} <span className={s.num}>{counts.open}</span></Link>
            <Link role="tab" aria-selected={state === 'resolved'} href={q({ state: 'resolved', id: '' })}>{t('resolved')} <span className={s.num}>{counts.resolved}</span></Link>
          </div>
          {admin ? (
            <label className={d.filter}>
              <span className="sr-only">{t('assignee')}</span>
              <select value={assignee} onChange={(e) => router.push(q({ assignee: e.target.value, id: '' }))}>
                <option value="">{t('assignee')}: {t('all')}</option>
                {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
          ) : null}
        </div>
        {items.length === 0 ? <p className={`${s.small} ${s.muted} ${d.pad}`}>{t('empty')}</p> : groups.map((g) => (
          <div key={g.project}>
            <div className={d.groupHead}><strong>{g.title}</strong><span className={`${s.small} ${s.muted}`}>{g.client} · {g.list.length}</span></div>
            <ul className={d.items}>
              {g.list.map((i) => (
                <li key={i.id}>
                  <Link href={q({ id: i.id })} className={d.item} aria-current={i.id === selectedId ? 'true' : undefined} data-note-id={i.id} scroll={false}>
                    <span className={d.thumb} style={{ backgroundImage: bg(i.thumbhash) }}>
                      {i.has_thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element -- authorized /m route
                        <img src={`/m/${i.asset_id}/w320.webp`} alt="" loading="lazy" />
                      ) : null}
                    </span>
                    <span className={d.itemText}>
                      <span className={d.itemHead}><strong>{i.author}</strong><span className={`${s.small} ${s.muted}`}>{formatRelative(i.created_at, locale)}</span></span>
                      <span className={d.itemBody}>{i.body}</span>
                      {i.status === 'in_progress' ? <span className={d.state}>{tn('status.in_progress')}{i.assignee_name ? ` · ${i.assignee_name}` : ''}</span> : null}
                    </span>
                    {i.anchor === 'time' && i.t != null ? <span className={d.time}>{clock(i.t)}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className={s.card} aria-label={sel?.file ?? t('pick')} data-testid="note-detail">
        {!sel || !note ? <p className={`${s.small} ${s.muted} ${d.pad}`}>{t('pick')}</p> : (
          <div className={d.detail}>
            <div className={d.detailHead}>
              <div>
                <bdi className={d.file} dir="ltr">{sel.file}</bdi>
                <div className={`${s.small} ${s.muted}`}>{sel.project_title} · {sel.client_name}</div>
              </div>
              <Link href={`/admin/projects/${sel.project_id}`} className={d.link}>{t('openProject')} <ArrowUpRight size={14} aria-hidden /></Link>
            </div>
            <div className={d.media} style={{ backgroundImage: bg(sel.thumbhash) }}>
              {sel.has_thumb ? (
                // eslint-disable-next-line @next/next/no-img-element -- authorized /m route
                <img src={`/m/${sel.asset_id}/w1280.webp`} alt="" />
              ) : null}
              {thread.filter((n) => n.anchor === 'pin' && n.x != null).map((n) => (
                <span key={n.id} className={d.pin} data-active={n.id === note.id} style={{ left: `${n.x! * 100}%`, top: `${n.y! * 100}%` }}>{n.n}</span>
              ))}
              {sel.anchor === 'time' && sel.t != null ? <span className={d.mediaTime}>{t('at', { time: clock(sel.t) })}</span> : null}
            </div>
            <div className={d.noteCard}>
              <div className={d.itemHead}>
                {note.anchor === 'pin' ? <span className={d.pinSmall}>{note.n}</span> : null}
                <strong>{note.author}</strong><span className={`${s.small} ${s.muted}`}>{sel.client_name} · {formatRelative(note.createdAt, locale)}</span>
              </div>
              <p className={d.body}>{note.body}</p>
              {note.replies.map((r) => (
                <div key={r.id} className={d.reply}><span className={d.replyAuthor}>{r.author}</span><p className={d.body}>{r.body.startsWith('replaced:') ? t('replaced') : r.body}</p></div>
              ))}
            </div>
            {sel.replaced ? <p className={`${s.small} ${s.muted}`}>{t('replaced')}</p> : (
              <>
                <label className={d.field}>
                  <span>{t('replyTo', { name: note.author })}</span>
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} maxLength={2000} data-testid="reply-input" />
                  <span className={`${s.small} ${s.muted}`}>{t('replyHelp')}</span>
                </label>
                <div className={d.fields}>
                  {admin ? (
                    <label className={d.field}><span>{t('assignee')}</span>
                      <select value={sel.assignee_id ?? ''} data-testid="assignee" onChange={async (e) => { if (await patch(sel.id, { assigneeId: e.target.value || null })) done(t('saved')); else setMsg(t('failed')); }}>
                        <option value="">{t('none')}</option>
                        {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </label>
                  ) : null}
                  <label className={d.field}><span>{t('status')}</span>
                    <select value={sel.status} data-testid="status" onChange={async (e) => { if (await patch(sel.id, { status: e.target.value })) done(t('saved')); else setMsg(t('failed')); }}>
                      {(['open', 'in_progress', 'resolved'] as const).map((x) => <option key={x} value={x}>{tn(`status.${x}`)}</option>)}
                    </select>
                  </label>
                </div>
                <div className={d.actions}>
                  <button type="button" className={d.primary} disabled={busy || !reply.trim()} data-testid="reply-send" onClick={async () => {
                    setBusy(true);
                    const r = await postJson(`/api/admin/notes/${sel.id}/reply`, { body: reply.trim() });
                    setBusy(false);
                    if (r.ok) { setReply(''); done(t('saved')); } else setMsg(t('failed'));
                  }}>{t('send')}</button>
                  <button type="button" className={d.secondary} disabled={busy} onClick={() => file.current?.click()} data-testid="replace">
                    <Upload size={16} aria-hidden />{progress != null ? t('replacing', { pct: `${progress}%` }) : t('replace')}
                  </button>
                  <input ref={file} type="file" hidden data-testid="replace-file" onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    setBusy(true); setProgress(0);
                    try {
                      await uploadOne(f, { projectId: sel.project_id, replaces: sel.asset_id }, setProgress);
                      done(t('saved'));
                    } catch { setMsg(t('failed')); }
                    setBusy(false); setProgress(null);
                  }} />
                  {sel.status !== 'resolved' ? (
                    <button type="button" className={d.ghost} onClick={async () => { if (await patch(sel.id, { status: 'resolved' })) done(t('saved')); }}>
                      <Check size={16} aria-hidden />{t('resolve')}
                    </button>
                  ) : (
                    <button type="button" className={d.ghost} onClick={async () => { if (await patch(sel.id, { status: 'open' })) done(t('saved')); }}>{t('reopen')}</button>
                  )}
                </div>
                <p className={`${s.small} ${s.muted}`}>{t('replaceHelp')}</p>
              </>
            )}
            {msg ? <p className={d.msg} role="status">{msg}</p> : null}
          </div>
        )}
      </section>
    </div>
  );
}
