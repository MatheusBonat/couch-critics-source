import type { Knex } from "knex";
import { Episode, Rating, RatingTier, Reaction } from "@notas-app/gen-shared";
import { ensureColumn, knex } from "./db";
import { reactionRepository } from "./reactionRepository";

interface SeasonRow {
  title_id: number;
  season: number;
  episode_count: number;
  fetched_at: number;
  episodes_fetched_at: number;
}

interface EpisodeRow {
  title_id: number;
  season: number;
  number: number;
  name_en: string;
  name_pt: string;
  air_date: string;
  imdb_rating: number;
  tmdb_rating: number;
  tmdb_votes: number;
  imdb_checked_at: number;
}

interface EpisodeRatingRow {
  title_id: number;
  season: number;
  number: number;
  user_id: string;
  score: number;
  comment: string;
  tier: number;
  rated_at: number;
  spoiler: number;
}

const seasonsTable = "seasons";
const episodesTable = "episodes";
const episodeRatingsTable = "episode_ratings";

export interface CachedSeason {
  number: number;
  episodeCount: number;
  fetchedAt: number;
  episodesFetchedAt: number;
}

export interface EpisodeData {
  number: number;
  namePt: string;
  nameEn: string;
  airDate: string;
  tmdbRating: number;
  tmdbVotes: number;
}

function toRating(row: EpisodeRatingRow, reactions: Reaction[] = []): Rating {
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

function toEpisode(row: EpisodeRow, ratings: EpisodeRatingRow[], reactions?: Map<string, Reaction[]>): Episode {
  return {
    season: row.season,
    number: row.number,
    namePt: row.name_pt,
    nameEn: row.name_en,
    airDate: row.air_date,
    imdbRating: row.imdb_rating,
    tmdbRating: row.tmdb_rating,
    tmdbVotes: row.tmdb_votes,
    ratings: ratings.map((rating) => toRating(rating, reactions?.get(`${row.number}:${rating.user_id}`))),
  };
}

export class EpisodeRepository {
  public async seasonsOf(titleId: number): Promise<CachedSeason[]> {
    const rows = await knex<SeasonRow>(seasonsTable).where({ title_id: titleId }).orderBy("season", "asc");
    return rows.map((row) => ({
      number: row.season,
      episodeCount: row.episode_count,
      fetchedAt: row.fetched_at,
      episodesFetchedAt: row.episodes_fetched_at,
    }));
  }

  // Guarda a lista de temporadas sem apagar o que já se sabe dos episódios de cada uma.
  public async saveSeasons(titleId: number, seasons: { number: number; episodeCount: number }[], now: number): Promise<void> {
    for (const season of seasons) {
      await knex<SeasonRow>(seasonsTable)
        .insert({ title_id: titleId, season: season.number, episode_count: season.episodeCount, fetched_at: now, episodes_fetched_at: 0 })
        .onConflict(["title_id", "season"])
        .merge(["episode_count", "fetched_at"]);
    }
  }

  // Atualiza nomes, datas e notas do TMDB. As notas dos membros e a nota do IMDb não são mexidas.
  public async saveEpisodes(titleId: number, season: number, episodes: EpisodeData[], now: number): Promise<void> {
    await knex.transaction(async (trx) => {
      for (const episode of episodes) {
        await trx<EpisodeRow>(episodesTable)
          .insert({
            title_id: titleId,
            season,
            number: episode.number,
            name_en: episode.nameEn,
            name_pt: episode.namePt,
            air_date: episode.airDate,
            tmdb_rating: episode.tmdbRating,
            tmdb_votes: episode.tmdbVotes,
          })
          .onConflict(["title_id", "season", "number"])
          .merge(["name_en", "name_pt", "air_date", "tmdb_rating", "tmdb_votes"]);
      }

      await trx<SeasonRow>(seasonsTable)
        .insert({ title_id: titleId, season, episode_count: episodes.length, fetched_at: now, episodes_fetched_at: now })
        .onConflict(["title_id", "season"])
        .merge(["episodes_fetched_at"]);
    });
  }

  // Grava a nota do IMDb de cada episódio da temporada (0 quando o IMDb não tem) e anota quando foi a consulta.
  public async saveImdbRatings(titleId: number, season: number, ratings: Map<number, number>, now: number): Promise<void> {
    const rows = await knex<EpisodeRow>(episodesTable).where({ title_id: titleId, season }).select("number");

    await knex.transaction(async (trx) => {
      for (const row of rows) {
        await trx<EpisodeRow>(episodesTable)
          .where({ title_id: titleId, season, number: row.number })
          .update({ imdb_rating: ratings.get(row.number) ?? 0, imdb_checked_at: now });
      }
    });
  }

  // Quando a nota do IMDb da temporada foi consultada pela última vez e se ainda falta nota em algum episódio.
  public async imdbState(titleId: number, season: number): Promise<{ count: number; lastChecked: number; missing: boolean }> {
    const rows = await knex<EpisodeRow>(episodesTable).where({ title_id: titleId, season }).select("imdb_rating", "imdb_checked_at");
    return {
      count: rows.length,
      lastChecked: rows.reduce((latest, row) => Math.max(latest, row.imdb_checked_at), 0),
      missing: rows.some((row) => row.imdb_rating <= 0),
    };
  }

  public async listEpisodes(titleId: number, season: number): Promise<Episode[]> {
    const rows = await knex<EpisodeRow>(episodesTable).where({ title_id: titleId, season }).orderBy("number", "asc");
    const ratings = await knex<EpisodeRatingRow>(episodeRatingsTable).where({ title_id: titleId, season });
    const reactions = await reactionRepository.forEpisodes(titleId, season);

    return rows.map((row) => toEpisode(row, ratings.filter((rating) => rating.number === row.number), reactions));
  }

  public async getEpisode(titleId: number, season: number, number: number): Promise<Episode | null> {
    const row = await knex<EpisodeRow>(episodesTable).where({ title_id: titleId, season, number }).first();
    if (!row) return null;

    const ratings = await knex<EpisodeRatingRow>(episodeRatingsTable).where({ title_id: titleId, season, number });
    const reactions = await reactionRepository.forEpisodes(titleId, season);
    return toEpisode(row, ratings, reactions);
  }

  public async setRating(
    titleId: number,
    season: number,
    number: number,
    userId: string,
    score: number,
    comment: string,
    tier: RatingTier,
    spoiler = false,
  ): Promise<void> {
    await knex<EpisodeRatingRow>(episodeRatingsTable)
      .insert({ title_id: titleId, season, number, user_id: userId, score, comment, tier, rated_at: Date.now(), spoiler: spoiler && comment !== "" ? 1 : 0 })
      .onConflict(["title_id", "season", "number", "user_id"])
      .merge();
  }

  // Apaga só o texto do comentário (e o spoiler); a nota fica.
  public async removeComment(titleId: number, season: number, number: number, userId: string): Promise<void> {
    await knex<EpisodeRatingRow>(episodeRatingsTable).where({ title_id: titleId, season, number, user_id: userId }).update({ comment: "", spoiler: 0 });
  }

  public async clearRating(titleId: number, season: number, number: number, userId: string): Promise<void> {
    await knex<EpisodeRatingRow>(episodeRatingsTable).where({ title_id: titleId, season, number, user_id: userId }).del();
  }
}

// Média das notas por episódio: a média das médias de cada episódio avaliado, para um episódio
// com muitas notas não pesar mais que os outros. Devolve, por título, a média e quantos episódios têm nota.
export async function episodeSummaries(titleIds?: number[]): Promise<Map<number, { avg: number; rated: number }>> {
  const where = titleIds && titleIds.length > 0 ? `where title_id in (${titleIds.map((id) => Number(id)).join(",")})` : "";

  const rows = (await knex.raw(
    `select title_id, count(*) as rated, avg(a) as avg
       from (select title_id, season, number, avg(score) as a from ${episodeRatingsTable} ${where} group by title_id, season, number)
      group by title_id`,
  )) as { title_id: number; rated: number; avg: number }[];

  return new Map(rows.map((row) => [row.title_id, { avg: row.avg, rated: row.rated }]));
}

// Usada ao remover um título: leva junto temporadas, episódios e notas de episódios.
export async function deleteEpisodesOf(trx: Knex.Transaction, titleId: number): Promise<void> {
  await trx(episodeRatingsTable).where({ title_id: titleId }).del();
  await trx(episodesTable).where({ title_id: titleId }).del();
  await trx(seasonsTable).where({ title_id: titleId }).del();
}

export async function initializeEpisodes(): Promise<void> {
  if (!(await knex.schema.hasTable(seasonsTable))) {
    await knex.schema.createTable(seasonsTable, (table) => {
      table.integer("title_id").notNullable();
      table.integer("season").notNullable();
      table.integer("episode_count").notNullable().defaultTo(0);
      table.bigInteger("fetched_at").notNullable().defaultTo(0);
      table.bigInteger("episodes_fetched_at").notNullable().defaultTo(0);
      table.primary(["title_id", "season"]);
    });
  }

  if (!(await knex.schema.hasTable(episodesTable))) {
    await knex.schema.createTable(episodesTable, (table) => {
      table.integer("title_id").notNullable();
      table.integer("season").notNullable();
      table.integer("number").notNullable();
      table.text("name_en").notNullable().defaultTo("");
      table.text("name_pt").notNullable().defaultTo("");
      table.text("air_date").notNullable().defaultTo("");
      table.double("imdb_rating").notNullable().defaultTo(0);
      table.double("tmdb_rating").notNullable().defaultTo(0);
      table.integer("tmdb_votes").notNullable().defaultTo(0);
      table.bigInteger("imdb_checked_at").notNullable().defaultTo(0);
      table.primary(["title_id", "season", "number"]);
    });
  }

  if (!(await knex.schema.hasTable(episodeRatingsTable))) {
    await knex.schema.createTable(episodeRatingsTable, (table) => {
      table.integer("title_id").notNullable();
      table.integer("season").notNullable();
      table.integer("number").notNullable();
      table.text("user_id").notNullable();
      table.double("score").notNullable();
      table.text("comment").notNullable().defaultTo("");
      table.integer("tier").notNullable().defaultTo(0);
      table.bigInteger("rated_at").notNullable().defaultTo(0);
      table.integer("spoiler").notNullable().defaultTo(0);
      table.primary(["title_id", "season", "number", "user_id"]);
    });
  }

  await ensureColumn(episodeRatingsTable, "rated_at", (table) => table.bigInteger("rated_at").notNullable().defaultTo(0));
  await ensureColumn(episodeRatingsTable, "spoiler", (table) => table.integer("spoiler").notNullable().defaultTo(0));
}

export const episodeRepository = new EpisodeRepository();
