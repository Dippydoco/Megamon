# Builds assets/fonts/MegamonTypes.ttf from tools/type_glyphs.json (28-10-2026): the type-chip letters from Slevanas's
# "Bigger Pokemon type icons and font", one 5x8 pixel grid per letter (# = filled).
#     python tools/make_type_font.py tools/type_glyphs.json assets/fonts/MegamonTypes.ttf
import json,sys
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
G=json.load(open(sys.argv[1]))
U=125                      # font units per art pixel: 8 rows = 1000 = 1 em, so 16px text = 2 screen px per art pixel
ADV=6                      # 5 px glyph + 1 px gap
order=['.notdef','space']+[c for c in sorted(G)]
fb=FontBuilder(1000,isTTF=True)
names={c:('question' if c=='?' else c) for c in G}
fb.setupGlyphOrder(['.notdef','space']+[names[c] for c in sorted(G)])
cmap={32:'space'}
for c in G:
    cmap[ord(c)]=names[c]
    if c.isalpha(): cmap[ord(c.lower())]=names[c]
fb.setupCharacterMap(cmap)
glyphs={}; metrics={}
def rects(rows):
    out=[]; top=len(rows) if len(rows)<=8 else 8   # rows below 8 hang under the baseline
    for j,r in enumerate(rows):
        i=0
        while i<len(r):
            if r[i]=='#':
                k=i
                while k<len(r) and r[k]=='#': k+=1
                y1=(8-j)*U; y0=y1-U
                out.append((i*U, y0, k*U, y1)); i=k
            else: i+=1
    return out
for c,rows in G.items():
    pen=TTGlyphPen(None)
    for (x0,y0,x1,y1) in rects(rows):
        pen.moveTo((x0,y0)); pen.lineTo((x0,y1)); pen.lineTo((x1,y1)); pen.lineTo((x1,y0)); pen.closePath()
    glyphs[names[c]]=pen.glyph(); metrics[names[c]]=(ADV*U,0)
for n,w in (('.notdef',ADV*U),('space',4*U)):
    pen=TTGlyphPen(None); glyphs[n]=pen.glyph(); metrics[n]=(w,0)
fb.setupGlyf(glyphs); fb.setupHorizontalMetrics(metrics)
fb.setupHorizontalHeader(ascent=1000,descent=-250)
fam='Megamon Types'
fb.setupNameTable({'familyName':fam,'styleName':'Regular','uniqueFontIdentifier':fam,'fullName':fam,'psName':'MegamonTypes-Regular','version':'1.0',
  'copyright':'Letters by Slevanas (deviantart.com/slevanas/art/Bigger-Pokemon-type-icons-and-font-501606704), converted for Megamon'})
fb.setupOS2(sTypoAscender=1000,sTypoDescender=-250,usWinAscent=1000,usWinDescent=250)
fb.setupPost(); fb.save(sys.argv[2]); print('ok',sys.argv[2],len(G),'glyphs')
