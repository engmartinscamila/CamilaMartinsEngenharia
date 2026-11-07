import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button, Card, Field, Notice, StateView } from '@/components/ui';
import { accountBalance, effectiveStatus, financialStatus, financialToday, financialTotals, type BankTransaction, type ReceivableStatement } from '@/lib/financial-model';
import { exportReceivableCsv } from '@/services/financial-tools';
import { formatCurrency, formatDate } from '@/lib/format';
import type { AdminContractSummary, FinancialAccountSummary, FinancialEntrySummary } from '@/types/domain';

type Styles = any; // O tema continua sendo controlado pela tela Financeiro.
export type FinancialSummaryProps = {
  styles:Styles; coreError:string|null; bankError:string|null; loading:boolean;
  monthTotals:ReturnType<typeof financialTotals>; statementTotal:number; missingContractValues:number;
  embeddedProjectId?:string|null; entries:FinancialEntrySummary[]; accounts:FinancialAccountSummary[];
  transactions:BankTransaction[]; goldColor:string;
  onMonthReceipts:()=>void; onPendingPayables:()=>void; onReceivables:()=>void; onNewEntry:()=>void;
};
export function FinancialSummary({styles,coreError,bankError,loading,monthTotals,statementTotal,missingContractValues,embeddedProjectId,entries,accounts,transactions,onMonthReceipts,onPendingPayables,onReceivables,onNewEntry}:FinancialSummaryProps){
  return (
<>
        <Text style={styles.sectionTitle}>Resumo financeiro</Text>
        <View style={styles.metrics}>
          <Card style={styles.metric}><Text style={styles.metricLabel}>RECEBIDO NO MÊS</Text><Text style={styles.metricValue}>{coreError?'Indisponível':formatCurrency(monthTotals.received)}</Text><Button title="Ver recebimentos do mês" variant="ghost" onPress={onMonthReceipts} /></Card>
          <Card style={styles.metric}><Text style={styles.metricLabel}>SALDO A RECEBER</Text><Text style={styles.metricValue}>{coreError?'Indisponível':loading?'Carregando…':formatCurrency(statementTotal)}</Text><Button title="Abrir extrato a receber" variant="ghost" onPress={onReceivables} /></Card>
          <Card style={styles.metric}><Text style={styles.metricLabel}>A PAGAR</Text><Text style={styles.metricValue}>{coreError?'Indisponível':formatCurrency(financialTotals(entries.filter(entry=>!embeddedProjectId||entry.projectId===embedded.projectId)).payable)}</Text><Button title="Ver pendências" variant="ghost" onPress={onPendingPayables} /></Card>
        </View>
        {missingContractValues>0?<Notice tone="warning">{missingContractValues} contrato(s) sem valor contratado informado. O total a receber inclui apenas os saldos conhecidos e as parcelas já lançadas desses contratos. Confira os valores no extrato.</Notice>:null}
        <Text style={styles.sectionTitle}>Saldos das contas</Text>
        {embeddedProjectId?<Text style={styles.meta}>Os saldos bancários são globais. O saldo contratual considera todo o contrato do projeto selecionado.</Text>:null}
        {accounts.length===0?<StateView title="Nenhuma conta cadastrada" description="Cadastre uma conta em Mais opções → Contas e OFX." icon="wallet-outline" />:accounts.map(account=><Card key={account.id}><Text style={styles.title}>{account.name}</Text><Text style={styles.metricValue}>{coreError||bankError?'Indisponível':accountBalance(account,entries,transactions)===null?'Referência de saldo não informada':formatCurrency(accountBalance(account,entries,transactions))}</Text></Card>)}
        <Button title="Novo lançamento" onPress={onNewEntry} />
      </>
  );
}

export type FinancialReceivablesProps = {
  styles:Styles; embeddedProjectId?:string|null; missingContractValues:number;
  statementQuery:string; setStatementQuery:React.Dispatch<React.SetStateAction<string>>;
  statementPage:number; setStatementPage:React.Dispatch<React.SetStateAction<number>>;
  expandedStatement:string|null; setExpandedStatement:React.Dispatch<React.SetStateAction<string|null>>;
  statementRows:ReceivableStatement[]; contracts:AdminContractSummary[];
  loading:boolean; coreError:string|null; saving:boolean; goldColor:string;
  perform:(task:()=>Promise<void>)=>Promise<void>;
  openReceipt:(id:string,projectId?:string|null)=>void; receiveEntry:(entry:FinancialEntrySummary)=>void;
  onContractEdit:(id:string)=>void;
};
export function FinancialReceivables({styles,embeddedProjectId,missingContractValues,statementQuery,setStatementQuery,statementPage,setStatementPage,expandedStatement,setExpandedStatement,statementRows,contracts,loading,coreError,saving,goldColor,perform,openReceipt,receiveEntry,onContractEdit}:FinancialReceivablesProps){
  return (
<>
        <Text style={styles.sectionTitle}>Extrato de saldo a receber</Text>
        <Text style={styles.meta}>Saldo restante = valor contratado menos recebimentos. Parcelas pendentes fazem parte desse saldo. Serviços sem contrato usam os lançamentos pendentes. Valores de contratos cancelados ou arquivados ficam fora do total.</Text>
        {embeddedProjectId?<Notice tone="info">Exibindo o contrato completo do projeto selecionado, incluindo recebimentos de seus outros projetos.</Notice>:null}
        {missingContractValues>0?<Notice tone="warning">{missingContractValues} contrato(s) sem valor informado: o saldo completo desses contratos ainda não pode ser calculado. Use “Informar valor contratado” para completar.</Notice>:null}
        <Field label="Buscar cliente ou contrato no extrato" value={statementQuery} onChangeText={value=>{setStatementQuery(value);setStatementPage(0);}} />
        <Button title="Exportar extrato a receber (CSV)" variant="secondary" disabled={Boolean(coreError)||loading} onPress={()=>void perform(()=>exportReceivableCsv(statementRows))} />
        {loading?<ActivityIndicator color={goldColor} />:coreError?<Notice tone="danger">Extrato indisponível. Atualize os dados para conferir os saldos.</Notice>:<>
          <Text style={styles.metricValue}>Saldo a receber: {formatCurrency(statementRows.filter(row=>!row.inactive).reduce((sum,row)=>sum+Math.round((row.remaining??row.pending)*100),0)/100)}</Text>
          {statementRows.length===0?<StateView title="Nenhum contrato ou recebimento neste filtro" description="Confira o cliente selecionado ou registre os serviços avulsos." icon="receipt-outline" />:statementRows.slice(statementPage*25,statementPage*25+25).map(row=><Card key={row.id}>
            <Text style={styles.title}>{row.clientName} • {row.contractNumber}</Text>
            <Text style={styles.meta}>Contratado: {row.contractValue===null?'Não informado':formatCurrency(row.contractValue)} • Recebido: {formatCurrency(row.received)}</Text>
            <Text style={styles.title}>Saldo restante: {row.remaining===null?'Valor contratado não informado':formatCurrency(row.remaining)}</Text>
            <Text style={styles.meta}>Parcelas pendentes: {formatCurrency(row.pending)} • Em atraso: {formatCurrency(row.overdue)}</Text>
            {row.unscheduled!==null&&row.unscheduled>0?<Notice tone="warning">{formatCurrency(row.unscheduled)} do saldo ainda sem parcelas lançadas. Esse valor não foi lançado automaticamente.</Notice>:null}
            {row.remaining!==null&&row.pending>row.remaining?<Notice tone="warning">As parcelas pendentes excedem o saldo em {formatCurrency((Math.round(row.pending*100)-Math.round(row.remaining*100))/100)}. Confira os lançamentos.</Notice>:null}
            {row.contractValue===null&&contracts.some(contract=>contract.id===row.id)?<Button title="Informar valor contratado" variant="secondary" onPress={()=>onContractEdit(row.id)} />:null}
            {row.credit>0?<Notice tone="warning">Recebimentos excedem o valor contratado em {formatCurrency(row.credit)}. Confira o contrato e os pagamentos.</Notice>:null}
            {row.inactive?<Notice tone="info">Contrato cancelado ou arquivado: preservado para conferência, fora do total a receber.</Notice>:null}
            <Button title={expandedStatement===row.id?'Recolher parcelas':'Ver parcelas e recebimentos'} variant="secondary" onPress={()=>setExpandedStatement(expandedStatement===row.id?null:row.id)} />
            {expandedStatement===row.id?(row.entries.length===0?<Text style={styles.meta}>Ainda não há parcelas lançadas para este contrato.</Text>:row.entries.map(entry=><View key={entry.id} style={styles.summary}>
              <View style={{flex:1}}><Text style={styles.title}>{entry.description} • {formatCurrency(entry.amount)}</Text><Text style={styles.meta}>{effectiveStatus(entry)==='atrasado'?'Em atraso':financialStatus(entry.status)==='pago'?'Recebido':'Pendente'} • Vencimento: {formatDate(entry.dueDate)} • Recebimento: {formatDate(entry.paidAt)}</Text>
              {financialStatus(entry.status)==='pago'?<Button title="Emitir / abrir recibo" variant="secondary" onPress={()=>openReceipt(entry.id,entry.projectId)} />:<Button title="Registrar recebimento" variant="secondary" disabled={saving} onPress={()=>receiveEntry(entry)} />}</View>
            </View>)):null}
          </Card>)}
          <View style={styles.rowFields}><Button title="Contratos anteriores" variant="ghost" disabled={statementPage===0} onPress={()=>setStatementPage(value=>value-1)} /><Text style={styles.meta}>Página {statementPage+1} • {statementRows.length} registro(s)</Text><Button title="Próximos contratos" variant="ghost" disabled={(statementPage+1)*25>=statementRows.length} onPress={()=>setStatementPage(value=>value+1)} /></View>
        </>}
      </>
  );
}
