import { rootServer, RootAppStartState } from "@rootsdk/server-app";
import { titleService } from "./titleService";
import { initializeDatabase } from "./titleRepository";
import { initializeSettings } from "./settingsRepository";

async function onStarting(state: RootAppStartState) {
  await initializeDatabase();
  await initializeSettings();

  rootServer.lifecycle.addService(titleService);
}

(async () => {
  await rootServer.lifecycle.start(onStarting);
})();
