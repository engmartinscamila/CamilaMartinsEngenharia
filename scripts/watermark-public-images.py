"""Marca timbrada nas imagens e vídeos dos projetos publicados pelo site (somente na cópia de
publicação; os arquivos do repositório não mudam). Texto repetido em diagonal pelo quadro inteiro."""
import functools
import math
import os
from concurrent.futures import ProcessPoolExecutor
import pathlib
import shutil
import subprocess
import sys
import tempfile

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


@functools.lru_cache(maxsize=64)
def tiled_layer(w, h):
    """Camada transparente (w x h) com o texto repetido em diagonal."""
    size = max(14, round(min(w, h) / 30))
    f = font(size)
    text_w = int(ImageDraw.Draw(Image.new("RGBA", (1, 1))).textlength(TEXT, font=f))
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
    return layer.crop((left, top, left + w, top + h))


def corner_label(base):
    """Selo "© CAMILA MARTINS ENGENHARIA" no canto inferior esquerdo (o direito costuma ter o logotipo do vídeo)."""
    w, h = base.size
    size = max(12, round(min(w, h) * 0.03))
    f = font(size)
    label = "© CAMILA MARTINS ENGENHARIA"
    draw = ImageDraw.Draw(base)
    tw = draw.textlength(label, font=f)
    pad = max(10, round(min(w, h) * 0.02))
    x, y = pad * 2, h - size - pad * 2
    draw.rectangle((pad, y - pad // 2, x + tw + pad, h - pad), fill=(1, 9, 20, 150))
    draw.text((x, y), label, font=f, fill=(255, 255, 255, 220))


def stamp(path):
    image = Image.open(path)
    image.load()
    mode = image.mode
    base = image.convert("RGBA")
    w, h = base.size
    base.alpha_composite(tiled_layer(w, h))
    suffix = path.suffix.lower()
    if suffix == ".png":
        base.save(path)
    elif suffix in (".jpg", ".jpeg"):
        base.convert("RGB").save(path, quality=88)
    else:
        (base if mode in ("RGBA", "LA", "P") else base.convert("RGB")).save(path, "WEBP", quality=88, method=4)


def video_size(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                          "-of", "csv=p=0", str(path)], check=True, capture_output=True, text=True).stdout.strip()
    w, h = (int(v) for v in out.split(",")[:2])
    return w, h


def stamp_video(path):
    w, h = video_size(path)
    with tempfile.TemporaryDirectory() as tmp:
        overlay = pathlib.Path(tmp) / "marca.png"
        layer = tiled_layer(w, h).copy()
        corner_label(layer)
        layer.save(overlay)
        out = pathlib.Path(tmp) / path.name
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", str(path), "-i", str(overlay),
                        "-filter_complex", "[0:v][1:v]overlay=0:0:format=auto,format=yuv420p", "-map", "0:a?",
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "copy", "-movflags", "+faststart",
                        str(out)], check=True)
        shutil.move(str(out), str(path))


def main(root):
    folder = pathlib.Path(root) / "assets" / "projetos"
    files = [p for p in folder.rglob("*") if p.suffix.lower() in (".webp", ".jpg", ".jpeg", ".png")]
    workers = max(1, os.cpu_count() or 1)
    # Mesmo tamanho -> mesma camada (cache por processo); arquivos agrupados por tamanho.
    files.sort(key=lambda p: Image.open(p).size)
    with ProcessPoolExecutor(workers) as pool:
        list(pool.map(stamp, files, chunksize=8))
    print(f"Marca timbrada aplicada a {len(files)} imagem(ns) de projetos.")
    videos = [p for p in folder.rglob("*.mp4")]
    if videos and not shutil.which("ffmpeg"):
        if os.environ.get("CME_ALLOW_UNMARKED_VIDEO") == "1":
            print("AVISO: ffmpeg ausente; vídeos sem marca (somente teste local).")
            return
        raise SystemExit("ERRO: ffmpeg é necessário para gravar a marca nos vídeos dos projetos.")
    with ProcessPoolExecutor(max(1, min(4, os.cpu_count() or 1))) as pool:
        list(pool.map(stamp_video, videos))
    print(f"Marca timbrada gravada em {len(videos)} vídeo(s) de projetos.")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "site-public")
