import{useState}from'react';

type CreatorTab='class'|'item'|'settlement';
type Fields=Record<string,string>;
interface Props{onInsert:(source:string)=>void}

const Field=({label,name,value,onChange,area=false,placeholder=''}:{label:string;name:string;value:string;onChange:(n:string,v:string)=>void;area?:boolean;placeholder?:string})=><label className="creatorField"><span>{label}</span>{area?<textarea value={value} placeholder={placeholder} onChange={e=>onChange(name,e.target.value)}/>:<input value={value} placeholder={placeholder} onChange={e=>onChange(name,e.target.value)}/>}</label>;

export default function LoreCreators({onInsert}:Props){
 const[tab,setTab]=useState<CreatorTab>('class');
 const[cls,setCls]=useState<Fields>({name:'New Class',role:'',hitDie:'d8',primary:'',saves:'',armor:'',weapons:'',features:'',lore:''});
 const[item,setItem]=useState<Fields>({name:'New Item',type:'Wondrous item',rarity:'Uncommon',attunement:'No',properties:'',history:''});
 const[settlement,setSettlement]=useState<Fields>({name:'New Settlement',type:'Town',population:'',region:'',government:'',knownFor:'',landmark:'',people:'',lore:''});
 const update=(setter:React.Dispatch<React.SetStateAction<Fields>>)=>(name:string,value:string)=>setter(v=>({...v,[name]:value}));
 const clean=(v:string)=>v.trim()||'—';
 const classSource=()=>`\n# ${clean(cls.name)}\n*Character Class*\n\n**Role:** ${clean(cls.role)}  \n**Hit Die:** ${clean(cls.hitDie)}  \n**Primary Ability:** ${clean(cls.primary)}  \n**Saving Throws:** ${clean(cls.saves)}  \n**Armor Training:** ${clean(cls.armor)}  \n**Weapon Training:** ${clean(cls.weapons)}\n\n## Class Lore\n${clean(cls.lore)}\n\n## Class Features\n${clean(cls.features)}\n`;
 const itemSource=()=>`\n{{statblock\n## ${clean(item.name)}\n*${clean(item.type)}, ${clean(item.rarity)}*\n\n**Attunement:** ${clean(item.attunement)}\n\n### Properties\n${clean(item.properties)}\n\n### Lore & History\n${clean(item.history)}\n}}\n`;
 const settlementSource=()=>`\n# ${clean(settlement.name)}\n*${clean(settlement.type)}*\n\n**Population:** ${clean(settlement.population)}  \n**Region:** ${clean(settlement.region)}  \n**Government:** ${clean(settlement.government)}  \n**Known For:** ${clean(settlement.knownFor)}\n\n## Overview\n${clean(settlement.lore)}\n\n## Landmark\n${clean(settlement.landmark)}\n\n## Important People\n${clean(settlement.people)}\n`;
 const insert=()=>onInsert(tab==='class'?classSource():tab==='item'?itemSource():settlementSource());
 return <section className="loreCreators">
  <div className="creatorTabs">
   <button className={tab==='class'?'active':''} onClick={()=>setTab('class')}>Class Creator</button>
   <button className={tab==='item'?'active':''} onClick={()=>setTab('item')}>Item Creator</button>
   <button className={tab==='settlement'?'active':''} onClick={()=>setTab('settlement')}>Settlement Creator</button>
  </div>
  <div className="creatorPanel">
   {tab==='class'&&<div className="creatorGrid">
    <Field label="Class Name" name="name" value={cls.name} onChange={update(setCls)}/><Field label="Role / Theme" name="role" value={cls.role} onChange={update(setCls)} placeholder="Warrior, divine caster, explorer…"/>
    <Field label="Hit Die" name="hitDie" value={cls.hitDie} onChange={update(setCls)}/><Field label="Primary Ability" name="primary" value={cls.primary} onChange={update(setCls)} placeholder="Strength or Dexterity"/>
    <Field label="Saving Throws" name="saves" value={cls.saves} onChange={update(setCls)}/><Field label="Armor Training" name="armor" value={cls.armor} onChange={update(setCls)}/>
    <Field label="Weapon Training" name="weapons" value={cls.weapons} onChange={update(setCls)}/><Field label="Class Lore" name="lore" value={cls.lore} onChange={update(setCls)} area/>
    <Field label="Class Features" name="features" value={cls.features} onChange={update(setCls)} area placeholder="List core features and progression notes."/>
   </div>}
   {tab==='item'&&<div className="creatorGrid">
    <Field label="Item Name" name="name" value={item.name} onChange={update(setItem)}/><Field label="Item Type" name="type" value={item.type} onChange={update(setItem)}/>
    <Field label="Rarity" name="rarity" value={item.rarity} onChange={update(setItem)}/><Field label="Attunement" name="attunement" value={item.attunement} onChange={update(setItem)} placeholder="No / Yes / requirement"/>
    <Field label="Properties / Rules" name="properties" value={item.properties} onChange={update(setItem)} area/><Field label="Lore & History" name="history" value={item.history} onChange={update(setItem)} area/>
   </div>}
   {tab==='settlement'&&<div className="creatorGrid">
    <Field label="Settlement Name" name="name" value={settlement.name} onChange={update(setSettlement)}/><Field label="Settlement Type" name="type" value={settlement.type} onChange={update(setSettlement)} placeholder="Village, town, city, capital"/>
    <Field label="Population" name="population" value={settlement.population} onChange={update(setSettlement)}/><Field label="Region" name="region" value={settlement.region} onChange={update(setSettlement)}/>
    <Field label="Government" name="government" value={settlement.government} onChange={update(setSettlement)}/><Field label="Known For" name="knownFor" value={settlement.knownFor} onChange={update(setSettlement)}/>
    <Field label="Landmark" name="landmark" value={settlement.landmark} onChange={update(setSettlement)} area/><Field label="Important People" name="people" value={settlement.people} onChange={update(setSettlement)} area/>
    <Field label="Settlement Lore / Overview" name="lore" value={settlement.lore} onChange={update(setSettlement)} area/>
   </div>}
   <div className="creatorFooter"><span>Generates book-ready lore/source formatting.</span><button className="primary" onClick={insert}>Insert into Lore Source</button></div>
  </div>
 </section>
}