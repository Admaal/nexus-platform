import { PDFDocument, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";
import { classifyHttpStatus, type ErrorClass } from "../../../packages/domain/src/events.ts";

/** Error de un paso con su clasificación (transitorio = reintentar, permanente = DLQ). */
export class StepError extends Error {
  readonly errorClass: ErrorClass;

  constructor(message: string, errorClass: ErrorClass) {
    super(message);
    this.name = "StepError";
    this.errorClass = errorClass;
  }
}

export function errorFromStatus(context: string, status: number, detail = ""): StepError {
  return new StepError(`${context}: HTTP ${status} ${detail}`.trim(), classifyHttpStatus(status));
}

export interface OrderItem {
  name: string;
  price: number;
  quantity: number;
}

export interface OrderRecord {
  id: string;
  user_id: string;
  status: string;
  total: number;
  items: OrderItem[];
  customer_name: string | null;
  customer_email: string;
  shipping_address: string | null;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function shortRef(orderId: string): string {
  return (orderId.split("-")[0] ?? orderId).toUpperCase();
}

// ---------- PDF ----------
export async function renderInvoicePdf(order: OrderRecord): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([595.28, 841.89]);
  const { height } = page.getSize();

  page.drawText("NEXUS COMMERCE", { x: 50, y: height - 60, size: 24, font: bold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText("FACTURA OFICIAL", { x: 50, y: height - 85, size: 12, font, color: rgb(0.4, 0.4, 0.4) });

  page.drawText(`Ref Pedido: ${shortRef(order.id)}`, { x: 50, y: height - 130, size: 10, font: bold });
  page.drawText(`Fecha: ${new Date().toLocaleDateString("es-ES")}`, { x: 50, y: height - 145, size: 10, font });

  page.drawText("FACTURAR A:", { x: 350, y: height - 130, size: 10, font: bold });
  page.drawText(order.customer_name || "Cliente Contado", { x: 350, y: height - 145, size: 10, font });
  page.drawText(order.customer_email || "N/A", { x: 350, y: height - 160, size: 10, font });
  page.drawText(order.shipping_address || "N/A", { x: 350, y: height - 175, size: 10, font });

  let y = height - 230;
  page.drawRectangle({ x: 50, y: y - 5, width: 495, height: 20, color: rgb(0.95, 0.95, 0.95) });
  page.drawText("CANT.", { x: 60, y, size: 9, font: bold });
  page.drawText("CONCEPTO", { x: 120, y, size: 9, font: bold });
  page.drawText("PRECIO", { x: 420, y, size: 9, font: bold });
  page.drawText("TOTAL", { x: 490, y, size: 9, font: bold });
  y -= 30;

  for (const item of order.items) {
    const lineTotal = (item.quantity * item.price).toFixed(2);
    page.drawText(`${item.quantity}`, { x: 65, y, size: 10, font });
    page.drawText(String(item.name).substring(0, 40), { x: 120, y, size: 10, font });
    page.drawText(`${item.price} €`, { x: 420, y, size: 10, font });
    page.drawText(`${lineTotal} €`, { x: 490, y, size: 10, font });
    y -= 25;
  }

  y -= 20;
  page.drawLine({ start: { x: 350, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 25;
  page.drawText("TOTAL A PAGAR:", { x: 350, y, size: 12, font: bold });
  page.drawText(`${Number(order.total).toFixed(2)} €`, {
    x: 480, y, size: 14, font: bold, color: rgb(0.1, 0.5, 0.9),
  });

  return await pdfDoc.save();
}

// ---------- Email ----------
export interface Mailer {
  send(to: string, subject: string, html: string): Promise<void>;
}

export function createMailer(env: (key: string) => string | undefined): Mailer {
  const provider = env("EMAIL_PROVIDER") ?? "brevo";

  if (provider === "log") {
    // Desarrollo local: no envía nada, solo deja constancia (sin el destinatario).
    return { send: (_to, subject) => { console.log(JSON.stringify({ level: "info", msg: "email.log", subject })); return Promise.resolve(); } };
  }

  const apiKey = env("BREVO_API_KEY") ?? "";
  const senderEmail = env("SENDER_EMAIL") ?? "";

  return {
    async send(to, subject, html) {
      if (!apiKey || !senderEmail) {
        throw new StepError("Brevo sin configurar (BREVO_API_KEY/SENDER_EMAIL)", "permanent");
      }

      let res: Response;
      try {
        res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { accept: "application/json", "api-key": apiKey, "content-type": "application/json" },
          body: JSON.stringify({
            sender: { name: "Nexus Commerce", email: senderEmail },
            to: [{ email: to }],
            subject,
            htmlContent: html,
          }),
        });
      } catch (error) {
        throw new StepError(`Brevo inalcanzable: ${error instanceof Error ? error.message : String(error)}`, "transient");
      }

      if (!res.ok) throw errorFromStatus("Brevo", res.status, (await res.text()).slice(0, 200));
    },
  };
}

export function buildOrderEmail(order: OrderRecord, invoiceUrl: string, trackingLink: string): string {
  const itemsHtml = order.items
    .map((i) => `<li>${escapeHtml(i.quantity)}x ${escapeHtml(i.name)} - ${escapeHtml(i.price)}€</li>`)
    .join("");

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #1A1A1A;">¡Gracias por tu pedido, ${escapeHtml(order.customer_name || "cliente")}!</h2>
      <p>Tu pedido ha sido procesado correctamente y hemos generado tu factura oficial.</p>
      <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Resumen:</h3>
        <ul style="padding-left: 20px;">${itemsHtml}</ul>
        <h3 style="border-top: 1px solid #ddd; padding-top: 15px;">Total: ${Number(order.total).toFixed(2)}€</h3>
      </div>
      <a href="${escapeHtml(invoiceUrl)}" style="background-color: #1A1A1A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; margin-bottom: 15px;">Descargar Factura PDF</a>
      <br />
      <a href="${escapeHtml(trackingLink)}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Rastrear tu envío en tiempo real</a>
    </div>
  `;
}
