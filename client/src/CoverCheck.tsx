import { useState } from "react";
import { coverServiceClient } from "@notas-app/gen-client";
import { blobUrlOf, dataUrlOf } from "./covers";
import { posterUrl } from "./images";
import { useI18n } from "./i18n";

interface Props {
  // Uma capa de um título que já está na comunidade, usada no teste.
  samplePath: string;
}

interface Line {
  label: string;
  ok: boolean;
}

// Tenta carregar uma imagem de verdade, como a tela faz. Sem resposta em 6 segundos, conta como falha.
function canLoad(url: string): Promise<boolean> {
  if (!url) return Promise.resolve(false);
  return new Promise((resolve) => {
    const image = new Image();
    const timer = setTimeout(() => resolve(false), 6000);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image.naturalWidth > 0);
    };
    image.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    image.src = url;
  });
}

// Teste para admins, dentro das configurações: mostra, no Root de verdade, de que jeitos uma capa consegue ser exibida.
export function CoverCheck({ samplePath }: Props) {
  const { t } = useI18n();
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<Line[] | null>(null);

  const run = async () => {
    setRunning(true);
    const out: Line[] = [];
    out.push({ label: t.settings.coverCheck.direct, ok: await canLoad(posterUrl(samplePath, 92)) });

    let image: { mime: string; bytes: Uint8Array } | null = null;
    try {
      const response = await coverServiceClient.get({ paths: [samplePath] });
      const cover = response.covers[0];
      if (cover && cover.data.length > 0) image = { mime: cover.mime, bytes: cover.data };
    } catch {
      // Conta como falha abaixo.
    }
    out.push({ label: t.settings.coverCheck.server, ok: image !== null });
    out.push({ label: t.settings.coverCheck.blob, ok: image !== null && (await canLoad(blobUrlOf(image))) });
    out.push({ label: t.settings.coverCheck.dataUrl, ok: image !== null && (await canLoad(dataUrlOf(image))) });

    setLines(out);
    setRunning(false);
  };

  return (
    <div className="cover-check">
      <h3 className="howto-title">{t.settings.coverCheck.title}</h3>
      <p className="muted">{samplePath ? t.settings.coverCheck.hint : t.settings.coverCheck.noSample}</p>
      <div className="actions">
        <button type="button" className="button-outline" disabled={running || !samplePath} onClick={() => void run()}>
          {running ? t.settings.coverCheck.running : t.settings.coverCheck.run}
        </button>
      </div>
      {lines && (
        <ul className="cover-check-lines">
          {lines.map((line) => (
            <li key={line.label}>
              <span aria-hidden="true">{line.ok ? "✓" : "✗"}</span> {line.label}: {line.ok ? t.settings.coverCheck.ok : t.settings.coverCheck.fail}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
