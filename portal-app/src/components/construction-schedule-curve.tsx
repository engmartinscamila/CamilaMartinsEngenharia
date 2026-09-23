import React from 'react';
import { Text, View } from 'react-native';
import { Card } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useThemeStyles } from '@/providers/theme-provider';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';

export interface ConstructionScheduleCurvePointView {
  date: string;
  planned: number;
  actual: number | null;
  measurementDate?: string | null;
}

interface Props {
  points: readonly ConstructionScheduleCurvePointView[];
  title?: string;
  description?: string;
  maxPoints?: number;
}

const clamp=(value:number)=>Math.max(0,Math.min(100,Number.isFinite(value)?value:0));

export function ConstructionScheduleCurve({points,title='Curva S — planejado × realizado',description,maxPoints=14}:Props){
  const styles=useThemeStyles(styleDefinitions);
  const step=Math.max(1,Math.ceil(points.length/Math.max(2,maxPoints)));
  const sampled=points.filter((_,index)=>index%step===0||index===points.length-1);
  if(!sampled.length)return null;
  return <Card>
    <Text style={styles.title}>{title}</Text>
    {description?<Text style={styles.description}>{description}</Text>:null}
    <View style={styles.legend}><Text style={styles.plannedLegend}>PLANEJADO</Text><Text style={styles.actualLegend}>REALIZADO MEDIDO</Text></View>
    {sampled.map(point=><View key={`${point.date}-${point.measurementDate??''}`} style={styles.row}>
      <Text style={styles.date}>{formatDate(point.date,point.date)}</Text>
      <View style={styles.bars}>
        <View style={styles.track}><View style={[styles.planned,{width:`${clamp(point.planned)}%`}]} /></View>
        <View style={styles.track}><View style={[styles.actual,{width:`${clamp(point.actual??0)}%`,opacity:point.actual===null?0.18:1}]} /></View>
      </View>
      <Text style={styles.value}>{clamp(point.planned).toFixed(1)}% / {point.actual===null?'—':`${clamp(point.actual).toFixed(1)}%`}</Text>
    </View>)}
    <Text style={styles.note}>O realizado só avança quando existe medição datada. Pontos intermediários podem ser resumidos visualmente em cronogramas longos.</Text>
  </Card>;
}

const styleDefinitions=(colors:ThemeColors)=>({
  title:{color:colors.ink,fontSize:typography.size.bodyLarge,fontWeight:'700' as const,fontFamily:typography.family},
  description:{color:colors.slate,fontSize:12,lineHeight:18,fontFamily:typography.family},
  legend:{flexDirection:'row' as const,gap:spacing.md,flexWrap:'wrap' as const},
  plannedLegend:{color:colors.gold600,fontSize:10,fontWeight:'700' as const,letterSpacing:.8,fontFamily:typography.family},
  actualLegend:{color:colors.slate,fontSize:10,fontWeight:'700' as const,letterSpacing:.8,fontFamily:typography.family},
  row:{gap:4,paddingVertical:spacing.xs,borderTopWidth:1,borderTopColor:colors.line},
  date:{color:colors.muted,fontSize:11,fontFamily:typography.family},
  bars:{gap:3},
  track:{height:7,borderRadius:radius.pill,overflow:'hidden' as const,backgroundColor:colors.line},
  planned:{height:'100%' as const,borderRadius:radius.pill,backgroundColor:colors.gold500},
  actual:{height:'100%' as const,borderRadius:radius.pill,backgroundColor:colors.slate},
  value:{color:colors.ink,fontSize:10,fontFamily:typography.family},
  note:{color:colors.muted,fontSize:10,lineHeight:15,fontFamily:typography.family},
});
