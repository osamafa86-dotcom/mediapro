'use client';
import { Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button, PinInput } from '@/components/ui';
import { mmss, postJson } from '@/lib/client/api';
import s from './auth.module.css';

/**
 * PIN gate (Figma 14:2) and its locked state (68:1412). The lock is decided by the server; the
 * countdown here is only a display — when it ends the page asks the server again.
 */
export function PinGate({ token, lockedUntil }: { token: string; lockedUntil: string | null }) {
  const t = useTranslations();
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [until, setUntil] = useState<Date | null>(lockedUntil ? new Date(lockedUntil) : null);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!until) return;
    const id = setInterval(() => {
      if (until.getTime() <= Date.now()) { setUntil(null); setPin(''); router.refresh(); } else tick((n) => n + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [until, router]);

  async function submit(code = pin) {
    if (busy || until || code.length !== 4) return;
    setBusy(true); setMsg(null);
    const r = await postJson<{ next?: string; remaining?: number; until?: string; error?: string }>('/api/link/pin', { token, pin: code }, null);
    setBusy(false);
    if (r.ok && r.data.next) { router.replace(r.data.next); return; }
    if (r.status === 423 && r.data.until) { setUntil(new Date(r.data.until)); return; }
    if (r.status === 401) { setPin(''); setMsg(t('gate.wrongPin', { remaining: r.data.remaining ?? 0 })); return; }
    if (r.status === 410 || r.status === 404) { router.refresh(); return; }
    setMsg(t('gate.error'));
  }

  const locked = !!until;
  return (
    <form className={s.form} onSubmit={(e) => { e.preventDefault(); void submit(); }} data-testid="pin-gate" data-state={locked ? 'locked' : 'open'}>
      <PinInput
        value={pin}
        onChange={(v) => { setPin(v); setMsg(null); }}
        onComplete={(v) => void submit(v)}
        label={t('pin.label')}
        digitLabel={(n) => t('pin.digit', { n })}
        invalid={locked || !!msg}
        disabled={locked || busy}
      />
      {msg && <p className={s.error} role="alert">{msg}</p>}
      {locked ? (
        <>
          <div className={s.alert} role="alert" data-testid="pin-locked">
            <Lock size={16} aria-hidden />
            <strong>{t('gate.lockedTitle')}</strong>
            <p>{t('gate.lockedBody')}</p>
          </div>
          <Button variant="secondary" size="lg" className={s.full} isDisabled>
            {/* LRI…PDI keeps mm:ss in order inside an Arabic sentence */}
            {t('gate.retryIn', { time: `\u2066${mmss(until)}\u2069` })}
          </Button>
        </>
      ) : (
        <Button type="submit" variant="primary" size="lg" className={s.full} isDisabled={busy || pin.length !== 4}>
          {t('gate.enter')}
        </Button>
      )}
      <p className={s.note}>{t('gate.noPin')}</p>
    </form>
  );
}
