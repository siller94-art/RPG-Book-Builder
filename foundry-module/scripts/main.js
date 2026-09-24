const MODULE_ID="rpg-book-builder-companion";
Hooks.once("init",()=>console.log("RPG Book Builder Companion | Initializing"));
Hooks.once("ready",()=>{game.modules.get(MODULE_ID).api={importPackage,validatePackage,previewPackage,importPlainLore,plainLorePackage,entryStatus};if(game.user?.isGM)ui.notifications.info("RPG Book Builder Companion ready.")});
Hooks.on("renderJournalDirectory",(app,html)=>{if(!game.user?.isGM)return;const root=html instanceof HTMLElement?html:html?.[0];if(!root||root.querySelector("[data-rpgbb-import]"))return;const button=document.createElement("button");button.type="button";button.dataset.rpgbbImport="";button.className="rpgbb-import";button.innerHTML='<i class="fas fa-book-import"></i> RPG Book Builder';button.addEventListener("click",choosePackage);(root.querySelector(".directory-header .header-actions, .directory-header")||root).append(button)});
async function choosePackage(){const input=document.createElement("input");input.type="file";input.accept=".json,.rpgfoundry,.md,.txt,application/json,text/plain,text/markdown";input.addEventListener("change",async()=>{const file=input.files?.[0];if(!file)return;try{const raw=await file.text();let data;if(/\.(md|txt)$/i.test(file.name))data=plainLorePackage(file.name.replace(/\.[^.]+$/,""),raw);else{try{data=JSON.parse(raw)}catch{data=plainLorePackage(file.name.replace(/\.[^.]+$/,""),raw)}}validatePackage(data);await showPreview(data)}catch(error){console.error("RPG Book Builder Companion | Import failed",error);ui.notifications.error(error?.message||"Lore import failed.")}},{once:true});input.click()}
function plainLorePackage(title,text){const normalized=String(text||"").replace(/\r\n/g,"\n"),parts=[...normalized.matchAll(/^#\s+(.+)$/gm)];const entries=parts.length?parts.map((m,i)=>({id:"external-"+slug(m[1])+"-"+i,name:m[1].trim(),kind:"History",visibility:"Player",body:normalized.slice(m.index+m[0].length,i+1<parts.length?parts[i+1].index:normalized.length).trim(),links:[]})):[{id:"external-"+slug(title||"lore"),name:title||"Imported Lore",kind:"History",visibility:"Player",body:normalized.trim(),links:[]}];return{format:"rpg-book-builder-foundry",version:1,title:title||"Imported Lore",createdAt:new Date().toISOString(),entries}}
function slug(v){return String(v||"lore").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"lore"}
async function importPlainLore(title,text){return importPackage(plainLorePackage(title,text))}
function validatePackage(data){if(!data||typeof data!=="object")throw new Error("Invalid RPG Book Builder package.");if(data.format!=="rpg-book-builder-foundry")throw new Error("This is not an RPG Book Builder Foundry export.");if(!Array.isArray(data.entries))throw new Error("The package has no lore entries.");return true}
function targetType(e){return e.kind==="Creature"||e.kind==="Person"?"Actor":e.kind==="Item"?"Item":"Journal"}
function existingFor(entry){const type=targetType(entry),collection=type==="Actor"?game.actors:type==="Item"?game.items:game.journal;return findBySource(collection,entry.id)}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==="object")return Object.keys(value).sort().reduce((out,key)=>(out[key]=canonical(value[key]),out),{});return value}
function fingerprintPayload(entry){return{name:entry.name||"",kind:entry.kind||"History",visibility:entry.visibility||"Player",body:entry.body||"",html:entry.html||"",links:entry.links||[],image:entry.image||"",dnd5e:entry.dnd5e||null}}
function stableEntry(entry){return JSON.stringify(canonical(fingerprintPayload(entry)))}
function legacyFingerprints(entry){
  const payload=fingerprintPayload(entry);
  return new Set([
    JSON.stringify(payload),
    JSON.stringify(canonical(payload)),
    JSON.stringify(entry),
    JSON.stringify(canonical(entry))
  ])
}
function fingerprintMatches(entry,value){return typeof value==="string"&&legacyFingerprints(entry).has(value)}
function entryStatus(entry){const old=existingFor(entry);if(!old)return"New";const stored=old.getFlag(MODULE_ID,"fingerprint");return fingerprintMatches(entry,stored)?"Unchanged":"Update"}
function previewPackage(data){return data.entries.reduce((a,e)=>{const type=targetType(e),status=entryStatus(e);a[type]=(a[type]||0)+1;a[status]=(a[status]||0)+1;return a},{Journal:0,Actor:0,Item:0,New:0,Update:0,Unchanged:0})}
function sourceFlag(entry){return{[MODULE_ID]:{sourceId:entry.id||null,visibility:entry.visibility||"Player",links:entry.links||[],fingerprint:stableEntry(entry),fingerprintVersion:2}}}
function findBySource(collection,id){return id?collection?.find(d=>d.getFlag(MODULE_ID,"sourceId")===id):null}
function num(v,fallback=0){const match=String(v??"").match(/-?\d+(?:\.\d+)?/);if(!match)return fallback;const n=Number(match[0]);return Number.isFinite(n)?n:fallback}
function field(entry,...names){const f=entry.dnd5e?.fields||{};for(const n of names){const k=Object.keys(f).find(x=>x.toLowerCase()===n.toLowerCase());if(k)return f[k]}return""}
function ability(entry,key){return num(field(entry,key,key.toUpperCase()),10)}
function parseSpeed(value=""){const out={walk:0,fly:0,swim:0,climb:0,burrow:0,units:"ft"};const text=String(value);const walk=text.match(/(?:^|,)\s*(\d+)\s*ft/i);out.walk=walk?num(walk[1]):30;for(const k of ["fly","swim","climb","burrow"]){const m=text.match(new RegExp(k+"\\s+(\\d+)\\s*ft","i"));if(m)out[k]=num(m[1])}return out}
function parseProficiencyMap(value=""){const out={};for(const part of String(value).split(",")){const m=part.trim().match(/^(.+?)\s*([+-]\d+)$/);if(m)out[m[1].trim().toLowerCase()]=num(m[2])}return out}
function actorData(entry,folder){const npc=entry.kind==="Creature",hp=num(field(entry,"Hit Points","HP"),1),ac=num(field(entry,"Armor Class","AC"),10),cr=field(entry,"Challenge","CR")||"0",speed=parseSpeed(field(entry,"Speed"));return{name:entry.name,type:"npc",folder:folder.id,img:entry.image||undefined,ownership:ownership(entry),flags:sourceFlag(entry),system:enrichActorSystem(entry,{abilities:{str:{value:ability(entry,"STR")},dex:{value:ability(entry,"DEX")},con:{value:ability(entry,"CON")},int:{value:ability(entry,"INT")},wis:{value:ability(entry,"WIS")},cha:{value:ability(entry,"CHA")}},attributes:{ac:{flat:ac,calc:"flat"},hp:{value:hp,max:hp},movement:speed},details:{cr,biography:{value:loreHtml(entry)},type:{value:npc?"custom":"humanoid",custom:npc?"Creature":"NPC"}}})}}
function listField(entry,...names){return field(entry,...names).split(/[,;]/).map(x=>x.trim()).filter(Boolean)}
function parseDamage(text=""){const m=text.match(/(?:Hit:\s*\d+\s*\()?\s*(\d+d\d+(?:\s*[+-]\s*\d+)?)\)?\s*([a-z]+)?\s+damage/i);return m?{formula:m[1].replace(/\s/g,""),type:(m[2]||"").toLowerCase()}:null}
function parseAttack(text=""){const bonus=text.match(/([+-]\d+)\s*to hit/i),damage=parseDamage(text),range=text.match(/range\s*(\d+)(?:\/(\d+))?\s*ft/i),reach=text.match(/reach\s*(\d+)\s*ft/i),save=text.match(/DC\s*(\d+)\s*(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/i);return{bonus:bonus?num(bonus[1]):0,damage,range:range?num(range[1]):reach?num(reach[1]):5,longRange:range?.[2]?num(range[2]):null,save:save?{dc:num(save[1]),ability:save[2].slice(0,3).toLowerCase()}:null}}
function traitValues(entry,name){return listField(entry,name).map(x=>x.toLowerCase())}
const SKILL_IDS={acrobatics:"acr","animal handling":"ani",arcana:"arc",athletics:"ath",deception:"dec",history:"his",insight:"ins",intimidation:"itm",investigation:"inv",medicine:"med",nature:"nat",perception:"prc",performance:"prf",persuasion:"per",religion:"rel","sleight of hand":"slt",stealth:"ste",survival:"sur"};
function enrichActorSystem(entry,system){const saves=parseProficiencyMap(field(entry,"Saving Throws")),skills=parseProficiencyMap(field(entry,"Skills"));for(const [key,value] of Object.entries(saves)){const ability=key.slice(0,3);if(system.abilities[ability])system.abilities[ability].bonuses={save:String(value)}}system.skills={};for(const [key,value] of Object.entries(skills)){const id=SKILL_IDS[key];if(id)system.skills[id]={bonuses:{check:String(value)}}}system.traits={...(system.traits||{}),languages:{value:[],custom:field(entry,"Languages")},di:{value:traitValues(entry,"Damage Immunities"),custom:""},dr:{value:traitValues(entry,"Damage Resistances"),custom:""},dv:{value:traitValues(entry,"Damage Vulnerabilities"),custom:""},ci:{value:traitValues(entry,"Condition Immunities"),custom:""}};system.attributes.senses={special:field(entry,"Senses")};return system}
function featureItems(entry){const sections=entry.dnd5e?.sections||{},out=[];for(const [section,rows] of Object.entries(sections)){for(const row of rows||[]){const action=/weapon|attack|action/i.test(section),spell=/spell/i.test(section),type=spell?"spell":action?"weapon":"feat",attack=parseAttack(row.text||"");const system={description:{value:`<p>${escapeHtml(row.text||"")}</p>`}};if(action){const ranged=/ranged|bow|crossbow|range\s+\d+/i.test(row.text||"");system.actionType=attack.save?"save":ranged?"rwak":"mwak";system.attack={bonus:attack.bonus};system.range={value:attack.range,long:attack.longRange,units:"ft"};if(attack.damage)system.damage={parts:[[attack.damage.formula,attack.damage.type]]};if(attack.save)system.save={ability:attack.save.ability,dc:attack.save.dc,scaling:"flat"}}out.push({name:row.name,type,system})}}return out}
async function upsertJournal(entry,folder){const old=findBySource(game.journal,entry.id),data={name:entry.name,folder:folder.id,ownership:ownership(entry),flags:sourceFlag(entry)};if(old){await old.update(data);const page=old.pages?.contents?.[0];if(page)await page.update({name:entry.name,"text.content":loreHtml(entry)});else await old.createEmbeddedDocuments("JournalEntryPage",[{name:entry.name,type:"text",text:{format:1,content:loreHtml(entry)}}]);return{doc:old,updated:true}}const doc=await JournalEntry.create({...data,pages:[{name:entry.name,type:"text",text:{format:1,content:loreHtml(entry)}}]});return{doc,updated:false}}
async function upsertActor(entry,folder){const old=findBySource(game.actors,entry.id),data=actorData(entry,folder);let doc,updated=false;if(old){await old.update(data);doc=old;updated=true}else doc=await Actor.implementation.create(data);const features=featureItems(entry);if(features.length){const previous=doc.items?.filter(i=>i.getFlag(MODULE_ID,"importedFeature"));if(previous?.length)await doc.deleteEmbeddedDocuments("Item",previous.map(i=>i.id));await doc.createEmbeddedDocuments("Item",features.map(x=>({...x,flags:{[MODULE_ID]:{importedFeature:true}}})))}return{doc,updated}}
function itemData(entry,folder){return{name:entry.name,type:"loot",folder:folder.id,img:entry.image||undefined,ownership:ownership(entry),flags:sourceFlag(entry),system:{description:{value:loreHtml(entry)}}}}
async function upsertItem(entry,folder){const old=findBySource(game.items,entry.id),data=itemData(entry,folder);if(old){await old.update(data);return{doc:old,updated:true}}return{doc:await Item.implementation.create(data),updated:false}}
async function importPackage(data){if(!game.user?.isGM)throw new Error("Only a GM can import lore.");validatePackage(data);const active=data.entries.filter(e=>e?.name&&entryStatus(e)!=="Unchanged"),unchanged=data.entries.length-active.length;if(!active.length)return{created:0,updated:0,unchanged,total:data.entries.length};const roots={Journal:await ensureFolder(data.title||"RPG Book Builder","JournalEntry"),Actor:await ensureFolder(data.title||"RPG Book Builder","Actor"),Item:await ensureFolder(data.title||"RPG Book Builder","Item")},createdDocs=new Map();let created=0,updated=0;for(const entry of active){const kind=targetType(entry);const folder=await ensureFolder(entry.kind||"Lore",kind==="Journal"?"JournalEntry":kind,roots[kind]);const r=kind==="Actor"?await upsertActor(entry,folder):kind==="Item"?await upsertItem(entry,folder):await upsertJournal(entry,folder);createdDocs.set(entry.name.toLowerCase(),r.doc);r.updated?updated++:created++}for(const entry of active){const doc=createdDocs.get(entry.name?.toLowerCase());if(!doc||doc.documentName!=="JournalEntry")continue;const page=doc.pages?.contents?.[0];if(!page)continue;let content=page.text?.content||"";for(const linkName of entry.links||[]){const target=createdDocs.get(String(linkName).toLowerCase())||importedByName(linkName);if(!target)continue;content=content.split(`@${linkName}`).join(`@UUID[${target.uuid}]{${linkName}}`)}if(content!==page.text?.content)await page.update({"text.content":content})}return{created,updated,unchanged,total:data.entries.length}}


function escapeHtml(value=""){return String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))}
function loreHtml(entry){
  if(entry.html)return String(entry.html);
  const body=escapeHtml(entry.body||"").replace(/\n{2,}/g,"</p><p>").replace(/\n/g,"<br>");
  return body?`<p>${body}</p>`:"<p></p>"
}
function ownership(entry){
  const observer=CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER??2;
  const none=CONST?.DOCUMENT_OWNERSHIP_LEVELS?.NONE??0;
  return {default:entry.visibility==="Player"?observer:none}
}
async function ensureFolder(name,type,parent=null){
  const parentId=parent?.id??parent??null;
  const existing=game.folders?.find(f=>f.name===name&&f.type===type&&(f.folder?.id??f.folder??null)===parentId);
  if(existing)return existing;
  return Folder.create({name,type,folder:parentId})
}
function importedByName(name){
  const wanted=String(name||"").toLowerCase();
  if(!wanted)return null;
  for(const collection of [game.journal,game.actors,game.items]){
    const found=collection?.find(d=>String(d.name||"").toLowerCase()===wanted&&d.getFlag?.(MODULE_ID,"sourceId"));
    if(found)return found
  }
  return null
}
async function showPreview(data){
  const counts=previewPackage(data);
  const rows=data.entries.map((entry,index)=>{
    const status=entryStatus(entry),unchanged=status==="Unchanged";
    return `<label class="rpgbb-row ${unchanged?"is-unchanged":""}"><input type="checkbox" data-entry="${index}" ${unchanged?"disabled":"checked"}><span><b>${escapeHtml(entry.name||"Untitled")}</b><small>${escapeHtml(entry.kind||"History")} · ${escapeHtml(entry.visibility||"Player")}</small></span><em class="${status.toLowerCase()}">${status}</em></label>`
  }).join("");
  const content=`<div class="rpgbb-preview"><div class="rpgbb-summary"><b>${escapeHtml(data.title||"Lore Import")}</b><div class="rpgbb-counts"><span>${counts.Journal} Journal</span><span>${counts.Actor} Actor</span><span>${counts.Item} Item</span><span>${counts.New} New</span><span>${counts.Update} Update</span><strong>${counts.Unchanged} Unchanged</strong></div></div><div class="rpgbb-filter"><button type="button" data-select="all">All</button><button type="button" data-select="none">None</button></div><div class="rpgbb-rows">${rows}</div></div>`;
  const DialogV2=foundry?.applications?.api?.DialogV2;
  if(!DialogV2)throw new Error("Foundry VTT 14 DialogV2 API is unavailable.");
  return DialogV2.wait({
    window:{title:"RPG Book Builder Import Manager",resizable:true},
    position:{width:640,height:720},
    content,
    rejectClose:false,
    buttons:[
      {action:"import",icon:"<i class=\"fas fa-file-import\"></i>",label:"Import Selected",default:true,callback:async(event,button)=>{
        const root=button?.form||button?.closest?.("form")||button?.ownerDocument;
        const indexes=[...(root?.querySelectorAll?.('input[data-entry]:checked')||[])].map(el=>Number(el.dataset.entry));
        const selected={...data,entries:indexes.map(i=>data.entries[i]).filter(Boolean)};
        if(!selected.entries.length){ui.notifications.info("No entries selected.");return{created:0,updated:0,unchanged:0,total:0}}
        const result=await importPackage(selected);
        ui.notifications.info(`Import complete: ${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged.`);
        return result
      }},
      {action:"cancel",label:"Cancel"}
    ],
    render:(event,dialog)=>{
      const root=dialog?.element;
      root?.querySelector?.('[data-select="all"]')?.addEventListener("click",()=>root.querySelectorAll('input[data-entry]:not(:disabled)').forEach(x=>x.checked=true));
      root?.querySelector?.('[data-select="none"]')?.addEventListener("click",()=>root.querySelectorAll('input[data-entry]:not(:disabled)').forEach(x=>x.checked=false))
    }
  })
}
