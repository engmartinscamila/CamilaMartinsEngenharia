export interface ServiceMatchCandidate {
  code: string;
  name: string;
  aliases?: string[];
  synonyms?: string[];
  keywords?: string[];
}

export interface ServiceMatchSuggestion extends ServiceMatchCandidate {
  score: number;
  exact: boolean;
}

export function normalizeServiceText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous: number[] = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0] ?? 0;
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const before = previous[j] ?? j;
      const above = previous[j] ?? j;
      const left = previous[j - 1] ?? i;
      const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      previous[j] = Math.min(above + 1, left + 1, diagonal + cost);
      diagonal = before;
    }
  }
  return previous[b.length] ?? Math.max(a.length, b.length);
}

function similarity(query: string, target: string): number {
  if (!query || !target) return 0;
  if (query === target) return 1;
  if (target.includes(query) || query.includes(target)) {
    return Math.min(query.length, target.length) / Math.max(query.length, target.length) * 0.96 + 0.04;
  }
  const distance = levenshtein(query, target);
  return Math.max(0, 1 - distance / Math.max(query.length, target.length));
}

/**
 * Sugestões conservadoras. Nunca vincula automaticamente um serviço.
 * A UI precisa exigir clique/confirmação explícita da administradora.
 */
export function suggestCommercialServices(
  query: string,
  candidates: readonly ServiceMatchCandidate[],
  limit = 5,
): ServiceMatchSuggestion[] {
  const normalizedQuery = normalizeServiceText(query);
  if (!normalizedQuery) return [];

  // Códigos oficiais podem ser curtos (ex.: "o"). Para consultas de um
  // caractere, só uma correspondência EXATA de código é permitida; fuzzy
  // matching continua desativado para evitar sugestões ambíguas.
  if (normalizedQuery.length < 2) {
    return candidates
      .filter((candidate) => normalizeServiceText(candidate.code) === normalizedQuery)
      .slice(0, 1)
      .map((candidate) => ({ ...candidate, score: 1, exact: true }));
  }

  const suggestions = candidates.map((candidate) => {
    const normalizedName = normalizeServiceText(candidate.name);
    const normalizedCode = normalizeServiceText(candidate.code);
    const alternateTerms = [
      ...(candidate.aliases ?? []),
      ...(candidate.synonyms ?? []),
      ...(candidate.keywords ?? []),
    ].map(normalizeServiceText).filter(Boolean);
    const words = [normalizedName, ...alternateTerms].flatMap(value => value.split(' ').filter(Boolean));
    const scores = [similarity(normalizedQuery, normalizedName), similarity(normalizedQuery, normalizedCode)];
    for (const term of alternateTerms) scores.push(similarity(normalizedQuery, term));
    for (const word of words) scores.push(similarity(normalizedQuery, word));
    const score = Math.max(...scores);
    return {
      ...candidate,
      score: Math.round(score * 1000) / 1000,
      exact: normalizedQuery === normalizedName || normalizedQuery === normalizedCode,
    };
  })
    .filter((candidate) => candidate.exact || candidate.score >= 0.72)
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.score - a.score || a.name.localeCompare(b.name, 'pt-BR'));

  return suggestions.slice(0, Math.max(1, Math.min(limit, 10)));
}
