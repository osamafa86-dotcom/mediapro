import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { PageHead } from '@/components/admin/AdminShell';
import { ClientPanel, type ClientValues } from '@/components/admin/ClientPanel';
import { ListFilters } from '@/components/admin/ListFilters';
import s from '@/components/admin/admin.module.css';
import { getSql } from '@/db';
import type { Locale } from '@/i18n/config';
import { normSql } from '@/lib/admin/queries';
import { requireStaffPage } from '@/lib/auth/session';
import { isUuid } from '@/lib/authz';
import { daysUntil, formatDay, searchTokens } from '@/lib/format';
import { getSettings } from '@/lib/settings';

type SP = Record<string, string | undefined>;

export async function generateMetadata() { return { title: (await getTranslations('admin'))('nav.clients') }; }

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireStaffPage(['admin']);
  const sp = await searchParams;
  const t = await getTranslations('admin');
  const locale = (await getLocale()) as Locale;
  const { region, linkDefaults } = await getSettings();
  const sql = getSql();
  const q = sp.q?.slice(0, 100) ?? '';
  const kind = sp.kind === 'partner' || sp.kind === 'beneficiary' ? sp.kind : '';
  const status = sp.status === 'archived' ? 'archived' : 'active';
  // every search word must appear in the client's names or contact (Arabic/Turkish-normalized)
  const nameMatch = searchTokens(q).reduce((acc, tok) => sql`${acc} and ${normSql(sql`c.name_ar || ' ' || coalesce(c.name_tr, '') || ' ' || coalesce(c.contact_name, '')`)} like ${`%${tok.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`}`, sql``);

  const [rows, [tot]] = await Promise.all([
    sql<{ id: string; name_ar: string; name_tr: string | null; kind: 'partner' | 'beneficiary'; contact_name: string | null; projects: number;
      last_published: string | null; active_links: number; soonest: string | null; unopened: number }[]>`
      select c.id, c.name_ar, c.name_tr, c.kind, c.contact_name,
        (select count(*) from projects p where p.client_id = c.id and p.archived_at is null)::int as projects,
        (select max(p.published_at) from projects p where p.client_id = c.id) as last_published,
        (select count(*) from links l where l.client_id = c.id and l.revoked_at is null and l.expires_at > now())::int as active_links,
        (select min(l.expires_at) from links l where l.client_id = c.id and l.revoked_at is null and l.expires_at > now()) as soonest,
        (select count(*) from links l where l.client_id = c.id and l.revoked_at is null and l.expires_at > now() and l.opens = 0)::int as unopened
      from clients c
      where ${status === 'archived' ? sql`c.archived_at is not null` : sql`c.archived_at is null`}
        ${kind ? sql`and c.kind = ${kind}` : sql``}
        ${nameMatch}
      order by last_published desc nulls last, c.name_ar
      limit 500`,
    sql<{ n: number }[]>`select count(*)::int as n from clients`,
  ]);

  const selectedId = sp.id && isUuid(sp.id) ? sp.id : null;
  let selected: (ClientValues & { id: string | null; createdAt?: string; projects?: number; archived?: boolean }) | null = null;
  if (selectedId) {
    const [c] = await sql<{ id: string; name_ar: string; name_tr: string | null; kind: 'partner' | 'beneficiary'; contact_name: string | null; contact_phone: string | null;
      contact_email: string | null; locale: 'ar' | 'tr'; default_link_days: number; allow_raw: boolean; expiry_reminder: boolean; created_at: string; archived_at: string | null; projects: number }[]>`
      select c.*, (select count(*) from projects p where p.client_id = c.id)::int as projects from clients c where c.id = ${selectedId}`;
    if (c) selected = {
      id: c.id, nameAr: c.name_ar, nameTr: c.name_tr ?? '', kind: c.kind, contactName: c.contact_name ?? '', contactPhone: c.contact_phone ?? '', contactEmail: c.contact_email ?? '',
      locale: c.locale, defaultLinkDays: c.default_link_days, allowRaw: c.allow_raw, expiryReminder: c.expiry_reminder,
      createdAt: formatDay(c.created_at, locale, region.timeZone), projects: c.projects, archived: !!c.archived_at,
    };
  } else if (sp.new === '1') {
    selected = { id: null, nameAr: '', nameTr: '', kind: 'beneficiary', contactName: '', contactPhone: '', contactEmail: '', locale: 'ar', defaultLinkDays: linkDefaults.days, allowRaw: linkDefaults.rawDefault, expiryReminder: linkDefaults.expiryReminder };
  }
  const keep = (extra: Record<string, string>) => {
    const u = new URLSearchParams(); if (q) u.set('q', q); if (kind) u.set('kind', kind); if (status !== 'active') u.set('status', status);
    for (const [k, v] of Object.entries(extra)) u.set(k, v);
    return `?${u}`;
  };

  return (
    <>
      <PageHead title={t('nav.clients')} subtitle={t('clients.subtitle')}
        actions={<Link href={keep({ new: '1' })} className={s.btnPrimary} scroll={false}>+ {t('clients.new')}</Link>} />
      <div className={selected ? s.split : undefined}>
        <section className={`${s.card} ${s.tableWrap}`}>
          <ListFilters
            q={q} placeholder={t('clients.search')}
            selects={[
              { key: 'kind', label: t('clients.kindFilter'), value: kind, options: [{ value: 'partner', label: t('clients.kind.partner') }, { value: 'beneficiary', label: t('clients.kind.beneficiary') }] },
              { key: 'status', label: t('clients.statusFilter'), value: status === 'archived' ? 'archived' : '', options: [{ value: 'archived', label: t('clients.archived') }], emptyLabel: `${t('clients.statusFilter')}: ${t('clients.active')}` },
            ]}
          />
          {rows.length === 0 ? <div className={s.emptyState}><p>{t('clients.empty')}</p></div> : (
            <table className={s.table} data-testid="clients-table">
              <caption>{t('nav.clients')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('clients.col.org')}</th>
                  <th scope="col" className={s.numCol}>{t('clients.col.projects')}</th>
                  <th scope="col">{t('clients.col.last')}</th>
                  <th scope="col">{t('clients.col.links')}</th>
                  <th scope="col" className={s.menuCol}><span className="sr-only">{t('archive.col.actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const name = locale === 'tr' ? c.name_tr || c.name_ar : c.name_ar;
                  const left = c.soonest ? daysUntil(c.soonest) : null;
                  const linkText = c.active_links === 0 ? t('clients.linksNone')
                    : left !== null && left <= 7 ? t('clients.linksExpiring', { n: left })
                    : c.unopened === c.active_links ? t('clients.linksUnopened') : t('clients.linksActive', { n: c.active_links });
                  const tone = c.active_links === 0 || c.unopened === c.active_links ? s.tertiary : left !== null && left <= 7 ? s.linkWarn : s.accentText;
                  return (
                    <tr key={c.id} data-id={c.id} data-selected={selected?.id === c.id || undefined}>
                      <td>
                        <Link href={keep({ id: c.id })} className={s.projectCell} scroll={false} style={{ color: 'inherit', textDecoration: 'none' }}>
                          <span className={s.initial} aria-hidden>{name.trim().charAt(0)}</span>
                          <span className={s.projectText}>
                            <strong style={{ fontWeight: 500 }}>{name}</strong>
                            <span>{t(`clients.kind.${c.kind}`)}{c.contact_name ? ` · ${c.contact_name}` : ''}</span>
                          </span>
                        </Link>
                      </td>
                      <td className={s.numCol}>{c.projects}</td>
                      <td className={s.num}>{c.last_published ? formatDay(c.last_published, locale, region.timeZone) : '—'}</td>
                      <td><span className={`${s.small} ${tone}`}>{linkText}</span></td>
                      <td className={s.menuCol}><Link href={keep({ id: c.id })} className={s.rowMenu} aria-label={`${t('clients.edit')}: ${name}`} scroll={false}><ChevronLeft className={s.chev} size={18} aria-hidden style={{ marginInlineStart: 0 }} /></Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div className={s.pager}><span>{t('clients.footer', { shown: rows.length, total: tot!.n })}</span></div>
        </section>
        {selected ? <ClientPanel key={selected.id ?? 'new'} client={selected} closeHref={keep({})} /> : null}
      </div>
    </>
  );
}
