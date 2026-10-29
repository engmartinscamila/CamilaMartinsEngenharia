import {useRouter,type Href} from 'expo-router';
import {useAdminModule} from '@/providers/admin-module-context';
export function useAdminModuleRouter(){
 const router=useRouter(),module=useAdminModule();
 const route=(href:Href,replace=false)=>{
  const pathname=typeof href==='string'?href:href.pathname;
  if(module&&pathname.startsWith('/admin/')){
   const params=typeof href==='string'?{}:Object.fromEntries(Object.entries(href.params??{}).filter(([,value])=>typeof value==='string')) as Record<string,string>;
   module.onNavigate(pathname.slice('/admin/'.length),params);return;
  }
  if(replace)router.replace(href);else router.push(href);
 };
 return {...router,push:(href:Href)=>route(href),replace:(href:Href)=>route(href,true)};
}
