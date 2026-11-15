import { useCallback, useEffect, useState } from "react";
import {
  addToCart,
  cartItemCount,
  cartTotalCents,
  removeFromCart,
  updateQuantity as setLineQuantity,
} from "@nexus/domain";
import type { CartItem, Product } from "../types";

export const CART_KEY = "nexus_cart";

function loadCart(): CartItem[] {
  try {
    const rawData = localStorage.getItem(CART_KEY);
    if (!rawData) return [];

    const parsed: unknown = JSON.parse(rawData);
    // Si el JSON no es un array (p. ej. contenido manipulado) caemos al carrito vacío.
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

export type Cart = ReturnType<typeof useCart>;

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((product: Product) => {
    setItems((prev) => addToCart(prev, product));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => removeFromCart(prev, id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems((prev) => setLineQuantity(prev, id, quantity));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const itemCount = cartItemCount(items);
  const total = cartTotalCents(items) / 100;

  return { items, itemCount, total, addItem, removeItem, updateQuantity, clearCart };
}
