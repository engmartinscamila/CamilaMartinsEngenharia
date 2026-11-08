import type {ScheduleBudgetItem} from '@/services/construction-schedule-budget-service';

/** Uma única regra de validação/cálculo para a prévia e para a gravação. */
export type ValidatedBudgetLine={
 code:string;quantity:number|null;unit:string|null;unit_cost:number|null;
 planned_cost:number|null;cost_source:string;cost:number;
};
export type BudgetValidation={
 total:number|null;valid:boolean;errors:string[];lines:ValidatedBudgetLine[];
 lineCosts:Record<string,number>;
};

type DecimalResult={scaled:number;value:number};
function localizedDecimal(text:string,decimals:2|4):DecimalResult|null{
 const value=text.trim();
 if(!value||/\s/.test(value))return null;
 // Entrada brasileira com vírgula (ex.: 1.234,56) ou decimal do banco com ponto (1234.56).
 const brazilian=new RegExp('^(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,\\d{1,'+decimals+'})?$');
 const decimal=new RegExp('^\\d+(?:\\.\\d{1,'+decimals+'})?$');
 let normalized:string;
 if(value.includes(',')){
  if(!brazilian.test(value))return null;
  normalized=value.replace(/\./g,'').replace(',','.');
 }else{
  if(!decimal.test(value))return null;
  normalized=value;
 }
 const [whole,fraction='']=normalized.split('.');
 const multiplier=10**decimals;
 const scaled=Number(whole)*multiplier+Number(fraction.padEnd(decimals,'0'));
 if(!Number.isSafeInteger(scaled)||scaled<0)return null;
 return {scaled,value:scaled/multiplier};
}
export function analyzeExecutionBudget(items:ScheduleBudgetItem[]):BudgetValidation{
 const errors:string[]=[];
 const lines:ValidatedBudgetLine[]=[];
 const lineCosts=Object.create(null) as Record<string,number>;
 let totalCents=0;
 const codes=new Set<string>();
 for(const item of items){
  const code=item.code.trim();
  if(!code||codes.has(code)){errors.push('Há códigos repetidos ou vazios no orçamento.');continue;}
  codes.add(code);
  const source=item.costSource.trim();
  const hasComposition=Boolean(item.quantity.trim()||item.unit.trim()||item.unitCost.trim());
  const quantity=localizedDecimal(item.quantity,4);
  const unitCost=localizedDecimal(item.unitCost,2);
  const direct=localizedDecimal(item.plannedCost,2);
  let cents:number|null=null;
  if(!source)errors.push('Atividade '+code+': informe a fonte do custo.');
  if(hasComposition){
   if(!quantity||quantity.scaled===0||!unitCost||!item.unit.trim()){
    errors.push('Atividade '+code+': composição requer quantidade positiva, unidade e preço unitário válidos.');
    continue;
   }
   const product=quantity.scaled*unitCost.scaled;
   if(!Number.isSafeInteger(product)){errors.push('Atividade '+code+': custo excede o limite de cálculo seguro.');continue;}
   cents=Math.round(product/10000);
  }else{
   if(!direct){errors.push('Atividade '+code+': informe custo total válido em reais.');continue;}
   cents=direct.scaled;
  }
  if(!Number.isSafeInteger(cents)||cents<0||totalCents>Number.MAX_SAFE_INTEGER-cents){
   errors.push('Atividade '+code+': o valor ultrapassa o limite financeiro seguro.');continue;
  }
  totalCents+=cents;lineCosts[code]=cents/100;
  lines.push({code,quantity:hasComposition?quantity!.value:null,unit:hasComposition?item.unit.trim():null,
   unit_cost:hasComposition?unitCost!.value:null,planned_cost:hasComposition?null:direct!.value,
   cost_source:source,cost:cents/100});
 }
 if(items.length===0)errors.push('O cronograma não possui atividades para orçar.');
 if(totalCents<=0)errors.push('Informe ao menos um custo de execução maior que zero.');
 return {total:errors.length===0?totalCents/100:null,valid:errors.length===0&&lines.length===items.length,
  errors,lines,lineCosts};
}
