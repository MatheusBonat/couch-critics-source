import { useEffect, useId, useState } from "react";
import { UserProfile } from "@rootsdk/client-app";
import { Episode, EpisodeListResponse, SearchStatus, Title, TitleKind } from "@notas-app/gen-shared";
import { titleServiceClient, TitleServiceClientEvent } from "@notas-app/gen-client";
import { RatingForm } from "./RatingEditor";
import { VoteList } from "./VoteList";
import { useI18n } from "./i18n";
import { averageOf, episodeName, episodeOutsideRating, errorMessage, formatAirDate, formatScore, ratingLabel } from "./lib";

interface Props {
  title: Title;
  me: string;
  isAdmin: boolean;
  profiles: Map<string, UserProfile>;
  onTitleChanged: (title: Title) => void;
  onError: (message: string) => void;
}

const keyOf = (episode: Episode) => `${episode.season}:${episode.number}`;

// Episódios de uma série do TMDB: a lista por temporada, a nota do IMDb (ou a do TMDB, quando o IMDb
// não tem) e a nota de cada membro por episódio.
export function EpisodesPanel({ title, me, isAdmin, profiles, onTitleChanged, onError }: Props) {
  const { t, lang } = useI18n();
  const id = useId();

  const [open, setOpen] = useState(false);
  const [season, setSeason] = useState(0);
  const [data, setData] = useState<EpisodeListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [openEpisode, setOpenEpisode] = useState<string | null>(null);
  // Anime tem uma lista só, sem temporadas: o episódio aparece como "E5" e, sem nome na fonte, como "Episódio 5".
  const isAnime = title.kind === TitleKind.ANIME;

  const load = (wanted: number) => {
    setLoading(true);
    setFailed(false);
    titleServiceClient
      .listEpisodes({ titleId: title.id, season: wanted })
      .then((response) => {
        setData(response);
        setSeason(response.season);
        setOpenEpisode(null);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open && data === null && !loading) load(season);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Notas de outros membros chegam em tempo real.
  useEffect(() => {
    if (!open) return;

    const onEpisodeUpdated = (event: { titleId: number; episode?: Episode }) => {
      const updated = event.episode;
      if (event.titleId !== title.id || !updated) return;

      setData((current) => {
        if (!current || current.season !== updated.season) return current;
        return {
          ...current,
          episodes: current.episodes.map((episode) => (episode.number === updated.number ? updated : episode)),
        };
      });
    };

    titleServiceClient.on(TitleServiceClientEvent.EpisodeUpdated, onEpisodeUpdated);
    return () => {
      titleServiceClient.off(TitleServiceClientEvent.EpisodeUpdated, onEpisodeUpdated);
    };
  }, [open, title.id]);

  const replaceEpisode = (updated: Episode) =>
    setData((current) =>
      current ? { ...current, episodes: current.episodes.map((episode) => (episode.number === updated.number ? updated : episode)) } : current,
    );

  // Moderação: o admin apaga o texto do comentário de outra pessoa neste episódio; a nota fica.
  const removeComment = async (episode: Episode, userId: string) => {
    try {
      const response = await titleServiceClient.removeComment({ titleId: title.id, userId, season: episode.season, number: episode.number });
      if (response.episode) replaceEpisode(response.episode);
      if (response.title) onTitleChanged(response.title);
    } catch (error) {
      onError(errorMessage(error, t));
    }
  };

  // Reagir à nota de outra pessoa neste episódio (clicar de novo no mesmo emoji tira a reação).
  const react = async (episode: Episode, ratingUserId: string, emoji: string) => {
    try {
      const response = await titleServiceClient.react({ titleId: title.id, season: episode.season, number: episode.number, ratingUserId, emoji });
      if (response.episode) replaceEpisode(response.episode);
      if (response.title) onTitleChanged(response.title);
    } catch (error) {
      onError(errorMessage(error, t));
    }
  };

  const statusMessage =
    data === null
      ? null
      : data.status === SearchStatus.NOT_AVAILABLE
        ? t.episodes.notAvailable
        : data.status === SearchStatus.NOT_CONFIGURED
          ? t.episodes.notConfigured
          : data.status === SearchStatus.INVALID_KEY
            ? t.episodes.invalidKey
            : data.status === SearchStatus.RATE_LIMITED
              ? t.episodes.rateLimited
              : data.status === SearchStatus.UNAVAILABLE
                ? t.episodes.unavailable
                : null;

  if (!open) {
    return (
      <div className="episodes-closed">
        <button type="button" className="button-outline" aria-expanded={false} onClick={() => setOpen(true)}>
          {t.episodes.open}
        </button>
      </div>
    );
  }

  return (
    <section className="episodes" aria-labelledby={`${id}-title`}>
      <div className="episodes-head">
        <h3 id={`${id}-title`} className="episodes-title">
          {t.episodes.list}
        </h3>
        <button type="button" className="button-quiet" aria-expanded onClick={() => setOpen(false)}>
          {t.episodes.close}
        </button>
      </div>

      {title.episodesRated > 0 && <p className="muted">{t.episodes.average(formatScore(title.episodesAvg, t.locale), title.episodesRated)}</p>}

      {data && data.seasons.length > (isAnime ? 1 : 0) && (
        <div className="field season-field">
          <label htmlFor={`${id}-season`}>{isAnime ? t.episodes.rangeLabel : t.episodes.seasonLabel}</label>
          <select id={`${id}-season`} className="input" value={season} disabled={loading} onChange={(event) => load(Number(event.target.value))}>
            {data.seasons.map((item, index) => {
              // Anime: cada "temporada" é uma faixa de episódios; o início é a soma das faixas anteriores.
              const from = data.seasons.slice(0, index).reduce((sum, previous) => sum + previous.episodeCount, 0) + 1;
              return (
                <option key={item.number} value={item.number}>
                  {isAnime ? t.episodes.animeRange(from, from + item.episodeCount - 1) : t.episodes.seasonOption(item.number, item.episodeCount)}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {loading && (
        <ul className="episode-list" aria-hidden="true">
          {[0, 1, 2].map((item) => (
            <li key={item} className="episode episode-skeleton">
              <span className="skeleton skeleton-name" />
            </li>
          ))}
        </ul>
      )}

      {!loading && failed && (
        <div className="empty empty-compact">
          <p>{t.episodes.unavailable}</p>
          <button type="button" className="button-outline" onClick={() => load(season)}>
            {t.tryAgain}
          </button>
        </div>
      )}

      {!loading && !failed && statusMessage && (
        <div className="empty empty-compact">
          <p>{statusMessage}</p>
          {(data?.status === SearchStatus.UNAVAILABLE || data?.status === SearchStatus.RATE_LIMITED) && (
            <button type="button" className="button-outline" onClick={() => load(season)}>
              {t.tryAgain}
            </button>
          )}
        </div>
      )}

      {!loading && !failed && data && !statusMessage && data.episodes.length === 0 && <p className="muted">{t.episodes.empty}</p>}

      {!loading && !failed && data && !statusMessage && data.episodes.length > 0 && (
        <ul className="episode-list">
          {data.episodes.map((episode) => {
            const key = keyOf(episode);
            const expanded = openEpisode === key;
            const avg = averageOf(episode.ratings);
            const mine = episode.ratings.find((rating) => rating.userId === me);
            const outside = episodeOutsideRating(episode);
            const aired = formatAirDate(episode.airDate, t.locale);
            const bodyId = `${id}-${key.replace(":", "-")}`;

            return (
              <li key={key} className="episode">
                <button
                  type="button"
                  className="episode-head"
                  aria-expanded={expanded}
                  aria-controls={bodyId}
                  onClick={() => setOpenEpisode(expanded ? null : key)}
                >
                  <span className="episode-code">{isAnime ? t.episodes.animeCode(episode.number) : t.episodes.code(episode.season, episode.number)}</span>

                  <span className="episode-main">
                    <span className="episode-name">{episodeName(episode, lang) || t.episodes.animeName(episode.number)}</span>
                    {aired && <span className="episode-meta">{aired}</span>}
                  </span>

                  <span className="episode-outside">
                    {outside &&
                      (outside.source === "imdb" ? (
                        <span className="outside">
                          {t.imdbLabel} {formatScore(outside.value, t.locale)}
                        </span>
                      ) : (
                        <span className="outside outside-alt" title={t.episodes.tmdbTitle(formatScore(outside.value, t.locale), episode.tmdbVotes)}>
                          {t.episodes.tmdbLabel} {formatScore(outside.value, t.locale)}
                        </span>
                      ))}
                  </span>

                  <span className="episode-side">
                    <span className="episode-avg">
                      {avg === null ? t.noRatings : `${formatScore(avg, t.locale)}, ${t.ratingCount(episode.ratings.length)}`}
                    </span>
                    <span className={mine ? "mine" : "mine mine-empty"}>{mine ? t.yourRatingValue(ratingLabel(mine, t)) : t.rate}</span>
                  </span>
                </button>

                {expanded && (
                  <div className="episode-body" id={bodyId}>
                    {episode.ratings.length > 0 && (
                      <VoteList
                        ratings={episode.ratings}
                        me={me}
                        profiles={profiles}
                        onRemoveComment={isAdmin ? (userId) => removeComment(episode, userId) : undefined}
                        onReact={(ratingUserId, emoji) => react(episode, ratingUserId, emoji)}
                      />
                    )}

                    <RatingForm
                      key={mine ? `${mine.score}-${mine.tier}-${mine.comment}-${mine.spoiler}` : "new"}
                      mine={mine}
                      onError={onError}
                      save={async (input) => {
                        const response = await titleServiceClient.rateEpisode({
                          titleId: title.id,
                          season: episode.season,
                          number: episode.number,
                          ...input,
                        });
                        if (response.episode) replaceEpisode(response.episode);
                        if (response.title) onTitleChanged(response.title);
                      }}
                      clear={async () => {
                        const response = await titleServiceClient.clearEpisodeRating({
                          titleId: title.id,
                          season: episode.season,
                          number: episode.number,
                        });
                        if (response.episode) replaceEpisode(response.episode);
                        if (response.title) onTitleChanged(response.title);
                      }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
