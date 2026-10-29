import React,{createContext,useCallback,useContext,useState} from 'react';
export interface AdminModuleContextValue {
 projectId:string|null;subview?:string;module:string;params?:Record<string,string>;
 onProjectChange:(id:string|null)=>void;
 onNavigate:(module:string,params?:Record<string,string>)=>void;
}
const Context=createContext<AdminModuleContextValue|null>(null);
export const AdminModuleProvider=Context.Provider;
export const useAdminModule=()=>useContext(Context);
export function useAdminProjectSelection(initial:string|null=null):[string|null,React.Dispatch<React.SetStateAction<string|null>>]{
 const context=useAdminModule();const [local,setLocal]=useState(initial);
 const select=useCallback<React.Dispatch<React.SetStateAction<string|null>>>(value=>{
  if(!context){setLocal(value);return;}
  if(typeof value==='function')return;
  if(value!==context.projectId)context.onProjectChange(value);
 },[context]);
 return context?[context.projectId,select]:[local,setLocal];
}
