import { useEffect, useMemo, useRef, useState } from "react";
import { UserProfile } from "@rootsdk/client-app";
import { Night, Title, TitleKind, WatchStatus } from "@notas-app/gen-shared";
import { titleServiceClient } from "@notas-app/gen-client";
import { TitleItem } from "./TitleItem";
import { useI18n } from "./i18n";
import { buildWantList, countWanted, errorMessage, KindInfo, pageSize, titleName, watchStatusOf } from "./lib";

interface Props {
  titles: Title[];
  visibleKinds: KindInfo[];
  me: string;
  isAdmin: boolean;
  profiles: Map<string, UserProfile>;
  openId: number | null;
  onToggle: (id: number) => void;
  onChanged: (title: Title) => void;
  onDeleted: (id: number) => void;
  onError: (message: string) => void;
  // Título -> noite marcada com ele (para o aviso "Noite marcada" na linha).
  scheduled: Map<number, Night>;
  // Abre o formulário de adicionar título na categoria escolhida.
  onAdd: (kind: KindInfo) => void;
}

// A lista da turma: tudo que alguém marcou "quero ver / jogar / ler / ouvir", com quem quer cada título.
// As linhas são as mesmas da tela de notas, então dá para abrir, dar nota e marcar "vendo" ou "já vi" daqui.
export function WantList({ titles, visibleKinds, me, isAdmin, profiles, openId, onToggle, onChanged, onDeleted, onError, scheduled, onAdd }: Props) {
  const { t, lang } = useI18n();
  const [kindFilter, setKindFilter] = useState<TitleKind | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);
  const [limit, setLimit] = useState(pageSize);

  const allowed = useMemo(() => visibleKinds.map((item) => item.kind), [visibleKinds]);
  const counts = useMemo(() => countWanted(titles, allowed, me), [titles, allowed, me]);
  const total = useMemo(() => [...counts.values()].reduce((sum, count) => sum + count, 0), [counts]);
  const items = useMemo(() => buildWantList(titles, allowed, me, { kind: kindFilter, onlyMine }), [titles, allowed, me, kindFilter, onlyMine]);

  // Se o admin desligar a categoria escolhida, volta para "Tudo".
  useEffect(() => {
    if (kindFilter !== null && !allowed.includes(kindFilter)) setKindFilter(null);
  }, [allowed, kindFilter]);

  // Mudou o filtro: volta para a primeira página.
  useEffect(() => setLimit(pageSize), [kindFilter, onlyMine]);

  // Quando eu marco "já vi" ou "joguei", o título sai da minha lista na hora. Avisa quem saiu e dá a chance de desfazer.
  const [gone, setGone] = useState<{ id: number; name: string; previous: WatchStatus } | null>(null);
  const lastShown = useRef<Map<number, Title>>(new Map());

  useEffect(() => {
    const now = new Set(items.map((item) => item.title.id));
    for (const [id, old] of lastShown.current) {
      if (now.has(id)) continue;
      const current = titles.find((title) => title.id === id);
      if (current && watchStatusOf(current, me) === WatchStatus.DONE) {
        setGone({ id, name: titleName(current, lang), previous: watchStatusOf(old, me) });
      }
    }
    lastShown.current = new Map(items.map((item) => [item.title.id, item.title]));
  }, [items, titles, me, lang]);

  useEffect(() => {
    if (!gone) return;
    const timer = setTimeout(() => setGone(null), 10000);
    return () => clearTimeout(timer);
  }, [gone]);

  const undo = async () => {
    if (!gone) return;
    const { id, previous } = gone;
    setGone(null);
    try {
      const response = await titleServiceClient.setWatchStatus({ titleId: id, status: previous });
      if (response.title) onChanged(response.title);
    } catch (error) {
      onError(errorMessage(error, t));
    }
  };

  const chosen = visibleKinds.find((item) => item.kind === kindFilter) ?? null;
  const addTarget = chosen ?? visibleKinds[0];
  const addLabel = chosen ? t.kinds[chosen.key].add : t.toWatch.add;

  return (
    <div className="want">
      <p className="muted want-intro">{t.toWatch.intro}</p>

      <div className="want-bar">
        <div className="want-chips" role="group" aria-label={t.category}>
          <button type="button" className="want-chip" aria-pressed={kindFilter === null} onClick={() => setKindFilter(null)}>
            {t.toWatch.all}
            <span className="tab-count">{total}</span>
          </button>
          {visibleKinds.map((item) => (
            <button key={item.kind} type="button" className="want-chip" aria-pressed={kindFilter === item.kind} onClick={() => setKindFilter(item.kind)}>
              {t.kinds[item.key].tab}
              <span className="tab-count">{counts.get(item.kind) ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="want-actions">
          <button type="button" className="want-chip want-mine" aria-pressed={onlyMine} onClick={() => setOnlyMine((current) => !current)}>
            {onlyMine && <span aria-hidden="true">✓</span>}
            {t.toWatch.onlyMine}
          </button>
          <button type="button" className="button-primary" onClick={() => onAdd(addTarget)}>
            {addLabel}
          </button>
        </div>
      </div>

      {gone && (
        <p className="want-gone" role="status">
          <span>{t.toWatch.gone(gone.name)}</span>
          <button type="button" className="button-quiet" onClick={() => void undo()}>
            {t.toWatch.undo}
          </button>
        </p>
      )}

      {items.length === 0 ? (
        <div className="empty">
          <p>{onlyMine ? t.toWatch.emptyMine : kindFilter !== null && total > 0 ? t.toWatch.emptyKind : t.toWatch.empty}</p>
        </div>
      ) : (
        <>
          <ul className="list">
            {items.slice(0, limit).map((item) => (
              <TitleItem
                key={item.title.id}
                title={item.title}
                me={me}
                isAdmin={isAdmin}
                open={openId === item.title.id}
                profiles={profiles}
                wantedBy={item.wanters}
                showWatch
                scheduled={scheduled.get(item.title.id)}
                onToggle={() => onToggle(item.title.id)}
                onChanged={onChanged}
                onDeleted={onDeleted}
                onError={onError}
              />
            ))}
          </ul>

          {items.length > limit && (
            <div className="show-more">
              <button type="button" className="button-outline" onClick={() => setLimit((current) => current + pageSize)}>
                {t.showMore(items.length - limit)}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
