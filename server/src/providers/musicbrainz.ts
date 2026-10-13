import { getJson, ProviderError } from "./http";
import { Catalog, CatalogItem, failFor, paced, retryDelayMs, sleep, textOf, userAgent, yearOf } from "./catalog";

const base = "https://musicbrainz.org/ws/2";
const headers = { "User-Agent": userAgent };
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// A MusicBrainz recusa com 503 quem passa do limite, mesmo por pouco: espera e tenta de novo uma vez.
async function call(path: string): Promise<Record<string, any>> {
  for (let attempt = 0; ; attempt++) {
    const { status, body } = await paced("musicbrainz", () => getJson(`${base}${path}`, headers));

    if (status === 503 && attempt === 0) {
      await sleep(retryDelayMs.musicbrainz);
      continue;
    }
    if (status < 200 || status >= 300) failFor("MusicBrainz", status);
    return (body ?? {}) as Record<string, any>;
  }
}

// Caracteres que têm função especial na busca da MusicBrainz (Lucene) viram texto comum.
function escapeLucene(text: string): string {
  return text.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, " ").replace(/\s+/g, " ").trim();
}

function artistOf(credit: unknown): string {
  if (!Array.isArray(credit)) return "";
  return credit
    .map((part: Record<string, any>) => `${textOf(part?.name)}${textOf(part?.joinphrase)}`)
    .join("")
    .trim();
}

function toItem(raw: Record<string, any>): CatalogItem | null {
  const id = textOf(raw.id);
  const name = textOf(raw.title).trim();
  if (!idPattern.test(id) || !name) return null;

  // Gêneros: os campos "genres" (consulta de detalhes) ou, na busca, as marcas mais votadas.
  const genreList = Array.isArray(raw.genres) ? raw.genres : Array.isArray(raw.tags) ? [...raw.tags].sort((a, b) => (b?.count ?? 0) - (a?.count ?? 0)) : [];

  return {
    id,
    name,
    originalName: "",
    year: yearOf(raw["first-release-date"]),
    creator: artistOf(raw["artist-credit"]),
    poster: `mb:${id}`,
    overview: "",
    genres: genreList
      .map((genre: Record<string, any>) => textOf(genre?.name).trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(", "),
  };
}

// Músicas únicas: os lançamentos do tipo "single" (uma música, com capa e artista), que é como as músicas de sucesso
// aparecem na MusicBrainz. Faixas que nunca saíram como single não aparecem na busca (dá para adicionar à mão).
async function search(query: string): Promise<CatalogItem[]> {
  const text = escapeLucene(query);
  if (text === "") return [];

  const lucene = `${text} AND primarytype:single`;
  const body = await call(`/release-group/?query=${encodeURIComponent(lucene)}&fmt=json&limit=10`);
  const groups = Array.isArray(body["release-groups"]) ? body["release-groups"] : [];
  return groups.map(toItem).filter((item: CatalogItem | null): item is CatalogItem => item !== null);
}

async function details(id: string): Promise<CatalogItem> {
  if (!idPattern.test(id)) throw new ProviderError("not_found", "Invalid MusicBrainz id.");

  const item = toItem(await call(`/release-group/${id}?inc=artist-credits+genres&fmt=json`));
  if (!item) throw new ProviderError("not_found", "MusicBrainz does not know this song.");
  return item;
}

export const musicBrainz: Catalog = { source: "musicbrainz", idPattern, search, details };
