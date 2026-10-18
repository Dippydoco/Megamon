#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Downloads the Mega Zygarde sprite (and its shiny) from SpriteCollab as if it were
a Pokémon of its own with number 9718 (it isn't in the Pokédex: only the Zygarde
Portal boss uses it when it transforms, see js/systems/rift.js).

    python tools/fetch_zygarde_mega.py

- Sprite normal:  sprite/0718/0005/        (forma "Mega")
- Sprite shiny:   sprite/0718/0005/0001/
Saves the sheets in assets/pokemon/9718/, the geometry in tools/cache/9718.json
(so tools/fetch_sprites.py keeps it if it is run again) and adds it to
js/data/sprites-meta.js. It can be repeated safely.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_sprites as F

DEX = 9718
FORM = '0718/0005'


def main():
    base = f'{F.BASE}/{FORM}'
    xml = F.fetch(f'{base}/AnimData.xml')
    if not xml:
        sys.exit('Could not download AnimData.xml for Mega Zygarde')
    anims, shadow = F.parse_animdata(xml.decode('utf-8', 'replace'))
    out = os.path.join(F.OUT_ASSETS, str(DEX))
    normal = F.download_set(base, out, anims)
    if not F.REQUIRED <= set(normal):
        sys.exit('Faltan animaciones obligatorias: ' + str(F.REQUIRED - set(normal)))
    meta = {'s': shadow, 'a': normal}

    sxml = F.fetch(f'{base}/0001/AnimData.xml')
    sanims = F.parse_animdata(sxml.decode('utf-8', 'replace'))[0] if sxml else anims
    shiny = F.download_set(f'{base}/0001', os.path.join(out, 's'), sanims, normal)
    if F.REQUIRED <= set(shiny):
        meta['sh'] = 1
        diff = {k: v for k, v in shiny.items() if normal.get(k) != v}
        if diff:
            meta['sa'] = diff
        missing = [k for k in normal if k not in shiny]
        if missing:
            meta['sm'] = missing

    os.makedirs(F.CACHE, exist_ok=True)
    with open(os.path.join(F.CACHE, f'{DEX}.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, separators=(',', ':'))

    line = f'  {DEX}: {json.dumps(meta, separators=(",", ":"))},\n'
    s = open(F.OUT_META, encoding='utf-8').read().split('\n')
    s = [l for l in s if not l.startswith(f'  {DEX}: ')]
    # Before entry 718 if it exists (approximate numeric order), otherwise at the end.
    idx = next((i for i, l in enumerate(s) if l.startswith('  718: ')), None)
    if idx is None:
        idx = max(i for i, l in enumerate(s) if l.strip() == '};')
    s.insert(idx, line.rstrip('\n'))
    open(F.OUT_META, 'w', encoding='utf-8', newline='\n').write('\n'.join(s))
    print(f'Mega Zygarde ({DEX}): {sorted(meta["a"])} shiny={bool(meta.get("sh"))}')


if __name__ == '__main__':
    main()
