import { Client, RootServerException } from "@rootsdk/server-app";
import {
  CommentRemoveRequest,
  CommentRemoveResponse,
  EpisodeClearRatingRequest,
  EpisodeClearRatingResponse,
  EpisodeListRequest,
  EpisodeListResponse,
  EpisodeRateRequest,
  EpisodeRateResponse,
  KeyStatus,
  RatingTier,
  ReactRequest,
  ReactResponse,
  SearchStatus,
  SettingsGetRequest,
  SettingsGetResponse,
  SettingsSaveRequest,
  SettingsSaveResponse,
  Title,
  TitleAddFromSourceRequest,
  TitleAddFromSourceResponse,
  TitleClearRatingRequest,
  TitleClearRatingResponse,
  TitleCreateRequest,
  TitleCreateResponse,
  TitleDeleteRequest,
  TitleDeleteResponse,
  TitleError,
  TitleKind,
  TitleListRequest,
  TitleListResponse,
  TitleRateRequest,
  TitleRateResponse,
  TitleSearchRequest,
  TitleSearchResponse,
  TitleUpdateRequest,
  TitleUpdateResponse,
  WatchStatus,
  WatchStatusRequest,
  WatchStatusResponse,
} from "@notas-app/gen-shared";
import { TitleServiceBase } from "@notas-app/gen-server";
import { TitleDetails, titleRepository } from "./titleRepository";
import { reactionEmojis, reactionRepository } from "./reactionRepository";
import { watchRepository } from "./watchRepository";
import { CachedSeason, EpisodeData, episodeRepository } from "./episodeRepository";
import { deleteSetting, getSetting, setSetting, settingKeys } from "./settingsRepository";
import { adminState, claimAdmin } from "./access";
import { warnAdmins } from "./communityLog";
import { enabledKinds, optionalKinds } from "./kinds";
import { nightService } from "./nightService";
import { ProviderError, ProviderErrorCode } from "./providers/http";
import { Lang, TmdbKind, mergeSearchResults, tmdbCheck, tmdbDetails, tmdbSearch, tmdbSeasonEpisodes, tmdbSeasons } from "./providers/tmdb";
import { omdbCheck, omdbRating, omdbSeasonRatings } from "./providers/omdb";
import { Catalog, CatalogItem } from "./providers/catalog";
import { openLibrary } from "./providers/openlibrary";
import { aniList } from "./providers/anilist";
import { musicBrainz } from "./providers/musicbrainz";
import { IgdbCredentials, forgetIgdbTokens, igdbCheck, igdbDetails, igdbSearch } from "./providers/igdb";

const maxNameLength = 120;
const maxCommentLength = 300;
const firstYear = 1888;
const maxScore = 10;

// A nota do IMDb é buscada de novo depois de uma semana, e poucas por vez, para não gastar o limite do dia do OMDb.
const imdbMaxAgeMs = 7 * 24 * 60 * 60 * 1000;
const imdbBatchSize = 15;

// Sinopse e gêneros dos títulos de antes da 1.2 são buscados aos poucos, em segundo plano.
const detailsBatchSize = 10;

// Só para testes: pausa entre uma consulta e outra ao OMDb.
export const tuning = {
  pauseMs: 250,
  // Cada página da lista tem no máximo 60 títulos e cerca de 180 KB (o limite do Root é 256 KiB por mensagem).
  listPageTitles: 60,
  listPageBytes: 180_000,
  // Nomes, datas e notas dos episódios são atualizados depois de uma semana (entram os episódios novos).
  episodeMaxAgeMs: imdbMaxAgeMs,
  // Se algum episódio ainda não tem nota no IMDb, tenta de novo depois de 6 horas.
  imdbRetryMs: 6 * 60 * 60 * 1000,
  // Depois de uma falha do OMDb (limite do dia, fora do ar), espera antes de tentar de novo.
  imdbBackoffMs: 10 * 60 * 1000,
  // Ao adicionar uma série, já busca as temporadas e a primeira temporada, para a primeira abertura ser rápida.
  prefetchEpisodes: true,
};

// O host do Root repassa para a tela só a mensagem da exceção: no servidor de teste o código
// chega como -3, mesmo lançando RootServerException. Por isso o código vai junto no texto,
// no formato "codigo|mensagem". A tela (client/src/lib.ts) usa o código para escolher o texto
// no idioma do usuário; a mensagem em inglês aqui é só uma reserva para logs e depuração.
function fail(code: TitleError, message: string): never {
  throw new RootServerException(code, `${code}|${message}`);
}

function isValidKind(kind: TitleKind): boolean {
  return kind === TitleKind.MOVIE || kind === TitleKind.SERIES || kind === TitleKind.GAME || optionalKinds.includes(kind);
}

// Uma categoria opcional desligada não aceita busca nem título novo (os que já existem continuam guardados).
async function requireEnabled(kind: TitleKind): Promise<void> {
  if (optionalKinds.includes(kind) && !(await enabledKinds()).includes(kind)) fail(TitleError.INVALID_KIND, "This category is turned off.");
}

// Livros, animes e álbuns vêm de catálogos gratuitos e sem chave.
const catalogs: Partial<Record<TitleKind, Catalog>> = {
  [TitleKind.BOOK]: openLibrary,
  [TitleKind.ANIME]: aniList,
  [TitleKind.ALBUM]: musicBrainz,
};

// O que a busca achou fica guardado por um tempo: adicionar um resultado não precisa consultar o serviço de novo
// (a AniList e a MusicBrainz limitam as consultas) e o ano, o autor e a capa já estão à mão.
const cacheTtlMs = 30 * 60 * 1000;
const cacheMax = 400;
const searchCache = new Map<string, { at: number; items: CatalogItem[] }>();
const itemCache = new Map<string, { at: number; item: CatalogItem }>();

function remember<V extends { at: number }>(cache: Map<string, V>, key: string, value: V): void {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > cacheMax) cache.delete(cache.keys().next().value as string);
}

function fresh<V extends { at: number }>(cache: Map<string, V>, key: string): V | undefined {
  const found = cache.get(key);
  return found && Date.now() - found.at < cacheTtlMs ? found : undefined;
}

// Só para testes.
export function resetCatalogCaches(): void {
  searchCache.clear();
  itemCache.clear();
}

// A nota vai de 0 a 10, de meio em meio ponto.
function isValidScore(score: number): boolean {
  return Number.isFinite(score) && score >= 0 && score <= maxScore && Math.round(score * 2) === score * 2;
}

// Regras de uma nota, iguais para título e episódio: de 0 a 10 de meio em meio ponto, ou Peak (conta 10)
// e Rock Bottom (conta 0), com comentário de até 300 caracteres.
function checkRating(rawScore: number, tier: RatingTier, rawComment: string): { score: number; comment: string } {
  const comment = rawComment.trim();

  if (tier !== RatingTier.UNSPECIFIED && tier !== RatingTier.PEAK && tier !== RatingTier.ROCK_BOTTOM) {
    fail(TitleError.INVALID_SCORE, "Unknown rating tier.");
  }

  const score = tier === RatingTier.PEAK ? maxScore : tier === RatingTier.ROCK_BOTTOM ? 0 : rawScore;

  if (tier === RatingTier.UNSPECIFIED && !isValidScore(score)) {
    fail(TitleError.INVALID_SCORE, "Ratings go from 0 to 10, in steps of 0.5.");
  }
  if (comment.length > maxCommentLength) {
    fail(TitleError.INVALID_COMMENT, `Comments can have up to ${maxCommentLength} characters.`);
  }
  return { score, comment };
}

async function requireTitle(id: number): Promise<Title> {
  const title = await titleRepository.get(id);
  if (!title) fail(TitleError.NOT_FOUND, "This title no longer exists.");
  return title;
}

// Filmes e séries vêm do TMDB; jogos vêm do IGDB.
function tmdbKindOf(kind: TitleKind): TmdbKind | null {
  if (kind === TitleKind.MOVIE) return "movie";
  if (kind === TitleKind.SERIES) return "tv";
  return null;
}

// Capa do IGDB guardada como "igdb:<id da imagem>"; a tela monta o endereço (ver client/src/images.ts).
function igdbPoster(coverId: string): string {
  return coverId ? `igdb:${coverId}` : "";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Source = "tmdb" | "igdb" | "catalog";

// Cada fonte tem os seus códigos, para a tela dizer qual serviço está com problema.
const sourceErrorCodes: Record<Source, Record<ProviderErrorCode, TitleError>> = {
  tmdb: {
    invalid_key: TitleError.SOURCE_INVALID_KEY,
    rate_limited: TitleError.SOURCE_RATE_LIMITED,
    unavailable: TitleError.SOURCE_UNAVAILABLE,
    not_found: TitleError.SOURCE_NOT_FOUND,
  },
  catalog: {
    invalid_key: TitleError.CATALOG_UNAVAILABLE,
    rate_limited: TitleError.CATALOG_RATE_LIMITED,
    unavailable: TitleError.CATALOG_UNAVAILABLE,
    not_found: TitleError.CATALOG_NOT_FOUND,
  },
  igdb: {
    invalid_key: TitleError.IGDB_INVALID_KEY,
    rate_limited: TitleError.IGDB_RATE_LIMITED,
    unavailable: TitleError.IGDB_UNAVAILABLE,
    not_found: TitleError.IGDB_NOT_FOUND,
  },
};

const searchStatuses: Record<ProviderErrorCode, SearchStatus> = {
  invalid_key: SearchStatus.INVALID_KEY,
  rate_limited: SearchStatus.RATE_LIMITED,
  unavailable: SearchStatus.UNAVAILABLE,
  not_found: SearchStatus.UNAVAILABLE,
};

// Chaves que o serviço externo recusou: aparecem como "inválida" nas configurações até serem trocadas.
const keyProblems = { tmdb: false, omdb: false, igdb: false };
const keyLabels = { tmdb: "TMDB", omdb: "OMDb", igdb: "IGDB (Twitch)" };

// Marca a chave como recusada e avisa os admins no log do app (o mesmo aviso só se repete depois de 6 horas).
function flagKeyProblem(name: keyof typeof keyProblems): void {
  keyProblems[name] = true;
  void warnAdmins(`key:${name}`, `${keyLabels[name]} rejected the saved key. An app admin needs to replace it in the Settings screen of Couch Critics.`);
}

async function igdbCredentials(): Promise<IgdbCredentials | null> {
  const clientId = await getSetting(settingKeys.igdbClientId);
  const clientSecret = await getSetting(settingKeys.igdbClientSecret);
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

async function keyStatus(name: "tmdb" | "omdb" | "igdb"): Promise<KeyStatus> {
  const stored = name === "igdb" ? await igdbCredentials() : await getSetting(name === "tmdb" ? settingKeys.tmdbToken : settingKeys.omdbKey);
  if (!stored) return KeyStatus.UNSPECIFIED;
  return keyProblems[name] ? KeyStatus.INVALID : KeyStatus.CONFIGURED;
}

const keyFormats = {
  tmdb: /^[A-Za-z0-9._-]{20,2000}$/,
  omdb: /^[A-Za-z0-9]{6,20}$/,
  // Client ID e Client Secret da Twitch: 30 letras e números cada.
  igdbId: /^[A-Za-z0-9]{20,64}$/,
  igdbSecret: /^[A-Za-z0-9]{20,64}$/,
};

export class TitleService extends TitleServiceBase {
  private refreshing = false;
  private loading = new Map<string, Promise<void>>();
  private imdbAttempts = new Map<string, number>();
  private background = new Set<Promise<void>>();
  private fillingDetails = false;

  private keepInBackground(job: Promise<void>): void {
    this.background.add(job);
    void job.finally(() => this.background.delete(job));
  }

  // Espera o trabalho em segundo plano (adiantar episódios, buscar detalhes) terminar. Serve aos testes.
  async idle(): Promise<void> {
    while (this.background.size > 0) await Promise.all([...this.background]);
  }

  // A lista vai em páginas, do título mais novo para o mais antigo: o Root recusa mensagens com mais de 256 KiB
  // (medido na mensagem serializada), e uma comunidade com algumas centenas de títulos passaria disso.
  async list(request: TitleListRequest, _client: Client): Promise<TitleListResponse> {
    const rows = await titleRepository.listPage(request.beforeId ?? 0, tuning.listPageTitles + 1);

    const titles: Title[] = [];
    let bytes = 0;
    let cut = false;
    for (const title of rows.slice(0, tuning.listPageTitles)) {
      const size = Title.toBinary(title).length + 8;
      if (titles.length > 0 && bytes + size > tuning.listPageBytes) {
        cut = true;
        break;
      }
      titles.push(title);
      bytes += size;
    }
    const hasMore = cut || rows.length > tuning.listPageTitles;

    // O trabalho em segundo plano começa quando a tela pede a primeira página.
    if (!request.beforeId) {
      void this.refreshImdbRatings();
      this.keepInBackground(this.fillMissingDetails());
    }
    return { titles, hasMore, nextBeforeId: hasMore ? titles[titles.length - 1].id : 0 };
  }

  async create(request: TitleCreateRequest, client: Client): Promise<TitleCreateResponse> {
    const name = request.name.trim().replace(/\s+/g, " ");
    const lastYear = new Date().getFullYear() + 5;

    if (!isValidKind(request.kind)) fail(TitleError.INVALID_KIND, "Choose a category.");
    await requireEnabled(request.kind);
    if (name.length === 0 || name.length > maxNameLength) {
      fail(TitleError.INVALID_NAME, `The name must be 1 to ${maxNameLength} characters.`);
    }
    if (request.year !== 0 && (request.year < firstYear || request.year > lastYear)) {
      fail(TitleError.INVALID_YEAR, "Invalid year.");
    }

    const title = await titleRepository.create(request.kind, name, request.year, client.userId);
    if (!title) fail(TitleError.DUPLICATE, "This title was already added.");

    this.broadcastCreated({ title }, "all", client);
    return { title };
  }

  async search(request: TitleSearchRequest, _client: Client): Promise<TitleSearchResponse> {
    if (request.kind === TitleKind.GAME) return this.searchGames(request);

    const catalog = catalogs[request.kind];
    if (catalog) return this.searchCatalog(request, catalog);

    const tmdbKind = tmdbKindOf(request.kind);
    if (!tmdbKind) return { status: SearchStatus.NOT_CONFIGURED, results: [] };

    const token = await getSetting(settingKeys.tmdbToken);
    if (!token) return { status: SearchStatus.NOT_CONFIGURED, results: [] };

    const query = request.query.trim().replace(/\s+/g, " ").slice(0, 100);
    if (query.length < 2) return { status: SearchStatus.OK, results: [] };

    const lang: Lang = request.language === "pt" ? "pt" : "en";

    try {
      // O TMDB casa melhor o nome no idioma pedido. Para achar pelo nome em português ou em inglês,
      // busca nos dois e junta; se a busca no outro idioma falhar, a do idioma da pessoa ainda vale.
      const other: Lang = lang === "pt" ? "en" : "pt";
      const [primary, secondary] = await Promise.all([
        tmdbSearch(tmdbKind, query, lang, token),
        tmdbSearch(tmdbKind, query, other, token).catch(() => []),
      ]);
      const items = mergeSearchResults(primary, secondary);
      const existing = await titleRepository.existingIdsByExternal(
        request.kind,
        items.map((item) => item.id),
      );

      return {
        status: SearchStatus.OK,
        results: items.map((item) => ({
          externalId: item.id,
          kind: request.kind,
          name: item.name || item.originalName,
          originalName: item.originalName,
          year: item.year,
          posterPath: item.posterPath,
          existingTitleId: existing.get(item.id) ?? 0,
          creator: "",
        })),
      };
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      if (error.code === "invalid_key") flagKeyProblem("tmdb");
      return { status: searchStatuses[error.code], results: [] };
    }
  }

  // Livros, animes e álbuns: busca no catálogo da categoria (sem chave). Resultados repetidos vêm do cache.
  private async searchCatalog(request: TitleSearchRequest, catalog: Catalog): Promise<TitleSearchResponse> {
    await requireEnabled(request.kind);

    const query = request.query.trim().replace(/\s+/g, " ").slice(0, 100);
    if (query.length < 2) return { status: SearchStatus.OK, results: [] };

    try {
      const cacheKey = `${request.kind}:${query.toLowerCase()}`;
      let items = fresh(searchCache, cacheKey)?.items;

      if (!items) {
        items = await catalog.search(query);
        remember(searchCache, cacheKey, { at: Date.now(), items });
        for (const item of items) remember(itemCache, `${request.kind}:${item.id}`, { at: Date.now(), item });
      }

      const existing = await titleRepository.existingIdsByExternal(
        request.kind,
        items.map((item) => item.id),
      );

      return {
        status: SearchStatus.OK,
        results: items.map((item) => ({
          externalId: item.id,
          kind: request.kind,
          name: item.name,
          originalName: item.originalName,
          year: item.year,
          posterPath: item.poster,
          existingTitleId: existing.get(item.id) ?? 0,
          creator: item.creator,
        })),
      };
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      return { status: searchStatuses[error.code], results: [] };
    }
  }

  private async addCatalog(request: TitleAddFromSourceRequest, client: Client, catalog: Catalog): Promise<TitleAddFromSourceResponse> {
    await requireEnabled(request.kind);

    const externalId = request.externalId.trim();
    if (!catalog.idPattern.test(externalId)) fail(TitleError.CATALOG_NOT_FOUND, "Unknown item.");

    if (await titleRepository.findByExternal(request.kind, externalId)) {
      fail(TitleError.DUPLICATE, "This title was already added.");
    }

    // O que a busca achou já tem tudo; se o servidor reiniciou, busca de novo os detalhes.
    const cacheKey = `${request.kind}:${externalId}`;
    let item: CatalogItem;
    try {
      const cached = fresh(itemCache, cacheKey)?.item;
      item = cached ? await catalog.enrich?.(cached).catch(() => cached) ?? cached : await catalog.details(externalId);
    } catch (error) {
      if (error instanceof ProviderError) fail(sourceErrorCodes.catalog[error.code], error.message);
      throw error;
    }

    const created = await titleRepository.createFromSource(
      {
        kind: request.kind,
        externalId,
        name: item.name.slice(0, maxNameLength),
        nameEn: item.name.slice(0, maxNameLength),
        namePt: "",
        year: item.year,
        posterEn: item.poster,
        posterPt: item.poster,
        imdbId: "",
        source: catalog.source,
        creator: item.creator.slice(0, maxNameLength),
        details: { overviewPt: "", overviewEn: item.overview, genresPt: "", genresEn: item.genres, platforms: "" },
      },
      client.userId,
    );
    if (!created) fail(TitleError.DUPLICATE, "This title was already added.");

    this.broadcastCreated({ title: created }, "all", client);
    return { title: created };
  }

  // Jogos: o IGDB acha pelo nome (também pelos nomes alternativos, como o brasileiro) e traz a capa.
  private async searchGames(request: TitleSearchRequest): Promise<TitleSearchResponse> {
    const credentials = await igdbCredentials();
    if (!credentials) return { status: SearchStatus.NOT_CONFIGURED, results: [] };

    const query = request.query.trim().replace(/\s+/g, " ").slice(0, 100);
    if (query.length < 2) return { status: SearchStatus.OK, results: [] };

    try {
      const games = await igdbSearch(query, credentials);
      const existing = await titleRepository.existingIdsByExternal(
        TitleKind.GAME,
        games.map((game) => game.id),
      );

      return {
        status: SearchStatus.OK,
        results: games.map((game) => ({
          externalId: game.id,
          kind: TitleKind.GAME,
          // Na tela em português, mostra o nome brasileiro quando o IGDB tem um; o original vai ao lado.
          name: request.language === "pt" && game.namePt !== "" ? game.namePt : game.name,
          originalName: game.name,
          year: game.year,
          posterPath: igdbPoster(game.coverId),
          existingTitleId: existing.get(game.id) ?? 0,
          creator: "",
        })),
      };
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      if (error.code === "invalid_key") flagKeyProblem("igdb");
      return { status: searchStatuses[error.code], results: [] };
    }
  }

  private async addGame(request: TitleAddFromSourceRequest, client: Client): Promise<TitleAddFromSourceResponse> {
    const externalId = request.externalId.trim();
    if (!/^\d{1,10}$/.test(externalId)) fail(TitleError.IGDB_NOT_FOUND, "Unknown game.");

    const credentials = await igdbCredentials();
    if (!credentials) fail(TitleError.IGDB_NOT_CONFIGURED, "Game search is not set up yet.");

    if (await titleRepository.findByExternal(TitleKind.GAME, externalId)) {
      fail(TitleError.DUPLICATE, "This title was already added.");
    }

    let game;
    try {
      game = await igdbDetails(externalId, credentials);
    } catch (error) {
      if (error instanceof ProviderError) {
        if (error.code === "invalid_key") flagKeyProblem("igdb");
        fail(sourceErrorCodes.igdb[error.code], error.message);
      }
      throw error;
    }

    const cover = igdbPoster(game.coverId);
    const created = await titleRepository.createFromSource(
      {
        kind: TitleKind.GAME,
        externalId,
        name: game.name.slice(0, maxNameLength),
        nameEn: game.name.slice(0, maxNameLength),
        namePt: game.namePt.slice(0, maxNameLength),
        year: game.year,
        // A capa do IGDB é a mesma em qualquer idioma.
        posterEn: cover,
        posterPt: cover,
        imdbId: "",
        source: "igdb",
        // O IGDB só tem resumo em inglês.
        details: { overviewPt: "", overviewEn: game.summary, genresPt: "", genresEn: game.genres, platforms: game.platforms },
      },
      client.userId,
    );
    if (!created) fail(TitleError.DUPLICATE, "This title was already added.");

    this.broadcastCreated({ title: created }, "all", client);
    return { title: created };
  }

  async addFromSource(request: TitleAddFromSourceRequest, client: Client): Promise<TitleAddFromSourceResponse> {
    if (request.kind === TitleKind.GAME) return this.addGame(request, client);

    const catalog = catalogs[request.kind];
    if (catalog) return this.addCatalog(request, client, catalog);

    const tmdbKind = tmdbKindOf(request.kind);
    if (!tmdbKind) fail(TitleError.INVALID_KIND, "Choose movie, series or game.");

    const externalId = request.externalId.trim();
    if (!/^\d{1,10}$/.test(externalId)) fail(TitleError.SOURCE_NOT_FOUND, "Unknown title.");

    const token = await getSetting(settingKeys.tmdbToken);
    if (!token) fail(TitleError.SOURCE_NOT_CONFIGURED, "Search is not set up yet.");

    if (await titleRepository.findByExternal(request.kind, externalId)) {
      fail(TitleError.DUPLICATE, "This title was already added.");
    }

    // Guarda o nome e a capa nos dois idiomas, para mostrar conforme o idioma de cada pessoa.
    let english, portuguese;
    try {
      [english, portuguese] = await Promise.all([
        tmdbDetails(tmdbKind, externalId, "en", token),
        tmdbDetails(tmdbKind, externalId, "pt", token),
      ]);
    } catch (error) {
      if (error instanceof ProviderError) {
        if (error.code === "invalid_key") flagKeyProblem("tmdb");
        fail(sourceErrorCodes.tmdb[error.code], error.message);
      }
      throw error;
    }

    const name = (english.name || english.originalName || portuguese.name || portuguese.originalName).trim();
    if (!name) fail(TitleError.SOURCE_NOT_FOUND, "Unknown title.");

    const created = await titleRepository.createFromSource(
      {
        kind: request.kind,
        externalId,
        name: name.slice(0, maxNameLength),
        nameEn: english.name.slice(0, maxNameLength),
        namePt: portuguese.name.slice(0, maxNameLength),
        year: english.year || portuguese.year,
        posterEn: english.posterPath,
        posterPt: portuguese.posterPath,
        imdbId: english.imdbId || portuguese.imdbId,
        source: "tmdb",
        details: {
          overviewPt: portuguese.overview,
          overviewEn: english.overview,
          genresPt: portuguese.genres,
          genresEn: english.genres,
          platforms: "",
        },
      },
      client.userId,
    );
    if (!created) fail(TitleError.DUPLICATE, "This title was already added.");

    let title = created;

    // A nota do IMDb é só curiosidade: se falhar, o título entra do mesmo jeito.
    const omdbKey = await getSetting(settingKeys.omdbKey);
    if (omdbKey && created.imdbId) {
      try {
        const rating = await omdbRating(created.imdbId, omdbKey);
        await titleRepository.updateImdb(created.id, rating?.rating ?? 0, rating?.votes ?? 0, Date.now());
        title = (await titleRepository.get(created.id)) ?? created;
      } catch (error) {
        if (error instanceof ProviderError && error.code === "invalid_key") flagKeyProblem("omdb");
      }
    }

    this.broadcastCreated({ title }, "all", client);
    if (tuning.prefetchEpisodes && request.kind === TitleKind.SERIES) {
      const job = this.warmEpisodes(title, token);
      this.background.add(job);
      void job.finally(() => this.background.delete(job));
    }
    return { title };
  }

  async delete(request: TitleDeleteRequest, client: Client): Promise<TitleDeleteResponse> {
    const title = await requireTitle(request.id);
    if (title.createdBy !== client.userId && !(await adminState(client.userId)).isAdmin) {
      fail(TitleError.FORBIDDEN, "Only the person who added a title, or an app admin, can remove it.");
    }

    await titleRepository.delete(title.id);
    // O título sai das noites em que era uma opção (e das que ele já tinha vencido).
    await nightService.titleRemoved(title.id);

    this.broadcastDeleted({ id: title.id }, "all", client);
    return {};
  }

  // Só títulos adicionados à mão têm nome e ano editáveis (os da fonte vêm do TMDB ou do IGDB). Vale para quem adicionou ou um admin.
  async update(request: TitleUpdateRequest, client: Client): Promise<TitleUpdateResponse> {
    const title = await requireTitle(request.id);
    if (title.createdBy !== client.userId && !(await adminState(client.userId)).isAdmin) {
      fail(TitleError.FORBIDDEN, "Only the person who added a title, or an app admin, can edit it.");
    }
    if (title.source !== "manual") fail(TitleError.TITLE_LOCKED, "Titles from TMDB or IGDB cannot be edited.");

    const name = request.name.trim().replace(/\s+/g, " ");
    if (name.length === 0 || name.length > maxNameLength) {
      fail(TitleError.INVALID_NAME, "The name must be 1 to " + maxNameLength + " characters.");
    }
    if (request.year !== 0 && (request.year < firstYear || request.year > new Date().getFullYear() + 5)) {
      fail(TitleError.INVALID_YEAR, "Invalid year.");
    }
    if (await titleRepository.hasSameName(title.kind, name, request.year, title.id)) {
      fail(TitleError.DUPLICATE, "This title was already added.");
    }

    await titleRepository.update(title.id, name, request.year);
    const updated = await requireTitle(title.id);
    this.broadcastUpdated({ title: updated }, "all", client);
    return { title: updated };
  }

  // Moderação: um admin apaga o texto de um comentário. A nota da pessoa continua.
  async removeComment(request: CommentRemoveRequest, client: Client): Promise<CommentRemoveResponse> {
    if (!(await adminState(client.userId)).isAdmin) fail(TitleError.NOT_ADMIN, "Only app admins can remove comments.");
    await requireTitle(request.titleId);

    if (request.season === 0) {
      await titleRepository.removeComment(request.titleId, request.userId);
      const title = await requireTitle(request.titleId);
      this.broadcastUpdated({ title }, "all", client);
      return { title };
    }

    if (!(await episodeRepository.getEpisode(request.titleId, request.season, request.number))) {
      fail(TitleError.EPISODE_NOT_FOUND, "This episode does not exist.");
    }
    await episodeRepository.removeComment(request.titleId, request.season, request.number, request.userId);
    return this.episodeChanged(request.titleId, request.season, request.number, client);
  }

  // Reagir à nota de outra pessoa com um dos emojis da lista. Reagir de novo com o mesmo emoji tira a reação.
  async react(request: ReactRequest, client: Client): Promise<ReactResponse> {
    if (!reactionEmojis.includes(request.emoji)) fail(TitleError.INVALID_REACTION, "Unknown reaction.");
    if (request.ratingUserId === client.userId) fail(TitleError.INVALID_REACTION, "You cannot react to your own rating.");

    const title = await requireTitle(request.titleId);

    if (request.season === 0) {
      if (!title.ratings.some((rating) => rating.userId === request.ratingUserId)) fail(TitleError.NOT_FOUND, "This rating no longer exists.");

      await reactionRepository.toggle(title.id, 0, 0, request.ratingUserId, client.userId, request.emoji);
      const updated = await requireTitle(title.id);
      this.broadcastUpdated({ title: updated }, "all", client);
      return { title: updated };
    }

    const episode = await episodeRepository.getEpisode(title.id, request.season, request.number);
    if (!episode || !episode.ratings.some((rating) => rating.userId === request.ratingUserId)) {
      fail(TitleError.EPISODE_NOT_FOUND, "This rating no longer exists.");
    }

    await reactionRepository.toggle(title.id, request.season, request.number, request.ratingUserId, client.userId, request.emoji);
    return this.episodeChanged(title.id, request.season, request.number, client);
  }

  // O estado do título para quem pede: quero ver, vendo, já vi (ou nenhum, que limpa).
  async setWatchStatus(request: WatchStatusRequest, client: Client): Promise<WatchStatusResponse> {
    const valid = [WatchStatus.UNSPECIFIED, WatchStatus.WANT, WatchStatus.DOING, WatchStatus.DONE];
    if (!valid.includes(request.status)) fail(TitleError.INVALID_STATUS, "Unknown status.");

    await requireTitle(request.titleId);
    await watchRepository.set(request.titleId, client.userId, request.status, Date.now());

    const title = await requireTitle(request.titleId);
    this.broadcastUpdated({ title }, "all", client);
    return { title };
  }

  async rate(request: TitleRateRequest, client: Client): Promise<TitleRateResponse> {
    const { score, comment } = checkRating(request.score, request.tier, request.comment);
    const tier = request.tier;

    await requireTitle(request.titleId);
    await titleRepository.setRating(request.titleId, client.userId, score, comment, tier, request.spoiler);

    const title = await requireTitle(request.titleId);
    this.broadcastUpdated({ title }, "all", client);
    return { title };
  }

  async clearRating(request: TitleClearRatingRequest, client: Client): Promise<TitleClearRatingResponse> {
    await requireTitle(request.titleId);
    await titleRepository.clearRating(request.titleId, client.userId);
    await reactionRepository.clearForRating(request.titleId, 0, 0, client.userId);

    const title = await requireTitle(request.titleId);
    this.broadcastUpdated({ title }, "all", client);
    return { title };
  }

  async listEpisodes(request: EpisodeListRequest, _client: Client): Promise<EpisodeListResponse> {
    const title = await requireTitle(request.titleId);
    const unavailable = (status: SearchStatus): EpisodeListResponse => ({ status, seasons: [], season: 0, episodes: [] });

    // Só séries que vieram do TMDB têm episódios. Séries adicionadas à mão não têm de onde tirar a lista.
    if (title.kind !== TitleKind.SERIES || title.source !== "tmdb" || title.externalId === "") {
      return unavailable(SearchStatus.NOT_AVAILABLE);
    }

    const token = await getSetting(settingKeys.tmdbToken);
    const stored = await episodeRepository.seasonsOf(title.id);
    if (!token && stored.length === 0) return unavailable(SearchStatus.NOT_CONFIGURED);

    try {
      const seasons = token ? await this.ensureSeasons(title, token) : stored;
      if (seasons.length === 0) return unavailable(SearchStatus.NOT_AVAILABLE);

      const season = seasons.find((item) => item.number === request.season)?.number ?? seasons[0].number;
      if (token) await this.ensureEpisodes(title, season, token);

      return {
        status: SearchStatus.OK,
        seasons: seasons.map((item) => ({ number: item.number, episodeCount: item.episodeCount })),
        season,
        episodes: await episodeRepository.listEpisodes(title.id, season),
      };
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      if (error.code === "invalid_key") flagKeyProblem("tmdb");
      return unavailable(searchStatuses[error.code]);
    }
  }

  async rateEpisode(request: EpisodeRateRequest, client: Client): Promise<EpisodeRateResponse> {
    const { score, comment } = checkRating(request.score, request.tier, request.comment);

    if (!(await episodeRepository.getEpisode(request.titleId, request.season, request.number))) {
      fail(TitleError.EPISODE_NOT_FOUND, "This episode does not exist.");
    }

    await episodeRepository.setRating(request.titleId, request.season, request.number, client.userId, score, comment, request.tier, request.spoiler);
    return this.episodeChanged(request.titleId, request.season, request.number, client);
  }

  async clearEpisodeRating(request: EpisodeClearRatingRequest, client: Client): Promise<EpisodeClearRatingResponse> {
    if (!(await episodeRepository.getEpisode(request.titleId, request.season, request.number))) {
      fail(TitleError.EPISODE_NOT_FOUND, "This episode does not exist.");
    }

    await episodeRepository.clearRating(request.titleId, request.season, request.number, client.userId);
    await reactionRepository.clearForRating(request.titleId, request.season, request.number, client.userId);
    return this.episodeChanged(request.titleId, request.season, request.number, client);
  }

  // Avisa todo mundo: o episódio mudou e a média de episódios da série também.
  private async episodeChanged(titleId: number, season: number, number: number, client: Client) {
    const episode = (await episodeRepository.getEpisode(titleId, season, number))!;
    const title = await requireTitle(titleId);

    this.broadcastEpisodeUpdated({ titleId, episode }, "all", client);
    this.broadcastUpdated({ title }, "all", client);
    return { episode, title };
  }

  // Adianta o trabalho: deixa no banco as temporadas e a primeira temporada. Se falhar, a abertura refaz.
  private async warmEpisodes(title: Title, token: string): Promise<void> {
    try {
      const seasons = await this.ensureSeasons(title, token);
      if (seasons.length > 0) await this.ensureEpisodes(title, seasons[0].number, token);
    } catch {
      // Nada a fazer: é só adiantar trabalho.
    }
  }

  // Garante no banco a lista de temporadas. Se o TMDB falhar, vale a que já estava guardada.
  private async ensureSeasons(title: Title, token: string): Promise<CachedSeason[]> {
    const cached = await episodeRepository.seasonsOf(title.id);
    const now = Date.now();

    if (cached.length > 0 && cached.every((season) => season.fetchedAt > now - tuning.episodeMaxAgeMs)) return cached;

    try {
      await episodeRepository.saveSeasons(title.id, await tmdbSeasons(title.externalId, token), now);
      return await episodeRepository.seasonsOf(title.id);
    } catch (error) {
      if (error instanceof ProviderError && cached.length > 0) return cached;
      throw error;
    }
  }

  // Duas pessoas abrindo a mesma temporada ao mesmo tempo geram uma consulta só.
  private ensureEpisodes(title: Title, season: number, token: string): Promise<void> {
    const key = `${title.id}:${season}`;
    const running = this.loading.get(key);
    if (running) return running;

    const job = this.loadEpisodes(title, season, token).finally(() => this.loading.delete(key));
    this.loading.set(key, job);
    return job;
  }

  private async loadEpisodes(title: Title, season: number, token: string): Promise<void> {
    const now = Date.now();
    const cached = (await episodeRepository.seasonsOf(title.id)).find((item) => item.number === season);
    const fresh = cached !== undefined && cached.episodesFetchedAt > now - tuning.episodeMaxAgeMs;
    let refreshed = false;

    if (!fresh) {
      try {
        const [english, portuguese] = await Promise.all([
          tmdbSeasonEpisodes(title.externalId, season, "en", token),
          tmdbSeasonEpisodes(title.externalId, season, "pt", token),
        ]);

        const byNumber = new Map<number, EpisodeData>();
        for (const episode of english) {
          byNumber.set(episode.number, {
            number: episode.number,
            nameEn: episode.name,
            namePt: episode.name,
            airDate: episode.airDate,
            tmdbRating: episode.rating,
            tmdbVotes: episode.votes,
          });
        }
        for (const episode of portuguese) {
          const current = byNumber.get(episode.number);
          if (current) current.namePt = episode.name || current.namePt;
          else {
            byNumber.set(episode.number, {
              number: episode.number,
              nameEn: episode.name,
              namePt: episode.name,
              airDate: episode.airDate,
              tmdbRating: episode.rating,
              tmdbVotes: episode.votes,
            });
          }
        }

        await episodeRepository.saveEpisodes(title.id, season, [...byNumber.values()].sort((a, b) => a.number - b.number), now);
        refreshed = true;
      } catch (error) {
        // Se a atualização falhar mas já há episódios guardados, segue com eles.
        const hasEpisodes = (await episodeRepository.imdbState(title.id, season)).count > 0;
        if (!(error instanceof ProviderError) || !hasEpisodes) throw error;
      }
    }

    await this.refreshEpisodeImdb(title, season, refreshed);
  }

  // Busca no OMDb a nota do IMDb de cada episódio da temporada: toda vez que os episódios são atualizados,
  // e de novo mais cedo enquanto algum episódio ainda estiver sem nota.
  private async refreshEpisodeImdb(title: Title, season: number, force: boolean): Promise<void> {
    const key = await getSetting(settingKeys.omdbKey);
    if (!key || title.imdbId === "") return;

    const state = await episodeRepository.imdbState(title.id, season);
    if (state.count === 0) return;

    const now = Date.now();
    const due = state.lastChecked < now - (state.missing ? tuning.imdbRetryMs : tuning.episodeMaxAgeMs);
    if (!force && !due) return;

    const attemptKey = `${title.id}:${season}`;
    const lastAttempt = this.imdbAttempts.get(attemptKey) ?? 0;
    if (!force && lastAttempt > now - tuning.imdbBackoffMs) return;

    try {
      const ratings = await omdbSeasonRatings(title.imdbId, season, key);
      await episodeRepository.saveImdbRatings(title.id, season, ratings, now);
      this.imdbAttempts.delete(attemptKey);
    } catch (error) {
      if (!(error instanceof ProviderError)) return;

      if (error.code === "not_found") {
        // O IMDb não conhece essa temporada: anota a consulta e volta ao TMDB como nota alternativa.
        await episodeRepository.saveImdbRatings(title.id, season, new Map(), now);
      } else {
        if (error.code === "invalid_key") flagKeyProblem("omdb");
        this.imdbAttempts.set(attemptKey, now);
      }
    }
  }

  async getSettings(_request: SettingsGetRequest, client: Client): Promise<SettingsGetResponse> {
    const state = await adminState(client.userId);
    return {
      isAdmin: state.isAdmin,
      canClaim: state.canClaim,
      tmdb: await keyStatus("tmdb"),
      omdb: await keyStatus("omdb"),
      igdb: await keyStatus("igdb"),
      enabledKinds: await enabledKinds(),
    };
  }

  async saveSettings(request: SettingsSaveRequest, client: Client): Promise<SettingsSaveResponse> {
    const state = await adminState(client.userId);
    if (!state.isAdmin && !state.canClaim) fail(TitleError.NOT_ADMIN, "Only admins can change these settings.");

    let savedAny = false;
    let omdbSaved = false;
    let tmdb = await keyStatus("tmdb");
    let omdb = await keyStatus("omdb");
    let igdb = await keyStatus("igdb");
    let enabled = await enabledKinds();

    // Categorias opcionais: a lista enviada substitui a anterior (vazia desliga todas).
    if (request.enabledKinds !== undefined) {
      const wanted = request.enabledKinds.kinds.filter((kind) => optionalKinds.includes(kind));
      await setSetting(settingKeys.enabledKinds, wanted.join(","));
      enabled = await enabledKinds();
      savedAny = true;
    }

    // O IGDB usa um par de chaves: os dois campos vão juntos.
    if (request.igdbClientId !== undefined || request.igdbClientSecret !== undefined) {
      if (request.igdbClientId === undefined || request.igdbClientSecret === undefined) {
        fail(TitleError.INVALID_KEY_FORMAT, "The Client ID and the Client Secret must be sent together.");
      }
      const result = await this.applyIgdb(request.igdbClientId, request.igdbClientSecret);
      igdb = result.status;
      savedAny = savedAny || result.saved;
    }

    if (request.tmdbToken !== undefined) {
      const result = await this.applyKey("tmdb", settingKeys.tmdbToken, request.tmdbToken, tmdbCheck);
      tmdb = result.status;
      savedAny = savedAny || result.saved;
    }

    if (request.omdbKey !== undefined) {
      const result = await this.applyKey("omdb", settingKeys.omdbKey, request.omdbKey, omdbCheck);
      omdb = result.status;
      savedAny = savedAny || result.saved;
      omdbSaved = result.saved;
    }

    // Sem admin escolhido na instalação, quem salva a primeira chave vira o admin.
    if (state.canClaim && savedAny) await claimAdmin(client.userId);

    this.broadcastSettingsChanged({ tmdb, omdb, igdb, enabledKinds: enabled }, "all");
    if (omdbSaved) void this.refreshImdbRatings();

    const after = await adminState(client.userId);
    return { tmdb, omdb, igdb, isAdmin: after.isAdmin, enabledKinds: enabled };
  }

  // Confere o par Client ID e Client Secret na Twitch antes de guardar. Os dois vazios apagam as chaves.
  private async applyIgdb(rawId: string, rawSecret: string): Promise<{ status: KeyStatus; saved: boolean }> {
    const clientId = rawId.trim();
    const clientSecret = rawSecret.trim();

    if (clientId === "" && clientSecret === "") {
      await deleteSetting(settingKeys.igdbClientId);
      await deleteSetting(settingKeys.igdbClientSecret);
      keyProblems.igdb = false;
      forgetIgdbTokens();
      return { status: KeyStatus.UNSPECIFIED, saved: false };
    }

    if (!keyFormats.igdbId.test(clientId) || !keyFormats.igdbSecret.test(clientSecret)) {
      fail(TitleError.INVALID_KEY_FORMAT, "That does not look like a valid Client ID and Client Secret.");
    }

    let status = KeyStatus.CONFIGURED;
    try {
      await igdbCheck({ clientId, clientSecret });
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      if (error.code === "invalid_key") return { status: KeyStatus.INVALID, saved: false };
      // Sem como conferir agora: guarda e avisa. Limite estourado ou outra resposta: a chave foi reconhecida.
      if (error.code === "unavailable") status = KeyStatus.UNREACHABLE;
    }

    await setSetting(settingKeys.igdbClientId, clientId);
    await setSetting(settingKeys.igdbClientSecret, clientSecret);
    keyProblems.igdb = false;
    return { status, saved: true };
  }

  // Confere a chave no serviço antes de guardar. Texto vazio apaga a chave.
  private async applyKey(
    name: "tmdb" | "omdb",
    settingKey: string,
    raw: string,
    check: (value: string) => Promise<void>,
  ): Promise<{ status: KeyStatus; saved: boolean }> {
    const value = raw.trim();

    if (value === "") {
      await deleteSetting(settingKey);
      keyProblems[name] = false;
      return { status: KeyStatus.UNSPECIFIED, saved: false };
    }

    if (!keyFormats[name].test(value)) fail(TitleError.INVALID_KEY_FORMAT, "That does not look like a valid key.");

    try {
      await check(value);
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      if (error.code === "invalid_key") return { status: KeyStatus.INVALID, saved: false };

      if (error.code === "unavailable") {
        // Sem como conferir agora (sem internet ou serviço fora do ar): guarda e avisa.
        await setSetting(settingKey, value);
        keyProblems[name] = false;
        return { status: KeyStatus.UNREACHABLE, saved: true };
      }
      // Limite do dia estourado ou outra resposta: a chave foi reconhecida, então vale.
    }

    await setSetting(settingKey, value);
    keyProblems[name] = false;
    return { status: KeyStatus.CONFIGURED, saved: true };
  }

  // Títulos de antes da 1.2 não têm sinopse nem gêneros: busca de uma fonte já configurada, poucos por vez.
  // Roda em segundo plano e nunca derruba o servidor.
  private async fillMissingDetails(): Promise<void> {
    if (this.fillingDetails) return;
    this.fillingDetails = true;

    try {
      const tmdbToken = await getSetting(settingKeys.tmdbToken);
      const igdb = await igdbCredentials();

      const kinds: TitleKind[] = [];
      if (tmdbToken) kinds.push(TitleKind.MOVIE, TitleKind.SERIES);
      if (igdb) kinds.push(TitleKind.GAME);

      for (const item of await titleRepository.listMissingDetails(detailsBatchSize, kinds)) {
        try {
          let details: TitleDetails;

          if (item.kind === TitleKind.GAME) {
            const game = await igdbDetails(item.externalId, igdb!);
            details = { overviewPt: "", overviewEn: game.summary, genresPt: "", genresEn: game.genres, platforms: game.platforms };
          } else {
            const kind = tmdbKindOf(item.kind)!;
            const [english, portuguese] = await Promise.all([
              tmdbDetails(kind, item.externalId, "en", tmdbToken!),
              tmdbDetails(kind, item.externalId, "pt", tmdbToken!),
            ]);
            details = { overviewPt: portuguese.overview, overviewEn: english.overview, genresPt: portuguese.genres, genresEn: english.genres, platforms: "" };
          }

          await titleRepository.updateDetails(item.id, details, Date.now());
          const title = await titleRepository.get(item.id);
          if (title) this.broadcastUpdated({ title }, "all");
        } catch (error) {
          if (!(error instanceof ProviderError)) break;

          if (error.code === "invalid_key") {
            flagKeyProblem(item.kind === TitleKind.GAME ? "igdb" : "tmdb");
            break;
          }
          if (error.code === "rate_limited" || error.code === "unavailable") break;

          // A fonte não conhece mais esse título: não tenta de novo.
          await titleRepository.markDetailsChecked(item.id, Date.now());
        }

        if (tuning.pauseMs > 0) await sleep(tuning.pauseMs);
      }
    } catch {
      // Falha de banco ou de rede aqui não pode afetar quem está usando o app.
    } finally {
      this.fillingDetails = false;
    }
  }

  // Busca a nota do IMDb dos títulos que ainda não têm ou que estão velhos. Roda em segundo plano
  // e nunca derruba o servidor.
  private async refreshImdbRatings(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;

    try {
      const key = await getSetting(settingKeys.omdbKey);
      if (!key) return;

      const stale = await titleRepository.listStaleImdb(Date.now() - imdbMaxAgeMs, imdbBatchSize);

      for (const item of stale) {
        try {
          const rating = await omdbRating(item.imdbId, key);
          await titleRepository.updateImdb(item.id, rating?.rating ?? 0, rating?.votes ?? 0, Date.now());

          const title = await titleRepository.get(item.id);
          if (title) this.broadcastUpdated({ title }, "all");
        } catch (error) {
          if (!(error instanceof ProviderError)) break;

          if (error.code === "invalid_key") {
            flagKeyProblem("omdb");
            break;
          }
          if (error.code === "rate_limited" || error.code === "unavailable") break;

          // O IMDb não conhece esse ID: não tenta de novo por uma semana.
          await titleRepository.markImdbChecked(item.id, Date.now());
        }

        if (tuning.pauseMs > 0) await sleep(tuning.pauseMs);
      }
    } catch {
      // Falha de banco ou de rede aqui não pode afetar quem está usando o app.
    } finally {
      this.refreshing = false;
    }
  }
}

export const titleService = new TitleService();
