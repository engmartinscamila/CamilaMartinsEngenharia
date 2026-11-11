import {groupStatementClients} from '@/lib/financial-grouping';
import {FinancialProjectGroups} from '@/components/financial-entry-groups';
import React from 'react';
import type { useThemeStyles } from '@/providers/theme-provider';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button, Card, Field, Notice, StateView, StatusPill } from '@/components/ui';
import { accountBalance, effectiveStatus, financialStatus, financialToday, financialTotals, type BankTransaction, type ReceivableStatement } from '@/lib/financial-model';
import { exportReceivableCsv } from '@/services/financial-tools';
import { SelectionChips } from '@/components/admin-ui';
import { receivableOverview, type ReceivableFocus } from '@/lib/receivable-priorities';
import type { FinancialIntegrityIssue } from '@/lib/financial-reconciliation';
import { formatCurrency, formatDate } from '@/lib/format';
import type { AdminContractSummary, FinancialAccountSummary, FinancialEntrySummary } from '@/types/domain';

type Styles = ReturnType<typeof useThemeStyles>;
export type FinancialSummaryProps = {
  styles:Styles; coreError:string|null; bankError:string|null; loading:boolean;
  monthTotals:ReturnType<typeof financialTotals>; statementTotal:number; missingContractValues:number;
  embeddedProjectId?:string|null; entries:FinancialEntrySummary[]; accounts:FinancialAccountSummary[];
  transactions:BankTransaction[]; goldColor:string;
  onMonthReceipts:()=>void; onPendingPayables:()=>void; onReceivables:()=>void; onNewEntry:()=>void; onInstallments:()=>void;
};
export function FinancialSummary({styles,coreError,bankError,loading,monthTotals,statementTotal,missingContractValues,embeddedProjectId,entries,accounts,transactions,onMonthReceipts,onPendingPayables,onReceivables,onNewEntry,onInstallments}:FinancialSummaryProps){
  const openInstallments=entries.filter(entry=>entry.type==='entrada'&&financialStatus(entry.status)==='pendente'&&(!embeddedProjectId||entry.projectId===embeddedProjectId));
  const lateInstallments=openInstallments.filter(entry=>effectiveStatus(entry)==='atrasado');
  return (
<>
        <Text style={styles.sectionTitle}>Resumo financeiro</Text>
        {!coreError&&!loading?<Card>
          <Text style={styles.title}>{openInstallments.length} parcela(s) a receber{lateInstallments.length?` • ${lateInstallments.length} em atraso`:''}</Text>
          <Button title="Dar baixa em parcelas" onPress={onInstallments} />
        </Card>:null}
        <View style={styles.metrics}>
          <Card style={styles.metric}><Text style={styles.metricLabel}>RECEBIDO NO MÊS</Text><Text style={styles.metricValue}>{coreError?'Indisponível':formatCurrency(monthTotals.received)}</Text><Button title="Ver recebimentos do mês" variant="ghost" onPress={onMonthReceipts} /></Card>
          <Card style={styles.metric}><Text style={styles.metricLabel}>SALDO A RECEBER</Text><Text style={styles.metricValue}>{coreError?'Indisponível':loading?'Carregando…':formatCurrency(statementTotal)}</Text><Button title="Abrir extrato a receber" variant="ghost" onPress={onReceivables} /></Card>
          <Card style={styles.metric}><Text style={styles.metricLabel}>A PAGAR</Text><Text style={styles.metricValue}>{coreError?'Indisponível':formatCurrency(financialTotals(entries.filter(entry=>!embeddedProjectId||entry.projectId===embeddedProjectId)).payable)}</Text><Button title="Ver pendências" variant="ghost" onPress={onPendingPayables} /></Card>
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
  statementFocus:ReceivableFocus; setStatementFocus:React.Dispatch<React.SetStateAction<ReceivableFocus>>;
  statementPage:number; setStatementPage:React.Dispatch<React.SetStateAction<number>>;
  expandedStatement:string|null; setExpandedStatement:React.Dispatch<React.SetStateAction<string|null>>;
  statementRows:ReceivableStatement[]; contracts:AdminContractSummary[]; integrityIssues:FinancialIntegrityIssue[]; bankError:string|null;
  loading:boolean; coreError:string|null; saving:boolean; goldColor:string;
  perform:(task:()=>Promise<void>)=>Promise<void>;
  openReceipt:(id:string,projectId?:string|null)=>void; receiveEntry:(entry:FinancialEntrySummary)=>void;
  onContractEdit:(id:string)=>void;
};
export function FinancialReceivables({styles,embeddedProjectId,missingContractValues,statementQuery,setStatementQuery,statementFocus,setStatementFocus,statementPage,setStatementPage,expandedStatement,setExpandedStatement,statementRows,contracts,integrityIssues,bankError,loading,coreError,saving,goldColor,perform,openReceipt,receiveEntry,onContractEdit}:FinancialReceivablesProps){
  const [expandedClients,setExpandedClients]=React.useState<Record<string,boolean>>({});
  const clientGroups=groupStatementClients(statementRows);
  return (
<>
        <Text style={styles.sectionTitle}>Extrato de saldo a receber</Text>
        {!loading&&!coreError?<Card>
          <Text style={styles.title}>Conferência automática de integridade</Text>
          {bankError?<Notice tone="warning">Os dados bancários não foram carregados integralmente; esta conferência não valida a conciliação de contas.</Notice>:null}
          {integrityIssues.length?<Notice tone="warning">{integrityIssues.length} ponto(s) para conferir no financeiro. Este aviso não altera lançamentos nem confirma perda de saldo.</Notice>:<Text style={styles.meta}>{bankError?'Nenhuma divergência nos dados carregados; validação incompleta.':'Nenhuma divergência nas verificações básicas. A conciliação completa depende de extrato bancário e comprovantes.'}</Text>}
          {integrityIssues.slice(0,5).map((issue,index)=><Text key={issue.code+'-'+(issue.entryId??'')+'-'+index} style={styles.meta}>• {issue.message}</Text>)}
          {integrityIssues.length>5?<Text style={styles.meta}>Há mais {integrityIssues.length-5} ocorrência(s); exporte e confira os lançamentos antes de regularizar.</Text>:null}
        </Card>:null}
        <Text style={styles.meta}>Saldo restante = valor contratado menos recebimentos. Parcelas pendentes fazem parte desse saldo. Serviços sem contrato usam os lançamentos pendentes. Valores de contratos cancelados ou arquivados ficam fora do total.</Text>
        {embeddedProjectId?<Notice tone="info">Exibindo o contrato completo do projeto selecionado, incluindo recebimentos de seus outros projetos.</Notice>:null}
        {missingContractValues>0?<Notice tone="warning">{missingContractValues} contrato(s) sem valor informado: o saldo completo desses contratos ainda não pode ser calculado. Use “Informar valor contratado” para completar.</Notice>:null}
        <SelectionChips label="Prioridade de cobrança" value={statementFocus} onChange={value=>{setStatementFocus(value);setStatementPage(0);}} items={[{value:'all',label:'Todos'},{value:'overdue',label:'Em atraso'},{value:'unplanned',label:'Sem parcelas'},{value:'credit',label:'Crédito excedente'},{value:'inactive',label:'Inativos'}]} />
        <Field label="Buscar cliente, projeto ou contrato no extrato" value={statementQuery} onChangeText={value=>{setStatementQuery(value);setStatementPage(0);}} />
        <Button title="Exportar resultado filtrado (CSV)" variant="secondary" disabled={Boolean(coreError)||loading} onPress={()=>void perform(()=>exportReceivableCsv(statementRows))} />
        {loading?<ActivityIndicator color={goldColor} />:coreError?<Notice tone="danger">Extrato indisponível. Atualize os dados para conferir os saldos.</Notice>:<>
          <Text style={styles.metricValue}>Saldo a receber: {formatCurrency(receivableOverview(statementRows).total)}</Text>
          <Text style={styles.meta}>Em atraso: {formatCurrency(receivableOverview(statementRows).overdue)} • Saldo sem parcelas: {formatCurrency(receivableOverview(statementRows).unplanned)} • Créditos a conferir: {formatCurrency(receivableOverview(statementRows).credit)}. Indicadores do filtro atual.</Text>
          {statementRows.length===0?<StateView title="Nenhum contrato ou recebimento neste filtro" description="Confira o cliente selecionado ou registre os serviços avulsos." icon="receipt-outline" />:clientGroups.slice(statementPage*25,statementPage*25+25).map(client=><Card key={client.id}>
            <Text style={styles.sectionTitle}>{client.name}</Text>
            <Text style={styles.meta}>{client.rows.length} contrato(s) / grupo(s) • Saldo a receber: {formatCurrency(receivableOverview(client.rows).total)}</Text>
            <Button title={expandedClients[client.id]?'Recolher cliente':'Ver contratos e projetos do cliente'} variant="secondary" onPress={()=>setExpandedClients(current=>({...current,[client.id]:!current[client.id]}))} />
            {expandedClients[client.id]?client.rows.map(row=><Card key={row.id}>
            <Text style={styles.title}>{row.clientName} • {row.contractNumber}</Text>
            {row.overdue>0&&!row.inactive?<Notice tone="warning">Cobrança prioritária: {formatCurrency(row.overdue)} em atraso.</Notice>:null}
            <Text style={styles.meta}>Contratado: {row.contractValue===null?'Não informado':formatCurrency(row.contractValue)}{row.addendumValue?` (inclui ${formatCurrency(row.addendumValue)} de aditivos aceitos)`:''} • Recebido: {formatCurrency(row.received)}</Text>
            <Text style={styles.title}>Saldo restante: {row.remaining===null?'Valor contratado não informado':formatCurrency(row.remaining)}</Text>
            <Text style={styles.meta}>Parcelas pendentes: {formatCurrency(row.pending)} • Em atraso: {formatCurrency(row.overdue)}</Text>
            {row.unscheduled!==null&&row.unscheduled>0?<Notice tone="warning">{formatCurrency(row.unscheduled)} do saldo ainda sem parcelas lançadas. Esse valor não foi lançado automaticamente.</Notice>:null}
            {row.remaining!==null&&row.pending>row.remaining?<Notice tone="warning">As parcelas pendentes excedem o saldo em {formatCurrency((Math.round(row.pending*100)-Math.round(row.remaining*100))/100)}. Confira os lançamentos.</Notice>:null}
            {row.contractValue===null&&contracts.some(contract=>contract.id===row.id)?<Button title="Informar valor contratado" variant="secondary" onPress={()=>onContractEdit(row.id)} />:null}
            {row.credit>0?<Notice tone="warning">Recebimentos excedem o valor contratado em {formatCurrency(row.credit)}. Confira o contrato e os pagamentos.</Notice>:null}
            {row.inactive?<Notice tone="info">Contrato cancelado ou arquivado: preservado para conferência, fora do total a receber.</Notice>:null}
            <Button title={expandedStatement===row.id?'Recolher parcelas':'Ver parcelas e recebimentos'} variant="secondary" onPress={()=>setExpandedStatement(expandedStatement===row.id?null:row.id)} />
            {expandedStatement===row.id?(row.entries.length===0?<Text style={styles.meta}>Ainda não há parcelas lançadas para este contrato.</Text>:<FinancialProjectGroups entries={row.entries} styles={styles} renderEntry={entry=><View key={entry.id} style={styles.summary}>
              <View style={{flex:1}}><Text style={styles.title}>{entry.description} • {formatCurrency(entry.amount)}</Text><Text style={styles.meta}>{effectiveStatus(entry)==='atrasado'?'Em atraso':financialStatus(entry.status)==='pago'?'Recebido':'Pendente'} • Vencimento: {formatDate(entry.dueDate)} • Recebimento: {formatDate(entry.paidAt)}</Text>
              {financialStatus(entry.status)==='pago'?<Button title="Emitir / abrir recibo" variant="secondary" onPress={()=>openReceipt(entry.id,entry.projectId)} />:<Button title="Dar baixa (registrar recebimento)" variant="secondary" disabled={saving} onPress={()=>receiveEntry(entry)} />}</View>
            </View>} />):null}
          </Card>):null}</Card>)}
          <View style={styles.rowFields}><Button title="Clientes anteriores" variant="ghost" disabled={statementPage===0} onPress={()=>setStatementPage(value=>value-1)} /><Text style={styles.meta}>Página {statementPage+1} • {clientGroups.length} cliente(s)</Text><Button title="Próximos clientes" variant="ghost" disabled={(statementPage+1)*25>=clientGroups.length} onPress={()=>setStatementPage(value=>value+1)} /></View>
        </>}
      </>
  );
}

export type InstallmentFocus='all'|'overdue'|'next30';
/** Parcelas a receber em lista direta: o que vence primeiro aparece no topo, com a baixa a um clique. */
export function pendingInstallments(entries:FinancialEntrySummary[],focus:InstallmentFocus,query:string,projectId?:string|null,today=financialToday()){
  const limit=new Date(`${today}T12:00:00`);limit.setDate(limit.getDate()+30);
  const in30=`${limit.getFullYear()}-${String(limit.getMonth()+1).padStart(2,'0')}-${String(limit.getDate()).padStart(2,'0')}`;
  const text=query.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
  return entries.filter(entry=>entry.type==='entrada'&&financialStatus(entry.status)==='pendente'
    &&(!projectId||entry.projectId===projectId)
    &&(focus==='all'||(focus==='overdue'?effectiveStatus(entry,today)==='atrasado':Boolean(entry.dueDate)&&entry.dueDate!<=in30))
    &&(!text||[entry.description,entry.clientName,entry.contractNumber,entry.projectName].join(' ').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().includes(text)))
    .sort((a,b)=>(a.dueDate||'9999-12-31').localeCompare(b.dueDate||'9999-12-31')||a.description.localeCompare(b.description,'pt-BR'));
}

export type FinancialInstallmentsProps={
  styles:Styles; entries:FinancialEntrySummary[]; embeddedProjectId?:string|null;
  loading:boolean; coreError:string|null; saving:boolean; goldColor:string;
  receiveEntry:(entry:FinancialEntrySummary)=>void; onNewEntry:()=>void;
};
export function FinancialInstallments({styles,entries,embeddedProjectId,loading,coreError,saving,goldColor,receiveEntry,onNewEntry}:FinancialInstallmentsProps){
  const [focus,setFocus]=React.useState<InstallmentFocus>('all');
  const [query,setQuery]=React.useState('');
  const [page,setPage]=React.useState(0);
  const today=financialToday();
  const rows=React.useMemo(()=>pendingInstallments(entries,focus,query,embeddedProjectId,today),[entries,focus,query,embeddedProjectId,today]);
  const overdue=rows.filter(entry=>effectiveStatus(entry,today)==='atrasado');
  const pageRows=rows.slice(page*20,page*20+20);
  return (
<>
        <Text style={styles.sectionTitle}>Dar baixa em parcelas</Text>
        <Text style={styles.meta}>Todas as parcelas em aberto, das mais antigas para as mais recentes. Use “Dar baixa” para confirmar o recebimento e emitir o recibo.</Text>
        <SelectionChips label="Mostrar" value={focus} onChange={value=>{setFocus(value as InstallmentFocus);setPage(0);}} items={[{value:'all',label:'Todas em aberto'},{value:'overdue',label:'Em atraso'},{value:'next30',label:'Vencem em até 30 dias'}]} />
        <Field label="Buscar cliente, contrato, projeto ou parcela" value={query} onChangeText={value=>{setQuery(value);setPage(0);}} />
        {loading?<ActivityIndicator color={goldColor} />:coreError?<Notice tone="danger">Parcelas indisponíveis. Atualize os dados para dar baixa.</Notice>:<>
          <Text style={styles.meta}>{rows.length} parcela(s) • {formatCurrency(rows.reduce((sum,entry)=>sum+entry.amount,0))}{overdue.length?` • ${overdue.length} em atraso (${formatCurrency(overdue.reduce((sum,entry)=>sum+entry.amount,0))})`:''}</Text>
          {rows.length===0?<StateView title="Nenhuma parcela em aberto neste filtro" description="Parcelas novas são lançadas pelo contrato ou em Movimentações → Novo lançamento." icon="checkmark-done-outline" />:pageRows.map(entry=>{
            const late=effectiveStatus(entry,today)==='atrasado';
            return <Card key={entry.id}>
              <View style={styles.summary}>
                <View style={{flex:1}}>
                  <Text style={styles.title}>{entry.clientName} • {formatCurrency(entry.amount)}</Text>
                  <Text style={styles.meta}>{entry.description}</Text>
                  <Text style={styles.meta}>{[entry.contractNumber,entry.projectName].filter(Boolean).join(' • ')}</Text>
                  <Text style={styles.meta}>Vencimento: {formatDate(entry.dueDate,'sem data')}</Text>
                </View>
                <StatusPill label={late?'Em atraso':'A vencer'} tone={late?'danger':'warning'} />
              </View>
              <Button title="Dar baixa (registrar recebimento)" disabled={saving} onPress={()=>receiveEntry(entry)} />
            </Card>;
          })}
          {rows.length>20?<View style={styles.rowFields}><Button title="Anteriores" variant="ghost" disabled={page===0} onPress={()=>setPage(value=>value-1)} /><Text style={styles.meta}>Página {page+1} de {Math.ceil(rows.length/20)}</Text><Button title="Próximas" variant="ghost" disabled={(page+1)*20>=rows.length} onPress={()=>setPage(value=>value+1)} /></View>:null}
        </>}
        <Button title="Lançar nova parcela" variant="ghost" onPress={onNewEntry} />
      </>
  );
}
