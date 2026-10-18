# Publishing the game for free on GitHub Pages

The game is a static website: GitHub Pages serves it for free at
`https://jpter78.github.io/pokesurvivor/`.

## 1. Create the repository (once)

1. Go to <https://github.com/new> with the **JPTER78** account.
2. Name: `pokesurvivor` · **Public** · **no** README, .gitignore or licence
   (they're already in the project).
3. Create repository.

## 2. Upload the project

From the project folder (the local repository is already created, with the
first commit made):

```
git remote add origin https://github.com/JPTER78/pokesurvivor.git
git push -u origin main
```

The first time, a window opens to sign in to GitHub.
It's about 75 MB, so it can take a few minutes.

## 3. Turn on GitHub Pages

In the repository: **Settings → Pages** →
*Source*: **Deploy from a branch** → *Branch*: **main**, folder **/ (root)** → **Save**.

In a minute or two it will be at <https://jpter78.github.io/pokesurvivor/>.

## 4. Connect to Firebase

If you have already followed [FIREBASE.md](FIREBASE.md), add `jpter78.github.io` to
Authentication's **authorised domains** (step 5) and upload the
filled-in `firebase-config.js`:

```
git add js/core/firebase-config.js
git commit -m "Connect to Firebase"
git push
```

## 5. Getting it on Google

1. <https://search.google.com/search-console> → **Add property** →
   *URL prefix* → `https://jpter78.github.io/pokesurvivor/`.
2. Verification: the **HTML tag** method gives you a `<meta ...>` line;
   paste it inside `<head>` in `index.html`, run `git push`, and click Verify.
3. **URL inspection** → paste the address → **Request indexing**.

Google takes days to weeks to show it, and at first it only appears when people
search for the exact name.

## Updating the game later

Every time you change something:

```
git add -A
git commit -m "What you changed"
git push
```

GitHub Pages updates on its own in a minute or two.

## Reminders

- **No money**: no ads, no donations in exchange for anything, no payments.
  The sprites' licence (CC BY-NC) requires it, and it's what most reduces the
  risk of Nintendo asking for it to be taken down.
- If a rights claim arrives at the legal notice email, deal with it
  quickly: removing what they ask for usually closes the matter.
