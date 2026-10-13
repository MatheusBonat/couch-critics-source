import type { Knex } from "knex";
import { Rating, RatingTier, Reaction, Title, TitleKind, WatchEntry } from "@notas-app/gen-shared";
import { ensureColumn, knex } from "./db";
import { deleteEpisodesOf, episodeSummaries, initializeEpisodes } from "./episodeRepository";
import { initializeReactions, reactionRepository } from "./reactionRepository";
import { initializeWatch, watchRepository } from "./watchRepository";

interface TitleRow {
  id: number;
  kind: number;
  name: string;
  name_key: string;
  year: number;
  created_by: string;
  source: string;
  external_id: string;
  name_pt: string;
  name_en: string;
  poster_pt: string;
  poster_en: string;
  imdb_id: string;
  imdb_rating: number;
  imdb_votes: number;
  imdb_checked_at: number;
  overview_pt: string;
  overview_en: string;
  genres_pt: string;
  genres_en: string;
  platforms: string;
  details_checked_at: number;
  creator: string;
}

interface RatingRow {
  title_id: number;
  user_id: string;
  score: number;
  comment: string;
  tier: number;
  rated_at: number;
  spoiler: number;
}

const titlesTable = "titles";
const ratingsTable = "ratings";

// "Amélie" e "amelie" devem contar como o mesmo título.
export function toNameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function toRating(row: RatingRow, reactions: Reaction[] = []): Rating {
  return {
    userId: row.user_id,
    score: row.score,
    comment: row.comment,
    tier: row.tier as RatingTier,
    ratedAt: row.rated_at ?? 0,
    spoiler: row.spoiler === 1,
    reactions,
  };
}

function toTitle(
  row: TitleRow,
  ratings: RatingRow[],
  episodes?: { avg: number; rated: number },
  reactions?: Map<string, Reaction[]>,
  statuses: WatchEntry[] = [],
): Title {
  return {
    id: row.id,
    kind: row.kind as TitleKind,
    name: row.name,
    year: row.year,
    createdBy: row.created_by,
    ratings: ratings.map((rating) => toRating(rating, reactions?.get(`${row.id}:${rating.user_id}`))),
    namePt: row.name_pt,
    nameEn: row.name_en,
    posterPt: row.poster_pt,
    posterEn: row.poster_en,
    imdbId: row.imdb_id,
    imdbRating: row.imdb_rating,
    imdbVotes: row.imdb_votes,
    source: row.source,
    externalId: row.external_id,
    episodesAvg: episodes?.avg ?? 0,
    episodesRated: episodes?.rated ?? 0,
    overviewPt: row.overview_pt ?? "",
    overviewEn: row.overview_en ?? "",
    genresPt: row.genres_pt ?? "",
    genresEn: row.genres_en ?? "",
    platforms: row.platforms ?? "",
    statuses,
    creator: row.creator ?? "",
  };
}

export interface SourceTitle {
  kind: TitleKind;
  externalId: string;
  name: string;
  namePt: string;
  nameEn: string;
  year: number;
  posterPt: string;
  posterEn: string;
  imdbId: string;
  // De onde veio o título: "tmdb" (filmes e séries), "igdb" (jogos), "openlibrary" (livros), "anilist" (animes) ou "musicbrainz" (músicas).
  source: "tmdb" | "igdb" | "openlibrary" | "anilist" | "musicbrainz";
  // Autor (livros) ou artista (músicas).
  creator?: string;
  details?: TitleDetails;
}

// Sinopse, gêneros e plataformas (o IGDB só tem em inglês).
export interface TitleDetails {
  overviewPt: string;
  overviewEn: string;
  genresPt: string;
  genresEn: string;
  platforms: string;
}

export class TitleRepository {
  public async list(): Promise<Title[]> {
    const titleRows = await knex<TitleRow>(titlesTable).select().orderBy("id", "desc");
    const ratingRows = await knex<RatingRow>(ratingsTable).select();

    const ratingsByTitle = new Map<number, RatingRow[]>();
    for (const row of ratingRows) {
      const list = ratingsByTitle.get(row.title_id) ?? [];
      list.push(row);
      ratingsByTitle.set(row.title_id, list);
    }

    const episodes = await episodeSummaries();
    const reactions = await reactionRepository.forTitles();
    const statuses = await watchRepository.forTitles();
    return titleRows.map((row) => toTitle(row, ratingsByTitle.get(row.id) ?? [], episodes.get(row.id), reactions, statuses.get(row.id)));
  }

  // Uma página da lista, do título mais novo para o mais antigo. beforeId = 0 começa pelo mais novo; senão vem só o
  // que tem ID menor que beforeId. O Root limita cada mensagem a 256 KiB, então a lista não pode ir toda de uma vez.
  public async listPage(beforeId: number, limit: number): Promise<Title[]> {
    const query = knex<TitleRow>(titlesTable).select().orderBy("id", "desc").limit(limit);
    if (beforeId > 0) query.where("id", "<", beforeId);
    const titleRows = await query;
    if (titleRows.length === 0) return [];

    const ids = titleRows.map((row) => row.id);
    const ratingRows = await knex<RatingRow>(ratingsTable).whereIn("title_id", ids).select();

    const ratingsByTitle = new Map<number, RatingRow[]>();
    for (const row of ratingRows) {
      const list = ratingsByTitle.get(row.title_id) ?? [];
      list.push(row);
      ratingsByTitle.set(row.title_id, list);
    }

    const episodes = await episodeSummaries(ids);
    const reactions = await reactionRepository.forTitles(ids);
    const statuses = await watchRepository.forTitles(ids);
    return titleRows.map((row) => toTitle(row, ratingsByTitle.get(row.id) ?? [], episodes.get(row.id), reactions, statuses.get(row.id)));
  }

  public async get(id: number): Promise<Title | null> {
    const row = await knex<TitleRow>(titlesTable).where({ id }).first();
    if (!row) return null;

    const ratingRows = await knex<RatingRow>(ratingsTable).where({ title_id: id });
    const episodes = await episodeSummaries([id]);
    const reactions = await reactionRepository.forTitles([id]);
    const statuses = await watchRepository.forTitles([id]);
    return toTitle(row, ratingRows, episodes.get(id), reactions, statuses.get(id));
  }

  public async findByExternal(kind: TitleKind, externalId: string): Promise<Title | null> {
    const row = await knex<TitleRow>(titlesTable).where({ kind, external_id: externalId }).first();
    return row ? this.get(row.id) : null;
  }

  // Quais dos IDs da fonte (TMDB ou IGDB) a comunidade já tem: ID da fonte -> ID do título.
  public async existingIdsByExternal(kind: TitleKind, externalIds: string[]): Promise<Map<string, number>> {
    const found = new Map<string, number>();
    if (externalIds.length === 0) return found;

    const rows = await knex<TitleRow>(titlesTable).where({ kind }).whereIn("external_id", externalIds).select("id", "external_id");
    for (const row of rows) found.set(row.external_id, row.id);
    return found;
  }

  // Vale para qualquer nome do título (principal, português ou inglês). Anos diferentes (e conhecidos) não contam.
  public async hasSameName(kind: TitleKind, name: string, year: number, exceptId = 0): Promise<boolean> {
    const key = toNameKey(name);
    const rows = await knex<TitleRow>(titlesTable).where({ kind });

    return rows.some((row) => {
      if (row.id === exceptId) return false;
      const sameName = [row.name, row.name_pt, row.name_en].some((candidate) => candidate !== "" && toNameKey(candidate) === key);
      const differentYear = year !== 0 && row.year !== 0 && row.year !== year;
      return sameName && !differentYear;
    });
  }

  // Devolve null quando já existe um título com o mesmo nome na mesma categoria.
  public async create(kind: TitleKind, name: string, year: number, userId: string): Promise<Title | null> {
    if (await this.hasSameName(kind, name, year)) return null;

    const [id] = await knex<TitleRow>(titlesTable).insert({
      kind,
      name,
      name_key: toNameKey(name),
      year,
      created_by: userId,
    });

    return (await this.get(id))!;
  }

  // Devolve null quando a comunidade já tem esse título da fonte.
  public async createFromSource(source: SourceTitle, userId: string): Promise<Title | null> {
    if (await this.findByExternal(source.kind, source.externalId)) return null;

    try {
      const [id] = await knex<TitleRow>(titlesTable).insert({
        kind: source.kind,
        name: source.name,
        name_key: toNameKey(source.name),
        year: source.year,
        created_by: userId,
        source: source.source,
        creator: source.creator ?? "",
        external_id: source.externalId,
        name_pt: source.namePt,
        name_en: source.nameEn,
        poster_pt: source.posterPt,
        poster_en: source.posterEn,
        imdb_id: source.imdbId,
        ...(source.details
          ? {
              overview_pt: source.details.overviewPt,
              overview_en: source.details.overviewEn,
              genres_pt: source.details.genresPt,
              genres_en: source.details.genresEn,
              platforms: source.details.platforms,
              details_checked_at: Date.now(),
            }
          : {}),
      });
      return (await this.get(id))!;
    } catch (error) {
      // Duas pessoas adicionando o mesmo título ao mesmo tempo: o índice único segura a segunda.
      if (String((error as Error)?.message).includes("UNIQUE")) return null;
      throw error;
    }
  }

  public async delete(id: number): Promise<void> {
    await knex.transaction(async (trx) => {
      await trx(ratingsTable).where({ title_id: id }).del();
      await deleteEpisodesOf(trx, id);
      await reactionRepository.clearForTitle(trx, id);
      await watchRepository.clearForTitle(trx, id);
      await trx(titlesTable).where({ id }).del();
    });
  }

  public async setRating(
    titleId: number,
    userId: string,
    score: number,
    comment: string,
    tier: RatingTier,
    spoiler = false,
  ): Promise<void> {
    await knex<RatingRow>(ratingsTable)
      .insert({ title_id: titleId, user_id: userId, score, comment, tier, rated_at: Date.now(), spoiler: spoiler && comment !== "" ? 1 : 0 })
      .onConflict(["title_id", "user_id"])
      .merge();
  }

  public async clearRating(titleId: number, userId: string): Promise<void> {
    await knex<RatingRow>(ratingsTable).where({ title_id: titleId, user_id: userId }).del();
  }

  // Só o nome e o ano: o resto do título não muda.
  public async update(id: number, name: string, year: number): Promise<void> {
    await knex<TitleRow>(titlesTable).where({ id }).update({ name, name_key: toNameKey(name), year });
  }

  // Apaga só o texto do comentário (e o spoiler); a nota fica.
  public async removeComment(titleId: number, userId: string): Promise<void> {
    await knex<RatingRow>(ratingsTable).where({ title_id: titleId, user_id: userId }).update({ comment: "", spoiler: 0 });
  }

  public async updateDetails(id: number, details: TitleDetails, checkedAt: number): Promise<void> {
    await knex<TitleRow>(titlesTable).where({ id }).update({
      overview_pt: details.overviewPt,
      overview_en: details.overviewEn,
      genres_pt: details.genresPt,
      genres_en: details.genresEn,
      platforms: details.platforms,
      details_checked_at: checkedAt,
    });
  }

  public async markDetailsChecked(id: number, checkedAt: number): Promise<void> {
    await knex<TitleRow>(titlesTable).where({ id }).update({ details_checked_at: checkedAt });
  }

  // Títulos de fonte (TMDB ou IGDB) cujos detalhes ainda nunca foram buscados: os de antes da versão 1.2.
  public async listMissingDetails(limit: number, kinds: TitleKind[]): Promise<{ id: number; kind: TitleKind; externalId: string }[]> {
    if (kinds.length === 0) return [];
    const rows = await knex<TitleRow>(titlesTable)
      .whereIn("source", ["tmdb", "igdb"])
      .whereIn("kind", kinds)
      .andWhere("details_checked_at", 0)
      .orderBy("id", "desc")
      .limit(limit)
      .select("id", "kind", "external_id");
    return rows.map((row) => ({ id: row.id, kind: row.kind as TitleKind, externalId: row.external_id }));
  }

  public async updateImdb(id: number, rating: number, votes: number, checkedAt: number): Promise<void> {
    await knex<TitleRow>(titlesTable).where({ id }).update({ imdb_rating: rating, imdb_votes: votes, imdb_checked_at: checkedAt });
  }

  public async markImdbChecked(id: number, checkedAt: number): Promise<void> {
    await knex<TitleRow>(titlesTable).where({ id }).update({ imdb_checked_at: checkedAt });
  }

  // Títulos com ID do IMDb cuja nota nunca foi buscada ou está velha.
  public async listStaleImdb(olderThan: number, limit: number): Promise<{ id: number; imdbId: string }[]> {
    const rows = await knex<TitleRow>(titlesTable)
      .where("imdb_id", "<>", "")
      .andWhere("imdb_checked_at", "<", olderThan)
      .orderBy("imdb_checked_at", "asc")
      .limit(limit)
      .select("id", "imdb_id");
    return rows.map((row) => ({ id: row.id, imdbId: row.imdb_id }));
  }
}

async function createTitlesTable(db: Knex | Knex.Transaction): Promise<void> {
  await db.schema.createTable(titlesTable, (table) => {
    table.increments("id").primary();
    table.integer("kind").notNullable();
    table.text("name").notNullable();
    table.text("name_key").notNullable();
    table.integer("year").notNullable().defaultTo(0);
    table.text("created_by").notNullable();
    table.text("source").notNullable().defaultTo("manual");
    table.text("external_id").notNullable().defaultTo("");
    table.text("name_pt").notNullable().defaultTo("");
    table.text("name_en").notNullable().defaultTo("");
    table.text("poster_pt").notNullable().defaultTo("");
    table.text("poster_en").notNullable().defaultTo("");
    table.text("imdb_id").notNullable().defaultTo("");
    table.double("imdb_rating").notNullable().defaultTo(0);
    table.integer("imdb_votes").notNullable().defaultTo(0);
    table.bigInteger("imdb_checked_at").notNullable().defaultTo(0);
    table.text("overview_pt").notNullable().defaultTo("");
    table.text("overview_en").notNullable().defaultTo("");
    table.text("genres_pt").notNullable().defaultTo("");
    table.text("genres_en").notNullable().defaultTo("");
    table.text("platforms").notNullable().defaultTo("");
    table.bigInteger("details_checked_at").notNullable().defaultTo(0);
    table.text("creator").notNullable().defaultTo("");
  });
}

export async function initializeDatabase(): Promise<void> {
  const hasTitles = await knex.schema.hasTable(titlesTable);

  if (!hasTitles) {
    await createTitlesTable(knex);
  } else if (!(await knex.schema.hasColumn(titlesTable, "source"))) {
    // Banco da versão anterior: refaz a tabela com as colunas novas e a regra de nome única
    // passa a ser conferida no código (títulos de anos diferentes podem ter o mesmo nome).
    await knex.transaction(async (trx) => {
      await trx.raw(`alter table ${titlesTable} rename to titles_v1`);
      await createTitlesTable(trx);
      await trx.raw(
        `insert into ${titlesTable} (id, kind, name, name_key, year, created_by) select id, kind, name, name_key, year, created_by from titles_v1`,
      );
      await trx.raw("drop table titles_v1");
    });
  }

  // Dois títulos da mesma fonte (mesmo ID no TMDB ou no IGDB) não podem coexistir na comunidade.
  await knex.raw(`create unique index if not exists titles_kind_external on ${titlesTable}(kind, external_id) where external_id <> ''`);

  if (!(await knex.schema.hasTable(ratingsTable))) {
    await knex.schema.createTable(ratingsTable, (table) => {
      table.integer("title_id").notNullable();
      table.text("user_id").notNullable();
      table.double("score").notNullable();
      table.text("comment").notNullable().defaultTo("");
      table.integer("tier").notNullable().defaultTo(0);
      table.bigInteger("rated_at").notNullable().defaultTo(0);
      table.integer("spoiler").notNullable().defaultTo(0);
      table.primary(["title_id", "user_id"]);
    });
  } else if (!(await knex.schema.hasColumn(ratingsTable, "tier"))) {
    // Bancos criados antes das notas especiais (Peak e Rock Bottom) ganham a coluna nova.
    await knex.schema.alterTable(ratingsTable, (table) => {
      table.integer("tier").notNullable().defaultTo(0);
    });
  }

  // Bancos da 1.1 (ou anteriores) ganham as colunas da 1.2: data e spoiler das notas, sinopse e gêneros dos títulos.
  await ensureColumn(ratingsTable, "rated_at", (table) => table.bigInteger("rated_at").notNullable().defaultTo(0));
  await ensureColumn(ratingsTable, "spoiler", (table) => table.integer("spoiler").notNullable().defaultTo(0));
  for (const column of ["overview_pt", "overview_en", "genres_pt", "genres_en", "platforms"]) {
    await ensureColumn(titlesTable, column, (table) => table.text(column).notNullable().defaultTo(""));
  }
  await ensureColumn(titlesTable, "details_checked_at", (table) => table.bigInteger("details_checked_at").notNullable().defaultTo(0));
  await ensureColumn(titlesTable, "creator", (table) => table.text("creator").notNullable().defaultTo(""));

  await initializeEpisodes();
  await initializeReactions();
  await initializeWatch();
}

export const titleRepository = new TitleRepository();
