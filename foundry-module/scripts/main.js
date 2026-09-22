const MODULE_ID="rpg-book-builder-companion";

Hooks.once("init",()=>console.log("RPG Book Builder Companion | Initializing"));

Hooks.once("ready",()=>{
  game.modules.get(MODULE_ID).api={importPackage,validatePackage};
  if(game.user?.isGM) ui.notifications.info("RPG Book Builder Companion ready.");
});

Hooks.on("renderJournalDirectory",(app,html)=>{
  if(!game.user?.isGM)return;
  const root=html instanceof HTMLElement?html:html?.[0];
  if(!root||root.querySelector("[data-rpgbb-import]"))return;
  const button=document.createElement("button");
  button.type="button";
  button.dataset.rpgbbImport="";
  button.className="rpgbb-import";
  button.innerHTML='<i class="fas fa-book-import"></i> RPG Book Builder';
  button.addEventListener("click",choosePackage);
  const header=root.querySelector(".directory-header .header-actions, .directory-header")||root;
  header.append(button);
});

async function choosePackage(){
  const input=document.createElement("input");
  input.type="file";
  input.accept=".json,.rpgfoundry,application/json";
  input.addEventListener("change",async()=>{
    const file=input.files?.[0]; if(!file)return;
    try{const data=JSON.parse(await file.text());const result=await importPackage(data);ui.notifications.info(`Imported ${result.journals} lore journals.`)}
    catch(error){console.error("RPG Book Builder Companion | Import failed",error);ui.notifications.error(error?.message||"Lore import failed.")}
  },{once:true});
  input.click();
}

function validatePackage(data){
  if(!data||typeof data!=="object")throw new Error("Invalid RPG Book Builder package.");
  if(data.format!=="rpg-book-builder-foundry")throw new Error("This is not an RPG Book Builder Foundry export.");
  if(!Array.isArray(data.entries))throw new Error("The package has no lore entries.");
  return true;
}

function escapeHtml(value=""){const div=document.createElement("div");div.textContent=String(value);return div.innerHTML}
function loreHtml(entry){
  const body=entry.html||`<p>${escapeHtml(entry.body||"").replace(/\n\n/g,"</p><p>").replace(/\n/g,"<br>")}</p>`;
  const visibility=escapeHtml(entry.visibility||"Player");
  const kind=escapeHtml(entry.kind||"Lore");
  return `<section class="rpgbb-lore"><p class="rpgbb-meta"><strong>${kind}</strong> · ${visibility}</p>${body}</section>`;
}
async function ensureFolder(name,parent=null){
  const existing=game.folders?.find(f=>f.type==="JournalEntry"&&f.name===name&&(f.folder?.id??null)===(parent?.id??null));
  return existing||Folder.create({name,type:"JournalEntry",folder:parent?.id??null});
}
async function importPackage(data){
  if(!game.user?.isGM)throw new Error("Only a GM can import lore.");
  validatePackage(data);
  const root=await ensureFolder(data.title||"RPG Book Builder");
  const kindFolders=new Map();
  let journals=0;
  const created=new Map();
  for(const entry of data.entries){
    if(!entry?.name)continue;
    const kind=entry.kind||"Lore";
    let folder=kindFolders.get(kind);
    if(!folder){folder=await ensureFolder(kind,root);kindFolders.set(kind,folder)}
    const ownership=entry.visibility==="Player"?{default:2}:{default:0};
    const journal=await JournalEntry.create({
      name:entry.name,
      folder:folder.id,
      ownership,
      flags:{[MODULE_ID]:{sourceId:entry.id||null,visibility:entry.visibility||"Player",links:entry.links||[]}},
      pages:[{name:entry.name,type:"text",text:{format:1,content:loreHtml(entry)}}]
    });
    journals++;
  }
  await resolveLoreLinks();
  return{journals};
}

async function resolveLoreLinks(){
  const journals=game.journal?.contents||[];
  const byName=new Map(journals.map(j=>[j.name.toLowerCase(),j]));
  for(const journal of journals){
    const flag=journal.getFlag(MODULE_ID,"links");
    if(!Array.isArray(flag)||!flag.length)continue;
    const resolved=flag.map(name=>{const target=byName.get(String(name).toLowerCase());return target?{name,uuid:target.uuid}:{name,uuid:null}});
    await journal.setFlag(MODULE_ID,"resolvedLinks",resolved);
    for(const page of journal.pages||[]){
      if(page.type!=="text")continue;
      let content=page.text?.content||"";
      for(const link of resolved)if(link.uuid){content=content.split("@"+link.name).join("@UUID["+link.uuid+"]{"+link.name+"}")}
      if(content!==(page.text?.content||""))await page.update({"text.content":content});
    }
  }
}
