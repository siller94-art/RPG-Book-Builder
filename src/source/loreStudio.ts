export type LoreVisibility='Player'|'GM Only'|'Secret';
export type LoreKind='Empire'|'Settlement'|'Person'|'Faction'|'Religion'|'History'|'Item'|'Creature'|'Mystery';
export interface LoreEntry{id:string;name:string;kind:LoreKind;visibility:LoreVisibility;body:string;year?:number;links:string[]}
export const loreTemplates:Record<string,string>={
 Empire:'# Empire Name\n**Capital:** —\n**Government:** —\n## Overview\n\n## History\n\n## Culture\n',
 Settlement:'# Settlement Name\n**Population:** —\n**Region:** —\n## Overview\n\n## Landmark\n\n## Important People\n',
 Faction:'# Faction Name\n**Purpose:** —\n**Leader:** —\n## Beliefs & Goals\n\n## Allies\n\n## Enemies\n',
 Religion:'# Religion Name\n**Deity / Pantheon:** —\n**Symbol:** —\n## Beliefs\n\n## Holy Sites\n\n## Practices\n',
 History:'# Historical Event\n**Year / Age:** —\n## What Happened\n\n## Consequences\n',
 Mystery:'# Mystery\n**Known By:** —\n## Player Knowledge\n\n## GM Truth\n'
};
export function npcSource(name:string,role:string,goal:string,secret:string,visibility:LoreVisibility){return `\n# ${name||'New NPC'}\n*NPC · ${visibility}*\n\n**Role:** ${role||'—'}\n**Goal:** ${goal||'—'}\n\n## Description\n\n## Relationships\n\n## Secret\n${secret||'—'}\n`}
export function factionSource(name:string,type:'Faction'|'Religion',purpose:string,visibility:LoreVisibility){return `\n# ${name||'New '+type}\n*${type} · ${visibility}*\n\n**Purpose / Belief:** ${purpose||'—'}\n\n## Leaders\n\n## Goals\n\n## Allies\n\n## Enemies\n`}
export function findLoreLinks(source:string){const out:string[]=[];for(const m of source.matchAll(/@([A-Za-z][A-Za-z0-9 '\\-]{0,60})/g)){let name=m[1].trim();name=name.replace(/\\s+(?:and|or|but)(?:\\s*)$/i,'').trim();if(name)out.push(name)}return out}
export function consistencyIssues(source:string){const out:string[]=[];const heads=[...source.matchAll(/^# ([^\n]+)$/gm)].map(x=>x[1].trim());const seen=new Set<string>();for(const h of heads){const k=h.toLowerCase();if(seen.has(k))out.push(`Duplicate lore heading: ${h}`);seen.add(k)}const links=findLoreLinks(source);for(const l of links)if(!heads.some(h=>h.toLowerCase()===l.toLowerCase()))out.push(`Unresolved lore link: @${l}`);const years=[...source.matchAll(/\b(?:Year|Founded|Established):?\s*(\d{3,5})\b/gi)].map(x=>Number(x[1]));if(years.some(y=>y>10000))out.push('A lore date is unusually large; check the timeline.');return [...new Set(out)]}
export function playerSafeSource(source:string){return source.replace(/# ([^\n]+)\n\*(?:NPC|Faction|Religion)?\s*·?\s*(?:GM Only|Secret)\*[\s\S]*?(?=\n# |$)/gi,'').replace(/## GM Truth[\s\S]*?(?=\n## |\n# |$)/gi,'')}
export function timelineFromSource(source:string){const events=[...source.matchAll(/(?:\*\*Year \/ Age:\*\*|\bYear:)\s*(\d+)[^\n]*\n(?:##[^\n]*\n)?([^\n]+)/gi)].map((m,i)=>({id:i,year:Number(m[1]),text:m[2].trim()}));return events.sort((a,b)=>a.year-b.year)}
export function encyclopedia(source:string){return [...source.matchAll(/^# ([^\n]+)(?:\n\*([^\n]+)\*)?/gm)].map((m,i)=>({id:i,name:m[1].trim(),meta:(m[2]||'Lore').trim()}))}
