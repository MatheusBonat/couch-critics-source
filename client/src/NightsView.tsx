import { useEffect, useMemo, useState } from "react";
import { UserProfile } from "@rootsdk/client-app";
import { Night, Title } from "@notas-app/gen-shared";
import { NightCard } from "./NightCard";
import { NightForm } from "./NightForm";
import { useI18n } from "./i18n";
import { IconParty } from "./icons";
import { KindInfo } from "./lib";
import { groupNights, NightGroup } from "./nights";

interface Props {
  nights: Night[] | null;
  hasMoreNights: boolean;
  loadingMore: boolean;
  loadFailed: boolean;
  titles: Title[];
  visibleKinds: KindInfo[];
  me: string;
  isAdmin: boolean;
  profiles: Map<string, UserProfile>;
  onNightChanged: (night: Night) => void;
  onNightDeleted: (id: number) => void;
  onTitleChanged: (title: Title) => void;
  onOpenTitle: (title: Title) => void;
  onLoadMore: () => void;
  onRetry: () => void;
  onError: (message: string) => void;
}

const groupOrder: NightGroup[] = ["voting", "decided", "tie", "past"];

// A visão "Noite": as noites abertas (votando, marcadas, esperando desempate) e as anteriores, e o botão de criar uma nova.
export function NightsView({
  nights,
  hasMoreNights,
  loadingMore,
  loadFailed,
  titles,
  visibleKinds,
  me,
  isAdmin,
  profiles,
  onNightChanged,
  onNightDeleted,
  onTitleChanged,
  onOpenTitle,
  onLoadMore,
  onRetry,
  onError,
}: Props) {
  const { t } = useI18n();
  const [creating, setCreating] = useState(false);

  // O relógio da tela: o "faltam 3 h" e o fim do prazo de votação se atualizam sozinhos, a cada 20 segundos.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(timer);
  }, []);

  const titleById = useMemo(() => new Map(titles.map((title) => [title.id, title])), [titles]);
  const allowedKinds = useMemo(() => visibleKinds.map((item) => item.kind), [visibleKinds]);
  const groups = useMemo(() => groupNights(nights ?? []), [nights]);

  return (
    <div className="nights">
      <p className="muted want-intro">{t.nights.intro}</p>

      {!creating && (
        <div>
          <button type="button" className="button-primary" onClick={() => setCreating(true)}>
            {t.nights.new}
          </button>
        </div>
      )}

      {creating && (
        <NightForm
          titles={titles}
          allowedKinds={allowedKinds}
          me={me}
          now={now}
          onCreated={(night) => {
            onNightChanged(night);
            setCreating(false);
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {loadFailed ? (
        <div className="empty">
          <button type="button" className="button-outline" onClick={onRetry}>
            {t.tryAgain}
          </button>
        </div>
      ) : nights === null ? (
        <ul className="list" aria-hidden="true">
          {[0, 1].map((item) => (
            <li key={item} className="title title-skeleton">
              <span className="skeleton skeleton-score" />
              <span className="skeleton skeleton-name" />
            </li>
          ))}
        </ul>
      ) : nights.length === 0 ? (
        !creating && (
          <div className="empty">
            <span className="empty-icon">
              <IconParty />
            </span>
            <p>{t.nights.empty}</p>
          </div>
        )
      ) : (
        groupOrder.map((group) =>
          groups[group].length === 0 ? null : (
            <section key={group} className="night-group" aria-label={t.nights.groups[group]}>
              <h2 className="night-group-title">{t.nights.groups[group]}</h2>
              <ul className="night-list">
                {groups[group].map((night) => (
                  <NightCard
                    key={night.id}
                    night={night}
                    titleOf={(id) => titleById.get(id)}
                    me={me}
                    isAdmin={isAdmin}
                    profiles={profiles}
                    now={now}
                    onChanged={onNightChanged}
                    onDeleted={onNightDeleted}
                    onTitleChanged={onTitleChanged}
                    onOpenTitle={onOpenTitle}
                    onError={onError}
                  />
                ))}
              </ul>
            </section>
          )
        )
      )}

      {hasMoreNights && (
        <div className="show-more">
          <button type="button" className="button-outline" disabled={loadingMore} onClick={onLoadMore}>
            {t.nights.showPrevious}
          </button>
        </div>
      )}
    </div>
  );
}
