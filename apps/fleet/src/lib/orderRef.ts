/** Referencia corta y legible de un pedido: primer bloque del UUID en mayúsculas. */
export function orderRef(id: string): string {
  return (id.split("-")[0] ?? id).toUpperCase();
}
