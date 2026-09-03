import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { ProjectPicker } from '@/components/project-picker';
import { Button, Card, Field, Notice, PageHeader, Screen, StateView, StatusPill } from '@/components/ui';
import { openExternalUrl } from '@/lib/external-link';
import { useProject } from '@/providers/project-provider';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import {
  acceptClientDocument,
  listClientDocumentGovernance,
  type ClientDocumentDecision,
  type ClientDocumentGovernanceItem,
} from '@/services/document-governance-service';
import { createDocumentSignedUrl, listDocuments } from '@/services/portal-service';
import { spacing, ThemeColors, typography } from '@/theme/tokens';
import type { DocumentSummary } from '@/types/domain';

const statusLabels: Record<string, string> = {
  aguardando_aceite: 'Aguardando seu aceite',
  aceito: 'Aceito',
  aceito_com_ressalvas: 'Aceito com ressalvas',
  recusado: 'Recusado',
  disponivel: 'Disponível',
  substituido: 'Substituído',
  expirado: 'Expirado',
};

export default function DocumentsScreen() {
  const { selectedProject } = useProject();
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [governance, setGovernance] = useState<ClientDocumentGovernanceItem[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState<{ id: string; decision: ClientDocumentDecision } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);
  const governanceByDocument = useMemo(() => new Map(governance.map((item) => [item.documentId, item])), [governance]);

  const load = useCallback(async () => {
    if (!selectedProject) {
      setDocuments([]);
      setGovernance([]);
      return;
    }
    setLoading(true);
    setError(null);
    const [documentResult, governanceResult] = await Promise.all([
      listDocuments(selectedProject.id),
      listClientDocumentGovernance(selectedProject.id),
    ]);
    setDocuments(documentResult.data);
    setGovernance(governanceResult.data);
    setError(documentResult.error ?? governanceResult.error);
    setLoading(false);
  }, [selectedProject]);

  useEffect(() => {
    const task = setTimeout(() => void load(), 0);
    return () => clearTimeout(task);
  }, [load]);

  const openDocument = async (document: DocumentSummary) => {
    setOpeningId(document.id);
    const result = await createDocumentSignedUrl(document);
    setOpeningId(null);
    if (result.error || !result.url) setError(result.error);
    else setError(await openExternalUrl(result.url));
  };

  const submitDecision = async (item: ClientDocumentGovernanceItem, decision: ClientDocumentDecision) => {
    const note = notes[item.documentId]?.trim() ?? '';
    if (decision !== 'accepted' && note.length < 3) {
      setError(decision === 'rejected' ? 'Informe brevemente o motivo da recusa.' : 'Informe suas ressalvas antes de confirmar.');
      return;
    }
    setSubmittingId(item.documentId);
    setError(null);
    setSuccess(null);
    const responseError = await acceptClientDocument(item.documentId, decision, note);
    setSubmittingId(null);
    setConfirmation(null);
    if (responseError) {
      setError(responseError);
      return;
    }
    setSuccess('Sua manifestação foi registrada e vinculada à versão exata deste documento.');
    await load();
  };

  return (
    <Screen>
      <PageHeader eyebrow="Arquivos privados" title="Documentos" description="Consulte os documentos liberados e registre seu aceite quando uma versão exigir manifestação formal." />
      <ProjectPicker />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}
      {loading ? <ActivityIndicator color={colors.gold600} /> : null}
      {!loading && selectedProject && documents.length === 0 ? (
        <StateView actionLabel="Atualizar" description="Os documentos publicados para este projeto aparecerão aqui." icon="document-text-outline" onAction={() => void load()} title="Nenhum documento publicado" />
      ) : null}
      {documents.map((document) => {
        const control = governanceByDocument.get(document.id);
        const pendingAcceptance = control?.acceptanceRequired && control.lifecycleStatus === 'aguardando_aceite';
        const activeConfirmation = confirmation?.id === document.id ? confirmation.decision : null;
        return (
          <Card key={document.id}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{document.title}</Text>
                <Text style={styles.meta}>{document.category} • {new Date(document.createdAt).toLocaleDateString('pt-BR')}</Text>
                <Text style={styles.protection}>{document.protectionMode === 'authored_pdf' ? 'PDF autoral: cópia identificada e registrada' : 'Administrativo: acesso autorizado ao cliente'}</Text>
                {control?.validUntil ? <Text style={styles.meta}>Validade: {new Date(`${control.validUntil}T00:00:00`).toLocaleDateString('pt-BR')}</Text> : null}
              </View>
              <View style={styles.pills}>
                <StatusPill label={`Versão ${control?.version ?? document.version ?? '1.0'}`} />
                {control ? <StatusPill label={statusLabels[control.lifecycleStatus] ?? control.lifecycleStatus} tone={control.lifecycleStatus.startsWith('aceito') ? 'success' : control.lifecycleStatus === 'recusado' || control.lifecycleStatus === 'expirado' ? 'danger' : pendingAcceptance ? 'warning' : 'neutral'} /> : null}
              </View>
            </View>
            <Button loading={openingId === document.id} onPress={() => void openDocument(document)} title={document.protectionMode === 'authored_pdf' ? 'Abrir cópia identificada' : 'Abrir / baixar documento autorizado'} variant="secondary" />
            {pendingAcceptance ? (
              <>
                <Notice tone="info">Leia o documento antes de registrar sua decisão. O aceite será vinculado à versão e ao snapshot congelado da emissão.</Notice>
                <Field label="Observação / ressalvas" multiline onChangeText={(value) => setNotes((current) => ({ ...current, [document.id]: value }))} placeholder="Obrigatório para aceite com ressalvas ou recusa" style={styles.comment} value={notes[document.id] ?? ''} />
                {!activeConfirmation ? (
                  <View style={styles.actions}>
                    <View style={styles.action}><Button onPress={() => setConfirmation({ id: document.id, decision: 'accepted' })} title="Aceitar versão" /></View>
                    <View style={styles.action}><Button onPress={() => setConfirmation({ id: document.id, decision: 'accepted_with_notes' })} title="Aceitar com ressalvas" variant="secondary" /></View>
                    <View style={styles.action}><Button onPress={() => setConfirmation({ id: document.id, decision: 'rejected' })} title="Recusar" variant="ghost" /></View>
                  </View>
                ) : (
                  <>
                    <Notice tone={activeConfirmation === 'accepted' ? 'success' : 'warning'}>
                      {activeConfirmation === 'accepted' ? 'Confirme para registrar definitivamente o aceite desta versão.' : 'Confirme para registrar esta manifestação com a observação informada.'}
                    </Notice>
                    <View style={styles.actions}>
                      <View style={styles.action}><Button loading={submittingId === document.id} onPress={() => void submitDecision(control, activeConfirmation)} title="Confirmar decisão" /></View>
                      <View style={styles.action}><Button disabled={submittingId === document.id} onPress={() => setConfirmation(null)} title="Cancelar" variant="ghost" /></View>
                    </View>
                  </>
                )}
              </>
            ) : control?.acceptanceDecision ? (
              <Notice tone={control.acceptanceDecision === 'rejected' ? 'danger' : 'success'}>Manifestação já registrada para esta versão. Uma versão futura exigirá uma nova manifestação.</Notice>
            ) : null}
          </Card>
        );
      })}
      {documents.length > 0 ? <Button loading={loading} onPress={() => void load()} title="Atualizar lista" variant="ghost" /> : null}
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 12, marginTop: 5, fontFamily: typography.family },
  protection: { color: colors.gold600, fontSize: 11, marginTop: 7, fontWeight: '700', fontFamily: typography.family },
  pills: { gap: spacing.xs, alignItems: 'flex-end' },
  comment: { minHeight: 88, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { minWidth: 145, flexGrow: 1, flexBasis: 0 },
});
