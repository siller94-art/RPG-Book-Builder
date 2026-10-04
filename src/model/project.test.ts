import{describe,expect,it}from'vitest';import{createImageBlock,createPage,createProject,createStatblock,createTextBlock,createTitlePage,deleteActivePage,normalizeProject}from'./project';
describe('project model',()=>{it('preserves printable book and stat block colors',()=>{const p=createProject();p.settings.pageColor='#112233';p.settings.pageTextColor='#223344';p.settings.headingColor='#334455';p.settings.ruleColor='#445566';const s=createStatblock('monster');s.textColor='#010203';s.backgroundColor='#102030';s.accentColor='#405060';s.borderColor='#708090';p.pages[0].blocks=[s];const n=normalizeProject(JSON.parse(JSON.stringify(p)));expect(n.settings.pageColor).toBe('#112233');const b=n.pages[0].blocks[0] as any;expect(b.backgroundColor).toBe('#102030');expect(b.accentColor).toBe('#405060')});it('creates an editable centered title page template',()=>{const p=createTitlePage('Sample Book');expect(p.name).toBe('Title Page');expect(p.blocks).toHaveLength(3);const title=p.blocks[0] as any;expect(title.title).toBe('Sample Book');expect(title.align).toBe('center');expect(title.fontSize).toBe(36)});it('creates a valid project',()=>{const p=createProject();expect(p.schemaVersion).toBe(1);expect(p.pages).toHaveLength(1);expect(p.settings.orientation).toBe('portrait')});it('preserves text color through project normalization',()=>{const p=createProject();const b=p.pages[0].blocks[0] as any;b.color='#336699';const n=normalizeProject(JSON.parse(JSON.stringify(p)));expect((n.pages[0].blocks[0] as any).color).toBe('#336699')});it('persists creator library entries',()=>{const p=createProject();p.creatorLibrary!.push({id:'c1',kind:'items',data:{Name:'Sample Item'}});const n=normalizeProject(JSON.parse(JSON.stringify(p)));expect(n.creatorLibrary?.[0].data.Name).toBe('Sample Item')});it('keeps a valid page when deleting the final page',()=>{const p=createProject();const old=p.activePageId;deleteActivePage(p);expect(p.pages).toHaveLength(1);expect(p.activePageId).toBe(p.pages[0].id);expect(p.activePageId).not.toBe(old)});it('deletes an active page safely when other pages remain',()=>{const p=createProject();const second={...p.pages[0],id:'second',name:'Second',blocks:[]};p.pages.push(second);p.activePageId=second.id;deleteActivePage(p);expect(p.pages).toHaveLength(1);expect(p.activePageId).toBe(p.pages[0].id)});it('creates structured monster sections',()=>{const b=createStatblock('monster');expect(b.sections?.actions).toHaveLength(1);expect(b.fields.str).toBe('10')});it('normalizes legacy image crop defaults',()=>{const p=createProject();p.pages[0].blocks=[{id:'i',kind:'image',title:'Art',src:'data:image/png;base64,AA==',alt:'Art',fit:'cover',opacity:1,width:100,position:'center',layer:'inline'}];const n=normalizeProject(p);const b=n.pages[0].blocks[0];expect(b.kind==='image'&&b.focalX).toBe(50);expect(b.kind==='image'&&b.focalY).toBe(50)});it('migrates legacy monster action text',()=>{const p=createProject();const b=createStatblock('monster');delete b.sections;b.fields.actions='Claw attack';p.pages[0].blocks=[b];const n=normalizeProject(p);const m=n.pages[0].blocks[0];expect(m.kind==='statblock'&&m.sections?.actions[0].text).toBe('Claw attack')})});

import{markdownToProjectPages,markdownToTextSections,parseBrewSource,projectTextToMarkdown,renderBrewMarkdown,safeBrewCss,sourceToPlainText}from'../source/brewSource';import{applyIssue,applySafeIssues,inspectSource}from'../source/writingHelper';import{consistencyIssues,encyclopedia,factionSource,findLoreLinks,npcSource,playerSafeSource,timelineFromSource}from'../source/loreStudio';import{applyPhotoPreset,photoAdvice}from'../source/photoHelper';import{clampStamp,createStampPlacement,stampAssets}from'../source/stampAssets';
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
 it('renders uploaded PNG data images in the live preview',()=>{const h=renderBrewMarkdown('![Artwork](data:image/png;base64,iVBORw0KGgo=)');expect(h).toContain('<img src="data:image/png;base64,iVBORw0KGgo="');expect(h).toContain('alt="Artwork"')});
 it('rejects unsafe non-image data URLs',()=>{const h=renderBrewMarkdown('![Bad](data:text/html;base64,PHNjcmlwdD4=)');expect(h).not.toContain('<img src="data:text/html')});
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
 it('handles a large realistic lore document',()=>{const chapter=`# Sample City\n## Overview\nA fictional city used only for stress testing.\n## Landmark\nCentral Hall\n## Important People\nLocal officials.\n\\column\n## History\nSample history.\n`;const source=Array.from({length:120},()=>chapter).join('\\page\n');expect(()=>{inspectSource(source);parseBrewSource(source);sourceToPlainText(source)}).not.toThrow()});
});

describe('lore studio',()=>{
 it('creates NPC and faction lore with visibility',()=>{expect(npcSource('Mira','Captain','','Secret','GM Only')).toContain('GM Only');expect(factionSource('Wardens','Faction','Guard the coast','Player')).toContain('# Wardens')});
 it('finds @ lore links and unresolved references',()=>{const s='# Sample City\nSee @Harbor and @Sample City.';expect(findLoreLinks(s)).toEqual(['Harbor','Sample City']);expect(consistencyIssues(s)).toContain('Unresolved lore link: @Harbor')});
 it('builds a searchable encyclopedia index',()=>{expect(encyclopedia('# Sample City\n*Capital*\nText\n# Sample Region\n*Region*')).toHaveLength(2)});
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

describe('stamps and seals',()=>{
 it('provides simple built-in stamp assets',()=>{expect(stampAssets.some(x=>x.kind==='seal')).toBe(true);expect(stampAssets.some(x=>x.kind==='wave')).toBe(true);expect(stampAssets.some(x=>x.kind==='tear')).toBe(true)});
 it('creates safe default placement',()=>{const p=createStampPlacement('seal');expect(p.size).toBe(120);expect(p.opacity).toBe(.8);expect(p.layer).toBe('front')});
 it('clamps extreme stamp controls',()=>{const p=clampStamp({...createStampPlacement('wave'),size:9999,opacity:5,rotation:900,x:-20,y:500});expect(p).toMatchObject({size:400,opacity:1,rotation:180,x:0,y:100})});
 it('persists image stamp overlay data through normalization',()=>{const p=createProject(),img=createImageBlock('data:image/png;base64,AA==','Map');img.stamps=[{...createStampPlacement('wave'),id:'s1',glyph:'≋'}];p.pages[0].blocks=[img];const n=normalizeProject(p),b=n.pages[0].blocks[0];expect(b.kind==='image'&&b.stamps?.[0].assetId).toBe('wave')});
 it('stress checks 5000 stamp placements',()=>{expect(()=>Array.from({length:5000},(_,i)=>clampStamp({...createStampPlacement('seal'),size:i,rotation:i,x:i%140,y:i%170}))).not.toThrow()});
});

describe('empty source resilience',()=>{
 it('keeps one editable page for an empty markdown import',()=>{const pages=markdownToProjectPages('');expect(pages).toHaveLength(1);expect(pages[0].name).toBe('Page 1');expect(pages[0].sections).toEqual([])});
 it('keeps one editable page when World Creator content is cleared',()=>{const pages=markdownToProjectPages('   \n');expect(pages).toHaveLength(1);expect(pages[0].sections).toEqual([])});
});

describe('page and column layout synchronization',()=>{
 it('serializes two-column text with a column break marker',()=>{const p=createProject();const b=p.pages[0].blocks[0] as any;b.columns=2;const md=projectTextToMarkdown(p.pages as any);expect(md).toContain('\\column')});
 it('restores column layout from synchronized markdown',()=>{const pages=markdownToProjectPages('# Page 1\n\n## First\nText\n\n\\column\n\n## Second\nMore');expect(pages[0].sections.some((s:any)=>s.title==='Second'&&s.columns===2)).toBe(true)});
 it('preserves page boundaries and column metadata together',()=>{const pages=markdownToProjectPages('# One\n\nText\n\n\\page\n\n# Two\n\n## Next\nMore\n\n\\column\n\n## Last\nEnd');expect(pages).toHaveLength(2);expect(pages[1].sections.some((s:any)=>s.title==='Last'&&s.columns===2)).toBe(true)});
 it('round trips page and column breaks without moving content',()=>{const p=createProject();p.pages[0].name='One';const first=p.pages[0].blocks[0] as any;first.title='Left';first.body='Left text';const second={...first,id:'right',title:'Right',body:'Right text',columns:2};p.pages[0].blocks=[first,second];const md=projectTextToMarkdown(p.pages as any);const back=markdownToProjectPages(md);expect(back[0].sections.map((s:any)=>[s.title,s.body,s.columns])).toEqual([['Left','Left text',1],['Right','Right text',2]])});
});

describe('World Creator page creation synchronization',()=>{
 it('serializes a newly added world page so the source and tree stay aligned',()=>{const p=createProject();const q=createPage('New World Page');q.blocks.push({...createTextBlock(),title:'New World Page',body:'Start writing…'});p.pages.push(q);p.activePageId=q.id;const md=projectTextToMarkdown(p.pages as any);const back=markdownToProjectPages(md);expect(back).toHaveLength(2);expect(back[1].name).toBe('New World Page');expect(back[1].sections.some(x=>x.body.includes('Start writing'))).toBe(true)});
 it('serializes an inserted title page first and preserves the following pages',()=>{const p=createProject();p.title='Sample Book';const title=createTitlePage(p.title);p.pages.unshift(title);p.activePageId=title.id;const md=projectTextToMarkdown(p.pages as any);const back=markdownToProjectPages(md);expect(back).toHaveLength(2);expect(back[0].name).toBe('Title Page');expect(back[1].name).toBe('Page 1')});
});

describe('book and World Creator synchronization',()=>{
 it('converts editable book pages to markdown without losing page boundaries',()=>{const p=createProject();p.pages[0].name='Opening';p.pages[0].blocks=[{...p.pages[0].blocks[0],title:'Introduction',body:'Visible book text'} as any];const second={...p.pages[0],id:'p2',name:'Second',blocks:[{...p.pages[0].blocks[0],id:'b2',title:'Next',body:'More text'} as any]};p.pages.push(second);const md=projectTextToMarkdown(p.pages as any);expect(md).toContain('# Opening');expect(md).toContain('\\page');expect(md).toContain('# Second');const back=markdownToProjectPages(md);expect(back.map(x=>x.name)).toEqual(['Opening','Second']);expect(back[0].sections.some(x=>x.body.includes('Visible book text'))).toBe(true)});
 it('converts World Creator headings into editable text sections',()=>{const s=markdownToTextSections('## History\nA long history.\n\n## People\nSeveral people.');expect(s.map(x=>x.title)).toEqual(['History','People']);expect(s[1].body).toBe('Several people.')});
});
