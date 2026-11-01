"""Crop the 4 x 3 atelier sheet into small, independently loaded WebP portraits."""
import argparse
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
destination = root / 'apps/web/assets/avatars/atelier'
destination.mkdir(parents=True, exist_ok=True)
names = ['ink', 'shiba', 'witch', 'mecha', 'rabbit', 'clockwork', 'phantom', 'oracle', 'noir', 'jazz', 'paladin', 'sprout']
sheet = Image.open(args.source).convert('RGB')
# The generated sheet has slightly unequal row heights. Keep crop edges inside
# each painted tile, then center-crop to a square before downsampling.
rows = [0, 354, 707, 1086]
if sheet.size != (1448, 1086):
    raise ValueError('Expected the approved 1448 x 1086 atelier sheet')
total = 0
for index, name in enumerate(names):
    row, column = divmod(index, 4)
    left, top, right, bottom = column * 362 + 1, rows[row] + 1, (column + 1) * 362 - 1, rows[row + 1] - 1
    side = min(right - left, bottom - top)
    x, y = (left + right - side) // 2, (top + bottom - side) // 2
    portrait = sheet.crop((x, y, x + side, y + side)).resize((256, 256), Image.Resampling.LANCZOS)
    path = destination / f'{name}-v1.webp'
    portrait.save(path, 'WEBP', quality=80, method=6)
    size = path.stat().st_size
    total += size
    print(f'{path.name}: {size:,} bytes')
print(f'Total: {total:,} bytes for {len(names)} portraits')
