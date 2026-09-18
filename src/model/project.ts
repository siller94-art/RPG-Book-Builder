import type{DocumentBlock,Page,Project,StatblockKind}from'./types';
export const PROJECT_SCHEMA_VERSION=1 as const;
export const uid=()=>crypto.randomUUID();
export function createTextBlock():DocumentBlock{return{id:uid(),kind:'text',title:'New Section',body:'Start writing…',columns:1}}
export function createImageBlock(src='',alt='Artwork'):DocumentBlock{return{id:uid(),kind:'image',title:alt,src,alt,fit:'contain',opacity:1}}
export function createStatblock(template:StatblockKind='monster'):DocumentBlock{return{id:uid(),kind:'statblock',template,title:template==='spell'?'New Spell':template==='item'?'New Item':'New Creature',body:'Add rules and details here.'}}
export function createPage(name='Page 1'):Page{return{id:uid(),name,blocks:[]}}
export function createProject():Project{const page=createPage();page.blocks=[{id:uid(),kind:'text',title:'Chapter One',body:'Begin writing your adventure here.',columns:1}];return{schemaVersion:PROJECT_SCHEMA_VERSION,id:uid(),title:'Untitled Adventure',pages:[page],activePageId:page.id,settings:{pageSize:'letter',themeId:'parchment'},updatedAt:new Date().toISOString()}}
export function cloneProject(project:Project):Project{return structuredClone(project)}
export function activePage(project:Project):Page{return project.pages.find(p=>p.id===project.activePageId)??project.pages[0]}
export function normalizeProject(value:unknown):Project{if(!value||typeof value!=='object')throw new Error('Invalid project');const p=value as Partial<Project>;if(p.schemaVersion!==1||!Array.isArray(p.pages)||!p.pages.length)throw new Error('Unsupported or damaged project file');return p as Project}
