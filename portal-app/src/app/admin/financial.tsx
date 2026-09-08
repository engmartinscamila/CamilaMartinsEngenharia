import { useLiveRefresh } from '@/hooks/use-live-refresh';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

import { AdminPageHeader, SelectionChips } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { formatCurrency, formatDate, isValidIsoDate, parseBrazilianCurrency } from '@/lib/format';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import {
  createAdminFinancialEntry,
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
  listFinancialAccounts,
  listFiscalDocuments,
  listProjectFinancialSummaries,
  listTimesheets,
  importOfxTransactions,
} from '@/services/operations-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type {
  AdminContractSummary,
  AdminProjectSummary,
  FinancialAccountSummary,
  FinancialArchiveSummary,
  FinancialEntrySummary,
  FiscalDocumentSummary,
  ProjectFinancialSummary,
  TimesheetSummary,
} from '@/types/domain';

function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export default function AdminFinancialScreen() {
  const [contracts, setContracts] = useState<AdminContractSummary[]>([]);
  const [projects, setProjects] = useState<AdminProjectSummary[]>([]);
  const [entries, setEntries] = useState<FinancialEntrySummary[]>([]);
  const [archive, setArchive] = useState<FinancialArchiveSummary[]>([]);
  const [summaries, setSummaries] = useState<ProjectFinancialSummary[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccountSummary[]>([]);
  const [timesheets, setTimesheets] = useState<TimesheetSummary[]>([]);
  const [fiscalDocuments, setFiscalDocuments] = useState<FiscalDocumentSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [type, setType] = useState<'entrada' | 'saida'>('entrada');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(localDate());
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('outros');
  const [entryStatus, setEntryStatus] = useState<'pendente' | 'pago'>('pendente');
  const [dueDate, setDueDate] = useState(localDate());
  const [accountId, setAccountId] = useState<string | null>(null);
  const [contractValue, setContractValue] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<'bank' | 'cash' | 'credit'>('bank');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [timeHours, setTimeHours] = useState('');
  const [hourlyCost, setHourlyCost] = useState('');
  const [timeDescription, setTimeDescription] = useState('');
  const [fiscalDescription, setFiscalDescription] = useState('');
  const [fiscalAmount, setFiscalAmount] = useState('');
  const [serviceCode, setServiceCode] = useState('');
  const [importingOfx, setImportingOfx] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);

  const load = useCallback(async () => {
    setLoading(true);
    const [contractResult, projectResult, entryResult, archiveResult, summaryResult, accountResult, timeResult, fiscalResult] = await Promise.all([
      listAdminContracts(), listAdminProjects(), listAdminFinancialEntries(), listFinancialArchive(),
      listProjectFinancialSummaries(), listFinancialAccounts(), listTimesheets(), listFiscalDocuments(),
    ]);
    setContracts(contractResult.data);
    setProjects(projectResult.data);
    setEntries(entryResult.data);
    setArchive(archiveResult.data);
    setSummaries(summaryResult.data);
    setAccounts(accountResult.data);
    setTimesheets(timeResult.data);
    setFiscalDocuments(fiscalResult.data);
    setSelectedProjectId((current) => current ?? projectResult.data[0]?.id ?? null);
    setSelectedContractId((current) => current ?? contractResult.data[0]?.id ?? null);
    setAccountId((current) => current ?? accountResult.data[0]?.id ?? null);
    setError(contractResult.error ?? projectResult.error ?? entryResult.error ?? archiveResult.error ?? summaryResult.error ?? accountResult.error ?? timeResult.error ?? fiscalResult.error);
    setLoading(false);
  }, []);

  useLiveRefresh(load);

  const totals = useMemo(() => {
    const contracted = contracts.reduce((sum, contract) => sum + (contract.contractValue ?? 0), 0);
    const income = entries.filter((entry) => entry.type === 'entrada').reduce((sum, entry) => sum + entry.amount, 0);
    const expense = entries.filter((entry) => entry.type === 'saida').reduce((sum, entry) => sum + entry.amount, 0);
    return { contracted, income, expense, balance: income - expense };
  }, [contracts, entries]);

  const saveEntry = async () => {
    setError(null); setSuccess(null);
    const parsed = parseBrazilianCurrency(amount);
    if (!selectedProjectId || description.trim().length < 2 || parsed === null || parsed <= 0 || !isValidIsoDate(date)) {
      setError('Selecione o projeto e informe descrição, valor e data válidos.');
      return;
    }
    if (dueDate && !isValidIsoDate(dueDate)) { setError('A data de vencimento deve usar AAAA-MM-DD.'); return; }
    setSaving(true);
    const result = await createAdminFinancialEntry({
      projectId: selectedProjectId, description, type, amount: parsed, date, notes,
      category, status: entryStatus, dueDate, accountId,
    });
    setSaving(false);
    if (result) setError(result);
    else { setSuccess('Lançamento administrativo registrado.'); setDescription(''); setAmount(''); setNotes(''); await load(); }
  };

  const saveAccount = async () => {
    const balance = parseBrazilianCurrency(openingBalance);
    if (accountName.trim().length < 2 || balance === null) { setError('Informe o nome e o saldo inicial da conta.'); return; }
    const actionError = await createFinancialAccount(accountName, accountType, balance);
    if (actionError) setError(actionError); else { setAccountName(''); setOpeningBalance('0'); setSuccess('Conta financeira cadastrada.'); await load(); }
  };

  const saveTime = async () => {
    const hours = Number(timeHours.replace(',', '.')); const cost = parseBrazilianCurrency(hourlyCost);
    if (!selectedProjectId || !Number.isFinite(hours) || hours <= 0 || hours > 24 || cost === null || timeDescription.trim().length < 3) {
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
    if (actionError) setError(actionError); else { setFiscalDescription(''); setFiscalAmount(''); setServiceCode(''); setSuccess('Documento fiscal preparado para transmissão ao provedor municipal.'); await load(); }
  };

  const importOfx = async () => {
    if (!accountId) { setError('Selecione ou cadastre a conta bancária antes de importar o OFX.'); return; }
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false, type: ['application/x-ofx', 'application/octet-stream', 'text/plain'] });
    const asset = picked.canceled ? null : picked.assets[0] ?? null;
    if (!asset) return;
    setImportingOfx(true); setError(null); setSuccess(null);
    const result = await importOfxTransactions(accountId, asset);
    setImportingOfx(false);
    if (result.error) setError(result.error);
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
      <AdminPageHeader title="Gestão financeira" description="DRE gerencial, fluxo de caixa, contas, margens por projeto, horas e preparação fiscal." />
      <Notice tone="info">Clientes não possuem permissão de banco nem rota para esta área. O histórico arquivado permanece somente administrativo mesmo após a exclusão do cliente.</Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}
      {loading ? <ActivityIndicator color={colors.gold600} /> : null}
      <View style={styles.metrics}>
        {[
          ['VALORES CONTRATADOS', totals.contracted],
          ['ENTRADAS', totals.income],
          ['SAÍDAS', totals.expense],
          ['SALDO', totals.balance],
        ].map(([label, value]) => <Card key={String(label)} style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{formatCurrency(Number(value))}</Text></Card>)}
      </View>
      <View style={styles.metrics}>
        {[
          ['RECEBIDO', summaries.reduce((sum, item) => sum + item.received, 0)],
          ['A RECEBER', summaries.reduce((sum, item) => sum + item.receivable, 0)],
          ['CUSTOS PAGOS', summaries.reduce((sum, item) => sum + item.paidCosts, 0)],
          ['A PAGAR', summaries.reduce((sum, item) => sum + item.payable, 0)],
          ['CUSTO DE HORAS', summaries.reduce((sum, item) => sum + item.laborCost, 0)],
        ].map(([label, value]) => <Card key={String(label)} style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{formatCurrency(Number(value))}</Text></Card>)}
      </View>

      <Card>
        <Text style={styles.sectionTitle}>Novo lançamento</Text>
        <SelectionChips items={[{ value: 'entrada', label: 'Entrada' }, { value: 'saida', label: 'Saída' }]} label="Natureza" onChange={setType} value={type} />
        <SelectionChips items={[{ value: 'pendente', label: 'Pendente' }, { value: 'pago', label: type === 'entrada' ? 'Recebido' : 'Pago' }]} label="Situação" onChange={setEntryStatus} value={entryStatus} />
        <Text style={styles.label}>Contrato e projeto</Text>
        <View style={styles.selector}>{projects.map((project) => <Pressable key={project.id} onPress={() => setSelectedProjectId(project.id)} style={[styles.choice, selectedProjectId === project.id && styles.choiceSelected]}><Text style={[styles.choiceText, selectedProjectId === project.id && styles.choiceTextSelected]}>{project.contractNumber} • {project.clientName} • {project.name}</Text></Pressable>)}</View>
        <Field label="Descrição" onChangeText={setDescription} placeholder="Ex.: Parcela 2 do contrato" value={description} />
        <Field label="Categoria / centro de custo" onChangeText={setCategory} value={category} />
        <Field keyboardType="decimal-pad" label="Valor (R$)" onChangeText={setAmount} placeholder="Ex.: 2.500,00" value={amount} />
        <View style={styles.rowFields}><Field label="Data (AAAA-MM-DD)" onChangeText={setDate} value={date} /><Field label="Vencimento (AAAA-MM-DD)" onChangeText={setDueDate} value={dueDate} /></View>
        {accounts.length ? <><Text style={styles.label}>Conta</Text><View style={styles.selector}>{accounts.map((account) => <Pressable key={account.id} onPress={() => setAccountId(account.id)} style={[styles.choice, accountId === account.id && styles.choiceSelected]}><Text style={[styles.choiceText, accountId === account.id && styles.choiceTextSelected]}>{account.name} • {account.accountType}</Text></Pressable>)}</View></> : <Notice tone="warning">Cadastre uma conta para conciliar os lançamentos.</Notice>}
        <Field label="Observações (opcional)" multiline onChangeText={setNotes} value={notes} />
        <Button loading={saving} onPress={() => void saveEntry()} title="Registrar no extrato administrativo" />
      </Card>

      <View style={styles.columns}>
        <Card style={styles.column}>
          <Text style={styles.sectionTitle}>Contas e saldos</Text>
          <SelectionChips items={[{ value: 'bank', label: 'Banco' }, { value: 'cash', label: 'Caixa' }, { value: 'credit', label: 'Cartão' }]} label="Tipo" onChange={setAccountType} value={accountType} />
          <Field label="Nome da conta" onChangeText={setAccountName} value={accountName} />
          <Field keyboardType="decimal-pad" label="Saldo inicial (R$)" onChangeText={setOpeningBalance} value={openingBalance} />
          <Button onPress={() => void saveAccount()} title="Cadastrar conta" variant="secondary" />
          <Button loading={importingOfx} onPress={() => void importOfx()} title="Importar OFX e conciliar" variant="secondary" />
          {accounts.map((account) => <View key={account.id} style={styles.row}><Text style={styles.title}>{account.name}</Text><StatusPill label={formatCurrency(account.openingBalance)} /></View>)}
        </Card>
        <Card style={styles.column}>
          <Text style={styles.sectionTitle}>Horas por projeto</Text>
          <Field keyboardType="decimal-pad" label="Horas trabalhadas" onChangeText={setTimeHours} value={timeHours} />
          <Field keyboardType="decimal-pad" label="Custo por hora (R$)" onChangeText={setHourlyCost} value={hourlyCost} />
          <Field label="Atividade" onChangeText={setTimeDescription} value={timeDescription} />
          <Button onPress={() => void saveTime()} title="Registrar horas" variant="secondary" />
          <Text style={styles.meta}>{timesheets.length} apontamento(s) • {timesheets.reduce((sum, item) => sum + item.hours, 0).toLocaleString('pt-BR')} h registradas</Text>
        </Card>
      </View>

      <Card>
        <Text style={styles.sectionTitle}>Margem por contrato e projeto</Text>
        {summaries.length === 0 ? <StateView icon="analytics-outline" title="Sem dados para margem" description="Registre valores contratados, recebimentos, custos e horas." /> : summaries.map((item) => {
          const totalCost = item.paidCosts + item.payable + item.laborCost;
          const margin = (item.contractValue ?? 0) - totalCost;
          return <View key={item.projectId} style={styles.summary}><View style={{ flex: 1 }}><Text style={styles.title}>{item.contractNumber} • {item.projectName}</Text><Text style={styles.meta}>Recebido {formatCurrency(item.received)} • a receber {formatCurrency(item.receivable)} • custos + horas {formatCurrency(totalCost)}</Text></View><StatusPill label={`Margem ${formatCurrency(margin)}`} tone={margin >= 0 ? 'success' : 'danger'} /></View>;
        })}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Preparação de NFS-e</Text>
        <Notice tone="info">O documento fica validado e pronto para transmissão. O envio à prefeitura só é executado quando o provedor municipal e as credenciais fiscais estiverem configurados.</Notice>
        <Field label="Descrição do serviço" onChangeText={setFiscalDescription} value={fiscalDescription} />
        <View style={styles.rowFields}><Field keyboardType="decimal-pad" label="Valor (R$)" onChangeText={setFiscalAmount} value={fiscalAmount} /><Field label="Código municipal do serviço" onChangeText={setServiceCode} value={serviceCode} /></View>
        <Button onPress={() => void saveFiscal()} title="Preparar documento fiscal" variant="secondary" />
        {fiscalDocuments.map((document) => <View key={document.id} style={styles.row}><View style={{ flex: 1 }}><Text style={styles.title}>{document.description}</Text><Text style={styles.meta}>{formatCurrency(document.amount)} • {document.provider ?? 'provedor ainda não configurado'}</Text></View><StatusPill label={document.status} tone={document.status === 'authorized' ? 'success' : document.status === 'error' ? 'danger' : 'warning'} /></View>)}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Valor do contrato</Text>
        <View style={styles.selector}>{contracts.map((contract) => <Pressable key={contract.id} onPress={() => { setSelectedContractId(contract.id); setContractValue(contract.contractValue === null ? '' : String(contract.contractValue).replace('.', ',')); }} style={[styles.choice, selectedContractId === contract.id && styles.choiceSelected]}><Text style={[styles.choiceText, selectedContractId === contract.id && styles.choiceTextSelected]}>{contract.contractNumber} • {contract.clientName} • {formatCurrency(contract.contractValue)}</Text></Pressable>)}</View>
        <Field keyboardType="decimal-pad" label="Valor contratado (R$)" onChangeText={setContractValue} value={contractValue} />
        <Button loading={saving} onPress={() => void saveContractValue()} title="Atualizar valor contratado" variant="secondary" />
      </Card>

      <Text style={styles.sectionTitle}>Lançamentos atuais</Text>
      {!loading && entries.length === 0 ? <StateView description="Nenhum lançamento foi registrado." icon="receipt-outline" title="Extrato vazio" /> : null}
      {entries.map((entry) => <Card key={entry.id}><View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.title}>{entry.description}</Text><Text style={styles.meta}>{entry.clientName} • {entry.contractNumber} • {entry.projectName}</Text><Text style={styles.meta}>{formatDate(entry.date)} • vence {formatDate(entry.dueDate)} • {entry.category}{entry.notes ? ` • ${entry.notes}` : ''}</Text></View><View style={styles.valueColumn}><StatusPill label={`${entry.type === 'saida' ? '−' : '+'} ${formatCurrency(entry.amount)}`} tone={entry.type === 'saida' ? 'danger' : 'success'} /><StatusPill label={entry.status} tone={entry.status === 'pendente' ? 'warning' : 'success'} /></View></View></Card>)}

      <Text style={styles.sectionTitle}>Histórico preservado e imutável</Text>
      <Notice tone="warning">Estes registros não são apagados quando um cliente é excluído. Somente o administrador pode consultá-los.</Notice>
      {archive.map((entry) => <Card key={entry.id}><View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.title}>{entry.clientName} • {entry.contractNumber}</Text><Text style={styles.meta}>{entry.description ?? entry.sourceTable} • arquivado em {formatDate(entry.archivedAt)}</Text></View><StatusPill label={formatCurrency(entry.amount ?? entry.contractValue)} /></View></Card>)}
      <Button loading={loading} onPress={() => void load()} title="Atualizar extrato" variant="ghost" />
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: { flexGrow: 1, flexBasis: 190, minHeight: 105, justifyContent: 'space-between' },
  metricLabel: { color: colors.gold600, fontSize: 11, letterSpacing: 1.3, fontWeight: '700', fontFamily: typography.family },
  metricValue: { color: colors.ink, fontSize: 22, fontWeight: '700', fontFamily: typography.family },
  sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700', fontFamily: typography.family },
  selector: { gap: spacing.xs, maxHeight: 230 },
  choice: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.surfaceRaised },
  choiceSelected: { borderColor: colors.gold500, backgroundColor: colors.warningSoft },
  choiceText: { color: colors.slate, fontSize: 12, fontFamily: typography.family },
  choiceTextSelected: { color: colors.gold600, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  rowFields: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  columns: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.sm },
  column: { flex: 1, minWidth: 280 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  valueColumn: { alignItems: 'flex-end', gap: spacing.xs },
  title: { color: colors.ink, fontSize: 15, fontWeight: '700', fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 11, marginTop: 5, fontFamily: typography.family },
});
