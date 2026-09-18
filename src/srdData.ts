import type{DmEntry}from"./models";
const now="2026-09-18T00:00:00.000Z";const e=(id:string,kind:DmEntry["kind"],name:string,subtitle:string,description:string,rules:string):DmEntry=>({id:"srd-"+id,kind,name,source:"srd",subtitle,description,rules,tags:["SRD","Open Content"],createdAt:now,updatedAt:now});
export const starterSrd:DmEntry[]=[
e("spell-guidance","spell","Guidance","Cantrip","You touch one willing creature and bolster an ability check.","Use the applicable SRD wording/rules in your licensed distribution. This starter record intentionally stores a short summary rather than full rules text."),
e("item-club","item","Club","Simple melee weapon","A basic light bludgeoning weapon.","Damage: 1d4 bludgeoning. Properties: Light."),
e("monster-skeleton","monster","Skeleton","Medium undead","An animated skeleton suitable as a basic undead opponent.","Starter SRD reference. Add licensed stat details from the SRD data source."),
e("background-custom","background","Custom Background","Background template","A blank open-content-friendly background template.","Choose appropriate proficiencies, equipment, and narrative details.")
];