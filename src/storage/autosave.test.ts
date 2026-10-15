import { describe, it, expect, beforeEach } from 'vitest';
import type { Project } from '../model/types';
import { autosave, createRecoverySnapshot, listRecoverySnapshots } from './projectStorage';

// A localStorage stand-in with a size limit, so "storage is full" can be tested.
function installQuotaStorage(limitChars: number) {
  const data = new Map<string, string>();
  const used = () => [...data].reduce((n, [k, v]) => n + k.length + v.length, 0);
  const storage = {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => {
      const next = used() - (data.has(k) ? k.length + data.get(k)!.length : 0) + k.length + v.length;
      if (next > limitChars) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      data.set(k, String(v));
    },
    removeItem: (k: string) => { data.delete(k); },
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() { return data.size; },
  };
  (globalThis as any).localStorage = storage;
  return { data, used };
}

const KEY = 'rpg-book-builder.autosave.v1';
const book = (artChars: number, title = 'Book') =>
  ({ id: 'p1', title, updatedAt: '', pages: [{ id: 'pg', art: 'x'.repeat(artChars) }] } as unknown as Project);

describe('autosave with limited browser storage', () => {
  beforeEach(() => { delete (globalThis as any).localStorage; });

  it('saves a normal book and reports success', () => {
    const s = installQuotaStorage(1_000_000);
    expect(autosave(book(1_000))).toBe(true);
    expect(JSON.parse(s.data.get(KEY)!).title).toBe('Book');
  });

  it('drops older copies to make room for the current book', () => {
    const s = installQuotaStorage(250_000);
    expect(autosave(book(60_000, 'v1'))).toBe(true);
    expect(createRecoverySnapshot(book(60_000, 'v1'))).toBe(true);
    // A bigger version no longer fits next to the backup and snapshot copies.
    expect(autosave(book(140_000, 'v2'))).toBe(true);
    expect(JSON.parse(s.data.get(KEY)!).title).toBe('v2');
    expect(listRecoverySnapshots()).toEqual([]);
  });

  it('reports failure when the book cannot be stored at all', () => {
    installQuotaStorage(50_000);
    expect(autosave(book(100_000))).toBe(false);
  });

  it('a failed recovery snapshot does not throw', () => {
    installQuotaStorage(50_000);
    expect(createRecoverySnapshot(book(100_000))).toBe(false);
  });
});
