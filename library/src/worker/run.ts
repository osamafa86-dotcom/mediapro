import { spawn } from 'node:child_process';

/** Run a tool with arguments (never a shell string), with a timeout; resolves stdout as a Buffer. */
export function run(cmd: string, args: string[], opts: { timeoutMs?: number; input?: Buffer } = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    let err = '';
    const timer = setTimeout(() => { p.kill('SIGKILL'); reject(new Error(`${cmd} timed out`)); }, opts.timeoutMs ?? 30 * 60_000);
    p.stdout.on('data', (d: Buffer) => out.push(d));
    p.stderr.on('data', (d: Buffer) => { err = (err + d.toString()).slice(-4000); });
    p.on('error', (e) => { clearTimeout(timer); reject(e); });
    p.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`${cmd} exited ${code}: ${err.split('\n').filter(Boolean).slice(-3).join(' | ')}`));
    });
    if (opts.input) p.stdin.end(opts.input); else p.stdin.end();
  });
}
