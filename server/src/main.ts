import "./bootTrace";
import { rootServer, RootAppStartState } from "@rootsdk/server-app";
import { titleService } from "./titleService";
import { nightService } from "./nightService";
import { coverService } from "./coverService";
import { initializeDatabase } from "./titleRepository";
import { initializeNights } from "./nightRepository";
import { initializeCovers } from "./coverRepository";
import { initializeSettings } from "./settingsRepository";
import { knex } from "./db";
import { trace, traceError } from "./startupLog";

// Quantas linhas há em cada tabela principal, para ver o tamanho dos dados da comunidade no log.
async function describeData(): Promise<string> {
  const parts: string[] = [];
  for (const table of ["titles", "ratings", "season_ratings", "episode_ratings", "covers", "nights"]) {
    try {
      const row = (await knex(table).count({ n: "*" }))[0] as { n: number | string };
      parts.push(`${table}=${row.n}`);
    } catch {
      parts.push(`${table}=?`);
    }
  }
  return parts.join(" ");
}

async function step(name: string, run: () => Promise<void>): Promise<void> {
  trace(`${name}: começando`);
  try {
    await run();
  } catch (error) {
    traceError(`${name}: FALHOU`, error);
    throw error;
  }
  trace(`${name}: ok`);
}

async function onStarting(state: RootAppStartState) {
  trace("onStarting: começou");

  await step("banco de dados (initializeDatabase)", initializeDatabase);
  await step("configurações (initializeSettings)", initializeSettings);
  await step("noites (initializeNights)", initializeNights);
  await step("capas (initializeCovers)", initializeCovers);
  trace(`dados: ${await describeData()}`);

  rootServer.lifecycle.addService(titleService);
  rootServer.lifecycle.addService(nightService);
  rootServer.lifecycle.addService(coverService);
  trace("serviços registrados (títulos, noites, capas)");

  nightService.startSweeper();
  trace("onStarting: terminou, o servidor está pronto");
}

// O Root desliga o app de propósito ("Hub is disconnecting" ou SIGTERM, quando troca a máquina ou reinicia o
// serviço): para o varredor das noites e fecha o banco antes de sair, para nenhuma gravação ficar pela metade.
// O SDK espera esta função por até 15 s e depois sai de qualquer jeito.
async function onStopping() {
  trace("onStopping: o Root pediu para desligar; parando o varredor e fechando o banco");
  nightService.stopSweeper();
  await knex.destroy();
}

(async () => {
  trace("chamando rootServer.lifecycle.start");
  try {
    await rootServer.lifecycle.start(onStarting, onStopping);
    trace("rootServer.lifecycle.start voltou");
  } catch (error) {
    traceError("rootServer.lifecycle.start FALHOU", error);
    throw error;
  }
})();
