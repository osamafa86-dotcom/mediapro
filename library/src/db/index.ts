import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

type Sql = ReturnType<typeof postgres>;
declare global {
  // one pool per process; survives Next dev hot reloads
  var __mediaSql: Sql | undefined;
  var __mediaDb: PostgresJsDatabase<typeof schema> | undefined;
}

export function getSql(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set — see .env.example');
  globalThis.__mediaSql ??= postgres(url, { max: Number(process.env.DB_POOL ?? 10), onnotice: () => {} });
  return globalThis.__mediaSql;
}

export function getDb(): PostgresJsDatabase<typeof schema> {
  globalThis.__mediaDb ??= drizzle({ client: getSql(), schema });
  return globalThis.__mediaDb;
}

export { schema };
