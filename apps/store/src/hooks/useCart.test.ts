import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CART_KEY, useCart } from "./useCart";
import type { Product } from "../types";

const keyboard: Product = { id: "k", name: "Teclado", price: 189.5, description: null };
const mouse: Product = { id: "m", name: "Ratón", price: 95, description: null };

describe("useCart", () => {
  it("empieza vacío", () => {
    const { result } = renderHook(() => useCart());
    expect(result.current.items).toEqual([]);
    expect(result.current.itemCount).toBe(0);
    expect(result.current.total).toBe(0);
  });

  it("acumula cantidades y calcula total y número de unidades", () => {
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.addItem(keyboard);
      result.current.addItem(keyboard);
      result.current.addItem(mouse);
    });

    expect(result.current.itemCount).toBe(3);
    expect(result.current.total).toBe(474);
    expect(result.current.items.map((i) => [i.id, i.quantity])).toEqual([["k", 2], ["m", 1]]);
  });

  it("cambia cantidades, ignora valores no válidos y elimina líneas", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addItem(keyboard));

    act(() => result.current.updateQuantity("k", 4));
    expect(result.current.itemCount).toBe(4);

    act(() => result.current.updateQuantity("k", 0));
    expect(result.current.itemCount).toBe(4);

    act(() => result.current.removeItem("k"));
    expect(result.current.items).toEqual([]);
  });

  it("persiste el carrito en localStorage y lo recupera al montar", () => {
    const first = renderHook(() => useCart());
    act(() => first.result.current.addItem(mouse));
    expect(JSON.parse(localStorage.getItem(CART_KEY) ?? "[]")).toHaveLength(1);
    first.unmount();

    const second = renderHook(() => useCart());
    expect(second.result.current.items[0]?.id).toBe("m");
  });

  it("ignora un carrito guardado corrupto o con forma inesperada", () => {
    localStorage.setItem(CART_KEY, "{no es json");
    expect(renderHook(() => useCart()).result.current.items).toEqual([]);

    localStorage.setItem(CART_KEY, JSON.stringify({ items: "inyectado" }));
    expect(renderHook(() => useCart()).result.current.items).toEqual([]);
  });

  it("vacía el carrito", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addItem(keyboard));
    act(() => result.current.clearCart());
    expect(result.current.items).toEqual([]);
  });
});
