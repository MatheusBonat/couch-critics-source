import { useState } from "react";
import { UserProfile } from "@rootsdk/client-app";
import { Night, NightStatus, RsvpAnswer, Title, WatchStatus } from "@notas-app/gen-shared";
import { nightServiceClient, titleServiceClient } from "@notas-app/gen-client";
import { Poster } from "./Poster";
import { useI18n } from "./i18n";
import { Avatar, displayName } from "./profiles";
import { errorMessage, kinds, posterPathOf, titleName, watchStatusOf } from "./lib";
import { canManageNight, formatWhen, myRsvp, myVoteOptionId, nightGroup, rsvpGroups, tally, tiedOptionIds, timeLeft, winnerOption } from "./nights";

interface Props {
  night: Night;
  titleOf: (id: number) => Title | undefined;
  me: string;
  isAdmin: boolean;
  profiles: Map<string, UserProfile>;
  // O relógio da tela (atualizado de vez em quando), para o "faltam 3 h" e para saber se a votação ainda está aberta.
  now: number;
  onChanged: (night: Night) => void;
  onDeleted: (id: number) => void;
  onTitleChanged: (title: Title) => void;
  onOpenTitle: (title: Title) => void;
  onError: (message: string) => void;
}

type Confirming = "cancel" | "delete" | null;

// Uma noite: quando é, as opções com os votos (abertos), a presença de cada pessoa e, para quem criou ou é admin,
// os botões para encerrar a votação, desempatar, marcar que aconteceu, cancelar e apagar.
export function NightCard({ night, titleOf, me, isAdmin, profiles, now, onChanged, onDeleted, onTitleChanged, onOpenTitle, onError }: Props) {
  const { t, lang } = useI18n();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<Confirming>(null);

  const group = nightGroup(night);
  const voting = night.status === NightStatus.VOTING && now < night.votingEndsAt;
  const canManage = canManageNight(night, me, isAdmin);
  const mine = myVoteOptionId(night, me);
  const answer = myRsvp(night, me);
  const rows = tally(night);
  const tied = group === "tie" ? tiedOptionIds(night) : [];
  const winner = winnerOption(night);
  const open = night.status === NightStatus.VOTING || night.status === NightStatus.CLOSED;
  const creator = night.createdBy === me ? t.you : displayName(profiles, night.createdBy, t.member);
  const nameOf = (userId: string) => (userId === me ? t.youTitle : displayName(profiles, userId, t.member));
  const left = timeLeft(night.votingEndsAt - now);
  const statusLabel =
    group === "voting" ? t.nights.status.voting : group === "decided" ? t.nights.status.decided : group === "tie" ? t.nights.status.tie : night.status === NightStatus.HAPPENED ? t.nights.status.happened : t.nights.status.canceled;

  // Roda uma ação do servidor que devolve a noite atualizada.
  const run = async (action: () => Promise<{ night?: Night }>) => {
    setBusy(true);
    try {
      const response = await action();
      if (response.night) onChanged(response.night);
    } catch (error) {
      onError(errorMessage(error, t));
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const vote = (optionId: number) => run(() => nightServiceClient.vote({ nightId: night.id, optionId }));
  const setRsvp = (next: RsvpAnswer) => run(() => nightServiceClient.setRsvp({ nightId: night.id, answer: next }));

  const remove = async () => {
    setBusy(true);
    try {
      await nightServiceClient.delete({ nightId: night.id });
      onDeleted(night.id);
    } catch (error) {
      onError(errorMessage(error, t));
      setBusy(false);
      setConfirming(null);
    }
  };

  // Depois da noite: marca "já vi / joguei" no título que foi escolhido e abre o título para dar a nota.
  const winnerTitle = winner ? titleOf(winner.titleId) : undefined;
  const winnerKind = winnerTitle ? (kinds.find((item) => item.kind === winnerTitle.kind)?.key ?? "movie") : "movie";
  const canMarkDone = night.status === NightStatus.HAPPENED && winnerTitle !== undefined && watchStatusOf(winnerTitle, me) !== WatchStatus.DONE;

  const markDone = async () => {
    if (!winnerTitle) return;
    setBusy(true);
    try {
      const response = await titleServiceClient.setWatchStatus({ titleId: winnerTitle.id, status: WatchStatus.DONE });
      const updated = response.title ?? winnerTitle;
      onTitleChanged(updated);
      onOpenTitle(updated);
    } catch (error) {
      onError(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  const rsvpButtons: { value: RsvpAnswer; label: string }[] = [
    { value: RsvpAnswer.GOING, label: t.nights.rsvp.going },
    { value: RsvpAnswer.MAYBE, label: t.nights.rsvp.maybe },
    { value: RsvpAnswer.NOT_GOING, label: t.nights.rsvp.notGoing },
  ];
  const groups = rsvpGroups(night);

  return (
    <li className={`night night-${group}`} id={`night-${night.id}`}>
      <div className="night-head">
        <h3 className="night-name">{night.name || t.nights.defaultName}</h3>
        <span className={`night-status night-status-${group}`}>{statusLabel}</span>
      </div>

      <p className="night-when">{t.nights.when(formatWhen(night.startsAt, t.locale))}</p>
      <p className="muted night-sub">
        {[
          night.status === NightStatus.VOTING && voting
            ? t.nights.votingUntil(formatWhen(night.votingEndsAt, t.locale), t.nights.left(left.days, left.hours, left.minutes))
            : night.status === NightStatus.CANCELED
              ? ""
              : t.nights.votingOver,
          t.nights.createdBy(creator),
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {group === "tie" && <p className="night-tie">{canManage ? t.nights.manage.tieHint : t.nights.manage.tieWait}</p>}

      <ul className="night-options">
        {rows.map(({ option, votes, percent, leading }) => {
          const title = titleOf(option.titleId);
          const name = title ? titleName(title, lang) : "…";
          const kindKey = title ? (kinds.find((item) => item.kind === title.kind)?.key ?? "movie") : "movie";
          const isWinner = night.winnerOptionId === option.id;
          const isTied = tied.includes(option.id);
          const isMine = mine === option.id;
          const classes = ["night-option", isWinner ? "is-winner" : "", isTied ? "is-tied" : "", isMine ? "is-mine" : ""].filter(Boolean).join(" ");

          return (
            <li key={option.id} className={classes}>
              <Poster path={title ? posterPathOf(title, lang) : ""} name={name} alt={t.posterAlt(name)} />

              <div className="night-option-main">
                <span className="night-option-name">{name}</span>
                <span className="muted night-option-meta">
                  {title ? `${title.year > 0 ? title.year + " · " : ""}${t.kinds[kindKey].tab}` : ""}
                </span>
                <div className="night-bar" role="presentation">
                  <span className={leading ? "night-bar-fill is-leading" : "night-bar-fill"} style={{ width: `${percent}%` }} />
                </div>
                <span className="night-option-votes">
                  {t.nights.votes(votes)}
                  {isWinner && <strong className="night-tag"> · {t.nights.chosen}</strong>}
                  {isTied && <strong className="night-tag"> · {t.nights.tied}</strong>}
                </span>
                {option.voterIds.length > 0 && (
                  <span className="night-voters" title={t.nights.voters(option.voterIds.map(nameOf).join(", "))}>
                    {option.voterIds.slice(0, 6).map((userId) => (
                      <Avatar key={userId} profile={profiles.get(userId)} small />
                    ))}
                    <span className="muted">
                      {option.voterIds
                        .slice(0, 4)
                        .map(nameOf)
                        .join(", ")}
                      {option.voterIds.length > 4 ? ` ${t.moreRatings(option.voterIds.length - 4)}` : ""}
                    </span>
                  </span>
                )}
              </div>

              <div className="night-option-side">
                {voting && (
                  <button
                    type="button"
                    className={isMine ? "button-outline is-active" : "button-primary"}
                    aria-pressed={isMine}
                    disabled={busy}
                    onClick={() => void vote(isMine ? 0 : option.id)}
                    title={isMine ? t.nights.removeVote : undefined}
                  >
                    {isMine ? t.nights.yourVote : t.nights.vote}
                  </button>
                )}
                {group === "tie" && canManage && isTied && (
                  <button type="button" className="button-primary" disabled={busy} onClick={() => void run(() => nightServiceClient.pickWinner({ nightId: night.id, optionId: option.id }))}>
                    {t.nights.manage.pick}
                  </button>
                )}
                {winnerTitle && isWinner && winnerTitle.id === option.titleId && title && (
                  <button type="button" className="button-quiet" onClick={() => onOpenTitle(title)}>
                    {t.nights.openTitle}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {open && (
        <div className="night-rsvp">
          <div className="watch-row" role="group" aria-label={t.nights.rsvp.label}>
            <span className="watch-label">{t.nights.rsvp.label}</span>
            {rsvpButtons.map((button) => (
              <button
                key={button.value}
                type="button"
                className={answer === button.value ? "watch-button is-active" : "watch-button"}
                aria-pressed={answer === button.value}
                disabled={busy}
                onClick={() => void setRsvp(answer === button.value ? RsvpAnswer.UNSPECIFIED : button.value)}
              >
                {button.label}
              </button>
            ))}
          </div>
          {(groups.going.length > 0 || groups.maybe.length > 0 || groups.notGoing.length > 0) && (
            <ul className="watch-groups">
              {groups.going.length > 0 && <li>{t.nights.rsvp.groupGoing(groups.going.map(nameOf).join(", "))}</li>}
              {groups.maybe.length > 0 && <li>{t.nights.rsvp.groupMaybe(groups.maybe.map(nameOf).join(", "))}</li>}
              {groups.notGoing.length > 0 && <li>{t.nights.rsvp.groupNotGoing(groups.notGoing.map(nameOf).join(", "))}</li>}
            </ul>
          )}
        </div>
      )}

      {!open && groups.going.length > 0 && <p className="muted night-sub">{t.nights.rsvp.groupGoing(groups.going.map(nameOf).join(", "))}</p>}

      {canMarkDone && winnerTitle && (
        <div className="actions">
          <button type="button" className="button-primary" disabled={busy} onClick={() => void markDone()}>
            {t.nights.done(t.watch.labels[winnerKind].done)}
          </button>
        </div>
      )}

      {canManage && (
        <div className="night-manage">
          {confirming ? (
            <>
              <p className="muted">{confirming === "cancel" ? t.nights.manage.confirmCancel : t.nights.manage.confirmDelete}</p>
              <div className="actions">
                <button type="button" className="button-danger" disabled={busy} onClick={() => void (confirming === "cancel" ? run(() => nightServiceClient.cancel({ nightId: night.id })) : remove())}>
                  {confirming === "cancel" ? t.nights.manage.cancel : t.nights.manage.delete}
                </button>
                <button type="button" className="button-quiet" disabled={busy} onClick={() => setConfirming(null)}>
                  {t.cancel}
                </button>
              </div>
            </>
          ) : (
            <div className="actions">
              {night.status === NightStatus.VOTING && (
                <button type="button" className="button-outline" disabled={busy} onClick={() => void run(() => nightServiceClient.closeVoting({ nightId: night.id }))}>
                  {t.nights.manage.closeVoting}
                </button>
              )}
              {night.status === NightStatus.CLOSED && night.winnerOptionId > 0 && (
                <button type="button" className="button-outline" disabled={busy} onClick={() => void run(() => nightServiceClient.markHappened({ nightId: night.id }))}>
                  {t.nights.manage.markHappened}
                </button>
              )}
              {open && (
                <button type="button" className="button-quiet" disabled={busy} onClick={() => setConfirming("cancel")}>
                  {t.nights.manage.cancel}
                </button>
              )}
              {!open && (
                <button type="button" className="button-quiet" disabled={busy} onClick={() => setConfirming("delete")}>
                  {t.nights.manage.delete}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
