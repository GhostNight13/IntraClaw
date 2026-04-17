/**
 * Generic Skill: Invoice Creator
 * Generates a PDF invoice from client + items, then emails it via Gmail.
 */
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import { GenericSkill, SkillContext, SkillResult } from '../types';
import { sendEmail } from '../../tools/gmail';
import { logger } from '../../utils/logger';

interface InvoiceItem {
  description: string;
  quantity:    number;
  unitPrice:   number;          // EUR
}

interface InvoiceCreatorConfig {
  companyName?:    string;
  companyAddress?: string;
  vatNumber?:      string;
  iban?:           string;
  currency?:       string;       // default 'EUR'
  vatRate?:        number;       // e.g. 0.21
  invoicePrefix?:  string;       // e.g. 'INV-'
}

interface InvoiceCreatorInput {
  clientName:    string;
  clientEmail:   string;
  clientAddress?: string;
  items:         InvoiceItem[];
  invoiceNumber?: string;
  notes?:        string;
  sendEmail?:    boolean;        // default true
}

function formatCurrency(amount: number, currency = 'EUR'): string {
  return `${amount.toFixed(2)} ${currency}`;
}

async function buildInvoicePdf(args: {
  cfg: InvoiceCreatorConfig;
  input: InvoiceCreatorInput;
  invoiceNumber: string;
  outPath: string;
}): Promise<{ subtotal: number; vat: number; total: number }> {
  const { cfg, input, invoiceNumber, outPath } = args;
  const currency = cfg.currency ?? 'EUR';
  const vatRate  = cfg.vatRate  ?? 0;

  const subtotal = input.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const vat      = subtotal * vatRate;
  const total    = subtotal + vat;

  return new Promise((resolve, reject) => {
    try {
      const doc    = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(outPath);
      doc.pipe(stream);

      // Header
      doc.fontSize(20).text('INVOICE', { align: 'right' });
      doc.fontSize(10).text(`# ${invoiceNumber}`, { align: 'right' });
      doc.text(new Date().toISOString().slice(0, 10), { align: 'right' });
      doc.moveDown();

      // From
      doc.fontSize(12).text(cfg.companyName ?? 'Your Company');
      if (cfg.companyAddress) doc.fontSize(9).text(cfg.companyAddress);
      if (cfg.vatNumber)      doc.text(`VAT: ${cfg.vatNumber}`);
      doc.moveDown();

      // To
      doc.fontSize(11).text('Bill to:');
      doc.fontSize(10).text(input.clientName);
      if (input.clientAddress) doc.text(input.clientAddress);
      doc.text(input.clientEmail);
      doc.moveDown();

      // Items table
      doc.fontSize(11).text('Description', 50, doc.y, { continued: true });
      doc.text('Qty', 320, doc.y, { continued: true, width: 50, align: 'right' });
      doc.text('Unit', 380, doc.y, { continued: true, width: 70, align: 'right' });
      doc.text('Total', 460, doc.y, { width: 90, align: 'right' });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);

      for (const it of input.items) {
        const line = it.quantity * it.unitPrice;
        const y = doc.y;
        doc.fontSize(10).text(it.description, 50, y, { width: 260 });
        doc.text(String(it.quantity), 320, y, { width: 50, align: 'right' });
        doc.text(formatCurrency(it.unitPrice, currency), 380, y, { width: 70, align: 'right' });
        doc.text(formatCurrency(line, currency), 460, y, { width: 90, align: 'right' });
        doc.moveDown(0.3);
      }

      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);

      doc.fontSize(10).text(`Subtotal: ${formatCurrency(subtotal, currency)}`, { align: 'right' });
      if (vatRate > 0) {
        doc.text(`VAT (${(vatRate * 100).toFixed(0)}%): ${formatCurrency(vat, currency)}`, { align: 'right' });
      }
      doc.fontSize(13).text(`TOTAL: ${formatCurrency(total, currency)}`, { align: 'right' });

      if (cfg.iban) {
        doc.moveDown(2).fontSize(9).text(`Payment IBAN: ${cfg.iban}`);
      }
      if (input.notes) {
        doc.moveDown().fontSize(9).text(input.notes);
      }

      doc.end();
      stream.on('finish', () => resolve({ subtotal, vat, total }));
      stream.on('error', reject);
    } catch (e) {
      reject(e);
    }
  });
}

export const invoiceCreator: GenericSkill = {
  id:          'invoice-creator',
  name:        'Invoice Creator',
  description: 'Generates a professional PDF invoice from a client and line items, then emails it.',
  icon:        'FileText',
  tier:        'pro',
  requires:    ['gmail'],

  async execute(ctx: SkillContext, input: Record<string, unknown>): Promise<SkillResult> {
    const cfg = ctx.config as InvoiceCreatorConfig;
    const data = input as unknown as InvoiceCreatorInput;

    if (!data.clientName || !data.clientEmail || !Array.isArray(data.items) || data.items.length === 0) {
      return { ok: false, error: 'Missing input: clientName, clientEmail, items[]' };
    }

    try {
      const prefix        = cfg.invoicePrefix ?? 'INV-';
      const invoiceNumber = data.invoiceNumber ?? `${prefix}${Date.now()}`;
      const outDir        = path.join(process.cwd(), 'data', 'invoices');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const outPath       = path.join(outDir, `${invoiceNumber}.pdf`);

      const totals = await buildInvoicePdf({ cfg, input: data, invoiceNumber, outPath });

      let emailed = false;
      const shouldSend = data.sendEmail !== false;
      if (shouldSend) {
        const html = `
          <p>Hi ${data.clientName},</p>
          <p>Please find attached invoice <strong>${invoiceNumber}</strong>
          for ${formatCurrency(totals.total, cfg.currency ?? 'EUR')}.</p>
          <p>Thanks,<br>${cfg.companyName ?? ''}</p>
        `;
        // Note: current sendEmail does not support attachments — we send a link/notice instead.
        await sendEmail(
          data.clientEmail,
          `Invoice ${invoiceNumber}`,
          `${html}<p style="color:#888;font-size:11px;">PDF available at: ${outPath}</p>`,
        );
        emailed = true;
      }

      return {
        ok: true,
        message: `Invoice ${invoiceNumber} created (${formatCurrency(totals.total, cfg.currency ?? 'EUR')}).`,
        data: { invoiceNumber, pdfPath: outPath, ...totals, emailed },
      };
    } catch (err) {
      logger.error('Skill:invoice-creator', err instanceof Error ? err.message : String(err));
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
