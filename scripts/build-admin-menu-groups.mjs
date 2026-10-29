import fs from 'node:fs';
// The web and native menus share this source of categories and ordering.
const groups=JSON.parse(fs.readFileSync('portal-app/src/lib/admin-menu-groups.json','utf8'));
const path='js/ui-core.js',source=fs.readFileSync(path,'utf8');
const block=`const ADMIN_MENU_GROUPS=${JSON.stringify(groups)};`;
if(!/const ADMIN_MENU_GROUPS=\[[^\n]*\];/.test(source))throw Error('Missing generated menu block');
fs.writeFileSync(path,source.replace(/const ADMIN_MENU_GROUPS=\[[^\n]*\];/,block));
console.log('Menu: sete categorias sincronizadas entre site e portal.');

const areas=JSON.parse(fs.readFileSync('portal-app/src/lib/admin-areas.json','utf8')),aliases={};
for(const area of ['client-center','asset-center','finance-center','relationship-center','settings-center','works-center']){
 for(const group of areas[area].groups)for(const view of group.views)if(view.module!=='workspace'&&!aliases[view.module])aliases[view.module]={area,view:view.key};
}
aliases.library={area:'asset-center',view:'files'};
const web=fs.readFileSync(path,'utf8');
fs.writeFileSync(path,web.replace(/const GROUPED_ADMIN_ROUTES=[^\n]*;/,`const GROUPED_ADMIN_ROUTES=${JSON.stringify(aliases)};`));
const navigation='portal-app/src/lib/admin-navigation.ts';
fs.writeFileSync(navigation,fs.readFileSync(navigation,'utf8').replace(/const groupedWebsiteAdminRoutes:[^\n]*;/,`const groupedWebsiteAdminRoutes:Record<string,{area:string;view:string}>=${JSON.stringify(aliases)};`));
