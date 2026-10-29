import { normalizeSearch } from './format';

/*
 * What the admin is offered for each Drive folder before anything moves (DESIGN §6.6): the client
 * (by the words of its names in the folder name), the date (the usual ways people write one), and a
 * project title (the folder name without the date). The admin can change all three.
 */

export interface ClientName { id: string; name_ar: string; name_tr: string | null }
export interface Suggestion { clientId: string | null; date: string | null; title: string }

const pad = (n: number) => String(n).padStart(2, '0');
function valid(y: number, m: number, d: number) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return y >= 1990 && y <= 2100 && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
}

/** 2025-03-14 · 2025.03.14 · 20250314 · 14-03-2025 · 14.03.2025 · 14/03/2025 → ISO date, and the text without it. */
export function findDate(name: string): { date: string | null; rest: string } {
  const pats: [RegExp, (m: RegExpExecArray) => string | null][] = [
    [/(?<!\d)(\d{4})[-_.](\d{1,2})[-_.](\d{1,2})(?!\d)/, (m) => valid(+m[1]!, +m[2]!, +m[3]!)],
    [/(?<!\d)(\d{1,2})[-_./](\d{1,2})[-_./](\d{4})(?!\d)/, (m) => valid(+m[3]!, +m[2]!, +m[1]!)],
    [/(?<!\d)(\d{4})(\d{2})(\d{2})(?!\d)/, (m) => valid(+m[1]!, +m[2]!, +m[3]!)],
  ];
  for (const [re, f] of pats) {
    const m = re.exec(name);
    const date = m ? f(m) : null;
    if (m && date) return { date, rest: (name.slice(0, m.index) + name.slice(m.index + m[0].length)) };
  }
  return { date: null, rest: name };
}

const words = (s: string) => normalizeSearch(s).split(' ').filter((w) => w.length >= 3);

export function suggest(folderName: string, clients: ClientName[]): Suggestion {
  const { date, rest } = findDate(folderName);
  const have = new Set(words(rest));
  let best: { id: string; score: number } | null = null;
  for (const c of clients) {
    for (const name of [c.name_ar, c.name_tr ?? '']) {
      const ws = words(name);
      if (!ws.length) continue;
      const hit = ws.filter((w) => have.has(w)).length;
      // at least two of the name's words, or all of a one-word name
      if (hit >= Math.min(2, ws.length) && (!best || hit > best.score)) best = { id: c.id, score: hit };
    }
  }
  const title = rest.replace(/[\s_\-–—.·|]+/g, ' ').trim() || folderName.trim();
  return { clientId: best?.id ?? null, date, title };
}

/** Which group a file goes to, from the sub-folders it sits in («RAW», «خام», «رشزات», «footage», «Ham çekim»). */
export function groupFromPath(path: string[]): 'raw' | 'footage' | null {
  const p = normalizeSearch(path.join(' '));
  if (/\b(raw|ham)\b|خام/.test(p) && !/ham çekim|ham cekim/.test(p)) return 'raw';
  if (/footage|b-?roll|رشز|ham çekim|ham cekim/.test(p)) return 'footage';
  return null;
}
