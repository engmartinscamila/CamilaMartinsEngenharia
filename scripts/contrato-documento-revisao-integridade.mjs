import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { contractDocument } from '../portal-app/supabase/functions/_shared/commercial-word-renderer.ts';
import { enhanceContractDocument } from '../portal-app/supabase/functions/_shared/commercial-word-enhancements.ts';

const requirePortal=createRequire(new URL('../portal-app/package.json',import.meta.url));
const {Packer}=requirePortal('docx');
const JSZip=requirePortal('jszip');
const read=p=>readFileSync(p,'utf8');
const renderer=read('portal-app/supabase/functions/_shared/commercial-word-renderer.ts');
const core=read('portal-app/supabase/functions/generate-commercial-document/index.ts');
const annex=read('portal-app/supabase/functions/generate-contract-document/index.ts');
const editor=read('js/commercial-terms-web.js');
const migration=read('docs/VALIDACAO_REPRESENTANTE_ESCOMPO_PUBLICO_20261101.sql');
assert.ok(core.includes('docVersion')&&core.includes('documentId}.docx'),'Cada versão deve ter caminho de armazenamento próprio');
assert.ok(core.includes('document_version:docVersion'),'Versão deve ser armazenada no snapshot');
assert.ok(!core.includes("contract_signed_at:documentDate"),'Não forjar data de assinatura');
assert.ok(annex.includes("anexo_i:'do Anexo I'")&&annex.includes('${versionLabel(kind)}: v'),'Anexo deve identificar versão');
assert.ok(!annex.includes('Versão do Anexo I: v')&&annex.includes("estudo_preliminar:'do Estudo Preliminar'")&&annex.includes("notificacao_formal:'da Notificação Formal'"),'A11: demais documentos não usam o rótulo de versão do Anexo I');
assert.equal((annex.match(/\.\.\.identity\(d,profile,generatedAt,kind\)/g)||[]).length,(annex.match(/\.\.\.identity\(/g)||[]).length,'A11: todo documento informa seu tipo ao bloco de identificação');
assert.ok(annex.includes('a CONTRATADA entrega o serviço técnico-administrativo'), 'A Prefeitura deve continuar responsável pelo alvará e Habite-se');
assert.ok(annex.includes("action==='reconstitute'")&&annex.includes('historical_reconstitution:true')&&annex.includes('/reconstituted/')&&annex.includes("upsert:false")&&annex.includes(".is('arquivo',null)"),'A12: reconstituição usa caminho próprio, não sobrescreve arquivo existente e só vincula documento sem arquivo');
assert.ok(annex.includes('CÓPIA RECONSTITUÍDA')&&annex.includes('build(row.document_kind,reconstitutedData,profile,emittedAt)'),'A12: cópia reconstituída é identificada e preserva a data original da emissão');
assert.ok(!/action==='reconstitute'[\s\S]{0,2500}generated_at:/.test(annex),'A12: reconstituição não altera generated_at nem os dados congelados');
assert.ok(read('js/contract-documents-web.js').includes("action:'reconstitute'"),'A12: tela oferece a cópia reconstituída quando falta o original');
{
 const finalCommercial=read('portal-app/supabase/functions/generate-commercial-document-final/index.ts');
 assert.ok(finalCommercial.includes("update({ superseded_by: documentId })")&&finalCommercial.includes(".is('superseded_by', null)"),'Revisão: versão anterior passa a ser substituída após a nova emissão');
 assert.ok(finalCommercial.includes('pelo menos 10 letras'),'Revisão: motivo genérico (ex.: "A") é recusado no servidor');
 assert.ok(read('js/commercial-document-preview-web.js').includes('pelo menos 10 letras')&&read('portal-app/src/app/admin/commercial-documents.tsx').includes('pelo menos 10 letras'),'Revisão: mesma regra de motivo no site e no portal');
 assert.ok(read('js/commercial-documents-web.js').includes('window.CMEGenerateCommercialDocument(recordId, kind, archive)'),'Comercial: caminho único de emissão');
 assert.ok(read('js/contract-documents-web.js').includes("'generate-contract-document-final'"),'Contratuais: site usa o mesmo gerador do portal (respeita opções)');
 assert.ok(annex.includes("alreadyEmitted:true")&&annex.includes("from('document_emission_snapshots')"),'Documento emitido não é gerado de novo por cima; o download entrega o original');
}
assert.ok(editor.includes('representative_name')&&editor.includes('representative_powers'),'Cadastro do signatário completo');
assert.ok(migration.includes('assert_commercial_party_ready')&&migration.includes("v_code IN ('k','l','m')"),'Validação obrigatória também no servidor');
const record={
 id:'00000000-0000-4000-8000-000000000012',quote_number:'ORC-TEST',contract_number:'CON-TEST',
 prospect_name:'Construtora Exemplo Ltda',cpf_cnpj:'12.345.678/0001-90',status:'convertido',
 address:'Rua Teste, 10',email:'empresa@example.invalid',phone:'(11) 99999-0000',
 services:[{code:'k',name:'Legalização',included:true,levelApplicable:true,level:{code:'prata',label:'PRATA'}}],
 total_value:12000,commercial_terms:{
  payment_method:'pix',
  installments:[{amount:'1500.00',due_date:'2026-11-06',due_event:''},{amount:'10500.00',due_date:'2027-06-11',due_event:''}],
  schedule:{days:'150',day_type:'uteis',start_trigger:'Assinatura, pagamento e entrega dos documentos'},
  scope:[{code:'k',quantity:'1',unit:'processo',days:'',deadline_type:'municipal',revisions:'0',visits:'',municipal_notes:'Protocolo somente após recebimento de todos os documentos',deliverables:'Preparação e acompanhamento perante a Prefeitura, sem garantia de deferimento'}],
  legal_representative:{name:'Maria da Silva',cpf:'12345678909',role:'Sócia-administradora',powers:'Representação conforme contrato social'}
 },
 document_version:'2.1',document_version_reason:'MOTIVO-INTERNO-NAO-EXIBIR',
 coobligors:[],contract_master_version:5,smart_texts:{},notes:''
};
const profile={full_name:'Profissional de Engenharia',professional_title:'Engenheira Civil',crea_sp:'123456'};
const doc=contractDocument(record,profile,'CLÁUSULA 2ª – DO PRAZO\n2.1. O prazo específico de 150 dias úteis consta do Anexo I.',new Date('2026-11-01T17:00:00Z'));
const buff=await Packer.toBuffer(doc);
const zip=await JSZip.loadAsync(buff);
const raw=(await zip.file('word/document.xml').async('string'));
const text=raw.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/[\u00a0\u202f]/g,' ');
assert.match(text,/R\$\s*1\.500,00/,'Pagamento em reais, sem 1500.00');
assert.match(text,/06\/11\/2026/,'Data brasileira 06/11/2026');
assert.match(text,/11\/06\/2027/,'Segunda data brasileira');
assert.ok(!text.includes('2026-11-06')&&!text.includes('1500.00'),'Word não pode expor formato de banco');
assert.match(text,/Versão do contrato:\s*v2\.1/,'Identificar versão emitida');
assert.match(text,/150 dias úteis/,'Preservar prazo de 150 dias úteis');
assert.ok(!text.includes('MOTIVO-INTERNO-NAO-EXIBIR')&&!text.includes('Motivo registrado para esta revisão'),'Não publicar motivo interno de revisão no Word.');
const footers = Object.keys(zip.files).filter(name=>/^word\/footer\d+\.xml$/.test(name));
assert.ok(footers.length>0,'Word deve conter rodapé.');
for(const filename of footers){
  const footerXml=await zip.file(filename).async('string');
  assert.ok(!footerXml.includes('CON CON-TEST'),'Não duplicar o prefixo CON no rodapé.');
  assert.ok(footerXml.includes('CON-TEST'),'Rodapé deve identificar o número de contrato.');
}
const finalized=await enhanceContractDocument(new Uint8Array(buff),'Rua Santa Rita da Estrela',record.services,null,'prata',record.commercial_terms);
const finalXml=await (await JSZip.loadAsync(finalized)).file('word/document.xml').async('string');
assert.match(finalXml,/Entrega técnica aprovada para esta atividade:/,'O contrato deve reproduzir entregáveis contratados.');
assert.ok(finalXml.includes('Preparação e acompanhamento perante a Prefeitura'),'Não perder descrição contratada de serviço municipal.');
assert.ok(!finalXml.includes('O contrato identifica o número de produtos'),'Não inserir texto genérico de catálogo.');
await assert.rejects(()=>enhanceContractDocument(new Uint8Array(buff),'Rua Teste',record.services,null,'prata',{scope:[]}),/Preencha os entregáveis específicos/,'Bloquear geração sem escopo individualizado.');
assert.match(text,/depende exclusivamente da Prefeitura/,'Prazo externo municipal deve constar do Word');
assert.match(text,/Observações complementares/,'Observações opcionais devem integrar o Word');
assert.ok(!text.includes('prazo: 30')&&!text.includes('prazo: 0'),'Prazo municipal não pode virar número em contrato');
assert.ok(editor.includes('municipalScopes')&&editor.includes('municipal_notes')&&editor.includes('municipalDeadline'),'Editor deve conter texto padrão, notas e prazo municipal');
const municipalSql=read('docs/VALIDACAO_PRAZOS_MUNICIPAIS_PADRAO_20261101.sql');
assert.ok(municipalSql.includes("v_entry->>'deadline_type'='municipal'"),'Banco deve dispensar dias numéricos apenas para etapas municipais');
assert.ok(annex.includes('depende exclusivamente da Prefeitura'),'Anexo deve separar prazo municipal');
assert.match(text,/Maria da Silva/,'Representante legal no corpo e assinatura');
assert.match(text,/123\.456\.789-09/,'CPF formatado');
assert.ok(!text.includes('A CONFIRMAR ANTES DA ASSINATURA'),'Não permitir placeholder de representante');
assert.throws(()=>contractDocument({...record,commercial_terms:{...record.commercial_terms,legal_representative:{}}},profile,'CLÁUSULA TESTE',new Date()),/representante legal/i,'Sem representante o Word deve bloquear geração');
const historicDoc=contractDocument({...record,historical_reconstitution:true,document_version:'1.0',commercial_terms:{...record.commercial_terms,legal_representative:{}}},profile,'CLÁUSULA HISTÓRICA',new Date());
const historicBuf=await Packer.toBuffer(historicDoc);
const historicXml=await (await JSZip.loadAsync(historicBuf)).file('word/document.xml').async('string');
assert.ok(historicXml.includes('CÓPIA RECONSTITUÍDA'),'Recuperação histórica deve ser sinalizada');
assert.ok(historicXml.includes('não registrados na emissão histórica'),'Representante ausente em versão antiga não deve causar bloqueio nem ser inventado');
const recovery=read('portal-app/supabase/functions/download-commercial-word/index.ts');
assert.ok(recovery.includes('historical_reconstitution:true')&&recovery.includes('document_version:String(snapshot.data.version'),'Recuperação deve usar versão congelada');
assert.equal(read('supabase/functions/download-commercial-word/index.ts'),recovery,'Recuperadores espelhados idênticos');
assert.equal(read('supabase/functions/_shared/commercial-word-renderer.ts'),renderer,'Renderizadores sincronizados');
assert.equal(read('supabase/functions/generate-contract-document/index.ts'),annex,'Anexo sincronizado');
assert.equal(read('supabase/functions/generate-commercial-document/index.ts'),core,'Gerador sincronizado');
console.log('PASS: DOCX formatado em pt-BR, prazo 150, signatário, versão, armazenamento e Anexo I.');
