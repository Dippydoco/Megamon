/* ============ moveset.js — which moves can turn up in a run, per Pokémon ============
 * (27-10-2026) Every Pokémon has a moveset of exactly SIZE moves picked from its pool (its types' moves, the shared
 * Normal moves and its signature move). Only moves in the moveset come up as new-move cards in a run, so every
 * Pokémon has the same chance of finding the moves it wants, whatever the size of its pool.
 *
 * save.pmoves[dex] = [move ids] chosen in the Moveset screen (ui/moveset-ui.js). Until a Pokémon is edited, or
 * if fewer than SIZE are chosen, the rest is filled automatically (auto): its signature move, its starting move,
 * then its own types' attacking moves that suit its Attack or Sp. Atk, then Normal ones, with at most 2 boosters
 * and 1 burst move. The fill is worked out each time (never saved), so it follows changes to the move list.
 *
 * Not affected: your starting moves (default or Starting Moves upgrade) and Spiritomb's moves, which come from
 * outside the pool on purpose.
 */
G.Moveset = (() => {
  const SIZE = 12;
  const AUTO_BUFF = 2, AUTO_BURST = 1;          // boosters and burst moves in an automatic fill

  /** Every move this Pokémon could have in its moveset. */
  const poolOf = mon => G.Moves.poolFor(mon);

  /** The automatic order: best first (signature, starting move, own types, attacking, suits its stat...). */
  function ranked(mon) {
    const own = new Set(mon.types), start = G.startMoveOf(mon.dex), lean = mon.lean;
    const score = id => {
      const d = G.Moves.BY_ID[id];
      let s = 0;
      if (d.sig === mon.dex) s += 1000;
      if (id === start) s += 500;
      if (own.has(d.type) && d.type !== 'normal') s += 100;
      if (d.kind !== 'buff' && d.kind !== 'burst') s += 50;
      if (!d.cat || !lean || lean === 'mixed' || d.cat === lean) s += 20;
      if (G.Moves.evoNeed(id)) s += 5;
      return s;
    };
    return poolOf(mon).slice().sort((a, b) => score(b) - score(a) || G.Moves.BY_ID[a].name.localeCompare(G.Moves.BY_ID[b].name, 'en'));
  }

  /** Fills `list` up to SIZE with the automatic picks (boosters and bursts capped). → new array */
  function fill(mon, list) {
    const out = list.slice(0, SIZE);
    let buffs = out.filter(id => G.Moves.BY_ID[id].kind === 'buff').length;
    let bursts = out.filter(id => G.Moves.BY_ID[id].kind === 'burst').length;
    const rest = ranked(mon).filter(id => !out.includes(id));
    // First pass with the caps; if the pool is too small to fill that way, a second pass without them.
    for (const pass of [true, false]) for (const id of rest) {
      if (out.length >= SIZE) break;
      if (out.includes(id)) continue;
      const k = G.Moves.BY_ID[id].kind;
      if (pass && k === 'buff' && buffs >= AUTO_BUFF) continue;
      if (pass && k === 'burst' && bursts >= AUTO_BURST) continue;
      out.push(id);
      if (k === 'buff') buffs++; else if (k === 'burst') bursts++;
    }
    return out;
  }

  /** The moves the player chose for this Pokémon (valid ones only, at most SIZE). */
  function chosen(dex) {
    const mon = G.DEX_BY[dex], s = G.DB.save;
    if (!mon || !s || !s.pmoves || !Array.isArray(s.pmoves[dex])) return [];
    const pool = new Set(poolOf(mon));
    return s.pmoves[dex].filter((id, i, a) => pool.has(id) && a.indexOf(id) === i).slice(0, SIZE);
  }

  /** This Pokémon's full moveset: what you chose, filled up automatically to SIZE. */
  function of(dex) {
    const mon = G.DEX_BY[dex];
    return mon ? fill(mon, chosen(dex)) : [];
  }

  /** Has the player set this one up (any choice saved)? */
  const edited = dex => chosen(dex).length > 0;

  /** Saves the player's choice (an empty list = back to automatic). */
  function set(dex, list) {
    const s = G.DB.save;
    if (!s) return;
    s.pmoves = s.pmoves && typeof s.pmoves === 'object' ? s.pmoves : {};
    if (list && list.length) s.pmoves[dex] = list.slice(0, SIZE); else delete s.pmoves[dex];
    G.DB.commit();
  }

  return { SIZE, poolOf, ranked, fill, chosen, of, edited, set };
})();
