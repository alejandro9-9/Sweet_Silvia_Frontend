"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiClientError, apiRequest, publicAssetUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { readGuestCart, removeGuestCartItem, updateGuestCartItemQuantity, writeGuestCart, type GuestCartItem } from "@/lib/cart";
import { persistCheckoutSession, readCheckoutSession } from "@/lib/checkout-session";
import { getMockProductImage, isPlaceholderImage } from "@/lib/mock-catalog";
import type { Address, Cart, CartAppliedCouponSummary, Coupon, CreatedResponse, Department, District, IzipayPaymentLinkResponse, OlvaAgency, PaymentMethod, Product, ProductImage, ProductVariant, Province, ShippingCost, ShippingDestinationType, UserAccount } from "@/lib/types";

type CartShippingOption = {
  shippingRateId: string | null;
  courierId: string | null;
  label: string;
  cost: number;
  currency: string;
  estimatedTime: string;
  source: "backend" | "estimate";
  description: string;
  chargeableWeightKg: number;
  volumetricWeightKg: number;
  actualWeightKg: number;
  volumeSurcharge: number;
};

type CheckoutStatus = "idle" | "submitting" | "success" | "error";

type LocationOption = {
  id: string;
  name: string;
};

type ShippingPackageItem = {
  quantity: number;
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

type PackageSummary = {
  actualWeightKg: number;
  volumetricWeightKg: number;
  chargeableWeightKg: number;
  limaSurcharge: number;
  provinceSurcharge: number;
};

export default function CartPage() {
  const { token, user, isReady } = useAuth();
  const [items, setItems] = useState<GuestCartItem[]>(() => readGuestCart());
  const [cartId, setCartId] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<CartAppliedCouponSummary | null>(null);
  const [appliedCouponDetails, setAppliedCouponDetails] = useState<Coupon | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponItemId, setCouponItemId] = useState("");
  const [couponQuantity, setCouponQuantity] = useState("1");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [izipayPayMethod, setIzipayPayMethod] = useState("CARD");
  const [izipayDocument, setIzipayDocument] = useState("");
  const [izipayPostalCode, setIzipayPostalCode] = useState("");
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatus>("idle");
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [paymentLink, setPaymentLink] = useState<IzipayPaymentLinkResponse | null>(null);
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [districts, setDistricts] = useState<LocationOption[]>([]);
  const [olvaAgencies, setOlvaAgencies] = useState<OlvaAgency[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [provinceId, setProvinceId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [shippingOptions, setShippingOptions] = useState<CartShippingOption[]>([]);
  const [selectedShippingIndex, setSelectedShippingIndex] = useState(0);
  const [selectedAgencyId, setSelectedAgencyId] = useState("");
  const [isLoadingShipping, setIsLoadingShipping] = useState(false);
  const [shippingMessage, setShippingMessage] = useState("");
  const shippingRequestId = useRef(0);

  const subtotal = useMemo(() => calculateSubtotal(items), [items]);
  const selectedDepartment = useMemo(
    () => departments.find((department) => department.id === departmentId) ?? null,
    [departmentId, departments],
  );
  const selectedProvince = useMemo(
    () => provinces.find((province) => province.id === provinceId) ?? null,
    [provinceId, provinces],
  );
  const selectedDistrict = useMemo(
    () => districts.find((district) => district.id === districtId) ?? null,
    [districtId, districts],
  );
  const selectedDestinationType = selectedDepartment ? normalizeDestinationType(selectedDepartment.destinationType) : null;
  const selectedShipping = shippingOptions[selectedShippingIndex] ?? shippingOptions[0] ?? null;
  const selectedAgency = olvaAgencies.find((agency) => agency.id === selectedAgencyId) ?? null;
  const total = subtotal + (selectedShipping?.cost ?? 0);
  const discount = appliedCoupon?.estimatedDiscountAmount ?? 0;
  const totalWithDiscount = Math.max(0, total - discount);
  const packageItems = useMemo(() => items.map(toShippingPackageItem), [items]);
  const packageSummary = useMemo(() => calculatePackageSummary(packageItems), [packageItems]);

  useEffect(function restoreCheckoutSession() {
    if (!isReady) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const stored = readCheckoutSession(user?.id ?? null);
      setCreatedOrderId(stored?.orderId ?? null);
      setPaymentLink(stored?.paymentLink ?? null);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isReady, user?.id]);

  const hydrateBackendCart = useCallback(async (cart: Cart, guestItems: GuestCartItem[] = []) => {
    const guestByVariant = new Map(guestItems.filter((item) => item.variantId).map((item) => [item.variantId as string, item]));
    const hydratedItems = await Promise.all(
      cart.items.map(async (cartItem) => {
        const fallback = guestByVariant.get(cartItem.productVariantId);
        try {
          const variant = await apiRequest<ProductVariant>(`/api/product-variants/${cartItem.productVariantId}`, { token });
          const product = await apiRequest<Product>(`/api/products/${variant.productId}`, { token });
          const images = await apiRequest<ProductImage[]>(`/api/product-images/product/${product.id}`, { token }).catch(() => []);
          const mainImage = images.find((image) => image.isMain) ?? images[0];
          return {
            id: cartItem.id,
            productId: product.id,
            variantId: variant.id,
            productName: product.name,
            size: variant.size,
            color: variant.color,
            quantity: cartItem.quantity,
            unitPrice: variant.price ?? product.basePrice,
            currency: variant.currency ?? product.currency,
            imageUrl: mainImage?.url ?? null,
          } satisfies GuestCartItem;
        } catch {
          return fallback ? { ...fallback, id: cartItem.id, quantity: cartItem.quantity } : null;
        }
      }),
    );

    setCartId(cart.id);
    setAppliedCoupon(cart.appliedCoupons[0] ?? null);
    setItems(hydratedItems.filter((item): item is GuestCartItem => item !== null));
  }, [token]);

  const loadBackendCart = useCallback(async () => {
    if (!token) {
      return;
    }

    const guestItems = readGuestCart();
    let cart: Cart;
    try {
      cart = await apiRequest<Cart>("/api/cart/me", { token });
    } catch (error) {
      if (!(error instanceof ApiClientError) || error.status !== 404) {
        throw error;
      }
      const created = await apiRequest<CreatedResponse>("/api/cart", { method: "POST", token });
      cart = await apiRequest<Cart>("/api/cart/me", { token });
      if (!cart.id && created.id) {
        cart = { ...cart, id: created.id };
      }
    }

    for (const item of guestItems) {
      if (!item.variantId || !isGuid(item.variantId)) {
        continue;
      }

      const existing = cart.items.find((cartItem) => cartItem.productVariantId === item.variantId);
      if (existing) {
        await apiRequest<void>("/api/cart/items", {
          method: "PUT",
          token,
          body: { cartId: cart.id, productVariantId: item.variantId, quantity: item.quantity },
        });
      } else {
        await apiRequest<void>("/api/cart/items", {
          method: "POST",
          token,
          body: { cartId: cart.id, productVariantId: item.variantId, quantity: item.quantity },
        });
      }
    }

    if (guestItems.some((item) => item.variantId && isGuid(item.variantId))) {
      writeGuestCart([]);
      cart = await apiRequest<Cart>("/api/cart/me", { token });
    }

    await hydrateBackendCart(cart, guestItems);
  }, [hydrateBackendCart, token]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (token) {
      const timeoutId = window.setTimeout(() => {
        void loadBackendCart().catch((error: Error) => {
          setItems(readGuestCart());
          setCheckoutMessage(`No pudimos sincronizar tu carrito: ${error.message}`);
        });
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    const loadGuestCart = () => setItems(readGuestCart());
    loadGuestCart();
    window.addEventListener("sweet-silvia-cart-updated", loadGuestCart);
    return () => window.removeEventListener("sweet-silvia-cart-updated", loadGuestCart);
  }, [isReady, loadBackendCart, token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    Promise.all([
      apiRequest<Address[]>("/api/addresses/me", { token }),
      apiRequest<PaymentMethod[]>("/api/payment-methods"),
      apiRequest<UserAccount>("/api/users/me", { token }),
    ])
      .then(([nextAddresses, nextPaymentMethods, nextAccount]) => {
        setAddresses(nextAddresses);
        setSelectedAddressId((currentId) => nextAddresses.some((address) => address.id === currentId) ? currentId : nextAddresses.find((address) => address.isDefault)?.id ?? nextAddresses[0]?.id ?? "");
        const availablePaymentMethods = nextPaymentMethods.filter((method) =>
          !(method.type === "gateway" && method.requiresExternalIntegration) ||
          process.env.NEXT_PUBLIC_IZIPAY_ENABLED === "true",
        );
        setPaymentMethods(availablePaymentMethods);
        setPaymentMethodId((currentId) => availablePaymentMethods.some((method) => method.id === currentId) ? currentId : availablePaymentMethods[0]?.id ?? "");
        setAccount(nextAccount);
      })
      .catch(() => setCheckoutMessage("Inicia sesion con una direccion guardada para finalizar la compra."));
  }, [token]);

  useEffect(() => {
    apiRequest<Department[]>("/api/departments?onlyActive=true")
      .then((nextDepartments) => {
        setDepartments(nextDepartments.filter(isValidLocationOption));
      })
      .catch(() => setShippingMessage("No pudimos cargar las zonas de envio."));
  }, []);

  useEffect(() => {
    if (!departmentId) {
      return;
    }

    let isActive = true;
    const departmentName = selectedDepartment?.name;
    if (!departmentName) {
      return;
    }

    apiRequest<Province[]>(`/api/provinces/department/${departmentId}?onlyActive=true`)
      .then((nextProvinces) => {
        if (!isActive) {
          return;
        }
        setProvinces(nextProvinces.filter(isValidLocationOption));
        setDistricts([]);
        setProvinceId("");
        setDistrictId("");
        setOlvaAgencies([]);
        setSelectedAgencyId("");
        setShippingOptions([]);
        setSelectedShippingIndex(0);
      })
      .catch(() => {
        if (isActive) {
          setProvinces([]);
        }
      });

    return () => {
      isActive = false;
    };
  }, [departmentId, selectedDepartment?.name]);

  useEffect(() => {
    if (!provinceId) {
      return;
    }

    let isActive = true;
    const departmentName = selectedDepartment?.name;
    const provinceName = selectedProvince?.name;
    if (!departmentName || !provinceName) {
      return;
    }

    apiRequest<District[]>(`/api/districts/province/${provinceId}?onlyActive=true`)
      .then((nextDistricts) => {
        if (!isActive) {
          return;
        }
        setDistricts(nextDistricts.filter(isValidLocationOption));
        setDistrictId("");
        setOlvaAgencies([]);
        setSelectedAgencyId("");
        setShippingOptions([]);
        setSelectedShippingIndex(0);
      })
      .catch(() => {
        if (isActive) {
          setDistricts([]);
        }
      });

    return () => {
      isActive = false;
    };
  }, [provinceId, selectedDepartment?.name, selectedProvince?.name]);

  async function updateQuantity(itemId: string, quantity: number) {
    const nextQuantity = Number.isFinite(quantity) ? Math.max(1, quantity) : 1;
    const item = items.find((entry) => entry.id === itemId);
    if (token && cartId && item?.variantId && isGuid(item.variantId)) {
      try {
        await apiRequest<void>("/api/cart/items", {
          method: "PUT",
          token,
          body: { cartId, productVariantId: item.variantId, quantity: nextQuantity },
        });
        await loadBackendCart();
        if (districtId) {
          void calculateShipping(districtId);
        }
      } catch (error) {
        setCheckoutMessage(error instanceof Error ? error.message : "No se pudo actualizar el carrito.");
      }
      return;
    }

    const nextItems = updateGuestCartItemQuantity(itemId, nextQuantity);
    setItems(nextItems);
    refreshShippingForCartChange(nextItems);
  }

  async function removeItem(itemId: string) {
    const item = items.find((entry) => entry.id === itemId);
    if (token && cartId && item?.variantId && isGuid(item.variantId)) {
      try {
        await apiRequest<void>("/api/cart/items", {
          method: "DELETE",
          token,
          body: { cartId, productVariantId: item.variantId },
        });
        await loadBackendCart();
        if (districtId) {
          void calculateShipping(districtId);
        }
      } catch (error) {
        setCheckoutMessage(error instanceof Error ? error.message : "No se pudo quitar el producto.");
      }
      return;
    }

    const nextItems = removeGuestCartItem(itemId);
    setItems(nextItems);
    refreshShippingForCartChange(nextItems);
  }

  function refreshShippingForCartChange(nextItems: GuestCartItem[]) {
    if (nextItems.length === 0) {
      clearSelectedShipping();
      return;
    }

    if (districtId) {
      void calculateShipping(districtId, nextItems);
      return;
    }

    setShippingOptions([]);
    setSelectedShippingIndex(0);
    setShippingMessage("");
  }

  function clearSelectedShipping() {
    shippingRequestId.current += 1;
    setDistrictId("");
    setOlvaAgencies([]);
    setSelectedAgencyId("");
    setShippingOptions([]);
    setSelectedShippingIndex(0);
    setShippingMessage("");
    setIsLoadingShipping(false);
  }

  async function calculateShipping(nextDistrictId: string, cartItems = items) {
    const requestId = shippingRequestId.current + 1;
    shippingRequestId.current = requestId;
    setDistrictId(nextDistrictId);
    setShippingMessage("");

    if (!selectedDepartment || !selectedProvince || !nextDistrictId || cartItems.length === 0) {
      setOlvaAgencies([]);
      setSelectedAgencyId("");
      setShippingOptions([]);
      setSelectedShippingIndex(0);
      return;
    }

    setIsLoadingShipping(true);
    const destinationType = normalizeDestinationType(selectedDepartment.destinationType);
    const districtName = districts.find((district) => district.id === nextDistrictId)?.name ?? "";
    const nextPackageItems = cartItems.map(toShippingPackageItem);
    const nextPackageSummary = calculatePackageSummary(nextPackageItems);
    const nextSubtotal = calculateSubtotal(cartItems);
    const nextAgencies =
      destinationType === "province"
        ? await apiRequest<OlvaAgency[]>(
            `/api/shipping/olva/agencies?${new URLSearchParams({
              department: selectedDepartment.name,
              province: selectedProvince.name,
              district: districtName,
            }).toString()}`,
          ).catch(() => [])
        : [];

    if (requestId !== shippingRequestId.current) {
      return;
    }

    setOlvaAgencies(nextAgencies);
    setSelectedAgencyId(nextAgencies[0]?.id ?? "");

    if (destinationType === "province" && nextAgencies.length === 0) {
      setShippingOptions([]);
      setSelectedAgencyId("");
      setSelectedShippingIndex(0);
      setShippingMessage("Aun no tenemos una agencia Olva guardada para esta zona.");
      setIsLoadingShipping(false);
      return;
    }

    try {
      if (!token || !isGuid(provinceId) || !isGuid(nextDistrictId)) {
        throw new Error("guest-estimate");
      }

      const response = await apiRequest<ShippingCost>("/api/shipping-rates/calculate", {
          method: "POST",
          token,
          body: {
          departmentId,
          provinceId,
          districtId: nextDistrictId,
          destinationType,
          orderSubtotal: nextSubtotal,
          currency: "PEN",
          packageItems: nextPackageItems,
        },
      });

      if (requestId !== shippingRequestId.current) {
        return;
      }

      setShippingOptions([
        {
          shippingRateId: response.shippingRateId,
          courierId: response.courierId,
          label: destinationType === "lima" ? "Delivery Sweet Silvia" : "Olva Courier agencia",
          cost: response.cost,
          currency: response.currency,
          estimatedTime: response.estimatedTime ?? "Por confirmar",
          source: "backend",
          description:
            destinationType === "lima"
              ? "Costo unico de reparto para todo tu pedido."
              : "Costo unico de envio por agencia para todo tu pedido.",
          chargeableWeightKg: response.chargeableWeightKg,
          volumetricWeightKg: response.volumetricWeightKg,
          actualWeightKg: response.actualWeightKg,
          volumeSurcharge: response.volumeSurcharge,
        },
      ]);
      setSelectedShippingIndex(0);
    } catch (error) {
      if (requestId !== shippingRequestId.current) {
        return;
      }

      if (token) {
        setShippingOptions([]);
        setSelectedShippingIndex(0);
        setShippingMessage(error instanceof Error ? error.message : "No pudimos calcular el envio.");
      } else {
        setShippingOptions(estimatedCartShippingOptions(destinationType, selectedDepartment.name, nextPackageSummary));
      }
      setSelectedShippingIndex(0);
    } finally {
      if (requestId === shippingRequestId.current) {
        setIsLoadingShipping(false);
      }
    }
  }

  async function applyCoupon() {
    if (!token || !cartId || !couponCode.trim()) {
      setCheckoutMessage("Inicia sesion y escribe un codigo de cupon.");
      return;
    }

    const item = items.find((entry) => entry.id === (couponItemId || items[0]?.id));
    setCheckoutStatus("submitting");
    setCheckoutMessage("");
    try {
      const coupon = await apiRequest<Coupon>(`/api/coupons/code/${encodeURIComponent(couponCode.trim())}`, { token });
      if (coupon.scope === "item" && (!item?.variantId || !isGuid(item.variantId))) {
        throw new Error("Este cupon necesita una variante real del catalogo.");
      }

      await apiRequest<void>("/api/cart/coupons", {
        method: "POST",
        token,
        body: {
          cartId,
          couponId: coupon.id,
          scope: coupon.scope,
          cartItemId: coupon.scope === "item" ? item?.id : null,
          appliedQuantity: coupon.scope === "item" ? Math.min(Number(couponQuantity) || 1, item?.quantity ?? 1) : null,
        },
      });
      setAppliedCouponDetails(coupon);
      setCouponCode("");
      await loadBackendCart();
      setCheckoutStatus("idle");
      setCheckoutMessage("Cupon aplicado. El descuento mostrado es referencial; el backend lo confirma al crear la orden.");
    } catch (error) {
      setCheckoutStatus("error");
      setCheckoutMessage(error instanceof Error ? error.message : "No se pudo aplicar el cupon.");
    }
  }

  async function removeCoupon() {
    if (!token || !appliedCoupon) {
      return;
    }

    try {
      await apiRequest<void>(`/api/cart/coupons/${appliedCoupon.id}`, { method: "DELETE", token });
      setAppliedCoupon(null);
      setAppliedCouponDetails(null);
      await loadBackendCart();
      setCheckoutMessage("Cupon retirado.");
    } catch (error) {
      setCheckoutMessage(error instanceof Error ? error.message : "No se pudo retirar el cupon.");
    }
  }

  async function submitPaymentForOrder(order: { id: string; total: number; currency: string }, paymentMethod: PaymentMethod) {
    if (paymentMethod.type === "gateway" && paymentMethod.requiresExternalIntegration) {
      if (process.env.NEXT_PUBLIC_IZIPAY_ENABLED !== "true") {
        throw new Error("Izipay se habilitara cuando la tienda este desplegada y sus URLs publicas esten configuradas.");
      }

      const customer = account ?? await apiRequest<UserAccount>("/api/users/me", { token });
      const address = addresses.find((entry) => entry.id === selectedAddressId);
      if (!address) {
        throw new Error("No pudimos recuperar la direccion seleccionada.");
      }

      const contact = toIzipayContact(
        customer,
        address,
        selectedDistrict?.name ?? address.districtId,
        selectedDepartment?.name ?? address.departmentId,
        izipayDocument,
        izipayPostalCode,
      );
      const link = await apiRequest<IzipayPaymentLinkResponse>("/api/payments/izipay/payment-link", {
        method: "POST",
        token,
        body: {
          orderId: order.id,
          paymentMethodId: paymentMethod.id,
          productDescription: `Pedido Sweet Silvia ${order.id.slice(0, 8).toUpperCase()}`,
          payMethod: izipayPayMethod,
          billing: contact,
          shipping: contact,
        },
      });
      setPaymentLink(link);
      persistCheckoutSession(user?.id ?? null, order.id, link);
      return;
    }

    await apiRequest<CreatedResponse>("/api/payments", {
      method: "POST",
      token,
      body: {
        orderId: order.id,
        paymentMethodId: paymentMethod.id,
        amount: order.total,
        currency: order.currency,
      },
    });
  }

  async function retryPayment() {
    if (!token || !createdOrderId) {
      return;
    }

    const paymentMethod = paymentMethods.find((method) => method.id === paymentMethodId);
    if (!paymentMethod) {
      setCheckoutMessage("Selecciona un metodo de pago para reintentar.");
      return;
    }

    setCheckoutStatus("submitting");
    setCheckoutMessage("");
    try {
      const order = await apiRequest<{ id: string; total: number; currency: string }>(`/api/orders/${createdOrderId}`, { token });
      await submitPaymentForOrder(order, paymentMethod);
      setCheckoutStatus("success");
      setCheckoutMessage(paymentMethod.requiresManualVerification ? "Pedido creado. Sube tu comprobante desde la seccion de pagos." : "Pago listo para continuar.");
    } catch (error) {
      setCheckoutStatus("error");
      setCheckoutMessage(error instanceof Error ? error.message : "No se pudo reintentar el pago.");
    }
  }

  async function handleCheckout() {
    setCheckoutStatus("submitting");
    setCheckoutMessage("");
    setPaymentLink(null);
    let orderCreatedInRequest: string | null = null;

    try {
      if (!token) {
        throw new Error("Inicia sesion para finalizar la compra.");
      }
      if (!cartId || items.length === 0) {
        throw new Error("Tu carrito esta vacio o aun no se sincronizo.");
      }
      if (!selectedAddressId) {
        throw new Error("Selecciona una direccion de entrega o agrega una desde tu perfil.");
      }
      if (!selectedShipping || selectedShipping.source !== "backend" || !selectedShipping.shippingRateId) {
        throw new Error("Selecciona una tarifa de envio calculada por el servidor antes de pagar.");
      }
      const paymentMethod = paymentMethods.find((method) => method.id === paymentMethodId);
      if (!paymentMethod) {
        throw new Error("Selecciona un metodo de pago.");
      }
      if (paymentMethod.type === "gateway" && paymentMethod.requiresExternalIntegration) {
        if (process.env.NEXT_PUBLIC_IZIPAY_ENABLED !== "true") {
          throw new Error("Selecciona un metodo de pago manual mientras Izipay no este habilitado.");
        }

        if (!/^\d{8}$/.test(izipayDocument)) {
          throw new Error("Ingresa un DNI valido de 8 digitos para continuar con Izipay.");
        }
        if (!/^\d{5,10}$/.test(izipayPostalCode)) {
          throw new Error("Ingresa el codigo postal de tu direccion para continuar con Izipay.");
        }
      }

      const createdOrder = await apiRequest<CreatedResponse>("/api/orders", {
        method: "POST",
        token,
        body: {
          addressId: selectedAddressId,
          shippingRateId: selectedShipping.shippingRateId,
          shippingAgencyId: selectedDestinationType === "province" ? selectedAgencyId || null : null,
          couponId: appliedCoupon?.couponId ?? null,
        },
      });
      const order = await apiRequest<{ id: string; total: number; currency: string }>(`/api/orders/${createdOrder.id}`, { token });
      orderCreatedInRequest = order.id;
      setCreatedOrderId(order.id);
      persistCheckoutSession(user?.id ?? null, order.id, null);
      setItems([]);
      setCartId(null);
      writeGuestCart([]);
      await submitPaymentForOrder(order, paymentMethod);
      setCheckoutStatus("success");
      setCheckoutMessage(paymentMethod.requiresManualVerification ? "Pedido creado. Sube tu comprobante desde la seccion de pagos." : "Pedido creado correctamente.");
    } catch (error) {
      setCheckoutStatus("error");
      const paymentError = error instanceof Error ? error.message : "No se pudo finalizar la compra.";
      setCheckoutMessage(orderCreatedInRequest
        ? `El pedido #${orderCreatedInRequest.slice(0, 8).toUpperCase()} fue creado, pero el pago no termino. Puedes reintentarlo.`
        : paymentError);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8f5f0] text-zinc-950">
      <div className="bg-zinc-950 px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-white">
        {token ? "Carrito sincronizado con tu cuenta" : "Carrito reservado como invitado hasta iniciar sesion"}
      </div>
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-sm font-semibold uppercase tracking-[0.14em]">
            Inicio
          </Link>
          <Link href="/" className="font-serif text-3xl font-semibold">
            Sweet Silvia
          </Link>
          <Link href="/catalog" className="text-sm font-semibold uppercase tracking-[0.14em]">
            Catalogo
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_360px]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-800">Carrito</p>
          <h1 className="mt-2 font-serif text-5xl font-semibold tracking-normal sm:text-6xl">Tus prendas</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
            Revisa tus prendas y elige una sola opcion de envio para todo el pedido.
          </p>

          {items.length === 0 ? (
            <div className="mt-8 border border-zinc-200 bg-white p-8">
              <p className="text-zinc-600">Aun no agregaste productos.</p>
              <Link
                href="/catalog"
                className="mt-5 inline-flex bg-zinc-950 px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white"
              >
                Ver catalogo
              </Link>
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              {items.map((item) => (
        <article className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-[132px_1fr_auto]" key={item.id}>
                  <CartItemImage item={item} />
                  <div className="py-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-800">Sweet Silvia</p>
                    <h2 className="mt-2 text-sm font-semibold uppercase tracking-[0.08em]">{item.productName}</h2>
                    <p className="mt-2 text-sm text-zinc-600">
                      Talla {item.size} - {item.color}
                    </p>
                    <p className="mt-3 text-sm font-semibold">
                      {formatMoney(item.unitPrice, item.currency)}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500">Linea: {formatMoney(item.unitPrice * item.quantity, item.currency)}</p>
                  </div>
                  <div className="flex items-start gap-3 sm:flex-col sm:items-end">
                    <QuantityStepper
                      label={`Cantidad de ${item.productName}`}
                      onDecrease={() => void updateQuantity(item.id, item.quantity - 1)}
                      onIncrease={() => void updateQuantity(item.id, item.quantity + 1)}
                      value={item.quantity}
                    />
                    <button className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-800" onClick={() => void removeItem(item.id)} type="button">
                      Quitar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="h-fit rounded-lg border border-zinc-200 bg-white p-6 shadow-sm lg:sticky lg:top-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">Pedido</p>
          <h2 className="mt-1 font-serif text-3xl font-semibold tracking-normal">Resumen</h2>

          <section className="mt-6 border-y border-zinc-200 py-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em]">Envio unico</h3>
            <p className="mt-2 text-xs leading-5 text-zinc-500">Selecciona una zona y se calcula una sola tarifa para todo el carrito.</p>
            {items.length > 0 && districtId ? (
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                Paquete estimado: {packageSummary.chargeableWeightKg.toFixed(2)} kg cobrables por volumen/peso.
              </p>
            ) : null}

            <div className="mt-4 grid gap-3">
              <select
                className="h-11 rounded-lg border border-zinc-300 bg-[#f8f5f0] px-3 text-sm"
                value={departmentId}
                onChange={(event) => {
                  setDepartmentId(event.target.value);
                  setProvinces([]);
                  setDistricts([]);
                  setProvinceId("");
                  setDistrictId("");
                  setOlvaAgencies([]);
                  setSelectedAgencyId("");
                  setShippingOptions([]);
                  setShippingMessage("");
                  setSelectedShippingIndex(0);
                }}
              >
                <option value="">Departamento</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
              <select
                className="h-11 rounded-lg border border-zinc-300 bg-[#f8f5f0] px-3 text-sm disabled:bg-zinc-100 disabled:text-zinc-400"
                disabled={!departmentId}
                value={provinceId}
                onChange={(event) => {
                  setProvinceId(event.target.value);
                  setDistricts([]);
                  setDistrictId("");
                  setOlvaAgencies([]);
                  setSelectedAgencyId("");
                  setShippingOptions([]);
                  setShippingMessage("");
                  setSelectedShippingIndex(0);
                }}
              >
                <option value="">Provincia</option>
                {provinces.map((province) => (
                  <option key={province.id} value={province.id}>
                    {province.name}
                  </option>
                ))}
              </select>
              <select
                className="h-11 rounded-lg border border-zinc-300 bg-[#f8f5f0] px-3 text-sm disabled:bg-zinc-100 disabled:text-zinc-400"
                disabled={!provinceId || items.length === 0}
                value={districtId}
                onChange={(event) => void calculateShipping(event.target.value)}
              >
                <option value="">Distrito</option>
                {districts.map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.name}
                  </option>
                ))}
              </select>
            </div>

            {isLoadingShipping ? <p className="mt-3 text-sm text-zinc-500">Calculando envio...</p> : null}
            {shippingMessage ? <p className="mt-3 rounded-lg border border-dashed border-zinc-300 bg-[#f8f5f0] p-3 text-xs leading-5 text-zinc-600">{shippingMessage}</p> : null}

            {shippingOptions.length > 0 ? (
              <div className="mt-4 grid gap-3">
                {shippingOptions.map((option, index) => (
                  <button
                    aria-pressed={selectedShippingIndex === index}
                    className={`rounded-lg border p-4 text-left transition ${
                      selectedShippingIndex === index
                        ? "border-zinc-950 bg-zinc-950 text-white"
                        : "border-zinc-200 bg-[#f8f5f0] hover:border-zinc-950"
                    }`}
                    key={`${option.label}-${option.cost}`}
                    onClick={() => setSelectedShippingIndex(index)}
                    type="button"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.12em]">{option.label}</p>
                    <p className="mt-2 text-xl font-semibold">
                      {formatMoney(option.cost, option.currency)}
                    </p>
                    <p className={`mt-1 text-xs uppercase tracking-[0.12em] ${selectedShippingIndex === index ? "text-zinc-300" : "text-zinc-500"}`}>
                      {option.estimatedTime}
                    </p>
                    <p className={`mt-2 text-xs leading-5 ${selectedShippingIndex === index ? "text-zinc-300" : "text-zinc-500"}`}>{option.description}</p>
                    <p className={`mt-2 text-xs leading-5 ${selectedShippingIndex === index ? "text-zinc-300" : "text-zinc-500"}`}>
                      Peso real {option.actualWeightKg.toFixed(2)} kg | volumetrico {option.volumetricWeightKg.toFixed(2)} kg | cobrable {option.chargeableWeightKg.toFixed(2)} kg
                    </p>
                    {option.volumeSurcharge > 0 ? (
                      <p className={`mt-1 text-xs ${selectedShippingIndex === index ? "text-zinc-300" : "text-zinc-500"}`}>
                        Incluye recargo por volumen: {formatMoney(option.volumeSurcharge, "PEN")}.
                      </p>
                    ) : null}
                    {option.source === "estimate" ? <p className={`mt-2 text-xs ${selectedShippingIndex === index ? "text-zinc-300" : "text-zinc-500"}`}>Costo referencial.</p> : null}
                  </button>
                ))}
              </div>
            ) : null}

            {selectedDestinationType === "province" && selectedDistrict && olvaAgencies.length > 0 ? (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Elige agencia de recojo</p>
                {olvaAgencies.slice(0, 2).map((agency) => (
                  <button
                    aria-pressed={selectedAgencyId === agency.id}
                    className={`mt-3 w-full rounded-lg border p-3 text-left transition ${
                      selectedAgencyId === agency.id ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-[#f8f5f0] hover:border-zinc-950"
                    }`}
                    key={agency.id}
                    onClick={() => setSelectedAgencyId(agency.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em]">{formatAgencyName(agency.name)}</p>
                      {selectedAgencyId === agency.id ? (
                        <span className="shrink-0 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-950">Elegida</span>
                      ) : null}
                    </div>
                    {agency.address ? <p className={`mt-2 text-xs leading-5 ${selectedAgencyId === agency.id ? "text-zinc-300" : "text-zinc-600"}`}>{agency.address}</p> : null}
                  </button>
                ))}
                {selectedAgency ? (
                  <p className="mt-3 rounded-lg border border-zinc-200 bg-white p-3 text-xs leading-5 text-zinc-600">
                    Retiro seleccionado: <span className="font-semibold text-zinc-950">{formatAgencyName(selectedAgency.name)}</span>
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          <div className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatMoney(subtotal, "PEN")}</span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>Envio</span>
              <span>{selectedShipping ? formatMoney(selectedShipping.cost, selectedShipping.currency) : "Por calcular"}</span>
            </div>
            {appliedCoupon ? (
              <div className="flex justify-between text-emerald-700">
                <span>{appliedCouponDetails?.code ?? "Cupon"}</span>
                <span>- {formatMoney(discount, appliedCoupon.currency)}</span>
              </div>
            ) : null}
            <div className="border-t border-zinc-200 pt-3 font-semibold">
              <div className="flex justify-between">
                <span>{token ? "Total a confirmar" : "Total estimado"}</span>
                <span>{formatMoney(totalWithDiscount, "PEN")}</span>
              </div>
            </div>
          </div>

          {token ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-zinc-200 bg-[#f8f5f0] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.14em]">Cupon</h3>
                    <p className="mt-1 text-xs text-zinc-500">Un solo cupon por carrito. Un cupon de prenda se aplica solo a la cantidad elegida.</p>
                  </div>
                  {appliedCoupon ? <button className="text-xs font-semibold uppercase tracking-[0.1em] text-rose-800" onClick={() => void removeCoupon()} type="button">Quitar</button> : null}
                </div>
                {!appliedCoupon ? (
                  <>
                    <input className="admin-input mt-3" placeholder="Codigo de cupon" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} />
                    <select className="admin-input mt-3" value={couponItemId || items[0]?.id || ""} onChange={(event) => setCouponItemId(event.target.value)}>
                      <option value="">Prenda para cupon de item</option>
                      {items.map((item) => <option key={item.id} value={item.id}>{item.productName} - {item.size} {item.color}</option>)}
                    </select>
                    <input className="admin-input mt-3" min="1" max={items.find((item) => item.id === (couponItemId || items[0]?.id))?.quantity ?? 1} type="number" value={couponQuantity} onChange={(event) => setCouponQuantity(event.target.value)} />
                    <button className="admin-secondary-button mt-3 w-full" disabled={!couponCode.trim() || checkoutStatus === "submitting"} onClick={() => void applyCoupon()} type="button">Aplicar cupon</button>
                  </>
                ) : <p className="mt-3 text-sm font-semibold text-emerald-700">Cupon aplicado por {formatMoney(discount, appliedCoupon.currency)}.</p>}
              </div>

              <div className="rounded-lg border border-zinc-200 bg-[#f8f5f0] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="text-sm font-semibold uppercase tracking-[0.14em]">Entrega y pago</h3><p className="mt-1 text-xs text-zinc-500">El pedido se vuelve a validar en el servidor antes de crearse.</p></div>
                  <Link className="text-xs font-semibold uppercase tracking-[0.1em] text-rose-800" href="/profile">Gestionar direcciones</Link>
                </div>
                <select className="admin-input mt-4" value={selectedAddressId} onChange={(event) => setSelectedAddressId(event.target.value)}>
                  <option value="">Direccion de entrega</option>
                  {addresses.map((address) => <option key={address.id} value={address.id}>{address.receiverName} - {address.line}</option>)}
                </select>
                <select className="admin-input mt-3" value={paymentMethodId} onChange={(event) => setPaymentMethodId(event.target.value)}>
                  <option value="">Metodo de pago</option>
                  {paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
                </select>
                {paymentMethods.find((method) => method.id === paymentMethodId)?.type === "gateway" ? (
                  <div className="mt-3 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                    <select className="admin-input" value={izipayPayMethod} onChange={(event) => setIzipayPayMethod(event.target.value)}>
                      <option value="CARD">Tarjeta</option>
                      <option value="QR">QR</option>
                      <option value="YAPE_CODE">Codigo Yape</option>
                      <option value="PAGO_PUSH">Pago push</option>
                    </select>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-semibold text-zinc-700">
                        DNI del titular
                        <input className="admin-input mt-1" inputMode="numeric" maxLength={8} minLength={8} placeholder="12345678" value={izipayDocument} onChange={(event) => setIzipayDocument(event.target.value.replace(/\D/g, ""))} />
                      </label>
                      <label className="text-xs font-semibold text-zinc-700">
                        Codigo postal
                        <input className="admin-input mt-1" inputMode="numeric" maxLength={10} minLength={5} placeholder="15000" value={izipayPostalCode} onChange={(event) => setIzipayPostalCode(event.target.value.replace(/\D/g, ""))} />
                      </label>
                    </div>
                    <p className="text-xs leading-5 text-zinc-500">Izipay solicita estos datos para validar el titular y la direccion de facturacion.</p>
                  </div>
                ) : null}
                {addresses.length === 0 ? <p className="mt-3 text-xs text-rose-800">Agrega una direccion desde tu perfil para continuar.</p> : null}
              </div>

              <button className="admin-primary-button w-full" disabled={checkoutStatus === "submitting" || items.length === 0} onClick={() => void handleCheckout()} type="button">
                {checkoutStatus === "submitting" ? "Procesando..." : "Crear pedido y pagar"}
              </button>
              {createdOrderId && checkoutStatus === "error" && !paymentLink ? <button className="admin-secondary-button w-full" onClick={() => void retryPayment()} type="button">Reintentar pago del pedido</button> : null}
              {createdOrderId ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Pedido creado: #{createdOrderId.slice(0, 8).toUpperCase()}</p> : null}
              {paymentLink ? <a className="block rounded-lg bg-zinc-950 px-4 py-3 text-center text-sm font-semibold uppercase tracking-[0.1em] text-white" href={paymentLink.paymentUrl} rel="noreferrer" target="_blank">Abrir pago Izipay</a> : null}
              {checkoutMessage ? <p className="rounded-lg border border-zinc-200 bg-white p-3 text-xs leading-5 text-zinc-600">{checkoutMessage}</p> : null}
            </div>
          ) : (
            <>
              <Link href="/login" className="mt-6 flex w-full justify-center rounded-lg bg-zinc-950 px-5 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-white">Iniciar sesion para comprar</Link>
              <p className="mt-3 text-xs leading-5 text-zinc-500">Tus productos se guardan como invitado. Para finalizar la compra se usara tu cuenta.</p>
            </>
          )}
        </aside>
      </section>
    </main>
  );
}

function CartItemImage({ item }: { item: GuestCartItem }) {
  const fallbackImage = getMockProductImage(item.productName);
  const initialImage = item.imageUrl && !isPlaceholderImage(item.imageUrl) ? toDisplayImage(item.imageUrl) : fallbackImage;
  const [imageSrc, setImageSrc] = useState(initialImage);

  return (
    <div className="aspect-[3/4] overflow-hidden bg-[#eee8df]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={item.productName}
        className="h-full w-full object-cover"
        onError={() => setImageSrc(fallbackImage)}
        src={imageSrc}
      />
    </div>
  );
}

function QuantityStepper({
  label,
  value,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div aria-label={label} className="grid h-11 w-32 grid-cols-3 overflow-hidden rounded-lg border border-zinc-300 bg-[#f8f5f0]" role="group">
      <button
        aria-label="Disminuir cantidad"
        className="grid h-full place-items-center text-lg transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-transparent"
        disabled={value <= 1}
        onClick={onDecrease}
        type="button"
      >
        -
      </button>
      <span className="grid h-full place-items-center border-x border-zinc-300 bg-white text-sm font-semibold">{value}</span>
      <button
        aria-label="Aumentar cantidad"
        className="grid h-full place-items-center text-lg transition hover:bg-zinc-950 hover:text-white"
        onClick={onIncrease}
        type="button"
      >
        +
      </button>
    </div>
  );
}

function toDisplayImage(imageUrl: string) {
  return imageUrl.startsWith("/mock-products") ? imageUrl : publicAssetUrl(imageUrl);
}

function calculateSubtotal(items: GuestCartItem[]) {
  return items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
}

function formatMoney(amount: number, currency = "PEN") {
  const formattedAmount = new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return `S/. ${formattedAmount} ${currency}`;
}

function toShippingPackageItem(item: GuestCartItem): ShippingPackageItem {
  const profile = getProductPackageProfile(item.productName);

  return {
    quantity: item.quantity,
    weightKg: profile.weightKg,
    lengthCm: profile.lengthCm,
    widthCm: profile.widthCm,
    heightCm: profile.heightCm,
  };
}

function getProductPackageProfile(productName: string) {
  const normalizedName = productName.toLowerCase();

  if (normalizedName.includes("sandalia") || normalizedName.includes("zapato")) {
    return { weightKg: 0.75, lengthCm: 34, widthCm: 24, heightCm: 12 };
  }

  if (normalizedName.includes("bolso") || normalizedName.includes("cartera")) {
    return { weightKg: 0.65, lengthCm: 32, widthCm: 24, heightCm: 12 };
  }

  if (normalizedName.includes("blazer") || normalizedName.includes("chaqueta") || normalizedName.includes("cardigan")) {
    return { weightKg: 0.8, lengthCm: 38, widthCm: 30, heightCm: 8 };
  }

  if (normalizedName.includes("jean") || normalizedName.includes("pantalon")) {
    return { weightKg: 0.65, lengthCm: 34, widthCm: 26, heightCm: 7 };
  }

  if (normalizedName.includes("gorra") || normalizedName.includes("lente")) {
    return { weightKg: 0.25, lengthCm: 24, widthCm: 18, heightCm: 12 };
  }

  return { weightKg: 0.35, lengthCm: 30, widthCm: 22, heightCm: 4 };
}

function calculatePackageSummary(packageItems: ShippingPackageItem[]): PackageSummary {
  const actualWeightKg = packageItems.reduce((total, item) => total + item.weightKg * item.quantity, 0);
  const volumeCm3 = packageItems.reduce((total, item) => total + item.lengthCm * item.widthCm * item.heightCm * item.quantity, 0);
  const volumetricWeightKg = volumeCm3 / 6000;
  const chargeableWeightKg = Math.max(actualWeightKg, volumetricWeightKg);

  return {
    actualWeightKg: roundWeight(actualWeightKg),
    volumetricWeightKg: roundWeight(volumetricWeightKg),
    chargeableWeightKg: roundWeight(chargeableWeightKg),
    limaSurcharge: calculateVolumeSurcharge(chargeableWeightKg, volumeCm3, 3, 2),
    provinceSurcharge: calculateVolumeSurcharge(chargeableWeightKg, volumeCm3, 1, 4),
  };
}

function calculateVolumeSurcharge(chargeableWeightKg: number, volumeCm3: number, includedWeightKg: number, extraKgRate: number) {
  const extraWeightKg = Math.max(0, chargeableWeightKg - includedWeightKg);
  const bulkySurcharge = volumeCm3 > 45000 ? 8 : 0;
  return Math.ceil(extraWeightKg) * extraKgRate + bulkySurcharge;
}

function roundWeight(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeDestinationType(value: ShippingDestinationType | string): ShippingDestinationType {
  return value.toLowerCase() === "lima" ? "lima" : "province";
}

function estimatedCartShippingOptions(destinationType: ShippingDestinationType, departmentName: string, packageSummary: PackageSummary): CartShippingOption[] {
  if (destinationType === "lima" || departmentName.toLowerCase().includes("lima") || departmentName.toLowerCase().includes("callao")) {
    return [
      {
        shippingRateId: null,
        courierId: null,
        label: "Delivery regular",
        cost: 12 + packageSummary.limaSurcharge,
        currency: "PEN",
        estimatedTime: "24 a 48 horas",
        source: "estimate",
        description: "Reparto local unico para todo el pedido.",
        actualWeightKg: packageSummary.actualWeightKg,
        volumetricWeightKg: packageSummary.volumetricWeightKg,
        chargeableWeightKg: packageSummary.chargeableWeightKg,
        volumeSurcharge: packageSummary.limaSurcharge,
      },
      {
        shippingRateId: null,
        courierId: null,
        label: "Delivery express",
        cost: 18 + packageSummary.limaSurcharge,
        currency: "PEN",
        estimatedTime: "Mismo dia",
        source: "estimate",
        description: "Opcion rapida para distritos habilitados.",
        actualWeightKg: packageSummary.actualWeightKg,
        volumetricWeightKg: packageSummary.volumetricWeightKg,
        chargeableWeightKg: packageSummary.chargeableWeightKg,
        volumeSurcharge: packageSummary.limaSurcharge,
      },
    ];
  }

  return [
    {
      shippingRateId: null,
      courierId: null,
      label: "Olva Courier agencia",
      cost: 18 + packageSummary.provinceSurcharge,
      currency: "PEN",
      estimatedTime: "2 a 4 dias",
      source: "estimate",
      description: "Recojo en agencia Olva Courier para todo el pedido.",
      actualWeightKg: packageSummary.actualWeightKg,
      volumetricWeightKg: packageSummary.volumetricWeightKg,
      chargeableWeightKg: packageSummary.chargeableWeightKg,
      volumeSurcharge: packageSummary.provinceSurcharge,
    },
  ];
}

function formatAgencyName(name: string) {
  return name
    .replace(/^\w+\s*-\s*/i, "")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isValidLocationOption(location: { name: string }) {
  const name = location.name.trim().toLowerCase();
  return name.length > 1 && name !== "string";
}

function isGuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function toIzipayContact(account: UserAccount, address: Address, districtName: string, departmentName: string, document: string, postalCode: string) {
  return {
    firstName: account.name || address.receiverName,
    lastName: `${account.paternalSurname} ${account.maternalSurname ?? ""}`.trim() || address.receiverName,
    email: account.email,
    phoneNumber: address.receiverPhone || account.phone || "",
    street: address.line,
    postalCode,
    city: districtName,
    state: departmentName,
    country: "PE",
    documentType: "DNI",
    document,
  };
}
