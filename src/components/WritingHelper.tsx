import{useEffect,useMemo,useState}from'react';import{applyIssue,applySafeIssues,inspectSource,type HelperIssue}from'../source/writingHelper';
interface Props{source:string;onChange:(source:string)=>void;onLocate:(issue:HelperIssue)=>void}
export default function WritingHelper({source,onChange,onLocate}:Props){
 const[ignored,setIgnored]=useState<string[]>([]),[inspectedSource,setInspectedSource]=useState(source);
 useEffect(()=>{const timer=window.setTimeout(()=>setInspectedSource(source),250);return()=>window.clearTimeout(timer)},[source]);
 const issues=useMemo(()=>inspectSource(inspectedSource).filter(x=>!ignored.includes(x.id)),[inspectedSource,ignored]),safe=issues.filter(x=>x.safe),stale=source!==inspectedSource;
 const fix=(issue:HelperIssue)=>{if(stale)return;onChange(applyIssue(source,issue))},fixAll=()=>{if(stale)return;onChange(applySafeIssues(source,safe))};
 return <section className="writingHelper">
  <div className="helperHead"><div><b>✦ Writing Helper</b><small>Grammar, Markdown formatting, lore templates, and 5e checks. You approve every change.</small></div><span className={issues.length?'helperCount':'helperCount clear'}>{stale?'Checking…':issues.length?issues.length+' suggestion'+(issues.length===1?'':'s'):'Looks good'}</span></div>
  {issues.length>0&&<div className="helperIssues">{issues.slice(0,10).map(issue=><article key={issue.id} className={'helperIssue '+issue.type} onClick={()=>onLocate(issue)}><div><small>{issue.type.toUpperCase()}</small><b>{issue.message}</b>{issue.safe&&issue.before!==issue.after&&<p><del>{issue.before}</del> → <ins>{issue.after}</ins></p>}</div><div className="helperActions"><button onClick={e=>{e.stopPropagation();onLocate(issue)}}>Show</button>{issue.safe&&issue.before!==issue.after&&<button className="primary" disabled={stale} title={stale?'Waiting for the latest text to be checked.':''} onClick={e=>{e.stopPropagation();fix(issue)}}>Fix</button>}<button onClick={e=>{e.stopPropagation();setIgnored(v=>[...v,issue.id])}}>Ignore</button></div></article>)}</div>}
  {issues.length>10&&<small className="moreIssues">+ {issues.length-10} more suggestions.</small>}
  {safe.length>1&&<button className="fixAll" disabled={stale} title={stale?'Waiting for the latest text to be checked.':''} onClick={fixAll}>Fix All Safe ({safe.length})</button>}
 </section>
}