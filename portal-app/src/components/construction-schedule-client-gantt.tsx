import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { buildClientConstructionGantt } from '@/lib/construction-schedule-client-gantt';
import { formatDate } from '@/lib/format';
import { useAppTheme } from '@/providers/theme-provider';
import type { ClientConstructionSchedulePublication } from '@/services/construction-schedule-publication-service';

interface Props { publication: ClientConstructionSchedulePublication; }
/** Read-only and strictly limited to the client publication snapshot.
 * The gold bar means PLANNED DATES, not real progress. Show a measured percentage
 * only when a dated measurement is present. No S curve can be inferred from this snapshot.
 */
export function ConstructionScheduleClientGantt({ publication }: Props) {
  const { colors } = useAppTheme();
  const data = useMemo(() => buildClientConstructionGantt(publication), [publication]);
  if (!data) return null;
  return (
    <View accessibilityRole="summary" style={{ gap: 12, paddingVertical: 12 }}>
      <Text style={{ color: colors.ink, fontWeight: '700' }}>Linha do tempo visual — planejamento aprovado</Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>
        {formatDate(data.start)} a {formatDate(data.finish)}. Barras mostram datas previstas, não execução. Avanço só é exibido com medição.
      </Text>
      {data.bars.map((bar) => {
        const width = Math.max(0, Math.min(bar.widthPercent, 100 - bar.offsetPercent));
        return (
          <View key={bar.code} style={{ gap: 4 }}>
            <Text style={{ color: colors.ink, fontSize: 12 }}>{bar.code} — {bar.activity}</Text>
            <View
              accessibilityLabel={`${bar.activity}: previsto entre ${formatDate(bar.start)} e ${formatDate(bar.finish)}`}
              style={{ height: 16, backgroundColor: colors.line, borderRadius: 4, flexDirection: 'row', overflow: 'hidden' }}
            >
              {bar.offsetPercent > 0 ? <View style={{ width: `${bar.offsetPercent}%` }} /> : null}
              <View style={{ width: `${width}%`, backgroundColor: colors.gold500, borderRadius: 4 }} />
            </View>
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              {formatDate(bar.start)} — {formatDate(bar.finish)} · {bar.measuredPercent === null ? 'Sem medição registrada' : `${bar.measuredPercent}% medido`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
