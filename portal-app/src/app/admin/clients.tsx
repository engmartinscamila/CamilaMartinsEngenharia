import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { AdminPageHeader, SelectionChips } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { inviteAdminClient, listAdminClients, previewPermanentClientDeletion, requestPermanentClientDeletion, resendAdminClientInvite, sendAdminClientRecovery, updateAdminClientProfile, updateAdminClientStatus } from '@/services/admin-service';
import { spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AdminClientSummary, ClientDeletionPreview } from '@/types/domain';

type ClientStatus = 'ativo' | 'arquivado' | 'acesso_revogado';

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'ativo') return 'success';
  if (status === 'acesso_revogado') return 'danger';
  if (status === 'arquivado') return 'warning';
  return 'neutral';
}

export default function AdminClientsScreen() {
  const [items, setItems] = useState<AdminClientSummary[]>([]);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminClientSummary | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletePreview, setDeletePreview] = useState<ClientDeletionPreview | null>(null);
  const [editTarget, setEditTarget] = useState<AdminClientSummary | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listAdminClients(search);
    setItems(result.data);
    setError(result.error);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const task = setTimeout(() => void load(), 250);
    return () => clearTimeout(task);
  }, [load]);

  const invite = async () => {
    if (name.trim().length < 3 || !email.includes('@')) {
      setError('Informe nome completo e e-mail válido.');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await inviteAdminClient({ name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim() });
    setSaving(false);
    if (result) setError(result);
    else {
      setSuccess('Cliente convidado e cadastro criado.');
      setName(''); setEmail(''); setPhone('');
      await load();
    }
  };

  const changeStatus = async (client: AdminClientSummary, status: ClientStatus) => {
    setSaving(true);
    setError(null);
    const result = await updateAdminClientStatus(client.id, status);
    setSaving(false);
    if (result) setError(result);
    else await load();
  };

  const permanentlyDelete = async () => {
    if (!deleteTarget || deleteConfirmation.trim() !== deleteTarget.name.trim()) {
      setError('Digite o nome completo exatamente como aparece no cadastro.');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await requestPermanentClientDeletion(deleteTarget.id, deleteConfirmation.trim());
    setSaving(false);
    if (result) setError(result);
    else {
      setSuccess('Cliente, vínculos e arquivos removidos pela função segura.');
      setDeleteTarget(null);
      setDeletePreview(null);
      setDeleteConfirmation('');
      await load();
    }
  };

  const openDeletionPreview = async (client: AdminClientSummary) => {
    setDeleteTarget(client); setDeleteConfirmation(''); setDeletePreview(null); setError(null); setSaving(true);
    const result = await previewPermanentClientDeletion(client.id);
    setSaving(false);
    if (result.error || !result.data) { setError(result.error); setDeleteTarget(null); return; }
    setDeletePreview(result.data);
  };

  const saveProfile = async () => {
    if (!editTarget || editName.trim().length < 3) { setError('Informe o nome completo do cliente.'); return; }
    setSaving(true); setError(null);
    const result = await updateAdminClientProfile(editTarget.id, { name: editName, phone: editPhone });
    setSaving(false);
    if (result) setError(result);
    else { setEditTarget(null); setSuccess('Cadastro atualizado.'); await load(); }
  };

  const sendAccessEmail = async (client: AdminClientSummary, kind: 'invite' | 'recovery') => {
    if (!client.email) { setError('Este cliente não possui e-mail cadastrado.'); return; }
    setSaving(true); setError(null); setSuccess(null);
    const result = kind === 'invite' ? await resendAdminClientInvite(client.email) : await sendAdminClientRecovery(client.email);
    setSaving(false);
    if (result) setError(result); else setSuccess(kind === 'invite' ? 'Convite reenviado.' : 'Recuperação de senha enviada.');
  };

  return (
    <Screen>
      <AdminPageHeader description="Convide clientes, controle acessos e use exclusão definitiva somente com confirmação nominal." title="Clientes e acessos" />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}
      <Card>
        <Text style={styles.sectionTitle}>Convidar novo cliente</Text>
        <Field label="Nome completo" onChangeText={setName} placeholder="Nome do cliente" value={name} />
        <Field autoCapitalize="none" keyboardType="email-address" label="E-mail" onChangeText={setEmail} placeholder="cliente@email.com" value={email} />
        <Field keyboardType="phone-pad" label="Telefone (opcional)" onChangeText={setPhone} placeholder="(00) 00000-0000" value={phone} />
        <Button loading={saving} onPress={() => void invite()} title="Criar acesso e enviar convite" />
        <Notice tone="info">O convite é enviado por uma função protegida do servidor; nenhuma chave administrativa fica no aplicativo.</Notice>
      </Card>
      <Field autoCapitalize="none" label="Pesquisar clientes" onChangeText={setSearch} placeholder="Nome ou e-mail" value={search} />
      {loading ? <ActivityIndicator color={colors.gold600} /> : null}
      {!loading && items.length === 0 ? <StateView description="Nenhum cadastro corresponde à pesquisa." icon="people-outline" title="Nenhum cliente encontrado" /> : null}
      {items.map((client) => (
        <Card key={client.id}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}><Text style={styles.name}>{client.name}</Text><Text style={styles.meta}>{client.email ?? 'Sem e-mail'} • {client.phone ?? 'Sem telefone'}</Text></View>
            <StatusPill label={client.status.replaceAll('_', ' ')} tone={statusTone(client.status)} />
          </View>
          <Text style={styles.detail}>Criado em {formatDate(client.createdAt)} • {client.authId ? 'Acesso vinculado' : 'Convite/vínculo pendente'}</Text>
          <SelectionChips<ClientStatus>
            items={[{ value: 'ativo', label: 'Ativar' }, { value: 'arquivado', label: 'Arquivar' }, { value: 'acesso_revogado', label: 'Revogar acesso' }]}
            label="Alterar situação"
            onChange={(status) => void changeStatus(client, status)}
            value={client.status as ClientStatus}
          />
          <View style={styles.actions}><View style={styles.action}><Button onPress={() => { setEditTarget(client); setEditName(client.name); setEditPhone(client.phone ?? ''); }} title="Editar cadastro" variant="secondary" /></View><View style={styles.action}><Button disabled={!client.email} onPress={() => void sendAccessEmail(client, 'invite')} title="Reenviar convite" variant="ghost" /></View><View style={styles.action}><Button disabled={!client.email} onPress={() => void sendAccessEmail(client, 'recovery')} title="Enviar recuperação" variant="ghost" /></View></View>
          <Button onPress={() => void openDeletionPreview(client)} title="Revisar exclusão definitiva" variant="danger" />
        </Card>
      ))}
      {editTarget ? (
        <Card>
          <Text style={styles.sectionTitle}>Editar cadastro</Text>
          <Field label="Nome completo" onChangeText={setEditName} value={editName} />
          <Field keyboardType="phone-pad" label="Telefone" onChangeText={setEditPhone} value={editPhone} />
          <Notice tone="info">O e-mail de acesso é alterado somente pelo serviço central de autenticação para não separar o login do cadastro.</Notice>
          <View style={styles.actions}><View style={styles.action}><Button loading={saving} onPress={() => void saveProfile()} title="Salvar alterações" /></View><View style={styles.action}><Button onPress={() => setEditTarget(null)} title="Cancelar" variant="ghost" /></View></View>
        </Card>
      ) : null}
      {deleteTarget ? (
        <Card>
          <Notice tone="danger">A exclusão definitiva remove acesso, projetos e arquivos operacionais. Antes disso, contratos, valores e lançamentos são copiados para um histórico administrativo imutável.</Notice>
          <Text style={styles.sectionTitle}>Confirmar exclusão de {deleteTarget.name}</Text>
          {deletePreview ? <View style={styles.preview}><Text style={styles.detail}>{deletePreview.contracts} contrato(s) • {deletePreview.projects} projeto(s) • {deletePreview.storageObjects} arquivo(s) no Storage</Text><Text style={styles.detail}>{deletePreview.documents} documento(s) • {deletePreview.photos} foto(s) • {deletePreview.libraryItems} item(ns) de biblioteca</Text><Text style={styles.detail}>{deletePreview.financialEntries + deletePreview.ledgerEntries} lançamento(s) a preservar • {formatCurrency(deletePreview.contractedValue)} contratado</Text></View> : <ActivityIndicator color={colors.gold600} />}
          <Field label="Digite o nome completo do cliente" onChangeText={setDeleteConfirmation} value={deleteConfirmation} />
          <View style={styles.actions}><View style={styles.action}><Button disabled={!deletePreview} loading={saving} onPress={() => void permanentlyDelete()} title="Preservar extrato e excluir" variant="danger" /></View><View style={styles.action}><Button onPress={() => { setDeleteTarget(null); setDeletePreview(null); }} title="Cancelar" variant="ghost" /></View></View>
        </Card>
      ) : null}
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  name: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4, fontFamily: typography.family },
  detail: { color: colors.slate, fontSize: 12, fontFamily: typography.family },
  preview: { gap: spacing.xs, borderLeftWidth: 2, borderLeftColor: colors.gold500, paddingLeft: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1, flexBasis: 160 },
});
