import { Rating, RatingTier, Title, TitleKind } from "@notas-app/gen-shared";
import { average } from "./lib";

// Estatísticas da comunidade e retrospectiva de cada pessoa. Só entram as notas dos títulos (as dos episódios não).

export interface MemberStat {
  userId: string;
  count: number;
  average: number;
  peaks: number;
  rockBottoms: number;
}

// Quem avaliou quanto, a média que dá (quem é mais generoso) e quantos Peak e Rock Bottom. Quem mais avaliou vem primeiro.
export function memberStats(titles: Title[]): MemberStat[] {
  const byUser = new Map<string, Rating[]>();
  for (const title of titles) {
    for (const rating of title.ratings) byUser.set(rating.userId, [...(byUser.get(rating.userId) ?? []), rating]);
  }

  return [...byUser]
    .map(([userId, ratings]) => ({
      userId,
      count: ratings.length,
      average: ratings.reduce((total, rating) => total + rating.score, 0) / ratings.length,
      peaks: ratings.filter((rating) => rating.tier === RatingTier.PEAK).length,
      rockBottoms: ratings.filter((rating) => rating.tier === RatingTier.ROCK_BOTTOM).length,
    }))
    .sort((a, b) => b.count - a.count || b.average - a.average || a.userId.localeCompare(b.userId));
}

export interface Pair {
  a: string;
  b: string;
  common: number;
  // De 0 a 100: 100 é dar sempre a mesma nota; cada ponto de diferença médio tira 10.
  similarity: number;
}

export const minCommonTitles = 3;

// Quem pensa parecido: para cada par de membros que avaliaram pelo menos 3 títulos em comum, o quanto as notas se parecem.
// O mais parecido vem primeiro.
export function compatibility(titles: Title[], minCommon = minCommonTitles): Pair[] {
  const totals = new Map<string, { a: string; b: string; common: number; gap: number }>();

  for (const title of titles) {
    const ratings = [...title.ratings].sort((x, y) => x.userId.localeCompare(y.userId));

    for (let i = 0; i < ratings.length; i++) {
      for (let j = i + 1; j < ratings.length; j++) {
        const key = `${ratings[i].userId}|${ratings[j].userId}`;
        const entry = totals.get(key) ?? { a: ratings[i].userId, b: ratings[j].userId, common: 0, gap: 0 };
        entry.common += 1;
        entry.gap += Math.abs(ratings[i].score - ratings[j].score);
        totals.set(key, entry);
      }
    }
  }

  return [...totals.values()]
    .filter((entry) => entry.common >= minCommon)
    .map((entry) => ({ a: entry.a, b: entry.b, common: entry.common, similarity: Math.round(Math.max(0, 100 - (entry.gap / entry.common) * 10)) }))
    .sort((x, y) => y.similarity - x.similarity || y.common - x.common || x.a.localeCompare(y.a));
}

// O par de uma pessoa com cada um dos outros, do mais parecido ao menos parecido.
export function pairsOf(pairs: Pair[], userId: string): { other: string; common: number; similarity: number }[] {
  return pairs
    .filter((pair) => pair.a === userId || pair.b === userId)
    .map((pair) => ({ other: pair.a === userId ? pair.b : pair.a, common: pair.common, similarity: pair.similarity }));
}

export interface Divisive {
  title: Title;
  min: number;
  max: number;
  count: number;
  deviation: number;
}

// Os títulos que mais dividiram a turma: maior desvio entre as notas, com pelo menos 3 notas.
export function divisiveTitles(titles: Title[], minRatings = 3, limit = 3): Divisive[] {
  return titles
    .filter((title) => title.ratings.length >= minRatings)
    .map((title) => {
      const scores = title.ratings.map((rating) => rating.score);
      const mean = scores.reduce((total, score) => total + score, 0) / scores.length;
      const deviation = Math.sqrt(scores.reduce((total, score) => total + (score - mean) ** 2, 0) / scores.length);
      return { title, min: Math.min(...scores), max: Math.max(...scores), count: scores.length, deviation };
    })
    .filter((entry) => entry.deviation > 0)
    .sort((a, b) => b.deviation - a.deviation || b.count - a.count || b.title.id - a.title.id)
    .slice(0, limit);
}

// Quantas notas caíram em cada faixa, de 0 a 10: a faixa N pega de N até antes de N+1 (o 10 fica sozinho).
export function scoreDistribution(titles: Title[]): number[] {
  const buckets = Array.from({ length: 11 }, () => 0);
  for (const title of titles) {
    for (const rating of title.ratings) buckets[Math.min(10, Math.max(0, Math.floor(rating.score)))] += 1;
  }
  return buckets;
}

export interface Overview {
  titles: number;
  ratings: number;
  members: number;
  average: number | null;
}

export function communityOverview(titles: Title[]): Overview {
  const ratings = titles.flatMap((title) => title.ratings);
  return {
    titles: titles.length,
    ratings: ratings.length,
    members: new Set(ratings.map((rating) => rating.userId)).size,
    average: ratings.length === 0 ? null : ratings.reduce((total, rating) => total + rating.score, 0) / ratings.length,
  };
}

// ---------- Meu ano ----------

export interface RecapEntry {
  title: Title;
  rating: Rating;
}

export interface Recap {
  year: number;
  count: number;
  average: number | null;
  peaks: number;
  rockBottoms: number;
  byKind: Record<number, number>;
  top: RecapEntry[];
  // A nota minha que mais destoou da média das outras pessoas (títulos com pelo menos 2 notas de outras pessoas).
  hottest: (RecapEntry & { others: number; diff: number }) | null;
  busiestMonth: { month: number; count: number } | null;
}

const yearOf = (timestamp: number) => new Date(timestamp).getFullYear();

// Anos em que a pessoa tem notas com data, do mais recente ao mais antigo. Notas antigas (sem data) não contam.
export function recapYears(titles: Title[], userId: string): number[] {
  const years = new Set<number>();
  for (const title of titles) {
    for (const rating of title.ratings) {
      if (rating.userId === userId && rating.ratedAt > 0) years.add(yearOf(rating.ratedAt));
    }
  }
  return [...years].sort((a, b) => b - a);
}

// A retrospectiva de uma pessoa em um ano: usa a data em que cada nota foi salva pela última vez.
export function recapOf(titles: Title[], userId: string, year: number): Recap {
  const mine: RecapEntry[] = [];
  for (const title of titles) {
    const rating = title.ratings.find((item) => item.userId === userId);
    if (rating && rating.ratedAt > 0 && yearOf(rating.ratedAt) === year) mine.push({ title, rating });
  }

  const months = Array.from({ length: 12 }, () => 0);
  for (const entry of mine) months[new Date(entry.rating.ratedAt).getMonth()] += 1;
  const busiest = months.reduce((best, count, month) => (count > best.count ? { month, count } : best), { month: 0, count: 0 });

  const byKind: Record<number, number> = { [TitleKind.MOVIE]: 0, [TitleKind.SERIES]: 0, [TitleKind.GAME]: 0 };
  for (const entry of mine) byKind[entry.title.kind] = (byKind[entry.title.kind] ?? 0) + 1;

  const top = [...mine]
    .sort((a, b) => b.rating.score - a.rating.score || (average(b.title) ?? 0) - (average(a.title) ?? 0) || b.title.id - a.title.id)
    .slice(0, 5);

  let hottest: Recap["hottest"] = null;
  for (const entry of mine) {
    const others = entry.title.ratings.filter((item) => item.userId !== userId);
    if (others.length < 2) continue;

    const diff = entry.rating.score - others.reduce((total, item) => total + item.score, 0) / others.length;
    if (hottest === null || Math.abs(diff) > Math.abs(hottest.diff)) hottest = { ...entry, others: others.length, diff };
  }

  return {
    year,
    count: mine.length,
    average: mine.length === 0 ? null : mine.reduce((total, entry) => total + entry.rating.score, 0) / mine.length,
    peaks: mine.filter((entry) => entry.rating.tier === RatingTier.PEAK).length,
    rockBottoms: mine.filter((entry) => entry.rating.tier === RatingTier.ROCK_BOTTOM).length,
    byKind,
    top,
    hottest,
    busiestMonth: busiest.count > 0 ? busiest : null,
  };
}
