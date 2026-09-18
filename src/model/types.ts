export type BlockKind='text'|'image'|'statblock';
export type StatblockKind='monster'|'npc'|'spell'|'item'|'vehicle'|'trap'|'encounter'|'custom';
export interface BaseBlock{id:string;kind:BlockKind;title:string;}
export interface TextBlock extends BaseBlock{kind:'text';body:string;columns:1|2;}
export interface ImageBlock extends BaseBlock{kind:'image';src:string;alt:string;fit:'contain'|'cover';opacity:number;}
export interface StatblockBlock extends BaseBlock{kind:'statblock';template:StatblockKind;body:string;}
export type DocumentBlock=TextBlock|ImageBlock|StatblockBlock;
export interface Page{id:string;name:string;blocks:DocumentBlock[];}
export interface ProjectSettings{pageSize:'letter'|'a4';themeId:string;}
export interface Project{schemaVersion:1;id:string;title:string;pages:Page[];activePageId:string;settings:ProjectSettings;updatedAt:string;}
