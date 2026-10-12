# Couch Critics

A [Root](https://www.rootapp.com) app where the members of a community rate movies, series, games, books, anime and albums together and see each other's scores in one place.

Português: [README.pt.md](README.pt.md)

> Couch Critics is an independent project. It is not an official Root app, and it is not sponsored, endorsed or certified by Root, TMDB, OMDb, IGDB, Twitch, Open Library, AniList or MusicBrainz. See [NOTICE.md](NOTICE.md).

## Features

- Scores from 0 to 10 in half points, with an optional comment (emoji picker included). Two special ratings: **Peak** (above 10, counts as 10) and **Rock Bottom** (below 0, counts as 0)
- One score per member per title, editable at any time. Each row shows the average, the IMDb rating and the first members' scores without opening it
- Search by name, in English or Portuguese, with covers, synopsis and genres: movies and series (TMDB), games (IGDB, with platforms), and optional books (Open Library), anime (AniList) and albums (MusicBrainz), which need no API key. Titles can also be added by hand
- Series: an overall score and, optionally, a score per episode (with the IMDb rating of each episode)
- Spoiler comments, emoji reactions on other people's ratings, and "want to watch / watching / watched" per member
- "To watch / play" view: the group's list of everything someone marked "want to watch / play / read / listen to", across all categories, with who wants each title. Titles that more people want come first; filter by category or "only the ones I want". When you mark a title as watched or played, it leaves only your own list (everyone else still sees it; there is an "Undo" notice). You can add titles straight from there (the new title is marked "want" for whoever added it)
- "Night" view: any member creates a night with an optional name, date and time, a voting deadline and 2 to 8 titles from the community. Each member has one vote (changeable until it closes; **votes are public**, everyone sees who voted for what) and answers Going / Maybe / Not going. The voting closes at the deadline or when the creator (or an admin) closes it; the most voted option wins and, on a tie (or when nobody voted), the creator picks among the tied ones. The chosen title is flagged as "Night planned" in the lists. Six hours after the start the night moves on its own to "happened" (or "canceled" if a tie was never resolved), and after it there is a shortcut to mark the title as watched/played and rate it. Limits: 5 open nights in the community and 3 per person. The server checks deadlines every 30 seconds and when listing. The app uses Root's notifications (no manifest permission): the community activity indicator when a night opens or closes, and a notification to the members who said Going or Maybe when the night is decided and about 1 hour before it starts (delivery depends on Root; not tested in the real Root yet)
- Statistics: who thinks like you, the titles that split the group, a yearly recap per member, and a Hall of Fame and Shame
- Filters ("not rated by me", watch status), sort by score, date or year, and a list that shows 30 titles at a time
- Import your ratings from a CSV spreadsheet (titles are matched with the search before importing) and export them
- Moderation: admins can remove comments and titles; titles added by hand can be edited
- English and Portuguese, light and dark themes (it follows the Root theme), narrow screens
- Live updates for every member

## Data sources and API keys

Each community that installs the app uses its **own free keys**, which the app admins paste in the app's Settings screen (they are stored in the community's own database and never shown again):

| Service | Used for | Key |
|---|---|---|
| TMDB | movies and series, covers, episodes | yes |
| OMDb | IMDb ratings | yes |
| IGDB (Twitch) | games | yes (Client ID and Client Secret) |
| Open Library, AniList, MusicBrainz + Cover Art Archive | books, anime, albums (optional categories) | no |

The app admins are chosen when the app is installed (the "App admins" setting), and the community owner is always an admin. When a service rejects a saved key, the app warns the admins in the app log inside Root. Without keys the app still works with titles added by hand. Guides: [how to get the keys](docs/api-keys.en.md) and [how to set them up](docs/how-to-set-up.en.md) (also in Portuguese: [chaves](docs/chaves-de-api.pt.md), [configurar](docs/como-configurar.pt.md)).

The privacy policy of the published app is in [docs/privacy-policy.md](docs/privacy-policy.md): the developer receives and collects nothing; scores and comments live in the community's database hosted by Root.

## Project layout

| Folder | What it has |
|---|---|
| `networking/src/titles.proto` | The contract between the client and the server (protobuf over the Root SDK RPC). After changing it, run `npm run build`. Root limits every message to 256 KiB, so any call that returns a collection has to be paged (the title list is) |
| `server/src` | Rules, validation and the SQLite storage (`titleService.ts`, `*Repository.ts`) |
| `server/src/providers` | TMDB, OMDb, IGDB/Twitch, Open Library, AniList and MusicBrainz clients (timeouts, pacing, clear errors) |
| `server/src/access.ts` | Who is an admin of the app |
| `server/src/nightService.ts`, `nightRepository.ts` | Movie/game nights: create, vote, attendance, close, tie-break, deadlines, reminders and past nights (paged) |
| `client/src/nights.ts` | The Night rules on the client (groups, votes, ties, planned night, dates and form) |
| `client/src` | The React UI. It uses the Root color variables, so it follows the light and dark themes |
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
- Change the `User-Agent` in [`server/src/providers/catalog.ts`](server/src/providers/catalog.ts) to identify your own project: MusicBrainz and AniList ask for an identifiable one and may block abusive clients
- Keep the TMDB attribution (the logo and the notice in the "About and credits" screen) if you use the TMDB API, and follow the terms of every service you use. Most of them are for non-commercial use
- Change the contact and links in the privacy policy and guides

## License

[MIT](LICENSE). Third-party notices and what the license does not cover are in [NOTICE.md](NOTICE.md).
