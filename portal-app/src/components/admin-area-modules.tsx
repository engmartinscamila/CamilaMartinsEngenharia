import React from 'react';
import {Platform} from 'react-native';
import {AdminWebTool} from './admin-web-tool';
import Clients from '@/app/admin/clients';
import Projects from '@/app/admin/projects';
import Content from '@/app/admin/content';
import Archive from '@/app/admin/document-archive';
import Complete from '@/app/admin/construction-schedule';
import Simple from '@/app/admin/schedule';
import NewSchedule from '@/app/admin/construction-schedule-new';
import Budget from '@/app/admin/construction-schedule-budget';
import Measurements from '@/app/admin/construction-schedule-measurements';
import Revision from '@/app/admin/construction-schedule-revision';
import Baselines from '@/app/admin/construction-schedule-baselines';
import TestSchedule from '@/app/admin/construction-schedule-test';
import Tasks from '@/app/admin/tasks';
import Diary from '@/app/admin/work-diary';
import Procurement from '@/app/admin/procurement';
import Financial from '@/app/admin/financial';
import Receipts from '@/app/admin/receipts';
import Agenda from '@/app/admin/agenda';
import Requests from '@/app/admin/requests';
import Notifications from '@/app/admin/notifications';
import Settings from '@/app/admin/settings';
import Portal from '@/app/admin/portal-control';
import Security from '@/app/admin/security';
import Health from '@/app/admin/system-health';
import Services from '@/app/admin/service-level-governance';
import Website from '@/app/admin/website-content';
import Workspace from '@/app/admin/workspace';
const components:Record<string,React.ComponentType>={
 clients:Clients,projects:Projects,documents:Content,photos:Content,'document-archive':Archive,
 'construction-schedule':Complete,schedule:Simple,'construction-schedule-new':NewSchedule,
 'construction-schedule-budget':Budget,'construction-schedule-measurements':Measurements,
 'construction-schedule-revision':Revision,'construction-schedule-baselines':Baselines,'construction-schedule-test':TestSchedule,
 tasks:Tasks,'work-diary':Diary,procurement:Procurement,financial:Financial,receipts:Receipts,
 agenda:Agenda,requests:Requests,notifications:Notifications,settings:Settings,'portal-control':Portal,
 security:Security,'system-health':Health,'service-level-governance':Services,'website-content':Website,workspace:Workspace,
};
const webTools:Record<string,{title:string;path:string}>={
 clients:{title:'Clientes',path:'/clientes.html'},projects:{title:'Projetos e contratos',path:'/projetos.html'},
 documents:{title:'Arquivos e biblioteca',path:'/documentos.html'},photos:{title:'Galeria de imagens',path:'/fotos.html'},
};
export function AdminAreaModule({module}:{module:string}){
 const web=webTools[module];if(web&&Platform.OS==='web')return <AdminWebTool {...web} />;
 const Component=components[module];return Component?<Component />:null;
}
