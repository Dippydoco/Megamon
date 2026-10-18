# Setting up Firebase (database and accounts)

With this, saves are stored in the cloud and can be continued on any computer.
Everything is **free** (Firebase's Spark plan). It takes about 10 minutes.

Until you do it, the game works as before, saving only in the browser.

## 1. Create the project

1. Go to <https://console.firebase.google.com> with your Google account.
2. **Create a project** → give it a name (e.g. `pokesurvivor`). The project ID
   appears in the "Sign in with Google" window and cannot be changed later.
3. Google Analytics: **turn it off** (not needed, and this way there is no tracking).

## 2. Enable accounts

1. Left menu → **Build → Authentication** → **Get started**.
2. **Sign-in method** tab:
   - **Email/Password** → Enable → Save.
     (The game uses name + password; internally it turns that into an
     internal email address that is never sent anything.)
   - **Google** → Enable → choose your support email → Save.

## 3. Create the database

1. **Build → Firestore Database** → **Create database**.
2. Location: a European one (e.g. `eur3` or `europe-southwest1`). It cannot be changed later.
3. Start in **production mode**.
4. **Rules** tab: delete whatever is there, paste **all** of this project's
   [`firestore.rules`](../firestore.rules) file and click **Publish**.

   These rules make each player able to read, write and delete only **their own**
   save. Without them, anyone could touch everyone else's.

### 3b. Realtime Database (rooms and multiplayer)

1. **Build → Realtime Database** → **Create database** → location
   **Belgium (europe-west1)** → locked mode.
2. **Rules** tab: paste the contents of [`database.rules.json`](../database.rules.json).
3. Copy the URL shown at the top (`https://...firebasedatabase.app`) and add it to
   `firebase-config.js` as `databaseURL: '...'`.

Faster, with the Firebase tool (uploads the rules for both databases and the
leaderboard indexes in one go):

```
npx firebase-tools deploy --only firestore,database --project YOUR-PROJECT
```

## 4. Connect the game

1. Top left, the ⚙ cog → **Project settings**.
2. At the bottom, under **Your apps**, click the web icon **`</>`**.
3. Give it a nickname (e.g. `web`). Do **not** tick Firebase Hosting. → Register app.
4. It shows a `const firebaseConfig = { ... }` block. Copy what is between the braces.
5. Open [`js/core/firebase-config.js`](../js/core/firebase-config.js) and replace
   `G.FIREBASE_CONFIG = null;` with:

   ```js
   G.FIREBASE_CONFIG = {
     apiKey: '...',
     authDomain: '...firebaseapp.com',
     projectId: '...',
     storageBucket: '...',
     messagingSenderId: '...',
     appId: '...'
   };
   ```

   These values are **not secret**: Firebase designs them to live inside the website.
   What protects the saves are the rules from step 3.

## 5. Authorise the published site

**Authentication → Settings → Authorized domains → Add domain**:

- `jpter78.github.io` (if you publish on GitHub Pages)
- `localhost`, to test on your computer (new projects no longer include it).

Without this, "Sign in with Google" gives the *unauthorized domain* error.

## 6. Recommended: restrict the key

At <https://console.cloud.google.com/apis/credentials> (same project), open the
**Browser key** → *Application restrictions* → *Websites* and add:

- `https://jpter78.github.io/*`
- `http://localhost:*`

That way nobody can use your key from another website.

## Testing on your computer

The cloud only works if the game is opened from a server (not by double-clicking):

```
python -m http.server 8000
```

and open <http://localhost:8000>. The start screen should show the
**Sign in with Google** button and the text saying your save is stored in the cloud.
At the top right, next to your name, a **green** square means it is saved in the
cloud (yellow = saving, red = offline).

## Free plan limits

Firestore: about 50,000 reads and 20,000 writes per day, and 1 GB of data.
The game is designed to use as little as possible (measured in the emulator):

| Action | Reads | Writes |
|---|---|---|
| Viewing a leaderboard tab | 1 (0 if you viewed it less than 10 min ago) | 0 |
| Viewing your rank if you're not in the top 50 | 1 the first time in that browser | 0 |
| Finishing a run | ~3 | ~3-9 (only where you improve) |
| Saving | 1 every 30 s at most | 1 every 30 s at most |
| Being online | 0 | 1 every 10 min (the "online" status) |
| Opening Friends or the room | 1 per friend (valid for 1 min) | 0 |

How that is achieved:
- **Leaderboard**: each table has a summary document `lbs/{table}` with the
  top 50 (the rules check that each row matches a record validated against
  cheating in `lb/{table}/e/{id}`). What is read is cached for 10 min in the
  browser. The per-Pokémon filter only exists in the all-time table.
- **Saving**: the browser copy is saved immediately; the cloud receives what is
  pending at most every 30 s, and always when the tab is hidden or closed.
  If you play on two computers at once, the saves are merged when signing in and when uploading.
- **Public profile**: uploaded after a run, at most every 10 min.

Realtime Database: **100 simultaneous connections** and 10 GB of downloads per month.
Only people **in a room or a group run** connect (friends' "online" status and
invitations go through Firestore), so the limit of 100 only counts those playing
in a group at that moment, not all players. Group runs go directly between
browsers and use nothing; only those that can't connect directly go through here
(about 20-70 MB per hour per player). If it ever runs short, Firebase simply
rejects operations until the next day (it charges nothing unless you enable a
paid plan yourself).

## For developers: emulator

To test without touching the real project (needs Java 21):

```
npx firebase-tools emulators:start --project demo-ps --only auth,firestore,database
```

and in `firebase-config.js` use
`{ apiKey: 'demo', projectId: 'demo-ps', authDomain: 'demo-ps.firebaseapp.com', appId: 'demo', databaseURL: 'http://127.0.0.1:9000?ns=demo-ps-default-rtdb', emulator: true }`.
