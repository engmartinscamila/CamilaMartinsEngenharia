import { useLiveRefresh } from '@/hooks/use-live-refresh';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { AdminPageHeader, SelectionChips } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { inviteAdminClientWithProject, listAdminClients, resendAdminClientInvite, sendAdminClientRecovery, updateAdminClientProfile, updateAdminClientStatus } from '@/services/admin-service';
import { previewPermanentClientDeletion, requestPermanentClientDeletion, type ClientDeletionPreview } from '@/services/client-deletion-service';
import { spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AdminClientSummary } from '@/types/domain';

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
  // Cadastro integrado: projeto opcional criado junto com o cliente (antes do contrato).
  const [withProject, setWithProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState('');
  const [projectAddress, setProjectAddress] = useState('');
  const [projectNumber, setProjectNumber] = useState('');
  const [projectNeighborhood, setProjectNeighborhood] = useState('');
  const [projectCity, setProjectCity] = useState('');
  const [projectState, setProjectState] = useState('');
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

  useLiveRefresh(load, 250);

  const invite = async () => {
    if (name.trim().length < 3 || !email.includes('@')) {
      setError('Informe nome completo e e-mail válido.');
      return;
    }
    if (withProject && (projectName.trim().length < 3 || projectAddress.trim().length < 3)) {
      setError('Para cadastrar o projeto junto, informe o nome do projeto e o endereço da obra.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    const result = await inviteAdminClientWithProject(
      { name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim() },
      withProject ? { projectName, serviceType: projectType, address: projectAddress, number: projectNumber, neighborhood: projectNeighborhood, city: projectCity, state: projectState } : null,
    );
    setSaving(false);
    const created = Boolean(result.clientId);
    if (result.projectError) setError(created ? `Cliente cadastrado, mas o projeto não foi criado: ${result.projectError}` : result.projectError);
    else if (result.clientError && !created) setError(result.clientError);
    if (created || !result.clientError) {
      const parts = ['Cliente cadastrado'];
      if (withProject && !result.projectError) parts.push('projeto criado (contrato pode ser feito depois)');
      parts.push(result.clientError ? `aviso do convite: ${result.clientError}` : 'convite enviado');
      setSuccess(parts.join(' • ') + '.');
      setName(''); setEmail(''); setPhone('');
      if (!result.projectError) { setWithProject(false); setProjectName(''); setProjectType(''); setProjectAddress(''); setProjectNumber(''); setProjectNeighborhood(''); setProjectCity(''); setProjectState(''); }
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
    if (result.error) setError(result.error);
    else {
      setSuccess(result.data?.warning ?? 'Cliente, vínculos e arquivos removidos pela função segura.');
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
    const result = kind === 'invite' ? await resendAdminClientInvite(client.id) : await sendAdminClientRecovery(client.id);
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
        <SelectionChips<'no' | 'yes'> items={[{ value: 'no', label: 'Só o cliente' }, { value: 'yes', label: 'Já cadastrar o projeto' }]} label="Projeto" onChange={(value) => setWithProject(value === 'yes')} value={withProject ? 'yes' : 'no'} />
        {withProject ? <View style={{ gap: spacing.sm }}>
          <Notice tone="info">O projeto fica vinculado ao cliente e pode receber orçamento e contrato depois. Não é preciso número de contrato agora.</Notice>
          <Field label="Nome do projeto *" onChangeText={setProjectName} placeholder="Ex.: Residência Silva" value={projectName} />
          <Field label="Tipo de serviço (opcional)" onChangeText={setProjectType} placeholder="Ex.: Projeto arquitetônico" value={projectType} />
          <Field label="Endereço da obra *" onChangeText={setProjectAddress} placeholder="Rua, avenida…" value={projectAddress} />
          <Field label="Número (opcional)" onChangeText={setProjectNumber} value={projectNumber} />
          <Field label="Bairro (opcional)" onChangeText={setProjectNeighborhood} value={projectNeighborhood} />
          <Field label="Cidade (opcional)" onChangeText={setProjectCity} value={projectCity} />
          <Field label="UF (opcional)" maxLength={2} onChangeText={setProjectState} value={projectState} />
        </View> : null}
        <Button loading={saving} onPress={() => void invite()} title={withProject ? 'Cadastrar cliente e projeto e enviar convite' : 'Criar acesso e enviar convite'} />
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
          <View style={styles.actions}><View style={styles.action}><Button onPress={() => { setEditTarget(client); setEditName(client.name); setEditPhone(client.phone ?? ''); }} title="Editar cadastro" variant="secondary" /></View><View style={styles.action}><Button disabled={saving || !client.email} onPress={() => void sendAccessEmail(client, 'invite')} title="Reenviar convite" variant="ghost" /></View><View style={styles.action}><Button disabled={saving || !client.email} onPress={() => void sendAccessEmail(client, 'recovery')} title="Enviar recuperação" variant="ghost" /></View></View>
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
          <Notice tone="danger">A exclusão definitiva remove acesso, projetos e arquivos operacionais. Antes disso, contratos, valores, lançamentos e evidências de segurança são preservados no histórico administrativo.</Notice>
          <Text style={styles.sectionTitle}>Confirmar exclusão de {deleteTarget.name}</Text>
          {deletePreview ? <View style={styles.preview}><Text style={styles.detail}>{deletePreview.contracts} contrato(s) • {deletePreview.projects} projeto(s) • {deletePreview.storageObjects} arquivo(s) no Storage</Text><Text style={styles.detail}>{deletePreview.documents} documento(s) • {deletePreview.photos} foto(s) • {deletePreview.libraryItems} item(ns) de biblioteca</Text><Text style={styles.detail}>{deletePreview.supplierAttachments} anexo(s) de cotação • {deletePreview.temporaryIssuedCopies} cópia(s) temporária(s) protegida(s)</Text><Text style={styles.detail}>{deletePreview.financialEntries + deletePreview.ledgerEntries} lançamento(s) financeiros a preservar • {formatCurrency(deletePreview.contractedValue)} contratado</Text><Text style={styles.detail}>Bloqueios de retenção: {deletePreview.emissionSnapshots} snapshot(s) • {deletePreview.documentAcceptances} aceite(s) documental(is) • {deletePreview.fiscalDocuments} documento(s) fiscal(is)</Text><Text style={styles.detail}>Histórico preservado: {deletePreview.legalAcceptances} aceite(s) legal(is) • {deletePreview.protectedAssetIssues + deletePreview.protectedPdfIssues} emissão(ões) protegida(s)</Text>{!deletePreview.canDelete?<Notice tone="warning">Este cadastro possui registros documentais ou fiscais de retenção obrigatória. A exclusão definitiva foi bloqueada; use Arquivar ou Revogar acesso para preservar a trilha exigida.</Notice>:null}</View> : <ActivityIndicator color={colors.gold600} />}
          <Field label="Digite o nome completo do cliente" onChangeText={setDeleteConfirmation} value={deleteConfirmation} />
          <View style={styles.actions}><View style={styles.action}><Button disabled={!deletePreview?.canDelete} loading={saving} onPress={() => void permanentlyDelete()} title="Preservar históricos e excluir" variant="danger" /></View><View style={styles.action}><Button onPress={() => { setDeleteTarget(null); setDeletePreview(null); }} title="Cancelar" variant="ghost" /></View></View>
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
