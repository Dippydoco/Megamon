/* ============ chat-ui.js — chat screens ============
 *   G.DMUI      private chat with a friend (from Friends → Chat)
 *   G.RoomChatUI  room chat: in the waiting room and, during the run, a small
 *                 box at the bottom left (Enter to type, Esc to close)
 * Other players' text is always set with textContent (never as HTML).
 */
(() => {
  const $ = id => document.getElementById(id);

  const clock = at => { try { return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };

  /** Draws lines { mine, name, t, at } in a container and scrolls to the end if you were already at the bottom. */
  function renderLines(box, lines, opts = {}) {
    const atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.textContent = '';
    if (!lines.length && opts.empty) {
      const p = document.createElement('div');
      p.className = 'cm-empty'; p.textContent = opts.empty;
      box.appendChild(p);
    }
    for (const l of lines) {
      const row = document.createElement('div');
      row.className = 'cm ' + (l.mine ? 'me' : 'them');
      const who = document.createElement('b');
      who.textContent = l.name;
      if (l.c) who.style.color = l.c;
      const txt = document.createElement('span');
      txt.className = 'cm-t';
      txt.textContent = l.t;
      row.append(who, txt);
      if (opts.time && l.at) { const t = document.createElement('i'); t.textContent = clock(l.at); row.appendChild(t); }
      box.appendChild(row);
    }
    if (atEnd || opts.stick) box.scrollTop = box.scrollHeight;
  }

  // ======================= CHAT PRIVADO =======================

  G.DMUI = (() => {
    let other = null;

    const friend = () => G.Social.friends.find(f => f.uid === other && f.status === 'ok');

    function init() {
      $('chat-back').onclick = () => { other = null; G.FriendsUI.open(); };
      $('chat-mute').onclick = () => {
        if (!other) return;
        G.Chat.setMuted(other, !G.Chat.isMuted(other));
        G.Audio.sfx('select');
      };
      $('chat-form').onsubmit = async e => {
        e.preventDefault();
        if (!other) return;
        const inp = $('chat-input'), text = inp.value;
        if (!G.Chat.clean(text)) return;
        const r = await G.Chat.send(other, text);
        note(r.ok ? '' : r.error);
        if (r.ok) { inp.value = ''; G.Audio.sfx('select'); }
        inp.focus();
      };
      G.Chat.on((what, a, b) => {
        if (what === 'dm-new') {
          const f = G.Social.friends.find(x => x.uid === a);
          const here = G.UI.isOpen('scr-chat') && other === a;
          if (f && !here && !G.Chat.isMuted(a) && G.Game.state === 'ui') {
            G.UI.toast(f.name + ': ' + b.t.slice(0, 60), 3200);
            G.Audio.sfx('select');
          }
        }
        if (G.UI.isOpen('scr-chat') && other && (what === 'dm' || what === 'mute') && (a === other || !a)) {
          render();
          G.Chat.markRead(other);
        }
        if (G.UI.isOpen('scr-friends')) G.FriendsUI.render();
        G.MenuUI.refreshSocial && G.MenuUI.refreshSocial();
      });
      // If the friend disappears from the list (they removed you), go back to Friends.
      G.Social.on(() => { if (G.UI.isOpen('scr-chat') && other && !friend()) { other = null; G.FriendsUI.open(); } });
    }

    function note(t) { $('chat-note').textContent = t || ''; if (t) G.Audio.sfx('error'); }

    function open(uid) {
      const f = G.Social.friends.find(x => x.uid === uid && x.status === 'ok');
      if (!f) return;
      other = uid;
      G.UI.show('scr-chat', true);
      note('');
      render(true);
      G.Chat.markRead(uid);
      setTimeout(() => { const i = $('chat-input'); if (i) i.focus(); }, 60);
    }

    function render(stick) {
      const f = friend();
      if (!f) return;
      const muted = G.Chat.isMuted(other);
      $('chat-title').textContent = 'Chat with ' + f.name;
      $('chat-mute').textContent = muted ? 'Unmute' : 'Mute';
      $('chat-sub').textContent = muted
        ? 'You muted ' + f.name + ': their messages are hidden and will not notify you.'
        : 'Your last ' + G.Chat.DM_KEEP + ' messages together are kept.';
      const me = G.Social.me ? G.Social.me.name : 'You';
      const lines = G.Chat.history(other)
        .filter(m => !(muted && m.f === other))
        .map(m => ({ mine: m.f !== other, name: m.f === other ? f.name : me, t: String(m.t || ''), at: m.at, c: G.Cosmetics.validColor(m.c) }));
      renderLines($('chat-log'), lines, { time: true, stick, empty: 'No messages yet. Say hi!' });
    }

    return { init, open, render };
  })();

  // ======================= ROOM CHAT =======================

  G.RoomChatUI = (() => {
    const SHOW_MS = 10000;                 // during the run, each line shows for 10 s
    let runKey = '';

    // Mobile (touch): no team chat during the run (the waiting-room chat stays).
    const inRun = () => G.Coop.active && G.Game.state !== 'ui' && !(G.Touch && G.Touch.active);
    const lines = () => G.Chat.roomLog().map(l => ({ mine: l.u === G.Social.uid, name: l.name, t: l.t, at: l.at, c: l.c }));

    function init() {
      // Waiting room.
      $('lobby-chatform').onsubmit = e => {
        e.preventDefault();
        const inp = $('lobby-chatinput');
        const r = G.Chat.sendRoom(inp.value);
        if (r.ok) { inp.value = ''; G.Audio.sfx('select'); } else if (r.error) G.UI.toast(r.error, 1600);
        inp.focus();
      };
      // During the run.
      const form = $('chat-run-form'), inp = $('chat-run-input');
      form.onsubmit = e => {
        e.preventDefault();
        if (G.Chat.clean(inp.value)) {
          const r = G.Chat.sendRoom(inp.value);
          if (!r.ok) { if (r.error) G.UI.toast(r.error, 1600); return; }
        }
        inp.value = '';
        closeInput();
      };
      inp.onkeydown = e => {
        e.stopPropagation();
        if (e.key === 'Escape') { e.preventDefault(); inp.value = ''; closeInput(); }
      };
      inp.onblur = () => setTimeout(() => { if (document.activeElement !== inp) closeInput(); }, 50);
      $('chat-run-btn').onclick = () => openInput();
      addEventListener('keydown', e => {
        if (e.key !== 'Enter' || e.repeat) return;
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
        const st = G.Game.state;
        if (!inRun() || (st !== 'playing' && st !== 'held')) return;
        e.preventDefault();
        openInput();
      });
      G.Chat.on(what => {
        if (what !== 'room' && what !== 'mute') return;
        if (G.UI.isOpen('scr-lobby')) renderLobby(true);
        renderRun();
      });
      G.Social.on(what => { if (what === 'room' && G.UI.isOpen('scr-lobby')) renderLobby(); });
      setInterval(tick, 500);
    }

    function renderLobby(stick) {
      renderLines($('lobby-chatlog'), lines(), { stick, empty: 'Nobody has said anything yet.' });
    }

    function openInput() {
      if (!inRun()) return;
      $('chat-run-form').classList.remove('hidden');
      $('chat-run-input').focus();
      renderRun();
    }
    function closeInput() {
      const f = $('chat-run-form');
      if (f.classList.contains('hidden')) return;
      f.classList.add('hidden');
      $('chat-run-input').blur();
      renderRun();
    }

    /** The last lines, and only recent ones (all of them while you're typing). */
    function renderRun() {
      const typing = !$('chat-run-form').classList.contains('hidden');
      const t = Date.now();
      const recent = G.Chat.roomLog().filter(l => typing || t - l.at < SHOW_MS).slice(-6);
      const key = recent.map(l => l.at + l.t).join('|');
      if (key === runKey) return;            // nothing new: don't rebuild
      runKey = key;
      renderLines($('chat-run-log'), recent.map(l => ({ mine: l.u === G.Social.uid, name: l.name, t: l.t, c: l.c })), { stick: true });
    }

    function tick() {
      const on = inRun();
      $('chat-run').classList.toggle('hidden', !on);
      if (!on) { if (!$('chat-run-form').classList.contains('hidden')) closeInput(); return; }
      renderRun();
    }

    return { init, renderLobby };
  })();

  // Hooks into the social part's initialisation.
  const baseInit = G.SocialUI.init;
  G.SocialUI.init = () => { baseInit(); G.DMUI.init(); G.RoomChatUI.init(); };
})();
