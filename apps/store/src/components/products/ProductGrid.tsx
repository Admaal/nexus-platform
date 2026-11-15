import { ProductCard } from "./ProductCard";
import type { Product } from "../../types";

function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton--image" />
      <div className="skeleton-card__body">
        <div className="skeleton skeleton--title" />
        <div className="skeleton skeleton--text" />
        <div className="skeleton skeleton--short" />
      </div>
    </div>
  );
}

interface ProductGridProps {
  products: Product[];
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onAddToCart: (product: Product) => void;
}

export function ProductGrid({ products, loading, error = null, onRetry, onAddToCart }: ProductGridProps) {
  if (loading) {
    return (
      <div className="product-grid">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="product-grid__error" role="alert">
        <p>No pudimos cargar el catálogo. Revisa tu conexión e inténtalo de nuevo.</p>
        {onRetry && (
          <button type="button" className="btn btn--secondary btn--md" onClick={onRetry}>
            Reintentar
          </button>
        )}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <p className="product-grid__empty">
        No hay productos disponibles en este momento.
      </p>
    );
  }

  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} />
      ))}
    </div>
  );
}
