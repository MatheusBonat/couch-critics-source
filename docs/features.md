# Couch Critics: all the features

[← Back to the README](../README.md) · Screenshots: [docs/screenshots](screenshots)

- Scores from 0 to 10 in half points, with an optional comment (emoji picker included). Two special ratings: **Peak** (above 10, counts as 10) and **Rock Bottom** (below 0, counts as 0)
- One score per member per title, editable at any time. Each row shows the average, the IMDb rating and the first members' scores without opening it
- Search by name, in English or Portuguese, with covers, synopsis and genres: movies and series (TMDB), games (IGDB, with platforms), and optional books (Open Library), anime (AniList) and songs (MusicBrainz), which need no API key. Titles can also be added by hand
- Series: an overall score and, optionally, a score per episode (with the IMDb rating of each episode)
- Anime: the same, per episode. Episodes come from AniList (a count, and a name when AniList has one), in groups of 50 for long anime
- Spoiler comments, emoji reactions on other people's ratings, and "want to watch / watching / watched" per member (set from the To watch / play view)
- "To watch / play" view: the group's list of everything someone marked "want to watch / play / read / listen to", across all categories, with who wants each title. Titles that more people want come first; filter by category. When you mark a title as watched or played, it does not disappear: it goes to the end of your own list, under "Done" (everyone else sees it where it was). You can add titles straight from there (the new title is marked "want" for whoever added it)
- "Party Night" view: any member creates a night with an optional name, date and time, a voting deadline and 2 to 8 titles from the community. Each member has one vote (changeable until it closes; **votes are public**, everyone sees who voted for what) and answers Going / Maybe / Not going. The voting closes at the deadline or when the creator (or an admin) closes it; the most voted option wins and, on a tie (or when nobody voted), the creator picks among the tied ones. The chosen title is flagged as "Night planned" in the lists. Six hours after the start the night moves on its own to "happened" (or "canceled" if a tie was never resolved), and after it there is a shortcut to mark the title as watched/played and rate it. Limits: 5 open nights in the community and 3 per person. The server checks deadlines every 30 seconds and when listing. The app uses Root's notifications (no manifest permission): the community activity indicator when a night opens or closes, and a notification to the members who said Going or Maybe when the night is decided and about 1 hour before it starts (delivery depends on Root; not tested in the real Root yet)
- Statistics: who thinks like you, the titles that split the group, a yearly recap per member, and a Hall of Fame and Shame
- Filters ("not rated by me", watch status), sort by score, date or year, and a list that shows 30 titles at a time
- Import your ratings from a CSV spreadsheet (titles are matched with the search before importing) and export them
- Moderation: admins can remove comments and titles; titles added by hand can be edited
- English and Portuguese, light and dark themes (it follows the Root theme), narrow screens
- Live updates for every member
