import { useEffect, useId, useRef, useState } from "react";
import { Title } from "@notas-app/gen-shared";
import { titleServiceClient } from "@notas-app/gen-client";
import { useI18n } from "./i18n";
import { errorMessage } from "./lib";

interface Props {
  title: Title;
  onSaved: (title: Title) => void;
  onCancel: () => void;
}

// Edita o nome e o ano de um título adicionado à mão (os da fonte, TMDB e IGDB, não mudam).
export function EditTitleForm({ title, onSaved, onCancel }: Props) {
  const { t } = useI18n();
  const id = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(title.name);
  const [year, setYear] = useState(title.year > 0 ? String(title.year) : "");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const submit = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const response = await titleServiceClient.update({ id: title.id, name, year: year === "" ? 0 : Number(year) });
      if (response.title) onSaved(response.title);
    } catch (error) {
      setFailure({ error });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="edit-form"
      aria-label={t.edit.title}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <div className="add-fields">
        <div className="field add-name">
          <label htmlFor={`${id}-name`}>{t.name}</label>
          <input
            id={`${id}-name`}
            ref={nameRef}
            className="input"
            type="text"
            required
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="field add-year">
          <label htmlFor={`${id}-year`}>{t.yearOptional}</label>
          <input
            id={`${id}-year`}
            className="input"
            type="number"
            inputMode="numeric"
            min={1888}
            max={new Date().getFullYear() + 5}
            value={year}
            onChange={(event) => setYear(event.target.value)}
          />
        </div>
      </div>

      {failure && (
        <p className="status-banner" role="alert">
          {errorMessage(failure.error, t)}
        </p>
      )}

      <div className="actions">
        <button type="submit" className="button-primary" disabled={busy || name.trim() === ""}>
          {busy ? t.edit.saving : t.edit.save}
        </button>
        <button type="button" className="button-quiet" disabled={busy} onClick={onCancel}>
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
