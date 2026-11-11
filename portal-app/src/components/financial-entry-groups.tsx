import React, {useState} from 'react';
import {Text,View} from 'react-native';
import {Button,Card} from '@/components/ui';
import {groupFinancialProjects} from '@/lib/financial-grouping';
import {financialTotals} from '@/lib/financial-model';
import {formatCurrency} from '@/lib/format';
import type {FinancialEntrySummary} from '@/types/domain';
import type {useThemeStyles} from '@/providers/theme-provider';

export function FinancialProjectGroups({entries,styles,renderEntry}:{entries:FinancialEntrySummary[];styles:ReturnType<typeof useThemeStyles>;renderEntry:(entry:FinancialEntrySummary)=>React.ReactNode}){
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  return <>{groupFinancialProjects(entries).map(group=>{
    const totals=financialTotals(group.entries);
    return <Card key={group.id}>
      <Text style={styles.title}>{group.name}</Text>
      <Text style={styles.meta}>{group.entries.length} lançamento(s) • Recebido {formatCurrency(totals.received)} • A receber {formatCurrency(totals.receivable)}</Text>
      <Button title={expanded[group.id]?'Recolher projeto':'Ver parcelas do projeto'} variant="secondary" onPress={()=>setExpanded(current=>({...current,[group.id]:!current[group.id]}))} />
      {expanded[group.id]?<View style={{gap:12}}>{group.entries.map(renderEntry)}</View>:null}
    </Card>;
  })}</>;
}
