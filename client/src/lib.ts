import { Episode, Rating, RatingTier, Title, TitleKind, WatchStatus } from "@notas-app/gen-shared";
import { Dictionary, KindKey, Lang } from "./i18n";

export interface KindInfo {
  kind: TitleKind;
  key: KindKey;
}

export const kinds: KindInfo[] = [
  { kind: TitleKind.MOVIE, key: "movie" },
  { kind: TitleKind.SERIES, key: "series" },
  { kind: TitleKind.GAME, key: "game" },
  { kind: TitleKind.BOOK, key: "book" },
  { kind: TitleKind.ANIME, key: "anime" },
  { kind: TitleKind.ALBUM, key: "album" },
];

// Categorias que o admin liga em Configurações. As três primeiras estão sempre ligadas.
export const optionalKinds: TitleKind[] = [TitleKind.BOOK, TitleKind.ANIME, TitleKind.ALBUM];

// De onde vêm os dados de cada categoria (para as mensagens da busca).
export function sourceNameOf(kind: TitleKind): string {
  switch (kind) {
    case TitleKind.GAME:
      return "IGDB";
    case TitleKind.BOOK:
      return "Open Library";
    case TitleKind.ANIME:
      return "AniList";
    case TitleKind.ALBUM:
      return "MusicBrainz";
    default:
      return "TMDB";
  }
}

export type SortKey = "recent" | "best" | "most" | "yearNew" | "yearOld" | "name";

export function average(title: Title): number | null {
  if (title.ratings.length === 0) return null;
  const sum = title.ratings.reduce((total, rating) => total + rating.score, 0);
  return sum / title.ratings.length;
}

export function formatScore(score: number, locale: string): string {
  return score.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function findRating(title: Title, userId: string): Rating | undefined {
  return title.ratings.find((rating) => rating.userId === userId);
}

export function hasRated(title: Title, userId: string): boolean {
  return title.ratings.some((rating) => rating.userId === userId);
}

// Compara sem diferenciar acento nem maiúscula: "amelie" encontra "Amélie".
export function searchKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function sortTitles(titles: Title[], sort: SortKey, lang: Lang = "en"): Title[] {
  const copy = [...titles];

  if (sort === "recent") return copy.sort((a, b) => b.id - a.id);

  // A a Z pelo nome no idioma da pessoa, sem ligar para acento nem maiúscula ("Rocky 2" vem antes de "Rocky 10").
  if (sort === "name") return copy.sort((a, b) => titleName(a, lang).localeCompare(titleName(b, lang), lang, { sensitivity: "base", numeric: true }) || b.id - a.id);

  if (sort === "yearNew" || sort === "yearOld") {
    // Título sem ano (0) vai para o fim nas duas ordens.
    return copy.sort((a, b) => {
      if (a.year === 0 && b.year === 0) return b.id - a.id;
      if (a.year === 0) return 1;
      if (b.year === 0) return -1;
      return (sort === "yearNew" ? b.year - a.year : a.year - b.year) || b.id - a.id;
    });
  }

  if (sort === "most") {
    return copy.sort((a, b) => b.ratings.length - a.ratings.length || b.id - a.id);
  }

  return copy.sort((a, b) => {
    const avgA = average(a);
    const avgB = average(b);
    if (avgA === null && avgB === null) return b.id - a.id;
    if (avgA === null) return 1;
    if (avgB === null) return -1;
    return avgB - avgA || b.ratings.length - a.ratings.length || b.id - a.id;
  });
}

export function upsertTitle(titles: Title[], title: Title): Title[] {
  const exists = titles.some((item) => item.id === title.id);
  return exists ? titles.map((item) => (item.id === title.id ? title : item)) : [...titles, title];
}

export interface TitlePage {
  titles: Title[];
  hasMore: boolean;
  nextBeforeId: number;
}

// Pede a lista em páginas (o Root limita cada mensagem a 256 KiB) e junta tudo, do mais novo para o mais antigo.
export async function loadAllTitles(fetchPage: (beforeId: number) => Promise<TitlePage>): Promise<Title[]> {
  const all: Title[] = [];
  const seen = new Set<number>();
  let beforeId = 0;

  // O limite de voltas é só uma proteção contra um servidor que nunca termina.
  for (let round = 0; round < 2000; round++) {
    const page = await fetchPage(beforeId);
    for (const title of page.titles) {
      if (seen.has(title.id)) continue;
      seen.add(title.id);
      all.push(title);
    }
    if (!page.hasMore || page.nextBeforeId === 0 || page.nextBeforeId === beforeId) break;
    beforeId = page.nextBeforeId;
  }
  return all;
}

// O que mudou em tempo real enquanto a lista ainda estava chegando.
export type TitleEvent = { type: "upsert"; title: Title } | { type: "delete"; id: number };

// Aplica as mudanças, na ordem em que chegaram, por cima da lista carregada: a mudança é mais nova que a página.
export function applyTitleEvents(titles: Title[], events: TitleEvent[]): Title[] {
  let result = titles;
  for (const event of events) {
    result = event.type === "upsert" ? upsertTitle(result, event.title) : result.filter((item) => item.id !== event.id);
  }
  return result;
}

// O servidor manda os erros de regra como "codigo|mensagem" (ver fail() em server/src/titleService.ts).
// O código escolhe o texto no idioma do usuário. Qualquer outro erro (rede, banco, falha interna)
// vira a mensagem genérica, sem expor detalhes técnicos.
export function errorMessage(error: unknown, t: Dictionary): string {
  const raw = (error as { message?: unknown } | null)?.message;
  if (typeof raw !== "string") return t.genericError;

  const match = /^(\d+)\|/.exec(raw);
  return (match && t.errors[Number(match[1])]) || t.genericError;
}

// A barra de nota vai de -0,5 a 10,5: a posição -0,5 é o Rock Bottom (conta como 0)
// e a 10,5 é o Peak (conta como 10). De 0 a 10 é a nota normal, de meio em meio ponto.
export const sliderMin = -0.5;
export const sliderMax = 10.5;

export function sliderValueOf(rating: Rating | undefined, fallback: number): number {
  if (!rating) return fallback;
  if (rating.tier === RatingTier.PEAK) return sliderMax;
  if (rating.tier === RatingTier.ROCK_BOTTOM) return sliderMin;
  return rating.score;
}

export function tierOfSlider(value: number): RatingTier {
  if (value > 10) return RatingTier.PEAK;
  if (value < 0) return RatingTier.ROCK_BOTTOM;
  return RatingTier.UNSPECIFIED;
}

export function scoreOfSlider(value: number): number {
  return Math.min(10, Math.max(0, value));
}

export function sliderLabel(value: number, t: Dictionary): string {
  const tier = tierOfSlider(value);
  if (tier === RatingTier.PEAK) return t.tiers.peak;
  if (tier === RatingTier.ROCK_BOTTOM) return t.tiers.rockBottom;
  return formatScore(value, t.locale);
}

// Texto da nota de um membro: o nome da nota especial, ou o número.
export function ratingLabel(rating: Rating, t: Dictionary): string {
  return sliderLabel(sliderValueOf(rating, rating.score), t);
}

// Ordem das notas de um membro: Peak primeiro, Rock Bottom por último.
export function ratingRank(rating: Rating): number {
  return sliderValueOf(rating, rating.score);
}

// Nome do título no idioma da pessoa; se não tiver, cai no outro idioma e por fim no nome principal.
export function titleName(title: Title, lang: Lang): string {
  const preferred = lang === "pt" ? title.namePt : title.nameEn;
  const other = lang === "pt" ? title.nameEn : title.namePt;
  return preferred || other || title.name;
}

// A busca da lista acha por qualquer um dos nomes ou pela franquia, com ou sem acento.
export function titleMatches(title: Title, needle: string): boolean {
  if (needle === "") return true;
  return [title.name, title.namePt, title.nameEn, title.franchise].some((name) => name !== "" && searchKey(name).includes(needle));
}

// Valor do filtro de franquia para "só os que não têm franquia" (vazio = todas).
export const noFranchise = "*none";

export interface FranchiseOption {
  name: string;
  count: number;
}

// As franquias dos títulos dados (sem repetir "marvel" e "Marvel"), da que tem mais títulos para a que tem menos.
export function franchiseOptions(titles: Title[]): FranchiseOption[] {
  const byKey = new Map<string, FranchiseOption>();
  for (const title of titles) {
    const name = title.franchise.trim();
    if (name === "") continue;
    const key = searchKey(name);
    const entry = byKey.get(key) ?? { name, count: 0 };
    entry.count += 1;
    byKey.set(key, entry);
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

// O título está na franquia escolhida? "" = qualquer um; noFranchise = os que não têm franquia.
export function inFranchise(title: Title, franchise: string): boolean {
  if (franchise === "") return true;
  const own = title.franchise.trim();
  if (franchise === noFranchise) return own === "";
  return own !== "" && searchKey(own) === searchKey(franchise);
}

// Capa no idioma da pessoa, com a do outro idioma como reserva.
export function posterPathOf(title: Title, lang: Lang): string {
  const preferred = lang === "pt" ? title.posterPt : title.posterEn;
  const other = lang === "pt" ? title.posterEn : title.posterPt;
  return preferred || other;
}

// Média das notas de uma lista (Peak já conta 10 e Rock Bottom 0). Sem notas, devolve null.
export function averageOf(ratings: Rating[]): number | null {
  if (ratings.length === 0) return null;
  return ratings.reduce((total, rating) => total + rating.score, 0) / ratings.length;
}

export function episodeName(episode: Episode, lang: Lang): string {
  const preferred = lang === "pt" ? episode.namePt : episode.nameEn;
  const other = lang === "pt" ? episode.nameEn : episode.namePt;
  return preferred || other;
}

// Nota de fora do episódio: a do IMDb; se o IMDb não tem, a do TMDB (só com votos), marcada como alternativa.
export function episodeOutsideRating(episode: Episode): { source: "imdb" | "tmdb"; value: number } | null {
  if (episode.imdbRating > 0) return { source: "imdb", value: episode.imdbRating };
  if (episode.tmdbRating > 0 && episode.tmdbVotes > 0) return { source: "tmdb", value: episode.tmdbRating };
  return null;
}

export function formatAirDate(date: string, locale: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}

// Sinopse e gêneros no idioma da pessoa, com o outro idioma como reserva (o IGDB só tem em inglês).
export function overviewOf(title: Title, lang: Lang): string {
  return lang === "pt" ? title.overviewPt || title.overviewEn : title.overviewEn || title.overviewPt;
}

export function genresOf(title: Title, lang: Lang): string {
  return lang === "pt" ? title.genresPt || title.genresEn : title.genresEn || title.genresPt;
}

// Data da nota (0 = nota antiga, sem data).
export function formatRatedDate(timestamp: number, locale: string): string {
  if (!(timestamp > 0)) return "";
  return new Date(timestamp).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}

export interface HallEntry {
  title: Title;
  count: number;
  userIds: string[];
}

// Os títulos com mais notas Peak (ou Rock Bottom), no máximo 10. No empate, vale a média: a maior para o Peak, a menor para o Rock Bottom.
export function hallOf(titles: Title[], tier: RatingTier): HallEntry[] {
  const worst = tier === RatingTier.ROCK_BOTTOM;

  return titles
    .map((title) => {
      const userIds = title.ratings.filter((rating) => rating.tier === tier).map((rating) => rating.userId);
      return { title, count: userIds.length, userIds };
    })
    .filter((entry) => entry.count > 0)
    .sort((a, b) => {
      const gap = (average(a.title) ?? 0) - (average(b.title) ?? 0);
      return b.count - a.count || (worst ? gap : -gap) || b.title.id - a.title.id;
    })
    .slice(0, 10);
}

type CsvValue = string | number;

// Texto que, depois de eventuais espaços, começa com = + - @ (ou com as formas de largura total) ou que começa com tab, CR, LF
// ou NUL é lido como fórmula pela planilha.
const formulaStart = /^(?:[\t\r\n\u0000]|\s*[=+\-@\uFF1D\uFF0B\uFF0D\uFF20])/;

// Uma célula de CSV. Todo texto vai entre aspas (com as aspas internas dobradas) e, se pudesse virar fórmula, leva um apóstrofo
// na frente; as aspas sozinhas não impedem a fórmula. Número sai como número, sem aspas e sem apóstrofo.
export function csvCell(value: CsvValue): string {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const safe = formulaStart.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

// Todas as notas da comunidade em CSV: uma linha por nota (e uma por título ainda sem nota).
export function buildCsv(titles: Title[], memberName: (userId: string) => string): string {
  const rows: CsvValue[][] = [["category", "title", "year", "member", "user_id", "score", "special", "comment", "spoiler", "rated_at"]];
  const keyOf = (kind: TitleKind) => kinds.find((item) => item.kind === kind)?.key ?? "";

  const ordered = [...titles].sort((a, b) => a.kind - b.kind || a.name.localeCompare(b.name));
  for (const title of ordered) {
    const head: CsvValue[] = [keyOf(title.kind), title.name, title.year > 0 ? title.year : ""];

    if (title.ratings.length === 0) {
      rows.push([...head, "", "", "", "", "", "", ""]);
      continue;
    }
    for (const rating of title.ratings) {
      const special = rating.tier === RatingTier.PEAK ? "peak" : rating.tier === RatingTier.ROCK_BOTTOM ? "rock_bottom" : "";
      rows.push([
        ...head,
        memberName(rating.userId),
        rating.userId,
        rating.score,
        special,
        rating.comment,
        rating.spoiler ? "yes" : "no",
        rating.ratedAt > 0 ? new Date(rating.ratedAt).toISOString() : "",
      ]);
    }
  }

  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

// Baixa o texto como arquivo. O BOM no começo faz o Excel abrir os acentos certo.
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Os emojis que dá para usar numa nota. É a mesma lista do servidor (server/src/reactionRepository.ts).
export const reactionEmojis = ["👍", "😂", "🔥", "😮", "❤️"];

// O estado de um título para uma pessoa (quero ver, vendo, já vi), ou nenhum.
export function watchStatusOf(title: Title, userId: string): WatchStatus {
  return title.statuses.find((entry) => entry.userId === userId)?.status ?? WatchStatus.UNSPECIFIED;
}

export type FilterKey = "all" | "unrated" | "want" | "doing" | "done";

export const filterStatus: Record<Exclude<FilterKey, "all" | "unrated">, WatchStatus> = {
  want: WatchStatus.WANT,
  doing: WatchStatus.DOING,
  done: WatchStatus.DONE,
};

// Filtro da lista: tudo, só o que falta eu avaliar, ou só o que eu marquei como quero ver, vendo ou já vi.
export function matchesFilter(title: Title, filter: FilterKey, userId: string): boolean {
  if (filter === "all") return true;
  if (filter === "unrated") return !hasRated(title, userId);
  return watchStatusOf(title, userId) === filterStatus[filter];
}

export interface WantItem {
  title: Title;
  // Quem marcou "quero ver / jogar / ler / ouvir" neste título, na ordem em que marcou.
  wanters: string[];
  mine: boolean;
  // Quem está usando já viu, jogou, leu ou ouviu: o título vai para o fim da lista dessa pessoa (os outros não veem diferença).
  done: boolean;
}

// A lista da turma: tudo que pelo menos uma pessoa quer ver, jogar, ler ou ouvir, nas categorias que aparecem.
// Quem tem mais gente querendo vem primeiro; empatou, vem o mais novo. O que quem está usando já viu ou jogou
// (já vi / joguei) não some: vai para o fim da lista dessa pessoa, na mesma ordem.
export function buildWantList(titles: Title[], allowedKinds: TitleKind[], userId: string, options: { kind?: TitleKind | null; onlyMine?: boolean } = {}): WantItem[] {
  const items: WantItem[] = [];

  for (const title of titles) {
    if (!allowedKinds.includes(title.kind)) continue;
    if (options.kind != null && title.kind !== options.kind) continue;

    const wanters = title.statuses.filter((entry) => entry.status === WatchStatus.WANT).map((entry) => entry.userId);
    const done = watchStatusOf(title, userId) === WatchStatus.DONE;
    if (wanters.length === 0 && !done) continue;

    const mine = wanters.includes(userId);
    if (options.onlyMine && !mine) continue;
    items.push({ title, wanters, mine, done });
  }

  return items.sort((a, b) => Number(a.done) - Number(b.done) || b.wanters.length - a.wanters.length || b.title.id - a.title.id);
}

// Quantos títulos ainda faltam na lista da turma em cada categoria (para os contadores das categorias; os já vistos não contam).
export function countWanted(titles: Title[], allowedKinds: TitleKind[], userId: string): Map<TitleKind, number> {
  const counts = new Map<TitleKind, number>();
  for (const item of buildWantList(titles, allowedKinds, userId)) {
    if (!item.done) counts.set(item.title.kind, (counts.get(item.title.kind) ?? 0) + 1);
  }
  return counts;
}

// Quantos títulos cada lista mostra de cada vez. "Mostrar mais" abre os próximos.
export const pageSize = 30;
