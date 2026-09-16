import { useNavigate } from "react-router-dom";
import { Link } from "@/components/RouterLink";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "@/lib/auth";
import { CartNavLink } from "@/components/CartNavLink";
import { SiteFooter } from "@/components/SiteFooter";
import { WhatsappFloatingButton } from "@/components/WhatsappFloatingButton";
import { canManageCatalog } from "@/lib/roles";
import { useProductImageSource } from "@/components/useProductImageSource";
import { useStorefrontCatalog } from "@/components/useStorefrontCatalog";
import type { Product, ProductImage } from "@/lib/types";

type StorefrontProps = {
  compact?: boolean;
};

const introVideoStorageKey = "sweet-silvia-intro-video-v3";
type IntroVideoState = "checking" | "open" | "closed";

export function Storefront({ compact = false }: StorefrontProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
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
    setCategoryId,
    setCollectionId,
    setMessage,
    visibleProducts,
  } = useStorefrontCatalog();
  const [introVideoState, setIntroVideoState] = useState<IntroVideoState>(compact ? "closed" : "checking");

  useEffect(() => {
    if (compact) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      let hasSeenIntro = false;
      try {
        hasSeenIntro = window.localStorage.getItem(introVideoStorageKey) === "true";
      } catch {
        hasSeenIntro = false;
      }
      setIntroVideoState(hasSeenIntro ? "closed" : "open");
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [compact]);

  function openProduct(product: Product) {
    navigate(`/products/${product.id}`);
  }

  function handleCardAddToCart(product: Product) {
    setMessage("");
    openProduct(product);
  }

  function finishIntro() {
    try {
      window.localStorage.setItem(introVideoStorageKey, "true");
    } catch {
      // La bienvenida igual puede cerrarse si el navegador bloquea el almacenamiento.
    }
    setIntroVideoState("closed");
  }

  function skipIntro() {
    setIntroVideoState("closed");
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-[#f8f5f0] text-zinc-950">
      {!compact && introVideoState === "checking" ? <div aria-hidden="true" className="fixed inset-0 z-50 bg-zinc-950" /> : null}
      {!compact && introVideoState === "open" ? (
        <section aria-label="Presentacion de Sweet Silvia" className="fixed inset-0 z-50 overflow-hidden bg-zinc-950 text-white">
          <video
            autoPlay
            className="absolute inset-0 h-full w-full object-contain"
            muted
            onEnded={() => finishIntro()}
            playsInline
            poster="/sweet-silvia-preview-poster.jpg"
            preload="auto"
          >
            <source src="/sweet-silvia-preview.mp4" type="video/mp4" />
          </video>
          <div aria-hidden="true" className="absolute inset-0 bg-black/35" />
          <div className="relative flex min-h-full items-end justify-center px-5 pb-10 text-center sm:pb-14">
            <div className="max-w-md">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-200">Sweet Silvia</p>
              <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight sm:text-6xl">Vuelve a ti.</h1>
              <p className="mt-4 text-sm leading-6 text-white/85 sm:text-base">Descubre la nueva selección de Sweet Silvia.</p>
              <button
                className="mt-7 inline-flex min-h-12 items-center justify-center rounded-lg bg-white px-7 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-950 transition hover:bg-rose-100"
                onClick={skipIntro}
                type="button"
              >
                Ir a la tienda
              </button>
            </div>
          </div>
        </section>
      ) : null}
      <div className="bg-zinc-950 px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-white">
        Envio express disponible en Lima
      </div>

      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-[#f8f5f0]/95 backdrop-blur">
        <div className="mx-auto flex min-h-20 max-w-7xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
          <nav className="flex flex-wrap items-center gap-5 text-sm font-semibold uppercase tracking-[0.12em]">
            <Link href="/">Inicio</Link>
            <Link href="/catalog">Catalogo</Link>
          </nav>

          <Link aria-label="Ir al inicio de Sweet Silvia" href="/">
            <BrandLogo className="w-40 sm:w-44" priority />
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

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div className="min-h-[520px] bg-[url('/mock-products/vestido-floral-rosa.jpg')] bg-cover bg-center" />
        <div className="py-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-800">Nueva seleccion</p>
          <h1 className="mt-4 font-serif text-5xl font-semibold leading-tight tracking-normal sm:text-7xl">
            Prendas elegidas para volver a ti.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-zinc-600">
            Descubre vestidos, sets, blusas y piezas suaves para todos los dias. Compra como visitante y accede a tu cuenta solo cuando lo necesites.
          </p>
          <Link className="mt-8 inline-flex rounded-lg bg-zinc-950 px-8 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-white" href="#productos">
            Comprar ahora
          </Link>
        </div>
      </section>

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
        <div className="mb-7 flex flex-col gap-5 border-t border-zinc-200 pt-6 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">Seleccion actual</p>
            <h2 className="mt-1 font-serif text-2xl font-semibold leading-tight tracking-normal sm:text-3xl">{catalogTitle}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              {catalogDescription}
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-2 md:items-end">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500" htmlFor="catalog-category-filter">
              Categoria
            </label>
            <select
              className="h-10 min-w-48 rounded-lg border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-950"
              id="catalog-category-filter"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Todas las categorias</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
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

      <SiteFooter />
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

function getAccountInitial(email?: string | null) {
  return email?.trim().charAt(0) || "C";
}
