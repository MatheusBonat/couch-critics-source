import { TitleKind } from "@notas-app/gen-shared";
import { getSetting, settingKeys } from "./settingsRepository";

// Categorias que o admin liga ou desliga em Configurações. Filmes, séries e jogos estão sempre ligados.
export const optionalKinds: TitleKind[] = [TitleKind.BOOK, TitleKind.ANIME, TitleKind.ALBUM];

export async function enabledKinds(): Promise<TitleKind[]> {
  const wanted = ((await getSetting(settingKeys.enabledKinds)) ?? "").split(",").map(Number);
  return optionalKinds.filter((kind) => wanted.includes(kind));
}
