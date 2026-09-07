"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiRequest, publicAssetUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { CartNavLink } from "@/components/CartNavLink";
import { WhatsappFloatingButton } from "@/components/WhatsappFloatingButton";
import { canManageCatalog } from "@/lib/roles";
import type { Category, Collection, Product, ProductImage, ProductVariant } from "@/lib/types";

type StorefrontProps = {
  compact?: boolean;
};

const mockProducts: Product[] = [
  {
    id: "mock-blusa-satin-marfil",
    categoryId: "10000000-0000-0000-0000-000000000001",
    collectionId: "20000000-0000-0000-0000-000000000003",
    name: "Blusa Satin Marfil",
    description: "Blusa satinada de caida suave.",
    basePrice: 119.9,
    currency: "PEN",
    isActive: true,
  },
  {
    id: "mock-falda-midi-negra",
    categoryId: "10000000-0000-0000-0000-000000000003",
    collectionId: "20000000-0000-0000-0000-000000000002",
    name: "Falda Midi Negra",
    description: "Falda midi para looks de noche.",
    basePrice: 129.9,
    currency: "PEN",
    isActive: true,
  },
  {
    id: "mock-top-basico-crema",
    categoryId: "10000000-0000-0000-0000-000000000001",
    collectionId: "20000000-0000-0000-0000-000000000003",
    name: "Top Basico Crema",
    description: "Top versatil para combinar todos los dias.",
    basePrice: 69.9,
    currency: "PEN",
    isActive: true,
  },
  {
    id: "mock-set-lino-verano",
    categoryId: "10000000-0000-0000-0000-000000000001",
    collectionId: "20000000-0000-0000-0000-000000000001",
    name: "Set Lino Verano",
    description: "Set fresco de lino para temporada calida.",
    basePrice: 189.9,
    currency: "PEN",
    isActive: true,
  },
  {
    id: "mock-vestido-negro-midi",
    categoryId: "10000000-0000-0000-0000-000000000003",
    collectionId: "20000000-0000-0000-0000-000000000002",
    name: "Vestido Negro Midi",
    description: "Vestido midi elegante para noche.",
    basePrice: 169.9,
    currency: "PEN",
    isActive: true,
  },
  {
    id: "mock-chaqueta-denim-clara",
    categoryId: "10000000-0000-0000-0000-000000000002",
    collectionId: "20000000-0000-0000-0000-000000000003",
    name: "Chaqueta Denim Clara",
    description: "Chaqueta denim liviana de uso diario.",
    basePrice: 179.9,
    currency: "PEN",
    isActive: true,
  },
  {
    id: "mock-bolso-mini-rosa",
    categoryId: "10000000-0000-0000-0000-000000000004",
    collectionId: "20000000-0000-0000-0000-000000000001",
    name: "Bolso Mini Rosa",
    description: "Bolso compacto para completar el look.",
    basePrice: 89.9,
    currency: "PEN",
    isActive: true,
  },
  {
    id: "mock-enterizo-verde",
    categoryId: "10000000-0000-0000-0000-000000000003",
    collectionId: "20000000-0000-0000-0000-000000000001",
    name: "Enterizo Verde",
    description: "Enterizo fluido con corte relajado.",
    basePrice: 149.9,
    currency: "PEN",
    isActive: true,
  },
  {
    id: "mock-camisa-rayas-azul",
    categoryId: "10000000-0000-0000-0000-000000000001",
    collectionId: "20000000-0000-0000-0000-000000000003",
    name: "Camisa Rayas Azul",
    description: "Camisa fresca de manga larga.",
    basePrice: 109.9,
    currency: "PEN",
    isActive: true,
  },
  {
    id: "mock-body-rib-caramelo",
    categoryId: "10000000-0000-0000-0000-000000000001",
    collectionId: "20000000-0000-0000-0000-000000000003",
    name: "Body Rib Caramelo",
    description: "Body acanalado de fit comodo.",
    basePrice: 79.9,
    currency: "PEN",
    isActive: true,
  },
  {
    id: "mock-blazer-lino-arena",
    categoryId: "10000000-0000-0000-0000-000000000001",
    collectionId: "20000000-0000-0000-0000-000000000001",
    name: "Blazer Lino Arena",
    description: "Blazer ligero para elevar el look.",
    basePrice: 219.9,
    currency: "PEN",
    isActive: true,
  },
  {
    id: "mock-cardigan-rosa-suave",
    categoryId: "10000000-0000-0000-0000-000000000001",
    collectionId: "20000000-0000-0000-0000-000000000002",
    name: "Cardigan Rosa Suave",
    description: "Cardigan tejido de tacto suave.",
    basePrice: 139.9,
    currency: "PEN",
    isActive: true,
  },
  {
    id: "mock-pantalon-sastre-hueso",
    categoryId: "10000000-0000-0000-0000-000000000002",
    collectionId: "20000000-0000-0000-0000-000000000003",
    name: "Pantalon Sastre Hueso",
    description: "Pantalon recto para oficina o salida.",
    basePrice: 159.9,
    currency: "PEN",
    isActive: true,
  },
  {
    id: "mock-short-denim-celeste",
    categoryId: "10000000-0000-0000-0000-000000000002",
    collectionId: "20000000-0000-0000-0000-000000000001",
    name: "Short Denim Celeste",
    description: "Short denim de tiro alto.",
    basePrice: 99.9,
    currency: "PEN",
    isActive: true,
  },
  {
    id: "mock-vestido-largo-celeste",
    categoryId: "10000000-0000-0000-0000-000000000003",
    collectionId: "20000000-0000-0000-0000-000000000001",
    name: "Vestido Largo Celeste",
    description: "Vestido largo de movimiento ligero.",
    basePrice: 179.9,
    currency: "PEN",
    isActive: true,
  },
  {
    id: "mock-kimono-estampado",
    categoryId: "10000000-0000-0000-0000-000000000003",
    collectionId: "20000000-0000-0000-0000-000000000001",
    name: "Kimono Estampado",
    description: "Kimono liviano para capas de verano.",
    basePrice: 129.9,
    currency: "PEN",
    isActive: true,
  },
  {
    id: "mock-sandalias-tiras-negras",
    categoryId: "10000000-0000-0000-0000-000000000004",
    collectionId: "20000000-0000-0000-0000-000000000001",
    name: "Sandalias Tiras Negras",
    description: "Sandalias minimalistas de tiras.",
    basePrice: 119.9,
    currency: "PEN",
    isActive: true,
  },
  {
    id: "mock-lentes-carey",
    categoryId: "10000000-0000-0000-0000-000000000004",
    collectionId: "20000000-0000-0000-0000-000000000003",
    name: "Lentes Carey",
    description: "Lentes con montura carey.",
    basePrice: 69.9,
    currency: "PEN",
    isActive: true,
  },
  {
    id: "mock-cartera-camel",
    categoryId: "10000000-0000-0000-0000-000000000004",
    collectionId: "20000000-0000-0000-0000-000000000002",
    name: "Cartera Camel",
    description: "Cartera estructurada de uso diario.",
    basePrice: 149.9,
    currency: "PEN",
    isActive: true,
  },
  {
    id: "mock-vestido-slip-champagne",
    categoryId: "10000000-0000-0000-0000-000000000003",
    collectionId: "20000000-0000-0000-0000-000000000002",
    name: "Vestido Slip Champagne",
    description: "Vestido slip satinado para noche.",
    basePrice: 189.9,
    currency: "PEN",
    isActive: true,
  },
];

const useMockCatalog = process.env.NEXT_PUBLIC_ENABLE_MOCKS === "true";

export function Storefront({ compact = false }: StorefrontProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [imagesByProduct, setImagesByProduct] = useState<Record<string, ProductImage[]>>({});
  const [categoryId, setCategoryId] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<ProductVariant[]>([]);
  const [isLoadingVariants, setIsLoadingVariants] = useState(false);
  const [cartNotice, setCartNotice] = useState("");

  useEffect(() => {
    Promise.all([
      apiRequest<Category[]>("/api/categories?onlyActive=true"),
      apiRequest<Collection[]>("/api/collections?onlyActive=true"),
    ])
      .then(([nextCategories, nextCollections]) => {
        setCategories(nextCategories);
        setCollections(nextCollections);
      })
      .catch(() => setMessage("No pudimos cargar las colecciones en este momento."));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ onlyActive: "true" });
    if (categoryId) {
      params.set("categoryId", categoryId);
    }
    if (collectionId) {
      params.set("collectionId", collectionId);
    }

    let isActive = true;

    apiRequest<Product[]>(`/api/products?${params.toString()}`)
      .then((nextProducts) => {
        if (!isActive) {
          return [];
        }
        setProducts(nextProducts);
        return Promise.all(
          nextProducts.map((product) =>
            apiRequest<ProductImage[]>(`/api/product-images/product/${product.id}`).then((images) => [product.id, images] as const),
          ),
        );
      })
      .then((entries) => {
        if (isActive) {
          setImagesByProduct(Object.fromEntries(entries));
          setMessage("");
        }
      })
      .catch(() => {
        if (isActive) {
          setMessage("No pudimos cargar los productos. Intenta nuevamente en unos minutos.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingProducts(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [categoryId, collectionId]);

  const categoryNames = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const visibleProducts = useMemo(() => {
    const backendIds = new Set(products.map((product) => product.id));
    const availableMocks = useMockCatalog ? mockProducts.filter((product) => !backendIds.has(product.id)) : [];
    const allProducts = [...products, ...availableMocks];

    return allProducts.filter((product) => {
      const matchesCategory = categoryId ? product.categoryId === categoryId : true;
      const matchesCollection = collectionId ? product.collectionId === collectionId : true;
      return matchesCategory && matchesCollection;
    });
  }, [categoryId, collectionId, products]);

  const selectedImages = selectedProduct ? imagesByProduct[selectedProduct.id] ?? [] : [];

  function openProduct(product: Product) {
    setSelectedProduct(null);
    setSelectedVariants([]);
    setIsLoadingVariants(false);
    setCartNotice("");
    router.push(`/products/${product.id}`);
  }

  function handleAddToCart() {
    if (!user) {
      setCartNotice("Para agregar productos al carrito necesitas iniciar sesion.");
      return;
    }

    setCartNotice("Selecciona una talla para continuar con tu carrito.");
  }

  function handleCardAddToCart(product: Product) {
    setMessage("");
    openProduct(product);
  }

  return (
    <div className="min-h-screen bg-[#f8f5f0] text-zinc-950">
      <div className="bg-zinc-950 px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-white">
        Envio express disponible en Lima
      </div>

      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-[#f8f5f0]/95 backdrop-blur">
        <div className="mx-auto flex min-h-20 max-w-7xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
          <nav className="flex flex-wrap items-center gap-5 text-sm font-semibold uppercase tracking-[0.12em]">
            <Link href="/">Inicio</Link>
            <Link href="/catalog">Catalogo</Link>
          </nav>

          <Link href="/" className="font-serif text-3xl font-semibold tracking-normal">
            Sweet Silvia
          </Link>

          <div className="flex items-center gap-4 text-sm font-semibold uppercase tracking-[0.12em]">
            {user ? (
              <Link
                className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white/85 px-3 py-2 text-xs normal-case tracking-normal shadow-sm transition hover:border-rose-200 hover:bg-rose-50"
                href={canManageCatalog(user.role) ? "/dashboard" : "/profile"}
                title={user.email}
              >
                <span className="grid size-7 place-items-center rounded-full bg-rose-100 text-[11px] font-bold uppercase text-rose-700">
                  {getAccountInitial(user.email)}
                </span>
                <span className="hidden max-w-44 truncate text-left leading-tight sm:block">
                  <span className="block text-[11px] uppercase tracking-[0.12em] text-zinc-500">{user.role}</span>
                  <span className="block truncate text-zinc-950">{user.email}</span>
                </span>
              </Link>
            ) : (
              <Link href="/login">Ingresar</Link>
            )}
            <CartNavLink />
          </div>
        </div>
      </header>

      {!compact ? (
        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="min-h-[520px] bg-[url('https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1300&q=80')] bg-cover bg-center" />
          <div className="py-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-800">Nueva seleccion</p>
            <h1 className="mt-4 font-serif text-5xl font-semibold leading-tight tracking-normal sm:text-7xl">
              Prendas elegidas para volver a ti.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-zinc-600">
              Descubre vestidos, sets, blusas y piezas suaves para todos los dias. Compra como visitante y accede a tu cuenta solo cuando lo necesites.
            </p>
            <a className="mt-8 inline-flex rounded-lg bg-zinc-950 px-8 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-white" href="#productos">
              Comprar ahora
            </a>
          </div>
        </section>
      ) : null}

      <section id="colecciones" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-800">Catalogo</p>
            <h2 className="mt-2 font-serif text-4xl font-semibold tracking-normal">Colecciones</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className={`rounded-lg border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                collectionId === "" ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-300 bg-transparent"
              }`}
              onClick={() => setCollectionId("")}
            >
              Todo
            </button>
            {collections.slice(0, 6).map((collection) => (
              <button
                className={`rounded-lg border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                  collectionId === collection.id ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-300 bg-transparent"
                }`}
                key={collection.id}
                onClick={() => setCollectionId(collectionId === collection.id ? "" : collection.id)}
              >
                {collection.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="productos" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-serif text-4xl font-semibold tracking-normal">New arrivals</h2>
            <p className="mt-2 text-sm text-zinc-600">Piezas disponibles para explorar sin iniciar sesion.</p>
          </div>

          <select className="h-11 rounded-lg border border-zinc-300 bg-white px-3 text-sm" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Todas las categorias</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {message ? <p className="mb-4 border border-zinc-200 bg-white p-3 text-sm text-zinc-700">{message}</p> : null}

        {isLoadingProducts ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div className="h-96 animate-pulse bg-white" key={index} />
            ))}
          </div>
        ) : (
          <div className="grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {visibleProducts.map((product) => (
              <ProductCard
                categoryName={categoryNames.get(product.categoryId)}
                images={imagesByProduct[product.id] ?? []}
                key={product.id}
                onAddToCart={() => handleCardAddToCart(product)}
                onOpen={() => openProduct(product)}
                product={product}
              />
            ))}
          </div>
        )}
      </section>

      {selectedProduct ? (
        <ProductQuickView
          categoryName={categoryNames.get(selectedProduct.categoryId)}
          images={selectedImages}
          isLoadingVariants={isLoadingVariants}
          notice={cartNotice}
          onAddToCart={handleAddToCart}
          onClose={() => {
            setSelectedProduct(null);
            setCartNotice("");
          }}
          product={selectedProduct}
          variants={selectedVariants}
        />
      ) : null}
      <WhatsappFloatingButton />
    </div>
  );
}

function ProductCard({
  product,
  images,
  categoryName,
  onAddToCart,
  onOpen,
}: {
  product: Product;
  images: ProductImage[];
  categoryName?: string;
  onAddToCart: () => void;
  onOpen: () => void;
}) {
  const { imageSrc, handleImageError } = useProductImageSource(product, images);

  return (
    <article className="group cursor-pointer" onClick={onOpen}>
      <div className="relative aspect-[3/4] overflow-hidden bg-[#eee8df]">
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            onError={handleImageError}
            src={imageSrc}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center font-serif text-2xl text-zinc-400">Sweet Silvia</div>
        )}
        <button
          className="absolute inset-x-3 bottom-3 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] opacity-0 shadow-sm transition group-hover:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            onAddToCart();
          }}
        >
          Ver tallas
        </button>
      </div>
      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{categoryName ?? "Sweet Silvia"}</p>
        <h3 className="mt-1 text-sm font-semibold uppercase tracking-[0.08em]">{product.name}</h3>
        <p className="mt-1 text-sm text-zinc-700">
          S/. {product.basePrice.toFixed(2)} {product.currency}
        </p>
      </div>
    </article>
  );
}

function ProductQuickView({
  product,
  images,
  variants,
  categoryName,
  isLoadingVariants,
  notice,
  onAddToCart,
  onClose,
}: {
  product: Product;
  images: ProductImage[];
  variants: ProductVariant[];
  categoryName?: string;
  isLoadingVariants: boolean;
  notice: string;
  onAddToCart: () => void;
  onClose: () => void;
}) {
  const { imageSrc, handleImageError } = useProductImageSource(product, images);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/50 px-4 py-8" onClick={onClose}>
      <section
        aria-modal="true"
        className="grid max-h-[92vh] w-full max-w-5xl overflow-hidden bg-[#f8f5f0] shadow-2xl md:grid-cols-[0.95fr_1.05fr]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="min-h-[360px] bg-[#eee8df] md:min-h-[620px]">
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={product.name} className="h-full w-full object-cover" onError={handleImageError} src={imageSrc} />
          ) : (
            <div className="grid h-full place-items-center font-serif text-3xl text-zinc-400">Sweet Silvia</div>
          )}
        </div>

        <div className="overflow-y-auto p-6 sm:p-8">
          <button className="ml-auto block text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500" onClick={onClose}>
            Cerrar
          </button>

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">{categoryName ?? "Sweet Silvia"}</p>
          <h2 className="mt-3 font-serif text-4xl font-semibold tracking-normal">{product.name}</h2>
          <p className="mt-3 text-lg font-semibold">
            S/. {product.basePrice.toFixed(2)} {product.currency}
          </p>
          <p className="mt-5 leading-7 text-zinc-600">
            {product.description ?? "Prenda seleccionada para completar tu look Sweet Silvia."}
          </p>

          <div className="mt-8">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em]">Tallas disponibles</h3>
            {isLoadingVariants ? <p className="mt-3 text-sm text-zinc-500">Cargando tallas...</p> : null}
            {!isLoadingVariants && variants.length === 0 ? <p className="mt-3 text-sm text-zinc-500">Tallas por confirmar.</p> : null}
            {variants.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {variants.map((variant) => (
                  <button className="min-w-20 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-left text-sm font-semibold" key={variant.id}>
                    <span className="block">{variant.size}</span>
                    <span className="mt-1 block text-xs font-normal text-zinc-500">{variant.color}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button className="mt-8 w-full bg-zinc-950 px-5 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-white" onClick={onAddToCart}>
            Anadir al carrito
          </button>

          {notice ? <p className="mt-4 border border-rose-200 bg-white p-3 text-sm text-rose-800">{notice}</p> : null}
        </div>
      </section>
    </div>
  );
}

function useProductImageSource(product: Product, images: ProductImage[]) {
  const fallbackImage = getMockProductImage(product.name);
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

function getMockProductImage(productName: string) {
  const normalizedName = productName.toLowerCase();

  if (normalizedName.includes("polo") || normalizedName.includes("oversize")) {
    return "/mock-products/polo-oversize-blanco.jpg";
  }

  if (normalizedName.includes("jean") || normalizedName.includes("wide leg")) {
    return "/mock-products/jean-wide-leg-azul.jpg";
  }

  if (normalizedName.includes("vestido") || normalizedName.includes("floral")) {
    return "/mock-products/vestido-floral-rosa.jpg";
  }

  if (normalizedName.includes("gorra")) {
    return "/mock-products/gorra-sweet-silvia.jpg";
  }

  if (normalizedName.includes("blusa")) {
    return "/mock-products/blusa-satin-marfil.jpg";
  }

  if (normalizedName.includes("falda")) {
    return "/mock-products/falda-midi-negra.jpg";
  }

  if (normalizedName.includes("top")) {
    return "/mock-products/top-basico-crema.jpg";
  }

  if (normalizedName.includes("set")) {
    return "/mock-products/set-lino-verano.jpg";
  }

  if (normalizedName.includes("negro")) {
    return "/mock-products/vestido-negro-midi.jpg";
  }

  if (normalizedName.includes("chaqueta") || normalizedName.includes("denim")) {
    return "/mock-products/chaqueta-denim-clara.jpg";
  }

  if (normalizedName.includes("bolso")) {
    return "/mock-products/bolso-mini-rosa.jpg";
  }

  if (normalizedName.includes("enterizo")) {
    return "/mock-products/enterizo-verde.jpg";
  }

  if (normalizedName.includes("camisa")) {
    return "/mock-products/camisa-rayas-azul.jpg";
  }

  if (normalizedName.includes("body")) {
    return "/mock-products/body-rib-caramelo.jpg";
  }

  if (normalizedName.includes("blazer")) {
    return "/mock-products/blazer-lino-arena.jpg";
  }

  if (normalizedName.includes("cardigan")) {
    return "/mock-products/cardigan-rosa-suave.jpg";
  }

  if (normalizedName.includes("pantalon") || normalizedName.includes("sastre")) {
    return "/mock-products/pantalon-sastre-hueso.jpg";
  }

  if (normalizedName.includes("short")) {
    return "/mock-products/short-denim-celeste.jpg";
  }

  if (normalizedName.includes("largo") || normalizedName.includes("celeste")) {
    return "/mock-products/vestido-largo-celeste.jpg";
  }

  if (normalizedName.includes("kimono")) {
    return "/mock-products/kimono-estampado.jpg";
  }

  if (normalizedName.includes("sandalias")) {
    return "/mock-products/sandalias-tiras-negras.jpg";
  }

  if (normalizedName.includes("lentes")) {
    return "/mock-products/lentes-carey.jpg";
  }

  if (normalizedName.includes("cartera")) {
    return "/mock-products/cartera-camel.jpg";
  }

  if (normalizedName.includes("slip") || normalizedName.includes("champagne")) {
    return "/mock-products/vestido-slip-champagne.jpg";
  }

  return "/mock-products/vestido-floral-rosa.jpg";
}

function isPlaceholderImage(url: string) {
  return url.includes("placehold.co") || url.includes("placeholder");
}

function getAccountInitial(email?: string | null) {
  return email?.trim().charAt(0) || "C";
}
