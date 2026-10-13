// Capas de filmes e séries vêm do servidor de imagens do TMDB. Tamanhos disponíveis: w92, w154, w185, w342, w500.
const tmdbBase = "https://image.tmdb.org/t/p";

// Capas de jogos vêm do IGDB e chegam como "igdb:<id da imagem>". Tamanhos: t_cover_small (90 px de largura) e t_cover_big (264 px).
const igdbBase = "https://images.igdb.com/igdb/image/upload";

// Livros: "ol:<id da capa>" na Open Library. Animes: "al:<caminho>" no servidor de imagens da AniList.
// Músicas: "mb:<id do lançamento>" no Cover Art Archive (se não tiver capa, a imagem falha e a tela mostra a inicial).
const openLibraryBase = "https://covers.openlibrary.org/b/id";
const aniListBase = "https://s4.anilist.co/file/anilistcdn";
const coverArtBase = "https://coverartarchive.org/release-group";

export function posterUrl(path: string, width: 92 | 154 | 185 | 342): string {
  if (!path) return "";

  if (path.startsWith("igdb:")) {
    const id = path.slice(5);
    if (!/^[A-Za-z0-9_-]+$/.test(id)) return "";
    return `${igdbBase}/${width <= 92 ? "t_cover_small" : "t_cover_big"}/${id}.jpg`;
  }

  if (path.startsWith("ol:")) {
    const id = path.slice(3);
    return /^\d{1,12}$/.test(id) ? `${openLibraryBase}/${id}-${width <= 92 ? "S" : "M"}.jpg` : "";
  }

  if (path.startsWith("al:")) {
    const rest = path.slice(3);
    return /^[A-Za-z0-9/_.-]+$/.test(rest) && !rest.includes("..") ? `${aniListBase}/${rest}` : "";
  }

  if (path.startsWith("mb:")) {
    const id = path.slice(3);
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) ? `${coverArtBase}/${id}/front-250` : "";
  }

  return `${tmdbBase}/w${width}${path}`;
}
