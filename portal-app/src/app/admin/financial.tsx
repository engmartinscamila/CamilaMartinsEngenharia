import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { AdminPageHeader, SelectionChips } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { formatCurrency, formatDate, isValidIsoDate, parseBrazilianCurrency } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { listAdminContracts, listAdminProjects, listFinancialArchive, updateAdminContractValue } from '@/services/admin-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AdminContractSummary, AdminProjectSummary, FinancialArchiveSummary } from '@/types/domain';

type FinanceStatus = 'pendente' | 'pago' | 'cancelado';
type FinanceType = 'entrada' | 'saida';
type FinanceRow = {
  id: string; projeto_id: string | null; descricao: string; tipo: string; valor: number; data: string | null; observacoes: string | null;
  categoria: string | null; status: string | null; data_vencimento: string | null; data_pagamento: string | null; forma_pagamento: string | null;
};

function localDate() { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); }
function effectiveStatus(item: FinanceRow): 'pago' | 'cancelado' | 'atrasado' | 'pendente' { if (item.status === 'pago' || item.status === 'cancelado') return item.status; if (item.data_vencimento && item.data_vencimento < localDate()) return 'atrasado'; return 'pendente'; }
function refDate(item: FinanceRow) { return item.data_vencimento || item.data || ''; }

export default function AdminFinancialScreen() {
  const [contracts, setContracts] = useState<AdminContractSummary[]>([]);
  const [projects, setProjects] = useState<AdminProjectSummary[]>([]);
  const [entries, setEntries] = useState<FinanceRow[]>([]);
  const [archive, setArchive] = useState<FinancialArchiveSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [type, setType] = useState<FinanceType>('entrada');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(localDate());
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('outros');
  const [status, setStatus] = useState<FinanceStatus>('pendente');
  const [dueDate, setDueDate] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [contractValue, setContractValue] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);

  const load = useCallback(async () => {
    setLoading(true);
    const [contractResult, projectResult, archiveResult, financeResult] = await Promise.all([
      listAdminContracts(), listAdminProjects(), listFinancialArchive(),
      supabase.from('financeiro').select('id,projeto_id,descricao,tipo,valor,data,observacoes,categoria,status,data_vencimento,data_pagamento,forma_pagamento').order('data', { ascending: false }).limit(800),
    ]);
    setContracts(contractResult.data); setProjects(projectResult.data); setArchive(archiveResult.data);
    setEntries((financeResult.data ?? []).map((row: any) => ({ ...row, valor: Number(row.valor ?? 0) })));
    setSelectedProjectId((current) => current ?? projectResult.data[0]?.id ?? null);
    setSelectedContractId((current) => current ?? contractResult.data[0]?.id ?? null);
    setError(contractResult.error ?? projectResult.error ?? archiveResult.error ?? (financeResult.error ? 'Não foi possível carregar os lançamentos financeiros.' : null));
    setLoading(false);
  }, []);

  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  const filtered = useMemo(() => entries.filter((item) => {
    if (filterProject && item.projeto_id !== filterProject) return false;
    if (filterStatus && effectiveStatus(item) !== filterStatus) return false;
    if (filterMonth && !refDate(item).startsWith(filterMonth)) return false;
    return true;
  }), [entries, filterMonth, filterProject, filterStatus]);

  const totals = useMemo(() => {
    const active = filtered.filter((item) => effectiveStatus(item) !== 'cancelado');
    const receivable = active.filter((item) => item.tipo === 'entrada' && effectiveStatus(item) !== 'pago').reduce((sum, item) => sum + item.valor, 0);
    const overdue = active.filter((item) => effectiveStatus(item) === 'atrasado').reduce((sum, item) => sum + item.valor, 0);
    const income = active.filter((item) => item.tipo === 'entrada').reduce((sum, item) => sum + item.valor, 0);
    const expense = active.filter((item) => item.tipo === 'saida').reduce((sum, item) => sum + item.valor, 0);
    const limit = new Date(); limit.setDate(limit.getDate() + 30); const limitIso = limit.toISOString().slice(0, 10);
    const next = active.filter((item) => { const d = refDate(item); return effectiveStatus(item) !== 'pago' && d >= localDate() && d <= limitIso; });
    const nextResult = next.reduce((sum, item) => sum + (item.tipo === 'saida' ? -item.valor : item.valor), 0);
    return { receivable, overdue, result: income - expense, nextResult };
  }, [filtered]);

  const projectGroups = useMemo(() => {
    const map = new Map<string, { income: number; expense: number; pending: number }>();
    filtered.filter((item) => effectiveStatus(item) !== 'cancelado').forEach((item) => {
      const key = item.projeto_id || 'sem-projeto'; const group = map.get(key) ?? { income: 0, expense: 0, pending: 0 };
      if (item.tipo === 'entrada') group.income += item.valor; if (item.tipo === 'saida') group.expense += item.valor;
      if (!['pago', 'cancelado'].includes(effectiveStatus(item))) group.pending += 1; map.set(key, group);
    });
    return [...map.entries()];
  }, [filtered]);

  const clearForm = () => { setEditingId(null); setDescription(''); setAmount(''); setDate(localDate()); setNotes(''); setCategory('outros'); setStatus('pendente'); setDueDate(''); setPaymentDate(''); setPaymentMethod(''); };
  const edit = (item: FinanceRow) => { setEditingId(item.id); setSelectedProjectId(item.projeto_id); setType(item.tipo === 'saida' ? 'saida' : 'entrada'); setDescription(item.descricao ?? ''); setAmount(String(item.valor).replace('.', ',')); setDate(item.data || localDate()); setNotes(item.observacoes || ''); setCategory(item.categoria || 'outros'); setStatus((['pago','cancelado'].includes(item.status || '') ? item.status : 'pendente') as FinanceStatus); setDueDate(item.data_vencimento || ''); setPaymentDate(item.data_pagamento || ''); setPaymentMethod(item.forma_pagamento || ''); };

  const saveEntry = async () => {
    setError(null); setSuccess(null); const parsed = parseBrazilianCurrency(amount);
    if (!selectedProjectId || description.trim().length < 2 || parsed === null || parsed <= 0 || !isValidIsoDate(date) || (dueDate && !isValidIsoDate(dueDate)) || (paymentDate && !isValidIsoDate(paymentDate))) { setError('Selecione o projeto e informe descrição, valor e datas válidas.'); return; }
    setSaving(true);
    const payload = { projeto_id: selectedProjectId, descricao: description.trim(), tipo: type, valor: parsed, data: date, observacoes: notes.trim() || null, categoria: category.trim() || 'outros', status, data_vencimento: dueDate || null, data_pagamento: status === 'pago' ? (paymentDate || localDate()) : (paymentDate || null), forma_pagamento: paymentMethod.trim() || null };
    const result = editingId ? await supabase.from('financeiro').update(payload).eq('id', editingId).select('id').maybeSingle() : await supabase.from('financeiro').insert(payload).select('id').maybeSingle();
    setSaving(false);
    if (result.error || !result.data) setError('Não foi possível salvar o lançamento financeiro.'); else { setSuccess(editingId ? 'Lançamento atualizado.' : 'Lançamento registrado.'); clearForm(); await load(); }
  };

  const saveContractValue = async () => {
    setError(null); setSuccess(null); const parsed = parseBrazilianCurrency(contractValue);
    if (!selectedContractId || parsed === null || parsed < 0) { setError('Selecione o contrato e informe um valor válido.'); return; }
    setSaving(true); const result = await updateAdminContractValue(selectedContractId, parsed); setSaving(false);
    if (result) setError(result); else { setSuccess('Valor contratado atualizado.'); setContractValue(''); await load(); }
  };

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? 'Sem projeto';
  const projectMeta = (item: FinanceRow) => { const p = projects.find((project) => project.id === item.projeto_id); return p ? `${p.clientName} • ${p.contractNumber} • ${p.name}` : 'Projeto não identificado'; };

  return <Screen>
    <AdminPageHeader title="Extrato financeiro" description="Mesmo controle financeiro do portal: filtros, vencimentos, pagamentos, resultado e histórico preservado." />
    {error ? <Notice tone="danger">{error}</Notice> : null}{success ? <Notice tone="success">{success}</Notice> : null}{loading ? <ActivityIndicator color={colors.gold600} /> : null}
    <View style={styles.metrics}>{[['A RECEBER', totals.receivable], ['EM ATRASO', totals.overdue], ['RESULTADO PREVISTO', totals.result], ['PRÓXIMOS 30 DIAS', totals.nextResult]].map(([label, value]) => <Card key={String(label)} style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{formatCurrency(Number(value))}</Text></Card>)}</View>

    <Card><Text style={styles.sectionTitle}>Filtros</Text><Text style={styles.label}>Projeto</Text><View style={styles.selector}><Pressable onPress={() => setFilterProject('')} style={[styles.choice, !filterProject && styles.choiceSelected]}><Text style={[styles.choiceText, !filterProject && styles.choiceTextSelected]}>Todos os projetos</Text></Pressable>{projects.map((p) => <Pressable key={p.id} onPress={() => setFilterProject(p.id)} style={[styles.choice, filterProject === p.id && styles.choiceSelected]}><Text style={[styles.choiceText, filterProject === p.id && styles.choiceTextSelected]}>{p.clientName} • {p.name}</Text></Pressable>)}</View><SelectionChips items={[{ value: '', label: 'Todos' }, { value: 'pendente', label: 'Pendentes' }, { value: 'atrasado', label: 'Atrasados' }, { value: 'pago', label: 'Pagos' }, { value: 'cancelado', label: 'Cancelados' }]} label="Situação" onChange={setFilterStatus} value={filterStatus} /><Field label="Mês (AAAA-MM)" onChangeText={setFilterMonth} placeholder="Ex.: 2026-09" value={filterMonth} /></Card>

    <Card><Text style={styles.sectionTitle}>{editingId ? 'Editar lançamento' : 'Novo lançamento'}</Text><SelectionChips<FinanceType> items={[{ value: 'entrada', label: 'Entrada' }, { value: 'saida', label: 'Saída' }]} label="Natureza" onChange={setType} value={type} /><Text style={styles.label}>Contrato e projeto</Text><View style={styles.selector}>{projects.map((p) => <Pressable key={p.id} onPress={() => setSelectedProjectId(p.id)} style={[styles.choice, selectedProjectId === p.id && styles.choiceSelected]}><Text style={[styles.choiceText, selectedProjectId === p.id && styles.choiceTextSelected]}>{p.contractNumber} • {p.clientName} • {p.name}</Text></Pressable>)}</View><Field label="Descrição" onChangeText={setDescription} value={description} /><Field keyboardType="decimal-pad" label="Valor (R$)" onChangeText={setAmount} value={amount} /><Field label="Categoria" onChangeText={setCategory} value={category} /><SelectionChips<FinanceStatus> items={[{ value: 'pendente', label: 'Pendente' }, { value: 'pago', label: 'Pago' }, { value: 'cancelado', label: 'Cancelado' }]} label="Status" onChange={setStatus} value={status} /><Field label="Data (AAAA-MM-DD)" onChangeText={setDate} value={date} /><Field label="Vencimento (AAAA-MM-DD)" onChangeText={setDueDate} value={dueDate} /><Field label="Pagamento (AAAA-MM-DD)" onChangeText={setPaymentDate} value={paymentDate} /><Field label="Forma de pagamento" onChangeText={setPaymentMethod} value={paymentMethod} /><Field label="Observações" multiline onChangeText={setNotes} value={notes} /><Button loading={saving} onPress={() => void saveEntry()} title={editingId ? 'Salvar alterações' : 'Registrar lançamento'} />{editingId ? <Button onPress={clearForm} title="Cancelar edição" variant="ghost" /> : null}</Card>

    <Card><Text style={styles.sectionTitle}>Valor do contrato</Text><View style={styles.selector}>{contracts.map((c) => <Pressable key={c.id} onPress={() => { setSelectedContractId(c.id); setContractValue(c.contractValue === null ? '' : String(c.contractValue).replace('.', ',')); }} style={[styles.choice, selectedContractId === c.id && styles.choiceSelected]}><Text style={[styles.choiceText, selectedContractId === c.id && styles.choiceTextSelected]}>{c.contractNumber} • {c.clientName} • {formatCurrency(c.contractValue)}</Text></Pressable>)}</View><Field keyboardType="decimal-pad" label="Valor contratado (R$)" onChangeText={setContractValue} value={contractValue} /><Button loading={saving} onPress={() => void saveContractValue()} title="Atualizar valor contratado" variant="secondary" /></Card>

    <Text style={styles.sectionTitle}>Resumo por projeto</Text>{projectGroups.length === 0 ? <StateView description="Nenhum lançamento corresponde aos filtros." icon="receipt-outline" title="Sem resultados" /> : projectGroups.map(([id, group]) => <Card key={id}><Text style={styles.title}>{id === 'sem-projeto' ? 'Sem projeto' : projectName(id)}</Text><Text style={styles.meta}>Entradas: {formatCurrency(group.income)} • Saídas: {formatCurrency(group.expense)}</Text><Text style={styles.meta}>Resultado: {formatCurrency(group.income - group.expense)} • {group.pending} pendência(s)</Text></Card>)}

    <Text style={styles.sectionTitle}>Lançamentos atuais</Text>{!loading && filtered.length === 0 ? <StateView description="Nenhum lançamento corresponde aos filtros." icon="receipt-outline" title="Extrato vazio" /> : null}{filtered.map((entry) => <Card key={entry.id}><View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.title}>{entry.descricao}</Text><Text style={styles.meta}>{projectMeta(entry)}</Text><Text style={styles.meta}>{formatDate(entry.data)} • {entry.categoria || 'outros'} • {effectiveStatus(entry)}{entry.data_vencimento ? ` • vence ${formatDate(entry.data_vencimento)}` : ''}{entry.data_pagamento ? ` • pago ${formatDate(entry.data_pagamento)}` : ''}</Text>{entry.forma_pagamento ? <Text style={styles.meta}>Pagamento: {entry.forma_pagamento}</Text> : null}</View><StatusPill label={`${entry.tipo === 'saida' ? '−' : '+'} ${formatCurrency(entry.valor)}`} tone={entry.tipo === 'saida' ? 'danger' : 'success'} /></View><Button onPress={() => edit(entry)} title="Editar lançamento" variant="ghost" /></Card>)}

    <Text style={styles.sectionTitle}>Histórico preservado</Text><Notice tone="info">O histórico contábil permanece disponível ao administrador mesmo após exclusões de clientes, projetos ou lançamentos.</Notice>{archive.map((entry) => <Card key={entry.id}><View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.title}>{entry.clientName} • {entry.contractNumber}</Text><Text style={styles.meta}>{entry.description ?? entry.sourceTable} • {formatDate(entry.date ?? entry.archivedAt)}</Text><Text style={styles.meta}>{entry.reason}</Text></View><StatusPill label={formatCurrency(entry.amount ?? entry.contractValue)} /></View></Card>)}<Button loading={loading} onPress={() => void load()} title="Atualizar extrato" variant="ghost" />
  </Screen>;
}

const styleDefinitions = (colors: ThemeColors) => ({ metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, metric: { flexGrow: 1, flexBasis: 145, minHeight: 105, justifyContent: 'space-between' }, metricLabel: { color: colors.gold600, fontSize: 10, letterSpacing: 1.1, fontWeight: '700', fontFamily: typography.family }, metricValue: { color: colors.ink, fontSize: 20, fontWeight: '700', fontFamily: typography.family }, sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family }, label: { color: colors.ink, fontSize: 13, fontWeight: '700', fontFamily: typography.family }, selector: { gap: spacing.xs, maxHeight: 260 }, choice: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.surfaceRaised }, choiceSelected: { borderColor: colors.gold500, backgroundColor: colors.warningSoft }, choiceText: { color: colors.slate, fontSize: 12, fontFamily: typography.family }, choiceTextSelected: { color: colors.gold600, fontWeight: '700' }, row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, title: { color: colors.ink, fontSize: 15, fontWeight: '700', fontFamily: typography.family }, meta: { color: colors.muted, fontSize: 11, marginTop: 5, fontFamily: typography.family } });
