# Changelog

All notable changes to Couch Critics. The format follows [Keep a Changelog](https://keepachangelog.com), and the versions follow [semantic versioning](https://semver.org). The newest version comes first.

## [2.6.5] - 2026-10-16

### Changed
- Same code as 2.6.3, sent to Root again with a new version number. Versions 2.6.1 to 2.6.4 were sent while the app was unavailable in one community, to try to unstick it with an update (2.6.4 carried the code of 2.5.0 as a test)

## [2.6.3] - 2026-10-16

### Fixed
- **The app did not start in Root with version 2.6.2.** The slim upload package of 2.6.2 left out the libraries that `sqlite3` loads when it starts (`bindings` and `file-uri-to-path`), so the server stopped at startup and the app stayed unavailable. The package now includes the dependencies of `sqlite3` (the `sqlite3` folder itself is still left out, because Root provides it). No change in the app itself: same code as 2.6.0

## [2.6.2] - 2026-10-16

### Fixed
- **The app could not be updated in Root (it stayed unavailable).** The upload package carried the whole `node_modules` folder (about 13,000 files and 59 MB), including development tools, and the Root portal took longer than its own time limit to process it (HTTP 524). Versions 2.6.0 and 2.6.1 were created in Root but kept the old client, so the app did not start. The package is now built from a clean staging folder with only what the server needs at run time (2,459 files, 3.7 MB) and uploads in a few seconds. No change in the app itself: same code as 2.6.0

### Changed
- `npm run package` (`scripts/package.cjs`) now builds that slim package

## [2.6.1] - 2026-10-15

### Changed
- Same code as 2.6.0, sent to Root again with a new version number (the upload of 2.6.0 ended with a gateway timeout, and Root does not accept the same number twice)

## [2.6.0] - 2026-10-15

### Added
- **Rate series by season**: besides the overall score and the score per episode, every season of a series now has its own score (with comment, Peak and Rock Bottom, spoiler and reactions, like any other rating). Open **Rate by season and episode** and the first row of each season is "Whole season". The season average appears in the season picker and the season scores are shown above the episodes. A season score does not change the average of the episodes or of the series. Only series from TMDB have seasons (anime keep rating by episode)
- **Franchise**: every title can now have a franchise, like "Harry Potter" or "The Legend of Zelda". Movies get it from the TMDB collection and games from the IGDB franchise; on any title (series, books, anime and songs too) the person who added it, or an admin, can write, change or clear it ("Set franchise" / "Change franchise" in the open title). Movies and games already in the community get their franchise by themselves, little by little, when the TMDB and IGDB keys are set. A franchise written by hand is never replaced by the one from the source
- **Filter by franchise** in the list (a drop-down that only appears when the category has franchises, with the number of titles and "No franchise"), and the search box now also finds a title by its franchise
- **Sort by name** (A to Z, in the language of the person, ignoring accents and capital letters, with "Rocky 2" before "Rocky 10")
- **Statistics by genre**: a new tab with the genres each person watched (rated or marked as watched), with count, bar and average score. Choose whose (you, the members or everyone) and the category

### Changed
- **Statistics** and **Hall of Fame** moved from the footer to the top bar, next to Ratings, To watch / play and Party Night

## [2.5.1] - 2026-10-14

### Fixed
- In the title search ("Add movie", "Add game"...), the cover touched the title because the cover column was narrower than the cover. There is now space between them, on wide and narrow screens.

### Source code
- This repository now has the full source of versions 2.4.2 to 2.5.1. The commits for 2.4.2, 2.4.3, 2.4.4 and 2.5.0 only carried the changelog and the version number, so the code of those versions (cover downloads, episode paging, contrast fixes, Party Night tabs) was missing here.

## [2.5.0] - 2026-10-14

### Changed
- **Party Night**: when you pick the options of a night, the titles are now split into tabs by category: **Movies and series** (anime go here too), **Games**, **Books** and **Songs** (only the categories that are turned on appear). The search works inside the open tab, what you picked stays when you switch tabs, and each tab shows how many titles you picked in it. A night can still mix categories

## [2.4.4] - 2026-10-14

### Fixed
- The cover cache limit (added in 2.4.2) could delete the covers of titles that were still in use, so big communities would see covers reload over and over. The limit now applies only to loose covers from searches (500), and a title's cover is never removed by it

## [2.4.3] - 2026-10-14

### Fixed
- Contrast (WCAG AA): the main buttons and the "open vote" badge had 4.08:1 in the dark Root theme; the background is now a slightly darker shade of the brand color (5.6:1). The titles under **Done** were dimmed as a whole, which left the secondary text at 2.6:1 in the light theme; now only the cover, the ring and the chips fade and the text keeps a passing contrast
- When Root refuses a notification for a Party Night, the reason is now written once (every few hours) to the app log that admins see, instead of failing silently

## [2.4.2] - 2026-10-13

### Fixed
- **Covers of long anime lists and some popular anime**: about 1 in 7 popular AniList covers is larger than the 150 KB limit, and the app gave up on them for good ("no cover"). The server now tries the smaller version of the same file, and covers saved as "no cover" by older versions are tried again once
- **Episode lists could pass Root's 256 KiB message limit** (for example 30 members rating 24 episodes with long comments). Episodes now load in pages sized by bytes, with a "Show more episodes" button
- The exported CSV now protects every way a cell can start a spreadsheet formula (leading spaces, full-width signs, tab, line breaks), puts every text cell in quotes and leaves numbers as numbers

### Security
- The server only downloads covers that the app really shows (a title of the community or a recent search result) and keeps at most 1500 covers, so a member cannot make it fetch and store arbitrary paths
- Cover downloads follow redirects by hand (only to the same host or archive.org, at most 3 hops) and stop reading as soon as the file passes the size limit

## [2.4.1] - 2026-10-13

### Changed
- While a cover is still being fetched (the first time a cover is shown, the server downloads it from the image service and that takes a few seconds), the row shows a moving placeholder instead of the title's initial, so it no longer looks like the cover is missing
- The empty Party Night screen has an icon, like the other empty screens

## [2.4.0] - 2026-10-13

### Added
- **Anime by episode**: anime can be rated episode by episode, like series. The episode list comes from AniList (the count of episodes that have aired and, when AniList has it, the name). Long anime are split into groups of 50 episodes so every answer stays under Root's 256 KiB limit
- **Songs by artist**: write the song name and put the artist in quotes, like `Envolver "Anitta"`. Writing only an artist (or only a song) also works, and the search tip shows in the Songs form

### Changed
- In **To watch / play**, a title you marked as watched, played, read or listened to no longer disappears: it goes to the end of your own list, under **Done**, dimmed (everyone else sees it where it was, and the counters count only what is left)
- Switching category clears the list search, so what you typed in Songs does not hide your Anime
- Night candidates still put the titles you have not seen first

## [2.3.1] - 2026-10-13

### Changed
- The search box on the list only filters what is already added, and it was not clear how to search the catalogs. Now **Enter** searches what you typed (TMDB, IGDB, Open Library, AniList, MusicBrainz) to add it, the "nothing in the list" screen has a main button, "Search “…” to add", and the same link shows under the results
- The "Only the ones I want" button was removed from **To watch / play**

## [2.3.0] - 2026-10-13

### Changed
- A new look for the whole app: a top bar with the three views (**Ratings**, **To watch / play**, **Party Night**) and a badge for votes that are open, categories with icons, a search box with the **Add** button next to the filters, a ring around each average score, and the Geist font and Phosphor icons bundled with the app (Root clients have no direct internet access)
- Going anywhere closes what was open: with Settings, Statistics or another panel open, choosing a category or a view closes the panel, closes the "add" form and the open title, and scrolls to the top. Before, only the tab changed underneath. Opening a panel also closes the "add" form
- On phones the views become three equal columns with the icon over the name, and the categories become a grid, so nothing is cut off
- The panel buttons in the footer show which panel is open, and the movie, series, game, book, anime and song icons are the same everywhere

## [2.2.1] - 2026-10-13

### Fixed
- Covers did not show up inside Root. A Root client cannot reach the internet directly, so covers now go through the app's server, which downloads them once and keeps a copy. The admins can test a cover in **Settings**
- Searching books with fewer than 3 letters showed "could not reach Open Library". Open Library refuses short searches, so the search now waits for 3 letters
- Links and checkboxes use the colors of the Root theme

### Changed
- The **Albums** category is now **Songs**: it searches singles on MusicBrainz (type "song artist" for the exact one)
- **Night** is now **Party Night**
- "Want / watching / watched" lives only in **To watch / play** and is gone from the notes screen. What you mark as watched or played leaves only your own list there

## [2.2.0] - 2026-10-12

### Added
- **To watch / play**: a view with the group's list of everything someone marked as "want", across all categories, with who wants each title. The most wanted come first. You can filter by category and by "only the ones I want", and add titles straight from the list
- **Party Night**: any member plans a movie or game night with a date, a voting deadline and 2 to 8 titles. Votes are public and each member answers going, maybe or not going. The voting closes at the deadline or when the creator (or an app admin) closes it. A tie is broken by the creator. The chosen title is flagged as "Night planned" in the lists, and after the night there is a shortcut to mark it as watched or played and rate it
- Root notifications for nights, with no manifest permission: the community activity indicator when a night opens or closes, and a notification to the members who said going or maybe when the night is decided and about one hour before it starts

### Changed
- A title that a member marked as watched or played leaves only that member's own "To watch / play" list (with an undo notice). Everyone else still sees it
- The privacy policy and the portal description cover the new data (votes, attendance, notifications)

## [2.0.1] - 2026-10-12

### Fixed
- The title list is now loaded in pages. Root refuses messages above 256 KiB, so a community with about 135 titles or more would have lost the list

### Added
- The community owner is always an app admin
- App admins are warned in the app's log inside Root when a service rejects a saved key
- The "About and credits" screen shows the Root Terms of Use, the Community Guidelines and how to ask for a correction or deletion of your data
- The source code is open, under the MIT license

### Changed
- The privacy policy no longer promises that uninstalling the app deletes everything (the Root documentation does not confirm it)

## [2.0.0] - 2026-10-12

### Added
- Three optional categories that need no API key: **books** (Open Library), **anime** (AniList) and **albums** (MusicBrainz)
- Import your ratings from a spreadsheet (CSV), with a review of the matches before importing
- The list shows 30 titles at a time, with "Show more"

### Fixed
- The CSV import paces its calls under Root's request limit (10 per second per client) and retries when Root answers with the limit error. The best year match is picked when several results share the name

## [1.3.0] - 2026-10-12

### Added
- Emoji reactions on other people's ratings
- "Want to watch / watching / watched" (and the matching words for games, books and albums) per member, with a list filter
- Statistics: who thinks like you, the titles that split the group, and a yearly recap ("My year")

## [1.2.0] - 2026-10-12

### Added
- Filters (including "not rated by me") and sort by year
- Spoiler comments, admin moderation (remove a comment or a title) and editing of titles added by hand
- Synopsis, genres and platforms on every title
- Hall of Fame and Shame, rating dates and CSV export

## [1.1.0] - 2026-10-11

First release.

### Added
- Scores from 0 to 10 in half points with an optional comment and an emoji picker, plus the special ratings **Peak** and **Rock Bottom**
- Movies and series (TMDB) and games (IGDB) with covers, found by name in English or Portuguese, with the IMDb rating from OMDb. Titles can also be added by hand
- A score per episode for series
- English and Portuguese, light and dark themes, live updates, and a Settings screen where the app admins paste the free API keys
