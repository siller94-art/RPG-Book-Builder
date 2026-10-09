import html2canvas from'html2canvas';
import{jsPDF}from'jspdf';
import{brewPageSources,parseBrewSource,renderBrewPage,safeBrewCss}from'../source/brewSource';
export interface StyledPdfOptions{pageSize:'letter'|'a4';orientation:'portrait'|'landscape';quality:'print'|'normal'|'small'|'tiny';onOverflow?:(page:number,overflowPx:number)=>void}
const dims=(size:'letter'|'a4',orientation:'portrait'|'landscape')=>{const base=size==='a4'?[794,1123]:[816,1056];return orientation==='landscape'?[base[1],base[0]]:base};
export async function renderStyledPdf(source:string,options:StyledPdfOptions){
 const pages=brewPageSources(source),[width,height]=dims(options.pageSize,options.orientation),scale={print:2.4,normal:1.8,small:1.3,tiny:1}[options.quality],parsed=parseBrewSource(source),custom=safeBrewCss(parsed.customCss);
 const host=document.createElement('div');host.className='pdfCaptureHost';host.style.cssText='position:fixed;left:-20000px;top:0;z-index:-1;';document.body.appendChild(host);
 try{const pdf=new jsPDF({orientation:options.orientation,unit:'pt',format:options.pageSize==='a4'?'a4':'letter',compress:true});
  for(let i=0;i<pages.length;i++){const page=document.createElement('article');page.className='lockedPreview worldPagePreview pdfCapturePage '+options.pageSize+' '+options.orientation;page.style.width=width+'px';page.style.height=height+'px';page.innerHTML='<style>'+custom+'</style><div class="worldPageNumber">Page '+(i+1)+' of '+pages.length+'</div><div class="liveWorldPreview">'+renderBrewPage(pages[i])+'</div>';host.appendChild(page);
   await Promise.all([...page.querySelectorAll('img')].map(img=>img.complete?Promise.resolve():new Promise<void>(resolve=>{let settled=false;const done=()=>{if(settled)return;settled=true;clearTimeout(timeout);img.removeEventListener('load',done);img.removeEventListener('error',done);resolve()};const timeout=setTimeout(done,8000);img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true});if(img.complete)done()})));
   const preview=page.querySelector('.liveWorldPreview') as HTMLElement|null,overflow=Math.max(0,(preview?.scrollHeight||0)-(preview?.clientHeight||0));if(overflow>2)options.onOverflow?.(i+1,overflow);
   const canvas=await html2canvas(page,{backgroundColor:null,scale,useCORS:true,logging:false,imageTimeout:8000}),image=canvas.toDataURL('image/jpeg',options.quality==='print'?.96:options.quality==='normal'?.9:.82);
   if(i)pdf.addPage(options.pageSize==='a4'?'a4':'letter',options.orientation);const w=pdf.internal.pageSize.getWidth(),h=pdf.internal.pageSize.getHeight();pdf.addImage(image,'JPEG',0,0,w,h,undefined,'FAST');page.remove()}
  return new Uint8Array(pdf.output('arraybuffer'))
 }finally{host.remove()}
}
