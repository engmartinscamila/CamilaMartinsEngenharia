import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

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
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AdminContractSummary, AdminProjectSummary, FinancialArchiveSummary, FinancialEntrySummary } from '@/types/domain';

function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export default function AdminFinancialScreen() {
  const [contracts, setContracts] = useState<AdminContractSummary[]>([]);
  const [projects, setProjects] = useState<AdminProjectSummary[]>([]);
  const [entries, setEntries] = useState<FinancialEntrySummary[]>([]);
  const [archive, setArchive] = useState<FinancialArchiveSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [type, setType] = useState<'entrada' | 'saida'>('entrada');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(localDate());
  const [notes, setNotes] = useState('');
  const [contractValue, setContractValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);

  const load = useCallback(async () => {
    setLoading(true);
    const [contractResult, projectResult, entryResult, archiveResult] = await Promise.all([
      listAdminContracts(), listAdminProjects(), listAdminFinancialEntries(), listFinancialArchive(),
    ]);
    setContracts(contractResult.data);
    setProjects(projectResult.data);
    setEntries(entryResult.data);
    setArchive(archiveResult.data);
    setSelectedProjectId((current) => current ?? projectResult.data[0]?.id ?? null);
    setSelectedContractId((current) => current ?? contractResult.data[0]?.id ?? null);
    setError(contractResult.error ?? projectResult.error ?? entryResult.error ?? archiveResult.error);
    setLoading(false);
  }, []);

  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

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
    setSaving(true);
    const result = await createAdminFinancialEntry({ projectId: selectedProjectId, description, type, amount: parsed, date, notes });
    setSaving(false);
    if (result) setError(result);
    else { setSuccess('Lançamento administrativo registrado.'); setDescription(''); setAmount(''); setNotes(''); await load(); }
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
      <AdminPageHeader title="Extrato financeiro" description="Área exclusiva do administrador: valores contratados, entradas, saídas e histórico permanente." />
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

      <Card>
        <Text style={styles.sectionTitle}>Novo lançamento</Text>
        <SelectionChips items={[{ value: 'entrada', label: 'Entrada' }, { value: 'saida', label: 'Saída' }]} label="Natureza" onChange={setType} value={type} />
        <Text style={styles.label}>Contrato e projeto</Text>
        <View style={styles.selector}>{projects.map((project) => <Pressable key={project.id} onPress={() => setSelectedProjectId(project.id)} style={[styles.choice, selectedProjectId === project.id && styles.choiceSelected]}><Text style={[styles.choiceText, selectedProjectId === project.id && styles.choiceTextSelected]}>{project.contractNumber} • {project.clientName} • {project.name}</Text></Pressable>)}</View>
        <Field label="Descrição" onChangeText={setDescription} placeholder="Ex.: Parcela 2 do contrato" value={description} />
        <Field keyboardType="decimal-pad" label="Valor (R$)" onChangeText={setAmount} placeholder="Ex.: 2.500,00" value={amount} />
        <Field label="Data (AAAA-MM-DD)" onChangeText={setDate} value={date} />
        <Field label="Observações (opcional)" multiline onChangeText={setNotes} value={notes} />
        <Button loading={saving} onPress={() => void saveEntry()} title="Registrar no extrato administrativo" />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Valor do contrato</Text>
        <View style={styles.selector}>{contracts.map((contract) => <Pressable key={contract.id} onPress={() => { setSelectedContractId(contract.id); setContractValue(contract.contractValue === null ? '' : String(contract.contractValue).replace('.', ',')); }} style={[styles.choice, selectedContractId === contract.id && styles.choiceSelected]}><Text style={[styles.choiceText, selectedContractId === contract.id && styles.choiceTextSelected]}>{contract.contractNumber} • {contract.clientName} • {formatCurrency(contract.contractValue)}</Text></Pressable>)}</View>
        <Field keyboardType="decimal-pad" label="Valor contratado (R$)" onChangeText={setContractValue} value={contractValue} />
        <Button loading={saving} onPress={() => void saveContractValue()} title="Atualizar valor contratado" variant="secondary" />
      </Card>

      <Text style={styles.sectionTitle}>Lançamentos atuais</Text>
      {!loading && entries.length === 0 ? <StateView description="Nenhum lançamento foi registrado." icon="receipt-outline" title="Extrato vazio" /> : null}
      {entries.map((entry) => <Card key={entry.id}><View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.title}>{entry.description}</Text><Text style={styles.meta}>{entry.clientName} • {entry.contractNumber} • {entry.projectName}</Text><Text style={styles.meta}>{formatDate(entry.date)}{entry.notes ? ` • ${entry.notes}` : ''}</Text></View><StatusPill label={`${entry.type === 'saida' ? '−' : '+'} ${formatCurrency(entry.amount)}`} tone={entry.type === 'saida' ? 'danger' : 'success'} /></View></Card>)}

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
  title: { color: colors.ink, fontSize: 15, fontWeight: '700', fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 11, marginTop: 5, fontFamily: typography.family },
});
