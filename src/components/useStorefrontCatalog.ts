import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { clientEnv } from "@/lib/env";
import { mockProducts } from "@/lib/mock-catalog";
import type { Category, Collection, Product, ProductImage } from "@/lib/types";

export function useStorefrontCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [imagesByProduct, setImagesByProduct] = useState<Record<string, ProductImage[]>>({});
  const [categoryId, setCategoryId] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    Promise.all([
      apiRequest<Category[]>("/api/categories?onlyActive=true"),
      apiRequest<Collection[]>("/api/collections?onlyActive=true"),
    ])
      .then(([nextCategories, nextCollections]) => {
        if (!isActive) return;
        setCategories(nextCategories);
        setCollections(nextCollections);
      })
      .catch(() => {
        if (isActive) setMessage("No pudimos cargar las colecciones en este momento.");
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ onlyActive: "true" });
    if (categoryId) params.set("categoryId", categoryId);
    if (collectionId) params.set("collectionId", collectionId);

    let isActive = true;
    setIsLoadingProducts(true);
    setMessage("");

    async function loadProducts() {
      try {
        const nextProducts = await apiRequest<Product[]>(`/api/products?${params.toString()}`);
        if (!isActive) return;

        setProducts(nextProducts);
        const imageEntries = await Promise.all(
          nextProducts.map(async (product) => {
            try {
              const images = await apiRequest<ProductImage[]>(`/api/product-images/product/${product.id}`);
              return [product.id, images] as const;
            } catch {
              return [product.id, []] as const;
            }
          }),
        );

        if (isActive) setImagesByProduct(Object.fromEntries(imageEntries));
      } catch {
        if (isActive) {
          setProducts(clientEnv.enableMocks ? mockProducts : []);
          setImagesByProduct({});
          setMessage(clientEnv.enableMocks ? "Modo de pruebas activo: mostramos el catalogo local." : "No pudimos cargar los productos. Intenta nuevamente en unos minutos.");
        }
      } finally {
        if (isActive) setIsLoadingProducts(false);
      }
    }

    void loadProducts();
    return () => {
      isActive = false;
    };
  }, [categoryId, collectionId]);

  const categoryNames = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const selectedCollection = collections.find((collection) => collection.id === collectionId) ?? null;
  const selectedCategory = categories.find((category) => category.id === categoryId) ?? null;
  const catalogTitle = selectedCategory
    ? `${selectedCollection?.name ?? "Todo"} / ${selectedCategory.name}`
    : selectedCollection?.name ?? "New arrivals";
  const catalogDescription = selectedCategory?.description ?? selectedCollection?.description ?? "Piezas disponibles para explorar sin iniciar sesion.";
  const visibleProducts = useMemo(() => {
    const backendIds = new Set(products.map((product) => product.id));
    const availableMocks = clientEnv.enableMocks ? mockProducts.filter((product) => !backendIds.has(product.id)) : [];

    return [...products, ...availableMocks]
      .filter((product) => {
        const matchesCategory = categoryId ? product.categoryId === categoryId : true;
        const matchesCollection = collectionId ? product.collectionId === collectionId : true;
        return matchesCategory && matchesCollection;
      })
      .sort((firstProduct, secondProduct) => {
        const firstOrder = firstProduct.displayOrder ?? Number.MAX_SAFE_INTEGER;
        const secondOrder = secondProduct.displayOrder ?? Number.MAX_SAFE_INTEGER;
        return firstOrder - secondOrder || firstProduct.name.localeCompare(secondProduct.name);
      });
  }, [categoryId, collectionId, products]);

  return {
    categories,
    categoryId,
    categoryNames,
    catalogDescription,
    catalogTitle,
    collectionId,
    collections,
    imagesByProduct,
    isLoadingProducts,
    message,
    selectedCategory,
    selectedCollection,
    setCategoryId,
    setCollectionId,
    setMessage,
    visibleProducts,
  };
}
