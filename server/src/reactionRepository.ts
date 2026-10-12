import type { Knex } from "knex";
import { Reaction } from "@notas-app/gen-shared";
import { knex } from "./db";

interface ReactionRow {
  title_id: number;
  season: number;
  number: number;
  rating_user_id: string;
  user_id: string;
  emoji: string;
  created_at: number;
}

const reactionsTable = "reactions";

// Os emojis que dá para usar numa nota. A tela tem a mesma lista (client/src/lib.ts).
export const reactionEmojis: readonly string[] = ["👍", "😂", "🔥", "😮", "❤️"];

// Junta as linhas por emoji, na ordem em que cada emoji apareceu pela primeira vez.
function group(rows: ReactionRow[]): Reaction[] {
  const byEmoji = new Map<string, string[]>();
  for (const row of [...rows].sort((a, b) => a.created_at - b.created_at)) {
    const users = byEmoji.get(row.emoji) ?? [];
    users.push(row.user_id);
    byEmoji.set(row.emoji, users);
  }
  return [...byEmoji].map(([emoji, userIds]) => ({ emoji, userIds }));
}

// Reações às notas. Uma nota de título tem season 0 e number 0; a de um episódio guarda a temporada e o número.
export class ReactionRepository {
  // Liga a reação, ou desliga se já estava ligada. Devolve true quando ela ficou ligada.
  public async toggle(titleId: number, season: number, number: number, ratingUserId: string, userId: string, emoji: string): Promise<boolean> {
    const key = { title_id: titleId, season, number, rating_user_id: ratingUserId, user_id: userId, emoji };

    const removed = await knex<ReactionRow>(reactionsTable).where(key).del();
    if (removed > 0) return false;

    try {
      await knex<ReactionRow>(reactionsTable).insert({ ...key, created_at: Date.now() });
    } catch (error) {
      // Dois cliques ao mesmo tempo: a outra chamada já ligou a reação.
      if (!String((error as Error)?.message).includes("UNIQUE")) throw error;
    }
    return true;
  }

  // Reações das notas de título: "idDoTitulo:idDeQuemDeuANota" -> reações.
  public async forTitles(titleIds?: number[]): Promise<Map<string, Reaction[]>> {
    const query = knex<ReactionRow>(reactionsTable).where({ season: 0, number: 0 });
    if (titleIds) query.whereIn("title_id", titleIds);

    const rows = await query;
    const byRating = new Map<string, ReactionRow[]>();
    for (const row of rows) {
      const key = `${row.title_id}:${row.rating_user_id}`;
      byRating.set(key, [...(byRating.get(key) ?? []), row]);
    }
    return new Map([...byRating].map(([key, list]) => [key, group(list)]));
  }

  // Reações das notas de uma temporada: "numeroDoEpisodio:idDeQuemDeuANota" -> reações.
  public async forEpisodes(titleId: number, season: number): Promise<Map<string, Reaction[]>> {
    const rows = await knex<ReactionRow>(reactionsTable).where({ title_id: titleId, season });
    const byRating = new Map<string, ReactionRow[]>();
    for (const row of rows) {
      const key = `${row.number}:${row.rating_user_id}`;
      byRating.set(key, [...(byRating.get(key) ?? []), row]);
    }
    return new Map([...byRating].map(([key, list]) => [key, group(list)]));
  }

  // Quando a nota é removida, as reações a ela vão junto.
  public async clearForRating(titleId: number, season: number, number: number, ratingUserId: string): Promise<void> {
    await knex<ReactionRow>(reactionsTable).where({ title_id: titleId, season, number, rating_user_id: ratingUserId }).del();
  }

  // Usada ao remover um título: leva as reações às notas dele e dos episódios.
  public async clearForTitle(trx: Knex.Transaction, titleId: number): Promise<void> {
    await trx(reactionsTable).where({ title_id: titleId }).del();
  }
}

export async function initializeReactions(): Promise<void> {
  if (await knex.schema.hasTable(reactionsTable)) return;

  await knex.schema.createTable(reactionsTable, (table) => {
    table.integer("title_id").notNullable();
    table.integer("season").notNullable().defaultTo(0);
    table.integer("number").notNullable().defaultTo(0);
    table.text("rating_user_id").notNullable();
    table.text("user_id").notNullable();
    table.text("emoji").notNullable();
    table.bigInteger("created_at").notNullable().defaultTo(0);
    table.primary(["title_id", "season", "number", "rating_user_id", "user_id", "emoji"]);
  });
}

export const reactionRepository = new ReactionRepository();
