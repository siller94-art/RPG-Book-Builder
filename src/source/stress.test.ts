import{describe,expect,it}from'vitest';
import{parseBrewSource,renderBrewMarkdown,sourceToPlainText}from'./brewSource';
import{consistencyIssues,encyclopedia,findLoreLinks,timelineFromSource}from'./loreStudio';

function largeWorld(count=1200){
 return Array.from({length:count},(_,i)=>`# Location ${i}
*Settlement · Places*

**Year:** ${1000+i}

## Overview
Location ${i} is connected to @Location ${(i+1)%count} and contains repeated campaign lore for stress testing.

## Details
${'History, culture, factions, encounters, and regional details. '.repeat(8)}
`).join('\n\\page\n');
}
describe('large project stress coverage',()=>{
 it('parses and renders a 1200-page Homebrewery source without dropping pages',()=>{
  const source=largeWorld();
  const parsed=parseBrewSource(source);
  expect(parsed.pages).toHaveLength(1200);
  expect(renderBrewMarkdown(parsed.pages[0].source)).toContain('Location 0');
  expect(sourceToPlainText(parsed.pages[1199].source)).toContain('Location 1199');
 });
 it('indexes a 1200-article world and resolves dense links/timeline data',()=>{
  const source=largeWorld();
  expect(encyclopedia(source)).toHaveLength(1200);
  expect(findLoreLinks(source)).toHaveLength(1200);
  expect(timelineFromSource(source)).toHaveLength(1200);
  expect(consistencyIssues(source)).toEqual([]);
 });
 it('survives repeated parsing and indexing passes used during editing',()=>{
  const source=largeWorld(500);
  for(let i=0;i<20;i++){
   expect(parseBrewSource(source).pages.length).toBe(500);
   expect(encyclopedia(source).length).toBe(500);
   expect(findLoreLinks(source).length).toBe(500);
  }
 });
});