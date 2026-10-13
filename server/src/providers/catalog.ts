import { ProviderError } from "./http";

// Os catálogos de livros (Open Library), animes (AniList) e músicas (MusicBrainz) são gratuitos e sem chave,
// mas pedem que o app se identifique e limitam as consultas.
export const userAgent = "CouchCritics/2.0 (https://matheusbonat.github.io/couch-critics/)";

// Um resultado de busca ou os detalhes de um item, já no formato do app.
export interface CatalogItem {
  id: string;
  name: string;
  // Nome original ou alternativo, mostrado ao lado quando é diferente do nome.
  originalName: string;
  year: number;
  // Autor (livros) ou artista (músicas).
  creator: string;
  // Capa já com o prefixo da fonte ("ol:", "al:" ou "mb:"); vazio = sem capa.
  poster: string;
  overview: string;
  // Gêneros separados por vírgula.
  genres: string;
}

export interface Catalog {
  // Vai em Title.source.
  source: "openlibrary" | "anilist" | "musicbrainz";
  idPattern: RegExp;
  // Menor tamanho de busca que o serviço aceita (a Open Library recusa buscas com menos de 3 letras). Padrão: 2.
  minQuery?: number;
  search(query: string): Promise<CatalogItem[]>;
  details(id: string): Promise<CatalogItem>;
  // Completa um item que veio da busca com algo que só a página do item tem (a sinopse dos livros). Opcional.
  enrich?(item: CatalogItem): Promise<CatalogItem>;
}

// Intervalo mínimo entre duas consultas a cada serviço, em milissegundos: a MusicBrainz aceita 1 por segundo (e
// recusa com 503 quem passa disso, então vai com folga) e a AniList, hoje, 30 por minuto. Os testes põem tudo em 0.
export const pacing: Record<Catalog["source"], number> = {
  openlibrary: 600,
  anilist: 2100,
  musicbrainz: 2000,
};

// Quando o serviço recusa por excesso de uso (503), espera um pouco e tenta de novo uma vez. Os testes põem em 0.
export const retryDelayMs = { musicbrainz: 2500 };

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Quantas consultas podem esperar a vez em cada serviço. Passou disso, a busca avisa que o serviço está limitando.
export const maxQueued = 6;

const lastCall = new Map<string, number>();
const chains = new Map<string, Promise<unknown>>();
const queued = new Map<string, number>();

// Faz as consultas de um serviço uma depois da outra, respeitando o intervalo mínimo.
export function paced<T>(source: Catalog["source"], job: () => Promise<T>): Promise<T> {
  const waiting = queued.get(source) ?? 0;
  if (waiting >= maxQueued) return Promise.reject(new ProviderError("rate_limited", "Too many requests waiting for the catalog."));
  queued.set(source, waiting + 1);

  const run = (chains.get(source) ?? Promise.resolve()).then(async () => {
    try {
      const wait = (lastCall.get(source) ?? 0) + pacing[source] - Date.now();
      if (wait > 0) await sleep(wait);
      lastCall.set(source, Date.now());
      return await job();
    } finally {
      queued.set(source, (queued.get(source) ?? 1) - 1);
    }
  });

  chains.set(source, run.catch(() => undefined));
  return run;
}

export function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// O ano de uma data em qualquer formato: "1937", "1969-09-26" ou "September 21, 1937". Sem ano reconhecível, 0.
export function yearOf(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number") return 0;
  const found = /\b(1\d{3}|20\d{2})\b/.exec(String(value));
  return found ? Number(found[1]) : 0;
}

// Traduz o status HTTP de um catálogo no que o app precisa saber.
export function failFor(service: string, status: number): never {
  if (status === 404) throw new ProviderError("not_found", `${service} does not know this item.`);
  if (status === 429 || status === 503) throw new ProviderError("rate_limited", `${service} rate limit reached.`);
  throw new ProviderError("unavailable", `${service} answered ${status}.`);
}
