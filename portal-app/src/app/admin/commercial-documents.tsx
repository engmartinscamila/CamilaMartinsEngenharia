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
  type CommercialRecord,
  type CommercialServiceSelection,
} from '@/services/commercial-service';
import { CONTRACT_SCOPE_PRESETS } from '@/services/document-workflow-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';

const emptyForm = {
  prospectName: '', cpfCnpj: '', email: '', phone: '', cep: '', address: '', city: '', state: '', propertyAddress: '', propertyType: '',
  areaTerrenoM2: '', areaConstruidaM2: '', constructionStandard: '', experienceLevel: '', customService: '', totalValue: '', notes: '',
};

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
    setRecords(result.data);
    setError(result.error);
  }, []);

  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  const update = (key: keyof typeof emptyForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const toggleService = (code: string) => setSelectedCodes((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);

  const create = async () => {
    if (!form.prospectName.trim()) { setError('Informe o nome do prospect.'); return; }
    if (!selectedCodes.length && !form.customService.trim()) { setError('Selecione ao menos um serviço ou descreva um serviço personalizado.'); return; }
    setLoadingKey('create'); setError(null); setSuccess(null);
    const result = await createCommercialRecord({ ...form, services });
    if (result.error) setError(result.error);
    else {
      setSuccess('Orçamento criado com numeração automática. O prospect ainda não foi cadastrado como cliente.');
      setForm(emptyForm); setSelectedCodes([]); await load();
    }
    setLoadingKey(null);
  };

  const generate = async (record: CommercialRecord, kind: 'orcamento' | 'contrato') => {
    setLoadingKey(`${kind}-${record.id}`); setError(null); setSuccess(null);
    const actionError = await generateCommercialDocument(record.id, kind);
    if (actionError) setError(actionError);
    else { setSuccess(kind === 'orcamento' ? 'Word editável do orçamento gerado.' : 'Contrato numerado e Word editável gerado.'); await load(); }
    setLoadingKey(null);
  };

  const convert = async (record: CommercialRecord) => {
    setLoadingKey(`convert-${record.id}`); setError(null); setSuccess(null);
    const result = await convertCommercialRecord(record.id);
    if (result.error) setError(result.error);
    else { setSuccess('Prospect convertido: cliente, contrato e projeto vinculados sem redigitação.'); await load(); }
    setLoadingKey(null);
  };

  return (
    <Screen>
      <AdminPageHeader title="Orçamentos e contratos" description="Crie documentos comerciais antes do cadastro do cliente. O cadastro e o projeto só são criados quando a contratação for efetivada." />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      <Card>
        <Text style={styles.sectionTitle}>Novo prospect / orçamento</Text>
        <Text style={styles.help}>A numeração ORC-AAAA-MM-0001 é criada automaticamente e de forma sequencial.</Text>
        <Field label="Nome / razão social *" value={form.prospectName} onChangeText={(value) => update('prospectName', value)} />
        <View style={styles.twoColumns}>
          <Field label="CPF / CNPJ" value={form.cpfCnpj} onChangeText={(value) => update('cpfCnpj', value)} />
          <Field label="Telefone / WhatsApp" value={form.phone} onChangeText={(value) => update('phone', value)} />
        </View>
        <Field autoCapitalize="none" keyboardType="email-address" label="E-mail" value={form.email} onChangeText={(value) => update('email', value)} />
        <View style={styles.twoColumns}>
          <Field label="CEP" value={form.cep} onChangeText={(value) => update('cep', value)} />
          <Field label="Cidade" value={form.city} onChangeText={(value) => update('city', value)} />
          <Field label="UF" value={form.state} onChangeText={(value) => update('state', value)} />
        </View>
        <Field label="Endereço do prospect" value={form.address} onChangeText={(value) => update('address', value)} />
        <Field label="Endereço do imóvel / obra" value={form.propertyAddress} onChangeText={(value) => update('propertyAddress', value)} />
        <View style={styles.twoColumns}>
          <Field label="Tipo de imóvel" value={form.propertyType} onChangeText={(value) => update('propertyType', value)} />
          <Field label="Padrão construtivo" value={form.constructionStandard} onChangeText={(value) => update('constructionStandard', value)} />
        </View>
        <View style={styles.twoColumns}>
          <Field keyboardType="decimal-pad" label="Área do terreno (m²)" value={form.areaTerrenoM2} onChangeText={(value) => update('areaTerrenoM2', value)} />
          <Field keyboardType="decimal-pad" label="Área construída prevista (m²)" value={form.areaConstruidaM2} onChangeText={(value) => update('areaConstruidaM2', value)} />
        </View>
        <Field label="Nível de experiência (Bronze / Prata / Ouro)" value={form.experienceLevel} onChangeText={(value) => update('experienceLevel', value)} />

        <Text style={styles.subTitle}>Serviços propostos *</Text>
        <View style={styles.serviceList}>
          {CONTRACT_SCOPE_PRESETS.map(([code, name]) => {
            const selected = selectedCodes.includes(code);
            return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} key={code} onPress={() => toggleService(code)} style={[styles.serviceRow, selected && styles.serviceSelected]}><Text style={styles.check}>{selected ? '☒' : '☐'}</Text><Text style={styles.serviceText}>({code}) {name}</Text></Pressable>;
          })}
        </View>
        <Field label="Outro serviço / especificação livre" value={form.customService} onChangeText={(value) => update('customService', value)} />
        <Field keyboardType="decimal-pad" label="Valor total dos honorários (R$)" value={form.totalValue} onChangeText={(value) => update('totalValue', value)} />
        <Field label="Observações / condição de pagamento" multiline value={form.notes} onChangeText={(value) => update('notes', value)} />
        <Button loading={loadingKey === 'create'} onPress={() => void create()} title="Criar orçamento numerado" />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Orçamentos e contratos existentes</Text>
        {records.length === 0 ? <StateView icon="document-text-outline" title="Nenhum orçamento criado" description="O primeiro orçamento criado aparecerá aqui, sem exigir cadastro prévio do prospect como cliente." /> : records.map((record) => (
          <View key={record.id} style={styles.recordCard}>
            <View style={styles.recordHeader}>
              <View style={{ flex: 1 }}><Text style={styles.recordTitle}>{record.quoteNumber} • {record.prospectName}</Text><Text style={styles.meta}>{record.contractNumber ? `Contrato ${record.contractNumber} • ` : ''}{record.propertyType ?? 'Serviço de engenharia'} • {formatDate(record.createdAt)}</Text></View>
              <StatusPill label={record.status.replaceAll('_', ' ')} tone={record.status === 'convertido' ? 'success' : record.status === 'cancelado' ? 'danger' : 'neutral'} />
            </View>
            <View style={styles.actions}>
              <Button loading={loadingKey === `orcamento-${record.id}`} onPress={() => void generate(record, 'orcamento')} title={record.quoteDocumentId ? 'Regenerar Word do orçamento' : 'Gerar Word do orçamento'} variant="secondary" />
              <Button disabled={record.status === 'convertido'} loading={loadingKey === `contrato-${record.id}`} onPress={() => void generate(record, 'contrato')} title={record.contractNumber ? 'Regenerar Word do contrato' : 'Gerar contrato numerado'} variant="secondary" />
              <Button disabled={!record.contractDocumentId || record.status === 'convertido'} loading={loadingKey === `convert-${record.id}`} onPress={() => void convert(record)} title={record.status === 'convertido' ? 'Cliente/projeto vinculados' : 'Converter em cliente + projeto'} />
            </View>
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
  twoColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  serviceList: { gap: spacing.xs },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm },
  serviceSelected: { borderColor: colors.gold500, backgroundColor: colors.warningSoft },
  check: { color: colors.gold600, fontSize: 18, fontFamily: typography.family },
  serviceText: { flex: 1, color: colors.ink, fontSize: 12, fontFamily: typography.family },
  recordCard: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm, gap: spacing.sm },
  recordHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  recordTitle: { color: colors.ink, fontSize: 14, fontWeight: '700', fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3, fontFamily: typography.family },
  actions: { gap: spacing.xs },
});
