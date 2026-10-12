import { useState } from "react";
import { UserProfile } from "@rootsdk/client-app";
import { Rating, RatingTier } from "@notas-app/gen-shared";
import { Avatar, displayName } from "./profiles";
import { useI18n } from "./i18n";
import { formatRatedDate, ratingLabel, ratingRank, reactionEmojis } from "./lib";

interface Props {
  ratings: Rating[];
  me: string;
  profiles: Map<string, UserProfile>;
  // Só para admins: mostra "Remover comentário" nos comentários dos outros. Quem chama trata os erros.
  onRemoveComment?: (userId: string) => Promise<void>;
  // Liga ou desliga a reação de quem está usando a uma nota de outra pessoa. Quem chama trata os erros.
  onReact?: (ratingUserId: string, emoji: string) => Promise<void>;
}

// Comentário de uma nota. Com spoiler, fica escondido até alguém clicar.
function Comment({ vote, onRemove }: { vote: Rating; onRemove?: () => Promise<void> }) {
  const { t } = useI18n();
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!vote.comment) return null;

  const remove = async () => {
    if (!onRemove) return;
    setBusy(true);
    try {
      await onRemove();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {vote.spoiler && !revealed ? (
        <button type="button" className="spoiler-button" onClick={() => setRevealed(true)}>
          {t.spoiler.hidden}
        </button>
      ) : (
        <span className="vote-comment">{vote.comment}</span>
      )}
      {onRemove && (
        <button type="button" className="button-quiet vote-remove" disabled={busy} onClick={() => void remove()}>
          {t.moderation.removeComment}
        </button>
      )}
    </>
  );
}

// Reações com emoji a uma nota. Dá para reagir às notas dos outros (clicar de novo tira); a própria nota só mostra as reações.
function Reactions({
  vote,
  me,
  profiles,
  onReact,
}: {
  vote: Rating;
  me: string;
  profiles: Map<string, UserProfile>;
  onReact?: (ratingUserId: string, emoji: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  const canReact = onReact !== undefined && vote.userId !== me;
  if (vote.reactions.length === 0 && !canReact) return null;

  const toggle = async (emoji: string) => {
    if (!onReact) return;
    setBusy(true);
    try {
      await onReact(vote.userId, emoji);
    } finally {
      setBusy(false);
      setPicking(false);
    }
  };

  const namesOf = (userIds: string[]) => userIds.map((id) => (id === me ? t.youTitle : displayName(profiles, id, t.member))).join(", ");

  return (
    <div className="reactions">
      {vote.reactions.map((reaction) => {
        const mine = reaction.userIds.includes(me);
        return (
          <button
            key={reaction.emoji}
            type="button"
            className={mine ? "reaction reaction-mine" : "reaction"}
            aria-pressed={mine}
            disabled={!canReact || busy}
            title={t.reactions.by(reaction.emoji, namesOf(reaction.userIds))}
            onClick={() => void toggle(reaction.emoji)}
          >
            <span aria-hidden="true">{reaction.emoji}</span> {reaction.userIds.length}
          </button>
        );
      })}

      {canReact && (
        <button
          type="button"
          className="reaction reaction-add"
          aria-expanded={picking}
          aria-label={t.reactions.add}
          title={t.reactions.add}
          onClick={() => setPicking((current) => !current)}
        >
          +
        </button>
      )}

      {picking && (
        <span className="reaction-picker" role="group" aria-label={t.reactions.pick}>
          {reactionEmojis.map((emoji) => (
            <button key={emoji} type="button" className="reaction" disabled={busy} aria-label={emoji} onClick={() => void toggle(emoji)}>
              {emoji}
            </button>
          ))}
        </span>
      )}
    </div>
  );
}

// Quem deu qual nota, da maior para a menor. Serve para o título e para cada episódio.
export function VoteList({ ratings, me, profiles, onRemoveComment, onReact }: Props) {
  const { t } = useI18n();
  const votes = [...ratings].sort((a, b) => ratingRank(b) - ratingRank(a));

  const tierClass = (rating: Rating) =>
    rating.tier === RatingTier.PEAK ? " tier tier-peak" : rating.tier === RatingTier.ROCK_BOTTOM ? " tier tier-bottom" : "";

  return (
    <ul className="votes" aria-label={t.memberRatings}>
      {votes.map((vote) => {
        const date = formatRatedDate(vote.ratedAt, t.locale);
        return (
          <li key={vote.userId} className="vote">
            <Avatar profile={profiles.get(vote.userId)} />
            <div className="vote-text">
              <span className="vote-name">{vote.userId === me ? t.youTitle : displayName(profiles, vote.userId, t.member)}</span>
              <Comment vote={vote} onRemove={onRemoveComment && vote.userId !== me ? () => onRemoveComment(vote.userId) : undefined} />
              <Reactions vote={vote} me={me} profiles={profiles} onReact={onReact} />
            </div>
            <span className={`vote-score${tierClass(vote)}`} title={date ? t.ratedOn(date) : undefined}>
              {ratingLabel(vote, t)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
