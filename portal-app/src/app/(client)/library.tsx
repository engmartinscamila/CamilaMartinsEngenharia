import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { ProjectPicker } from '@/components/project-picker';
import { Button, Card, Notice, PageHeader, Screen, StateView, StatusPill } from '@/components/ui';
import { formatBytes, formatDate } from '@/lib/format';
import { openExternalUrl } from '@/lib/external-link';
import { useProject } from '@/providers/project-provider';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { createStorageSignedUrl, listLibraryItems } from '@/services/portal-service';
import { spacing, ThemeColors, typography } from '@/theme/tokens';
import type { LibraryItemSummary } from '@/types/domain';

export default function LibraryScreen() {
  const { selectedProject } = useProject();
  const [items, setItems] = useState<LibraryItemSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);

  const load = useCallback(async () => {
    if (!selectedProject) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await listLibraryItems(selectedProject.id, selectedProject.clientId);
    setItems(result.data);
    setError(result.error);
    setLoading(false);
  }, [selectedProject]);

  useEffect(() => {
    const task = setTimeout(() => void load(), 0);
    return () => clearTimeout(task);
  }, [load]);

  const openItem = async (item: LibraryItemSummary) => {
    if (!item.storagePath) {
      setError('Este material ainda não possui um arquivo publicado.');
      return;
    }
    setOpeningId(item.id);
    const response = await createStorageSignedUrl(item.storageBucket, item.storagePath);
    setOpeningId(null);
    if (!response.url) setError(response.error);
    else setError(await openExternalUrl(response.url));
  };

  return (
    <Screen>
      <PageHeader eyebrow="Conteúdo exclusivo" title="Biblioteca" description="Guias, referências e materiais liberados para este projeto." />
      <ProjectPicker />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {loading ? <ActivityIndicator color={colors.gold600} /> : null}
      {!loading && selectedProject && items.length === 0 ? (
        <StateView actionLabel="Atualizar" description="Os materiais liberados pela equipe aparecerão aqui." icon="library-outline" onAction={() => void load()} title="Biblioteca vazia" />
      ) : null}
      {items.map((item) => (
        <Card key={item.id}>
          <View style={styles.header}>
            <View style={styles.icon}><Ionicons color={colors.gold600} name="library-outline" size={22} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>{item.category ?? 'Material'} • {item.fileType ?? 'Arquivo'} • {formatDate(item.createdAt)}</Text>
            </View>
            <StatusPill label={item.projectId ? 'Projeto' : 'Geral'} />
          </View>
          {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
          {formatBytes(item.sizeBytes) ? <Text style={styles.size}>{formatBytes(item.sizeBytes)}</Text> : null}
          <Button icon="lock-open-outline" loading={openingId === item.id} onPress={() => void openItem(item)} title="Abrir com link seguro" variant="secondary" />
        </Card>
      ))}
      {items.length > 0 ? <Button loading={loading} onPress={() => void load()} title="Atualizar biblioteca" variant="ghost" /> : null}
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.warningSoft },
  title: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 11, marginTop: 4, fontFamily: typography.family },
  description: { color: colors.slate, fontSize: 13, lineHeight: 19, fontFamily: typography.family },
  size: { color: colors.muted, fontSize: 11, fontFamily: typography.family },
});
