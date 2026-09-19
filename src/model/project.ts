import type{DocumentBlock,ImageBlock,Page,Project,StatblockBlock,StatblockKind,TextBlock}from'./types';
export const PROJECT_SCHEMA_VERSION=1 as const;
export const uid=()=>crypto.randomUUID();
export function createTextBlock():TextBlock{return{id:uid(),kind:'text',title:'New Section',body:'Start writing…',columns:1}}
export function createImageBlock(src='',alt='Artwork'):ImageBlock{return{id:uid(),kind:'image',title:alt,src,alt,fit:'contain',opacity:1,width:100,position:'center',layer:'inline',focalX:50,focalY:50,height:320}}
export function createStatblock(template:StatblockKind='monster'):StatblockBlock{
 const presets:Record<StatblockKind,Record<string,string>>={
  monster:{sizeType:'Medium creature',alignment:'unaligned',ac:'15',hp:'45',speed:'30 ft.',str:'10',dex:'10',con:'10',int:'10',wis:'10',cha:'10',saves:'',skills:'',senses:'',languages:'',cr:'1'},
  npc:{role:'NPC',ancestry:'',alignment:'',ac:'10',hp:'10',speed:'30 ft.',str:'10',dex:'10',con:'10',int:'10',wis:'10',cha:'10',skills:'',languages:''},
  spell:{levelSchool:'1st-level spell',school:'Evocation',ritual:'No',castingTime:'1 action',range:'60 feet',components:'V, S',material:'',duration:'Instantaneous',concentration:'No',classes:'',higherLevels:''},
  item:{itemType:'Wondrous item',rarity:'Uncommon',attunement:'No',attunementReq:'',charges:'',recharge:'',properties:''},
  vehicle:{vehicleType:'Vehicle',size:'Large',ac:'15',hp:'100',damageThreshold:'',speed:'',crew:'',passengers:'',cargo:'',capacity:'',actions:''},
  trap:{level:'Moderate',type:'Mechanical',trigger:'',effect:'',save:'DC 13',damage:'',detect:'',disable:'',countermeasures:''},
  encounter:{difficulty:'Medium',party:'4 characters',creatures:'',environment:'',objectives:'',waves:'',complications:'',rewards:''},
  custom:{subtitle:'Custom RPG Block',category:'Reference',tags:''}
 };return{id:uid(),kind:'statblock',template,title:template==='spell'?'New Spell':template==='item'?'New Item':template==='encounter'?'New Encounter':template==='trap'?'New Trap':template==='vehicle'?'New Vehicle':template==='custom'?'Custom Block':'New Creature',body:'Add rules and details here.',fields:presets[template],sections:(template==='monster'||template==='npc')?{traits:[],actions:template==='monster'?[{id:uid(),name:'Attack',text:'Add an attack or action here.'}]:[],reactions:[],legendary:[]}:undefined}}

export function createPage(name='Page 1'):Page{return{id:uid(),name,blocks:[]}}
export function createProject():Project{const page=createPage();page.blocks=[{id:uid(),kind:'text',title:'Chapter One',body:'Begin writing your adventure here.',columns:1}];return{schemaVersion:PROJECT_SCHEMA_VERSION,id:uid(),title:'Untitled Adventure',pages:[page],activePageId:page.id,settings:{pageSize:'letter',orientation:'portrait',themeId:'parchment'},updatedAt:new Date().toISOString()}}
export function cloneProject(project:Project):Project{return structuredClone(project)}
export function activePage(project:Project):Page{return project.pages.find(p=>p.id===project.activePageId)??project.pages[0]}
export function normalizeProject(value:unknown):Project{if(!value||typeof value!=='object')throw new Error('Invalid project');const p=value as Partial<Project>;if(p.schemaVersion!==1||!Array.isArray(p.pages)||!p.pages.length)throw new Error('Unsupported or damaged project file');p.settings??={pageSize:'letter',orientation:'portrait',themeId:'parchment'};p.settings.orientation??='portrait';for(const page of p.pages)for(const block of page.blocks){block.width??=block.kind==='statblock'?62:100;block.spacing??=18;if(block.kind==='statblock'){if(!block.fields)block.fields=createStatblock(block.template).fields;if((block.template==='monster'||block.template==='npc')&&!block.sections){block.sections={traits:[],actions:[],reactions:[],legendary:[]};for(const key of['traits','actions','reactions','legendary']){const text=block.fields[key];if(text?.trim())block.sections[key].push({id:uid(),name:key[0].toUpperCase()+key.slice(1),text});delete block.fields[key]}}}if(block.kind==='image'){block.width??=100;block.position??='center';block.layer??='inline';block.opacity??=1;block.fit??='contain';block.focalX??=50;block.focalY??=50;block.height??=320}}return p as Project}
