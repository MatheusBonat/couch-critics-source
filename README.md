<div align="center">

# 🛋️ Couch Critics

**Rate movies, series, games, books, anime and songs with your community, and plan the next movie night.**

A free, open source [Root](https://www.rootapp.com) app. Everyone rates, everyone sees the scores, and the group decides what to watch or play next.

[![License: MIT](https://img.shields.io/github/license/MatheusBonat/couch-critics-source?color=blue)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/MatheusBonat/couch-critics-source?color=brightgreen)](https://github.com/MatheusBonat/couch-critics-source/releases)
[![Last commit](https://img.shields.io/github/last-commit/MatheusBonat/couch-critics-source)](https://github.com/MatheusBonat/couch-critics-source/commits/main)
![Root app](https://img.shields.io/badge/Root-app-60a5fa)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232a?logo=react&logoColor=61dafb)

[Features](#-features) · [Screenshots](#%EF%B8%8F-screenshots) · [What's new](#-whats-new) · [Set it up](#-set-it-up) · [For developers](#-for-developers) · [Changelog](CHANGELOG.md) · [Português](README.pt.md)

<img src="docs/screenshots/01-notes-list.png" alt="Couch Critics: the list of ratings" width="860">

</div>

> Couch Critics is an independent project. It is not an official Root app, and it is not sponsored, endorsed or certified by Root, TMDB, OMDb, IGDB, Twitch, Open Library, AniList or MusicBrainz. See [NOTICE.md](NOTICE.md).

## ✨ Features

**Rate together**
- Scores from 0 to 10 in half points, with an optional comment and an emoji picker. Two special ratings: **Peak** (counts as 10) and **Rock Bottom** (counts as 0)
- One score per member per title. Every row shows the average, the IMDb rating and the first members' scores
- Emoji reactions on other people's ratings, spoiler comments, and a score for each episode of a series

**Find and add titles**
- Search with covers, synopsis and genres, in English or Portuguese: movies and series (TMDB), games (IGDB) and, optionally, books (Open Library), anime (AniList) and songs (MusicBrainz), which need no API key
- Import your old ratings from a spreadsheet (CSV) and export them

**Decide what's next**
- **To watch / play**: the group's list of everything someone wants to watch, play, read or listen to, with who wants each one. What you already finished leaves only your own list
- **Party Night**: plan a movie or game night. Pick 2 to 8 titles, set a voting deadline, everyone votes (votes are public) and says if they are coming. The winner becomes a planned night, and Root notifications remind the ones who are going

**Know your group**
- Who thinks like you, the titles that split the group, your year in ratings, and a Hall of Fame and Shame

**Built for communities**
- English and Portuguese, light and dark themes (it follows the Root theme), narrow screens, and live updates for every member
- Admins choose who configures the app, can remove comments and titles, and turn the optional categories on or off
- No ads, no analytics and no tracking. The developer never sees a community's data

Every detail is in [docs/features.md](docs/features.md).

## 🖼️ Screenshots

### Rate together

<table>
<tr>
<td width="50%" valign="top">

<img src="docs/screenshots/02-reactions.png" alt="Ratings with comments and reactions" width="100%"><br>
<b>A score per member, with reactions</b><br>
<sub>Emoji reactions on other people's ratings, and an optional comment with every score.</sub>

</td>
<td width="50%" valign="top">

<img src="docs/screenshots/03-spoilers.png" alt="A spoiler comment hidden until clicked" width="100%"><br>
<b>Spoilers stay hidden</b><br>
<sub>Mark a comment as spoiler and it only opens when someone clicks it.</sub>

</td>
</tr>
<tr>
<td width="50%" valign="top">

<img src="docs/screenshots/04-details.png" alt="Synopsis, genres and platforms" width="100%"><br>
<b>Synopsis, genres and platforms</b><br>
<sub>In English or Portuguese, straight from the data sources.</sub>

</td>
<td width="50%" valign="top">

<img src="docs/screenshots/15-episodes.png" alt="Rating a series episode by episode" width="100%"><br>
<b>Series, episode by episode</b><br>
<sub>An overall score and, if you want, one for each episode.</sub>

</td>
</tr>
</table>

### Find and add titles

<table>
<tr>
<td width="33%" valign="top">

<img src="docs/screenshots/05-search.png" alt="Searching for a movie with covers" width="100%"><br>
<b>Search with covers</b><br>
<sub>Movies, series, games, books, anime and songs, in English or Portuguese. Can't find it? Add it by hand.</sub>

</td>
<td width="33%" valign="top">

<img src="docs/screenshots/06-books.png" alt="The books category" width="100%"><br>
<b>Books, anime and songs</b><br>
<sub>Optional categories that need no API key: the admin ticks them in Settings.</sub>

</td>
<td width="33%" valign="top">

<img src="docs/screenshots/07-import-csv.png" alt="Importing ratings from a spreadsheet" width="100%"><br>
<b>Import your old ratings</b><br>
<sub>Bring a CSV, check the matches, import. You can export yours too.</sub>

</td>
</tr>
</table>

### Decide what's next

<table>
<tr>
<td width="50%" valign="top">

<img src="docs/screenshots/08-to-watch-list.png" alt="The group's To watch / play list" width="100%"><br>
<b>To watch / play</b><br>
<sub>What everyone wants to watch, play, read or listen to, with who wants each one. Done it already? It leaves only your own list.</sub>

</td>
<td width="50%" valign="top">

<img src="docs/screenshots/09-night-voting.png" alt="A night with public votes" width="100%"><br>
<b>Party Night: vote and say if you're coming</b><br>
<sub>Pick 2 to 8 titles, set a deadline, everyone votes (votes are public) and answers Going / Maybe / Not going.</sub>

</td>
</tr>
<tr>
<td width="50%" valign="top">

<img src="docs/screenshots/10-new-night.png" alt="Creating a new night" width="100%"><br>
<b>Anyone can plan a night</b><br>
<sub>Name, date, voting deadline and titles from the community list.</sub>

</td>
<td width="50%" valign="top">

<img src="docs/screenshots/11-night-planned.png" alt="A planned night" width="100%"><br>
<b>The winner becomes a planned night</b><br>
<sub>Ties are broken by whoever created it. After the night, mark it as watched and rate it.</sub>

</td>
</tr>
</table>

### Know your group

<table>
<tr>
<td width="33%" valign="top">

<img src="docs/screenshots/12-stats.png" alt="Statistics: who thinks like you" width="100%"><br>
<b>Who thinks like you</b><br>
<sub>Compatibility between members, the titles that split the group and how scores are spread.</sub>

</td>
<td width="33%" valign="top">

<img src="docs/screenshots/13-my-year.png" alt="A yearly recap" width="100%"><br>
<b>Your year in ratings</b><br>
<sub>Scores given, average, favorites and the busiest month.</sub>

</td>
<td width="33%" valign="top">

<img src="docs/screenshots/14-hall-of-fame.png" alt="Hall of Fame and Shame" width="100%"><br>
<b>Hall of Fame and Shame</b><br>
<sub>The titles with the most Peak and the most Rock Bottom ratings.</sub>

</td>
</tr>
</table>

### Looks good everywhere

<table>
<tr>
<td width="50%" valign="top">

<img src="docs/screenshots/16-light-theme.png" alt="The light theme" width="100%"><br>
<b>Light and dark</b><br>
<sub>It follows the theme of your Root app.</sub>

</td>
<td width="50%" valign="top">

<img src="docs/screenshots/17-mobile.png" alt="On a phone" width="100%"><br>
<b>Made for narrow screens</b><br>
<sub>The same app on a phone: ratings, the group's list and a night.</sub>

</td>
</tr>
</table>

<sub>The screenshots use sample titles and made-up member names. Covers come from TMDB.</sub>

## 🆕 What's new

**2.3.0**: a new look, and every button takes you where it says (open panels close when you go to another category or view). **2.2.1**: covers show up inside Root, the **Songs** category, and the night is now **Party Night**. **2.2.0**: the **To watch / play** list and **Party Night**, to decide together what to watch or play. **2.0.1**: the title list is paged, so it keeps working with hundreds of titles. **2.0.0**: books, anime and songs, and import from a spreadsheet.

See the [CHANGELOG](CHANGELOG.md) and the [releases](https://github.com/MatheusBonat/couch-critics-source/releases). Click **Watch → Custom → Releases** on this page to be told about each new version.

## 🚀 Set it up

1. Install Couch Critics in your Root community and choose, during the installation, who the app admins are. The community owner is always an admin.
2. Admins open **Settings** and paste the free keys they need (TMDB for movies and series, OMDb for IMDb ratings, IGDB/Twitch for games). Books, anime and songs need no key. Without any key the app still works with titles added by hand.
3. Everyone adds titles, rates, and plans nights.

Step-by-step guides: [how to get the API keys](docs/api-keys.en.md) and [how to set them up](docs/how-to-set-up.en.md). Each community uses its **own** free keys, and the app tells the admins when a service rejects one.

## 🧑‍💻 For developers

Couch Critics is built with the **Root SDK**: a TypeScript and React client, a Node.js server and SQLite storage.

```bash
npm install
npm run build
# dev host: put your dev token in server/.env (see server/.env.example), then
npm run server   # inside server/
npm run client   # inside client/
```

The [development guide](docs/development.md) covers the project layout, the data sources, running it in the Root dev host, packaging and uploading your own version, and what to change if you fork it.

## 🤝 Feedback

Found a bug or have an idea? [Open an issue](https://github.com/MatheusBonat/couch-critics-source/issues/new/choose). You can also message **MalphasW** on Root.

## 📄 License and credits

[MIT](LICENSE). Third-party notices, and what the license does not cover (the app's name and logo and the TMDB logo), are in [NOTICE.md](NOTICE.md). The privacy policy of the published app is in [docs/privacy-policy.md](docs/privacy-policy.md).

Data and covers: [TMDB](https://www.themoviedb.org), [OMDb](https://www.omdbapi.com), [IGDB](https://www.igdb.com) (through Twitch), [Open Library](https://openlibrary.org), [AniList](https://anilist.co), [MusicBrainz](https://musicbrainz.org) and the [Cover Art Archive](https://coverartarchive.org). *This product uses the TMDB API but is not endorsed or certified by TMDB.*
