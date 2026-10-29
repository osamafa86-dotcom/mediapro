/*
 * First admin, from the command line only (there is no open sign-up page):
 *   pnpm create-admin --email you@emdatra.org --name "اسامة"
 * The password is read without echo from the terminal (twice), or as one line from a pipe.
 * --reset-password changes an existing local user's password and signs them out everywhere.
 */
import { createInterface } from 'node:readline';
import postgres from 'postgres';
import { hashSecret, passwordProblem } from '../src/lib/auth/password';

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function readSecret(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin });
    for await (const line of rl) { rl.close(); return line; }
    return '';
  }
  process.stdout.write(prompt);
  return new Promise((resolve) => {
    const stdin = process.stdin;
    let buf = '';
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    const onData = (ch: string) => {
      if (ch === '\r' || ch === '\n') { stdin.setRawMode(false); stdin.pause(); stdin.off('data', onData); process.stdout.write('\n'); resolve(buf); }
      else if (ch === '\u0003') process.exit(130);
      else if (ch === '\u007f') buf = buf.slice(0, -1);
      else buf += ch;
    };
    stdin.on('data', onData);
  });
}

async function main() {
  const email = arg('email')?.trim().toLowerCase();
  const name = arg('name')?.trim();
  const reset = process.argv.includes('--reset-password');
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || (!reset && !name)) {
    console.error('Usage: pnpm create-admin --email <email> --name <name>   |   --email <email> --reset-password');
    process.exit(2);
  }
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set'); process.exit(2); }
  const pw = await readSecret('Password (12+ characters): ');
  const problem = passwordProblem(pw);
  if (problem) { console.error(`Refused: ${problem === 'too_short' ? 'at least 12 characters' : 'at most 256 characters'}`); process.exit(1); }
  if (process.stdin.isTTY && (await readSecret('Repeat: ')) !== pw) { console.error('Passwords do not match'); process.exit(1); }

  const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    const hash = await hashSecret(pw);
    const [existing] = await sql<{ id: string; auth_provider: string }[]>`select id, auth_provider from users where lower(email) = ${email}`;
    if (reset) {
      if (!existing || existing.auth_provider !== 'local') { console.error('No local user with that email'); process.exit(1); }
      await sql.begin(async (tx) => {
        await tx`update users set password_hash = ${hash} where id = ${existing.id}`;
        await tx`delete from sessions where user_id = ${existing.id}`;
        await tx`insert into audit_log (actor_type, action, target_type, target_id) values ('system', 'user.password_reset_cli', 'user', ${existing.id})`;
      });
      console.log('Password changed; existing sessions signed out.');
      return;
    }
    if (existing) { console.error('A user with that email already exists (use --reset-password)'); process.exit(1); }
    const [u] = await sql<{ id: string }[]>`insert into users (name, email, role, password_hash) values (${name!}, ${email}, 'admin', ${hash}) returning id`;
    await sql`insert into audit_log (actor_type, action, target_type, target_id) values ('system', 'user.admin_created_cli', 'user', ${u!.id})`;
    console.log(`Admin created: ${email}`);
  } finally {
    await sql.end();
  }
}

void main();
