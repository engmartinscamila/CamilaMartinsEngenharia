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
  listPurgedDocuments,
  previewDocumentArchive,
  purgeDocumentArchive,
  restorePurgedDocument,
  setDocumentRetainOnline,
  type DocumentArchiveBatch,
  type DocumentArchiveFilters,
  type DocumentArchivePreview,
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

  const load = useCallback(async () => {
    const [batchResult, purgedResult] = await Promise.all([listDocumentArchiveBatches(), listPurgedDocuments()]);
    setBatches(batchResult.data);
    setPurgedDocs(purgedResult.data);
    if (batchResult.error || purgedResult.error) setError(batchResult.error ?? purgedResult.error);
  }, []);

  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);
  const parsedDays = () => Math.max(30, Math.min(Number(days) || 180, 3650));

  const preview = async () => {
    setLoadingKey('preview'); setError(null); setSuccess(null);
    const result = await previewDocumentArchive(parsedDays(), filters);
    if (result.error || !result.data) setError(result.error ?? 'Não foi possível calcular o lote.');
    else { setPreviewData(result.data); setSuccess(result.data.count ? `${result.data.count} documento(s) elegível(is), com aproximadamente ${formatBytes(result.data.estimatedBytes)}.` : 'Nenhum documento elegível com os filtros informados.'); }
    setLoadingKey(null);
  };

  const exportBatch = async () => {
    setLoadingKey('export'); setError(null); setSuccess(null);
    const result = await exportDocumentArchive(parsedDays(), filters);
    if (result.error || !result.data) setError(result.error ?? 'Não foi possível exportar.');
    else {
      setSelectedBatchId(result.data.batchId);
      setSuccess(`Pacote com ${result.data.count} documento(s) e ${formatBytes(result.data.totalBytes)} gerado. Salve antes de limpar; o link expira em 1 hora.`);
      await Linking.openURL(result.data.downloadUrl); await load();
    }
    setLoadingKey(null);
  };

  const toggleRetain = async (documentId: string, retain: boolean) => {
    setLoadingKey(`retain-${documentId}`); setError(null); setSuccess(null);
    const result = await setDocumentRetainOnline(documentId, retain);
    if (result) setError(result); else { setSuccess(retain ? 'Documento marcado para permanecer online.' : 'Documento liberado para arquivamento futuro.'); await preview(); }
    setLoadingKey(null);
  };

  const purge = async () => {
    if (!selectedBatchId) { setError('Selecione um lote exportado no histórico.'); return; }
    setLoadingKey('purge'); setError(null); setSuccess(null);
    const result = await purgeDocumentArchive(selectedBatchId, confirmation);
    if (result) setError(result);
    else { setConfirmation(''); setSelectedBatchId(null); setPreviewData(null); setSuccess('Arquivos físicos removidos. Numeração, histórico e auditoria permanecem preservados.'); await load(); }
    setLoadingKey(null);
  };

  const restore = async (document: PurgedDocument) => {
    setLoadingKey(`restore-${document.id}`); setError(null); setSuccess(null);
    const picked = await DocumentPicker.getDocumentAsync({ type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', copyToCacheDirectory: true, multiple: false });
    if (picked.canceled || !picked.assets[0]) { setLoadingKey(null); return; }
    const asset = picked.assets[0];
    if ((asset.size ?? 0) > 20 * 1024 * 1024) { setError('O Word selecionado ultrapassa 20 MB.'); setLoadingKey(null); return; }
    try {
      const response = await fetch(asset.uri);
      const buffer = await response.arrayBuffer();
      const result = await restorePurgedDocument(document.id, asset.name, buffer);
      if (result) setError(result); else { setSuccess(`${document.name} restaurado e marcado para permanecer online.`); await load(); }
    } catch { setError('Não foi possível ler o arquivo selecionado para restauração.'); }
    setLoadingKey(null);
  };

  return (
    <Screen>
      <AdminPageHeader title="Arquivo documental" description="Controle o que permanece online, exporte lotes antigos e restaure arquivos sem perder rastreabilidade." />
      <Notice tone="info">Nada é apagado automaticamente. A limpeza continua disponível somente depois da exportação e nunca inclui documentos marcados como “manter online”.</Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      <Card>
        <Text style={styles.sectionTitle}>1. Período e filtros</Text>
        <Field keyboardType="number-pad" label="Mais antigos que quantos dias?" value={days} onChangeText={setDays} />
        <Field label="Cliente (opcional)" placeholder="Parte do nome" value={clientName} onChangeText={setClientName} />
        <Field label="Projeto (opcional)" placeholder="Parte do nome" value={projectName} onChangeText={setProjectName} />
        <Field label="Tipo do documento (opcional)" placeholder="Ex.: contrato, orcamento, termo_aceite" value={kind} onChangeText={setKind} />
        <View style={styles.twoColumns}><Field label="Gerado a partir de (AAAA-MM-DD)" value={fromDate} onChangeText={setFromDate} /><Field label="Gerado até (AAAA-MM-DD)" value={toDate} onChangeText={setToDate} /></View>
        <Button loading={loadingKey === 'preview'} onPress={() => void preview()} title="Calcular documentos e espaço" variant="secondary" />
        {previewData ? <Text style={styles.metric}>{previewData.count} documento(s) • ~{formatBytes(previewData.estimatedBytes)} a liberar</Text> : null}
      </Card>

      {previewData && (previewData.documents.length > 0 || previewData.protectedDocuments.length > 0) ? <Card>
        <Text style={styles.sectionTitle}>Controle de permanência</Text>
        <Text style={styles.help}>Marque documentos importantes para que nunca entrem na limpeza automática por lote.</Text>
        {previewData.documents.slice(0, 30).map((doc) => <View key={doc.id} style={styles.row}><View style={{ flex: 1 }}><Text style={styles.title}>{doc.name}</Text><Text style={styles.help}>{doc.kind ?? 'Documento'} • {doc.generatedAt ? formatDate(doc.generatedAt) : 'sem data'}</Text></View><Button loading={loadingKey === `retain-${doc.id}`} onPress={() => void toggleRetain(doc.id, true)} title="Manter online" variant="ghost" /></View>)}
        {previewData.protectedDocuments.map((doc) => <View key={doc.id} style={styles.row}><View style={{ flex: 1 }}><Text style={styles.title}>🔒 {doc.name}</Text><Text style={styles.help}>Protegido contra arquivamento</Text></View><Button loading={loadingKey === `retain-${doc.id}`} onPress={() => void toggleRetain(doc.id, false)} title="Liberar" variant="ghost" /></View>)}
      </Card> : null}

      <Card>
        <Text style={styles.sectionTitle}>2. Exportar</Text>
        <Text style={styles.help}>O ZIP inclui os Word e manifestos CSV/JSON. O tamanho exibido após a exportação é o valor real do lote.</Text>
        <Button disabled={previewData?.count === 0} loading={loadingKey === 'export'} onPress={() => void exportBatch()} title="Exportar ZIP e abrir download" />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>3. Limpar somente após salvar o ZIP</Text>
        <View style={styles.batchList}>{batches.length === 0 ? <StateView icon="archive-outline" title="Nenhum lote exportado" description="Os lotes aparecerão aqui." /> : batches.map((batch) => <Button key={batch.id} onPress={() => batch.status === 'exportado' ? setSelectedBatchId(batch.id) : undefined} title={`${selectedBatchId === batch.id ? '✓ ' : ''}${batch.documentCount} docs • ${formatDate(batch.createdAt)} • ${batch.status}`} variant={selectedBatchId === batch.id ? 'secondary' : 'ghost'} />)}</View>
        <Field label="Para confirmar, digite: LIMPAR DOCUMENTOS" value={confirmation} onChangeText={setConfirmation} />
        <Button disabled={!selectedBatchId || confirmation !== 'LIMPAR DOCUMENTOS'} loading={loadingKey === 'purge'} onPress={() => void purge()} title="Limpar arquivos do lote exportado" variant="secondary" />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Restaurar documento</Text>
        <Text style={styles.help}>Para um documento já limpo, selecione o Word correspondente salvo no seu arquivo externo. Depois da restauração ele fica protegido contra nova limpeza até você liberá-lo.</Text>
        {purgedDocs.length === 0 ? <StateView icon="cloud-upload-outline" title="Nenhum documento limpo" description="Documentos que forem removidos do Storage aparecerão aqui para eventual restauração." /> : purgedDocs.map((doc) => <View key={doc.id} style={styles.row}><View style={{ flex: 1 }}><Text style={styles.title}>{doc.name}</Text><Text style={styles.help}>{doc.kind ?? 'Documento'} • limpo em {formatDate(doc.purgedAt)}</Text></View><Button loading={loadingKey === `restore-${doc.id}`} onPress={() => void restore(doc)} title="Restaurar Word" variant="secondary" /></View>)}
      </Card>

      <Card><Text style={styles.sectionTitle}>Histórico de lotes</Text>{batches.map((batch) => <View key={batch.id} style={styles.row}><View style={{ flex: 1 }}><Text style={styles.title}>{batch.documentCount} documentos</Text><Text style={styles.help}>Criado em {formatDate(batch.createdAt)} • corte em {formatDate(batch.cutoffAt)}</Text></View><StatusPill label={batch.status} tone={batch.status === 'limpo' ? 'success' : batch.status === 'exportado' ? 'neutral' : 'warning'} /></View>)}</Card>
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  help: { color: colors.slate, fontSize: 12, lineHeight: 18, fontFamily: typography.family },
  metric: { color: colors.gold600, fontSize: 18, fontWeight: '700', fontFamily: typography.family },
  batchList: { gap: spacing.xs },
  twoColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  title: { color: colors.ink, fontSize: 14, fontWeight: '700', fontFamily: typography.family },
});
