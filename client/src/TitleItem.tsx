import { CSSProperties, useState } from "react";
import { UserProfile } from "@rootsdk/client-app";
import { Night, Rating, RatingTier, Title, TitleKind, WatchStatus } from "@notas-app/gen-shared";
import { titleServiceClient } from "@notas-app/gen-client";
import { EditTitleForm } from "./EditTitleForm";
import { FranchiseForm } from "./FranchiseForm";
import { EpisodesPanel } from "./EpisodesPanel";
import { Poster } from "./Poster";
import { RatingEditor } from "./RatingEditor";
import { TitleDetails } from "./TitleDetails";
import { VoteList } from "./VoteList";
import { WatchControls } from "./WatchControls";
import { useI18n } from "./i18n";
import { Avatar, displayName } from "./profiles";
import { formatWhen } from "./nights";
import { average, errorMessage, findRating, formatScore, kinds, posterPathOf, ratingLabel, ratingRank, titleName, watchStatusOf } from "./lib";

interface Props {
  title: Title;
  me: string;
  isAdmin: boolean;
  open: boolean;
  profiles: Map<string, UserProfile>;
  onToggle: () => void;
  onChanged: (title: Title) => void;
  onDeleted: (id: number) => void;
  onError: (message: string) => void;
  // Na lista "Para ver / jogar": quem quer este título, mostrado na linha.
  wantedBy?: string[];
  // A noite marcada em que este título foi o escolhido (decidida e ainda por acontecer).
  scheduled?: Night;
  // O estado "quero ver / vendo / já vi" só aparece na lista "Para ver / jogar", não na tela de notas.
  showWatch?: boolean;
  // Na lista "Para ver / jogar": quem está usando já viu, jogou, leu ou ouviu este título (a linha fica esmaecida, no fim da lista).
  done?: boolean;
  // Franquias que a comunidade já tem, para sugerir ao escrever a franquia do título.
  franchiseNames?: string[];
}

export function TitleItem({ title, me, isAdmin, open, profiles, onToggle, onChanged, onDeleted, onError, wantedBy, scheduled, showWatch = false, done = false, franchiseNames = [] }: Props) {
  const { t, lang } = useI18n();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingFranchise, setEditingFranchise] = useState(false);

  const avg = average(title);
  const name = titleName(title, lang);
  const imdb = title.imdbRating > 0 ? formatScore(title.imdbRating, t.locale) : null;
  const mine = findRating(title, me);
  const votes = [...title.ratings].sort((a, b) => ratingRank(b) - ratingRank(a));
  const bodyId = `title-body-${title.id}`;
  const creator = title.createdBy === me ? t.you : displayName(profiles, title.createdBy, t.member);
  // Episódios: séries do TMDB e animes da AniList.
  const hasEpisodes = (title.kind === TitleKind.SERIES && title.source === "tmdb") || (title.kind === TitleKind.ANIME && title.source === "anilist");

  // Quem adicionou o título ou um admin pode editar (só os feitos à mão) e remover.
  const canManage = title.createdBy === me || isAdmin;
  const canEdit = canManage && title.source === "manual";

  const tierClass = (rating: Rating) =>
    rating.tier === RatingTier.PEAK ? " tier tier-peak" : rating.tier === RatingTier.ROCK_BOTTOM ? " tier tier-bottom" : "";

  const nameOf = (rating: Rating) => (rating.userId === me ? t.youTitle : displayName(profiles, rating.userId, t.member));

  // "3 querem: Ana, Bruno, você e mais 1": os quatro primeiros nomes, quem está usando como "você".
  const wantLine = (userIds: string[]) => {
    const names = userIds.map((id) => (id === me ? t.youTitle : displayName(profiles, id, t.member)));
    const shown = names.slice(0, 4).join(", ");
    return t.toWatch.wantedBy(names.length, names.length > 4 ? `${shown} ${t.toWatch.moreNames(names.length - 4)}` : shown);
  };

  const maxChips = 4;
  const chips = votes.slice(0, maxChips);
  const hiddenChips = votes.length - chips.length;

  const remove = async () => {
    setDeleting(true);
    try {
      await titleServiceClient.delete({ id: title.id });
      onDeleted(title.id);
    } catch (error) {
      onError(errorMessage(error, t));
      setDeleting(false);
    }
  };

  // Reagir à nota de outra pessoa (clicar de novo no mesmo emoji tira a reação).
  const react = async (ratingUserId: string, emoji: string) => {
    try {
      const response = await titleServiceClient.react({ titleId: title.id, season: 0, number: 0, ratingUserId, emoji });
      if (response.title) onChanged(response.title);
    } catch (error) {
      onError(errorMessage(error, t));
    }
  };

  // O estado que eu marquei (quero ver, vendo, já vi), mostrado na linha.
  const myStatus = watchStatusOf(title, me);
  const kindKey = kinds.find((item) => item.kind === title.kind)?.key ?? "movie";
  const statusLabel =
    myStatus === WatchStatus.WANT
      ? t.watch.labels[kindKey].want
      : myStatus === WatchStatus.DOING
        ? t.watch.labels[kindKey].doing
        : myStatus === WatchStatus.DONE
          ? t.watch.labels[kindKey].done
          : "";

  // Moderação: o admin apaga o texto do comentário de outra pessoa; a nota fica.
  const removeComment = async (userId: string) => {
    try {
      const response = await titleServiceClient.removeComment({ titleId: title.id, userId, season: 0, number: 0 });
      if (response.title) onChanged(response.title);
    } catch (error) {
      onError(errorMessage(error, t));
    }
  };

  return (
    <li className={done ? "title title-done" : "title"} id={`title-${title.id}`}>
      <button type="button" className="title-head" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
        <span className="score-col">
          <span
            className={avg === null ? "score score-none" : "score"}
            style={avg === null ? undefined : ({ "--p": Math.max(0, Math.min(100, avg * 10)) } as CSSProperties)}
          >
            {avg === null ? "-" : formatScore(avg, t.locale)}
          </span>
          {imdb && (
            <span className="imdb" title={t.imdbTitle(imdb, title.imdbVotes)}>
              {t.imdbLabel} {imdb}
            </span>
          )}
        </span>

        <Poster path={posterPathOf(title, lang)} name={name} alt={t.posterAlt(name)} />

        <span className="title-main">
          <span className="title-name">{name}</span>
          <span className="title-meta">{title.creator ? `${title.creator} · ${t.addedByLine(title.year, creator)}` : t.addedByLine(title.year, creator)}</span>
          {wantedBy && wantedBy.length > 0 && <span className="want-line">{wantLine(wantedBy)}</span>}
          {scheduled && <span className="night-flag">{t.nights.scheduled(formatWhen(scheduled.startsAt, t.locale))}</span>}
          {chips.length > 0 && (
            <span className="chips">
              {chips.map((vote, index) => (
                <span
                  key={vote.userId}
                  className={`chip${tierClass(vote)}${index >= 3 ? " chip-wide-only" : ""}`}
                  title={t.memberRating(nameOf(vote), ratingLabel(vote, t))}
                >
                  <Avatar profile={profiles.get(vote.userId)} small />
                  <span className="chip-score">
                    {vote.tier === RatingTier.ROCK_BOTTOM ? formatScore(0, t.locale) : ratingLabel(vote, t)}
                  </span>
                </span>
              ))}
              {hiddenChips > 0 && <span className="chip-more chip-more-wide">{t.moreRatings(hiddenChips)}</span>}
              {votes.length > 3 && (
                <span className="chip-more chip-more-narrow">{t.moreRatings(votes.length - 3)}</span>
              )}
            </span>
          )}
        </span>

        <span className="title-side">
          <span>{title.ratings.length === 0 ? t.noRatings : t.ratingCount(title.ratings.length)}</span>
          <span className={mine ? "mine" : "mine mine-empty"}>
            {mine ? t.yourRatingValue(ratingLabel(mine, t)) : t.rate}
          </span>
          {hasEpisodes && title.episodesRated > 0 && (
            <span className="episodes-summary">{t.episodes.summary(formatScore(title.episodesAvg, t.locale))}</span>
          )}
          {showWatch && statusLabel && <span className="watch-pill">{statusLabel}</span>}
        </span>
      </button>

      {open && (
        <div className="title-body" id={bodyId}>
          <TitleDetails title={title} />

          {votes.length > 0 ? (
            <VoteList ratings={title.ratings} me={me} profiles={profiles} onRemoveComment={isAdmin ? removeComment : undefined} onReact={react} />
          ) : (
            <p className="muted">{t.nobodyRated}</p>
          )}

          {showWatch && <WatchControls title={title} me={me} profiles={profiles} onChanged={onChanged} onError={onError} />}

          <RatingEditor
            key={mine ? `${mine.score}-${mine.tier}-${mine.comment}-${mine.spoiler}` : "new"}
            title={title}
            mine={mine}
            onSaved={onChanged}
            onError={onError}
          />

          {hasEpisodes && (
            <EpisodesPanel title={title} me={me} isAdmin={isAdmin} profiles={profiles} onTitleChanged={onChanged} onError={onError} />
          )}

          {editing && (
            <EditTitleForm
              title={title}
              onSaved={(updated) => {
                onChanged(updated);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          )}

          {editingFranchise && (
            <FranchiseForm
              title={title}
              suggestions={franchiseNames}
              onSaved={(updated) => {
                onChanged(updated);
                setEditingFranchise(false);
              }}
              onCancel={() => setEditingFranchise(false)}
            />
          )}

          {canManage && !editing && !editingFranchise && (
            <div className="danger-zone">
              {confirmingDelete ? (
                <>
                  <p className="muted">{t.removeWarning(title.ratings.length)}</p>
                  <div className="actions">
                    <button type="button" className="button-danger" disabled={deleting} onClick={() => void remove()}>
                      {t.removeTitle}
                    </button>
                    <button
                      type="button"
                      className="button-quiet"
                      disabled={deleting}
                      onClick={() => setConfirmingDelete(false)}
                    >
                      {t.cancel}
                    </button>
                  </div>
                </>
              ) : (
                <div className="actions">
                  {canEdit && (
                    <button type="button" className="button-quiet" onClick={() => setEditing(true)}>
                      {t.edit.open}
                    </button>
                  )}
                  <button type="button" className="button-quiet" onClick={() => setEditingFranchise(true)}>
                    {title.franchise ? t.franchise.change : t.franchise.set}
                  </button>
                  <button type="button" className="button-quiet" onClick={() => setConfirmingDelete(true)}>
                    {t.removeTitle}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
