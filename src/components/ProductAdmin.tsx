"use client";

import { Link } from "@/components/RouterLink";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canAdminister } from "@/lib/roles";
import { getVariantEffectiveCurrency, getVariantEffectivePrice, hasVariantSpecialPrice } from "@/lib/pricing";
import type { Category, Collection, Product, ProductVariant } from "@/lib/types";

type CreatedResponse = {
  id: string;
};

type TaxonomyType = "category" | "collection";
type EditorMode = "create" | "edit";
type CatalogTab = "categories" | "collections" | "products" | "variants";
type ProductMoveDirection = "up" | "down";

const currency = "PEN";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function ProductAdmin() {
  const { token, user } = useAuth();
  const isAdministrator = canAdminister(user?.role);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [activeTab, setActiveTab] = useState<CatalogTab>("products");
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

  const loadVariants = useCallback(
    async (productId: string) => {
      const nextVariants = await apiRequest<ProductVariant[]>(`/api/product-variants/product/${productId}?onlyActive=true`, { token });
      setVariants(nextVariants);
      setSelectedVariantId((currentId) => (nextVariants.some((variant) => variant.id === currentId) ? currentId : nextVariants[0]?.id ?? ""));
    },
    [token],
  );

  useEffect(() => {
    let isActive = true;
    const timeoutId = window.setTimeout(() => {
      loadCatalogBase()
        .catch((error: Error) => {
          if (isActive) {
            setMessage(error.message);
          }
        })
        .finally(() => {
          if (isActive) {
            setIsLoading(false);
          }
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
        if (isActive) {
          setMessage(error.message);
        }
      });
    }, 0);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [loadVariants, selectedProductId]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) ?? null,
    [selectedVariantId, variants],
  );

  async function refreshCatalog(successMessage: string, productId?: string) {
    await loadCatalogBase();
    if (productId) {
      setSelectedProductId(productId);
      await loadVariants(productId);
    }
    setMessage(successMessage);
  }

  async function refreshVariants(successMessage: string, variantId?: string) {
    if (!selectedProductId) {
      return;
    }

    await loadVariants(selectedProductId);
    if (variantId) {
      setSelectedVariantId(variantId);
    }
    setMessage(successMessage);
  }

  async function saveCatalogChanges(successMessage: string, productId?: string) {
    try {
      await refreshCatalog(successMessage, productId);
    } catch (error) {
      setMessage(getErrorMessage(error, "No se pudieron actualizar los datos del catalogo."));
    }
  }

  async function saveVariantChanges(successMessage: string, variantId?: string) {
    try {
      await refreshVariants(successMessage, variantId);
    } catch (error) {
      setMessage(getErrorMessage(error, "No se pudieron actualizar las variantes."));
    }
  }

  async function deleteEntity(endpoint: string, successMessage: string) {
    if (!isAdministrator || !window.confirm("Esta accion desactivara el registro. Continuar?")) {
      return;
    }

    try {
      await apiRequest<void>(endpoint, { method: "DELETE", token });
      await loadCatalogBase();
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo desactivar el registro.");
    }
  }

  async function moveProduct(productId: string, direction: ProductMoveDirection) {
    if (!isAdministrator) {
      return;
    }

    const currentIndex = products.findIndex((product) => product.id === productId);
    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= products.length || movingProductId) {
      return;
    }

    const productName = products[currentIndex].name;
    const nextProducts = [...products];
    [nextProducts[currentIndex], nextProducts[nextIndex]] = [nextProducts[nextIndex], nextProducts[currentIndex]];
    setMovingProductId(productId);
    setProducts(nextProducts);
    try {
      await apiRequest<void>("/api/products/order", {
        body: { productIds: nextProducts.map((product) => product.id) },
        method: "PUT",
        token,
      });
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

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {isAdministrator ? <Metric active={activeTab === "categories"} label="Categorias" value={categories.length} onClick={() => setActiveTab("categories")} /> : null}
        {isAdministrator ? <Metric active={activeTab === "collections"} label="Colecciones" value={collections.length} onClick={() => setActiveTab("collections")} /> : null}
        <Metric active={activeTab === "products"} label="Productos" value={products.length} onClick={() => setActiveTab("products")} />
        <Metric active={activeTab === "variants"} label="Variantes" value={variants.length} onClick={() => setActiveTab("variants")} />
      </section>

      {message ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">{message}</div> : null}

      {isAdministrator && activeTab === "categories" ? (
        <TaxonomyWorkspace
          description="Organiza las familias principales que se mostraran en el catalogo publico."
          items={categories}
          label="Categoria"
          onError={(message) => setMessage(message)}
          onSaved={() => saveCatalogChanges("Categoria guardada.")}
          onDelete={(id) => deleteEntity(`/api/categories/${id}`, "Categoria desactivada.")}
          token={token}
          type="category"
        />
      ) : null}

      {isAdministrator && activeTab === "collections" ? (
        <TaxonomyWorkspace
          description="Agrupa productos por temporadas, estilos o campanas comerciales."
          items={collections}
          label="Coleccion"
          onError={(message) => setMessage(message)}
          onSaved={() => saveCatalogChanges("Coleccion guardada.")}
          onDelete={(id) => deleteEntity(`/api/collections/${id}`, "Coleccion desactivada.")}
          token={token}
          type="collection"
        />
      ) : null}

      {activeTab === "products" ? (
        <ProductWorkspace
          categories={categories}
          collections={collections}
          isLoading={isLoading}
          onError={(errorMessage) => setMessage(errorMessage)}
          onSaved={(productId, mode) => saveCatalogChanges(mode === "create" ? "Producto creado. Ya puedes registrar variantes e imagenes." : "Producto actualizado.", productId)}
          onDelete={(id) => deleteEntity(`/api/products/${id}`, "Producto desactivado.")}
          onSelectProduct={(productId) => {
            setSelectedProductId(productId);
            setSelectedVariantId("");
          }}
          onMove={isAdministrator ? moveProduct : undefined}
          product={selectedProduct}
          products={products}
          selectedProductId={selectedProductId}
          movingProductId={movingProductId}
          token={token}
        />
      ) : null}

      {activeTab === "variants" ? (
        <VariantWorkspace
          canAdjustStock={isAdministrator}
          isLoading={isLoading}
          onError={(errorMessage) => setMessage(errorMessage)}
          onDelete={(id) => deleteEntity(`/api/product-variants/${id}`, "Variante desactivada.")}
          onSelectProduct={(productId) => {
            setSelectedProductId(productId);
            setSelectedVariantId("");
          }}
          onSelectVariant={setSelectedVariantId}
          onSaved={(variantId, mode) => saveVariantChanges(mode === "create" ? "Variante creada." : "Variante actualizada.", variantId)}
          product={selectedProduct}
          products={products}
          selectedProductId={selectedProductId}
          selectedVariant={selectedVariant}
          selectedVariantId={selectedVariantId}
          token={token}
          variants={variants}
        />
      ) : null}
    </div>
  );
}

function Metric({ active, label, value, onClick }: { active: boolean; label: string; value: number; onClick: () => void }) {
  return (
    <button
      aria-pressed={active}
      className={`rounded-lg border bg-white p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-950 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-rose-300 ${
        active ? "border-zinc-950 bg-zinc-950 text-white ring-2 ring-zinc-950/10" : "border-zinc-200 text-zinc-950"
      }`}
      onClick={onClick}
      type="button"
    >
      <p className="text-2xl font-semibold">{value}</p>
      <p className={`mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${active ? "text-white/75" : "text-zinc-500"}`}>{label}</p>
    </button>
  );
}

function TaxonomyWorkspace({
  description,
  items,
  label,
  token,
  type,
  onError,
  onSaved,
  onDelete,
}: {
  description: string;
  items: Category[] | Collection[];
  label: string;
  token: string | null;
  type: TaxonomyType;
  onError: (message: string) => void;
  onSaved: () => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[340px_1fr]">
      <EntityList description={description} emptyText={`Aun no hay ${label.toLowerCase()}s registradas.`} items={items} onDelete={onDelete} title={`${label}s activas`} />
      <TaxonomyManager items={items} label={label} onError={onError} onSaved={onSaved} token={token} type={type} />
    </section>
  );
}

function EntityList({
  description,
  emptyText,
  items,
  title,
  onDelete,
}: {
  description: string;
  emptyText: string;
  items: Array<Category | Collection>;
  title: string;
  onDelete?: (id: string) => Promise<void>;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">Catalogo</p>
        <h2 className="mt-1 text-xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
      </div>
      {items.length === 0 ? <p className="p-5 text-sm text-zinc-500">{emptyText}</p> : null}
      <div className="max-h-[560px] space-y-3 overflow-y-auto p-3">
        {items.map((item) => (
          <article className="rounded-lg border border-zinc-200 bg-stone-50 p-4" key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold uppercase tracking-[0.04em]">{item.name}</h3>
              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
                {item.isActive ? "Activo" : "Inactivo"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{item.description}</p>
            {onDelete ? <button className="mt-3 text-xs font-semibold uppercase tracking-[0.1em] text-rose-800" onClick={() => void onDelete(item.id)} type="button">Desactivar</button> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function ProductWorkspace({
  categories,
  collections,
  isLoading,
  product,
  products,
  selectedProductId,
  token,
  onError,
  onSaved,
  onSelectProduct,
  onDelete,
  onMove,
  movingProductId,
}: {
  categories: Category[];
  collections: Collection[];
  isLoading: boolean;
  product: Product | null;
  products: Product[];
  selectedProductId: string;
  token: string | null;
  onError: (message: string) => void;
  onSaved: (productId: string, mode: EditorMode) => Promise<void>;
  onSelectProduct: (productId: string) => void;
  onDelete: (id: string) => Promise<void>;
  onMove?: (id: string, direction: ProductMoveDirection) => Promise<void>;
  movingProductId?: string;
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[340px_1fr]">
      <ProductSelector
        isLoading={isLoading}
        movingProductId={movingProductId}
        onDelete={onDelete}
        onMove={onMove}
        onSelectProduct={onSelectProduct}
        products={products}
        selectedProductId={selectedProductId}
      />
      <ProductEditor categories={categories} collections={collections} onError={onError} onSaved={onSaved} product={product} token={token} />
    </section>
  );
}

function VariantWorkspace({
  canAdjustStock,
  isLoading,
  product,
  products,
  selectedProductId,
  selectedVariant,
  selectedVariantId,
  token,
  variants,
  onError,
  onSaved,
  onSelectProduct,
  onSelectVariant,
  onDelete,
}: {
  canAdjustStock: boolean;
  isLoading: boolean;
  product: Product | null;
  products: Product[];
  selectedProductId: string;
  selectedVariant: ProductVariant | null;
  selectedVariantId: string;
  token: string | null;
  variants: ProductVariant[];
  onError: (message: string) => void;
  onSaved: (variantId: string | undefined, mode: EditorMode) => Promise<void>;
  onSelectProduct: (productId: string) => void;
  onSelectVariant: (variantId: string) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <section className="grid gap-6 2xl:grid-cols-[300px_1fr_360px]">
      <ProductSelector isLoading={isLoading} products={products} selectedProductId={selectedProductId} onSelectProduct={onSelectProduct} />
      <VariantEditor canAdjustStock={canAdjustStock} onError={onError} onSaved={onSaved} product={product} selectedVariant={selectedVariant} token={token} />
      <VariantPanel product={product} selectedVariantId={selectedVariantId} variants={variants} onDelete={onDelete} onSelectVariant={onSelectVariant} />
    </section>
  );
}

function ProductSelector({
  isLoading,
  products,
  selectedProductId,
  onSelectProduct,
  onDelete,
  onMove,
  movingProductId,
}: {
  isLoading: boolean;
  products: Product[];
  selectedProductId: string;
  onSelectProduct: (productId: string) => void;
  onDelete?: (id: string) => Promise<void>;
  onMove?: (id: string, direction: ProductMoveDirection) => Promise<void>;
  movingProductId?: string;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">Productos</p>
        <h2 className="mt-1 text-xl font-semibold">Productos activos</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">Selecciona una prenda para editarla o administrar sus variantes.</p>
      </div>
      {isLoading ? <p className="p-5 text-sm text-zinc-500">Cargando productos...</p> : null}
      {!isLoading && products.length === 0 ? <p className="p-5 text-sm text-zinc-500">Aun no hay productos registrados.</p> : null}
      <div className="max-h-[560px] space-y-2 overflow-y-auto p-3">
        {products.map((product, index) => (
          <div className="flex gap-2" key={product.id}>
            <button
              className={`min-w-0 flex-1 rounded-lg border px-4 py-4 text-left text-sm transition ${
                selectedProductId === product.id ? "border-zinc-950 bg-zinc-950 text-white shadow-sm" : "border-zinc-200 bg-stone-50 hover:border-zinc-950"
              }`}
              onClick={() => onSelectProduct(product.id)}
              type="button"
            >
              <span className="flex items-center gap-2 font-semibold uppercase tracking-[0.05em]">
                <span className={selectedProductId === product.id ? "grid size-6 shrink-0 place-items-center rounded-full bg-white/15 text-xs" : "grid size-6 shrink-0 place-items-center rounded-full bg-zinc-200 text-xs text-zinc-600"}>{index + 1}</span>
                <span className="min-w-0 truncate">{product.name}</span>
              </span>
              <span className={selectedProductId === product.id ? "mt-1 block text-zinc-300" : "mt-1 block text-zinc-500"}>{formatMoney(product.basePrice, product.currency)}</span>
            </button>
            <div className="flex shrink-0 flex-col gap-2">
              {onMove ? (
                <div className="flex gap-1">
                  <button
                    aria-label={`Subir ${product.name}`}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-950 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={Boolean(movingProductId) || index === 0}
                    onClick={() => void onMove(product.id, "up")}
                    title="Subir producto"
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Bajar ${product.name}`}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-950 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={Boolean(movingProductId) || index === products.length - 1}
                    onClick={() => void onMove(product.id, "down")}
                    title="Bajar producto"
                    type="button"
                  >
                    ↓
                  </button>
                </div>
              ) : null}
              {onDelete ? <button aria-label={`Desactivar ${product.name}`} className="rounded-lg border border-rose-200 px-3 py-2 text-[11px] font-semibold text-rose-800 hover:bg-rose-50" onClick={() => void onDelete(product.id)} type="button">Desactivar</button> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TaxonomyManager({
  items,
  label,
  token,
  type,
  onError,
  onSaved,
}: {
  items: Category[] | Collection[];
  label: string;
  token: string | null;
  type: TaxonomyType;
  onError: (message: string) => void;
  onSaved: () => Promise<void>;
}) {
  const [mode, setMode] = useState<EditorMode>("create");
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const endpoint = type === "category" ? "/api/categories" : "/api/collections";
  const selectedItem = items.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    if (mode === "edit" && selectedItem) {
      const timeoutId = window.setTimeout(() => {
        setName(selectedItem.name);
        setDescription(selectedItem.description);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [mode, selectedItem]);

  function resetForm(nextMode: EditorMode) {
    setMode(nextMode);
    setName("");
    setDescription("");
    if (nextMode === "create") {
      setSelectedId("");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await apiRequest<CreatedResponse | void>(mode === "edit" ? `${endpoint}/${selectedId}` : endpoint, {
        method: mode === "edit" ? "PUT" : "POST",
        body: { name, description },
        token,
      });
      resetForm("create");
      await onSaved();
    } catch (error) {
      onError(getErrorMessage(error, "No se pudo guardar la categoria o coleccion."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-800">{label}</p>
          <h3 className="mt-1 text-xl font-semibold">{mode === "create" ? `Nueva ${label.toLowerCase()}` : `Editar ${label.toLowerCase()}`}</h3>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            {mode === "create" ? "Registra una opcion nueva para organizar el catalogo." : "Actualiza el nombre o descripcion de una opcion existente."}
          </p>
        </div>
        <div className="flex rounded-lg bg-stone-100 p-1 text-xs font-semibold uppercase tracking-[0.1em]">
          <button className={mode === "create" ? "rounded-md bg-zinc-950 px-4 py-2 text-white shadow-sm" : "rounded-md px-4 py-2 text-zinc-600"} onClick={() => resetForm("create")} type="button">
            Crear nuevo
          </button>
          <button className={mode === "edit" ? "rounded-md bg-zinc-950 px-4 py-2 text-white shadow-sm" : "rounded-md px-4 py-2 text-zinc-600"} onClick={() => setMode("edit")} type="button">
            Editar existente
          </button>
        </div>
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        {mode === "edit" ? (
          <Field label={`${label} registrada`}>
            <select className="admin-input" required value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              <option value="">Seleccionar</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field label="Nombre">
          <input className="admin-input" required value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Descripcion">
          <textarea className="admin-input min-h-20 resize-y" required value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <button className="admin-primary-button" disabled={isSubmitting || (mode === "edit" && !selectedId)}>
          {mode === "create" ? `Crear ${label.toLowerCase()}` : `Guardar ${label.toLowerCase()}`}
        </button>
      </form>
    </section>
  );
}

function ProductEditor({
  categories,
  collections,
  onError,
  product,
  token,
  onSaved,
}: {
  categories: Category[];
  collections: Collection[];
  onError: (message: string) => void;
  product: Product | null;
  token: string | null;
  onSaved: (productId: string, mode: EditorMode) => Promise<void>;
}) {
  const [mode, setMode] = useState<EditorMode>("edit");
  const [categoryId, setCategoryId] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (mode === "edit" && product) {
      const timeoutId = window.setTimeout(() => {
        setCategoryId(product.categoryId);
        setCollectionId(product.collectionId ?? "");
        setName(product.name);
        setDescription(product.description ?? "");
        setBasePrice(String(product.basePrice));
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [mode, product]);

  function resetCreateForm() {
    setMode("create");
    setCategoryId("");
    setCollectionId("");
    setName("");
    setDescription("");
    setBasePrice("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await apiRequest<CreatedResponse | void>(mode === "edit" && product ? `/api/products/${product.id}` : "/api/products", {
        method: mode === "edit" ? "PUT" : "POST",
        body: {
          categoryId,
          collectionId: collectionId || null,
          name,
          description: description || null,
          basePrice: Number(basePrice),
          currency,
        },
        token,
      });

      const productId = mode === "create" ? (response as CreatedResponse).id : product?.id;
      if (productId) {
        await onSaved(productId, mode);
        setMode("edit");
      }
    } catch (error) {
      onError(getErrorMessage(error, "No se pudo guardar el producto."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">Producto</p>
          <h3 className="mt-1 text-2xl font-semibold">{mode === "create" ? "Crear producto" : product?.name ?? "Selecciona un producto"}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            {mode === "create" ? "Completa los datos principales para registrar una nueva prenda." : "Estás editando el producto seleccionado en el listado de la izquierda."}
          </p>
        </div>
        <div className="flex rounded-lg bg-stone-100 p-1 text-xs font-semibold uppercase tracking-[0.1em]">
          <button className={mode === "edit" ? "rounded-md bg-zinc-950 px-4 py-2 text-white shadow-sm" : "rounded-md px-4 py-2 text-zinc-600"} onClick={() => setMode("edit")} type="button">
            Editar seleccionado
          </button>
          <button className={mode === "create" ? "rounded-md bg-zinc-950 px-4 py-2 text-white shadow-sm" : "rounded-md px-4 py-2 text-zinc-600"} onClick={resetCreateForm} type="button">
            Crear nuevo
          </button>
        </div>
      </div>

      <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Categoria">
            <select className="admin-input" required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Seleccionar categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Coleccion">
            <select className="admin-input" value={collectionId} onChange={(event) => setCollectionId(event.target.value)}>
              <option value="">Sin coleccion</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_180px]">
          <Field label="Nombre comercial">
            <input className="admin-input" required value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Precio base">
          <input className="admin-input" inputMode="decimal" min="0.01" required step="0.01" type="number" value={basePrice} onChange={(event) => setBasePrice(event.target.value)} />
          </Field>
        </div>

        <Field label="Descripcion del producto">
          <textarea className="admin-input min-h-28 resize-y" value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <button className="admin-primary-button" disabled={isSubmitting || (mode === "edit" && !product)}>
            {mode === "create" ? "Crear producto" : "Guardar cambios"}
          </button>
          <Link className="admin-secondary-button" href={mode === "edit" && product ? "/admin/uploads?productId=" + encodeURIComponent(product.id) : "/admin/uploads"}>
            Gestionar imagenes
          </Link>
        </div>
      </form>
    </section>
  );
}

function VariantEditor({
  canAdjustStock,
  onError,
  product,
  selectedVariant,
  token,
  onSaved,
}: {
  canAdjustStock: boolean;
  onError: (message: string) => void;
  product: Product | null;
  selectedVariant: ProductVariant | null;
  token: string | null;
  onSaved: (variantId: string | undefined, mode: EditorMode) => Promise<void>;
}) {
  const [mode, setMode] = useState<EditorMode>("create");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [sku, setSku] = useState("");
  const [physicalStock, setPhysicalStock] = useState("");
  const [price, setPrice] = useState("");
  const [shippingWeightKg, setShippingWeightKg] = useState("0.3");
  const [shippingLengthCm, setShippingLengthCm] = useState("30");
  const [shippingWidthCm, setShippingWidthCm] = useState("22");
  const [shippingHeightCm, setShippingHeightCm] = useState("4");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (mode === "edit" && selectedVariant) {
      const timeoutId = window.setTimeout(() => {
        setSize(selectedVariant.size);
        setColor(selectedVariant.color);
        setSku(selectedVariant.sku);
        setPhysicalStock(String(selectedVariant.physicalStock));
        setPrice(selectedVariant.price === null ? "" : String(selectedVariant.price));
        setShippingWeightKg(String(selectedVariant.shippingWeightKg));
        setShippingLengthCm(String(selectedVariant.shippingLengthCm));
        setShippingWidthCm(String(selectedVariant.shippingWidthCm));
        setShippingHeightCm(String(selectedVariant.shippingHeightCm));
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [mode, selectedVariant]);

  function resetCreateForm() {
    setMode("create");
    setSize("");
    setColor("");
    setSku("");
    setPhysicalStock("");
    setPrice("");
    setShippingWeightKg("0.3");
    setShippingLengthCm("30");
    setShippingWidthCm("22");
    setShippingHeightCm("4");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiRequest<CreatedResponse | void>(mode === "edit" && selectedVariant ? `/api/product-variants/${selectedVariant.id}` : "/api/product-variants", {
        method: mode === "edit" ? "PUT" : "POST",
        body:
          mode === "edit"
            ? {
                size,
                color,
                price: price ? Number(price) : null,
                currency,
                shippingWeightKg: Number(shippingWeightKg),
                shippingLengthCm: Number(shippingLengthCm),
                shippingWidthCm: Number(shippingWidthCm),
                shippingHeightCm: Number(shippingHeightCm),
              }
            : {
                productId: product.id,
                size,
                color,
                sku,
                physicalStock: Number(physicalStock),
                price: price ? Number(price) : null,
                currency,
                shippingWeightKg: Number(shippingWeightKg),
                shippingLengthCm: Number(shippingLengthCm),
                shippingWidthCm: Number(shippingWidthCm),
                shippingHeightCm: Number(shippingHeightCm),
              },
        token,
      });

      const variantId = mode === "create" ? (response as CreatedResponse).id : selectedVariant?.id;
      await onSaved(variantId, mode);
      if (mode === "create") {
        resetCreateForm();
      }
    } catch (error) {
      onError(getErrorMessage(error, "No se pudo guardar la variante."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">Variantes</p>
          <h3 className="mt-1 text-2xl font-semibold">{product?.name ?? "Selecciona un producto"}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            {mode === "create" ? "Agrega una talla o color nuevo para este producto." : "Edita la variante marcada en el panel de la derecha."}
          </p>
        </div>
        <div className="flex rounded-lg bg-stone-100 p-1 text-xs font-semibold uppercase tracking-[0.1em]">
          <button className={mode === "create" ? "rounded-md bg-zinc-950 px-4 py-2 text-white shadow-sm" : "rounded-md px-4 py-2 text-zinc-600"} onClick={resetCreateForm} type="button">
            Crear nueva
          </button>
          <button className={mode === "edit" ? "rounded-md bg-zinc-950 px-4 py-2 text-white shadow-sm" : "rounded-md px-4 py-2 text-zinc-600"} onClick={() => setMode("edit")} type="button">
            Editar existente
          </button>
        </div>
      </div>

      <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Talla">
            <input className="admin-input" required value={size} onChange={(event) => setSize(event.target.value)} />
          </Field>
          <Field label="Color">
            <input className="admin-input" required value={color} onChange={(event) => setColor(event.target.value)} />
          </Field>
          <Field label="SKU">
            <input className="admin-input disabled:bg-zinc-100 disabled:text-zinc-500" disabled={mode === "edit"} required value={sku} onChange={(event) => setSku(event.target.value)} />
          </Field>
          <Field label={mode === "edit" ? "Stock actual" : "Stock inicial"}>
            <input
              className="admin-input disabled:bg-zinc-100 disabled:text-zinc-500"
              disabled={mode === "edit"}
              min="0"
              required
              type="number"
              value={physicalStock}
              onChange={(event) => setPhysicalStock(event.target.value)}
            />
            {mode === "edit" && selectedVariant && canAdjustStock ? (
              <Link className="mt-2 inline-flex text-xs font-semibold uppercase tracking-[0.1em] text-rose-800 underline decoration-rose-200 underline-offset-4" href={`/admin/settings?tab=stock&variantId=${selectedVariant.id}`}>
                Ajustar inventario
              </Link>
            ) : null}
          </Field>
        </div>
        <Field label="Precio especial">
          <input
            className="admin-input"
            inputMode="decimal"
            min="0"
            placeholder={product ? `Vacio: usa ${formatMoney(product.basePrice, product.currency)}` : "Opcional"}
            step="0.01"
            type="number"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </Field>
        <div className="grid gap-4 rounded-lg border border-zinc-200 bg-stone-50 p-4 sm:grid-cols-4">
          <Field label="Peso (kg)"><input className="admin-input" min="0.01" step="0.01" type="number" value={shippingWeightKg} onChange={(event) => setShippingWeightKg(event.target.value)} /></Field>
          <Field label="Largo (cm)"><input className="admin-input" min="0.1" step="0.1" type="number" value={shippingLengthCm} onChange={(event) => setShippingLengthCm(event.target.value)} /></Field>
          <Field label="Ancho (cm)"><input className="admin-input" min="0.1" step="0.1" type="number" value={shippingWidthCm} onChange={(event) => setShippingWidthCm(event.target.value)} /></Field>
          <Field label="Alto (cm)"><input className="admin-input" min="0.1" step="0.1" type="number" value={shippingHeightCm} onChange={(event) => setShippingHeightCm(event.target.value)} /></Field>
        </div>
        <p className="text-xs leading-5 text-zinc-500">
          Si queda vacio, la variante usa el precio base del producto. SKU y stock se mantienen desde inventario al editar.
        </p>
        <button className="admin-primary-button" disabled={isSubmitting || !product || (mode === "edit" && !selectedVariant)}>
          {mode === "create" ? "Crear variante" : "Guardar variante"}
        </button>
      </form>
    </section>
  );
}

function VariantPanel({
  product,
  variants,
  selectedVariantId,
  onDelete,
  onSelectVariant,
}: {
  product: Product | null;
  variants: ProductVariant[];
  selectedVariantId: string;
  onDelete: (id: string) => Promise<void>;
  onSelectVariant: (variantId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-[0.14em]">Variantes activas</h3>
      {!product ? <p className="mt-4 text-sm text-zinc-500">Selecciona un producto.</p> : null}
      {product && variants.length === 0 ? <p className="mt-4 text-sm text-zinc-500">Este producto aun no tiene variantes.</p> : null}
      <div className="mt-4 space-y-3">
        {variants.map((variant) => (
          <div className={`border p-4 transition ${
            selectedVariantId === variant.id ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-stone-50"
          }`} key={variant.id}>
            <button
            className="w-full text-left"
            onClick={() => onSelectVariant(variant.id)}
            type="button"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold uppercase tracking-[0.06em]">{variant.size}</p>
                <p className={selectedVariantId === variant.id ? "mt-1 text-sm text-zinc-300" : "mt-1 text-sm text-zinc-600"}>{variant.color}</p>
              </div>
              <span className={selectedVariantId === variant.id ? "text-sm font-semibold text-white" : "text-sm font-semibold"}>{variant.physicalStock} uds.</span>
            </div>
            <p className={selectedVariantId === variant.id ? "mt-3 text-xs text-zinc-300" : "mt-3 text-xs text-zinc-500"}>{variant.sku}</p>
            {product ? (
              <div className="mt-2">
                <p className="text-sm font-semibold">{formatMoney(getVariantEffectivePrice(product, variant), getVariantEffectiveCurrency(product, variant))}</p>
                <p className={selectedVariantId === variant.id ? "mt-1 text-xs text-zinc-300" : "mt-1 text-xs text-zinc-500"}>
                  {hasVariantSpecialPrice(variant) ? "Precio especial de variante" : "Usa precio base del producto"}
                </p>
              </div>
            ) : null}
            </button>
            <button className={selectedVariantId === variant.id ? "mt-3 text-xs font-semibold uppercase tracking-[0.1em] text-zinc-300" : "mt-3 text-xs font-semibold uppercase tracking-[0.1em] text-rose-800"} onClick={() => void onDelete(variant.id)} type="button">Desactivar variante</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-zinc-800">
      {label}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function formatMoney(amount: number, nextCurrency = currency) {
  return `S/. ${amount.toFixed(2)} ${nextCurrency}`;
}
