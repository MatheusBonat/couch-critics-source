# Couch Critics: development guide

[← Back to the README](../README.md)

## Data sources and API keys

Each community that installs the app uses its **own free keys**, which the app admins paste in the app's Settings screen (they are stored in the community's own database and never shown again):

| Service | Used for | Key |
|---|---|---|
| TMDB | movies and series, covers, episodes | yes |
| OMDb | IMDb ratings | yes |
| IGDB (Twitch) | games | yes (Client ID and Client Secret) |
| Open Library, AniList, MusicBrainz + Cover Art Archive | books, anime, songs (optional categories) | no |

The app admins are chosen when the app is installed (the "App admins" setting), and the community owner is always an admin. When a service rejects a saved key, the app warns the admins in the app log inside Root. Without keys the app still works with titles added by hand. Guides: [how to get the keys](api-keys.en.md) and [how to set them up](how-to-set-up.en.md) (also in Portuguese: [chaves](chaves-de-api.pt.md), [configurar](como-configurar.pt.md)).

The privacy policy of the published app is in [privacy-policy.md](privacy-policy.md): the developer receives and collects nothing; scores and comments live in the community's database hosted by Root.

## Project layout

| Folder | What it has |
|---|---|
| `networking/src/titles.proto` | The contract between the client and the server (protobuf over the Root SDK RPC). After changing it, run `npm run build`. Root limits every message to 256 KiB, so any call that returns a collection has to be paged (the title list is) |
| `server/src` | Rules, validation and the SQLite storage (`titleService.ts`, `*Repository.ts`) |
| `server/src/providers` | TMDB, OMDb, IGDB/Twitch, Open Library, AniList and MusicBrainz clients (timeouts, pacing, clear errors) |
| `server/src/access.ts` | Who is an admin of the app |
| `server/src/nightService.ts`, `nightRepository.ts` | Movie/game nights: create, vote, attendance, close, tie-break, deadlines, reminders and past nights (paged) |
| `server/src/coverService.ts`, `coverRepository.ts` | Covers: a Root client has no direct internet access, so the server downloads each cover once (only from allowed image hosts), keeps a copy in SQLite and sends it in small batches. The client side is `client/src/covers.ts` |
| `client/src/nights.ts` | The Party Night rules on the client (groups, votes, ties, planned night, dates and form) |
| `client/src` | The React UI. It uses the Root color variables, so it follows the light and dark themes |
| `client/src/design.css`, `icons.tsx` | The look: tokens built on the Root theme variables (so light and dark follow Root), the Geist font bundled in `assets/fonts`, and Phosphor icons. `styles.css` has the older base rules and `design.css` is loaded after it |
| `client/src/i18n.tsx` | Every text of the UI in Portuguese and English. To change a sentence or add a language, start here |
| `client/src/importer.ts` | The CSV import logic (parsing, matching, pacing under the Root request limit) |
| `scripts/package.cjs` | Builds the upload package without leaking secrets (see below) |

The internal packages are still called `notas-app` (the original project name). This does not show to anyone and does not affect the app.

## Run it locally

You need Node.js 22 or newer and a Root developer account.

1. In the Root dev portal ([dev.rootapp.com](https://dev.rootapp.com)), create an app, open it in **My apps**, go to **Settings** and click **Generate new dev token**.
2. Copy `server/.env.example` to `server/.env` and paste the token after the `=` (one line, no repeated prefix). This file is ignored by git.
3. Put your app's ID in the `id` field of `root-manifest.json`.
4. In the project folder:

```bash
npm install
npm run build
```

5. In one terminal run `npm run server` inside `server/`. In another, `npm run client` inside `client/`. The UI opens at http://localhost:5173.

Tips for the dev host:

- The bar at the top of the page switches the virtual user. Open the page in two windows to simulate two members.
- Virtual users have no profile, so their name shows as "Member". In a real community the nickname and picture show.
- The data lives in `server/rootsdk.sqlite3`. Delete it (with the server stopped) to reset.
- If you change server code, run `npm run build` and restart `npm run server`.

## Publish your own version

1. Use your own app ID in `root-manifest.json` and raise the `version`: Root refuses an upload whose version already exists.
2. Package and upload (the token is the one in **Settings → Tokens** of the portal, different from the dev token):

```bash
npm install && npm run build
npm run package
npx rootsdk upload package --file ./rootapp.pkg --authToken <AUTH_TOKEN> --host dev.rootapp.com
```

Always use `npm run package` instead of calling `rootsdk build package` directly. The packager copies the whole `node_modules` folder, and `node_modules/@notas-app/server` is a link to `server/`, so the package would carry `server/.env` (your dev token) and the test database `server/rootsdk.sqlite3` (which holds API keys pasted in Settings). The script moves those files away, builds the package, checks its contents (and deletes it if it finds a secret) and puts the files back. Stop the dev server first.

## If you fork it

- Use your own app ID, name and logo. The name "Couch Critics" and its logo are not covered by the MIT license
- Change the `User-Agent` in [`server/src/providers/catalog.ts`](../server/src/providers/catalog.ts) to identify your own project: MusicBrainz and AniList ask for an identifiable one and may block abusive clients
- Keep the TMDB attribution (the logo and the notice in the "About and credits" screen) if you use the TMDB API, and follow the terms of every service you use. Most of them are for non-commercial use
- Change the contact and links in the privacy policy and guides
