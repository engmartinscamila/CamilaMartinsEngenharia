#!/usr/bin/env bash
set -euo pipefail
mkdir -p /tmp/portfolio-clips assets/projetos/tiny-house-signature/videos
OUT=assets/projetos
make_still() {
  ffmpeg -hide_banner -loglevel error -y -loop 1 -i "$1" \
    -vf "scale=1360:860:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='min(zoom+0.00050,1.05)':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=84:s=1280x720:fps=24,format=yuv420p" \
    -frames:v 84 -an -c:v libx264 -preset veryfast -crf 24 -pix_fmt yuv420p "$2"
}
make_still "$OUT/tiny-house-signature/01.webp" /tmp/portfolio-clips/t1.mp4
make_still "$OUT/tiny-house-signature/03.webp" /tmp/portfolio-clips/t2.mp4
make_still "$OUT/tiny-house-signature/09.webp" /tmp/portfolio-clips/t3.mp4
ffmpeg -hide_banner -loglevel error -y -i /tmp/portfolio-clips/t1.mp4 -i /tmp/portfolio-clips/t2.mp4 -i /tmp/portfolio-clips/t3.mp4 \
  -filter_complex "[0:v][1:v]xfade=transition=fade:duration=0.6:offset=2.9[v1];[v1][2:v]xfade=transition=fade:duration=0.6:offset=5.8,fade=t=in:st=0:d=0.3,fade=t=out:st=9.0:d=0.3,format=yuv420p[v]" \
  -map '[v]' -an -c:v libx264 -preset veryfast -crf 24 -pix_fmt yuv420p -movflags +faststart "$OUT/tiny-house-signature/videos/tiny-house-cinematic.mp4"
ffmpeg -hide_banner -loglevel error -y \
  -loop 1 -i "$OUT/empreendimento-vitalle/curadoria-20260828/02-fachada-entardecer.webp" \
  -i "$OUT/empreendimento-vitalle/videos/vitalle-interiores-01.mp4" \
  -filter_complex "[0:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,trim=duration=3.3,setpts=PTS-STARTPTS,fps=24,format=yuv420p[front];[1:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,trim=duration=7,setpts=PTS-STARTPTS,fps=24,format=yuv420p[inside];[front][inside]xfade=transition=fade:duration=0.6:offset=2.7,fade=t=in:st=0:d=0.3,fade=t=out:st=9.3:d=0.3,format=yuv420p[v]" \
  -map '[v]' -an -c:v libx264 -preset veryfast -crf 24 -pix_fmt yuv420p -movflags +faststart "$OUT/empreendimento-vitalle/videos/vitalle-cinematic.mp4"
ffmpeg -hide_banner -loglevel error -y \
  -i "$OUT/casa-urban/videos/casa-urben-tour.mp4" \
  -vf "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=24,eq=contrast=1.025:saturation=1.025,fade=t=in:st=0:d=0.3,fade=t=out:st=9.2:d=0.6,format=yuv420p" \
  -t 9.8 -an -c:v libx264 -preset veryfast -crf 24 -pix_fmt yuv420p -movflags +faststart "$OUT/casa-urban/videos/casa-urben-cinematic.mp4"
for f in "$OUT/tiny-house-signature/videos/tiny-house-cinematic.mp4" "$OUT/empreendimento-vitalle/videos/vitalle-cinematic.mp4" "$OUT/casa-urban/videos/casa-urben-cinematic.mp4"; do
  test -s "$f" || { echo "Arquivo nao gerado: $f" >&2; exit 1; }
  ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$f"
done
