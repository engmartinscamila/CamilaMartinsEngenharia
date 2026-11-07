import React from 'react';
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { Button, Card, Notice } from '@/components/ui';
import { categoryLabel, effectiveStatus, entryDate, financialStatus } from '@/lib/financial-model';
import { formatCurrency, formatDate } from '@/lib/format';
import type { FinancialEntrySummary } from '@/types/domain';

type FinancialEntryCardProps = {
  entry: FinancialEntrySummary;
  saving: boolean;
  styles: { title: StyleProp<TextStyle>; meta: StyleProp<TextStyle>; rowFields: StyleProp<ViewStyle> };
  onOpenReceipt: (entry: FinancialEntrySummary) => void;
  onReceiveEntry: (entry: FinancialEntrySummary) => void;
  onEditEntry: (entry: FinancialEntrySummary) => void;
  onDeleteEntry: (entry: FinancialEntrySummary) => void;
};

/** Uma única representação do lançamento para ações de recibo, edição e conciliação. */
export function FinancialEntryCard({
  entry, saving, styles, onOpenReceipt, onReceiveEntry, onEditEntry, onDeleteEntry,
}: FinancialEntryCardProps) {
  return (
    <Card key={entry.id}><Text style={styles.title}>{entry.description}</Text><Text style={styles.meta}>{entry.clientName} • {entry.contractNumber} • {entry.projectName}</Text>
        <Text style={styles.meta}>{entry.type==='saida'?'Saída':'Entrada'} • {formatCurrency(entry.amount)} • {effectiveStatus(entry)} • {categoryLabel(entry.category)} • {formatDate(entryDate(entry))}</Text>
        <Text style={styles.meta}>{entry.notes}</Text>
        {entry.type==='entrada'&&financialStatus(entry.status)==='pago'?<Button debounceMs={0} title="Emitir / abrir recibo deste recebimento" variant="secondary" onPress={()=>onOpenReceipt(entry)} />:null}
        {entry.type==='entrada'&&financialStatus(entry.status)==='pendente'?<Button title="Registrar recebimento" variant="secondary" disabled={saving} onPress={()=>onReceiveEntry(entry)} />:null}
        {entry.bankTransactionId?<Notice tone="info">Lançamento conciliado. O vínculo bancário foi preservado.</Notice>:<View style={styles.rowFields}><Button title="Editar lançamento" variant="secondary" disabled={saving} onPress={()=>onEditEntry(entry)} /><Button title="Excluir dos ativos" variant="ghost" disabled={saving} onPress={()=>onDeleteEntry(entry)} /></View>}
      </Card>
  );
}
