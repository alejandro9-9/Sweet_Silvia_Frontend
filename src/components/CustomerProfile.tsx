"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { PaymentReceiptUploadForm } from "@/components/UploadForms";
import { apiRequest, publicAssetUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Address, Department, District, Order, OrderItem, Payment, PaymentReceipt, Province, Shipment, ShipmentEvent, UserAccount } from "@/lib/types";

type ProfileSection = "orders" | "tracking" | "receipts" | "profile";

const profileSections: { id: ProfileSection; label: string }[] = [
  { id: "orders", label: "Pedidos" },
  { id: "tracking", label: "Seguimiento" },
  { id: "receipts", label: "Comprobantes" },
  { id: "profile", label: "Datos del perfil" },
];

export function CustomerProfile() {
  const { token, user, refresh } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSection = searchParams.get("section") as ProfileSection | null;
  const [activeSection, setActiveSection] = useState<ProfileSection>(isProfileSection(requestedSection) ? requestedSection : "orders");
  const currentSection = isProfileSection(requestedSection) ? requestedSection : activeSection;
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, OrderItem[]>>({});
  const [paymentsByOrder, setPaymentsByOrder] = useState<Record<string, Payment[]>>({});
  const [receiptsByPayment, setReceiptsByPayment] = useState<Record<string, PaymentReceipt[]>>({});
  const [shipmentsByOrder, setShipmentsByOrder] = useState<Record<string, Shipment[]>>({});
  const [eventsByShipment, setEventsByShipment] = useState<Record<string, ShipmentEvent[]>>({});
  const [profileMessage, setProfileMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [profileVersion, setProfileVersion] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function loadProfileData() {
      const [nextAccount, nextAddresses, nextOrders] = await Promise.all([
        apiRequest<UserAccount>("/api/users/me", { token }),
        apiRequest<Address[]>("/api/addresses/me", { token }).catch(() => []),
        apiRequest<Order[]>("/api/orders/me", { token }),
      ]);

      const orderDetails = await Promise.all(
        nextOrders.map(async (order) => {
          const [items, payments, shipments] = await Promise.all([
            apiRequest<OrderItem[]>(`/api/order-items/order/${order.id}`, { token }).catch(() => []),
            apiRequest<Payment[]>(`/api/payments/order/${order.id}`, { token }).catch(() => []),
            apiRequest<Shipment[]>(`/api/shipments/order/${order.id}`, { token }).catch(() => []),
          ]);

          return { order, items, payments, shipments };
        }),
      );

      const receiptPairs = await Promise.all(
        orderDetails
          .flatMap((detail) => detail.payments)
          .map(async (payment) => ({
            paymentId: payment.id,
            receipts: await apiRequest<PaymentReceipt[]>(`/api/payment-receipts/payment/${payment.id}`, { token }).catch(() => []),
          })),
      );

      const eventPairs = await Promise.all(
        orderDetails
          .flatMap((detail) => detail.shipments)
          .map(async (shipment) => ({
            shipmentId: shipment.id,
            events: await apiRequest<ShipmentEvent[]>(`/api/shipment-events/shipment/${shipment.id}`, { token }).catch(() => []),
          })),
      );

      if (!isActive) {
        return;
      }

      setAccount(nextAccount);
      setAddresses(nextAddresses);
      setOrders([...nextOrders].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()));
      setItemsByOrder(Object.fromEntries(orderDetails.map((detail) => [detail.order.id, detail.items])));
      setPaymentsByOrder(Object.fromEntries(orderDetails.map((detail) => [detail.order.id, detail.payments])));
      setShipmentsByOrder(Object.fromEntries(orderDetails.map((detail) => [detail.order.id, detail.shipments])));
      setReceiptsByPayment(Object.fromEntries(receiptPairs.map((entry) => [entry.paymentId, entry.receipts])));
      setEventsByShipment(Object.fromEntries(eventPairs.map((entry) => [entry.shipmentId, entry.events])));
    }

    loadProfileData()
      .catch((error: Error) => {
        if (isActive) {
          setProfileMessage(error.message);
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
  }, [profileVersion, token]);

  const pendingReceiptCount = useMemo(
    () => Object.values(paymentsByOrder).flat().filter((payment) => payment.status === "pendingReceipt" || payment.status === "rejected").length,
    [paymentsByOrder],
  );

  async function updateProfile(request: UpdateProfileRequest) {
    const updatedAccount = await apiRequest<UserAccount>("/api/users/me", {
      method: "PATCH",
      body: request,
      token,
    });
    setAccount(updatedAccount);
    await refresh();
    setProfileMessage("Datos del perfil actualizados correctamente.");
  }

  function handleAddressesChange(nextAddresses: Address[], successMessage: string) {
    setAddresses(nextAddresses);
    setProfileMessage(successMessage);
  }

  function handleSectionSelect(section: ProfileSection) {
    setActiveSection(section);
    if (requestedSection) {
      router.replace("/profile", { scroll: false });
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-rose-100 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">Mi cuenta</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl font-semibold tracking-normal sm:text-5xl">
              Hola, {account?.name ?? user?.email}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              Revisa tus pedidos, seguimiento, comprobantes y datos personales desde un solo espacio.
            </p>
          </div>
          <Link className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-white" href="/catalog">
            Seguir comprando
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <ProfileMetric label="Pedidos realizados" value={orders.length} />
        <ProfileMetric label="Comprobantes pendientes" value={pendingReceiptCount} />
        <ProfileMetric label="Direcciones" value={addresses.length} />
      </section>

      <section className="rounded-2xl border border-rose-100 bg-white p-2 shadow-sm">
        <div className="grid gap-2 md:grid-cols-4">
          {profileSections.map((section) => (
            <button
              className={currentSection === section.id ? "rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white" : "rounded-xl px-4 py-3 text-sm font-semibold text-zinc-600 hover:bg-rose-50 hover:text-rose-800"}
              key={section.id}
              onClick={() => handleSectionSelect(section.id)}
              type="button"
            >
              {section.label}
            </button>
          ))}
        </div>
      </section>

      {profileMessage ? <p className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-900">{profileMessage}</p> : null}
      {isLoading ? <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">Cargando tu perfil...</p> : null}

      {currentSection === "orders" ? <OrdersPanel itemsByOrder={itemsByOrder} orders={orders} paymentsByOrder={paymentsByOrder} /> : null}
      {currentSection === "tracking" ? <TrackingPanel eventsByShipment={eventsByShipment} orders={orders} shipmentsByOrder={shipmentsByOrder} /> : null}
      {currentSection === "receipts" ? (
        <ReceiptsPanel
          orders={orders}
          paymentsByOrder={paymentsByOrder}
          receiptsByPayment={receiptsByPayment}
          onReceiptUploaded={() => setProfileVersion((version) => version + 1)}
        />
      ) : null}
      {currentSection === "profile" ? <ProfileDataPanel account={account} addresses={addresses} onAddressesChange={handleAddressesChange} onSubmit={updateProfile} /> : null}
    </div>
  );
}

function OrdersPanel({ orders, itemsByOrder, paymentsByOrder }: { orders: Order[]; itemsByOrder: Record<string, OrderItem[]>; paymentsByOrder: Record<string, Payment[]> }) {
  return (
    <section className="grid gap-4">
      {orders.length === 0 ? <EmptyState title="Aun no tienes pedidos" text="Cuando completes una compra, la veras aqui." /> : null}
      {orders.map((order) => {
        const payment = paymentsByOrder[order.id]?.[0];
        return (
          <article className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm" key={order.id}>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">Pedido #{shortId(order.id)}</p>
                <h2 className="mt-2 text-xl font-semibold">{formatOrderStatus(order.status)}</h2>
                <p className="mt-1 text-sm text-zinc-500">{formatDate(order.createdAt)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-zinc-500">Total</p>
                <p className="text-lg font-semibold">{formatMoney(order.total, order.currency)}</p>
              </div>
            </div>
            {payment?.status === "rejected" ? (
              <RejectedPaymentNotice observation={payment.observation} />
            ) : null}
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_260px]">
              <div className="space-y-2">
                {(itemsByOrder[order.id] ?? []).map((item) => (
                  <div className="rounded-xl bg-rose-50/50 px-4 py-3 text-sm" key={item.id}>
                    <p className="font-semibold uppercase tracking-[0.06em]">{item.productName}</p>
                    <p className="mt-1 text-zinc-600">{item.quantity} und. - talla {item.size} - {item.color}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-zinc-200 p-4 text-sm">
                <SummaryRow label="Subtotal" value={formatMoney(order.subtotal, order.currency)} />
                <SummaryRow label="Envio" value={formatMoney(order.shippingCost, order.currency)} />
                <SummaryRow label="Pago" value={formatPaymentStatus(payment?.status)} />
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function TrackingPanel({ orders, shipmentsByOrder, eventsByShipment }: { orders: Order[]; shipmentsByOrder: Record<string, Shipment[]>; eventsByShipment: Record<string, ShipmentEvent[]> }) {
  const trackedOrders = orders.filter((order) => (shipmentsByOrder[order.id] ?? []).length > 0);

  return (
    <section className="grid gap-4">
      {trackedOrders.length === 0 ? <EmptyState title="Sin envios registrados" text="Cuando tu pedido tenga despacho, aparecera su avance aqui." /> : null}
      {trackedOrders.map((order) =>
        (shipmentsByOrder[order.id] ?? []).map((shipment) => (
          <article className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm" key={shipment.id}>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">Pedido #{shortId(order.id)}</p>
                <h2 className="mt-2 text-xl font-semibold">{formatShipmentStatus(shipment.status)}</h2>
                <p className="mt-1 text-sm text-zinc-500">{shipment.trackingCode ? `Tracking ${shipment.trackingCode}` : "Tracking por confirmar"}</p>
              </div>
              <p className="h-fit rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white">{formatMoney(shipment.shippingCost, shipment.currency)}</p>
            </div>
            <div className="mt-5 space-y-3 border-l-2 border-rose-100 pl-4">
              {(eventsByShipment[shipment.id] ?? []).length === 0 ? <p className="text-sm text-zinc-500">Aun no hay eventos de seguimiento.</p> : null}
              {(eventsByShipment[shipment.id] ?? []).map((event) => (
                <div className="relative text-sm" key={event.id}>
                  <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-rose-600 ring-4 ring-white" />
                  <p className="font-semibold">{event.description}</p>
                  <p className="mt-1 text-zinc-500">{event.location ?? "Sweet Silvia"} - {formatDate(event.eventDate)}</p>
                </div>
              ))}
            </div>
          </article>
        )),
      )}
    </section>
  );
}

function ReceiptsPanel({
  orders,
  paymentsByOrder,
  receiptsByPayment,
  onReceiptUploaded,
}: {
  orders: Order[];
  paymentsByOrder: Record<string, Payment[]>;
  receiptsByPayment: Record<string, PaymentReceipt[]>;
  onReceiptUploaded: () => void;
}) {
  const orderById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);
  const payments = orders.flatMap((order) => paymentsByOrder[order.id] ?? []);
  const editablePayments = payments.filter((payment) => isPaymentEditableByCustomer(payment, orderById.get(payment.orderId)));

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-4">
        {payments.length === 0 ? <EmptyState title="Sin pagos registrados" text="Cuando elijas un metodo de pago, el comprobante aparecera en esta seccion." /> : null}
        {payments.map((payment) => (
          <article className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm" key={payment.id}>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">Orden #{shortId(payment.orderId)}</p>
                <h2 className="mt-2 text-lg font-semibold">{formatPaymentStatus(payment.status)}</h2>
              </div>
              <p className="font-semibold">{formatMoney(payment.amount, payment.currency)}</p>
            </div>
            {payment.status === "rejected" ? <RejectedPaymentNotice observation={payment.observation} /> : null}
            <div className="mt-4 grid gap-3">
              {(receiptsByPayment[payment.id] ?? []).length === 0 ? <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">Aun no adjuntaste comprobante.</p> : null}
              {(receiptsByPayment[payment.id] ?? []).map((receipt) => (
                <a className="rounded-xl border border-zinc-200 p-4 text-sm hover:border-rose-300" href={publicAssetUrl(receipt.fileUrl)} key={receipt.id} target="_blank">
                  <span className="font-semibold">Comprobante {formatReceiptStatus(receipt.status)}</span>
                  <span className="mt-1 block text-zinc-500">{receipt.operationCode ?? "Sin codigo"} - {receipt.declaredAmount ? formatMoney(receipt.declaredAmount, receipt.currency ?? payment.currency) : "Sin monto declarado"}</span>
                </a>
              ))}
            </div>
            {isPaymentEditableByCustomer(payment, orderById.get(payment.orderId)) ? (
              <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50/30 p-4">
                <PaymentReceiptUploadForm
                  fixedOrder={orderById.get(payment.orderId)}
                  fixedPayment={payment}
                  onUploaded={onReceiptUploaded}
                  submitLabel={payment.status === "rejected" ? "Enviar nuevo comprobante" : "Agregar comprobante"}
                />
              </div>
            ) : null}
          </article>
        ))}
      </div>
      <aside className="h-fit rounded-2xl border border-rose-100 bg-white p-6 shadow-sm lg:sticky lg:top-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Acciones</p>
        <h2 className="mt-2 text-xl font-semibold">Comprobantes editables</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Solo puedes agregar o reemplazar comprobantes cuando el pago esta pendiente o fue rechazado por administracion.
        </p>
        <p className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
          {editablePayments.length} pendiente(s) por atender.
        </p>
      </aside>
    </section>
  );
}

type UpdateProfileRequest = {
  name: string;
  paternalSurname: string;
  maternalSurname: string | null;
  phone: string;
  email: string;
};

type AddressRequest = {
  receiverName: string;
  receiverPhone: string;
  departmentId: string;
  provinceId: string;
  districtId: string;
  line: string;
  references: string | null;
  isDefault: boolean;
};

const emptyAddressRequest: AddressRequest = {
  receiverName: "",
  receiverPhone: "",
  departmentId: "",
  provinceId: "",
  districtId: "",
  line: "",
  references: null,
  isDefault: false,
};

function ProfileDataPanel({
  account,
  addresses,
  onAddressesChange,
  onSubmit,
}: {
  account: UserAccount | null;
  addresses: Address[];
  onAddressesChange: (addresses: Address[], message: string) => void;
  onSubmit: (request: UpdateProfileRequest) => Promise<void>;
}) {
  const { token } = useAuth();
  const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];
  const [name, setName] = useState("");
  const [paternalSurname, setPaternalSurname] = useState("");
  const [maternalSurname, setMaternalSurname] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState<AddressRequest>(emptyAddressRequest);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddressSubmitting, setIsAddressSubmitting] = useState(false);

  useEffect(() => {
    let isActive = true;
    const timeoutId = window.setTimeout(() => {
      apiRequest<Department[]>("/api/departments")
        .then((nextDepartments) => {
          if (isActive) {
            setDepartments(nextDepartments);
          }
        })
        .catch(() => {
          if (isActive) {
            setDepartments([]);
          }
        });
    }, 0);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!addressForm.departmentId) {
      const timeoutId = window.setTimeout(() => {
        setProvinces([]);
        setDistricts([]);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    let isActive = true;
    const timeoutId = window.setTimeout(() => {
      apiRequest<Province[]>(`/api/provinces/department/${addressForm.departmentId}`)
        .then((nextProvinces) => {
          if (isActive) {
            setProvinces(nextProvinces);
          }
        })
        .catch(() => {
          if (isActive) {
            setProvinces([]);
          }
        });
    }, 0);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [addressForm.departmentId]);

  useEffect(() => {
    if (!addressForm.provinceId) {
      const timeoutId = window.setTimeout(() => setDistricts([]), 0);
      return () => window.clearTimeout(timeoutId);
    }

    let isActive = true;
    const timeoutId = window.setTimeout(() => {
      apiRequest<District[]>(`/api/districts/province/${addressForm.provinceId}`)
        .then((nextDistricts) => {
          if (isActive) {
            setDistricts(nextDistricts);
          }
        })
        .catch(() => {
          if (isActive) {
            setDistricts([]);
          }
        });
    }, 0);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [addressForm.provinceId]);

  useEffect(() => {
    if (!account) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setName(account.name);
      setPaternalSurname(account.paternalSurname);
      setMaternalSurname(account.maternalSurname ?? "");
      setPhone(account.phone ?? "");
      setEmail(account.email);
      setMessage("");
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [account]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail)) {
      setMessage("Ingresa un correo valido, por ejemplo nombre@dominio.com.");
      return;
    }

    if (!name.trim() || !paternalSurname.trim() || !phone.trim()) {
      setMessage("Completa nombre, apellido paterno y telefono.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    try {
      await onSubmit({
        name: name.trim(),
        paternalSurname: paternalSurname.trim(),
        maternalSurname: maternalSurname.trim() || null,
        phone: phone.trim(),
        email: trimmedEmail,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el perfil.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function refreshAddresses(successMessage: string) {
    const nextAddresses = await apiRequest<Address[]>("/api/addresses/me", { token }).catch(() => []);
    onAddressesChange(nextAddresses, successMessage);
  }

  function startAddressCreate() {
    setEditingAddressId(null);
    setAddressForm({
      ...emptyAddressRequest,
      receiverName: account ? `${account.name} ${account.paternalSurname}`.trim() : "",
      receiverPhone: account?.phone ?? "",
      isDefault: addresses.length === 0,
    });
    setMessage("");
  }

  function startAddressEdit(address: Address) {
    setEditingAddressId(address.id);
    setAddressForm({
      receiverName: address.receiverName,
      receiverPhone: address.receiverPhone,
      departmentId: address.departmentId,
      provinceId: address.provinceId,
      districtId: address.districtId,
      line: address.line,
      references: address.references,
      isDefault: address.isDefault,
    });
    setMessage("");
  }

  function updateAddressField<Key extends keyof AddressRequest>(field: Key, value: AddressRequest[Key]) {
    setAddressForm((current) => {
      if (field === "departmentId") {
        return { ...current, departmentId: String(value), provinceId: "", districtId: "" };
      }

      if (field === "provinceId") {
        return { ...current, provinceId: String(value), districtId: "" };
      }

      return { ...current, [field]: value };
    });
  }

  async function handleAddressSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!addressForm.receiverName.trim() || !addressForm.receiverPhone.trim() || !addressForm.line.trim()) {
      setMessage("Completa receptor, telefono y direccion.");
      return;
    }

    if (!addressForm.departmentId || !addressForm.provinceId || !addressForm.districtId) {
      setMessage("Selecciona departamento, provincia y distrito.");
      return;
    }

    const payload: AddressRequest = {
      ...addressForm,
      receiverName: addressForm.receiverName.trim(),
      receiverPhone: addressForm.receiverPhone.trim(),
      line: addressForm.line.trim(),
      references: addressForm.references?.trim() || null,
    };

    setIsAddressSubmitting(true);
    setMessage("");
    try {
      if (editingAddressId) {
        await apiRequest<void>(`/api/addresses/${editingAddressId}`, { method: "PUT", body: payload, token });
        await refreshAddresses("Direccion actualizada correctamente.");
      } else {
        await apiRequest<string>("/api/addresses", { method: "POST", body: payload, token });
        await refreshAddresses("Direccion agregada correctamente.");
      }
      setEditingAddressId(null);
      setAddressForm(emptyAddressRequest);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la direccion.");
    } finally {
      setIsAddressSubmitting(false);
    }
  }

  async function deleteAddress(addressId: string) {
    setIsAddressSubmitting(true);
    setMessage("");
    try {
      await apiRequest<void>(`/api/addresses/${addressId}`, { method: "DELETE", token });
      await refreshAddresses("Direccion eliminada correctamente.");
      if (editingAddressId === addressId) {
        setEditingAddressId(null);
        setAddressForm(emptyAddressRequest);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar la direccion.");
    } finally {
      setIsAddressSubmitting(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <form className="rounded-2xl border border-rose-100 bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Datos personales</p>
        <h2 className="mt-2 text-2xl font-semibold">Informacion de contacto</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <EditableField label="Nombre" value={name} onChange={setName} required />
          <EditableField label="Apellido paterno" value={paternalSurname} onChange={setPaternalSurname} required />
          <EditableField label="Apellido materno" value={maternalSurname} onChange={setMaternalSurname} />
          <EditableField label="Telefono" value={phone} onChange={setPhone} required />
          <EditableField label="Correo" type="email" value={email} onChange={setEmail} required />
          <ReadOnlyField label="Estado" value={account ? formatUserStatus(account.status) : ""} />
        </div>
        {message ? <p className="mt-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-900">{message}</p> : null}
        <button className="admin-primary-button mt-6" disabled={isSubmitting || !account} type="submit">
          {isSubmitting ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>
      <aside className="rounded-2xl border border-rose-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Direccion principal</p>
        <h2 className="mt-2 text-xl font-semibold">{defaultAddress?.receiverName ?? "Sin direccion"}</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">{defaultAddress ? `${defaultAddress.line}${defaultAddress.references ? `, ${defaultAddress.references}` : ""}` : "Agrega una direccion durante tu siguiente compra."}</p>
        {defaultAddress ? <p className="mt-3 text-sm font-semibold">{defaultAddress.receiverPhone}</p> : null}
      </aside>
      <div className="rounded-2xl border border-rose-100 bg-white p-6 shadow-sm xl:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Direcciones</p>
            <h2 className="mt-2 text-2xl font-semibold">Entrega y contacto</h2>
            <p className="mt-2 text-sm text-zinc-500">Crea, edita o elimina las direcciones que usaras para tus pedidos.</p>
          </div>
          <button className="admin-secondary-button" type="button" onClick={startAddressCreate}>
            Nueva direccion
          </button>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-3">
            {addresses.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">Aun no tienes direcciones guardadas.</p> : null}
            {addresses.map((address) => (
              <article className="rounded-2xl border border-zinc-200 bg-stone-50 p-4 text-sm" key={address.id}>
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="font-semibold">{address.receiverName}</p>
                    <p className="mt-1 text-zinc-600">{address.line}</p>
                    {address.references ? <p className="mt-1 text-zinc-500">{address.references}</p> : null}
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">{address.receiverPhone}</p>
                  </div>
                  {address.isDefault ? <span className="h-fit rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-rose-800">Principal</span> : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="rounded-lg bg-zinc-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-white" type="button" onClick={() => startAddressEdit(address)}>
                    Editar
                  </button>
                  <button className="rounded-lg border border-rose-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-rose-800 disabled:opacity-50" disabled={isAddressSubmitting} type="button" onClick={() => void deleteAddress(address.id)}>
                    Eliminar
                  </button>
                </div>
              </article>
            ))}
          </div>
          <form className="rounded-2xl border border-rose-100 bg-rose-50/30 p-5" onSubmit={handleAddressSubmit}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">{editingAddressId ? "Editar direccion" : "Nueva direccion"}</p>
            <div className="mt-4 grid gap-3">
              <EditableField label="Recibe" value={addressForm.receiverName} onChange={(value) => updateAddressField("receiverName", value)} required />
              <EditableField label="Telefono de contacto" value={addressForm.receiverPhone} onChange={(value) => updateAddressField("receiverPhone", value)} required />
              <AddressSelect label="Departamento" value={addressForm.departmentId} onChange={(value) => updateAddressField("departmentId", value)} options={departments.map((department) => ({ id: department.id, name: department.name }))} />
              <AddressSelect label="Provincia" value={addressForm.provinceId} onChange={(value) => updateAddressField("provinceId", value)} options={provinces.map((province) => ({ id: province.id, name: province.name }))} disabled={!addressForm.departmentId} />
              <AddressSelect label="Distrito" value={addressForm.districtId} onChange={(value) => updateAddressField("districtId", value)} options={districts.map((district) => ({ id: district.id, name: district.name }))} disabled={!addressForm.provinceId} />
              <EditableField label="Direccion" value={addressForm.line} onChange={(value) => updateAddressField("line", value)} required />
              <label className="block text-sm font-semibold">
                Referencias
                <textarea className="admin-input mt-2 min-h-20" value={addressForm.references ?? ""} onChange={(event) => updateAddressField("references", event.target.value)} />
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-rose-100 bg-white px-4 py-3 text-sm font-semibold">
                <input checked={addressForm.isDefault} type="checkbox" onChange={(event) => updateAddressField("isDefault", event.target.checked)} />
                Usar como direccion principal
              </label>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button className="admin-primary-button" disabled={isAddressSubmitting} type="submit">
                {isAddressSubmitting ? "Guardando..." : editingAddressId ? "Guardar direccion" : "Crear direccion"}
              </button>
              {editingAddressId ? (
                <button className="admin-secondary-button" type="button" onClick={startAddressCreate}>
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function AddressSelect({
  disabled = false,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: { id: string; name: string }[];
  value: string;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <select className="admin-input mt-2" disabled={disabled} required value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.name}</option>
        ))}
      </select>
    </label>
  );
}

function ProfileMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm">
      <p className="text-3xl font-semibold">{value}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value?: string }) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input className="admin-input mt-2" readOnly value={value ?? ""} />
    </label>
  );
}

function EditableField({
  label,
  value,
  onChange,
  required = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input className="admin-input mt-2" required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <span className="text-zinc-500">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-rose-200 bg-white p-8 text-center shadow-sm">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-zinc-500">{text}</p>
    </div>
  );
}

function RejectedPaymentNotice({ observation }: { observation: string | null }) {
  return (
    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
      <p className="font-semibold">Comprobante rechazado</p>
      <p className="mt-1 leading-6">
        Motivo: {observation?.trim() || "Administracion solicito revisar y enviar un nuevo comprobante."}
      </p>
    </div>
  );
}

function isPaymentEditableByCustomer(payment: Payment, order: Order | undefined) {
  if (!order || order.status === "cancelled" || order.status === "delivered" || order.status === "outOfStock") {
    return false;
  }

  return payment.status === "pendingReceipt" || payment.status === "rejected";
}

function isProfileSection(value: string | null): value is ProfileSection {
  return value === "orders" || value === "tracking" || value === "receipts" || value === "profile";
}

function shortId(value: string) {
  return value.slice(0, 8).toUpperCase();
}

function formatMoney(amount: number, currency: string) {
  return `S/. ${amount.toFixed(2)} ${currency}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
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

function formatPaymentStatus(status?: Payment["status"]) {
  if (!status) {
    return "Sin pago";
  }

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

function formatReceiptStatus(status: PaymentReceipt["status"]) {
  const labels: Record<PaymentReceipt["status"], string> = {
    uploaded: "cargado",
    approved: "aprobado",
    rejected: "rechazado",
  };
  return labels[status];
}

function formatShipmentStatus(status: Shipment["status"]) {
  const labels: Record<string, string> = {
    pending: "Envio pendiente",
    coordinated: "Envio coordinado",
    registered: "Registrado en courier",
    inTransit: "En camino",
    delivered: "Entregado",
    cancelled: "Cancelado",
    observed: "Con observacion",
  };
  return labels[status] ?? String(status);
}

function formatUserStatus(status: UserAccount["status"]) {
  const labels: Record<UserAccount["status"], string> = {
    active: "Activo",
    inactive: "Inactivo",
    blocked: "Bloqueado",
  };
  return labels[status];
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
