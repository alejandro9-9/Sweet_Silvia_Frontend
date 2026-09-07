import type { Product, ProductVariant } from "./types";

export function getVariantEffectivePrice(product: Product, variant?: ProductVariant | null) {
  return variant?.price ?? product.basePrice;
}

export function getVariantEffectiveCurrency(product: Product, variant?: ProductVariant | null) {
  return variant?.price === null || variant?.price === undefined ? product.currency : variant.currency ?? product.currency;
}

export function hasVariantSpecialPrice(variant?: ProductVariant | null) {
  return variant?.price !== null && variant?.price !== undefined;
}
