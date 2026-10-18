# Balance Lab

A test bench for balancing, built into the game. It runs moves against training dummies with the
real game engine and shows the numbers.

## Opening it

Add `?dev&lab` to the game's address:

- live: `https://dippydoco.github.io/Megamon/?dev&lab`
- local: `http://localhost:8123/dev.html?dev&lab`

Players never see it: without `?dev&lab` the game starts as normal. Anyone who types the address
only gets a sandbox. It uses a throwaway save in memory, never ends the run and is marked as
tampered, so nothing is saved, nothing reaches the leaderboard and your account is untouched.
**Exit** reloads the page normally.

## Using it

1. **Moves**: tick them one by one, or use All / None / New / Burst / "+ type" / "+ style".
2. **Levels**: any of Lv. 1–5, plus **Evolved** (evolved = level 5 + evolution).
3. **Pokémon**: its attack stat scales every move's damage (default Mew).
4. **Scenario**:
   - *Single target*: one tough dummy that walks up to you.
   - *Boss*: the same, but it can't be frozen, stunned or pushed.
   - *Crowd*: 12 enemies with 150 HP that respawn when they die.
   - *Swarm*: 30 enemies with 60 HP that respawn when they die.

   You can change the enemy count, HP, speed and test length (seconds) for each.
5. **Upgrades and item**: stack Power, Reflexes, Reach and Focus, and equip any item.
6. **Run tests**. Tests run much faster than real time (a few seconds for dozens of tests).
   Tick **Watch in real time** to see one play out. **Hide** shrinks the panel so you can watch.

Results stack up between runs (the **Run** column tells them apart; hover a row to see its setup),
so you can compare, say, the same moves with and without Focus. Click a column to sort.
**Download CSV** gives a file for a spreadsheet.

## Reading the numbers

- **DPS**: damage per second dealt to the dummies, burn and poison included.
- **Kills**: dummies defeated (only meaningful in Crowd and Swarm).
- **Hits / Crit %**: direct hits and the share that were critical.
- **Heal/s**: HP per second healed (draining moves, Recover, Shell Bell...).
- **Frozen / Stunned / Weakened**: enemy-seconds. For example, 3 enemies frozen for 2 s counts as 6.
- **Dummies have no type**: every move hits for neutral damage, so the type chart doesn't skew the comparison.
- **Burst moves** fire once per cooldown, so test them for 30 s or more.
- **Finishing moves** like Pursuit only show their bonus on enemies that can die (Crowd, Swarm).

## How it works (for code changes)

`js/ui/lab-ui.js`. It starts a normal run with `G.DB.labSave()` and stops the normal clock
(`G.Game.debugSpeed(0)`). It then steps the run itself with `G.Game.labStep()` at a fixed 1/60 s.
It switches off spawns, events, weather, rifts, Arceus, shrines, hazards, drops and level-ups, and
moves the player to an open clearing. New moves, items and upgrades appear in it automatically.
