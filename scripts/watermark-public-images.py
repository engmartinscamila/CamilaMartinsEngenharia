"""Marca timbrada nas imagens dos projetos publicadas pelo site (somente na cópia de publicação;
os arquivos do repositório não mudam). Texto repetido em diagonal pela imagem inteira."""
import math
import pathlib
import sys

from PIL import Image, ImageDraw, ImageFont

TEXT = "CAMILA MARTINS ENGENHARIA  •  camilamartinsengenharia.com.br"
FONTS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
]


def font(size):
    for path in FONTS:
        if pathlib.Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size=size)


def stamp(path):
    image = Image.open(path)
    image.load()
    mode = image.mode
    base = image.convert("RGBA")
    w, h = base.size
    size = max(14, round(min(w, h) / 30))
    f = font(size)
    text_w = int(ImageDraw.Draw(base).textlength(TEXT, font=f))
    along = text_w + size * 3
    gap = int(size * 5.5)
    span = int(math.hypot(w, h)) + along * 2
    layer = Image.new("RGBA", (span, span), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    stroke = max(1, round(size * 0.05))
    for i, y in enumerate(range(0, span, gap)):
        shift = (i % 2) * along // 2
        for x in range(-along + shift, span, along):
            draw.text((x, y), TEXT, font=f, fill=(255, 255, 255, 44), stroke_width=stroke, stroke_fill=(0, 0, 0, 20))
    layer = layer.rotate(30, resample=Image.BICUBIC)
    left, top = (span - w) // 2, (span - h) // 2
    base.alpha_composite(layer.crop((left, top, left + w, top + h)))
    suffix = path.suffix.lower()
    if suffix == ".png":
        base.save(path)
    elif suffix in (".jpg", ".jpeg"):
        base.convert("RGB").save(path, quality=88)
    else:
        (base if mode in ("RGBA", "LA", "P") else base.convert("RGB")).save(path, "WEBP", quality=88, method=4)


def main(root):
    folder = pathlib.Path(root) / "assets" / "projetos"
    files = [p for p in folder.rglob("*") if p.suffix.lower() in (".webp", ".jpg", ".jpeg", ".png")]
    for p in files:
        stamp(p)
    print(f"Marca timbrada aplicada a {len(files)} imagem(ns) de projetos.")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "site-public")
