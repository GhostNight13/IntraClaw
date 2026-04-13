// src/tools/document-generator.ts
// Document generation tools — PPT, Word, PDF, CSV, JSON, HTML
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

const OUTPUT_DIR = path.resolve(process.cwd(), 'data', 'generated');

function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').replace(/\s+/g, '-').substring(0, 100);
}

// ─── PowerPoint ──────────────────────────────────────────────────────────────

export async function createPPT(params: {
  title: string;
  slides: Array<{
    title: string;
    content: string;       // Bullet points separated by \n
    notes?: string;
  }>;
  filename?: string;
}): Promise<{ success: boolean; filePath: string }> {
  ensureOutputDir();

  try {
    const PptxGenJS = (await import('pptxgenjs')).default;
    const pptx = new PptxGenJS();

    pptx.title = params.title;
    pptx.author = 'IntraClaw';

    // Title slide
    const titleSlide = pptx.addSlide();
    titleSlide.addText(params.title, {
      x: 0.5, y: 1.5, w: 9, h: 2,
      fontSize: 36, bold: true, color: '1a1a2e',
      align: 'center', valign: 'middle',
    });
    titleSlide.addText('Généré par IntraClaw', {
      x: 0.5, y: 4, w: 9, h: 0.5,
      fontSize: 14, color: '666666', align: 'center',
    });

    // Content slides
    for (const slide of params.slides) {
      const s = pptx.addSlide();
      s.addText(slide.title, {
        x: 0.5, y: 0.3, w: 9, h: 0.8,
        fontSize: 24, bold: true, color: '1a1a2e',
      });

      const bullets = slide.content.split('\n').filter(Boolean);
      s.addText(
        bullets.map(b => ({
          text: b.trim(),
          options: { bullet: true, fontSize: 16, color: '333333' } as const,
        })),
        { x: 0.8, y: 1.5, w: 8.2, h: 4, lineSpacing: 28 }
      );

      if (slide.notes) {
        s.addNotes(slide.notes);
      }
    }

    const filename = params.filename ?? `${sanitizeFilename(params.title)}.pptx`;
    const filePath = path.join(OUTPUT_DIR, filename);
    await pptx.writeFile({ fileName: filePath });

    logger.info('DocGenerator', `PPT created: ${filePath} (${params.slides.length} slides)`);
    return { success: true, filePath };
  } catch (err) {
    logger.error('DocGenerator', 'PPT creation failed', err instanceof Error ? err.message : String(err));
    return { success: false, filePath: '' };
  }
}

// ─── Word Document ───────────────────────────────────────────────────────────

export async function createWord(params: {
  title: string;
  sections: Array<{
    heading: string;
    content: string;
  }>;
  filename?: string;
}): Promise<{ success: boolean; filePath: string }> {
  ensureOutputDir();

  try {
    const docx = await import('docx');
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;

    const children: InstanceType<typeof Paragraph>[] = [];

    // Title
    children.push(new Paragraph({
      text: params.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }));

    // Sections
    for (const section of params.sections) {
      children.push(new Paragraph({
        text: section.heading,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 },
      }));

      for (const para of section.content.split('\n').filter(Boolean)) {
        children.push(new Paragraph({
          children: [new TextRun({ text: para.trim(), size: 24 })],
          spacing: { after: 120 },
        }));
      }
    }

    const doc = new Document({
      sections: [{ children }],
      creator: 'IntraClaw',
      title: params.title,
    });

    const buffer = await Packer.toBuffer(doc);
    const filename = params.filename ?? `${sanitizeFilename(params.title)}.docx`;
    const filePath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filePath, buffer);

    logger.info('DocGenerator', `Word created: ${filePath} (${params.sections.length} sections)`);
    return { success: true, filePath };
  } catch (err) {
    logger.error('DocGenerator', 'Word creation failed', err instanceof Error ? err.message : String(err));
    return { success: false, filePath: '' };
  }
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

export async function createPDF(params: {
  title: string;
  content: string;         // Plain text or markdown-like content
  filename?: string;
}): Promise<{ success: boolean; filePath: string }> {
  ensureOutputDir();

  try {
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 595;   // A4
    const pageHeight = 842;
    const margin = 50;
    const lineHeight = 18;
    const maxWidth = pageWidth - 2 * margin;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    // Title
    page.drawText(params.title, {
      x: margin, y: y - 30,
      size: 24, font: boldFont, color: rgb(0.1, 0.1, 0.18),
    });
    y -= 60;

    // Content
    const lines = params.content.split('\n');
    for (const line of lines) {
      if (y < margin + lineHeight) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }

      const isHeading = line.startsWith('#');
      const text = line.replace(/^#+\s*/, '').trim();
      if (!text) { y -= lineHeight; continue; }

      // Simple word wrap
      const words = text.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const activeFont = isHeading ? boldFont : font;
        const width = activeFont.widthOfTextAtSize(testLine, isHeading ? 16 : 11);

        if (width > maxWidth && currentLine) {
          page.drawText(currentLine, {
            x: margin, y,
            size: isHeading ? 16 : 11,
            font: activeFont,
            color: rgb(0.1, 0.1, 0.1),
          });
          y -= lineHeight;
          currentLine = word;

          if (y < margin + lineHeight) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            y = pageHeight - margin;
          }
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        page.drawText(currentLine, {
          x: margin, y,
          size: isHeading ? 16 : 11,
          font: isHeading ? boldFont : font,
          color: rgb(0.1, 0.1, 0.1),
        });
        y -= isHeading ? lineHeight * 1.5 : lineHeight;
      }
    }

    const pdfBytes = await pdfDoc.save();
    const filename = params.filename ?? `${sanitizeFilename(params.title)}.pdf`;
    const filePath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filePath, pdfBytes);

    logger.info('DocGenerator', `PDF created: ${filePath} (${pdfDoc.getPageCount()} pages)`);
    return { success: true, filePath };
  } catch (err) {
    logger.error('DocGenerator', 'PDF creation failed', err instanceof Error ? err.message : String(err));
    return { success: false, filePath: '' };
  }
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

export function createCSV(params: {
  headers: string[];
  rows: string[][];
  filename?: string;
}): { success: boolean; filePath: string } {
  ensureOutputDir();

  try {
    const csv = [
      params.headers.join(','),
      ...params.rows.map(row =>
        row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const filename = params.filename ?? `export-${Date.now()}.csv`;
    const filePath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filePath, csv, 'utf8');

    logger.info('DocGenerator', `CSV created: ${filePath} (${params.rows.length} rows)`);
    return { success: true, filePath };
  } catch (err) {
    logger.error('DocGenerator', 'CSV creation failed', err instanceof Error ? err.message : String(err));
    return { success: false, filePath: '' };
  }
}

// ─── JSON export ─────────────────────────────────────────────────────────────

export function createJSON(data: unknown, filename?: string): { success: boolean; filePath: string } {
  ensureOutputDir();

  try {
    const name = filename ?? `data-${Date.now()}.json`;
    const filePath = path.join(OUTPUT_DIR, name);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');

    logger.info('DocGenerator', `JSON created: ${filePath}`);
    return { success: true, filePath };
  } catch (err) {
    logger.error('DocGenerator', 'JSON creation failed', err instanceof Error ? err.message : String(err));
    return { success: false, filePath: '' };
  }
}

// ─── HTML (can be opened in browser or converted) ────────────────────────────

export function createHTML(params: {
  title: string;
  body: string;            // HTML content
  styles?: string;         // Custom CSS
  filename?: string;
}): { success: boolean; filePath: string } {
  ensureOutputDir();

  try {
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; color: #1a1a2e; }
    h1 { font-size: 2rem; border-bottom: 2px solid #e0e0e0; padding-bottom: 0.5rem; }
    h2 { font-size: 1.4rem; color: #16213e; margin-top: 2rem; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f5f5f5; }
    ${params.styles ?? ''}
  </style>
</head>
<body>
  <h1>${params.title}</h1>
  ${params.body}
  <footer style="margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #eee; color: #999; font-size: 0.8rem;">
    Généré par IntraClaw — ${new Date().toLocaleDateString('fr-BE')}
  </footer>
</body>
</html>`;

    const filename = params.filename ?? `${sanitizeFilename(params.title)}.html`;
    const filePath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filePath, html, 'utf8');

    logger.info('DocGenerator', `HTML created: ${filePath}`);
    return { success: true, filePath };
  } catch (err) {
    logger.error('DocGenerator', 'HTML creation failed', err instanceof Error ? err.message : String(err));
    return { success: false, filePath: '' };
  }
}
