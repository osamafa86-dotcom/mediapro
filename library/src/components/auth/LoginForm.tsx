'use client';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, TextField } from '@/components/ui';
import { mmss, postJson } from '@/lib/client/api';
import s from './auth.module.css';

export function LoginForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  async function login() {
    setBusy(true); setMsg(null);
    const r = await postJson<{ next?: string; until?: string }>('/api/auth/login', { email, password }, null);
    setBusy(false);
    if (r.ok) { router.replace(r.data.next ?? '/admin'); router.refresh(); return; }
    setPassword('');
    if (r.status === 423 && r.data.until) setMsg({ kind: 'error', text: t('locked', { time: mmss(new Date(r.data.until)) }) });
    else if (r.status === 401) setMsg({ kind: 'error', text: t('badCredentials') });
    else setMsg({ kind: 'error', text: t('error') });
  }

  async function magic() {
    if (!email) return;
    setBusy(true); setMsg(null);
    const r = await postJson('/api/auth/magic', { email }, null);
    setBusy(false);
    setMsg(r.ok ? { kind: 'success', text: t('magicSent') } : { kind: 'error', text: t('error') });
  }

  return (
    <form className={s.form} onSubmit={(e) => { e.preventDefault(); void login(); }}>
      <TextField label={t('email')} type="email" name="email" autoComplete="username" value={email} onChange={setEmail} isRequired />
      <TextField label={t('password')} type="password" name="password" autoComplete="current-password" value={password} onChange={setPassword} isRequired />
      {msg && <p className={msg.kind === 'error' ? s.error : s.success} role={msg.kind === 'error' ? 'alert' : 'status'}>{msg.text}</p>}
      <Button type="submit" variant="primary" size="lg" className={s.full} isDisabled={busy}>{t('submit')}</Button>
      <button type="button" className={s.link} onClick={() => void magic()} disabled={busy}>{t('orMagic')}</button>
    </form>
  );
}
