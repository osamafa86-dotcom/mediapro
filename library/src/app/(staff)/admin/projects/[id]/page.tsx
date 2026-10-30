import { Calendar, Camera, ChevronLeft, Film, Folder, Image as ImageIcon, MapPin, Upload } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { PageHead } from '@/components/admin/AdminShell';
import { AlbumMenu, NewAlbumButton } from '@/components/admin/Albums';
import { ProjectActions, LinkRowActions } from '@/components/admin/ProjectActions';
import { isPermanent } from '@/lib/links';
import { projectOptions } from '@/components/admin/ProjectDialog';
import s from '@/components/admin/admin.module.css';
import { MediaManager, type ManagedAsset } from '@/components/admin/MediaManager';
import type { AssetEdit, Renditions } from '@/db/schema';
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
  if (!isUuid(id) || !(await staffCanAccessProject(staff, id))) notFound();
  const sql = getSql();
  // the tab: «الصور», «الفيديو», or one of the project's albums (by id)
  const albums = await sql<{ id: string; name: string; n: number; created_by: string | null }[]>`
    select al.id, al.name, al.created_by, (select count(*)::int from assets a where a.album_id = al.id and a.replaced_by is null) as n
    from project_albums al where al.project_id = ${id} order by al.sort_order, al.created_at`;
  const asked = (await searchParams).tab;
  const album = albums.find((a) => a.id === asked) ?? null;
  const tab = album ? 'album' : asked === 'videos' ? 'videos' : 'photos';
  const t = await getTranslations('admin');
  const ts = await getTranslations('status');
  const locale = (await getLocale()) as Locale;
  const { region } = await getSettings();
  const admin = staff.role === 'admin';

  const [[p], members, counts, assets, links] = await Promise.all([
    sql<{ id: string; title: string; status: ProjectStatus; type: string | null; shot_date: string | null; place: string | null; archived_at: string | null;
      client_id: string; name_ar: string; name_tr: string | null; default_link_days: number; contact_email: string | null; cover_asset_id: string | null }[]>`
      select p.id, p.title, p.status, p.type, p.shot_date, p.place, p.archived_at, p.client_id, c.name_ar, c.name_tr, c.default_link_days, c.contact_email, p.cover_asset_id
      from projects p join clients c on c.id = p.client_id where p.id = ${id}`,
    sql<{ id: string; name: string }[]>`select u.id, u.name from project_members m join users u on u.id = m.user_id where m.project_id = ${id} order by u.name`,
    sql<{ section: string; n: number; ready: number; in_album: boolean }[]>`select section, album_id is not null as in_album, count(*)::int as n, count(*) filter (where status = 'ready')::int as ready
      from assets where project_id = ${id} and replaced_by is null group by section, album_id is not null`,
    // the whole section: reordering needs every item (2000 is far above any real shoot)
    sql<{ id: string; original_name: string; status: string; error: string | null; section: 'photos' | 'videos'; group: 'final' | 'raw' | 'footage';
      thumbhash: string | null; duration: number | null; renditions: Renditions; width: number | null; height: number | null; size: number;
      taken_at: string | null; uploaded_by: string | null; edit: AssetEdit | null }[]>`
      select id, original_name, status, error, section, "group", thumbhash, duration, renditions, width, height, size::float8 as size, taken_at, uploaded_by, edit
      from assets where project_id = ${id} and replaced_by is null
        and ${album ? sql`album_id = ${album.id}` : sql`section = ${tab} and album_id is null`}
      order by sort_order, original_name, created_at limit 2000`,
    admin
      ? sql<{ id: string; kind: 'client' | 'guest'; project_id: string | null; code: string | null; created_at: string; expires_at: string; revoked_at: string | null; opens: number; locked_until: string | null; has_pin: boolean }[]>`
        select id, kind, project_id, code, created_at, expires_at, revoked_at, opens, locked_until, pin_hash is not null as has_pin from links
        where project_id = ${id} or (project_id is null and client_id = (select client_id from projects where id = ${id}))
        order by created_at desc limit 20`
      : Promise.resolve([]),
  ]);
  if (!p) notFound();
  const favs = await favouriteCounts(id);
  const n = (sec: string) => counts.find((c) => c.section === sec && !c.in_album)?.n ?? 0;
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
            project={{ id: p.id, title: p.title, status: p.status, archived: !!p.archived_at, clientId: p.client_id, clientName: client, defaultDays: p.default_link_days, hasEmail: !!p.contact_email, readyCount: ready, timeZone: region.timeZone, assetCount: counts.reduce((a, c) => a + c.n, 0) }}
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
                        <strong>{isPermanent(l.expires_at) && kind === 'client' ? t('project.linkKind.permanent') : t(`project.linkKind.${kind}`)}</strong>
                        <span className={`${s.small} ${s.tertiary}`}>
                          {isPermanent(l.expires_at)
                            ? t('project.linkMetaPermanent', { created: formatRelative(l.created_at, locale), opens: t('archive.link.opened', { n: l.opens }) })
                            : t('project.linkMeta', { created: formatRelative(l.created_at, locale), opens: t('archive.link.opened', { n: l.opens }), expires: formatDay(l.expires_at, locale, region.timeZone) })}
                        </span>
                      </span>
                      {l.revoked_at ? <span className={`${s.small} ${s.tertiary}`}>{t('project.linkRevoked')}</span>
                        : expired ? <span className={`${s.small} ${s.tertiary}`}>{t('project.linkExpired')}</span>
                        : <>
                            {locked ? <span className={`${s.small} ${s.linkWarn}`}>{t('project.linkLocked', { time: new Intl.DateTimeFormat('en-GB', { timeStyle: 'short', timeZone: region.timeZone }).format(new Date(l.locked_until!)) })}</span> : null}
                            <LinkRowActions id={l.id} code={l.code} hasPin={l.has_pin} />
                          </>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      <div className={s.tabsRow}>
        <div className={`${s.segmented} ${s.albumTabs}`} role="tablist" aria-label={t('albums.label')} data-testid="project-tabs">
          {(['photos', 'videos'] as const).map((sec) => (
            <Link key={sec} href={`?tab=${sec}`} role="tab" aria-selected={tab === sec} className={s.tabLink} scroll={false}>
              {sec === 'photos' ? <ImageIcon size={16} aria-hidden /> : <Film size={16} aria-hidden />}
              {t(`project.${sec}`)} <span className={s.num}>{formatNumber(n(sec), locale, region.digits)}</span>
            </Link>
          ))}
          {albums.map((al) => (
            <Link key={al.id} href={`?tab=${al.id}`} role="tab" aria-selected={album?.id === al.id} className={s.tabLink} scroll={false} data-album-id={al.id}>
              <Folder size={16} aria-hidden /><bdi>{al.name}</bdi> <span className={s.num}>{formatNumber(al.n, locale, region.digits)}</span>
            </Link>
          ))}
        </div>
        <NewAlbumButton projectId={id} />
      </div>

      {album ? (
        <div className={s.albumHead} data-testid="album-head">
          <h2><Folder size={18} aria-hidden /><bdi>{album.name}</bdi></h2>
          <span className={`${s.small} ${s.muted}`}>{t('albums.mixed')}</span>
          <span className={s.albumHeadEnd}>
            <Link href={`/upload/${id}?album=${album.id}`} className={s.btnLink}><Upload size={16} aria-hidden />&nbsp;{t('albums.uploadHere')}</Link>
            <AlbumMenu projectId={id} album={album} canDelete={admin || album.created_by === staff.id} />
          </span>
        </div>
      ) : null}

      <section aria-label={album ? album.name : t(`project.${tab as 'photos' | 'videos'}`)}>
        {assets.length === 0 ? (
          <div className={`${s.card} ${s.emptyState}`} style={{ paddingBlock: 32 }}>
            <h2 style={{ fontSize: 17 }}>{album ? t('albums.empty') : t('project.emptyMedia')}</h2>
            <p className={s.small}>{album ? t('albums.emptyHint') : t('project.emptyMediaHint')}</p>
          </div>
        ) : (
          <MediaManager key={album?.id ?? tab} projectId={id} section={tab === 'videos' ? 'videos' : 'photos'} albumId={album?.id ?? null}
            albums={albums.map((x) => ({ id: x.id, name: x.name }))} coverId={p.cover_asset_id} digits={region.digits} canReorder
            items={assets.map((a): ManagedAsset => ({
              ...a, favs: favs[a.id] ?? 0,
              // the admin deletes anything; a member what they uploaded, while the client cannot have it yet
              deletable: admin || (a.uploaded_by === staff.id && p.status !== 'published'),
              view: {
                id: a.id, name: a.original_name, section: a.section, group: a.group, w: a.width ?? 0, h: a.height ?? 0, size: a.renditions.edited?.size ?? a.size,
                duration: a.duration, taken: a.taken_at, hash: a.thumbhash, widths: (a.renditions.images ?? []).map((i) => i.w),
                web: !!(a.section === 'photos' ? a.renditions.web : a.renditions.mp4_1080), quality: null,
              },
            }))} />
        )}
      </section>

    </>
  );
}
