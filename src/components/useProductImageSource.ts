import { useState } from "react";
import { publicAssetUrl } from "@/lib/api";
import { getStorefrontMockProductImage, isPlaceholderImage } from "@/lib/mock-catalog";
import type { Product, ProductImage } from "@/lib/types";

export function useProductImageSource(product: Product, images: ProductImage[]) {
  const fallbackImage = getStorefrontMockProductImage(product.name);
  const mainImage =
    images.find((image) => image.isMain && !isPlaceholderImage(image.url)) ??
    images.find((image) => !isPlaceholderImage(image.url)) ??
    images.find((image) => image.isMain) ??
    images[0];
  const [hasImageError, setHasImageError] = useState(false);
  const imageSrc =
    hasImageError || !mainImage || isPlaceholderImage(mainImage.url)
      ? fallbackImage
      : publicAssetUrl(mainImage.url);

  return {
    imageSrc,
    handleImageError: () => setHasImageError(true),
  };
}
