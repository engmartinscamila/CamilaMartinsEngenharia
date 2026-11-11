/* Frase do dia: mesmo acervo e mesma regra do site (uma frase por dia, na ordem do acervo,
   que nunca repete o autor em dias seguidos). Se o acervo não carregar, o card não aparece. */
import React, { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';

import { useThemeStyles } from '@/providers/theme-provider';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';

type Quote = { texto: string; autor: string; categoria?: string };

const SOURCE = Platform.OS === 'web' ? '/assets/frases-do-dia.json' : 'https://camilamartinsengenharia.com.br/assets/frases-do-dia.json';

export function dayIndex(total: number, now = new Date()) {
  const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const [year, month, day] = key.split('-').map(Number);
  const days = Math.floor(Date.UTC(year!, month! - 1, day!) / 86400000);
  return ((days % total) + total) % total;
}

export function DailyQuote() {
  const styles = useThemeStyles(styleDefinitions);
  const [quote, setQuote] = useState<Quote | null>(null);
  useEffect(() => {
    let active = true;
    fetch(SOURCE, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { frases?: Quote[] } | null) => {
        const list = (data?.frases ?? []).filter((item) => item?.texto && item?.autor);
        if (active && list.length) setQuote(list[dayIndex(list.length)]!);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  if (!quote) return null;
  return (
    <View style={styles.card} accessibilityLabel={`Frase do dia: ${quote.texto} — ${quote.autor}`}>
      <View style={styles.top}>
        <Text style={styles.label}>FRASE DO DIA</Text>
        {quote.categoria ? <Text style={styles.category}>{quote.categoria}</Text> : null}
      </View>
      <Text style={styles.text}>“{quote.texto}”</Text>
      <Text style={styles.author}>— {quote.autor}</Text>
    </View>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  card: { gap: spacing.xs, padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderLeftWidth: 3, borderLeftColor: colors.gold500, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  top: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, gap: spacing.sm },
  label: { color: colors.gold600, fontFamily: typography.family, fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.2 },
  category: { color: colors.slate, fontFamily: typography.family, fontSize: 11 },
  text: { color: colors.ink, fontFamily: typography.family, fontSize: 17, lineHeight: 25, fontStyle: 'italic' as const },
  author: { color: colors.gold600, fontFamily: typography.family, fontSize: 13, fontWeight: '600' as const },
});
