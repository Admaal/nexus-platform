import { ResponsiveImage } from "../ui/ResponsiveImage";

const HERO_IMAGE = {
  src: "/images/hero/hero-1024.webp",
  srcSet:
    "/images/hero/hero-640.webp 640w, /images/hero/hero-1024.webp 1024w, /images/hero/hero-1600.webp 1600w",
  sizes: "100vw",
  fallbackSrc: "/images/hero/hero-fallback.jpg",
};

export function HeroSection({ onShopClick }) {
  return (
    <section className="hero">
      <ResponsiveImage
        {...HERO_IMAGE}
        alt="Premium workspace setup"
        className="hero__image"
        loading="eager"
        fetchPriority="high"
        decoding="async"
        width={1600}
        height={900}
      />
      <div className="hero__overlay">
        <div className="hero__content">
          <p className="hero__eyebrow">Nueva Colección 2025</p>
          <h1 className="hero__title">Diseñado para crear.</h1>
          <p className="hero__subtitle">
            Equipamiento premium para profesionales que valoran la calidad, el diseño y el rendimiento.
          </p>
          <button className="hero__cta" onClick={onShopClick}>
            Explorar la colección
          </button>
        </div>
      </div>
    </section>
  );
}
