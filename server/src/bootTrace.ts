import { rootServer } from "@rootsdk/server-app";
import { trace, traceError } from "./startupLog";

// Este arquivo é o PRIMEIRO import do main.ts de propósito: ele roda antes de db.ts, que já usa a configuração do banco ao
// ser carregado, e assim o log mostra se o servidor chegou a ser iniciado e como estava o ambiente.
trace(`servidor carregado (node ${process.version}, ${process.platform}/${process.arch}, memória ${Math.round(process.memoryUsage().rss / 1048576)} MB)`);

try {
  const file = rootServer.dataStore?.config?.sqlite3?.filename;
  trace(file ? `banco de dados configurado: ${file}` : "banco de dados NÃO configurado (rootServer.dataStore.config.sqlite3 vazio)");
} catch (error) {
  traceError("não consegui ler a configuração do banco", error);
}

// Um erro que ninguém tratou derrubaria o servidor sem deixar rastro: grava e termina como antes (depois de 2 s, para o log sair).
function fatal(what: string, error: unknown): void {
  traceError(what, error);
  setTimeout(() => process.exit(1), 2000);
}
process.on("uncaughtException", (error) => fatal("erro não tratado", error));
process.on("unhandledRejection", (reason) => fatal("promessa rejeitada sem tratamento", reason));
