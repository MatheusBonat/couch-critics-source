import { useEffect, useState } from "react";
import { posterUrl } from "./images";

interface Props {
  path: string;
  name: string;
  alt: string;
  size?: "small" | "medium";
}

// Capa do título. Sem capa (título adicionado à mão) ou se a imagem não carregar, mostra a inicial do nome.
export function Poster({ path, name, alt, size = "small" }: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [path]);

  const url = failed ? "" : posterUrl(path, 154);
  const className = `poster poster-${size}`;

  if (url) {
    return <img className={className} src={url} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
  }

  return (
    <span className={`${className} poster-empty`} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
