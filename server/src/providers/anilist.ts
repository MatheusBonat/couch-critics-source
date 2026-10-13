import { postJson, ProviderError } from "./http";
import { Catalog, CatalogItem, failFor, paced, textOf, userAgent, yearOf } from "./catalog";

const endpoint = "https://graphql.anilist.co";
const imageBase = "https://s4.anilist.co/file/anilistcdn/";

const mediaFields = "id title { romaji english native } startDate { year } coverImage { large } episodes genres description(asHtml: false)";

async function call(query: string, variables: Record<string, unknown>): Promise<Record<string, any>> {
  const { status, body } = await paced("anilist", () =>
    postJson(endpoint, JSON.stringify({ query, variables }), { "Content-Type": "application/json", "User-Agent": userAgent }),
  );

  const data = (body ?? {}) as Record<string, any>;
  // A AniList responde 404 quando o ID não existe e às vezes 200 com a lista "errors".
  if (status === 404 || (Array.isArray(data.errors) && data.errors.some((error: Record<string, any>) => error?.status === 404))) {
    throw new ProviderError("not_found", "AniList does not know this anime.");
  }
  if (status < 200 || status >= 300) failFor("AniList", status);
  return data;
}

// A sinopse vem com <br> e com texto de marcação: vira texto corrido.
function plainText(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function toItem(raw: Record<string, any>): CatalogItem | null {
  const id = typeof raw.id === "number" && raw.id > 0 ? String(raw.id) : "";
  const english = textOf(raw.title?.english).trim();
  const romaji = textOf(raw.title?.romaji).trim();
  const name = english || romaji;
  if (!id || !name) return null;

  // O nome em inglês vai como principal; o romaji ("Shingeki no Kyojin") vai ao lado.
  const originalName = english && romaji && english !== romaji ? romaji : textOf(raw.title?.native).trim() !== name ? textOf(raw.title?.native).trim() : "";

  // Só aceita capa do servidor de imagens da AniList.
  const cover = textOf(raw.coverImage?.large);
  const path = cover.startsWith(imageBase) ? cover.slice(imageBase.length) : "";

  return {
    id,
    name,
    originalName,
    year: yearOf(raw.startDate?.year),
    creator: "",
    poster: /^[A-Za-z0-9/_.-]+$/.test(path) ? `al:${path}` : "",
    overview: plainText(textOf(raw.description)),
    genres: Array.isArray(raw.genres) ? raw.genres.map(textOf).filter(Boolean).slice(0, 4).join(", ") : "",
  };
}

async function search(query: string): Promise<CatalogItem[]> {
  const data = await call(`query ($search: String) { Page(perPage: 10) { media(search: $search, type: ANIME, sort: SEARCH_MATCH) { ${mediaFields} } } }`, { search: query });
  const media = Array.isArray(data.data?.Page?.media) ? data.data.Page.media : [];
  return media.map(toItem).filter((item: CatalogItem | null): item is CatalogItem => item !== null);
}

async function details(id: string): Promise<CatalogItem> {
  if (!/^\d{1,9}$/.test(id)) throw new ProviderError("not_found", "Invalid AniList id.");

  const data = await call(`query ($id: Int) { Media(id: $id, type: ANIME) { ${mediaFields} } }`, { id: Number(id) });
  const item = data.data?.Media ? toItem(data.data.Media) : null;
  if (!item) throw new ProviderError("not_found", "AniList does not know this anime.");
  return item;
}

// Episódios de um anime: a AniList só sabe a quantidade e, às vezes, o nome (nos "streamingEpisodes", como "Episode 3 - Nome").
// Tudo vem de fora, então cada campo é conferido e limitado antes de ser usado.
export interface AnimeEpisodes {
  count: number;
  names: Map<number, string>;
}

const maxAnimeEpisodes = 2000;
const maxAnimeEpisodeName = 120;
const episodeTitle = /^(?:Episode|Episódio|Ep\.?)\s{0,3}(\d{1,4})\s{0,3}[-–—:.]\s{0,3}(.{1,200})/i;

export async function aniListEpisodes(id: string): Promise<AnimeEpisodes> {
  if (!/^\d{1,9}$/.test(id)) throw new ProviderError("not_found", "Invalid AniList id.");

  const data = await call(`query ($id: Int) { Media(id: $id, type: ANIME) { episodes nextAiringEpisode { episode } streamingEpisodes { title } } }`, { id: Number(id) });
  const media = data.data?.Media;
  if (!media || typeof media !== "object") throw new ProviderError("not_found", "AniList does not know this anime.");

  const names = new Map<number, string>();
  const streaming = Array.isArray(media.streamingEpisodes) ? media.streamingEpisodes.slice(0, 500) : [];
  for (const entry of streaming) {
    const match = episodeTitle.exec(textOf(entry?.title).trim());
    if (!match) continue;
    const number = Number(match[1]);
    const name = match[2].trim().slice(0, maxAnimeEpisodeName);
    if (number >= 1 && number <= maxAnimeEpisodes && name !== "" && !names.has(number)) names.set(number, name);
  }

  // Anime no ar: só os episódios que já saíram. Terminado: o total. Sem total: o maior número que a AniList nomeou.
  const total = typeof media.episodes === "number" && media.episodes > 0 ? Math.floor(media.episodes) : 0;
  const next = media.nextAiringEpisode?.episode;
  const highestNamed = Math.max(0, ...names.keys());
  const count = typeof next === "number" && next >= 1 ? Math.floor(next) - 1 : total > 0 ? total : highestNamed;

  return { count: Math.max(0, Math.min(maxAnimeEpisodes, count)), names };
}

export const aniList: Catalog = { source: "anilist", idPattern: /^\d{1,9}$/, search, details };
