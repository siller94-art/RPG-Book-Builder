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
 }).filter(p=>p.source||p.columns.some(Boolean));
 return{pages,customCss}
}
const esc=(s:string)=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
const inline=(s:string)=>esc(s).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/__([^_]+)__/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>').replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2">$1</a>');
export function safeBrewCss(css:string){return css.split('}').map(rule=>{const [sel,body]=rule.split('{');if(!body)return'';const safeSel=(sel||'').trim();if(!/^(?:\.brew[-\\w ]*|h[1-6]|p|blockquote|table|th|td)(?:[.#:>+~\\w\\s-]*)$/.test(safeSel))return'';const declarations=body.split(';').map(d=>d.trim()).filter(d=>/^(?:color|background(?:-color)?|font-(?:size|weight|style)|text-align|border(?:-[\\w-]+)?|padding(?:-[\\w-]+)?|margin(?:-[\\w-]+)?|width|max-width|min-height|column-count|column-gap)\s*:/i.test(d)&&!/(url\s*\(|expression\s*\(|javascript:|@import)/i.test(d));return declarations.length?safeSel+'{'+declarations.join(';')+'}':''}).filter(Boolean).join('\n')}
function expandContainers(source:string){return source.replace(/{{\s*(note|descriptive|monster|statblock|wide|columns?)\s*\n([\s\S]*?)\n}}/gi,(_m,type,body)=>':::BREW:'+String(type).toLowerCase()+'\n'+body+'\n:::END')}
export function renderBrewMarkdown(source:string){
 const lines=expandContainers(source.replace(/<style[\s\S]*?<\/style>/gi,'')).split(/\n/),out:string[]=[];let list=false,quote=false,table=false,container='';
 const close=()=>{if(list){out.push('</ul>');list=false}if(quote){out.push('</blockquote>');quote=false}if(table){out.push('</tbody></table>');table=false}};
 for(let i=0;i<lines.length;i++){const raw=lines[i],s=raw.trim();
  if(/^:::BREW:/.test(s)){close();container=s.slice(8);out.push('<div class="brew-snippet '+container+'">');continue}if(s===':::END'){close();if(container)out.push('</div>');container='';continue}
  if(!s){close();continue}
  const h=s.match(/^(#{1,6})\s+(.+)$/);if(h){close();out.push('<h'+h[1].length+'>'+inline(h[2])+'</h'+h[1].length+'>');continue}
  if(/^___+$/.test(s)){close();out.push('<hr>');continue}
  if(/^>/.test(s)){if(!quote){close();quote=true;out.push('<blockquote class="brew-note">')}out.push('<p>'+inline(s.replace(/^>\s?/,''))+'</p>');continue}
  if(/^[-*]\s+/.test(s)){if(!list){close();list=true;out.push('<ul>')}out.push('<li>'+inline(s.replace(/^[-*]\s+/,''))+'</li>');continue}
  if(s.includes('|')&&i+1<lines.length&&/^\s*\|?\s*:?-+/.test(lines[i+1])){close();const heads=s.replace(/^\||\|$/g,'').split('|');out.push('<table><thead><tr>'+heads.map(x=>'<th>'+inline(x.trim())+'</th>').join('')+'</tr></thead><tbody>');table=true;i++;continue}
  if(table&&s.includes('|')){const cells=s.replace(/^\||\|$/g,'').split('|');out.push('<tr>'+cells.map(x=>'<td>'+inline(x.trim())+'</td>').join('')+'</tr>');continue}
  const img=s.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)(?:\s+\"([^\"]*)\")?\)(?:\s*\{([^}]*)\})?$/i);if(img){close();const opts=img[4]||'',w=(opts.match(/(?:width|w)\s*[:=]\s*(\d{1,3})%?/i)||[])[1],pos=(opts.match(/(?:position|pos)\s*[:=]\s*(left|center|right)/i)||[])[1]||'center';out.push('<figure class="brew-image '+pos+'"><img src="'+img[2]+'" alt="'+esc(img[1])+'"'+(w?' style="width:'+Math.min(100,Number(w))+'%"':'')+'>'+(img[3]?'<figcaption>'+inline(img[3])+'</figcaption>':'')+'</figure>');continue}
  const box=s.match(/^{{\s*(note|descriptive|monster|statblock|wide|columns?)\s*,?\s*(.*?)\s*}}$/i);if(box){close();out.push('<div class="brew-snippet '+box[1].toLowerCase()+'">'+inline(box[2])+'</div>');continue}
  close();out.push('<p>'+inline(s)+'</p>')
 }close();return out.join('\n')
}
export function sourceToPlainText(source:string){
 return source.replace(/<style[\s\S]*?<\/style>/gi,'').replace(/{{[^}]+}}/g,'').replace(/^\s*\\(?:page|pagebreak|column|columnbreak)\s*$/gmi,'').replace(/^#{1,6}\s+/gm,'').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/\*([^*]+)\*/g,'$1').replace(/__([^_]+)__/g,'$1').replace(/\[([^\]]+)\]\([^\)]+\)/g,'$1').trim()
}
