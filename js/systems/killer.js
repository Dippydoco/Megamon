/* ============ killer.js — "Defeated by" ============
 * Every hit on the player is described as { n name, d dex (0 = not a Pokémon), a attack, ty type, h damage, e effectiveness }.
 * The last one when you faint is the killer. Sources pass { n?, d?, k, a? }:
 *   k = 'contact' | 'shot' | 'beam' | 'zone' | 'trap' | 'liquid' | 'judge'
 */
G.Killer = (() => {
  const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
  const KIND = { contact: 'Body slam', shot: 'Shot', beam: 'Beam', zone: 'Blast' };
  // Forms with their own sprite number but no Pokédex entry: without this they showed up as "Something".
  const FORMS = { 9718: 'Mega Zygarde' };     // rift.js MEGA_DEX (Zygarde Portal, phase 2)
  const nameOf = d => (G.DEX_BY[d] && G.DEX_BY[d].name) || FORMS[d] || '';

  function attackName(src, type, pure) {
    if (src && src.a) return src.a;
    const k = src && src.k;
    if (k === 'liquid') return cap(G.World.liquidKind());
    if (pure) return 'Judgment';
    if (k === 'contact') return KIND.contact;
    const base = KIND[k] || 'Attack';
    return type ? cap(type) + ' ' + base : base;
  }

  /** Build the record kept in player.hits. */
  function make(src, type, dmg, eff, pure) {
    src = src || {};
    const known = src.d ? nameOf(src.d) : '';
    return {
      n: String(known || src.n || (src.k === 'liquid' ? cap(G.World.liquidKind()) : 'Something')).slice(0, 24),
      d: known ? src.d : 0,
      a: String(attackName(src, type, pure)).slice(0, 24),
      ty: type || '',
      h: Math.round(dmg),
      e: eff === 'super' || eff === 'weak' ? eff : ''
    };
  }

  /** Sanitise a record that came from a save (history). */
  function clean(k) {
    if (!k || typeof k !== 'object') return 0;
    const d = G.DEX_BY && nameOf(k.d) ? Math.floor(+k.d) : 0;
    const h = Number.isFinite(+k.h) && +k.h > 0 ? Math.min(Math.floor(+k.h), 1e9) : 0;
    return {
      d, n: String(k.n || '').slice(0, 24), a: String(k.a || '').slice(0, 24),
      ty: typeof k.ty === 'string' ? k.ty.slice(0, 12) : '', h, e: k.e === 'super' || k.e === 'weak' ? k.e : ''
    };
  }

  return { make, clean };
})();
