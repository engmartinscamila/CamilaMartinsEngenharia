import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {randomUUID} from 'expo-crypto';
import {useRouter} from 'expo-router';
import {AdminPageHeader,SelectionChips} from '@/components/admin-ui';
import {DateField} from '@/components/date-field';
import {Button,Card,Field,Notice,Screen,StateView} from '@/components/ui';
import {buildMonthlyInstallments,suggestPaymentDistribution} from '@/lib/finance-v2-forms';
import {financialToday} from '@/lib/financial-model';
import {formatCurrency,parseBrazilianCurrency} from '@/lib/format';
import {useAppTheme} from '@/providers/theme-provider';
import {issueFinanceV2ReceiptReference,listFinanceV2ReceiptRecords,type FinanceV2ReceiptRecord} from '@/services/finance-v2-receipt-service';
import {
 financeV2HomologationEnabled,loadFinanceV2Snapshot,createFinanceV2Title,recordFinanceV2Payment,
 reverseFinanceV2Payment,type FinanceV2Snapshot,
} from '@/services/finance-v2-service';

const spacing=12;
const parseMoney=(value:string)=>parseBrazilianCurrency(value);
type RetryKey={fingerprint:string;id:string};
function requestIdFor(ref:React.MutableRefObject<RetryKey|null>,payload:unknown){
 const fingerprint=JSON.stringify(payload);
 if(ref.current?.fingerprint!==fingerprint)ref.current={fingerprint,id:randomUUID()};
 return ref.current.id;
}
export default function AdminFinanceV2Screen(){
 const router=useRouter();
 const {colors}=useAppTheme();
 const [data,setData]=useState<FinanceV2Snapshot|null>(null);
 const [receiptRecords,setReceiptRecords]=useState<FinanceV2ReceiptRecord[]|null>(null);
 const [receiptError,setReceiptError]=useState<string|null>(null);
 const [loading,setLoading]=useState(financeV2HomologationEnabled),[saving,setSaving]=useState(false);
 const [error,setError]=useState<string|null>(null),[message,setMessage]=useState<string|null>(null);
 const [clientQuery,setClientQuery]=useState(''),[clientId,setClientId]=useState<string|null>(null);
 const [contractId,setContractId]=useState<string|null>(null),[projectId,setProjectId]=useState<string|null>(null);
 const [titleAmount,setTitleAmount]=useState(''),[installmentCount,setInstallmentCount]=useState('1');
 const [firstDue,setFirstDue]=useState(financialToday());
 const [selectedTitle,setSelectedTitle]=useState<string|null>(null);
 const [paymentAmount,setPaymentAmount]=useState(''),[paidOn,setPaidOn]=useState(financialToday());
 const [paymentMethod,setPaymentMethod]=useState('Pix'),[paymentAccount,setPaymentAccount]=useState<string|null>(null);
 const [allocation,setAllocation]=useState<Record<string,string>>({});
 const [reverseTarget,setReverseTarget]=useState<string|null>(null),[reverseReason,setReverseReason]=useState('');
 const titleRequest=useRef<RetryKey|null>(null),paymentRequest=useRef<RetryKey|null>(null),reversalRequest=useRef<RetryKey|null>(null),receiptRequest=useRef<RetryKey|null>(null);
 const locked=useRef(false);
 const selected=data?.titles.find(t=>t.id===selectedTitle);
 const titleInstallments=useMemo(()=>[...(data?.installments??[])].filter(i=>i.receivableId===selectedTitle).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)),[data,selectedTitle]);
 const matchingClients=useMemo(()=>[...(data?.clients??[])].filter(c=>c.name.toLocaleLowerCase('pt-BR').includes(clientQuery.toLocaleLowerCase('pt-BR'))).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).slice(0,20),[data,clientQuery]);
 const linkedContracts=(data?.contracts??[]).filter(c=>c.clientId===clientId);
 const linkedProjects=(data?.projects??[]).filter(p=>p.clientId===clientId);
 const clientName=(id:string)=>data?.clients.find(c=>c.id===id)?.name??'Cliente não identificado';

 async function reload(){
  if(!financeV2HomologationEnabled)return;
  setLoading(true);
  const [result,referenceResult]=await Promise.all([loadFinanceV2Snapshot(),listFinanceV2ReceiptRecords()]);
  setLoading(false);
  setReceiptError(referenceResult.error);
  setReceiptRecords(referenceResult.data);
  if(result.error||!result.data){setData(null);setError(result.error??'Não foi possível conferir o extrato.');return;}
  setData(result.data);setError(null);
 }
 useEffect(()=>{
  if(!financeV2HomologationEnabled)return;
  let active=true;
  void Promise.all([loadFinanceV2Snapshot(),listFinanceV2ReceiptRecords()]).then(([result,referenceResult])=>{
   if(!active)return;
   setLoading(false);
   setReceiptError(referenceResult.error);
   setReceiptRecords(referenceResult.data);
   if(result.error||!result.data){setData(null);setError(result.error??'Não foi possível conferir o extrato.');return;}
   setData(result.data);setError(null);
  });
  return ()=>{active=false;};
 },[]);
 async function perform(task:()=>Promise<void>){
  if(locked.current)return;
  locked.current=true;setSaving(true);setError(null);setMessage(null);
  try{await task();}
  catch(e){setError(e instanceof Error?e.message:'Operação não concluída. Os dados informados foram preservados.');}
  finally{locked.current=false;setSaving(false);}
 }
 const titlePreview=useMemo(()=>{
  const amount=parseMoney(titleAmount),count=Number(installmentCount);
  if(amount===null||!Number.isInteger(count))return null;
  try{return buildMonthlyInstallments(amount,count,firstDue);}catch{return null;}
 },[titleAmount,installmentCount,firstDue]);
 const distribution=useMemo(()=>{
  const amount=parseMoney(paymentAmount);
  if(amount===null||amount<=0)return null;
  try{
   const allocated=titleInstallments.map(i=>({installmentId:i.id,amount:parseMoney(allocation[i.id]??'0')??0}));
   const applied=allocated.reduce((sum,i)=>sum+Math.round(i.amount*100),0);
   if(applied>Math.round(amount*100))return {invalid:true,unallocated:0,applied:applied/100};
   return {invalid:false,unallocated:(Math.round(amount*100)-applied)/100,applied:applied/100};
  }catch{return null;}
 },[allocation,paymentAmount,titleInstallments]);
 const openPayment=(id:string)=>{
  setSelectedTitle(id);setPaymentAmount('');setAllocation({});paymentRequest.current=null;
 };
 async function saveTitle(){
  if(!clientId||!titlePreview)throw Error('Selecione um cliente, valor, vencimento e parcelamento válidos.');
  const amount=parseMoney(titleAmount);
  if(amount===null)throw Error('Valor do título inválido.');
  const draft={clientId,contractId,projectId,amount,installments:titlePreview};
  const result=await createFinanceV2Title({...draft,requestId:requestIdFor(titleRequest,draft)});
  if(result.error)throw Error(result.error);
  titleRequest.current=null;setTitleAmount('');setInstallmentCount('1');
  setMessage('Título registrado somente na homologação. Nenhuma entrada foi incluída no caixa do sistema legado.');
  await reload();
 }
 async function savePayment(){
  if(!selected||!distribution||distribution.invalid)throw Error('Selecione um título e confira a distribuição.');
  const amount=parseMoney(paymentAmount);
  if(amount===null||amount<=0)throw Error('Valor de recebimento inválido.');
  const allocations=titleInstallments.map(i=>({installmentId:i.id,amount:parseMoney(allocation[i.id]??'0')??0})).filter(i=>i.amount>0);
  const draft={clientId:selected.clientId,accountId:paymentAccount,paidOn,method:paymentMethod,amount,allocations};
  const result=await recordFinanceV2Payment({...draft,requestId:requestIdFor(paymentRequest,draft)});
  if(result.error)throw Error(result.error);
  paymentRequest.current=null;setPaymentAmount('');setAllocation({});
  setMessage('Recebimento confirmado no ledger de homologação, sem duplicar entrada de caixa no legado.');
  await reload();
 }
 async function issueReceiptRecord(paymentId:string){
  if(receiptError||receiptRecords===null)throw Error('É necessário confirmar a leitura de todo o histórico de comprovantes antes da emissão.');
  const draft={paymentId};
  const requestId=requestIdFor(receiptRequest,draft);
  const result=await issueFinanceV2ReceiptReference(paymentId,requestId);
  if(result.error)throw Error(result.error);
  receiptRequest.current=null;
  setMessage('Comprovante administrativo de homologação vinculado ao pagamento. Nenhum lançamento adicional foi criado no caixa.');
  await reload();
 }
 async function saveReversal(){
  if(!reverseTarget)throw Error('Selecione um pagamento.');
  const draft={paymentId:reverseTarget,reason:reverseReason.trim()};
  const id=requestIdFor(reversalRequest,draft);
  const result=await reverseFinanceV2Payment(reverseTarget,id,reverseReason);
  if(result.error)throw Error(result.error);
  reversalRequest.current=null;setReverseTarget(null);setReverseReason('');
  setMessage('Estorno registrado e preservado no histórico de homologação.');
  await reload();
 }
 if(!financeV2HomologationEnabled)return <Screen>
  <AdminPageHeader title="Financeiro V2" description="Controles de homologação de parcelas e recebimentos" />
  <StateView icon="shield-checkmark-outline" title="Operação bloqueada no ambiente atual" description="As funcionalidades de gravação V2 só estão disponíveis com a conexão de homologação correta. Os registros de produção permanecem no financeiro atual." />
  <Button title="Voltar ao financeiro" variant="secondary" onPress={()=>router.replace('/admin/financial')} />
 </Screen>;
 return <Screen>
  <AdminPageHeader title="Financeiro V2 — homologação" description="Teste de títulos, parcelamento, pagamentos parciais e estornos. Não gera recibos definitivos nem movimenta o caixa do sistema legado." />
  <Notice tone="warning">AMBIENTE DE HOMOLOGAÇÃO. O lançamento experimental não substitui financeiro, contratos ou recibos da produção.</Notice>
  {error?<Notice tone="danger">{error}</Notice>:null}
  {message?<Notice tone="success">{message}</Notice>:null}
  <Button title="Retornar ao financeiro" variant="ghost" onPress={()=>router.replace('/admin/financial')} />
  <Button title="Atualizar saldos V2" loading={loading} variant="secondary" onPress={()=>void reload()} />
  {data?<View style={{gap:spacing}}>
   <Card>
    <Text style={{fontWeight:'700',color:colors.ink,fontSize:16}}>Conferência isolada</Text>
    <Text style={{color:colors.ink}}>A receber: {formatCurrency(data.totalOpen)} • Em atraso: {formatCurrency(data.overdue)}</Text>
    <Text style={{color:colors.ink}}>Recebido V2: {formatCurrency(data.cashReceived)} • Crédito não alocado: {formatCurrency(data.unallocatedCredit)}</Text>
    <Text style={{color:colors.muted}}>Esses números são exclusivos da homologação, nunca somados ao caixa ou extrato legados.</Text>
   </Card>
   <Card>
    <Text style={{fontWeight:'700',color:colors.ink,fontSize:16}}>1. Criar título e parcelas</Text>
    <Field label="Pesquisar cliente" placeholder="Nome" value={clientQuery} onChangeText={setClientQuery} />
    {clientId?<Text style={{color:colors.ink}}>Selecionado: {clientName(clientId)}</Text>:null}
    {!clientId?matchingClients.map(c=><Pressable key={c.id} accessibilityRole="button" accessibilityLabel={'Selecionar cliente '+c.name} style={{paddingVertical:8,borderBottomWidth:1,borderColor:colors.line}} onPress={()=>{setClientId(c.id);setContractId(null);setProjectId(null);setClientQuery('');titleRequest.current=null;}}>
      <Text style={{color:colors.ink}}>{c.name}</Text>
    </Pressable>):<Button title="Trocar cliente" variant="ghost" onPress={()=>{setClientId(null);setContractId(null);setProjectId(null);}} />}
    {clientId?<View style={{gap:spacing}}>
     <SelectionChips label="Contrato (opcional)" value={contractId??''} onChange={value=>{setContractId(value||null);setProjectId(null);}} items={[{value:'',label:'Sem contrato'},...linkedContracts.map(c=>({value:c.id,label:c.number}))]} />
     <SelectionChips label="Projeto (opcional)" value={projectId??''} onChange={value=>setProjectId(value||null)} items={[{value:'',label:'Sem projeto'},...linkedProjects.filter(p=>!contractId||!p.contractId||p.contractId===contractId).map(p=>({value:p.id,label:p.name}))]} />
    </View>:null}
    <Field label="Valor do título (R$)" keyboardType="decimal-pad" value={titleAmount} onChangeText={setTitleAmount} placeholder="Ex.: 1.250,00" />
    <Field label="Quantidade de parcelas (1 a 60)" keyboardType="numeric" value={installmentCount} onChangeText={setInstallmentCount} />
    <DateField label="Primeiro vencimento" value={firstDue} onChange={setFirstDue} />
    {titlePreview?<View style={{gap:4}}>
     {titlePreview.slice(0,8).map((p,i)=><Text key={i} style={{color:colors.muted}}>{i+1}ª parcela • {p.dueDate} • {formatCurrency(p.amount)}</Text>)}
     {titlePreview.length>8?<Text style={{color:colors.muted}}>Mais {titlePreview.length-8} parcela(s), geradas mensalmente.</Text>:null}
    </View>:<Notice tone="info">Preencha um valor positivo, a quantidade e a data para visualizar as parcelas.</Notice>}
    <Button title="Criar título em homologação" loading={saving} disabled={!clientId||!titlePreview} onPress={()=>void perform(saveTitle)} />
   </Card>
   <Card>
    <Text style={{fontWeight:'700',color:colors.ink,fontSize:16}}>2. Distribuir e registrar recebimento</Text>
    {data.titles.length===0?<Text style={{color:colors.muted}}>Nenhum título V2. Cadastre um título de teste acima.</Text>:
     data.titles.slice(-30).reverse().map(t=><Button key={t.id} title={(selectedTitle===t.id?'✓ ':'')+clientName(t.clientId)+' • '+formatCurrency(t.amount)} variant={selectedTitle===t.id?'primary':'secondary'} onPress={()=>openPayment(t.id)} />)}
    {selected?<View style={{gap:spacing}}>
     {titleInstallments.map(i=><View key={i.id} style={{gap:4}}>
      <Text style={{color:colors.ink}}>{i.dueDate} • Restante: {formatCurrency(i.remaining)}</Text>
      <Field label={'Alocar nesta parcela '+i.dueDate+' (R$)'} keyboardType="decimal-pad" value={allocation[i.id]??''} onChangeText={value=>{setAllocation(s=>({...s,[i.id]:value}));}} placeholder="0,00" />
     </View>)}
     <Field label="Total efetivamente recebido (R$)" keyboardType="decimal-pad" value={paymentAmount} onChangeText={setPaymentAmount} />
     <Button title="Distribuir automaticamente por vencimento" variant="secondary" disabled={!paymentAmount} onPress={()=>{
      try{
       const amount=parseMoney(paymentAmount);
       if(amount===null)throw Error('Informe um valor válido.');
       const d=suggestPaymentDistribution(amount,titleInstallments.map(i=>({installmentId:i.id,dueDate:i.dueDate,remaining:i.remaining})));
       setAllocation(Object.fromEntries(d.allocations.map(a=>[a.installmentId,a.amount.toFixed(2).replace('.',',')])));
       setError(null);
      }catch(e){setError(e instanceof Error?e.message:'Distribuição inválida.');}
     }} />
     {distribution?.invalid?<Notice tone="danger">As parcelas alocadas superam o recebimento informado.</Notice>:distribution&&distribution.unallocated>0?<Notice tone="warning">Crédito antecipado de {formatCurrency(distribution.unallocated)}. Não será atribuído a outras parcelas automaticamente.</Notice>:null}
     <DateField label="Data do pagamento confirmado" value={paidOn} onChange={setPaidOn} />
     <SelectionChips label="Meio de pagamento" value={paymentMethod} onChange={setPaymentMethod} items={[{value:'Pix',label:'Pix'},{value:'Transferência',label:'Transferência'},{value:'Dinheiro',label:'Dinheiro'},{value:'Cartão',label:'Cartão'},{value:'Boleto',label:'Boleto'}]} />
     <SelectionChips label="Conta de referência" value={paymentAccount??''} onChange={value=>setPaymentAccount(value||null)} items={[{value:'',label:'Não informada'},...data.accounts.map(a=>({value:a.id,label:a.name}))]} />
     <Button title="Confirmar recebimento em homologação" loading={saving} disabled={!paymentAmount||Boolean(distribution?.invalid)} onPress={()=>void perform(savePayment)} />
     <Notice tone="info">A emissão de recibo definitivo será integrada após a conciliação do histórico. Nenhum recibo ou lançamento legado será criado por esta operação.</Notice>
    </View>:null}
   </Card>
   <Card>
    <Text style={{fontWeight:'700',color:colors.ink,fontSize:16}}>3. Histórico de recebimentos e estornos</Text>
    {receiptError?<Notice tone="danger">{receiptError}</Notice>:<Text style={{color:colors.muted}}>Comprovantes administrativos V2 não são recibos definitivos e não geram outra movimentação financeira.</Text>}
    {data.payments.length===0?<Text style={{color:colors.muted}}>Ainda não há pagamentos V2.</Text>:data.payments.slice(-30).reverse().map(p=>{
     const record=receiptRecords?.find(r=>r.paymentId===p.id);
     return <View key={p.id} style={{gap:4,paddingVertical:6,borderBottomWidth:1,borderColor:colors.line}}>
      <Text style={{color:colors.ink}}>{clientName(p.clientId)} • {formatCurrency(p.amount)} • {p.paidOn}{p.reversed?' • Estornado':''}</Text>
      {record?<Text style={{color:colors.muted}}>Comprovante interno H-{record.referenceNumber} • {p.reversed?'pagamento estornado; histórico preservado':'vinculado ao pagamento'}</Text>:null}
      {!p.reversed&&!record?<Button title="Registrar comprovante interno (homologação)" disabled={saving||receiptRecords===null||Boolean(receiptError)} variant="secondary" onPress={()=>void perform(()=>issueReceiptRecord(p.id))} />:null}
      {!p.reversed?<Button title={reverseTarget===p.id?'Cancelar seleção de estorno':'Preparar estorno'} variant="secondary" onPress={()=>{setReverseTarget(reverseTarget===p.id?null:p.id);setReverseReason('');reversalRequest.current=null;}} />:null}
     </View>;
    })}
    {reverseTarget?<View style={{gap:spacing}}>
     <Notice tone="warning">O estorno preserva o registro do pagamento e devolve os valores às parcelas. Confirme a justificativa antes de prosseguir.</Notice>
     <Field label="Justificativa do estorno" multiline value={reverseReason} onChangeText={setReverseReason} />
     <Button title="Confirmar estorno em homologação" variant="danger" loading={saving} disabled={reverseReason.trim().length<3} onPress={()=>void perform(saveReversal)} />
    </View>:null}
   </Card>
  </View>:loading?<StateView title="Carregando" description="Conferindo todo o ledger de homologação." />:<StateView title="Extrato indisponível" description="O sistema bloqueou a exibição de totais parciais. Confira o aviso de erro e atualize os dados." />}
 </Screen>;
}
