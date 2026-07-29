/// <reference path="./edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1"

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const brevoApiKey = Deno.env.get("BREVO_API_KEY") ?? "";
const fleetTrackingUrl = (Deno.env.get("FLEET_TRACKING_URL") ?? "http://localhost:5174").replace(/\/$/, "");
const senderEmail = Deno.env.get("SENDER_EMAIL") ?? "";
const processOrderSecret = Deno.env.get("PROCESS_ORDER_SECRET") ?? "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isAuthorized(req: Request): boolean {
  if (!processOrderSecret) return false;
  return req.headers.get("X-API-Key") === processOrderSecret;
}

async function sendOrderEmail(to: string, subject: string, htmlContent: string): Promise<void> {
  if (!brevoApiKey) {
    throw new Error("BREVO_API_KEY not configured");
  }

  if (!senderEmail) {
    throw new Error("SENDER_EMAIL not configured");
  }

  const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": brevoApiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Nexus Commerce", email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });

  if (!emailRes.ok) {
    const errorText = await emailRes.text();
    throw new Error(`Brevo API Error: ${errorText}`);
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  if (!isAuthorized(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const payload = await req.json();
    let order = payload.record;

    if (!order?.id && payload.order_id) {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", payload.order_id)
        .single();
      if (error || !data) {
        return jsonResponse({ error: "Pedido no encontrado" }, 404);
      }
      order = data;
    }

    if (!order?.id) {
      return jsonResponse({ error: "Falta order_id o record en el body" }, 400);
    }

    const { data: existing } = await supabase
      .from("orders")
      .select("status, invoice_url")
      .eq("id", order.id)
      .single();

    if (existing?.status === "COMPLETED" && existing.invoice_url) {
      return jsonResponse({
        success: true,
        alreadyCompleted: true,
        emailSent: true,
        invoiceUrl: existing.invoice_url,
      });
    }

    console.log(`Iniciando proceso para pedido: ${order.id}`);

    const items = order.items || [];
    const orderTotal = order.total || 0;

    // 1. GENERAR PDF
    const pdfDoc = await PDFDocument.create();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const page = pdfDoc.addPage([595.28, 841.89]);
    const { height } = page.getSize();

    page.drawText(`NEXUS COMMERCE`, { x: 50, y: height - 60, size: 24, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(`FACTURA OFICIAL`, { x: 50, y: height - 85, size: 12, font: helveticaFont, color: rgb(0.4, 0.4, 0.4) });

    page.drawText(`Ref Pedido: ${order.id.split('-')[0].toUpperCase()}`, { x: 50, y: height - 130, size: 10, font: helveticaBold });
    page.drawText(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, { x: 50, y: height - 145, size: 10, font: helveticaFont });

    page.drawText(`FACTURAR A:`, { x: 350, y: height - 130, size: 10, font: helveticaBold });
    page.drawText(order.customer_name || "Cliente Contado", { x: 350, y: height - 145, size: 10, font: helveticaFont });
    page.drawText(order.customer_email || "N/A", { x: 350, y: height - 160, size: 10, font: helveticaFont });
    page.drawText(order.shipping_address || "N/A", { x: 350, y: height - 175, size: 10, font: helveticaFont });

    let currentY = height - 230;
    page.drawRectangle({ x: 50, y: currentY - 5, width: 495, height: 20, color: rgb(0.95, 0.95, 0.95) });
    page.drawText(`CANT.`, { x: 60, y: currentY, size: 9, font: helveticaBold });
    page.drawText(`CONCEPTO`, { x: 120, y: currentY, size: 9, font: helveticaBold });
    page.drawText(`PRECIO`, { x: 420, y: currentY, size: 9, font: helveticaBold });
    page.drawText(`TOTAL`, { x: 490, y: currentY, size: 9, font: helveticaBold });

    currentY -= 30;

    for (const item of items) {
      const lineTotal = (item.quantity * item.price).toFixed(2);
      page.drawText(`${item.quantity}`, { x: 65, y: currentY, size: 10, font: helveticaFont });
      page.drawText(String(item.name).substring(0, 40), { x: 120, y: currentY, size: 10, font: helveticaFont });
      page.drawText(`${item.price} €`, { x: 420, y: currentY, size: 10, font: helveticaFont });
      page.drawText(`${lineTotal} €`, { x: 490, y: currentY, size: 10, font: helveticaFont });
      currentY -= 25;
    }

    currentY -= 20;
    page.drawLine({ start: { x: 350, y: currentY }, end: { x: 545, y: currentY }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
    currentY -= 25;

    page.drawText(`TOTAL A PAGAR:`, { x: 350, y: currentY, size: 12, font: helveticaBold });
    page.drawText(`${orderTotal.toFixed(2)} €`, { x: 480, y: currentY, size: 14, font: helveticaBold, color: rgb(0.1, 0.5, 0.9) });

    const pdfBytes = await pdfDoc.save();

    // 2. SUBIR PDF
    const fileName = `factura_${order.id}.pdf`;
    await supabase.storage.from('invoices').upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true });
    const { data: { publicUrl } } = supabase.storage.from('invoices').getPublicUrl(fileName);

    // 3. Marcar envío en tránsito (shipment ya creado por trigger)
    await supabase
      .from('shipments')
      .update({ status: 'IN_TRANSIT' })
      .eq('order_id', order.id);

    // 4. ENVIAR EMAIL
    const trackingLink = `${fleetTrackingUrl}/?tracking_id=${order.id}`;
    const itemsHtml = items.map((i: { quantity: number; name: string; price: number }) =>
      `<li>${i.quantity}x ${i.name} - ${i.price}€</li>`
    ).join("");

    let emailSent = false;
    let emailError: string | null = null;

    try {
      await sendOrderEmail(
        order.customer_email,
        `Factura de tu pedido #${order.id.split("-")[0].toUpperCase()}`,
        `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #1A1A1A;">¡Gracias por tu pedido, ${order.customer_name || "cliente"}!</h2>
            <p>Tu pedido ha sido procesado correctamente y hemos generado tu factura oficial.</p>

            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Resumen:</h3>
              <ul style="padding-left: 20px;">
                ${itemsHtml}
              </ul>
              <h3 style="border-top: 1px solid #ddd; padding-top: 15px;">Total: ${orderTotal.toFixed(2)}€</h3>
            </div>

            <a href="${publicUrl}" style="background-color: #1A1A1A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; margin-bottom: 15px;">Descargar Factura PDF</a>
            <br />
            <a href="${trackingLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Rastrear tu envío en tiempo real</a>
          </div>
        `,
      );
      emailSent = true;
    } catch (error) {
      emailError = error instanceof Error ? error.message : String(error);
      console.error("Email no enviado:", emailError);
    }

    // 5. ACTUALIZAR ESTADO (aunque falle el email)
    await supabase.from('orders').update({ status: 'COMPLETED', invoice_url: publicUrl }).eq('id', order.id);

    return jsonResponse({
      success: true,
      emailSent,
      ...(emailError ? { emailError } : {}),
      invoiceUrl: publicUrl,
      trackingLink,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error crítico en process-order:", message);
    return jsonResponse({ error: message }, 500);
  }
});
