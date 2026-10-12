import { getJson, ProviderError } from "./http";

const base = "https://api.themoviedb.org/3";

export type TmdbKind = "movie" | "tv";
export type Lang = "pt" | "en";

export interface TmdbSearchItem {
  id: string;
  name: string;
  originalName: string;
  year: number;
  posterPath: string;
}

export interface TmdbDetails extends TmdbSearchItem {
  imdbId: string;
  // Sinopse e gêneros (separados por vírgula) no idioma pedido.
  overview: string;
  genres: string;
}

const languageCode: Record<Lang, string> = { pt: "pt-BR", en: "en-US" };

// O token de leitura do TMDB é um texto comprido (vai no cabeçalho); a chave antiga v3 é curta (vai na URL).
async function call(token: string, path: string, params: Record<string, string> = {}) {
  const url = new URL(base + path);
  const headers: Record<string, string> = {};
  const key = token.trim();

  if (key.length > 60) headers.Authorization = `Bearer ${key}`;
  else url.searchParams.set("api_key", key);

  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);

  const { status, body } = await getJson(url.toString(), headers);

  if (status === 401 || status === 403) throw new ProviderError("invalid_key", "TMDB rejected the key.");
  if (status === 429) throw new ProviderError("rate_limited", "TMDB rate limit reached.");
  if (status === 404) throw new ProviderError("not_found", "TMDB does not know this title.");
  if (status < 200 || status >= 300) throw new ProviderError("unavailable", `TMDB answered ${status}.`);

  return body as Record<string, any>;
}

function yearOf(date: unknown): number {
  const year = typeof date === "string" ? parseInt(date.slice(0, 4), 10) : 0;
  return Number.isFinite(year) ? year : 0;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toItem(kind: TmdbKind, raw: Record<string, any>): TmdbSearchItem {
  const isMovie = kind === "movie";
  return {
    id: String(raw.id),
    name: text(isMovie ? raw.title : raw.name),
    originalName: text(isMovie ? raw.original_title : raw.original_name),
    year: yearOf(isMovie ? raw.release_date : raw.first_air_date),
    posterPath: text(raw.poster_path),
  };
}

// A busca do TMDB já acha por nome original, traduzido ou alternativo, em qualquer idioma.
export async function tmdbSearch(kind: TmdbKind, query: string, lang: Lang, token: string): Promise<TmdbSearchItem[]> {
  const body = await call(token, `/search/${kind}`, {
    query,
    language: languageCode[lang],
    include_adult: "false",
    page: "1",
  });

  const results = Array.isArray(body.results) ? body.results : [];
  return results.slice(0, 10).map((raw: Record<string, any>) => toItem(kind, raw));
}

// Junta duas listas de busca (uma por idioma), sem repetir o mesmo título: um de cada vez, começando
// pela lista do idioma da pessoa. Assim "parasita" acha o filme mesmo com a tela em inglês.
export function mergeSearchResults(primary: TmdbSearchItem[], secondary: TmdbSearchItem[], limit = 10): TmdbSearchItem[] {
  const merged: TmdbSearchItem[] = [];
  const seen = new Set<string>();
  // Se o mesmo título veio nas duas listas, vale a versão da lista do idioma da pessoa (nome e capa nesse idioma).
  const inPrimary = new Map(primary.map((item) => [item.id, item]));

  for (let i = 0; i < Math.max(primary.length, secondary.length) && merged.length < limit; i++) {
    for (const item of [primary[i], secondary[i]]) {
      if (item && !seen.has(item.id) && merged.length < limit) {
        seen.add(item.id);
        merged.push(inPrimary.get(item.id) ?? item);
      }
    }
  }
  return merged;
}

export async function tmdbDetails(kind: TmdbKind, id: string, lang: Lang, token: string): Promise<TmdbDetails> {
  if (!/^\d{1,10}$/.test(id)) throw new ProviderError("not_found", "Invalid TMDB id.");

  const body = await call(token, `/${kind}/${id}`, {
    language: languageCode[lang],
    append_to_response: "external_ids",
  });

  const genres = Array.isArray(body.genres)
    ? body.genres.map((genre: Record<string, any>) => text(genre?.name).trim()).filter(Boolean)
    : [];

  return {
    ...toItem(kind, body),
    imdbId: text(body.imdb_id) || text(body.external_ids?.imdb_id),
    overview: text(body.overview).trim(),
    genres: genres.join(", "),
  };
}

// Só confere se a chave é aceita.
export async function tmdbCheck(token: string): Promise<void> {
  await call(token, "/configuration");
}

export interface TmdbSeason {
  number: number;
  episodeCount: number;
}

export interface TmdbEpisode {
  number: number;
  name: string;
  airDate: string;
  rating: number;
  votes: number;
}

function numberOf(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// Temporadas da série. A temporada 0 ("Especiais") fica de fora.
export async function tmdbSeasons(id: string, token: string): Promise<TmdbSeason[]> {
  if (!/^\d{1,10}$/.test(id)) throw new ProviderError("not_found", "Invalid TMDB id.");

  const body = await call(token, `/tv/${id}`, { language: languageCode.en });
  const seasons = Array.isArray(body.seasons) ? body.seasons : [];

  return seasons
    .map((raw: Record<string, any>) => ({ number: numberOf(raw.season_number), episodeCount: numberOf(raw.episode_count) }))
    .filter((season: TmdbSeason) => season.number >= 1 && season.episodeCount > 0)
    .sort((a: TmdbSeason, b: TmdbSeason) => a.number - b.number);
}

export async function tmdbSeasonEpisodes(id: string, season: number, lang: Lang, token: string): Promise<TmdbEpisode[]> {
  if (!/^\d{1,10}$/.test(id) || !Number.isInteger(season) || season < 1 || season > 500) {
    throw new ProviderError("not_found", "Invalid season.");
  }

  const body = await call(token, `/tv/${id}/season/${season}`, { language: languageCode[lang] });
  const episodes = Array.isArray(body.episodes) ? body.episodes : [];

  return episodes
    .map((raw: Record<string, any>) => ({
      number: numberOf(raw.episode_number),
      name: text(raw.name),
      airDate: text(raw.air_date),
      rating: numberOf(raw.vote_average),
      votes: numberOf(raw.vote_count),
    }))
    .filter((episode: TmdbEpisode) => episode.number >= 1);
}
