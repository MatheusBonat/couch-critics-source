import type { Knex } from "knex";
import { Night, NightOption, NightRsvp, NightStatus, RsvpAnswer } from "@notas-app/gen-shared";
import { knex } from "./db";

interface NightRow {
  id: number;
  name: string;
  starts_at: number;
  voting_ends_at: number;
  created_by: string;
  created_at: number;
  status: number;
  winner_option_id: number;
  closed_at: number;
  reminded: number;
}

interface OptionRow {
  id: number;
  night_id: number;
  title_id: number;
  position: number;
}

interface VoteRow {
  night_id: number;
  user_id: string;
  option_id: number;
  voted_at: number;
}

interface RsvpRow {
  night_id: number;
  user_id: string;
  answer: number;
  answered_at: number;
}

const nightsTable = "nights";
const optionsTable = "night_options";
const votesTable = "night_votes";
const rsvpsTable = "night_rsvps";

// "Abertas" são as noites com votação aberta ou já decididas e ainda por acontecer.
const openStatuses = [NightStatus.VOTING, NightStatus.CLOSED];
const finishedStatuses = [NightStatus.HAPPENED, NightStatus.CANCELED];

export interface NewNight {
  name: string;
  startsAt: number;
  votingEndsAt: number;
  createdBy: string;
  titleIds: number[];
}

// O que o servidor precisa saber de uma noite para decidir o que fazer com ela.
export interface NightState {
  id: number;
  name: string;
  startsAt: number;
  votingEndsAt: number;
  createdBy: string;
  status: NightStatus;
  winnerOptionId: number;
  reminded: boolean;
}

function toState(row: NightRow): NightState {
  return {
    id: row.id,
    name: row.name,
    startsAt: row.starts_at,
    votingEndsAt: row.voting_ends_at,
    createdBy: row.created_by,
    status: row.status as NightStatus,
    winnerOptionId: row.winner_option_id,
    reminded: row.reminded === 1,
  };
}

// Monta as noites com opções, votos e presenças, buscando tudo de uma vez (sem uma consulta por noite).
async function assemble(rows: NightRow[]): Promise<Night[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);

  const optionRows = await knex<OptionRow>(optionsTable).whereIn("night_id", ids).orderBy("position", "asc");
  const voteRows = await knex<VoteRow>(votesTable).whereIn("night_id", ids).orderBy("voted_at", "asc");
  const rsvpRows = await knex<RsvpRow>(rsvpsTable).whereIn("night_id", ids).orderBy("answered_at", "asc");

  const votersByOption = new Map<number, string[]>();
  for (const vote of voteRows) votersByOption.set(vote.option_id, [...(votersByOption.get(vote.option_id) ?? []), vote.user_id]);

  const optionsByNight = new Map<number, NightOption[]>();
  for (const option of optionRows) {
    const list = optionsByNight.get(option.night_id) ?? [];
    list.push({ id: option.id, titleId: option.title_id, voterIds: votersByOption.get(option.id) ?? [] });
    optionsByNight.set(option.night_id, list);
  }

  const rsvpsByNight = new Map<number, NightRsvp[]>();
  for (const rsvp of rsvpRows) {
    const list = rsvpsByNight.get(rsvp.night_id) ?? [];
    list.push({ userId: rsvp.user_id, answer: rsvp.answer as RsvpAnswer });
    rsvpsByNight.set(rsvp.night_id, list);
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    startsAt: row.starts_at,
    votingEndsAt: row.voting_ends_at,
    createdBy: row.created_by,
    status: row.status as NightStatus,
    options: optionsByNight.get(row.id) ?? [],
    rsvps: rsvpsByNight.get(row.id) ?? [],
    winnerOptionId: row.winner_option_id,
    createdAt: row.created_at,
  }));
}

export class NightRepository {
  public async create(input: NewNight, now: number): Promise<Night> {
    const id = await knex.transaction(async (trx) => {
      const [created] = await trx(nightsTable)
        .insert({
          name: input.name,
          starts_at: input.startsAt,
          voting_ends_at: input.votingEndsAt,
          created_by: input.createdBy,
          created_at: now,
          status: NightStatus.VOTING,
          winner_option_id: 0,
          closed_at: 0,
          reminded: 0,
        })
        .returning("id");
      const nightId = typeof created === "object" ? (created as { id: number }).id : created;

      for (let position = 0; position < input.titleIds.length; position++) {
        await trx(optionsTable).insert({ night_id: nightId, title_id: input.titleIds[position], position });
      }
      return nightId as number;
    });

    return (await this.get(id))!;
  }

  public async get(id: number): Promise<Night | null> {
    const row = await knex<NightRow>(nightsTable).where({ id }).first();
    return row ? (await assemble([row]))[0] : null;
  }

  public async state(id: number): Promise<NightState | null> {
    const row = await knex<NightRow>(nightsTable).where({ id }).first();
    return row ? toState(row) : null;
  }

  // Todas as noites abertas, da que acontece primeiro para a que acontece por último.
  public async listOpen(): Promise<Night[]> {
    const rows = await knex<NightRow>(nightsTable).whereIn("status", openStatuses).orderBy("starts_at", "asc").orderBy("id", "asc");
    return assemble(rows);
  }

  // Noites que já acabaram (aconteceram ou foram canceladas), da mais nova para a mais antiga.
  public async listFinished(beforeId: number, limit: number): Promise<Night[]> {
    const query = knex<NightRow>(nightsTable).whereIn("status", finishedStatuses).orderBy("id", "desc").limit(limit);
    if (beforeId > 0) query.where("id", "<", beforeId);
    return assemble(await query);
  }

  public async countOpen(): Promise<number> {
    const row = await knex(nightsTable).whereIn("status", openStatuses).count({ total: "*" }).first();
    return Number(row?.total ?? 0);
  }

  public async countOpenBy(userId: string): Promise<number> {
    const row = await knex(nightsTable).whereIn("status", openStatuses).andWhere({ created_by: userId }).count({ total: "*" }).first();
    return Number(row?.total ?? 0);
  }

  // optionId = 0 tira o voto. Cada pessoa tem um voto por noite; votar de novo troca.
  public async setVote(nightId: number, userId: string, optionId: number, now: number): Promise<void> {
    if (optionId === 0) {
      await knex<VoteRow>(votesTable).where({ night_id: nightId, user_id: userId }).del();
      return;
    }
    await knex<VoteRow>(votesTable)
      .insert({ night_id: nightId, user_id: userId, option_id: optionId, voted_at: now })
      .onConflict(["night_id", "user_id"])
      .merge();
  }

  public async setRsvp(nightId: number, userId: string, answer: RsvpAnswer, now: number): Promise<void> {
    if (answer === RsvpAnswer.UNSPECIFIED) {
      await knex<RsvpRow>(rsvpsTable).where({ night_id: nightId, user_id: userId }).del();
      return;
    }
    await knex<RsvpRow>(rsvpsTable)
      .insert({ night_id: nightId, user_id: userId, answer, answered_at: now })
      .onConflict(["night_id", "user_id"])
      .merge();
  }

  public async setStatus(id: number, status: NightStatus, winnerOptionId: number, now: number): Promise<void> {
    await knex<NightRow>(nightsTable).where({ id }).update({ status, winner_option_id: winnerOptionId, closed_at: now });
  }

  public async markReminded(id: number): Promise<void> {
    await knex<NightRow>(nightsTable).where({ id }).update({ reminded: 1 });
  }

  public async remove(id: number): Promise<void> {
    await knex.transaction(async (trx) => {
      await this.removeChildren(trx, id);
      await trx(nightsTable).where({ id }).del();
    });
  }

  private async removeChildren(trx: Knex.Transaction, nightId: number): Promise<void> {
    await trx(votesTable).where({ night_id: nightId }).del();
    await trx(rsvpsTable).where({ night_id: nightId }).del();
    await trx(optionsTable).where({ night_id: nightId }).del();
  }

  // Um título foi removido: ele sai das noites, com os votos dele. Noites sem nenhuma opção são canceladas.
  // Se era o vencedor de uma noite decidida, a noite volta a esperar a escolha de quem criou. Devolve as noites afetadas.
  public async removeTitle(titleId: number, now: number): Promise<number[]> {
    return knex.transaction(async (trx) => {
      const options = await trx<OptionRow>(optionsTable).where({ title_id: titleId });
      if (options.length === 0) return [];

      const affected = [...new Set(options.map((option) => option.night_id))];
      const optionIds = options.map((option) => option.id);

      await trx(votesTable).whereIn("option_id", optionIds).del();
      await trx(optionsTable).whereIn("id", optionIds).del();
      await trx(nightsTable).whereIn("winner_option_id", optionIds).update({ winner_option_id: 0 });

      for (const nightId of affected) {
        const left = await trx(optionsTable).where({ night_id: nightId }).count({ total: "*" }).first();
        if (Number(left?.total ?? 0) > 0) continue;
        await trx(nightsTable)
          .where({ id: nightId })
          .whereIn("status", openStatuses)
          .update({ status: NightStatus.CANCELED, winner_option_id: 0, closed_at: now });
      }
      return affected;
    });
  }

  // Noites que o servidor precisa mexer agora: votação que passou do prazo, noites decididas que já passaram da hora
  // e noites decididas que começam em breve e ainda não mandaram o lembrete.
  public async due(now: number, finishAfterMs: number, reminderLeadMs: number): Promise<{ votingOver: NightState[]; finished: NightState[]; remind: NightState[] }> {
    const votingOver = await knex<NightRow>(nightsTable).where({ status: NightStatus.VOTING }).andWhere("voting_ends_at", "<=", now);
    const finished = await knex<NightRow>(nightsTable).where({ status: NightStatus.CLOSED }).andWhere("starts_at", "<=", now - finishAfterMs);
    const remind = await knex<NightRow>(nightsTable)
      .where({ status: NightStatus.CLOSED, reminded: 0 })
      .andWhere("winner_option_id", ">", 0)
      .andWhere("starts_at", ">", now)
      .andWhere("starts_at", "<=", now + reminderLeadMs);
    return { votingOver: votingOver.map(toState), finished: finished.map(toState), remind: remind.map(toState) };
  }

  // Título que cada opção representa, para saber o título vencedor.
  public async optionTitle(optionId: number): Promise<{ nightId: number; titleId: number } | null> {
    const row = await knex<OptionRow>(optionsTable).where({ id: optionId }).first();
    return row ? { nightId: row.night_id, titleId: row.title_id } : null;
  }

  public async optionsOf(nightId: number): Promise<{ id: number; titleId: number }[]> {
    const rows = await knex<OptionRow>(optionsTable).where({ night_id: nightId }).orderBy("position", "asc");
    return rows.map((row) => ({ id: row.id, titleId: row.title_id }));
  }

  // Quantos votos cada opção tem.
  public async tally(nightId: number): Promise<Map<number, number>> {
    const rows = await knex<VoteRow>(votesTable).where({ night_id: nightId }).select("option_id").count({ total: "*" }).groupBy("option_id");
    return new Map(rows.map((row) => [row.option_id, Number((row as unknown as { total: number }).total)]));
  }

  // Quem disse "Vou" ou "Talvez", para o lembrete.
  public async interested(nightId: number): Promise<string[]> {
    const rows = await knex<RsvpRow>(rsvpsTable).where({ night_id: nightId }).whereIn("answer", [RsvpAnswer.GOING, RsvpAnswer.MAYBE]);
    return rows.map((row) => row.user_id);
  }
}

export async function initializeNights(): Promise<void> {
  if (!(await knex.schema.hasTable(nightsTable))) {
    await knex.schema.createTable(nightsTable, (table) => {
      table.increments("id").primary();
      table.text("name").notNullable().defaultTo("");
      table.bigInteger("starts_at").notNullable();
      table.bigInteger("voting_ends_at").notNullable();
      table.text("created_by").notNullable();
      table.bigInteger("created_at").notNullable().defaultTo(0);
      table.integer("status").notNullable();
      table.integer("winner_option_id").notNullable().defaultTo(0);
      table.bigInteger("closed_at").notNullable().defaultTo(0);
      table.integer("reminded").notNullable().defaultTo(0);
      table.index(["status"]);
    });
  }

  if (!(await knex.schema.hasTable(optionsTable))) {
    await knex.schema.createTable(optionsTable, (table) => {
      table.increments("id").primary();
      table.integer("night_id").notNullable();
      table.integer("title_id").notNullable();
      table.integer("position").notNullable().defaultTo(0);
      table.index(["night_id"]);
      table.index(["title_id"]);
    });
  }

  if (!(await knex.schema.hasTable(votesTable))) {
    await knex.schema.createTable(votesTable, (table) => {
      table.integer("night_id").notNullable();
      table.text("user_id").notNullable();
      table.integer("option_id").notNullable();
      table.bigInteger("voted_at").notNullable().defaultTo(0);
      table.primary(["night_id", "user_id"]);
      table.index(["option_id"]);
    });
  }

  if (!(await knex.schema.hasTable(rsvpsTable))) {
    await knex.schema.createTable(rsvpsTable, (table) => {
      table.integer("night_id").notNullable();
      table.text("user_id").notNullable();
      table.integer("answer").notNullable();
      table.bigInteger("answered_at").notNullable().defaultTo(0);
      table.primary(["night_id", "user_id"]);
    });
  }
}

export const nightRepository = new NightRepository();
