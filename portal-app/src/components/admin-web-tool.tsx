import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Linking,Platform,View} from 'react-native';
import {useLocalSearchParams} from 'expo-router';
import {AdminPageHeader} from '@/components/admin-ui';
import {Button,Notice,Screen} from '@/components/ui';
import {useAdminModule} from '@/providers/admin-module-context';
const modules:Record<string,string>={
 '/clientes.html':'clients','/projetos.html':'projects','/documentos.html':'documents','/biblioteca.html':'documents','/fotos.html':'photos',
 '/recibos.html':'receipts','/agenda.html':'agenda','/solicitacoes.html':'requests','/cronograma.html':'schedule',
 '/configuracoes.html':'settings','/integridade-sistema.html':'system-health','/protecao-pdf-admin.html':'website-content',
};
export function AdminWebTool({title,path}:{title:string;path:string}){
 const embedded=useAdminModule(),params=useLocalSearchParams<{financialId?:string;clientId?:string;novo?:string;visao?:string;foto?:string}>();
 const [ready,setReady]=useState(false),[failed,setFailed]=useState(false);
 const iframe=useRef<HTMLIFrameElement|null>(null);
 const query=new URLSearchParams();
 if(embedded?.projectId)query.set('projectId',embedded.projectId);
 const contextParams=embedded?.params??params;
 for(const name of ['financialId','clientId','novo','visao','foto'] as const){const value=contextParams[name];if(typeof value==='string')query.set(name,value);}
 const fullPath=path+(query.size?'?'+query:'');
 useEffect(()=>{if(Platform.OS==='web'&&!embedded)window.location.replace(fullPath);},[embedded,fullPath]);
 const loaded=()=>{
  const frame=iframe.current;
  try{
   if(!frame?.contentWindow||!frame.contentDocument)return;
   const url=new URL(frame.contentWindow.location.href);
   if(url.origin!==location.origin)throw new Error('Origem não permitida');
   if(url.pathname!==path&&modules[url.pathname]){
    const values=Object.fromEntries([...url.searchParams.entries()].filter(([key])=>['projectId','financialId','clientId','novo','visao','foto'].includes(key)));
    embedded?.onNavigate(modules[url.pathname]!,values);frame.src=fullPath;return;
   }
   const doc=frame.contentDocument,style=doc.createElement('style');
   style.textContent='.layout .sidebar,#cmeAdminMobileMenuButton,#cmeAdminMobileMenuOverlay{display:none!important}.layout .conteudo{margin-left:0!important;width:100%!important;min-width:0!important;padding:16px!important}.layout .topbar>div:first-child{display:none}.layout .topbar{justify-content:flex-end;margin-bottom:16px}html,body{max-width:100%;overflow-x:hidden}';
   doc.head.appendChild(style);
   doc.querySelectorAll<HTMLElement>('.layout .sidebar,#cmeAdminMobileMenuButton,#cmeAdminMobileMenuOverlay').forEach(node=>node.style.setProperty('display','none','important'));
   doc.querySelectorAll<HTMLElement>('.layout .conteudo').forEach(node=>{for(const [key,value] of Object.entries({'margin-left':'0',width:'100%','min-width':'0',padding:'16px'}))node.style.setProperty(key,value,'important');});
   doc.addEventListener('click',event=>{
    const anchor=(event.target as Element)?.closest?.('a[href]') as HTMLAnchorElement|null;
    if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download'))return;
    const target=new URL(anchor.href);
    if(target.origin!==location.origin||!modules[target.pathname])return;
    event.preventDefault();embedded?.onNavigate(modules[target.pathname]!,Object.fromEntries([...target.searchParams.entries()].filter(([key])=>['projectId','financialId','clientId','novo','visao','foto'].includes(key))));
   });
   setReady(true);setFailed(false);
  }catch{setFailed(true);setReady(false);}
 };
 if(Platform.OS==='web'&&embedded)return <View style={{flex:1,minHeight:300}}>
  {!ready&&!failed?<ActivityIndicator accessibilityLabel="Carregando ferramenta integrada" />:null}
  {failed?<Notice tone="warning">Não foi possível abrir esta ferramenta dentro da área. Você pode abri-la em uma página própria.</Notice>:null}
  {React.createElement('iframe',{ref:iframe,src:fullPath,title,onLoad:loaded,onError:()=>setFailed(true),style:{flex:1,width:'100%',height:'100%',minHeight:300,border:0,opacity:ready?1:0}})}
  {failed?<Button title={'Abrir '+title} onPress={()=>window.location.assign(fullPath)} />:null}
 </View>;
 return <Screen><AdminPageHeader title={title} description="Ferramenta central disponível no painel web." /><Notice tone="info">O painel mantém os mesmos cadastros e solicita acesso administrativo.</Notice><Button title={'Abrir '+title} onPress={()=>void Linking.openURL('https://camilamartinsengenharia.com.br'+fullPath)} /></Screen>;
}
