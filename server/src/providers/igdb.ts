import { postJson, ProviderError } from "./http";

// O IGDB é da Twitch: a chave é um par (Client ID e Client Secret) que vira um token de acesso temporário.
const tokenUrl = "https://id.twitch.tv/oauth2/token";
const apiBase = "https://api.igdb.com/v4";

export interface IgdbCredentials {
  clientId: string;
  clientSecret: string;
}

export interface IgdbGame {
  id: string;
  name: string;
  // Nome em português, quando o IGDB tem um. Vazio quando não tem.
  namePt: string;
  year: number;
  // ID da imagem da capa (vazio = sem capa). A tela monta o endereço a partir dele.
  coverId: string;
  // Só vêm na consulta de detalhes (vazios na busca): resumo em inglês, gêneros e plataformas, separados por vírgula.
  summary: string;
  genres: string;
  platforms: string;
}

// O IGDB recusou a consulta em si (campo ou filtro que ele não conhece), e não a chave.
class IgdbBadQuery extends ProviderError {
  constructor() {
    super("unavailable", "IGDB did not understand the query.");
  }
}

interface CachedToken {
  value: string;
  expiresAt: number;
}

// Só na memória: o token dura semanas, e um novo é pedido sozinho quando vence.
const tokens = new Map<string, CachedToken>();
const pending = new Map<string, Promise<string>>();
const safetyMarginMs = 5 * 60 * 1000;

function cacheKey(creds: IgdbCredentials): string {
  return `${creds.clientId}\n${creds.clientSecret}`;
}

export function forgetIgdbTokens(): void {
  tokens.clear();
  pending.clear();
}

async function requestToken(creds: IgdbCredentials): Promise<string> {
  const form = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: "client_credentials",
  }).toString();

  const { status, body } = await postJson(tokenUrl, form, { "Content-Type": "application/x-www-form-urlencoded" });

  // A Twitch responde 400 para Client ID errado e 403 para Client Secret errado.
  if (status === 400 || status === 401 || status === 403) {
    throw new ProviderError("invalid_key", "Twitch rejected the Client ID or the Client Secret.");
  }
  if (status === 429) throw new ProviderError("rate_limited", "Twitch rate limit reached.");
  if (status < 200 || status >= 300) throw new ProviderError("unavailable", `Twitch answered ${status}.`);

  const data = (body ?? {}) as Record<string, unknown>;
  const value = typeof data.access_token === "string" ? data.access_token : "";
  if (!value) throw new ProviderError("unavailable", "Twitch did not return a token.");

  const seconds = typeof data.expires_in === "number" && data.expires_in > 0 ? data.expires_in : 3600;
  tokens.set(cacheKey(creds), { value, expiresAt: Date.now() + Math.max(seconds * 1000 - safetyMarginMs, 0) });
  return value;
}

// Duas buscas ao mesmo tempo pedem um token só.
async function igdbToken(creds: IgdbCredentials, renew = false): Promise<string> {
  const key = cacheKey(creds);
  const cached = tokens.get(key);
  if (!renew && cached && cached.expiresAt > Date.now()) return cached.value;

  const running = pending.get(key);
  if (running) return running;

  const job = requestToken(creds).finally(() => pending.delete(key));
  pending.set(key, job);
  return job;
}

async function call(path: string, query: string, creds: IgdbCredentials): Promise<Record<string, any>[]> {
  for (let attempt = 0; ; attempt++) {
    const token = await igdbToken(creds, attempt > 0);
    const { status, body } = await postJson(`${apiBase}${path}`, query, {
      "Client-ID": creds.clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    });

    // Token vencido ou revogado: pede outro uma vez e tenta de novo.
    if (status === 401 && attempt === 0) continue;
    if (status === 401 || status === 403) throw new ProviderError("invalid_key", "IGDB rejected the key.");
    if (status === 429) throw new ProviderError("rate_limited", "IGDB rate limit reached.");
    if (status === 400) throw new IgdbBadQuery();
    if (status < 200 || status >= 300) throw new ProviderError("unavailable", `IGDB answered ${status}.`);

    return Array.isArray(body) ? (body as Record<string, any>[]) : [];
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

const fields = "fields name,first_release_date,cover.image_id,alternative_names.name,alternative_names.comment;";
const detailFields = fields.replace(/;$/, ",summary,genres.name,platforms.abbreviation,platforms.name;");

// Nomes de uma lista aninhada do IGDB, sem repetir. Plataformas usam a sigla quando há (PS5, PC, NSW).
function names(list: unknown, preferShort = false): string {
  if (!Array.isArray(list)) return "";
  const found = list
    .map((item: Record<string, any>) => (preferShort ? text(item?.abbreviation) || text(item?.name) : text(item?.name)).trim())
    .filter(Boolean);
  return [...new Set(found)].join(", ");
}

// O IGDB marca os nomes alternativos com um comentário, como "Brazilian Portuguese title".
function portugueseName(raw: Record<string, any>): string {
  const alternatives: { name: string; comment: string }[] = Array.isArray(raw.alternative_names)
    ? raw.alternative_names.map((item: Record<string, any>) => ({ name: text(item?.name).trim(), comment: text(item?.comment) }))
    : [];

  const portuguese = alternatives.filter((item) => item.name !== "" && /portugu|brazil|brasil|\bpt(-br)?\b/i.test(item.comment));
  const brazilian = portuguese.find((item) => /brazil|brasil|pt-br/i.test(item.comment));
  return (brazilian ?? portuguese[0])?.name ?? "";
}

function toGame(raw: Record<string, any>): IgdbGame | null {
  const id = typeof raw.id === "number" ? String(raw.id) : "";
  const name = text(raw.name).trim();
  if (!id || !name) return null;

  const released = typeof raw.first_release_date === "number" ? new Date(raw.first_release_date * 1000).getUTCFullYear() : 0;

  return {
    id,
    name,
    namePt: portugueseName(raw),
    year: Number.isFinite(released) && released > 0 ? released : 0,
    coverId: text(raw.cover?.image_id),
    summary: text(raw.summary).trim(),
    genres: names(raw.genres),
    platforms: names(raw.platforms, true),
  };
}

// Deixa de fora edições, DLCs, expansões, pacotes e mods, que poluiriam a busca (0 jogo, 4 expansão independente,
// 8 remake, 9 remaster, 10 jogo expandido, 11 port). O campo "game_type" foi confirmado na API real; se um dia o IGDB
// deixar de aceitá-lo (resposta 400), a busca cai para o filtro simples e lembra disso.
const mainTypes = "(0,4,8,9,10,11)";
const filters = [`version_parent = null & game_type = ${mainTypes}`, "version_parent = null"];
let filterIndex = 0;

function quoted(value: string): string {
  return `"${value.replace(/["\\]/g, " ")}"`;
}

export async function igdbSearch(query: string, creds: IgdbCredentials): Promise<IgdbGame[]> {
  for (; filterIndex < filters.length; filterIndex++) {
    try {
      const rows = await call("/games", `${fields} search ${quoted(query)}; where ${filters[filterIndex]}; limit 10;`, creds);
      return rows.map(toGame).filter((game): game is IgdbGame => game !== null);
    } catch (error) {
      if (!(error instanceof IgdbBadQuery) || filterIndex === filters.length - 1) throw error;
    }
  }
  return [];
}

export async function igdbDetails(id: string, creds: IgdbCredentials): Promise<IgdbGame> {
  if (!/^\d{1,10}$/.test(id)) throw new ProviderError("not_found", "Invalid IGDB id.");

  // Se o IGDB não aceitar os campos extras, cai para os básicos: o jogo entra do mesmo jeito, sem resumo.
  let rows: Record<string, any>[];
  try {
    rows = await call("/games", `${detailFields} where id = ${id}; limit 1;`, creds);
  } catch (error) {
    if (!(error instanceof IgdbBadQuery)) throw error;
    rows = await call("/games", `${fields} where id = ${id}; limit 1;`, creds);
  }
  const game = rows.length > 0 ? toGame(rows[0]) : null;
  if (!game) throw new ProviderError("not_found", "IGDB does not know this game.");
  return game;
}

// Só confere se o par de chaves é aceito pela Twitch.
export async function igdbCheck(creds: IgdbCredentials): Promise<void> {
  tokens.delete(cacheKey(creds));
  await igdbToken(creds, true);
}
