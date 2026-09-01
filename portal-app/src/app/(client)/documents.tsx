import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ProjectPicker } from '@/components/project-picker';
import { Button, Card, Notice, PageHeader, Screen, StateView, StatusPill } from '@/components/ui';
import { openExternalUrl } from '@/lib/external-link';
import { useProject } from '@/providers/project-provider';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { createDocumentSignedUrl, listDocuments } from '@/services/portal-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { DocumentSummary } from '@/types/domain';

export default function DocumentsScreen() {
  const { selectedProject } = useProject();
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);

  const load = useCallback(async () => {
    if (!selectedProject) { setDocuments([]); setFolder(null); return; }
    setLoading(true);
    const result = await listDocuments(selectedProject.id);
    setDocuments(result.data); setError(result.error); setLoading(false);
  }, [selectedProject]);
  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  const folders = useMemo(() => Object.entries(documents.reduce<Record<string, DocumentSummary[]>>((acc, item) => {
    const key = item.category?.trim() || 'Outros documentos';
    (acc[key] ??= []).push(item); return acc;
  }, {})).sort(([a], [b]) => a.localeCompare(b, 'pt-BR')), [documents]);
  const visible = folder ? folders.find(([name]) => name === folder)?.[1] ?? [] : [];

  const openDocument = async (document: DocumentSummary) => {
    setOpeningId(document.id); const result = await createDocumentSignedUrl(document); setOpeningId(null);
    setError(result.error || !result.url ? result.error : await openExternalUrl(result.url));
  };

  return <Screen>
    <PageHeader eyebrow="Arquivos do projeto" title="Documentos" description="Seus documentos organizados por categoria, como no portal." />
    <ProjectPicker />
    {error ? <Notice tone="danger">{error}</Notice> : null}
    {!loading && selectedProject && documents.length === 0 ? <StateView actionLabel="Atualizar" description="Os documentos publicados para este projeto aparecerão aqui." icon="document-text-outline" onAction={() => void load()} title="Nenhum documento publicado" /> : null}
    {!folder ? <View style={styles.folderGrid}>{folders.map(([name, items]) => <Pressable accessibilityRole="button" key={name} onPress={() => setFolder(name)} style={({pressed}) => [styles.folder, pressed && styles.pressed]}><Ionicons color={colors.gold600} name="folder-outline" size={30}/><Text style={styles.folderTitle}>{name}</Text><Text style={styles.folderCount}>{items.length} {items.length === 1 ? 'arquivo' : 'arquivos'}</Text></Pressable>)}</View> : <>
      <Button icon="arrow-back-outline" onPress={() => setFolder(null)} title="Voltar às pastas" variant="ghost" />
      <Text style={styles.sectionTitle}>{folder}</Text>
      {visible.map(document => <Card key={document.id}><View style={styles.header}><View style={{flex:1}}><Text style={styles.title}>{document.title}</Text><Text style={styles.meta}>{new Date(document.createdAt).toLocaleDateString('pt-BR')}</Text><Text style={styles.protection}>Acesso protegido e autorizado para sua conta</Text></View>{document.version ? <StatusPill label={`Versão ${document.version}`}/> : null}</View><Button loading={openingId === document.id} onPress={() => void openDocument(document)} title={document.protectionMode === 'authored_pdf' ? 'Visualizar documento' : 'Abrir documento'} variant="secondary"/></Card>)}
    </>}
    {documents.length > 0 ? <Button loading={loading} onPress={() => void load()} title="Atualizar documentos" variant="ghost"/> : null}
  </Screen>;
}

const styleDefinitions = (colors: ThemeColors) => ({
  folderGrid:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm}, folder:{flexGrow:1,flexBasis:145,minHeight:120,padding:spacing.md,borderRadius:radius.lg,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,gap:6}, pressed:{opacity:.75}, folderTitle:{color:colors.ink,fontSize:14,fontWeight:'700',fontFamily:typography.family}, folderCount:{color:colors.muted,fontSize:11,fontFamily:typography.family}, sectionTitle:{color:colors.ink,fontSize:typography.size.bodyLarge,fontWeight:'700',fontFamily:typography.family}, header:{flexDirection:'row',alignItems:'flex-start',gap:spacing.sm}, title:{color:colors.ink,fontSize:typography.size.bodyLarge,fontWeight:'700',fontFamily:typography.family}, meta:{color:colors.muted,fontSize:12,marginTop:5,fontFamily:typography.family}, protection:{color:colors.gold600,fontSize:11,marginTop:7,fontWeight:'700',fontFamily:typography.family}
});