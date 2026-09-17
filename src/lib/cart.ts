import type { Product, ProductImage, ProductVariant } from "./types";
import { getVariantEffectiveCurrency, getVariantEffectivePrice } from "./pricing";

export type GuestCartItem = {
  id: string;
  productId: string;
  variantId: string | null;
  productName: string;
  size: string;
  color: string;
  quantity: number;
  availableStock: number | null;
  unitPrice: number;
  currency: string;
  imageUrl: string | null;
};

// v2 removes the old heuristic that divided prices >= 1000 by 100.
// Prices are stored as decimal PEN values throughout the API and cart.
const guestCartKey = "sweet-silvia-guest-cart-v2";

export function readGuestCart() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(guestCartKey);
    if (!rawValue) {
      return [];
    }

    const value = JSON.parse(rawValue);
    return Array.isArray(value) ? value.map(normalizeGuestCartItem).filter(isGuestCartItem) : [];
  } catch {
    return [];
  }
}

export function writeGuestCart(items: GuestCartItem[]) {
  window.localStorage.setItem(guestCartKey, JSON.stringify(items.map(normalizeGuestCartItem).filter(isGuestCartItem)));
  window.dispatchEvent(new Event("sweet-silvia-cart-updated"));
}

export function addGuestCartItem(item: Omit<GuestCartItem, "id">) {
  const items = readGuestCart();
  const existingIndex = items.findIndex(
    (cartItem) => cartItem.productId === item.productId && cartItem.variantId === item.variantId,
  );

  if (existingIndex >= 0) {
    const nextItems = items.map((cartItem, index) =>
      index === existingIndex
        ? {
            ...cartItem,
            quantity: Math.min(cartItem.quantity + item.quantity, item.availableStock ?? 99),
            availableStock: item.availableStock ?? cartItem.availableStock,
          }
        : cartItem,
    );
    writeGuestCart(nextItems);
    return nextItems;
  }

  const nextItems = [
    ...items,
    {
      ...item,
      id: `${item.productId}-${item.variantId ?? "default"}`,
    },
  ];
  writeGuestCart(nextItems);
  return nextItems;
}

export function updateGuestCartItemQuantity(itemId: string, quantity: number) {
  const nextItems = readGuestCart()
    .map((item) => item.id === itemId ? { ...item, quantity: Math.min(quantity, item.availableStock ?? 99) } : item)
    .filter((item) => item.quantity > 0);
  writeGuestCart(nextItems);
  return nextItems;
}

export function removeGuestCartItem(itemId: string) {
  const nextItems = readGuestCart().filter((item) => item.id !== itemId);
  writeGuestCart(nextItems);
  return nextItems;
}

export function toGuestCartItem({
  product,
  variant,
  imageUrl,
  quantity,
}: {
  product: Product;
  variant?: ProductVariant | null;
  imageUrl?: string | null;
  quantity: number;
}): Omit<GuestCartItem, "id"> {
  const unitPrice = getVariantEffectivePrice(product, variant);

  return {
    productId: product.id,
    variantId: variant?.id ?? null,
    productName: product.name,
    size: variant?.size ?? "Talla unica",
    color: variant?.color ?? "Color unico",
    quantity,
    availableStock: variant?.physicalStock ?? null,
    unitPrice,
    currency: getVariantEffectiveCurrency(product, variant),
    imageUrl: imageUrl ?? null,
  };
}

export function mainImageUrl(images: ProductImage[], fallbackImage: string | null) {
  const image = images.find((entry) => entry.isMain) ?? images[0];
  return image?.url ?? fallbackImage;
}

function normalizeGuestCartItem(item: GuestCartItem): GuestCartItem | null {
  if (!item || !item.id || !item.productId || !item.productName) {
    return null;
  }

  const quantity = Number.isFinite(item.quantity) ? Math.max(1, Math.floor(item.quantity)) : 1;
  const unitPrice = normalizeUnitPrice(Number(item.unitPrice));

  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    return null;
  }

  return {
    ...item,
    quantity: Math.min(quantity, item.availableStock ?? 99),
    availableStock: item.availableStock == null ? null : Math.max(0, Math.floor(item.availableStock)),
    unitPrice,
    currency: item.currency || "PEN",
    size: item.size || "Talla unica",
    color: item.color || "Color unico",
    imageUrl: item.imageUrl ?? null,
  };
}

function isGuestCartItem(item: GuestCartItem | null): item is GuestCartItem {
  return item !== null;
}

function normalizeUnitPrice(value: number) {
  return Number.isFinite(value) ? value : 0;
}
