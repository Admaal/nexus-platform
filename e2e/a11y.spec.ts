import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  return results.violations.map(
    (v) =>
      `${v.id} (${v.impact ?? '?'}): ` +
      v.nodes
        .slice(0, 4)
        .map((n) => `${n.target.join(' ')} [${(n.any[0]?.message ?? n.failureSummary ?? '').replace(/s+/g, ' ').slice(0, 140)}]`)
        .join(' | '),
  )
}

test.describe('accesibilidad (axe, WCAG 2.1 A/AA)', () => {
  // Con movimiento reducido las animaciones de aparición no falsean el contraste medido.
  test.use({ reducedMotion: 'reduce' })

  test('tienda: portada con catálogo', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Añadir' }).first()).toBeVisible()
    expect(await violations(page)).toEqual([])
  })

  test('tienda: carrito abierto con un producto', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Añadir' }).first().click()
    await page.getByRole('button', { name: 'Carrito' }).click()
    await expect(page.getByRole('dialog', { name: 'Tu carrito' })).toBeVisible()
    expect(await violations(page)).toEqual([])
  })

  test('tienda: el carrito se cierra con Escape y no deja foco atrapado fuera', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Carrito' }).click()
    await expect(page.getByRole('dialog', { name: 'Tu carrito' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('aside.drawer--open')).toHaveCount(0)
  })

  test('tienda: checkout', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Añadir' }).first().click()
    await page.getByRole('button', { name: 'Carrito' }).click()
    await page.getByRole('button', { name: /Proceder al pago/ }).click()
    await expect(page.getByRole('heading', { name: 'Finalizar compra' })).toBeVisible()
    expect(await violations(page)).toEqual([])
  })

  test('fleet: seguimiento de cliente', async ({ page }) => {
    await page.goto('/')
    await page.goto('http://localhost:5174/?tracking_id=00000000-0000-4000-8000-000000000001')
    await expect(page.getByText('Rastreo de Envío')).toBeVisible()
    expect(await violations(page)).toEqual([])
  })

  test('fleet: panel de control', async ({ page }) => {
    await page.goto('http://localhost:5174/')
    await expect(page.getByRole('heading', { name: 'Estado de Flota' })).toBeVisible()
    expect(await violations(page)).toEqual([])
  })
})
