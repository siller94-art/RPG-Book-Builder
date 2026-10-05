export interface SourcePage{source:string;columns:string[]}
export interface ParsedSource{pages:SourcePage[];customCss:string}
export function parseBrewSource(source:string):ParsedSource{
 const normalized=source.replace(/\r\n?/g,'\n');
 const customCss=[...normalized.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join('\n');
 const sourceWithoutCss=normalized.replace(/<style[^>]*>[\s\S]*?<\/style>/gi,'').trim();
 const rawPages=sourceWithoutCss.split(/^\s*(?:\\page|\\pagebreak|{{pageNumber[^}]*}})\s*$/gmi);
 const pages=rawPages.map(raw=>{
  const source=raw.trim();
  const columns=source.split(/^\s*(?:\\column|\\columnbreak|{{column[^}]*}})\s*$/gmi).map(x=>x.trim());
  return{source,columns:columns.length>1?columns:source?[source]:[]};
 });
 // Preserve pages created by explicit page directives, including intentionally empty pages.
 return{pages,customCss}
}
const esc=(s:string)=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
const inline=(s:string)=>esc(s).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/__([^_]+)__/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>').replace(/\[([^\]]+)\]\(((?:https?:\/\/[^\s)]+)|(?:data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+))\)/g,'<a href="$2">$1</a>');
export function safeBrewCss(css:string){return css.split('}').map(rule=>{const [sel,body]=rule.split('{');if(!body)return'';const safeSel=(sel||'').trim();if(!/^(?:\.brew[-\w ]*|h[1-6]|p|blockquote|table|th|td)(?:[.#:>+~\w\s-]*)$/.test(safeSel))return'';const declarations=body.split(';').map(d=>d.trim()).filter(d=>/^(?:color|background(?:-color)?|font-(?:size|weight|style)|text-align|border(?:-[\w-]+)?|padding(?:-[\w-]+)?|margin(?:-[\w-]+)?|width|max-width|min-height|column-count|column-gap)\s*:/i.test(d)&&!/(url\s*\(|expression\s*\(|javascript:|@import)/i.test(d));return declarations.length?safeSel+'{'+declarations.join(';')+'}':''}).filter(Boolean).join('\n')}
function expandContainers(source:string){return source.replace(/{{\s*(note|descriptive|monster|statblock|wide|columns?)\s*\n([\s\S]*?)\n}}/gi,(_m,type,body)=>':::BREW:'+String(type).toLowerCase()+'\n'+body+'\n:::END')}
export function maskEmbeddedImages(source:string){
 let index=0;
 return source.replace(/!\[([^\]]*)\]\((data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+)\)/gi,(_m,alt)=>`![${alt}](embedded-image:${++index})`)
}
export function restoreEmbeddedImages(edited:string,original:string){
 const images=[...original.matchAll(/!\[([^\]]*)\]\((data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+)\)/gi)].map(m=>m[2]);
 return edited.replace(/embedded-image:(\d+)/gi,(_m,n)=>images[Number(n)-1]||_m)
}
export function brewPageSources(source:string){
 const normalized=source.replace(/\r\n?/g,'\n');
 return normalized.split(/^\s*(?:\\page|\\pagebreak|{{pageNumber[^}]*}})\s*$/gmi)
}
export const TOC_MARKER='<!-- RPG-BOOK-BUILDER:TOC -->';
export function hasTableOfContents(source:string){return source.includes(TOC_MARKER)}
function tocPage(source:string){
 const pages=brewPageSources(source);
 const rows:string[]=[];
 pages.forEach((page,index)=>{
  if(page.includes(TOC_MARKER))return;
  const title=(page.match(/^#\s+(.+)$/m)?.[1]||('Page '+(index+1))).trim();
  rows.push('| '+(rows.length+1)+' | **'+title.replace(/\|/g,'\\|')+'** | '+(index+1)+' |');
  for(const h of page.matchAll(/^##\s+(.+)$/gm))rows.push('|  | '+h[1].trim().replace(/\|/g,'\\|')+' | '+(index+1)+' |')
 });
 return '# Contents\n\n'+TOC_MARKER+'\n\n| Part | Chapter | Page |\n|:--|:--|--:|\n'+rows.join('\n')
}
export function syncTableOfContents(source:string){
 if(!hasTableOfContents(source))return source;
 const pages=brewPageSources(source),index=pages.findIndex(p=>p.includes(TOC_MARKER));
 if(index<0)return source;
 pages[index]=tocPage(source);
 return pages.join('\n\\page\n')
}
export function insertTableOfContents(source:string){
 if(hasTableOfContents(source))return syncTableOfContents(source);
 const pages=brewPageSources(source),at=pages.length>1?1:0;
 pages.splice(at,0,'# Contents\n\n'+TOC_MARKER);
 const seeded=pages.join('\n\\page\n');
 return syncTableOfContents(seeded)
}
export function renderBrewPage(source:string){
 const parsed=parseBrewSource(source);
 const page=parsed.pages[0];
 if(!page)return'';
 if(page.columns.length>1){
  return '<div class="brew-columns">'+page.columns.map((column,index)=>'<section class="brew-column" data-column="'+(index+1)+'">'+renderBrewMarkdown(column)+'</section>').join('')+'</div>'
 }
 return renderBrewMarkdown(page.source)
}
export function renderBrewMarkdown(source:string){
 const lines=expandContainers(source.replace(/<style[\s\S]*?<\/style>/gi,'')).split(/\n/),out:string[]=[];let list=false,quote=false,table=false,container='';
 const close=()=>{if(list){out.push('</ul>');list=false}if(quote){out.push('</blockquote>');quote=false}if(table){out.push('</tbody></table>');table=false}};
 for(let i=0;i<lines.length;i++){const raw=lines[i],s=raw.trim();
  if(/^:::BREW:/.test(s)){close();container=s.slice(8);out.push('<div class="brew-snippet '+container+'">');continue}if(s===':::END'){close();if(container)out.push('</div>');container='';continue}
  if(!s||/^<!--.*-->$/.test(s)){close();continue}
  if(/^\\(?:column|columnbreak)$/i.test(s)){close();out.push('<div class="brew-column-break" aria-hidden="true"></div>');continue}
  const h=s.match(/^(#{1,6})\s+(.+)$/);if(h){close();out.push('<h'+h[1].length+'>'+inline(h[2])+'</h'+h[1].length+'>');continue}
  if(/^___+$/.test(s)){close();out.push('<hr>');continue}
  if(/^>/.test(s)){if(!quote){close();quote=true;out.push('<blockquote class="brew-note">')}out.push('<p>'+inline(s.replace(/^>\s?/,''))+'</p>');continue}
  if(/^[-*]\s+/.test(s)){if(!list){close();list=true;out.push('<ul>')}out.push('<li>'+inline(s.replace(/^[-*]\s+/,''))+'</li>');continue}
  if(s.includes('|')&&i+1<lines.length&&/^\s*\|?\s*:?-+/.test(lines[i+1])){close();const heads=s.replace(/^\||\|$/g,'').split('|');out.push('<table><thead><tr>'+heads.map(x=>'<th>'+inline(x.trim())+'</th>').join('')+'</tr></thead><tbody>');table=true;i++;continue}
  if(table&&s.includes('|')){const cells=s.replace(/^\||\|$/g,'').split('|');out.push('<tr>'+cells.map(x=>'<td>'+inline(x.trim())+'</td>').join('')+'</tr>');continue}
  const img=s.match(/^!\[([^\]]*)\]\(((?:https?:\/\/[^\s)]+)|(?:data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+))(?:\s+\"([^\"]*)\")?\)(?:\s*\{([^}]*)\})?$/i);if(img){close();const opts=img[4]||'',w=(opts.match(/(?:width|w)\s*[:=]\s*(\d{1,3})%?/i)||[])[1],pos=(opts.match(/(?:position|pos)\s*[:=]\s*(left|center|right)/i)||[])[1]||'center';out.push('<figure class="brew-image '+pos+'"><img src="'+img[2]+'" alt="'+esc(img[1])+'"'+(w?' style="width:'+Math.min(100,Number(w))+'%"':'')+'>'+(img[3]?'<figcaption>'+inline(img[3])+'</figcaption>':'')+'</figure>');continue}
  const box=s.match(/^{{\s*(note|descriptive|monster|statblock|wide|columns?)\s*,?\s*(.*?)\s*}}$/i);if(box){close();out.push('<div class="brew-snippet '+box[1].toLowerCase()+'">'+inline(box[2])+'</div>');continue}
  close();out.push('<p>'+inline(s)+'</p>')
 }close();return out.join('\n')
}
export function sourceToPlainText(source:string){
 return source.replace(/<style[\s\S]*?<\/style>/gi,'').replace(/^\s*{{\s*(?:note|descriptive|monster|statblock|wide|columns?)\s*$/gmi,'').replace(/^\s*}}\s*$/gmi,'').replace(/{{[^}]+}}/g,'').replace(/^\s*\\(?:page|pagebreak|column|columnbreak)\s*$/gmi,'').replace(/^#{1,6}\s+/gm,'').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/\*([^*]+)\*/g,'$1').replace(/__([^_]+)__/g,'$1').replace(/\[([^\]]+)\]\([^\)]+\)/g,'$1').trim()
}


export function projectTextToMarkdown(pages:{name:string;blocks:{kind:string;title:string;body?:string;style?:string;columns?:number}[]}[]){
 const out:string[]=[];
 for(const page of pages){
  if(pages.length>1)out.push('# '+page.name);
  for(const b of page.blocks){
   if(b.kind!=='text'&&b.kind!=='statblock')continue;
   const body=b.body??'';
   if(b.columns===2)out.push('\\column');
   if(b.style==='heading')out.push('## '+(b.title||body||'Section'));
   else if(b.style==='note')out.push('> **'+(b.title||'Note')+'**\n> '+body.replace(/\n/g,'\n> '));
   else if(b.style==='table')out.push('## '+(b.title||'Table')+'\n\n'+body);
   else out.push((b.title?'## '+b.title+'\n\n':'')+body);
  }
  if(pages.length>1&&page!==pages[pages.length-1])out.push('\\page');
 }
 return out.join('\n\n').replace(/\n{3,}/g,'\n\n').trim();
}
export function markdownToTextSections(source:string){
 const sections:{title:string;body:string;style:'body'|'heading'|'note'|'table';columns:1|2}[]=[];
 const lines=source.replace(/\r\n?/g,'\n').split('\n');let title='';let body:string[]=[];let columns:1|2=1,inContainer=false;
 let forcedStyle:'body'|'heading'|'note'|'table'='body';
 const flush=()=>{const text=body.join('\n').trim();if(title||text){const style=forcedStyle!=='body'?forcedStyle:text.includes('|')&&/^\s*[-:| ]+$/m.test(text)?'table':'body';sections.push({title:title||'New Section',body:text,style,columns})}title='';body=[];forcedStyle='body';columns=1};
 for(const line of lines){
  if(/^\s*\\(?:page|pagebreak)\s*$/i.test(line)){flush();continue}
  if(/^\s*\\(?:column|columnbreak)\s*$/i.test(line)){flush();columns=2;continue}
  const container=line.match(/^\s*{{\s*(note|descriptive)\s*$/i);
  if(container){flush();forcedStyle='note';inContainer=true;title=container[1].toLowerCase()==='descriptive'?'Descriptive':'Note';continue}
  if(/^\s*}}\s*$/.test(line)&&inContainer){flush();inContainer=false;continue}
  const h=line.match(/^#{1,6}\s+(.+)$/);
  if(h&&inContainer){body.push(line);continue}
  if(h){const nextColumns:1|2=columns;flush();columns=nextColumns;title=h[1].trim();forcedStyle='heading';continue}
  if(/^>\s?/.test(line)){if(forcedStyle==='body')forcedStyle='note';body.push(line.replace(/^>\s?/,''));continue}
  body.push(line)
 }
 flush();return sections;
}


export function markdownToProjectPages(source:string){
 const rawPages=source.replace(/\r\n?/g,'\n').split(/^\s*\\(?:page|pagebreak)\s*$/gmi);
 const pages=rawPages.map((raw,index)=>{
  const lines=raw.trim().split('\n');
  let name='Page '+(index+1);
  if(/^#\s+/.test(lines[0]||''))name=lines.shift()!.replace(/^#\s+/,'').trim()||name;
  return{name,sections:markdownToTextSections(lines.join('\n'))};
 });
 // Preserve explicit \\page commands even when the newly-created page is still empty.
 return pages.length?pages:[{name:'Page 1',sections:[]}];
}
