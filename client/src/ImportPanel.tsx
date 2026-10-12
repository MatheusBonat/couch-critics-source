import { ChangeEvent, useRef, useState } from "react";
import { RatingTier, SearchResult, SearchStatus, Title, TitleKind } from "@notas-app/gen-shared";
import { titleServiceClient } from "@notas-app/gen-client";
import { useI18n } from "./i18n";
import { downloadCsv, formatScore, KindInfo, kinds } from "./lib";
import { bestMatch, Candidate, Choice, createPacer, executeImport, findLocal, ImportRow, Outcome, parseCsv, PlanItem, readRows, ReadProblem, withRateRetry } from "./importer";

interface Props {
  titles: Title[];
  me: string;
  // A categoria que estava aberta: linhas do arquivo sem categoria entram nela.
  defaultKind: KindInfo;
  // Categorias que aparecem nas abas (as opcionais só quando o admin liga).
  allowedKinds: TitleKind[];
  onImported: () => void;
  onClose: () => void;
}

type Step = "pick" | "matching" | "review" | "importing" | "done";

interface Entry {
  row: ImportRow;
  kind: TitleKind;
  candidates: Candidate[];
  status: "existing" | "matched" | "review" | "none";
  existing?: Title;
  choice: Choice;
}

const maxFileBytes = 2 * 1024 * 1024;
const shownCandidates = 5;

const toCandidate = (result: SearchResult): Candidate => ({
  externalId: result.externalId,
  name: result.name,
  originalName: result.originalName,
  year: result.year,
  existingTitleId: result.existingTitleId,
  posterPath: result.posterPath,
  creator: result.creator,
});

// Valor do <select> de cada linha: "skip", "manual", "existing:<id>" ou "source:<posição na lista de resultados>".
function valueOf(entry: Entry): string {
  const { choice } = entry;
  if (choice.type === "existing") return `existing:${choice.titleId}`;
  if (choice.type === "source") return `source:${entry.candidates.indexOf(choice.candidate)}`;
  return choice.type;
}

const readableName = (candidate: Candidate) => [candidate.year > 0 ? `${candidate.name} (${candidate.year})` : candidate.name, candidate.creator].filter(Boolean).join(", ");

// Importa as notas de um arquivo CSV para a conta de quem está usando: lê, casa cada linha com um título da busca
// (para trazer a capa), mostra o que foi achado para conferir e então importa uma linha por vez.
export function ImportPanel({ titles, me, defaultKind, allowedKinds, onImported, onClose }: Props) {
  const { t, lang } = useI18n();
  const stop = useRef(false);
  const known = useRef<Title[]>(titles);
  const ratedNow = useRef(new Set<number>());
  // Todas as chamadas da importação passam por aqui: o Root recusa mais de 10 por segundo.
  const pace = useRef(createPacer());
  const call = <T,>(request: () => Promise<T>) =>
    withRateRetry(async () => {
      await pace.current();
      return request();
    });

  const [step, setStep] = useState<Step>("pick");
  const [text, setText] = useState("");
  const [read, setRead] = useState<{ rows: ImportRow[]; problem?: ReadProblem } | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [overwrite, setOverwrite] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [fileError, setFileError] = useState(false);

  const analyze = (content: string) => {
    const result = readRows(parseCsv(content));
    // Categoria que não está nas abas (ou desligada nas Configurações) não pode receber título.
    for (const row of result.rows) {
      if (!row.error && !allowedKinds.includes(row.kind ?? defaultKind.kind)) row.error = "off";
    }
    setRead(result);
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setFileError(false);
    if (file.size > maxFileBytes) {
      setFileError(true);
      return;
    }
    const content = await file.text();
    setText(content);
    analyze(content);
  };

  const usable = read?.rows.filter((row) => !row.error) ?? [];
  const broken = read?.rows.filter((row) => row.error) ?? [];

  const downloadExample = () =>
    downloadCsv("couch-critics-import-example.csv", "title,year,category,score,comment\r\nParasite,2019,movie,9.5,Great\r\nHollow Knight,2017,game,10,\r\n");

  // Casa cada linha com um título: primeiro com o que a comunidade já tem; se não houver, com a busca.
  const match = async () => {
    stop.current = false;
    setStep("matching");
    setSearchFailed(false);
    setProgress({ done: 0, total: usable.length });

    const result: Entry[] = [];
    let failed = false;

    for (const row of usable) {
      if (stop.current) break;

      const kind = row.kind ?? defaultKind.kind;
      const local = findLocal(known.current, kind, row);

      if (local) {
        result.push({ row, kind, candidates: [], status: "existing", existing: local, choice: { type: "existing", titleId: local.id } });
      } else {
        let candidates: Candidate[] = [];
        try {
          const response = await call(() => titleServiceClient.search({ kind, query: row.name, language: lang }));
          if (response.status === SearchStatus.OK) candidates = response.results.map(toCandidate);
          else failed = true;
        } catch {
          failed = true;
        }

        const best = bestMatch(row, candidates);
        const choice: Choice =
          best?.confident === true
            ? best.candidate.existingTitleId > 0
              ? { type: "existing", titleId: best.candidate.existingTitleId }
              : { type: "source", candidate: best.candidate }
            : { type: "manual" };

        // O melhor palpite vai para o começo da lista, para aparecer primeiro na escolha.
        const ordered = best ? [best.candidate, ...candidates.filter((item) => item !== best.candidate)] : candidates;
        result.push({ row, kind, candidates: ordered, status: best ? (best.confident ? "matched" : "review") : "none", choice });
      }

      setProgress((current) => ({ ...current, done: current.done + 1 }));
    }

    if (stop.current) {
      setStep("pick");
      return;
    }
    setSearchFailed(failed);
    setEntries(result);
    setStep("review");
  };

  const choose = (index: number, value: string) => {
    setEntries((current) =>
      current.map((entry, position) => {
        if (position !== index) return entry;

        let choice: Choice = { type: "manual" };
        if (value === "skip") choice = { type: "skip" };
        else if (value.startsWith("existing:")) choice = { type: "existing", titleId: Number(value.slice(9)) };
        else if (value.startsWith("source:")) choice = { type: "source", candidate: entry.candidates[Number(value.slice(7))] };
        return { ...entry, choice };
      }),
    );
  };

  const importable = entries.filter((entry) => entry.choice.type !== "skip").length;

  const run = async () => {
    stop.current = false;
    ratedNow.current = new Set();
    const plan: PlanItem[] = entries.map((entry) => ({ row: entry.row, kind: entry.kind, choice: entry.choice }));

    setStep("importing");
    setProgress({ done: 0, total: plan.length });

    const result = await executeImport(
      plan,
      { overwrite, shouldStop: () => stop.current },
      {
        addFromSource: async (kind, externalId) => {
          const response = await call(() => titleServiceClient.addFromSource({ kind, externalId }));
          if (!response.title) throw new Error("0|empty");
          return response.title;
        },
        create: async (kind, name, year) => {
          const response = await call(() => titleServiceClient.create({ kind, name, year }));
          if (!response.title) throw new Error("0|empty");
          return response.title;
        },
        rate: async (titleId, row) => {
          await call(() => titleServiceClient.rate({ titleId, score: row.score, comment: row.comment, tier: row.tier, spoiler: row.spoiler }));
          ratedNow.current.add(titleId);
        },
        alreadyRated: (titleId) => ratedNow.current.has(titleId) || (known.current.find((title) => title.id === titleId)?.ratings.some((rating) => rating.userId === me) ?? false),
        reload: async () => {
          known.current = (await call(() => titleServiceClient.list({}))).titles;
          return known.current;
        },
      },
      (done, total) => setProgress({ done, total }),
    );

    setOutcomes(result);
    setStep("done");
    onImported();
  };

  const count = (status: Outcome["status"]) => outcomes.filter((outcome) => outcome.status === status).length;
  const failures = outcomes.filter((outcome) => outcome.status === "failed");

  const reasonOf = (code: number | undefined) => (code !== undefined && t.errors[code]) || t.genericError;

  return (
    <section
      className="panel importer"
      aria-labelledby="import-title"
      onKeyDown={(event) => {
        if (event.key === "Escape" && step !== "importing" && step !== "matching") onClose();
      }}
    >
      <div className="panel-bar">
        <h2 id="import-title" className="panel-title">
          {t.importer.title}
        </h2>
        <button type="button" className="button-quiet" disabled={step === "importing"} onClick={onClose}>
          {t.importer.close}
        </button>
      </div>

      {step === "pick" && (
        <div className="import-body">
          <p>{t.importer.intro}</p>
          <p className="muted">{t.importer.columns}</p>
          <p className="muted">{t.importer.defaultKind(t.kinds[defaultKind.key].tab)}</p>

          <div className="actions">
            <label className="button-outline file-button">
              {t.importer.chooseFile}
              <input type="file" accept=".csv,.txt,text/csv,text/plain" className="visually-hidden" onChange={(event) => void onFile(event)} />
            </label>
            <button type="button" className="button-quiet" onClick={downloadExample}>
              {t.importer.example}
            </button>
          </div>

          {fileError && (
            <p className="status-banner" role="alert">
              {t.genericError}
            </p>
          )}

          <div className="field">
            <label htmlFor="import-text">{t.importer.orPaste}</label>
            <textarea id="import-text" className="input" rows={5} placeholder={t.importer.pastePlaceholder} value={text} onChange={(event) => setText(event.target.value)} />
          </div>

          <div className="actions">
            <button type="button" className="button-outline" disabled={text.trim() === ""} onClick={() => analyze(text)}>
              {t.importer.read}
            </button>
          </div>

          {read?.problem && (
            <p className="status-banner" role="alert">
              {read.problem === "empty" ? t.importer.problems.empty : read.problem === "no-title" ? t.importer.problems.noTitle : t.importer.problems.noScore}
            </p>
          )}

          {read && !read.problem && (
            <>
              <p role="status">{t.importer.readSummary(usable.length, broken.length)}</p>
              {broken.length > 0 && (
                <ul className="import-problems">
                  {broken.slice(0, 8).map((row) => (
                    <li key={row.line}>{t.importer.rowProblem(row.line, row.name, t.importer.reasons[row.error ?? ""] ?? t.genericError)}</li>
                  ))}
                  {broken.length > 8 && <li>…</li>}
                </ul>
              )}
              {usable.length > 0 && (
                <>
                  <p className="muted">{t.importer.matchNote}</p>
                  <div className="actions">
                    <button type="button" className="button-primary" onClick={() => void match()}>
                      {t.importer.matchStart}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {step === "matching" && (
        <div className="import-body">
          <p role="status" aria-live="polite">
            {t.importer.matching(progress.done, progress.total)}
          </p>
          <progress className="import-progress" max={progress.total} value={progress.done} />
          <div className="actions">
            <button type="button" className="button-quiet" onClick={() => (stop.current = true)}>
              {t.importer.cancel}
            </button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="import-body">
          <h3 className="stats-heading">{t.importer.review}</h3>
          <p className="muted">{t.importer.reviewHint}</p>
          {searchFailed && (
            <p className="status-banner" role="status">
              {t.importer.searchFailed}
            </p>
          )}

          <ul className="import-list">
            {entries.map((entry, index) => {
              const kindKey = kinds.find((item) => item.kind === entry.kind)?.key ?? defaultKind.key;
              return (
                <li key={entry.row.line} className="import-row">
                  <div className="import-main">
                    <span className="import-name">
                      {entry.row.name}
                      {entry.row.year > 0 ? ` (${entry.row.year})` : ""}
                    </span>
                    <span className="muted import-meta">
                      {[
                        t.kinds[kindKey].tab,
                        entry.row.tier === RatingTier.PEAK ? t.tiers.peak : entry.row.tier === RatingTier.ROCK_BOTTOM ? t.tiers.rockBottom : formatScore(entry.row.score, t.locale),
                        entry.row.notes.includes("comment") ? t.importer.reasons.comment : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>

                  <span className={`import-status import-status-${entry.status}`}>{t.importer.status[entry.status]}</span>

                  <select
                    className="input import-choice"
                    aria-label={entry.row.name}
                    value={valueOf(entry)}
                    onChange={(event) => choose(index, event.target.value)}
                  >
                    {entry.existing && <option value={`existing:${entry.existing.id}`}>{t.importer.optionExisting(entry.existing.name)}</option>}
                    {entry.candidates.slice(0, shownCandidates).map((candidate, position) =>
                      candidate.existingTitleId > 0 ? (
                        <option key={candidate.externalId} value={`existing:${candidate.existingTitleId}`}>
                          {t.importer.optionExisting(readableName(candidate))}
                        </option>
                      ) : (
                        <option key={candidate.externalId} value={`source:${position}`}>
                          {readableName(candidate)}
                        </option>
                      ),
                    )}
                    <option value="manual">{t.importer.optionManual}</option>
                    <option value="skip">{t.importer.optionSkip}</option>
                  </select>
                </li>
              );
            })}
          </ul>

          <label className="check">
            <input type="checkbox" checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)} />
            {t.importer.overwrite}
          </label>

          <div className="actions">
            <button type="button" className="button-primary" disabled={importable === 0} onClick={() => void run()}>
              {t.importer.importN(importable)}
            </button>
            <button type="button" className="button-quiet" onClick={() => setStep("pick")}>
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {step === "importing" && (
        <div className="import-body">
          <p role="status" aria-live="polite">
            {t.importer.importing(progress.done, progress.total)}
          </p>
          <progress className="import-progress" max={progress.total} value={progress.done} />
          <div className="actions">
            <button type="button" className="button-quiet" onClick={() => (stop.current = true)}>
              {t.importer.stop}
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="import-body">
          <h3 className="stats-heading">{t.importer.done}</h3>
          <ul className="import-summary">
            <li>
              {t.importer.imported}: <strong>{count("imported")}</strong>
            </li>
            {count("kept") > 0 && (
              <li>
                {t.importer.kept}: <strong>{count("kept")}</strong>
              </li>
            )}
            {count("skipped") > 0 && (
              <li>
                {t.importer.skipped}: <strong>{count("skipped")}</strong>
              </li>
            )}
            {failures.length > 0 && (
              <li>
                {t.importer.failed}: <strong>{failures.length}</strong>
              </li>
            )}
          </ul>

          {failures.length > 0 && (
            <>
              <h3 className="stats-heading">{t.importer.failures}</h3>
              <ul className="import-problems">
                {failures.slice(0, 10).map((outcome) => (
                  <li key={outcome.row.line}>{t.importer.rowProblem(outcome.row.line, outcome.row.name, reasonOf(outcome.code))}</li>
                ))}
              </ul>
            </>
          )}

          <div className="actions">
            <button
              type="button"
              className="button-outline"
              onClick={() => {
                setRead(null);
                setText("");
                setEntries([]);
                setOutcomes([]);
                setStep("pick");
              }}
            >
              {t.importer.again}
            </button>
            <button type="button" className="button-quiet" onClick={onClose}>
              {t.importer.close}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
