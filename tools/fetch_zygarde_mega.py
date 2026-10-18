#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Descarga el sprite de Mega Zygarde (y su shiny) de SpriteCollab como si fuera un
Pokémon propio con número 9718 (no está en la Pokédex: sólo lo usa el jefe del
Portal de Zygarde al transformarse, ver js/systems/rift.js).

    python tools/fetch_zygarde_mega.py

- Sprite normal:  sprite/0718/0005/        (forma "Mega")
- Sprite shiny:   sprite/0718/0005/0001/
Guarda las hojas en assets/pokemon/9718/, la geometría en tools/cache/9718.json
(así tools/fetch_sprites.py la conserva si se vuelve a ejecutar) y la añade a
js/data/sprites-meta.js. Se puede repetir sin problema.
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
        sys.exit('No se pudo bajar AnimData.xml de Mega Zygarde')
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
    # Antes de la entrada 718 si existe (orden numérico aproximado), si no al final.
    idx = next((i for i, l in enumerate(s) if l.startswith('  718: ')), None)
    if idx is None:
        idx = max(i for i, l in enumerate(s) if l.strip() == '};')
    s.insert(idx, line.rstrip('\n'))
    open(F.OUT_META, 'w', encoding='utf-8', newline='\n').write('\n'.join(s))
    print(f'Mega Zygarde ({DEX}): {sorted(meta["a"])} shiny={bool(meta.get("sh"))}')


if __name__ == '__main__':
    main()
