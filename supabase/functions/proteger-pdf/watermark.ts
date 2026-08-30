import {
  degrees,
  PDFDocument,
  PDFFont,
  rgb,
  StandardFonts
} from "npm:pdf-lib@1.17.1";
import { normalizeText } from "./core.ts";

export type ProtectPdfOptions = {
  issueCode: string;
  licensedTo: string;
  title: string;
  issuedAt: Date;
};

function fitText(
  font: PDFFont,
  value: string,
  maxWidth: number,
  initialSize: number,
  minimumSize: number
): { text: string; size: number } {
  let text = normalizeText(value, 220);
  let size = initialSize;

  while (
    size > minimumSize &&
    font.widthOfTextAtSize(text, size) > maxWidth
  ) {
    size -= 0.25;
  }

  while (
    text.length > 10 &&
    font.widthOfTextAtSize(text, size) > maxWidth
  ) {
    text = `${text.slice(0, -4)}...`;
  }

  return { text, size };
}

export async function protectPdf(
  input: Uint8Array,
  options: ProtectPdfOptions
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(input, {
    ignoreEncryption: false,
    updateMetadata: false
  });

  if (pdf.getPageCount() === 0) {
    throw new Error("PDF_EMPTY");
  }

  if (pdf.getPageCount() > 250) {
    throw new Error("PDF_TOO_MANY_PAGES");
  }

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const issueCode = normalizeText(options.issueCode, 32);
  const licensedTo = normalizeText(options.licensedTo, 110);
  const title = normalizeText(options.title, 180);
  const date = options.issuedAt.toISOString().slice(0, 10);
  const watermark =
    `CAMILA MARTINS ENGENHARIA | ${issueCode} | USO EXCLUSIVO`;
  const footer =
    `Licenciado para: ${licensedTo} | ${issueCode} | ` +
    `Emitido em ${date} | Reproducao e redistribuicao proibidas`;
  const micro = `CME:${issueCode}:P`;

  for (const [index, page] of pdf.getPages().entries()) {
    const { width, height } = page.getSize();
    const watermarkSize = Math.max(8, Math.min(11, width / 55));
    const watermarkWidth =
      regular.widthOfTextAtSize(watermark, watermarkSize);
    const stepX = Math.max(250, watermarkWidth + 72);
    const stepY = Math.max(125, height / 6);

    for (let y = -40; y < height + 80; y += stepY) {
      const row = Math.round((y + 40) / stepY);
      const offset =
        row % 2 === 0 ? -width * 0.6 : -width * 0.35;

      for (let x = offset; x < width * 1.3; x += stepX) {
        page.drawText(watermark, {
          x,
          y,
          size: watermarkSize,
          font: bold,
          color: rgb(0.35, 0.25, 0.18),
          rotate: degrees(32),
          opacity: 0.065
        });
      }
    }

    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height: 19,
      color: rgb(1, 1, 1),
      opacity: 0.86
    });

    const fittedFooter = fitText(
      regular,
      footer,
      Math.max(50, width - 22),
      7,
      4.5
    );
    page.drawText(fittedFooter.text, {
      x: 11,
      y: 6.25,
      size: fittedFooter.size,
      font: regular,
      color: rgb(0.21, 0.17, 0.14),
      opacity: 0.96
    });

    const pageCode = `${micro}${index + 1}`;
    page.drawText(pageCode, {
      x: 2,
      y: Math.max(22, height - 4),
      size: 1.8,
      font: regular,
      color: rgb(0.52, 0.48, 0.44),
      opacity: 0.035
    });
    page.drawText(pageCode, {
      x: Math.max(
        2,
        width - regular.widthOfTextAtSize(pageCode, 1.8) - 2
      ),
      y: 21,
      size: 1.8,
      font: regular,
      color: rgb(0.52, 0.48, 0.44),
      opacity: 0.035
    });
  }

  pdf.setTitle(title);
  pdf.setAuthor("Camila Martins Engenharia");
  pdf.setCreator("Camila Martins Engenharia - Portal do Cliente");
  pdf.setProducer(`Camila Martins Engenharia | ${issueCode}`);
  pdf.setSubject(
    `Copia licenciada: ${licensedTo} | Codigo: ${issueCode}`
  );
  pdf.setKeywords([
    "Camila Martins Engenharia",
    "documento licenciado",
    issueCode,
    `emitido-${date}`
  ]);
  pdf.setModificationDate(options.issuedAt);

  return pdf.save({
    addDefaultPage: false,
    objectsPerTick: 40,
    useObjectStreams: false,
    updateFieldAppearances: false
  });
}
