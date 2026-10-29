import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

type Sql = ReturnType<typeof postgres>;
declare global {
  // one pool per process; survives Next dev hot reloads
  var __mediaSql: Sql | undefined;
  var __mediaDb: PostgresJsDatabase<typeof schema> | undefined;
}

/**
 * Raw postgres.js queries share this client with drizzle, and drizzle replaces its serializers: pass
 * timestamps as ISO strings and JSON as `${JSON.stringify(v)}::jsonb` — never Date objects or sql.json().
 */
export function getSql(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set — see .env.example');
  if (!globalThis.__mediaSql) {
    const client = postgres(url, { max: Number(process.env.DB_POOL ?? 10), onnotice: () => {} });
    // The same overrides drizzle installs, applied up front: a process that never calls getDb() (the
    // worker) must not get different behaviour — otherwise `${JSON.stringify(v)}::jsonb` is stored as a
    // JSON *string*, and dates come back as Date objects in one process and strings in the other.
    const same = (v: unknown) => v;
    for (const t of [1184, 1082, 1083, 1114, 1182, 1185, 1115, 1231]) {
      client.options.parsers[t] = same;
      client.options.serializers[t] = same;
    }
    client.options.serializers[114] = same;
    client.options.serializers[3802] = same;
    globalThis.__mediaSql = client;
  }
  return globalThis.__mediaSql;
}

export function getDb(): PostgresJsDatabase<typeof schema> {
  globalThis.__mediaDb ??= drizzle({ client: getSql(), schema });
  return globalThis.__mediaDb;
}

export { schema };
