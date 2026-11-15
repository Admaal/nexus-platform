import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Product } from "../types";

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase.from("products").select("*");
      if (cancelled) return;
      if (error) setError(error.message);
      else setProducts((data ?? []) as Product[]);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { products, loading, error, reload };
}
