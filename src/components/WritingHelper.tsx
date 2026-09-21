import{useMemo,useState}from'react';import{applyIssue,applySafeIssues,inspectSource}from'../source/writingHelper';
interface Props{source:string;onChange:(source:string)=>void}
export default function WritingHelper({source,onChange}:Props){
 const[ignored,setIgnored]=useState<string[]>([]);
 const issues=useMemo(()=>inspectSource(source).filter(x=>!ignored.includes(x.id)),[source,ignored]);
 const safe=issues.filter(x=>x.safe);
 return <section className="writingHelper">
  <div className="helperHead"><div><b>✦ Writing Helper</b><small>Checks formatting, common writing mistakes, and 5e wording. You choose every change.</small></div><span className={issues.length?'helperCount':'helperCount clear'}>{issues.length?issues.length+' suggestion'+(issues.length===1?'':'s'):'Looks good'}</span></div>
  {issues.length>0&&<div className="helperIssues">{issues.slice(0,8).map(issue=><article key={issue.id} className={'helperIssue '+issue.type}><div><small>{issue.type.toUpperCase()}</small><b>{issue.message}</b>{issue.before!==issue.after&&<p><del>{issue.before}</del> → <ins>{issue.after}</ins></p>}</div><div className="helperActions">{issue.before!==issue.after&&<button className="primary" onClick={()=>onChange(applyIssue(source,issue))}>Fix</button>}<button onClick={()=>setIgnored(v=>[...v,issue.id])}>Ignore</button></div></article>)}</div>}
  {issues.length>8&&<small className="moreIssues">+ {issues.length-8} more suggestions update as you fix the text.</small>}
  {safe.length>1&&<button className="fixAll" onClick={()=>onChange(applySafeIssues(source,safe))}>Fix All Safe ({safe.length})</button>}
 </section>
}