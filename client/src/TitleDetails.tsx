import { useState } from "react";
import { Title } from "@notas-app/gen-shared";
import { useI18n } from "./i18n";
import { genresOf, overviewOf } from "./lib";

const previewLength = 280;

// Gêneros, plataformas (jogos) e sinopse do título, no idioma da pessoa. Some quando não há nada para mostrar
// (título à mão, ou de antes da 1.2 que ainda não recebeu os detalhes).
export function TitleDetails({ title }: { title: Title }) {
  const { t, lang } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const genres = genresOf(title, lang);
  const overview = overviewOf(title, lang);
  const meta = [genres, title.platforms ? `${t.details.platforms}: ${title.platforms}` : ""].filter(Boolean).join(" · ");

  if (!meta && !overview) return null;

  const long = overview.length > previewLength;
  const shown = long && !expanded ? `${overview.slice(0, previewLength).trimEnd()}…` : overview;

  return (
    <div className="synopsis">
      {meta && <p className="synopsis-meta">{meta}</p>}
      {overview && <p className="synopsis-text">{shown}</p>}
      {long && (
        <button type="button" className="button-quiet synopsis-toggle" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>
          {expanded ? t.details.showLess : t.details.showMore}
        </button>
      )}
    </div>
  );
}
