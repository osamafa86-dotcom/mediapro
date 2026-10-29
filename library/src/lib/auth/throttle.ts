import { sql } from 'drizzle-orm';
import { getDb } from '@/db';

export const MAX_FAILURES = 5;
export const LOCK_MINUTES = 10;

/** Returns the lock end if the key is locked now, else null. */
export async function lockedUntil(key: string): Promise<Date | null> {
  const rows = await getDb().execute<{ locked_until: Date | null }>(
    sql`select locked_until from login_throttle where key = ${key} and locked_until > now()`);
  const v = rows[0]?.locked_until;
  return v ? new Date(v) : null;
}

/** Atomic increment; the 5th failure locks the key for 10 minutes and resets the counter. */
export async function recordFailure(key: string): Promise<Date | null> {
  const rows = await getDb().execute<{ locked_until: Date | null }>(sql`
    insert into login_throttle (key, failures, updated_at) values (${key}, 1, now())
    on conflict (key) do update set
      failures = case when login_throttle.failures + 1 >= ${MAX_FAILURES} then 0 else login_throttle.failures + 1 end,
      locked_until = case when login_throttle.failures + 1 >= ${MAX_FAILURES}
                          then now() + make_interval(mins => ${LOCK_MINUTES}) else login_throttle.locked_until end,
      updated_at = now()
    returning locked_until`);
  const v = rows[0]?.locked_until;
  return v && new Date(v) > new Date() ? new Date(v) : null;
}

export async function clearFailures(key: string) {
  await getDb().execute(sql`delete from login_throttle where key = ${key}`);
}
