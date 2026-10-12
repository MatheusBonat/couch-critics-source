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

export const aniList: Catalog = { source: "anilist", idPattern: /^\d{1,9}$/, search, details };
