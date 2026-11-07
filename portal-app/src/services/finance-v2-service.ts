import {env} from '@/lib/env';
import {supabase} from '@/lib/supabase';
import {reconcileLedger,toCents,type Ledger} from '@/lib/payment-allocation-model';
import {financialToday} from '@/lib/financial-model';
import {isValidIsoDate} from '@/lib/format';

/**
 * O V2 não pode consultar nem gravar no banco de produção enquanto o legado
 * não tiver sido reconciliado individualmente com o ledger.
 */
export const financeV2HomologationEnabled=env.isSupabaseConfigured
  && env.isHomologation && env.projectRef==='nvhjcoxnzigwwbdbhkhq';

export type FinanceV2Client={id:string;name:string};
export type FinanceV2Contract={id:string;clientId:string;number:string;amount:number|null};
export type FinanceV2Project={id:string;clientId:string|null;contractId:string|null;name:string};
export type FinanceV2Account={id:string;name:string};
export type FinanceV2Title={id:string;clientId:string;contractId:string|null;projectId:string|null;amount:number;createdAt:string};
export type FinanceV2Installment={id:string;receivableId:string;dueDate:string;amount:number;received:number;remaining:number};
export type FinanceV2Payment={id:string;clientId:string;accountId:string|null;amount:number;paidOn:string;method:string;reversed:boolean};
export type FinanceV2Snapshot={
 clients:FinanceV2Client[];contracts:FinanceV2Contract[];projects:FinanceV2Project[];accounts:FinanceV2Account[];
 titles:FinanceV2Title[];installments:FinanceV2Installment[];payments:FinanceV2Payment[];
 totalOpen:number;overdue:number;cashReceived:number;unallocatedCredit:number;
};
export type FinanceV2Result<T>={data:T|null;error:string|null};

const denied='Financeiro V2 disponível apenas na homologação validada. Nenhum lançamento de produção foi alterado.';
function fail<T>(error:string):FinanceV2Result<T>{return {data:null,error};}
async function readAll(table:string,columns:string,sort='id',secondary?:string):Promise<any[]>{
 const rows:any[]=[];
 for(let offset=0;offset<100000;offset+=500){
  let query=supabase.from(table).select(columns).order(sort);
  if(secondary)query=query.order(secondary);
  const result=await query.range(offset,offset+499);
  if(result.error)throw new Error('Falha ao carregar '+table+'. Nenhum total parcial será apresentado.');
  rows.push(...(result.data??[]));
  if((result.data??[]).length<500)return rows;
 }
 throw new Error('O conjunto excede 100 mil registros; a conferência foi interrompida para evitar saldos parciais.');
}
export async function loadFinanceV2Snapshot():Promise<FinanceV2Result<FinanceV2Snapshot>>{
 if(!financeV2HomologationEnabled)return fail(denied);
 try{
  const [clients,contracts,projects,accounts,titles,installments,payments,allocations,reversals]=await Promise.all([
   readAll('clientes','id,nome'),readAll('contratos','id,cliente_id,contract_number,contract_value'),
   readAll('projetos','id,cliente_id,contract_id,nome'),readAll('financial_accounts','id,name'),
   readAll('fin_v2_receivables','id,client_id,contract_id,project_id,amount,created_at'),
   readAll('fin_v2_installments','id,receivable_id,due_date,amount'),
   readAll('fin_v2_payments','id,request_id,client_id,account_id,amount,paid_on,payment_method'),
   readAll('fin_v2_allocations','payment_id,installment_id,amount','payment_id','installment_id'),
   readAll('fin_v2_reversals','payment_id,request_id,reason','payment_id')
  ]);
  const ledger:Ledger={
   receivables:titles.map(r=>({id:r.id,clientId:r.client_id,contractId:r.contract_id,amount:Number(r.amount)})),
   installments:installments.map(r=>({id:r.id,receivableId:r.receivable_id,dueDate:r.due_date,amount:Number(r.amount)})),
   payments:payments.map(r=>({id:r.id,clientId:r.client_id,amount:Number(r.amount),paidOn:r.paid_on,requestId:r.request_id,fingerprint:''})),
   allocations:allocations.map(r=>({paymentId:r.payment_id,installmentId:r.installment_id,amount:Number(r.amount)})),
   reversals:reversals.map(r=>({paymentId:r.payment_id,requestId:r.request_id,reason:r.reason,reversedAt:financialToday()}))
  };
  const summary=reconcileLedger(ledger,financialToday());
  const byInstallment=new Map(summary.receivables.flatMap(r=>r.installments.map(i=>[i.id,i] as const)));
  const reversed=new Set(reversals.map(r=>r.payment_id));
  const data:FinanceV2Snapshot={
   clients:clients.map(r=>({id:r.id,name:r.nome})),
   contracts:contracts.map(r=>({id:r.id,clientId:r.cliente_id,number:r.contract_number,amount:r.contract_value===null?null:Number(r.contract_value)})),
   projects:projects.map(r=>({id:r.id,clientId:r.cliente_id,contractId:r.contract_id,name:r.nome})),
   accounts:accounts.map(r=>({id:r.id,name:r.name})),
   titles:titles.map(r=>({id:r.id,clientId:r.client_id,contractId:r.contract_id,projectId:r.project_id,amount:Number(r.amount),createdAt:r.created_at})),
   installments:installments.map(r=>({
    id:r.id,receivableId:r.receivable_id,dueDate:r.due_date,amount:Number(r.amount),
    received:byInstallment.get(r.id)?.received??0,remaining:byInstallment.get(r.id)?.remaining??Number(r.amount)
   })),
   payments:payments.map(r=>({id:r.id,clientId:r.client_id,accountId:r.account_id,amount:Number(r.amount),paidOn:r.paid_on,method:r.payment_method,reversed:reversed.has(r.id)})),
   totalOpen:summary.totalOpen,overdue:summary.overdue,cashReceived:summary.cashReceived,unallocatedCredit:summary.unallocatedCredit
  };
  return {data,error:null};
 }catch(err){return fail(err instanceof Error?err.message:'Falha na reconciliação do Financeiro V2. Nenhum saldo parcial será apresentado.');}
}
export type FinanceV2TitleDraft={
 requestId:string;clientId:string;contractId:string|null;projectId:string|null;amount:number;
 installments:{amount:number;dueDate:string}[];
};
export type FinanceV2PaymentDraft={
 requestId:string;clientId:string;accountId:string|null;amount:number;paidOn:string;method:string;
 allocations:{installmentId:string;amount:number}[];
};
function validateId(value:string,label:string){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw Error(label+' inválido.');}
function validAmount(value:number,label:string){if(toCents(value)<=0)throw Error('Informe '+label+' positivo com até duas casas decimais.');}
async function callId(method:string,payload:Record<string,unknown>):Promise<FinanceV2Result<string>>{
 if(!financeV2HomologationEnabled)return fail(denied);
 const result=await supabase.rpc(method,payload);
 if(result.error||typeof result.data!=='string')return fail(result.error?.message??'Não foi possível confirmar a gravação. Reenvie usando o mesmo identificador de solicitação.');
 return {data:result.data,error:null};
}
export async function createFinanceV2Title(input:FinanceV2TitleDraft):Promise<FinanceV2Result<string>>{
 try{
  validateId(input.requestId,'Solicitação');validateId(input.clientId,'Cliente');
  if(input.contractId)validateId(input.contractId,'Contrato');
  if(input.projectId)validateId(input.projectId,'Projeto');
  validAmount(input.amount,'um valor de título');
  if(input.installments.length>60)throw Error('Máximo de 60 parcelas.');
  let scheduled=0;
  for(const part of input.installments){validAmount(part.amount,'uma parcela');if(!isValidIsoDate(part.dueDate))throw Error('Vencimento inválido.');scheduled+=toCents(part.amount);}
  if(scheduled>toCents(input.amount))throw Error('As parcelas ultrapassam o valor do título.');
  return callId('admin_fin_v2_create_receivable',{p_data:{
   request_id:input.requestId,client_id:input.clientId,contract_id:input.contractId,project_id:input.projectId,
   amount:input.amount,installments:input.installments.map(p=>({amount:p.amount,due_date:p.dueDate}))
  }});
 }catch(err){return fail(err instanceof Error?err.message:'Título inválido.');}
}
export async function recordFinanceV2Payment(input:FinanceV2PaymentDraft):Promise<FinanceV2Result<string>>{
 try{
  validateId(input.requestId,'Solicitação');validateId(input.clientId,'Cliente');
  if(input.accountId)validateId(input.accountId,'Conta');
  validAmount(input.amount,'um recebimento');
  if(!isValidIsoDate(input.paidOn)||input.paidOn>financialToday())throw Error('Data de recebimento inválida ou futura.');
  if(input.method.trim().length<2)throw Error('Informe o meio de pagamento.');
  const used=new Set<string>();
  let total=0;
  for(const part of input.allocations){
   validateId(part.installmentId,'Parcela');validAmount(part.amount,'uma alocação');
   if(used.has(part.installmentId))throw Error('Parcela repetida na mesma distribuição.');
   used.add(part.installmentId);total+=toCents(part.amount);
  }
  if(total>toCents(input.amount))throw Error('Distribuição maior que o recebimento.');
  return callId('admin_fin_v2_record_payment',{p_data:{
   request_id:input.requestId,client_id:input.clientId,account_id:input.accountId,amount:input.amount,
   paid_on:input.paidOn,payment_method:input.method.trim(),
   allocations:input.allocations.map(p=>({installment_id:p.installmentId,amount:p.amount}))
  }});
 }catch(err){return fail(err instanceof Error?err.message:'Recebimento inválido.');}
}
export async function reverseFinanceV2Payment(paymentId:string,requestId:string,reason:string):Promise<FinanceV2Result<string>>{
 try{
  validateId(paymentId,'Pagamento');validateId(requestId,'Solicitação');
  if(reason.trim().length<3)throw Error('Descreva o motivo do estorno (mínimo de três caracteres).');
  return callId('admin_fin_v2_reverse_payment',{p_payment_id:paymentId,p_request_id:requestId,p_reason:reason.trim()});
 }catch(err){return fail(err instanceof Error?err.message:'Estorno inválido.');}
}
