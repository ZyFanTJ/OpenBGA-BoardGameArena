"""Export image_gen atlases as browser assets; requires Pillow, no generation API.

This only unpacks existing pixels, pads transparent sprites and encodes WebP.
Source atlases remain intact. Run from the repository root.
"""
from collections import deque
from hashlib import sha256
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/dnd/source-atlases'
OUT = ROOT / 'apps/web/assets/dnd'
manifest = {'version': 1, 'generator': 'image_gen built-in', 'assets': [], 'sources': []}

SCENES = {
    'mistlight': (2, 2, ['village', 'trail', 'gate', 'vault']),
    'blackapple': (2, 5, ['appleVillage', 'sanitarium', 'manor', 'tavern', 'cloakroom', 'bluehouse', 'banquet', 'service', 'cellar', 'treasury']),
    'morgansfort': (3, 3, ['dragonInn', 'river', 'entry', 'wolvesDen', 'traps', 'kobolds', 'store', 'lower', 'nest']),
}
ACTORS = ['fighter', 'rogue', 'cleric', 'wizard', 'messenger', 'warden', 'mother', 'physician', 'fairy-lord', 'jester', 'attendant', 'bart', 'kobold-chief', 'boy', 'girl', 'miner']
FOES = ['wolf', 'den-wolf', 'sentinel', 'goat-guard', 'mirror-guard', 'stirge', 'kobold', 'mine-warden']
PROPS = ['lantern', 'map', 'mirror', 'thread', 'rope', 'silver', 'jade', 'opener', 'key', 'rune', 'potion', 'flower']


def export(im, group, name, **details):
    path = OUT / group / f'{name}-v1.webp'
    path.parent.mkdir(parents=True, exist_ok=True)
    if im.mode == 'RGBA':
        im.save(path, lossless=True, method=6, exact=True)
    else:
        im.save(path, quality=87, method=6)
    manifest['assets'].append({'id': name, 'group': group, 'path': str(path.relative_to(ROOT)).replace('\\', '/'), 'width': im.width, 'height': im.height, 'bytes': path.stat().st_size, 'sha256': sha256(path.read_bytes()).hexdigest(), **details})


for pack, (cols, rows, names) in SCENES.items():
    atlas = Image.open(SOURCE / f'{pack}-v1.png').convert('RGB')
    for i, name in enumerate(names):
        col, row = i % cols, i // cols
        box = (round(col*atlas.width/cols), round(row*atlas.height/rows), round((col+1)*atlas.width/cols), round((row+1)*atlas.height/rows))
        frame = atlas.crop(box)
        # Keep native pixels when possible; never enlarge a scene for download.
        export(frame, 'scenes', name, pack=pack, atlas=f'{pack}-v1.png', crop=list(box))
    cover_name = {'mistlight': 'village', 'blackapple': 'appleVillage', 'morgansfort': 'river'}[pack]
    cover = Image.open(OUT / 'scenes' / f'{cover_name}-v1.webp').convert('RGB')
    w = min(cover.width, round(cover.height*.86))
    x = (cover.width-w)//2
    export(cover.crop((x, 0, x+w, cover.height)), 'covers', pack, derivedFrom=cover_name)


def unpack_sprites(name, names, columns, rows, group):
    """Extract disconnected objects, rather than cutting weapons at grid edges.

    Generated atlases are approximate grids. Alpha-connected components retain
    the exact generated alpha and separate neighbouring objects that extend
    slightly across nominal cell boundaries.
    """
    atlas = Image.open(SOURCE / f'{name}-v1.png').convert('RGBA')
    w, h = atlas.size
    data = atlas.getchannel('A').tobytes()
    seen = bytearray(w*h)
    components = []
    for start, value in enumerate(data):
        if value < 32 or seen[start]:
            continue
        queue = deque([start])
        seen[start] = 1
        pixels = []
        x1, y1, x2, y2 = w, h, 0, 0
        while queue:
            p = queue.popleft()
            x, y = p % w, p // w
            pixels.append(p)
            x1, y1, x2, y2 = min(x1, x), min(y1, y), max(x2, x+1), max(y2, y+1)
            for q in (p-1 if x else -1, p+1 if x<w-1 else -1, p-w, p+w):
                if 0 <= q < w*h and not seen[q] and data[q] >= 32:
                    seen[q] = 1
                    queue.append(q)
        if len(pixels) > 1500:
            components.append((pixels, (x1, y1, x2, y2)))
    if len(components) != len(names):
        raise ValueError(f'{name}: expected {len(names)} isolated sprites, found {len(components)}')
    # Source rows are visually ordered but not always evenly padded.
    components.sort(key=lambda c: (c[1][1]+c[1][3])/2)
    ordered = []
    for row in range(rows):
        ordered.extend(sorted(components[row*columns:(row+1)*columns], key=lambda c: c[1][0]))
    for key, (pixels, box) in zip(names, ordered):
        source = atlas.crop(box)
        mask = bytearray(source.width*source.height)
        for p in pixels:
            x, y = p % w - box[0], p // w - box[1]
            mask[y*source.width+x] = data[p]
            # Retain the source's translucent edge pixels without the faint
            # alpha haze that can connect two separate sprites in an atlas.
            for dy in (-1,0,1):
                for dx in (-1,0,1):
                    nx, ny = x+dx, y+dy
                    q = p+dy*w+dx
                    if 0 <= nx < source.width and 0 <= ny < source.height and 0 < data[q] < 32:
                        mask[ny*source.width+nx] = data[q]
        source.putalpha(Image.frombytes('L', source.size, bytes(mask)))
        canvas_size = (224, 256) if group == 'actors' else (256, 256)
        # Preserve original adult/child size differences in the same scene.
        factor = .64 if group == 'actors' else min(228/source.width, 228/source.height)
        resized = source.resize((max(1,round(source.width*factor)), max(1,round(source.height*factor))), Image.Resampling.NEAREST)
        canvas = Image.new('RGBA', canvas_size)
        canvas.alpha_composite(resized, ((canvas.width-resized.width)//2, canvas.height-10-resized.height))
        export(canvas, group, key, atlas=f'{name}-v1.png', crop=list(box), alpha=True)
        if group == 'actors':
            head = max(56, round(min(source.width, source.height)*.62))
            x = (source.width-head)//2
            portrait = source.crop((x, 0, x+head, head)).resize((128,128), Image.Resampling.NEAREST)
            export(portrait, 'portraits', key, derivedFrom=key, alpha=True)


unpack_sprites('characters', ACTORS, 4, 4, 'actors')
unpack_sprites('enemies', FOES, 4, 2, 'foes')
unpack_sprites('props', PROPS, 4, 3, 'props')
for file in sorted(SOURCE.glob('*.png')):
    im = Image.open(file)
    manifest['sources'].append({'path': str(file.relative_to(ROOT)).replace('\\', '/'), 'width': im.width, 'height': im.height, 'sha256': sha256(file.read_bytes()).hexdigest()})
(ROOT/'assets/dnd/manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(f'Exported {len(manifest["assets"])} assets, {sum(a["bytes"] for a in manifest["assets"]):,} browser bytes')
