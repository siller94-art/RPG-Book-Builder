export type ContentKind = "character" | "npc" | "monster" | "item" | "spell" | "feat" | "species" | "background" | "class" | "handout";
export interface ImageAsset{id:string;name:string;dataUrl:string;alt?:string}
export interface ContentEntry{id:string;kind:ContentKind;name:string;source:"custom"|"srd";description:string;image?:ImageAsset;createdAt:string;updatedAt:string}
export interface AbilityScores{str:number;dex:number;con:number;int:number;wis:number;cha:number}
export type ProficiencyLevel=0|1|2;
export interface Attack{name:string;bonus:string;damage:string;notes:string}
export interface InventoryItem{name:string;quantity:number;notes:string}
export interface Feature{name:string;description:string}
export interface SpellEntry{name:string;level:number;prepared:boolean;notes:string}
export interface Character extends ContentEntry{kind:"character";level:number;className:string;speciesName:string;backgroundName:string;abilities:AbilityScores;maxHp:number;currentHp:number;tempHp:number;armorClass:number;proficiencyBonus:number;speed:number;initiativeBonus:number;hitDice:string;inspiration:boolean;savingThrows:Partial<Record<keyof AbilityScores,ProficiencyLevel>>;skills:Record<string,ProficiencyLevel>;attacks:Attack[];inventory:InventoryItem[];features:Feature[];spells:SpellEntry[];currency:{cp:number;sp:number;ep:number;gp:number;pp:number};languages:string;senses:string;conditions:string;notes:string;customFields:Record<string,string>}
export interface CampaignProject{schemaVersion:1;name:string;entries:ContentEntry[]}