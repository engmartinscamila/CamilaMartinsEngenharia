import { encode } from 'base64-arraybuffer';
import { Platform } from 'react-native';
import { isValidIsoDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { downloadBase64File } from '@/lib/download-generated-file';
import { categoryLabel, csvCell, financialToday, type BankTransaction } from '@/lib/financial-model';
import type { FinancialAccountSummary, FinancialArchiveSummary, FinancialEntrySummary, ServiceResult } from '@/types/domain';

export async function listBankTransactions():Promise<ServiceResult<BankTransaction[]>> {
  const rows:BankTransaction[]=[];
  for(let offset=0;;offset+=500){
    const result=await supabase.from('bank_transactions').select('id,account_id,transaction_date,amount,description,matched_financial_id')
      .order('transaction_date',{ascending:false}).order('id').range(offset,offset+499);
    if(result.error)return {data:[],error:'Não foi possível conferir todas as movimentações bancárias. Saldos indisponíveis.'};
    rows.push(...(result.data??[]).map(row=>({id:row.id,accountId:row.account_id,date:row.transaction_date,amount:Number(row.amount),description:row.description,matchedFinancialId:row.matched_financial_id})));
    if((result.data??[]).length<500)break;
    if(rows.length>=100000)return {data:[],error:'Há mais de 100 mil movimentos. Refine a consulta antes de calcular saldos.'};
  }
  return {data:rows,error:null};
}
export async function updateAccountReference(id:string,amount:number,date:string) {
  if(!Number.isFinite(amount)||!isValidIsoDate(date)||date>financialToday())return 'Informe um saldo e uma data de referência válidos.';
  const result=await supabase.from('financial_accounts').update({opening_balance:amount,opening_balance_date:date})
    .eq('id',id).select('id').maybeSingle();
  return result.error || !result.data ? 'Não foi possível confirmar a referência de saldo.' : null;
}
function activeRows(entries:FinancialEntrySummary[]){
  return entries.map(row=>({'Cliente':row.clientName,'Contrato':row.contractNumber,'Projeto':row.projectName,'Descrição':row.description,
    'Natureza':row.type,'Valor (R$)':row.amount,'Data':row.date,'Vencimento':row.dueDate,'Pagamento':row.paidAt,
    'Situação':row.status,'Categoria':categoryLabel(row.category),'Conta':row.accountId??'','Forma de pagamento':row.paymentMethod??'','Observações':row.notes??''}));
}
export async function exportFinancialCsv(entries:FinancialEntrySummary[]) {
  const rows=activeRows(entries),columns=Object.keys(rows[0]??{'Cliente':'','Contrato':'','Projeto':'','Descrição':'','Natureza':'','Valor (R$)':0,'Data':''});
  const csv='\ufeff'+[columns.map(csvCell).join(';'),...rows.map(row=>columns.map(key=>csvCell(row[key as keyof typeof row])).join(';'))].join('\r\n');
  await downloadBase64File(encode(new TextEncoder().encode(csv).buffer as ArrayBuffer),`financeiro-filtrado-${financialToday()}.csv`,'text/csv;charset=utf-8');
}
type XlsxApi={utils:{json_to_sheet:(rows:object[])=>unknown;book_new:()=>unknown;book_append_sheet:(book:unknown,sheet:unknown,name:string)=>void};write:(book:unknown,options:object)=>string};
let xlsxPromise:Promise<XlsxApi>|null=null;
async function xlsx(){
  if(Platform.OS!=='web')throw new Error('Use o CSV neste aplicativo ou abra o painel web para salvar em Excel.');
  const get=()=>(window as unknown as {XLSX?:XlsxApi}).XLSX;
  if(get())return get()!;
  xlsxPromise??=new Promise<XlsxApi>((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    const timer=setTimeout(()=>{script.remove();reject(new Error('O gerador de Excel demorou a responder. Tente novamente ou use CSV.'));},20000);
    script.onload=()=>{clearTimeout(timer);if(get())resolve(get()!);else reject(new Error('Gerador de Excel indisponível.'));};
    script.onerror=()=>{clearTimeout(timer);reject(new Error('Não foi possível carregar o Excel. Use CSV ou tente novamente.'));};document.head.appendChild(script);
  }).catch(error=>{xlsxPromise=null;throw error;});
  return xlsxPromise;
}
export async function exportFinancialExcel(entries:FinancialEntrySummary[],archive:FinancialArchiveSummary[],accounts:FinancialAccountSummary[]) {
  const api=await xlsx(),book=api.utils.book_new();
  const sheets:Record<string,object[]>={
    'Lançamentos ativos':activeRows(entries),
    'Histórico preservado':archive.map(row=>({'Cliente':row.clientName,'Contrato':row.contractNumber,'Descrição':row.description,'Natureza':row.type,'Valor':row.amount,'Data':row.date,'Arquivado em':row.archivedAt,'Motivo':row.reason})),
    'Contas':accounts.map(row=>({'Conta':row.name,'Tipo':row.accountType,'Saldo inicial':row.openingBalance,'Referência (fim do dia)':row.openingBalanceDate??'Não informada'})),
  };
  for(const [name,rows] of Object.entries(sheets))api.utils.book_append_sheet(book,api.utils.json_to_sheet(rows.length?rows:[{'Informação':'Nenhum registro.'}]),name);
  const content=api.write(book,{type:'base64',bookType:'xlsx',compression:true});
  await downloadBase64File(content,`financeiro-completo-${financialToday()}.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
