import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useThemeStyles } from '@/providers/theme-provider';
import {
  convertCommercialRecord,
  createCommercialRecord,
  generateCommercialDocument,
  listCommercialRecords,
  lookupCommercialCep,
  lookupCommercialCnpj,
  type CommercialRecord,
  type CommercialServiceSelection,
} from '@/services/commercial-service';
import { CONTRACT_SCOPE_PRESETS } from '@/services/document-workflow-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';

const emptyForm = {
  prospectName: '', cpfCnpj: '', email: '', phone: '', cep: '', address: '', city: '', state: '', propertyAddress: '', propertyType: '',
  areaTerrenoM2: '', areaConstruidaM2: '', constructionStandard: '', experienceLevel: '', customService: '', totalValue: '', notes: '',
};
const digitsOnly = (value: string) => value.replace(/\D/g, '');

export default function AdminCommercialDocumentsScreen() {
  const styles = useThemeStyles(styleDefinitions);
  const [form, setForm] = useState(emptyForm);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [records, setRecords] = useState<CommercialRecord[]>([]);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const services = useMemo<CommercialServiceSelection[]>(() => CONTRACT_SCOPE_PRESETS.map(([code, name], index) => ({
    code, name, included: selectedCodes.includes(code), acceptanceRequired: true, displayOrder: index + 1,
  })), [selectedCodes]);

  const load = useCallback(async () => {
    const result = await listCommercialRecords();
    setRecords(result.data); setError(result.error);
  }, []);
  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);
  const update = (key: keyof typeof emptyForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const toggleService = (code: string) => setSelectedCodes((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);

  const lookupCnpj = async () => {
    const cnpj = digitsOnly(form.cpfCnpj);
    if (cnpj.length !== 14) { setError('Para a consulta automática, informe um CNPJ com 14 dígitos. CPF continua disponível para preenchimento manual.'); return; }
    setLoadingKey('lookup-cnpj'); setError(null); setSuccess(null);
    const result = await lookupCommercialCnpj(cnpj);
    if (result.error || !result.data) setError(result.error ?? 'CNPJ não encontrado.');
    else {
      const data = result.data;
      setForm((current) => ({ ...current, prospectName: data.legalName || current.prospectName, cpfCnpj: data.cnpj || current.cpfCnpj, email: data.email || current.email, phone: data.phone || current.phone, cep: data.cep || current.cep, address: data.address || current.address, city: data.city || current.city, state: data.state || current.state }));
      setSuccess('Dados do CNPJ preenchidos automaticamente. Revise número/complemento e demais dados antes de criar o orçamento.');
    }
    setLoadingKey(null);
  };

  const lookupCep = async () => {
    const cep = digitsOnly(form.cep);
    if (cep.length !== 8) { setError('Informe um CEP com 8 dígitos.'); return; }
    setLoadingKey('lookup-cep'); setError(null); setSuccess(null);
    const result = await lookupCommercialCep(cep);
    if (result.error || !result.data) setError(result.error ?? 'CEP não encontrado.');
    else { const data = result.data; setForm((current) => ({ ...current, cep: data.cep, address: data.address || current.address, city: data.city, state: data.state })); setSuccess('Endereço localizado pelo CEP. Complete número e complemento antes de criar o orçamento.'); }
    setLoadingKey(null);
  };

  const create = async () => {
    if (!form.prospectName.trim()) { setError('Informe o nome do prospect.'); return; }
    if (!selectedCodes.length && !form.customService.trim()) { setError('Selecione ao menos um serviço ou descreva um serviço personalizado.'); return; }
    setLoadingKey('create'); setError(null); setSuccess(null);
    const result = await createCommercialRecord({ ...form, services });
    if (result.error) setError(result.error);
    else { setSuccess('Orçamento criado com numeração automática. O prospect ainda não foi cadastrado como cliente.'); setForm(emptyForm); setSelectedCodes([]); await load(); }
    setLoadingKey(null);
  };

  const generate = async (record: CommercialRecord, kind: 'orcamento' | 'contrato', archive: boolean) => {
    const key = `${kind}-${archive ? 'archive' : 'download'}-${record.id}`;
    setLoadingKey(key); setError(null); setSuccess(null);
    const actionError = await generateCommercialDocument(record.id, kind, archive);
    if (actionError) setError(actionError);
    else setSuccess(archive ? 'Word gerado, baixado e arquivado no sistema. O evento também foi registrado no extrato.' : 'Word gerado para download. O arquivo não foi mantido no sistema; somente o histórico leve foi registrado.');
    await load(); setLoadingKey(null);
  };

  const convert = async (record: CommercialRecord) => {
    setLoadingKey(`convert-${record.id}`); setError(null); setSuccess(null);
    const result = await convertCommercialRecord(record.id);
    if (result.error) setError(result.error); else { setSuccess('Prospect convertido: cliente, contrato e projeto vinculados sem redigitação.'); await load(); }
    setLoadingKey(null);
  };

  return (
    <Screen>
      <AdminPageHeader title="Orçamentos e contratos" description="Crie documentos comerciais antes do cadastro do cliente. Por padrão, o Word é baixado sem permanecer armazenado; o histórico da geração continua registrado." />
      <Notice tone="info">Ao gerar um Word, escolha “Baixar Word” para não manter o arquivo no sistema ou “Baixar + arquivar” quando quiser guardar uma cópia online.</Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}{success ? <Notice tone="success">{success}</Notice> : null}

      <Card>
        <Text style={styles.sectionTitle}>Novo prospect / orçamento</Text>
        <Text style={styles.help}>A numeração ORC-AAAA-MM-0001 é criada automaticamente e de forma sequencial. A consulta de CEP/CNPJ existe somente nesta tela; os demais documentos continuam usando os dados oficiais do cadastro do cliente.</Text>
        <Field label="Nome / razão social *" value={form.prospectName} onChangeText={(value) => update('prospectName', value)} />
        <View style={styles.twoColumns}><View style={styles.lookupField}><Field label="CPF / CNPJ" value={form.cpfCnpj} onChangeText={(value) => update('cpfCnpj', value)} /><Button loading={loadingKey === 'lookup-cnpj'} onPress={() => void lookupCnpj()} title="Buscar CNPJ" variant="secondary" /></View><Field label="Telefone / WhatsApp" value={form.phone} onChangeText={(value) => update('phone', value)} /></View>
        <Field autoCapitalize="none" keyboardType="email-address" label="E-mail" value={form.email} onChangeText={(value) => update('email', value)} />
        <View style={styles.twoColumns}><View style={styles.lookupField}><Field label="CEP" value={form.cep} onChangeText={(value) => update('cep', value)} /><Button loading={loadingKey === 'lookup-cep'} onPress={() => void lookupCep()} title="Buscar CEP" variant="secondary" /></View><Field label="Cidade" value={form.city} onChangeText={(value) => update('city', value)} /><Field label="UF" value={form.state} onChangeText={(value) => update('state', value)} /></View>
        <Field label="Endereço do prospect" value={form.address} onChangeText={(value) => update('address', value)} />
        <Field label="Endereço do imóvel / obra" value={form.propertyAddress} onChangeText={(value) => update('propertyAddress', value)} />
        <View style={styles.twoColumns}><Field label="Tipo de imóvel" value={form.propertyType} onChangeText={(value) => update('propertyType', value)} /><Field label="Padrão construtivo" value={form.constructionStandard} onChangeText={(value) => update('constructionStandard', value)} /></View>
        <View style={styles.twoColumns}><Field keyboardType="decimal-pad" label="Área do terreno (m²)" value={form.areaTerrenoM2} onChangeText={(value) => update('areaTerrenoM2', value)} /><Field keyboardType="decimal-pad" label="Área construída prevista (m²)" value={form.areaConstruidaM2} onChangeText={(value) => update('areaConstruidaM2', value)} /></View>
        <Field label="Nível de experiência (Bronze / Prata / Ouro)" value={form.experienceLevel} onChangeText={(value) => update('experienceLevel', value)} />
        <Text style={styles.subTitle}>Serviços propostos *</Text>
        <View style={styles.serviceList}>{CONTRACT_SCOPE_PRESETS.map(([code, name]) => { const selected = selectedCodes.includes(code); return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} key={code} onPress={() => toggleService(code)} style={[styles.serviceRow, selected && styles.serviceSelected]}><Text style={styles.check}>{selected ? '☒' : '☐'}</Text><Text style={styles.serviceText}>({code}) {name}</Text></Pressable>; })}</View>
        <Field label="Outro serviço / especificação livre" value={form.customService} onChangeText={(value) => update('customService', value)} />
        <Field keyboardType="decimal-pad" label="Valor total dos honorários (R$)" value={form.totalValue} onChangeText={(value) => update('totalValue', value)} />
        <Field label="Observações / condição de pagamento" multiline value={form.notes} onChangeText={(value) => update('notes', value)} />
        <Button loading={loadingKey === 'create'} onPress={() => void create()} title="Criar orçamento numerado" />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Orçamentos e contratos existentes</Text>
        {records.length === 0 ? <StateView icon="document-text-outline" title="Nenhum orçamento criado" description="O primeiro orçamento criado aparecerá aqui, sem exigir cadastro prévio do prospect como cliente." /> : records.map((record) => (
          <View key={record.id} style={styles.recordCard}>
            <View style={styles.recordHeader}><View style={{ flex: 1 }}><Text style={styles.recordTitle}>{record.quoteNumber} • {record.prospectName}</Text><Text style={styles.meta}>{record.contractNumber ? `Contrato ${record.contractNumber} • ` : ''}{record.propertyType ?? 'Serviço de engenharia'} • {formatDate(record.createdAt)}</Text></View><StatusPill label={record.status.replaceAll('_', ' ')} tone={record.status === 'convertido' ? 'success' : record.status === 'cancelado' ? 'danger' : 'neutral'} /></View>
            <Text style={styles.subTitle}>Orçamento</Text>
            <View style={styles.actions}><Button loading={loadingKey === `orcamento-download-${record.id}`} onPress={() => void generate(record, 'orcamento', false)} title="Baixar Word" variant="secondary" /><Button loading={loadingKey === `orcamento-archive-${record.id}`} onPress={() => void generate(record, 'orcamento', true)} title="Baixar + arquivar" variant="ghost" /></View>
            <Text style={styles.subTitle}>Contrato</Text>
            <View style={styles.actions}><Button disabled={record.status === 'convertido'} loading={loadingKey === `contrato-download-${record.id}`} onPress={() => void generate(record, 'contrato', false)} title={record.contractNumber ? 'Baixar Word do contrato' : 'Gerar contrato e baixar'} variant="secondary" /><Button disabled={record.status === 'convertido'} loading={loadingKey === `contrato-archive-${record.id}`} onPress={() => void generate(record, 'contrato', true)} title="Baixar + arquivar contrato" variant="ghost" /></View>
            <Button disabled={!record.contractDocumentId || record.status === 'convertido'} loading={loadingKey === `convert-${record.id}`} onPress={() => void convert(record)} title={record.status === 'convertido' ? 'Cliente/projeto vinculados' : 'Converter em cliente + projeto'} />
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  subTitle: { color: colors.ink, fontSize: 14, fontWeight: '700', fontFamily: typography.family, marginTop: spacing.xs },
  help: { color: colors.slate, fontSize: 12, lineHeight: 18, fontFamily: typography.family },
  twoColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, lookupField: { flex: 1, minWidth: 220, gap: spacing.xs }, serviceList: { gap: spacing.xs },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm }, serviceSelected: { borderColor: colors.gold500, backgroundColor: colors.warningSoft }, check: { color: colors.gold600, fontSize: 18, fontFamily: typography.family }, serviceText: { flex: 1, color: colors.ink, fontSize: 12, fontFamily: typography.family },
  recordCard: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm, gap: spacing.sm }, recordHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, recordTitle: { color: colors.ink, fontSize: 14, fontWeight: '700', fontFamily: typography.family }, meta: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3, fontFamily: typography.family }, actions: { gap: spacing.xs },
});
