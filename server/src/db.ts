import Knex from "knex";
import type { Knex as KnexTypes } from "knex";
import { rootServer } from "@rootsdk/server-app";

// Uma única conexão com o SQLite do app, usada por todos os módulos do servidor.
export const knex = Knex({
  client: "sqlite3",
  connection: { filename: rootServer.dataStore.config.sqlite3!.filename },
  useNullAsDefault: true,
});

// Bancos de versões anteriores ganham as colunas novas sem perder nada.
export async function ensureColumn(table: string, column: string, add: (table: KnexTypes.AlterTableBuilder) => void): Promise<void> {
  if (await knex.schema.hasColumn(table, column)) return;
  await knex.schema.alterTable(table, add);
}
