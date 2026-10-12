import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { rootClient } from "@rootsdk/client-app";
import { titleServiceClient, TitleServiceClientEvent } from "@notas-app/gen-client";
import { KeyStatus, Title, TitleCreatedEvent, TitleDeletedEvent, TitleKind, TitleUpdatedEvent } from "@notas-app/gen-shared";
import { AboutPanel } from "./AboutPanel";
import { AddTitle } from "./AddTitle";
import { HallPanel } from "./HallPanel";
import { ImportPanel } from "./ImportPanel";
import { StatsPanel } from "./StatsPanel";
import { SettingsPanel, SettingsView } from "./SettingsPanel";
import { TitleItem } from "./TitleItem";
import { Lang, useI18n } from "./i18n";
import { displayName, useProfiles } from "./profiles";
import {
  buildCsv,
  downloadCsv,
  errorMessage,
  FilterKey,
  kinds,
  matchesFilter,
  optionalKinds,
  searchKey,
  SortKey,
  sortTitles,
  titleMatches,
  upsertTitle,
  applyTitleEvents,
  loadAllTitles,
  TitleEvent,
} from "./lib";

// Quantos títulos a lista mostra de cada vez. "Mostrar mais" abre os próximos.
const pageSize = 30;
const showAllTitles = Number.MAX_SAFE_INTEGER;

const sortKeys: SortKey[] = ["recent", "best", "most", "yearNew", "yearOld"];

const languages: { lang: Lang; label: string; name: string }[] = [
  { lang: "pt", label: "PT", name: "Português" },
  { lang: "en", label: "EN", name: "English" },
];

type PanelKey = "none" | "settings" | "about" | "hall" | "stats" | "import";

const App = () => {
  const me = String(rootClient.users.getCurrentUserId());
  const { t, lang, setLang } = useI18n();

  const [titles, setTitles] = useState<Title[] | null>(null);
  const [loadFailure, setLoadFailure] = useState<{ error: unknown } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [kindIndex, setKindIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [limit, setLimit] = useState(pageSize);
  const [adding, setAdding] = useState(false);
  const [addName, setAddName] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [panel, setPanel] = useState<PanelKey>("none");
  const [settings, setSettings] = useState<SettingsView>({
    isAdmin: false,
    canClaim: false,
    tmdb: KeyStatus.UNSPECIFIED,
    omdb: KeyStatus.UNSPECIFIED,
    igdb: KeyStatus.UNSPECIFIED,
    enabledKinds: [],
  });

  // Filmes, séries e jogos estão sempre nas abas; livros, animes e álbuns só quando o admin liga em Configurações.
  const visibleKinds = useMemo(
    () => kinds.filter((item) => !optionalKinds.includes(item.kind) || settings.enabledKinds.includes(item.kind)),
    [settings.enabledKinds],
  );
  const kind = visibleKinds[Math.min(kindIndex, visibleKinds.length - 1)];
  const kindText = t.kinds[kind.key];

  // Se o admin desligar a categoria que está aberta, volta para a primeira aba.
  useEffect(() => {
    if (kindIndex >= visibleKinds.length) setKindIndex(0);
  }, [kindIndex, visibleKinds.length]);

  // Os títulos das categorias que aparecem. Estatísticas, hall da fama e exportação usam só estes.
  const shownTitles = useMemo(
    () => (titles ?? []).filter((title) => visibleKinds.some((item) => item.kind === title.kind)),
    [titles, visibleKinds],
  );

  // Mudanças em tempo real que chegam enquanto a lista ainda está sendo carregada em páginas ficam guardadas aqui
  // e entram por cima dela quando termina.
  const arrivedDuringLoad = useRef<TitleEvent[] | null>(null);

  const load = () => {
    setLoadFailure(null);
    arrivedDuringLoad.current = [];
    loadAllTitles((beforeId) => titleServiceClient.list({ beforeId }))
      .then((all) => {
        setTitles(applyTitleEvents(all, arrivedDuringLoad.current ?? []));
      })
      .catch((error) => setLoadFailure({ error }))
      .finally(() => {
        arrivedDuringLoad.current = null;
      });
  };

  useEffect(load, []);

  // Mudou a categoria, a busca, a ordem ou o filtro: volta para a primeira página.
  useEffect(() => setLimit(pageSize), [kindIndex, query, sort, filter]);

  const loadSettings = () => {
    titleServiceClient
      .getSettings({})
      .then((response) =>
        setSettings({
          isAdmin: response.isAdmin,
          canClaim: response.canClaim,
          tmdb: response.tmdb,
          omdb: response.omdb,
          igdb: response.igdb,
          enabledKinds: response.enabledKinds,
        }),
      )
      .catch(() => {
        // Sem configurações o app segue só com o cadastro à mão.
      });
  };

  useEffect(loadSettings, []);

  // Mudanças feitas por outros membros chegam em tempo real.
  useEffect(() => {
    const onUpserted = (title: Title | undefined) => {
      if (!title) return;
      if (arrivedDuringLoad.current) arrivedDuringLoad.current.push({ type: "upsert", title });
      setTitles((current) => (current ? upsertTitle(current, title) : current));
    };
    const onCreated = (event: TitleCreatedEvent) => onUpserted(event.title);
    const onUpdated = (event: TitleUpdatedEvent) => onUpserted(event.title);
    const onDeleted = (event: TitleDeletedEvent) => {
      if (arrivedDuringLoad.current) arrivedDuringLoad.current.push({ type: "delete", id: event.id });
      setTitles((current) => (current ? current.filter((title) => title.id !== event.id) : current));
      setOpenId((current) => (current === event.id ? null : current));
    };

    const onSettingsChanged = () => loadSettings();

    titleServiceClient.on(TitleServiceClientEvent.Created, onCreated);
    titleServiceClient.on(TitleServiceClientEvent.SettingsChanged, onSettingsChanged);
    titleServiceClient.on(TitleServiceClientEvent.Updated, onUpdated);
    titleServiceClient.on(TitleServiceClientEvent.Deleted, onDeleted);

    return () => {
      titleServiceClient.off(TitleServiceClientEvent.Created, onCreated);
      titleServiceClient.off(TitleServiceClientEvent.SettingsChanged, onSettingsChanged);
      titleServiceClient.off(TitleServiceClientEvent.Updated, onUpdated);
      titleServiceClient.off(TitleServiceClientEvent.Deleted, onDeleted);
    };
  }, []);

  const userIds = useMemo(
    () => (titles ?? []).flatMap((title) => [title.createdBy, ...title.ratings.map((rating) => rating.userId)]),
    [titles],
  );
  const profiles = useProfiles(userIds);

  const countByKind = (index: number) => (titles ?? []).filter((title) => title.kind === visibleKinds[index].kind).length;

  const visible = useMemo(() => {
    const needle = searchKey(query);
    const ofKind = (titles ?? []).filter(
      (title) => title.kind === kind.kind && titleMatches(title, needle) && matchesFilter(title, filter, me),
    );
    return sortTitles(ofKind, sort);
  }, [titles, kind, query, sort, filter, me]);

  const handleChanged = (title: Title) => {
    setNotice(null);
    setTitles((current) => (current ? upsertTitle(current, title) : current));
  };

  const handleDeleted = (id: number) => {
    setNotice(null);
    setTitles((current) => (current ? current.filter((title) => title.id !== id) : current));
    setOpenId(null);
  };

  const handleCreated = (title: Title) => {
    handleChanged(title);
    setLimit(showAllTitles);
    setAdding(false);
    setOpenId(title.id);
  };

  const openExisting = (id: number) => {
    setAdding(false);
    setLimit(showAllTitles);
    setQuery("");
    setOpenId(id);
    setTimeout(() => document.getElementById(`title-${id}`)?.scrollIntoView({ block: "center" }), 50);
  };

  // Abre um título vindo de outro painel (hall da fama): vai para a categoria dele e rola até ele.
  const openTitle = (title: Title) => {
    const index = visibleKinds.findIndex((item) => item.kind === title.kind);
    if (index < 0) return;

    setKindIndex(index);
    setPanel("none");
    setAdding(false);
    setQuery("");
    setFilter("all");
    setLimit(showAllTitles);
    setOpenId(title.id);
    setTimeout(() => document.getElementById(`title-${title.id}`)?.scrollIntoView({ block: "center" }), 50);
  };

  // Todas as notas da comunidade em um arquivo CSV (abre no Excel e no Google Planilhas).
  const exportCsv = () => {
    const csv = buildCsv(shownTitles, (id) => displayName(profiles, id, t.member));
    downloadCsv("couch-critics-ratings.csv", csv);
  };

  const openSettings = () => {
    setAdding(false);
    setPanel("settings");
  };

  const canConfigure = settings.isAdmin || settings.canClaim;

  // Filmes e séries pedem a chave do TMDB, jogos a do IGDB; livros, animes e álbuns não pedem chave nenhuma.
  const sourceStatus =
    kind.kind === TitleKind.GAME
      ? settings.igdb
      : kind.kind === TitleKind.MOVIE || kind.kind === TitleKind.SERIES
        ? settings.tmdb
        : KeyStatus.CONFIGURED;

  const startAdding = (name: string) => {
    setPanel("none");
    setAddName(name);
    setAdding(true);
  };

  const selectKind = (index: number) => {
    setKindIndex(index);
    setAdding(false);
    setOpenId(null);
  };

  // Um aviso de erro já mostrado ficaria no idioma antigo, então some ao trocar de idioma.
  const selectLang = (next: Lang) => {
    setNotice(null);
    setLang(next);
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = (kindIndex + step + visibleKinds.length) % visibleKinds.length;
    selectKind(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  const hasFilter = query.trim() !== "";
  const toggle = (next: PanelKey) => setPanel(panel === next ? "none" : next);

  return (
    <main className="app">
      <header className="bar">
        <div className="tab-bar" role="tablist" aria-label={t.category}>
          {visibleKinds.map((item, index) => (
            <button
              key={item.kind}
              id={`tab-${index}`}
              type="button"
              role="tab"
              className="tab"
              aria-selected={index === kindIndex}
              aria-controls="titles-panel"
              tabIndex={index === kindIndex ? 0 : -1}
              onClick={() => selectKind(index)}
              onKeyDown={onTabKeyDown}
            >
              {t.kinds[item.key].tab}
              <span className="tab-count">{titles ? countByKind(index) : ""}</span>
            </button>
          ))}
        </div>

        <div className="bar-actions">
          {!adding && (
            <button type="button" className="button-primary" onClick={() => startAdding("")}>
              {kindText.add}
            </button>
          )}

          {canConfigure && (
            <button type="button" className="button-quiet" onClick={() => toggle("settings")}>
              {t.settings.open}
            </button>
          )}

          <div className="lang" role="group" aria-label={t.languageGroup}>
            {languages.map((item) => (
              <button
                key={item.lang}
                type="button"
                lang={item.lang}
                aria-label={item.name}
                aria-pressed={lang === item.lang}
                onClick={() => selectLang(item.lang)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {notice && (
        <p className="status-banner" role="alert">
          {notice}
        </p>
      )}

      {panel === "settings" && (
        <SettingsPanel
          settings={settings}
          onChanged={(next) => setSettings((current) => ({ ...current, ...next }))}
          onClose={() => setPanel("none")}
        />
      )}

      {panel === "about" && <AboutPanel onClose={() => setPanel("none")} />}

      {panel === "stats" && <StatsPanel titles={shownTitles} me={me} profiles={profiles} onOpen={openTitle} onClose={() => setPanel("none")} />}

      {panel === "hall" && <HallPanel titles={shownTitles} me={me} profiles={profiles} onOpen={openTitle} onClose={() => setPanel("none")} />}

      {panel === "import" && (
        <ImportPanel
          titles={titles ?? []}
          me={me}
          defaultKind={kind}
          allowedKinds={visibleKinds.map((item) => item.kind)}
          onImported={load}
          onClose={() => setPanel("none")}
        />
      )}

      {adding && (
        <AddTitle
          key={addName}
          kind={kind}
          initialName={addName}
          source={sourceStatus}
          canConfigure={canConfigure}
          onCreated={handleCreated}
          onCancel={() => setAdding(false)}
          onOpenExisting={openExisting}
          onOpenSettings={openSettings}
        />
      )}

      <section
        id="titles-panel"
        role="tabpanel"
        aria-labelledby={`tab-${kindIndex}`}
        aria-busy={titles === null && !loadFailure}
      >
        <div className="toolbar">
          <div className="field toolbar-search">
            <label htmlFor="search" className="visually-hidden">
              {t.searchIn(kindText.plural)}
            </label>
            <input
              id="search"
              className="input"
              type="search"
              placeholder={t.searchIn(kindText.plural)}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="field toolbar-filter">
            <label htmlFor="filter" className="visually-hidden">
              {t.filters.label}
            </label>
            <select id="filter" className="input" value={filter} onChange={(event) => setFilter(event.target.value as FilterKey)}>
              <option value="all">{t.filters.all}</option>
              <option value="unrated">{t.filters.notRatedByMe}</option>
              <option value="want">{t.watch.labels[kind.key].want}</option>
              <option value="doing">{t.watch.labels[kind.key].doing}</option>
              <option value="done">{t.watch.labels[kind.key].done}</option>
            </select>
          </div>

          <div className="field toolbar-sort">
            <label htmlFor="sort" className="visually-hidden">
              {t.sortBy}
            </label>
            <select id="sort" className="input" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              {sortKeys.map((key) => (
                <option key={key} value={key}>
                  {t.sort[key]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loadFailure ? (
          <div className="empty">
            <p>{errorMessage(loadFailure.error, t)}</p>
            <button type="button" className="button-outline" onClick={load}>
              {t.tryAgain}
            </button>
          </div>
        ) : titles === null ? (
          <ul className="list" aria-hidden="true">
            {[0, 1, 2, 3].map((item) => (
              <li key={item} className="title title-skeleton">
                <span className="skeleton skeleton-score" />
                <span className="skeleton skeleton-name" />
              </li>
            ))}
          </ul>
        ) : visible.length === 0 ? (
          <div className="empty">
            {filter !== "all" && !hasFilter && countByKind(Math.min(kindIndex, visibleKinds.length - 1)) > 0 ? (
              <p>{filter === "unrated" ? t.filters.allRated : t.filters.none}</p>
            ) : hasFilter ? (
              <>
                <p>{t.nothingFound(query.trim())}</p>
                <button type="button" className="button-outline" onClick={() => startAdding(query.trim())}>
                  {t.addQuery(query.trim())}
                </button>
              </>
            ) : (
              <>
                <p>{kindText.empty}</p>
                <button type="button" className="button-outline" onClick={() => startAdding("")}>
                  {kindText.addFirst}
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <ul className="list">
              {visible.slice(0, limit).map((title) => (
                <TitleItem
                  key={title.id}
                  title={title}
                  me={me}
                  isAdmin={settings.isAdmin}
                  open={openId === title.id}
                  profiles={profiles}
                  onToggle={() => setOpenId(openId === title.id ? null : title.id)}
                  onChanged={handleChanged}
                  onDeleted={handleDeleted}
                  onError={setNotice}
                />
              ))}
            </ul>

            {visible.length > limit && (
              <div className="show-more">
                <button type="button" className="button-outline" onClick={() => setLimit((current) => current + pageSize)}>
                  {t.showMore(visible.length - limit)}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <footer className="app-footer">
        <button type="button" className="button-quiet" onClick={() => toggle("stats")}>
          {t.stats.link}
        </button>
        <button type="button" className="button-quiet" onClick={() => toggle("hall")}>
          {t.hall.link}
        </button>
        <button type="button" className="button-quiet" onClick={() => toggle("import")}>
          {t.importer.link}
        </button>
        <button type="button" className="button-quiet" disabled={shownTitles.length === 0} onClick={exportCsv}>
          {t.exportCsv}
        </button>
        <button type="button" className="button-quiet" onClick={() => toggle("about")}>
          {t.about.link}
        </button>
      </footer>
    </main>
  );
};

export default App;
