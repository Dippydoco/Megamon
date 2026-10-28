#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Adds extra SpriteCollab animations to every Pokémon that has them (28-10-2026), without re-downloading the rest.
Used by the main menu: Sleep for the backdrop's naps (js/game.js Backdrop), and Sleep plus the expressive ones
(Hop, Rotate, Nod, Eat...) for your partner in its box (js/ui/ui.js, the `partner` option).

    python tools/fetch_anims.py                  # every name in EXTRA
    python tools/fetch_anims.py Hop Rotate       # only these

For each Pokémon in js/data/sprites-meta.js (the normal Pokédex numbers, not 9718 or the forms), it reads its
AnimData.xml, downloads {Name}-Anim.png (following CopyOf) to assets/pokemon/{dex}/{Name}.png and, when the Pokémon
has a shiny, the shiny's to assets/pokemon/{dex}/s/{Name}.png, and adds the animation to its entry in
sprites-meta.js (in "sm" when only the shiny lacks it). Safe to repeat: animations a Pokémon already has are skipped.
tools/fetch_sprites.py downloads the same list (WANT), so a full re-fetch keeps them.
"""
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_sprites as F


EXTRA = ['Sleep', 'Hop', 'Rotate', 'Nod', 'Eat', 'LookUp', 'Sit', 'Pose', 'Twirl', 'Appeal', 'Dance']
NAMES = [a for a in sys.argv[1:]] or EXTRA


def one(job):
    dex, meta = job
    names = [n for n in NAMES if n not in meta['a']]
    if not names:
        return dex, None
    tag = f'{dex:04d}'
    xml = F.fetch(f'{F.BASE}/{tag}/AnimData.xml')
    if not xml:
        return dex, None
    anims = F.parse_animdata(xml.decode('utf-8', 'replace'))[0]
    out_dir = os.path.join(F.OUT_ASSETS, str(dex))
    # Only an animation's own sheet (no stand-ins): `resolve` follows CopyOf, so a copy of Walk comes as Walk's drawing.
    got = F.download_set(f'{F.BASE}/{tag}', out_dir, anims, want=names)
    if not got:
        return dex, None
    res = {'a': got, 'sm': [], 'sa': {}}
    if meta.get('sh'):
        sxml = F.fetch(f'{F.BASE}/{tag}/0000/0001/AnimData.xml')
        sanims = F.parse_animdata(sxml.decode('utf-8', 'replace'))[0] if sxml else anims
        sgot = F.download_set(f'{F.BASE}/{tag}/0000/0001', os.path.join(out_dir, 's'), sanims, got, want=list(got))
        for n in got:
            if n not in sgot:
                res['sm'].append(n)
            elif sgot[n] != got[n]:
                res['sa'][n] = sgot[n]
    return dex, res


def main():
    text = open(F.OUT_META, encoding='utf-8').read()
    lines = text.split('\n')
    entries = {}
    for i, l in enumerate(lines):
        m = re.match(r'  (\d+): (\{.*\}),$', l)
        if m and int(m.group(1)) < 9000:
            entries[int(m.group(1))] = (i, json.loads(m.group(2)))
    print(f'{len(entries)} Pokémon')
    done = added = 0
    with ThreadPoolExecutor(max_workers=16) as ex:
        for dex, res in ex.map(one, [(d, e[1]) for d, e in entries.items()]):
            done += 1
            if res:
                i, meta = entries[dex]
                meta['a'].update(res['a'])
                if res['sm']:
                    meta['sm'] = sorted(set(meta.get('sm', [])) | set(res['sm']))
                if res['sa']:
                    meta.setdefault('sa', {}).update(res['sa'])
                lines[i] = f'  {dex}: {json.dumps(meta, separators=(",", ":"))},'
                added += len(res['a'])
            if done % 100 == 0:
                print(f'  {done}/{len(entries)}', flush=True)
    open(F.OUT_META, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    print(f'{added} animations added ({", ".join(NAMES)})')


if __name__ == '__main__':
    main()
