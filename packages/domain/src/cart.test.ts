import { describe, expect, it } from 'vitest'
import {
  addToCart,
  cartItemCount,
  cartTotalCents,
  MAX_LINE_QUANTITY,
  removeFromCart,
  updateQuantity,
} from './cart'

const keyboard = { id: 'k', name: 'Teclado', price: 189.5 }
const mouse = { id: 'm', name: 'Ratón', price: 95 }

describe('addToCart', () => {
  it('añade un producto nuevo con cantidad 1 conservando sus datos', () => {
    expect(addToCart([], keyboard)).toEqual([{ ...keyboard, quantity: 1 }])
  })

  it('incrementa la cantidad si el producto ya está', () => {
    const cart = addToCart(addToCart([], keyboard), keyboard)
    expect(cart).toEqual([{ ...keyboard, quantity: 2 }])
  })

  it('mantiene el orden y no toca las demás líneas', () => {
    const cart = addToCart(addToCart(addToCart([], keyboard), mouse), keyboard)
    expect(cart.map((l) => [l.id, l.quantity])).toEqual([['k', 2], ['m', 1]])
  })

  it('no supera la cantidad máxima por línea', () => {
    const full = [{ ...keyboard, quantity: MAX_LINE_QUANTITY }]
    expect(addToCart(full, keyboard)).toEqual(full)
  })

  it('no muta el carrito original', () => {
    const original = [{ ...keyboard, quantity: 1 }]
    addToCart(original, keyboard)
    expect(original).toEqual([{ ...keyboard, quantity: 1 }])
  })
})

describe('updateQuantity', () => {
  const cart = [{ ...keyboard, quantity: 2 }, { ...mouse, quantity: 1 }]

  it('fija la cantidad de la línea indicada', () => {
    expect(updateQuantity(cart, 'm', 5).map((l) => l.quantity)).toEqual([2, 5])
  })

  it('acepta los límites válidos: 1 y el máximo', () => {
    expect(updateQuantity(cart, 'k', 1)[0]?.quantity).toBe(1)
    expect(updateQuantity(cart, 'k', MAX_LINE_QUANTITY)[0]?.quantity).toBe(MAX_LINE_QUANTITY)
  })

  it('ignora cantidades menores que 1 (la línea se elimina con removeFromCart)', () => {
    expect(updateQuantity(cart, 'k', 0)).toEqual(cart)
    expect(updateQuantity(cart, 'k', -3)).toEqual(cart)
  })

  it('ignora cantidades no enteras', () => {
    expect(updateQuantity(cart, 'k', 1.5)).toEqual(cart)
  })

  it('limita la cantidad al máximo por línea', () => {
    expect(updateQuantity(cart, 'k', 5000)[0]?.quantity).toBe(MAX_LINE_QUANTITY)
  })

  it('no cambia nada si el id no existe', () => {
    expect(updateQuantity(cart, 'zzz', 3)).toEqual(cart)
  })
})

describe('removeFromCart', () => {
  it('elimina solo la línea indicada', () => {
    const cart = [{ ...keyboard, quantity: 2 }, { ...mouse, quantity: 1 }]
    expect(removeFromCart(cart, 'k')).toEqual([{ ...mouse, quantity: 1 }])
  })
})

describe('totales', () => {
  it('cuenta unidades, no líneas', () => {
    expect(cartItemCount([{ quantity: 2 }, { quantity: 3 }])).toBe(5)
    expect(cartItemCount([])).toBe(0)
  })

  it('suma en céntimos sin errores de coma flotante', () => {
    // 0.1 + 0.2 en flotante es 0.30000000000000004
    expect(cartTotalCents([{ price: 0.1, quantity: 1 }, { price: 0.2, quantity: 1 }])).toBe(30)
    expect(cartTotalCents([{ price: 189.5, quantity: 2 }, { price: 95, quantity: 1 }])).toBe(47400)
    expect(cartTotalCents([])).toBe(0)
  })
})
