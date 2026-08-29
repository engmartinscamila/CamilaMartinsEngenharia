import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { ProjectPicker } from '@/components/project-picker';
import { Button, Card, Notice, PageHeader, Screen, StateView, StatusPill } from '@/components/ui';
import { openExternalUrl } from '@/lib/external-link';
import { useProject } from '@/providers/project-provider';
import { useThemeStyles } from '@/providers/theme-provider';
import { createDocumentSignedUrl, listDocuments } from '@/services/portal-service';
import { spacing, ThemeColors, typography } from '@/theme/tokens';
import type { DocumentSummary } from '@/types/domain';

export default function DocumentsScreen() {
  const { selectedProject } = useProject();
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const styles = useThemeStyles(styleDefinitions);

  const load = useCallback(async () => {
    if (!selectedProject) {
      setDocuments([]);
      return;
    }
    setLoading(true);
    const result = await listDocuments(selectedProject.id);
    setDocuments(result.data);
    setError(result.error);
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

  return (
    <Screen>
      <PageHeader eyebrow="Arquivos privados" title="Documentos" description="Documentos administrativos autorizados e cópias identificadas de materiais técnicos autorais." />
      <ProjectPicker />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {!loading && selectedProject && documents.length === 0 ? (
        <StateView
          actionLabel="Atualizar"
          description="Os documentos publicados para este projeto aparecerão aqui."
          icon="document-text-outline"
          onAction={() => void load()}
          title="Nenhum documento publicado"
        />
      ) : null}
      {documents.map((document) => (
        <Card key={document.id}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{document.title}</Text>
              <Text style={styles.meta}>{document.category} • {new Date(document.createdAt).toLocaleDateString('pt-BR')}</Text>
              <Text style={styles.protection}>{document.protectionMode === 'authored_pdf' ? 'PDF autoral: cópia identificada e registrada' : 'Administrativo: download autorizado ao cliente'}</Text>
            </View>
            {document.version ? <StatusPill label={`Versão ${document.version}`} /> : null}
          </View>
          <Button loading={openingId === document.id} onPress={() => void openDocument(document)} title={document.protectionMode === 'authored_pdf' ? 'Abrir cópia identificada' : 'Abrir / baixar documento autorizado'} variant="secondary" />
        </Card>
      ))}
      {documents.length > 0 ? <Button loading={loading} onPress={() => void load()} title="Atualizar lista" variant="ghost" /> : null}
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 12, marginTop: 5, fontFamily: typography.family },
  protection: { color: colors.gold600, fontSize: 11, marginTop: 7, fontWeight: '700', fontFamily: typography.family },
});
