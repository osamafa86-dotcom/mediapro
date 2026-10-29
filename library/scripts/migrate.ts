import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { runMigrations } from 'graphile-worker';
import { resolve } from 'node:path';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is not set'); process.exit(1); }
const client = postgres(url, { max: 1, onnotice: () => {} });
await client`create extension if not exists pgcrypto`;
// relative to where it runs: library/ in development, /app in the worker image (deploy/vps/Dockerfile)
await migrate(drizzle(client), { migrationsFolder: resolve(process.cwd(), 'drizzle') });
// the job queue's own schema (graphile_worker), so the app can enqueue before the worker ever started
await runMigrations({ connectionString: url });
console.log('migrations applied');
await client.end();
