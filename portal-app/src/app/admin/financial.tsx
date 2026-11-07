import { FinancialSummary, FinancialReceivables } from '@/components/financial-overview';
import {useAdminModule} from '@/providers/admin-module-context';
import { useUnsavedForm } from '@/hooks/use-unsaved-form';
import { useNotificationProject } from '@/hooks/use-notification-project';
import { useLiveRefresh } from '@/hooks/use-live-refresh';
import React, { useCallback, useMemo, useState, useRef } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

import { AdminClientPicker } from '@/components/admin-client-picker';
import { AdminProjectPicker } from '@/components/admin-project-picker';
import { AdminPageHeader, SelectionChips } from '@/components/admin-ui';
import { DateField } from '@/components/date-field';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { randomUUID } from 'expo-crypto';
import { accountBalance, categoryLabel, effectiveStatus, entryDate, filterFinancialEntries, financialCategories, financialCategory, financialStatus, financialToday, financialTotals, receivableStatements, type BankTransaction } from '@/lib/financial-model';
import { exportFinancialCsv, exportFinancialExcel, exportReceivableCsv, listBankTransactions, updateAccountReference } from '@/services/financial-tools';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, isValidIsoDate, parseBrazilianCurrency } from '@/lib/format';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import {
  createAdminFinancialEntry,
  updateAdminFinancialEntry,
  deleteAdminFinancialEntry,
  listAdminClients,
  listAdminContracts,
  listAdminFinancialEntries,
  listAdminProjects,
  listFinancialArchive,
  updateAdminContractValue,
} from '@/services/admin-service';
import {
  createFinancialAccount,
  createFiscalDocument,
  createTimesheet,
  getAdminFinancialPreferences,
  listFinancialAccounts,
  listFiscalDocuments,
  listTimesheets,
  importOfxTransactions,
  updateAdminFinancialPreferences,
} from '@/services/operations-service';
import { financialStyleDefinitions } from '@/components/financial-styles';
import type {
  AdminClientSummary,
  AdminContractSummary,
  AdminProjectSummary,
  FinancialAccountSummary,
  FinancialArchiveSummary,
  FinancialEntrySummary,
  FiscalDocumentSummary,
  TimesheetSummary,
} from '@/types/domain';

function financialDateInput(value:string){return value.trim().replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '$3-$2-$1');}

export default function AdminFinancialScreen() {
  const embedded=useAdminModule();
  const [clients,setClients]=useState<AdminClientSummary[]>([]);
  const [entryLink,setEntryLink]=useState('client');
  const [entryErrors,setEntryErrors]=useState<Record<string,string>>({});
  const [entryClientId,setEntryClientId]=useState<string|null>(null);
  const [entryContractId,setEntryContractId]=useState<string|null>(null);
  const [contracts, setContracts] = useState<AdminContractSummary[]>([]);
  const [projects, setProjects] = useState<AdminProjectSummary[]>([]);
  const [entries, setEntries] = useState<FinancialEntrySummary[]>([]);
  const [archive, setArchive] = useState<FinancialArchiveSummary[]>([]);

  const [accounts, setAccounts] = useState<FinancialAccountSummary[]>([]);
  const [timesheets, setTimesheets] = useState<TimesheetSummary[]>([]);
  const [fiscalDocuments, setFiscalDocuments] = useState<FiscalDocumentSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [type, setType] = useState<'entrada' | 'saida'>('entrada');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(financialToday());
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('outros');
  const [entryStatus, setEntryStatus] = useState<'pendente' | 'pago' | 'cancelado'>('pendente');
  const [dueDate, setDueDate] = useState(financialToday());
  const [accountId, setAccountId] = useState<string | null>(null);
  const [contractValue, setContractValue] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<'bank' | 'cash' | 'credit'>('bank');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [timeHours, setTimeHours] = useState('');
  const [hourlyCost, setHourlyCost] = useState('');
  const [defaultHourlyRate, setDefaultHourlyRate] = useState('');
  const [hourlyRateEffectiveFrom, setHourlyRateEffectiveFrom] = useState('');
  const [hourlyRateReference, setHourlyRateReference] = useState('');
  const [timeDescription, setTimeDescription] = useState('');
  const [fiscalDescription, setFiscalDescription] = useState('');
  const [fiscalAmount, setFiscalAmount] = useState('');
  const [serviceCode, setServiceCode] = useState('');
  const [importingOfx, setImportingOfx] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [transactions,setTransactions]=useState<BankTransaction[]>([]);
  const [editing,setEditing]=useState<FinancialEntrySummary|null>(null);
  const [deleteTarget,setDeleteTarget]=useState<FinancialEntrySummary|null>(null);
  const [paidAt,setPaidAt]=useState(financialToday());
  const [paymentMethod,setPaymentMethod]=useState('');
  const [openingDate,setOpeningDate]=useState(financialToday());
  const [referenceAccount,setReferenceAccount]=useState<string|null>(null);
  const [localSection,setLocalSection]=useState('summary');
  const [formOpen,setFormOpen]=useState(false);
  const [statementQuery,setStatementQuery]=useState('');
  const [statementPage,setStatementPage]=useState(0);
  const [expandedStatement,setExpandedStatement]=useState<string|null>(null);
  const section=embedded?.subview??localSection;
  const setSection=(value:string)=>{if(embedded)embedded.onNavigate('financial',{view:value});else setLocalSection(value);};
  const [filters,setFilters]=useState({query:'',projectId:'',status:'',month:'',type:''});
  const [coreError,setCoreError]=useState<string|null>(null);
  const [bankError,setBankError]=useState<string|null>(null);
  const [archiveError,setArchiveError]=useState<string|null>(null);
  const [page,setPage]=useState(0);
  const [archivePage,setArchivePage]=useState(0);
  const [resetPhrase,setResetPhrase]=useState('');
  const [resetReady,setResetReady]=useState(false);
  const actionLock=useRef(false), requestId=useRef<string|null>(null), requestFingerprint=useRef('');
  async function perform(task:()=>Promise<void>){
    if(actionLock.current)return;actionLock.current=true;setSaving(true);
    try{await task();}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível concluir. Seus campos foram preservados.');}
    finally{actionLock.current=false;setSaving(false);}
  }
  const clearEntry=()=>{setEntryErrors({});setEditing(null);setDescription('');setAmount('');setNotes('');setCategory('outros');setDate(financialToday());setDueDate(financialToday());setEntryStatus('pendente');setPaidAt(financialToday());setPaymentMethod('');requestId.current=null;};
  const editEntry=(entry:FinancialEntrySummary)=>{
    setEditing(entry);setEntryLink(entry.projectId?'project':'client');setEntryClientId(entry.clientId??projects.find(p=>p.id===entry.projectId)?.clientId??null);setEntryContractId(entry.contractId??null);setSelectedProjectId(entry.projectId);setType(entry.type as 'entrada'|'saida');setDescription(entry.description);
    setAmount(entry.amount.toFixed(2).replace('.',','));setDate(entry.date??financialToday());setDueDate(entry.dueDate??'');setNotes(entry.notes??'');
    setCategory(financialCategory(entry.category));setEntryStatus(financialStatus(entry.status));setAccountId(entry.accountId);setPaidAt(entry.paidAt||entry.date||financialToday());
    setPaymentMethod(entry.paymentMethod??'');setFormOpen(true);setSection('entries');requestId.current=null;
  };
  const { colors } = useAppTheme();
  const styles = useThemeStyles(financialStyleDefinitions);
  useUnsavedForm(Boolean(description||amount||notes||accountName||timeHours||timeDescription||fiscalDescription||fiscalAmount||contractValue));

  const selectContext=useCallback((id:string)=>{setEntryLink('project');setSelectedProjectId(id);setFilters(current=>({...current,projectId:id}));setPage(0);},[]);
  useNotificationProject(projects, selectContext);

  const contextProjectId=embedded?.projectId;
  const load = useCallback(async () => {
    setLoading(true);
    try {
    const [contractResult, projectResult, entryResult, archiveResult, bankResult, accountResult, timeResult, fiscalResult, preferenceResult, clientResult] = await Promise.all([
      listAdminContracts(), listAdminProjects(), listAdminFinancialEntries(), listFinancialArchive(),
      listBankTransactions(), listFinancialAccounts(), listTimesheets(), listFiscalDocuments(), getAdminFinancialPreferences(), listAdminClients(),
    ]);
    setClients(clientResult.data);
    setContracts(contractResult.data);
    setProjects(projectResult.data);
    setEntries(entryResult.data);
    setArchive(archiveResult.data);
    setArchiveError(archiveResult.error);
    setTransactions(bankResult.data);
    setCoreError(clientResult.error ?? contractResult.error ?? projectResult.error ?? entryResult.error ?? timeResult.error);
    setBankError(bankResult.error ?? accountResult.error);
    setAccounts(accountResult.data);
    setTimesheets(timeResult.data);
    setFiscalDocuments(fiscalResult.data);
    const configuredRate = preferenceResult.data.defaultHourlyRate;
    setDefaultHourlyRate(configuredRate === null ? '' : String(configuredRate).replace('.', ','));
    setHourlyRateEffectiveFrom(preferenceResult.data.effectiveFrom ?? '');
    setHourlyRateReference(preferenceResult.data.referenceNote ?? '');
    setHourlyCost((current) => current || (configuredRate === null ? '' : String(configuredRate).replace('.', ',')));
    setSelectedProjectId((current) => current ?? null);
    setSelectedContractId((current) => contextProjectId ? projectResult.data.find(project=>project.id===contextProjectId)?.contractId ?? null : current ?? contractResult.data[0]?.id ?? null);
    setAccountId((current) => current ?? null);
    setError(clientResult.error ?? contractResult.error ?? projectResult.error ?? entryResult.error ?? archiveResult.error ?? bankResult.error ?? accountResult.error ?? timeResult.error ?? fiscalResult.error ?? preferenceResult.error);
    } catch { const message='Não foi possível atualizar os dados financeiros. Tente novamente.'; setError(message); setCoreError(message); setBankError(message); setArchiveError(message); }
    finally { setLoading(false); }
  }, [contextProjectId]);

  useLiveRefresh(load);

  const filteredEntries=useMemo(()=>filterFinancialEntries(entries,{...filters,projectId:embedded?.projectId??filters.projectId}),[entries,filters,embedded?.projectId]);
  const statements=useMemo(()=>receivableStatements(contracts,projects,entries,clients,embedded?.projectId??filters.projectId),[contracts,projects,entries,clients,embedded?.projectId,filters.projectId]);
  const statementRows=statements.filter(row=>[row.clientName,row.contractNumber].join(' ').toLocaleLowerCase('pt-BR').includes(statementQuery.trim().toLocaleLowerCase('pt-BR')));
  const missingContractValues=statements.filter(row=>!row.inactive&&row.contractValue===null&&contracts.some(contract=>contract.id===row.id)).length;
  const statementTotal=statements.filter(row=>!row.inactive).reduce((sum,row)=>sum+Math.round((row.remaining??row.pending)*100),0)/100;
  const monthTotals=financialTotals(entries.filter(entry=>(!embedded?.projectId||entry.projectId===embedded.projectId)&&entryDate(entry)?.startsWith(financialToday().slice(0,7))));
  const openReceipt=(id:string,projectId?:string|null)=>{const url='/recibos.html?financialId='+encodeURIComponent(id);if(embedded)embedded.onNavigate('receipts',{financialId:id,...(projectId?{projectId}:{})});else if(Platform.OS==='web')window.location.assign(url);else void Linking.openURL('https://camilamartinsengenharia.com.br'+url);};
  const receiveEntry=(entry:FinancialEntrySummary)=>{editEntry(entry);setEntryStatus('pago');setPaidAt(financialToday());};
  const totals=useMemo(()=>financialTotals(filteredEntries),[filteredEntries]);
  const visibleEntries=filteredEntries.slice(page*50,page*50+50);
  const summaries=useMemo(()=>contracts.filter(contract=>!embedded?.projectId||projects.some(project=>project.id===embedded.projectId&&project.contractId===contract.id)).map(contract=>{
    const linkedProjects=projects.filter(project=>project.contractId===contract.id);
    const ids=new Set(linkedProjects.map(project=>project.id));
    const values=financialTotals(entries.filter(entry=>entry.contractId===contract.id||(!entry.contractId&&entry.projectId&&ids.has(entry.projectId))));
    const hours=timesheets.filter(item=>ids.has(item.projectId));
    return {projectId:contract.id,projectName:linkedProjects.map(project=>project.name).join(' • '),contractNumber:contract.contractNumber,
      contractValue:contract.contractValue,received:values.received,receivable:values.receivable,paidCosts:values.paid,payable:values.payable,
      laborCost:hours.reduce((sum,item)=>sum+item.hours*item.hourlyCost,0)};
  }),[projects,entries,timesheets,contracts,embedded]);
  const setFilter=(key:keyof typeof filters,value:string)=>{setFilters(current=>({...current,[key]:value}));setPage(0);};
  const exportComplete=async()=>{
    if(coreError||bankError||archiveError)throw new Error('Atualize os dados e resolva as falhas de leitura antes de exportar o conjunto completo.');
    await exportFinancialExcel(entries,archive,accounts);setSuccess('Excel completo preparado para download, incluindo o histórico preservado.');
  };
  const deleteEntry=async()=>{
    if(!deleteTarget)return;
    const result=await deleteAdminFinancialEntry(deleteTarget.id);
    if(result){setError(result);return;}
    setDeleteTarget(null);setSuccess('Lançamento removido dos ativos. O histórico foi preservado.');await load();
  };
  const resetEntries=async()=>{
    if(!resetReady||resetPhrase!=='RESETAR FINANCEIRO')return;
    const result=await supabase.rpc('admin_reset_financial_data',{p_confirmation:resetPhrase,p_reason:'accounting_reset'});
    if(result.error){setError('A limpeza não foi confirmada. Atualize os dados antes de tentar novamente.');return;}
    setResetReady(false);setResetPhrase('');await load();setSuccess('Lançamentos ativos arquivados. O histórico permanece disponível.');
  };
  const saveEntry = async (withReceipt=false) => {
    setError(null); setSuccess(null);
    const parsed = parseBrazilianCurrency(amount);
    const dateValue=financialDateInput(date),dueValue=financialDateInput(dueDate),paidValue=financialDateInput(paidAt);
    const linkedProject=(embedded?.projectId||entryLink==='project')?projects.find(project=>project.id===selectedProjectId):null;
    const clientId=linkedProject?.clientId||((embedded?.projectId||entryLink==='project')?null:entryClientId);
    const contractId=linkedProject?.contractId||((embedded?.projectId||entryLink==='project')?null:entryContractId);
    const projectId=linkedProject?.id||null;
    const invalid:Record<string,string>={};
    if(!clientId)invalid.client=(embedded?.projectId||entryLink==='project')?'Selecione um projeto da lista ou use Cliente — contrato opcional para um serviço avulso.':'Selecione o cliente na lista. Contrato e projeto são opcionais neste modo.';
    if(description.trim().length<2)invalid.description='Preencha a descrição do lançamento com pelo menos 2 caracteres.';
    if(parsed===null||parsed<=0)invalid.amount='Informe um valor maior que zero. Exemplo: 500,00.';
    if(!isValidIsoDate(dateValue))invalid.date='Informe uma data válida para o lançamento (DD/MM/AAAA ou AAAA-MM-DD).';
    if(dueValue&&!isValidIsoDate(dueValue))invalid.dueDate='Informe uma data de vencimento válida ou deixe em branco.';
    if(entryStatus==='pago'&&paidValue&&!isValidIsoDate(paidValue))invalid.paidAt='Informe uma data efetiva de pagamento válida.';
    if(entryStatus==='pago'&&(paidValue||dateValue)>financialToday())invalid.paidAt='A data efetiva de pagamento não pode estar no futuro.';
    setEntryErrors(invalid);
    if(Object.keys(invalid).length||parsed===null){setError(Object.values(invalid).join(' '));return;}
    setSaving(true);
    const fingerprint=JSON.stringify({projectId,clientId,contractId,description,type,parsed,date,notes,category,entryStatus,dueDate,accountId,paidAt,paymentMethod});
    if(requestFingerprint.current!==fingerprint){requestId.current=null;requestFingerprint.current=fingerprint;}
    requestId.current ??= randomUUID();
    const input={projectId,clientId,contractId,description,type,amount:parsed,date:dateValue,notes,category,status:entryStatus,dueDate:dueValue,accountId,paidAt:entryStatus==='pago'?paidValue:'',paymentMethod,requestId:requestId.current};
    const result=editing ? await updateAdminFinancialEntry(editing.id,input) : await createAdminFinancialEntry(input);
    setSaving(false);
    if (result) setError(result);
    else { const receiptEntry=withReceipt&&editing&&type==='entrada'&&entryStatus==='pago'?editing:null; clearEntry(); setFormOpen(false); setSuccess('Lançamento administrativo confirmado.'); await load(); if(receiptEntry)openReceipt(receiptEntry.id,receiptEntry.projectId); }
  };

  const saveAccount = async () => {
    const balance = parseBrazilianCurrency(openingBalance);
    if (accountName.trim().length < 2 || balance === null || !isValidIsoDate(openingDate) || openingDate>financialToday()) { setError('Informe o nome e o saldo inicial da conta.'); return; }
    const actionError = await (referenceAccount ? updateAccountReference(referenceAccount,balance,openingDate) : createFinancialAccount(accountName, accountType, balance,openingDate));
    if (actionError) setError(actionError); else { setAccountName(''); setOpeningBalance('0'); setReferenceAccount(null); setSuccess('Conta e referência de saldo confirmadas.'); await load(); }
  };

  const saveDefaultHourlyRate = async () => {
    const parsed = defaultHourlyRate.trim() ? parseBrazilianCurrency(defaultHourlyRate) : null;
    if (defaultHourlyRate.trim() && (parsed === null || parsed < 0)) { setError('Informe uma taxa horária padrão válida ou deixe o campo em branco.'); return; }
    if (hourlyRateEffectiveFrom && !isValidIsoDate(hourlyRateEffectiveFrom)) { setError('Informe uma data de vigência válida.'); return; }
    setSaving(true); setError(null); setSuccess(null);
    const actionError = await updateAdminFinancialPreferences({
      defaultHourlyRate: parsed,
      effectiveFrom: hourlyRateEffectiveFrom || null,
      referenceNote: hourlyRateReference,
    });
    setSaving(false);
    if (actionError) setError(actionError);
    else {
      if (parsed !== null) setHourlyCost((current) => current || String(parsed).replace('.', ','));
      setSuccess('Referência de custo por hora salva. Novos apontamentos passam a sugerir esse valor, sem impedir ajuste manual.');
      await load();
    }
  };

  const saveTime = async () => {
    const hours = Number(timeHours.replace(',', '.')); const cost = parseBrazilianCurrency(hourlyCost);
    if (!selectedProjectId || !Number.isFinite(hours) || hours <= 0 || hours > 24 || cost === null || cost<0 || !isValidIsoDate(date) || timeDescription.trim().length < 3) {
      setError('Informe projeto, horas, custo/hora e descrição válidos.'); return;
    }
    const actionError = await createTimesheet({ projectId: selectedProjectId, workDate: date, hours, hourlyCost: cost, description: timeDescription });
    if (actionError) setError(actionError); else { setTimeHours(''); setHourlyCost(''); setTimeDescription(''); setSuccess('Horas registradas no custo do projeto.'); await load(); }
  };

  const saveFiscal = async () => {
    const value = parseBrazilianCurrency(fiscalAmount);
    if (!selectedProjectId || value === null || value <= 0 || fiscalDescription.trim().length < 3) {
      setError('Informe projeto, descrição e valor do documento fiscal.'); return;
    }
    const actionError = await createFiscalDocument({ projectId: selectedProjectId, description: fiscalDescription, amount: value, serviceCode });
    if (actionError) setError(actionError); else { setFiscalDescription(''); setFiscalAmount(''); setServiceCode(''); setSuccess('Rascunho fiscal registrado. Não houve emissão de NFS-e nem transmissão à prefeitura.'); await load(); }
  };

  const importOfx = async () => {
    if (!accountId) { setError('Selecione ou cadastre a conta bancária antes de importar o OFX.'); return; }
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false, type: ['application/x-ofx', 'application/octet-stream', 'text/plain'] });
    const asset = picked.canceled ? null : picked.assets[0] ?? null;
    if (!asset) return;
    setImportingOfx(true); setError(null); setSuccess(null);
    const result = await importOfxTransactions(accountId, asset);
    setImportingOfx(false);
    if (result.error) { await load(); setError(result.error); }
    else { setSuccess(`OFX importado: ${result.imported} nova(s) transação(ões) e ${result.reconciled} conciliação(ões) automática(s).`); await load(); }
  };

  const saveContractValue = async () => {
    setError(null); setSuccess(null);
    const parsed = parseBrazilianCurrency(contractValue);
    if (!selectedContractId || parsed === null || parsed < 0) { setError('Selecione o contrato e informe um valor válido.'); return; }
    setSaving(true);
    const result = await updateAdminContractValue(selectedContractId, parsed);
    setSaving(false);
    if (result) setError(result);
    else { setSuccess('Valor contratado atualizado.'); setContractValue(''); await load(); }
  };

  return (
    <Screen>
      <AdminPageHeader title="Financeiro" description="Confira os saldos, registre recebimentos e emita seus recibos." />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}
      {loading ? <ActivityIndicator color={colors.gold600} /> : null}
      {!embedded ? <SelectionChips label="Área financeira" value={section} onChange={value=>{setSection(value);setError(null);setSuccess(null);}}
        items={[{value:'summary',label:'Resumo'},{value:'receivables',label:'A receber'},{value:'entries',label:'Movimentações'},{value:'accounts',label:'Contas e OFX'},{value:'hours',label:'Horas e margem'},{value:'history',label:'Histórico e exportações'},{value:'fiscal',label:'Rascunhos fiscais'}]} /> : null}
      {!embedded ? <Button title="Emissão de recibos — Word e PDF" variant="secondary" onPress={()=>{if(Platform.OS==='web')window.location.assign('/recibos.html');else void Linking.openURL('https://camilamartinsengenharia.com.br/recibos.html');}} /> : null}
      {section==='summary'?<FinancialSummary styles={styles} coreError={coreError} bankError={bankError} loading={loading} monthTotals={monthTotals} statementTotal={statementTotal} missingContractValues={missingContractValues} embeddedProjectId={embedded?.projectId} entries={entries} accounts={accounts} transactions={transactions} goldColor={colors.gold600}
        onMonthReceipts={()=>{setFilters({query:'',projectId:embedded?.projectId??'',status:'pago',month:financialToday().slice(0,7),type:'entrada'});setPage(0);setSection('entries');}}
        onPendingPayables={()=>{setFilters({query:'',projectId:embedded?.projectId??'',status:'aberto',month:'',type:'saida'});setPage(0);setSection('entries');}}
        onReceivables={()=>setSection('receivables')} onNewEntry={()=>{clearEntry();setFormOpen(true);setSection('entries');}} />:null}
      {section==='receivables'?<FinancialReceivables styles={styles} embeddedProjectId={embedded?.projectId} missingContractValues={missingContractValues} statementQuery={statementQuery} setStatementQuery={setStatementQuery} statementPage={statementPage} setStatementPage={setStatementPage} expandedStatement={expandedStatement} setExpandedStatement={setExpandedStatement} statementRows={statementRows} contracts={contracts} loading={loading} coreError={coreError} saving={saving} goldColor={colors.gold600}
        perform={perform} openReceipt={openReceipt} receiveEntry={receiveEntry} onContractEdit={id=>{setSelectedContractId(id);setContractValue('');setSection('hours');}} />:null}
      {section==='entries'?<>
      <Card><Text style={styles.sectionTitle}>Filtrar lançamentos e indicadores</Text>
        <Field label="Buscar cliente, contrato, projeto ou descrição" value={filters.query} onChangeText={value=>setFilter('query',value)} />
        {!embedded ? <SelectionChips label="Projeto / contrato" value={filters.projectId} onChange={value=>setFilter('projectId',value)} items={[{value:'',label:'Todos'},...projects.map(project=>({value:project.id,label:`${project.contractNumber} • ${project.clientName} • ${project.name}`}))]} /> : null}
        <SelectionChips label="Tipo de movimentação" value={filters.type} onChange={value=>setFilter('type',value)} items={[{value:'',label:'Todas'},{value:'entrada',label:'Entradas'},{value:'saida',label:'Saídas'}]} />
        <SelectionChips label="Situação do lançamento" value={filters.status} onChange={value=>setFilter('status',value)} items={[{value:'',label:'Todas'},{value:'pago',label:'Recebidos / pagos'},{value:'aberto',label:'Em aberto'},{value:'pendente',label:'Pendentes a vencer'},{value:'atrasado',label:'Em atraso'},{value:'cancelado',label:'Cancelados'}]} />
        <Field label="Mês (AAAA-MM)" placeholder="Ex.: 2026-10" value={filters.month} onChangeText={value=>setFilter('month',value)} />
        <Text style={styles.meta}>O mês usa a data de pagamento para quitados e o vencimento para pendentes. Cancelados não entram nos totais.</Text>
        <Button title="Limpar filtros" variant="ghost" onPress={()=>{setFilters({query:'',projectId:embedded?.projectId??'',status:'',month:'',type:''});setPage(0);}} />
      </Card>
      <View style={styles.metrics}>{[
        ['RECEBIDO',totals.received],['PAGO',totals.paid],['SALDO REALIZADO',totals.balance],
        ['A RECEBER',totals.receivable],['A PAGAR',totals.payable],['RESULTADO PREVISTO',totals.forecast],
      ].map(([label,value])=><Card key={String(label)} style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{coreError?'Indisponível':formatCurrency(Number(value))}</Text></Card>)}</View>
      <Button title="Novo lançamento" onPress={()=>{clearEntry();setFormOpen(true);}} />
      {formOpen?<Card>
        <Text style={styles.sectionTitle}>{editing?"Editar lançamento":"Novo lançamento"}</Text>
        <SelectionChips items={[{ value: 'entrada', label: 'Entrada' }, { value: 'saida', label: 'Saída' }]} label="Natureza" onChange={value=>{setType(value);requestId.current=null;}} value={type} />
        <SelectionChips items={[{ value: 'pendente', label: 'Pendente' }, { value: 'pago', label: type === 'entrada' ? 'Recebido' : 'Pago' },{value:'cancelado',label:'Cancelado'}]} label="Situação" onChange={value=>{setEntryStatus(value);requestId.current=null;}} value={entryStatus} />
        {!embedded?.projectId?<SelectionChips label="Vincular lançamento a" value={entryLink} onChange={value=>{setEntryLink(value);requestId.current=null;}} items={[{value:'client',label:'Cliente — contrato opcional'},{value:'project',label:'Contrato e projeto'}]} />:null}
        {embedded?.projectId||entryLink==='project'?<AdminProjectPicker projects={projects.filter(project=>!embedded?.projectId||project.id===embedded.projectId||project.id===editing?.projectId)} value={selectedProjectId} onChange={id=>{setSelectedProjectId(id);requestId.current=null;}} />:<>
          <AdminClientPicker clients={clients} contracts={contracts} value={entryClientId} onChange={id=>{setEntryLink('client');setEntryClientId(id);setEntryContractId(null);setEntryErrors({});requestId.current=null;}} />
          {entryClientId?<SelectionChips label="Contrato (opcional)" value={entryContractId??''} onChange={id=>{setEntryContractId(id||null);requestId.current=null;}} items={[{value:'',label:'Sem contrato — serviço avulso'},...contracts.filter(contract=>contract.clientId===entryClientId).map(contract=>({value:contract.id,label:contract.contractNumber}))]} />:null}
          {entryErrors.client?<Notice tone="warning">{entryErrors.client}</Notice>:null}
          <Text style={styles.meta}>Você pode registrar a receber ou recebido sem cadastrar contrato ou projeto.</Text>
        </>}
        <Button title="Emitir recibo de serviço sem projeto" variant="ghost" debounceMs={0} onPress={()=>{if(embedded)embedded.onNavigate('receipts');else if(Platform.OS==='web')window.location.assign('/recibos.html');else void Linking.openURL('https://camilamartinsengenharia.com.br/recibos.html');}} />
        <Field label="Descrição" error={entryErrors.description} onChangeText={value=>{setDescription(value);setEntryErrors(current=>({...current,description:''}));requestId.current=null;}} placeholder="Ex.: Parcela 2 do contrato" value={description} />
        <Text style={styles.label}>Categoria / centro de custo</Text><View nativeID="financialEntryCategories" style={styles.selector}>{[...financialCategories,...(financialCategories.some(item=>item.value===category)?[]:[{value:category,label:category}])].map((item) => <Pressable accessibilityRole="button" key={item.value} onPress={() => {setCategory(item.value);requestId.current=null;}} style={[styles.choice, category === item.value && styles.choiceSelected]}><Text style={[styles.choiceText, category === item.value && styles.choiceTextSelected]}>{item.label}</Text></Pressable>)}</View>
        <Field keyboardType="decimal-pad" label="Valor (R$)" error={entryErrors.amount} onChangeText={value=>{setAmount(value);setEntryErrors(current=>({...current,amount:''}));requestId.current=null;}} placeholder="Ex.: 2.500,00" value={amount} />
        <View style={styles.rowFields}><DateField label="Data" onChange={value=>{setDate(value);requestId.current=null;}} value={date} /><DateField label="Vencimento" optional onChange={value=>{setDueDate(value);requestId.current=null;}} value={dueDate} /></View>
        {accounts.length ? <><Text style={styles.label}>Conta</Text><View style={styles.selector}>{accounts.map((account) => <Pressable accessibilityRole="button" key={account.id} onPress={() => {setAccountId(account.id);requestId.current=null;}} style={[styles.choice, accountId === account.id && styles.choiceSelected]}><Text style={[styles.choiceText, accountId === account.id && styles.choiceTextSelected]}>{account.name} • {account.accountType}</Text></Pressable>)}</View></> : <Notice tone="warning">Cadastre uma conta para conciliar os lançamentos.</Notice>}
        {entryStatus==='pago'?<DateField label="Data efetiva de pagamento / recebimento" optional={entryStatus!=='pago'} value={paidAt} onChange={value=>{setPaidAt(value);requestId.current=null;}} />:null}
        {entryErrors.date||entryErrors.dueDate||entryErrors.paidAt?<Notice tone="warning">{[entryErrors.date,entryErrors.dueDate,entryErrors.paidAt].filter(Boolean).join(' ')}</Notice>:null}
        <Field label="Forma de pagamento" value={paymentMethod} onChangeText={value=>{setPaymentMethod(value);requestId.current=null;}} />
        <Button title="Sem conta vinculada" variant="ghost" onPress={()=>{setAccountId(null);requestId.current=null;}} />
        <Field label="Observações (opcional)" multiline onChangeText={value=>{setNotes(value);requestId.current=null;}} value={notes} />
        {editing&&type==='entrada'&&entryStatus==='pago'?<Button loading={saving} title="Confirmar recebimento e emitir recibo" variant="secondary" onPress={()=>void perform(()=>saveEntry(true))} />:null}
        <Button loading={saving} onPress={() => void perform(saveEntry)} title={editing?"Confirmar alterações":"Registrar no extrato administrativo"} />
        <Button title="Cancelar edição / limpar formulário" variant="ghost" onPress={()=>{clearEntry();setFormOpen(false);}} />
      </Card>:null}
      <Text style={styles.sectionTitle}>Lançamentos atuais • {filteredEntries.length} resultado(s)</Text>
      <Button title="Exportar CSV do filtro" variant="secondary" disabled={Boolean(coreError)} onPress={()=>void perform(()=>exportFinancialCsv(filteredEntries))} />
      {visibleEntries.length===0?<StateView title="Nenhum lançamento neste filtro" description="Ajuste os filtros ou registre um lançamento." icon="receipt-outline" />:null}
      {visibleEntries.map(entry=><Card key={entry.id}><Text style={styles.title}>{entry.description}</Text><Text style={styles.meta}>{entry.clientName} • {entry.contractNumber} • {entry.projectName}</Text>
        <Text style={styles.meta}>{entry.type==='saida'?'Saída':'Entrada'} • {formatCurrency(entry.amount)} • {effectiveStatus(entry)} • {categoryLabel(entry.category)} • {formatDate(entryDate(entry))}</Text>
        <Text style={styles.meta}>{entry.notes}</Text>
        {entry.type==='entrada'&&financialStatus(entry.status)==='pago'?<Button debounceMs={0} title="Emitir / abrir recibo deste recebimento" variant="secondary" onPress={()=>openReceipt(entry.id,entry.projectId)} />:null}
        {entry.type==='entrada'&&financialStatus(entry.status)==='pendente'?<Button title="Registrar recebimento" variant="secondary" disabled={saving} onPress={()=>receiveEntry(entry)} />:null}
        {entry.bankTransactionId?<Notice tone="info">Lançamento conciliado. O vínculo bancário foi preservado.</Notice>:<View style={styles.rowFields}><Button title="Editar lançamento" variant="secondary" disabled={saving} onPress={()=>editEntry(entry)} /><Button title="Excluir dos ativos" variant="ghost" disabled={saving} onPress={()=>setDeleteTarget(entry)} /></View>}
      </Card>)}
      <View style={styles.rowFields}><Button title="Página anterior" disabled={page===0} variant="ghost" onPress={()=>setPage(value=>value-1)} /><Text style={styles.meta}>Página {page+1}</Text><Button title="Próxima página" disabled={(page+1)*50>=filteredEntries.length} variant="ghost" onPress={()=>setPage(value=>value+1)} /></View>
      {deleteTarget?<Card><Notice tone="warning">Excluir “{deleteTarget.description}” dos ativos? O registro ficará no histórico preservado. Lançamentos conciliados não podem ser excluídos aqui.</Notice><Button title="Confirmar exclusão dos ativos" loading={saving} onPress={()=>void perform(deleteEntry)} /><Button title="Cancelar exclusão" variant="ghost" onPress={()=>setDeleteTarget(null)} /></Card>:null}
      </>:null}
      {section==='accounts'?<Card>
          <Text style={styles.sectionTitle}>{referenceAccount?'Conferir referência de saldo':'Contas e saldos'}</Text>
          <SelectionChips label="Conta para importação OFX" value={accountId??''} onChange={value=>setAccountId(value||null)} items={[{value:'',label:'Selecione'},...accounts.map(account=>({value:account.id,label:account.name}))]} />
          {!referenceAccount ? <SelectionChips items={[{ value: 'bank', label: 'Banco' }, { value: 'cash', label: 'Caixa' }, { value: 'credit', label: 'Cartão' }]} label="Tipo" onChange={setAccountType} value={accountType} /> : null}
          <Field label="Nome da conta" editable={!referenceAccount} onChangeText={setAccountName} value={accountName} />
          <Field keyboardType="decimal-pad" label="Saldo de referência (R$)" onChangeText={setOpeningBalance} value={openingBalance} />
          <DateField label="Saldo ao final do dia" value={openingDate} onChange={setOpeningDate} />
          <Text style={styles.meta}>O saldo gerencial soma apenas movimentos posteriores a essa data. Movimentos conciliados são contados uma única vez.</Text>
          <Button onPress={() => void perform(saveAccount)} title={referenceAccount?"Salvar referência de saldo":"Cadastrar conta"} variant="secondary" />
          <Text style={styles.meta}>A conciliação usa a mesma conta, valor exato e data próxima. Possibilidades ambíguas ficam sem vínculo automático.</Text><Button loading={importingOfx} onPress={() => void perform(importOfx)} title="Importar extrato OFX" variant="secondary" />
          {accounts.map(account=><Card key={account.id}><Text style={styles.title}>{account.name}</Text><Text style={styles.meta}>Referência: {formatCurrency(account.openingBalance)} ao final de {formatDate(account.openingBalanceDate)}</Text>
            <Text style={styles.title}>Saldo gerencial: {bankError||coreError?'Indisponível':accountBalance(account,entries,transactions)===null?'Informe a data do saldo inicial':formatCurrency(accountBalance(account,entries,transactions))}</Text>
            <Button title="Conferir saldo de referência" variant="secondary" onPress={()=>{setReferenceAccount(account.id);setAccountName(account.name);setAccountType(account.accountType);setOpeningBalance(account.openingBalance.toFixed(2).replace('.',','));setOpeningDate(account.openingBalanceDate??'');}} />
          </Card>)}
          <Button title="Limpar formulário de conta" variant="ghost" onPress={()=>{setReferenceAccount(null);setAccountName('');setOpeningBalance('0');setOpeningDate(financialToday());}} />
          {bankError?<Notice tone="danger">{bankError}</Notice>:null}
          <Text style={styles.sectionTitle}>Movimentações OFX da conta selecionada</Text>
          {transactions.filter(item=>item.accountId===accountId).slice(0,100).map(item=><View key={item.id}><Text style={styles.meta}>{formatDate(item.date)} • {item.description} • {formatCurrency(item.amount)} • {item.matchedFinancialId?'Conciliado':'Sem conciliação'}</Text></View>)}
          <Text style={styles.meta}>Exibindo até 100 movimentos recentes; o saldo usa todos os movimentos carregados.</Text>
      </Card>:null}
      {section==='hours'?<>
        <Card>
          <Text style={styles.sectionTitle}>Horas por projeto</Text>
          <SelectionChips label="Projeto do apontamento" value={selectedProjectId??''} onChange={value=>setSelectedProjectId(value||null)} items={[{value:'',label:'Selecione'},...projects.filter(project=>!embedded?.projectId||project.id===embedded.projectId).map(project=>({value:project.id,label:`${project.contractNumber} • ${project.name}`}))]} />
          <DateField label="Data do apontamento" value={date} onChange={value=>{setDate(value);requestId.current=null;}} />
          <Notice tone="info">A taxa padrão é uma referência administrativa configurada por você. O sistema não calcula nem inventa valor profissional.</Notice>
          <Field keyboardType="decimal-pad" label="Taxa horária padrão (R$)" placeholder="Ex.: 180,00" onChangeText={setDefaultHourlyRate} value={defaultHourlyRate} />
          <DateField label="Vigência da referência" optional onChange={setHourlyRateEffectiveFrom} value={hourlyRateEffectiveFrom} />
          <Field label="Referência / observação" multiline placeholder="Ex.: tabela interna 2026 ou critério adotado pelo escritório" onChangeText={setHourlyRateReference} value={hourlyRateReference} />
          <Button loading={saving} onPress={() => void perform(saveDefaultHourlyRate)} title="Salvar taxa padrão" variant="secondary" />
          <Field keyboardType="decimal-pad" label="Horas trabalhadas" onChangeText={setTimeHours} value={timeHours} />
          <Field keyboardType="decimal-pad" label="Custo por hora deste lançamento (R$)" placeholder="Sugestão carregada da taxa padrão" onChangeText={setHourlyCost} value={hourlyCost} />
          <Text style={styles.meta}>O valor deste lançamento continua editável sem alterar a referência padrão.</Text>
          <Field label="Atividade" onChangeText={setTimeDescription} value={timeDescription} />
          <Button onPress={() => void perform(saveTime)} title="Registrar horas" variant="secondary" />
          <Text style={styles.meta}>{timesheets.filter(item=>!embedded?.projectId||item.projectId===embedded.projectId).length} apontamento(s) • {timesheets.filter(item=>!embedded?.projectId||item.projectId===embedded.projectId).reduce((sum, item) => sum + item.hours, 0).toLocaleString('pt-BR')} h registradas</Text>
        </Card>
      <Card>
        <Text style={styles.sectionTitle}>Margem por contrato</Text>
        <Text style={styles.meta}>Custos incluem pagamentos, pendências e horas de todos os projetos vinculados. O valor de cada contrato é considerado uma única vez.</Text>
        {summaries.length === 0 ? <StateView icon="analytics-outline" title="Sem dados para margem" description="Registre valores contratados, recebimentos, custos e horas." /> : summaries.map((item) => {
          const totalCost = item.paidCosts + item.payable + item.laborCost;
          const margin = item.contractValue===null ? null : item.contractValue-totalCost;
          return <View key={item.projectId} style={styles.summary}><View style={{ flex: 1 }}><Text style={styles.title}>{item.contractNumber} • {item.projectName}</Text><Text style={styles.meta}>Recebido {formatCurrency(item.received)} • a receber {formatCurrency(item.receivable)} • custos + horas {formatCurrency(totalCost)}</Text></View><StatusPill label={coreError?'Indisponível':margin===null?'Valor contratado não informado':`Margem ${formatCurrency(margin)}`} tone={margin===null?'neutral':margin >= 0 ? 'success' : 'danger'} /></View>;
        })}
      </Card>

      </>:null}
      {section==='fiscal'?<Card>
        <Text style={styles.sectionTitle}>Rascunhos para NFS-e</Text>
        <SelectionChips label="Projeto do rascunho fiscal" value={selectedProjectId??''} onChange={value=>setSelectedProjectId(value||null)} items={[{value:'',label:'Selecione'},...projects.filter(project=>!embedded?.projectId||project.id===embedded.projectId).map(project=>({value:project.id,label:`${project.contractNumber} • ${project.name}`}))]} />
        <Notice tone="info">Esta área apenas guarda um rascunho. Não valida os requisitos municipais nem emite nota fiscal. A transmissão depende de uma integração fiscal ainda não disponível neste painel.</Notice>
        <Field label="Descrição do serviço" onChangeText={setFiscalDescription} value={fiscalDescription} />
        <View style={styles.rowFields}><Field keyboardType="decimal-pad" label="Valor (R$)" onChangeText={setFiscalAmount} value={fiscalAmount} /><Field label="Código municipal do serviço" onChangeText={setServiceCode} value={serviceCode} /></View>
        <Button onPress={() => void perform(saveFiscal)} title="Preparar documento fiscal" variant="secondary" />
        {fiscalDocuments.map((document) => <View key={document.id} style={styles.row}><View style={{ flex: 1 }}><Text style={styles.title}>{document.description}</Text><Text style={styles.meta}>{formatCurrency(document.amount)} • {document.provider ?? 'provedor ainda não configurado'}</Text></View><StatusPill label={document.status} tone={document.status === 'authorized' ? 'success' : document.status === 'error' ? 'danger' : 'warning'} /></View>)}
      </Card>:null}
      {section==='hours'?<Card>
        <Text style={styles.sectionTitle}>Valor do contrato</Text>
        <View style={styles.selector}>{contracts.filter(contract=>!embedded?.projectId||projects.some(project=>project.id===embedded.projectId&&project.contractId===contract.id)).map((contract) => <Pressable accessibilityRole="button" key={contract.id} onPress={() => { setSelectedContractId(contract.id); setContractValue(contract.contractValue === null ? '' : String(contract.contractValue).replace('.', ',')); }} style={[styles.choice, selectedContractId === contract.id && styles.choiceSelected]}><Text style={[styles.choiceText, selectedContractId === contract.id && styles.choiceTextSelected]}>{contract.contractNumber} • {contract.clientName} • {formatCurrency(contract.contractValue)}</Text></Pressable>)}</View>
        <Field keyboardType="decimal-pad" label="Valor contratado (R$)" onChangeText={setContractValue} value={contractValue} />
        <Button loading={saving} onPress={() => void perform(saveContractValue)} title="Atualizar valor contratado" variant="secondary" />
      </Card>:null}

      {section==='history'?<>
      <Button title="Baixar Excel completo (.xlsx)" loading={saving} onPress={()=>void perform(exportComplete)} />
      <Button title="Baixar CSV dos lançamentos ativos" disabled={Boolean(coreError)} variant="secondary" loading={saving} onPress={()=>void perform(()=>exportFinancialCsv(entries))} />
      <Text style={styles.sectionTitle}>Histórico preservado e imutável</Text>
      <Notice tone="warning">Estes registros não são apagados quando um cliente é excluído. Somente o administrador pode consultá-los.</Notice>
      {archiveError?<Notice tone="danger">{archiveError}</Notice>:null}
      {archive.slice(archivePage*50,archivePage*50+50).map((entry) => <Card key={entry.id}><View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.title}>{entry.clientName} • {entry.contractNumber}</Text><Text style={styles.meta}>{entry.description ?? entry.sourceTable} • arquivado em {formatDate(entry.archivedAt)}</Text></View><StatusPill label={formatCurrency(entry.amount ?? entry.contractValue)} /></View></Card>)}
      <View style={styles.rowFields}><Button title="Histórico anterior" variant="ghost" disabled={archivePage===0} onPress={()=>setArchivePage(value=>value-1)} /><Button title="Histórico seguinte" variant="ghost" disabled={(archivePage+1)*50>=archive.length} onPress={()=>setArchivePage(value=>value+1)} /></View>
      <Card><Text style={styles.sectionTitle}>Arquivar todos os lançamentos ativos</Text><Notice tone="warning">Faça e confira uma exportação antes de limpar os ativos. Clientes, projetos e histórico preservado permanecem.</Notice>
        <Button title="1. Preparar Excel antes da limpeza" variant="secondary" loading={saving} onPress={()=>void perform(async()=>{await exportComplete();setResetReady(true);})} />
        {resetReady?<><Field label="Após conferir o download, digite RESETAR FINANCEIRO" value={resetPhrase} onChangeText={setResetPhrase} /><Button title="2. Confirmar arquivamento e limpar ativos" disabled={resetPhrase!=='RESETAR FINANCEIRO'||saving} onPress={()=>void perform(resetEntries)} /></>:null}
      </Card></>:null}
      <Button loading={loading} onPress={() => void perform(load)} title="Atualizar extrato" variant="ghost" />
    </Screen>
  );
}

