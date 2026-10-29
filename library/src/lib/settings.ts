import 'server-only';
import { cache } from 'react';
import { z } from 'zod';
import { getSql } from '@/db';

/*
 * Library-wide settings live in the `settings` table as one JSON value per key. Every key has a
 * schema and a default, so a missing or older row never breaks a page: unknown fields are dropped,
 * missing ones take the default.
 */

export const PERMISSIONS = ['upload', 'createProject', 'publishWithoutReview', 'seeClientLinks', 'deleteAfterPublish'] as const;
export type Permission = (typeof PERMISSIONS)[number];
/** Never grantable to a team role, whatever is stored (DESIGN: links and PINs are admin-only). */
export const LOCKED_OFF: readonly Permission[] = ['seeClientLinks'];

const RolePerms = z.object(Object.fromEntries(PERMISSIONS.map((p) => [p, z.boolean()])) as Record<Permission, z.ZodBoolean>);

export const schemas = {
  identity: z.object({ nameAr: z.string().trim().min(1).max(120), nameTr: z.string().trim().min(1).max(120) }),
  linkDefaults: z.object({
    days: z.number().int().min(1).max(365),
    expiryReminder: z.boolean(),
    watermark: z.boolean(),
    rawDefault: z.boolean(),
  }),
  region: z.object({
    locale: z.enum(['ar', 'tr']),
    timeZone: z.enum(['Asia/Hebron', 'Europe/Istanbul']),
    digits: z.enum(['latn', 'arab']),
  }),
  rolePermissions: z.object({ photographer: RolePerms, editor: RolePerms, contributor: RolePerms }),
  notifications: z.object({ onReview: z.boolean(), onFirstDownload: z.boolean(), onRenewalRequest: z.boolean(), onComment: z.boolean() }),
  storage: z.object({ quotaBytes: z.number().int().min(0) }),
};
export type SettingKey = keyof typeof schemas;
export type Settings = { [K in SettingKey]: z.infer<(typeof schemas)[K]> };

const off = Object.fromEntries(PERMISSIONS.map((p) => [p, false])) as Record<Permission, boolean>;
export const DEFAULTS: Settings = {
  identity: { nameAr: 'مكتبة المرئيات — إمداترا', nameTr: 'EMDATRA Medya Kütüphanesi' },
  linkDefaults: { days: 30, expiryReminder: true, watermark: false, rawDefault: false },
  region: { locale: 'ar', timeZone: 'Asia/Hebron', digits: 'latn' },
  rolePermissions: {
    photographer: { ...off, upload: true, createProject: true },
    editor: { ...off, upload: true },
    contributor: { ...off, upload: true },
  },
  notifications: { onReview: true, onFirstDownload: true, onRenewalRequest: true, onComment: true },
  storage: { quotaBytes: 10 * 1024 ** 4 },
};

function merge<K extends SettingKey>(key: K, stored: unknown): Settings[K] {
  const base = DEFAULTS[key] as Record<string, unknown>;
  const candidate = stored && typeof stored === 'object' ? deepMerge(base, stored as Record<string, unknown>) : base;
  const r = schemas[key].safeParse(candidate);
  const v = (r.success ? r.data : DEFAULTS[key]) as Settings[K];
  if (key === 'rolePermissions') {
    for (const role of Object.values(v as Settings['rolePermissions'])) for (const p of LOCKED_OFF) role[p] = false;
  }
  return v;
}

function deepMerge(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (!(k in a)) continue;
    const av = a[k];
    out[k] = av && typeof av === 'object' && v && typeof v === 'object' ? deepMerge(av as Record<string, unknown>, v as Record<string, unknown>) : v;
  }
  return out;
}

/** All settings, once per request. */
export const getSettings = cache(async (): Promise<Settings> => {
  const rows = await getSql()<{ key: string; value: unknown }[]>`select key, value from settings where key = any(${Object.keys(schemas)})`;
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries((Object.keys(schemas) as SettingKey[]).map((k) => [k, merge(k, stored.get(k))])) as Settings;
});

/** Partial updates are merged into the current value, then the whole value is validated. */
export async function saveSetting<K extends SettingKey>(key: K, value: unknown): Promise<Settings[K]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new z.ZodError([]);
  const current = (await getSettings())[key] as Record<string, unknown>;
  const parsed = merge(key, schemas[key].parse(deepMerge(current, value as Record<string, unknown>)));
  await getSql()`insert into settings (key, value, updated_at) values (${key}, ${JSON.stringify(parsed)}::jsonb, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
  return parsed;
}

/** Can this staff member do X? Admin always; team roles per the stored matrix. */
export async function can(role: string, p: Permission): Promise<boolean> {
  if (role === 'admin') return true;
  const perms = (await getSettings()).rolePermissions as Record<string, Record<Permission, boolean>>;
  return perms[role]?.[p] ?? false;
}
