import { CommunityAppLogType, rootServer } from "@rootsdk/server-app";

// Rastro da inicialização do servidor, para saber até onde ele chega quando o app fica indisponível.
// Cada linha vai para a saída do servidor (console) e para o log do app dentro do Root (quem tem "Manage Apps" vê).
// As linhas são gravadas em ordem e sem esperar: gravar o log nunca pode travar nem derrubar o servidor.
export const buildLabel = "2.6.7 (log de inicialização)";

let chain: Promise<unknown> = Promise.resolve();

// Níveis do log do app (Info = 1, Error = 3 no SDK); se o SDK não trouxer o enum, usa os números.
function level(name: "Info" | "Error", fallback: number): CommunityAppLogType {
  const levels = CommunityAppLogType as unknown as Record<string, number> | undefined;
  return (levels?.[name] ?? fallback) as CommunityAppLogType;
}

function write(type: CommunityAppLogType, message: string): void {
  chain = chain
    .then(() => rootServer.dataStore?.logs?.community?.create({ communityAppLogType: type, message: message.slice(0, 900) }))
    .catch(() => {
      // O log é só um aviso a mais.
    });
}

export function trace(message: string): void {
  const line = `[Couch Critics ${buildLabel}] ${message}`;
  try {
    console.log(line);
    write(level("Info", 1), line);
  } catch {
    // Nunca derruba o servidor.
  }
}

export function traceError(message: string, error: unknown): void {
  try {
    const detail = error instanceof Error ? `${error.name}: ${error.message}\n${(error.stack ?? "").split("\n").slice(1, 6).join("\n")}` : String(error);
    const line = `[Couch Critics ${buildLabel}] ${message}: ${detail}`;
    console.error(line);
    write(level("Error", 3), line);
  } catch {
    // Nunca derruba o servidor.
  }
}
