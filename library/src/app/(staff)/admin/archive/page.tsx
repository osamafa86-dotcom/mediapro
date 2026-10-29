import { Archive, Camera, Check, ChevronLeft, CloudDownload, Users } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { PageHead } from '@/components/admin/AdminShell';
import { ArchiveFilters } from '@/components/admin/ArchiveFilters';
import { ArchiveTable, type ArchiveItem } from '@/components/admin/ArchiveTable';
import { NewProjectButton } from '@/components/admin/ProjectDialog';
import s from '@/components/admin/admin.module.css';
import { getSql } from '@/db';
import type { Locale } from '@/i18n/config';
import { archive, archiveFacets, PERIODS, STATUSES, type ArchiveFilters as F } from '@/lib/admin/queries';
import { requireStaffPage } from '@/lib/auth/session';
import { isUuid } from '@/lib/authz';
import { daysUntil, formatBytes, formatDay, formatNumber, formatPct, joinNames, ltr } from '@/lib/format';
import { can, getSettings } from '@/lib/settings';
import { storageStatus } from '@/lib/storage';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Only values we understand reach SQL; anything else is ignored rather than an error. */
function parseFilters(sp: SP): F {
  const pick = <T extends string>(v: string | undefined, allowed: readonly T[]) => (v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined);
  const id = (v: string | undefined) => (v && isUuid(v) ? v : undefined);
  return {
    q: one(sp.q)?.slice(0, 100) || undefined,
    client: id(one(sp.client)), photographer: id(one(sp.photographer)),
    type: one(sp.type)?.slice(0, 60) || undefined, tag: one(sp.tag)?.slice(0, 60) || undefined,
    media: pick(one(sp.media), ['photos', 'videos'] as const), status: pick(one(sp.status), STATUSES), period: pick(one(sp.period), PERIODS),
    archived: one(sp.archived) === '1', sort: one(sp.sort) === 'date_asc' ? 'date_asc' : 'date_desc',
    page: Math.min(10_000, Math.max(1, Number(one(sp.page)) || 1)),
  };
}

export async function generateMetadata() { return { title: (await getTranslations('admin'))('nav.archive') }; }

export default async function ArchivePage({ searchParams }: { searchParams: Promise<SP> }) {
  const staff = await requireStaffPage();
  const sp = await searchParams;
  const f = parseFilters(sp);
  const t = await getTranslations('admin');
  const locale = (await getLocale()) as Locale;
  const { region } = await getSettings();
  const [data, facets] = await Promise.all([archive(staff, f), archiveFacets(staff)]);
  const admin = staff.role === 'admin';
  const filtered = Object.entries(f).some(([k, v]) => !['sort', 'page'].includes(k) && v !== undefined && v !== false);
  const canCreate = await can(staff.role, 'createProject');

  const actions = (
    <>
      {admin ? <Link href="/admin/import" className={s.btnSecondary}><CloudDownload size={18} aria-hidden />{t('archive.importDrive')}</Link> : null}
      {canCreate ? <NewProjectButton /> : null}
    </>
  );

  if (data.all === 0 && !filtered && admin) return <FirstRun t={t} />;

  const tStatus = await getTranslations('status');
  const items: ArchiveItem[] = data.rows.map((r) => {
    const pct = r.uploads_total ? Math.round((r.uploads_done / r.uploads_total) * 100) : 0;
    let link: ArchiveItem['link'];
    if (r.status === 'uploading') link = { text: t('archive.link.uploading', { pct: formatPct(pct, locale) }), tone: 'muted' };
    else if (!r.link_expires_at) link = { text: t('archive.link.none'), tone: 'muted' };
    else {
      const left = daysUntil(r.link_expires_at);
      if (left <= 0) link = { text: t('archive.link.expired', { date: formatDay(r.link_expires_at, locale, region.timeZone) }), tone: 'muted' };
      else if (left <= 7) link = { text: t('archive.link.expiresIn', { n: left }), tone: 'warn' };
      else if (r.downloads > 0) link = { text: t('archive.link.downloads', { n: r.downloads }), tone: 'muted' };
      else link = { text: t('archive.link.opened', { n: r.link_opens ?? 0 }), tone: 'muted' };
    }
    return {
      id: r.id, title: r.title, client: locale === 'tr' ? r.client_name_tr || r.client_name_ar : r.client_name_ar,
      date: r.shot_date ? formatDay(r.shot_date, locale, 'UTC', region.digits) : '—',
      people: joinNames(r.photographers, locale),
      counts: `${formatNumber(r.photos, locale, region.digits)} · ${formatNumber(r.videos, locale, region.digits)}`,
      size: formatBytes(Number(r.bytes), locale, region.digits), status: r.status, statusLabel: tStatus(r.status as 'draft'),
      link, archived: !!r.archived_at,
    };
  });

  const qs = (patch: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) { const x = one(v); if (x) u.set(k, x); }
    for (const [k, v] of Object.entries(patch)) { if (v) u.set(k, v); else u.delete(k); }
    return `?${u.toString()}`;
  };

  return (
    <>
      <PageHead title={t('nav.archive')} subtitle={t('archive.subtitle')} actions={actions} />
      <ArchiveFilters
        values={{ q: f.q ?? '', period: f.period ?? '', client: f.client ?? '', photographer: f.photographer ?? '', type: f.type ?? '', media: f.media ?? '', status: f.status ?? '', tag: f.tag ?? '', archived: f.archived ? '1' : '' }}
        facets={{
          clients: facets.clients.map((c) => ({ value: c.id, label: locale === 'tr' ? c.name_tr || c.name_ar : c.name_ar })),
          people: facets.people.map((p) => ({ value: p.id, label: p.name })),
          types: facets.types.map((x) => ({ value: x, label: x })), tags: facets.tags.map((x) => ({ value: x, label: x })),
        }}
        showPeople={admin}
      />
      <ArchiveTable
        items={items}
        summary={`${t('archive.summary', { n: data.total, all: formatNumber(data.all, locale, region.digits) })}${f.q ? ` · ${t('archive.summaryQ', { q: f.q })}` : ''} · ${ltr(formatBytes(data.bytes, locale, region.digits))}`}
        sort={f.sort ?? 'date_desc'}
        sortHref={qs({ sort: f.sort === 'date_asc' ? undefined : 'date_asc', page: undefined })}
        admin={admin}
        archivedView={!!f.archived}
        emptyFiltered={filtered && data.total === 0}
        pager={data.pages > 1 ? { text: t('archive.page', { page: data.page, pages: data.pages }), prev: data.page > 1 ? qs({ page: String(data.page - 1) }) : null, next: data.page < data.pages ? qs({ page: String(data.page + 1) }) : null } : null}
      />
    </>
  );
}

async function FirstRun({ t }: { t: Awaited<ReturnType<typeof getTranslations<'admin'>>> }) {
  const sql = getSql();
  const [[c], st] = await Promise.all([
    sql<{ clients: number; team: number; imports: number }[]>`select (select count(*) from clients)::int as clients,
      (select count(*) from users where role <> 'admin')::int as team, (select count(*) from drive_imports where status = 'done')::int as imports`,
    storageStatus(),
  ]);
  const steps = [
    { done: st.state === 'connected', icon: Archive, title: t('archive.setupR2'), sub: st.state === 'unconfigured' ? t('archive.setupR2No') : st.state === 'error' ? t('archive.setupR2Err', { bucket: st.bucket }) : t('archive.setupR2Ok', { bucket: st.bucket }), href: '/admin/settings#storage' },
    { done: c!.imports > 0, icon: CloudDownload, title: t('archive.setupDrive'), sub: t('archive.setupDriveSub'), href: '/admin/import' },
    { done: c!.clients > 0, icon: Users, title: t('archive.setupClients'), sub: t('archive.setupClientsSub'), href: '/admin/clients?new=1' },
    { done: c!.team > 0, icon: Camera, title: t('archive.setupTeam'), sub: t('archive.setupTeamSub'), href: '/admin/team?invite=1' },
  ];
  return (
    <>
      <PageHead title={t('nav.archive')} subtitle={t('archive.firstRunSubtitle')} />
      <section className={s.emptyState} data-testid="archive-first-run">
        <span className={s.emptyIcon} aria-hidden><Archive size={30} /></span>
        <h2>{t('archive.firstRunTitle')}</h2>
        <p>{t('archive.firstRunBody')}</p>
        <div className={s.actions}>
          <Link href="/admin/import" className={s.btnPrimary}><CloudDownload size={18} aria-hidden />{t('archive.importDrive')}</Link>
          <NewProjectButton />
        </div>
        <div className={`${s.card} ${s.checklist}`}>
          <div className={s.cardHead} style={{ paddingBlockEnd: 16 }}>
            <h2>{t('archive.setup')}</h2>
            <span className={`${s.small} ${s.tertiary}`}>{t('archive.setupCount', { done: steps.filter((x) => x.done).length, total: steps.length })}</span>
          </div>
          <ul>
            {steps.map((x) => (
              <li key={x.title}>
                <Link href={x.href} data-done={x.done || undefined}>
                  <span className={`${s.stepIcon} ${x.done ? s.stepDone : ''}`} aria-hidden>{x.done ? <Check size={16} /> : <x.icon size={16} />}</span>
                  <span className={s.itemText}><strong>{x.title}</strong><span className={`${s.small} ${s.tertiary}`}>{x.sub}</span></span>
                  {x.done ? <span className={`${s.chev} ${s.small} ${s.tertiary}`}>{t('archive.setupDone')}</span> : <ChevronLeft className={s.chev} size={18} aria-hidden />}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
