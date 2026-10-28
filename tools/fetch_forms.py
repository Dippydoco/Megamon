#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Downloads the alternate forms (Megas, regional forms, female variants, Unown letters...)
from SpriteCollab as cosmetic skins, and generates js/data/forms.js.

    python tools/fetch_forms.py           # all eligible forms
    python tools/fetch_forms.py --list    # only print the catalogue, download nothing

Eligible = canon form (SpriteCollab's `canon` flag), sprite not marked incomplete, and it has at
least Idle, Walk and Attack. Fan recolours and redesigns (Altcolor, Alternate, Cutscene, Beta...)
are left out. Mega Zygarde is skipped: it is already in the game as 9718 (tools/fetch_zygarde_mega.py).

Each form is drawn as if it were a Pokémon of its own with a sprite id:
    id = 100000 + dex * 100 + form number        (female variants: + 50)
    e.g. Mega Charizard X = sprite/0006/0001 -> 100601,  female Venusaur = 0003/0000/0000/0002 -> 100350
Sheets go to assets/pokemon/{id}/ (shiny in s/, when SpriteCollab has one), the geometry to
tools/cache_forms/{id}.json (reused when re-run), and the catalogue plus geometry to js/data/forms.js.
It can be interrupted and repeated safely.
"""
import io
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_sprites as F

CACHE = os.path.join(F.ROOT, 'tools', 'cache_forms')
OUT_JS = os.path.join(F.ROOT, 'js', 'data', 'forms.js')
DROP = re.compile(r'(Altcolor|Alternate|Cutscene|Beta|Skytemple|Shadow|Drone|Purple)')
REGIONS = ('Alola', 'Galar', 'Hisui', 'Paldea')
# Labels that read badly once the underscores are gone.
LABEL = {'Pa_U': "Pa'u", 'Pom_Pom': 'Pom-Pom', '10': '10%', 'Question_Mark': '???',
         'Exclamation': '!', 'Question': '?', 'Mega_X': 'Mega X', 'Mega_Y': 'Mega Y'}


def category(form):
    if form.startswith('Mega') or form == 'Primal':
        return 'mega'
    if form.split('_')[0] in REGIONS:
        return 'regional'
    if form == 'Female':
        return 'female'
    return 'form'


def label(form):
    if form in LABEL:
        return LABEL[form]
    return ' '.join(LABEL.get(p, p) for p in form.split('_'))


def catalogue(tracker):
    """Every eligible form: (id, dex, label, category, normal path, shiny path or None, fully featured)."""
    out = []
    for tag, d in tracker.items():
        dex = int(tag)
        if dex == 0:
            continue
        for fid, f in d.get('subgroups', {}).items():
            cands = []
            if fid != '0000':
                cands.append((f'{tag}/{fid}', f.get('name', ''), f, f['subgroups'].get('0001'), 0))
            n0 = f['subgroups'].get('0000')
            if n0 and '0002' in n0['subgroups']:      # female variant of this form
                s1 = f['subgroups'].get('0001')
                cands.append((f'{tag}/{fid}/0000/0002', (f.get('name', '') + ' Female').strip(),
                              n0['subgroups']['0002'], s1 and s1['subgroups'].get('0002'), 50))
            for path, form, node, shiny, plus in cands:
                files = set(node.get('sprite_files', {}))
                if not (f.get('canon', True) and node.get('sprite_complete', 0) >= 1 and F.REQUIRED <= files):
                    continue
                if DROP.search(form) or (dex == 718 and form.startswith('Mega')):
                    continue
                n = int(fid) + plus
                if n >= 100:
                    raise SystemExit(f'form number too big: {path}')
                if plus:
                    spath = f'{tag}/{fid}/0001/0002'
                else:
                    spath = f'{tag}/{fid}/0001'
                # The shiny only needs its files: SpriteCollab marks some finished shinies "incomplete"
                # (Mega Charizard X's), so its completeness flag is not checked.
                has_shiny = bool(shiny and {'Idle', 'Walk'} <= set(shiny.get('sprite_files', {})))
                base_form = form[:-7].strip() if plus else form
                shown = ((label(base_form) + ' ') if base_form else '') + 'Female' if plus else label(form)
                out.append({'id': 100000 + dex * 100 + n, 'dex': dex, 'form': shown,
                            'cat': category(base_form) if base_form else 'female',
                            'path': path, 'spath': spath if has_shiny else None,
                            'full': node.get('sprite_complete', 0) == 2})
    out.sort(key=lambda o: o['id'])
    return out


def do_form(o):
    cache_file = os.path.join(CACHE, f'{o["id"]}.json')
    out_dir = os.path.join(F.OUT_ASSETS, str(o['id']))
    if os.path.exists(cache_file):
        meta = json.load(open(cache_file, encoding='utf-8'))
        if all(os.path.exists(os.path.join(out_dir, a + '.png')) for a in meta['a']):
            return o, meta
    base = f'{F.BASE}/{o["path"]}'
    xml = F.fetch(f'{base}/AnimData.xml')
    if not xml:
        return o, None
    anims, shadow = F.parse_animdata(xml.decode('utf-8', 'replace'))
    normal = F.download_set(base, out_dir, anims)
    if not F.REQUIRED <= set(normal):
        return o, None
    meta = {'s': shadow, 'a': normal}
    if o['spath']:
        sbase = f'{F.BASE}/{o["spath"]}'
        sxml = F.fetch(f'{sbase}/AnimData.xml')
        sanims = F.parse_animdata(sxml.decode('utf-8', 'replace'))[0] if sxml else anims
        shiny = F.download_set(sbase, os.path.join(out_dir, 's'), sanims, normal)
        if 'Idle' in shiny and 'Walk' in shiny:
            meta['sh'] = 1
            diff = {k: v for k, v in shiny.items() if normal.get(k) != v}
            if diff:
                meta['sa'] = diff
            miss = [k for k in normal if k not in shiny]
            if miss:
                meta['sm'] = miss
    with open(cache_file, 'w', encoding='utf-8') as fh:
        json.dump(meta, fh, separators=(',', ':'))
    return o, meta


def main():
    print('Reading SpriteCollab tracker.json...')
    tracker = json.loads(F.fetch(F.RAW + '/tracker.json').decode('utf-8'))
    forms = catalogue(tracker)
    if '--list' in sys.argv:
        for o in forms:
            print(o['id'], o['dex'], o['cat'], o['form'], o['path'], 'shiny' if o['spath'] else '')
        print(len(forms), 'forms')
        return
    os.makedirs(CACHE, exist_ok=True)
    print(f'{len(forms)} forms')
    done, metas, failed = 0, {}, []
    with ThreadPoolExecutor(max_workers=16) as ex:
        for o, meta in ex.map(do_form, forms):
            done += 1
            if meta:
                metas[o['id']] = (o, meta)
            else:
                failed.append(o['path'])
            if done % 25 == 0 or done == len(forms):
                print(f'  {done}/{len(forms)}', flush=True)

    lines = [
        '/* ============ forms.js — GENERATED by tools/fetch_forms.py, do not edit by hand ============',
        ' * Alternate forms from SpriteCollab (Megas, regional forms, female variants, Unown letters...),',
        ' * used as cosmetic skins. Each form is drawn as its own sprite id (100000 + dex*100 + form,',
        ' * female variants +50) with sheets in assets/pokemon/{id}/; the geometry is merged into',
        ' * G.SPRITE_META (same format, see sprites-meta.js), so G.Sprites draws them like any Pokémon.',
        ' *',
        ' * G.FORMS: [id, dex, form label, category, fully featured (1/0)]',
        ' *   category: mega (Megas and Primals) · regional (Alola, Galar, Hisui, Paldea)',
        ' *             female (gender differences) · form (every other canon form)',
        ' */',
        'G.FORMS = [',
    ]
    for fid in sorted(metas):
        o = metas[fid][0]
        lines.append(f'  {json.dumps([fid, o["dex"], o["form"], o["cat"], 1 if o["full"] else 0], ensure_ascii=False)},')
    lines += ['];', 'Object.assign(G.SPRITE_META, {']
    for fid in sorted(metas):
        lines.append(f'  {fid}: {json.dumps(metas[fid][1], separators=(",", ":"))},')
    lines += ['});', '']
    with io.open(OUT_JS, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('\n'.join(lines))

    size = sum(os.path.getsize(os.path.join(F.OUT_ASSETS, str(i), dp, fn))
               for i in metas for dp, _, fns in os.walk(os.path.join(F.OUT_ASSETS, str(i))) for fn in fns)
    print(f'\n{len(metas)} forms ({sum(1 for _, m in metas.values() if m.get("sh"))} with shiny), {size / 1e6:.1f} MB')
    if failed:
        print(f'Failed ({len(failed)}): {failed}')


if __name__ == '__main__':
    main()
