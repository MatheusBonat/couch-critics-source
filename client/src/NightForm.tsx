import { useMemo, useState } from "react";
import { Night, Title, TitleKind } from "@notas-app/gen-shared";
import { nightServiceClient } from "@notas-app/gen-client";
import { Poster } from "./Poster";
import { useI18n } from "./i18n";
import { errorMessage, kinds, posterPathOf, titleName } from "./lib";
import {
  candidateTitles,
  defaultStart,
  defaultVotingEnd,
  fromInputValue,
  maxNightName,
  maxNightOptions,
  minNightOptions,
  nightFormError,
  toInputValue,
} from "./nights";

interface Props {
  titles: Title[];
  allowedKinds: TitleKind[];
  me: string;
  now: number;
  onCreated: (night: Night) => void;
  onCancel: () => void;
}

// Formulário da noite nova: nome (opcional), quando vai ser, até quando vale a votação e de 2 a 8 títulos da comunidade.
export function NightForm({ titles, allowedKinds, me, now, onCreated, onCancel }: Props) {
  const { t, lang } = useI18n();
  const [name, setName] = useState("");
  const [start, setStart] = useState(() => toInputValue(defaultStart(now)));
  const [votingEnd, setVotingEnd] = useState(() => toInputValue(defaultVotingEnd(defaultStart(now), now)));
  const [chosen, setChosen] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const startMs = fromInputValue(start);
  const votingEndMs = fromInputValue(votingEnd);
  const error = nightFormError({ start: startMs, votingEnd: votingEndMs, titleIds: chosen }, now);

  const byId = useMemo(() => new Map(titles.map((title) => [title.id, title])), [titles]);
  const candidates = useMemo(() => candidateTitles(titles, allowedKinds, me, query), [titles, allowedKinds, me, query]);

  // Mudou o início: a votação não pode terminar depois dele, então acompanha quando ficaria fora do lugar.
  const changeStart = (value: string) => {
    setStart(value);
    const next = fromInputValue(value);
    if (Number.isFinite(next) && (!Number.isFinite(votingEndMs) || votingEndMs > next)) setVotingEnd(toInputValue(defaultVotingEnd(next, now)));
  };

  const toggle = (id: number) =>
    setChosen((current) => (current.includes(id) ? current.filter((item) => item !== id) : current.length >= maxNightOptions ? current : [...current, id]));

  const submit = async () => {
    if (error) return;
    setSaving(true);
    setFailure(null);
    try {
      const response = await nightServiceClient.create({ name, startsAt: startMs, votingEndsAt: votingEndMs, titleIds: chosen });
      if (response.night) onCreated(response.night);
    } catch (caught) {
      setFailure(errorMessage(caught, t));
      setSaving(false);
    }
  };

  return (
    <section className="panel night-form" aria-labelledby="night-form-title">
      <h2 id="night-form-title" className="panel-title">
        {t.nights.form.title}
      </h2>

      <div className="field">
        <label htmlFor="night-name">{t.nights.form.name}</label>
        <input id="night-name" className="input" type="text" maxLength={maxNightName} placeholder={t.nights.form.namePlaceholder} value={name} onChange={(event) => setName(event.target.value)} />
      </div>

      <div className="night-dates">
        <div className="field">
          <label htmlFor="night-start">{t.nights.form.start}</label>
          <input id="night-start" className="input" type="datetime-local" value={start} onChange={(event) => changeStart(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="night-voting-end">{t.nights.form.votingEnd}</label>
          <input id="night-voting-end" className="input" type="datetime-local" value={votingEnd} onChange={(event) => setVotingEnd(event.target.value)} />
        </div>
      </div>
      {(error === "start" || error === "voting") && (
        <p className="field-error" role="alert">
          {t.nights.form.errors[error]}
        </p>
      )}

      <div className="field">
        <label htmlFor="night-search">
          {t.nights.form.options} <span className="muted">· {t.nights.form.optionsHint(minNightOptions, maxNightOptions)}</span>
        </label>

        {chosen.length > 0 && (
          <ul className="night-chosen" aria-label={t.nights.form.selected(chosen.length, maxNightOptions)}>
            {chosen.map((id) => {
              const title = byId.get(id);
              const label = title ? titleName(title, lang) : String(id);
              return (
                <li key={id}>
                  <button type="button" className="night-chosen-chip" onClick={() => toggle(id)} aria-label={t.nights.form.remove(label)}>
                    {label} <span aria-hidden="true">×</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="muted night-count">{t.nights.form.selected(chosen.length, maxNightOptions)}</p>

        <input id="night-search" className="input" type="search" placeholder={t.nights.form.search} value={query} onChange={(event) => setQuery(event.target.value)} />

        {candidates.length === 0 ? (
          <p className="muted">{t.nights.form.noMatches}</p>
        ) : (
          <ul className="night-candidates">
            {candidates.map((title) => {
              const selected = chosen.includes(title.id);
              const kindKey = kinds.find((item) => item.kind === title.kind)?.key ?? "movie";
              const name = titleName(title, lang);
              const full = !selected && chosen.length >= maxNightOptions;
              return (
                <li key={title.id}>
                  <label className={selected ? "night-candidate is-selected" : "night-candidate"}>
                    <input type="checkbox" checked={selected} disabled={full} onChange={() => toggle(title.id)} />
                    <Poster path={posterPathOf(title, lang)} name={name} alt="" />
                    <span className="night-candidate-main">
                      <span className="night-option-name">{name}</span>
                      <span className="muted night-option-meta">
                        {title.year > 0 ? `${title.year} · ` : ""}
                        {t.kinds[kindKey].tab}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <p className="muted night-hint">{t.nights.form.addHint}</p>
        {error === "options" && chosen.length > 0 && <p className="muted">{t.nights.form.errors.options}</p>}
      </div>

      {failure && (
        <p className="field-error" role="alert">
          {failure}
        </p>
      )}

      <div className="actions">
        <button type="button" className="button-primary" disabled={saving || error !== null} onClick={() => void submit()}>
          {saving ? t.nights.form.submitting : t.nights.form.submit}
        </button>
        <button type="button" className="button-quiet" disabled={saving} onClick={onCancel}>
          {t.nights.form.cancel}
        </button>
      </div>
    </section>
  );
}
