import{describe,expect,it}from'vitest';import{createProject,createStatblock,normalizeProject}from'./project';
describe('project model',()=>{it('creates a valid project',()=>{const p=createProject();expect(p.schemaVersion).toBe(1);expect(p.pages).toHaveLength(1);expect(p.settings.orientation).toBe('portrait')});it('creates structured monster sections',()=>{const b=createStatblock('monster');expect(b.sections?.actions).toHaveLength(1);expect(b.fields.str).toBe('10')});it('normalizes legacy image crop defaults',()=>{const p=createProject();p.pages[0].blocks=[{id:'i',kind:'image',title:'Art',src:'data:image/png;base64,AA==',alt:'Art',fit:'cover',opacity:1,width:100,position:'center',layer:'inline'}];const n=normalizeProject(p);const b=n.pages[0].blocks[0];expect(b.kind==='image'&&b.focalX).toBe(50);expect(b.kind==='image'&&b.focalY).toBe(50)});it('migrates legacy monster action text',()=>{const p=createProject();const b=createStatblock('monster');delete b.sections;b.fields.actions='Claw attack';p.pages[0].blocks=[b];const n=normalizeProject(p);const m=n.pages[0].blocks[0];expect(m.kind==='statblock'&&m.sections?.actions[0].text).toBe('Claw attack')})});

import{parseBrewSource,renderBrewMarkdown,safeBrewCss,sourceToPlainText}from'../source/brewSource';
describe('brew source compatibility',()=>{
 it('splits Homebrewery page directives without losing source',()=>{const p=parseBrewSource('# One\nBody\n\\page\n# Two\nMore');expect(p.pages).toHaveLength(2);expect(p.pages[1].source).toContain('# Two')});
 it('splits column directives',()=>{const p=parseBrewSource('Left\n\\column\nRight');expect(p.pages[0].columns).toEqual(['Left','Right'])});
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
