"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canAdminister } from "@/lib/roles";
import type {
  Category,
  Collection,
  Coupon,
  CouponRestriction,
  Courier,
  CreatedResponse,
  Department,
  District,
  PaymentMethod,
  Product,
  ProductVariant,
  Province,
  RefreshToken,
  Role,
  ShippingRate,
  StockMovement,
  UserAccount,
} from "@/lib/types";

type SettingsTab = "coupons" | "payments" | "shipping" | "ubigeo" | "stock" | "security" | "olva";

const tabs: Array<{ id: SettingsTab; label: string; adminOnly?: boolean }> = [
  { id: "coupons", label: "Cupones" },
  { id: "payments", label: "Pagos", adminOnly: true },
  { id: "shipping", label: "Envios" },
  { id: "ubigeo", label: "Ubigeo" },
  { id: "stock", label: "Stock", adminOnly: true },
  { id: "security", label: "Seguridad", adminOnly: true },
  { id: "olva", label: "Olva" },
];

export function AdminSettings() {
  const { token, user } = useAuth();
  const isAdmin = canAdminister(user?.role);
  const [activeTab, setActiveTab] = useState<SettingsTab>("coupons");
  const [message, setMessage] = useState("");

  const visibleTabs = tabs.filter((tab) => !tab.adminOnly || isAdmin);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">Administracion</p>
        <h1 className="mt-2 text-3xl font-semibold">Configuracion operativa</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
          Mantiene las reglas que alimentan el catalogo, el checkout, los pagos y la entrega.
        </p>
        <div className="mt-5 flex flex-wrap gap-2" role="tablist">
          {visibleTabs.map((tab) => (
            <button
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? "rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white" : "rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-950"}
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setMessage(""); }}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {message ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{message}</div> : null}

      {activeTab === "coupons" ? <CouponsPanel isAdmin={isAdmin} onMessage={setMessage} token={token} /> : null}
      {activeTab === "payments" ? <PaymentsPanel onMessage={setMessage} token={token} /> : null}
      {activeTab === "shipping" ? <ShippingPanel isAdmin={isAdmin} onMessage={setMessage} token={token} /> : null}
      {activeTab === "ubigeo" ? <UbigeoPanel onMessage={setMessage} token={token} /> : null}
      {activeTab === "stock" ? <StockPanel onMessage={setMessage} token={token} /> : null}
      {activeTab === "security" ? <SecurityPanel onMessage={setMessage} token={token} /> : null}
      {activeTab === "olva" ? <OlvaPanel onMessage={setMessage} token={token} /> : null}
    </div>
  );
}

function CouponsPanel({ isAdmin, onMessage, token }: PanelProps & { isAdmin: boolean }) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCouponId, setSelectedCouponId] = useState("");
  const [restrictions, setRestrictions] = useState<CouponRestriction[]>([]);
  const [usages, setUsages] = useState<Array<Record<string, unknown>>>([]);
  const [form, setForm] = useState(() => {
    const today = new Date();
    const endDate = new Date(today.getTime() + 30 * 86400000);
    return {
      code: "", name: "", scope: "order", discountType: "percentage", discountValue: "10",
      startDate: today.toISOString().slice(0, 10), endDate: endDate.toISOString().slice(0, 10),
      minimumPurchaseAmount: "", minimumItemsQuantity: "", maximumDiscountedItemsQuantity: "",
      applicationStrategy: "cheapest", maximumTotalUses: "", maximumUsesPerUser: "1",
    };
  });
  const [restrictionForm, setRestrictionForm] = useState({ categoryId: "", productId: "", productVariantId: "", collectionId: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function load() {
    const [nextCoupons, nextCategories, nextCollections, nextProducts] = await Promise.all([
      apiRequest<Coupon[]>("/api/coupons?onlyActive=false", { token }),
      apiRequest<Category[]>("/api/categories?onlyActive=true"),
      apiRequest<Collection[]>("/api/collections?onlyActive=true"),
      apiRequest<Product[]>("/api/products?onlyActive=true"),
    ]);
    setCoupons(nextCoupons);
    setCategories(nextCategories);
    setCollections(nextCollections);
    setProducts(nextProducts);
    const nextId = selectedCouponId || nextCoupons[0]?.id || "";
    setSelectedCouponId(nextId);
    if (nextId) {
      const nextRestrictions = await apiRequest<CouponRestriction[]>("/api/coupon-restrictions/coupon/" + nextId, { token });
      setRestrictions(nextRestrictions);
      if (isAdmin) {
        const nextUsages = await apiRequest<Array<Record<string, unknown>>>("/api/coupon-usages/coupon/" + nextId, { token }).catch(() => []);
        setUsages(nextUsages);
      }
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void load().catch((error: Error) => onMessage(error.message)); }, 0);
    return () => window.clearTimeout(timeoutId);
    // The loader is also used by mutation handlers; keeping it stable would obscure the refresh flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAdmin, selectedCouponId]);

  async function createCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const created = await apiRequest<CreatedResponse>("/api/coupons", {
        method: "POST",
        token,
        body: {
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          scope: form.scope,
          discountType: form.discountType,
          discountValue: Number(form.discountValue),
          startDate: form.startDate + "T00:00:00-05:00",
          endDate: form.endDate + "T23:59:59-05:00",
        },
      });
      await apiRequest<void>("/api/coupons/" + created.id + "/rules", {
        method: "PUT",
        token,
        body: {
          minimumPurchaseAmount: form.minimumPurchaseAmount ? Number(form.minimumPurchaseAmount) : null,
          minimumItemsQuantity: form.minimumItemsQuantity ? Number(form.minimumItemsQuantity) : null,
          maximumDiscountedItemsQuantity: form.maximumDiscountedItemsQuantity ? Number(form.maximumDiscountedItemsQuantity) : null,
          applicationStrategy: form.scope === "item" ? form.applicationStrategy : null,
          maximumTotalUses: form.maximumTotalUses ? Number(form.maximumTotalUses) : null,
          maximumUsesPerUser: form.maximumUsesPerUser ? Number(form.maximumUsesPerUser) : null,
        },
      });
      onMessage("Cupon creado y sus reglas guardadas.");
      setSelectedCouponId(created.id);
      await load();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "No se pudo crear el cupon.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteCoupon() {
    if (!selectedCouponId || !window.confirm("Se desactivara este cupon. Continuar?")) return;
    try {
      await apiRequest<void>("/api/coupons/" + selectedCouponId, { method: "DELETE", token });
      onMessage("Cupon desactivado.");
      await load();
    } catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo desactivar el cupon."); }
  }

  async function addRestriction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCouponId || !Object.values(restrictionForm).some(Boolean)) {
      onMessage("Selecciona al menos una restriccion.");
      return;
    }
    try {
      await apiRequest<CreatedResponse>("/api/coupon-restrictions", {
        method: "POST",
        token,
        body: {
          couponId: selectedCouponId,
          categoryId: restrictionForm.categoryId || null,
          productId: restrictionForm.productId || null,
          productVariantId: restrictionForm.productVariantId || null,
          collectionId: restrictionForm.collectionId || null,
        },
      });
      setRestrictionForm({ categoryId: "", productId: "", productVariantId: "", collectionId: "" });
      onMessage("Restriccion agregada.");
      await load();
    } catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo agregar la restriccion."); }
  }

  async function removeRestriction(id: string) {
    try {
      await apiRequest<void>("/api/coupon-restrictions/" + id, { method: "DELETE", token });
      await load();
    } catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo quitar la restriccion."); }
  }

  const selectedCoupon = coupons.find((coupon) => coupon.id === selectedCouponId);
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      {isAdmin ? (
        <form className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm" onSubmit={createCoupon}>
          <PanelTitle title="Crear cupon" text="La vigencia, el descuento y los limites se guardan en el dominio." />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Field label="Codigo"><input className="admin-input" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
            <Field label="Nombre"><input className="admin-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Alcance"><select className="admin-input" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}><option value="order">Orden completa</option><option value="item">Prenda o cantidad</option></select></Field>
            <Field label="Tipo de descuento"><select className="admin-input" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}><option value="percentage">Porcentaje</option><option value="amount">Monto fijo</option></select></Field>
            <Field label="Valor"><input className="admin-input" min="0" required step="0.01" type="number" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} /></Field>
            <Field label="Usos por usuario"><input className="admin-input" min="1" type="number" value={form.maximumUsesPerUser} onChange={(e) => setForm({ ...form, maximumUsesPerUser: e.target.value })} /></Field>
            <Field label="Inicio"><input className="admin-input" required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
            <Field label="Fin"><input className="admin-input" required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
            <Field label="Compra minima"><input className="admin-input" min="0" step="0.01" type="number" value={form.minimumPurchaseAmount} onChange={(e) => setForm({ ...form, minimumPurchaseAmount: e.target.value })} /></Field>
            <Field label="Items minimos"><input className="admin-input" min="1" type="number" value={form.minimumItemsQuantity} onChange={(e) => setForm({ ...form, minimumItemsQuantity: e.target.value })} /></Field>
            <Field label="Items con descuento"><input className="admin-input" min="1" type="number" value={form.maximumDiscountedItemsQuantity} onChange={(e) => setForm({ ...form, maximumDiscountedItemsQuantity: e.target.value })} /></Field>
            <Field label="Usos totales"><input className="admin-input" min="1" type="number" value={form.maximumTotalUses} onChange={(e) => setForm({ ...form, maximumTotalUses: e.target.value })} /></Field>
          </div>
          {form.scope === "item" ? <Field label="Estrategia"><select className="admin-input mt-3" value={form.applicationStrategy} onChange={(e) => setForm({ ...form, applicationStrategy: e.target.value })}><option value="cheapest">Prenda mas barata</option><option value="mostExpensive">Prenda mas cara</option><option value="firstAdded">Primera agregada</option></select></Field> : null}
          <button className="admin-primary-button mt-5" disabled={isSubmitting}>Crear cupon</button>
        </form>
      ) : null}

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <PanelTitle title="Cupones activos e historial" text="El asistente puede consultar restricciones y usos, el administrador tambien puede modificarlos." />
        <select className="admin-input mt-5" value={selectedCouponId} onChange={(e) => setSelectedCouponId(e.target.value)}><option value="">Seleccionar cupon</option>{coupons.map((coupon) => <option key={coupon.id} value={coupon.id}>{coupon.code} - {coupon.name}</option>)}</select>
        {selectedCoupon ? (
          <div className="mt-4 rounded-lg border border-zinc-200 bg-stone-50 p-4 text-sm">
            <div className="flex justify-between gap-3"><span className="font-semibold">{selectedCoupon.code}</span><span>{selectedCoupon.isActive ? "Activo" : "Inactivo"}</span></div>
            <p className="mt-2 text-zinc-600">{selectedCoupon.name}</p>
            <p className="mt-2 text-xs text-zinc-500">{selectedCoupon.scope} / {selectedCoupon.discountType} / {selectedCoupon.discountValue}</p>
            {isAdmin ? <button className="mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-rose-800" onClick={() => void deleteCoupon()} type="button">Desactivar cupon</button> : null}
          </div>
        ) : null}
        <h3 className="mt-6 text-sm font-semibold uppercase tracking-[0.12em]">Restricciones</h3>
        {restrictions.length === 0 ? <p className="mt-3 text-sm text-zinc-500">Sin restricciones especificas.</p> : <div className="mt-3 space-y-2">{restrictions.map((restriction) => <div className="flex justify-between gap-3 rounded-lg border border-zinc-200 p-3 text-xs" key={restriction.id}><span>{restriction.categoryId ? "Categoria" : restriction.productId ? "Producto" : restriction.productVariantId ? "Variante" : "Coleccion"}</span>{isAdmin ? <button className="font-semibold text-rose-800" onClick={() => void removeRestriction(restriction.id)} type="button">Quitar</button> : null}</div>)}</div>}
        {isAdmin ? <form className="mt-4 space-y-3" onSubmit={addRestriction}>
          <Field label="Categoria"><select className="admin-input" value={restrictionForm.categoryId} onChange={(e) => setRestrictionForm({ ...restrictionForm, categoryId: e.target.value })}><option value="">Sin categoria</option>{categories.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field>
          <Field label="Producto"><select className="admin-input" value={restrictionForm.productId} onChange={(e) => setRestrictionForm({ ...restrictionForm, productId: e.target.value })}><option value="">Sin producto</option>{products.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field>
          <Field label="Coleccion"><select className="admin-input" value={restrictionForm.collectionId} onChange={(e) => setRestrictionForm({ ...restrictionForm, collectionId: e.target.value })}><option value="">Sin coleccion</option>{collections.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field>
          <button className="admin-secondary-button w-full" disabled={!selectedCouponId}>Agregar restriccion</button>
        </form> : null}
        {isAdmin && usages.length > 0 ? <div className="mt-6 border-t border-zinc-200 pt-4"><h3 className="text-sm font-semibold uppercase tracking-[0.12em]">Usos registrados</h3><pre className="mt-3 max-h-48 overflow-auto text-xs text-zinc-600">{JSON.stringify(usages, null, 2)}</pre></div> : null}
      </section>
    </div>
  );
}

function PaymentsPanel({ onMessage, token }: PanelProps) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState({ name: "", type: "manual", requiresManualVerification: true, requiresExternalIntegration: false });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function load() {
    const nextMethods = await apiRequest<PaymentMethod[]>("/api/payment-methods");
    setMethods(nextMethods);
    setSelectedId((current) => current || nextMethods[0]?.id || "");
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const timeoutId = window.setTimeout(() => { void load().catch((error: Error) => onMessage(error.message)); }, 0); return () => window.clearTimeout(timeoutId); }, [token]);

  const selected = methods.find((method) => method.id === selectedId);
  useEffect(() => {
    if (!selected) return;
    const timeoutId = window.setTimeout(() => setForm({ name: selected.name, type: selected.type, requiresManualVerification: selected.requiresManualVerification, requiresExternalIntegration: selected.requiresExternalIntegration }), 0);
    return () => window.clearTimeout(timeoutId);
  }, [selected]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      if (selectedId) await apiRequest<void>("/api/payment-methods/" + selectedId, { method: "PUT", token, body: form });
      else await apiRequest<CreatedResponse>("/api/payment-methods", { method: "POST", token, body: form });
      onMessage("Metodo de pago guardado.");
      await load();
    } catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo guardar el metodo."); }
    finally { setIsSubmitting(false); }
  }

  async function remove() {
    if (!selectedId || !window.confirm("Se desactivara el metodo de pago. Continuar?")) return;
    try { await apiRequest<void>("/api/payment-methods/" + selectedId, { method: "DELETE", token }); onMessage("Metodo desactivado."); await load(); }
    catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo desactivar el metodo."); }
  }

  function startNew() {
    setSelectedId("");
    setForm({ name: "", type: "manual", requiresManualVerification: true, requiresExternalIntegration: false });
  }

  return <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]"><section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><PanelTitle title="Metodos disponibles" text="Selecciona un metodo para editarlo." /><button className="admin-secondary-button" onClick={startNew} type="button">Nuevo</button></div><EntityList title="Registrados" items={methods.map((entry) => ({ id: entry.id, name: entry.name, detail: entry.type + (entry.requiresManualVerification ? " / verificacion manual" : "") }))} selectedId={selectedId} onSelect={setSelectedId} /></section><section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"><PanelTitle title={selected ? "Editar metodo" : "Nuevo metodo"} text="Define si el checkout crea pago manual, efectivo o enlace de pasarela." /><form className="mt-5 space-y-4" onSubmit={submit}><Field label="Nombre"><input className="admin-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field label="Tipo"><select className="admin-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="manual">Manual</option><option value="gateway">Pasarela</option><option value="cash">Efectivo</option></select></Field><Check label="Requiere verificacion manual" checked={form.requiresManualVerification} onChange={(value) => setForm({ ...form, requiresManualVerification: value })} /><Check label="Requiere integracion externa" checked={form.requiresExternalIntegration} onChange={(value) => setForm({ ...form, requiresExternalIntegration: value })} /><div className="flex flex-wrap gap-2"><button className="admin-primary-button" disabled={isSubmitting}>{selected ? "Guardar cambios" : "Crear metodo"}</button>{selected ? <button className="admin-secondary-button" onClick={remove} type="button">Desactivar</button> : null}</div></form></section></div>;
}

function ShippingPanel({ isAdmin, onMessage, token }: PanelProps & { isAdmin: boolean }) {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedCourierId, setSelectedCourierId] = useState("");
  const [selectedRateId, setSelectedRateId] = useState("");
  const [courierForm, setCourierForm] = useState({ name: "", type: "agency", requiresExternalIntegration: true });
  const [rateForm, setRateForm] = useState({ courierId: "", courierType: "agency", departmentId: "", provinceId: "", districtId: "", destinationType: "province", serviceType: "regular", cost: "0", freeShippingMinimumAmount: "", estimatedTime: "" });
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);

  async function load() {
    const [nextCouriers, nextRates, nextDepartments] = await Promise.all([
      apiRequest<Courier[]>("/api/couriers?onlyActive=false", { token }),
      apiRequest<ShippingRate[]>("/api/shipping-rates?onlyActive=false", { token }),
      apiRequest<Department[]>("/api/departments"),
    ]);
    setCouriers(nextCouriers); setRates(nextRates); setDepartments(nextDepartments);
    setSelectedCourierId((current) => current || nextCouriers[0]?.id || "");
    setSelectedRateId((current) => current || nextRates[0]?.id || "");
    setRateForm((current) => ({ ...current, courierId: current.courierId || nextCouriers[0]?.id || "", departmentId: current.departmentId || nextDepartments[0]?.id || "" }));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const timeoutId = window.setTimeout(() => { void load().catch((error: Error) => onMessage(error.message)); }, 0); return () => window.clearTimeout(timeoutId); }, [token]);

  const selectedCourier = couriers.find((entry) => entry.id === selectedCourierId);
  const selectedRate = rates.find((entry) => entry.id === selectedRateId);
  useEffect(() => {
    if (!selectedCourier) return;
    const timeoutId = window.setTimeout(() => setCourierForm({ name: selectedCourier.name, type: selectedCourier.type, requiresExternalIntegration: selectedCourier.requiresExternalIntegration }), 0);
    return () => window.clearTimeout(timeoutId);
  }, [selectedCourier]);
  useEffect(() => {
    if (!selectedRate) return;
    const timeoutId = window.setTimeout(() => setRateForm({ courierId: selectedRate.courierId, courierType: selectedRate.courierType, departmentId: selectedRate.departmentId, provinceId: selectedRate.provinceId || "", districtId: selectedRate.districtId || "", destinationType: selectedRate.destinationType, serviceType: selectedRate.serviceType, cost: String(selectedRate.cost), freeShippingMinimumAmount: selectedRate.freeShippingMinimumAmount ? String(selectedRate.freeShippingMinimumAmount) : "", estimatedTime: selectedRate.estimatedTime || "" }), 0);
    return () => window.clearTimeout(timeoutId);
  }, [selectedRate]);

  useEffect(() => {
    if (!rateForm.departmentId) return;
    const timeoutId = window.setTimeout(() => { void apiRequest<Province[]>("/api/provinces/department/" + rateForm.departmentId).then(setProvinces).catch(() => setProvinces([])); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [rateForm.departmentId]);
  useEffect(() => {
    if (!rateForm.provinceId) {
      const timeoutId = window.setTimeout(() => setDistricts([]), 0);
      return () => window.clearTimeout(timeoutId);
    }
    const timeoutId = window.setTimeout(() => { void apiRequest<District[]>("/api/districts/province/" + rateForm.provinceId).then(setDistricts).catch(() => setDistricts([])); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [rateForm.provinceId]);

  async function saveCourier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (selectedCourierId) await apiRequest<void>("/api/couriers/" + selectedCourierId, { method: "PUT", token, body: courierForm });
      else await apiRequest<CreatedResponse>("/api/couriers", { method: "POST", token, body: courierForm });
      onMessage("Courier guardado."); await load();
    } catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo guardar el courier."); }
  }
  async function deleteCourier() {
    if (!selectedCourierId || !window.confirm("Se desactivara este courier. Continuar?")) return;
    try { await apiRequest<void>("/api/couriers/" + selectedCourierId, { method: "DELETE", token }); onMessage("Courier desactivado."); await load(); }
    catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo desactivar el courier."); }
  }
  async function saveRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const body = { ...rateForm, provinceId: rateForm.provinceId || null, districtId: rateForm.districtId || null, cost: Number(rateForm.cost), freeShippingMinimumAmount: rateForm.freeShippingMinimumAmount ? Number(rateForm.freeShippingMinimumAmount) : null, estimatedTime: rateForm.estimatedTime || null };
      if (selectedRateId) await apiRequest<void>("/api/shipping-rates/" + selectedRateId, { method: "PUT", token, body });
      else await apiRequest<CreatedResponse>("/api/shipping-rates", { method: "POST", token, body });
      onMessage("Tarifa de envio guardada."); await load();
    } catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo guardar la tarifa."); }
  }
  async function deleteRate() {
    if (!selectedRateId || !window.confirm("Se desactivara esta tarifa. Continuar?")) return;
    try { await apiRequest<void>("/api/shipping-rates/" + selectedRateId, { method: "DELETE", token }); onMessage("Tarifa desactivada."); await load(); }
    catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo desactivar la tarifa."); }
  }

  function startNewCourier() {
    setSelectedCourierId("");
    setCourierForm({ name: "", type: "agency", requiresExternalIntegration: true });
  }

  function startNewRate() {
    setSelectedRateId("");
    setRateForm((current) => ({ ...current, cost: "0", provinceId: "", districtId: "", serviceType: "regular", estimatedTime: "" }));
  }

  return <div className="grid gap-6 xl:grid-cols-2"><section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><PanelTitle title="Couriers" text="Agencia, delivery app o reparto propio." />{isAdmin ? <button className="admin-secondary-button" onClick={startNewCourier} type="button">Nuevo</button> : null}</div><EntityList title="Registrados" items={couriers.map((entry) => ({ id: entry.id, name: entry.name, detail: entry.type }))} selectedId={selectedCourierId} onSelect={setSelectedCourierId} /><form className="mt-5 space-y-3 border-t border-zinc-200 pt-5" onSubmit={saveCourier}><Field label="Nombre"><input className="admin-input" required value={courierForm.name} onChange={(e) => setCourierForm({ ...courierForm, name: e.target.value })} /></Field><Field label="Tipo"><select className="admin-input" value={courierForm.type} onChange={(e) => setCourierForm({ ...courierForm, type: e.target.value })}><option value="agency">Agencia</option><option value="deliveryApp">Delivery app</option><option value="ownDelivery">Propio</option></select></Field><Check label="Requiere integracion externa" checked={courierForm.requiresExternalIntegration} onChange={(value) => setCourierForm({ ...courierForm, requiresExternalIntegration: value })} /><div className="flex gap-2">{isAdmin ? <><button className="admin-primary-button">{selectedCourier ? "Guardar courier" : "Crear courier"}</button>{selectedCourier ? <button className="admin-secondary-button" onClick={deleteCourier} type="button">Desactivar</button> : null}</> : <p className="text-sm text-zinc-500">Solo el administrador modifica couriers.</p>}</div></form></section><section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><PanelTitle title="Tarifas por zona" text="El checkout solo acepta tarifas creadas en esta seccion." />{isAdmin ? <button className="admin-secondary-button" onClick={startNewRate} type="button">Nueva</button> : null}</div><EntityList title="Tarifas" items={rates.map((entry) => ({ id: entry.id, name: formatMoney(entry.cost, entry.currency), detail: entry.serviceType + " / " + entry.destinationType }))} selectedId={selectedRateId} onSelect={setSelectedRateId} /><form className="mt-5 grid gap-3 border-t border-zinc-200 pt-5 sm:grid-cols-2" onSubmit={saveRate}><Field label="Courier"><select className="admin-input" required value={rateForm.courierId} onChange={(e) => { const courier = couriers.find((entry) => entry.id === e.target.value); setRateForm({ ...rateForm, courierId: e.target.value, courierType: courier?.type || "agency" }); }}><option value="">Seleccionar</option>{couriers.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field><Field label="Departamento"><select className="admin-input" required value={rateForm.departmentId} onChange={(e) => setRateForm({ ...rateForm, departmentId: e.target.value, provinceId: "", districtId: "" })}><option value="">Seleccionar</option>{departments.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field><Field label="Provincia"><select className="admin-input" value={rateForm.provinceId} onChange={(e) => setRateForm({ ...rateForm, provinceId: e.target.value, districtId: "" })}><option value="">Todas</option>{provinces.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field><Field label="Distrito"><select className="admin-input" value={rateForm.districtId} onChange={(e) => setRateForm({ ...rateForm, districtId: e.target.value })}><option value="">Todos</option>{districts.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field><Field label="Destino"><select className="admin-input" value={rateForm.destinationType} onChange={(e) => setRateForm({ ...rateForm, destinationType: e.target.value })}><option value="lima">Lima</option><option value="province">Provincia</option></select></Field><Field label="Servicio"><select className="admin-input" value={rateForm.serviceType} onChange={(e) => setRateForm({ ...rateForm, serviceType: e.target.value })}><option value="regular">Regular</option><option value="express">Express</option><option value="sameDay">Mismo dia</option><option value="agency">Agencia</option><option value="homeDelivery">Domicilio</option></select></Field><Field label="Costo"><input className="admin-input" min="0" required step="0.01" type="number" value={rateForm.cost} onChange={(e) => setRateForm({ ...rateForm, cost: e.target.value })} /></Field><Field label="Tiempo estimado"><input className="admin-input" value={rateForm.estimatedTime} onChange={(e) => setRateForm({ ...rateForm, estimatedTime: e.target.value })} /></Field><div className="sm:col-span-2 flex gap-2">{isAdmin ? <><button className="admin-primary-button">{selectedRate ? "Guardar tarifa" : "Crear tarifa"}</button>{selectedRate ? <button className="admin-secondary-button" onClick={deleteRate} type="button">Desactivar</button> : null}</> : <p className="text-sm text-zinc-500">Solo el administrador modifica tarifas.</p>}</div></form></section></div>;
}

function UbigeoPanel({ onMessage, token }: PanelProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [provinceId, setProvinceId] = useState("");
  const [selectedDistrictId, setSelectedDistrictId] = useState("");
  const [form, setForm] = useState({ name: "", destinationType: "province", ubigeo: "" });
  const [mode, setMode] = useState<"department" | "province" | "district">("department");
  const [isNew, setIsNew] = useState(true);

  async function loadDepartments() { const next = await apiRequest<Department[]>("/api/departments?onlyActive=false"); setDepartments(next); if (!departmentId && next[0]) setDepartmentId(next[0].id); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const timeoutId = window.setTimeout(() => { void loadDepartments().catch((error: Error) => onMessage(error.message)); }, 0); return () => window.clearTimeout(timeoutId); }, [token]);
  useEffect(() => { if (!departmentId) return; const timeoutId = window.setTimeout(() => { void apiRequest<Province[]>("/api/provinces/department/" + departmentId).then(setProvinces).catch(() => setProvinces([])); }, 0); return () => window.clearTimeout(timeoutId); }, [departmentId]);
  useEffect(() => { if (!provinceId) return; const timeoutId = window.setTimeout(() => { void apiRequest<District[]>("/api/districts/province/" + provinceId).then(setDistricts).catch(() => setDistricts([])); }, 0); return () => window.clearTimeout(timeoutId); }, [provinceId]);

  useEffect(() => {
    if (isNew) return;
    const selectedDepartment = departments.find((entry) => entry.id === departmentId);
    const selectedProvince = provinces.find((entry) => entry.id === provinceId);
    const selectedDistrict = districts.find((entry) => entry.id === selectedDistrictId);
    const timeoutId = window.setTimeout(() => {
      if (mode === "department" && selectedDepartment) setForm({ name: selectedDepartment.name, destinationType: selectedDepartment.destinationType, ubigeo: "" });
      if (mode === "province" && selectedProvince) setForm({ name: selectedProvince.name, destinationType: "province", ubigeo: "" });
      if (mode === "district" && selectedDistrict) setForm({ name: selectedDistrict.name, destinationType: "province", ubigeo: selectedDistrict.ubigeo ?? "" });
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [departmentId, districts, isNew, mode, provinceId, provinces, selectedDistrictId]);

  function chooseMode(nextMode: "department" | "province" | "district") { setMode(nextMode); setIsNew(true); setForm({ name: "", destinationType: "province", ubigeo: "" }); setSelectedDistrictId(""); }
  async function save(event: FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    try {
      if (mode === "department") await apiRequest<CreatedResponse | void>(isNew ? "/api/departments" : "/api/departments/" + departmentId, { method: isNew ? "POST" : "PUT", token, body: { name: form.name, destinationType: form.destinationType } });
      if (mode === "province") await apiRequest<CreatedResponse | void>(isNew ? "/api/provinces" : "/api/provinces/" + provinceId, { method: isNew ? "POST" : "PUT", token, body: { departmentId, name: form.name } });
      if (mode === "district") await apiRequest<CreatedResponse | void>(isNew ? "/api/districts" : "/api/districts/" + selectedDistrictId, { method: isNew ? "POST" : "PUT", token, body: { provinceId, name: form.name, ubigeo: form.ubigeo || null } });
      onMessage("Ubicacion guardada."); await loadDepartments();
    } catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo guardar la ubicacion."); }
  }

  async function removeSelected() {
    const id = mode === "department" ? departmentId : mode === "province" ? provinceId : selectedDistrictId;
    if (!id || !window.confirm("Se desactivara esta ubicacion. Continuar?")) return;
    try {
      await apiRequest<void>("/api/" + (mode === "department" ? "departments/" : mode === "province" ? "provinces/" : "districts/") + id, { method: "DELETE", token });
      setIsNew(true);
      setForm({ name: "", destinationType: "province", ubigeo: "" });
      onMessage("Ubicacion desactivada.");
      await loadDepartments();
    } catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo desactivar la ubicacion."); }
  }

  return <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"><PanelTitle title="Departamentos, provincias y distritos" text="El asistente puede corregir nombres y activar o desactivar ubicaciones." /><div className="mt-5 flex flex-wrap gap-2">{(["department", "province", "district"] as const).map((entry) => <button className={mode === entry ? "rounded-lg bg-zinc-950 px-3 py-2 text-sm text-white" : "rounded-lg border px-3 py-2 text-sm"} key={entry} onClick={() => chooseMode(entry)} type="button">{entry === "department" ? "Departamento" : entry === "province" ? "Provincia" : "Distrito"}</button>)}</div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Field label="Departamento"><select className="admin-input" value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setProvinceId(""); setSelectedDistrictId(""); }}><option value="">Seleccionar</option>{departments.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field>{mode !== "department" ? <Field label="Provincia"><select className="admin-input" value={provinceId} onChange={(e) => { setProvinceId(e.target.value); setSelectedDistrictId(""); }}><option value="">Seleccionar</option>{provinces.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field> : null}{mode === "district" ? <Field label="Distrito"><select className="admin-input" value={selectedDistrictId} onChange={(e) => setSelectedDistrictId(e.target.value)}><option value="">Seleccionar</option>{districts.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field> : null}<Field label="Nombre"><input className="admin-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>{mode === "department" ? <Field label="Tipo"><select className="admin-input" value={form.destinationType} onChange={(e) => setForm({ ...form, destinationType: e.target.value })}><option value="lima">Lima</option><option value="province">Provincia</option></select></Field> : null}{mode === "district" ? <Field label="Ubigeo"><input className="admin-input" value={form.ubigeo} onChange={(e) => setForm({ ...form, ubigeo: e.target.value })} /></Field> : null}</div><div className="mt-5 flex flex-wrap gap-2"><button className="admin-primary-button" onClick={() => setIsNew(true)} type="button">Crear nuevo</button><button className="admin-primary-button" disabled={(mode === "department" ? !departmentId : mode === "province" ? !provinceId : !selectedDistrictId)} onClick={() => setIsNew(false)} type="button">Editar seleccionado</button><button className="admin-secondary-button" onClick={save}>Guardar</button><button className="admin-secondary-button" disabled={isNew || (mode === "district" ? !selectedDistrictId : mode === "province" ? !provinceId : !departmentId)} onClick={() => void removeSelected()} type="button">Desactivar</button></div><p className="mt-3 text-xs text-zinc-500">Selecciona una entidad para editarla o desactivarla; crear una nueva usa la jerarquia seleccionada.</p></section>;
}

function StockPanel({ onMessage, token }: PanelProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [newStock, setNewStock] = useState("");
  const [observation, setObservation] = useState("");
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [productId, setProductId] = useState("");

  async function load() {
    const nextProducts = await apiRequest<Product[]>("/api/products?onlyActive=true", { token });
    const allVariants = (await Promise.all(nextProducts.map((product) => apiRequest<ProductVariant[]>("/api/product-variants/product/" + product.id, { token }).catch(() => [])))).flat();
    setProducts(nextProducts); setVariants(allVariants); setProductId((current) => current || nextProducts[0]?.id || "");
    setSelectedVariantId((current) => current || allVariants[0]?.id || "");
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const timeoutId = window.setTimeout(() => { void load().catch((error: Error) => onMessage(error.message)); }, 0); return () => window.clearTimeout(timeoutId); }, [token]);
  const productVariants = useMemo(() => variants.filter((variant) => variant.productId === productId), [productId, variants]);
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId);
  useEffect(() => { if (!selectedVariantId) return; const timeoutId = window.setTimeout(() => { void apiRequest<StockMovement[]>("/api/stock-movements/product-variant/" + selectedVariantId, { token }).then(setMovements).catch(() => setMovements([])); }, 0); return () => window.clearTimeout(timeoutId); }, [selectedVariantId, token]);
  async function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedVariant) return;
    const next = Number(newStock);
    if (!Number.isInteger(next) || next < 0) { onMessage("El stock debe ser un entero mayor o igual a cero."); return; }
    try {
      await apiRequest<CreatedResponse>("/api/stock-movements/manual-adjustment", { method: "POST", token, body: { productVariantId: selectedVariant.id, orderId: null, quantity: next - selectedVariant.physicalStock, previousStock: selectedVariant.physicalStock, newStock: next, observation: observation.trim() || null } });
      onMessage("Stock actualizado y movimiento auditado."); setObservation(""); setNewStock(""); await load();
    } catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo ajustar el stock."); }
  }
  return <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]"><section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"><PanelTitle title="Inventario" text="El stock se modifica mediante un movimiento manual, no editando la variante directamente." /><Field label="Producto"><select className="admin-input mt-4" value={productId} onChange={(e) => { setProductId(e.target.value); setSelectedVariantId(""); }}>{products.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field><div className="mt-4 space-y-2">{productVariants.map((variant) => <button className={variant.id === selectedVariantId ? "w-full rounded-lg border border-zinc-950 bg-zinc-950 p-3 text-left text-white" : "w-full rounded-lg border border-zinc-200 bg-stone-50 p-3 text-left"} key={variant.id} onClick={() => setSelectedVariantId(variant.id)} type="button"><span className="font-semibold">{variant.size} / {variant.color}</span><span className="mt-1 block text-xs">SKU {variant.sku} - {variant.physicalStock} uds.</span></button>)}</div></section><section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"><PanelTitle title={selectedVariant ? "Ajuste manual" : "Selecciona una variante"} text="Cada ajuste queda registrado con fecha, usuario y valores anterior/nuevo." />{selectedVariant ? <form className="mt-5 space-y-4" onSubmit={adjust}><Field label="Nuevo stock"><input className="admin-input" min="0" required type="number" value={newStock} onChange={(e) => setNewStock(e.target.value)} /></Field><Field label="Observacion"><textarea className="admin-input min-h-20" value={observation} onChange={(e) => setObservation(e.target.value)} /></Field><button className="admin-primary-button">Guardar ajuste</button></form> : null}<h3 className="mt-6 border-t border-zinc-200 pt-4 text-sm font-semibold uppercase tracking-[0.12em]">Historial</h3>{movements.map((movement) => <p className="mt-3 text-sm text-zinc-600" key={movement.id}>{movement.type}: {movement.previousStock} {"->"} {movement.newStock} ({formatDate(movement.createdAt)})</p>)}</section></div>;
}

function SecurityPanel({ onMessage, token }: PanelProps) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [refreshTokens, setRefreshTokens] = useState<RefreshToken[]>([]);
  const [roleName, setRoleName] = useState("");
  async function load() {
    const [nextUsers, nextRoles] = await Promise.all([apiRequest<UserAccount[]>("/api/users", { token }), apiRequest<Role[]>("/api/roles?onlyActive=false", { token })]);
    setUsers(nextUsers); setRoles(nextRoles); setSelectedUserId((current) => current || nextUsers[0]?.id || ""); setSelectedRoleId((current) => current || nextRoles[0]?.id || "");
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const timeoutId = window.setTimeout(() => { void load().catch((error: Error) => onMessage(error.message)); }, 0); return () => window.clearTimeout(timeoutId); }, [token]);
  useEffect(() => { if (!selectedUserId) return; const timeoutId = window.setTimeout(() => { void apiRequest<RefreshToken[]>("/api/refresh-tokens/user/" + selectedUserId, { token }).then(setRefreshTokens).catch(() => setRefreshTokens([])); }, 0); return () => window.clearTimeout(timeoutId); }, [selectedUserId, token]);
  async function changeRole() {
    if (!selectedUserId || !selectedRoleId) return;
    try { await apiRequest<void>("/api/users/" + selectedUserId + "/role", { method: "PATCH", token, body: { roleId: selectedRoleId } }); onMessage("Rol actualizado."); await load(); }
    catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo cambiar el rol."); }
  }
  async function changeStatus(userId: string, action: "block" | "unblock") {
    try { await apiRequest<void>("/api/users/" + userId + "/" + action, { method: "PATCH", token }); onMessage(action === "block" ? "Usuario bloqueado." : "Usuario desbloqueado."); await load(); }
    catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo actualizar el usuario."); }
  }
  async function revoke(id: string) {
    try { await apiRequest<void>("/api/refresh-tokens/" + id, { method: "DELETE", token }); onMessage("Sesion revocada."); setRefreshTokens((current) => current.filter((entry) => entry.id !== id)); }
    catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo revocar la sesion."); }
  }
  async function createRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { await apiRequest<CreatedResponse>("/api/roles", { method: "POST", token, body: { id: null, name: roleName.trim() } }); setRoleName(""); onMessage("Rol creado."); await load(); }
    catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo crear el rol."); }
  }
  const selectedUser = users.find((entry) => entry.id === selectedUserId);
  return <div className="grid gap-6 xl:grid-cols-2"><section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"><PanelTitle title="Usuarios y roles" text="Bloquea cuentas, asigna roles y revisa el estado de acceso." /><EntityList title="Usuarios" items={users.map((entry) => ({ id: entry.id, name: entry.email, detail: entry.status }))} selectedId={selectedUserId} onSelect={setSelectedUserId} /><select className="admin-input mt-4" value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)}>{roles.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select><div className="mt-3 flex flex-wrap gap-2"><button className="admin-primary-button" onClick={() => void changeRole()} type="button">Asignar rol</button>{selectedUser?.status === "blocked" ? <button className="admin-secondary-button" onClick={() => void changeStatus(selectedUser.id, "unblock")} type="button">Desbloquear</button> : <button className="admin-secondary-button" onClick={() => void changeStatus(selectedUserId, "block")} type="button">Bloquear</button>}</div><form className="mt-5 flex gap-2" onSubmit={createRole}><input className="admin-input" placeholder="Nuevo rol" required value={roleName} onChange={(e) => setRoleName(e.target.value)} /><button className="admin-secondary-button">Crear rol</button></form></section><section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"><PanelTitle title="Sesiones activas" text="Revoca refresh tokens de un usuario desde el mismo panel." />{refreshTokens.length === 0 ? <p className="mt-5 text-sm text-zinc-500">No hay sesiones registradas.</p> : <div className="mt-5 space-y-3">{refreshTokens.map((entry) => <div className="rounded-lg border border-zinc-200 bg-stone-50 p-3 text-sm" key={entry.id}><p className="font-semibold">{entry.deviceInfo || entry.userAgent || "Dispositivo sin nombre"}</p><p className="mt-1 text-xs text-zinc-500">Creado {formatDate(entry.createdAt)} · expira {formatDate(entry.expiresAt)}</p>{entry.revokedAt ? <p className="mt-1 text-xs text-rose-700">Revocado</p> : <button className="mt-2 text-xs font-semibold uppercase tracking-[0.1em] text-rose-800" onClick={() => void revoke(entry.id)} type="button">Revocar sesion</button>}</div>)}</div>}</section></div>;
}

function OlvaPanel({ onMessage, token }: PanelProps) {
  const [result, setResult] = useState<unknown>(null);
  const [quote, setQuote] = useState({ origin: "", destination: "", deliveryType: "agency", shipmentType: "package", weight: "1", partnerRate: "" });
  const [track, setTrack] = useState({ orderNumber: "", orderCode: "" });
  async function validate() { try { setResult(await apiRequest<unknown>("/api/shipping/olva/validate", { token })); onMessage("La API de Olva respondio correctamente."); } catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo validar Olva."); } }
  async function sync() { try { setResult(await apiRequest<unknown>("/api/shipping/olva/agencies/sync", { method: "POST", token })); onMessage("Agencias Olva sincronizadas."); } catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo sincronizar Olva."); } }
  async function makeQuote(event: FormEvent<HTMLFormElement>) { event.preventDefault(); try { setResult(await apiRequest<unknown>("/api/shipping/olva/quote", { method: "POST", token, body: { origin: quote.origin.trim(), destination: quote.destination.trim(), deliveryType: quote.deliveryType, shipmentType: quote.shipmentType, weight: Number(quote.weight), partnerRate: quote.partnerRate ? Number(quote.partnerRate) : null } })); onMessage("Cotizacion Olva consultada."); } catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo cotizar el envio."); } }
  async function makeTrack(event: FormEvent<HTMLFormElement>) { event.preventDefault(); try { setResult(await apiRequest<unknown>("/api/shipping/olva/track", { method: "POST", token, body: track })); onMessage("Seguimiento consultado."); } catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo consultar el seguimiento."); } }
  return <div className="grid gap-6 xl:grid-cols-2"><section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"><PanelTitle title="Conexion Olva" text="Valida credenciales y actualiza el catalogo de agencias." /><div className="mt-5 flex flex-wrap gap-2"><button className="admin-primary-button" onClick={() => void validate()} type="button">Validar API</button><button className="admin-secondary-button" onClick={() => void sync()} type="button">Sincronizar agencias</button></div><form className="mt-6 space-y-3 border-t border-zinc-200 pt-5" onSubmit={makeQuote}><Field label="Origen"><input className="admin-input" required value={quote.origin} onChange={(e) => setQuote({ ...quote, origin: e.target.value })} /></Field><Field label="Destino"><input className="admin-input" required value={quote.destination} onChange={(e) => setQuote({ ...quote, destination: e.target.value })} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Tipo de entrega"><select className="admin-input" value={quote.deliveryType} onChange={(e) => setQuote({ ...quote, deliveryType: e.target.value })}><option value="agency">Agencia</option><option value="home">Domicilio</option></select></Field><Field label="Peso (kg)"><input className="admin-input" min="0.1" required step="0.1" type="number" value={quote.weight} onChange={(e) => setQuote({ ...quote, weight: e.target.value })} /></Field></div><button className="admin-secondary-button">Cotizar envio</button></form></section><section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"><PanelTitle title="Seguimiento" text="Consulta el estado devuelto por Olva para una orden registrada." /><form className="mt-5 space-y-3" onSubmit={makeTrack}><Field label="Numero de orden"><input className="admin-input" required value={track.orderNumber} onChange={(e) => setTrack({ ...track, orderNumber: e.target.value })} /></Field><Field label="Codigo de orden"><input className="admin-input" value={track.orderCode} onChange={(e) => setTrack({ ...track, orderCode: e.target.value })} /></Field><button className="admin-primary-button">Consultar seguimiento</button></form>{result !== null ? <pre className="mt-6 max-h-96 overflow-auto rounded-lg bg-zinc-950 p-4 text-xs text-white">{JSON.stringify(result, null, 2)}</pre> : null}</section></div>;
}

type PanelProps = { onMessage: (message: string) => void; token: string | null };

function PanelTitle({ title, text }: { title: string; text: string }) {
  return <div><h2 className="text-xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-zinc-500">{text}</p></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-zinc-800">{label}<div className="mt-2">{children}</div></label>;
}

function Check({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return <label className="flex items-center gap-3 text-sm font-medium"><input checked={checked} type="checkbox" onChange={(e) => onChange(e.target.checked)} />{label}</label>;
}

function EntityList({ items, onSelect, selectedId, title }: { items: Array<{ id: string; name: string; detail: string }>; onSelect: (id: string) => void; selectedId: string; title: string }) {
  return <div className="mt-4"><h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{title}</h3><div className="mt-2 max-h-52 space-y-2 overflow-auto">{items.map((item) => <button className={item.id === selectedId ? "w-full rounded-lg border border-zinc-950 bg-zinc-950 p-3 text-left text-white" : "w-full rounded-lg border border-zinc-200 bg-stone-50 p-3 text-left hover:border-zinc-950"} key={item.id} onClick={() => onSelect(item.id)} type="button"><span className="block text-sm font-semibold">{item.name}</span><span className="mt-1 block text-xs opacity-70">{item.detail}</span></button>)}{items.length === 0 ? <p className="text-sm text-zinc-500">Sin registros.</p> : null}</div></div>;
}

function formatMoney(value: number, currency: string) {
  return "S/. " + value.toFixed(2) + " " + currency;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
