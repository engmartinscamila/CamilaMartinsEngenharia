import React from 'react';
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { Button, Card, Notice } from '@/components/ui';
import { effectiveStatus, financialStatus, type ReceivableStatement } from '@/lib/financial-model';
import { formatCurrency, formatDate } from '@/lib/format';
import type { FinancialEntrySummary } from '@/types/domain';

type StatementCardProps = {
  row: ReceivableStatement;
  hasContract: boolean;
  expanded: boolean;
  saving: boolean;
  styles: { title: StyleProp<TextStyle>; meta: StyleProp<TextStyle>; summary: StyleProp<ViewStyle> };
  onInformContract: () => void;
  onToggle: () => void;
  onOpenReceipt: (entry: FinancialEntrySummary) => void;
  onReceiveEntry: (entry: FinancialEntrySummary) => void;
};

/** Um contrato, suas parcelas e ações; sem mutação de dados ou novo cálculo de saldo. */
export function FinancialReceivableCard({
  row, hasContract, expanded, saving, styles,
  onInformContract, onToggle, onOpenReceipt, onReceiveEntry,
}: StatementCardProps) {
  return (
    <Card key={row.id}>
            <Text style={styles.title}>{row.clientName} • {row.contractNumber}</Text>
            <Text style={styles.meta}>Contratado: {row.contractValue===null?'Não informado':formatCurrency(row.contractValue)} • Recebido: {formatCurrency(row.received)}</Text>
            <Text style={styles.title}>Saldo restante: {row.remaining===null?'Valor contratado não informado':formatCurrency(row.remaining)}</Text>
            <Text style={styles.meta}>Parcelas pendentes: {formatCurrency(row.pending)} • Em atraso: {formatCurrency(row.overdue)}</Text>
            {row.unscheduled!==null&&row.unscheduled>0?<Notice tone="warning">{formatCurrency(row.unscheduled)} do saldo ainda sem parcelas lançadas. Esse valor não foi lançado automaticamente.</Notice>:null}
            {row.remaining!==null&&row.pending>row.remaining?<Notice tone="warning">As parcelas pendentes excedem o saldo em {formatCurrency((Math.round(row.pending*100)-Math.round(row.remaining*100))/100)}. Confira os lançamentos.</Notice>:null}
            {row.contractValue===null&&hasContract?<Button title="Informar valor contratado" variant="secondary" onPress={onInformContract} />:null}
            {row.credit>0?<Notice tone="warning">Recebimentos excedem o valor contratado em {formatCurrency(row.credit)}. Confira o contrato e os pagamentos.</Notice>:null}
            {row.inactive?<Notice tone="info">Contrato cancelado ou arquivado: preservado para conferência, fora do total a receber.</Notice>:null}
            <Button title={expanded?'Recolher parcelas':'Ver parcelas e recebimentos'} variant="secondary" onPress={onToggle} />
            {expanded?(row.entries.length===0?<Text style={styles.meta}>Ainda não há parcelas lançadas para este contrato.</Text>:row.entries.map(entry=><View key={entry.id} style={styles.summary}>
              <View style={{flex:1}}><Text style={styles.title}>{entry.description} • {formatCurrency(entry.amount)}</Text><Text style={styles.meta}>{effectiveStatus(entry)==='atrasado'?'Em atraso':financialStatus(entry.status)==='pago'?'Recebido':'Pendente'} • Vencimento: {formatDate(entry.dueDate)} • Recebimento: {formatDate(entry.paidAt)}</Text>
              {financialStatus(entry.status)==='pago'?<Button title="Emitir / abrir recibo" variant="secondary" onPress={()=>onOpenReceipt(entry)} />:<Button title="Registrar recebimento" variant="secondary" disabled={saving} onPress={()=>onReceiveEntry(entry)} />}</View>
            </View>)):null}
          </Card>
  );
}
