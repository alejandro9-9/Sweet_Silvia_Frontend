"use client";

import { useNavigate, useParams } from "react-router-dom";
import { Link } from "@/components/RouterLink";
import { useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { apiRequest, publicAssetUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { addGuestCartItem, toGuestCartItem } from "@/lib/cart";
import { findMockProduct, getMockProductImage, isPlaceholderImage, mockVariantsByProduct } from "@/lib/mock-catalog";
import { getVariantEffectiveCurrency, getVariantEffectivePrice } from "@/lib/pricing";
import { clientEnv } from "@/lib/env";
import { CartNavLink } from "@/components/CartNavLink";
import type { Product, ProductImage, ProductVariant } from "@/lib/types";

type GalleryImage = {
  src: string;
  label: string;
};

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const productId = params.id ?? "";
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    let isActive = true;
    const mockProduct = clientEnv.enableMocks ? findMockProduct(productId) : null;

    const productRequest = mockProduct
      ? Promise.resolve(mockProduct)
      : apiRequest<Product>(`/api/products/${productId}`);
    const imagesRequest = mockProduct
      ? Promise.resolve<ProductImage[]>([])
      : apiRequest<ProductImage[]>(`/api/product-images/product/${productId}`).catch(() => []);
    const variantsRequest = mockProduct
      ? Promise.resolve(mockVariantsByProduct[productId] ?? [])
      : apiRequest<ProductVariant[]>(`/api/product-variants/product/${productId}?onlyActive=true`).catch(() => []);

    Promise.all([productRequest, imagesRequest, variantsRequest])
      .then(([nextProduct, nextImages, nextVariants]) => {
        if (!isActive) {
          return;
        }

        setProduct(nextProduct);
        setImages(nextImages);
        setVariants(nextVariants);
        setSelectedVariantId(nextVariants[0]?.id ?? "");
        setSelectedImageIndex(0);
      })
      .catch(() => {
        if (isActive) {
          setMessage("No pudimos abrir este producto.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [productId]);
  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) ?? null,
    [selectedVariantId, variants],
  );
  const fallbackImage = product ? getMockProductImage(product.name) : null;
  const galleryImages = useMemo(() => {
    if (!product) {
      return [];
    }

    const backendImages = images
      .filter((image) => !isPlaceholderImage(image.url))
      .sort(sortGalleryImages)
      .map((image) => ({
        src: publicAssetUrl(image.url),
        label: image.altText ?? product.name,
      }));

    if (backendImages.length > 0) {
      return uniqueGalleryImages(backendImages);
    }

    if (!findMockProduct(product.id)) {
      return fallbackImage
        ? [
            {
              src: fallbackImage,
              label: product.name,
            },
          ]
        : [];
    }

    const mockImages = getMockGalleryImages(product.name).map((src, index) => ({
      src,
      label: `${product.name} vista ${index + 1}`,
    }));

    return uniqueGalleryImages(mockImages);
  }, [fallbackImage, images, product]);
  const imageSrc = galleryImages[selectedImageIndex]?.src ?? galleryImages[0]?.src ?? fallbackImage;
  const activeImageLabel = galleryImages[selectedImageIndex]?.label ?? product?.name ?? "Sweet Silvia";
  const cartImageSrc = galleryImages[0]?.src ?? fallbackImage;

  useEffect(() => {
    if (selectedImageIndex < galleryImages.length) {
      return;
    }

    Promise.resolve().then(() => setSelectedImageIndex(0));
  }, [galleryImages.length, selectedImageIndex]);

  useEffect(() => {
    if (!selectedVariantId) {
      return;
    }

    const variantImage = images
      .filter((image) => image.productVariantId === selectedVariantId && !isPlaceholderImage(image.url))
      .sort(sortGalleryImages)[0];
    if (!variantImage) {
      return;
    }

    const variantImageIndex = galleryImages.findIndex((image) => image.src === publicAssetUrl(variantImage.url));
    if (variantImageIndex < 0) {
      return;
    }

    setSelectedImageIndex((currentIndex) => (currentIndex === variantImageIndex ? currentIndex : variantImageIndex));
  }, [galleryImages, images, selectedVariantId]);

  const unitPrice = product ? getVariantEffectivePrice(product, selectedVariant) : 0;
  const unitCurrency = product ? getVariantEffectiveCurrency(product, selectedVariant) : "PEN";
  const subtotal = unitPrice * quantity;
  const whatsappHref = product
    ? buildWhatsappHref({
        phone: clientEnv.whatsappPhone ?? "51941872197",
        productName: product.name,
        quantity,
        size: selectedVariant?.size ?? "Talla unica",
        color: selectedVariant?.color ?? "Color unico",
        unitPrice,
        currency: unitCurrency,
      })
    : "#";

  function addToCart() {
    if (!product || !selectedVariant) {
      setMessage("Selecciona una talla y un color antes de agregar el producto.");
      return;
    }

    addGuestCartItem(
      toGuestCartItem({
        product,
        variant: selectedVariant,
        imageUrl: cartImageSrc,
        quantity,
      }),
    );
    setMessage("Producto agregado al carrito.");
    navigate("/cart");
  }

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f8f5f0] text-zinc-500">
        Cargando producto...
      </main>
    );
  }

  if (!product) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f8f5f0] px-4 text-center">
        <div>
          <h1 className="font-serif text-4xl font-semibold">Producto no disponible</h1>
          <Link className="mt-5 inline-flex bg-zinc-950 px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white" href="/catalog">
            Volver al catalogo
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f5f0] text-zinc-950">
      <div className="bg-zinc-950 px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-white">
        Delivery en Lima y envios por Olva a provincia
      </div>
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-[#f8f5f0]/95 backdrop-blur">
        <div className="mx-auto flex min-h-20 max-w-7xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
          <nav className="flex items-center gap-5 text-sm font-semibold uppercase tracking-[0.12em]">
            <Link href="/">Inicio</Link>
            <Link href="/catalog">Catalogo</Link>
          </nav>
          <Link aria-label="Ir al inicio de Sweet Silvia" href="/">
            <BrandLogo className="w-40 sm:w-44" priority />
          </Link>
          <div className="flex items-center gap-4 text-sm font-semibold uppercase tracking-[0.12em]">
            {user ? (
              <Link className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/70 px-4 py-2 shadow-sm transition hover:border-zinc-950" href="/dashboard">
                <AccountIcon />
                Cuenta
              </Link>
            ) : (
              <Link className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/70 px-4 py-2 shadow-sm transition hover:border-zinc-950" href="/login">
                <AccountIcon />
                Ingresar
              </Link>
            )}
            <CartNavLink />
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,0.96fr)_minmax(440px,0.82fr)] lg:gap-14">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="grid gap-3 lg:grid-cols-[88px_minmax(0,1fr)]">
            <div className="order-2 flex gap-3 overflow-x-auto lg:order-1 lg:max-h-[720px] lg:flex-col lg:overflow-y-auto">
              {galleryImages.map((image, index) => (
                <button
                  aria-label={`Ver imagen ${index + 1} de ${product.name}`}
                  className={`h-24 w-20 shrink-0 overflow-hidden rounded-lg border bg-white transition lg:h-28 lg:w-full ${
                    selectedImageIndex === index ? "border-zinc-950 ring-2 ring-zinc-950/15" : "border-zinc-200 hover:border-zinc-950"
                  }`}
                  key={image.src}
                  onClick={() => setSelectedImageIndex(index)}
                  type="button"
                >
                  <ProductImageWithFallback
                    alt={image.label}
                    className="h-full w-full object-cover"
                    fallbackSrc={getMockGalleryImages(product.name)[index % 3] ?? fallbackImage ?? undefined}
                    src={image.src}
                  />
                </button>
              ))}
            </div>

            <div className="relative order-1 overflow-hidden rounded-lg bg-[#e7dfd4] lg:order-2">
              {imageSrc ? (
                <ProductImageWithFallback
                  alt={activeImageLabel}
                  className="aspect-[4/5] min-h-[560px] w-full object-cover"
                  fallbackSrc={getMockGalleryImages(product.name)[selectedImageIndex % 3] ?? fallbackImage ?? undefined}
                  key={imageSrc}
                  src={imageSrc}
                />
              ) : (
                <div className="grid aspect-[4/5] min-h-[560px] place-items-center font-serif text-4xl text-zinc-400">Sweet Silvia</div>
              )}
              <div className="absolute left-4 top-4 rounded-md bg-white/90 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] shadow-sm">
                New arrival
              </div>
              <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-zinc-950/88 px-5 py-4 text-white backdrop-blur">
                <p className="text-sm font-semibold uppercase tracking-[0.12em]">Sweet Silvia fit</p>
                <p className="text-xs uppercase tracking-[0.12em]">
                  {selectedImageIndex + 1}/{galleryImages.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="pb-10">
          <div className="border-b border-zinc-200 pb-6">
            <Link href="/catalog" className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Volver al catalogo
            </Link>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-rose-800">Edicion seleccionada</p>
            <h1 className="mt-3 font-serif text-5xl font-semibold leading-tight tracking-normal sm:text-6xl">{product.name}</h1>
            <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
              <p className="text-2xl font-semibold">
                S/. {unitPrice.toFixed(2)} {unitCurrency}
              </p>
              <span className="rounded-md border border-rose-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-rose-800">
                Disponible online
              </span>
            </div>
            <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-600">
              {product.description ?? "Prenda seleccionada para completar tu look Sweet Silvia con una silueta comoda y facil de combinar."}
            </p>
          </div>

          <section className="mt-7">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Seleccion</p>
                <h2 className="mt-1 font-serif text-3xl font-semibold tracking-normal">Talla y color</h2>
              </div>
              {selectedVariant ? <p className="text-sm text-zinc-500">SKU {selectedVariant.sku}</p> : null}
            </div>
            {variants.length === 0 ? (
              <p className="mt-3 rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500">Talla unica o por confirmar.</p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {variants.map((variant) => (
                  <button
                    className={`rounded-lg border px-4 py-4 text-left transition ${
                      selectedVariantId === variant.id ? "border-zinc-950 bg-zinc-950 text-white shadow-md" : "border-zinc-200 bg-white hover:border-zinc-950 hover:shadow-sm"
                    }`}
                    key={variant.id}
                    onClick={() => setSelectedVariantId(variant.id)}
                  >
                    <span className="block text-lg font-semibold">{variant.size}</span>
                    <span className="mt-1 block text-sm">{variant.color}</span>
                    <span className="mt-3 block text-sm font-semibold">
                      S/. {getVariantEffectivePrice(product, variant).toFixed(2)} {getVariantEffectiveCurrency(product, variant)}
                    </span>
                    <span className="mt-2 block text-xs uppercase tracking-[0.12em] opacity-70">{variant.physicalStock} en stock</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="mt-8 border-t border-zinc-200 pt-6">
            <div className="grid gap-4 rounded-lg bg-white p-5 shadow-sm sm:grid-cols-[140px_1fr]">
              <div className="flex h-14 items-center justify-between overflow-hidden rounded-lg border border-zinc-300 bg-[#f8f5f0]">
                <button className="h-full px-4 text-xl" onClick={() => setQuantity((current) => Math.max(1, current - 1))} type="button">
                  -
                </button>
                <span className="text-sm font-semibold">{quantity}</span>
                <button className="h-full px-4 text-xl" onClick={() => setQuantity((current) => current + 1)} type="button">
                  +
                </button>
              </div>
              <button className="inline-flex h-14 items-center justify-center gap-3 rounded-lg bg-zinc-950 px-6 text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-rose-900" onClick={addToCart} type="button">
                <ShoppingBagIcon />
                Agregar al carrito
              </button>
            </div>
            <a
              className="mt-3 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-lg bg-[#128c7e] px-6 py-4 text-center text-sm font-semibold uppercase tracking-[0.12em] text-white shadow-sm transition hover:bg-[#0f766c]"
              href={whatsappHref}
              rel="noreferrer"
              target="_blank"
            >
              <WhatsappIcon />
              Compra este producto por WhatsApp
            </a>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-lg border border-zinc-200 bg-white p-4 sm:col-span-2">
                <p className="text-zinc-500">Subtotal</p>
                <p className="mt-1 font-semibold">
                  S/. {subtotal.toFixed(2)} {unitCurrency}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-950 bg-zinc-950 p-4 text-white">
                <p className="text-zinc-300">Siguiente paso</p>
                <p className="mt-1 font-semibold">Envio en carrito</p>
              </div>
            </div>
          </section>

          {message ? <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-700">{message}</p> : null}

          <section className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ["Material", "Tela suave y fresca para uso diario."],
              ["Cuidado", "Lavar en frio y secar a la sombra."],
              ["Cambios", "Coordinacion por disponibilidad de stock."],
            ].map(([title, body]) => (
              <div className="border-t border-zinc-300 pt-4" key={title}>
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{body}</p>
              </div>
            ))}
          </section>
        </div>
      </section>
    </main>
  );
}

function uniqueGalleryImages(images: GalleryImage[]) {
  const seen = new Set<string>();
  return images.filter((image) => {
    if (seen.has(image.src)) {
      return false;
    }

    seen.add(image.src);
    return true;
  });
}

function sortGalleryImages(firstImage: ProductImage, secondImage: ProductImage) {
  if (firstImage.isMain !== secondImage.isMain) {
    return firstImage.isMain ? -1 : 1;
  }

  return firstImage.order - secondImage.order || firstImage.id.localeCompare(secondImage.id);
}

function buildWhatsappHref({
  phone,
  productName,
  quantity,
  size,
  color,
  unitPrice,
  currency,
}: {
  phone: string;
  productName: string;
  quantity: number;
  size: string;
  color: string;
  unitPrice: number;
  currency: string;
}) {
  const message = [
    "Hola Sweet Silvia, quiero comprar este producto:",
    `Producto: ${productName}`,
    `Talla: ${size}`,
    `Color: ${color}`,
    `Cantidad: ${quantity}`,
    `Precio unitario: S/. ${unitPrice.toFixed(2)} ${currency}`,
  ].join("\n");

  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

function AccountIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path d="M12 12.5a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.75 20.25a7.25 7.25 0 0 1 14.5 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function ShoppingBagIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="M6.75 8.5h10.5l.75 11H6l.75-11Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M9 8.5a3 3 0 0 1 6 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function WhatsappIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M5.35 18.7 6.2 15.8a7.15 7.15 0 1 1 2.25 2.05l-3.1.85Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M9.4 8.75c.18-.37.32-.38.56-.38h.45c.14 0 .34.04.48.36.18.42.58 1.42.62 1.52.05.1.08.24-.02.39-.2.29-.43.52-.6.73-.1.13-.2.25-.08.45.32.55.71 1.05 1.2 1.47.55.48 1.02.64 1.22.72.2.08.34.07.47-.08.18-.2.53-.62.68-.84.15-.22.31-.18.52-.1.22.08 1.37.64 1.6.76.24.12.4.18.46.28.06.1.06.58-.14 1.13-.2.56-1.14 1.07-1.58 1.1-.42.03-.95.15-3.2-.78-2.7-1.12-4.4-3.88-4.54-4.06-.13-.18-1.08-1.44-1.08-2.75 0-1.3.68-1.95.92-2.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function getMockGalleryImages(productName: string) {
  const mainImage = getMockProductImage(productName);
  const normalizedName = productName.toLowerCase();

  if (normalizedName.includes("gorra")) {
    return [mainImage, "/mock-products/lentes-carey.jpg", "/mock-products/cartera-camel.jpg"];
  }

  if (normalizedName.includes("jean") || normalizedName.includes("denim") || normalizedName.includes("pantalon")) {
    return [mainImage, "/mock-products/short-denim-celeste.jpg", "/mock-products/chaqueta-denim-clara.jpg"];
  }

  if (normalizedName.includes("bolso") || normalizedName.includes("cartera") || normalizedName.includes("lentes") || normalizedName.includes("sandalias")) {
    return [mainImage, "/mock-products/bolso-mini-rosa.jpg", "/mock-products/sandalias-tiras-negras.jpg"];
  }

  if (normalizedName.includes("vestido") || normalizedName.includes("falda") || normalizedName.includes("enterizo")) {
    return [mainImage, "/mock-products/vestido-slip-champagne.jpg", "/mock-products/vestido-largo-celeste.jpg"];
  }

  return [mainImage, "/mock-products/blusa-satin-marfil.jpg", "/mock-products/top-basico-crema.jpg"];
}

function ProductImageWithFallback({
  src,
  fallbackSrc,
  alt,
  className,
}: {
  src: string;
  fallbackSrc?: string;
  alt: string;
  className: string;
}) {
  const [fallbackState, setFallbackState] = useState<{ source: string; useFallback: boolean }>({ source: src, useFallback: false });
  const displaySrc = fallbackState.source === src && fallbackState.useFallback && fallbackSrc ? fallbackSrc : src;

  return (
    <img
      alt={alt}
      className={className}
      onError={() => {
        if (fallbackSrc && fallbackState.source === src && !fallbackState.useFallback) {
          setFallbackState({ source: src, useFallback: true });
        }
      }}
      src={displaySrc}
    />
  );
}
