// The worker and the operations scripts as plain ESM bundles for the worker image (deploy/vps/Dockerfile):
// no tsx at runtime; dependencies stay in node_modules (native ones like sharp and argon2 must).
// The e2e runs the very same bundle, so what CI tests is what the server runs.
import { build } from 'esbuild';

const entries = {
  worker: 'src/worker/index.ts',
  migrate: 'scripts/migrate.ts',
  'create-admin': 'scripts/create-admin.ts',
  's3-setup': 'scripts/s3-setup.mjs',
};
await build({
  entryPoints: entries,
  outdir: 'dist/ops',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  packages: 'external',
  tsconfig: 'tsconfig.json',
  // 'server-only' throws outside React Server Components; nothing the worker loads may depend on it
  plugins: [{ name: 'no-server-only', setup(b) { b.onResolve({ filter: /^server-only$/ }, (a) => { throw new Error(`server-only imported by ${a.importer} — not allowed in the worker`); }); } }],
  logLevel: 'warning',
});
console.log(`ops bundles: ${Object.keys(entries).map((e) => `dist/ops/${e}.mjs`).join(', ')}`);
