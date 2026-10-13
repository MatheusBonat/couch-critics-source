import { useEffect, useState } from "react";
import { coverSources, loadCover } from "./covers";
import { posterUrl } from "./images";

interface Props {
  path: string;
  name: string;
  alt: string;
  size?: "small" | "medium";
}

// Capa do título. A imagem vem pelo servidor do app (no Root as capas de endereços externos podem não carregar); se ela não
// carregar de um jeito, tenta o outro e, por último, o endereço direto. Sem capa (título adicionado à mão) ou se nada
// funcionar, mostra a inicial do nome.
export function Poster({ path, name, alt, size = "small" }: Props) {
  const [sources, setSources] = useState<Array<() => string>>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let alive = true;
    setSources([]);
    setIndex(0);
    if (!path) return;

    void loadCover(path).then((result) => {
      if (alive) setSources(coverSources(result, posterUrl(path, 154)));
    });
    return () => {
      alive = false;
    };
  }, [path]);

  const url = index < sources.length ? sources[index]() : "";
  const className = `poster poster-${size}`;

  if (url) {
    return <img className={className} src={url} alt={alt} onError={() => setIndex((current) => current + 1)} />;
  }

  return (
    <span className={`${className} poster-empty`} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
