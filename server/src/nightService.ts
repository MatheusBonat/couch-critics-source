import { Client, RootServerException, rootServer } from "@rootsdk/server-app";
import {
  Night,
  NightIdRequest,
  NightCreateRequest,
  NightDeleteResponse,
  NightListRequest,
  NightListResponse,
  NightPickRequest,
  NightResponse,
  NightRsvpRequest,
  NightStatus,
  NightVoteRequest,
  RsvpAnswer,
  TitleError,
} from "@notas-app/gen-shared";
import { NightServiceBase } from "@notas-app/gen-server";
import { adminState } from "./access";
import { enabledKinds, optionalKinds } from "./kinds";
import { NightState, nightRepository } from "./nightRepository";
import { titleRepository } from "./titleRepository";

// Limites da Noite. Ficam num objeto para os testes poderem trocar.
export const nightTuning = {
  maxName: 60,
  minOptions: 2,
  maxOptions: 8,
  // Noites abertas (votando ou decididas e por acontecer): no total e por pessoa.
  maxOpen: 5,
  maxOpenPerMember: 3,
  maxDaysAhead: 365,
  // A votação precisa terminar daqui a pelo menos isto.
  minVotingMs: 60 * 1000,
  // Uma noite decidida passa sozinha para "aconteceu" (ou "cancelada", se ficou sem vencedor) 6 horas depois do início.
  finishAfterMs: 6 * 60 * 60 * 1000,
  // O lembrete vai para quem disse "Vou" ou "Talvez" cerca de 1 hora antes do início.
  reminderLeadMs: 60 * 60 * 1000,
  // De quanto em quanto tempo o servidor confere prazos, lembretes e noites passadas.
  sweepMs: 30 * 1000,
  // Cada página da lista de noites acabadas: até 10 noites e cerca de 180 KB (o limite do Root é 256 KiB por mensagem).
  pageNights: 10,
  pageBytes: 180_000,
};

// Só para testes: o relógio do servidor.
export const nightClock = { now: () => Date.now() };

// Mesmo formato dos outros erros do app: "codigo|mensagem". A tela escolhe o texto pelo código (ver client/src/lib.ts).
function fail(code: TitleError, message: string): never {
  throw new RootServerException(code, `${code}|${message}`);
}

function cut(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

// Avisos do Root (indicador de atividade da comunidade e notificações). Nunca atrapalham quem está usando o app.
async function pingCommunity(): Promise<void> {
  try {
    await rootServer.community?.notifications?.setActivity({});
  } catch {
    // Só um aviso a mais.
  }
}

async function notifyMembers(userIds: string[], title: string, description: string): Promise<void> {
  if (userIds.length === 0) return;
  try {
    await rootServer.community?.notifications?.send({
      title: cut(title, 50),
      description: cut(description, 150),
      userIds: userIds as never,
    });
  } catch {
    // Só um aviso a mais.
  }
}

async function canManage(night: NightState, userId: string): Promise<boolean> {
  return night.createdBy === userId || (await adminState(userId)).isAdmin;
}

export class NightService extends NightServiceBase {
  private sweeping = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  // ---------- consultas ----------

  async list(request: NightListRequest, _client: Client): Promise<NightListResponse> {
    await this.sweepAndBroadcast();

    const beforeId = request.beforeId ?? 0;
    const open = beforeId === 0 ? await nightRepository.listOpen() : [];
    const room = Math.max(3, nightTuning.pageNights - open.length);
    const finished = await nightRepository.listFinished(beforeId, room + 1);

    const nights: Night[] = [...open];
    let bytes = open.reduce((sum, night) => sum + Night.toBinary(night).length + 8, 0);
    let hasMore = finished.length > room;
    let lastFinished = 0;

    for (const night of finished.slice(0, room)) {
      const size = Night.toBinary(night).length + 8;
      if (lastFinished !== 0 && bytes + size > nightTuning.pageBytes) {
        hasMore = true;
        break;
      }
      nights.push(night);
      bytes += size;
      lastFinished = night.id;
    }

    return { nights, hasMore, nextBeforeId: hasMore ? lastFinished : 0 };
  }

  // ---------- criar ----------

  async create(request: NightCreateRequest, client: Client): Promise<NightResponse> {
    const now = nightClock.now();
    const name = (request.name ?? "").trim().replace(/\s+/g, " ");
    if (name.length > nightTuning.maxName) fail(TitleError.NIGHT_INVALID_NAME, `The name can have up to ${nightTuning.maxName} characters.`);

    const startsAt = request.startsAt;
    const votingEndsAt = request.votingEndsAt;
    const limit = now + nightTuning.maxDaysAhead * 24 * 60 * 60 * 1000;
    if (!Number.isFinite(startsAt) || !Number.isFinite(votingEndsAt)) fail(TitleError.NIGHT_INVALID_TIME, "Invalid date.");
    if (startsAt <= now || startsAt > limit) fail(TitleError.NIGHT_INVALID_TIME, "The night needs to start in the future, within a year.");
    if (votingEndsAt < now + nightTuning.minVotingMs || votingEndsAt > startsAt) {
      fail(TitleError.NIGHT_INVALID_TIME, "The voting needs to end in the future and before the night starts.");
    }

    const titleIds = [...new Set(request.titleIds ?? [])];
    if (titleIds.length < nightTuning.minOptions || titleIds.length > nightTuning.maxOptions || titleIds.length !== (request.titleIds ?? []).length) {
      fail(TitleError.NIGHT_INVALID_OPTIONS, `Choose from ${nightTuning.minOptions} to ${nightTuning.maxOptions} different titles.`);
    }
    const enabled = await enabledKinds();
    for (const id of titleIds) {
      const title = await titleRepository.get(id);
      if (!title) fail(TitleError.NIGHT_INVALID_OPTIONS, "One of the titles no longer exists.");
      if (optionalKinds.includes(title.kind) && !enabled.includes(title.kind)) fail(TitleError.NIGHT_INVALID_OPTIONS, "That category is turned off.");
    }

    if ((await nightRepository.countOpen()) >= nightTuning.maxOpen) {
      fail(TitleError.NIGHT_LIMIT, `There can be up to ${nightTuning.maxOpen} open nights at the same time.`);
    }
    if ((await nightRepository.countOpenBy(client.userId)) >= nightTuning.maxOpenPerMember) {
      fail(TitleError.NIGHT_LIMIT, `Each person can have up to ${nightTuning.maxOpenPerMember} open nights.`);
    }

    const night = await nightRepository.create({ name, startsAt, votingEndsAt, createdBy: client.userId, titleIds }, now);
    this.broadcastUpdated({ night }, "all", client);
    void pingCommunity();
    return { night };
  }

  // ---------- votar e confirmar presença ----------

  async vote(request: NightVoteRequest, client: Client): Promise<NightResponse> {
    await this.sweepAndBroadcast();
    const state = await this.require(request.nightId);
    const now = nightClock.now();
    if (state.status !== NightStatus.VOTING || now >= state.votingEndsAt) fail(TitleError.NIGHT_VOTING_CLOSED, "The voting is closed.");

    if (request.optionId !== 0) {
      const options = await nightRepository.optionsOf(state.id);
      if (!options.some((option) => option.id === request.optionId)) fail(TitleError.NIGHT_INVALID_OPTION, "That option is not part of this night.");
    }

    await nightRepository.setVote(state.id, client.userId, request.optionId, now);
    return this.changed(state.id, client);
  }

  async setRsvp(request: NightRsvpRequest, client: Client): Promise<NightResponse> {
    await this.sweepAndBroadcast();
    const state = await this.require(request.nightId);
    if (state.status !== NightStatus.VOTING && state.status !== NightStatus.CLOSED) fail(TitleError.NIGHT_WRONG_STATE, "This night is over.");

    const answer = request.answer;
    if (answer !== RsvpAnswer.UNSPECIFIED && answer !== RsvpAnswer.GOING && answer !== RsvpAnswer.MAYBE && answer !== RsvpAnswer.NOT_GOING) {
      fail(TitleError.NIGHT_INVALID_RSVP, "Invalid answer.");
    }

    await nightRepository.setRsvp(state.id, client.userId, answer, nightClock.now());
    return this.changed(state.id, client);
  }

  // ---------- quem criou (ou um admin) conduz a noite ----------

  async closeVoting(request: NightIdRequest, client: Client): Promise<NightResponse> {
    const state = await this.requireManaged(request.nightId, client.userId);
    if (state.status !== NightStatus.VOTING) fail(TitleError.NIGHT_WRONG_STATE, "The voting is not open.");

    await this.resolveVoting(state, client.userId);
    return this.changed(state.id, client);
  }

  // Empate: quem criou escolhe, entre as opções empatadas, a que vai ser a noite.
  async pickWinner(request: NightPickRequest, client: Client): Promise<NightResponse> {
    const state = await this.requireManaged(request.nightId, client.userId);
    if (state.status !== NightStatus.CLOSED || state.winnerOptionId !== 0) fail(TitleError.NIGHT_WRONG_STATE, "There is nothing to break a tie on.");

    const tied = await this.topOptions(state.id);
    if (!tied.includes(request.optionId)) fail(TitleError.NIGHT_INVALID_OPTION, "Choose one of the tied options.");

    await nightRepository.setStatus(state.id, NightStatus.CLOSED, request.optionId, nightClock.now());
    void this.announceWinner(state, request.optionId, client.userId);
    return this.changed(state.id, client);
  }

  async markHappened(request: NightIdRequest, client: Client): Promise<NightResponse> {
    const state = await this.requireManaged(request.nightId, client.userId);
    if (state.status !== NightStatus.CLOSED || state.winnerOptionId === 0) fail(TitleError.NIGHT_WRONG_STATE, "This night has no chosen title yet.");

    await nightRepository.setStatus(state.id, NightStatus.HAPPENED, state.winnerOptionId, nightClock.now());
    return this.changed(state.id, client);
  }

  async cancel(request: NightIdRequest, client: Client): Promise<NightResponse> {
    const state = await this.requireManaged(request.nightId, client.userId);
    if (state.status !== NightStatus.VOTING && state.status !== NightStatus.CLOSED) fail(TitleError.NIGHT_WRONG_STATE, "This night is already over.");

    await nightRepository.setStatus(state.id, NightStatus.CANCELED, state.winnerOptionId, nightClock.now());
    return this.changed(state.id, client);
  }

  async delete(request: NightIdRequest, client: Client): Promise<NightDeleteResponse> {
    const state = await this.requireManaged(request.nightId, client.userId);
    await nightRepository.remove(state.id);
    this.broadcastDeleted({ id: state.id }, "all", client);
    return {};
  }

  // ---------- trabalho do servidor ----------

  // Um título foi removido da comunidade: sai das noites. Quem está com a tela aberta recebe a noite atualizada.
  async titleRemoved(titleId: number): Promise<void> {
    try {
      const affected = await nightRepository.removeTitle(titleId, nightClock.now());
      for (const id of affected) {
        const night = await nightRepository.get(id);
        if (night) this.broadcastUpdated({ night }, "all");
      }
    } catch {
      // A remoção do título já aconteceu; a noite se acerta na próxima conferência.
    }
  }

  // Confere prazos, lembretes e noites passadas. Devolve as noites que mudaram.
  async sweep(now: number = nightClock.now()): Promise<number[]> {
    const changed: number[] = [];
    const due = await nightRepository.due(now, nightTuning.finishAfterMs, nightTuning.reminderLeadMs);

    for (const state of due.votingOver) {
      await this.resolveVoting(state, null);
      changed.push(state.id);
    }

    for (const state of due.finished) {
      await nightRepository.setStatus(state.id, state.winnerOptionId > 0 ? NightStatus.HAPPENED : NightStatus.CANCELED, state.winnerOptionId, now);
      changed.push(state.id);
    }

    for (const state of due.remind) {
      await nightRepository.markReminded(state.id);
      const winner = await nightRepository.optionTitle(state.winnerOptionId);
      const title = winner ? await titleRepository.get(winner.titleId) : null;
      void notifyMembers(
        await nightRepository.interested(state.id),
        `Movie night in 1 hour · Noite em 1 hora`,
        title ? `${state.name ? state.name + ": " : ""}${title.name}` : state.name,
      );
    }

    return changed;
  }

  async sweepAndBroadcast(): Promise<void> {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      for (const id of await this.sweep()) {
        const night = await nightRepository.get(id);
        if (night) this.broadcastUpdated({ night }, "all");
      }
    } catch {
      // A conferência roda de novo daqui a pouco.
    } finally {
      this.sweeping = false;
    }
  }

  startSweeper(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.sweepAndBroadcast(), nightTuning.sweepMs);
    this.timer.unref?.();
  }

  stopSweeper(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // ---------- partes internas ----------

  private async require(id: number): Promise<NightState> {
    const state = await nightRepository.state(id);
    if (!state) fail(TitleError.NIGHT_NOT_FOUND, "This night no longer exists.");
    return state;
  }

  private async requireManaged(id: number, userId: string): Promise<NightState> {
    await this.sweepAndBroadcast();
    const state = await this.require(id);
    if (!(await canManage(state, userId))) fail(TitleError.NIGHT_FORBIDDEN, "Only the person who created the night, or an app admin, can do this.");
    return state;
  }

  // Devolve a noite atualizada a quem pediu e avisa os outros em tempo real.
  private async changed(id: number, client: Client): Promise<NightResponse> {
    const night = (await nightRepository.get(id))!;
    this.broadcastUpdated({ night }, "all", client);
    return { night };
  }

  // As opções com mais votos. Sem nenhum voto, são todas.
  private async topOptions(nightId: number): Promise<number[]> {
    const options = await nightRepository.optionsOf(nightId);
    const tally = await nightRepository.tally(nightId);
    const max = Math.max(0, ...options.map((option) => tally.get(option.id) ?? 0));
    return options.filter((option) => (tally.get(option.id) ?? 0) === max).map((option) => option.id);
  }

  // Fecha a votação. Uma opção com mais votos que as outras vence; empate (ou ninguém votou) fica para quem criou decidir.
  private async resolveVoting(state: NightState, actingUserId: string | null): Promise<void> {
    const tied = await this.topOptions(state.id);
    const tally = await nightRepository.tally(state.id);
    const hasVotes = [...tally.values()].some((count) => count > 0);
    const winner = tied.length === 1 && hasVotes ? tied[0] : 0;

    await nightRepository.setStatus(state.id, NightStatus.CLOSED, winner, nightClock.now());

    if (winner > 0) {
      void this.announceWinner(state, winner, actingUserId);
    } else {
      void pingCommunity();
      if (state.createdBy !== actingUserId) {
        void notifyMembers([state.createdBy], "Tie: pick the winner · Empate: escolha o vencedor", state.name || "Couch Critics");
      }
    }
  }

  // A noite foi decidida: quem disse "Vou" ou "Talvez" fica sabendo, e a comunidade vê o indicador de atividade.
  private async announceWinner(state: NightState, optionId: number, actingUserId: string | null): Promise<void> {
    const option = await nightRepository.optionTitle(optionId);
    const title = option ? await titleRepository.get(option.titleId) : null;
    const interested = (await nightRepository.interested(state.id)).filter((userId) => userId !== actingUserId);
    await notifyMembers(interested, `Night chosen · Noite escolhida`, `${state.name ? state.name + ": " : ""}${title?.name ?? ""}`);
    await pingCommunity();
  }
}

export const nightService = new NightService();
