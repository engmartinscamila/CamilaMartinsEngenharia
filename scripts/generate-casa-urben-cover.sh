#!/usr/bin/env bash
set -euo pipefail

# Build the cinematic cover from the ORIGINAL Casa Urben gallery photo 03.
# Invoked before source auditing and again when constructing the Pages artifact.
# This does not replace or change the original source image.
BASE="${1:-assets/projetos/casa-urban}"
PHOTO="${BASE}/03.webp"
VIDEO="${BASE}/videos/casa-urben-foto03-movimento.mp4"

if [[ ! -s "${PHOTO}" ]]; then
  echo "ERRO: foto 03 original da Casa Urben ausente: ${PHOTO}" >&2
  exit 1
fi
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ERRO: ffmpeg indisponível para gerar a capa animada da Casa Urben." >&2
  exit 1
fi

mkdir -p "$(dirname "${VIDEO}")"

# The original image is 1600 x 600. A 570 x 600 sliding crop fills the
# portrait-oriented project card, showing both the lateral window and garage
# over a seamless 12-second panoramic movement.
ffmpeg -hide_banner -loglevel error -nostdin -y \
  -loop 1 -framerate 24 -i "${PHOTO}" -t 12 \
  -vf "crop=w=570:h=600:x='(in_w-out_w)*(0.5-0.5*cos(2*PI*n/(24*12)))':y=0,scale=760:800:flags=lanczos,format=yuv420p" \
  -c:v libx264 -preset veryfast -crf 24 -pix_fmt yuv420p -movflags +faststart \
  -an "${VIDEO}"

test -s "${VIDEO}" || { echo "ERRO: vídeo de capa Casa Urben não gerado." >&2; exit 1; }
echo "OK: capa animada da Casa Urben gerada a partir da imagem 03 original: ${VIDEO}"
