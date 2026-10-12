# Changelog

All notable changes to Couch Critics. The format follows [Keep a Changelog](https://keepachangelog.com), and the versions follow [semantic versioning](https://semver.org). The newest version comes first.

## [2.2.0] - 2026-10-12

### Added
- **To watch / play**: a view with the group's list of everything someone marked as "want", across all categories, with who wants each title. The most wanted come first. You can filter by category and by "only the ones I want", and add titles straight from the list
- **Night**: any member plans a movie or game night with a date, a voting deadline and 2 to 8 titles. Votes are public and each member answers going, maybe or not going. The voting closes at the deadline or when the creator (or an app admin) closes it. A tie is broken by the creator. The chosen title is flagged as "Night planned" in the lists, and after the night there is a shortcut to mark it as watched or played and rate it
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
