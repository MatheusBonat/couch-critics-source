import { CommunityAppLogType, rootServer } from "@rootsdk/server-app";

// Avisos para os admins da comunidade. Aparecem no log do app dentro do Root, para quem tem a permissão "Manage Apps"
// (o desenvolvedor não vê esse log). O mesmo aviso só é repetido depois de algumas horas, para não encher o log.
const repeatAfterMs = 6 * 60 * 60 * 1000;
const lastWritten = new Map<string, number>();

export function resetCommunityLog(): void {
  lastWritten.clear();
}

export async function warnAdmins(key: string, message: string, now: number = Date.now()): Promise<void> {
  const last = lastWritten.get(key);
  if (last !== undefined && now - last < repeatAfterMs) return;
  lastWritten.set(key, now);

  try {
    const levels = CommunityAppLogType as unknown as { Warn?: number } | undefined;
    await rootServer.dataStore?.logs?.community?.create({ communityAppLogType: (levels?.Warn ?? 2) as CommunityAppLogType, message });
  } catch {
    // O log é só um aviso a mais: nunca pode atrapalhar quem está usando o app.
  }
}
