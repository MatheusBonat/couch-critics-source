import { knex } from "./db";

const settingsTable = "settings";

// Chaves de API e outros ajustes do app, guardados no banco da própria comunidade.
export const settingKeys = {
  tmdbToken: "tmdb_token",
  omdbKey: "omdb_key",
  igdbClientId: "igdb_client_id",
  igdbClientSecret: "igdb_client_secret",
  claimedAdmin: "claimed_admin",
  // Categorias opcionais ligadas pelo admin (livros, animes, álbuns), como "4,5".
  enabledKinds: "enabled_kinds",
} as const;

export async function getSetting(key: string): Promise<string | null> {
  const row = await knex<{ key: string; value: string }>(settingsTable).where({ key }).first();
  return row ? row.value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await knex(settingsTable).insert({ key, value }).onConflict("key").merge();
}

export async function deleteSetting(key: string): Promise<void> {
  await knex(settingsTable).where({ key }).del();
}

export async function initializeSettings(): Promise<void> {
  if (!(await knex.schema.hasTable(settingsTable))) {
    await knex.schema.createTable(settingsTable, (table) => {
      table.text("key").primary();
      table.text("value").notNullable();
    });
  }
}
