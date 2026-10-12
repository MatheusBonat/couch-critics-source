import { useEffect, useId, useRef, useState } from "react";
import { Title } from "@notas-app/gen-shared";
import { titleServiceClient } from "@notas-app/gen-client";
import { useI18n } from "./i18n";
import { errorMessage, KindInfo } from "./lib";

interface Props {
  kind: KindInfo;
  initialName: string;
  onCreated: (title: Title) => void;
  onCancel: () => void;
  // Quando a busca está disponível, deixa voltar a ela levando o nome já digitado.
  onBackToSearch?: (name: string) => void;
}

export function AddTitleForm({ kind, initialName, onCreated, onCancel, onBackToSearch }: Props) {
  const { t } = useI18n();
  const id = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  // Guarda o erro, não o texto, para o aviso acompanhar uma troca de idioma.
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const submit = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const response = await titleServiceClient.create({
        kind: kind.kind,
        name,
        year: year === "" ? 0 : Number(year),
      });
      if (response.title) onCreated(response.title);
    } catch (caught) {
      setFailure({ error: caught });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="panel add-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      <h2 className="panel-title">{t.kinds[kind.key].newTitle}</h2>

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
          {t.add}
        </button>
        {onBackToSearch && (
          <button type="button" className="button-quiet" onClick={() => onBackToSearch(name.trim())}>
            {t.search.searchInstead}
          </button>
        )}
        <button type="button" className="button-quiet" onClick={onCancel}>
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
