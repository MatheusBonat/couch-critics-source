import { rootServer, RootAppStartState } from "@rootsdk/server-app";
import { titleService } from "./titleService";
import { nightService } from "./nightService";
import { initializeDatabase } from "./titleRepository";
import { initializeNights } from "./nightRepository";
import { initializeSettings } from "./settingsRepository";

async function onStarting(state: RootAppStartState) {
  await initializeDatabase();
  await initializeSettings();
  await initializeNights();

  rootServer.lifecycle.addService(titleService);
  rootServer.lifecycle.addService(nightService);
  nightService.startSweeper();
}

(async () => {
  await rootServer.lifecycle.start(onStarting);
})();
