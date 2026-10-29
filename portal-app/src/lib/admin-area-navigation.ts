import definitions from './admin-areas.json';
export type AdminAreaKey=keyof typeof definitions;
export interface AdminAreaView {key:string;label:string;module:string;subview?:string;project?:boolean;scope?:boolean}
export interface AdminAreaGroup {key:string;label:string;views:AdminAreaView[]}
export interface AdminAreaDefinition {title:string;description:string;groups:AdminAreaGroup[]}
export const adminAreas:Record<AdminAreaKey,AdminAreaDefinition>=definitions;
export function adminAreaForModule(module:string){
 if(module==='workspace')return null;
 for(const area of ['client-center','asset-center','finance-center','relationship-center','settings-center','works-center'] as AdminAreaKey[]){
  const definition=adminAreas[area];
  for(const group of definition.groups){const view=group.views.find(item=>item.module===module);if(view)return {area:area as AdminAreaKey,view:view.key};}
 }
 return null;
}
