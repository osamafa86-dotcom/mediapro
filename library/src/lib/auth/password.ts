import { hash, verify } from '@node-rs/argon2';

// Argon2id, OWASP 2024 baseline (m=19 MiB, t=2, p=1). Same parameters hash PINs.
const OPTS = { algorithm: 2 /* Argon2id */, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const hashSecret = (plain: string) => hash(plain, OPTS);

export async function verifySecret(hashed: string | null | undefined, plain: string): Promise<boolean> {
  if (!hashed) return false;
  try { return await verify(hashed, plain); } catch { return false; }
}

/** Minimum for staff passwords: length beats composition rules (NIST 800-63B). */
export function passwordProblem(p: string): string | null {
  if (p.length < 12) return 'too_short';
  if (p.length > 256) return 'too_long';
  return null;
}
