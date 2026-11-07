import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = path => readFileSync(path, 'utf8');
function loadHelpers(names, document = {getElementById:()=>null}) {
  const window = {};
  const context=vm.createContext({window,document,console,Blob,Uint8Array,atob,setTimeout,clearTimeout,URL});
  for(const name of names) new vm.Script(read('js/'+name),{filename:name}).runInContext(context,{timeout:2000});
  return {window,document};
}
const {window} = loadHelpers([
  'commercial-search-utils.js','commercial-quote-utils.js','commercial-record-view.js',
  'commercial-legacy-quotes.js','commercial-download.js','portfolio-media-view.js','portfolio-media-storage.js'
]);
const matched=window.CMECommercialSearch.suggestCatalogService('eletrico',[
  {code:'f',name:'Projeto Elétrico',aliases:['eletrica']},
  {code:'p',name:'Outro'},
]);
assert.equal(matched.code,'f');
assert.equal(window.CMECommercialSearch.suggestCatalogService('xx',[{code:'a',name:'abc'}]),null);
const quotes=window.CMECommercialQuotes;
assert.equal(quotes.moneyValue(1250),'1.250,00');
assert.equal(quotes.parseMoney('1.250,00'),1250);
assert.equal(quotes.sameQuoteOwner([{cpf_cnpj:'123.456.789-00'},{cpf_cnpj:'12345678900'}]),true);
assert.equal(quotes.sameQuoteOwner([{cpf_cnpj:'12345678900'},{cpf_cnpj:'98765432100'}]),false);
const merged=quotes.combinedServices([
 {services:[{code:'f',name:'Projeto Elétrico',included:true,deliverables:'Quadro de cargas',levelCode:'ouro'}]},
 {services:[{code:'f',name:'Projeto Elétrico',included:false},{code:'z',name:'Adicional',included:true,notes:'Escopo extra'}]},
],[['f','Projeto Elétrico'],['a','Anteprojeto']]);
assert.equal(merged[0].deliverables,'Quadro de cargas');
assert.equal(merged[0].levelCode,'ouro');
assert.equal(merged[0].included,true);
assert.equal(merged.find(x=>x.code==='z').notes,'Escopo extra');
const fields={
 commercialList:{innerHTML:''},
 commercialExistingTitle:{textContent:''}
};
const visible=loadHelpers(['commercial-record-view.js'],{getElementById:id=>fields[id]??null}).window;
visible.CMECommercialRecordView.renderList([{record_kind:'contrato',contract_number:'CT-01',contract_document_id:'doc-1',prospect_name:'Cliente QA',property_type:'Legalização',created_at:'2026-01-01'}],()=> 'contrato',v=>String(v));
assert.match(fields.commercialList.innerHTML,/contract-download/);
assert.match(fields.commercialList.innerHTML,/commercial-terms/);
assert.equal(fields.commercialExistingTitle.textContent,'Contratos');
const manifest=window.CMECommercialLegacyQuotes.buildProjectAddress({endereco_obra:'Rua Teste',numero_obra:'123',cidade_obra:'São Paulo'});
assert.equal(manifest,'Rua Teste, 123, São Paulo');
assert.equal(typeof window.CMEPortfolioMediaView.create,'function');
assert.equal(typeof window.CMEPortfolioMediaStorage.create,'function');
const commercial=read('js/commercial-documents-web.js'),portfolio=read('js/portfolio-admin.js');
const commercialHtml=read('orcamentos-contratos.html'),portfolioHtml=read('protecao-pdf-admin.html');
for(const [html,modules,controller] of [
  [commercialHtml,['commercial-search-utils','commercial-quote-utils','commercial-record-view','commercial-legacy-quotes','commercial-download'],'commercial-documents-web'],
  [portfolioHtml,['portfolio-media-view','portfolio-media-storage'],'portfolio-admin'],
]){
 const last=html.indexOf('js/'+controller+'.js');
 assert(last>0,'Controller absent '+controller);
 for(const mod of modules){const at=html.indexOf('js/'+mod+'.js');assert(at>=0&&at<last,mod+' must load first');}
}
assert.match(commercial,/window\.CMECommercialQuotes\.combinedServices/);
assert.match(commercial,/function applyQuotesToContract/);
assert.match(commercial,/window\.CMECorrectCommercialServiceClassification/);
assert.match(portfolio,/window\.CMEPortfolioMediaStorage\.create/);
const finance=read('portal-app/src/app/admin/financial.tsx'),view=read('portal-app/src/components/financial-overview.tsx');
assert.match(finance,/section==='receivables'\?<>[\s\S]*?<LegacyFinancialAuditPanel[\s\S]*?<FinancialReceivables/);
assert.match(view,/Extrato de saldo a receber/);
assert.match(view,/Saldo restante:/);
assert.match(view,/Registrar recebimento/);
assert.match(finance,/admin_reset_financial_data/);
const financialDetails=read('portal-app/src/components/financial-detail-sections.tsx');
assert.match(financialDetails,/Conta para importação OFX/);
assert.match(financialDetails,/Histórico preservado e imutável/);
assert.match(financialDetails,/RESETAR FINANCEIRO/);
assert.match(finance,/section==='accounts'\?<FinancialAccountSection/);
assert.match(finance,/section==='history'\?<FinancialHistorySection/);

const receiptNodes={
 receiptPaper:{innerHTML:''},receiptEditor:{hidden:false},
 receiptResult:{hidden:true,scrollIntoView(){}},
};
const receiptDoc={getElementById:id=>receiptNodes[id]??null,title:'Recibos'};
const receipt=loadHelpers(['receipt-view.js'],receiptDoc).window.CMEReceiptView;
assert.equal(receipt.parseAmount('1.250,00'),1250);
assert.throws(()=>receipt.parseAmount('0,00'),/maior que zero/);
assert.throws(()=>receipt.parseAmount('1,234'),/formato brasileiro/);
const receiptRow={
 receipt_number:7,created_at:'2026-11-06T12:00:00Z',amount:1250,
 paid_on:'2026-11-06',description:'Serviço <teste>',payment_method:'Pix',
 snapshot:{issuer:{name:'Engenharia QA',title:'Engenheira Civil',document:'123'},
 payer_name:'Cliente <Teste>',payer_document:'456',project_name:'Sem projeto',contract_number:null,city:'São Paulo'},
};
const showReceiptWindow=loadHelpers(['receipt-view.js'],receiptDoc).window;
showReceiptWindow.CMEReceiptIdentity={fileStem:()=> 'recibo-teste'};
let savedReceipt=null;
showReceiptWindow.CMEReceiptView.showReceipt(receiptRow,value=>{savedReceipt=value;});
assert.equal(savedReceipt,receiptRow);
assert.match(receiptNodes.receiptPaper.innerHTML,/Cliente &lt;Teste&gt;/);
assert.doesNotMatch(receiptNodes.receiptPaper.innerHTML,/Cliente <Teste>/);
assert.equal(receiptNodes.receiptResult.hidden,false);
assert.ok(read('recibos.html').indexOf('js/receipt-view.js')<read('recibos.html').indexOf('js/recibos.js'));

console.log('Refatoração: 5 módulos comerciais, 2 do Portfólio, Financeiro e extrato validados com dados sintéticos.');
