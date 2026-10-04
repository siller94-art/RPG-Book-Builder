import type{ImageBlock}from'../model/types';
export type PhotoPreset='portrait'|'half'|'wide'|'background'|'decoration'|'chapterHero'|'sidebarPortrait'|'fullBleed'|'watermark'|'cornerArt'|'banner'|'bestiarum'|'itemSpotlight';
export interface PhotoAdvice{level:'good'|'tip'|'warning';message:string}
export const photoPresets:Record<PhotoPreset,{label:string;patch:Partial<ImageBlock>;description:string}>={
 portrait:{label:'Portrait',description:'NPC or character artwork',patch:{width:42,fit:'cover',height:360,position:'right',layer:'inline',opacity:1}},
 half:{label:'Half Page',description:'Location or scene beside lore',patch:{width:55,fit:'contain',position:'center',layer:'inline',opacity:1}},
 wide:{label:'Full Width',description:'Landscape or chapter artwork',patch:{width:100,fit:'cover',height:300,position:'center',layer:'inline',opacity:1}},
 background:{label:'Background',description:'Faded art behind page text',patch:{width:100,fit:'cover',height:700,position:'center',layer:'background',opacity:.22}},
 decoration:{label:'Decoration',description:'Crest, symbol, or small accent',patch:{width:28,fit:'contain',position:'center',layer:'inline',opacity:1}},
 chapterHero:{label:'Chapter Hero',description:'Large sourcebook chapter-opening artwork',patch:{width:92,fit:'cover',height:390,position:'center',layer:'inline',opacity:1}},
 sidebarPortrait:{label:'Lore Portrait',description:'Narrow character art beside sourcebook text',patch:{width:34,fit:'cover',height:330,position:'right',layer:'inline',opacity:1}},
 fullBleed:{label:'Full Bleed',description:'Edge-filling dramatic page artwork',patch:{width:100,fit:'cover',height:620,position:'center',layer:'inline',opacity:1}},
 watermark:{label:'Watermark',description:'Soft fantasy art behind readable lore',patch:{width:100,fit:'contain',height:620,position:'center',layer:'background',opacity:.14}},
 cornerArt:{label:'Corner Art',description:'Small decorative sourcebook illustration',patch:{width:24,fit:'contain',position:'right',layer:'inline',opacity:1}},
 banner:{label:'Chapter Banner',description:'Wide shallow art below a chapter heading',patch:{width:100,fit:'cover',height:190,position:'center',layer:'inline',opacity:1}},
 bestiarum:{label:'Bestiary Art',description:'Creature illustration sized for a stat page',patch:{width:46,fit:'contain',height:390,position:'right',layer:'inline',opacity:1}},
 itemSpotlight:{label:'Item Spotlight',description:'Magic item or relic art with surrounding lore',patch:{width:32,fit:'contain',height:300,position:'center',layer:'inline',opacity:1}}
};
export function photoAdvice(image:ImageBlock):PhotoAdvice[]{
 const a:PhotoAdvice[]=[],kb=(image.storedBytes??0)/1024;
 if(kb>2500)a.push({level:'warning',message:'Large embedded image. Consider replacing it with a smaller/compressed copy.'});
 else if(kb>1200)a.push({level:'tip',message:'This image is fairly large and may increase project/PDF size.'});
 if(image.layer==='background'&&image.opacity>.45)a.push({level:'tip',message:'Background art above 45% opacity can make lore difficult to read.'});
 if(image.layer==='background'&&image.width<90)a.push({level:'tip',message:'Background art usually works best near full-page width.'});
 if(image.fit==='cover'&&(image.height??320)<180)a.push({level:'tip',message:'A very short crop may hide important parts of the artwork.'});
 if(image.width>85&&kb>0&&kb<80)a.push({level:'warning',message:'A small source file used very wide may look blurry in print.'});
 if(!a.length)a.push({level:'good',message:'Photo settings look reasonable for a book page.'});
 return a
}
export function applyPhotoPreset(image:ImageBlock,preset:PhotoPreset):Partial<ImageBlock>{return{...photoPresets[preset].patch,focalX:image.focalX??50,focalY:image.focalY??50}}
