import{describe,it,expect}from'vitest';
import fs from'node:fs';
import path from'node:path';

const root='foundry-module';
const manifest=JSON.parse(fs.readFileSync(path.join(root,'module.json'),'utf8'));

describe('Foundry release package',()=>{
  it('has the required module files',()=>{
    for(const file of ['module.json','README.md','scripts/main.js','styles/companion.css']){
      expect(fs.existsSync(path.join(root,file)),file).toBe(true);
    }
  });
  it('uses the v0.2.0 release manifest contract',()=>{
    expect(manifest.id).toBe('rpg-book-builder-companion');
    expect(manifest.version).toBe('0.2.0');
    expect(manifest.compatibility.minimum).toBe('13');
    expect(manifest.esmodules).toContain('scripts/main.js');
    expect(manifest.styles).toContain('styles/companion.css');
    expect(manifest.manifest).toMatch(/releases\/latest\/download\/module\.json$/);
    expect(manifest.download).toMatch(/releases\/latest\/download\/rpg-book-builder-companion\.zip$/);
  });
  it('keeps manifest entry points inside the packaged folder',()=>{
    for(const file of [...manifest.esmodules,...manifest.styles])expect(fs.existsSync(path.join(root,file)),file).toBe(true);
  });
});
