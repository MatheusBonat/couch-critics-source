import { useEffect, useId, useRef, useState } from "react";
import { Title } from "@notas-app/gen-shared";
import { titleServiceClient } from "@notas-app/gen-client";
import { useI18n } from "./i18n";
import { errorMessage } from "./lib";

interface Props {
  title: Title;
  // Franquias que já existem na comunidade, para sugerir (e evitar "marvel" e "Marvel" como duas).
  suggestions: string[];
  onSaved: (title: Title) => void;
  onCancel: () => void;
}

// Escreve, troca ou tira a franquia de qualquer título (também os do TMDB e do IGDB).
export function FranchiseForm({ title, suggestions, onSaved, onCancel }: Props) {
  const { t } = useI18n();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(title.franchise);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const response = await titleServiceClient.setFranchise({ id: title.id, franchise: value });
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
      aria-label={t.franchise.label}
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
      <div className="field">
        <label htmlFor={`${id}-franchise`}>{t.franchise.fieldLabel}</label>
        <input
          id={`${id}-franchise`}
          ref={inputRef}
          className="input"
          type="text"
          list={`${id}-suggestions`}
          maxLength={60}
          placeholder={t.franchise.placeholder}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <datalist id={`${id}-suggestions`}>
          {suggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <p className="muted">{t.franchise.hint}</p>
      </div>

      {failure && (
        <p className="status-banner" role="alert">
          {errorMessage(failure.error, t)}
        </p>
      )}

      <div className="actions">
        <button type="submit" className="button-primary" disabled={busy}>
          {busy ? t.franchise.saving : t.franchise.save}
        </button>
        <button type="button" className="button-quiet" disabled={busy} onClick={onCancel}>
          {t.franchise.cancel}
        </button>
      </div>
    </form>
  );
}
