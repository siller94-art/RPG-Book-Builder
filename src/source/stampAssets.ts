export type StampKind='seal'|'wave'|'crown'|'compass'|'sun'|'ink'|'tear'|'burn';
export interface StampAsset{id:string;name:string;kind:StampKind;glyph:string;category:'Stamps & Seals'|'Page Effects'|'Decorative'}
export interface StampPlacement{assetId:string;size:number;opacity:number;rotation:number;x:number;y:number;layer:'front'|'back'}
export const stampAssets:StampAsset[]=[
{id:'seal',name:'Wax Seal',kind:'seal',glyph:'✦',category:'Stamps & Seals'},
{id:'wave',name:'Ocean Waves',kind:'wave',glyph:'≋',category:'Stamps & Seals'},
{id:'crown',name:'Royal Crown',kind:'crown',glyph:'♛',category:'Stamps & Seals'},
{id:'compass',name:'Compass',kind:'compass',glyph:'✥',category:'Decorative'},
{id:'sun',name:'Sun Mark',kind:'sun',glyph:'☀',category:'Decorative'},
{id:'ink',name:'Ink Mark',kind:'ink',glyph:'●',category:'Page Effects'},
{id:'tear',name:'Paper Tear',kind:'tear',glyph:'〰',category:'Page Effects'},
{id:'burn',name:'Burn Mark',kind:'burn',glyph:'◉',category:'Page Effects'}];
export function createStampPlacement(assetId:string):StampPlacement{return{assetId,size:120,opacity:.8,rotation:-8,x:78,y:12,layer:'front'}}
export function clampStamp(p:StampPlacement):StampPlacement{return{...p,size:Math.min(400,Math.max(24,p.size)),opacity:Math.min(1,Math.max(.05,p.opacity)),rotation:Math.min(180,Math.max(-180,p.rotation)),x:Math.min(100,Math.max(0,p.x)),y:Math.min(100,Math.max(0,p.y))}}
