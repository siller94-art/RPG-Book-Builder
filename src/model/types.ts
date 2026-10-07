export type BlockKind='text'|'image'|'statblock';
export type StatblockKind='monster'|'npc'|'spell'|'item'|'vehicle'|'trap'|'encounter'|'custom';

export interface BaseBlock{id:string;kind:BlockKind;title:string;width?:number;spacing?:number;titleColor?:string;borderColor?:string;lineColor?:string;}
export interface TextBlock extends BaseBlock{kind:'text';body:string;columns:1|2;style?:'body'|'heading'|'note'|'table';align?:'left'|'center'|'right';fontSize?:number;color?:string;}
export interface ImageStamp{id:string;assetId:string;glyph:string;size:number;opacity:number;rotation:number;x:number;y:number;layer:'front'|'back';}
export type ImageStyle='standard'|'watercolor'|'transparent-cutout';
export interface ImageBlock extends BaseBlock{kind:'image';src:string;originalSrc?:string;alt:string;fit:'contain'|'cover';opacity:number;width:number;position:'left'|'center'|'right';layer:'inline'|'background';imageStyle?:ImageStyle;watercolorFeather?:number;focalX?:number;focalY?:number;height?:number;originalBytes?:number;storedBytes?:number;stamps?:ImageStamp[];}

export type StatFields=Record<string,string>;
export interface StatEntry{id:string;name:string;text:string;}
export type StatSections=Record<string,StatEntry[]>;
export interface StatblockBlock extends BaseBlock{kind:'statblock';template:StatblockKind;body:string;fields:StatFields;sections?:StatSections;textColor?:string;backgroundColor?:string;accentColor?:string;}
export type DocumentBlock=TextBlock|ImageBlock|StatblockBlock;

export interface Page{id:string;name:string;blocks:DocumentBlock[];isTitlePage?:boolean;}
export interface ProjectSettings{pageSize:'letter'|'a4';orientation:'portrait'|'landscape';themeId:string;pageColor?:string;pageTextColor?:string;headingColor?:string;ruleColor?:string;}
export interface MapPin{id:number;x:number;y:number;label:string;}
export interface MapWorkspace{name:string;notes:string;image:string;pins:MapPin[];}
export interface TimelineEvent{date:string;title:string;text:string;}
export interface BoardCard{title:string;text:string;status?:string;}
export interface WorldToolsData{maps:MapWorkspace;timeline:TimelineEvent[];boards:BoardCard[];}
export type CreatorKind='characters'|'items'|'spells'|'monsters';
export interface CreatorEntry{id:string;kind:CreatorKind;data:Record<string,string>;}
export interface Project{schemaVersion:1;id:string;title:string;pages:Page[];activePageId:string;settings:ProjectSettings;updatedAt:string;brewSource?:string;worldTools?:WorldToolsData;creatorLibrary?:CreatorEntry[];}
