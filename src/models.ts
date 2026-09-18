export type ContentKind = "character" | "npc" | "monster" | "item" | "spell" | "feat" | "species" | "background" | "class" | "handout";

export interface ImageAsset {
  id: string;
  name: string;
  dataUrl: string;
  alt?: string;
}

export interface ContentEntry {
  id: string;
  kind: ContentKind;
  name: string;
  source: "custom" | "srd";
  description: string;
  image?: ImageAsset;
  createdAt: string;
  updatedAt: string;
}

export interface AbilityScores {
  str: number; dex: number; con: number; int: number; wis: number; cha: number;
}

export interface Character extends ContentEntry {
  kind: "character";
  level: number;
  className: string;
  speciesName: string;
  backgroundName: string;
  abilities: AbilityScores;
  maxHp: number;
  armorClass: number;
  proficiencyBonus: number;
  notes: string;
  customFields: Record<string, string>;
}

export interface CampaignProject {
  schemaVersion: 1;
  name: string;
  entries: ContentEntry[];
}
