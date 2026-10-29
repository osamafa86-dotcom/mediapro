'use client';
import { ChevronRight, CloudDownload, Folder, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { postJson } from '@/lib/client/api';
import type { ImportRow } from '@/lib/drive';
import type { Suggestion } from '@/lib/import-suggest';
import s from './admin.module.css';
import d from './import.module.css';

interface DriveFolder { id: string; name: string; suggestion: Suggestion; imported: string | null }
interface Plan { folderId: string; folderName: string; clientId: string; projectId: string; title: string; shotDate: string }
type ClientOpt = { id: string; name_ar: string; name_tr: string | null };

export function DriveImport({ notice, connection, imports, clients, projects }: {
  notice: string | null; connection: { connected: boolean; email: string | null };
  imports: ImportRow[]; clients: ClientOpt[]; projects: { id: string; client_id: string; title: string }[];
}) {
  const t = useTranslations('admin.import');
  const locale = useLocale();
  const router = useRouter();
  const [trail, setTrail] = useState<{ id: string; name: string }[]>([{ id: 'root', name: t('root') }]);
  // folders as last loaded, keyed by their parent: anything else is «loading»
  const [loaded, setLoaded] = useState<{ parent: string; folders: DriveFolder[]; error: string | null } | null>(null);
  const [plan, setPlan] = useState<Plan[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; warn: boolean } | null>(notice ? { text: t(`notice.${notice}`), warn: notice !== 'connected' } : null);
  const name = (c: ClientOpt) => (locale === 'tr' ? c.name_tr || c.name_ar : c.name_ar);
  const parent = trail.at(-1)!.id;

  useEffect(() => {
    if (!connection.connected) return;
    let live = true;
    void (async () => {
      const r = await fetch(`/api/admin/drive/folders?parent=${encodeURIComponent(parent)}`, { credentials: 'same-origin' });
      const j = (await r.json().catch(() => ({}))) as { folders?: DriveFolder[]; error?: string };
      if (live) setLoaded({ parent, folders: j.folders ?? [], error: r.ok ? null : j.error === 'drive_reconnect' ? t('reconnect') : t('unavailable') });
    })();
    return () => { live = false; };
  }, [connection.connected, parent, t]);
  const folders = loaded?.parent === parent ? loaded.folders : null;
  const error = loaded?.parent === parent ? loaded.error : null;

  // keep the history fresh while something is moving
  const moving = imports.some((i) => i.status === 'queued' || i.status === 'running');
  useEffect(() => {
    if (!moving) return;
    const id = window.setInterval(() => router.refresh(), 3000);
    return () => window.clearInterval(id);
  }, [moving, router]);

  const toggle = (f: DriveFolder) => setPlan((cur) => cur.some((p) => p.folderId === f.id)
    ? cur.filter((p) => p.folderId !== f.id)
    : [...cur, { folderId: f.id, folderName: f.name, clientId: f.suggestion.clientId ?? '', projectId: '', title: f.suggestion.title, shotDate: f.suggestion.date ?? '' }]);
  const edit = (id: string, patch: Partial<Plan>) => setPlan((cur) => cur.map((p) => (p.folderId === id ? { ...p, ...patch } : p)));

  async function start() {
    if (plan.some((p) => !p.clientId)) { setMsg({ text: t('needClient'), warn: true }); return; }
    setBusy(true);
    const r = await postJson('/api/admin/drive/imports', {
      items: plan.map((p) => ({ folderId: p.folderId, folderName: p.folderName, clientId: p.clientId, projectId: p.projectId || undefined, title: p.title, shotDate: p.shotDate || null })),
    });
    setBusy(false);
    if (!r.ok) { setMsg({ text: t('notice.failed'), warn: true }); return; }
    setPlan([]); setMsg({ text: t('started'), warn: false });
    router.refresh();
  }

  return (
    <div className={d.stack}>
      {msg ? <p className={d.notice} data-warn={msg.warn || undefined} role="status">{msg.text}</p> : null}

      {!connection.connected ? (
        <section className={`${s.card} ${s.emptyState}`} data-testid="drive-connect">
          <span className={s.emptyIcon} aria-hidden><CloudDownload size={30} /></span>
          <h2>{t('connectTitle')}</h2>
          <p>{t('connectBody')}</p>
          <a className={d.primary} href="/api/admin/drive/connect">{t('connect')}</a>
        </section>
      ) : (
        <div className={d.split}>
          <section className={s.card} aria-labelledby="h-folders" data-testid="drive-browser">
            <div className={s.cardHead}>
              <h2 id="h-folders">{t('folders')}</h2>
              <span className={d.account}>
                <span className={`${s.small} ${s.muted}`} dir="auto">{t('connectedAs', { email: connection.email ?? '—' })}</span>
                <button type="button" className={d.ghost} onClick={async () => { await postJson('/api/admin/drive/disconnect', {}); router.refresh(); }}>
                  <LogOut size={14} aria-hidden />{t('disconnect')}
                </button>
              </span>
            </div>
            <div className={s.cardBody}>
              <nav className={d.trail} aria-label={t('folders')}>
                {trail.map((c, i) => (
                  <span key={c.id} className={d.trailItem}>
                    {i ? <ChevronRight size={14} className={d.chev} aria-hidden /> : null}
                    {i < trail.length - 1 ? <button type="button" className={d.link} onClick={() => setTrail(trail.slice(0, i + 1))}>{c.name}</button> : <span aria-current="page" dir="auto">{c.name}</span>}
                  </span>
                ))}
              </nav>
              {error ? <p className={d.error} role="alert">{error}</p> : null}
              {folders === null ? <p className={`${s.small} ${s.muted}`}>{t('loading')}</p>
                : folders.length === 0 && !error ? <p className={`${s.small} ${s.muted}`}>{t('noFolders')}</p>
                : (
                  <ul className={d.folders}>
                    {folders.map((f) => {
                      const on = plan.some((p) => p.folderId === f.id);
                      const c = clients.find((x) => x.id === f.suggestion.clientId);
                      return (
                        <li key={f.id} className={d.folder} data-folder-id={f.id} data-selected={on}>
                          <label className={d.pick}>
                            <input type="checkbox" checked={on} onChange={() => toggle(f)} />
                            <Folder size={18} aria-hidden className={d.icon} />
                            <span className={d.fname}>
                              <bdi>{f.name}</bdi>
                              <span className={`${s.small} ${s.muted}`}>
                                {c ? name(c) : t('noSuggestion')}{f.suggestion.date ? <> · <bdi dir="ltr">{f.suggestion.date}</bdi></> : null}
                                {f.imported ? <> · <span className={d.badge}>{t('importedBefore')}</span></> : null}
                              </span>
                            </span>
                          </label>
                          <button type="button" className={d.ghost} onClick={() => setTrail([...trail, { id: f.id, name: f.name }])}>{t('open')}</button>
                        </li>
                      );
                    })}
                  </ul>
                )}
            </div>
          </section>

          <section className={s.card} aria-labelledby="h-plan" data-testid="drive-plan">
            <div className={s.cardHead}><h2 id="h-plan">{t('plan')}</h2></div>
            <div className={s.cardBody}>
              {plan.length === 0 ? <p className={`${s.small} ${s.muted}`}>{t('planEmpty')}</p> : (
                <ul className={d.plan}>
                  {plan.map((p) => (
                    <li key={p.folderId} data-plan-for={p.folderId}>
                      <strong dir="auto">{p.folderName}</strong>
                      <div className={d.fields}>
                        <label>{t('client')}
                          <select value={p.clientId} onChange={(e) => edit(p.folderId, { clientId: e.target.value, projectId: '' })} aria-invalid={!p.clientId}>
                            <option value="">{t('chooseClient')}</option>
                            {clients.map((c) => <option key={c.id} value={c.id}>{name(c)}</option>)}
                          </select>
                        </label>
                        <label>{t('project')}
                          <select value={p.projectId} onChange={(e) => edit(p.folderId, { projectId: e.target.value })} disabled={!p.clientId}>
                            <option value="">{t('newProject')}</option>
                            {projects.filter((x) => x.client_id === p.clientId).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                          </select>
                        </label>
                        {!p.projectId ? (
                          <>
                            <label>{t('titleLabel')}<input value={p.title} onChange={(e) => edit(p.folderId, { title: e.target.value })} maxLength={200} /></label>
                            <label>{t('date')}<input type="date" value={p.shotDate} onChange={(e) => edit(p.folderId, { shotDate: e.target.value })} dir="ltr" /></label>
                          </>
                        ) : null}
                      </div>
                      <button type="button" className={d.ghost} onClick={() => setPlan(plan.filter((x) => x.folderId !== p.folderId))}>{t('remove')}</button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className={d.primary} disabled={!plan.length || busy} onClick={start} data-testid="drive-start">
                {busy ? t('starting') : t('start', { n: plan.length })}
              </button>
            </div>
          </section>
        </div>
      )}

      <section className={s.card} aria-labelledby="h-history" data-testid="drive-history">
        <div className={s.cardHead}><h2 id="h-history">{t('history')}</h2></div>
        <div className={s.cardBody}>
          {imports.length === 0 ? <p className={`${s.small} ${s.muted}`}>{t('empty')}</p> : (
            <ul className={d.history}>
              {imports.map((i) => (
                <li key={i.id} data-import-id={i.id} data-status={i.status}>
                  <div className={d.row}>
                    <span className={d.fname}>
                      <bdi>{i.folder_name}</bdi>
                      <span className={`${s.small} ${s.muted}`}>{[i.client_name, i.project_title].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className={d.state} data-state={i.status}>{t(`status.${i.status}`)}</span>
                    <span className={`${s.num} ${s.small}`}>{t('progress', { done: i.done, total: i.total })}</span>
                    {i.failed ? <span className={d.failed}>{t('failedN', { n: i.failed })}</span> : null}
                    {i.project_id ? <Link className={d.link} href={`/admin/projects/${i.project_id}`}>{t('openProject')}</Link> : null}
                  </div>
                  {i.total ? <progress className={d.bar} max={i.total} value={i.done + i.failed} /> : null}
                  {i.error ? <p className={d.error}>{t(`reason.${i.error}`)}</p> : null}
                  {i.report.some((r) => !r.ok) ? (
                    <details className={d.details}>
                      <summary>{t('details')}</summary>
                      <ul>{i.report.filter((r) => !r.ok).map((r, k) => <li key={k}><bdi dir="ltr">{r.file}</bdi> — {t(`reason.${r.error ?? 'copy_failed'}`)}</li>)}</ul>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
