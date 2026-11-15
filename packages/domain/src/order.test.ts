import { describe, expect, it } from 'vitest'
import { calculateOrderTotal } from './order'

describe('calculateOrderTotal', () => {
  it('suma precio*cantidad en céntimos usando el precio del catálogo, no el del cliente', () => {
    const catalog = { a: { priceCents: 1999 }, b: { priceCents: 500 } }
    const total = calculateOrderTotal(
      [{ productId: 'a', quantity: 2 }, { productId: 'b', quantity: 1 }],
      catalog,
    )
    expect(total).toEqual({ ok: true, totalCents: 4498 })
  })

  it('rechaza productos que no existen en el catálogo', () => {
    expect(calculateOrderTotal([{ productId: 'x', quantity: 1 }], {})).toEqual({
      ok: false, error: 'UNKNOWN_PRODUCT', productId: 'x',
    })
  })

  it.each([0, -1, 1.5, Number.NaN])('rechaza cantidad inválida (%s)', (quantity) => {
    expect(calculateOrderTotal([{ productId: 'a', quantity }], { a: { priceCents: 100 } })).toEqual({
      ok: false, error: 'INVALID_QUANTITY', productId: 'a',
    })
  })

  it('rechaza un pedido vacío', () => {
    expect(calculateOrderTotal([], {})).toEqual({ ok: false, error: 'EMPTY_ORDER' })
  })
})
