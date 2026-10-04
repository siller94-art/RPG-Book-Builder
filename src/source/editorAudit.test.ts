import{describe,it,expect}from'vitest';import{inspectSource,applySafeIssues}from'./writingHelper';
import{markdownToProjectPages,markdownToTextSections,renderBrewMarkdown}from'./brewSource';import{findLoreLinks,consistencyIssues,playerSafeSource,timelineFromSource,encyclopedia}from'./loreStudio';
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
