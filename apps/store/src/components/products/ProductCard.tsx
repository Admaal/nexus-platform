import { ResponsiveImage } from "../ui/ResponsiveImage";
import { getProductImageSources } from "../../lib/constants";
import type { Product } from "../../types";

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const image = getProductImageSources(product.name);

  return (
    <article className="product-card">
      <div className="product-card__image-wrap">
        <ResponsiveImage
          {...image}
          alt={product.name}
          className="product-card__image"
          loading="lazy"
          decoding="async"
          width={360}
          height={480}
        />
      </div>
      <div className="product-card__body">
        <h3 className="product-card__name">{product.name}</h3>
        <p className="product-card__desc">{product.description}</p>
        <div className="product-card__footer">
          <span className="product-card__price">{product.price}€</span>
          <button
            className="product-card__add-btn"
            onClick={() => onAddToCart(product)}
          >
            Añadir
          </button>
        </div>
      </div>
    </article>
  );
}
