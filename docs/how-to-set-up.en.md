# Couch Critics: how to set up the API keys

This guide shows, step by step, how to put the API keys into Couch Critics. It is for community admins, and it assumes nothing: if you get stuck, jump to **Troubleshooting** at the end.

Need to get the keys first? See [How to get the API keys](api-keys.en.md). This page starts when you already have them.

---

## The short version

1. Open Couch Critics in your community and click **Settings** at the top.
2. Paste each key in its block and click **Save**.
3. Check that each block says **Configured**.

That is all. The rest of this page explains each step in detail.

---

## 1. Open the Settings screen

1. In your community, open **Couch Critics**.
2. At the top of the app, next to the **Add movie / Add series / Add game** button, you will see **Settings**.
3. Click it. A panel called **Data sources** opens below.

### I do not see the Settings button

Only the **app admins** see it. The admins are chosen when the app is installed, in the setting called **App admins** (people and roles).

- Ask whoever installed the app to add you (or your role) to **App admins** in the app's settings in Root.
- Close the app and open it again after that.
- If nobody was ever chosen as admin, the screen shows the notice "Nobody has been chosen as an admin of the app. Whoever saves the first key becomes the admin." In that case, the first person to save a key becomes the admin.

---

## 2. What each block is for

You will see three blocks. You do not need all of them: each one turns on one feature.

| Block | What it turns on | What you paste | If you skip it |
|---|---|---|---|
| **TMDB (movies and series)** | Searching movies and series by name, covers, names in English and Portuguese, episode lists | One long text (the **API Read Access Token**) | No search for movies and series. You can still add them by hand, without a cover |
| **OMDb (IMDb rating)** | The small IMDb rating next to the average, and the IMDb rating of each episode | One short key from an e-mail | Everything works, just without IMDb ratings |
| **IGDB (games)** | Searching games by name and game covers | Two things: **Client ID** and **Client Secret** | No search for games. You can still add them by hand, without a cover |

Each block shows its state on the right: **Not configured** or **Configured**.

---

## 3. Paste the keys

The steps are the same for every block.

1. Click inside the field.
2. Paste the key (Ctrl+V on Windows, Cmd+V on Mac).
3. The field hides what you paste, like a password. Click **Show** to see it and check that it looks right, and **Hide** to hide it again.
4. Click **Save**.
5. Wait a second or two. The app checks the key with the service before keeping it.
6. You should see **Saved.** under the field, and the block should say **Configured**. The field is cleared on purpose: for safety, a saved key is never shown again.

The **Save** button stays gray until the field has something in it. In the IGDB block it stays gray until **both** fields are filled in.

### TMDB block

- Paste the **API Read Access Token**. It is a very long text, hundreds of characters, and starts with `eyJ`.
- If you only have the short **API Key** (about 32 letters and numbers), it also works. The long token is the recommended one.
- Paste the text alone, with no spaces or line breaks before or after it.

### OMDb block

- Paste only the key from the e-mail. It is short, about 8 letters and numbers, for example `a1b2c3d4`.
- The e-mail also shows a link that contains `apikey=`. **Do not paste the link.** Paste only what comes after `apikey=`.
- If you just requested the key, open the activation link from the e-mail first. The key may not work before that.

### IGDB block (two fields)

- **Client ID:** the code that Twitch shows on the **Manage** page of your application. About 30 letters and numbers.
- **Client Secret:** the code you get by clicking **New Secret** on that same page. About 30 letters and numbers.
- **Both are required.** The app saves them together, with the single **Save** button of that block.
- The Client Secret is shown only once on the Twitch page. If you did not copy it, click **New Secret** on Twitch and use the new one.

---

## Optional: books, anime and albums

Below the three key blocks there is a **Categories** block with three boxes: **Books (Open Library)**, **Anime (AniList)** and **Albums (MusicBrainz)**.

- They are optional and need **no key at all**: the services are free and open.
- Tick the ones your community wants. Each box saves right away, and a new tab shows up for everyone.
- Untick a box to hide that tab. Titles that were already added are kept, and they come back if you tick the box again.
- Anime can also be found by the original name (for example "Shingeki no Kyojin"). Not every book or album has a cover.

---

## 4. What the states and messages mean

### State of each block (top right of the block)

| You see | It means |
|---|---|
| **Not configured** | No key saved. That feature is off |
| **Configured** | The key was checked and saved. The feature is on |
| **Rejected by the service** | The service refused the key. A key that was already saved before keeps working until it is replaced; the new one was **not** saved |
| **Saved, but could not be checked right now** | The key was saved, but the service did not answer (it is down, or there is no internet). Try a search a few minutes later |

### Messages under the field

| Message | What to do |
|---|---|
| **Saved.** | Done |
| **The service rejected that key. Check that you copied all of it.** | The key is wrong or incomplete. Copy it again from the original page and paste it again. See "Common mistakes" below |
| **That does not look like a valid key. Copy it again, without spaces.** | The text has the wrong shape: spaces in the middle, a link instead of the key, or part of it missing |
| **Only app admins can change these settings.** | Your account is not an admin. See "I do not see the Settings button" |

### Common mistakes

- **Copying only part of the key.** Triple-click the text to select all of it, or use the copy button on the site if there is one.
- **Pasting the whole link** from the OMDb e-mail. Paste only the part after `apikey=`.
- **Pasting the TMDB "API Key" in the wrong block**, or pasting a different code. The TMDB block takes the TMDB token; the IGDB block takes the Twitch codes.
- **Swapping the two IGDB fields.** The Client ID goes in **Client ID** and the Client Secret in **Client Secret**.
- **A secret that was regenerated.** If you clicked **New Secret** on Twitch, the old Client Secret stopped working. Paste the new one.
- **Spaces or a line break** at the beginning or end. The app trims them, but extra characters in the middle break the key.
- **A key from the wrong website.** Each block takes a key from its own site: themoviedb.org, omdbapi.com, dev.twitch.tv.

---

## 5. Check that it works

1. Go to the **Movies** tab and click **Add movie**. Type a title, for example `parasite`. Results with covers should appear.
2. Go to the **Games** tab and click **Add game**. Type a title, for example `zelda`. Results with covers should appear.
3. Add a movie. A small **IMDb** number should show up below the average. It can take a moment, and titles added by hand never have one.
4. Open a series that came from the search and click **Rate by episode**. The episodes appear, with the IMDb rating of each one.

If a search says the source is not set up, go back to **Settings** and check that block.

---

## 6. Change or remove a key

- **Replace a key:** paste the new one in the same block and click **Save**. The old one is replaced only if the new one is accepted.
- **Remove a key:** click **Remove key** under the block. The feature turns off, and titles already added stay in the list.
- **After a leak:** generate a new key on the original website (see the key guide) and paste it here. Then, on that website, delete or revoke the old key whenever the site allows it. On Twitch, **New Secret** already cancels the old Client Secret.

---

## 7. Keeping the keys safe

- Treat the keys like passwords. Do not post them in chats, in community channels or in screenshots.
- Use **Show** only when nobody is watching your screen or recording it.
- Once saved, a key can never be read back from the app, only replaced or removed.
- If you posted a key by accident, generate a new one right away and paste it here.

---

## 8. Troubleshooting

| Problem | Why it happens | What to do |
|---|---|---|
| No **Settings** button | You are not an app admin | See section 1 |
| **Save** stays gray | The field is empty (or one of the two IGDB fields is) | Fill in everything |
| "The service rejected that key" | Wrong, incomplete or expired key | Copy it again from the original website, or generate a new one |
| "That does not look like a valid key" | Spaces, a link, or missing characters | Paste only the key itself |
| "Search is not turned on yet" when adding | The key for that source was never saved | An admin needs to paste it in Settings |
| "TMDB (or IGDB) rejected the key. An admin needs to replace it" | A saved key stopped working, for example after **New Secret** | Paste a new key |
| "TMDB (or IGDB) is limiting requests right now" | Too many requests in a short time | Wait a few minutes |
| "Could not reach TMDB (or IGDB) right now" | The service is down, or the connection failed | Try again in a moment |
| IMDb ratings do not appear | The OMDb key is missing or its daily limit (1,000 requests) is over | Check the OMDb block. The limit resets the next day, and ratings are filled in later by themselves |
| A series says it has no episode list | It was added by hand | The person who added it can remove it (only they can) and add it again by searching |
| No covers | The title was added by hand, or the TMDB/IGDB key is missing | Add it by searching |
| "Saved, but could not be checked right now" | The service did not answer | Wait a few minutes and try a search |

---

## 9. Frequently asked questions

**Do I have to pay for any of this?** No. The three keys are free for non-commercial use.

**Does every community need its own keys?** Yes. Each community pastes its own, so one community's usage never slows down another.

**Do I need all three?** No. Each key turns on one feature, as shown in the table in section 2.

**Do books, anime and albums need a key?** No. Just tick them in the **Categories** block.

**Can more than one admin set the keys?** Yes. Anyone in **App admins** can paste, replace or remove them.

**What happens if the admin who saved the keys leaves?** Nothing. The keys belong to the community, not to a person. Another admin can replace them any time.

**Does the app share my keys?** No. They are stored only in your community's own database and are used by the app's server to talk to TMDB, OMDb and IGDB.

---

## Still stuck?

Send a message to the person who maintains Couch Critics (Root user **MalphasW**) and tell us:

- which block you are in (TMDB, OMDb or IGDB);
- the exact message you see;
- what you already tried.

**Never send the key itself.**
