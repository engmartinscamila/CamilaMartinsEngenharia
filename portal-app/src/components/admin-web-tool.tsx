import React,{useEffect} from 'react';
import {Linking,Platform} from 'react-native';
import {AdminPageHeader} from '@/components/admin-ui';
import {Button,Notice,Screen} from '@/components/ui';
export function AdminWebTool({title,path}:{title:string;path:string}){
 useEffect(()=>{if(Platform.OS==='web')window.location.replace(path);},[path]);
 return <Screen><AdminPageHeader title={title} description="Ferramenta central disponível no painel web." /><Notice tone="info">O painel mantém os mesmos cadastros e solicita acesso administrativo.</Notice><Button title={'Abrir '+title} onPress={()=>void Linking.openURL('https://camilamartinsengenharia.com.br'+path)} /></Screen>;
}
