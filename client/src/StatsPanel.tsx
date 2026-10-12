import { useMemo, useState } from "react";
import { UserProfile } from "@rootsdk/client-app";
import { RatingTier, Title } from "@notas-app/gen-shared";
import { Poster } from "./Poster";
import { useI18n } from "./i18n";
import { displayName } from "./profiles";
import { compatibility, communityOverview, divisiveTitles, memberStats, pairsOf, recapOf, recapYears, scoreDistribution } from "./stats";
import { formatScore, kinds, posterPathOf, ratingLabel, titleName } from "./lib";

interface Props {
  titles: Title[];
  me: string;
  profiles: Map<string, UserProfile>;
  onOpen: (title: Title) => void;
  onClose: () => void;
}

type Tab = "community" | "mine";

// Estatísticas da comunidade (quem pensa parecido, membros, polêmicos, distribuição das notas) e a retrospectiva
// de cada pessoa por ano. Tudo calculado a partir das notas que já estão na lista.
export function StatsPanel({ titles, me, profiles, onOpen, onClose }: Props) {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<Tab>("community");

  const nameOf = (id: string) => (id === me ? t.youTitle : displayName(profiles, id, t.member));

  return (
    <section
      className="panel stats"
      aria-labelledby="stats-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div className="panel-bar">
        <h2 id="stats-title" className="panel-title">
          {t.stats.title}
        </h2>
        <button type="button" className="button-quiet" onClick={onClose}>
          {t.stats.close}
        </button>
      </div>

      <div className="stats-tabs" role="group" aria-label={t.stats.title}>
        <button type="button" className={tab === "community" ? "stats-tab is-active" : "stats-tab"} aria-pressed={tab === "community"} onClick={() => setTab("community")}>
          {t.stats.tabCommunity}
        </button>
        <button type="button" className={tab === "mine" ? "stats-tab is-active" : "stats-tab"} aria-pressed={tab === "mine"} onClick={() => setTab("mine")}>
          {t.stats.tabMine}
        </button>
      </div>

      {tab === "community" ? (
        <Community titles={titles} me={me} nameOf={nameOf} onOpen={onOpen} lang={lang} />
      ) : (
        <MyYear titles={titles} me={me} onOpen={onOpen} lang={lang} />
      )}
    </section>
  );
}

function Community({ titles, me, nameOf, onOpen, lang }: { titles: Title[]; me: string; nameOf: (id: string) => string; onOpen: (title: Title) => void; lang: "pt" | "en" }) {
  const { t } = useI18n();

  const data = useMemo(() => {
    const pairs = compatibility(titles);
    const mineAlike = pairsOf(pairs, me);
    return {
      overview: communityOverview(titles),
      members: memberStats(titles),
      pairs,
      best: mineAlike[0],
      worst: mineAlike.length > 1 ? mineAlike[mineAlike.length - 1] : undefined,
      divisive: divisiveTitles(titles),
      distribution: scoreDistribution(titles),
    };
  }, [titles, me]);

  if (data.overview.ratings === 0) return <p className="muted">{t.stats.nothing}</p>;

  const maxBucket = Math.max(1, ...data.distribution);

  return (
    <div className="stats-body">
      <p>{t.stats.overview(data.overview.titles, data.overview.ratings, data.overview.members, formatScore(data.overview.average ?? 0, t.locale))}</p>

      <div className="stats-section">
        <h3 className="stats-heading">{t.stats.alike}</h3>
        <p className="muted">{t.stats.alikeHint(3)}</p>
        {data.pairs.length === 0 ? (
          <p className="muted">{t.stats.alikeNone}</p>
        ) : (
          <>
            {data.best && <p>{t.stats.mostAlike(nameOf(data.best.other), data.best.similarity, data.best.common)}</p>}
            {data.worst && <p>{t.stats.leastAlike(nameOf(data.worst.other), data.worst.similarity, data.worst.common)}</p>}
            <ol className="stats-list">
              {data.pairs.slice(0, 5).map((pair) => (
                <li key={`${pair.a}|${pair.b}`} className="stats-row">
                  <span>{t.stats.pair(nameOf(pair.a), nameOf(pair.b))}</span>
                  <span className="muted">{t.stats.common(pair.common)}</span>
                  <strong>{pair.similarity}%</strong>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>

      <div className="stats-section">
        <h3 className="stats-heading">{t.stats.members}</h3>
        <ul className="stats-list">
          {data.members.map((member) => (
            <li key={member.userId} className="stats-row">
              <span>{nameOf(member.userId)}</span>
              <span className="muted">
                {[
                  t.stats.memberLine(member.count, formatScore(member.average, t.locale)),
                  member.peaks > 0 ? t.hall.peaks(member.peaks) : "",
                  member.rockBottoms > 0 ? t.hall.bottoms(member.rockBottoms) : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="stats-section">
        <h3 className="stats-heading">{t.stats.divisive}</h3>
        {data.divisive.length === 0 ? (
          <p className="muted">{t.stats.divisiveNone}</p>
        ) : (
          <ul className="stats-list">
            {data.divisive.map((entry) => (
              <li key={entry.title.id}>
                <button type="button" className="stats-open" onClick={() => onOpen(entry.title)}>
                  <Poster path={posterPathOf(entry.title, lang)} name={titleName(entry.title, lang)} alt={t.posterAlt(titleName(entry.title, lang))} />
                  <span className="stats-open-main">
                    <span className="stats-open-name">{titleName(entry.title, lang)}</span>
                    <span className="muted">{t.stats.divisiveLine(formatScore(entry.min, t.locale), formatScore(entry.max, t.locale), entry.count)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="stats-section">
        <h3 className="stats-heading">{t.stats.distribution}</h3>
        <div className="dist" role="img" aria-label={t.stats.distribution}>
          {data.distribution.map((count, bucket) => (
            <div key={bucket} className="dist-col" title={`${bucket}: ${count}`}>
              <span className="dist-count">{count > 0 ? count : ""}</span>
              <span className="dist-bar" style={{ height: `${Math.round((count / maxBucket) * 100)}%` }} />
              <span className="dist-label">{bucket}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MyYear({ titles, me, onOpen, lang }: { titles: Title[]; me: string; onOpen: (title: Title) => void; lang: "pt" | "en" }) {
  const { t } = useI18n();
  const years = useMemo(() => recapYears(titles, me), [titles, me]);
  const [chosen, setChosen] = useState<number | null>(null);

  const year = chosen !== null && years.includes(chosen) ? chosen : (years[0] ?? new Date().getFullYear());
  const recap = useMemo(() => recapOf(titles, me, year), [titles, me, year]);

  const monthName = (month: number) => new Date(2000, month, 1).toLocaleDateString(t.locale, { month: "long" });

  return (
    <div className="stats-body">
      {years.length > 1 && (
        <div className="field stats-year">
          <label htmlFor="stats-year">{t.stats.year}</label>
          <select id="stats-year" className="input" value={year} onChange={(event) => setChosen(Number(event.target.value))}>
            {years.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      )}

      {recap.count === 0 ? (
        <>
          <p>{t.stats.yearNone(year)}</p>
          <p className="muted">{t.stats.yearNote}</p>
        </>
      ) : (
        <>
          <h3 className="stats-heading">{t.stats.yourYear(year)}</h3>

          <div className="cards">
            <div className="card">
              <span className="card-value">{recap.count}</span>
              <span className="card-label">{t.stats.cardRatings}</span>
            </div>
            <div className="card">
              <span className="card-value">{formatScore(recap.average ?? 0, t.locale)}</span>
              <span className="card-label">{t.stats.cardAverage}</span>
            </div>
            <div className="card">
              <span className="card-value">{recap.peaks}</span>
              <span className="card-label">{t.stats.cardPeaks}</span>
            </div>
            <div className="card">
              <span className="card-value">{recap.rockBottoms}</span>
              <span className="card-label">{t.stats.cardBottoms}</span>
            </div>
          </div>

          <div className="stats-section">
            <h3 className="stats-heading">{t.stats.byKind}</h3>
            <p className="muted">
              {kinds
                .filter((item) => (recap.byKind[item.kind] ?? 0) > 0)
                .map((item) => `${t.kinds[item.key].tab}: ${recap.byKind[item.kind]}`)
                .join(" · ")}
            </p>
          </div>

          <div className="stats-section">
            <h3 className="stats-heading">{t.stats.top}</h3>
            <ol className="stats-list">
              {recap.top.map((entry) => (
                <li key={entry.title.id}>
                  <button type="button" className="stats-open" onClick={() => onOpen(entry.title)}>
                    <Poster path={posterPathOf(entry.title, lang)} name={titleName(entry.title, lang)} alt={t.posterAlt(titleName(entry.title, lang))} />
                    <span className="stats-open-main">
                      <span className="stats-open-name">{titleName(entry.title, lang)}</span>
                    </span>
                    <span className={entry.rating.tier === RatingTier.PEAK ? "tier tier-peak" : entry.rating.tier === RatingTier.ROCK_BOTTOM ? "tier tier-bottom" : "stats-score"}>
                      {ratingLabel(entry.rating, t)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>

          {recap.hottest && (
            <div className="stats-section">
              <h3 className="stats-heading">{t.stats.hottest}</h3>
              <button type="button" className="stats-open" onClick={() => onOpen(recap.hottest!.title)}>
                <Poster path={posterPathOf(recap.hottest.title, lang)} name={titleName(recap.hottest.title, lang)} alt={t.posterAlt(titleName(recap.hottest.title, lang))} />
                <span className="stats-open-main">
                  <span className="stats-open-name">{titleName(recap.hottest.title, lang)}</span>
                  <span className="muted">
                    {t.stats.hottestLine(
                      ratingLabel(recap.hottest.rating, t),
                      formatScore(recap.hottest.rating.score - recap.hottest.diff, t.locale),
                      recap.hottest.others,
                    )}
                  </span>
                </span>
              </button>
            </div>
          )}

          {recap.busiestMonth && (
            <div className="stats-section">
              <h3 className="stats-heading">{t.stats.busiest}</h3>
              <p>{t.stats.busiestLine(monthName(recap.busiestMonth.month), recap.busiestMonth.count)}</p>
            </div>
          )}

          <p className="muted">{t.stats.yearNote}</p>
        </>
      )}
    </div>
  );
}
