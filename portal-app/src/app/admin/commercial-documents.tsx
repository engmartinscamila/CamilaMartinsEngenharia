import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { suggestCommercialServices } from '@/lib/commercial-service-match';
import { formatDate } from '@/lib/format';
import { useThemeStyles } from '@/providers/theme-provider';
import {
  convertCommercialRecord,
  createProspectAccessLink,
  createCommercialRecord,
  generateCommercialDocument,
  listCommercialRecords,
  listCommercialServiceCatalog,
  lookupCommercialCep,
  lookupCommercialCnpj,
  previewCommercialDocument,
  searchExistingCommercialClients,
  type CommercialCatalogService,
  type CommercialDocumentPreview,
  type CommercialRecord,
  type CommercialServiceLevelCode,
  type CommercialServiceSelection,
  type ExistingCommercialClient,
} from '@/services/commercial-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';

const emptyForm = {
  prospectName: '', cpfCnpj: '', email: '', phone: '', cep: '', address: '', city: '', state: '', propertyAddress: '', propertyType: '',
  areaTerrenoM2: '', areaConstruidaM2: '', constructionStandard: '', customService: '', totalValue: '', notes: '',
};
const SERVICE_LEVELS: { code: CommercialServiceLevelCode; label: string }[] = [
  { code: 'bronze', label: 'Bronze' },
  { code: 'prata', label: 'Prata' },
  { code: 'ouro', label: 'Ouro' },
];
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
  const [prospectLink, setProspectLink] = useState<string | null>(null);
  const [clientQuery,setClientQuery]=useState('');
  const [clientMatches,setClientMatches]=useState<ExistingCommercialClient[]>([]);
  const [selectedClient,setSelectedClient]=useState<ExistingCommercialClient|null>(null);
  const [serviceQuery,setServiceQuery]=useState('');
  const [catalogServices,setCatalogServices]=useState<CommercialCatalogService[]>([]);
  const [selectedLevels,setSelectedLevels]=useState<Record<string,CommercialServiceLevelCode>>({});
  const [customServiceLevel,setCustomServiceLevel]=useState<CommercialServiceLevelCode|null>(null);

  const services = useMemo<CommercialServiceSelection[]>(() => catalogServices.map((item, index) => ({
    code: item.code,
    name: item.name,
    included: selectedCodes.includes(item.code),
    acceptanceRequired: item.acceptanceRequired,
    displayOrder: index + 1,
    levelApplicable: item.levelApplicable,
    levelCode: selectedLevels[item.code] ?? null,
  })), [catalogServices, selectedCodes, selectedLevels]);
  const serviceSuggestions=useMemo(()=>suggestCommercialServices(
    serviceQuery,
    catalogServices.map(({code,name})=>({code,name})),
    5,
  ),[catalogServices,serviceQuery]);

  const load = useCallback(async () => {
    const [recordsResult,catalogResult]=await Promise.all([
      listCommercialRecords(),
      listCommercialServiceCatalog(),
    ]);
    setRecords(recordsResult.data);
    setCatalogServices(catalogResult.data);
    setError(recordsResult.error ?? catalogResult.error);
  }, []);
  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);
  const update = (key: keyof typeof emptyForm, value: string) => setForm((current) => {
    const next={ ...current, [key]: value };
    if(key==='address'&&sameAddress)next.propertyAddress=value;
    return next;
  });
  const toggleService = (code: string) => setSelectedCodes((current) => {
    if (!current.includes(code)) return [...current, code];
    setSelectedLevels((levels) => {
      const next={...levels}; delete next[code]; return next;
    });
    return current.filter((item) => item !== code);
  });
  const chooseServiceLevel=(code:string,level:CommercialServiceLevelCode)=>setSelectedLevels(current=>({...current,[code]:level}));
  const toggleSameAddress=()=>setSameAddress(current=>{const next=!current;if(next)setForm(value=>({...value,propertyAddress:value.address}));return next;});

  const searchClients=async()=>{
    setLoadingKey('search-client');setError(null);setSuccess(null);
    const result=await searchExistingCommercialClients(clientQuery);
    setLoadingKey(null);
    if(result.error){setClientMatches([]);setError(result.error);return;}
    setClientMatches(result.data);
    if(!result.data.length)setSuccess('Nenhum cliente cadastrado corresponde à busca. Você pode continuar como novo prospect.');
  };
  const chooseClient=(client:ExistingCommercialClient)=>{
    setSelectedClient(client);setClientMatches([]);setClientQuery(client.name);setSameAddress(false);
    setForm(current=>({
      ...current,
      prospectName:client.name,
      cpfCnpj:client.cpfCnpj??'',
      email:client.email??'',
      phone:client.phone??'',
      cep:client.cep??'',
      address:client.address??'',
      city:client.city??'',
      state:client.state??'',
      // O endereço da obra não é inferido do endereço cadastral do cliente.
      propertyAddress:current.propertyAddress,
    }));
    setSuccess('Cliente existente selecionado. Os dados foram copiados para este orçamento como snapshot; o cadastro original não será alterado.');
  };
  const clearClient=()=>{setSelectedClient(null);setClientMatches([]);setClientQuery('');setForm(emptyForm);setSameAddress(false);setSuccess('Fluxo de novo prospect selecionado.');};

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
    const missingLevel=services.find(item=>item.included&&item.levelApplicable!==false&&!item.levelCode);
    if(missingLevel){setError(`Selecione Bronze, Prata ou Ouro para ${missingLevel.name}.`);return;}
    const otherSelected=selectedCodes.some(code=>['p','outro','outros'].includes(code.toLowerCase()));
    if(form.customService.trim()&&!otherSelected&&!customServiceLevel){setError('Selecione Bronze, Prata ou Ouro para a atividade personalizada.');return;}
    setLoadingKey('create'); setError(null); setSuccess(null);
    const result = await createCommercialRecord({
      ...form,
      linkedClientId:selectedClient?.id??null,
      propertyAddress:sameAddress?form.address:form.propertyAddress,
      services,
      customServiceLevel: otherSelected ? (selectedLevels.p ?? null) : customServiceLevel,
    });
    if (result.error) setError(result.error);
    else {
      setSuccess(selectedClient?'Orçamento criado e vinculado ao cliente existente sem alterar o cadastro original.':'Orçamento criado com numeração automática. O prospect ainda não foi cadastrado como cliente.');
      setForm(emptyForm);setSameAddress(false);setSelectedCodes([]);setSelectedLevels({});setCustomServiceLevel(null);setSelectedClient(null);setClientQuery('');setClientMatches([]);setServiceQuery('');await load();
    }
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
    const preview=result.data;
    setPending(current=>current?{...current,bump,preview}:current);
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

  const createAccess = async (record: CommercialRecord) => {
    setLoadingKey(`access-${record.id}`); setError(null); setSuccess(null); setProspectLink(null);
    const result = await createProspectAccessLink(record.id);
    setLoadingKey(null);
    if (result.error || !result.url) setError(result.error ?? 'Não foi possível criar o link.');
    else {
      setProspectLink(result.url);
      setSuccess('Link temporário criado por 72 horas, limitado e sem exigir cadastro do prospect.');
      await Share.share({ message: `Documentos Camila Martins Engenharia Civil: ${result.url}` });
    }
  };

  return (
    <Screen>
      <AdminPageHeader title="Orçamentos e contratos" description="Crie documentos comerciais para cliente existente ou novo prospect. Endereço cadastral e endereço da obra permanecem independentes." />
      <Notice tone="info">Antes de gerar um Word, o app mostra a prévia da versão, endereço da obra, endereço cadastral, valor e serviços. Uma versão já emitida exige motivo para nova revisão.</Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}{success ? <Notice tone="success">{success}</Notice> : null}
      {prospectLink ? <Card><Text style={styles.sectionTitle}>Acesso temporário do prospect</Text><Text selectable style={styles.previewStrong}>{prospectLink}</Text><Text style={styles.help}>O link expira automaticamente e pode ser revogado pelo banco sem alterar o documento original.</Text></Card> : null}

      <Card>
        <Text style={styles.sectionTitle}>Cliente existente ou novo prospect</Text>
        <Text style={styles.help}>Pesquise por nome, CPF ou CNPJ. Selecionar um cliente apenas copia os dados atuais para o novo orçamento; alterações feitas aqui não sobrescrevem o cadastro original.</Text>
        <Field label="Pesquisar cliente cadastrado" value={clientQuery} onChangeText={(value)=>{setClientQuery(value);setClientMatches([]);}} />
        <View style={styles.actions}><Button loading={loadingKey==='search-client'} disabled={clientQuery.trim().length<2&&digitsOnly(clientQuery).length<3} onPress={()=>void searchClients()} title="Pesquisar cliente" variant="secondary" />{selectedClient?<Button onPress={clearClient} title="Usar novo prospect" variant="ghost" />:null}</View>
        {selectedClient?<Notice tone="success">Cliente vinculado: {selectedClient.name}{selectedClient.cpfCnpj?` • ${selectedClient.cpfCnpj}`:''}. O endereço da obra continua separado e precisa ser confirmado.</Notice>:null}
        {clientMatches.map(client=><View key={client.id} style={styles.matchRow}><View style={{flex:1}}><Text style={styles.recordTitle}>{client.name}</Text><Text style={styles.meta}>{client.cpfCnpj||'CPF/CNPJ não informado'} • {client.email||'e-mail não informado'}</Text></View><Button onPress={()=>chooseClient(client)} title="Selecionar" variant="secondary" /></View>)}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{selectedClient?'Novo orçamento para cliente existente':'Novo prospect / orçamento'}</Text>
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
        <Text style={styles.subTitle}>Serviços propostos *</Text>
        <Text style={styles.help}>Selecione cada atividade e, em seguida, o nível Bronze, Prata ou Ouro correspondente. O nível fica vinculado à atividade no snapshot do orçamento.</Text>
        <Field label="Localizar serviço por nome ou código" value={serviceQuery} onChangeText={setServiceQuery} />
        {serviceQuery.trim().length>=2&&serviceSuggestions.length===0?<Notice tone="info">Nenhuma correspondência segura. Revise o termo ou selecione manualmente no catálogo abaixo.</Notice>:null}
        {serviceSuggestions.map(item=><View key={`suggest-${item.code}`} style={styles.matchRow}><View style={{flex:1}}><Text style={styles.serviceText}>({item.code}) {item.name}</Text><Text style={styles.meta}>{item.exact?'Correspondência exata':'Sugestão aproximada — confirme antes de selecionar'}</Text></View><Button onPress={()=>{if(!selectedCodes.includes(item.code))setSelectedCodes(current=>[...current,item.code]);setServiceQuery('');}} title={selectedCodes.includes(item.code)?'Já selecionado':'Confirmar serviço'} variant="secondary" /></View>)}
        {catalogServices.length===0?<Notice tone="warning">O catálogo central de serviços não pôde ser carregado. A criação do orçamento fica bloqueada para evitar usar uma lista desatualizada.</Notice>:null}
        <View style={styles.serviceList}>{catalogServices.map(({code, name, levelApplicable}) => {
          const selected = selectedCodes.includes(code);
          return <View key={code} style={[styles.serviceCard, selected && styles.serviceSelected]}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => toggleService(code)} style={styles.serviceSelector}>
              <Text style={styles.check}>{selected ? '☒' : '☐'}</Text><Text style={styles.serviceText}>({code}) {name}</Text>
            </Pressable>
            {selected&&levelApplicable?<View style={styles.levelChoices}>{SERVICE_LEVELS.map(level=><Pressable key={level.code} accessibilityRole="radio" accessibilityState={{selected:selectedLevels[code]===level.code}} onPress={()=>chooseServiceLevel(code,level.code)} style={[styles.levelChip,selectedLevels[code]===level.code&&styles.levelChipSelected]}><Text style={styles.levelChipText}>{level.label}</Text></Pressable>)}</View>:null}
          </View>;
        })}</View>
        <Field label="Outro serviço / especificação livre" value={form.customService} onChangeText={(value) => update('customService', value)} />
        {form.customService.trim()&&!selectedCodes.includes('p')?<View><Text style={styles.help}>Nível da atividade personalizada:</Text><View style={styles.levelChoices}>{SERVICE_LEVELS.map(level=><Pressable key={`custom-${level.code}`} accessibilityRole="radio" accessibilityState={{selected:customServiceLevel===level.code}} onPress={()=>setCustomServiceLevel(level.code)} style={[styles.levelChip,customServiceLevel===level.code&&styles.levelChipSelected]}><Text style={styles.levelChipText}>{level.label}</Text></Pressable>)}</View></View>:null}
        <Field keyboardType="decimal-pad" label="Valor total dos honorários (R$)" value={form.totalValue} onChangeText={(value) => update('totalValue', value)} />
        <Field label="Observações / condição de pagamento" multiline value={form.notes} onChangeText={(value) => update('notes', value)} />
        <Button disabled={catalogServices.length===0} loading={loadingKey === 'create'} onPress={() => void create()} title="Criar orçamento numerado" />
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
            <Button disabled={!record.quoteDocumentId && !record.contractDocumentId} loading={loadingKey === `access-${record.id}`} onPress={() => void createAccess(record)} title="Compartilhar link temporário" variant="secondary" />
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
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm }, serviceCard:{borderWidth:1,borderColor:colors.line,borderRadius:radius.md,padding:spacing.sm,gap:spacing.xs}, serviceSelector:{flexDirection:'row',alignItems:'center',gap:spacing.sm}, serviceSelected: { borderColor: colors.gold500, backgroundColor: colors.warningSoft }, check: { color: colors.gold600, fontSize: 18, fontFamily: typography.family }, serviceText: { flex: 1, color: colors.ink, fontSize: 12, fontFamily: typography.family }, levelChoices:{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs,marginLeft:28}, levelChip:{borderWidth:1,borderColor:colors.line,borderRadius:radius.md,paddingHorizontal:spacing.sm,paddingVertical:spacing.xs}, levelChipSelected:{borderColor:colors.gold500,backgroundColor:colors.warningSoft}, levelChipText:{color:colors.ink,fontSize:11,fontWeight:'700',fontFamily:typography.family},
  matchRow:{flexDirection:'row',alignItems:'center',gap:spacing.sm,borderWidth:1,borderColor:colors.line,borderRadius:radius.md,padding:spacing.sm},
  recordCard: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm, gap: spacing.sm }, recordHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, recordTitle: { color: colors.ink, fontSize: 14, fontWeight: '700', fontFamily: typography.family }, meta: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3, fontFamily: typography.family }, previewStrong:{color:colors.ink,fontSize:12,lineHeight:18,fontWeight:'700',fontFamily:typography.family}, actions: { gap: spacing.xs },
});