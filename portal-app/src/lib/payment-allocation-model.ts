/**
 * Motor determinístico de liquidação financeira.
 *
 * Não altera o legado "financeiro": a integração SQL só deve ser habilitada
 * depois de migração auditada e conciliação de dados. Todas as quantias são
 * validadas e agregadas em centavos para evitar erros de ponto flutuante.
 */
export type Receivable={id:string;clientId:string;contractId:string|null;amount:number};
export type Installment={id:string;receivableId:string;amount:number;dueDate:string;cancelled?:boolean};
export type Payment={id:string;clientId:string;amount:number;paidOn:string;requestId:string;fingerprint:string};
export type Allocation={paymentId:string;installmentId:string;amount:number};
export type Reversal={paymentId:string;requestId:string;reason:string;reversedAt:string};
export type Ledger={receivables:Receivable[];installments:Installment[];payments:Payment[];allocations:Allocation[];reversals:Reversal[]};
export type PaymentDraft={
 id:string;clientId:string;amount:number;paidOn:string;requestId:string;
 allocations:{installmentId:string;amount:number}[];
};
export type InstallmentBalance={id:string;receivableId:string;original:number;received:number;remaining:number;overdue:number};
export type ReceivableBalance={id:string;clientId:string;contractId:string|null;original:number;received:number;remaining:number;unscheduled:number;overdue:number;installments:InstallmentBalance[]};

export function toCents(value:number):number{
  if(!Number.isFinite(value)||value<0||value>1_000_000_000_000||Math.abs(value*100-Math.round(value*100))>0.00001)
    throw new Error('Valor monetário inválido: informe reais com até duas casas decimais.');
  return Math.round(value*100);
}
const fromCents=(value:number)=>value/100;
const requirePositive=(value:number)=>{
  const centavos=toCents(value);
  if(centavos<=0)throw new Error('O valor deve ser maior que zero.');
  return centavos;
};
function validDate(value:string):boolean{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(value+'T00:00:00.000Z');
  return !Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===value;
}
function required(value:string,label:string){
  if(!value||!value.trim())throw new Error(label+' obrigatório.');
}
const fingerprint=(draft:PaymentDraft)=>JSON.stringify({
  clientId:draft.clientId,amount:toCents(draft.amount),paidOn:draft.paidOn,
  allocations:draft.allocations.map(a=>[a.installmentId,toCents(a.amount)])
    .sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),
});
export function reconcileLedger(ledger:Ledger,today:string):{receivables:ReceivableBalance[];cashReceived:number;unallocatedCredit:number;totalOpen:number;overdue:number}{
  if(!validDate(today))throw new Error('Data de referência inválida.');
  const receivableById=new Map<string,Receivable>();
  for(const r of ledger.receivables){
    required(r.id,'Recebível');required(r.clientId,'Cliente');requirePositive(r.amount);
    if(receivableById.has(r.id))throw new Error('Recebível duplicado.');
    receivableById.set(r.id,r);
  }
  const installmentsById=new Map<string,Installment>();
  const installmentsByReceivable=new Map<string,Installment[]>();
  for(const installment of ledger.installments){
    required(installment.id,'Parcela');requirePositive(installment.amount);
    if(!validDate(installment.dueDate))throw new Error('Vencimento inválido.');
    if(installmentsById.has(installment.id))throw new Error('Parcela duplicada.');
    if(!receivableById.has(installment.receivableId))throw new Error('Parcela sem título válido.');
    installmentsById.set(installment.id,installment);
    installmentsByReceivable.set(installment.receivableId,[...(installmentsByReceivable.get(installment.receivableId)||[]),installment]);
  }
  const paymentById=new Map<string,Payment>(),requests=new Set<string>();
  for(const payment of ledger.payments){
    required(payment.id,'Pagamento');required(payment.clientId,'Cliente do pagamento');required(payment.requestId,'Solicitação');
    requirePositive(payment.amount);
    if(!validDate(payment.paidOn)||payment.paidOn>today)throw new Error('Data de recebimento inválida.');
    if(paymentById.has(payment.id)||requests.has(payment.requestId))throw new Error('Pagamento ou solicitação duplicados.');
    paymentById.set(payment.id,payment);requests.add(payment.requestId);
  }
  const reversed=new Set<string>(),reversalRequests=new Set<string>();
  for(const reversal of ledger.reversals){
    if(!paymentById.has(reversal.paymentId))throw new Error('Estorno sem pagamento.');
    required(reversal.reason,'Motivo do estorno');required(reversal.requestId,'Solicitação do estorno');
    if(!validDate(reversal.reversedAt)||reversal.reversedAt>today)throw new Error('Data de estorno inválida.');
    if(reversed.has(reversal.paymentId)||reversalRequests.has(reversal.requestId))throw new Error('Estorno duplicado.');
    reversed.add(reversal.paymentId);reversalRequests.add(reversal.requestId);
  }
  const allocatedByPayment=new Map<string,number>(),allocatedByInstallment=new Map<string,number>();
  const pairs=new Set<string>();
  for(const allocation of ledger.allocations){
    const payment=paymentById.get(allocation.paymentId), installment=installmentsById.get(allocation.installmentId);
    if(!payment||!installment)throw new Error('Alocação sem pagamento ou parcela.');
    if(installment.cancelled)throw new Error('Parcela cancelada não pode receber pagamento.');
    const receivable=receivableById.get(installment.receivableId)!;
    if(receivable.clientId!==payment.clientId)throw new Error('Cliente do pagamento diverge do título.');
    const key=allocation.paymentId+'/'+allocation.installmentId;
    if(pairs.has(key))throw new Error('Alocação duplicada para o mesmo pagamento e parcela.');
    pairs.add(key);
    const cents=requirePositive(allocation.amount);
    allocatedByPayment.set(payment.id,(allocatedByPayment.get(payment.id)||0)+cents);
    if(!reversed.has(payment.id))allocatedByInstallment.set(installment.id,(allocatedByInstallment.get(installment.id)||0)+cents);
  }
  for(const payment of ledger.payments)
    if((allocatedByPayment.get(payment.id)||0)>toCents(payment.amount))
      throw new Error('Soma das alocações excede o pagamento.');
  for(const installment of ledger.installments)
    if((allocatedByInstallment.get(installment.id)||0)>toCents(installment.amount))
      throw new Error('Alocações excedem o saldo da parcela.');
  const receivables=ledger.receivables.map(receivable=>{
    const items=installmentsByReceivable.get(receivable.id)||[];
    let received=0,overdue=0,scheduled=0;
    const installments=items.map(item=>{
      if(!item.cancelled)scheduled+=toCents(item.amount);
      const receivedCents=item.cancelled?0:(allocatedByInstallment.get(item.id)||0);
      received+=receivedCents;
      const remainder=item.cancelled?0:toCents(item.amount)-receivedCents;
      const overdueCents=item.dueDate<today?remainder:0;
      overdue+=overdueCents;
      return {id:item.id,receivableId:receivable.id,original:item.amount,received:fromCents(receivedCents),remaining:fromCents(remainder),overdue:fromCents(overdueCents)};
    });
    const original=toCents(receivable.amount);
    if(received>original)throw new Error('Recebimentos excedem o valor do título.');
    if(scheduled>original)throw new Error('Parcelamento excede o valor do título.');
    return {id:receivable.id,clientId:receivable.clientId,contractId:receivable.contractId,
      original:fromCents(original),received:fromCents(received),remaining:fromCents(original-received),
      unscheduled:fromCents(original-scheduled),overdue:fromCents(overdue),installments};
  });
  const cashReceived=ledger.payments.reduce((sum,p)=>sum+(reversed.has(p.id)?0:toCents(p.amount)),0);
  const unallocated=ledger.payments.reduce((sum,p)=>sum+(reversed.has(p.id)?0:toCents(p.amount)-(allocatedByPayment.get(p.id)||0)),0);
  return {receivables,cashReceived:fromCents(cashReceived),unallocatedCredit:fromCents(unallocated),
    totalOpen:fromCents(receivables.reduce((sum,r)=>sum+toCents(r.remaining),0)),
    overdue:fromCents(receivables.reduce((sum,r)=>sum+toCents(r.overdue),0))};
}

/** Testa uma operação antes de persistir; a gravação real exige RPC transacional no banco. */
export function planPayment(ledger:Ledger,draft:PaymentDraft,today:string):Ledger{
  required(draft.id,'Identificador do pagamento');
  required(draft.clientId,'Cliente');
  required(draft.requestId,'Solicitação');
  requirePositive(draft.amount);
  if(!validDate(draft.paidOn)||draft.paidOn>today)throw new Error('Data do pagamento inválida.');
  const hash=fingerprint(draft);
  const replay=ledger.payments.find(p=>p.requestId===draft.requestId);
  if(replay){
    if(replay.fingerprint!==hash)throw new Error('Esta solicitação já foi usada com dados diferentes.');
    return ledger;
  }
  if(ledger.payments.some(p=>p.id===draft.id))throw new Error('Identificador do pagamento já utilizado.');
  const payment:Payment={id:draft.id,clientId:draft.clientId,requestId:draft.requestId,amount:draft.amount,paidOn:draft.paidOn,fingerprint:hash};
  const allocations=draft.allocations.map(item=>({paymentId:draft.id,installmentId:item.installmentId,amount:item.amount}));
  const updated={...ledger,payments:[...ledger.payments,payment],allocations:[...ledger.allocations,...allocations]};
  reconcileLedger(updated,today);
  return updated;
}
export function planReversal(ledger:Ledger,paymentId:string,requestId:string,reason:string,today:string):Ledger{
  required(paymentId,'Pagamento');required(requestId,'Solicitação');required(reason,'Motivo do estorno');
  const prior=ledger.reversals.find(item=>item.requestId===requestId);
  if(prior){
    if(prior.paymentId!==paymentId||prior.reason!==reason)throw new Error('Esta solicitação já pertence a outro estorno.');
    return ledger;
  }
  if(ledger.reversals.some(item=>item.paymentId===paymentId))throw new Error('O recebimento já foi estornado.');
  const next={...ledger,reversals:[...ledger.reversals,{paymentId,requestId,reason,reversedAt:today}]};
  reconcileLedger(next,today);
  return next;
}
export const emptyLedger=():Ledger=>({receivables:[],installments:[],payments:[],allocations:[],reversals:[]});
