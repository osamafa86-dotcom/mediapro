import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is not set'); process.exit(1); }
const client = postgres(url, { max: 1, onnotice: () => {} });
await client`create extension if not exists pgcrypto`;
await migrate(drizzle(client), { migrationsFolder: new URL('../drizzle', import.meta.url).pathname });
console.log('migrations applied');
await client.end();
