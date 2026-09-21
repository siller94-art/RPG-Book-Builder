import{describe,expect,it}from'vitest';import{createProject,createStatblock,normalizeProject}from'./project';
describe('project model',()=>{it('creates a valid project',()=>{const p=createProject();expect(p.schemaVersion).toBe(1);expect(p.pages).toHaveLength(1);expect(p.settings.orientation).toBe('portrait')});it('creates structured monster sections',()=>{const b=createStatblock('monster');expect(b.sections?.actions).toHaveLength(1);expect(b.fields.str).toBe('10')});it('normalizes legacy image crop defaults',()=>{const p=createProject();p.pages[0].blocks=[{id:'i',kind:'image',title:'Art',src:'data:image/png;base64,AA==',alt:'Art',fit:'cover',opacity:1,width:100,position:'center',layer:'inline'}];const n=normalizeProject(p);const b=n.pages[0].blocks[0];expect(b.kind==='image'&&b.focalX).toBe(50);expect(b.kind==='image'&&b.focalY).toBe(50)});it('migrates legacy monster action text',()=>{const p=createProject();const b=createStatblock('monster');delete b.sections;b.fields.actions='Claw attack';p.pages[0].blocks=[b];const n=normalizeProject(p);const m=n.pages[0].blocks[0];expect(m.kind==='statblock'&&m.sections?.actions[0].text).toBe('Claw attack')})});

import{parseBrewSource,renderBrewMarkdown,safeBrewCss,sourceToPlainText}from'../source/brewSource';import{applyIssue,applySafeIssues,inspectSource}from'../source/writingHelper';
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
