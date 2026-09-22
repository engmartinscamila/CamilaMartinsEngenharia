import { PNG } from 'npm:pngjs@7.0.0';

/** Desenha planejado e realizado somente nos pontos sustentados por medição datada.
 * Pontos reais desconhecidos não são substituídos por zero nem interpolados. */
export function renderScheduleCurveChart(points: ReadonlyArray<{ planned: number; actual: number | null }>): string {
  if (!points.length || points.some((point) => !Number.isFinite(point.planned) || point.planned < 0 || point.planned > 100 ||
    (point.actual !== null && (!Number.isFinite(point.actual) || point.actual < 0 || point.actual > 100)))) {
    throw new Error('Dados insuficientes ou inválidos para o gráfico da Curva S.');
  }
  const width = 960, height = 380, left = 54, right = 30, top = 25, bottom = 45;
  const image = new PNG({ width, height });
  for (let offset = 0; offset < image.data.length; offset += 4) {
    image.data[offset] = 250; image.data[offset + 1] = 249;
    image.data[offset + 2] = 246; image.data[offset + 3] = 255;
  }
  type RGB = readonly [number, number, number];
  const navy: RGB = [8, 25, 43], gold: RGB = [195, 156, 84], grid: RGB = [220, 223, 226];
  function dot(x: number, y: number, color: RGB, radius = 1) {
    for (let dx = -radius; dx <= radius; dx++) for (let dy = -radius; dy <= radius; dy++) {
      const px = Math.round(x + dx), py = Math.round(y + dy);
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      const offset = (py * width + px) * 4;
      image.data[offset] = color[0]; image.data[offset + 1] = color[1]; image.data[offset + 2] = color[2]; image.data[offset + 3] = 255;
    }
  }
  function line(x0: number, y0: number, x1: number, y1: number, color: RGB, radius = 1) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let step = 0; step <= steps; step++) dot(x0 + (x1 - x0) * step / steps, y0 + (y1 - y0) * step / steps, color, radius);
  }
  const x = (index: number) => left + index / Math.max(1, points.length - 1) * (width - left - right);
  const y = (percent: number) => height - bottom - percent / 100 * (height - top - bottom);
  line(left, top, left, height - bottom, navy);
  line(left, height - bottom, width - right, height - bottom, navy);
  for (let percent = 0; percent <= 100; percent += 20) {
    line(left, y(percent), width - right, y(percent), grid, 0);
  }
  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    if (!point) continue;
    dot(x(index), y(point.planned), gold, 2);
    if (point.actual !== null) dot(x(index), y(point.actual), navy, 2);
    if (index === 0) continue;
    const preceding = points[index - 1];
    if (!preceding) continue;
    line(x(index - 1), y(preceding.planned), x(index), y(point.planned), gold, 2);
    if (preceding.actual !== null && point.actual !== null) {
      line(x(index - 1), y(preceding.actual), x(index), y(point.actual), navy, 2);
    }
  }
  return PNG.sync.write(image).toString('base64');
}
