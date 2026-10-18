# SEO and the pokesurvivor.com domain

Everything technical is already in place in the code. What's left is what only you
can do (buy the domain, set up the DNS and register the site with Google).

## What's in place

| File | What for |
|---|---|
| `index.html` | Title and description written for searches ("free online Pokémon game", "Survivor.io style"), canonical address, social cards (Open Graph / Twitter), `VideoGame` structured data (free, 1-4 players, browser/Android/iOS) and real text while loading (with an `<h1>`). |
| `en/guide/` | Guide with how to play, features, tips and **frequently asked questions** (with `FAQPage` data, which Google can show as drop-downs in results). |
| `en/pokedex/` | The 966 playable Pokémon with their types and sprites: draws searches like "free game with Pikachu". |
| `404.html` | "Doesn't exist" page with links to the game (GitHub Pages uses it automatically). |
| `robots.txt` | Allows crawling everything except `tools/` and `docs/`, and points to the sitemap. |
| `sitemap.xml` | The pages to be indexed. |
| `assets/og-image.jpg` | The image shown when the link is shared (1200×630). |
| `manifest.webmanifest`, icons | Installable app, icon in the browser and on phones. |

The pages in `en/` are static: the script that generated them (and their Spanish versions) was removed on
18-10-2026, when the game became English-only. Edit them by hand if something on them needs changing.

> **Important:** the canonical addresses already point to `https://pokesurvivor.com/`.
> Don't publish these changes until the domain works, or Google will try to
> index a domain that doesn't exist yet.

## 1. Domain

The steps to get pokesurvivor.com running (DNS on Cloudflare, GitHub Pages,
Firebase and the final step) are in [DOMAIN.md](DOMAIN.md).

## 2. Google Search Console (the most important part)

1. Go to <https://search.google.com/search-console> with your Google account.
2. **Add property → Domain** → `pokesurvivor.com`.
3. Google gives you a **TXT** record: add it to the DNS (name `@`) and click Verify
   (it can take a few minutes).
4. **Sitemaps** → submit `sitemap.xml`.
5. **URL inspection** → `https://pokesurvivor.com/` → **Request indexing**.
   Repeat with `/en/guide/` and `/en/pokedex/`.

Bing (and with it DuckDuckGo and Ecosia): <https://www.bing.com/webmasters> → "Import
from Google Search Console".

## 3. What helps rankings most (off the site)

Google ranks sites that other sites link to and that people search for by name:

- **YouTube trailer** with the link in the first line of the description and the
  title "PokéSurvivor – Free Pokémon game in your browser".
- **itch.io**: create a page for the game (free, in the HTML5 category) with a link.
- **Reddit**: r/PokemonROMhacks, r/incremental_games, r/WebGames, r/survivorslikes
  (read their rules; many like free fan games without ads).
- **Discord**: Pokémon fan game and "survivors-like" servers.
- **TikTok / Shorts** with 15 s clips (shinies, legendaries, co-op).
- Ask people who play it to link or share it: every link counts.

## 4. Over time

- Check in Search Console which **searches** bring visits and add answers to those
  questions to the guide.
- Each big update: a new entry (for example `en/news/`) and add it to the sitemap.
- The pages load fast (Lighthouse: guide and Pokédex 100/100/100/100).

## Warning

"Pokémon" is a registered trademark. The PokéSurvivor name and the domain may
attract notices from The Pokémon Company; the legal notice and the free, non-profit
nature help, but don't remove that risk.

## How we work now (important)

- **Edit `dev.html`** (and the `js/` files), not `index.html`. `dev.html` loads each script
  separately for development; `index.html` is the version for publishing, with everything in
  a single `js/app.min.js` (the front page loads much faster).
- Before testing the final version or publishing:

```
node tools/build.js            # dev.html -> index.html + js/app.min.js
```

## Language

- The game is **English only** (since 18-10-2026). `/en/` now just redirects to the game.
- Pages: guide, Pokédex, legendaries, shinies, types, moves, items, achievements and
  what's new, all under `en/`.
