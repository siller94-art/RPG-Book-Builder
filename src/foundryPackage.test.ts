import{describe,it,expect}from'vitest';
import fs from'node:fs';
import path from'node:path';

const root='foundry-module';
const manifest=JSON.parse(fs.readFileSync(path.join(root,'module.json'),'utf8'));
const shipped=['module.json','README.md','scripts/main.js','scripts/shared.js','scripts/importer.js','scripts/approval.js','scripts/srd-catalog.js','scripts/character-creator.js','styles/companion.css'];

/** Every relative import reachable from the entry point, so a missing file can't ship. */
function importGraph(entry:string,seen=new Set<string>()):Set<string>{
  if(seen.has(entry))return seen;
  seen.add(entry);
  const src=fs.readFileSync(path.join(root,entry),'utf8');
  for(const m of src.matchAll(/^\s*import\s[^'"]*["'](\.[^"']+)["']/gm)){
    const next=path.posix.normalize(path.posix.join(path.posix.dirname(entry),m[1]));
    expect(fs.existsSync(path.join(root,next)),`${entry} imports missing ${next}`).toBe(true);
    importGraph(next,seen);
  }
  return seen;
}

describe('Foundry release package',()=>{
  it('has the required module files',()=>{
    for(const file of shipped)expect(fs.existsSync(path.join(root,file)),file).toBe(true);
  });
  it('uses the Foundry v14 release manifest contract',()=>{
    expect(manifest.id).toBe('rpg-book-builder-companion');
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.compatibility.minimum).toBe('14.367');
    expect(manifest.compatibility.verified).toBe('14.369');
    expect(manifest.esmodules).toEqual(['scripts/main.js']);
    expect(manifest.styles).toContain('styles/companion.css');
    expect(manifest.manifest).toBe(`https://github.com/siller94-art/RPG-Book-Builder/releases/download/foundry-v${manifest.version}/module.json`);
    expect(manifest.download).toBe(`https://github.com/siller94-art/RPG-Book-Builder/releases/download/foundry-v${manifest.version}/rpg-book-builder-companion.zip`);
  });
  it('enables the module socket that player submissions travel over',()=>{
    expect(manifest.socket).toBe(true);
  });
  it('does not pin the module to one game system (lore import works everywhere)',()=>{
    expect(manifest.relationships?.systems??[]).toEqual([]);
  });
  it('keeps manifest entry points and their imports inside the packaged folder',()=>{
    for(const file of [...manifest.esmodules,...manifest.styles])expect(fs.existsSync(path.join(root,file)),file).toBe(true);
    const graph=importGraph('scripts/main.js');
    for(const file of graph)expect(shipped,`${file} is imported but not in the release list`).toContain(file);
  });
});
