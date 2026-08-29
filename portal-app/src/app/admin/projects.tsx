import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { AdminPageHeader, SelectionChips } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { formatCurrency, parseBrazilianCurrency } from '@/lib/format';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { createAdminContractProject, createAdminProjectForContract, listAdminClients, listAdminContracts, listAdminProjects, updateAdminProject } from '@/services/admin-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AdminClientSummary, AdminContractSummary, AdminProjectSummary } from '@/types/domain';

type ProjectStatus = 'ativo' | 'pausado' | 'concluido' | 'arquivado';

export default function AdminProjectsScreen() {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);
  const [clients, setClients] = useState<AdminClientSummary[]>([]);
  const [contracts, setContracts] = useState<AdminContractSummary[]>([]);
  const [projects, setProjects] = useState<AdminProjectSummary[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [contractNumber, setContractNumber] = useState('');
  const [projectName, setProjectName] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [contractValue, setContractValue] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [existingProjectName, setExistingProjectName] = useState('');
  const [existingCity, setExistingCity] = useState('');
  const [existingState, setExistingState] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AdminProjectSummary | null>(null);
  const [editStatus, setEditStatus] = useState<ProjectStatus>('ativo');
  const [editProgress, setEditProgress] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [clientResult, contractResult, projectResult] = await Promise.all([listAdminClients(), listAdminContracts(), listAdminProjects()]);
    setClients(clientResult.data.filter((client) => client.status === 'ativo'));
    setContracts(contractResult.data.filter((contract) => !['cancelado', 'arquivado'].includes(contract.status)));
    setProjects(projectResult.data);
    setSelectedClientId((current) => current ?? clientResult.data.find((client) => client.status === 'ativo')?.id ?? null);
    setSelectedContractId((current) => current ?? contractResult.data.find((contract) => !['cancelado', 'arquivado'].includes(contract.status))?.id ?? null);
    setError(clientResult.error ?? contractResult.error ?? projectResult.error);
    setLoading(false);
  }, []);

  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    if (!term) return projects;
    return projects.filter((project) => [project.contractNumber, project.name, project.clientName, project.serviceType].some((value) => value?.toLocaleLowerCase('pt-BR').includes(term)));
  }, [projects, search]);

  const create = async () => {
    const parsedValue = parseBrazilianCurrency(contractValue);
    if (!selectedClientId || contractNumber.trim().length < 2 || projectName.trim().length < 3 || serviceType.trim().length < 3 || parsedValue === null || parsedValue <= 0) {
      setError('Selecione o cliente e preencha contrato, valor contratado, projeto e serviço.');
      return;
    }
    setSaving(true); setError(null); setSuccess(null);
    const result = await createAdminContractProject({ clientId: selectedClientId, contractNumber, projectName, serviceType, contractValue: parsedValue, city, state });
    setSaving(false);
    if (result) setError(result);
    else {
      setSuccess('Contrato e projeto criados juntos.');
      setContractNumber(''); setProjectName(''); setServiceType(''); setContractValue(''); setCity(''); setState('');
      await load();
    }
  };

  const createInExistingContract = async () => {
    if (!selectedContractId || existingProjectName.trim().length < 3) {
      setError('Selecione o contrato e informe o nome do novo projeto.');
      return;
    }
    setSaving(true); setError(null); setSuccess(null);
    const result = await createAdminProjectForContract({ contractId: selectedContractId, projectName: existingProjectName, city: existingCity, state: existingState });
    setSaving(false);
    if (result) setError(result);
    else {
      setSuccess('Novo projeto adicionado ao contrato existente.');
      setExistingProjectName(''); setExistingCity(''); setExistingState('');
      await load();
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const progress = editProgress.trim() === '' ? null : Number(editProgress.replace(',', '.'));
    if (progress !== null && (!Number.isFinite(progress) || progress < 0 || progress > 100)) {
      setError('O progresso precisa ficar entre 0 e 100.');
      return;
    }
    setSaving(true); setError(null);
    const result = await updateAdminProject({ projectId: editing.id, status: editStatus, progress });
    setSaving(false);
    if (result) setError(result);
    else { setEditing(null); await load(); }
  };

  return (
    <Screen>
      <AdminPageHeader description="Cada projeto nasce ligado a um contrato único e ao cliente correto." title="Contratos e projetos" />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}
      <Card>
        <Text style={styles.sectionTitle}>Novo contrato com projeto</Text>
        <Text style={styles.label}>Cliente</Text>
        <View style={styles.clientList}>
          {clients.map((client) => <Pressable key={client.id} onPress={() => setSelectedClientId(client.id)} style={[styles.clientChip, selectedClientId === client.id && styles.clientChipSelected]}><Text style={[styles.clientText, selectedClientId === client.id && styles.clientTextSelected]}>{client.name}</Text></Pressable>)}
        </View>
        <Field autoCapitalize="characters" label="Número do contrato" onChangeText={setContractNumber} placeholder="Ex.: CME-2026-001" value={contractNumber} />
        <Field label="Nome do projeto" onChangeText={setProjectName} placeholder="Ex.: Residência Família Silva" value={projectName} />
        <Field label="Tipo de serviço" onChangeText={setServiceType} placeholder="Ex.: Projeto arquitetônico executivo" value={serviceType} />
        <Field keyboardType="decimal-pad" label="Valor contratado (R$)" onChangeText={setContractValue} placeholder="Ex.: 25.000,00" value={contractValue} />
        <View style={styles.row}><View style={styles.grow}><Field label="Cidade" onChangeText={setCity} value={city} /></View><View style={styles.state}><Field autoCapitalize="characters" label="UF" maxLength={2} onChangeText={setState} value={state} /></View></View>
        <Button loading={saving} onPress={() => void create()} title="Criar contrato e projeto" />
        <Notice tone="info">A operação é atômica: se o contrato não puder ser criado, o projeto também não será gravado.</Notice>
      </Card>
      <Card>
        <Text style={styles.sectionTitle}>Adicionar projeto a contrato existente</Text>
        <Text style={styles.label}>Contrato obrigatório</Text>
        <View style={styles.clientList}>
          {contracts.map((contract) => <Pressable key={contract.id} onPress={() => setSelectedContractId(contract.id)} style={[styles.clientChip, selectedContractId === contract.id && styles.clientChipSelected]}><Text style={[styles.clientText, selectedContractId === contract.id && styles.clientTextSelected]}>{contract.contractNumber} • {contract.clientName} • {formatCurrency(contract.contractValue)}</Text></Pressable>)}
        </View>
        <Field label="Nome do novo projeto" onChangeText={setExistingProjectName} value={existingProjectName} />
        <View style={styles.row}><View style={styles.grow}><Field label="Cidade" onChangeText={setExistingCity} value={existingCity} /></View><View style={styles.state}><Field autoCapitalize="characters" label="UF" maxLength={2} onChangeText={setExistingState} value={existingState} /></View></View>
        <Button loading={saving} onPress={() => void createInExistingContract()} title="Adicionar projeto ao contrato" variant="secondary" />
      </Card>
      <Field autoCapitalize="none" label="Pesquisar por contrato, projeto, cliente ou serviço" onChangeText={setSearch} value={search} />
      {loading ? <ActivityIndicator color={colors.gold600} /> : null}
      {!loading && filteredProjects.length === 0 ? <StateView description="Nenhum projeto corresponde à pesquisa." icon="briefcase-outline" title="Sem projetos" /> : null}
      {filteredProjects.map((project) => (
        <Card key={project.id}>
          <View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.contract}>CONTRATO {project.contractNumber}</Text><Text style={styles.title}>{project.name}</Text><Text style={styles.meta}>{project.clientName} • {project.serviceType ?? 'Serviço não informado'}</Text></View><StatusPill label={project.status} tone={project.status === 'ativo' ? 'success' : 'neutral'} /></View>
          <Text style={styles.meta}>{[project.city, project.state].filter(Boolean).join(' • ') || 'Local não informado'} • Progresso: {project.progress === null ? 'não informado' : `${project.progress}%`}</Text>
          <Button onPress={() => { setEditing(project); setEditStatus(project.status as ProjectStatus); setEditProgress(project.progress?.toString() ?? ''); }} title="Editar andamento" variant="secondary" />
        </Card>
      ))}
      {editing ? (
        <Card>
          <Text style={styles.sectionTitle}>Editar {editing.name}</Text>
          <SelectionChips<ProjectStatus> items={[{ value: 'ativo', label: 'Ativo' }, { value: 'pausado', label: 'Pausado' }, { value: 'concluido', label: 'Concluído' }, { value: 'arquivado', label: 'Arquivado' }]} label="Status" onChange={setEditStatus} value={editStatus} />
          <Field keyboardType="decimal-pad" label="Progresso (%)" maxLength={5} onChangeText={setEditProgress} placeholder="0 a 100" value={editProgress} />
          <View style={styles.actions}><View style={styles.grow}><Button loading={saving} onPress={() => void saveEdit()} title="Salvar" /></View><View style={styles.grow}><Button onPress={() => setEditing(null)} title="Cancelar" variant="ghost" /></View></View>
        </Card>
      ) : null}
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  label: { color: colors.ink, fontSize: 13, fontWeight: '600', fontFamily: typography.family },
  clientList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  clientChip: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: 8 },
  clientChipSelected: { borderColor: colors.gold500, backgroundColor: colors.warningSoft },
  clientText: { color: colors.slate, fontSize: 12, fontFamily: typography.family },
  clientTextSelected: { color: colors.gold600, fontWeight: '700' },
  row: { flexDirection: 'row', gap: spacing.sm }, state: { width: 86 }, grow: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  contract: { color: colors.gold600, fontSize: 10, fontWeight: '700', letterSpacing: 1, fontFamily: typography.family },
  title: { color: colors.ink, fontSize: typography.size.bodyLarge, marginTop: 3, fontWeight: '700', fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4, fontFamily: typography.family },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
