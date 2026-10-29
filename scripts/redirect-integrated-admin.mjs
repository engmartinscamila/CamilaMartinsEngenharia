import fs from 'node:fs';
const file='site-public/admin.html';
const source=fs.readFileSync(file,'utf8');
if(!fs.existsSync('site-public/portal/admin/workspace/index.html'))throw new Error('Visão geral integrada ausente');
const tag=`<script src="js/admin-home-route.js?v=${process.env.GITHUB_SHA||'integrated'}"></script>`;
fs.writeFileSync(file,source.replace(/<head>/i,'<head>\n'+tag));
console.log('Entrada administrativa integrada à Visão geral; endereço legado preservado para compatibilidade.');
