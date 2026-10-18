# PokéSurvivor — how we work and publish

Fixed rules from the project owner. They ALWAYS apply.

## Publishing a version
1. Edit `dev.html` (never `index.html`, which is generated).
2. `node tools/build.js`
   - `build.js` generates `index.html`, `js/app.min.js` and **`version.json`** (this version's fingerprint).
3. Commit (no "Co-Authored-By" or any AI signature) and `git push origin main` only when the owner asks.

## Automatic update for players (mandatory)
When publishing, every player must move to the new version without losing anything
(`js/core/updater.js` checks `version.json` every 5 min):
- **Outside a run** (menu, including the co-op room): 5 s notice, then the page reloads.
  If they are in the gacha, the upgrade shop, the settings, the Codex or typing in a field, it waits until they finish.
- **In a run**: left alone. When it ends, the run is saved as usual and the page reloads on returning to the menu.
- **Starting a run** (Play, Start in the room): `version.json` is checked first (`Updater.gate()`); if there is a
  new version, the page reloads instead of starting.
- Anything pending is uploaded to the cloud before reloading.
Do not remove `updater.js` or the `version.json` write in `tools/build.js`.

## What's new (changelog)
Every gameplay change or bug fix also goes in `js/data/changelog.js`
(in English, under `new` / `chg` / `fix` for today's date), with its publish time in
`at` (UTC, `date -u +%Y-%m-%dT%H:%MZ`). Server, database or cost changes do NOT go there.

## Balance Lab
`?dev&lab` in the address opens a test bench for balancing moves (see `docs/BALANCE_LAB.md`). It never saves
anything; keep it that way (`G.DB.labSave`, the run is tampered and never ended). It is a developer tool, so it
does not go in the changelog.

## Language
The game, its code comments and its documents are in English only (18-10-2026: the Spanish version, the
translation layer and the Spanish web pages were removed). Write new text directly in English; there is no
translation file to update.

## Servers
- Firebase: project **pokesurvivor-free** (standard authentication: free accounts, no limit).
  **Never** enable "Identity Platform" or anything that turns it on (blocking functions, MFA,
  "Upgrade to enable"): it charges per user. The old project pokesurvivor-jpter was deleted on 13-10-2026 (with its billing).
- Cloudflare: ONLY the domain pokesurvivor.com (bought there, free DNS). The Worker and the TURN server
  (Cloudflare Realtime) were removed on 15-10-2026: co-op uses direct connection only
  (Google's free STUN). Do not add anything paid again.
- Maintenance: `MAINTENANCE` in `js/main.js` (with `?dev` you can still get in to test).
