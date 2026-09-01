import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useThemeStyles } from '@/providers/theme-provider';
import {
  exportDocumentArchive,
  listDocumentArchiveBatches,
  previewDocumentArchive,
  purgeDocumentArchive,
  type DocumentArchiveBatch,
} from '@/services/document-archive-service';
import { spacing, ThemeColors, typography } from '@/theme/tokens';

export default function DocumentArchiveScreen() {
  const styles = useThemeStyles(styleDefinitions);
  const [days, setDays] = useState('180');
  const [eligibleCount, setEligibleCount] = useState<number | null>(null);
  const [batches, setBatches] = useState<DocumentArchiveBatch[]>([]);
  const [confirmation, setConfirmation] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await listDocumentArchiveBatches();
    setBatches(result.data);
    if (result.error) setError(result.error);
  }, []);

  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  const parsedDays = () => Math.max(30, Math.min(Number(days) || 180, 3650));

  const preview = async () => {
    setLoadingKey('preview'); setError(null); setSuccess(null);
    const result = await previewDocumentArchive(parsedDays());
    if (result.error || !result.data) setError(result.error ?? 'Não foi possível calcular o lote.');
    else {
      setEligibleCount(result.data.count);
      setSuccess(result.data.count ? `${result.data.count} documento(s) podem ser exportados com segurança neste lote.` : 'Nenhum documento antigo e encerrado está elegível neste período.');
    }
    setLoadingKey(null);
  };

  const exportBatch = async () => {
    setLoadingKey('export'); setError(null); setSuccess(null);
    const result = await exportDocumentArchive(parsedDays());
    if (result.error || !result.data) setError(result.error ?? 'Não foi possível exportar.');
    else {
      setSelectedBatchId(result.data.batchId);
      setEligibleCount(result.data.count);
      setSuccess('Pacote ZIP gerado. Salve o arquivo antes de usar a limpeza. O link temporário expira em 1 hora.');
      await Linking.openURL(result.data.downloadUrl);
      await load();
    }
    setLoadingKey(null);
  };

  const purge = async () => {
    if (!selectedBatchId) { setError('Selecione um lote exportado no histórico.'); return; }
    setLoadingKey('purge'); setError(null); setSuccess(null);
    const result = await purgeDocumentArchive(selectedBatchId, confirmation);
    if (result) setError(result);
    else {
      setConfirmation(''); setSelectedBatchId(null); setEligibleCount(null);
      setSuccess('Arquivos físicos removidos do Storage. O histórico mínimo, numeração e trilha de auditoria foram preservados.');
      await load();
    }
    setLoadingKey(null);
  };

  return (
    <Screen>
      <AdminPageHeader title="Arquivo documental" description="Exporte e limpe arquivos antigos de orçamentos, contratos e documentos contratuais sem perder numeração e rastreabilidade." />
      <Notice tone="info">A limpeza só considera documentos encerrados/aceitos/assinados/cancelados e orçamentos/contratos comerciais já convertidos ou cancelados. Rascunhos, documentos ativos e pendências não entram automaticamente.</Notice>
      <Notice tone="warning">O pacote ZIP contém os arquivos Word e dois manifestos (CSV e JSON). A limpeza só deve ser executada depois de salvar esse pacote fora do sistema.</Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      <Card>
        <Text style={styles.sectionTitle}>1. Escolher período e conferir</Text>
        <Field keyboardType="number-pad" label="Documentos com mais de quantos dias?" value={days} onChangeText={setDays} />
        <Button loading={loadingKey === 'preview'} onPress={() => void preview()} title="Ver documentos elegíveis" variant="secondary" />
        {eligibleCount !== null ? <Text style={styles.metric}>{eligibleCount} documento(s) elegível(is)</Text> : null}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>2. Exportar pacote completo</Text>
        <Text style={styles.help}>O ZIP reúne os Word e um índice com número, tipo, status, versão, datas, vínculos e hash disponível.</Text>
        <Button disabled={eligibleCount === 0} loading={loadingKey === 'export'} onPress={() => void exportBatch()} title="Exportar ZIP e abrir download" />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>3. Limpar somente após exportar</Text>
        <Text style={styles.help}>Selecione abaixo um lote com status “exportado”. A limpeza remove os arquivos físicos e o ZIP temporário do Storage, mas mantém o registro mínimo e a auditoria.</Text>
        <View style={styles.batchList}>
          {batches.length === 0 ? <StateView icon="archive-outline" title="Nenhum lote exportado" description="Quando você fizer a primeira exportação, ela aparecerá aqui." /> : batches.map((batch) => (
            <Button
              key={batch.id}
              onPress={() => batch.status === 'exportado' ? setSelectedBatchId(batch.id) : undefined}
              title={`${selectedBatchId === batch.id ? '✓ ' : ''}${batch.documentCount} docs • ${formatDate(batch.createdAt)} • ${batch.status}`}
              variant={selectedBatchId === batch.id ? 'secondary' : 'ghost'}
            />
          ))}
        </View>
        <Field label={'Para confirmar, digite: LIMPAR DOCUMENTOS'} value={confirmation} onChangeText={setConfirmation} />
        <Button disabled={!selectedBatchId || confirmation !== 'LIMPAR DOCUMENTOS'} loading={loadingKey === 'purge'} onPress={() => void purge()} title="Limpar arquivos do lote exportado" variant="secondary" />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Histórico de lotes</Text>
        {batches.map((batch) => (
          <View key={batch.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{batch.documentCount} documentos</Text>
              <Text style={styles.help}>Criado em {formatDate(batch.createdAt)} • corte em {formatDate(batch.cutoffAt)}</Text>
            </View>
            <StatusPill label={batch.status} tone={batch.status === 'limpo' ? 'success' : batch.status === 'exportado' ? 'neutral' : 'warning'} />
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  help: { color: colors.slate, fontSize: 12, lineHeight: 18, fontFamily: typography.family },
  metric: { color: colors.gold600, fontSize: 18, fontWeight: '700', fontFamily: typography.family },
  batchList: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  title: { color: colors.ink, fontSize: 14, fontWeight: '700', fontFamily: typography.family },
});
