"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest, publicAssetUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canAdminister } from "@/lib/roles";
import type { Order, Payment, Product, ProductImage, ProductVariant, UploadResult } from "@/lib/types";

type ProductImageDraft = {
  productVariantId: string;
  altText: string;
  order: number;
  isMain: boolean;
};

export function ProductImageUploadForm() {
  const { token, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [imageDrafts, setImageDrafts] = useState<Record<string, ProductImageDraft>>({});
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [altText, setAltText] = useState("");
  const [isMain, setIsMain] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [savingImageId, setSavingImageId] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewObjectUrlRef = useRef("");
  const selectedProduct = useMemo(() => products.find((product) => product.id === productId) ?? null, [productId, products]);
  const canDeleteImages = Boolean(user && canAdminister(user.role));

  useEffect(() => {
    apiRequest<Product[]>("/api/products?onlyActive=true", { token })
      .then(setProducts)
      .catch((error: Error) => setMessage(error.message));
  }, [token]);

  useEffect(() => {
    if (!productId) {
      const timeoutId = window.setTimeout(() => {
        setVariants([]);
        setImages([]);
        setImageDrafts({});
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    let isActive = true;
    const timeoutId = window.setTimeout(() => {
      Promise.all([
        apiRequest<ProductVariant[]>(`/api/product-variants/product/${productId}?onlyActive=true`, { token }),
        apiRequest<ProductImage[]>(`/api/product-images/product/${productId}`, { token }),
      ])
        .then(([nextVariants, nextImages]) => {
          if (!isActive) {
            return;
          }
          setVariants(nextVariants);
          setImages(sortProductImages(nextImages));
          setImageDrafts(createImageDrafts(nextImages));
        })
        .catch((error: Error) => {
          if (isActive) {
            setMessage(error.message);
          }
        });
    }, 0);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [productId, token]);

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    };
  }, []);

  async function refreshImages(successMessage?: string) {
    if (!productId) {
      return;
    }

    const nextImages = await apiRequest<ProductImage[]>(`/api/product-images/product/${productId}`, { token });
    setImages(sortProductImages(nextImages));
    setImageDrafts(createImageDrafts(nextImages));
    if (successMessage) {
      setMessage(successMessage);
    }
  }

  function updateImageDraft(imageId: string, changes: Partial<ProductImageDraft>) {
    setImageDrafts((currentDrafts) => ({
      ...currentDrafts,
      [imageId]: {
        ...currentDrafts[imageId],
        ...changes,
      },
    }));
  }

  async function saveImage(image: ProductImage, draft: ProductImageDraft, successMessage = "Imagen actualizada.") {
    setSavingImageId(image.id);
    try {
      await apiRequest<void>(`/api/product-images/${image.id}`, {
        method: "PUT",
        body: {
          productVariantId: draft.productVariantId || null,
          url: image.url,
          altText: draft.altText || null,
          order: Number(draft.order),
          isMain: draft.isMain,
        },
        token,
      });
      await refreshImages(successMessage);
    } finally {
      setSavingImageId("");
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.currentTarget.files?.item(0) ?? null;
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = "";
    }

    setFile(selectedFile);
    const nextPreviewUrl = selectedFile ? URL.createObjectURL(selectedFile) : "";
    previewObjectUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
    setResult(null);
    setMessage("");
  }

  function clearSelectedFile() {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = "";
    }
    setFile(null);
    setPreviewUrl("");
    setFileInputKey((currentKey) => currentKey + 1);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function moveImage(image: ProductImage, direction: "up" | "down") {
    const currentIndex = images.findIndex((item) => item.id === image.id);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const targetImage = images[targetIndex];
    const draft = imageDrafts[image.id];
    const targetDraft = targetImage ? imageDrafts[targetImage.id] : null;

    if (!targetImage || !draft || !targetDraft) {
      return;
    }

    setSavingImageId(image.id);
    try {
      await apiRequest<void>(`/api/product-images/${image.id}`, {
        method: "PUT",
        body: {
          productVariantId: draft.productVariantId || null,
          url: image.url,
          altText: draft.altText || null,
          order: targetDraft.order,
          isMain: draft.isMain,
        },
        token,
      });
      await apiRequest<void>(`/api/product-images/${targetImage.id}`, {
        method: "PUT",
        body: {
          productVariantId: targetDraft.productVariantId || null,
          url: targetImage.url,
          altText: targetDraft.altText || null,
          order: draft.order,
          isMain: targetDraft.isMain,
        },
        token,
      });
      await refreshImages("Orden actualizado.");
    } finally {
      setSavingImageId("");
    }
  }

  async function deleteImage(imageId: string) {
    setSavingImageId(imageId);
    try {
      await apiRequest<void>(`/api/product-images/${imageId}`, {
        method: "DELETE",
        token,
      });
      await refreshImages("Imagen quitada del producto.");
    } finally {
      setSavingImageId("");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !productId) {
      setMessage("Selecciona un producto y un archivo.");
      return;
    }

    const formData = new FormData();
    formData.append("productId", productId);
    if (variantId) {
      formData.append("productVariantId", variantId);
    }
    formData.append("altText", altText);
    formData.append("order", String(images.length + 1));
    formData.append("isMain", String(isMain));
    formData.append("file", file);

    setIsUploading(true);
    setMessage("");
    setResult(null);
    try {
      const upload = await apiRequest<UploadResult>("/api/product-images/upload", {
        method: "POST",
        body: formData,
        token,
      });
      setResult(upload);
      setMessage("Imagen subida y asociada al producto.");
      clearSelectedFile();
      setIsMain(false);
      await refreshImages();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo subir la imagen.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <form className="h-fit space-y-5 rounded-2xl border border-rose-100 bg-white/90 p-6 shadow-sm" onSubmit={handleSubmit}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Carga</p>
          <h2 className="mt-1 text-xl font-semibold">Nueva imagen</h2>
          <p className="mt-1 text-sm text-zinc-500">Formatos permitidos: JPG, PNG y WEBP.</p>
        </div>

        <label className="block text-sm font-medium">
          Producto
          <select
            className="admin-input mt-2"
            value={productId}
            onChange={(event) => {
              setProductId(event.target.value);
              setVariantId("");
            }}
          >
            <option value="">Seleccionar producto</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium">
          Variante
          <select className="admin-input mt-2" value={variantId} onChange={(event) => setVariantId(event.target.value)}>
            <option value="">Sin variante especifica</option>
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.size} - {variant.color} - {variant.sku}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Texto alternativo
            <input className="admin-input mt-2" value={altText} onChange={(event) => setAltText(event.target.value)} />
          </label>
          <div className="rounded-xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-sm">
            <p className="font-medium">Orden automatico</p>
            <p className="mt-1 text-zinc-500">Nueva posicion: {images.length + 1}</p>
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-sm font-medium">
          <input checked={isMain} type="checkbox" onChange={(event) => setIsMain(event.target.checked)} />
          Imagen principal
        </label>

        <label className="block text-sm font-medium">
          Archivo
          <input
            key={fileInputKey}
            ref={fileInputRef}
            className="mt-2 w-full rounded-xl border border-dashed border-rose-200 bg-white px-3 py-3 text-sm"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            type="file"
            onChange={handleFileChange}
          />
        </label>

        {previewUrl ? (
          <div className="overflow-hidden rounded-2xl border border-rose-100 bg-stone-50">
            <div className="relative h-72 w-full bg-stone-100">
              <Image
                alt={altText || file?.name || "Vista previa de imagen"}
                className="object-cover"
                fill
                src={previewUrl}
                unoptimized
              />
            </div>
            <div className="border-t border-rose-100 bg-white px-4 py-3">
              <p className="truncate text-sm font-semibold text-zinc-950">{file?.name}</p>
              <p className="mt-1 text-xs text-zinc-500">Vista previa antes de subir</p>
            </div>
          </div>
        ) : null}

        <button className="admin-primary-button w-full" disabled={isUploading} type="submit">
          {isUploading ? "Subiendo..." : "Subir imagen"}
        </button>

        {message ? <p className="rounded-xl border border-rose-100 bg-rose-50/60 p-3 text-sm text-zinc-700">{message}</p> : null}
        {result ? (
          <a className="block text-sm font-medium text-rose-700" href={publicAssetUrl(result.url)} target="_blank">
            Ver archivo subido
          </a>
        ) : null}
      </form>

      <section className="rounded-2xl border border-rose-100 bg-white/90 shadow-sm">
        <div className="border-b border-rose-100 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Galeria</p>
          <h2 className="mt-1 text-xl font-semibold">{selectedProduct ? selectedProduct.name : "Selecciona un producto"}</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-500">Edita el orden, define la imagen principal o relaciona fotos con variantes.</p>
        </div>

        {!productId ? <p className="p-6 text-sm text-zinc-500">Selecciona un producto para ver sus imagenes.</p> : null}
        {productId && images.length === 0 ? <p className="p-6 text-sm text-zinc-500">Este producto aun no tiene imagenes registradas.</p> : null}

        <div className="grid gap-4 p-4 md:grid-cols-2">
          {images.map((image, index) => {
            const draft = imageDrafts[image.id];
            return draft ? (
              <ProductImageCard
                canDelete={canDeleteImages}
                draft={draft}
                image={image}
                isFirst={index === 0}
                isLast={index === images.length - 1}
                isSaving={savingImageId === image.id}
                key={image.id}
                variants={variants}
                onDelete={() => deleteImage(image.id)}
                onMoveDown={() => moveImage(image, "down")}
                onMoveUp={() => moveImage(image, "up")}
                onSave={() => saveImage(image, draft)}
                onUpdate={(changes) => {
                  if (changes.isMain) {
                    setImageDrafts((currentDrafts) =>
                      Object.fromEntries(
                        Object.entries(currentDrafts).map(([draftImageId, currentDraft]) => [
                          draftImageId,
                          {
                            ...currentDraft,
                            isMain: draftImageId === image.id,
                          },
                        ]),
                      ),
                    );
                    return;
                  }

                  updateImageDraft(image.id, changes);
                }}
              />
            ) : null;
          })}
        </div>
      </section>
    </section>
  );
}

function ProductImageCard({
  canDelete,
  draft,
  image,
  isFirst,
  isLast,
  isSaving,
  variants,
  onDelete,
  onMoveDown,
  onMoveUp,
  onSave,
  onUpdate,
}: {
  canDelete: boolean;
  draft: ProductImageDraft;
  image: ProductImage;
  isFirst: boolean;
  isLast: boolean;
  isSaving: boolean;
  variants: ProductVariant[];
  onDelete: () => Promise<void>;
  onMoveDown: () => Promise<void>;
  onMoveUp: () => Promise<void>;
  onSave: () => Promise<void>;
  onUpdate: (changes: Partial<ProductImageDraft>) => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="relative aspect-[4/5] bg-stone-100">
        <Image alt={image.altText ?? "Imagen de producto"} className="object-cover" fill sizes="(min-width: 768px) 360px, 100vw" src={publicAssetUrl(image.url)} unoptimized />
        {draft.isMain ? (
          <span className="absolute left-3 top-3 rounded-full bg-rose-700 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
            Principal
          </span>
        ) : null}
      </div>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <button className="admin-secondary-button min-h-10 px-3 py-2" disabled={isFirst || isSaving} onClick={onMoveUp} type="button">
            Subir
          </button>
          <button className="admin-secondary-button min-h-10 px-3 py-2" disabled={isLast || isSaving} onClick={onMoveDown} type="button">
            Bajar
          </button>
        </div>

        <label className="block text-sm font-medium">
          Variante relacionada
          <select className="admin-input mt-2" value={draft.productVariantId} onChange={(event) => onUpdate({ productVariantId: event.target.value })}>
            <option value="">Producto general</option>
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.size} - {variant.color} - {variant.sku}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium">
          Texto alternativo
          <input className="admin-input mt-2" value={draft.altText} onChange={(event) => onUpdate({ altText: event.target.value })} />
        </label>

        <label className="flex items-center gap-3 rounded-xl bg-rose-50/70 px-4 py-3 text-sm font-medium">
          <input checked={draft.isMain} name="main-product-image" type="radio" onChange={() => onUpdate({ isMain: true })} />
          Usar como principal
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <button className="admin-primary-button min-h-10 px-3 py-2" disabled={isSaving} onClick={onSave} type="button">
            Guardar
          </button>
          {canDelete ? (
            <button className="admin-secondary-button min-h-10 border-rose-200 px-3 py-2 text-rose-700 hover:border-rose-500" disabled={isSaving} onClick={onDelete} type="button">
              Quitar
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function sortProductImages(images: ProductImage[]) {
  return [...images].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
}

function createImageDrafts(images: ProductImage[]) {
  const sortedImages = sortProductImages(images);
  const mainImageId = sortedImages.find((image) => image.isMain)?.id ?? sortedImages[0]?.id;

  return sortedImages.reduce<Record<string, ProductImageDraft>>((drafts, image, index) => {
    drafts[image.id] = {
      productVariantId: image.productVariantId ?? "",
      altText: image.altText ?? "",
      order: index + 1,
      isMain: image.id === mainImageId,
    };
    return drafts;
  }, {});
}

type PaymentReceiptUploadFormProps = {
  fixedOrder?: Order;
  fixedPayment?: Payment;
  onUploaded?: () => void | Promise<void>;
  submitLabel?: string;
};

export function PaymentReceiptUploadForm({ fixedOrder, fixedPayment, onUploaded, submitLabel }: PaymentReceiptUploadFormProps = {}) {
  const { token } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [ordersById, setOrdersById] = useState<Map<string, Order>>(new Map());
  const [paymentId, setPaymentId] = useState("");
  const [operationCode, setOperationCode] = useState("");
  const [declaredAmount, setDeclaredAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("Selecciona una orden abierta y adjunta el comprobante.");
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);
  const eligiblePayments = useMemo(() => payments.filter((payment) => isPaymentOpenForReceipt(payment, ordersById.get(payment.orderId))), [ordersById, payments]);
  const isFixedPayment = Boolean(fixedPayment);

  useEffect(() => {
    let isActive = true;

    if (fixedPayment) {
      const timeoutId = window.setTimeout(() => {
        const nextOrdersById = new Map<string, Order>();
        if (fixedOrder) {
          nextOrdersById.set(fixedOrder.id, fixedOrder);
        }

        setPayments([fixedPayment]);
        setOrdersById(nextOrdersById);
        setPaymentId(fixedPayment.id);
        setDeclaredAmount(String(fixedPayment.amount));
        setMessage(isPaymentOpenForReceipt(fixedPayment, fixedOrder) ? "Adjunta un comprobante para esta orden." : "Este pago ya no admite cambios de comprobante.");
        setIsLoadingPayments(false);
      }, 0);

      return () => {
        isActive = false;
        window.clearTimeout(timeoutId);
      };
    }

    apiRequest<Order[]>("/api/orders/me", { token })
      .then(async (orders) => {
        const openOrders = orders.filter(isOpenCustomerOrder);
        const paymentGroups = await Promise.all(
          openOrders.map((order) => apiRequest<Payment[]>(`/api/payments/order/${order.id}`, { token }).catch(() => [])),
        );

        if (!isActive) {
          return;
        }

        const nextPayments = paymentGroups.flat();
        const nextOrdersById = new Map(openOrders.map((order) => [order.id, order]));
        const firstEligiblePayment = nextPayments.find((payment) => isPaymentOpenForReceipt(payment, nextOrdersById.get(payment.orderId)));
        setPayments(nextPayments);
        setOrdersById(nextOrdersById);
        setPaymentId(firstEligiblePayment?.id ?? "");
        setDeclaredAmount(firstEligiblePayment ? String(firstEligiblePayment.amount) : "");
        setMessage(firstEligiblePayment ? "Selecciona la orden y carga tu comprobante." : "No tienes ordenes abiertas pendientes de comprobante.");
      })
      .catch((error: Error) => {
        if (isActive) {
          setMessage(error.message);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingPayments(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [fixedOrder, fixedPayment, token]);

  function handlePaymentChange(nextPaymentId: string) {
    const payment = payments.find((entry) => entry.id === nextPaymentId);
    setPaymentId(nextPaymentId);
    setDeclaredAmount(payment ? String(payment.amount) : "");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !paymentId) {
      setMessage("Selecciona una orden abierta y un archivo.");
      return;
    }

    const formData = new FormData();
    formData.append("paymentId", paymentId);
    formData.append("operationCode", operationCode);
    if (declaredAmount) {
      formData.append("declaredAmount", declaredAmount);
    }
    formData.append("currency", "PEN");
    formData.append("file", file);

    setIsUploading(true);
    try {
      await apiRequest<UploadResult>("/api/payment-receipts/upload-file", {
        method: "POST",
        body: formData,
        token,
      });
      setMessage(fixedPayment?.status === "rejected" ? "Nuevo comprobante enviado a revision." : "Comprobante subido correctamente.");
      setFile(null);
      setOperationCode("");
      await onUploaded?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo subir el comprobante.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form className="space-y-5 rounded-2xl border border-rose-100 bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-xl font-semibold">Comprobante de pago</h2>
        <p className="mt-1 text-sm text-zinc-500">Aceptamos imagenes o PDF de hasta 10 MB.</p>
      </div>

      <label className="block text-sm font-medium">
        Orden pendiente
        <select className="admin-input mt-2" disabled={isFixedPayment || isLoadingPayments || eligiblePayments.length === 0} value={paymentId} onChange={(event) => handlePaymentChange(event.target.value)}>
          {isLoadingPayments ? <option value="">Cargando ordenes...</option> : null}
          {!isLoadingPayments && eligiblePayments.length === 0 ? <option value="">Sin ordenes pendientes</option> : null}
          {eligiblePayments.map((payment) => {
            const order = ordersById.get(payment.orderId);
            return (
              <option key={payment.id} value={payment.id}>
                Orden #{shortId(payment.orderId)} - {formatMoney(payment.amount, payment.currency)} - {order ? formatOrderStatus(order.status) : formatPaymentStatus(payment.status)}
              </option>
            );
          })}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Codigo de operacion
          <input className="admin-input mt-2" value={operationCode} onChange={(event) => setOperationCode(event.target.value)} />
        </label>
        <label className="block text-sm font-medium">
          Monto declarado
          <input className="admin-input mt-2" inputMode="decimal" value={declaredAmount} onChange={(event) => setDeclaredAmount(event.target.value)} />
        </label>
      </div>

      <label className="block text-sm font-medium">
        Archivo
        <input className="mt-2 w-full rounded-xl border border-dashed border-rose-200 bg-rose-50/40 px-3 py-3 text-sm" accept=".jpg,.jpeg,.png,.webp,.pdf" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      </label>

      <button className="admin-primary-button" disabled={isUploading || eligiblePayments.length === 0}>
        {isUploading ? "Subiendo..." : submitLabel ?? "Subir comprobante"}
      </button>

      {message ? <p className="rounded-xl border border-rose-100 bg-rose-50/60 p-3 text-sm text-zinc-600">{message}</p> : null}
    </form>
  );
}

function isOpenCustomerOrder(order: Order) {
  return order.status === "pendingReceipt" || order.status === "receiptInReview" || order.status === "paid" || order.status === "preparing" || order.status === "shipped";
}

function isPaymentOpenForReceipt(payment: Payment, order: Order | undefined) {
  if (!order || order.status === "cancelled" || order.status === "delivered" || order.status === "outOfStock") {
    return false;
  }

  return payment.status === "pendingReceipt" || payment.status === "rejected";
}

function formatMoney(amount: number, currency: string) {
  return `S/. ${amount.toFixed(2)} ${currency}`;
}

function shortId(value: string) {
  return value.slice(0, 8).toUpperCase();
}

function formatOrderStatus(status: Order["status"]) {
  const labels: Record<Order["status"], string> = {
    pendingReceipt: "Pendiente de comprobante",
    receiptInReview: "Comprobante en revision",
    paid: "Pagado",
    preparing: "Preparando",
    shipped: "Enviado",
    delivered: "Entregado",
    cancelled: "Cancelado",
    outOfStock: "Sin stock",
  };
  return labels[status];
}

function formatPaymentStatus(status: Payment["status"]) {
  const labels: Record<Payment["status"], string> = {
    pendingReceipt: "Pendiente de comprobante",
    inReview: "En revision",
    approved: "Aprobado",
    rejected: "Rechazado",
    voided: "Anulado",
    pendingGateway: "Pago en pasarela",
  };
  return labels[status];
}
