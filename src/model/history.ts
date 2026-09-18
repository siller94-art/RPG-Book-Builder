import type{Project}from'./types';import{cloneProject}from'./project';
export interface HistoryState{past:Project[];present:Project;future:Project[]}
export const createHistory=(present:Project):HistoryState=>({past:[],present,future:[]});
export function commit(h:HistoryState,next:Project):HistoryState{return{past:[...h.past.slice(-49),cloneProject(h.present)],present:next,future:[]}}
export function undo(h:HistoryState):HistoryState{const previous=h.past.at(-1);return previous?{past:h.past.slice(0,-1),present:cloneProject(previous),future:[cloneProject(h.present),...h.future]}:h}
export function redo(h:HistoryState):HistoryState{const next=h.future[0];return next?{past:[...h.past,cloneProject(h.present)],present:cloneProject(next),future:h.future.slice(1)}:h}
