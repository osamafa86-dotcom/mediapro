import { run } from 'graphile-worker';
import { createServer } from 'node:http';
import { taskList } from './tasks';

/*
 * The processing worker (its own container, with ffmpeg, libvips, exiftool and LibRaw). Jobs live in
 * Postgres (Graphile Worker): the app enqueues `process_asset` in the same transaction that creates
 * the asset, so a crash can never lose one.
 */
const runner = await run({
  connectionString: process.env.DATABASE_URL,
  concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2),
  pollInterval: 2000,
  taskList,
});
console.log(`[worker] running with concurrency ${process.env.WORKER_CONCURRENCY ?? 2}`);

// Optional liveness endpoint for the container healthcheck (and the e2e runner): 200 while the runner is up.
if (process.env.WORKER_HEALTH_PORT) {
  createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok'); })
    .listen(Number(process.env.WORKER_HEALTH_PORT), '127.0.0.1');
}

await runner.promise;
process.exit(0);
