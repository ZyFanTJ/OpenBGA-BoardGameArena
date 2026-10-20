"""Re-encode source art losslessly. Run with Python + Pillow; not needed at runtime."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'apps/web/assets'


def save_exact(source, destination, box=None):
    original = Image.open(source).convert('RGB')
    pixels = original.crop(box) if box else original
    destination.parent.mkdir(parents=True, exist_ok=True)
    pixels.save(destination, 'WEBP', lossless=True, quality=100, method=6, exact=True)
    with Image.open(destination) as encoded:
        assert encoded.convert('RGB').tobytes() == pixels.tobytes(), destination
    print(f'{destination.relative_to(ROOT)}: {source.stat().st_size:,} -> {destination.stat().st_size:,} bytes; identical pixels')


for name in ['hero', 'moon']:
    save_exact(ASSETS / f'lobby/{name}-v1.png', ASSETS / f'lobby/{name}-v2.webp')
cards = ROOT / 'assets/cabo/reference-style/cabo-atlas-v1.png'
save_exact(cards, ASSETS / 'cabo-atlas-v2.webp')
for index in [0, 4, 9]:
    x, y = index % 4 * 256, index // 4 * 384
    save_exact(cards, ASSETS / f'lobby/cabo-{index}-v1.webp', (x, y, x + 256, y + 384))
for index, name in enumerate(['werewolf', 'avalon', 'undercover', 'uno', 'ludo', 'catan']):
    x, y = index % 3 * 512, index // 3 * 512
    save_exact(ASSETS / 'lobby/covers-v1.png', ASSETS / f'lobby/cover-{name}-v1.webp', (x, y, x + 512, y + 512))
# The lobby displays only the last scene of this eight-scene atlas.
save_exact(ASSETS / 'seven-wonders/wonders-v1.webp', ASSETS / 'lobby/wonders-cover-v1.webp', (768, 768, 1536, 1024))
