import { describe, expect, it } from "vitest"
import { orderRef } from "./orderRef"

describe("orderRef", () => {
  it("devuelve el primer bloque del UUID en mayúsculas", () => {
    expect(orderRef("3f2a9c1e-1111-2222-3333-444455556666")).toBe("3F2A9C1E")
  })

  it("devuelve el id completo en mayúsculas si no hay guiones", () => {
    expect(orderRef("abc")).toBe("ABC")
  })
})
