import { knex } from "./db";

interface CoverRow {
  path: string;
  mime: string;
  data: Buffer;
  fetched_at: number;
}

const coversTable = "covers";

// Capas já baixadas, guardadas no banco da comunidade. mime vazio = esta capa não existe (o serviço de imagens disse 404).
export class CoverRepository {
  public async get(path: string): Promise<{ mime: string; data: Buffer } | null> {
    const row = await knex<CoverRow>(coversTable).where({ path }).first();
    return row ? { mime: row.mime, data: Buffer.from(row.data) } : null;
  }

  public async put(path: string, mime: string, data: Buffer, now: number): Promise<void> {
    await knex(coversTable).insert({ path, mime, data, fetched_at: now }).onConflict("path").merge();
  }
}

export async function initializeCovers(): Promise<void> {
  if (await knex.schema.hasTable(coversTable)) return;

  await knex.schema.createTable(coversTable, (table) => {
    table.text("path").primary();
    table.text("mime").notNullable().defaultTo("");
    table.binary("data").notNullable();
    table.bigInteger("fetched_at").notNullable().defaultTo(0);
  });
}

export const coverRepository = new CoverRepository();
