import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { AdminPageHeader, SelectionChips } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { openExternalUrl } from '@/lib/external-link';
import { supabase } from '@/lib/supabase';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { createAdminContentSignedUrl, deleteAdminContent, listAdminContent, listAdminProjects, uploadAdminContent } from '@/services/admin-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AdminContentKind, AdminContentSummary, AdminProjectSummary } from '@/types/domain';

const kindLabels: Record<AdminContentKind, string> = { document: 'Documento', photo: 'Foto', library: 'Biblioteca' };
const sectionTitles: Record<AdminContentKind, string> = {
  document: 'Documentos',
  photo: 'Fotos e evolução da obra',
  library: 'Biblioteca',
};
const sectionDescriptions: Record<AdminContentKind, string> = {
  document: 'Envie, classifique e organize documentos privados no contrato e projeto corretos.',
  photo: 'Publique registros fotográficos protegidos e vinculados ao projeto correto.',
  library: 'Organize guias, catálogos e materiais exclusivos de cada projeto.',
};

function isAdminContentKind(value: string | undefined): value is AdminContentKind {
  return value === 'document' || value === 'photo' || value === 'library';
}

type DocumentClassification =
  | 'art_rrt'
  | 'contract'
  | 'quote'
  | 'receipt'
  | 'administrative'
  | 'authored_technical'
  | 'other_downloadable'
  | 'other_protected';

const documentClassifications: {
  value: DocumentClassification;
  label: string;
  category: string;
  protectionMode: 'administrative' | 'authored_pdf';
}[] = [
  { value: 'art_rrt', label: 'ART/RRT', category: 'ART/RRT', protectionMode: 'administrative' },
  { value: 'contract', label: 'Contrato', category: 'Contrato', protectionMode: 'administrative' },
  { value: 'quote', label: 'Orçamento ou proposta', category: 'Orçamento/Proposta', protectionMode: 'administrative' },
  { value: 'receipt', label: 'Comprovante ou recibo', category: 'Comprovante/Recibo', protectionMode: 'administrative' },
  { value: 'administrative', label: 'Outro administrativo', category: 'Documento administrativo', protectionMode: 'administrative' },
  { value: 'authored_technical', label: 'Projeto ou relatório técnico autoral', category: 'Documento técnico autoral', protectionMode: 'authored_pdf' },
  { value: 'other_downloadable', label: 'Outro: cliente pode baixar', category: 'Outro documento baixável', protectionMode: 'administrative' },
  { value: 'other_protected', label: 'Outro: original protegido', category: 'Outro documento autoral protegido', protectionMode: 'authored_pdf' },
];

export default function AdminContentScreen() {
  const params = useLocalSearchParams<{ tipo?: string | string[] }>();
  const requestedKind = Array.isArray(params.tipo) ? params.tipo[0] : params.tipo;
  const [projects, setProjects] = useState<AdminProjectSummary[]>([]);
  const [items, setItems] = useState<AdminContentSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [kind, setKind] = useState<AdminContentKind>(isAdminContentKind(requestedKind) ? requestedKind : 'document');
  const [documentClassification, setDocumentClassification] = useState<DocumentClassification | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [version, setVersion] = useState('1.0');
  const [protectionMode, setProtectionMode] = useState<'administrative' | 'authored_pdf' | 'authored_photo'>('administrative');
  const [asset, setAsset] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminContentSummary | null>(null);
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);
  const visibleItems = items.filter((item) => item.kind === kind);

  const load = useCallback(async () => {
    setLoading(true);
    const [projectResult, contentResult] = await Promise.all([listAdminProjects(), listAdminContent()]);
    setProjects(projectResult.data);
    setItems(contentResult.data);
    setSelectedProjectId((current) => current ?? projectResult.data[0]?.id ?? null);
    setError(projectResult.error ?? contentResult.error);
    setLoading(false);
  }, []);

  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  const pick = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false, type: kind === 'photo' ? 'image/*' : ['application/pdf', 'image/*'] });
    const selected = result.canceled ? null : result.assets[0] ?? null;
    if (selected) {
      setAsset(selected);
      if (!title.trim()) setTitle(selected.name.replace(/\.[^.]+$/, ''));
    }
  };

  const upload = async () => {
    const project = projects.find((item) => item.id === selectedProjectId);
    if (!project || !asset || title.trim().length < 2) {
      setError('Selecione projeto e arquivo, e informe um título.');
      return;
    }
    const selectedClassification = kind === 'document'
      ? documentClassifications.find((item) => item.value === documentClassification) ?? null
      : null;
    if (kind === 'document' && !selectedClassification) {
      setError('Escolha a classificação do documento para definir, com segurança, se o cliente poderá baixá-lo.');
      return;
    }
    const resolvedProtectionMode = selectedClassification?.protectionMode ?? protectionMode;
    const complementaryCategory = category.trim();
    const resolvedCategory = selectedClassification
      ? `${selectedClassification.category}${complementaryCategory ? ` — ${complementaryCategory}` : ''}`
      : complementaryCategory;
    setSaving(true); setError(null); setSuccess(null);
    const result = await uploadAdminContent({ kind, clientId: project.clientId, projectId: project.id, title, category: resolvedCategory, version, protectionMode: resolvedProtectionMode, asset });
    setSaving(false);
    if (result) setError(result);
    else {
      setSuccess(selectedClassification
        ? selectedClassification.protectionMode === 'administrative'
          ? 'Arquivo publicado. Somente o cliente vinculado ao projeto poderá visualizá-lo e baixá-lo.'
          : 'Arquivo autoral publicado. O original permanece privado; cada abertura gera uma cópia PDF identificada e rastreável.'
        : 'Arquivo enviado e vinculado ao projeto.');
      setTitle(''); setCategory(''); setVersion('1.0'); setAsset(null); setDocumentClassification(null);
      await load();
    }
  };

  const open = async (item: AdminContentSummary) => {
    if (item.kind === 'document' && item.protectionMode === 'authored_pdf') {
      const issued = await supabase.functions.invoke('issue-protected-asset', {
        body: { assetId: item.id, kind: 'document', action: 'view' },
      });
      if (issued.error || !issued.data?.url) {
        setError('Não foi possível gerar a cópia PDF identificada deste material autoral.');
        return;
      }
      setSuccess(issued.data?.trackingCode ? `Cópia rastreável gerada: ${issued.data.trackingCode}` : 'Cópia rastreável gerada com sucesso.');
      setError(await openExternalUrl(issued.data.url));
      return;
    }
    const result = await createAdminContentSignedUrl(item);
    if (!result.url) setError(result.error);
    else setError(await openExternalUrl(result.url));
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setSaving(true); setError(null);
    const result = await deleteAdminContent(deleteTarget);
    setSaving(false); setDeleteTarget(null);
    if (result) setError(result);
    else { setSuccess('Arquivo e metadados excluídos.'); await load(); }
  };

  return (
    <Screen>
      <AdminPageHeader description={sectionDescriptions[kind]} title={sectionTitles[kind]} />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}
      <Card>
        <Text style={styles.sectionTitle}>Publicar novo conteúdo</Text>
        <SelectionChips<AdminContentKind> items={[{ value: 'document', label: 'Documento' }, { value: 'photo', label: 'Foto' }, { value: 'library', label: 'Biblioteca' }]} label="Tipo" onChange={(value) => { setKind(value); setAsset(null); setDocumentClassification(null); setProtectionMode(value === 'photo' ? 'authored_photo' : 'administrative'); }} value={kind} />
        {kind === 'document' ? (
          <>
            <SelectionChips<DocumentClassification>
              items={documentClassifications.map(({ value, label }) => ({ value, label }))}
              label="Classificação obrigatória do documento"
              onChange={(value) => {
                setDocumentClassification(value);
                const selected = documentClassifications.find((item) => item.value === value);
                if (selected) setProtectionMode(selected.protectionMode);
              }}
              value={documentClassification}
            />
            {documentClassification ? (
              <Notice tone={protectionMode === 'administrative' ? 'success' : 'warning'}>
                {protectionMode === 'administrative'
                  ? 'Resultado: o cliente vinculado a este projeto poderá visualizar e baixar o arquivo. Ele não ficará público.'
                  : 'Resultado: o original não será liberado. Cada acesso gera um PDF identificado com cliente, contrato, código de rastreio e registro da emissão.'}
              </Notice>
            ) : (
              <Notice tone="warning">Escolha uma classificação. O sistema não deduz a permissão pelo nome do arquivo.</Notice>
            )}
          </>
        ) : null}
        {kind === 'photo' ? <SelectionChips<'authored_photo' | 'administrative'> items={[{ value: 'authored_photo', label: 'Autoral: marca d’água' }, { value: 'administrative', label: 'Administrativa: original autorizado' }]} label="Proteção" onChange={setProtectionMode} value={protectionMode as 'authored_photo' | 'administrative'} /> : null}
        <Text style={styles.label}>Contrato e projeto</Text>
        <View style={styles.projectList}>{projects.map((project) => <Pressable key={project.id} onPress={() => setSelectedProjectId(project.id)} style={[styles.projectChip, selectedProjectId === project.id && styles.projectSelected]}><Text style={[styles.projectText, selectedProjectId === project.id && styles.projectTextSelected]}>{project.contractNumber} • {project.name}</Text></Pressable>)}</View>
        <Field label="Título" onChangeText={setTitle} value={title} />
        <Field label={kind === 'document' ? 'Descrição complementar (opcional)' : 'Categoria'} onChangeText={setCategory} placeholder={kind === 'photo' ? 'Ex.: Fundação' : kind === 'document' ? 'Ex.: ART de execução ou Revisão estrutural' : 'Ex.: Manual'} value={category} />
        {kind === 'document' ? <Field label="Versão do documento" onChangeText={setVersion} placeholder="Ex.: 1.0 ou Revisão B" value={version} /> : null}
        <Button icon="attach-outline" onPress={() => void pick()} title={asset ? `Selecionado: ${asset.name}` : 'Escolher arquivo'} variant="secondary" />
        <Button disabled={!asset || (kind === 'document' && !documentClassification)} loading={saving} onPress={() => void upload()} title="Enviar e publicar" />
        <Notice tone="info">ART/RRT, contratos, orçamentos e documentos administrativos continuam baixáveis apenas pelo cliente vinculado. PDFs técnicos e materiais autorais mantêm o original privado; cada visualização emite uma cópia identificada e rastreável. Capturas de tela não podem ser impedidas completamente.</Notice>
      </Card>
      {loading ? <ActivityIndicator color={colors.gold600} /> : null}
      {!loading && visibleItems.length === 0 ? <StateView description={`Nenhum conteúdo da categoria ${kindLabels[kind].toLowerCase()} foi publicado.`} icon="folder-open-outline" title={`${sectionTitles[kind]} sem conteúdo`} /> : null}
      {visibleItems.map((item) => (
        <Card key={`${item.kind}-${item.id}`}>
          <View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.title}>{item.title}</Text><Text style={styles.meta}>{item.clientName} • {item.projectName}</Text><Text style={styles.meta}>{item.category}{item.version ? ` • Versão ${item.version}` : ''} • {formatDate(item.createdAt)}</Text><Text style={styles.protection}>{item.protectionMode === 'authored_pdf' ? 'Original bloqueado • PDF rastreável por acesso' : item.protectionMode === 'authored_photo' ? 'Foto autoral protegida • cópia identificada' : item.kind === 'document' && item.allowDownload ? 'Cliente do projeto pode baixar' : 'Acesso privado do projeto'}</Text></View><StatusPill label={kindLabels[item.kind]} /></View>
          <View style={styles.actions}><View style={styles.grow}><Button onPress={() => void open(item)} title={item.protectionMode === 'authored_pdf' ? 'Gerar e abrir cópia rastreável' : 'Abrir com link seguro'} variant="secondary" /></View><View style={styles.grow}><Button onPress={() => setDeleteTarget(item)} title="Excluir" variant="danger" /></View></View>
        </Card>
      ))}
      {deleteTarget ? <Card><Notice tone="danger">Confirme a exclusão de “{deleteTarget.title}”. O arquivo será removido do Storage e da lista.</Notice><View style={styles.actions}><View style={styles.grow}><Button loading={saving} onPress={() => void remove()} title="Confirmar exclusão" variant="danger" /></View><View style={styles.grow}><Button onPress={() => setDeleteTarget(null)} title="Cancelar" variant="ghost" /></View></View></Card> : null}
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  label: { color: colors.ink, fontSize: 13, fontWeight: '600', fontFamily: typography.family },
  projectList: { gap: spacing.xs, maxHeight: 220 },
  projectChip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, padding: spacing.sm },
  projectSelected: { borderColor: colors.gold500, backgroundColor: colors.warningSoft },
  projectText: { color: colors.slate, fontSize: 12, fontFamily: typography.family },
  projectTextSelected: { color: colors.gold600, fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4, fontFamily: typography.family },
  protection: { color: colors.gold600, fontSize: 11, marginTop: 6, fontWeight: '700', fontFamily: typography.family },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, grow: { flexGrow: 1, flexBasis: 160 },
});
