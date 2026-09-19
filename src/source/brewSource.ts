export interface SourcePage{source:string;columns:string[]}
export interface ParsedSource{pages:SourcePage[]}
export function parseBrewSource(source:string):ParsedSource{
 const normalized=source.replace(/\r\n?/g,'\n');
 const rawPages=normalized.split(/^\s*(?:\\page|\\pagebreak|{{pageNumber[^}]*}})\s*$/gmi);
 return{pages:rawPages.map(raw=>({source:raw.trim(),columns:raw.split(/^\s*(?:\\column|\\columnbreak|{{column[^}]*}})\s*$/gmi).map(x=>x.trim()).filter(Boolean)})).filter(p=>p.source||p.columns.length)}
}
export function sourceToPlainText(source:string){
 return source
  .replace(/<style[\s\S]*?<\/style>/gi,'')
  .replace(/{{[^}]+}}/g,'')
  .replace(/^\s*\\(?:page|pagebreak|column|columnbreak)\s*$/gmi,'')
  .replace(/^#{1,6}\s+/gm,'')
  .replace(/\*\*([^*]+)\*\*/g,'$1')
  .replace(/\*([^*]+)\*/g,'$1')
  .replace(/__([^_]+)__/g,'$1')
  .replace(/\[([^\]]+)\]\([^\)]+\)/g,'$1')
  .trim()
}
