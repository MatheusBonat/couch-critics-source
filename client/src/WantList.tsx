import { useEffect, useMemo, useState } from "react";
import { UserProfile } from "@rootsdk/client-app";
import { Night, Title, TitleKind } from "@notas-app/gen-shared";
import { IconToWatch } from "./icons";
import { TitleItem } from "./TitleItem";
import { useI18n } from "./i18n";
import { buildWantList, countWanted, KindInfo, pageSize } from "./lib";

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
  const { t } = useI18n();
  const [kindFilter, setKindFilter] = useState<TitleKind | null>(null);
  const [limit, setLimit] = useState(pageSize);
  const [doneLimit, setDoneLimit] = useState(pageSize);

  const allowed = useMemo(() => visibleKinds.map((item) => item.kind), [visibleKinds]);
  const counts = useMemo(() => countWanted(titles, allowed, me), [titles, allowed, me]);
  const total = useMemo(() => [...counts.values()].reduce((sum, count) => sum + count, 0), [counts]);
  const items = useMemo(() => buildWantList(titles, allowed, me, { kind: kindFilter }), [titles, allowed, me, kindFilter]);
  // Os que eu já vi, joguei, li ou ouvi ficam no fim, numa parte separada.
  const pending = useMemo(() => items.filter((item) => !item.done), [items]);
  const finished = useMemo(() => items.filter((item) => item.done), [items]);

  // Se o admin desligar a categoria escolhida, volta para "Tudo".
  useEffect(() => {
    if (kindFilter !== null && !allowed.includes(kindFilter)) setKindFilter(null);
  }, [allowed, kindFilter]);

  // Mudou o filtro: volta para a primeira página.
  useEffect(() => {
    setLimit(pageSize);
    setDoneLimit(pageSize);
  }, [kindFilter]);

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
          <button type="button" className="button-primary" onClick={() => onAdd(addTarget)}>
            {addLabel}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty">
          <span className="empty-icon">
            <IconToWatch />
          </span>
          <p>{kindFilter !== null && total > 0 ? t.toWatch.emptyKind : t.toWatch.empty}</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <ul className="list">
              {pending.slice(0, limit).map((item) => (
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
          )}

          {pending.length > limit && (
            <div className="show-more">
              <button type="button" className="button-outline" onClick={() => setLimit((current) => current + pageSize)}>
                {t.showMore(pending.length - limit)}
              </button>
            </div>
          )}

          {finished.length > 0 && (
            <section className="want-done" aria-label={t.toWatch.doneTitle}>
              <h3 className="want-done-title">
                {t.toWatch.doneTitle}
                <span className="tab-count">{finished.length}</span>
              </h3>
              <ul className="list">
                {finished.slice(0, doneLimit).map((item) => (
                  <TitleItem
                    key={item.title.id}
                    title={item.title}
                    me={me}
                    isAdmin={isAdmin}
                    open={openId === item.title.id}
                    profiles={profiles}
                    wantedBy={item.wanters}
                    showWatch
                    done
                    scheduled={scheduled.get(item.title.id)}
                    onToggle={() => onToggle(item.title.id)}
                    onChanged={onChanged}
                    onDeleted={onDeleted}
                    onError={onError}
                  />
                ))}
              </ul>
              {finished.length > doneLimit && (
                <div className="show-more">
                  <button type="button" className="button-outline" onClick={() => setDoneLimit((current) => current + pageSize)}>
                    {t.showMore(finished.length - doneLimit)}
                  </button>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
