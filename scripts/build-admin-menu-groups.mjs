import fs from 'node:fs';
// The web and native menus share this source of categories and ordering.
const groups=JSON.parse(fs.readFileSync('portal-app/src/lib/admin-menu-groups.json','utf8'));
const path='js/ui-core.js',source=fs.readFileSync(path,'utf8');
const block=`const ADMIN_MENU_GROUPS=${JSON.stringify(groups)};`;
if(!/const ADMIN_MENU_GROUPS=\[[^\n]*\];/.test(source))throw Error('Missing generated menu block');
fs.writeFileSync(path,source.replace(/const ADMIN_MENU_GROUPS=\[[^\n]*\];/,block));
console.log('Menu: sete categorias sincronizadas entre site e portal.');
