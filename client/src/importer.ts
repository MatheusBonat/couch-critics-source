import { RatingTier, Title, TitleKind } from "@notas-app/gen-shared";

// Importar as próprias notas de um arquivo CSV. Este arquivo só tem a lógica (ler o arquivo, casar os nomes com
// títulos e executar a importação); a tela fica em ImportPanel.tsx.

export interface ImportRow {
  // Linha no arquivo (1 é o cabeçalho).
  line: number;
  // null = usa a categoria que estava aberta quando a importação começou.
  kind: TitleKind | null;
  name: string;
  year: number;
  score: number;
  tier: RatingTier;
  comment: string;
  spoiler: boolean;
  notes: string[];
  error?: string;
}

const maxName = 120;
const maxComment = 300;

// Tira acento e maiúscula: "Amélie" e "amelie" viram a mesma coisa.
function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// ---------- Ler o CSV ----------

// Excel em português salva com ponto e vírgula; outros programas usam vírgula ou tab. Escolhe o que mais aparece na primeira linha.
function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;

  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === "\n" || char === "\r")) break;
    else if (!quoted && char in counts) counts[char] += 1;
  }

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0 ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] : ",";
}

// CSV com aspas, vírgula dentro de aspas, aspas duplas e quebra de linha dentro de campo. Ignora o BOM e as linhas vazias.
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) endField();
    else if (char === "\r") {
      if (text[i + 1] === "\n") i++;
      endRow();
    } else if (char === "\n") endRow();
    else field += char;
  }
  if (field !== "" || row.length > 0) endRow();

  return rows;
}

const aliases: Record<string, string[]> = {
  title: ["title", "titulo", "name", "nome", "filme", "serie", "jogo", "obra", "livro", "album"],
  year: ["year", "ano"],
  category: ["category", "categoria", "kind", "tipo", "type"],
  score: ["score", "nota", "rating", "avaliacao", "note"],
  comment: ["comment", "comentario", "review", "opiniao"],
  special: ["special", "especial", "tier"],
  spoiler: ["spoiler"],
};

const kindWords: Record<string, TitleKind> = {
  movie: TitleKind.MOVIE,
  movies: TitleKind.MOVIE,
  film: TitleKind.MOVIE,
  filme: TitleKind.MOVIE,
  filmes: TitleKind.MOVIE,
  series: TitleKind.SERIES,
  serie: TitleKind.SERIES,
  tv: TitleKind.SERIES,
  show: TitleKind.SERIES,
  shows: TitleKind.SERIES,
  seriado: TitleKind.SERIES,
  game: TitleKind.GAME,
  games: TitleKind.GAME,
  jogo: TitleKind.GAME,
  jogos: TitleKind.GAME,
  book: TitleKind.BOOK,
  books: TitleKind.BOOK,
  livro: TitleKind.BOOK,
  livros: TitleKind.BOOK,
  anime: TitleKind.ANIME,
  animes: TitleKind.ANIME,
  album: TitleKind.ALBUM,
  albums: TitleKind.ALBUM,
  albuns: TitleKind.ALBUM,
  disco: TitleKind.ALBUM,
  discos: TitleKind.ALBUM,
  music: TitleKind.ALBUM,
  musica: TitleKind.ALBUM,
};

export function kindFromText(text: string): TitleKind | undefined {
  return kindWords[plain(text)];
}

export type ReadProblem = "empty" | "no-title" | "no-score";

// Transforma a tabela lida em linhas de importação. Linhas com problema vêm com `error` e não são importadas.
export function readRows(table: string[][]): { rows: ImportRow[]; problem?: ReadProblem } {
  if (table.length < 2) return { rows: [], problem: "empty" };

  const header = table[0].map((cell) => plain(cell).replace(/[\s_-]+/g, ""));
  const column = (key: string) => header.findIndex((cell) => aliases[key].includes(cell));
  const index = Object.fromEntries(Object.keys(aliases).map((key) => [key, column(key)])) as Record<string, number>;

  if (index.title < 0) return { rows: [], problem: "no-title" };
  if (index.score < 0 && index.special < 0) return { rows: [], problem: "no-score" };

  const rows: ImportRow[] = [];

  table.slice(1).forEach((cells, offset) => {
    const cell = (key: string) => (index[key] >= 0 ? (cells[index[key]] ?? "").trim() : "");
    const name = cell("title").replace(/\s+/g, " ");
    if (name === "") return;

    const row: ImportRow = { line: offset + 2, kind: null, name, year: 0, score: 0, tier: RatingTier.UNSPECIFIED, comment: "", spoiler: false, notes: [] };

    const category = cell("category");
    if (category !== "") {
      const kind = kindFromText(category);
      if (kind === undefined) row.error = "category";
      else row.kind = kind;
    }

    const year = Number(cell("year").replace(/\D/g, "").slice(0, 4));
    if (cell("year") !== "" && Number.isInteger(year) && year >= 1888 && year <= new Date().getFullYear() + 5) row.year = year;
    else if (cell("year") !== "") row.notes.push("year");

    const special = plain(cell("special")).replace(/[\s_-]+/g, "");
    if (special === "peak") row.tier = RatingTier.PEAK;
    else if (["rockbottom", "fundodopoco", "fundo"].includes(special)) row.tier = RatingTier.ROCK_BOTTOM;

    if (row.tier === RatingTier.PEAK) row.score = 10;
    else if (row.tier === RatingTier.ROCK_BOTTOM) row.score = 0;
    else {
      const raw = cell("score").replace(",", ".");
      const score = raw === "" ? NaN : Number(raw);
      if (!Number.isFinite(score)) row.error ??= "score";
      else if (score < 0 || score > 10) row.error ??= "range";
      else row.score = Math.round(score * 2) / 2;
    }

    const comment = cell("comment");
    row.comment = comment.length > maxComment ? comment.slice(0, maxComment) : comment;
    if (comment.length > maxComment) row.notes.push("comment");

    row.spoiler = ["yes", "true", "sim", "1", "x"].includes(plain(cell("spoiler"))) && row.comment !== "";

    if (row.name.length > maxName) row.error ??= "name";

    rows.push(row);
  });

  return { rows };
}

// ---------- Casar com títulos ----------

// Para comparar nomes: sem acento, sem pontuação e sem o artigo do começo ("The Matrix" = "Matrix").
export function normalizeName(text: string): string {
  return plain(text)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^(the|a|an|o|os|as|um|uma) /, "");
}

export interface Candidate {
  externalId: string;
  name: string;
  originalName: string;
  year: number;
  existingTitleId: number;
  posterPath: string;
  creator: string;
}

const yearClose = (wanted: number, found: number) => wanted === 0 || found === 0 || Math.abs(wanted - found) <= 1;

// O título que a comunidade já tem com esse nome (e ano parecido), na mesma categoria.
export function findLocal(titles: Title[], kind: TitleKind, row: ImportRow): Title | undefined {
  const wanted = normalizeName(row.name);
  return titles.find(
    (title) =>
      title.kind === kind &&
      yearClose(row.year, title.year) &&
      [title.name, title.namePt, title.nameEn].some((name) => name !== "" && normalizeName(name) === wanted),
  );
}

// O melhor resultado da busca para uma linha. "confident" só quando o nome bate exatamente e o ano é parecido:
// nos outros casos a pessoa confere antes de importar.
export function bestMatch(row: ImportRow, candidates: Candidate[]): { candidate: Candidate; confident: boolean } | null {
  if (candidates.length === 0) return null;

  const wanted = normalizeName(row.name);
  const exact = candidates.filter((item) => [item.name, item.originalName].some((name) => name !== "" && normalizeName(name) === wanted));

  // Entre os de ano parecido, o mais perto do pedido (um "1900" não ganha de um "1899" quando o arquivo diz 1899).
  const gap = (item: Candidate) => (row.year === 0 || item.year === 0 ? 1.5 : Math.abs(row.year - item.year));
  const sure = exact
    .filter((item) => yearClose(row.year, item.year))
    .reduce<Candidate | undefined>((best, item) => (best === undefined || gap(item) < gap(best) ? item : best), undefined);
  if (sure) return { candidate: sure, confident: true };

  return { candidate: exact[0] ?? candidates[0], confident: false };
}

// ---------- Executar ----------

export type Choice =
  | { type: "skip" }
  | { type: "existing"; titleId: number }
  | { type: "source"; candidate: Candidate }
  | { type: "manual" };

export interface PlanItem {
  row: ImportRow;
  kind: TitleKind;
  choice: Choice;
}

export interface Outcome {
  row: ImportRow;
  // imported: nota salva; kept: já havia nota sua e foi mantida; skipped: ignorada; failed: deu erro.
  status: "imported" | "kept" | "skipped" | "failed";
  titleId?: number;
  // Código do erro do servidor, quando falhou.
  code?: number;
}

export interface Deps {
  addFromSource(kind: TitleKind, externalId: string): Promise<Title>;
  create(kind: TitleKind, name: string, year: number): Promise<Title>;
  rate(titleId: number, row: ImportRow): Promise<void>;
  // A nota que a pessoa já tem neste título (para não sobrescrever sem querer).
  alreadyRated(titleId: number): boolean;
  // Lista atualizada da comunidade, para achar o título quando alguém adicionou na frente.
  reload(): Promise<Title[]>;
}

const duplicateCode = 2;

// O Root recusa um cliente que passa de 10 chamadas por segundo ("rate limit exceeded"). Na importação cada linha
// faz até 2 chamadas em seguida, então todas passam por um ritmo de ~6 por segundo, que deixa folga para o resto do app.
export const requestGapMs = 170;

export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

const realClock: Clock = { now: () => Date.now(), sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) };

// Devolve uma função que, a cada chamada, espera o tempo que falta para respeitar o intervalo mínimo.
export function createPacer(gapMs: number = requestGapMs, clock: Clock = realClock): () => Promise<void> {
  let next = 0;
  return async () => {
    const now = clock.now();
    const startAt = Math.max(now, next);
    next = startAt + gapMs;
    if (startAt > now) await clock.sleep(startAt - now);
  };
}

export function isRateLimited(error: unknown): boolean {
  const raw = (error as { message?: unknown } | null)?.message;
  return typeof raw === "string" && /rate limit/i.test(raw);
}

// Refaz uma chamada recusada por excesso de pedidos, esperando um pouco mais a cada tentativa.
export async function withRateRetry<T>(call: () => Promise<T>, clock: Clock = realClock, tries = 4): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call();
    } catch (error) {
      if (!isRateLimited(error) || attempt >= tries) throw error;
      await clock.sleep(1100 * attempt);
    }
  }
}

// O servidor manda os erros de regra como "codigo|mensagem".
export function codeOf(error: unknown): number | undefined {
  const raw = (error as { message?: unknown } | null)?.message;
  const match = typeof raw === "string" ? /^(\d+)\|/.exec(raw) : null;
  return match ? Number(match[1]) : undefined;
}

// Importa uma linha por vez (nunca em paralelo, para respeitar os limites dos serviços de busca).
export async function executeImport(
  plan: PlanItem[],
  options: { overwrite: boolean; shouldStop?: () => boolean },
  deps: Deps,
  onProgress?: (done: number, total: number) => void,
): Promise<Outcome[]> {
  const outcomes: Outcome[] = [];

  for (const [position, item] of plan.entries()) {
    if (options.shouldStop?.()) break;

    outcomes.push(await importOne(item, options, deps));
    onProgress?.(position + 1, plan.length);
  }

  return outcomes;
}

async function importOne(item: PlanItem, options: { overwrite: boolean }, deps: Deps): Promise<Outcome> {
  const { row, kind, choice } = item;
  if (choice.type === "skip" || row.error) return { row, status: "skipped" };

  try {
    let titleId: number;

    if (choice.type === "existing") {
      titleId = choice.titleId;
    } else if (choice.type === "source") {
      try {
        titleId = (await deps.addFromSource(kind, choice.candidate.externalId)).id;
      } catch (error) {
        if (codeOf(error) !== duplicateCode) throw error;
        const found = (await deps.reload()).find((title) => title.kind === kind && title.externalId === choice.candidate.externalId);
        if (!found) throw error;
        titleId = found.id;
      }
    } else {
      try {
        titleId = (await deps.create(kind, row.name, row.year)).id;
      } catch (error) {
        if (codeOf(error) !== duplicateCode) throw error;
        const found = findLocal(await deps.reload(), kind, row);
        if (!found) throw error;
        titleId = found.id;
      }
    }

    if (deps.alreadyRated(titleId) && !options.overwrite) return { row, status: "kept", titleId };

    await deps.rate(titleId, row);
    return { row, status: "imported", titleId };
  } catch (error) {
    return { row, status: "failed", code: codeOf(error) };
  }
}
