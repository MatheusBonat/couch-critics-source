import { UserProfile } from "@rootsdk/client-app";
import { CloseButton } from "./CloseButton";
import { RatingTier, Title } from "@notas-app/gen-shared";
import { Poster } from "./Poster";
import { useI18n } from "./i18n";
import { displayName } from "./profiles";
import { HallEntry, hallOf, kinds, posterPathOf, titleName } from "./lib";

interface Props {
  titles: Title[];
  me: string;
  profiles: Map<string, UserProfile>;
  onOpen: (title: Title) => void;
  onClose: () => void;
}

// Hall da fama (mais notas Peak) e hall da vergonha (mais notas Rock Bottom), de todas as categorias.
export function HallPanel({ titles, me, profiles, onOpen, onClose }: Props) {
  const { t, lang } = useI18n();

  const section = (heading: string, hint: string, empty: string, entries: HallEntry[], countText: (count: number) => string) => (
    <div className="hall-section">
      <h3 className="hall-heading">{heading}</h3>
      <p className="muted">{hint}</p>

      {entries.length === 0 ? (
        <p className="muted hall-empty">{empty}</p>
      ) : (
        <ol className="hall-list">
          {entries.map((entry) => {
            const name = titleName(entry.title, lang);
            const kind = kinds.find((item) => item.kind === entry.title.kind);
            const who = entry.userIds.map((id) => (id === me ? t.youTitle : displayName(profiles, id, t.member))).join(", ");

            return (
              <li key={entry.title.id}>
                <button type="button" className="hall-entry" onClick={() => onOpen(entry.title)}>
                  <Poster path={posterPathOf(entry.title, lang)} name={name} alt={t.posterAlt(name)} />
                  <span className="hall-main">
                    <span className="hall-name">{name}</span>
                    <span className="hall-meta">{[kind ? t.kinds[kind.key].tab : "", entry.title.year > 0 ? String(entry.title.year) : ""].filter(Boolean).join(", ")}</span>
                    <span className="hall-who">{t.hall.by(who)}</span>
                  </span>
                  <span className="hall-count">{countText(entry.count)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );

  return (
    <section
      className="panel hall"
      aria-labelledby="hall-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div className="panel-bar">
        <h2 id="hall-title" className="panel-title">
          {t.hall.title}
        </h2>
        <CloseButton label={t.hall.close} onClick={onClose} />
      </div>

      {section(t.hall.fame, t.hall.fameHint, t.hall.emptyFame, hallOf(titles, RatingTier.PEAK), t.hall.peaks)}
      {section(t.hall.shame, t.hall.shameHint, t.hall.emptyShame, hallOf(titles, RatingTier.ROCK_BOTTOM), t.hall.bottoms)}
    </section>
  );
}
