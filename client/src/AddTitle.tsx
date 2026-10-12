import { useState } from "react";
import { KeyStatus, Title } from "@notas-app/gen-shared";
import { AddTitleForm } from "./AddTitleForm";
import { SearchPanel } from "./SearchPanel";
import { useI18n } from "./i18n";
import { KindInfo, sourceNameOf } from "./lib";

interface Props {
  kind: KindInfo;
  initialName: string;
  // Estado da chave da fonte desta categoria: TMDB (filmes e séries) ou IGDB (jogos).
  source: KeyStatus;
  canConfigure: boolean;
  onCreated: (title: Title) => void;
  onCancel: () => void;
  onOpenExisting: (id: number) => void;
  onOpenSettings: () => void;
}

// Filmes, séries e jogos podem ser buscados pelo nome. Qualquer título que a busca não ache entra à mão.
export function AddTitle({ kind, initialName, source, canConfigure, onCreated, onCancel, onOpenExisting, onOpenSettings }: Props) {
  const { t } = useI18n();

  const sourceName = sourceNameOf(kind.kind);
  // Toda categoria tem busca; só filmes, séries e jogos dependem de chave (as outras estão sempre disponíveis).
  const searchAvailable = source !== KeyStatus.UNSPECIFIED;

  const [mode, setMode] = useState<"search" | "manual">(searchAvailable ? "search" : "manual");
  const [text, setText] = useState(initialName);

  if (mode === "search") {
    return (
      <SearchPanel
        kind={kind}
        initialQuery={text}
        canConfigure={canConfigure}
        onCreated={onCreated}
        onCancel={onCancel}
        onOpenExisting={onOpenExisting}
        onOpenSettings={onOpenSettings}
        onManual={(query) => {
          setText(query);
          setMode("manual");
        }}
      />
    );
  }

  return (
    <>
      {!searchAvailable && (
        <div className="status-banner status-inline" role="status">
          <span>{canConfigure ? t.search.notConfiguredAdmin(sourceName) : t.search.notConfigured}</span>
          {canConfigure && (
            <button type="button" className="button-outline" onClick={onOpenSettings}>
              {t.search.openSettings}
            </button>
          )}
        </div>
      )}

      <AddTitleForm
        key={text}
        kind={kind}
        initialName={text}
        onCreated={onCreated}
        onCancel={onCancel}
        onBackToSearch={
          searchAvailable
            ? (name) => {
                setText(name);
                setMode("search");
              }
            : undefined
        }
      />
    </>
  );
}
