import { Calendar, Camera, ChevronLeft, Film, Image as ImageIcon, MapPin } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { PageHead } from '@/components/admin/AdminShell';
import { ProjectActions, LinkRowActions } from '@/components/admin/ProjectActions';
import { projectOptions } from '@/components/admin/ProjectDialog';
import s from '@/components/admin/admin.module.css';
import { MediaTile, type TileAsset } from '@/components/media/MediaTile';
import { StatusBadge, type ProjectStatus } from '@/components/ui';
import { getSql } from '@/db';
import type { Locale } from '@/i18n/config';
import { requireStaffPage } from '@/lib/auth/session';
import { isUuid, staffCanAccessProject } from '@/lib/authz';
import { daysUntil, formatDay, formatNumber, formatRelative, joinNames } from '@/lib/format';
import { favouriteCounts } from '@/lib/notes';
import { getSettings } from '@/lib/settings';

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const staff = await requireStaffPage();
  const { id } = await params;
  const tab = (await searchParams).tab === 'videos' ? 'videos' : 'photos';
  if (!isUuid(id) || !(await staffCanAccessProject(staff, id))) notFound();
  const t = await getTranslations('admin');
  const ts = await getTranslations('status');
  const locale = (await getLocale()) as Locale;
  const { region } = await getSettings();
  const admin = staff.role === 'admin';
  const sql = getSql();

  const [[p], members, counts, assets, links] = await Promise.all([
    sql<{ id: string; title: string; status: ProjectStatus; type: string | null; shot_date: string | null; place: string | null; archived_at: string | null;
      client_id: string; name_ar: string; name_tr: string | null; default_link_days: number; contact_email: string | null }[]>`
      select p.id, p.title, p.status, p.type, p.shot_date, p.place, p.archived_at, p.client_id, c.name_ar, c.name_tr, c.default_link_days, c.contact_email
      from projects p join clients c on c.id = p.client_id where p.id = ${id}`,
    sql<{ id: string; name: string }[]>`select u.id, u.name from project_members m join users u on u.id = m.user_id where m.project_id = ${id} order by u.name`,
    sql<{ section: string; n: number; ready: number }[]>`select section, count(*)::int as n, count(*) filter (where status = 'ready')::int as ready from assets where project_id = ${id} and replaced_by is null group by section`,
    sql<TileAsset[]>`select id, original_name, status, error, section, thumbhash, duration, renditions from assets where project_id = ${id} and section = ${tab} and replaced_by is null order by sort_order, original_name, created_at limit 48`,
    admin
      ? sql<{ id: string; kind: 'client' | 'guest'; project_id: string | null; code: string | null; created_at: string; expires_at: string; revoked_at: string | null; opens: number; locked_until: string | null }[]>`
        select id, kind, project_id, code, created_at, expires_at, revoked_at, opens, locked_until from links
        where project_id = ${id} or (project_id is null and client_id = (select client_id from projects where id = ${id}))
        order by created_at desc limit 20`
      : Promise.resolve([]),
  ]);
  if (!p) notFound();
  const favs = await favouriteCounts(id);
  const n = (sec: string) => counts.find((c) => c.section === sec)?.n ?? 0;
  const ready = counts.reduce((a, c) => a + c.ready, 0);
  const client = locale === 'tr' ? p.name_tr || p.name_ar : p.name_ar;
  const options = await projectOptions();

  return (
    <>
      <nav className={s.crumbs} aria-label={t('nav.archive')}>
        <Link href="/admin/archive">{t('nav.archive')}</Link>
        <ChevronLeft size={14} aria-hidden className={s.chev} style={{ marginInlineStart: 0 }} />
        <span aria-current="page">{p.title}</span>
      </nav>
      <PageHead
        title={p.title}
        actions={
          <ProjectActions
            admin={admin}
            project={{ id: p.id, title: p.title, status: p.status, archived: !!p.archived_at, clientId: p.client_id, clientName: client, defaultDays: p.default_link_days, hasEmail: !!p.contact_email, readyCount: ready, timeZone: region.timeZone }}
            edit={{ options, values: { title: p.title, clientId: p.client_id, type: p.type ?? '', shotDate: p.shot_date ?? '', place: p.place ?? '', memberIds: members.map((m) => m.id) } }}
          />
        }
      />
      <div className={s.titleRow} style={{ marginBlockStart: -12 }}>
        <StatusBadge status={p.status} label={ts(p.status)} />
        <div className={s.meta}>
          <span>{client}</span>
          {p.shot_date ? <span><Calendar size={14} aria-hidden /><span className={s.num}>{formatDay(p.shot_date, locale, 'UTC', region.digits)}</span></span> : null}
          {p.place ? <span><MapPin size={14} aria-hidden />{p.place}</span> : null}
          {members.length ? <span><Camera size={14} aria-hidden />{joinNames(members.map((m) => m.name), locale)}</span> : null}
        </div>
      </div>

      {admin ? (
        <section className={s.card} aria-labelledby="h-links" data-testid="project-links">
          <div className={s.cardHead}><h2 id="h-links">{t('project.links')}</h2></div>
          <div className={s.cardBody}>
            {links.length === 0 ? <p className={`${s.small} ${s.muted}`}>{t('project.linksEmpty')}</p> : (
              <ul className={s.linksList}>
                {links.map((l) => {
                  const kind = l.kind === 'guest' ? 'guest' : l.project_id ? 'client' : 'library';
                  const expired = daysUntil(l.expires_at) <= 0;
                  const locked = l.locked_until && new Date(l.locked_until) > new Date();
                  return (
                    <li key={l.id} data-link-id={l.id}>
                      <span className={s.itemText}>
                        <strong>{t(`project.linkKind.${kind}`)}</strong>
                        <span className={`${s.small} ${s.tertiary}`}>
                          {t('project.linkMeta', { created: formatRelative(l.created_at, locale), opens: t('archive.link.opened', { n: l.opens }), expires: formatDay(l.expires_at, locale, region.timeZone) })}
                        </span>
                      </span>
                      {l.revoked_at ? <span className={`${s.small} ${s.tertiary}`}>{t('project.linkRevoked')}</span>
                        : expired ? <span className={`${s.small} ${s.tertiary}`}>{t('project.linkExpired')}</span>
                        : <>
                            {locked ? <span className={`${s.small} ${s.linkWarn}`}>{t('project.linkLocked', { time: new Intl.DateTimeFormat('en-GB', { timeStyle: 'short', timeZone: region.timeZone }).format(new Date(l.locked_until!)) })}</span> : null}
                            <LinkRowActions id={l.id} code={l.code} />
                          </>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      <div className={s.segmented} role="tablist" aria-label={t('project.photos')}>
        {(['photos', 'videos'] as const).map((sec) => (
          <Link key={sec} href={`?tab=${sec}`} role="tab" aria-selected={tab === sec} className={s.tabLink} scroll={false}>
            {sec === 'photos' ? <ImageIcon size={16} aria-hidden /> : <Film size={16} aria-hidden />}
            {t(`project.${sec}`)} <span className={s.num}>{formatNumber(n(sec), locale, region.digits)}</span>
          </Link>
        ))}
      </div>

      <section aria-label={t(`project.${tab}`)}>
        {assets.length === 0 ? (
          <div className={`${s.card} ${s.emptyState}`} style={{ paddingBlock: 32 }}>
            <h2 style={{ fontSize: 17 }}>{t('project.emptyMedia')}</h2>
            <p className={s.small}>{t('project.emptyMediaHint')}</p>
          </div>
        ) : (
          <ul className={s.grid} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {assets.map((a) => <li key={a.id} data-asset-id={a.id}><MediaTile a={a} favs={favs[a.id] ?? 0} /></li>)}
          </ul>
        )}
        {n(tab) > assets.length ? <p className={`${s.small} ${s.tertiary}`} style={{ marginBlockStart: 12 }}>{t('project.moreMedia', { n: formatNumber(n(tab) - assets.length, locale, region.digits) })}</p> : null}
      </section>

    </>
  );
}
