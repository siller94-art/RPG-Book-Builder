const MODULE_ID="rpg-book-builder-companion";
const RULES={2014:"2014",2024:"2024"};
const KINDS=new Set(["class","subclass","race","species","background","feat","spell","weapon","equipment","consumable","loot"]);

Hooks.once("ready",()=>{const mod=game.modules.get(MODULE_ID);if(mod)mod.api={...(mod.api||{}),getSrdCatalog,addSrdDocumentToActor,detectSrdRulesVersion};});

function detectSrdRulesVersion(doc){
  const source=String(doc?.system?.source?.rules||doc?.system?.source?.book||doc?.flags?.dnd5e?.source?.rules||doc?.flags?.dnd5e?.rulesVersion||"").toLowerCase();
  if(/2024|5\.2|5\.5/.test(source))return RULES[2024];
  if(/2014|5\.1/.test(source))return RULES[2014];
  const pack=String(doc?.pack||doc?.collectionName||"").toLowerCase();
  if(/2024|5\.2/.test(pack))return RULES[2024];
  if(/2014|5\.1|srd/.test(pack))return RULES[2014];
  return null;
}
function kindOf(doc){return String(doc?.type||"").toLowerCase()}
function isSrdPack(pack){
  const id=String(pack?.collection||pack?.metadata?.id||"").toLowerCase(),label=String(pack?.metadata?.label||"").toLowerCase();
  return pack?.documentName==="Item"&&(/srd|rules|class|spell|item|equipment|character/.test(id+" "+label));
}
async function getSrdCatalog({rulesVersion="2024",kind="",query=""}={}){
  if(!["2014","2024"].includes(String(rulesVersion)))throw new Error("Rules version must be 2014 or 2024.");
  const q=String(query).trim().toLowerCase(),wanted=String(kind).toLowerCase(),out=[];
  for(const pack of game.packs.filter(isSrdPack)){
    let index;try{index=await pack.getIndex({fields:["type","system.source","flags.dnd5e"]})}catch{continue}
    for(const row of index){
      const type=kindOf(row);if(!KINDS.has(type))continue;
      if(wanted&&type!==wanted&&!(wanted==="species"&&type==="race"))continue;
      if(q&&!String(row.name||"").toLowerCase().includes(q))continue;
      let version=detectSrdRulesVersion({...row,pack:pack.collection});
      if(!version){
        const label=(pack.collection+" "+(pack.metadata?.label||"")).toLowerCase();
        version=/2024|5\.2|5\.5/.test(label)?"2024":/2014|5\.1/.test(label)?"2014":null;
      }
      if(version!==rulesVersion)continue;
      out.push({uuid:`Compendium.${pack.collection}.${row._id}`,name:row.name,type,rulesVersion:version,pack:pack.metadata?.label||pack.collection});
    }
  }
  return out.sort((a,b)=>a.name.localeCompare(b.name));
}
async function addSrdDocumentToActor(actor,uuid){
  if(!actor||actor.documentName!=="Actor")throw new Error("Choose a Foundry Actor.");
  if(!actor.isOwner&&!game.user.isGM)throw new Error("You do not own this character.");
  const source=await fromUuid(uuid);if(!source||source.documentName!=="Item")throw new Error("SRD item not found.");
  const version=detectSrdRulesVersion(source);if(!version)throw new Error("Could not determine the SRD rules version.");
  const data=source.toObject();delete data._id;
  data.flags={...(data.flags||{}),[MODULE_ID]:{...(data.flags?.[MODULE_ID]||{}),srd:true,rulesVersion:version,sourceUuid:uuid}};
  const [created]=await actor.createEmbeddedDocuments("Item",[data]);
  return created;
}
export{getSrdCatalog,addSrdDocumentToActor,detectSrdRulesVersion,RULES};
