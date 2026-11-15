export interface CatalogEntry {
  readonly priceCents: number
}

export type Catalog = Readonly<Record<string, CatalogEntry>>

export interface OrderLineInput {
  readonly productId: string
  readonly quantity: number
}

export type OrderTotalResult =
  | { readonly ok: true; readonly totalCents: number }
  | { readonly ok: false; readonly error: 'EMPTY_ORDER' }
  | { readonly ok: false; readonly error: 'UNKNOWN_PRODUCT' | 'INVALID_QUANTITY'; readonly productId: string }

/** El total se calcula siempre con los precios del catálogo: el cliente no decide el precio. */
export function calculateOrderTotal(lines: readonly OrderLineInput[], catalog: Catalog): OrderTotalResult {
  if (lines.length === 0) return { ok: false, error: 'EMPTY_ORDER' }

  let totalCents = 0
  for (const { productId, quantity } of lines) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { ok: false, error: 'INVALID_QUANTITY', productId }
    }
    const entry = Object.hasOwn(catalog, productId) ? catalog[productId] : undefined
    if (!entry) return { ok: false, error: 'UNKNOWN_PRODUCT', productId }
    totalCents += entry.priceCents * quantity
  }
  return { ok: true, totalCents }
}
