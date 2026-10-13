import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { rootClient } from "@rootsdk/client-app";
import { nightServiceClient, NightServiceClientEvent, titleServiceClient, TitleServiceClientEvent } from "@notas-app/gen-client";
import { KeyStatus, Night, NightDeletedEvent, NightUpdatedEvent, Title, TitleCreatedEvent, TitleDeletedEvent, TitleKind, TitleUpdatedEvent, WatchStatus } from "@notas-app/gen-shared";
import { AboutPanel } from "./AboutPanel";
import { AddTitle } from "./AddTitle";
import { HallPanel } from "./HallPanel";
import { ImportPanel } from "./ImportPanel";
import { StatsPanel } from "./StatsPanel";
import { SettingsPanel, SettingsView } from "./SettingsPanel";
import { TitleItem } from "./TitleItem";
import { IconAbout, IconAdd, IconExport, IconHall, IconImport, IconParty, IconNotes, IconSearch, IconSettings, IconStats, IconToWatch, KindIcon } from "./icons";
import { NightsView } from "./NightsView";
import { WantList } from "./WantList";
import { Lang, useI18n } from "./i18n";
import { displayName, useProfiles } from "./profiles";
import { mergeNights, openVotingCount, scheduledByTitle, upsertNight } from "./nights";
import {
  buildCsv,
  downloadCsv,
  errorMessage,
  FilterKey,
  kinds,
  matchesFilter,
  optionalKinds,
  posterPathOf,
  pageSize,
  searchKey,
  SortKey,
  sortTitles,
  titleMatches,
  upsertTitle,
  applyTitleEvents,
  countWanted,
  watchStatusOf,
  loadAllTitles,
  TitleEvent,
} from "./lib";

const showAllTitles = Number.MAX_SAFE_INTEGER;

const sortKeys: SortKey[] = ["recent", "best", "most", "yearNew", "yearOld"];

const languages: { lang: Lang; label: string; name: string }[] = [
  { lang: "pt", label: "PT", name: "Português" },
  { lang: "en", label: "EN", name: "English" },
];

type PanelKey = "none" | "settings" | "about" | "hall" | "stats" | "import";
type ViewKey = "notes" | "toWatch" | "nights";

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
  const [view, setView] = useState<ViewKey>("notes");
  const [nights, setNights] = useState<Night[] | null>(null);
  const [nightsFailed, setNightsFailed] = useState(false);
  const [nightsMore, setNightsMore] = useState({ hasMore: false, next: 0, loading: false });
  const [settings, setSettings] = useState<SettingsView>({
    isAdmin: false,
    canClaim: false,
    tmdb: KeyStatus.UNSPECIFIED,
    omdb: KeyStatus.UNSPECIFIED,
    igdb: KeyStatus.UNSPECIFIED,
    enabledKinds: [],
  });

  // Filmes, séries e jogos estão sempre nas abas; livros, animes e músicas só quando o admin liga em Configurações.
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

  // Quantos títulos a turma quer ver, jogar, ler ou ouvir (nas categorias que aparecem).
  const wantTotal = useMemo(() => {
    let total = 0;
    for (const count of countWanted(titles ?? [], visibleKinds.map((item) => item.kind), me).values()) total += count;
    return total;
  }, [titles, visibleKinds, me]);

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

  // As mudanças das noites que chegam em tempo real enquanto a primeira página ainda está vindo entram por cima dela.
  const nightsArrivedDuringLoad = useRef<({ night: Night } | { deletedId: number })[] | null>(null);

  const loadNights = () => {
    setNightsFailed(false);
    nightsArrivedDuringLoad.current = [];
    nightServiceClient
      .list({ beforeId: 0 })
      .then((response) => {
        let loaded = response.nights;
        for (const change of nightsArrivedDuringLoad.current ?? []) {
          loaded = "night" in change ? upsertNight(loaded, change.night) : loaded.filter((item) => item.id !== change.deletedId);
        }
        setNights(loaded);
        setNightsMore({ hasMore: response.hasMore, next: response.nextBeforeId, loading: false });
      })
      .catch(() => setNightsFailed(true))
      .finally(() => {
        nightsArrivedDuringLoad.current = null;
      });
  };

  useEffect(loadNights, []);

  const loadMoreNights = () => {
    setNightsMore((current) => ({ ...current, loading: true }));
    nightServiceClient
      .list({ beforeId: nightsMore.next })
      .then((response) => {
        setNights((current) => mergeNights(current ?? [], response.nights));
        setNightsMore({ hasMore: response.hasMore, next: response.nextBeforeId, loading: false });
      })
      .catch((error) => {
        setNotice(errorMessage(error, t));
        setNightsMore((current) => ({ ...current, loading: false }));
      });
  };

  const handleNightChanged = (night: Night) => {
    setNotice(null);
    setNights((current) => (current ? upsertNight(current, night) : [night]));
  };

  const handleNightDeleted = (id: number) => {
    setNights((current) => (current ? current.filter((item) => item.id !== id) : current));
  };

  // Uma capa de um título da comunidade, para o teste das capas nas configurações.
  const coverSample = useMemo(() => {
    for (const title of titles ?? []) {
      const path = posterPathOf(title, lang);
      if (path) return path;
    }
    return "";
  }, [titles, lang]);

  // Títulos que já têm noite marcada, para o aviso "Noite marcada" nas linhas.
  const scheduled = useMemo(() => scheduledByTitle(nights ?? []), [nights]);
  const openVotes = useMemo(() => openVotingCount(nights ?? []), [nights]);

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

    const onNightUpdated = (event: NightUpdatedEvent) => {
      const night = event.night;
      if (!night) return;
      if (nightsArrivedDuringLoad.current) nightsArrivedDuringLoad.current.push({ night });
      setNights((current) => (current ? upsertNight(current, night) : current));
    };
    const onNightDeleted = (event: NightDeletedEvent) => {
      if (nightsArrivedDuringLoad.current) nightsArrivedDuringLoad.current.push({ deletedId: event.id });
      setNights((current) => (current ? current.filter((item) => item.id !== event.id) : current));
    };

    nightServiceClient.on(NightServiceClientEvent.Updated, onNightUpdated);
    nightServiceClient.on(NightServiceClientEvent.Deleted, onNightDeleted);
    titleServiceClient.on(TitleServiceClientEvent.Created, onCreated);
    titleServiceClient.on(TitleServiceClientEvent.SettingsChanged, onSettingsChanged);
    titleServiceClient.on(TitleServiceClientEvent.Updated, onUpdated);
    titleServiceClient.on(TitleServiceClientEvent.Deleted, onDeleted);

    return () => {
      nightServiceClient.off(NightServiceClientEvent.Updated, onNightUpdated);
      nightServiceClient.off(NightServiceClientEvent.Deleted, onNightDeleted);
      titleServiceClient.off(TitleServiceClientEvent.Created, onCreated);
      titleServiceClient.off(TitleServiceClientEvent.SettingsChanged, onSettingsChanged);
      titleServiceClient.off(TitleServiceClientEvent.Updated, onUpdated);
      titleServiceClient.off(TitleServiceClientEvent.Deleted, onDeleted);
    };
  }, []);

  // Nomes e fotos de todo mundo que aparece na tela: quem adicionou ou avaliou títulos e quem criou, votou ou respondeu nas noites.
  const userIds = useMemo(
    () => [
      ...(titles ?? []).flatMap((title) => [title.createdBy, ...title.ratings.map((rating) => rating.userId)]),
      ...(nights ?? []).flatMap((night) => [night.createdBy, ...night.options.flatMap((option) => option.voterIds), ...night.rsvps.map((rsvp) => rsvp.userId)]),
    ],
    [titles, nights],
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

    setView("notes");
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

  // Um lugar de cada vez: ir para outra visão ou categoria fecha o painel aberto (configurações, estatísticas...), o formulário
  // de adicionar e o título aberto, e volta ao topo. Antes, com as configurações abertas, clicar em "Filmes" só trocava a aba por baixo.
  const leave = () => {
    setPanel("none");
    setAdding(false);
    setOpenId(null);
    window.scrollTo({ top: 0 });
  };

  const selectView = (next: ViewKey) => {
    setView(next);
    leave();
  };

  // Marca "quero" para mim num título (usado ao adicionar pela lista da turma).
  const markWanted = async (id: number): Promise<Title | null> => {
    try {
      const response = await titleServiceClient.setWatchStatus({ titleId: id, status: WatchStatus.WANT });
      return response.title ?? null;
    } catch (error) {
      setNotice(errorMessage(error, t));
      return null;
    }
  };

  // Adicionar pela lista da turma: o título novo já entra marcado como "quero" para quem adicionou.
  const handleCreatedToWatch = async (title: Title) => {
    const updated = await markWanted(title.id);
    handleChanged(updated ?? title);
    setAdding(false);
    setOpenId(title.id);
  };

  // O título já existe: se eu ainda não marquei nada, marco "quero"; se já marquei (vendo, já vi), abro na tela de notas.
  const openExistingFromList = async (id: number) => {
    const existing = (titles ?? []).find((item) => item.id === id);
    if (!existing) return;

    if (watchStatusOf(existing, me) === WatchStatus.UNSPECIFIED) {
      const updated = await markWanted(id);
      if (updated) handleChanged(updated);
      setAdding(false);
      setOpenId(id);
      return;
    }

    setView("notes");
    openTitle(existing);
  };

  const startAddingFromList = (target: { kind: TitleKind }) => {
    const index = visibleKinds.findIndex((item) => item.kind === target.kind);
    setKindIndex(index < 0 ? 0 : index);
    setPanel("none");
    setAddName("");
    setAdding(true);
  };

  const openSettings = () => {
    setAdding(false);
    setPanel("settings");
    window.scrollTo({ top: 0 });
  };

  const canConfigure = settings.isAdmin || settings.canClaim;

  // Filmes e séries pedem a chave do TMDB, jogos a do IGDB; livros, animes e músicas não pedem chave nenhuma.
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
    // A busca da lista é de cada categoria: o que foi digitado em "Músicas" não deve esconder os "Animes".
    setQuery("");
    leave();
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
  // Abrir um painel fecha o formulário de adicionar e sobe a tela, para o painel aparecer (os botões ficam no rodapé).
  const toggle = (next: PanelKey) => {
    if (panel === next) {
      setPanel("none");
      return;
    }
    setAdding(false);
    setPanel(next);
    window.scrollTo({ top: 0 });
  };

  return (
    <main className="app">
      <div className="topbar">
        <nav className="views" aria-label={t.views.label}>
          <button type="button" className="view-tab" aria-current={view === "notes" ? "page" : undefined} onClick={() => selectView("notes")}>
            <IconNotes />
            <span className="view-label">{t.views.notes}</span>
          </button>
          <button type="button" className="view-tab" aria-current={view === "toWatch" ? "page" : undefined} onClick={() => selectView("toWatch")}>
            <IconToWatch />
            <span className="view-label">{t.views.toWatch}</span>
            {titles && wantTotal > 0 && <span className="count">{wantTotal}</span>}
          </button>
          <button type="button" className="view-tab" aria-current={view === "nights" ? "page" : undefined} onClick={() => selectView("nights")}>
            <IconParty />
            <span className="view-label">{t.views.nights}</span>
            {openVotes > 0 && (
              <span className="count is-live" title={t.nights.badge(openVotes)}>
                {openVotes}
              </span>
            )}
          </button>
        </nav>

        <div className="tools">
          {canConfigure && (
            <button type="button" className="icon-button" aria-label={t.settings.open} title={t.settings.open} aria-pressed={panel === "settings"} onClick={() => toggle("settings")}>
              <IconSettings />
            </button>
          )}

          <div className="lang" role="group" aria-label={t.languageGroup}>
            {languages.map((item) => (
              <button
                key={item.lang}
                type="button"
                className="button-quiet"
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
      </div>

      {view === "notes" && (
        <div className="kinds" role="tablist" aria-label={t.category}>
          {visibleKinds.map((item, index) => (
            <button
              key={item.kind}
              id={`tab-${index}`}
              type="button"
              role="tab"
              className="kind-tab"
              aria-selected={index === kindIndex}
              aria-controls="titles-panel"
              tabIndex={index === kindIndex ? 0 : -1}
              onClick={() => selectKind(index)}
              onKeyDown={onTabKeyDown}
            >
              <KindIcon kind={item.key} />
              <span>{t.kinds[item.key].tab}</span>
              <span className="count">{titles ? countByKind(index) : ""}</span>
            </button>
          ))}
        </div>
      )}

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
          coverSample={coverSample}
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
          key={`${addName}-${kind.kind}`}
          kind={kind}
          initialName={addName}
          source={sourceStatus}
          canConfigure={canConfigure}
          onCreated={view === "toWatch" ? (title) => void handleCreatedToWatch(title) : handleCreated}
          onCancel={() => setAdding(false)}
          onOpenExisting={view === "toWatch" ? (id) => void openExistingFromList(id) : openExisting}
          onOpenSettings={openSettings}
        />
      )}

      {view === "nights" ? (
        <section id="nights-panel" className="view-enter" aria-label={t.nights.title}>
          <NightsView
            nights={nights}
            hasMoreNights={nightsMore.hasMore}
            loadingMore={nightsMore.loading}
            loadFailed={nightsFailed}
            titles={titles ?? []}
            visibleKinds={visibleKinds}
            me={me}
            isAdmin={settings.isAdmin}
            profiles={profiles}
            onNightChanged={handleNightChanged}
            onNightDeleted={handleNightDeleted}
            onTitleChanged={handleChanged}
            onOpenTitle={openTitle}
            onLoadMore={loadMoreNights}
            onRetry={loadNights}
            onError={setNotice}
          />
        </section>
      ) : view === "toWatch" ? (
        <section id="to-watch-panel" className="view-enter" aria-label={t.toWatch.title} aria-busy={titles === null && !loadFailure}>
          {loadFailure ? (
            <div className="empty">
              <span className="empty-icon"><IconAbout /></span>
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
          ) : (
            <WantList
              titles={titles}
              visibleKinds={visibleKinds}
              me={me}
              isAdmin={settings.isAdmin}
              profiles={profiles}
              openId={openId}
              onToggle={(id) => setOpenId(openId === id ? null : id)}
              onChanged={handleChanged}
              onDeleted={handleDeleted}
              onError={setNotice}
              scheduled={scheduled}
              onAdd={startAddingFromList}
            />
          )}
        </section>
      ) : (
      <section
        id="titles-panel"
        className="view-enter"
        key={kindIndex}
        role="tabpanel"
        aria-labelledby={`tab-${kindIndex}`}
        aria-busy={titles === null && !loadFailure}
      >
        <div className="filters">
          <div className="field search-field">
            <label htmlFor="search" className="visually-hidden">
              {t.searchIn(kindText.plural)}
            </label>
            <IconSearch />
            <input
              id="search"
              className="input"
              type="search"
              placeholder={t.searchIn(kindText.plural)}
              value={query}
              title={t.searchHint}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                // A caixa filtra o que já está na lista; Enter leva o mesmo texto à busca nos catálogos, para adicionar.
                if (event.key === "Enter" && query.trim().length > 0) startAdding(query.trim());
              }}
            />
          </div>

          <div className="field">
            <label htmlFor="filter" className="visually-hidden">
              {t.filters.label}
            </label>
            <select id="filter" className="input" value={filter} onChange={(event) => setFilter(event.target.value as FilterKey)}>
              <option value="all">{t.filters.all}</option>
              <option value="unrated">{t.filters.notRatedByMe}</option>
            </select>
          </div>

          <div className="field">
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

          <button type="button" className="button-primary" disabled={adding} onClick={() => startAdding("")}>
            <IconAdd />
            {kindText.add}
          </button>
        </div>

        {loadFailure ? (
          <div className="empty">
            <span className="empty-icon"><IconAbout /></span>
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
            <span className="empty-icon"><KindIcon kind={kind.key} /></span>
            {filter !== "all" && !hasFilter && countByKind(Math.min(kindIndex, visibleKinds.length - 1)) > 0 ? (
              <p>{filter === "unrated" ? t.filters.allRated : t.filters.none}</p>
            ) : hasFilter ? (
              <>
                <p>{t.nothingFound(query.trim())}</p>
                <button type="button" className="button-primary" onClick={() => startAdding(query.trim())}>
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
                  scheduled={scheduled.get(title.id)}
                  onToggle={() => setOpenId(openId === title.id ? null : title.id)}
                  onChanged={handleChanged}
                  onDeleted={handleDeleted}
                  onError={setNotice}
                />
              ))}
            </ul>

            {hasFilter && (
              <div className="show-more">
                <button type="button" className="button-quiet" onClick={() => startAdding(query.trim())}>
                  <IconSearch />
                  {t.addQuery(query.trim())}
                </button>
              </div>
            )}

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
      )}

      <footer className="app-footer">
        <button type="button" className="button-quiet" aria-pressed={panel === "stats"} onClick={() => toggle("stats")}>
          <IconStats />
          {t.stats.link}
        </button>
        <button type="button" className="button-quiet" aria-pressed={panel === "hall"} onClick={() => toggle("hall")}>
          <IconHall />
          {t.hall.link}
        </button>
        <button type="button" className="button-quiet" aria-pressed={panel === "import"} onClick={() => toggle("import")}>
          <IconImport />
          {t.importer.link}
        </button>
        <button type="button" className="button-quiet" disabled={shownTitles.length === 0} onClick={exportCsv}>
          <IconExport />
          {t.exportCsv}
        </button>
        <button type="button" className="button-quiet" aria-pressed={panel === "about"} onClick={() => toggle("about")}>
          <IconAbout />
          {t.about.link}
        </button>
      </footer>
    </main>
  );
};

export default App;
