'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { I18nProvider } from 'react-aria-components';
import { ChevronLeft, Download, Link2, MoreHorizontal, Pencil, Play, Plus, Upload } from 'lucide-react';
import { Button, Chip, IconButton, PinInput, SearchField, SegmentTab, SelectField, StatusBadge, Switch, TextField } from '@/components/ui';
import { intlLocale, type Locale } from '@/i18n/config';
import s from './page.module.css';

export function Gallery({ locale, theme }: { locale: Locale; theme: 'light' | 'dark' }) {
  const t = useTranslations();
  const [tab, setTab] = useState('photos');
  const [pin, setPin] = useState('');
  const [pinBad, setPinBad] = useState('48');
  const [raw, setRaw] = useState(true);
  const [type, setType] = useState('distribution');
  const [chips, setChips] = useState(true);
  return (
    <I18nProvider locale={intlLocale(locale)}>
      <h2 className={`t-heading ${s.h}`}>{t('dev.title')} · {locale.toUpperCase()} · {theme === 'dark' ? t('common.dark') : t('common.light')}</h2>

      <div className={s.block}>
        <h3 className={`t-label ${s.h}`}>{t('dev.buttons')}</h3>
        <div className={s.row}>
          <Button variant="primary" icon={<Link2 size={16} strokeWidth={1.5} />}>{t('dev.primary')}</Button>
          <Button variant="secondary" icon={<Pencil size={16} strokeWidth={1.5} />}>{t('dev.secondary')}</Button>
          <Button variant="ghost">{t('dev.ghost')}</Button>
          <Button variant="primary" isDisabled>{t('common.save')}</Button>
        </div>
      </div>

      <div className={s.block}>
        <h3 className={`t-label ${s.h}`}>{t('dev.iconButtons')}</h3>
        <div className={s.row}>
          <IconButton aria-label={t('common.back')}><ChevronLeft size={18} strokeWidth={1.5} className="icon-mirror" /></IconButton>
          <IconButton aria-label={t('common.more')} variant="surface"><MoreHorizontal size={18} strokeWidth={1.5} /></IconButton>
          <IconButton aria-label={t('common.upload')} size={44}><Upload size={20} strokeWidth={1.5} /></IconButton>
          <div className={s.media} role="img" aria-label="sample media">
            <div className={s.mediaTools}>
              <IconButton aria-label={t('common.download')} variant="onMedia"><Download size={16} strokeWidth={1.5} /></IconButton>
              <IconButton aria-label="play" variant="onMedia"><Play size={16} strokeWidth={1.5} /></IconButton>
            </div>
          </div>
        </div>
      </div>

      <div className={s.block}>
        <h3 className={`t-label ${s.h}`}>{t('dev.chips')}</h3>
        <div className={s.row}>
          {chips ? <Chip label={t('dev.chipClient')} onRemove={() => setChips(false)} removeLabel={t('common.clear')} /> : null}
          <Chip label={t('dev.chipYear')} defaultSelected />
          <Chip label={<><Plus size={14} strokeWidth={1.5} aria-hidden="true" /> {t('status.published')}</>} />
        </div>
      </div>

      <div className={s.block}>
        <h3 className={`t-label ${s.h}`}>{t('dev.search')}</h3>
        <SearchField label={t('common.search')} placeholder={t('common.searchPlaceholder')} clearLabel={t('common.clear')} />
      </div>

      <div className={s.block}>
        <h3 className={`t-label ${s.h}`}>{t('dev.tabs')}</h3>
        <SegmentTab label={t('dev.tabs')} selected={tab} onChange={setTab}
          items={[{ id: 'photos', label: t('sections.photos'), count: 248 }, { id: 'videos', label: t('sections.videos'), count: 12 }]} />
      </div>

      <div className={s.block}>
        <h3 className={`t-label ${s.h}`}>{t('dev.badges')}</h3>
        <div className={s.row}>
          {(['draft', 'uploading', 'review', 'published', 'expired'] as const).map((st) => <StatusBadge key={st} status={st} label={t(`status.${st}`)} />)}
          <span className="t-caption">{t('dev.size')}: <span className="size">{t('dev.sizeSample')}</span></span>
        </div>
      </div>

      <div className={s.block}>
        <h3 className={`t-label ${s.h}`}>{t('dev.fields')}</h3>
        <div className={s.row}>
          <TextField label={t('dev.nameLabel')} description={t('dev.nameHelp')} defaultValue="توزيع سلال رمضان" />
          <TextField label={t('dev.nameLabel')} errorMessage={t('dev.nameError')} defaultValue="تو" />
          <SelectField label={t('dev.typeLabel')} value={type} onValueChange={setType}
            items={[{ id: 'distribution', label: t('dev.typeDistribution') }, { id: 'construction', label: t('dev.typeConstruction') }, { id: 'event', label: t('dev.typeEvent') }]} />
        </div>
      </div>

      <div className={s.block}>
        <h3 className={`t-label ${s.h}`}>{t('dev.switches')}</h3>
        <div style={{ maxInlineSize: 360 }}><Switch isSelected={raw} onChange={setRaw}>{t('dev.switchRaw')}</Switch></div>
      </div>

      <div className={s.block}>
        <h3 className={`t-label ${s.h}`}>{t('dev.pinCells')}</h3>
        <div className={s.row}>
          <PinInput value={pin} onChange={setPin} label={t('pin.label')} digitLabel={(n) => t('pin.digit', { n })} />
          <PinInput value={pinBad} onChange={setPinBad} label={t('pin.label')} digitLabel={(n) => t('pin.digit', { n })} invalid />
        </div>
        <p className="t-caption">{t('pin.help')}</p>
      </div>
    </I18nProvider>
  );
}
