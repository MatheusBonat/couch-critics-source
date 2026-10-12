import { useState } from "react";
import { UserProfile } from "@rootsdk/client-app";
import { Title, WatchStatus } from "@notas-app/gen-shared";
import { titleServiceClient } from "@notas-app/gen-client";
import { useI18n } from "./i18n";
import { displayName } from "./profiles";
import { errorMessage, kinds, watchStatusOf } from "./lib";

interface Props {
  title: Title;
  me: string;
  profiles: Map<string, UserProfile>;
  onChanged: (title: Title) => void;
  onError: (message: string) => void;
}

// Quero ver / vendo / já vi (nos jogos, quero jogar / jogando / já joguei): o estado de cada pessoa neste título.
// Clicar no estado que já está marcado limpa. Embaixo, quem marcou cada estado.
export function WatchControls({ title, me, profiles, onChanged, onError }: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  const kindKey = kinds.find((item) => item.kind === title.kind)?.key ?? "movie";
  const labels = t.watch.labels[kindKey];
  const mine = watchStatusOf(title, me);

  const options = [
    { status: WatchStatus.WANT, label: labels.want },
    { status: WatchStatus.DOING, label: labels.doing },
    { status: WatchStatus.DONE, label: labels.done },
  ];

  const set = async (status: WatchStatus) => {
    setBusy(true);
    try {
      const response = await titleServiceClient.setWatchStatus({ titleId: title.id, status });
      if (response.title) onChanged(response.title);
    } catch (error) {
      onError(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  const groups = options
    .map((option) => ({
      ...option,
      names: title.statuses
        .filter((entry) => entry.status === option.status)
        .map((entry) => (entry.userId === me ? t.youTitle : displayName(profiles, entry.userId, t.member))),
    }))
    .filter((group) => group.names.length > 0);

  return (
    <div className="watch">
      <div className="watch-row" role="group" aria-label={t.watch.label}>
        <span className="watch-label">{t.watch.label}</span>
        {options.map((option) => (
          <button
            key={option.status}
            type="button"
            className={mine === option.status ? "watch-button is-active" : "watch-button"}
            aria-pressed={mine === option.status}
            disabled={busy}
            onClick={() => void set(mine === option.status ? WatchStatus.UNSPECIFIED : option.status)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {groups.length > 0 && (
        <ul className="watch-groups">
          {groups.map((group) => (
            <li key={group.status}>{t.watch.group(group.label, group.names.join(", "))}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
