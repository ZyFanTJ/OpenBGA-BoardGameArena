"""Generate smaller display assets; keep original paintings and atlas coordinates intact."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'apps/web/assets'
JOBS = [
    ('lobby/hero-v2.webp', 'lobby/hero-display-v1.webp', 1440, 86),
    ('lobby/moon-v2.webp', 'lobby/moon-display-v1.webp', 576, 85),
    ('catan/terrain-v1.png', 'catan/terrain-v2.webp', 1536, 88),
    ('catan/terrain-v1.png', 'lobby/catan-preview-v1.webp', 768, 85),
]
for source, destination, width, quality in JOBS:
    image = Image.open(ROOT / source).convert('RGB')
    if image.width > width:
        image = image.resize((width, round(image.height * width / image.width)), Image.Resampling.LANCZOS)
    image.save(ROOT / destination, 'WEBP', quality=quality, method=6)
    print(f'{destination}: {(ROOT / source).stat().st_size} -> {(ROOT / destination).stat().st_size} bytes, {image.size}')
