import type{Project}from'../model/types';import{normalizeProject}from'../model/project';
const KEY='rpg-book-builder.autosave.v1',BACKUP='rpg-book-builder.backup.v1',SNAPSHOTS='rpg-book-builder.snapshots.v1';
export interface RecoverySnapshot{createdAt:string;project:Project}
function readSnapshots():RecoverySnapshot[]{try{const v=JSON.parse(localStorage.getItem(SNAPSHOTS)||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
// Browser storage is small (about 5 MB) and books keep their artwork inline, so a book with a
// few images can fill it. The current book always wins: if writing fails, older copies are
// dropped and the write is retried once. Returns false when even that fails, so the app can
// tell the person their work is not being autosaved.
export function autosave(project:Project):boolean{
 const data=JSON.stringify({...project,updatedAt:new Date().toISOString()});
 try{const previous=localStorage.getItem(KEY);if(previous){try{localStorage.setItem(BACKUP,previous)}catch{localStorage.removeItem(BACKUP)}}localStorage.setItem(KEY,data);return true}
 catch{try{localStorage.removeItem(SNAPSHOTS);localStorage.removeItem(BACKUP);localStorage.setItem(KEY,data);return true}catch(e){console.warn('Autosave failed',e);return false}}
}
export function createRecoverySnapshot(project:Project):boolean{try{const snapshots=readSnapshots(),now=Date.now(),last=snapshots[0];if(last&&now-new Date(last.createdAt).getTime()<5*60*1000)return true;const next=[{createdAt:new Date(now).toISOString(),project:structuredClone(project)},...snapshots].slice(0,5);localStorage.setItem(SNAPSHOTS,JSON.stringify(next));return true}catch(e){console.warn('Recovery snapshot failed',e);return false}}
export function listRecoverySnapshots(){return readSnapshots()}
export function loadAutosave():Project|null{for(const key of[KEY,BACKUP])try{const raw=localStorage.getItem(key);if(raw)return normalizeProject(JSON.parse(raw))}catch{}return null}
export function loadBackup():Project|null{try{const raw=localStorage.getItem(BACKUP);return raw?normalizeProject(JSON.parse(raw)):null}catch{return null}}
export function clearRecovery(){localStorage.removeItem(KEY);localStorage.removeItem(BACKUP);localStorage.removeItem(SNAPSHOTS)}
export function serializeProject(project:Project){return JSON.stringify(project,null,2)}
export function parseProject(raw:string){if(raw.length>150*1024*1024)throw new Error('Project file is too large');return normalizeProject(JSON.parse(raw))}
