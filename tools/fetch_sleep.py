#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Adds SpriteCollab's Sleep animation to every Pokémon that has one (28-10-2026), without re-downloading the rest.
Used by the main menu's backdrop: wandering Pokémon now and then lie down and sleep (js/game.js Backdrop).

    python tools/fetch_sleep.py

For each Pokémon in js/data/sprites-meta.js (the normal Pokédex numbers, not 9718 or the forms), it reads its
AnimData.xml, downloads Sleep-Anim.png (following CopyOf) to assets/pokemon/{dex}/Sleep.png and, when the Pokémon
has a shiny, the shiny's to assets/pokemon/{dex}/s/Sleep.png, and adds "Sleep" to its entry in sprites-meta.js
(in "sm" when only the shiny lacks it). Safe to repeat: Pokémon that already have it are skipped.
tools/fetch_sprites.py also downloads Sleep now, so a full re-fetch keeps it.
"""
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_sprites as F


def one(job):
    dex, meta = job
    if 'Sleep' in meta['a']:
        return dex, None
    tag = f'{dex:04d}'
    xml = F.fetch(f'{F.BASE}/{tag}/AnimData.xml')
    if not xml:
        return dex, None
    anims = F.parse_animdata(xml.decode('utf-8', 'replace'))[0]
    out_dir = os.path.join(F.OUT_ASSETS, str(dex))
    got = F.download_set(f'{F.BASE}/{tag}', out_dir, anims, want=['Sleep'])
    if 'Sleep' not in got:
        return dex, None
    res = {'a': got['Sleep']}
    if meta.get('sh'):
        sxml = F.fetch(f'{F.BASE}/{tag}/0000/0001/AnimData.xml')
        sanims = F.parse_animdata(sxml.decode('utf-8', 'replace'))[0] if sxml else anims
        sgot = F.download_set(f'{F.BASE}/{tag}/0000/0001', os.path.join(out_dir, 's'), sanims, got, want=['Sleep'])
        if 'Sleep' not in sgot:
            res['sm'] = True
        elif sgot['Sleep'] != got['Sleep']:
            res['sa'] = sgot['Sleep']
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
                meta['a']['Sleep'] = res['a']
                if res.get('sm'):
                    meta['sm'] = sorted(set(meta.get('sm', [])) | {'Sleep'})
                if res.get('sa'):
                    meta.setdefault('sa', {})['Sleep'] = res['sa']
                lines[i] = f'  {dex}: {json.dumps(meta, separators=(",", ":"))},'
                added += 1
            if done % 100 == 0:
                print(f'  {done}/{len(entries)}', flush=True)
    open(F.OUT_META, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    print(f'Sleep added to {added} Pokémon')


if __name__ == '__main__':
    main()
