/* ============ gacha-ui.js — banners por generación y animación de tirada ============
 * La lógica (probabilidades, pity, shiny, repetidos) está en systems/gacha.js.
 */
G.GachaUI = (() => {
  const $ = G.UI.$;
  let busy = false;
  let gen = 1;
  let surprise = false;        // "Surprise me": each roll uses a random generation
  let mystery = [];            // the three silhouettes on the mystery banner

  function init() {
    $('pull-1').onclick = () => pull(1);
    $('pull-10').onclick = () => pull(10, 't1');
    $('pull-10b').onclick = () => pull(10, 't10');
    $('pull-close').onclick = close;
    $('pull-all').onclick = pullAll;
    $('gacha-surprise').onclick = () => {
      surprise = !surprise;
      if (surprise) mystery = G.U.shuffle ? G.U.shuffle(G.DEX.filter(p => p.rarity === 5 && G.SPRITE_META[p.dex])).slice(0, 3).map(p => p.dex)
                                           : G.DEX.filter(p => p.rarity === 5 && G.SPRITE_META[p.dex]).sort(() => Math.random() - 0.5).slice(0, 3).map(p => p.dex);
      G.Audio.sfx('click');
      refresh();
    };

    const tabs = $('gacha-gens');
    G.Gacha.BANNERS.forEach(b => {
      const t = document.createElement('button');
      t.className = 'gen-tab';
      t.dataset.gen = b.gen;
      t.innerHTML = `<b>${b.name}</b><small>Gen ${b.gen}</small>`;
      t.onclick = () => { gen = b.gen; surprise = false; refresh(); };
      tabs.appendChild(t);
    });
  }

  function open() {
    G.UI.show('scr-gacha', true);
    refresh();
  }

  function refresh() {
    const s = G.DB.save;
    const banner = G.Gacha.BANNERS[gen - 1];
    document.querySelectorAll('#gacha-gens .gen-tab').forEach(t => t.classList.toggle('on', !surprise && +t.dataset.gen === gen));
    const sb = $('gacha-surprise');
    sb.classList.toggle('gold', surprise); sb.classList.toggle('ghost', !surprise);
    sb.setAttribute('aria-pressed', surprise ? 'true' : 'false');
    $('gacha-surprise-note').textContent = surprise ? 'ON: every roll comes from a random generation.' : 'Roll from a random generation instead of the one selected.';

    const all = surprise ? G.DEX.filter(p => G.SPRITE_META[p.dex]) : G.DEX.filter(p => p.gen === gen);
    const owned = all.filter(p => s.owned[p.dex]).length;
    const shinies = all.filter(p => s.shiny && s.shiny[p.dex]).length;
    const [c1, c2, c3] = surprise ? ['#2a0f55', '#12203f', '#4a1a6a'] : banner.color;
    $('banner').style.background =
      `radial-gradient(circle at 80% 30%, rgba(255,210,63,.3), transparent 45%),
       radial-gradient(circle at 15% 80%, rgba(196,123,255,.3), transparent 50%),
       linear-gradient(135deg, ${c1}, ${c2} 55%, ${c3})`;
    $('banner-title').textContent = surprise ? '??? Mystery Banner' : banner.name + ' Misterioso';
    $('banner-desc').textContent = surprise ? `Any of the ${all.length} Pokémon from any generation. Who knows what you will get?`
                                            : `Los ${all.length} Pokémon de la generación ${gen}. ¡Los legendarios esperan!`;
    $('gacha-owned').innerHTML = `Tienes ${owned} de ${all.length}` +
      (shinies ? ` · ${G.Icons.html('shiny', 12)} ${shinies} shiny` : '');

    const feat = $('gacha-feat');
    feat.innerHTML = '';
    if (surprise) {
      // Mystery style: dark silhouettes with a question mark instead of the featured Pokémon.
      for (const dex of mystery) {
        const w = document.createElement('div');
        w.className = 'mystery';
        w.appendChild(G.UI.spriteCanvas(dex, 170, 190, { silhouette: true, scale: 2, dir: 1 }));
        w.insertAdjacentHTML('beforeend', '<span>?</span>');
        feat.appendChild(w);
      }
    } else for (const dex of G.Gacha.featured(gen)) {
      feat.appendChild(G.UI.spriteCanvas(dex, 170, 190, { lively: true, scale: 2, dir: 1 }));
    }

    const pity = (s.pity && s.pity[surprise ? 'x' : gen]) || 0;
    $('gacha-pity').textContent = `Tiradas sin legendaria en ${surprise ? 'Surprise' : banner.name}: ${pity} / ${G.Gacha.PITY_5}`;

    $('gacha-rates').innerHTML = '<h3>Probabilidades</h3>' + G.Gacha.RATES.slice().reverse().map(([r, w]) => `
      <div><span style="color:${G.Gacha.RARITY_COLOR[r]}">${G.UI.stars(r, 10)} ${G.Gacha.RARITY_NAME[r]}</span>
      <span>${w}% · ${surprise ? G.Gacha.BANNERS.reduce((n, b) => n + G.Gacha.pool(r, b.gen).length, 0) : G.Gacha.pool(r, gen).length}</span></div>`).join('') +
      `<div><span>${G.Icons.html('shiny', 12)} Shiny</span><span>1%</span></div>
       <p class="note">· La tirada ×10 garantiza al menos una Épica.<br>
       · A las ${G.Gacha.PITY_5} tiradas sin Legendaria en un banner, la siguiente lo es.<br>
       · Los repetidos dan Pokémonedas. Los shiny no se repiten.<br>
       · Los tickets se consiguen jugando: algunos Pokémon los sueltan al caer, y
         los jefes y los legendarios de las grietas, a veces, tickets ×10.</p>`;

    const t = s.tickets;
    $('cost-1').innerHTML = `${G.Icons.html('ticket', 18)} 1`;
    $('cost-10').innerHTML = `${G.Icons.html('ticket', 18)} 10`;
    $('cost-10b').innerHTML = `${G.Icons.html('ticket10', 18)} 1`;
    $('gacha-tickets').innerHTML = `Tienes ${G.Icons.html('ticket', 18)} <b>${t.t1}</b> tickets y ${G.Icons.html('ticket10', 18)} <b>${t.t10}</b> tickets ×10`;
    $('pull-1').disabled = !G.Gacha.costOf(s, 1);
    $('pull-10').disabled = !G.Gacha.costOf(s, 10, 't1');
    $('pull-10b').disabled = !G.Gacha.costOf(s, 10, 't10');
    $('pull-all').disabled = !(t.t1 > 0 || t.t10 > 0);
    G.UI.refreshCoins();
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));

  async function pull(n, use = 't1') {
    if (busy) return;
    const res = G.Gacha.pull(G.DB.save, n, gen, use, surprise);
    if (!res) { G.Audio.sfx('error'); G.UI.toast('No tienes tickets suficientes: consíguelos jugando'); return; }
    present(res, n);
  }

  /** Spend every ticket on the selected banner (or Surprise): ×10 tickets, then groups of 10, then singles. */
  async function pullAll() {
    if (busy) return;
    const s = G.DB.save, t = s.tickets;
    const total = t.t1 + t.t10 * 10;
    if (!(t.t1 > 0 || t.t10 > 0)) { G.Audio.sfx('error'); G.UI.toast('You have no tickets'); return; }
    const where = surprise ? 'the Surprise banner' : G.Gacha.BANNERS[gen - 1].name;
    busy = true;                // no double clicks while the prompt is open
    const ok = await G.UI.ask('Use all tickets?',
      `Spend <b>${t.t1}</b> single and <b>${t.t10}</b> ×10 tickets (${total} pulls) on <b>${where}</b>?`, 'Use all', 'Cancel');
    busy = false;
    if (!ok) return;
    const res = [];
    const go = (n, use) => { const r = G.Gacha.pull(s, n, gen, use, surprise); if (r) res.push(...r); return !!r; };
    while (G.Gacha.costOf(s, 10, 't10') && go(10, 't10'));
    while (G.Gacha.costOf(s, 10, 't1') && go(10, 't1'));
    while (G.Gacha.costOf(s, 1) && go(1, 't1'));
    if (!res.length) return;
    present(res, res.length);
  }

  async function present(res, n) {
    G.Progress.checkAch();
    G.DB.commit(true);
    busy = true;

    const best = Math.max(...res.map(r => r.rarity));
    const many = res.length > 10;
    const fx = $('pull-fx'), slot = $('slot'), out = $('pull-results');
    out.innerHTML = '';
    $('pull-close').classList.add('hidden');
    slot.style.display = many ? 'none' : '';
    fx.classList.remove('hidden');

    // La tragaperras (ui/slots.js) y luego las cartas. (With "Use all tickets" there are too many: summary instead.)
    if (!many) await G.Slots.play(slot, res);
    G.Audio.sfx('burst', { rarity: best });
    slot.style.display = 'none';

    let list = res;
    if (many) {
      // Summary line, then only the notable results (new, shiny or Rare and above).
      const news = res.filter(r => r.isNew).length, shin = res.filter(r => r.shiny).length;
      const coins = res.reduce((a, r) => a + r.refund, 0);
      const top = Math.max(...res.map(r => r.rarity));
      out.insertAdjacentHTML('beforeend', `<div class="pull-sum" style="grid-column:1/-1;width:100%;text-align:center"><b>${res.length} pulls</b> · ${news} new${shin ? ' · ' + G.Icons.html('shiny', 12) + ' ' + shin + ' shiny' : ''} · <span class="coin"></span> +${coins} from duplicates · best: <span style="color:${G.Gacha.RARITY_COLOR[top]}">${G.Gacha.RARITY_NAME[top]}</span></div>`);
      list = res.filter(r => r.isNew || r.shiny || r.rarity >= 3);
    }
    for (const r of list) {
      const mon = G.DEX_BY[r.dex];
      const c = document.createElement('div');
      c.className = 'pcard r' + r.rarity + (r.shiny ? ' shiny' : '');
      c.style.setProperty('--rc', r.shiny ? '#9ae6ff' : G.Gacha.RARITY_COLOR[r.rarity]);
      c.innerHTML = `<div class="stars">${G.UI.stars(r.rarity, 24)}</div>`;
      c.appendChild(G.UI.spriteCanvas(r.dex, 132, 120, { lively: r.rarity >= 4 || r.shiny, scale: 2, shiny: r.shiny }));
      const tag = r.isNew
        ? `<span class="new">${r.shiny ? '¡SHINY NUEVO!' : '¡NUEVO!'}</span>`
        : `Repetido · <span class="coin"></span> +${r.refund}`;
      c.insertAdjacentHTML('beforeend', `<b>${r.shiny ? G.Icons.html('shiny', 12) + ' ' : ''}${mon.name}</b>${surprise ? `<small class="sub">Gen ${r.gen}</small>` : ''}<div class="tag">${tag}</div>`);
      out.appendChild(c);
      G.Audio.sfx('reveal', { rarity: r.rarity });
      await wait(many ? 40 : n === 10 ? 150 : 0);
    }
    $('pull-close').classList.remove('hidden');
    busy = false;
  }

  function close() {
    $('pull-fx').classList.add('hidden');
    refresh();
  }

  return { init, open, get open_() { return !$('pull-fx').classList.contains('hidden'); } };
})();
