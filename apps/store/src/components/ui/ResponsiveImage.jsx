import { useState } from "react";

export function ResponsiveImage({
  src,
  srcSet,
  sizes,
  fallbackSrc,
  alt,
  className,
  loading,
  fetchPriority,
  decoding = "async",
  width,
  height,
}) {
  const [hasError, setHasError] = useState(false);
  const imageSrc = hasError ? fallbackSrc : fallbackSrc || src;
  const handleError = () => setHasError(true);

  if (hasError || !srcSet) {
    return (
      <img
        src={imageSrc}
        alt={alt}
        className={className}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding={decoding}
        width={width}
        height={height}
      />
    );
  }

  return (
    <picture className="responsive-image">
      <source type="image/webp" srcSet={srcSet} sizes={sizes} />
      <img
        src={imageSrc}
        alt={alt}
        className={className}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding={decoding}
        width={width}
        height={height}
        onError={handleError}
      />
    </picture>
  );
}
