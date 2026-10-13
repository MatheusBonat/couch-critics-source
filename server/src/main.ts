import { rootServer, RootAppStartState } from "@rootsdk/server-app";
import { titleService } from "./titleService";
import { nightService } from "./nightService";
import { coverService } from "./coverService";
import { initializeDatabase } from "./titleRepository";
import { initializeNights } from "./nightRepository";
import { initializeCovers } from "./coverRepository";
import { initializeSettings } from "./settingsRepository";

async function onStarting(state: RootAppStartState) {
  await initializeDatabase();
  await initializeSettings();
  await initializeNights();
  await initializeCovers();

  rootServer.lifecycle.addService(titleService);
  rootServer.lifecycle.addService(nightService);
  rootServer.lifecycle.addService(coverService);
  nightService.startSweeper();
}

(async () => {
  await rootServer.lifecycle.start(onStarting);
})();
