import { Night, NightOption, NightStatus, RsvpAnswer, Title, TitleKind } from "@notas-app/gen-shared";
import { buildWantList, searchKey, titleMatches } from "./lib";

export const minNightOptions = 2;
export const maxNightOptions = 8;
export const maxNightName = 60;

export type NightGroup = "voting" | "decided" | "tie" | "past";

// Em que parte da tela a noite fica: votando, decidida (com título escolhido), esperando desempate ou já passada.
export function nightGroup(night: Night): NightGroup {
  if (night.status === NightStatus.VOTING) return "voting";
  if (night.status === NightStatus.CLOSED) return night.winnerOptionId > 0 ? "decided" : "tie";
  return "past";
}

// As noites abertas vêm pela data (a que acontece antes primeiro); as passadas, da mais nova para a mais antiga.
export function groupNights(nights: Night[]): Record<NightGroup, Night[]> {
  const groups: Record<NightGroup, Night[]> = { voting: [], decided: [], tie: [], past: [] };
  for (const night of nights) groups[nightGroup(night)].push(night);

  const byStart = (a: Night, b: Night) => a.startsAt - b.startsAt || a.id - b.id;
  groups.voting.sort((a, b) => a.votingEndsAt - b.votingEndsAt || byStart(a, b));
  groups.decided.sort(byStart);
  groups.tie.sort(byStart);
  groups.past.sort((a, b) => b.id - a.id);
  return groups;
}

export function upsertNight(nights: Night[], night: Night): Night[] {
  const exists = nights.some((item) => item.id === night.id);
  return exists ? nights.map((item) => (item.id === night.id ? night : item)) : [...nights, night];
}

// Junta a página nova de noites antigas à lista que já está na tela, sem repetir.
export function mergeNights(current: Night[], incoming: Night[]): Night[] {
  let result = current;
  for (const night of incoming) result = upsertNight(result, night);
  return result;
}

export function myVoteOptionId(night: Night, userId: string): number {
  return night.options.find((option) => option.voterIds.includes(userId))?.id ?? 0;
}

export function myRsvp(night: Night, userId: string): RsvpAnswer {
  return night.rsvps.find((rsvp) => rsvp.userId === userId)?.answer ?? RsvpAnswer.UNSPECIFIED;
}

export function rsvpGroups(night: Night): { going: string[]; maybe: string[]; notGoing: string[] } {
  const pick = (answer: RsvpAnswer) => night.rsvps.filter((rsvp) => rsvp.answer === answer).map((rsvp) => rsvp.userId);
  return { going: pick(RsvpAnswer.GOING), maybe: pick(RsvpAnswer.MAYBE), notGoing: pick(RsvpAnswer.NOT_GOING) };
}

export interface OptionTally {
  option: NightOption;
  votes: number;
  // De 0 a 100, em relação ao total de votos da noite.
  percent: number;
  // Tem o maior número de votos (e pelo menos um).
  leading: boolean;
}

export function tally(night: Night): OptionTally[] {
  const total = night.options.reduce((sum, option) => sum + option.voterIds.length, 0);
  const max = Math.max(0, ...night.options.map((option) => option.voterIds.length));
  return night.options.map((option) => ({
    option,
    votes: option.voterIds.length,
    percent: total === 0 ? 0 : Math.round((option.voterIds.length / total) * 100),
    leading: max > 0 && option.voterIds.length === max,
  }));
}

// As opções com mais votos. Sem nenhum voto, são todas (quem criou a noite escolhe).
export function tiedOptionIds(night: Night): number[] {
  const max = Math.max(0, ...night.options.map((option) => option.voterIds.length));
  return night.options.filter((option) => option.voterIds.length === max).map((option) => option.id);
}

export function winnerOption(night: Night): NightOption | undefined {
  return night.winnerOptionId > 0 ? night.options.find((option) => option.id === night.winnerOptionId) : undefined;
}

// Títulos que já têm uma noite marcada (decidida e ainda por acontecer): título -> noite que acontece primeiro.
export function scheduledByTitle(nights: Night[]): Map<number, Night> {
  const found = new Map<number, Night>();
  for (const night of nights) {
    if (night.status !== NightStatus.CLOSED) continue;
    const winner = winnerOption(night);
    if (!winner) continue;
    const current = found.get(winner.titleId);
    if (!current || night.startsAt < current.startsAt) found.set(winner.titleId, night);
  }
  return found;
}

export function openVotingCount(nights: Night[]): number {
  return nights.filter((night) => night.status === NightStatus.VOTING).length;
}

export function canManageNight(night: Night, userId: string, isAdmin: boolean): boolean {
  return night.createdBy === userId || isAdmin;
}

// ---------- datas ----------

const two = (value: number) => String(value).padStart(2, "0");

// Valor de um campo datetime-local ("2026-10-17T20:00"), no fuso do aparelho.
export function toInputValue(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}`;
}

// NaN quando o campo está vazio ou inválido.
export function fromInputValue(value: string): number {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? new Date(value).getTime() : NaN;
}

// Sugestão de início: hoje às 20h, se ainda faltarem mais de 2 horas; senão, amanhã às 20h.
export function defaultStart(now: number): number {
  const today = new Date(now);
  today.setHours(20, 0, 0, 0);
  if (today.getTime() - now > 2 * 3600 * 1000) return today.getTime();
  today.setDate(today.getDate() + 1);
  return today.getTime();
}

// Sugestão para o fim da votação: 3 horas antes do início, mas nunca antes de daqui a 10 minutos nem depois do início.
export function defaultVotingEnd(start: number, now: number): number {
  const wanted = Math.max(start - 3 * 3600 * 1000, now + 10 * 60 * 1000);
  return Math.min(wanted, start);
}

export function formatWhen(ms: number, locale: string): string {
  return new Date(ms).toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
}

export function timeLeft(ms: number): TimeLeft {
  const total = Math.max(0, Math.floor(ms / 60000));
  return { days: Math.floor(total / 1440), hours: Math.floor((total % 1440) / 60), minutes: total % 60 };
}

// ---------- formulário ----------

export type NightFormError = "options" | "start" | "voting" | null;

// As mesmas regras do servidor (server/src/nightService.ts), para avisar antes de enviar.
export function nightFormError(form: { start: number; votingEnd: number; titleIds: number[] }, now: number): NightFormError {
  const year = 365 * 24 * 3600 * 1000;
  if (!Number.isFinite(form.start) || form.start <= now || form.start > now + year) return "start";
  if (!Number.isFinite(form.votingEnd) || form.votingEnd < now + 60 * 1000 || form.votingEnd > form.start) return "voting";
  if (form.titleIds.length < minNightOptions || form.titleIds.length > maxNightOptions) return "options";
  return null;
}

// Na hora de montar a noite, os títulos aparecem separados por grupos: filmes e séries (e animes, que se assistem do mesmo jeito),
// jogos, livros e músicas. Cada grupo é uma aba; o que foi escolhido fica guardado ao trocar de aba.
export type NightPickKey = "screen" | "games" | "books" | "music";

export interface NightPickGroup {
  key: NightPickKey;
  kinds: TitleKind[];
}

const allPickGroups: NightPickGroup[] = [
  { key: "screen", kinds: [TitleKind.MOVIE, TitleKind.SERIES, TitleKind.ANIME] },
  { key: "games", kinds: [TitleKind.GAME] },
  { key: "books", kinds: [TitleKind.BOOK] },
  { key: "music", kinds: [TitleKind.ALBUM] },
];

// Os grupos que têm pelo menos uma categoria ligada na comunidade, na ordem de cima (filmes e séries primeiro).
export function pickGroups(allowedKinds: TitleKind[]): NightPickGroup[] {
  return allPickGroups
    .map((group) => ({ ...group, kinds: group.kinds.filter((kind) => allowedKinds.includes(kind)) }))
    .filter((group) => group.kinds.length > 0);
}

// Títulos que dá para pôr numa noite: primeiro os da lista "Para ver / jogar" (quem tem mais gente querendo vem antes),
// depois os outros, do mais novo ao mais antigo. A busca acha por nome, com ou sem acento. No máximo 30 resultados.
// Com onlyKinds, só os títulos desses grupos de categorias (a aba escolhida no formulário).
export function candidateTitles(titles: Title[], allowedKinds: TitleKind[], userId: string, query: string, limit = 30, onlyKinds?: TitleKind[]): Title[] {
  const needle = searchKey(query);
  const kindsHere = onlyKinds ? allowedKinds.filter((kind) => onlyKinds.includes(kind)) : allowedKinds;
  // O que a pessoa já viu ou jogou fica entre os "outros" (continua podendo ser escolhido, mas não vem na frente).
  const wanted = buildWantList(titles, kindsHere, userId).filter((item) => !item.done).map((item) => item.title);
  const wantedIds = new Set(wanted.map((title) => title.id));
  const others = titles.filter((title) => kindsHere.includes(title.kind) && !wantedIds.has(title.id)).sort((a, b) => b.id - a.id);
  return [...wanted, ...others].filter((title) => titleMatches(title, needle)).slice(0, limit);
}
