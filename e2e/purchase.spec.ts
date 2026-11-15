import { expect, test } from '@playwright/test'

const SUPABASE_URL = process.env['SUPABASE_URL'] ?? 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = process.env['SERVICE_ROLE_KEY'] ?? ''
const WORKER_SECRET = process.env['ORDER_WORKER_SECRET'] ?? 'local-worker-secret'

/** En producción despierta al worker pg_net/pg_cron; en local lo hacemos nosotros. */
async function kickWorker(): Promise<void> {
  await fetch(`${SUPABASE_URL}/functions/v1/order-worker`, {
    method: 'POST',
    headers: { 'X-API-Key': WORKER_SECRET, 'Content-Type': 'application/json' },
    body: '{}',
  })
}

test('compra → factura firmada → seguimiento en el panel de flota', async ({ page, context, request }) => {
  // La app abre la factura con window.open: lo capturamos para inspeccionar la URL firmada.
  await page.addInitScript(() => {
    window.open = (url) => {
      ;(window as unknown as { __opened?: string }).__opened = String(url)
      return null
    }
  })

  // ---- Tienda: elegir producto y pagar ----
  await page.goto('/')
  await page.getByRole('button', { name: 'Añadir' }).first().click()
  await page.getByRole('button', { name: 'Carrito' }).click()
  await page.getByRole('button', { name: /Proceder al pago/ }).click()

  await expect(page.getByRole('heading', { name: 'Finalizar compra' })).toBeVisible()
  await page.getByLabel('Nombre completo').fill('Ada Lovelace')
  await page.getByLabel('Correo electrónico').fill('ada@example.com')
  await page.getByLabel('Dirección de envío').fill('Calle Mayor 1, 28001 Madrid')
  await page.getByRole('button', { name: /Confirmar Pedido/ }).click()

  // ---- El pedido aparece y el worker lo procesa ----
  await expect(page.getByRole('heading', { name: 'Mis Pedidos' })).toBeVisible()
  const orderCard = page.locator('.order-card').first()
  await expect(orderCard).toContainText('Ref:')

  await kickWorker()

  // ---- Factura: descarga con URL firmada ----
  const invoiceButton = orderCard.getByRole('button', { name: /Descargar Factura PDF/ })
  await expect(invoiceButton).toBeVisible({ timeout: 30_000 })

  await invoiceButton.click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __opened?: string }).__opened ?? '')).toContain(
    '/storage/v1/object/sign/invoices/',
  )
  const signedUrl = await page.evaluate(() => (window as unknown as { __opened?: string }).__opened ?? '')

  const pdf = await request.get(signedUrl)
  expect(pdf.ok()).toBe(true)
  expect(pdf.headers()['content-type']).toContain('application/pdf')

  // Sin firma, la factura no es accesible.
  const unsigned = await request.get(signedUrl.split('?')[0] ?? '')
  expect(unsigned.ok()).toBe(false)

  // ---- Seguimiento: el panel de flota arranca y envía telemetría ----
  const trackingHref = await orderCard.getByRole('link', { name: /Rastrear Envío/ }).getAttribute('href')
  expect(trackingHref).toContain('tracking_id=')
  const orderId = new URL(trackingHref ?? '').searchParams.get('tracking_id') ?? ''
  expect(orderId).toMatch(/^[0-9a-f-]{36}$/)

  const fleet = await context.newPage()
  await fleet.goto(trackingHref ?? '')
  await expect(fleet.getByText('Rastreo de Envío')).toBeVisible()
  await expect(fleet.getByText(`Pedido Ref: ${orderId.split('-')[0]?.toUpperCase()}`)).toBeVisible()
  await expect(fleet.getByText('En tránsito hacia Peligros')).toBeVisible({ timeout: 20_000 })

  // La telemetría del navegador llegó a la base de datos pasando por la Edge Function.
  await expect
    .poll(async () => {
      const res = await request.get(
        `${SUPABASE_URL}/rest/v1/telemetry?truck_id=eq.${orderId}&select=id`,
        { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
      )
      return ((await res.json()) as unknown[]).length
    })
    .toBeGreaterThan(0)

  // Estado final del pedido y pasos registrados (comprobación de servidor).
  const steps = await request.get(`${SUPABASE_URL}/rest/v1/order_event_steps?order_id=eq.${orderId}&select=step`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  })
  expect(((await steps.json()) as { step: string }[]).map((s) => s.step).sort()).toEqual(['email', 'invoice', 'shipment'])
})
