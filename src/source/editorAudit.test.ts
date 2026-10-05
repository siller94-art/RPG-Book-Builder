import{describe,it,expect}from'vitest';import{inspectSource,applySafeIssues}from'./writingHelper';
import{markdownToProjectPages,markdownToTextSections,renderBrewMarkdown,parseBrewSource,sourceToPlainText,insertTableOfContents,syncTableOfContents,hasTableOfContents}from'./brewSource';import{findLoreLinks,consistencyIssues,playerSafeSource,timelineFromSource,encyclopedia}from'./loreStudio';
describe('Writing Helper regression and stress',()=>{
it('finds and safely fixes Markdown/writing issues',()=>{const s='#Bad\nThe the coast!! x\\page next';const issues=inspectSource(s);expect(issues.length).toBeGreaterThanOrEqual(4);const fixed=applySafeIssues(s,issues);expect(fixed).toContain('# Bad');expect(fixed).toContain('The coast!');expect(fixed).toContain('x\n\\page')});
it('does not auto-apply unsafe grammar advice',()=>{const s="It's history is old.";const issues=inspectSource(s);expect(issues.some(x=>!x.safe)).toBe(true);expect(applySafeIssues(s,issues)).toBe(s)});
it('handles a large manuscript without losing fixes',()=>{const unit='#Bad Heading\nThe the empire!! body\\column more\n';const s=unit.repeat(1500);const issues=inspectSource(s);expect(issues.length).toBeGreaterThan(4000);const fixed=applySafeIssues(s,issues);expect(fixed.includes('The the')).toBe(false);expect(fixed.includes('!!')).toBe(false);expect(fixed.includes('#Bad')).toBe(false)});
});
describe('World Creator regression and stress',()=>{
it('extracts links, timeline, encyclopedia and consistency issues',()=>{const s='# Coral\n*Empire · Player*\n**Year:** 800\nFounded.\n@Urzer\n# Urzer\n*NPC · Player*\n';expect(findLoreLinks(s)).toContain('Urzer');expect(timelineFromSource(s)[0].year).toBe(800);expect(encyclopedia(s).length).toBe(2);expect(consistencyIssues(s)).not.toContain('Unresolved lore link: @Urzer')});
it('removes secret articles and GM truth from player output',()=>{const s='# Public\n*NPC · Player*\nVisible\n## GM Truth\nHidden\n## Overview\nSafe\n# Secret One\n*NPC · Secret*\nNever show\n# Public Two\n*NPC · Player*\nVisible two';const p=playerSafeSource(s);expect(p).not.toContain('Hidden');expect(p).not.toContain('Never show');expect(p).toContain('Visible');expect(p).toContain('Visible two')});
it('handles a large world index',()=>{let s='';for(let i=0;i<2500;i++)s+=`# Place ${i}\n*Settlement · Player*\n**Year:** ${1000+i}\nEvent ${i}\n@Place ${(i+1)%2500}\n`;expect(encyclopedia(s).length).toBe(2500);expect(findLoreLinks(s).length).toBe(2500);expect(timelineFromSource(s).length).toBe(2500);expect(consistencyIssues(s).length).toBe(0)});
});
describe('Brew layout commands',()=>{
 it('creates a new page for every explicit page command, including an empty trailing page',()=>{
  const pages=markdownToProjectPages('# First\n\nAlpha\n\n\\page\n\n# Second\n\nBeta\n\n\\page');
  expect(pages).toHaveLength(3);
  expect(pages[0].name).toBe('First');
  expect(pages[1].name).toBe('Second');
  expect(pages[2].name).toBe('Page 3');
 });
 it('turns column commands into two-column sections without showing the command as text',()=>{
  const sections=markdownToTextSections('First column\n\n\\column\n\nSecond column');
  expect(sections.some(s=>s.columns===2&&s.body.includes('Second column'))).toBe(true);
  expect(sections.every(s=>!s.body.includes('\\\\column'))).toBe(true);
  expect(renderBrewMarkdown('First\n\\column\nSecond')).not.toContain('\\\\column');
 });
});

describe('Full audit Homebrewery regressions',()=>{
 const cr=`{{descriptive
#### Challenge Rating Reference

| CR | XP | CR | XP |
|:--|--:|:--|--:|
| 0 | 0 or 10 | 14 | 11,500 |
| 1/8 | 25 | 15 | 13,000 |
| 1/4 | 50 | 16 | 15,000 |
| 1/2 | 100 | 17 | 18,000 |
| 1 | 200 | 18 | 20,000 |
| 13 | 10,000 | 30 | 155,000 |
}}`;
 it('preserves explicit empty pages in both source parsers',()=>{
  expect(markdownToProjectPages('# One\n\\page').length).toBe(2);
  expect(parseBrewSource('# One\n\\page').pages.length).toBe(2);
 });
 it('renders the CR descriptive table as a container and table',()=>{
  const html=renderBrewMarkdown(cr);expect(html).toContain('brew-snippet descriptive');expect(html).toContain('<table>');expect(html).toContain('11,500');expect(html).toContain('155,000');
 });
 it('converts note and descriptive containers into visual note sections instead of raw braces',()=>{
  const note=markdownToTextSections('{{note\n**About this edition.** Keep this note.\n}}');
  const desc=markdownToTextSections(cr);
  expect(note[0]).toMatchObject({style:'note',title:'Note'});
  expect(note[0].body).not.toContain('{{');
  expect(desc[0]).toMatchObject({style:'note',title:'Descriptive'});
  expect(desc[0].body).toContain('Challenge Rating Reference');
  expect(desc[0].body).not.toContain('}}');
 });
 it('marks imported headings and blockquotes semantically',()=>{
  expect(markdownToTextSections('## History\nOld lore.')[0].style).toBe('heading');
  expect(markdownToTextSections('> Important warning')[0].style).toBe('note');
 });
});

describe('Post-merge export regressions',()=>{
 it('keeps multiline note and descriptive content in plain-text export while removing wrappers',()=>{
  const plain=sourceToPlainText('{{note\n**About this edition.** Keep this note.\n}}\n\n{{descriptive\n#### Challenge Rating Reference\n| CR | XP |\n|:--|--:|\n| 1 | 200 |\n}}');
  expect(plain).toContain('About this edition. Keep this note.');
  expect(plain).toContain('Challenge Rating Reference');
  expect(plain).toContain('| 1 | 200 |');
  expect(plain).not.toContain('{{note');expect(plain).not.toContain('{{descriptive');expect(plain).not.toContain('}}');
 });
});


describe('Automatic table of contents',()=>{
 it('uses Homebrewery pageNumber boundaries consistently for TOC pages',()=>{
  const source='# Cover\n{{pageNumber 1}}\n# Chapter One';
  const toc=insertTableOfContents(source);
  expect(hasTableOfContents(toc)).toBe(true);
  expect(toc).toContain('**Chapter One** | 3 |');
 });
 it('inserts a contents page after the opening page and calculates real page numbers',()=>{
  const source='# Cover\nIntro\n\\page\n# Coral Empire\n## History\nLore\n\\page\n# Tazia Empire\nText';
  const toc=insertTableOfContents(source);
  expect(hasTableOfContents(toc)).toBe(true);
  const pages=toc.split(/^\\page$/gm);
  expect(pages).toHaveLength(4);
  expect(pages[1]).toContain('# Contents');
  expect(pages[1]).toContain('**Coral Empire** | 3 |');
  expect(pages[1]).toContain('History | 3 |');
  expect(pages[1]).toContain('**Tazia Empire** | 4 |');
 });
 it('refreshes page numbers without creating duplicate contents pages',()=>{
  const first=insertTableOfContents('# Cover\n\\page\n# One\n\\page\n# Two');
  const moved=first.replace('# One','\\page\n# Added\n\\page\n# One');
  const synced=syncTableOfContents(moved);
  expect((synced.match(/RPG-BOOK-BUILDER:TOC/g)||[])).toHaveLength(1);
  expect(synced).toContain('**One** | 5 |');
 });
});
