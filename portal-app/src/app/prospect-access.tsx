import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { BrandMark, Button, Card, Notice, PageHeader, Screen, StateView, StatusPill } from '@/components/ui';
import { openExternalUrl } from '@/lib/external-link';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { spacing, ThemeColors, typography } from '@/theme/tokens';

interface ProspectAccessData {
  prospectName: string;
  quoteNumber: string | null;
  contractNumber: string | null;
  expiresAt: string;
  remainingUses: number;
  documents: { id: string; title: string; category: string | null; version: string | null; downloadAllowed: boolean }[];
}

export default function ProspectAccessScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);
  const [data, setData] = useState<ProspectAccessData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) { setError('O link está incompleto. Solicite um novo acesso à equipe.'); return; }
    setLoading(true); setError(null);
    const result = await supabase.functions.invoke('prospect-document-access', { body: { token } });
    if (result.error || !result.data?.documents) setError(result.data?.error ?? 'O link é inválido, expirou ou atingiu o limite de acessos.');
    else setData(result.data as ProspectAccessData);
    setLoading(false);
  }, [token]);
  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  const open = async (documentId: string) => {
    setLoading(true); setError(null);
    const result = await supabase.functions.invoke('prospect-document-access', { body: { token, documentId } });
    if (result.error || !result.data?.url) setError(result.data?.error ?? 'Não foi possível abrir o documento.');
    else {
      const openError = await openExternalUrl(result.data.url);
      if (openError) setError(openError);
    }
    setLoading(false);
  };

  return <Screen>
    <View style={styles.brand}><BrandMark /></View>
    <PageHeader eyebrow="Acesso temporário protegido" title={data ? `Olá, ${data.prospectName}.` : 'Documentos comerciais'} description="Orçamentos e contratos liberados pela Camila Martins Engenharia Civil." />
    {loading ? <ActivityIndicator color={colors.gold600} /> : null}
    {error ? <Notice tone="danger">{error}</Notice> : null}
    {data ? <>
      <Card><Text style={styles.title}>{data.contractNumber ? `Contrato ${data.contractNumber}` : data.quoteNumber ? `Orçamento ${data.quoteNumber}` : 'Documentos liberados'}</Text><Text style={styles.meta}>Acesso até {formatDate(data.expiresAt)} • {data.remainingUses} abertura(s) restante(s)</Text></Card>
      {data.documents.length === 0 ? <StateView icon="document-outline" title="Nenhum documento liberado" description="Solicite a atualização do link à equipe." /> : data.documents.map((document) => <Card key={document.id}><View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.title}>{document.title}</Text><Text style={styles.meta}>{document.category ?? 'Documento'} • versão {document.version ?? '1.0'}</Text></View><StatusPill label="temporário" tone="warning" /></View><Button onPress={() => void open(document.id)} title={document.downloadAllowed ? 'Abrir / baixar' : 'Visualizar'} /></Card>)}
      <Notice tone="info">Cada abertura gera uma URL assinada com validade de 10 minutos. O endereço original do arquivo permanece privado.</Notice>
    </> : !loading && !error ? <StateView description="Aguarde enquanto o link seguro é conferido." icon="shield-outline" title="Validando acesso" /> : null}
    {error ? <Button onPress={() => void load()} title="Tentar novamente" variant="secondary" /> : null}
  </Screen>;
}

const styleDefinitions = (colors: ThemeColors) => ({
  brand: { alignItems: 'flex-start', marginBottom: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  title: { color: colors.ink, fontSize: 15, fontWeight: '700', fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 4, fontFamily: typography.family },
});
