import {toCents} from '@/lib/payment-allocation-model';
export type DueInstallment={installmentId:string;dueDate:string;remaining:number};
export type DraftInstallment={amount:number;dueDate:string};
export type Distribution={allocations:{installmentId:string;amount:number}[];applied:number;unallocated:number};

function parseIsoDate(value:string):Date{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('Informe a data no formato AAAA-MM-DD.');
  const date=new Date(value+'T12:00:00.000Z');
  if(Number.isNaN(date.valueOf())||date.toISOString().slice(0,10)!==value)throw new Error('Data de vencimento inválida.');
  return date;
}
function monthlyDate(year:number,month:number,day:number):string{
  const first=new Date(Date.UTC(year,month,1));
  const monthEnd=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  return new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),Math.min(day,monthEnd))).toISOString().slice(0,10);
}
/** Parcelamento em centavos; o 1º vencimento é preservado e o dia fica limitado ao fim de cada mês. */
export function buildMonthlyInstallments(amount:number,count:number,firstDueDate:string):DraftInstallment[]{
  const cents=toCents(amount),first=parseIsoDate(firstDueDate);
  if(cents<=0)throw new Error('Informe um valor contratual maior que zero.');
  if(!Number.isInteger(count)||count<1||count>60)throw new Error('Informe de 1 a 60 parcelas.');
  if(count>cents)throw new Error('O valor é insuficiente para gerar parcelas de ao menos R$ 0,01.');
  const base=Math.floor(cents/count),excess=cents%count;
  return Array.from({length:count},(_,i)=>({
    amount:(base+(i<excess?1:0))/100,
    dueDate:monthlyDate(first.getUTCFullYear(),first.getUTCMonth()+i,first.getUTCDate()),
  }));
}
/** Só distribui contra o saldo em aberto. A sobra é crédito e nunca baixa outra obrigação automaticamente. */
export function suggestPaymentDistribution(amount:number,installments:DueInstallment[]):Distribution{
  let available=toCents(amount);
  if(available<=0)throw new Error('O recebimento deve ser maior que zero.');
  const used=new Set<string>(),allocations:Distribution['allocations']=[];
  const ordered=[...installments].sort((a,b)=>a.dueDate.localeCompare(b.dueDate)||a.installmentId.localeCompare(b.installmentId));
  for(const item of ordered){
    if(used.has(item.installmentId))throw new Error('Parcelas duplicadas na distribuição.');
    used.add(item.installmentId);
    parseIsoDate(item.dueDate);
    const open=toCents(item.remaining);
    if(!open||!available)continue;
    const portion=Math.min(available,open);
    allocations.push({installmentId:item.installmentId,amount:portion/100});
    available-=portion;
  }
  return {allocations,applied:(toCents(amount)-available)/100,unallocated:available/100};
}
