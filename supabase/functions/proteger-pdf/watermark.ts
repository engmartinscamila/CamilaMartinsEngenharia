import { degrees, PDFDocument, PDFFont, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";
import { normalizeText } from "./core.ts";

// Página pública onde qualquer pessoa confere se a cópia é autêntica e para quem foi emitida.
export const VERIFY_HOST = "camilamartinsengenharia.com.br";

export type ProtectPdfOptions = { issueCode: string; licensedTo: string; title: string; issuedAt: Date; };

function fitText(font: PDFFont, value: string, maxWidth: number, initialSize: number, minimumSize: number): { text: string; size: number } {
  let text = normalizeText(value, 220);
  let size = initialSize;
  while (size > minimumSize && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.25;
  while (text.length > 10 && font.widthOfTextAtSize(text, size) > maxWidth) text = `${text.slice(0, -4)}...`;
  return { text, size };
}

export async function protectPdf(input: Uint8Array, options: ProtectPdfOptions): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(input, { ignoreEncryption: false, updateMetadata: false });
  if (pdf.getPageCount() === 0) throw new Error("PDF_EMPTY");
  if (pdf.getPageCount() > 250) throw new Error("PDF_TOO_MANY_PAGES");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const issueCode = normalizeText(options.issueCode, 32);
  const licensedTo = normalizeText(options.licensedTo, 110);
  const title = normalizeText(options.title, 180);
  const date = options.issuedAt.toISOString().slice(0, 10);
  const watermark = `CAMILA MARTINS ENGENHARIA | COPIA AUTENTICADA ${issueCode}`;
  const footer = `Copia autenticada ${issueCode} | Licenciado para: ${licensedTo} | Emitido em ${date} | Confira em ${VERIFY_HOST}/verificar.html | Reproducao proibida`;
  const micro = `CME:${issueCode}:P`;

  for (const [index, page] of pdf.getPages().entries()) {
    const { width, height } = page.getSize();
    const watermarkSize = Math.max(9, Math.min(14, width / 44));
    const watermarkWidth = regular.widthOfTextAtSize(watermark, watermarkSize);
    // Linhas paralelas a 32°, com espaçamento fixo entre elas (sem sobreposição).
    const angle = (32 * Math.PI) / 180;
    const along = watermarkWidth + 60;
    const gap = Math.max(95, Math.min(width, height) / 4.2);
    const span = Math.hypot(width, height);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    for (let k = -Math.ceil(span / gap); k <= Math.ceil(span / gap); k += 1) {
      const shift = (k % 2) * (along / 2);
      for (let j = -Math.ceil(span / along) - 1; j <= Math.ceil(span / along) + 1; j += 1) {
        const t = j * along + shift;
        const x = width / 2 + t * cos - k * gap * sin;
        const y = height / 2 + t * sin + k * gap * cos;
        if (x < -along || x > width + 20 || y < -along || y > height + 20) continue;
        page.drawText(watermark, { x, y, size: watermarkSize, font: bold, color: rgb(0.35, 0.25, 0.18), rotate: degrees(32), opacity: 0.13 });
      }
    }
    page.drawRectangle({ x: 0, y: 0, width, height: 19, color: rgb(1, 1, 1), opacity: 0.9 });
    const fittedFooter = fitText(regular, footer, Math.max(50, width - 22), 7, 4);
    page.drawText(fittedFooter.text, { x: 11, y: 6.25, size: fittedFooter.size, font: regular, color: rgb(0.21, 0.17, 0.14), opacity: 0.96 });
    const pageCode = `${micro}${index + 1}`;
    page.drawText(pageCode, { x: 2, y: Math.max(22, height - 4), size: 1.8, font: regular, color: rgb(0.52, 0.48, 0.44), opacity: 0.035 });
    page.drawText(pageCode, { x: Math.max(2, width - regular.widthOfTextAtSize(pageCode, 1.8) - 2), y: 21, size: 1.8, font: regular, color: rgb(0.52, 0.48, 0.44), opacity: 0.035 });
  }

  pdf.setTitle(title);
  pdf.setAuthor("Camila Martins Engenharia");
  pdf.setCreator("Camila Martins Engenharia - Portal do Cliente");
  pdf.setProducer(`Camila Martins Engenharia | ${issueCode}`);
  pdf.setSubject(`Copia autenticada ${issueCode} | Licenciado para: ${licensedTo} | Confira em ${VERIFY_HOST}/verificar.html`);
  pdf.setKeywords(["Camila Martins Engenharia", "documento licenciado", issueCode, `emitido-${date}`]);
  pdf.setModificationDate(options.issuedAt);
  return pdf.save({ addDefaultPage: false, objectsPerTick: 40, useObjectStreams: false, updateFieldAppearances: false });
}
