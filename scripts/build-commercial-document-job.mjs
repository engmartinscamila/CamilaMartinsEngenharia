import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root='supabase/functions/process-commercial-document-job';
const definitions=[
 ['generate-commercial-document','createCommercialCoreHandler','async(req)=>{'],
 ['generate-commercial-document-final','createCommercialFinalHandler','async req => {'],
 ['generate-contract-document','createContractDocumentHandler','async(req)=>{'],
 ['deliver-generated-document','createDeliveryHandler','async (req) => {'],
];
export function generateJobWorkflow(name,factory,signature){
 const source=fs.readFileSync(`supabase/functions/${name}/index.ts`,'utf8');
 const marker='Deno.serve('+signature;
 if(source.split(marker).length!==2||!source.trimEnd().endsWith('});'))throw Error('Unexpected handler structure: '+name);
 let generated=source.replace(marker,`export function ${factory}(authorize: any${name==='generate-commercial-document-final'?', proxy: any':''}) { return ${signature}`);
 const start=generated.indexOf(`export function ${factory}`);
 let body=generated.slice(start).replace('await requireAdmin(req)','await authorize(req)');
 if(name==='generate-commercial-document-final')body=body.replace('await proxyCore(url, anonKey, authorization,','await proxy(url, anonKey, authorization,').replace('generated_data: { ...oldData,','generated_data: { ...oldData, maintenance_job_id:user.maintenanceJobId,');
 if(name==='generate-commercial-document')body=body.replace('const generatedData={commercial_record_snapshot:record,','const generatedData={maintenance_job_id:user.maintenanceJobId,commercial_record_snapshot:record,');
 generated=generated.slice(0,start)+body;
 generated=generated.trimEnd().slice(0,-3)+'}; }\n';
 return `// Generated from ${name}/index.ts (${createHash('sha256').update(source).digest('hex')}). Do not edit.\n`+generated;
}
for(const [name,factory,signature] of definitions){
 const target=`${root}/generated/${name}/index.ts`;
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.writeFileSync(target,generateJobWorkflow(name,factory,signature));
}
for(const name of ['commercial-word-renderer.ts','commercial-word-enhancements.ts']){
 const target=`${root}/generated/_shared/${name}`;
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.copyFileSync('supabase/functions/_shared/'+name,target);
}
console.log('PASS: generated protected job adapters from the four canonical handlers.');
