const MODULE_ID = "rpg-book-builder-companion";
const SETTING = "contentSubmissions";
const ALLOWED_TYPES = new Set(["species", "item", "spell"]);
const STATUS = Object.freeze({DRAFT:"draft",PENDING:"pending",APPROVED:"approved",CHANGES:"changes-requested",REJECTED:"rejected"});

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING, {
    name: "Player Content Submissions",
    scope: "world",
    config: false,
    type: Object,
    default: { submissions: [] }
  });
});

Hooks.once("ready", () => {
  game.socket.on(`module.${MODULE_ID}`, handleSocket);
  exposeApi();
});

Hooks.on("renderItemDirectory", (_app, html) => addDirectoryButton(html));
Hooks.on("renderActorDirectory", (_app, html) => addDirectoryButton(html));

function exposeApi(){
  const mod=game.modules.get(MODULE_ID);
  mod.api={...(mod.api||{}),openPlayerContentBuilder,openApprovalQueue,submitPlayerContent,listPlayerSubmissions};
}

function rootOf(html){return html instanceof HTMLElement?html:html?.[0]}
function addDirectoryButton(html){
  const root=rootOf(html); if(!root||root.querySelector("[data-rpgbb-player-content]"))return;
  const host=root.querySelector(".directory-header .header-actions, .directory-header"); if(!host)return;
  const button=document.createElement("button"); button.type="button"; button.dataset.rpgbbPlayerContent="";
  button.className="rpgbb-player-content";
  button.innerHTML=game.user.isGM?'<i class="fas fa-user-check"></i> Content Approval':'<i class="fas fa-wand-magic-sparkles"></i> My Custom Content';
  button.addEventListener("click",()=>game.user.isGM?openApprovalQueue():openPlayerContentBuilder());
  host.append(button);
}

function store(){const v=game.settings.get(MODULE_ID,SETTING);return v&&Array.isArray(v.submissions)?v:{submissions:[]}}
async function saveStore(value){if(!game.user.isGM)throw new Error("Only a GM can write the approval queue.");return game.settings.set(MODULE_ID,SETTING,value)}
function id(){return foundry.utils.randomID()}
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function cleanType(v){v=String(v||"").toLowerCase();if(!ALLOWED_TYPES.has(v))throw new Error("Only species, items, and spells can be submitted.");return v}
function sanitize(data){
  const type=cleanType(data.type),name=String(data.name||"").trim(),description=String(data.description||"").trim();
  if(!name)throw new Error("Name is required.");
  return {type,name,description,system:foundry.utils.deepClone(data.system||{}),img:String(data.img||"")};
}
function listPlayerSubmissions(userId=game.user.id){return store().submissions.filter(x=>x.userId===userId)}

async function submitPlayerContent(data){
  if(game.user.isGM)throw new Error("GM users should create content directly or review the queue.");
  const content=sanitize(data);
  const submission={id:id(),userId:game.user.id,userName:game.user.name,content,status:STATUS.PENDING,createdAt:Date.now(),updatedAt:Date.now(),revision:1,gmNote:""};
  game.socket.emit(`module.${MODULE_ID}`,{action:"submit",submission});
  ui.notifications.info(`${content.name} submitted to the GM for approval.`);
  return submission;
}

async function handleSocket(message){
  if(!game.user.isGM||!message||typeof message!=="object")return;
  if(message.action==="submit"){
    const s=message.submission;
    if(!s?.id||!s?.userId)return;
    try{s.content=sanitize(s.content)}catch(e){console.warn(MODULE_ID,e);return}
    s.status=STATUS.PENDING;s.updatedAt=Date.now();
    const db=store(); if(db.submissions.some(x=>x.id===s.id))return;
    db.submissions.push(s); await saveStore(db);
    ui.notifications.info(`New custom ${s.content.type} submission from ${s.userName}.`);
  }
}

async function openPlayerContentBuilder(){
  const mine=listPlayerSubmissions();
  const rows=mine.map(s=>`<div class="rpgbb-submission"><span><b>${esc(s.content.name)}</b><small>${esc(s.content.type)} · ${esc(s.status)}</small></span><em>${esc(s.gmNote||"")}</em></div>`).join("")||'<p class="hint">No submissions yet.</p>';
  const content=`<div class="rpgbb-approval"><p>Create a custom species, item, or spell. It remains unavailable to the character until a GM approves it.</p>
  <div class="form-group"><label>Type</label><select name="type"><option value="species">Species / Race</option><option value="item">Item</option><option value="spell">Spell</option></select></div>
  <div class="form-group"><label>Name</label><input name="name" required></div>
  <div class="form-group stacked"><label>Description / Rules</label><textarea name="description" rows="8"></textarea></div>
  <h3>My submissions</h3><div class="rpgbb-submissions">${rows}</div></div>`;
  return foundry.applications.api.DialogV2.wait({window:{title:"My Custom Content",resizable:true},position:{width:620,height:680},content,rejectClose:false,buttons:[
    {action:"submit",label:"Submit to GM",icon:"<i class='fas fa-paper-plane'></i>",default:true,callback:async(_e,b)=>{
      const f=b.form; await submitPlayerContent({type:f.elements.type.value,name:f.elements.name.value,description:f.elements.description.value}); return true;
    }},{action:"cancel",label:"Close"}
  ]});
}

async function openApprovalQueue(){
  if(!game.user.isGM)return;
  const pending=store().submissions.filter(s=>s.status===STATUS.PENDING||s.status===STATUS.CHANGES);
  const rows=pending.map(s=>`<article class="rpgbb-review-card" data-id="${s.id}"><header><b>${esc(s.content.name)}</b><span>${esc(s.content.type)} · ${esc(s.userName)}</span></header><div class="rpgbb-review-body">${esc(s.content.description).replace(/\n/g,"<br>")}</div><textarea data-note rows="2" placeholder="GM note / requested changes"></textarea><footer><button type="button" data-action="approve">Approve</button><button type="button" data-action="changes">Return for Changes</button><button type="button" data-action="reject">Reject</button></footer></article>`).join("")||'<p class="hint">No submissions are waiting for review.</p>';
  const content=`<div class="rpgbb-approval"><div class="rpgbb-review-list">${rows}</div></div>`;
  return foundry.applications.api.DialogV2.wait({window:{title:"GM Content Approval Queue",resizable:true},position:{width:760,height:720},content,rejectClose:false,buttons:[{action:"close",label:"Close"}],render:(_e,d)=>{
    d.element.querySelectorAll(".rpgbb-review-card button").forEach(btn=>btn.addEventListener("click",async()=>{
      const card=btn.closest(".rpgbb-review-card"),note=card.querySelector("[data-note]").value;
      await reviewSubmission(card.dataset.id,btn.dataset.action,note); card.remove();
    }));
  }});
}

async function reviewSubmission(submissionId,action,note=""){
  if(!game.user.isGM)throw new Error("Only a GM can review submissions.");
  const db=store(),s=db.submissions.find(x=>x.id===submissionId); if(!s)throw new Error("Submission not found.");
  s.gmNote=String(note||"");s.updatedAt=Date.now();
  if(action==="approve"){
    const doc=await createApprovedDocument(s);s.status=STATUS.APPROVED;s.approvedDocumentUuid=doc.uuid;
    ui.notifications.info(`Approved ${s.content.name}.`);
  }else if(action==="changes"){s.status=STATUS.CHANGES;ui.notifications.info(`${s.content.name} returned for changes.`)}
  else if(action==="reject"){s.status=STATUS.REJECTED;ui.notifications.info(`${s.content.name} rejected.`)}
  else throw new Error("Unknown review action.");
  await saveStore(db);
}

async function createApprovedDocument(s){
  const c=s.content,observer=CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER,owner=CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  const ownership={default:observer,[s.userId]:owner};
  const flags={[MODULE_ID]:{approvalStatus:STATUS.APPROVED,submissionId:s.id,submittedBy:s.userId,revision:s.revision}};
  let type="loot",system={description:{value:`<p>${esc(c.description).replace(/\n/g,"</p><p>")}</p>`}};
  if(c.type==="spell")type="spell";
  if(c.type==="species"){
    type="race";
    if(!CONFIG.Item.typeLabels?.race && CONFIG.Item.typeLabels?.species)type="species";
  }
  system=foundry.utils.mergeObject(system,c.system||{},{inplace:false,insertKeys:true,overwrite:true});
  return Item.implementation.create({name:c.name,type,img:c.img||undefined,ownership,flags,system});
}

export {openPlayerContentBuilder,openApprovalQueue,submitPlayerContent,listPlayerSubmissions,reviewSubmission,STATUS};
