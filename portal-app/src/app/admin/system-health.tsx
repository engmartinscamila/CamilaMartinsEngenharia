import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Notice, Screen, StatusPill } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { spacing, ThemeColors, typography } from '@/theme/tokens';

type HealthPayload = {
  ok?: boolean;
  checkedAt?: string;
  database?: {
    database?: string;
    documents_total?: number;
    snapshots_total?: number;
    legacy_snapshots?: number;
    sha256_snapshots?: number;
    pending_acceptances?: number;
    latest_document_generated_at?: string | null;
    latest_snapshot_at?: string | null;
  };
  storage?: { ok?: boolean; buckets?: number };
  edge?: { ok?: boolean; function?: string };
  error?: string;
};

const formatDateTime=(value?:string|null)=>value?new Date(value).toLocaleString('pt-BR'):'Sem registro';

export default function AdminSystemHealthScreen(){
  const {colors}=useAppTheme();
  const styles=useThemeStyles(styleDefinitions);
  const [health,setHealth]=useState<HealthPayload|null>(null);
  const [build,setBuild]=useState<string>('Não verificado');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    setLoading(true); setError(null);
    const [healthResult,buildResult]=await Promise.all([
      supabase.functions.invoke('system-health',{body:{}}),
      fetch('https://camilamartinsengenharia.com.br/build-version.txt',{cache:'no-store'}).then(async response=>response.ok?(await response.text()).trim():`HTTP ${response.status}`).catch(()=>null),
    ]);
    if(healthResult.error||!healthResult.data?.ok){
      setError(String(healthResult.data?.error??healthResult.error?.message??'Não foi possível consultar a integridade do backend.'));
    } else {
      setHealth(healthResult.data as HealthPayload);
    }
    setBuild(buildResult||'Site indisponível para verificação');
    setLoading(false);
  },[]);

  useEffect(()=>{const task=setTimeout(()=>void load(),0);return()=>clearTimeout(task);},[load]);
  const db=health?.database;
  const hashOk=Number(db?.snapshots_total??0)===Number(db?.sha256_snapshots??-1);

  return <Screen>
    <AdminPageHeader title="Integridade do sistema" description="Diagnóstico rápido do site publicado, banco, Storage, Edge Functions e trilha documental." />
    {error?<Notice tone="danger">{error}</Notice>:null}
    {loading?<ActivityIndicator color={colors.gold600}/>:null}
    <Card><View style={styles.row}><Text style={styles.title}>Site publicado</Text><StatusPill label={build.startsWith('Site indisponível')?'Falha':'Online'} tone={build.startsWith('Site indisponível')?'danger':'success'}/></View><Text style={styles.meta}>Build publicado: {build}</Text><Text style={styles.meta}>O identificador muda automaticamente a cada deploy e também controla o cache dos assets.</Text></Card>
    <Card><View style={styles.row}><Text style={styles.title}>Supabase / banco</Text><StatusPill label={db?.database==='ok'?'Operacional':'Indisponível'} tone={db?.database==='ok'?'success':'danger'}/></View><Text style={styles.meta}>Documentos: {db?.documents_total??'—'} • snapshots: {db?.snapshots_total??'—'}</Text><Text style={styles.meta}>Último documento: {formatDateTime(db?.latest_document_generated_at)}</Text><Text style={styles.meta}>Último snapshot: {formatDateTime(db?.latest_snapshot_at)}</Text></Card>
    <Card><View style={styles.row}><Text style={styles.title}>Integridade documental SHA-256</Text><StatusPill label={hashOk?'100% SHA-256':'Revisar'} tone={hashOk?'success':'warning'}/></View><Text style={styles.meta}>Snapshots SHA-256: {db?.sha256_snapshots??'—'} de {db?.snapshots_total??'—'}</Text><Text style={styles.meta}>Referências históricas anteriores à trilha imutável: {db?.legacy_snapshots??'—'}</Text><Text style={styles.meta}>Aceites pendentes: {db?.pending_acceptances??'—'}</Text></Card>
    <Card><View style={styles.row}><Text style={styles.title}>Storage</Text><StatusPill label={health?.storage?.ok?'Operacional':'Falha'} tone={health?.storage?.ok?'success':'danger'}/></View><Text style={styles.meta}>Buckets verificados pelo backend: {health?.storage?.buckets??'—'}</Text></Card>
    <Card><View style={styles.row}><Text style={styles.title}>Edge Functions</Text><StatusPill label={health?.edge?.ok?'Runtime operacional':'Falha'} tone={health?.edge?.ok?'success':'danger'}/></View><Text style={styles.meta}>Diagnóstico executado por: {health?.edge?.function??'—'} • {formatDateTime(health?.checkedAt)}</Text></Card>
    <Button loading={loading} onPress={()=>void load()} title="Executar nova verificação" variant="secondary" />
  </Screen>;
}

const styleDefinitions=(colors:ThemeColors)=>({
  row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:spacing.sm},
  title:{color:colors.ink,fontSize:typography.size.bodyLarge,fontWeight:'700',fontFamily:typography.family},
  meta:{color:colors.slate,fontSize:12,lineHeight:18,fontFamily:typography.family},
});
