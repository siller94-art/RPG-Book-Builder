import{describe,expect,it}from'vitest';import{createImageBlock,createProject,createStatblock,normalizeProject}from'./project';
describe('project model',()=>{it('creates a valid project',()=>{const p=createProject();expect(p.schemaVersion).toBe(1);expect(p.pages).toHaveLength(1);expect(p.settings.orientation).toBe('portrait')});it('creates structured monster sections',()=>{const b=createStatblock('monster');expect(b.sections?.actions).toHaveLength(1);expect(b.fields.str).toBe('10')});it('normalizes legacy image crop defaults',()=>{const p=createProject();p.pages[0].blocks=[{id:'i',kind:'image',title:'Art',src:'data:image/png;base64,AA==',alt:'Art',fit:'cover',opacity:1,width:100,position:'center',layer:'inline'}];const n=normalizeProject(p);const b=n.pages[0].blocks[0];expect(b.kind==='image'&&b.focalX).toBe(50);expect(b.kind==='image'&&b.focalY).toBe(50)});it('migrates legacy monster action text',()=>{const p=createProject();const b=createStatblock('monster');delete b.sections;b.fields.actions='Claw attack';p.pages[0].blocks=[b];const n=normalizeProject(p);const m=n.pages[0].blocks[0];expect(m.kind==='statblock'&&m.sections?.actions[0].text).toBe('Claw attack')})});

import{parseBrewSource,renderBrewMarkdown,safeBrewCss,sourceToPlainText}from'../source/brewSource';import{applyIssue,applySafeIssues,inspectSource}from'../source/writingHelper';import{consistencyIssues,encyclopedia,factionSource,findLoreLinks,npcSource,playerSafeSource,timelineFromSource}from'../source/loreStudio';import{applyPhotoPreset,photoAdvice}from'../source/photoHelper';
describe('brew source compatibility',()=>{
 it('splits Homebrewery page directives without losing source',()=>{const p=parseBrewSource('# One\nBody\n\\page\n# Two\nMore');expect(p.pages).toHaveLength(2);expect(p.pages[1].source).toContain('# Two')});
 it('splits column directives',()=>{const p=parseBrewSource('Left\n\\column\nRight');expect(p.pages[0].columns).toEqual(['Left','Right'])});
 it('supports pagebreak and columnbreak aliases with Windows line endings',()=>{const p=parseBrewSource('# One\r\n\\columnbreak\r\nRight\r\n\\pagebreak\r\n# Two');expect(p.pages).toHaveLength(2);expect(p.pages[0].columns).toEqual(['# One','Right']);expect(p.pages[1].columns).toEqual(['# Two'])});
 it('preserves an intentionally empty first column',()=>{const p=parseBrewSource('\\column\nRight side');expect(p.pages[0].columns).toEqual(['','Right side'])});
 it('keeps page and column boundaries independent across multiple pages',()=>{const p=parseBrewSource('A\n\\column\nB\n\\page\nC\n\\column\nD');expect(p.pages.map(x=>x.columns)).toEqual([['A','B'],['C','D']])});
 it('produces readable fallback text',()=>{expect(sourceToPlainText('## Heading\n**Bold** text')).toContain('Heading\nBold text')});
});

describe('brew markdown renderer',()=>{
 it('renders headings emphasis lists and links',()=>{const h=renderBrewMarkdown('# Title\n\n**Bold**\n\n- One\n- Two\n\n[OpenAI](https://openai.com)');expect(h).toContain('<h1>Title</h1>');expect(h).toContain('<strong>Bold</strong>');expect(h).toContain('<li>One</li>');expect(h).toContain('href="https://openai.com"')});
 it('escapes raw html',()=>{expect(renderBrewMarkdown('<script>alert(1)</script>')).not.toContain('<script>')});
 it('renders a simple brew table',()=>{const h=renderBrewMarkdown('Name | Value\n--- | ---\nAC | 15');expect(h).toContain('<table>');expect(h).toContain('<td>15</td>')});
});

describe('advanced brew compatibility',()=>{
 it('preserves custom style source and sanitizes it',()=>{const p=parseBrewSource('<style>.brew-note{color:red;background:#fff} body{background:url(http://bad)}</style>\n# Test');expect(p.customCss).toContain('.brew-note');const safe=safeBrewCss(p.customCss);expect(safe).toContain('color:red');expect(safe).not.toContain('url(')});
 it('renders positioned image hints',()=>{const h=renderBrewMarkdown('![Map](https://example.com/map.png "Map") {width=60 position=right}');expect(h).toContain('brew-image right');expect(h).toContain('width:60%')});
 it('recognizes statblock and wide snippets',()=>{expect(renderBrewMarkdown('{{statblock, Goblin}}')).toContain('statblock');expect(renderBrewMarkdown('{{wide, Across the page}}')).toContain('wide')});
});

describe('brew round trip compatibility',()=>{
 it('renders multiline statblock containers',()=>{const h=renderBrewMarkdown('{{statblock\n## Goblin\n**Armor Class** 15\n}}');expect(h).toContain('brew-snippet statblock');expect(h).toContain('<h2>Goblin</h2>');expect(h).toContain('<strong>Armor Class</strong>')});
 it('preserves page source exactly through parsing',()=>{const src='# One\nText\n\\page\n# Two\n{{note\nKeep me\n}}';const p=parseBrewSource(src);expect(p.pages.map(x=>x.source).join('\n\\page\n')).toBe(src)});
});

describe('brew project persistence',()=>{
 it('normalizes projects that contain preserved brew source',()=>{const p=createProject();p.brewSource='# Saved Brew\n\\page\n## Two';const n=normalizeProject(JSON.parse(JSON.stringify(p)));expect(n.brewSource).toBe(p.brewSource)});
 it('keeps legacy projects valid without brew source',()=>{const p=createProject();delete p.brewSource;expect(normalizeProject(JSON.parse(JSON.stringify(p))).brewSource).toBeUndefined()});
});

describe('writing helper',()=>{
 it('finds repeated words and applies a chosen fix',()=>{const issues=inspectSource('The sea sea was calm.');expect(issues.some(x=>x.message==='Repeated word')).toBe(true);const issue=issues.find(x=>x.message==='Repeated word')!;expect(applyIssue('The sea sea was calm.',issue)).toBe('The sea was calm.')});
 it('detects unbalanced brew containers without auto-changing them',()=>{const issues=inspectSource('{{note\nMissing close');expect(issues.some(x=>x.id==='unbalanced-containers'&&!x.safe)).toBe(true)});
 it('fixes only safe suggestions in bulk',()=>{const source='The the guard has Armour Class 15.';expect(applySafeIssues(source,inspectSource(source))).toBe('The guard has Armor Class 15.')});
});

describe('writing helper lore validation',()=>{
 it('reports settlement sections that need attention',()=>{const s='# Harbor\n*Town*\n\n## Overview\nA port town.';const i=inspectSource(s);expect(i.some(x=>x.type==='settlement'&&x.message.includes('Landmark'))).toBe(true);expect(i.some(x=>x.type==='settlement'&&x.message.includes('Important People'))).toBe(true)});
 it('reports incomplete creature statblocks',()=>{const s='{{statblock\n## Guard\n**Armor Class** 15\n**Speed** 30 ft.\n}}';expect(inspectSource(s).some(x=>x.type==='5e'&&x.message.includes('Hit Points'))).toBe(true)});
 it('provides source positions for clickable highlighting',()=>{const s='The sea sea moves.';const i=inspectSource(s).find(x=>x.message==='Repeated word')!;expect(s.slice(i.start,i.end)).toBe(i.before)});
});

describe('stress and resilience',()=>{
 it('parses a 250-page two-column brew without losing boundaries',()=>{const source=Array.from({length:250},(_,i)=>`# Page ${i+1}\nLeft ${i}\n\\column\nRight ${i}`).join('\n\\page\n');const p=parseBrewSource(source);expect(p.pages).toHaveLength(250);expect(p.pages.every(x=>x.columns.length===2)).toBe(true);expect(p.pages[249].columns[1]).toContain('Right 249')});
 it('finds and safely fixes 1000 repeated-word mistakes',()=>{const source=Array.from({length:1000},(_,i)=>`The sea sea moves ${i}.`).join('\n');const issues=inspectSource(source);expect(issues.filter(x=>x.message==='Repeated word')).toHaveLength(1000);const fixed=applySafeIssues(source,issues);expect(fixed.match(/sea sea/g)).toBeNull();expect(fixed).toContain('The sea moves 999.')});
 it('survives heavily malformed brew input',()=>{const source=('{{note\n#Bad\n\\column text\n{{statblock\n').repeat(500);expect(()=>inspectSource(source)).not.toThrow();expect(()=>parseBrewSource(source)).not.toThrow();expect(inspectSource(source).some(x=>x.id==='unbalanced-containers')).toBe(true)});
 it('keeps safe-fix positions correct when many issues exist',()=>{const source='The the guard. Sea sea wall. A a road.';const fixed=applySafeIssues(source,inspectSource(source));expect(fixed).toBe('The guard. Sea wall. A road.')});
 it('handles a large realistic lore document',()=>{const chapter=`# Coral\n**Population:** 65,000\n## Overview\nA capital city beside the sea.\n## Landmark\nImperial Palace\n## Important People\nThe court.\n\\column\n## History\nAncient history.\n`;const source=Array.from({length:120},()=>chapter).join('\\page\n');expect(()=>{inspectSource(source);parseBrewSource(source);sourceToPlainText(source)}).not.toThrow()});
});

describe('lore studio',()=>{
 it('creates NPC and faction lore with visibility',()=>{expect(npcSource('Mira','Captain','','Secret','GM Only')).toContain('GM Only');expect(factionSource('Wardens','Faction','Guard the coast','Player')).toContain('# Wardens')});
 it('finds @ lore links and unresolved references',()=>{const s='# Coral\nSee @Port Stell and @Coral.';expect(findLoreLinks(s)).toEqual(['Port Stell','Coral']);expect(consistencyIssues(s)).toContain('Unresolved lore link: @Port Stell')});
 it('builds a searchable encyclopedia index',()=>{expect(encyclopedia('# Coral\n*Capital*\nText\n# Stellaris\n*Empire*')).toHaveLength(2)});
 it('sorts timeline events',()=>{const s='# B\n**Year / Age:** 900\nEvent B\n# A\n**Year / Age:** 100\nEvent A';const t=timelineFromSource(s);expect(t.map(x=>x.year)).toEqual([100,900])});
 it('removes GM-only entries from player source',()=>{const s='# Public\n*NPC · Player*\nKnown\n# Hidden\n*NPC · GM Only*\nSecret';const p=playerSafeSource(s);expect(p).toContain('Public');expect(p).not.toContain('Hidden')});
 it('handles a 1000-entry encyclopedia and relationship graph source',()=>{const s=Array.from({length:1000},(_,i)=>`# Place ${i}\n*Settlement · Player*\nSee @Place ${(i+1)%1000}.\n`).join('');expect(encyclopedia(s)).toHaveLength(1000);expect(findLoreLinks(s)).toHaveLength(1000);expect(consistencyIssues(s)).toHaveLength(0)});
});

describe('photo helper',()=>{
 it('applies book layout presets without replacing artwork',()=>{const img=createImageBlock('data:image/png;base64,abc','Hero');const src=img.src,patch=applyPhotoPreset(img,'portrait');expect(patch.width).toBe(42);expect(patch.fit).toBe('cover');expect(img.src).toBe(src)});
 it('warns when a tiny embedded image is stretched wide',()=>{const img=createImageBlock('x','Tiny');img.width=100;img.storedBytes=40*1024;expect(photoAdvice(img).some(x=>x.level==='warning'&&x.message.includes('blurry'))).toBe(true)});
 it('warns about heavy background opacity',()=>{const img=createImageBlock('x','Background');img.layer='background';img.opacity=.8;expect(photoAdvice(img).some(x=>x.message.includes('difficult to read'))).toBe(true)});
 it('handles thousands of image checks without mutating blocks',()=>{const images=Array.from({length:2000},(_,i)=>{const x=createImageBlock('x','Art '+i);x.storedBytes=(i%30)*100000;x.width=20+(i%81);return x});expect(()=>images.forEach(photoAdvice)).not.toThrow();expect(images[0].title).toBe('Art 0')});
});
