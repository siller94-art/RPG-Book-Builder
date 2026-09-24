import{ArrowDown,ArrowUp,Copy,Plus,Trash2}from'lucide-react';
import type{Page}from'../model/types';

interface Props{
 pages:Page[];activePageId:string;heading:string;
 onSelect:(id:string)=>void;onRename:(name:string)=>void;
 onMove:(delta:number)=>void;onDuplicate:()=>void;onAdd:()=>void;onDelete:()=>void;
}
export default function PageNavigator({pages,activePageId,heading,onSelect,onRename,onMove,onDuplicate,onAdd,onDelete}:Props){
 const index=Math.max(0,pages.findIndex(p=>p.id===activePageId));
 const active=pages[index]??pages[0];
 if(!active)return null;
 return <aside className="pages">
  <div className="projectLabel">The Project</div>
  <div className="pageNavHeading"><h3>{heading}</h3><small>{pages.length} {pages.length===1?'page':'pages'}</small></div>
  <label className="pageRename"><span>Page name</span><input className="pageName" value={active.name} onChange={e=>onRename(e.target.value)}/></label>
  <div className="pageActions">
   <button title="Move page up" disabled={index===0} onClick={()=>onMove(-1)}><ArrowUp/></button>
   <button title="Move page down" disabled={index===pages.length-1} onClick={()=>onMove(1)}><ArrowDown/></button>
   <button title="Duplicate page" onClick={onDuplicate}><Copy/></button>
  </div>
  <div className="pageThumbList" aria-label="Book pages">
   {pages.map((p,i)=><button key={p.id} className={'thumb '+(p.id===activePageId?'selected':'')} onClick={()=>onSelect(p.id)}>
    <span className="pageNumber">{i+1}</span><span className="pageThumbText"><b>{p.name||`Page ${i+1}`}</b><small>{p.blocks.length} {p.blocks.length===1?'block':'blocks'}</small></span>
   </button>)}
  </div>
  <button className="addPageButton" onClick={onAdd}><Plus/> Add page</button>
  {pages.length>1&&<button className="danger" onClick={onDelete}><Trash2/> Delete current page</button>}
 </aside>
}