import type{Project}from'../model/types';import{normalizeProject}from'../model/project';
const KEY='rpg-book-builder.autosave.v1';
export function autosave(project:Project){localStorage.setItem(KEY,JSON.stringify({...project,updatedAt:new Date().toISOString()}))}
export function loadAutosave():Project|null{try{const raw=localStorage.getItem(KEY);return raw?normalizeProject(JSON.parse(raw)):null}catch{return null}}
export function serializeProject(project:Project){return JSON.stringify(project,null,2)}
export function parseProject(raw:string){return normalizeProject(JSON.parse(raw))}
