import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Product } from "../types";

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from("products").select("*");
      if (error) setError(error.message);
      else setProducts((data ?? []) as Product[]);
      setLoading(false);
    }
    void load();
  }, []);

  return { products, loading, error };
}
