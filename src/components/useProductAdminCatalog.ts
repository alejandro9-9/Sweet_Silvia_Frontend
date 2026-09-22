import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { Category, Collection, Product, ProductVariant } from "@/lib/types";

export type ProductMoveDirection = "up" | "down";

type UseProductAdminCatalogOptions = {
  isAdministrator: boolean;
  token: string | null;
};

export function useProductAdminCatalog({ isAdministrator, token }: UseProductAdminCatalogOptions) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [movingProductId, setMovingProductId] = useState("");

  const loadCatalogBase = useCallback(async () => {
    const [nextCategories, nextCollections, nextProducts] = await Promise.all([
      apiRequest<Category[]>("/api/categories?onlyActive=true", { token }),
      apiRequest<Collection[]>("/api/collections?onlyActive=true", { token }),
      apiRequest<Product[]>("/api/products?onlyActive=true", { token }),
    ]);

    setCategories(nextCategories);
    setCollections(nextCollections);
    setProducts(nextProducts);
  }, [token]);

  const loadVariants = useCallback(async (productId: string) => {
    const nextVariants = await apiRequest<ProductVariant[]>(`/api/product-variants/product/${productId}?onlyActive=true`, { token });
    setVariants(nextVariants);
    setSelectedVariantId((currentId) => (nextVariants.some((variant) => variant.id === currentId) ? currentId : nextVariants[0]?.id ?? ""));
  }, [token]);

  useEffect(() => {
    let isActive = true;
    const timeoutId = window.setTimeout(() => {
      loadCatalogBase()
        .catch((error: Error) => {
          if (isActive) setMessage(error.message);
        })
        .finally(() => {
          if (isActive) setIsLoading(false);
        });
    }, 0);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [loadCatalogBase]);

  useEffect(() => {
    if (!selectedProductId && products[0]) {
      const timeoutId = window.setTimeout(() => setSelectedProductId(products[0].id), 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [products, selectedProductId]);

  useEffect(() => {
    if (!selectedProductId) {
      const timeoutId = window.setTimeout(() => {
        setVariants([]);
        setSelectedVariantId("");
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    let isActive = true;
    const timeoutId = window.setTimeout(() => {
      loadVariants(selectedProductId).catch((error: Error) => {
        if (isActive) setMessage(error.message);
      });
    }, 0);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [loadVariants, selectedProductId]);

  const selectedProduct = useMemo(() => products.find((product) => product.id === selectedProductId) ?? null, [products, selectedProductId]);
  const selectedVariant = useMemo(() => variants.find((variant) => variant.id === selectedVariantId) ?? null, [selectedVariantId, variants]);

  async function refreshCatalog(successMessage: string, productId?: string) {
    await loadCatalogBase();
    if (productId) {
      setSelectedProductId(productId);
      await loadVariants(productId);
    }
    setMessage(successMessage);
  }

  async function refreshVariants(successMessage: string, variantId?: string) {
    if (!selectedProductId) return;
    await loadVariants(selectedProductId);
    if (variantId) setSelectedVariantId(variantId);
    setMessage(successMessage);
  }

  async function deleteEntity(endpoint: string, successMessage: string, reloadSelectedVariants = false) {
    if (!isAdministrator || !window.confirm("Esta accion desactivara el registro. Continuar?")) return;
    try {
      await apiRequest<void>(endpoint, { method: "DELETE", token });
      await loadCatalogBase();
      if (reloadSelectedVariants && selectedProductId) {
        await loadVariants(selectedProductId);
      }
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo desactivar el registro.");
    }
  }

  async function moveProduct(productId: string, direction: ProductMoveDirection) {
    if (!isAdministrator) return;

    const currentIndex = products.findIndex((product) => product.id === productId);
    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= products.length || movingProductId) return;

    const productName = products[currentIndex].name;
    const nextProducts = [...products];
    [nextProducts[currentIndex], nextProducts[nextIndex]] = [nextProducts[nextIndex], nextProducts[currentIndex]];
    setMovingProductId(productId);
    setProducts(nextProducts);
    try {
      await apiRequest<void>("/api/products/order", { body: { productIds: nextProducts.map((product) => product.id) }, method: "PUT", token });
      await loadCatalogBase();
      setSelectedProductId(productId);
      setMessage(`${productName} ahora ocupa la posicion ${nextIndex + 1}.`);
    } catch (error) {
      setProducts(products);
      setMessage(error instanceof Error ? error.message : "No se pudo cambiar el orden del producto.");
    } finally {
      setMovingProductId("");
    }
  }

  return {
    categories,
    collections,
    deleteEntity,
    isLoading,
    loadCatalogBase,
    message,
    moveProduct,
    movingProductId,
    products,
    refreshCatalog,
    refreshVariants,
    selectedProduct,
    selectedProductId,
    selectedVariant,
    selectedVariantId,
    setMessage,
    setSelectedProductId,
    setSelectedVariantId,
    variants,
  };
}
