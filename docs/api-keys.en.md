# Couch Critics: how to get the API keys

This guide is for whoever administers Couch Critics in a community. It walks you through getting the 3 keys the app uses to look up movies, series and games. No programming needed.

## Before you start

**What is an API key?** It works like a password that Couch Critics uses to ask another website for information (for example, "give me the cover and the Portuguese name of this movie"). Without a key the app still works, but only with titles added by hand and no covers.

**Why does each community use its own?** The websites limit how many requests a key can make per day. One key per community means one community's usage never slows down another.

**How much does it cost?** Nothing. All 3 keys are free for personal, non-commercial use.

**How long does it take?** About 20 to 30 minutes in total, plus waiting for an e-mail.

**What you need at hand:**
- An e-mail address you can open right now.
- A phone (Twitch requires two-factor authentication).
- A computer. TMDB's sign-up does not work well on phones.
- A few minutes to fill in the forms completely: TMDB and OMDb only create the key if **every requested field** is filled in (application name, URL, description and your contact details on TMDB; e-mail on OMDb).

| Key | Used for | Where |
|---|---|---|
| TMDB | Searching movies and series in English or Portuguese, covers and episodes | themoviedb.org |
| OMDb | Showing the IMDb rating next to each title | omdbapi.com |
| IGDB (through Twitch) | Searching games and covers | dev.twitch.tv |

Websites change their screens from time to time. If a button is named a little differently from what is written here, look for the one that does the same thing.

---

## 1. TMDB (movies and series)

1. Open https://www.themoviedb.org/ and create an account (the sign-up button is at the top right). Pick a username, a password and an e-mail.
2. Open the e-mail TMDB sent you and confirm the account, if it asks.
3. Log in, click your picture (top right) and go to **Settings**.
4. In the left menu, click **API**.
5. Request a key. TMDB shows its terms of use: read and accept them. Then it opens an **Application Details** form with 4 fields.

   > **Attention: every field must be filled in for TMDB to create the key.** The form will not let you submit with an empty field. What most often blocks people is the **URL** (shown in red with "Field is required") and the application **description**. If either is left blank, the key is not created.

   Fill them in like this:
   - **Application name:** `Couch Critics`
   - **Application URL (required):** the app has no website of its own, so use `https://www.rootapp.com`
   - **Type of use:** `Personal` (personal, non-profit use)
   - **About the application (summary):** paste this text, which is what TMDB staff read:

     ```
     Couch Critics is a free, non-commercial app for a Root community where friends rate movies, series and games together. It uses the TMDB API to search titles in English and Portuguese and to show posters and episode lists. Each community uses its own API key. The app displays the required TMDB attribution and logo, and no data is sold or monetized.
     ```

   Further down, the form may ask for your contact details (name, address, phone, e-mail). They are also required to create the key. Use real details: they are only for TMDB.
6. When you finish, the **API** page shows two things: **API Key** and **API Read Access Token**.
7. Copy the **API Read Access Token**. It is the very long text (hundreds of characters). Both give the same access, but Couch Critics uses the long one.

**Keep:** the API Read Access Token.

---

## 2. OMDb (IMDb rating)

1. Open https://www.omdbapi.com/apikey.aspx
2. Under **Account Type**, choose the free option: **FREE! (1,000 daily limit)**. That means 1,000 requests per day. Couch Critics saves the answers so it uses very few.
3. Type your e-mail and click **Generate API Key**.
4. Wait for the e-mail with your key. It can take a while, especially with Hotmail, Outlook, Live and Yahoo accounts. Check your spam folder too.
5. If the e-mail has an activation link, click it. The key may not work before that.
6. If the key does not arrive within 1 hour, the site itself asks you to contact its author.

**Keep:** the key that came by e-mail.

---

## 3. IGDB (games), through Twitch

IGDB is the games database owned by Twitch. That is why the key comes from a Twitch account.

### 3.1 Account and two-factor authentication
1. Open https://www.twitch.tv/ and create an account (**Sign Up**). Confirm the e-mail.
2. Turn on **two-factor authentication** (2FA): on Twitch, open **Settings**, then **Security and Privacy**, and find the **Security** section. Turn on two-factor authentication and follow the steps with your phone.
   - Without this, Twitch will not let you create the application in the next step.

### 3.2 Create the application
3. Open https://dev.twitch.tv/console and log in with the same account. If the page does not notice the 2FA you just enabled, refresh it.
4. Open the **Applications** tab and click **Register Your Application**.
5. Fill in:
   - **Name:** a name that is unique across all of Twitch, for example `Couch Critics - YourCommunityName`. If it says the name is taken, add some numbers.
   - **OAuth Redirect URLs:** type `http://localhost` and click **Add**. Couch Critics does not use this address, but the form requires one.
   - **Category:** choose **Application Integration**. If it is not there, pick the closest option.
   - **Client Type**, if shown: choose **Confidential**.
   - Tick **I'm not a robot** and click **Create**.

### 3.3 Get the Client ID and Client Secret
6. In the **Developer Applications** list, find your application and click **Manage**.
7. Copy the **Client ID**.
8. Click **New Secret** and copy the **Client Secret** right away. It is shown only once. If you lose it, just click **New Secret** again (the old one stops working).

**Keep:** the Client ID and the Client Secret.

---

## 4. Where to paste the keys in Couch Critics

1. Whoever installs the app chooses, during installation, **who administers Couch Critics** (people or roles).
2. Only those people see the **Settings** button at the top of the app.
3. There are three blocks: **TMDB** (one field), **OMDb** (one field) and **IGDB (games)**, which has two fields, **Client ID** and **Client Secret**. Both IGDB fields are required and are saved together with the same Save button. Paste each key in the right place and save. If the service rejects a key, the app says so and does not keep it.
Detailed guide, with every on-screen message and troubleshooting: [How to set up the keys](how-to-set-up.en.md).

4. The app stores the keys in your community's own database. Once saved, they are never shown again on screen (only "configured").

You can set up just some of them: without the OMDb key, for example, everything works, there is just no IMDb rating.

---

## 5. Keeping the keys safe

- Treat them like passwords. Do not post them in chats, community channels or screenshots.
- If a key leaks:
  - **TMDB:** generate another one on the same **Settings → API** page.
  - **OMDb:** request a new key with the same form.
  - **Twitch/IGDB:** click **New Secret** (the old Client Secret stops working).
  Then paste the new one into Couch Critics.
- If a search suddenly stops working, check whether the key was replaced or expired.

## 6. Common problems

| Problem | What to do |
|---|---|
| The OMDb e-mail does not arrive | Wait up to 1 hour, check spam, try another e-mail address (Gmail is usually faster). |
| Twitch will not let you create the application | Make sure two-factor authentication is on and refresh the console page. |
| "Name already in use" on Twitch | Change the application name to something more specific. |
| The search says the daily limit is over | OMDb resets the next day. The rest of the app keeps working. |
| I cannot find "Generate API Key" or "Register Your Application" | The site changed its screen. Look for a button with the same meaning, or send me a screenshot. |

## 7. Credits (the app shows these by itself)

The services require a usage notice. Couch Critics will have an "About" screen with:

- "This product uses the TMDB API but is not endorsed or certified by TMDB." and the TMDB logo.
- The IGDB and OMDb/IMDb notices.

You do not need to do anything. Just do not hide that screen.
