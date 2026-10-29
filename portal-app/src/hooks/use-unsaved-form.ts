import {useEffect} from 'react';
import {Platform} from 'react-native';
/** Browser refresh/close protection; form values are never copied to persistent storage. */
export function useUnsavedForm(dirty:boolean){
 useEffect(()=>{
  if(Platform.OS!=='web'||!dirty)return;
  const handler=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
  window.addEventListener('beforeunload',handler);
  return ()=>window.removeEventListener('beforeunload',handler);
 },[dirty]);
}
