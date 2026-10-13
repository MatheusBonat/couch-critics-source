import {
  BookOpenText,
  ChartBar,
  Confetti,
  DownloadSimple,
  FilmSlate,
  GameController,
  GearSix,
  Info,
  ListChecks,
  MagnifyingGlass,
  MusicNotes,
  Plus,
  Sparkle,
  Star,
  Television,
  Trophy,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { KindKey } from "./i18n";

// Um conjunto só de ícones (Phosphor, traço regular), para a tela inteira ter o mesmo peso e tamanho.
// O tamanho segue a fonte do texto ao lado (1.15em) e a cor segue a cor do texto.
const props = { weight: "regular" as const, className: "icon", "aria-hidden": true };

const make = (Glyph: Icon) => () => <Glyph {...props} />;

export const IconNotes = make(Star);
export const IconToWatch = make(ListChecks);
export const IconParty = make(Confetti);
export const IconSettings = make(GearSix);
export const IconClose = make(X);
export const IconAdd = make(Plus);
export const IconSearch = make(MagnifyingGlass);
export const IconStats = make(ChartBar);
export const IconHall = make(Trophy);
export const IconImport = make(UploadSimple);
export const IconExport = make(DownloadSimple);
export const IconAbout = make(Info);

const kindIcons: Record<KindKey, Icon> = {
  movie: FilmSlate,
  series: Television,
  game: GameController,
  book: BookOpenText,
  anime: Sparkle,
  album: MusicNotes,
};

export function KindIcon({ kind }: { kind: KindKey }) {
  const Icon = kindIcons[kind];
  return <Icon {...props} />;
}
