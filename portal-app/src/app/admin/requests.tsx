import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { AdminPageHeader, SelectionChips } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { formatDate, humanizeStatus } from '@/lib/format';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import {
  createAdminRequest,
  listAdminProjects,
  listAdminRequests,
  updateAdminRequest,
} from '@/services/admin-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AdminProjectSummary, AdminRequestSummary } from '@/types/domain';

type RequestStatus = 'nova' | 'em_analise' | 'aguardando_cliente' | 'em_execucao' | 'concluida' | 'cancelada';
type RequestCategory = 'duvida' | 'alteracao_projeto' | 'documento' | 'financeiro' | 'agendamento' | 'obra' | 'suporte' | 'outros';

const categories: { value: RequestCategory; label: string }[] = [
  { value: 'duvida', label: 'Dúvida' },
  { value: 'alteracao_projeto', label: 'Alteração de projeto' },
  { value: 'documento', label: 'Documento' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'agendamento', label: 'Agendamento' },
  { value: 'obra', label: 'Obra' },
  { value: 'suporte', label: 'Suporte' },
  { value: 'outros', label: 'Outros' },
];

const closedStatuses = new Set(['concluida', 'cancelada']);

function requestTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'concluida') return 'success';
  if (status === 'cancelada') return 'danger';
  if (status === 'aguardando_cliente' || status === 'em_execucao' || status === 'em_analise') return 'warning';
  return 'neutral';
}

export default function AdminRequestsScreen() {
  const [items, setItems] = useState<AdminRequestSummary[]>([]);
  const [projects, setProjects] = useState<AdminProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [category, setCategory] = useState<RequestCategory>('duvida');
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [editing, setEditing] = useState<AdminRequestSummary | null>(null);
  const [status, setStatus] = useState<RequestStatus>('em_analise');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);

  const openItems = useMemo(() => items.filter((item) => !closedStatuses.has(item.status)), [items]);
  const closedItems = useMemo(() => items.filter((item) => closedStatuses.has(item.status)), [items]);

  const load = useCallback(async () => {
    setLoading(true);
    const [requestResult, projectResult] = await Promise.all([listAdminRequests(), listAdminProjects()]);
    setItems(requestResult.data);
    setProjects(projectResult.data);
    setSelectedProjectId((current) => current ?? projectResult.data[0]?.id ?? null);
    setError(requestResult.error ?? projectResult.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    const task = setTimeout(() => void load(), 0);
    return () => clearTimeout(task);
  }, [load]);

  const create = async () => {
    const project = projects.find((item) => item.id === selectedProjectId);
    setError(null);
    setSuccess(null);
    if (!project || newTitle.trim().length < 3 || newMessage.trim().length < 5) {
      setError('Selecione o projeto e preencha título e mensagem da solicitação.');
      return;
    }
    setSaving(true);
    const result = await createAdminRequest({ project, category, title: newTitle, message: newMessage });
    setSaving(false);
    if (result) setError(result);
    else {
      setNewTitle('');
      setNewMessage('');
      setCategory('duvida');
      setSuccess('Solicitação enviada ao cliente. Ela ficará aguardando a resposta dele.');
      await load();
    }
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const result = await updateAdminRequest(editing.id, status, reply);
    setSaving(false);
    if (result) setError(result);
    else {
      setSuccess(status === 'concluida'
        ? 'Solicitação concluída e movida para o histórico.'
        : reply.trim()
          ? 'Resposta enviada e andamento atualizado.'
          : 'Andamento atualizado.');
      setEditing(null);
      setReply('');
      await load();
    }
  };

  const renderRequest = (item: AdminRequestSummary, closed: boolean) => (
    <Card key={item.id}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.origin}>{item.origin === 'cliente' ? 'ENVIADA PELO CLIENTE' : 'ENVIADA PELA ADMINISTRAÇÃO'}</Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.meta}>{humanizeStatus(item.category)} • {item.clientName} • {item.projectName} • {formatDate(item.updatedAt)}</Text>
        </View>
        <StatusPill label={humanizeStatus(item.status)} tone={requestTone(item.status)} />
      </View>
      {item.message ? <Text style={styles.message}>{item.message}</Text> : null}
      {!closed ? (
        <Button
          onPress={() => {
            setEditing(item);
            setStatus(item.status as RequestStatus);
            setReply('');
          }}
          title="Atender solicitação"
          variant="secondary"
        />
      ) : (
        <Notice tone={item.status === 'concluida' ? 'success' : 'warning'}>
          Solicitação encerrada. Não há mais ações disponíveis.
        </Notice>
      )}
    </Card>
  );

  return (
    <Screen>
      <AdminPageHeader description="Envie solicitações aos clientes, atenda as recebidas e mantenha as encerradas somente no histórico." title="Solicitações" />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      <Card>
        <Text style={styles.sectionTitle}>Nova solicitação para o cliente</Text>
        <Text style={styles.sectionDescription}>Use esta área quando a equipe precisar de uma resposta ou informação do cliente.</Text>
        <Text style={styles.label}>Projeto e contrato</Text>
        <View style={styles.projectList}>
          {projects.map((project) => (
            <Pressable
              key={project.id}
              onPress={() => setSelectedProjectId(project.id)}
              style={[styles.projectChip, selectedProjectId === project.id && styles.selected]}
            >
              <Text style={[styles.projectText, selectedProjectId === project.id && styles.selectedText]}>{project.contractNumber} • {project.name} • {project.clientName}</Text>
            </Pressable>
          ))}
        </View>
        <SelectionChips<RequestCategory> items={categories} label="Categoria" onChange={setCategory} value={category} />
        <Field label="Título" maxLength={120} onChangeText={setNewTitle} value={newTitle} />
        <Field label="Mensagem para o cliente" maxLength={4000} multiline onChangeText={setNewMessage} style={styles.reply} value={newMessage} />
        <Button loading={saving} onPress={() => void create()} title="Enviar solicitação ao cliente" />
      </Card>

      {editing ? (
        <Card>
          <Text style={styles.sectionTitle}>Atender: {editing.title}</Text>
          <SelectionChips<RequestStatus>
            items={[
              { value: 'nova', label: 'Nova' },
              { value: 'em_analise', label: 'Em análise' },
              { value: 'aguardando_cliente', label: 'Aguardando cliente' },
              { value: 'em_execucao', label: 'Em execução' },
              { value: 'concluida', label: 'Concluída' },
              { value: 'cancelada', label: 'Cancelada' },
            ]}
            label="Andamento"
            onChange={setStatus}
            value={status}
          />
          <Field label="Resposta (opcional)" multiline onChangeText={setReply} placeholder="Escreva uma mensagem para o cliente" style={styles.reply} value={reply} />
          <View style={styles.actions}>
            <View style={styles.grow}><Button loading={saving} onPress={() => void save()} title="Salvar e enviar" /></View>
            <View style={styles.grow}><Button onPress={() => setEditing(null)} title="Cancelar" variant="ghost" /></View>
          </View>
        </Card>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Solicitações em aberto</Text>
        <StatusPill label={`${openItems.length} aberta${openItems.length === 1 ? '' : 's'}`} tone={openItems.length ? 'warning' : 'success'} />
      </View>
      {loading ? <ActivityIndicator color={colors.gold600} /> : null}
      {!loading && openItems.length === 0 ? <StateView description="Nenhuma solicitação exige atendimento agora." icon="checkmark-circle-outline" title="Tudo atendido" /> : null}
      {openItems.map((item) => renderRequest(item, false))}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Solicitações concluídas</Text>
        <StatusPill label={`${closedItems.length} no histórico`} tone="success" />
      </View>
      {closedItems.length === 0 ? <StateView description="As solicitações encerradas aparecerão aqui, sem botão de atendimento." icon="archive-outline" title="Histórico vazio" /> : null}
      {closedItems.map((item) => renderRequest(item, true))}

      <Button loading={loading} onPress={() => void load()} title="Atualizar solicitações" variant="ghost" />
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  headerCopy: { flex: 1 },
  origin: { color: colors.gold600, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, fontFamily: typography.family },
  title: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family, marginTop: 3 },
  meta: { color: colors.muted, fontSize: 11, marginTop: 4, fontFamily: typography.family },
  message: { color: colors.slate, fontSize: 13, lineHeight: 20, fontFamily: typography.family },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.sm },
  sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  sectionDescription: { color: colors.muted, fontSize: 12, lineHeight: 18, fontFamily: typography.family },
  label: { color: colors.ink, fontSize: 13, fontWeight: '600', fontFamily: typography.family },
  projectList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  projectChip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm },
  selected: { borderColor: colors.gold500, backgroundColor: colors.warningSoft },
  projectText: { color: colors.slate, fontSize: 12, fontFamily: typography.family },
  selectedText: { color: colors.gold600, fontWeight: '700' },
  reply: { minHeight: 100, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grow: { flexGrow: 1, flexBasis: 150 },
});
