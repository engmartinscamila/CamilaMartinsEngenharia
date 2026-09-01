import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { useThemeStyles } from '@/providers/theme-provider';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';

type Quote = { texto: string; autor: string; categoria: string; fonte?: string };

type QuotePayload = {
  frases?: Quote[];
  finais?: string[];
  inicios?: string[];
  categorias?: string[];
  autor?: string;
};

const SOURCE = 'https://camilamartinsengenharia.com.br/assets/frases-do-dia.json?v=20260901-3';
const TIMEZONE = 'America/Sao_Paulo';
const DAY_MS = 86_400_000;
const FALLBACK: Quote = { texto: 'Consistência transforma intenção em resultado.', autor: 'Camila Martins', categoria: 'Disciplina' };

function brazilDateKey(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const map = Object.fromEntries(parts.map((item) => [item.type, item.value]));
    return `${map.year}-${map.month}-${map.day}`;
  } catch {
    const shifted = new Date(date.getTime() - 3 * 60 * 60 * 1000);
    return shifted.toISOString().slice(0, 10);
  }
}

function dayIndex(key: string, total: number) {
  const [year, month, day] = key.split('-').map(Number);
  const daysSinceEpoch = Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
  return ((daysSinceEpoch % total) + total) % total;
}

function normalize(item: Partial<Quote> | null | undefined): Quote | null {
  if (!String(item?.texto ?? '').trim()) return null;
  return {
    texto: String(item?.texto).trim(),
    autor: String(item?.autor || FALLBACK.autor).trim(),
    categoria: String(item?.categoria || 'Reflexão').trim(),
    fonte: item?.fonte ? String(item.fonte).trim() : undefined,
  };
}

function collection(payload: QuotePayload): Quote[] {
  if (Array.isArray(payload.frases)) return payload.frases.map(normalize).filter((item): item is Quote => Boolean(item));
  const endings = Array.isArray(payload.finais) ? payload.finais : [];
  const starts = Array.isArray(payload.inicios) ? payload.inicios : [];
  const categories = Array.isArray(payload.categorias) ? payload.categorias : [];
  const legacy: Quote[] = [];
  starts.forEach((start, i) => endings.forEach((ending, j) => legacy.push({
    texto: `${start}; ${ending}.`,
    autor: payload.autor || FALLBACK.autor,
    categoria: categories.length ? categories[(i + j) % categories.length] : 'Reflexão',
  })));
  return legacy;
}

async function loadQuote(): Promise<Quote> {
  try {
    const response = await fetch(SOURCE, { headers: { Accept: 'application/json' } });
    if (!response.ok) return FALLBACK;
    const entries = collection(await response.json() as QuotePayload);
    if (!entries.length) return FALLBACK;
    return entries[dayIndex(brazilDateKey(), entries.length)] ?? FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export function DailyQuote() {
  const [quote, setQuote] = useState<Quote>(FALLBACK);
  const styles = useThemeStyles(styleDefinitions);
  useEffect(() => { void loadQuote().then(setQuote); }, []);
  return (
    <View accessibilityLabel="Frase do dia" style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.label}>FRASE DO DIA</Text>
        <Text style={styles.category}>{quote.categoria}</Text>
      </View>
      <Text style={styles.quote}>“{quote.texto}”</Text>
      <Text style={styles.author}>{quote.autor}</Text>
    </View>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  card: {
    position: 'relative' as const,
    width: '100%' as const,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  top: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: spacing.sm },
  label: { color: colors.gold600, fontFamily: typography.family, fontSize: 10, fontWeight: '700' as const, letterSpacing: 1.8 },
  category: { color: colors.muted, fontFamily: typography.family, fontSize: 10, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 5 },
  quote: { color: colors.ink, fontFamily: typography.family, fontSize: 17, fontWeight: '300' as const, lineHeight: 27 },
  author: { color: colors.gold600, fontFamily: typography.signature, fontSize: 27, lineHeight: 34 },
});
