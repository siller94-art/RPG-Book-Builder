import type{DocumentBlock,ImageBlock,Page,Project,StatblockBlock,StatblockKind,TextBlock}from'./types';
export const PROJECT_SCHEMA_VERSION=1 as const;
export const uid=()=>crypto.randomUUID();
export function createTextBlock():TextBlock{return{id:uid(),kind:'text',title:'',body:'',columns:1}}
export function createImageBlock(src='',alt='Artwork'):ImageBlock{return{id:uid(),kind:'image',title:alt,src,originalSrc:src||undefined,alt,fit:'contain',opacity:1,width:100,position:'center',layer:'inline',imageStyle:'standard',watercolorFeather:35,focalX:50,focalY:50,height:320}}
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
 };return{id:uid(),kind:'statblock',template,textColor:'#2d251c',backgroundColor:'#f1dfbd',accentColor:'#7c302b',borderColor:'#a5655d',lineColor:'#a5655d',titleColor:'#7c302b',title:template==='spell'?'New Spell':template==='item'?'New Item':template==='encounter'?'New Encounter':template==='trap'?'New Trap':template==='vehicle'?'New Vehicle':template==='custom'?'Custom Block':'New Creature',body:'Add rules and details here.',fields:presets[template],sections:(template==='monster'||template==='npc')?{traits:[],actions:template==='monster'?[{id:uid(),name:'Attack',text:'Add an attack or action here.'}]:[],reactions:[],legendary:[]}:undefined}}

export function createPage(name='Page 1'):Page{return{id:uid(),name,blocks:[]}}
export function createTitlePage(projectTitle='Untitled Adventure'):Page{
 const page=createPage('Title Page');page.isTitlePage=true;
 const title=createTextBlock();title.title=projectTitle;title.body='';title.style='heading';title.align='center';title.fontSize=36;title.width=100;title.spacing=24;
 const subtitle=createTextBlock();subtitle.title='Subtitle';subtitle.body='Add a subtitle, campaign setting, or edition here.';subtitle.align='center';subtitle.fontSize=20;subtitle.width=100;subtitle.spacing=18;
 const author=createTextBlock();author.title='By';author.body='Author or creator name';author.align='center';author.fontSize=16;author.width=100;author.spacing=18;
 const cover=createImageBlock('','Cover Artwork');cover.width=72;cover.position='center';cover.imageStyle='watercolor';cover.watercolorFeather=42;cover.spacing=22;
 page.blocks=[title,subtitle,cover,author];
 return page
}
export function createProject():Project{const page=createPage();page.blocks=[{id:uid(),kind:'text',title:'Chapter One',body:'Begin writing your adventure here.',columns:1}];return{schemaVersion:PROJECT_SCHEMA_VERSION,id:uid(),title:'Untitled Adventure',pages:[page],activePageId:page.id,settings:{pageSize:'letter',orientation:'portrait',themeId:'parchment',pageColor:'#f4ead2',pageTextColor:'#342c24',headingColor:'#7c302b',ruleColor:'#a5655d'},updatedAt:new Date().toISOString(),creatorLibrary:[],worldTools:{maps:{name:'',notes:'',image:'',pins:[]},timeline:[],boards:[]}}}
export function cloneProject(project:Project):Project{return structuredClone(project)}
export function activePage(project:Project):Page{return project.pages.find(p=>p.id===project.activePageId)??project.pages[0]}
export function deleteActivePage(project:Project):void{const i=project.pages.findIndex(p=>p.id===project.activePageId);if(i<0)return;if(project.pages.length<=1){const q=createPage('Page 1');project.pages=[q];project.activePageId=q.id;return}project.pages.splice(i,1);project.activePageId=project.pages[Math.min(i,project.pages.length-1)].id}
export function normalizeProject(value:unknown):Project{if(!value||typeof value!=='object')throw new Error('Invalid project');const p=value as Partial<Project>;if(p.schemaVersion!==1||!Array.isArray(p.pages)||!p.pages.length)throw new Error('Unsupported or damaged project file');p.settings??={pageSize:'letter',orientation:'portrait',themeId:'parchment'};p.settings.orientation??='portrait';p.settings.pageColor??='#f4ead2';p.settings.pageTextColor??='#342c24';p.settings.headingColor??='#7c302b';p.settings.ruleColor??='#a5655d';p.worldTools??={maps:{name:'',notes:'',image:'',pins:[]},timeline:[],boards:[]};p.creatorLibrary??=[];for(const page of p.pages)for(const block of page.blocks){block.width??=block.kind==='statblock'?62:100;block.spacing??=18;if(block.kind==='statblock'){block.textColor??='#2d251c';block.backgroundColor??='#f1dfbd';block.accentColor??='#7c302b';block.borderColor??='#a5655d';block.lineColor??='#a5655d';block.titleColor??=block.accentColor;if(!block.fields)block.fields=createStatblock(block.template).fields;if((block.template==='monster'||block.template==='npc')&&!block.sections){block.sections={traits:[],actions:[],reactions:[],legendary:[]};for(const key of['traits','actions','reactions','legendary']){const text=block.fields[key];if(text?.trim())block.sections[key].push({id:uid(),name:key[0].toUpperCase()+key.slice(1),text});delete block.fields[key]}}}if(block.kind==='image'){block.width??=100;block.position??='center';block.layer??='inline';block.opacity??=1;block.fit??='contain';block.focalX??=50;block.focalY??=50;block.height??=320;block.imageStyle??='standard';block.watercolorFeather??=35;block.originalSrc??=block.src||undefined}}return p as Project}
