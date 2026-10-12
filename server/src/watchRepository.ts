import type { Knex } from "knex";
import { WatchEntry, WatchStatus } from "@notas-app/gen-shared";
import { knex } from "./db";

interface WatchRow {
  title_id: number;
  user_id: string;
  status: number;
  updated_at: number;
}

const watchTable = "watch_status";

// Estado de cada título para cada membro: quero ver (jogar), vendo (jogando), já vi (joguei).
export class WatchRepository {
  // WATCH_STATUS_UNSPECIFIED apaga o estado da pessoa.
  public async set(titleId: number, userId: string, status: WatchStatus, now: number): Promise<void> {
    if (status === WatchStatus.UNSPECIFIED) {
      await knex<WatchRow>(watchTable).where({ title_id: titleId, user_id: userId }).del();
      return;
    }

    await knex<WatchRow>(watchTable)
      .insert({ title_id: titleId, user_id: userId, status, updated_at: now })
      .onConflict(["title_id", "user_id"])
      .merge();
  }

  public async forTitles(titleIds?: number[]): Promise<Map<number, WatchEntry[]>> {
    const query = knex<WatchRow>(watchTable).orderBy("updated_at", "asc");
    if (titleIds) query.whereIn("title_id", titleIds);

    const byTitle = new Map<number, WatchEntry[]>();
    for (const row of await query) {
      const list = byTitle.get(row.title_id) ?? [];
      list.push({ userId: row.user_id, status: row.status as WatchStatus });
      byTitle.set(row.title_id, list);
    }
    return byTitle;
  }

  // Usada ao remover um título.
  public async clearForTitle(trx: Knex.Transaction, titleId: number): Promise<void> {
    await trx(watchTable).where({ title_id: titleId }).del();
  }
}

export async function initializeWatch(): Promise<void> {
  if (await knex.schema.hasTable(watchTable)) return;

  await knex.schema.createTable(watchTable, (table) => {
    table.integer("title_id").notNullable();
    table.text("user_id").notNullable();
    table.integer("status").notNullable();
    table.bigInteger("updated_at").notNullable().defaultTo(0);
    table.primary(["title_id", "user_id"]);
  });
}

export const watchRepository = new WatchRepository();
