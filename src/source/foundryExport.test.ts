import { describe, it, expect } from 'vitest';
import { createFoundryPackage, foundryFilename } from './foundryExport';

describe('Foundry export', () => {
  it('creates a versioned package from lore source', () => {
    const p = createFoundryPackage(
      'Test',
      '# Ashford\n*Settlement · GM Only*\nA river town near @Old Keep.',
    );
    expect(p.format).toBe('rpg-book-builder-foundry');
    expect(p.version).toBe(1);
    expect(p.title).toBe('Test');
    expect(p.entries).toHaveLength(1);
    expect(p.entries[0]).toMatchObject({
      name: 'Ashford',
      kind: 'Settlement',
      visibility: 'GM Only',
      links: ['Old Keep'],
    });
  });

  it('returns an empty package for empty source', () => {
    expect(createFoundryPackage('', '').entries).toEqual([]);
  });

  it('builds a safe .rpgfoundry filename', () => {
    expect(foundryFilename('My Campaign!')).toBe('my-campaign.rpgfoundry');
    expect(foundryFilename('')).toBe('campaign.rpgfoundry');
  });
});
