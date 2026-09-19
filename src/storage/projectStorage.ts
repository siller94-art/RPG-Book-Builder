import type{Project}from'../model/types';import{normalizeProject}from'../model/project';
const KEY='rpg-book-builder.autosave.v1',BACKUP='rpg-book-builder.backup.v1';
export function autosave(project:Project){try{const previous=localStorage.getItem(KEY);if(previous)localStorage.setItem(BACKUP,previous);localStorage.setItem(KEY,JSON.stringify({...project,updatedAt:new Date().toISOString()}))}catch(e){console.warn('Autosave failed',e)}}
export function loadAutosave():Project|null{for(const key of[KEY,BACKUP])try{const raw=localStorage.getItem(key);if(raw)return normalizeProject(JSON.parse(raw))}catch{}return null}
export function loadBackup():Project|null{try{const raw=localStorage.getItem(BACKUP);return raw?normalizeProject(JSON.parse(raw)):null}catch{return null}}
export function clearRecovery(){localStorage.removeItem(KEY);localStorage.removeItem(BACKUP)}
export function serializeProject(project:Project){return JSON.stringify(project,null,2)}
export function parseProject(raw:string){return normalizeProject(JSON.parse(raw))}
