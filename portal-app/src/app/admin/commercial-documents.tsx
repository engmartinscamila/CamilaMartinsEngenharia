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
  previewCommercialDocument,
  type CommercialDocumentPreview,
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
type PendingGeneration={record:CommercialRecord;kind:'orcamento'|'contrato';archive:boolean;preview:CommercialDocumentPreview;bump:'minor'|'major';reason:string};

export default function AdminCommercialDocumentsScreen() {
  const styles = useThemeStyles(styleDefinitions);
  const [form, setForm] = useState(emptyForm);
  const [sameAddress,setSameAddress]=useState(false);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [records, setRecords] = useState<CommercialRecord[]>([]);
  const [pending,setPending]=useState<PendingGeneration|null>(null);
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
  const update = (key: keyof typeof emptyForm, value: string) => setForm((current) => {
    const next={ ...current, [key]: value };
    if(key==='address'&&sameAddress)next.propertyAddress=value;
    return next;
  });
  const toggleService = (code: string) => setSelectedCodes((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);
  const toggleSameAddress=()=>setSameAddress(current=>{const next=!current;if(next)setForm(value=>({...value,propertyAddress:value.address}));return next;});

  const lookupCnpj = async () => {
    const cnpj = digitsOnly(form.cpfCnpj);
    if (cnpj.length !== 14) { setError('Para a consulta automática, informe um CNPJ com 14 dígitos. CPF continua disponível para preenchimento manual.'); return; }
    setLoadingKey('lookup-cnpj'); setError(null); setSuccess(null);
    const result = await lookupCommercialCnpj(cnpj);
    if (result.error || !result.data) setError(result.error ?? 'CNPJ não encontrado.');
    else {
      const data = result.data;
      setForm((current) => {
        const address=data.address || current.address;
        return { ...current, prospectName: data.legalName || current.prospectName, cpfCnpj: data.cnpj || current.cpfCnpj, email: data.email || current.email, phone: data.phone || current.phone, cep: data.cep || current.cep, address, propertyAddress:sameAddress?address:current.propertyAddress, city: data.city || current.city, state: data.state || current.state };
      });
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
    else { const data = result.data; setForm((current) => {const address=data.address||current.address;return { ...current, cep: data.cep, address, propertyAddress:sameAddress?address:current.propertyAddress, city: data.city, state: data.state };}); setSuccess('Endereço localizado pelo CEP. Complete número e complemento antes de criar o orçamento.'); }
    setLoadingKey(null);
  };

  const create = async () => {
    if (!form.prospectName.trim()) { setError('Informe o nome do prospect.'); return; }
    if (!selectedCodes.length && !form.customService.trim()) { setError('Selecione ao menos um serviço ou descreva um serviço personalizado.'); return; }
    setLoadingKey('create'); setError(null); setSuccess(null);
    const result = await createCommercialRecord({ ...form, propertyAddress:sameAddress?form.address:form.propertyAddress, services });
    if (result.error) setError(result.error);
    else { setSuccess('Orçamento criado com numeração automática. O prospect ainda não foi cadastrado como cliente.'); setForm(emptyForm); setSameAddress(false); setSelectedCodes([]); await load(); }
    setLoadingKey(null);
  };

  const requestGenerate = async (record: CommercialRecord, kind: 'orcamento' | 'contrato', archive: boolean) => {
    if(kind==='contrato'&&!record.propertyAddress?.trim()){setError('Informe o endereço do imóvel / obra antes de gerar o contrato. O endereço cadastral não será usado automaticamente como endereço da obra.');return;}
    const key = `preview-${kind}-${record.id}`;
    setLoadingKey(key);setError(null);setSuccess(null);
    const result=await previewCommercialDocument(record,kind,'minor');
    setLoadingKey(null);
    if(result.error||!result.data){setError(result.error??'Não foi possível montar a prévia do documento.');return;}
    setPending({record,kind,archive,preview:result.data,bump:'minor',reason:''});
  };

  const changeBump=async(bump:'minor'|'major')=>{
    if(!pending)return;
    const result=await previewCommercialDocument(pending.record,pending.kind,bump);
    if(result.error||!result.data){setError(result.error??'Não foi possível recalcular a versão.');return;}
    setPending(current=>current?{...current,bump,preview:result.data}:current);
  };

  const confirmGenerate=async()=>{
    if(!pending)return;
    if(pending.preview.frozen&&!pending.reason.trim()){setError('Informe o motivo da nova versão.');return;}
    const key = `${pending.kind}-${pending.archive ? 'archive' : 'download'}-${pending.record.id}`;
    setLoadingKey(key); setError(null); setSuccess(null);
    const actionError = await generateCommercialDocument(pending.record.id, pending.kind, pending.archive,{bump:pending.bump,reason:pending.reason.trim()});
    if (actionError) setError(actionError);
    else setSuccess(`${pending.kind==='contrato'?'Contrato':'Orçamento'} v${pending.preview.nextVersion} gerado${pending.archive?', baixado e arquivado':' para download'}. A emissão ficou vinculada ao snapshot desta versão.`);
    setPending(null);await load(); setLoadingKey(null);
  };

  const convert = async (record: CommercialRecord) => {
    setLoadingKey(`convert-${record.id}`); setError(null); setSuccess(null);
    const result = await convertCommercialRecord(record.id);
    if (result.error) setError(result.error); else { setSuccess('Prospect convertido: cliente, contrato e projeto vinculados sem redigitação.'); await load(); }
    setLoadingKey(null);
  };

  return (
    <Screen>
      <AdminPageHeader title="Orçamentos e contratos" description="Crie documentos comerciais antes do cadastro do cliente. Endereço cadastral e endereço da obra permanecem independentes." />
      <Notice tone="info">Antes de gerar um Word, o app mostra a prévia da versão, endereço da obra, endereço cadastral, valor e serviços. Uma versão já emitida exige motivo para nova revisão.</Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}{success ? <Notice tone="success">{success}</Notice> : null}

      <Card>
        <Text style={styles.sectionTitle}>Novo prospect / orçamento</Text>
        <Text style={styles.help}>A numeração ORC-AAAA-MM-0001 é criada automaticamente. O endereço cadastral identifica o contratante; o endereço do imóvel/obra identifica o local do serviço.</Text>
        <Field label="Nome / razão social *" value={form.prospectName} onChangeText={(value) => update('prospectName', value)} />
        <View style={styles.twoColumns}><View style={styles.lookupField}><Field label="CPF / CNPJ" value={form.cpfCnpj} onChangeText={(value) => update('cpfCnpj', value)} /><Button loading={loadingKey === 'lookup-cnpj'} onPress={() => void lookupCnpj()} title="Buscar CNPJ" variant="secondary" /></View><Field label="Telefone / WhatsApp" value={form.phone} onChangeText={(value) => update('phone', value)} /></View>
        <Field autoCapitalize="none" keyboardType="email-address" label="E-mail" value={form.email} onChangeText={(value) => update('email', value)} />
        <View style={styles.twoColumns}><View style={styles.lookupField}><Field label="CEP" value={form.cep} onChangeText={(value) => update('cep', value)} /><Button loading={loadingKey === 'lookup-cep'} onPress={() => void lookupCep()} title="Buscar CEP" variant="secondary" /></View><Field label="Cidade" value={form.city} onChangeText={(value) => update('city', value)} /><Field label="UF" value={form.state} onChangeText={(value) => update('state', value)} /></View>
        <Field label="Endereço cadastral / residência do contratante" value={form.address} onChangeText={(value) => update('address', value)} />
        <Pressable accessibilityRole="checkbox" accessibilityState={{checked:sameAddress}} onPress={toggleSameAddress} style={[styles.serviceRow,sameAddress&&styles.serviceSelected]}><Text style={styles.check}>{sameAddress?'☒':'☐'}</Text><Text style={styles.serviceText}>O endereço da obra é o mesmo endereço cadastral / residencial do contratante</Text></Pressable>
        <Field editable={!sameAddress} label="Endereço do imóvel / obra" value={sameAddress?form.address:form.propertyAddress} onChangeText={(value) => update('propertyAddress', value)} />
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

      {pending?<Card><View style={styles.recordHeader}><View style={{flex:1}}><Text style={styles.sectionTitle}>Prévia antes do Word</Text><Text style={styles.help}>Confira os dados que serão usados. Nenhum novo Word será gerado até a confirmação.</Text></View><StatusPill label={`v${pending.preview.nextVersion}`} tone="warning" /></View><Text style={styles.meta}>{pending.kind==='contrato'?'Contrato':'Orçamento'}: {pending.preview.number}</Text><Text style={styles.meta}>Cliente/prospect: {pending.preview.prospectName}</Text><Text style={styles.meta}>Endereço cadastral: {pending.preview.partyAddress||'Não informado'}</Text><Text style={styles.previewStrong}>Endereço da obra: {pending.preview.propertyAddress||'Não informado'}</Text><Text style={styles.meta}>Valor: {pending.preview.totalValue===null?'Não informado':pending.preview.totalValue.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</Text><Text style={styles.meta}>Serviços: {pending.preview.services.join(' • ')||'Nenhum serviço localizado'}</Text>{pending.preview.frozen?<><Text style={styles.subTitle}>Nova versão</Text><View style={styles.twoColumns}><Button onPress={()=>void changeBump('minor')} title="Revisão menor" variant={pending.bump==='minor'?'secondary':'ghost'} /><Button onPress={()=>void changeBump('major')} title="Nova versão principal" variant={pending.bump==='major'?'secondary':'ghost'} /></View><Field label="Motivo da nova versão *" value={pending.reason} onChangeText={reason=>setPending(current=>current?{...current,reason}:current)} /></>:<Notice tone="info">Primeira emissão ou versão ainda não congelada: não é necessário motivo de revisão.</Notice>}<View style={styles.actions}><Button loading={Boolean(loadingKey?.includes(pending.record.id))} onPress={()=>void confirmGenerate()} title={pending.archive?'Confirmar, baixar + arquivar':'Confirmar e baixar Word'} /><Button disabled={Boolean(loadingKey)} onPress={()=>setPending(null)} title="Cancelar" variant="ghost" /></View></Card>:null}

      <Card>
        <Text style={styles.sectionTitle}>Orçamentos e contratos existentes</Text>
        {records.length === 0 ? <StateView icon="document-text-outline" title="Nenhum orçamento criado" description="O primeiro orçamento criado aparecerá aqui, sem exigir cadastro prévio do prospect como cliente." /> : records.map((record) => (
          <View key={record.id} style={styles.recordCard}>
            <View style={styles.recordHeader}><View style={{ flex: 1 }}><Text style={styles.recordTitle}>{record.quoteNumber} • {record.prospectName}</Text><Text style={styles.meta}>{record.contractNumber ? `Contrato ${record.contractNumber} • ` : ''}{record.propertyType ?? 'Serviço de engenharia'} • {formatDate(record.createdAt)}</Text><Text style={styles.meta}>Obra: {record.propertyAddress||'endereço ainda não informado'}</Text></View><StatusPill label={record.status.replaceAll('_', ' ')} tone={record.status === 'convertido' ? 'success' : record.status === 'cancelado' ? 'danger' : 'neutral'} /></View>
            <Text style={styles.subTitle}>Orçamento</Text>
            <View style={styles.actions}><Button loading={loadingKey === `preview-orcamento-${record.id}`} onPress={() => void requestGenerate(record, 'orcamento', false)} title="Prévia + baixar Word" variant="secondary" /><Button onPress={() => void requestGenerate(record, 'orcamento', true)} title="Prévia + arquivar" variant="ghost" /></View>
            <Text style={styles.subTitle}>Contrato</Text>
            <View style={styles.actions}><Button disabled={record.status === 'convertido'} loading={loadingKey === `preview-contrato-${record.id}`} onPress={() => void requestGenerate(record, 'contrato', false)} title={record.contractNumber ? 'Prévia + Word do contrato' : 'Prévia + gerar contrato'} variant="secondary" /><Button disabled={record.status === 'convertido'} onPress={() => void requestGenerate(record, 'contrato', true)} title="Prévia + arquivar contrato" variant="ghost" /></View>
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
  recordCard: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm, gap: spacing.sm }, recordHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, recordTitle: { color: colors.ink, fontSize: 14, fontWeight: '700', fontFamily: typography.family }, meta: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3, fontFamily: typography.family }, previewStrong:{color:colors.ink,fontSize:12,lineHeight:18,fontWeight:'700',fontFamily:typography.family}, actions: { gap: spacing.xs },
});
