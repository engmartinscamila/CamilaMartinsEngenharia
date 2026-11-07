import React from 'react';
import {Text,View} from 'react-native';
import {Button,Card,Notice} from '@/components/ui';
import {formatCurrency} from '@/lib/format';
import type {LegacyAuditReport} from '@/lib/legacy-finance-audit';
import {useAppTheme} from '@/providers/theme-provider';

export function LegacyFinancialAuditPanel({report,error,loading,onContractEdit}:{
 report:LegacyAuditReport|null;error:string|null;loading:boolean;onContractEdit:(id:string)=>void;
}){
 const {colors}=useAppTheme();
 const title={color:colors.ink,fontSize:16,fontWeight:'700' as const};
 const subtitle={color:colors.ink,fontWeight:'600' as const};
 const details={color:colors.muted,fontSize:13};
 return <Card>
  <View style={{gap:10}}>
   <Text style={title}>Conciliação de lançamentos e recibos — legado</Text>
   <Text style={details}>Conferência somente de leitura. Recibos não criam uma segunda entrada no caixa e serviços avulsos não recebem contratos automaticamente.</Text>
   {loading?<Text style={details}>Conferindo todos os registros…</Text>:error?<Notice tone="danger">{error} Nenhum resultado parcial será apresentado.</Notice>:report?<>
    <Text style={details}>Lançamentos: {report.countEntries} • Recibos: {report.countReceipts} • Recibos conferidos: {report.confirmedReceiptLinks}</Text>
    <Text style={details}>Pagamentos sem recibo emitido: {report.paidWithoutReceipt} (emissão opcional; não equivale a pagamento não recebido).</Text>
    {report.migrationReady?<Notice tone="info">Vínculos básicos consistentes. A ativação do V2 ainda depende de backup restaurável, conciliação bancária e homologação.</Notice>
     :<Notice tone="warning">Migração automática bloqueada: existem {report.contractsMissingValue.length} contrato(s) sem valor, {report.unclassifiedEntries.length} lançamento(s) a classificar e {report.receiptIssues.length} divergência(s) de recibo.</Notice>}
    {report.contractsMissingValue.length?<View style={{gap:8}}>
     <Text style={subtitle}>Contratos que precisam de valor</Text>
     {report.contractsMissingValue.slice(0,20).map(contract=><View key={contract.id} style={{gap:4}}>
      <Text style={details}>{contract.clientName} • {contract.contractNumber}</Text>
      <Button title={'Informar valor • '+contract.contractNumber} variant="secondary" onPress={()=>onContractEdit(contract.id)} />
     </View>)}
     {report.contractsMissingValue.length>20?<Text style={details}>Outros contratos necessitam conferência. Consulte a listagem completa.</Text>:null}
    </View>:null}
    {report.unclassifiedEntries.length?<View style={{gap:6}}>
     <Text style={subtitle}>Lançamentos sem classificação contratual</Text>
     {report.unclassifiedEntries.slice(0,20).map(entry=><Text style={details} key={entry.id}>
      {entry.clientName} • {entry.projectName} • {formatCurrency(entry.amount)} • {entry.status} — confirmar se é serviço avulso
     </Text>)}
     {report.unclassifiedEntries.length>20?<Text style={details}>Há mais {report.unclassifiedEntries.length-20} lançamento(s) para conferir.</Text>:null}
    </View>:null}
    {report.receiptIssues.length?<View style={{gap:6}}>
     <Text style={subtitle}>Conferência de recibos</Text>
     {report.receiptIssues.slice(0,15).map((issue,index)=><Text key={issue.receiptId+'-'+index} style={details}>{issue.message}</Text>)}
     {report.receiptIssues.length>15?<Text style={details}>Mais {report.receiptIssues.length-15} divergência(s) no histórico.</Text>:null}
    </View>:null}
   </>:<Notice tone="warning">Conciliação indisponível. Atualize o extrato para refazer as verificações.</Notice>}
  </View>
 </Card>;
}
