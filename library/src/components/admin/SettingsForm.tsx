'use client';
import { Bell, Film, Globe, HardDrive, KeyRound, Link2, Lock, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { Button, TextField } from '@/components/ui';
import type { Settings } from '@/lib/settings';
import { fetchJson } from './ProjectForm';
import { SwitchRow } from './SwitchRow';
import s from './admin.module.css';

type Editable = Pick<Settings, 'identity' | 'linkDefaults' | 'region' | 'notifications' | 'storage'>;
const PRESETS = [7, 14, 30, 90];
const TB = 1024 ** 4;

/** «الإعدادات» (Figma 62:713). One save for the whole page, as in the design; the logo saves on upload. */
export function SettingsForm({ initial, logoVersion, storage, ssoEnabled }: {
  initial: Settings; logoVersion: number | null; ssoEnabled: boolean;
  storage: { state: string; bucket: string; region: string; originals: string; renditions: string; free: string; quota: string; pctOriginals: number; pctRenditions: number };
}) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [v, setV] = useState<Editable>({ identity: initial.identity, linkDefaults: initial.linkDefaults, region: initial.region, notifications: initial.notifications, storage: initial.storage });
  const [custom, setCustom] = useState(!PRESETS.includes(initial.linkDefaults.days));
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [logo, setLogo] = useState(logoVersion);
  const file = useRef<HTMLInputElement>(null);
  const set = <S extends keyof Editable, K extends keyof Editable[S]>(sec: S, k: K, val: Editable[S][K]) => setV((x) => ({ ...x, [sec]: { ...x[sec], [k]: val } }));

  async function save() {
    setBusy(true); setMsg(null);
    for (const key of Object.keys(v) as (keyof Editable)[]) {
      const r = await fetchJson(`/api/admin/settings/${key}`, 'PUT', v[key]);
      if (!r.ok) { setBusy(false); setMsg({ kind: 'error', text: t('common.error') }); return; }
    }
    setBusy(false); setMsg({ kind: 'ok', text: t('common.saved') });
    // the new language shows at once here too: this browser's language choice follows the saved setting
    if (v.region.locale !== locale) document.cookie = `locale=${v.region.locale}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  async function uploadLogo(f: File) {
    setMsg(null);
    if (f.size > 512 * 1024) { setMsg({ kind: 'error', text: t('settings.logoTooLarge') }); return; }
    const fd = new FormData(); fd.set('logo', f);
    const csrf = document.cookie.split('; ').find((c) => c.startsWith('ml_csrf=') || c.startsWith('__Host-ml_csrf='))?.split('=')[1] ?? '';
    const res = await fetch('/api/admin/settings/logo', { method: 'POST', body: fd, headers: { 'x-csrf-token': decodeURIComponent(csrf) } });
    if (res.ok) { setLogo(Date.now()); router.refresh(); }
    else setMsg({ kind: 'error', text: res.status === 415 ? t('settings.logoType') : res.status === 413 ? t('settings.logoTooLarge') : t('common.error') });
  }

  const sections = [
    { id: 'identity', icon: Film, label: t('settings.s.identity') },
    { id: 'links', icon: Link2, label: t('settings.s.links') },
    { id: 'region', icon: Globe, label: t('settings.s.region') },
    { id: 'storage', icon: HardDrive, label: t('settings.s.storage') },
    { id: 'notifications', icon: Bell, label: t('settings.s.notifications') },
    { id: 'sso', icon: KeyRound, label: t('settings.s.sso') },
  ];
  const preview = new Intl.DateTimeFormat(v.region.locale === 'ar' ? `ar-PS-u-nu-${v.region.digits}` : 'tr-TR',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: v.region.timeZone }).format(new Date());

  return (
    <>
      <header className={s.pageHead}>
        <div><h1 className={s.pageTitle}>{t('nav.settings')}</h1><p className={s.pageSub}>{t('settings.subtitle')}</p></div>
        <div className={s.actions} style={{ alignItems: 'center' }}>
          {msg ? <p className={s.formMsg} data-kind={msg.kind} role={msg.kind === 'error' ? 'alert' : 'status'}>{msg.text}</p> : null}
          <Button variant="primary" isDisabled={busy} onPress={() => void save()}>{t('common.saveChanges')}</Button>
        </div>
      </header>
      <div className={s.settingsLayout}>
        <nav className={s.settingsNav} aria-label={t('nav.settings')}>
          {sections.map((x) => <a key={x.id} href={`#${x.id}`}><x.icon size={16} aria-hidden />{x.label}</a>)}
        </nav>
        <div className={s.settingsSections}>
          <section id="identity" className={`${s.card} ${s.section}`} aria-labelledby="h-identity">
            <div className={s.sectionHead}><h2 id="h-identity">{t('settings.s.identity')}</h2><p>{t('settings.identitySub')}</p></div>
            <div className={s.sectionBody}>
              <div className={s.projectCell}>
                <span className={`${s.emptyIcon}`} style={{ inlineSize: 64, blockSize: 64, borderRadius: 12 }} aria-hidden>
                  {/* eslint-disable-next-line @next/next/no-img-element -- tiny same-origin logo; next/image adds nothing here */}
            {logo ? <img src={`/api/branding/logo?v=${logo}`} alt="" width={40} height={40} style={{ objectFit: 'contain' }} /> : <Film size={26} />}
                </span>
                <span className={s.itemText}><strong>{t('settings.logo')}</strong><span className={`${s.small} ${s.tertiary}`}>{t('settings.logoSub')}</span></span>
                <input ref={file} type="file" accept="image/png,image/webp,image/jpeg" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo(f); e.target.value = ''; }} data-testid="logo-input" />
                <Button variant="secondary" icon={<Upload size={16} />} onPress={() => file.current?.click()}>{t('settings.uploadLogo')}</Button>
                {logo ? <Button variant="ghost" onPress={async () => { await fetchJson('/api/admin/settings/logo', 'DELETE'); setLogo(null); router.refresh(); }}>{t('settings.removeLogo')}</Button> : null}
              </div>
              <div className={s.row2}>
                <TextField label={t('settings.nameAr')} value={v.identity.nameAr} onChange={(x) => set('identity', 'nameAr', x)} isRequired />
                <TextField label={t('settings.nameTr')} value={v.identity.nameTr} onChange={(x) => set('identity', 'nameTr', x)} isRequired />
              </div>
            </div>
          </section>

          <section id="links" className={`${s.card} ${s.section}`} aria-labelledby="h-links">
            <div className={s.sectionHead}><h2 id="h-links">{t('settings.s.links')}</h2><p>{t('settings.linksSub')}</p></div>
            <div className={s.sectionBody} style={{ gap: 0 }}>
              <div style={{ paddingBlockEnd: 12 }}>
                <span className={s.fieldLabel} id="days-label">{t('settings.defaultDays')}</span>
                <div className={s.segmented} role="group" aria-labelledby="days-label">
                  {PRESETS.map((d) => <button key={d} type="button" aria-pressed={!custom && v.linkDefaults.days === d} onClick={() => { setCustom(false); set('linkDefaults', 'days', d); }}>{t('share.days', { n: d })}</button>)}
                  <button type="button" aria-pressed={custom} onClick={() => setCustom(true)}>{t('settings.custom')}</button>
                </div>
                {custom ? (
                  <div style={{ maxInlineSize: 200, marginBlockStart: 8 }}>
                    <TextField label={t('settings.customDays')} type="number" value={String(v.linkDefaults.days)} onChange={(x) => set('linkDefaults', 'days', Math.min(365, Math.max(1, Number(x) || 1)))} />
                  </div>
                ) : null}
                <p className={s.fieldHelp}>{t('settings.defaultDaysHelp')}</p>
              </div>
              <SwitchRow title={t('settings.pinAlways')} hint={t('settings.pinAlwaysSub')} isSelected isDisabled />
              <SwitchRow title={t('settings.reminder')} hint={t('settings.reminderSub')} isSelected={v.linkDefaults.expiryReminder} onChange={(x) => set('linkDefaults', 'expiryReminder', x)} />
              <SwitchRow title={t('settings.watermark')} hint={t('settings.watermarkSub')} isSelected={v.linkDefaults.watermark} onChange={(x) => set('linkDefaults', 'watermark', x)} />
              <SwitchRow title={t('settings.raw')} hint={t('settings.rawSub')} isSelected={v.linkDefaults.rawDefault} onChange={(x) => set('linkDefaults', 'rawDefault', x)} />
            </div>
          </section>

          <section id="region" className={`${s.card} ${s.section}`} aria-labelledby="h-region">
            <div className={s.sectionHead}><h2 id="h-region">{t('settings.s.region')}</h2><p>{t('settings.regionSub')}</p></div>
            <div className={s.sectionBody}>
              <div className={s.row2}>
                <label><span className={s.fieldLabel}>{t('settings.locale')}</span>
                  <select className={s.nativeSelect} value={v.region.locale} onChange={(e) => set('region', 'locale', e.target.value as 'ar' | 'tr')}>
                    <option value="ar" lang="ar">العربية</option><option value="tr" lang="tr">Türkçe</option>
                  </select>
                </label>
                <label><span className={s.fieldLabel}>{t('settings.tz')}</span>
                  <select className={s.nativeSelect} value={v.region.timeZone} onChange={(e) => set('region', 'timeZone', e.target.value as 'Asia/Hebron')}>
                    <option value="Asia/Hebron">{t('settings.tzHebron')}</option><option value="Europe/Istanbul">{t('settings.tzIstanbul')}</option>
                  </select>
                </label>
              </div>
              <div className={s.row2}>
                <div>
                  <span className={s.fieldLabel} id="digits-label">{t('settings.digits')}</span>
                  <div className={s.segmented} role="group" aria-labelledby="digits-label" dir="ltr">
                    <button type="button" aria-pressed={v.region.digits === 'latn'} onClick={() => set('region', 'digits', 'latn')}>0123</button>
                    <button type="button" aria-pressed={v.region.digits === 'arab'} onClick={() => set('region', 'digits', 'arab')} lang="ar">٠١٢٣</button>
                  </div>
                </div>
                <div>
                  <span className={s.fieldLabel}>{t('settings.preview')}</span>
                  <p style={{ margin: 0 }} data-testid="date-preview">{preview}</p>
                  <p className={s.fieldHelp}>{t('settings.previewSub')}</p>
                </div>
              </div>
            </div>
          </section>

          <section id="storage" className={`${s.card} ${s.section}`} aria-labelledby="h-storage">
            <div className={s.sectionHead}><h2 id="h-storage">{t('settings.s.storage')}</h2><p>{t('settings.storageSub')}</p></div>
            <div className={s.sectionBody}>
              <div className={s.switchRow} style={{ paddingBlock: 0 }}>
                <span className={s.titleRow}>
                  <strong>{t('settings.bucket')}</strong>
                  <span className={`${s.pill} ${storage.state === 'connected' ? s.pill_active : storage.state === 'error' ? s.pill_pending : s.pill_suspended}`} data-testid="storage-state">
                    <span className={s.dot} aria-hidden />{storage.state === 'connected' ? t('settings.connected') : storage.state === 'error' ? t('settings.notConnected') : t('settings.notConfigured')}
                  </span>
                </span>
                <span className={s.mono} dir="ltr">{storage.bucket || '—'} · {storage.region}</span>
              </div>
              <div className={s.usageBar} aria-hidden><span style={{ inlineSize: `${storage.pctOriginals}%` }} /><span style={{ inlineSize: `${storage.pctRenditions}%` }} /></div>
              <div className={s.legend}>
                <span><i style={{ background: 'var(--color-bg-accent)' }} />{storage.originals} {t('settings.originals')}</span>
                <span><i style={{ background: 'var(--color-icon-secondary)' }} />{storage.renditions} {t('settings.renditions')}</span>
                <span>{t('settings.available', { free: storage.free, quota: storage.quota })}</span>
              </div>
              <div style={{ maxInlineSize: 200 }}>
                <TextField label={`${t('settings.quota')} (TB)`} type="number" value={String(Math.round((v.storage.quotaBytes / TB) * 10) / 10)}
                  onChange={(x) => set('storage', 'quotaBytes', Math.max(0, Math.round((Number(x) || 0) * TB)))} />
              </div>
              <p className={s.lockNote} style={{ borderRadius: 8 }}><Lock size={16} aria-hidden style={{ flex: 'none', marginBlockStart: 2 }} />{t('settings.storageLock')}</p>
            </div>
          </section>

          <section id="notifications" className={`${s.card} ${s.section}`} aria-labelledby="h-notif">
            <div className={s.sectionHead}><h2 id="h-notif">{t('settings.s.notifications')}</h2><p>{t('settings.notificationsSub')}</p></div>
            <div className={s.sectionBody} style={{ gap: 0 }}>
              <SwitchRow title={t('settings.onReview')} isSelected={v.notifications.onReview} onChange={(x) => set('notifications', 'onReview', x)} />
              <SwitchRow title={t('settings.onFirstDownload')} isSelected={v.notifications.onFirstDownload} onChange={(x) => set('notifications', 'onFirstDownload', x)} />
              <SwitchRow title={t('settings.onRenewal')} isSelected={v.notifications.onRenewalRequest} onChange={(x) => set('notifications', 'onRenewalRequest', x)} />
              <SwitchRow title={t('settings.onComment')} isSelected={v.notifications.onComment} onChange={(x) => set('notifications', 'onComment', x)} />
            </div>
          </section>

          <section id="sso" className={`${s.card} ${s.section}`} aria-labelledby="h-sso">
            <div className={s.sectionHead}><h2 id="h-sso">{t('settings.s.sso')}</h2><p>{t('settings.ssoSub')}</p></div>
            <div className={s.sectionBody}>
              <span className={`${s.pill} ${ssoEnabled ? s.pill_active : s.pill_suspended}`} style={{ alignSelf: 'flex-start' }}><span className={s.dot} aria-hidden />{ssoEnabled ? t('settings.connected') : t('settings.ssoOff')}</span>
              <p className={`${s.small} ${s.muted}`} style={{ margin: 0 }}>{t('settings.ssoBody')}</p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
