export type HelperIssue={id:string;type:'format'|'writing'|'5e'|'class'|'item'|'settlement';message:string;before:string;after:string;safe:boolean;start:number;end:number};

type Rule={type:HelperIssue['type'];message:string;pattern:RegExp;replace:string;safe:boolean};
const rules:Rule[]=[
 {type:'writing',message:'Repeated word',pattern:/\b([A-Za-z]+)\s+\1\b/i,replace:'$1',safe:true},
 {type:'writing',message:'Use “its” for possession',pattern:/\bit's\s+(history|people|land|army|capital|empire|kingdom|coast|walls)\b/i,replace:'its $1',safe:false},
 {type:'writing',message:'Remove repeated punctuation',pattern:/([.!?])\1{1,}/,replace:'$1',safe:true},
 {type:'5e',message:'Use “Armor Class” in 5e statblocks',pattern:/\bArmour Class\b/i,replace:'Armor Class',safe:true},
 {type:'5e',message:'Use “Hit Points” in 5e statblocks',pattern:/\bHit Point:\s*/i,replace:'Hit Points: ',safe:true},
 {type:'format',message:'Homebrew page directive should be on its own line',pattern:/([^\n])\\page\b/,replace:'$1\n\\page',safe:true},
 {type:'format',message:'Homebrew column directive should be on its own line',pattern:/([^\n])\\column\b/,replace:'$1\n\\column',safe:true},
];

function missing(source:string,type:HelperIssue['type'],section:string,anchor:string,message:string){
 if(!source.includes(anchor))return;
 const start=source.indexOf(anchor),next=source.indexOf('\n# ',start+anchor.length),chunk=source.slice(start,next<0?source.length:next);
 if(!chunk.toLowerCase().includes(section.toLowerCase()))return {id:`missing-${type}-${section}-${start}`,type,message,before:anchor,after:anchor,safe:false,start,end:start+anchor.length};
}
export function inspectSource(source:string):HelperIssue[]{
 const issues:HelperIssue[]=[];
 rules.forEach((rule,ri)=>{const flags=rule.pattern.flags.includes('g')?rule.pattern.flags:rule.pattern.flags+'g',rx=new RegExp(rule.pattern.source,flags);let m:RegExpExecArray|null;
  while((m=rx.exec(source))){const before=m[0],after=before.replace(new RegExp(rule.pattern.source,rule.pattern.flags.replace('g','')),rule.replace);issues.push({id:`${ri}-${m.index}-${before}`,type:rule.type,message:rule.message,before,after,safe:rule.safe,start:m.index,end:m.index+before.length});if(!before.length)rx.lastIndex++}
 });
 const opens=(source.match(/{{/g)||[]).length,closes=(source.match(/}}/g)||[]).length;
 if(opens!==closes){const start=Math.max(0,source.lastIndexOf('{{'));issues.push({id:'unbalanced-containers',type:'format',message:`Unbalanced Homebrew containers: ${opens} opening and ${closes} closing markers.`,before:'{{ … }}',after:'Check the missing {{ or }} marker manually.',safe:false,start,end:Math.min(source.length,start+2)})}
 const heading=/^#{1,6}[^ #].*$/gm;let h:RegExpExecArray|null;while((h=heading.exec(source))){issues.push({id:`heading-space-${h.index}`,type:'format',message:'Add a space after the Markdown heading marks.',before:h[0],after:h[0].replace(/^(#{1,6})/,'$1 '),safe:true,start:h.index,end:h.index+h[0].length})}
 const checks=[
  missing(source,'class','**Hit Die:**','# ','Class entry is missing a Hit Die.'),
  missing(source,'class','## Class Features','*Character Class*','Class entry is missing a Class Features section.'),
  missing(source,'settlement','**Population:**','## Overview','Settlement entry is missing population information.'),
  missing(source,'settlement','## Landmark','## Overview','Settlement entry is missing a Landmark section.'),
  missing(source,'settlement','## Important People','## Overview','Settlement entry is missing an Important People section.'),
  missing(source,'item','### Properties','{{statblock','Item/statblock entry is missing a Properties section.')
 ].filter(Boolean) as HelperIssue[];issues.push(...checks);
 const stat=/{{statblock\n([\s\S]*?)\n}}/gi;let sm:RegExpExecArray|null;while((sm=stat.exec(source))){const body=sm[1],required=['## ','Armor Class','Hit Points'];if(/Armor Class|Hit Points|Speed/i.test(body))for(const key of required)if(!body.toLowerCase().includes(key.toLowerCase()))issues.push({id:`stat-${key}-${sm.index}`,type:'5e',message:`Creature statblock may be missing ${key.trim()==='##'?'a name heading':key}.`,before:sm[0].slice(0,Math.min(28,sm[0].length)),after:'Review this statblock manually.',safe:false,start:sm.index,end:sm.index+Math.min(28,sm[0].length)})}
 return issues.sort((a,b)=>a.start-b.start);
}
export function applyIssue(source:string,issue:HelperIssue){return issue.safe&&source.slice(issue.start,issue.end)===issue.before?source.slice(0,issue.start)+issue.after+source.slice(issue.end):source.includes(issue.before)&&issue.safe?source.replace(issue.before,issue.after):source}
export function applySafeIssues(source:string,issues:HelperIssue[]){return issues.filter(x=>x.safe).sort((a,b)=>b.start-a.start).reduce((text,issue)=>applyIssue(text,issue),source)}
