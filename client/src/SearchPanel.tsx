import { useEffect, useId, useRef, useState } from "react";
import { SearchResult, SearchStatus, Title, TitleKind } from "@notas-app/gen-shared";
import { titleServiceClient } from "@notas-app/gen-client";
import { Poster } from "./Poster";
import { useI18n } from "./i18n";
import { errorMessage, KindInfo, sourceNameOf } from "./lib";

interface Props {
  kind: KindInfo;
  initialQuery: string;
  canConfigure: boolean;
  onCreated: (title: Title) => void;
  onCancel: () => void;
  onOpenExisting: (id: number) => void;
  onOpenSettings: () => void;
  onManual: (query: string) => void;
}

type Phase = "idle" | "loading" | "done";

const debounceMs = 400;

export function SearchPanel({ kind, initialQuery, canConfigure, onCreated, onCancel, onOpenExisting, onOpenSettings, onManual }: Props) {
  const { t, lang } = useI18n();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const latest = useRef(0);

  const [query, setQuery] = useState(initialQuery);
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState<SearchStatus>(SearchStatus.OK);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);

  const text = query.trim();
  const sourceName = sourceNameOf(kind.kind);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const runSearch = async (term: string, token: number) => {
    try {
      const response = await titleServiceClient.search({ kind: kind.kind, query: term, language: lang });
      if (token !== latest.current) return;
      setStatus(response.status);
      setResults(response.results);
    } catch {
      if (token !== latest.current) return;
      setStatus(SearchStatus.UNAVAILABLE);
      setResults([]);
    }
    setPhase("done");
  };

  // Busca enquanto a pessoa digita, esperando uma pausa na digitação. Só vale a resposta da última busca.
  useEffect(() => {
    latest.current += 1;
    const token = latest.current;

    if (text.length < 2) {
      setPhase("idle");
      setResults([]);
      return;
    }

    setPhase("loading");
    const timer = setTimeout(() => void runSearch(text, token), debounceMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, lang, kind.kind]);

  const add = async (result: SearchResult) => {
    setAddingId(result.externalId);
    setFailure(null);
    try {
      const response = await titleServiceClient.addFromSource({ kind: kind.kind, externalId: result.externalId });
      if (response.title) onCreated(response.title);
    } catch (error) {
      setFailure({ error });
      // Se alguém adicionou na frente, a busca passa a mostrar o título como já adicionado.
      latest.current += 1;
      void runSearch(text, latest.current);
    } finally {
      setAddingId(null);
    }
  };

  const unavailableMessage =
    status === SearchStatus.NOT_CONFIGURED
      ? canConfigure
        ? t.search.notConfiguredAdmin(sourceName)
        : t.search.notConfigured
      : status === SearchStatus.INVALID_KEY
        ? t.search.invalidKey(sourceName)
        : status === SearchStatus.RATE_LIMITED
          ? t.search.rateLimited(sourceName)
          : status === SearchStatus.UNAVAILABLE
            ? t.search.unavailable(sourceName)
            : null;

  return (
    <div
      className="panel add-form"
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      <h2 className="panel-title">{t.kinds[kind.key].newTitle}</h2>

      <div className="field">
        <label htmlFor={`${id}-q`}>{t.search.label}</label>
        <input
          id={`${id}-q`}
          ref={inputRef}
          className="input"
          type="search"
          maxLength={100}
          placeholder={t.search.placeholder(t.kinds[kind.key].plural)}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="search-status" aria-live="polite">
        {phase === "loading" && <p className="muted">{t.search.searching}</p>}

        {phase === "done" && unavailableMessage && (
          <div className="status-banner status-inline" role="status">
            <span>{unavailableMessage}</span>
            {status === SearchStatus.NOT_CONFIGURED && canConfigure && (
              <button type="button" className="button-outline" onClick={onOpenSettings}>
                {t.search.openSettings}
              </button>
            )}
          </div>
        )}

        {phase === "done" && !unavailableMessage && results.length === 0 && <p className="muted">{t.search.noResults(text)}</p>}
      </div>

      {failure && (
        <p className="status-banner" role="alert">
          {errorMessage(failure.error, t)}
        </p>
      )}

      {results.length > 0 && !unavailableMessage && (
        <ul className="results">
          {results.map((result) => {
            const already = result.existingTitleId > 0;
            const showOriginal = result.originalName !== "" && result.originalName !== result.name;
            return (
              <li key={result.externalId} className="result">
                <Poster path={result.posterPath} name={result.name} alt={t.posterAlt(result.name)} size="medium" />
                <span className="result-main">
                  <span className="result-name">{result.name}</span>
                  <span className="result-meta">
                    {[result.year > 0 ? String(result.year) : "", result.creator, showOriginal ? result.originalName : ""].filter(Boolean).join(", ")}
                  </span>
                </span>
                {already ? (
                  <span className="result-action">
                    <span className="muted">{t.search.alreadyAdded}</span>
                    <button type="button" className="button-outline" onClick={() => onOpenExisting(result.existingTitleId)}>
                      {t.search.open}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="button-primary"
                    disabled={addingId !== null}
                    onClick={() => void add(result)}
                  >
                    {addingId === result.externalId ? t.search.adding : t.search.add}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="search-footer">
        <button type="button" className="button-quiet" onClick={() => onManual(text)}>
          {t.search.addManually}
        </button>
        <span className="muted">{kind.kind === TitleKind.MOVIE || kind.kind === TitleKind.SERIES ? t.search.addManuallyHint : t.search.addManuallyHintGame}</span>
        <button type="button" className="button-quiet search-cancel" onClick={onCancel}>
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
