import { Link } from "@/components/RouterLink";
import { CartItemImage, QuantityStepper } from "@/components/CartItemControls";
import { BrandLogo } from "@/components/BrandLogo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiClientError, apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { readGuestCart, removeGuestCartItem, updateGuestCartItemQuantity, writeGuestCart, type GuestCartItem } from "@/lib/cart";
import { clientEnv } from "@/lib/env";
import { calculateSubtotal, formatAgencyName, formatCheckoutMoney as formatMoney, formatOlvaDistrictName, isGuid, isValidLocationOption, toIzipayContact } from "@/lib/checkout-utils";
import { calculatePackageSummary, estimatedCartShippingOptions, toShippingPackageItem, type CartShippingOption } from "@/lib/shipping-estimates";
import { PaymentMethodPicker } from "@/components/PaymentMethodPicker";
import { CustomerPaymentStatusIcon } from "@/components/CustomerPaymentStatusIcon";
import { CartNavLink } from "@/components/CartNavLink";
import type { Address, Cart, CartAppliedCouponSummary, Coupon, CreatedResponse, Department, District, IzipayPaymentLinkResponse, OlvaAgency, Order, Payment, PaymentMethod, Product, ProductImage, ProductVariant, Province, ShippingCost, UserAccount } from "@/lib/types";

type CheckoutStatus = "idle" | "submitting" | "success" | "error";
type CheckoutStep = "shipping" | "payment";

type OrderConfirmation = {
  orderId: string;
  nextPath?: string;
};

type LocationOption = {
  id: string;
  name: string;
};

type CartPageProps = {
  checkoutOnly?: boolean;
};

export default function CartPage({ checkoutOnly = false }: CartPageProps) {
  const { token, user, isReady } = useAuth();
  const navigate = useNavigate();
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
  const [orderConfirmation, setOrderConfirmation] = useState<OrderConfirmation | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(checkoutOnly);
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
  const [isOutsideLima, setIsOutsideLima] = useState(false);
  const [isLoadingShipping, setIsLoadingShipping] = useState(false);
  const [shippingMessage, setShippingMessage] = useState("");
  const [pendingReceiptCount, setPendingReceiptCount] = useState(0);
  const [activeCheckoutStep, setActiveCheckoutStep] = useState<CheckoutStep>("shipping");
  const shippingRequestId = useRef(0);

  const subtotal = useMemo(() => calculateSubtotal(items), [items]);
  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  );
  const selectedDepartment = useMemo(
    () => departments.find((department) => department.id === departmentId) ?? (
      !isOutsideLima && selectedAddress?.departmentId === departmentId
        ? { id: departmentId, name: "Lima", destinationType: "lima" as const, isActive: true }
        : null
    ),
    [departmentId, departments, isOutsideLima, selectedAddress?.departmentId],
  );
  const selectedProvince = useMemo(
    () => provinces.find((province) => province.id === provinceId) ?? (
      !isOutsideLima && selectedAddress?.provinceId === provinceId
        ? { id: provinceId, departmentId, name: "Provincia", isActive: true }
        : null
    ),
    [departmentId, isOutsideLima, provinceId, provinces, selectedAddress?.provinceId],
  );
  const selectedDistrict = useMemo(
    () => districts.find((district) => district.id === districtId) ?? (
      !isOutsideLima && selectedAddress?.districtId === districtId
        ? { id: districtId, provinceId, name: "Distrito", ubigeo: null, isActive: true }
        : null
    ),
    [districtId, districts, isOutsideLima, provinceId, selectedAddress?.districtId],
  );
  const selectedDestinationType = isOutsideLima ? "province" : "lima";
  const shippingDepartments = useMemo(
    () => isOutsideLima ? departments.filter((department) => department.destinationType === "province") : departments,
    [departments, isOutsideLima],
  );
  const selectedShipping = shippingOptions[selectedShippingIndex] ?? shippingOptions[0] ?? null;
  const selectedAgency = olvaAgencies.find((agency) => agency.id === selectedAgencyId) ?? null;
  const isOlvaShipping = isOutsideLima;
  const needsDeliveryAddress = !isOutsideLima;
  const checkoutMode = checkoutOnly || isCheckoutOpen;
  const hasShippingSelection = Boolean(
    departmentId &&
    provinceId &&
    districtId &&
    selectedShipping?.shippingRateId &&
    (!isOlvaShipping || selectedAgencyId),
  );
  const completedCheckoutSteps = [hasShippingSelection, Boolean(paymentMethodId)].filter(Boolean).length;
  const checkoutProgress = Math.round((completedCheckoutSteps / 2) * 100);
  const checkoutPaymentMethods = useMemo(
    () => isOlvaShipping ? paymentMethods.filter((method) => method.type !== "cash") : paymentMethods,
    [isOlvaShipping, paymentMethods],
  );
  const total = subtotal + (selectedShipping?.cost ?? 0);
  const discount = appliedCoupon?.estimatedDiscountAmount ?? 0;
  const totalWithDiscount = Math.max(0, total - discount);
  const packageItems = useMemo(() => items.map(toShippingPackageItem), [items]);
  const packageSummary = useMemo(() => calculatePackageSummary(packageItems), [packageItems]);

  useEffect(() => {
    if (!isOlvaShipping) {
      return;
    }

    setPaymentMethodId((currentId) => {
      const currentMethod = paymentMethods.find((method) => method.id === currentId);
      if (currentMethod?.type !== "cash") {
        return currentId;
      }

      return paymentMethods.find((method) => method.type !== "cash")?.id ?? "";
    });
  }, [isOlvaShipping, paymentMethods]);

  useEffect(() => {
    let isActive = true;

    if (!token) {
      setPendingReceiptCount(0);
      return () => {
        isActive = false;
      };
    }

    apiRequest<Order[]>("/api/orders/me", { token })
      .then(async (orders) => {
        const paymentsByOrder = await Promise.all(
          orders.map((order) => apiRequest<Payment[]>(`/api/payments/order/${order.id}`, { token }).catch(() => [])),
        );
        const count = paymentsByOrder.flat().filter((payment) => payment.status === "pendingReceipt" || payment.status === "rejected").length;
        if (isActive) {
          setPendingReceiptCount(count);
        }
      })
      .catch(() => {
        if (isActive) {
          setPendingReceiptCount(0);
        }
      });

    return () => {
      isActive = false;
    };
  }, [token]);

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
          if (variant.physicalStock <= 0) {
            return null;
          }

          return {
            id: cartItem.id,
            productId: product.id,
            variantId: variant.id,
            productName: product.name,
            size: variant.size,
            color: variant.color,
            quantity: Math.min(cartItem.quantity, variant.physicalStock),
            availableStock: variant.physicalStock,
            unitPrice: variant.price ?? product.basePrice,
            currency: variant.currency ?? product.currency,
            imageUrl: mainImage?.url ?? null,
          } satisfies GuestCartItem;
        } catch {
          return fallback ? { ...fallback, id: cartItem.id, quantity: Math.min(cartItem.quantity, fallback.availableStock ?? 99) } : null;
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
    if (!isReady || token) {
      return;
    }

    let isActive = true;
    const storedItems = readGuestCart();
    const itemsWithVariants = storedItems.filter((item) => item.variantId && isGuid(item.variantId));
    if (itemsWithVariants.length === 0) {
      return () => {
        isActive = false;
      };
    }

    Promise.all(
      storedItems.map(async (item) => {
        if (!item.variantId || !isGuid(item.variantId)) {
          return item;
        }

        try {
          const variant = await apiRequest<ProductVariant>(`/api/product-variants/${item.variantId}`);
          if (variant.physicalStock <= 0) {
            return null;
          }

          return {
            ...item,
            availableStock: variant.physicalStock,
            quantity: Math.min(item.quantity, variant.physicalStock),
          };
        } catch {
          return item;
        }
      }),
    ).then((nextItems) => {
      if (!isActive) {
        return;
      }

      const normalizedItems = nextItems.filter((item): item is GuestCartItem => item !== null);
      writeGuestCart(normalizedItems);
      setItems(normalizedItems);
    });

    return () => {
      isActive = false;
    };
  }, [isReady, token]);

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
          clientEnv.izipayEnabled,
        );
        setPaymentMethods(availablePaymentMethods);
        setPaymentMethodId((currentId) => availablePaymentMethods.some((method) => method.id === currentId) ? currentId : availablePaymentMethods[0]?.id ?? "");
        setAccount(nextAccount);
      })
      .catch(() => setCheckoutMessage("Inicia sesion con una direccion guardada para finalizar la compra."));
  }, [token]);

  useEffect(() => {
    if (isOutsideLima || !selectedAddress) {
      return;
    }

    setDepartmentId(selectedAddress.departmentId);
    setProvinceId(selectedAddress.provinceId);
    setDistrictId(selectedAddress.districtId);
    setOlvaAgencies([]);
    setSelectedAgencyId("");
    setShippingOptions([]);
    setSelectedShippingIndex(0);
    setShippingMessage("");
  }, [isOutsideLima, selectedAddress]);

  useEffect(() => {
    if (isOutsideLima || !selectedAddress || !departmentId || !provinceId || districtId !== selectedAddress.districtId) {
      return;
    }

    void calculateShipping(districtId);
    // The address already contains the three location ids required by the API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId, districtId, isOutsideLima, provinceId, selectedAddress?.districtId, selectedAddress?.id]);

  useEffect(() => {
    apiRequest<Department[]>("/api/departments?onlyActive=true")
      .then((nextDepartments) => {
        setDepartments(nextDepartments.filter(isValidLocationOption));
      })
      .catch(() => setShippingMessage("No pudimos cargar las zonas de envio."));
  }, []);

  useEffect(() => {
    if (!isOutsideLima || !departmentId) {
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
  }, [departmentId, isOutsideLima, selectedDepartment?.name]);

  useEffect(() => {
    if (!isOutsideLima || !provinceId) {
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
  }, [isOutsideLima, provinceId, selectedDepartment?.name, selectedProvince?.name]);

  async function updateQuantity(itemId: string, quantity: number) {
    setIsCheckoutOpen(false);
    const item = items.find((entry) => entry.id === itemId);
    const requestedQuantity = Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1;
    const nextQuantity = item?.availableStock != null
      ? Math.min(requestedQuantity, item.availableStock)
      : requestedQuantity;
    if (item?.availableStock != null && requestedQuantity > item.availableStock) {
      setCheckoutMessage(`Solo quedan ${item.availableStock} unidad${item.availableStock === 1 ? "" : "es"} de ${item.productName}.`);
      return;
    }
    if (token && cartId && item?.variantId && isGuid(item.variantId)) {
      try {
        await apiRequest<void>("/api/cart/items", {
          method: "PUT",
          token,
          body: { cartId, productVariantId: item.variantId, quantity: nextQuantity },
        });
        writeGuestCart([]);
        const nextItems = items.map((entry) => entry.id === itemId ? { ...entry, quantity: nextQuantity } : entry);
        setItems(nextItems);
        void refreshCartCoupon();
        if (districtId) {
          void calculateShipping(districtId, nextItems);
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
    setIsCheckoutOpen(false);
    const item = items.find((entry) => entry.id === itemId);
    if (token && cartId && item?.variantId && isGuid(item.variantId)) {
      try {
        await apiRequest<void>("/api/cart/items", {
          method: "DELETE",
          token,
          body: { cartId, productVariantId: item.variantId },
        });
        writeGuestCart([]);
        const nextItems = items.filter((entry) => entry.id !== itemId);
        setItems(nextItems);
        void refreshCartCoupon();
        if (districtId) {
          void calculateShipping(districtId, nextItems);
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

  async function refreshCartCoupon() {
    if (!token) {
      return;
    }

    try {
      const cart = await apiRequest<Cart>("/api/cart/me", { token });
      setAppliedCoupon(cart.appliedCoupons[0] ?? null);
    } catch {
      // The quantity update already succeeded; coupon refresh is secondary.
    }
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

    const nextDistrict = districts.find((district) => district.id === nextDistrictId) ?? (
      !isOutsideLima && selectedAddress?.districtId === nextDistrictId
        ? { id: nextDistrictId, provinceId, name: "Distrito", ubigeo: null, isActive: true }
        : null
    );
    if (!selectedDepartment || !selectedProvince || !nextDistrict || cartItems.length === 0) {
      setOlvaAgencies([]);
      setSelectedAgencyId("");
      setShippingOptions([]);
      setSelectedShippingIndex(0);
      return;
    }

    setIsLoadingShipping(true);
    const destinationType = isOutsideLima ? "province" : "lima";
    const nextPackageItems = cartItems.map(toShippingPackageItem);
    const nextPackageSummary = calculatePackageSummary(nextPackageItems);
    const nextSubtotal = calculateSubtotal(cartItems);
    const nextAgencies =
      destinationType === "province"
        ? await apiRequest<OlvaAgency[]>(
            `/api/shipping/olva/agencies?${new URLSearchParams({
              department: selectedDepartment.name,
              province: selectedProvince.name,
              district: formatOlvaDistrictName(nextDistrict.name),
              pageSize: "200",
            }).toString()}`,
          ).catch(() => [])
        : [];

    if (requestId !== shippingRequestId.current) {
      return;
    }

    setOlvaAgencies(nextAgencies);
    setSelectedAgencyId("");

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
        const message = error instanceof ApiClientError && error.status === 404
          ? "No hay una tarifa de envio configurada para esta zona. Selecciona otro departamento o solicita que se configure la tarifa."
          : error instanceof Error ? error.message : "No pudimos calcular el envio.";
        setShippingMessage(message);
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
      if (!clientEnv.izipayEnabled) {
        throw new Error("Izipay se habilitara cuando la tienda este desplegada y sus URLs publicas esten configuradas.");
      }

      const customer = account ?? await apiRequest<UserAccount>("/api/users/me", { token });
      const address = addresses.find((entry) => entry.id === selectedAddressId);
      const agencyStreet = selectedAgency?.address || selectedAgency?.name || "Recojo en agencia Olva";
      if (!address && !isOlvaShipping) {
        throw new Error("No pudimos recuperar la direccion seleccionada.");
      }

      const contact = toIzipayContact(
        customer,
        address ?? null,
        selectedDistrict?.name ?? selectedAgency?.district ?? address?.districtId ?? "Peru",
        selectedDepartment?.name ?? selectedAgency?.department ?? address?.departmentId ?? "Peru",
        izipayDocument,
        izipayPostalCode,
        agencyStreet,
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
      return null;
    }

    const createdPayment = await apiRequest<CreatedResponse>("/api/payments", {
      method: "POST",
      token,
      body: {
        orderId: order.id,
        paymentMethodId: paymentMethod.id,
        amount: order.total,
        currency: order.currency,
      },
    });
    return createdPayment.id;
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
      const paymentId = await submitPaymentForOrder(order, paymentMethod);
      if (paymentMethod.requiresManualVerification && paymentId) {
        navigate(`/payments?orderId=${encodeURIComponent(order.id)}&paymentId=${encodeURIComponent(paymentId)}`);
        return;
      }
      setCheckoutStatus("success");
      setCheckoutMessage("Pago listo para continuar.");
    } catch (error) {
      setCheckoutStatus("error");
      setCheckoutMessage(error instanceof Error ? error.message : "No se pudo reintentar el pago.");
    }
  }

  async function handleCheckout() {
    setCheckoutStatus("submitting");
    setCheckoutMessage("");
    setPaymentLink(null);
    setOrderConfirmation(null);
    setCreatedOrderId(null);
    let orderCreatedInRequest: string | null = null;

    try {
      if (!token) {
        throw new Error("Inicia sesion para finalizar la compra.");
      }
      if (!cartId || items.length === 0) {
        throw new Error("Tu carrito esta vacio o aun no se sincronizo.");
      }
      if (needsDeliveryAddress && !selectedAddressId) {
        throw new Error("Selecciona una direccion de entrega o agrega una desde tu perfil.");
      }
      if (isOlvaShipping && !selectedAgencyId) {
        throw new Error("Selecciona una agencia Olva para continuar.");
      }
      if (!selectedShipping || selectedShipping.source !== "backend" || !selectedShipping.shippingRateId) {
        throw new Error("Selecciona una tarifa de envio calculada por el servidor antes de pagar.");
      }
      if (!isGuid(departmentId) || !isGuid(provinceId) || !isGuid(districtId)) {
        throw new Error("Selecciona un departamento, provincia y distrito validos antes de pagar.");
      }
      const paymentMethod = paymentMethods.find((method) => method.id === paymentMethodId);
      if (!paymentMethod) {
        throw new Error("Selecciona un metodo de pago.");
      }
      if (isOlvaShipping && paymentMethod.type === "cash") {
        throw new Error("El pago en efectivo no esta disponible para envios por Olva Courier.");
      }
      if (paymentMethod.type === "gateway" && paymentMethod.requiresExternalIntegration) {
        if (!clientEnv.izipayEnabled) {
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
          addressId: needsDeliveryAddress ? selectedAddressId : null,
          shippingRateId: selectedShipping.shippingRateId,
          shippingAgencyId: selectedDestinationType === "province" ? selectedAgencyId || null : null,
          shippingDepartmentId: departmentId,
          shippingProvinceId: provinceId,
          shippingDistrictId: districtId,
          couponId: appliedCoupon?.couponId ?? null,
        },
      });
      const order = await apiRequest<{ id: string; total: number; currency: string }>(`/api/orders/${createdOrder.id}`, { token });
      orderCreatedInRequest = order.id;
      setCreatedOrderId(order.id);
      setItems([]);
      setCartId(null);
      writeGuestCart([]);
      const paymentId = await submitPaymentForOrder(order, paymentMethod);
      if (paymentMethod.requiresManualVerification && paymentId) {
        setOrderConfirmation({
          orderId: order.id,
          nextPath: `/payments?orderId=${encodeURIComponent(order.id)}&paymentId=${encodeURIComponent(paymentId)}`,
        });
        return;
      }
      setCheckoutStatus("success");
      setOrderConfirmation({ orderId: order.id });
    } catch (error) {
      setCheckoutStatus("error");
      const paymentError = error instanceof Error ? error.message : "No se pudo finalizar la compra.";
      setCheckoutMessage(orderCreatedInRequest
        ? `El pedido #${orderCreatedInRequest.slice(0, 8).toUpperCase()} fue creado, pero el pago no termino. Puedes reintentarlo.`
        : paymentError);
    }
  }

  function acceptOrderConfirmation() {
    const nextPath = orderConfirmation?.nextPath;
    setOrderConfirmation(null);
    setCreatedOrderId(null);
    setCheckoutMessage("");

    if (nextPath) {
      navigate(nextPath);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8f5f0] text-zinc-950">
      <div className="bg-zinc-950 px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white sm:px-4 sm:py-2 sm:text-xs sm:tracking-[0.18em]">
        {token ? "Carrito sincronizado con tu cuenta" : "Carrito reservado como invitado hasta iniciar sesion"}
      </div>
      <header className="border-b border-zinc-200">
        <div className="mx-auto grid min-h-16 max-w-7xl grid-cols-[1fr_auto] grid-rows-[auto_auto] items-center gap-x-3 gap-y-2 px-3 py-2 sm:min-h-20 sm:grid-cols-[1fr_auto_1fr] sm:grid-rows-1 sm:gap-4 sm:px-6 sm:py-0">
          <nav className="col-start-1 row-start-2 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.1em] sm:col-start-1 sm:row-start-1 sm:gap-5 sm:text-sm sm:tracking-[0.12em]">
            <Link href="/">Inicio</Link>
            <Link href="/catalog">Catalogo</Link>
          </nav>
          <Link aria-label="Sweet Silvia Store" className="col-span-2 row-start-1 justify-self-center sm:col-span-1 sm:col-start-2 sm:row-start-1" href="/">
            <BrandLogo className="w-24 sm:w-40" priority />
          </Link>
          <div className="col-start-2 row-start-2 flex items-center justify-self-end gap-2 sm:col-start-3 sm:row-start-1 sm:gap-3">
            {user ? (
              <Link
                className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white/85 px-2 py-2 text-xs shadow-sm transition hover:border-rose-200 hover:bg-rose-50 sm:px-3"
                href="/profile"
                title={user.email}
              >
                <span className="grid size-7 place-items-center rounded-full bg-rose-100 text-[11px] font-bold uppercase text-rose-700">
                  {user.email.slice(0, 1)}
                </span>
                <span className="hidden max-w-44 truncate text-left leading-tight sm:block">
                  <span className="block text-[10px] uppercase tracking-[0.12em] text-zinc-500">{user.role === "Cliente" ? "Sweet Reina" : user.role}</span>
                  <span className="block truncate text-zinc-950">{user.email}</span>
                </span>
              </Link>
            ) : (
              <Link className="text-[11px] font-semibold uppercase tracking-[0.1em] sm:text-sm sm:tracking-[0.12em]" href="/login">
                Iniciar sesion
              </Link>
            )}
            {user?.role === "Cliente" ? <CustomerPaymentStatusIcon token={token} /> : null}
            <CartNavLink />
          </div>
        </div>
      </header>

      {pendingReceiptCount > 0 ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-sm">
            <p>
              Tienes <span className="font-semibold">{pendingReceiptCount} comprobante{pendingReceiptCount === 1 ? "" : "s"}</span> pendiente{pendingReceiptCount === 1 ? "" : "s"} por subir.
            </p>
            <Link className="font-semibold uppercase tracking-[0.1em] text-amber-900 underline underline-offset-4" href="/profile?section=receipts">
              Subir comprobante
            </Link>
          </div>
        </div>
      ) : null}

      <section className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-10">
        {checkoutOnly ? (
          <div className="mb-8 max-w-3xl">
            <Link className="inline-flex text-xs font-semibold uppercase tracking-[0.12em] text-rose-800" href="/cart">
              Volver al carrito
            </Link>
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-rose-800 sm:text-sm sm:tracking-[0.18em]">Finalizar compra</p>
            <h1 className="mt-2 font-serif text-4xl font-semibold tracking-normal sm:text-6xl">Configura tu entrega</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              Confirma cómo recibirás tu pedido y elige el método de pago para terminar la compra.
            </p>
          </div>
        ) : null}

        <div className={checkoutOnly ? "block" : "flex flex-col gap-8 lg:flex-row lg:items-start"}>
        <div className={checkoutOnly ? "hidden" : "min-w-0 flex-1"}>
          {checkoutOnly ? null : (
          <>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-800 sm:text-sm sm:tracking-[0.18em]">Carrito</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold tracking-normal sm:text-6xl">Tus prendas</h1>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-zinc-600 sm:mt-3 sm:text-sm sm:leading-6">
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
            <div className="mt-5 space-y-3 sm:mt-8 sm:space-y-4">
              {items.map((item) => (
                <article className="grid min-w-0 grid-cols-[80px_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm sm:grid-cols-[132px_1fr_auto] sm:gap-4 sm:p-4" key={item.id}>
                  <CartItemImage item={item} />
                  <div className="py-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-800 sm:text-xs sm:tracking-[0.16em]">Sweet Silvia</p>
                    <h2 className="mt-1 text-xs font-semibold uppercase tracking-[0.06em] sm:mt-2 sm:text-sm sm:tracking-[0.08em]">{item.productName}</h2>
                    <p className="mt-1 text-xs text-zinc-600 sm:mt-2 sm:text-sm">
                      Talla {item.size} - {item.color}
                    </p>
                    <p className="mt-2 text-xs font-semibold sm:mt-3 sm:text-sm">
                      {formatMoney(item.unitPrice, item.currency)}
                    </p>
                    <p className="mt-1 text-[10px] text-zinc-500 sm:mt-2 sm:text-xs">Linea: {formatMoney(item.unitPrice * item.quantity, item.currency)}</p>
                  </div>
                  <div className="flex min-w-0 flex-col items-end gap-2 pt-0.5 sm:gap-3 sm:pt-0">
                    <QuantityStepper
                      label={`Cantidad de ${item.productName}`}
                      max={item.availableStock ?? undefined}
                      onDecrease={() => void updateQuantity(item.id, item.quantity - 1)}
                      onIncrease={() => void updateQuantity(item.id, item.quantity + 1)}
                      value={item.quantity}
                    />
                    <button className="text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-800 sm:text-xs sm:tracking-[0.14em]" onClick={() => void removeItem(item.id)} type="button">
                      Quitar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          </>
          )}
        </div>

        <aside className={`h-fit w-full shrink-0 rounded-lg border border-[#e7dfdc] bg-[#fffdfb] p-4 shadow-sm sm:p-6 ${checkoutOnly ? "lg:mx-auto lg:grid lg:max-w-[1120px] lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-x-10 lg:p-8" : "lg:sticky lg:top-6 lg:mt-36 lg:w-[360px]"}`}>
          <p className={checkoutOnly ? "text-xs font-semibold uppercase tracking-[0.18em] text-rose-800 lg:col-span-2" : "text-xs font-semibold uppercase tracking-[0.18em] text-rose-800"}>Pedido</p>
          <h2 className={checkoutOnly ? "mt-1 border-b border-[#e7dfdc] pb-5 font-serif text-2xl font-semibold tracking-normal sm:text-3xl lg:col-span-2" : "mt-1 font-serif text-2xl font-semibold tracking-normal sm:text-3xl"}>Resumen</h2>
          {checkoutOnly ? (
            <div className="mt-6 lg:col-span-2 lg:row-start-3">
              <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                <span>Progreso del pedido</span>
                <span className="text-[#7c4f58]">{completedCheckoutSteps} de 2</span>
              </div>
              <div aria-label={`${checkoutProgress}% del checkout completado`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={checkoutProgress} className="mt-3 h-2 overflow-hidden rounded-full bg-[#f0e3e2]" role="progressbar">
                <div className="h-full rounded-full bg-[#b85c72] transition-all duration-300" style={{ width: `${checkoutProgress}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                <span className={hasShippingSelection ? "text-[#7c4f58]" : ""}>Envío</span>
                <span className={paymentMethodId ? "text-right text-[#7c4f58]" : "text-right"}>Pago</span>
              </div>
            </div>
          ) : null}

          {checkoutMode ? <section className={checkoutOnly ? "mt-6 border-y border-zinc-200 py-5 lg:col-start-1 lg:row-start-4 lg:mt-8" : "mt-6 border-y border-zinc-200 py-5"}>
            <div className="flex items-start justify-between gap-3">
              <button className="flex min-w-0 items-center gap-3 text-left" onClick={() => setActiveCheckoutStep("shipping")} type="button">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-rose-100 text-xs font-bold text-rose-800">1</span>
                <span>
                  <span className="block text-sm font-semibold uppercase tracking-[0.14em]">Lugar de envio</span>
                  <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-zinc-500">Zona, distrito y agencia</span>
                </span>
              </button>
              <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] ${hasShippingSelection ? "text-[#7c4f58]" : "text-rose-800"}`}>
                {hasShippingSelection ? "Listo" : "Pendiente"}
              </span>
              {checkoutOnly ? (
                <Link className="hidden shrink-0 text-xs font-semibold uppercase tracking-[0.1em] text-rose-800 sm:inline-flex" href="/cart">Volver a prendas</Link>
              ) : (
                <button className="shrink-0 text-xs font-semibold uppercase tracking-[0.1em] text-rose-800" onClick={() => setIsCheckoutOpen(false)} type="button">
                  Volver a prendas
                </button>
              )}
            </div>
            {activeCheckoutStep === "shipping" ? (
              <>
            <p className="mt-2 text-xs leading-5 text-zinc-500">Selecciona una zona y se calcula una sola tarifa para todo el carrito.</p>
            {items.length > 0 && districtId ? (
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                Paquete estimado: {packageSummary.chargeableWeightKg.toFixed(2)} kg cobrables por volumen/peso.
              </p>
            ) : null}

            <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-lg border border-[#e7dfdc] bg-[#fbf8f5] p-3">
              <input checked={isOutsideLima} className="h-4 w-4 accent-[#b85c72]" onChange={(event) => {
                const outsideLima = event.target.checked;
                setIsOutsideLima(outsideLima);
                setActiveCheckoutStep("shipping");
                setShippingMessage("");
                setShippingOptions([]);
                setSelectedShippingIndex(0);
                setSelectedAgencyId("");
                setOlvaAgencies([]);
                if (outsideLima) {
                  setSelectedAddressId("");
                  setDepartmentId("");
                  setProvinceId("");
                  setDistrictId("");
                } else {
                  const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];
                  setSelectedAddressId(defaultAddress?.id ?? "");
                }
              }} type="checkbox" />
              <span>
                <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-[#4a3037]">Estoy fuera de Lima</span>
                <span className="mt-1 block text-xs leading-5 text-zinc-500">Activa esta opción para elegir un departamento y una agencia Olva</span>
              </span>
            </label>

            {isOutsideLima ? (
              <>
            <div className="mt-4 grid gap-3">
              <select
                className="h-11 rounded-lg border border-[#d9cfcc] bg-white px-3 text-sm outline-none transition focus:border-rose-700"
                value={departmentId}
                onChange={(event) => {
                  setActiveCheckoutStep("shipping");
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
                {shippingDepartments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
              <select
                className="h-11 rounded-lg border border-[#d9cfcc] bg-white px-3 text-sm outline-none transition focus:border-rose-700 disabled:bg-zinc-100 disabled:text-zinc-400"
                disabled={!departmentId}
                value={provinceId}
                onChange={(event) => {
                  setActiveCheckoutStep("shipping");
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
                className="h-11 rounded-lg border border-[#d9cfcc] bg-white px-3 text-sm outline-none transition focus:border-rose-700 disabled:bg-zinc-100 disabled:text-zinc-400"
                disabled={!provinceId || items.length === 0}
                value={districtId}
                onChange={(event) => {
                  setActiveCheckoutStep("shipping");
                  void calculateShipping(event.target.value);
                }}
              >
                <option value="">Distrito</option>
                {districts.map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.name}
                  </option>
                ))}
              </select>
            </div>

            </>
            ) : (
              <div className="mt-4 rounded-lg border border-[#e7dfdc] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4a3037]">Direccion para Lima</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">Selecciona una dirección guardada desde tu perfil para recibir el pedido.</p>
                  </div>
                  <Link className="shrink-0 text-right text-xs font-semibold uppercase tracking-[0.1em] text-rose-800" href="/profile?section=profile">Gestionar</Link>
                </div>
                <select className="admin-input mt-3" value={selectedAddressId} onChange={(event) => {
                  setSelectedAddressId(event.target.value);
                  setActiveCheckoutStep("shipping");
                }}>
                  <option value="">Seleccionar dirección</option>
                  {addresses.map((address) => <option key={address.id} value={address.id}>{address.receiverName} - {address.line}</option>)}
                </select>
                {selectedAddress ? <p className="mt-2 text-xs leading-5 text-zinc-600"><span className="font-semibold">{selectedAddress.receiverName}</span> - {selectedAddress.line}{selectedAddress.references ? ` - ${selectedAddress.references}` : ""}</p> : null}
                {addresses.length === 0 ? <p className="mt-2 text-xs font-semibold leading-5 text-rose-800">Agrega una dirección desde tu perfil para continuar.</p> : null}
              </div>
            )}

            {isLoadingShipping ? <p className="mt-3 text-sm text-zinc-500">Calculando envio...</p> : null}
            {shippingMessage ? <p className="mt-3 rounded-lg border border-dashed border-[#d9cfcc] bg-[#fbf8f5] p-3 text-xs leading-5 text-zinc-600">{shippingMessage}</p> : null}

            {shippingOptions.length > 0 ? (
              <div className="mt-4 grid gap-3">
                {shippingOptions.map((option, index) => (
                  <button
                    aria-pressed={selectedShippingIndex === index}
                    className={`rounded-lg border p-4 text-left transition ${
                      selectedShippingIndex === index
                        ? "border-[#30272b] bg-[#30272b] text-white shadow-sm"
                        : "border-[#e7dfdc] bg-white hover:border-rose-300 hover:bg-rose-50/30"
                    }`}
                    key={`${option.label}-${option.cost}`}
                    onClick={() => {
                      setSelectedShippingIndex(index);
                      if (selectedDestinationType === "lima") {
                        if (selectedAddressId) {
                          setActiveCheckoutStep("payment");
                        }
                      } else if (selectedDestinationType === "province" && selectedAgencyId) {
                        setActiveCheckoutStep("payment");
                      }
                    }}
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
                    <p className={`mt-2 text-[11px] leading-5 ${selectedShippingIndex === index ? "text-zinc-300" : "text-zinc-500"}`} title={`Peso real ${option.actualWeightKg.toFixed(2)} kg | volumetrico ${option.volumetricWeightKg.toFixed(2)} kg | cobrable ${option.chargeableWeightKg.toFixed(2)} kg`}>
                      Peso cobrable {option.chargeableWeightKg.toFixed(2)} kg
                      {option.volumeSurcharge > 0 ? ` · Recargo ${formatMoney(option.volumeSurcharge, "PEN")}` : ""}
                    </p>
                    {option.source === "estimate" ? <p className={`mt-2 text-xs ${selectedShippingIndex === index ? "text-zinc-300" : "text-zinc-500"}`}>Costo referencial.</p> : null}
                  </button>
                ))}
              </div>
            ) : null}

            {selectedDestinationType === "province" && selectedDistrict && olvaAgencies.length > 0 ? (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Elige agencia de recojo</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">Mostramos las agencias disponibles en la provincia seleccionada.</p>
                <div className="mt-3 grid max-h-80 gap-3 overflow-y-auto pr-1">
                {olvaAgencies.map((agency) => (
                  <button
                    aria-pressed={selectedAgencyId === agency.id}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      selectedAgencyId === agency.id ? "border-[#30272b] bg-[#30272b] text-white shadow-sm" : "border-[#e7dfdc] bg-white hover:border-rose-300 hover:bg-rose-50/30"
                    }`}
                    key={agency.id}
                    onClick={() => {
                      setSelectedAgencyId(agency.id);
                      if (selectedShipping?.shippingRateId) {
                        setActiveCheckoutStep("payment");
                      }
                    }}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em]">{formatAgencyName(agency.name)}</p>
                      {selectedAgencyId === agency.id ? (
                        <span className="shrink-0 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-950">Elegida</span>
                      ) : null}
                    </div>
                    <p className={`mt-2 text-xs ${selectedAgencyId === agency.id ? "text-zinc-300" : "text-zinc-500"}`}>
                      {agency.district ?? "Provincia seleccionada"} · {agency.province ?? selectedProvince?.name ?? "Provincia seleccionada"}
                    </p>
                  </button>
                ))}
                </div>
                {selectedAgency ? (
                  <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 p-3 text-xs leading-5 text-teal-950">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold uppercase tracking-[0.08em]">Agencia seleccionada</p>
                      {selectedAgency.code ? <span className="text-[10px] font-semibold uppercase tracking-[0.1em]">{selectedAgency.code}</span> : null}
                    </div>
                    <p className="mt-2 font-semibold">{formatAgencyName(selectedAgency.name)}</p>
                    {selectedAgency.address ? <p className="mt-1">{selectedAgency.address}</p> : null}
                    {selectedAgency.phone ? <p className="mt-1">Telefono: {selectedAgency.phone}</p> : null}
                    {selectedAgency.scheduleJson ? <p className="mt-1">Horario: {formatAgencySchedule(selectedAgency.scheduleJson)}</p> : null}
                  </div>
                ) : null}
              </div>
            ) : null}
              </>
            ) : (
              <div className="mt-4 rounded-lg border border-[#e9b9c4] bg-[#fdf1f3] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7c4f58]">Envio seleccionado</p>
                <p className="mt-2 text-sm font-semibold text-[#4a3037]">
                  {selectedDepartment?.name} · {selectedProvince?.name} · {selectedDistrict?.name}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#6f4650]">
                  {selectedAgency ? `Recojo en ${formatAgencyName(selectedAgency.name)}` : selectedShipping?.label}
                </p>
                <button className="mt-3 text-xs font-semibold uppercase tracking-[0.1em] text-rose-800" onClick={() => setActiveCheckoutStep("shipping")} type="button">
                  Editar envio
                </button>
              </div>
            )}
          </section> : null}

          <div className={checkoutOnly ? "mt-6 space-y-3 text-sm lg:col-start-2 lg:row-start-4 lg:row-span-2 lg:mt-8 lg:self-start lg:rounded-lg lg:border lg:border-[#e7dfdc] lg:bg-[#fbf8f5] lg:p-5" : "mt-6 space-y-3 text-sm"}>
            {checkoutOnly ? (
              <div className="mb-5 border-b border-zinc-200 pb-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Prendas</span>
                  <Link className="text-xs font-semibold uppercase tracking-[0.1em] text-rose-800" href="/cart">Editar</Link>
                </div>
                <div className="divide-y divide-zinc-100">
                  {items.map((item) => (
                    <div className="flex items-center justify-between gap-4 py-3" key={item.id}>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{item.productName}</p>
                        <p className="mt-1 text-xs text-zinc-500">Talla {item.size} - {item.color} · Cantidad {item.quantity}</p>
                      </div>
                      <span className="shrink-0 font-semibold">{formatMoney(item.unitPrice * item.quantity, item.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
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

          {token ? (checkoutMode ? (
            <div className={checkoutOnly ? "mt-6 space-y-4 lg:col-start-1 lg:row-start-5 lg:mt-8" : "mt-6 space-y-4"}>
              <details className="rounded-lg border border-[#e7dfdc] bg-[#fbf8f5] p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold uppercase tracking-[0.14em]">
                  <span>Cupon {appliedCoupon ? "aplicado" : "opcional"}</span>
                  {appliedCoupon ? <span className="text-emerald-700">-{formatMoney(discount, appliedCoupon.currency)}</span> : <span className="text-xs font-normal normal-case tracking-normal text-zinc-500">Agregar codigo</span>}
                </summary>
                <div className="mt-3 border-t border-zinc-200 pt-3">
                  <p className="text-xs text-zinc-500">Un solo cupon por carrito. El servidor confirma el descuento al crear la orden.</p>
                  {appliedCoupon ? (
                    <button className="mt-3 text-xs font-semibold uppercase tracking-[0.1em] text-rose-800" onClick={() => void removeCoupon()} type="button">Quitar cupon</button>
                  ) : (
                    <>
                      <input className="admin-input mt-3" placeholder="Codigo de cupon" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} />
                      <select className="admin-input mt-3" value={couponItemId || items[0]?.id || ""} onChange={(event) => setCouponItemId(event.target.value)}>
                        <option value="">Prenda para cupon de item</option>
                        {items.map((item) => <option key={item.id} value={item.id}>{item.productName} - {item.size} {item.color}</option>)}
                      </select>
                      <input className="admin-input mt-3" min="1" max={items.find((item) => item.id === (couponItemId || items[0]?.id))?.quantity ?? 1} type="number" value={couponQuantity} onChange={(event) => setCouponQuantity(event.target.value)} />
                      <button className="admin-secondary-button mt-3 w-full" disabled={!couponCode.trim() || checkoutStatus === "submitting"} onClick={() => void applyCoupon()} type="button">Aplicar cupon</button>
                    </>
                  )}
                </div>
              </details>

              <section className="rounded-lg border border-[#e7dfdc] bg-[#fbf8f5] p-4">
                <div className="flex items-start justify-between gap-3">
                  <button className="flex min-w-0 items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-50" disabled={!hasShippingSelection} onClick={() => setActiveCheckoutStep("payment")} type="button">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-rose-100 text-xs font-bold text-rose-800">2</span>
                    <span>
                      <span className="block text-sm font-semibold uppercase tracking-[0.14em]">Metodo de pago</span>
                      <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-zinc-500">Elige cómo pagarás tu pedido</span>
                    </span>
                  </button>
                  <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] ${paymentMethodId ? "text-[#7c4f58]" : "text-rose-800"}`}>
                    {paymentMethodId ? "Listo" : "Pendiente"}
                  </span>
                </div>
                {activeCheckoutStep === "payment" ? (
                  <>
                    <PaymentMethodPicker methods={checkoutPaymentMethods} value={paymentMethodId} onChange={setPaymentMethodId} showGatewayPlaceholder />
                    {paymentMethods.find((method) => method.id === paymentMethodId)?.type === "gateway" ? (
                      <div className="mt-3 space-y-3 rounded-lg border border-zinc-200 bg-white p-3">
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
                  </>
                ) : (
                  <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-3 text-xs leading-5 text-zinc-600">
                    {paymentMethodId ? `Metodo seleccionado: ${paymentMethods.find((method) => method.id === paymentMethodId)?.name ?? "Pago seleccionado"}.` : "Se habilitará cuando confirmes el lugar de envío."}
                  </p>
                )}
              </section>

              <button className="admin-primary-button w-full" disabled={checkoutStatus === "submitting" || items.length === 0 || !hasShippingSelection || !paymentMethodId} onClick={() => void handleCheckout()} type="button">
                {checkoutStatus === "submitting" ? "Procesando..." : "Crear pedido y pagar"}
              </button>
              {createdOrderId && checkoutStatus === "error" && !paymentLink ? <button className="admin-secondary-button w-full" onClick={() => void retryPayment()} type="button">Reintentar pago del pedido</button> : null}
              {paymentLink ? <a className="block rounded-lg bg-zinc-950 px-4 py-3 text-center text-sm font-semibold uppercase tracking-[0.1em] text-white" href={paymentLink.paymentUrl} rel="noreferrer" target="_blank">Abrir pago Izipay</a> : null}
              {checkoutMessage ? <p className="rounded-lg border border-zinc-200 bg-white p-3 text-xs leading-5 text-zinc-600">{checkoutMessage}</p> : null}
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-zinc-200 bg-[#f8f5f0] p-4">
              <p className="text-sm font-semibold">¿Ya confirmaste tus prendas?</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">Continua para elegir la zona de entrega y el metodo de pago.</p>
              <button className="admin-primary-button mt-4 w-full" disabled={items.length === 0} onClick={() => navigate("/checkout")} type="button">
                Seleccionar envio
              </button>
            </div>
          )) : (
            <>
              <Link href="/login" className="mt-6 flex w-full justify-center rounded-lg bg-zinc-950 px-5 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-white">Iniciar sesion para comprar</Link>
              <p className="mt-3 text-xs leading-5 text-zinc-500">Tus productos se guardan como invitado. Para finalizar la compra se usara tu cuenta.</p>
            </>
          )}
        </aside>
        </div>
      </section>
      {orderConfirmation ? (
        <div aria-labelledby="order-confirmation-title" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4" role="dialog">
          <div className="w-full max-w-sm rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-2xl">
            <div aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">OK</div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Pedido confirmado</p>
            <h2 id="order-confirmation-title" className="mt-2 font-serif text-2xl font-semibold">Tu pedido fue creado</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Numero de pedido: <span className="font-semibold text-zinc-950">#{orderConfirmation.orderId.slice(0, 8).toUpperCase()}</span>
            </p>
            <button className="admin-primary-button mt-6 w-full" onClick={acceptOrderConfirmation} type="button">Aceptar</button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function formatAgencySchedule(scheduleJson: string) {
  try {
    const schedule = JSON.parse(scheduleJson) as Record<string, unknown>;
    return Object.entries(schedule)
      .filter(([, value]) => typeof value === "string" && value.trim())
      .map(([day, value]) => `${formatScheduleDay(day)} ${value}`)
      .join(" · ");
  } catch {
    return scheduleJson;
  }
}

function formatScheduleDay(day: string) {
  return day.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}
