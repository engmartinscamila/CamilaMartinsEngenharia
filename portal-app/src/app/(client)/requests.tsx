import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { ProjectPicker } from '@/components/project-picker';
import { SelectionChips } from '@/components/admin-ui';
import { Button, Card, Field, Notice, PageHeader, Screen, StateView, StatusPill } from '@/components/ui';
import { humanizeStatus } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';
import { useProject } from '@/providers/project-provider';
import { useThemeStyles } from '@/providers/theme-provider';
import { createRequest, listRequestReplies, listRequests, replyToOwnRequest } from '@/services/portal-service';
import { spacing, ThemeColors, typography } from '@/theme/tokens';
import type { RequestReplySummary, RequestSummary } from '@/types/domain';

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

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'concluida') return 'success';
  if (status === 'cancelada') return 'danger';
  if (status === 'aguardando_cliente') return 'warning';
  return 'neutral';
}

export default function RequestsScreen() {
  const params = useLocalSearchParams<{ assunto?: string }>();
  const { client, role } = useAuth();
  const { selectedProject } = useProject();
  const [items, setItems] = useState<RequestSummary[]>([]);
  const [replies, setReplies] = useState<RequestReplySummary[]>([]);
  const requestedSubject = typeof params.assunto === 'string' ? params.assunto.trim().slice(0, 120) : '';
  const [category, setCategory] = useState<RequestCategory>(requestedSubject ? 'suporte' : 'duvida');
  const [title, setTitle] = useState(requestedSubject);
  const [message, setMessage] = useState('');
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const styles = useThemeStyles(styleDefinitions);
  const openItems = useMemo(() => items.filter((item) => !['concluida', 'cancelada'].includes(item.status)), [items]);
  const closedItems = useMemo(() => items.filter((item) => ['concluida', 'cancelada'].includes(item.status)), [items]);

  const load = useCallback(async () => {
    if (!selectedProject) {
      setItems([]);
      return;
    }
    setLoading(true);
    const result = await listRequests(selectedProject.id);
    const history = await listRequestReplies(result.data.map((item) => item.id));
    setItems(result.data);
    setReplies(history.data);
    setError(result.error ?? history.error);
    setLoading(false);
  }, [selectedProject]);

  useEffect(() => {
    const task = setTimeout(() => void load(), 0);
    return () => clearTimeout(task);
  }, [load]);

  useEffect(() => {
    if (!requestedSubject) return;
    const task = setTimeout(() => {
      setCategory('suporte');
      setTitle(requestedSubject);
    }, 0);
    return () => clearTimeout(task);
  }, [requestedSubject]);

  const submit = async () => {
    setError(null);
    setSuccess(null);
    if (!client || role !== 'client' || !selectedProject) {
      setError('Sua conta não possui permissão para criar uma solicitação neste projeto.');
      return;
    }
    if (title.trim().length < 3 || message.trim().length < 5) {
      setError('Informe um título e descreva sua solicitação.');
      return;
    }
    setSending(true);
    const nextError = await createRequest({
      clientId: client.id,
      projectId: selectedProject.id,
      category,
      title,
      message,
    });
    setSending(false);
    if (nextError) setError(nextError);
    else {
      setTitle('');
      setMessage('');
      setCategory('duvida');
      setSuccess('Solicitação enviada. Você poderá acompanhar as atualizações nesta tela.');
      await load();
    }
  };

  const submitReply = async (requestId: string) => {
    if (replyMessage.trim().length < 1) { setError('Escreva sua resposta.'); return; }
    setSending(true); setError(null); setSuccess(null);
    const nextError = await replyToOwnRequest(requestId, replyMessage);
    setSending(false);
    if (nextError) setError(nextError);
    else { setReplyingId(null); setReplyMessage(''); setSuccess('Resposta enviada e registrada no histórico.'); await load(); }
  };

  return (
    <Screen>
      <PageHeader eyebrow="Comunicação organizada" title="Solicitações" description="Envie e acompanhe assuntos vinculados ao projeto selecionado." />
      <ProjectPicker />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}
      {client && role === 'client' && selectedProject ? (
        <Card>
          <Text style={styles.cardTitle}>Nova solicitação</Text>
          <SelectionChips<RequestCategory> items={categories} label="Categoria" onChange={setCategory} value={category} />
          <Field label="Título" maxLength={120} onChangeText={setTitle} placeholder="Ex.: Dúvida sobre a próxima etapa" value={title} />
          <Field
            label="Descrição"
            maxLength={4000}
            multiline
            numberOfLines={4}
            onChangeText={setMessage}
            placeholder="Descreva sua solicitação com clareza"
            style={styles.multiline}
            textAlignVertical="top"
            value={message}
          />
          <Button loading={sending} onPress={() => void submit()} title="Enviar solicitação" />
        </Card>
      ) : null}
      {!loading && selectedProject && items.length === 0 ? (
        <StateView description="Você não possui solicitações abertas para este projeto." icon="chatbox-ellipses-outline" title="Nenhuma solicitação" />
      ) : null}
      {items.length > 0 ? (
        <View style={styles.sectionHeader}>
          <Text style={styles.cardTitle}>Em andamento</Text>
          <StatusPill label={`${openItems.length} aberta${openItems.length === 1 ? '' : 's'}`} tone={openItems.length ? 'warning' : 'success'} />
        </View>
      ) : null}
      {openItems.map((item) => (
        <Card key={item.id}>
          <View style={styles.itemHeader}>
            <View style={styles.itemCopy}>
              <Text style={styles.category}>{item.origin === 'cliente' ? 'ENVIADA POR VOCÊ' : 'SOLICITAÇÃO DA EQUIPE'} • {humanizeStatus(item.category)}</Text>
              <Text style={styles.itemTitle}>{item.title}</Text>
            </View>
            <StatusPill label={humanizeStatus(item.status)} tone={statusTone(item.status)} />
          </View>
          {item.message ? <Text style={styles.message}>{item.message}</Text> : null}
          {replies.filter((reply) => reply.requestId === item.id).map((reply) => (
            <View key={reply.id} style={[styles.reply, reply.author === 'administrador' ? styles.adminReply : styles.clientReply]}>
              <Text style={styles.replyAuthor}>{reply.author === 'administrador' ? 'Equipe' : 'Você'} • {new Date(reply.createdAt).toLocaleDateString('pt-BR')}</Text>
              <Text style={styles.replyText}>{reply.message}</Text>
            </View>
          ))}
          <Text style={styles.date}>Atualizada em {new Date(item.updatedAt).toLocaleDateString('pt-BR')}</Text>
          {role === 'client' && ['admin', 'administrador'].includes(item.origin) && item.status === 'aguardando_cliente' ? (
            replyingId === item.id ? (
              <View style={styles.replyForm}>
                <Field label="Sua resposta" maxLength={4000} multiline onChangeText={setReplyMessage} style={styles.multiline} value={replyMessage} />
                <View style={styles.replyActions}><View style={styles.grow}><Button loading={sending} onPress={() => void submitReply(item.id)} title="Enviar resposta" /></View><View style={styles.grow}><Button onPress={() => { setReplyingId(null); setReplyMessage(''); }} title="Cancelar" variant="ghost" /></View></View>
              </View>
            ) : <Button onPress={() => { setReplyingId(item.id); setReplyMessage(''); }} title="Responder à equipe" variant="secondary" />
          ) : item.origin === 'cliente' ? <Notice tone="info">Esta solicitação foi enviada por você e será respondida pela equipe.</Notice> : null}
        </Card>
      ))}
      {items.length > 0 ? (
        <View style={styles.sectionHeader}>
          <Text style={styles.cardTitle}>Concluídas</Text>
          <StatusPill label={`${closedItems.length} no histórico`} tone="success" />
        </View>
      ) : null}
      {closedItems.map((item) => (
        <Card key={item.id}>
          <View style={styles.itemHeader}>
            <View style={styles.itemCopy}>
              <Text style={styles.category}>{item.origin === 'cliente' ? 'ENVIADA POR VOCÊ' : 'SOLICITAÇÃO DA EQUIPE'} • {humanizeStatus(item.category)}</Text>
              <Text style={styles.itemTitle}>{item.title}</Text>
            </View>
            <StatusPill label={humanizeStatus(item.status)} tone={statusTone(item.status)} />
          </View>
          {item.message ? <Text style={styles.message}>{item.message}</Text> : null}
          {replies.filter((reply) => reply.requestId === item.id).map((reply) => (
            <View key={reply.id} style={[styles.reply, reply.author === 'administrador' ? styles.adminReply : styles.clientReply]}>
              <Text style={styles.replyAuthor}>{reply.author === 'administrador' ? 'Equipe' : 'Você'} • {new Date(reply.createdAt).toLocaleDateString('pt-BR')}</Text>
              <Text style={styles.replyText}>{reply.message}</Text>
            </View>
          ))}
          <Notice tone={item.status === 'concluida' ? 'success' : 'warning'}>Solicitação encerrada. O histórico permanece disponível para consulta.</Notice>
        </Card>
      ))}
      {items.length > 0 ? <Button loading={loading} onPress={() => void load()} title="Atualizar solicitações" variant="ghost" /> : null}
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  cardTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.sm },
  multiline: { minHeight: 110 },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  itemCopy: { flex: 1, gap: 3 },
  category: { color: colors.gold600, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: typography.family },
  itemTitle: { flex: 1, color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  message: { color: colors.slate, fontSize: typography.size.body, lineHeight: 21, fontFamily: typography.family },
  reply: { gap: 4, borderLeftWidth: 2, padding: spacing.sm },
  adminReply: { borderLeftColor: colors.gold600, backgroundColor: colors.warningSoft },
  clientReply: { borderLeftColor: colors.info, backgroundColor: colors.infoSoft },
  replyAuthor: { color: colors.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', fontFamily: typography.family },
  replyText: { color: colors.ink, fontSize: 13, lineHeight: 20, fontFamily: typography.family },
  replyForm: { gap: spacing.sm },
  replyActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grow: { flexGrow: 1, flexBasis: 150 },
  date: { color: colors.muted, fontSize: 11, fontFamily: typography.family },
});
