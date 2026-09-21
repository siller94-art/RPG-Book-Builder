export type HelperIssue={id:string;type:'format'|'writing'|'5e';message:string;before:string;after:string;safe:boolean};

const rules:{type:HelperIssue['type'];message:string;pattern:RegExp;replace:string;safe:boolean}[]=[
 {type:'writing',message:'Repeated word',pattern:/\b([A-Za-z]+)\s+\1\b/i,replace:'$1',safe:true},
 {type:'writing',message:'Use “its” for possession',pattern:/\bit's\s+(history|people|land|army|capital|empire|kingdom|coast|walls)\b/i,replace:'its $1',safe:false},
 {type:'5e',message:'Use “Armor Class” in 5e statblocks',pattern:/\bArmour Class\b/i,replace:'Armor Class',safe:true},
 {type:'5e',message:'Use “Hit Points” in 5e statblocks',pattern:/\bHit Point:\s*/i,replace:'Hit Points: ',safe:true},
 {type:'format',message:'Homebrew page directive should be on its own line',pattern:/([^\n])\\page\b/,replace:'$1\n\\page',safe:true},
 {type:'format',message:'Homebrew column directive should be on its own line',pattern:/([^\n])\\column\b/,replace:'$1\n\\column',safe:true},
];

export function inspectSource(source:string):HelperIssue[]{
 const issues:HelperIssue[]=[];
 rules.forEach((rule,ri)=>{
  const flags=rule.pattern.flags.includes('g')?rule.pattern.flags:rule.pattern.flags+'g';
  const rx=new RegExp(rule.pattern.source,flags);let match:RegExpExecArray|null;
  while((match=rx.exec(source))){const before=match[0],after=before.replace(new RegExp(rule.pattern.source,rule.pattern.flags.replace('g','')),rule.replace);issues.push({id:`${ri}-${match.index}-${before}`,type:rule.type,message:rule.message,before,after,safe:rule.safe});if(!before.length)rx.lastIndex++}
 });
 const opens=(source.match(/{{/g)||[]).length,closes=(source.match(/}}/g)||[]).length;
 if(opens!==closes)issues.push({id:'unbalanced-containers',type:'format',message:`Unbalanced Homebrew containers: ${opens} opening and ${closes} closing markers.`,before:'{{ … }}',after:'Check the missing {{ or }} marker manually.',safe:false});
 const headings=source.match(/^#{1,6}[^ #].*$/gm)||[];
 headings.forEach((h,i)=>issues.push({id:`heading-space-${i}-${h}`,type:'format',message:'Add a space after the Markdown heading marks.',before:h,after:h.replace(/^(#{1,6})/,'$1 '),safe:true}));
 return issues;
}

export function applyIssue(source:string,issue:HelperIssue){return source.includes(issue.before)?source.replace(issue.before,issue.after):source}
export function applySafeIssues(source:string,issues:HelperIssue[]){return issues.filter(x=>x.safe).reduce((text,issue)=>applyIssue(text,issue),source)}
