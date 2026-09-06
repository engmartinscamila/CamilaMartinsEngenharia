import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { formatDate, isValidIsoDate } from '@/lib/format';
import { useThemeStyles } from '@/providers/theme-provider';
import { listAdminProjects } from '@/services/admin-service';
import { createWorkDiaryEntry, listWorkDiary } from '@/services/operations-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AdminProjectSummary, WorkDiarySummary } from '@/types/domain';

const today = () => new Date().toISOString().slice(0, 10);
const escapeHtml = (value: string | null) => (value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char] ?? char);

export default function AdminWorkDiaryScreen() {
  const styles = useThemeStyles(styleDefinitions);
  const [projects, setProjects] = useState<AdminProjectSummary[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [entries, setEntries] = useState<WorkDiarySummary[]>([]);
  const [entryDate, setEntryDate] = useState(today());
  const [weather, setWeather] = useState('');
  const [teamCount, setTeamCount] = useState('');
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

  const save = async () => {
    if (!projectId || !isValidIsoDate(entryDate) || activities.trim().length < 3) { setError('Selecione o projeto, informe a data e descreva as atividades.'); return; }
    setLoading(true); setError(null); setSuccess(null);
    const actionError = await createWorkDiaryEntry({
      projectId, entryDate, weather, teamCount: teamCount ? Number(teamCount) : null,
      activities, occurrences, materials, nextSteps, voiceTranscript, clientVisible,
    });
    if (actionError) setError(actionError);
    else {
      setSuccess('Diário salvo. Se já existia um registro seu nesta data, ele foi atualizado.');
      setActivities(''); setOccurrences(''); setMaterials(''); setNextSteps(''); setVoiceTranscript('');
      setTeamCount(''); setClientVisible(false); await loadEntries();
    }
    setLoading(false);
  };

  const exportPdf = async () => {
    if (!project || entries.length === 0) { setError('Não há registros para exportar.'); return; }
    const rows = entries.map((entry) => `<section><h2>${escapeHtml(formatDate(entry.entryDate))}</h2><p><b>Clima:</b> ${escapeHtml(entry.weather || 'Não informado')} &nbsp; <b>Equipe:</b> ${entry.teamCount ?? 'Não informada'}</p><p><b>Atividades:</b><br/>${escapeHtml(entry.activities).replaceAll('\n', '<br/>')}</p>${entry.occurrences ? `<p><b>Ocorrências:</b><br/>${escapeHtml(entry.occurrences).replaceAll('\n', '<br/>')}</p>` : ''}${entry.materials ? `<p><b>Materiais:</b><br/>${escapeHtml(entry.materials).replaceAll('\n', '<br/>')}</p>` : ''}${entry.nextSteps ? `<p><b>Próximos passos:</b><br/>${escapeHtml(entry.nextSteps).replaceAll('\n', '<br/>')}</p>` : ''}</section>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"/><style>@page{margin:24mm}body{font-family:Arial;color:#10243e;font-size:11pt}header{border-bottom:3px solid #b9964b;margin-bottom:24px}h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;color:#8a6d2f}section{page-break-inside:avoid;border-bottom:1px solid #d9dee5;padding:10px 0}p{line-height:1.5}</style></head><body><header><h1>Camila Martins Engenharia Civil</h1><p>Diário de obra • ${escapeHtml(project.contractNumber)} • ${escapeHtml(project.name)}</p></header>${rows}</body></html>`;
    try {
      if (Platform.OS === 'web') await Print.printAsync({ html });
      else {
        const result = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', UTI: '.pdf' });
      }
      setSuccess('Relatório PDF preparado com os registros atuais.');
    } catch { setError('Não foi possível gerar o relatório PDF.'); }
  };

  return (
    <Screen>
      <AdminPageHeader title="Diário de obra" description="Registro estruturado, ditado por voz, compartilhamento seletivo e relatório em PDF." />
      <Notice tone="info">No celular, use o microfone do teclado no campo de transcrição: o texto pode ser revisado antes de integrar o registro oficial.</Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}{success ? <Notice tone="success">{success}</Notice> : null}
      <Card><Text style={styles.sectionTitle}>Projeto</Text><View style={styles.chips}>{projects.map((item) => <Pressable key={item.id} onPress={() => setProjectId(item.id)} style={[styles.chip, projectId === item.id && styles.selected]}><Text style={styles.chipText}>{item.contractNumber} • {item.name}</Text></Pressable>)}</View></Card>
      <Card>
        <Text style={styles.sectionTitle}>Registro do dia</Text>
        <View style={styles.twoColumns}><Field label="Data (AAAA-MM-DD)" onChangeText={setEntryDate} value={entryDate} /><Field label="Clima" onChangeText={setWeather} value={weather} /><Field keyboardType="number-pad" label="Pessoas na equipe" onChangeText={setTeamCount} value={teamCount} /></View>
        <Field label="Atividades executadas *" multiline onChangeText={setActivities} value={activities} />
        <Field label="Transcrição por voz para revisar" multiline onChangeText={setVoiceTranscript} value={voiceTranscript} />
        <Field label="Ocorrências e impedimentos" multiline onChangeText={setOccurrences} value={occurrences} />
        <Field label="Materiais recebidos / utilizados" multiline onChangeText={setMaterials} value={materials} />
        <Field label="Próximos passos" multiline onChangeText={setNextSteps} value={nextSteps} />
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: clientVisible }} onPress={() => setClientVisible((current) => !current)} style={[styles.toggle, clientVisible && styles.selected]}><Text style={styles.toggleText}>{clientVisible ? '☒ Compartilhar com o cliente' : '☐ Registro interno'}</Text></Pressable>
        <Button loading={loading} onPress={() => void save()} title="Salvar diário" />
      </Card>
      <Card>
        <View style={styles.header}><Text style={styles.sectionTitle}>Histórico</Text><Button onPress={() => void exportPdf()} title="Gerar PDF" variant="secondary" /></View>
        {entries.length === 0 ? <StateView icon="book-outline" title="Diário ainda vazio" description="O primeiro registro estruturado aparecerá aqui." /> : entries.map((entry) => <View key={entry.id} style={styles.entry}><View style={styles.header}><Text style={styles.title}>{formatDate(entry.entryDate)}</Text><StatusPill label={entry.clientVisible ? 'cliente acompanha' : 'interno'} tone={entry.clientVisible ? 'success' : 'neutral'} /></View><Text style={styles.meta}>{entry.weather || 'Clima não informado'} • {entry.teamCount ?? '—'} pessoa(s)</Text><Text style={styles.body}>{entry.activities}</Text>{entry.occurrences ? <Text style={styles.warning}>Ocorrências: {entry.occurrences}</Text> : null}{entry.nextSteps ? <Text style={styles.meta}>Próximos passos: {entry.nextSteps}</Text> : null}</View>)}
      </Card>
      <Button loading={loading} onPress={() => void loadEntries()} title="Atualizar diário" variant="secondary" />
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  title: { color: colors.ink, fontSize: 14, fontWeight: '700', fontFamily: typography.family },
  body: { color: colors.slate, fontSize: 13, lineHeight: 20, fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 11, lineHeight: 17, fontFamily: typography.family },
  warning: { color: colors.danger, fontSize: 12, lineHeight: 18, fontFamily: typography.family },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 8 },
  selected: { borderColor: colors.gold500, backgroundColor: colors.warningSoft },
  chipText: { color: colors.slate, fontSize: 11, fontFamily: typography.family },
  twoColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  toggle: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm },
  toggleText: { color: colors.ink, fontSize: 12, fontFamily: typography.family },
  entry: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
});
