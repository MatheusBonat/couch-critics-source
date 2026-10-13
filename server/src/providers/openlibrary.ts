import { getJson, ProviderError } from "./http";
import { Catalog, CatalogItem, failFor, paced, textOf, userAgent, yearOf } from "./catalog";

const base = "https://openlibrary.org";
const headers = { "User-Agent": userAgent };
const searchFields = "key,title,author_name,first_publish_year,cover_i,subject";

async function call(path: string): Promise<Record<string, any>> {
  const { status, body } = await paced("openlibrary", () => getJson(`${base}${path}`, headers));
  // 422: a busca é curta demais para a Open Library. Não é falha do serviço, só não há resultado.
  if (status === 422) return {};
  if (status < 200 || status >= 300) failFor("Open Library", status);
  return (body ?? {}) as Record<string, any>;
}

// Assuntos da Open Library vêm muito soltos ("Accessible book", "Protected DAISY"): fica com os curtos e úteis.
function subjectsOf(list: unknown): string {
  if (!Array.isArray(list)) return "";
  const useful = list
    .map((item) => textOf(item).trim())
    .filter((item) => item.length > 0 && item.length <= 24 && !/accessible|daisy|large type|reading level|in library/i.test(item) && !/^[a-z]+:|_/i.test(item));
  return [...new Set(useful)].slice(0, 3).join(", ");
}

function toItem(raw: Record<string, any>): CatalogItem | null {
  const id = textOf(raw.key).replace("/works/", "");
  const name = textOf(raw.title).trim();
  if (!/^OL\d{1,12}W$/.test(id) || !name) return null;

  const authors = Array.isArray(raw.author_name) ? raw.author_name.map(textOf).filter(Boolean) : [];
  const cover = typeof raw.cover_i === "number" && raw.cover_i > 0 ? raw.cover_i : 0;

  return {
    id,
    name,
    originalName: "",
    year: yearOf(raw.first_publish_year),
    creator: authors.slice(0, 2).join(", "),
    poster: cover ? `ol:${cover}` : "",
    overview: "",
    genres: subjectsOf(raw.subject),
  };
}

async function search(query: string): Promise<CatalogItem[]> {
  const body = await call(`/search.json?q=${encodeURIComponent(query)}&limit=10&fields=${searchFields}`);
  const docs = Array.isArray(body.docs) ? body.docs : [];
  return docs.map(toItem).filter((item: CatalogItem | null): item is CatalogItem => item !== null);
}

// A sinopse (e o resto, se o item não veio de uma busca) está na página da obra.
function descriptionOf(work: Record<string, any>): string {
  const raw = typeof work.description === "string" ? work.description : textOf(work.description?.value);
  // A descrição é Markdown simples: tira os links e o negrito para ficar texto corrido.
  return raw
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_]{1,3}/g, "")
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function authorName(key: string): Promise<string> {
  if (!/^\/authors\/OL\d{1,12}A$/.test(key)) return "";
  try {
    return textOf((await call(`${key}.json`)).name).trim();
  } catch {
    return "";
  }
}

async function details(id: string): Promise<CatalogItem> {
  if (!/^OL\d{1,12}W$/.test(id)) throw new ProviderError("not_found", "Invalid Open Library id.");

  const work = await call(`/works/${id}.json`);
  const name = textOf(work.title).trim();
  if (!name) throw new ProviderError("not_found", "Open Library does not know this book.");

  const authorKeys = Array.isArray(work.authors) ? work.authors.map((entry: Record<string, any>) => textOf(entry?.author?.key)).slice(0, 2) : [];
  const authors = (await Promise.all(authorKeys.map(authorName))).filter(Boolean);
  const cover = Array.isArray(work.covers) ? work.covers.find((value: unknown) => typeof value === "number" && value > 0) : 0;

  return {
    id,
    name,
    originalName: "",
    year: yearOf(work.first_publish_date),
    creator: authors.join(", "),
    poster: cover ? `ol:${cover}` : "",
    overview: descriptionOf(work),
    genres: subjectsOf(work.subjects),
  };
}

export const openLibrary: Catalog = {
  source: "openlibrary",
  idPattern: /^OL\d{1,12}W$/,
  // A Open Library recusa (422) buscas com menos de 3 letras.
  minQuery: 3,
  search,
  details,
  // A busca não traz a sinopse; a página da obra traz.
  async enrich(item) {
    const work = await call(`/works/${item.id}.json`);
    return { ...item, overview: descriptionOf(work) };
  },
};
