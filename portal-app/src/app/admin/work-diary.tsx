import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { DateField } from '@/components/date-field';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { formatDate, isValidIsoDate } from '@/lib/format';
import { useThemeStyles } from '@/providers/theme-provider';
import { listAdminProjects } from '@/services/admin-service';
import { createWorkDiaryEntry, listWorkDiary } from '@/services/operations-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AdminProjectSummary, WorkDiarySummary } from '@/types/domain';

const today = () => new Date().toISOString().slice(0, 10);
const timeNow = () => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date());
const formatTime = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
const escapeHtml = (value: string | null) => (value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char] ?? char);
type TeamDraft = { id: string; role: string; quantity: string };

export default function AdminWorkDiaryScreen() {
  const styles = useThemeStyles(styleDefinitions);
  const [projects, setProjects] = useState<AdminProjectSummary[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [entries, setEntries] = useState<WorkDiarySummary[]>([]);
  const [entryDate, setEntryDate] = useState(today());
  const [weather, setWeather] = useState('');
  const [teamCount, setTeamCount] = useState('');
  const [teamBreakdown, setTeamBreakdown] = useState<TeamDraft[]>([]);
  const [activities, setActivities] = useState('');
  const [occurrences, setOccurrences] = useState('');
  const [materials, setMaterials] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [clientVisible, setClientVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    const result = await listAdminProjects();
    const valid = result.data.filter((project) => project.contractId);
    setProjects(valid); setProjectId((current) => current ?? valid[0]?.id ?? null); setError(result.error);
  }, []);
  const loadEntries = useCallback(async () => {
    if (!projectId) return;
    setLoading(true); const result = await listWorkDiary(projectId);
    setEntries(result.data); setError(result.error); setLoading(false);
  }, [projectId]);
  useEffect(() => { const task = setTimeout(() => void loadProjects(), 0); return () => clearTimeout(task); }, [loadProjects]);
  useEffect(() => { const task = setTimeout(() => void loadEntries(), 0); return () => clearTimeout(task); }, [loadEntries]);
  const project = projects.find((item) => item.id === projectId) ?? null;

  const validTeamBreakdown = useMemo(
    () => teamBreakdown
      .map((item) => ({ role: item.role.trim(), quantity: Number(item.quantity) }))
      .filter((item) => item.role && Number.isInteger(item.quantity) && item.quantity > 0),
    [teamBreakdown],
  );
  const structuredTeamTotal = validTeamBreakdown.reduce((sum, item) => sum + item.quantity, 0);

  const addTeamRole = () => setTeamBreakdown((current) => [...current, { id: `${Date.now()}-${current.length}`, role: '', quantity: '' }]);
  const updateTeamRole = (id: string, changes: Partial<TeamDraft>) => setTeamBreakdown((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
  const removeTeamRole = (id: string) => setTeamBreakdown((current) => current.filter((item) => item.id !== id));

  const save = async () => {
    if (!projectId || !isValidIsoDate(entryDate) || activities.trim().length < 3) { setError('Selecione o projeto, informe a data e descreva as atividades.'); return; }
    const explicitTotal = teamCount.trim() ? Number(teamCount) : null;
    if (explicitTotal !== null && (!Number.isInteger(explicitTotal) || explicitTotal < 0)) { setError('O total da equipe deve ser um número inteiro não negativo.'); return; }
    if (teamBreakdown.some((item) => (item.role.trim() || item.quantity.trim()) && (!item.role.trim() || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0))) {
      setError('Complete função e quantidade em cada linha da equipe ou remova a linha incompleta.');
      return;
    }
    const finalTeamCount = explicitTotal ?? (structuredTeamTotal || null);
    if (explicitTotal !== null && structuredTeamTotal > explicitTotal) {
      setError('A soma das funções da equipe não pode ultrapassar o total informado.');
      return;
    }
    setLoading(true); setError(null); setSuccess(null);
    const actionError = await createWorkDiaryEntry({
      projectId, entryDate, weather, teamCount: finalTeamCount, teamBreakdown: validTeamBreakdown,
      activities, occurrences, materials, nextSteps, voiceTranscript, clientVisible,
    });
    if (actionError) setError(actionError);
    else {
      setSuccess('Diário salvo. Se já existia um registro seu nesta data, ele foi atualizado.');
      setActivities(''); setOccurrences(''); setMaterials(''); setNextSteps(''); setVoiceTranscript('');
      setTeamCount(''); setTeamBreakdown([]); setClientVisible(false); await loadEntries();
    }
    setLoading(false);
  };

  const exportPdf = async () => {
    if (!project || entries.length === 0) { setError('Não há registros para exportar.'); return; }
    const rows = entries.map((entry) => {
      const teamDetail = entry.teamBreakdown.length
        ? `<ul>${entry.teamBreakdown.map((item) => `<li>${escapeHtml(item.role)} — ${item.quantity}</li>`).join('')}</ul>`
        : '';
      return `<section><h2>${escapeHtml(formatDate(entry.entryDate))}</h2><p><b>Horário de registro:</b> ${escapeHtml(formatTime(entry.createdAt))}</p><p><b>Clima:</b> ${escapeHtml(entry.weather || 'Não informado')} &nbsp; <b>Equipe total:</b> ${entry.teamCount ?? 'Não informada'}</p>${teamDetail}<p><b>Atividades:</b><br/>${escapeHtml(entry.activities).replaceAll('\n', '<br/>')}</p>${entry.occurrences ? `<p><b>Ocorrências:</b><br/>${escapeHtml(entry.occurrences).replaceAll('\n', '<br/>')}</p>` : ''}${entry.materials ? `<p><b>Materiais:</b><br/>${escapeHtml(entry.materials).replaceAll('\n', '<br/>')}</p>` : ''}${entry.nextSteps ? `<p><b>Próximos passos:</b><br/>${escapeHtml(entry.nextSteps).replaceAll('\n', '<br/>')}</p>` : ''}</section>`;
    }).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"/><style>@page{margin:24mm}body{font-family:Arial;color:#10243e;font-size:11pt}header{border-bottom:3px solid #b9964b;margin-bottom:24px}h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;color:#8a6d2f}section{page-break-inside:avoid;border-bottom:1px solid #d9dee5;padding:10px 0}p,li{line-height:1.5}</style></head><body><header><h1>Camila Martins Engenharia Civil</h1><p>Diário de obra • ${escapeHtml(project.contractNumber)} • ${escapeHtml(project.name)}</p></header>${rows}</body></html>`;
    try {
      if (Platform.OS === 'web') await Print.printAsync({ html });
      else {
        const result = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', UTI: '.pdf' });
      }
      setSuccess('Relatório PDF preparado somente com informações do diário e identificação do projeto.');
    } catch { setError('Não foi possível gerar o relatório PDF.'); }
  };

  return (
    <Screen>
      <AdminPageHeader title="Diário de obra" description="Registro estruturado, ditado por voz, compartilhamento seletivo e relatório em PDF." />
      <Notice tone="info">O horário é registrado automaticamente. No celular, o microfone do teclado pode preencher a transcrição para revisão antes do salvamento.</Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}{success ? <Notice tone="success">{success}</Notice> : null}

      <Card><Text style={styles.sectionTitle}>Projeto</Text><View style={styles.chips}>{projects.map((item) => <Pressable key={item.id} onPress={() => setProjectId(item.id)} style={[styles.chip, projectId === item.id && styles.selected]}><Text style={styles.chipText}>{item.contractNumber} • {item.name}</Text></Pressable>)}</View></Card>

      <Card>
        <Text style={styles.sectionTitle}>Registro do dia</Text>
        <Text style={styles.meta}>Horário registrado automaticamente ao salvar: {timeNow()}</Text>
        <View style={styles.twoColumns}>
          <DateField label="Data" value={entryDate} onChange={setEntryDate} />
          <Field label="Clima" onChangeText={setWeather} value={weather} />
          <Field keyboardType="number-pad" label="Total da equipe" onChangeText={setTeamCount} value={teamCount} placeholder={structuredTeamTotal ? String(structuredTeamTotal) : 'Opcional'} />
        </View>

        <View style={styles.teamHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Equipe por função (opcional)</Text>
            <Text style={styles.meta}>Detalhe somente quando for útil. Soma atual: {structuredTeamTotal} pessoa(s).</Text>
          </View>
          <Button onPress={addTeamRole} title="Adicionar função" variant="secondary" />
        </View>
        {teamBreakdown.map((item) => (
          <View key={item.id} style={styles.teamRow}>
            <View style={{ flex: 2, minWidth: 180 }}><Field label="Função / equipe" value={item.role} onChangeText={(value) => updateTeamRole(item.id, { role: value })} placeholder="Ex.: Pedreiros" /></View>
            <View style={{ flex: 1, minWidth: 110 }}><Field keyboardType="number-pad" label="Quantidade" value={item.quantity} onChangeText={(value) => updateTeamRole(item.id, { quantity: value })} /></View>
            <Button onPress={() => removeTeamRole(item.id)} title="Remover" variant="ghost" />
          </View>
        ))}

        <Field label="Atividades executadas *" multiline onChangeText={setActivities} value={activities} style={styles.largeField} />
        <Field label="Transcrição por voz para revisar" multiline onChangeText={setVoiceTranscript} value={voiceTranscript} style={styles.largeField} />
        <Field label="Ocorrências e impedimentos" multiline onChangeText={setOccurrences} value={occurrences} style={styles.largeField} />
        <Field label="Materiais recebidos / utilizados" multiline onChangeText={setMaterials} value={materials} style={styles.largeField} />
        <Field label="Próximos passos" multiline onChangeText={setNextSteps} value={nextSteps} style={styles.largeField} />
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: clientVisible }} onPress={() => setClientVisible((current) => !current)} style={[styles.toggle, clientVisible && styles.selected]}><Text style={styles.toggleText}>{clientVisible ? 'Compartilhar com o cliente: SIM' : 'Registro interno: NÃO COMPARTILHAR'}</Text></Pressable>
        <Button loading={loading} onPress={() => void save()} title="Salvar diário" />
      </Card>

      <Card>
        <View style={styles.header}><Text style={styles.sectionTitle}>Histórico</Text><Button onPress={() => void exportPdf()} title="Gerar PDF" variant="secondary" /></View>
        {entries.length === 0 ? <StateView icon="book-outline" title="Diário ainda vazio" description="O primeiro registro estruturado aparecerá aqui." /> : entries.map((entry) => <View key={entry.id} style={styles.entry}><View style={styles.header}><Text style={styles.title}>{formatDate(entry.entryDate)}</Text><StatusPill label={entry.clientVisible ? 'cliente acompanha' : 'interno'} tone={entry.clientVisible ? 'success' : 'neutral'} /></View><Text style={styles.meta}>{entry.weather || 'Clima não informado'} • {entry.teamCount ?? '—'} pessoa(s) • registrado às {formatTime(entry.createdAt)}</Text>{entry.teamBreakdown.length ? <Text style={styles.meta}>Equipe: {entry.teamBreakdown.map((item) => `${item.role} — ${item.quantity}`).join(' • ')}</Text> : null}<Text style={styles.body}>{entry.activities}</Text>{entry.occurrences ? <Text style={styles.warning}>Ocorrências: {entry.occurrences}</Text> : null}{entry.materials ? <Text style={styles.meta}>Materiais: {entry.materials}</Text> : null}{entry.nextSteps ? <Text style={styles.meta}>Próximos passos: {entry.nextSteps}</Text> : null}</View>)}
      </Card>
      <Button loading={loading} onPress={() => void loadEntries()} title="Atualizar diário" variant="secondary" />
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700' as const, fontFamily: typography.family },
  title: { color: colors.ink, fontSize: 14, fontWeight: '700' as const, fontFamily: typography.family },
  body: { color: colors.slate, fontSize: 13, lineHeight: 20, fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 11, lineHeight: 17, fontFamily: typography.family },
  warning: { color: colors.danger, fontSize: 12, lineHeight: 18, fontFamily: typography.family },
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: spacing.sm },
  chips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.xs },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 8 },
  selected: { borderColor: colors.gold500, backgroundColor: colors.warningSoft },
  chipText: { color: colors.slate, fontSize: 11, fontFamily: typography.family },
  twoColumns: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
  teamHeader: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, alignItems: 'center' as const, gap: spacing.sm },
  teamRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, alignItems: 'flex-end' as const, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  largeField: { minHeight: 108, textAlignVertical: 'top' as const },
  toggle: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm },
  toggleText: { color: colors.ink, fontSize: 12, fontFamily: typography.family },
  entry: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
});
