import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Packer } from 'docx';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';

const ROOT=process.cwd();
const OUT=path.join(ROOT,'qa-generated-files');
const TMP=path.join(ROOT,'.qa-generated-modules');
fs.rmSync(OUT,{recursive:true,force:true});
fs.rmSync(TMP,{recursive:true,force:true});
fs.mkdirSync(OUT,{recursive:true});
fs.mkdirSync(TMP,{recursive:true});

const failures:string[]=[];
const check=(condition:boolean,message:string)=>{if(!condition)failures.push(message)};
const read=(rel:string)=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const importFresh=async(file:string)=>import(`${pathToFileURL(file).href}?v=${Date.now()}-${Math.random()}`);

function xmlText(xml:string){
  return xml
    .replace(/<w:tab\s*\/>/g,'\t')
    .replace(/<\/w:p>/g,'\n')
    .replace(/<[^>]+>/g,'')
    .replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>')
    .replaceAll('&quot;','"').replaceAll('&apos;',"'")
    .replace(/\s+/g,' ').trim();
}

async function validateDocx(name:string,bytes:Uint8Array|Buffer,expected:string[],forbidden:string[]=[]){
  const buffer=Buffer.from(bytes);
  check(buffer.length>5000,`${name}: DOCX pequeno demais (${buffer.length} bytes)`);
  check(buffer[0]===0x50&&buffer[1]===0x4b,`${name}: assinatura ZIP/OOXML inválida`);
  let zip:JSZip;
  try{zip=await JSZip.loadAsync(buffer,{checkCRC32:true});}
  catch(error){failures.push(`${name}: pacote DOCX corrompido: ${error instanceof Error?error.message:String(error)}`);return;}
  for(const required of ['[Content_Types].xml','_rels/.rels','word/document.xml','word/styles.xml']){
    check(Boolean(zip.file(required)),`${name}: estrutura OOXML ausente (${required})`);
  }
  const documentXml=await zip.file('word/document.xml')?.async('string')??'';
  const visible=xmlText(documentXml);
  for(const token of expected)check(visible.includes(token),`${name}: conteúdo esperado ausente: ${token}`);
  for(const token of forbidden)check(!visible.includes(token),`${name}: conteúdo indevido presente: ${token}`);
  for(const bad of ['undefined','[object Object]','NaN'])check(!visible.includes(bad),`${name}: texto inválido encontrado: ${bad}`);
  fs.writeFileSync(path.join(OUT,`${name}.docx`),buffer);
  console.log(`DOCX OK ${name}: ${buffer.length} bytes`);
}

function buildPureCommercialModule(){
  const source=read('portal-app/supabase/functions/generate-commercial-document/index.ts');
  const docxImport=source.match(/import \{[^;]+\} from 'docx';/)?.[0];
  const start=source.indexOf('type CommercialRecord=');
  const end=source.indexOf('Deno.serve');
  if(!docxImport||start<0||end<0)throw new Error('Não foi possível extrair o renderizador comercial real.');
  const target=path.join(TMP,'commercial-core.ts');
  fs.writeFileSync(target,`${docxImport}\n${source.slice(start,end)}\nexport { quoteDocument, contractDocument };\n`);
  return target;
}

function buildCommercialFinalModule(){
  const source=read('portal-app/supabase/functions/generate-commercial-document-final/index.ts');
  const start=source.indexOf('const text=');
  const end=source.indexOf('Deno.serve');
  if(start<0||end<0)throw new Error('Não foi possível extrair o pós-processamento comercial final.');
  const target=path.join(TMP,'commercial-final.ts');
  fs.writeFileSync(target,`import JSZip from 'jszip';\n${source.slice(start,end)}\nexport { replaceContractAddress };\n`);
  return target;
}

function buildPureContractModule(){
  const source=read('portal-app/supabase/functions/generate-contract-document/index.ts');
  const docxImport=source.match(/import \{[^;]+\} from 'docx';/)?.[0];
  const start=source.indexOf('type Data=');
  const end=source.indexOf('Deno.serve');
  if(!docxImport||start<0||end<0)throw new Error('Não foi possível extrair o renderizador contratual real.');
  const target=path.join(TMP,'contract-core.ts');
  fs.writeFileSync(target,`${docxImport}\n${source.slice(start,end)}\nexport { build };\n`);
  return target;
}

function buildPureXlsxModule(){
  const source=read('portal-app/supabase/functions/generate-construction-schedule-xlsx/index.ts');
  const helperStart=source.indexOf('const asDate=');
  const helperEnd=source.indexOf('Deno.serve');
  const blockStart=source.indexOf('const workbook=new ExcelJS.Workbook();');
  const blockEnd=source.indexOf('const bytes=await workbook.xlsx.writeBuffer();',blockStart);
  if(helperStart<0||helperEnd<0||blockStart<0||blockEnd<0)throw new Error('Não foi possível extrair o gerador XLSX real.');
  const target=path.join(TMP,'schedule-xlsx.ts');
  fs.writeFileSync(target,`import ExcelJS from 'exceljs';\nimport { PNG } from 'pngjs';\nimport { Buffer } from 'node:buffer';\n${source.slice(helperStart,helperEnd)}\nexport async function buildScheduleWorkbook(project:any,client:any,schedule:any,contract:any,items:any[]){\n${source.slice(blockStart,blockEnd)}\nconst bytes=await workbook.xlsx.writeBuffer();\nreturn Buffer.from(bytes as ArrayBuffer);\n}\n`);
  return target;
}

const profile={
  full_name:'Camila Martins QA',professional_title:'Engenheira Civil',crea_rj:'QA-123456',crea_sp:'QA-654321',
  cpf:'000.000.000-00',rg:'00.000.000-0',rg_issuer:'SSP',nationality:'brasileira',marital_status:'solteira',
  professional_address:'Av. Profissional QA, 100 - Rio de Janeiro/RJ',email_professional:'qa@cme.local',phone_professional:'(21) 90000-0000'
};
const generatedAt=new Date('2026-09-11T12:00:00-03:00');
const serviceLevel={label:'Essencial',subtitle:'Planejamento técnico completo',description:'Nível QA para validação dos documentos.',features:['Compatibilização técnica','Apresentação organizada'],exclusions:['Render cinematográfico']};
const services=[{
  code:'a',name:'Projeto Arquitetônico',included:true,levelApplicable:true,description:'Desenvolvimento do projeto arquitetônico da residência.',
  deliverables:['Plantas técnicas','Cortes e fachadas'],clientInputs:['Documento do imóvel','Briefing aprovado'],revisions:2,deliveryFormats:['PDF','DWG'],planningReference:'20 dias úteis',
  exclusions:['Projeto estrutural'],level:serviceLevel,acceptanceRequired:true
},{
  code:'b',name:'Consultoria de Obra',included:true,levelApplicable:false,description:'Acompanhamento técnico consultivo.',deliverables:['Relatório técnico'],clientInputs:['Acesso à obra'],revisions:1,deliveryFormats:['PDF'],planningReference:'Conforme agenda',exclusions:['Execução de mão de obra'],acceptanceRequired:true
}];
const smartTexts={scope_limits_rule:{body:'Somente os serviços expressamente contratados integram o escopo QA.'},proposal_timeline_rule:{body:'Prazo QA conforme planejamento aprovado.'},anexo_timeline_rule:{body:'Cronograma QA vinculado ao contrato.'}};

const commercialRecord:any={
  id:'11111111-1111-4111-8111-111111111111',quote_number:'ORC-2026-09-QA01',contract_number:'CON-2026-09-QA01',status:'contrato_gerado',prospect_name:'Cliente Arquivo QA',
  cpf_cnpj:'000.000.000-00',email:'cliente.qa@example.com',phone:'(21) 98888-0000',address:'Rua Particular QA, 123 - Rio de Janeiro/RJ',city:'Rio de Janeiro',state:'RJ',
  property_address:'Rua da Obra QA, 999 - Rio de Janeiro/RJ',property_type:'Residencial',area_terreno_m2:420,area_construida_m2:210,construction_standard:'Médio/alto',experience_level:'essencial',
  services,custom_service:'Compatibilização adicional QA.',total_value:25000,payment_terms:[{label:'Entrada',value:'R$ 10.000,00',due:'na assinatura'},{label:'Saldo',value:'R$ 15.000,00',due:'conforme etapas'}],
  valid_until:'2026-10-15',notes:'Condição comercial de teste.',quote_document_id:null,contract_document_id:null,contract_master_id:'master-qa',contract_master_version:3,smart_texts:smartTexts
};

const contractData:any={
  emitted_at:'2026-09-11T12:00:00-03:00',document_date:'2026-09-11',contract_signed_at:'2026-09-11',contract_number:'CON-2026-09-QA01',contract_master_version:3,
  client_name:'Cliente Arquivo QA',project_name:'Residência QA',project_type:'Residencial',property_address:'Rua da Obra QA, 999 - Rio de Janeiro/RJ',source_quote_number:'ORC-2026-09-QA01',
  area_terreno_m2:420,area_construida_m2:210,contract_value:25000,payment_terms:commercialRecord.payment_terms,commercial_notes:'Condição QA',experience_level:'essencial',service_level:serviceLevel,
  scope_items:[...services,{code:'c',name:'Projeto Estrutural',included:false,description:'Não contratado.'}],scope_snapshot:services,smart_texts:smartTexts,
  approval_title:'Projeto Arquitetônico - Estudo preliminar',approval_description:'Entrega preliminar para validação.',delivered_at:'2026-09-10T15:00:00-03:00',approval_due_at:'2026-09-15T23:59:59-03:00',
  notification_reason:'Aguardando manifestação do cliente.',regularization_days:3,additional_service_description:'Alteração de layout da cozinha.',project_description:'Residência unifamiliar QA.',outside_contracted_scope:false
};

try{
  const commercial=await importFresh(buildPureCommercialModule());
  const commercialFinal=await importFresh(buildCommercialFinalModule());
  const contract=await importFresh(buildPureContractModule());
  const native=await importFresh(path.join(ROOT,'portal-app/supabase/functions/generate-contract-document-final/native-options-docx.ts'));

  const quoteBytes=await Packer.toBuffer(commercial.quoteDocument(commercialRecord,profile,generatedAt));
  await validateDocx('01-orcamento-comercial',quoteBytes,['PROPOSTA COMERCIAL — ORC-2026-09-QA01','Cliente Arquivo QA','Rua da Obra QA, 999','R$ 25.000,00']);

  const coreContractBytes=await Packer.toBuffer(commercial.contractDocument(commercialRecord,profile,'CLÁUSULA 1 – OBJETO\nO objeto deste contrato é a prestação dos serviços descritos no Anexo I.\nCLÁUSULA 2 – PRAZOS\nOs prazos seguem o cronograma aprovado.',generatedAt));
  const finalContractBytes=await commercialFinal.replaceContractAddress(new Uint8Array(coreContractBytes),commercialRecord.address,commercialRecord.property_address);
  await validateDocx('02-contrato-comercial-final',finalContractBytes,['CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE ENGENHARIA — CON-2026-09-QA01','Cliente Arquivo QA','com endereço do imóvel/obra em Rua da Obra QA, 999','CLÁUSULA 1 – OBJETO'],['com endereço em Rua Particular QA, 123']);

  const coreKinds:[string,string,string][]=[
    ['anexo_i','03-anexo-i','ANEXO I'],
    ['estudo_preliminar','04-estudo-preliminar','ESTUDO PRELIMINAR'],
    ['notificacao_formal','05-notificacao-formal','NOTIFICAÇÃO FORMAL']
  ];
  for(const [kind,file,title] of coreKinds){
    const bytes=await Packer.toBuffer(contract.build(kind,contractData,profile));
    await validateDocx(file,bytes,[title,'Cliente Arquivo QA','Residência QA','CON-2026-09-QA01']);
  }

  const nativeCases:any[]=[
    ['termo_aceite','06-termo-aceite','TERMO DE ACEITE DE ETAPA',{acceptance:'accepted_with_notes',acceptance_notes:'Ressalva QA registrada.'},['Aceito com ressalvas','Ressalva QA registrada.']],
    ['levantamento_tecnico','07-levantamento-tecnico','FICHA DE LEVANTAMENTO TÉCNICO / VISTORIA',{inspection_datetime:'11/09/2026 10:00',site_contact:'Responsável QA',observed:['electrical','structure'],conditions:['cracks'],conditions_description:'Fissura superficial QA.'},['Pontos elétricos','Fissura superficial QA.']],
    ['servico_adicional','08-servico-adicional','TERMO DE APROVAÇÃO DE SERVIÇO ADICIONAL',{reasons:['scope_change'],pricing:'fixed',additional_service_description:'Alteração de layout QA.',additional_value:'R$ 2.500,00',schedule_impact:'5 dias úteis',approval:['approved']},['Alteração de layout QA.','R$ 2.500,00']],
    ['autorizacao_imagem','09-autorizacao-imagem','AUTORIZAÇÃO DE USO DE IMAGEM E DIVULGAÇÃO',{materials:['facade','interiors'],channels:['portfolio','social'],privacy:['hide_address'],wait_months:'6'},['Fotografias externas / fachada','Aguardar 6 meses']],
    ['quitacao_encerramento','10-quitacao-encerramento','TERMO DE QUITAÇÃO E ENCERRAMENTO',{closing_reason:'completed',financial:'paid',delivered_files:'Projetos finais QA',open_items:'Nenhuma',public_processes:'Nenhum'},['Conclusão integral do escopo contratado','Quitação integral']]
  ];
  for(const [kind,file,title,document_options,extraExpected] of nativeCases){
    const bytes=await native.generateNativeOptionsDocx(kind,{...contractData,document_options},profile);
    check(Boolean(bytes),`${file}: renderizador final nativo não retornou bytes`);
    if(bytes)await validateDocx(file,bytes,[title,'Cliente Arquivo QA','Residência QA','CON-2026-09-QA01',...extraExpected]);
  }

  const xlsx=await importFresh(buildPureXlsxModule());
  const project:any={id:'22222222-2222-4222-8222-222222222222',cliente_id:'33333333-3333-4333-8333-333333333333',contract_id:'44444444-4444-4444-8444-444444444444',nome:'Residência QA',tipo:'Residencial',status:'em_andamento',data_inicio:'2026-09-01',data_fim:'2026-12-20',numero_contrato:'CON-2026-09-QA01',numero_orcamento:'ORC-2026-09-QA01',area_construida_m2:210,area_terreno_m2:420,endereco_obra:'Rua da Obra QA',numero_obra:'999',complemento_obra:'Casa',bairro_obra:'Centro',cidade_obra:'Rio de Janeiro',estado_obra:'RJ'};
  const client:any={id:project.cliente_id,nome:'Cliente Arquivo QA',cpf_cnpj:'000.000.000-00',telefone:'(21) 98888-0000',email:'cliente.qa@example.com',endereco:'Rua Particular QA, 123',cidade:'Rio de Janeiro',estado:'RJ',cep:'20000-000'};
  const schedule:any={id:'55555555-5555-4555-8555-555555555555',planned_start:'2026-09-01',planned_finish:'2026-12-20',reference_date:'2026-10-01'};
  const commercialContract:any={id:project.contract_id,contract_number:'CON-2026-09-QA01',service_type:'Engenharia',status:'ativo',signed_at:'2026-09-11',start_date:'2026-09-01',end_date:'2026-12-20',contract_value:25000,currency:'BRL'};
  const items:any[]=[
    {code:'1',category:'Preliminares',activity:'Mobilização e planejamento',weight_percent:10,planned_duration_days:7,predecessor_code:null,planned_start:'2026-09-01',planned_finish:'2026-09-07',actual_start:'2026-09-01',actual_finish:'2026-09-07',actual_progress:100,planned_cost:2000,actual_cost:1950,status:'Concluído',notes:'QA'},
    {code:'2',category:'Fundação',activity:'Fundação',weight_percent:30,planned_duration_days:21,predecessor_code:'1',planned_start:'2026-09-08',planned_finish:'2026-09-28',actual_start:'2026-09-08',actual_finish:null,actual_progress:80,planned_cost:8000,actual_cost:7000,status:'Em andamento',notes:'QA'},
    {code:'3',category:'Estrutura',activity:'Estrutura',weight_percent:35,planned_duration_days:35,predecessor_code:'2',planned_start:'2026-09-29',planned_finish:'2026-11-02',actual_start:'2026-09-30',actual_finish:null,actual_progress:10,planned_cost:10000,actual_cost:2500,status:'Em andamento',notes:'QA'},
    {code:'4',category:'Acabamentos',activity:'Acabamentos finais',weight_percent:25,planned_duration_days:48,predecessor_code:'3',planned_start:'2026-11-03',planned_finish:'2026-12-20',actual_start:null,actual_finish:null,actual_progress:0,planned_cost:5000,actual_cost:0,status:'Pendente',notes:'QA'}
  ];
  const xlsxBytes:Buffer=await xlsx.buildScheduleWorkbook(project,client,schedule,commercialContract,items);
  check(xlsxBytes.length>20000,`Cronograma XLSX pequeno demais (${xlsxBytes.length} bytes)`);
  check(xlsxBytes[0]===0x50&&xlsxBytes[1]===0x4b,'Cronograma XLSX não é um pacote ZIP/OOXML válido');
  const xlsxZip=await JSZip.loadAsync(xlsxBytes,{checkCRC32:true});
  for(const required of ['[Content_Types].xml','xl/workbook.xml','xl/worksheets/sheet1.xml'])check(Boolean(xlsxZip.file(required)),`Cronograma XLSX: estrutura ausente (${required})`);
  const workbook=new ExcelJS.Workbook();
  await workbook.xlsx.load(xlsxBytes as any);
  const expectedSheets=['Resumo','Cronograma','Curva S','Gantt','Parâmetros'];
  check(JSON.stringify(workbook.worksheets.map(s=>s.name))===JSON.stringify(expectedSheets),`Cronograma XLSX: abas incorretas (${workbook.worksheets.map(s=>s.name).join(', ')})`);
  const resumo=workbook.getWorksheet('Resumo')!;
  const cron=workbook.getWorksheet('Cronograma')!;
  const curva=workbook.getWorksheet('Curva S')!;
  const gantt=workbook.getWorksheet('Gantt')!;
  check(String(resumo.getCell('B4').value)==='Cliente Arquivo QA','Cronograma XLSX: cliente não apareceu no Resumo');
  check(String(resumo.getCell('B6').value)==='Residência QA','Cronograma XLSX: projeto não apareceu no Resumo');
  check(cron.rowCount>=items.length+1,`Cronograma XLSX: atividades incompletas (${cron.rowCount-1}/${items.length})`);
  check(String(cron.getCell('C2').value)==='Mobilização e planejamento','Cronograma XLSX: primeira atividade divergente');
  const weight=items.reduce((sum,item)=>sum+Number(item.weight_percent||0),0);
  check(weight===100,`Cronograma XLSX: pesos de teste não totalizam 100% (${weight})`);
  check(typeof (cron.getCell('K2').value as any)?.formula==='string','Cronograma XLSX: fórmula de planejado ausente');
  check(typeof (cron.getCell('M2').value as any)?.formula==='string','Cronograma XLSX: fórmula ponderada planejada ausente');
  check(typeof (cron.getCell('N2').value as any)?.formula==='string','Cronograma XLSX: fórmula ponderada real ausente');
  check(typeof (cron.getCell('O2').value as any)?.formula==='string','Cronograma XLSX: fórmula de desvio ausente');
  check((cron.getCell('L2').dataValidation as any)?.type==='whole','Cronograma XLSX: validação 0–100 do realizado ausente');
  check(curva.getImages().length>=1,'Cronograma XLSX: gráfico/figura da Curva S ausente');
  check(typeof (gantt.getCell('D4').value as any)?.formula==='string','Cronograma XLSX: fórmula do Gantt ausente');
  fs.writeFileSync(path.join(OUT,'11-cronograma-obra.xlsx'),xlsxBytes);
  console.log(`XLSX OK 11-cronograma-obra: ${xlsxBytes.length} bytes, ${expectedSheets.length} abas, ${items.length} atividades`);
}catch(error){
  failures.push(`Falha inesperada nos geradores: ${error instanceof Error?error.stack||error.message:String(error)}`);
}

if(failures.length){
  console.error('\nFALHAS NOS ARQUIVOS GERADOS:');
  failures.forEach((failure,index)=>console.error(`${index+1}. ${failure}`));
  process.exit(1);
}
console.log('\nAPROVADO: 10 documentos Word + 1 cronograma Excel foram gerados, reabertos e validados a partir do código real dos geradores.');
