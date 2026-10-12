import { useId, useState } from "react";
import { KeyStatus, SettingsSaveResponse, TitleKind } from "@notas-app/gen-shared";
import { titleServiceClient } from "@notas-app/gen-client";
import { useI18n } from "./i18n";
import { errorMessage } from "./lib";

export interface SettingsView {
  isAdmin: boolean;
  canClaim: boolean;
  tmdb: KeyStatus;
  omdb: KeyStatus;
  igdb: KeyStatus;
  // Categorias opcionais ligadas pelo admin (livros, animes e álbuns).
  enabledKinds: TitleKind[];
}

interface Props {
  settings: SettingsView;
  onChanged: (next: Partial<SettingsView>) => void;
  onClose: () => void;
}

interface FieldProps {
  name: string;
  help: string;
  status: KeyStatus;
  // Um campo por valor. Com um campo só, o próprio nome da chave é o rótulo; com mais de um (IGDB), cada campo tem o seu.
  labels?: string[];
  save: (values: string[]) => Promise<KeyStatus>;
}

function KeyField({ name, help, status, labels, save }: FieldProps) {
  const { t } = useI18n();
  const id = useId();
  const count = labels?.length ?? 1;
  const [values, setValues] = useState<string[]>(() => Array.from({ length: count }, () => ""));
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);

  const statusText =
    status === KeyStatus.CONFIGURED
      ? t.settings.configured
      : status === KeyStatus.INVALID
        ? t.settings.invalid
        : status === KeyStatus.UNREACHABLE
          ? t.settings.unreachable
          : t.settings.notConfigured;

  const filled = values.every((value) => value.trim() !== "");

  const run = async (next: string[]) => {
    setBusy(true);
    setNotice(null);
    setFailure(null);
    try {
      const result = await save(next);
      if (next.some((value) => value !== "")) {
        setNotice(
          result === KeyStatus.INVALID
            ? t.settings.rejectedNotice
            : result === KeyStatus.UNREACHABLE
              ? t.settings.unreachable
              : t.settings.savedNotice,
        );
        if (result !== KeyStatus.INVALID) setValues(Array.from({ length: count }, () => ""));
      }
    } catch (error) {
      setFailure({ error });
    } finally {
      setBusy(false);
    }
  };

  const setValueAt = (index: number, value: string) => setValues((current) => current.map((item, i) => (i === index ? value : item)));

  const placeholder = status === KeyStatus.UNSPECIFIED ? "" : t.settings.newKey;

  const toggle = (
    <button type="button" className="button-quiet" onClick={() => setShown((current) => !current)}>
      {shown ? t.settings.hide : t.settings.show}
    </button>
  );

  const saveButton = (
    <button type="submit" className="button-primary" disabled={busy || !filled}>
      {busy ? t.settings.saving : t.settings.save}
    </button>
  );

  return (
    <div className="key-field">
      <div className="key-head">
        <span className="key-name" id={`${id}-name`}>
          {name}
        </span>
        <span className={`key-status key-status-${status === KeyStatus.CONFIGURED ? "ok" : status === KeyStatus.UNSPECIFIED ? "off" : "warn"}`}>
          {statusText}
        </span>
      </div>
      <p className="muted key-help">{help}</p>

      <form
        className={labels ? "key-pair" : "key-row"}
        onSubmit={(event) => {
          event.preventDefault();
          if (filled) void run(values);
        }}
      >
        {labels ? (
          <>
            {labels.map((label, index) => (
              <div className="field" key={label}>
                <label htmlFor={`${id}-${index}`}>{label}</label>
                <input
                  id={`${id}-${index}`}
                  className="input"
                  type={shown ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={placeholder}
                  value={values[index]}
                  onChange={(event) => setValueAt(index, event.target.value)}
                />
              </div>
            ))}
            <div className="key-actions">
              {toggle}
              {saveButton}
            </div>
          </>
        ) : (
          <>
            <input
              id={`${id}-0`}
              aria-labelledby={`${id}-name`}
              className="input"
              type={shown ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder={placeholder}
              value={values[0]}
              onChange={(event) => setValueAt(0, event.target.value)}
            />
            {toggle}
            {saveButton}
          </>
        )}
      </form>

      {notice && (
        <p className="muted" role="status">
          {notice}
        </p>
      )}
      {failure && (
        <p className="status-banner" role="alert">
          {errorMessage(failure.error, t)}
        </p>
      )}

      {status !== KeyStatus.UNSPECIFIED && (
        <button type="button" className="button-quiet key-remove" disabled={busy} onClick={() => void run(Array.from({ length: count }, () => ""))}>
          {t.settings.remove}
        </button>
      )}
    </div>
  );
}

// Categorias opcionais: livros, animes e álbuns (serviços gratuitos, sem chave). Cada caixa grava na hora.
function Categories({ enabled, save }: { enabled: TitleKind[]; save: (kinds: TitleKind[]) => Promise<void> }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);

  const options = [
    { kind: TitleKind.BOOK, label: t.categories.book },
    { kind: TitleKind.ANIME, label: t.categories.anime },
    { kind: TitleKind.ALBUM, label: t.categories.album },
  ];

  const toggle = async (kind: TitleKind, on: boolean) => {
    setBusy(true);
    setSaved(false);
    setFailure(null);
    try {
      await save(on ? [...enabled.filter((item) => item !== kind), kind] : enabled.filter((item) => item !== kind));
      setSaved(true);
    } catch (error) {
      setFailure({ error });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="key-field">
      <div className="key-head">
        <span className="key-name">{t.categories.title}</span>
      </div>
      <p className="muted key-help">{t.categories.help}</p>

      <div className="categories">
        {options.map((option) => (
          <label key={option.kind} className="check">
            <input type="checkbox" checked={enabled.includes(option.kind)} disabled={busy} onChange={(event) => void toggle(option.kind, event.target.checked)} />
            {option.label}
          </label>
        ))}
      </div>

      {saved && (
        <p className="muted" role="status">
          {t.categories.saved}
        </p>
      )}
      {failure && (
        <p className="status-banner" role="alert">
          {errorMessage(failure.error, t)}
        </p>
      )}
    </div>
  );
}

export function SettingsPanel({ settings, onChanged, onClose }: Props) {
  const { t } = useI18n();

  // Depois de salvar, a tela já passa a mostrar quem é admin e o estado de cada chave.
  // Uma chave recusada não foi salva: a anterior (se havia) continua valendo, então o estado dela não muda.
  const apply = (response: SettingsSaveResponse, saved: "tmdb" | "omdb" | "igdb" | "kinds") => {
    const next: Partial<SettingsView> = {
      isAdmin: response.isAdmin,
      canClaim: response.isAdmin ? false : settings.canClaim,
      enabledKinds: response.enabledKinds,
    };
    if (saved !== "tmdb" || response.tmdb !== KeyStatus.INVALID) next.tmdb = response.tmdb;
    if (saved !== "omdb" || response.omdb !== KeyStatus.INVALID) next.omdb = response.omdb;
    if (saved !== "igdb" || response.igdb !== KeyStatus.INVALID) next.igdb = response.igdb;
    onChanged(next);
  };

  const saveTmdb = async ([value]: string[]) => {
    const response = await titleServiceClient.saveSettings({ tmdbToken: value });
    apply(response, "tmdb");
    return response.tmdb;
  };

  const saveOmdb = async ([value]: string[]) => {
    const response = await titleServiceClient.saveSettings({ omdbKey: value });
    apply(response, "omdb");
    return response.omdb;
  };

  // Liga ou desliga uma categoria opcional. A lista enviada substitui a anterior.
  const saveKinds = async (kinds: TitleKind[]) => {
    const response = await titleServiceClient.saveSettings({ enabledKinds: { kinds } });
    apply(response, "kinds");
  };

  const saveIgdb = async ([clientId, clientSecret]: string[]) => {
    const response = await titleServiceClient.saveSettings({ igdbClientId: clientId, igdbClientSecret: clientSecret });
    apply(response, "igdb");
    return response.igdb;
  };

  return (
    <section
      className="panel settings"
      aria-labelledby="settings-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div className="panel-bar">
        <h2 id="settings-title" className="panel-title">
          {t.settings.title}
        </h2>
        <button type="button" className="button-quiet" onClick={onClose}>
          {t.settings.close}
        </button>
      </div>

      <p className="muted">{t.settings.intro}</p>
      {settings.canClaim && <p className="status-banner status-note">{t.settings.claimNotice}</p>}

      <KeyField name={t.settings.tmdbName} help={t.settings.tmdbHelp} status={settings.tmdb} save={saveTmdb} />
      <KeyField name={t.settings.omdbName} help={t.settings.omdbHelp} status={settings.omdb} save={saveOmdb} />
      <KeyField
        name={t.settings.igdbName}
        help={t.settings.igdbHelp}
        status={settings.igdb}
        labels={[t.settings.igdbClientId, t.settings.igdbClientSecret]}
        save={saveIgdb}
      />

      <Categories enabled={settings.enabledKinds} save={saveKinds} />

      <p className="muted">{t.settings.keepSecret}</p>

      <p>
        <a href={t.settings.guideUrl} target="_blank" rel="noopener noreferrer">
          {t.settings.guideLink}
        </a>
      </p>

      <details className="howto">
        <summary>{t.settings.howTo}</summary>
        <p className="muted">{t.settings.howToIntro}</p>
        <h3 className="howto-title">{t.settings.tmdbName}</h3>
        <ol>
          {t.settings.tmdbSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <h3 className="howto-title">{t.settings.omdbName}</h3>
        <ol>
          {t.settings.omdbSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <h3 className="howto-title">{t.settings.igdbName}</h3>
        <ol>
          {t.settings.igdbSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </details>
    </section>
  );
}
