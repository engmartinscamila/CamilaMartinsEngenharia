import * as DocumentPicker from 'expo-document-picker';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useThemeStyles } from '@/providers/theme-provider';
import {
  exportDocumentArchive,
  listDocumentArchiveBatches,
  listDocumentGenerationHistory,
  listPurgedDocuments,
  previewDocumentArchive,
  purgeDocumentArchive,
  restorePurgedDocument,
  setDocumentRetainOnline,
  type DocumentArchiveBatch,
  type DocumentArchiveFilters,
  type DocumentArchivePreview,
  type DocumentGenerationHistoryItem,
  type PurgedDocument,
} from '@/services/document-archive-service';
import { spacing, ThemeColors, typography } from '@/theme/tokens';

const formatBytes = (value: number) => {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
};

export default function DocumentArchiveScreen() {
  const styles = useThemeStyles(styleDefinitions);
  const [days, setDays] = useState('180');
  const [clientName, setClientName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [kind, setKind] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [previewData, setPreviewData] = useState<DocumentArchivePreview | null>(null);
  const [batches, setBatches] = useState<DocumentArchiveBatch[]>([]);
  const [purgedDocs, setPurgedDocs] = useState<PurgedDocument[]>([]);
  const [history, setHistory] = useState<DocumentGenerationHistoryItem[]>([]);
  const [confirmation, setConfirmation] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filters = useMemo<DocumentArchiveFilters>(() => ({
    clientName: clientName.trim() || undefined,
    projectName: projectName.trim() || undefined,
    kind: kind.trim() || undefined,
    fromDate: fromDate.trim() || undefined,
    toDate: toDate.trim() || undefined,
  }), [clientName, projectName, kind, fromDate, toDate]);

  const filteredHistory = useMemo(() => history.filter((item) => {
    if (clientName.trim() && !String(item.partyName ?? '').toLocaleLowerCase('pt-BR').includes(clientName.trim().toLocaleLowerCase('pt-BR'))) return false;
    if (kind.trim() && String(item.kind ?? '').toLocaleLowerCase('pt-BR') !== kind.trim().toLocaleLowerCase('pt-BR')) return false;
    if (fromDate && item.generatedAt.slice(0, 10) < fromDate) return false;
    if (toDate && item.generatedAt.slice(0, 10) > toDate) return false;
    return true;
  }), [history, clientName, kind, fromDate, toDate]);

  const load = useCallback(async () => {
    const [batchResult, purgedResult, historyResult] = await Promise.all([listDocumentArchiveBatches(), listPurgedDocuments(), listDocumentGenerationHistory()]);
    setBatches(batchResult.data); setPurgedDocs(purgedResult.data); setHistory(historyResult.data);
    if (batchResult.error || purgedResult.error || historyResult.error) setError(batchResult.error ?? purgedResult.error ?? historyResult.error);
  }, []);

  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);
  const parsedDays = () => Math.max(30, Math.min(Number(days) || 180, 3650));

  const preview = async () => {
    setLoadingKey('preview'); setError(null); setSuccess(null);
    const result = await previewDocumentArchive(parsedDays(), filters);
    if (result.error || !result.data) setError(result.error ?? 'Não foi possível calcular o lote.');
    else { setPreviewData(result.data); setSuccess(result.data.count ? `${result.data.count} documento(s) arquivado(s) elegível(is), com aproximadamente ${formatBytes(result.data.estimatedBytes)}.` : 'Nenhum arquivo armazenado está elegível com os filtros informados.'); }
    setLoadingKey(null);
  };

  const exportBatch = async () => {
    setLoadingKey('export'); setError(null); setSuccess(null);
    const result = await exportDocumentArchive(parsedDays(), filters);
    if (result.error || !result.data) setError(result.error ?? 'Não foi possível exportar.');
    else { setSelectedBatchId(result.data.batchId); setSuccess(`Pacote com ${result.data.count} documento(s) e ${formatBytes(result.data.totalBytes)} gerado. Salve antes de limpar; o link expira em 1 hora.`); await Linking.openURL(result.data.downloadUrl); await load(); }
    setLoadingKey(null);
  };

  const toggleRetain = async (documentId: string, retain: boolean) => {
    setLoadingKey(`retain-${documentId}`); setError(null); setSuccess(null);
    const result = await setDocumentRetainOnline(documentId, retain);
    if (result) setError(result); else { setSuccess(retain ? 'Documento arquivado marcado para permanecer online.' : 'Documento liberado para limpeza futura após exportação.'); await preview(); }
    setLoadingKey(null);
  };

  const purge = async () => {
    if (!selectedBatchId) { setError('Selecione um lote exportado no histórico.'); return; }
    setLoadingKey('purge'); setError(null); setSuccess(null);
    const result = await purgeDocumentArchive(selectedBatchId, confirmation);
    if (result) setError(result);
    else { setConfirmation(''); setSelectedBatchId(null); setPreviewData(null); setSuccess('Arquivos físicos removidos. O extrato de gerações, a numeração e a auditoria continuam preservados.'); await load(); }
    setLoadingKey(null);
  };

  const restore = async (document: PurgedDocument) => {
    setLoadingKey(`restore-${document.id}`); setError(null); setSuccess(null);
    const picked = await DocumentPicker.getDocumentAsync({ type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', copyToCacheDirectory: true, multiple: false });
    if (picked.canceled || !picked.assets[0]) { setLoadingKey(null); return; }
    const asset = picked.assets[0];
    if ((asset.size ?? 0) > 20 * 1024 * 1024) { setError('O Word selecionado ultrapassa 20 MB.'); setLoadingKey(null); return; }
    try {
      const response = await fetch(asset.uri); const buffer = await response.arrayBuffer();
      const result = await restorePurgedDocument(document.id, asset.name, buffer);
      if (result) setError(result); else { setSuccess(`${document.name} restaurado e marcado para permanecer online.`); await load(); }
    } catch { setError('Não foi possível ler o arquivo selecionado para restauração.'); }
    setLoadingKey(null);
  };

  return (
    <Screen>
      <AdminPageHeader title="Arquivo e extrato documental" description="Veja tudo o que já foi gerado e gerencie apenas os arquivos que você decidiu arquivar no sistema." />
      <Notice tone="info">Gerar um Word não ocupa Storage por padrão. O extrato abaixo é leve e permanece mesmo quando o arquivo é apenas baixado e não arquivado.</Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}{success ? <Notice tone="success">{success}</Notice> : null}

      <Card>
        <Text style={styles.sectionTitle}>Extrato de documentos gerados</Text>
        <Text style={styles.help}>Cada geração é registrada, inclusive regenerações. “Somente download” significa que o Word não ficou armazenado no sistema.</Text>
        {filteredHistory.length === 0 ? <StateView icon="receipt-outline" title="Extrato vazio" description="As próximas gerações de orçamento, contrato e demais documentos aparecerão aqui." /> : filteredHistory.slice(0, 100).map((item) => <View key={item.id} style={styles.row}><View style={{ flex: 1 }}><Text style={styles.title}>{item.number ? `${item.number} • ` : ''}{item.name}</Text><Text style={styles.help}>{item.partyName ?? 'Sem cliente/prospect identificado'} • {item.kind ?? 'documento'} • v{item.version ?? '—'} • {formatDate(item.generatedAt)}</Text>{item.fileSizeBytes ? <Text style={styles.help}>{formatBytes(item.fileSizeBytes)}</Text> : null}</View><StatusPill label={item.storageMode === 'archived' ? 'Arquivado' : 'Somente download'} tone={item.storageMode === 'archived' ? 'success' : 'neutral'} /></View>)}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Filtros e manutenção dos arquivos arquivados</Text>
        <Field keyboardType="number-pad" label="Arquivados com mais de quantos dias?" value={days} onChangeText={setDays} />
        <Field label="Cliente / prospect (opcional)" placeholder="Parte do nome" value={clientName} onChangeText={setClientName} />
        <Field label="Projeto (opcional)" placeholder="Parte do nome" value={projectName} onChangeText={setProjectName} />
        <Field label="Tipo do documento (opcional)" placeholder="Ex.: contrato, orcamento, termo_aceite" value={kind} onChangeText={setKind} />
        <View style={styles.twoColumns}><Field label="Gerado a partir de (AAAA-MM-DD)" value={fromDate} onChangeText={setFromDate} /><Field label="Gerado até (AAAA-MM-DD)" value={toDate} onChangeText={setToDate} /></View>
        <Button loading={loadingKey === 'preview'} onPress={() => void preview()} title="Calcular arquivos e espaço" variant="secondary" />
        {previewData ? <Text style={styles.metric}>{previewData.count} arquivo(s) arquivado(s) • ~{formatBytes(previewData.estimatedBytes)} a liberar</Text> : null}
      </Card>

      {previewData && (previewData.documents.length > 0 || previewData.protectedDocuments.length > 0) ? <Card><Text style={styles.sectionTitle}>Controle de permanência</Text><Text style={styles.help}>Use “Manter online” somente nos arquivados que você não quer incluir em futuras limpezas.</Text>{previewData.documents.slice(0, 30).map((doc) => <View key={doc.id} style={styles.row}><View style={{ flex: 1 }}><Text style={styles.title}>{doc.name}</Text><Text style={styles.help}>{doc.kind ?? 'Documento'} • {doc.generatedAt ? formatDate(doc.generatedAt) : 'sem data'}</Text></View><Button loading={loadingKey === `retain-${doc.id}`} onPress={() => void toggleRetain(doc.id, true)} title="Manter online" variant="ghost" /></View>)}{previewData.protectedDocuments.map((doc) => <View key={doc.id} style={styles.row}><View style={{ flex: 1 }}><Text style={styles.title}>🔒 {doc.name}</Text><Text style={styles.help}>Protegido contra limpeza</Text></View><Button loading={loadingKey === `retain-${doc.id}`} onPress={() => void toggleRetain(doc.id, false)} title="Liberar" variant="ghost" /></View>)}</Card> : null}

      <Card><Text style={styles.sectionTitle}>Exportar arquivados</Text><Text style={styles.help}>O ZIP inclui os Word arquivados e manifestos CSV/JSON.</Text><Button disabled={previewData?.count === 0} loading={loadingKey === 'export'} onPress={() => void exportBatch()} title="Exportar ZIP e abrir download" /></Card>

      <Card><Text style={styles.sectionTitle}>Limpar somente após salvar o ZIP</Text><View style={styles.batchList}>{batches.length === 0 ? <StateView icon="archive-outline" title="Nenhum lote exportado" description="Os lotes aparecerão aqui." /> : batches.map((batch) => <Button key={batch.id} onPress={() => batch.status === 'exportado' ? setSelectedBatchId(batch.id) : undefined} title={`${selectedBatchId === batch.id ? '✓ ' : ''}${batch.documentCount} docs • ${formatDate(batch.createdAt)} • ${batch.status}`} variant={selectedBatchId === batch.id ? 'secondary' : 'ghost'} />)}</View><Field label="Para confirmar, digite: LIMPAR DOCUMENTOS" value={confirmation} onChangeText={setConfirmation} /><Button disabled={!selectedBatchId || confirmation !== 'LIMPAR DOCUMENTOS'} loading={loadingKey === 'purge'} onPress={() => void purge()} title="Limpar arquivos do lote exportado" variant="secondary" /></Card>

      <Card><Text style={styles.sectionTitle}>Restaurar documento arquivado anteriormente</Text><Text style={styles.help}>Selecione o Word correspondente salvo fora do sistema. Depois da restauração ele fica protegido até você liberá-lo.</Text>{purgedDocs.length === 0 ? <StateView icon="cloud-upload-outline" title="Nenhum documento limpo" description="Documentos removidos do Storage aparecerão aqui para eventual restauração." /> : purgedDocs.map((doc) => <View key={doc.id} style={styles.row}><View style={{ flex: 1 }}><Text style={styles.title}>{doc.name}</Text><Text style={styles.help}>{doc.kind ?? 'Documento'} • limpo em {formatDate(doc.purgedAt)}</Text></View><Button loading={loadingKey === `restore-${doc.id}`} onPress={() => void restore(doc)} title="Restaurar Word" variant="secondary" /></View>)}</Card>

      <Card><Text style={styles.sectionTitle}>Histórico de lotes</Text>{batches.map((batch) => <View key={batch.id} style={styles.row}><View style={{ flex: 1 }}><Text style={styles.title}>{batch.documentCount} documentos</Text><Text style={styles.help}>Criado em {formatDate(batch.createdAt)} • corte em {formatDate(batch.cutoffAt)}</Text></View><StatusPill label={batch.status} tone={batch.status === 'limpo' ? 'success' : batch.status === 'exportado' ? 'neutral' : 'warning'} /></View>)}</Card>
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family }, help: { color: colors.slate, fontSize: 12, lineHeight: 18, fontFamily: typography.family }, metric: { color: colors.gold600, fontSize: 18, fontWeight: '700', fontFamily: typography.family }, batchList: { gap: spacing.xs }, twoColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm }, title: { color: colors.ink, fontSize: 14, fontWeight: '700', fontFamily: typography.family },
});
