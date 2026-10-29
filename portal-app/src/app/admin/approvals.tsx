import { useNotificationProject } from '@/hooks/use-notification-project';
import {Redirect,useLocalSearchParams as useLegacyParams} from 'expo-router';
import { useLiveRefresh } from '@/hooks/use-live-refresh';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { DateField } from '@/components/date-field';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { formatDate, humanizeStatus } from '@/lib/format';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { createAdminApproval, listAdminApprovals, listAdminProjects } from '@/services/admin-service';
import { listProjectContractDocuments, type ContractDocumentSummary } from '@/services/document-workflow-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AdminProjectSummary, ApprovalSummary } from '@/types/domain';

const APPROVAL_TYPES = [
  ['Etapa', 'Etapa do projeto'],
  ['Layout', 'Layout'],
  ['Projeto', 'Projeto'],
  ['Documento', 'Documento'],
  ['Material', 'Material'],
  ['Acabamento', 'Acabamento'],
  ['Revisão', 'Revisão'],
  ['Alteração', 'Alteração'],
  ['Entrega', 'Entrega'],
  ['Conclusão', 'Conclusão / finalização'],
  ['Outro', 'Outro'],
] as const;

export interface ApprovalDraft {type:string;approvalObject:string;description:string;relatedDocumentId:string|null;dueDate:string}

export function AdminApprovalsScreen({embedded=false,onProjectChange,contextProject,onCreated,initialDraft,onDraftChange,onSavingChange,confirmBeforeSubmit}:{onSavingChange?:(saving:boolean)=>void;confirmBeforeSubmit?:()=>Promise<boolean>;initialDraft?:ApprovalDraft;onDraftChange?:(draft:ApprovalDraft)=>void;embedded?:boolean;onProjectChange?:(id:string)=>void;contextProject?:AdminProjectSummary;onCreated?:()=>void}={}) {
  const [projects, setProjects] = useState<AdminProjectSummary[]>([]);
  const [items, setItems] = useState<ApprovalSummary[]>([]);
  const [documents, setDocuments] = useState<ContractDocumentSummary[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  useNotificationProject(projects, setProjectId);
  const [type, setType] = useState(initialDraft?.type??'Projeto');
  const [approvalObject, setApprovalObject] = useState(initialDraft?.approvalObject??'');
  const [description, setDescription] = useState(initialDraft?.description??'');
  const [relatedDocumentId, setRelatedDocumentId] = useState<string | null>(initialDraft?.relatedDocumentId??null);
  const [dueDate, setDueDate] = useState(initialDraft?.dueDate??'');
  useEffect(()=>{onDraftChange?.({type,approvalObject,description,relatedDocumentId,dueDate});},[type,approvalObject,description,relatedDocumentId,dueDate,onDraftChange]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);

  const load = useCallback(async () => {
    if(contextProject){setProjects([contextProject]);setProjectId(contextProject.id);return;}
    setLoading(true);
    const [p, a] = await Promise.all([listAdminProjects(), listAdminApprovals()]);
    setProjects(p.data);
    setItems(a.data);
    setProjectId((current) => current ?? p.data[0]?.id ?? null);
    setError(p.error ?? a.error);
    setLoading(false);
  }, [contextProject]);
  useLiveRefresh(load);

  useEffect(() => {
    if (!projectId) return;
    let mounted = true;
    void listProjectContractDocuments(projectId).then((result) => {
      if (!mounted) return;
      setDocuments(result.data);
      setRelatedDocumentId((current) => result.data.some((item) => item.id === current) ? current : null);
      if (result.error) setError(result.error);
    });
    return () => { mounted = false; };
  }, [projectId]);

  const selectedProject = contextProject ?? projects.find((item) => item.id === projectId) ?? null;

  const create = async () => {
    if (!selectedProject || approvalObject.trim().length < 3) {
      setError('Selecione o projeto e informe exatamente o que o cliente deverá avaliar.');
      return;
    }
    if(saving)return;
    setSaving(true);onSavingChange?.(true);setError(null);setSuccess(null);
    try{
    if(confirmBeforeSubmit&&!await confirmBeforeSubmit())return;
    const result = await createAdminApproval({
      project: selectedProject,
      type,
      approvalObject,
      description,
      relatedDocumentId,
      dueDate: dueDate || null,
    });
    if (result) { setError(result); return; }
    setSuccess('Aprovação enviada ao cliente com objeto, contexto e prazo registrados.');
    setApprovalObject(''); setDescription(''); setRelatedDocumentId(null); setDueDate('');
    await load();
    onCreated?.();
    }catch{setError('Não foi possível criar a aprovação. Tente novamente.');}
    finally{setSaving(false);onSavingChange?.(false);}
  };

  return (
    <Screen scroll={!contextProject}>
      {!embedded ? <AdminPageHeader
        description="Crie somente decisões ou entregas que realmente precisem de manifestação do cliente."
        title="Aprovações"
      /> : null}
      {!contextProject ? <Notice tone="info">O cliente é quem registra a decisão. Esta tela cria o objeto a ser avaliado; ela não aceita ou recusa no lugar dele.</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      {!contextProject ? <Card>
        <Text style={styles.sectionTitle}>1. Projeto / contrato</Text>
        <View style={styles.projectList}>
          {projects.map((project) => (
            <Pressable key={project.id} onPress={() => { setProjectId(project.id); onProjectChange?.(project.id); setDocuments([]); setRelatedDocumentId(null); }} style={[styles.projectChip, projectId === project.id && styles.selected]}>
              <Text style={[styles.projectText, projectId === project.id && styles.selectedText]}>{project.contractNumber} • {project.name}</Text>
            </Pressable>
          ))}
        </View>
      </Card> : null}

      <Card>
        <Text style={styles.sectionTitle}>2. O que o cliente deverá aprovar?</Text>
        <View style={styles.chips}>
          {APPROVAL_TYPES.filter(([value])=>!contextProject||value!=='Documento').map(([value, label]) => (
            <Pressable key={value} onPress={() => setType(value)} style={[styles.chip, type === value && styles.selected]}>
              <Text style={[styles.projectText, type === value && styles.selectedText]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Objeto específico</Text>
        <Field
          label="Objeto que será avaliado *"
          placeholder="Ex.: Layout térreo — versão 03"
          value={approvalObject}
          onChangeText={setApprovalObject}
        />
        <Field
          label="Descrição para o cliente"
          multiline
          placeholder="Explique de forma objetiva o que deve ser conferido e qual decisão é esperada."
          value={description}
          onChangeText={setDescription}
          style={styles.descriptionField}
        />

        <Text style={styles.sectionTitle}>Documento relacionado, quando houver</Text>
        {documents.length === 0 ? (
          <Text style={styles.meta}>Nenhum documento contratual está disponível para vincular neste projeto.</Text>
        ) : (
          <View style={styles.documentList}>
            <Pressable onPress={() => setRelatedDocumentId(null)} style={[styles.documentChip, relatedDocumentId === null && styles.selected]}>
              <Text style={styles.projectText}>Sem documento relacionado</Text>
            </Pressable>
            {documents.map((document) => (
              <Pressable key={document.id} onPress={() => setRelatedDocumentId(document.id)} style={[styles.documentChip, relatedDocumentId === document.id && styles.selected]}>
                <Text style={[styles.projectText, relatedDocumentId === document.id && styles.selectedText]}>
                  {document.title} • {document.status}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <DateField label="Prazo para manifestação" optional value={dueDate} onChange={setDueDate} />
        <Notice tone="info">Sem prazo manual, permanecem válidas as regras contratuais e automações já configuradas no sistema.</Notice>
        <Button loading={saving} onPress={() => void create()} title="Enviar aprovação ao cliente" />
      </Card>

      {!contextProject?<Text style={styles.sectionTitle}>Histórico</Text>:null}
      {loading&&!contextProject ? <ActivityIndicator color={colors.gold600} /> : null}
      {!contextProject && !loading && items.length === 0 ? <StateView description="Nenhuma aprovação cadastrada." icon="checkmark-done-outline" title="Sem aprovações" /> : null}
      {!contextProject && items.map((item) => (
        <Card key={item.id}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.type}>{item.type.toUpperCase()}</Text>
              <Text style={styles.title}>{item.approvalObject || item.title}</Text>
              <Text style={styles.meta}>
                criada em {formatDate(item.createdAt)}
                {item.dueAt ? ` • prazo ${formatDate(item.dueAt)}` : ''}
                {item.relatedDocumentId ? ' • documento vinculado' : ''}
              </Text>
            </View>
            <StatusPill label={humanizeStatus(item.status)} tone={item.status === 'aprovado' ? 'success' : item.status === 'aprovado_com_ressalvas' ? 'warning' : item.status === 'rejeitado' ? 'danger' : 'warning'} />
          </View>
          {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
          {item.status !== 'aguardando' ? <Notice tone={item.status === 'aprovado' ? 'success' : item.status === 'rejeitado' ? 'danger' : 'warning'}>{item.comment || 'Resposta registrada sem comentário.'}</Notice> : null}
        </Card>
      ))}
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700' as const, fontFamily: typography.family },
  projectList: { gap: spacing.xs },
  projectChip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm },
  selected: { borderColor: colors.gold500, backgroundColor: colors.warningSoft },
  projectText: { color: colors.slate, fontSize: 12, fontFamily: typography.family },
  selectedText: { color: colors.gold600, fontWeight: '700' as const },
  descriptionField: { minHeight: 105, textAlignVertical: 'top' as const },
  chips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.xs },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 9 },
  documentList: { gap: spacing.xs },
  documentChip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm },
  header: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: spacing.sm },
  type: { color: colors.gold600, fontSize: 10, fontWeight: '700' as const, letterSpacing: 1, fontFamily: typography.family },
  title: { color: colors.ink, fontSize: typography.size.bodyLarge, marginTop: 3, fontWeight: '700' as const, fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 11, marginTop: 4, lineHeight: 17, fontFamily: typography.family },
  description: { color: colors.slate, fontSize: 13, lineHeight: 19, fontFamily: typography.family },
});

export default function LegacyDocumentRoute(){const params=useLegacyParams<{projectId?:string}>();return <Redirect href={{pathname:'/admin/document-center',params:{...params,view:'approvals'}}} />;}
