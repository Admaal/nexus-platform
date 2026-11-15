/** Cantidad máxima por línea: coincide con el límite que valida place_order en el servidor. */
export const MAX_LINE_QUANTITY = 100

interface Priced {
  readonly id: string
  readonly price: number
}

type Line<P extends Priced> = P & { quantity: number }

export function addToCart<P extends Priced>(items: readonly Line<P>[], product: P): Line<P>[] {
  const existing = items.find((line) => line.id === product.id)
  if (!existing) return [...items, { ...product, quantity: 1 }]

  return items.map((line) =>
    line.id === product.id ? { ...line, quantity: Math.min(line.quantity + 1, MAX_LINE_QUANTITY) } : line,
  )
}

/** Fija la cantidad de una línea. Valores no válidos (< 1 o no enteros) se ignoran. */
export function updateQuantity<L extends { id: string; quantity: number }>(
  items: readonly L[],
  id: string,
  quantity: number,
): L[] {
  if (!Number.isInteger(quantity) || quantity < 1) return [...items]
  const clamped = Math.min(quantity, MAX_LINE_QUANTITY)
  return items.map((line) => (line.id === id ? { ...line, quantity: clamped } : line))
}

export function removeFromCart<L extends { id: string }>(items: readonly L[], id: string): L[] {
  return items.filter((line) => line.id !== id)
}

export function cartItemCount(items: readonly { quantity: number }[]): number {
  return items.reduce((sum, line) => sum + line.quantity, 0)
}

/** Total en céntimos: evita los errores de coma flotante de sumar euros. */
export function cartTotalCents(items: readonly { price: number; quantity: number }[]): number {
  return items.reduce((sum, line) => sum + Math.round(line.price * 100) * line.quantity, 0)
}
