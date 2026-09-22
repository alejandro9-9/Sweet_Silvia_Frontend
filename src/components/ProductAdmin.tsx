import { Link } from "@/components/RouterLink";
import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canAdminister } from "@/lib/roles";
import { formatMoney } from "@/lib/format";
import { getVariantEffectiveCurrency, getVariantEffectivePrice, hasVariantSpecialPrice } from "@/lib/pricing";
import { AdminPagination } from "@/components/AdminPagination";
import { useProductAdminCatalog, type ProductMoveDirection } from "@/components/useProductAdminCatalog";
import type { Category, Collection, Product, ProductVariant } from "@/lib/types";

type CreatedResponse = {
  id: string;
};

type TaxonomyType = "category" | "collection";
type EditorMode = "create" | "edit";
type CatalogTab = "categories" | "collections" | "products" | "variants";
type EditorState = { mode: EditorMode; id?: string };

const currency = "PEN";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function ProductAdmin() {
  const { token, user } = useAuth();
  const isAdministrator = canAdminister(user?.role);
  const [activeTab, setActiveTab] = useState<CatalogTab>("products");
  const catalog = useProductAdminCatalog({ isAdministrator, token });
  const { categories, collections, deleteEntity, isLoading, message, moveProduct, movingProductId, products, refreshCatalog, refreshVariants, selectedProduct, selectedProductId, selectedVariant, selectedVariantId, setMessage, setSelectedProductId, setSelectedVariantId, variants } = catalog;

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
          onDelete={(id) => deleteEntity(`/api/product-variants/${id}`, "Variante desactivada.", true)}
          onSelectProduct={(productId) => {
            setSelectedProductId(productId);
            setSelectedVariantId("");
          }}
          onSaved={(variantId, mode) => saveVariantChanges(mode === "create" ? "Variante creada." : "Variante actualizada.", variantId)}
          product={selectedProduct}
          products={products}
          selectedProductId={selectedProductId}
          token={token}
          variants={variants}
        />
      ) : null}
    </div>
  );
}

function CatalogModal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/55 p-4" role="presentation" onClick={onClose}>
      <section className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button aria-label="Cerrar" className="icon-button" onClick={onClose} title="Cerrar" type="button">
            <CloseIcon />
          </button>
        </div>
        {children}
      </section>
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
  const [editor, setEditor] = useState<EditorState | null>(null);

  return (
    <>
      <EntityList
        description={description}
        entityLabel={label}
        emptyText={`Aun no hay ${label.toLowerCase()}s registradas.`}
        items={items}
        onCreate={() => setEditor({ mode: "create" })}
        onDelete={onDelete}
        onEdit={(id) => setEditor({ mode: "edit", id })}
        title={`${label}s activas`}
      />
      {editor ? (
        <CatalogModal title={`${editor.mode === "create" ? "Nueva" : "Editar"} ${label.toLowerCase()}`} onClose={() => setEditor(null)}>
          <TaxonomyManager
            key={`${editor.mode}-${editor.id ?? "new"}`}
            initialMode={editor.mode}
            initialSelectedId={editor.id}
            items={items}
            label={label}
            onClose={() => setEditor(null)}
            onError={onError}
            onSaved={onSaved}
            token={token}
            type={type}
          />
        </CatalogModal>
      ) : null}
    </>
  );
}

function EntityList({
  description,
  entityLabel,
  emptyText,
  items,
  title,
  onCreate,
  onDelete,
  onEdit,
}: {
  description: string;
  entityLabel: string;
  emptyText: string;
  items: Array<Category | Collection>;
  title: string;
  onCreate: () => void;
  onDelete?: (id: string) => Promise<void>;
  onEdit: (id: string) => void;
}) {
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const visibleItems = items.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, pageCount));
  }, [pageCount]);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">Catalogo</p>
          <h2 className="mt-1 text-xl font-semibold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
        </div>
        <button aria-label={`Crear ${entityLabel.toLowerCase()}`} className="icon-button" onClick={onCreate} title={`Crear ${entityLabel.toLowerCase()}`} type="button">
          <PlusIcon />
        </button>
      </div>
      {items.length === 0 ? <p className="p-5 text-sm text-zinc-500">{emptyText}</p> : null}
      <div className="divide-y divide-zinc-100">
        {visibleItems.map((item) => (
          <article className="flex flex-wrap items-center justify-between gap-4 px-5 py-4" key={item.id}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold uppercase tracking-[0.04em]">{item.name}</h3>
                <span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
                  {item.isActive ? "Activo" : "Inactivo"}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-zinc-600">{item.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button aria-label={`Editar ${item.name}`} className="icon-button" onClick={() => onEdit(item.id)} title={`Editar ${item.name}`} type="button">
                <EditIcon />
              </button>
              {onDelete ? (
                <button aria-label={`Eliminar ${item.name}`} className="icon-button icon-button-danger" onClick={() => void onDelete(item.id)} title={`Eliminar ${item.name}`} type="button">
                  <TrashIcon />
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      <AdminPagination page={page} pageCount={pageCount} total={items.length} onPageChange={setPage} />
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
  const [editor, setEditor] = useState<EditorState | null>(null);
  const editorProduct = editor?.id ? products.find((entry) => entry.id === editor.id) ?? null : null;

  return (
    <>
      <ProductSelector
        isLoading={isLoading}
        movingProductId={movingProductId}
        onCreate={() => setEditor({ mode: "create" })}
        onDelete={onDelete}
        onEdit={(id) => {
          onSelectProduct(id);
          setEditor({ mode: "edit", id });
        }}
        onMove={onMove}
        products={products}
      />
      {editor ? (
        <CatalogModal title={`${editor.mode === "create" ? "Nuevo" : "Editar"} producto`} onClose={() => setEditor(null)}>
          <ProductEditor
            key={`${editor.mode}-${editor.id ?? "new"}`}
            categories={categories}
            collections={collections}
            initialMode={editor.mode}
            onClose={() => setEditor(null)}
            onError={onError}
            onSaved={onSaved}
            product={editorProduct}
            token={token}
          />
        </CatalogModal>
      ) : null}
    </>
  );
}

function VariantWorkspace({
  canAdjustStock,
  isLoading,
  product,
  products,
  selectedProductId,
  token,
  variants,
  onError,
  onSaved,
  onSelectProduct,
  onDelete,
}: {
  canAdjustStock: boolean;
  isLoading: boolean;
  product: Product | null;
  products: Product[];
  selectedProductId: string;
  token: string | null;
  variants: ProductVariant[];
  onError: (message: string) => void;
  onSaved: (variantId: string | undefined, mode: EditorMode) => Promise<void>;
  onSelectProduct: (productId: string) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(variants.length / pageSize));
  const visibleVariants = variants.slice((page - 1) * pageSize, page * pageSize);
  const selectedVariant = editor?.id ? variants.find((variant) => variant.id === editor.id) ?? null : null;

  useEffect(() => {
    setPage(1);
    setEditor(null);
  }, [selectedProductId]);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, pageCount));
  }, [pageCount]);

  return (
    <>
      <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">Catalogo</p>
            <h2 className="mt-1 text-xl font-semibold">Variantes activas</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">Administra tallas, colores, stock y precios por producto.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block min-w-56 text-xs font-semibold uppercase tracking-[0.1em] text-zinc-600">
              Producto
              <select className="admin-input mt-2 normal-case tracking-normal" disabled={isLoading} value={selectedProductId} onChange={(event) => onSelectProduct(event.target.value)}>
                <option value="">Seleccionar producto</option>
                {products.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
              </select>
            </label>
            <button aria-label="Crear variante" className="icon-button" disabled={!product} onClick={() => setEditor({ mode: "create" })} title="Crear variante" type="button">
              <PlusIcon />
            </button>
          </div>
        </div>
        {!product ? <p className="p-5 text-sm text-zinc-500">Selecciona un producto para ver sus variantes.</p> : null}
        {product && variants.length === 0 ? <p className="p-5 text-sm text-zinc-500">Este producto aun no tiene variantes.</p> : null}
        {product && variants.length > 0 ? (
          <div className="divide-y divide-zinc-100">
            <div className="hidden grid-cols-[1fr_1fr_120px_140px_88px] gap-4 bg-stone-50 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 md:grid">
              <span>Talla</span>
              <span>Color</span>
              <span>Stock</span>
              <span>SKU</span>
              <span className="text-right">Acciones</span>
            </div>
            {visibleVariants.map((variant) => (
              <div className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_1fr_120px_140px_88px] md:items-center md:gap-4" key={variant.id}>
                <div>
                  <p className="font-semibold uppercase tracking-[0.05em]">{variant.size}</p>
                  <p className="mt-1 text-xs text-zinc-500 md:hidden">{variant.color}</p>
                </div>
                <p className="hidden text-sm text-zinc-600 md:block">{variant.color}</p>
                <p className="text-sm font-semibold">{variant.physicalStock} uds.</p>
                <p className="text-xs text-zinc-500">{variant.sku}</p>
                <div className="flex items-center justify-start gap-2 md:justify-end">
                  <button aria-label={`Editar variante ${variant.size} ${variant.color}`} className="icon-button" onClick={() => setEditor({ mode: "edit", id: variant.id })} title="Editar variante" type="button">
                    <EditIcon />
                  </button>
                  <button aria-label={`Eliminar variante ${variant.size} ${variant.color}`} className="icon-button icon-button-danger" onClick={() => void onDelete(variant.id)} title="Eliminar variante" type="button">
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <AdminPagination page={page} pageCount={pageCount} total={variants.length} onPageChange={setPage} />
      </section>
      {editor ? (
        <CatalogModal title={`${editor.mode === "create" ? "Nueva" : "Editar"} variante`} onClose={() => setEditor(null)}>
          <VariantEditor
            key={`${editor.mode}-${editor.id ?? "new"}`}
            canAdjustStock={canAdjustStock}
            initialMode={editor.mode}
            onClose={() => setEditor(null)}
            onError={onError}
            onSaved={onSaved}
            product={product}
            selectedVariant={selectedVariant}
            token={token}
          />
        </CatalogModal>
      ) : null}
    </>
  );
}

function ProductSelector({
  isLoading,
  products,
  onCreate,
  onDelete,
  onEdit,
  onMove,
  movingProductId,
}: {
  isLoading: boolean;
  products: Product[];
  onCreate: () => void;
  onDelete?: (id: string) => Promise<void>;
  onEdit: (id: string) => void;
  onMove?: (id: string, direction: ProductMoveDirection) => Promise<void>;
  movingProductId?: string;
}) {
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const pageCount = Math.max(1, Math.ceil(products.length / pageSize));
  const visibleProducts = products.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, pageCount));
  }, [pageCount]);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">Productos</p>
          <h2 className="mt-1 text-xl font-semibold">Productos activos</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">Administra prendas, precios e imagenes desde el listado.</p>
        </div>
        <button aria-label="Crear producto" className="icon-button" onClick={onCreate} title="Crear producto" type="button">
          <PlusIcon />
        </button>
      </div>
      {isLoading ? <p className="p-5 text-sm text-zinc-500">Cargando productos...</p> : null}
      {!isLoading && products.length === 0 ? <p className="p-5 text-sm text-zinc-500">Aun no hay productos registrados.</p> : null}
      <div className="divide-y divide-zinc-100">
        {visibleProducts.map((product, index) => (
          <article className="flex flex-wrap items-center justify-between gap-4 px-5 py-4" key={product.id}>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-stone-100 text-xs font-semibold text-zinc-600">{(page - 1) * pageSize + index + 1}</span>
                <h3 className="truncate font-semibold uppercase tracking-[0.05em]">{product.name}</h3>
              </div>
              <p className="mt-1 pl-9 text-sm text-zinc-500">{formatMoney(product.basePrice, product.currency)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {onMove ? (
                <div className="mr-1 flex gap-1">
                  <button aria-label={`Subir ${product.name}`} className="icon-button" disabled={Boolean(movingProductId) || (page - 1) * pageSize + index === 0} onClick={() => void onMove(product.id, "up")} title="Subir producto" type="button">↑</button>
                  <button aria-label={`Bajar ${product.name}`} className="icon-button" disabled={Boolean(movingProductId) || (page - 1) * pageSize + index === products.length - 1} onClick={() => void onMove(product.id, "down")} title="Bajar producto" type="button">↓</button>
                </div>
              ) : null}
              <button aria-label={`Editar ${product.name}`} className="icon-button" onClick={() => onEdit(product.id)} title="Editar producto" type="button">
                <EditIcon />
              </button>
              {onDelete ? (
                <button aria-label={`Eliminar ${product.name}`} className="icon-button icon-button-danger" onClick={() => void onDelete(product.id)} title="Eliminar producto" type="button">
                  <TrashIcon />
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      <AdminPagination page={page} pageCount={pageCount} total={products.length} onPageChange={setPage} />
    </section>
  );
}

function TaxonomyManager({
  initialMode,
  initialSelectedId,
  items,
  label,
  onClose,
  token,
  type,
  onError,
  onSaved,
}: {
  initialMode: EditorMode;
  initialSelectedId?: string;
  items: Category[] | Collection[];
  label: string;
  token: string | null;
  type: TaxonomyType;
  onClose?: () => void;
  onError: (message: string) => void;
  onSaved: () => Promise<void>;
}) {
  const [mode] = useState<EditorMode>(initialMode);
  const [selectedId, setSelectedId] = useState(initialSelectedId ?? "");
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await apiRequest<CreatedResponse | void>(mode === "edit" ? `${endpoint}/${selectedId}` : endpoint, {
        method: mode === "edit" ? "PUT" : "POST",
        body: { name, description },
        token,
      });
      await onSaved();
      onClose?.();
    } catch (error) {
      onError(getErrorMessage(error, "No se pudo guardar la categoria o coleccion."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-800">{label}</p>
          <h3 className="mt-1 text-xl font-semibold">{mode === "create" ? `Nueva ${label.toLowerCase()}` : `Editar ${label.toLowerCase()}`}</h3>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            {mode === "create" ? "Registra una opcion nueva para organizar el catalogo." : "Actualiza el nombre o descripcion de una opcion existente."}
          </p>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
          {mode === "create" ? "Nuevo registro" : "Edicion"}
        </span>
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
  initialMode,
  onError,
  onClose,
  product,
  token,
  onSaved,
}: {
  categories: Category[];
  collections: Collection[];
  initialMode: EditorMode;
  onError: (message: string) => void;
  onClose?: () => void;
  product: Product | null;
  token: string | null;
  onSaved: (productId: string, mode: EditorMode) => Promise<void>;
}) {
  const [mode] = useState<EditorMode>(initialMode);
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
        onClose?.();
      }
    } catch (error) {
      onError(getErrorMessage(error, "No se pudo guardar el producto."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">Producto</p>
          <h3 className="mt-1 text-2xl font-semibold">{mode === "create" ? "Crear producto" : product?.name ?? "Selecciona un producto"}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            {mode === "create" ? "Completa los datos principales para registrar una nueva prenda." : "Estás editando el producto seleccionado en el listado de la izquierda."}
          </p>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
          {mode === "create" ? "Nuevo registro" : "Edicion"}
        </span>
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
  initialMode,
  onError,
  onClose,
  product,
  selectedVariant,
  token,
  onSaved,
}: {
  canAdjustStock: boolean;
  initialMode: EditorMode;
  onError: (message: string) => void;
  onClose?: () => void;
  product: Product | null;
  selectedVariant: ProductVariant | null;
  token: string | null;
  onSaved: (variantId: string | undefined, mode: EditorMode) => Promise<void>;
}) {
  const [mode] = useState<EditorMode>(initialMode);
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
      onClose?.();
    } catch (error) {
      onError(getErrorMessage(error, "No se pudo guardar la variante."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">Variantes</p>
          <h3 className="mt-1 text-2xl font-semibold">{product?.name ?? "Selecciona un producto"}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            {mode === "create" ? "Agrega una talla o color nuevo para este producto." : "Edita la variante marcada en el panel de la derecha."}
          </p>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
          {mode === "create" ? "Nuevo registro" : "Edicion"}
        </span>
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

function PlusIcon() {
  return <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}

function EditIcon() {
  return <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24"><path d="m5 16.5-.75 3.25L7.5 19l10.75-10.75a2.12 2.12 0 0 0-3-3L4.5 16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /><path d="m14 6 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /></svg>;
}

function TrashIcon() {
  return <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24"><path d="M4.5 7.5h15M9 7.5V5.25h6V7.5m-8.25 0 .75 12h9l.75-12M10 11v5M14 11v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>;
}

function CloseIcon() {
  return <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-zinc-800">
      {label}
      <div className="mt-2">{children}</div>
    </label>
  );
}
