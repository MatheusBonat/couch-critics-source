import { getJson, ProviderError } from "./http";

const base = "https://www.omdbapi.com/";

export interface ImdbRating {
  rating: number;
  votes: number;
}

// Devolve null quando o IMDb ainda não tem nota para o título.
export async function omdbRating(imdbId: string, key: string): Promise<ImdbRating | null> {
  if (!/^tt\d{5,10}$/.test(imdbId)) throw new ProviderError("not_found", "Invalid IMDb id.");

  const url = new URL(base);
  url.searchParams.set("apikey", key.trim());
  url.searchParams.set("i", imdbId);

  const { status, body } = await getJson(url.toString());
  if (status === 401) throw new ProviderError("invalid_key", "OMDb rejected the key.");
  if (status < 200 || status >= 300) throw new ProviderError("unavailable", `OMDb answered ${status}.`);

  const data = (body ?? {}) as Record<string, unknown>;

  if (data.Response === "False") {
    const message = String(data.Error ?? "");
    if (/invalid api key|no api key/i.test(message)) throw new ProviderError("invalid_key", message);
    if (/limit/i.test(message)) throw new ProviderError("rate_limited", message);
    throw new ProviderError("not_found", message || "OMDb does not know this title.");
  }

  const rating = parseFloat(String(data.imdbRating ?? ""));
  if (!Number.isFinite(rating)) return null;

  const votes = parseInt(String(data.imdbVotes ?? "").replace(/,/g, ""), 10);
  return { rating, votes: Number.isFinite(votes) ? votes : 0 };
}

// Nota do IMDb de cada episódio de uma temporada: número do episódio -> nota. Episódios sem nota ficam de fora.
export async function omdbSeasonRatings(imdbId: string, season: number, key: string): Promise<Map<number, number>> {
  if (!/^tt\d{5,10}$/.test(imdbId) || !Number.isInteger(season) || season < 1 || season > 500) {
    throw new ProviderError("not_found", "Invalid IMDb id or season.");
  }

  const url = new URL(base);
  url.searchParams.set("apikey", key.trim());
  url.searchParams.set("i", imdbId);
  url.searchParams.set("Season", String(season));

  const { status, body } = await getJson(url.toString());
  if (status === 401) throw new ProviderError("invalid_key", "OMDb rejected the key.");
  if (status < 200 || status >= 300) throw new ProviderError("unavailable", `OMDb answered ${status}.`);

  const data = (body ?? {}) as Record<string, unknown>;

  if (data.Response === "False") {
    const message = String(data.Error ?? "");
    if (/invalid api key|no api key/i.test(message)) throw new ProviderError("invalid_key", message);
    if (/limit/i.test(message)) throw new ProviderError("rate_limited", message);
    throw new ProviderError("not_found", message || "OMDb does not know this season.");
  }

  const ratings = new Map<number, number>();
  const episodes = Array.isArray(data.Episodes) ? (data.Episodes as Record<string, unknown>[]) : [];

  for (const episode of episodes) {
    const number = parseInt(String(episode.Episode ?? ""), 10);
    const rating = parseFloat(String(episode.imdbRating ?? ""));
    if (Number.isFinite(number) && Number.isFinite(rating)) ratings.set(number, rating);
  }
  return ratings;
}

// Só confere se a chave é aceita, perguntando por um filme conhecido.
export async function omdbCheck(key: string): Promise<void> {
  try {
    await omdbRating("tt0111161", key);
  } catch (error) {
    // Limite do dia estourado quer dizer que a chave existe e funciona.
    if (error instanceof ProviderError && (error.code === "rate_limited" || error.code === "not_found")) return;
    throw error;
  }
}
