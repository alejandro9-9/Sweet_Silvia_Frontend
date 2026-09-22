import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canAdminister } from "@/lib/roles";
import { formatMoney } from "@/lib/format";
import { AdminPagination } from "@/components/AdminPagination";
import { PlusIcon, SettingsList, SettingsModal, type SettingsEditorState } from "@/components/AdminSettingsCrud";
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
  OlvaQuoteLocation,
  RefreshToken,
  Role,
  ShippingRate,
  StockMovement,
  UserAccount,
} from "@/lib/types";

type SettingsTab = "coupons" | "payments" | "shipping" | "ubigeo" | "stock" | "users" | "roles" | "sessions" | "olva";

const tabs: Array<{ id: SettingsTab; label: string; adminOnly?: boolean }> = [
  { id: "coupons", label: "Cupones" },
  { id: "payments", label: "Pagos", adminOnly: true },
  { id: "shipping", label: "Envios" },
  { id: "ubigeo", label: "Ubigeo" },
  { id: "stock", label: "Stock", adminOnly: true },
  { id: "users", label: "Usuarios", adminOnly: true },
  { id: "roles", label: "Roles", adminOnly: true },
  { id: "sessions", label: "Sesiones activas", adminOnly: true },
  { id: "olva", label: "Olva" },
];

export function AdminSettings() {
  const { token, user } = useAuth();
  const isAdmin = canAdminister(user?.role);
  const [searchParams, setSearchParams] = useSearchParams();
  const visibleTabs = tabs.filter((tab) => !tab.adminOnly || isAdmin);
  const requestedTab = searchParams.get("tab") as SettingsTab | null;
  const requestedTabIsVisible = Boolean(requestedTab && visibleTabs.some((tab) => tab.id === requestedTab));
  const initialTab: SettingsTab = requestedTabIsVisible ? (requestedTab as SettingsTab) : "coupons";
  const initialVariantId = searchParams.get("variantId") ?? "";
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setActiveTab(requestedTabIsVisible ? (requestedTab as SettingsTab) : "coupons");
  }, [requestedTab, requestedTabIsVisible]);

  function selectTab(tab: SettingsTab) {
    setActiveTab(tab);
    setMessage("");
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("tab", tab);
      if (tab !== "stock") {
        next.delete("variantId");
      }
      return next;
    }, { replace: true });
  }

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
              onClick={() => selectTab(tab.id)}
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
      {activeTab === "stock" ? <StockPanel initialVariantId={initialVariantId} onMessage={setMessage} token={token} /> : null}
      {activeTab === "users" ? <SecurityPanel section="users" onMessage={setMessage} token={token} /> : null}
      {activeTab === "roles" ? <SecurityPanel section="roles" onMessage={setMessage} token={token} /> : null}
      {activeTab === "sessions" ? <SecurityPanel section="sessions" onMessage={setMessage} token={token} /> : null}
      {activeTab === "olva" ? <OlvaPanel onMessage={setMessage} token={token} /> : null}
    </div>
  );
}

function CouponsPanel({ isAdmin, onMessage, token }: PanelProps & { isAdmin: boolean }) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedCouponId, setSelectedCouponId] = useState("");
  const [couponEditor, setCouponEditor] = useState<SettingsEditorState | null>(null);
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
  const hasItemQuantityLimit = form.scope === "item" && Number(form.maximumDiscountedItemsQuantity) > 0;

  function resetCouponForm() {
    const today = new Date();
    const endDate = new Date(today.getTime() + 30 * 86400000);
    setForm({ code: "", name: "", scope: "order", discountType: "percentage", discountValue: "10", startDate: today.toISOString().slice(0, 10), endDate: endDate.toISOString().slice(0, 10), minimumPurchaseAmount: "", minimumItemsQuantity: "", maximumDiscountedItemsQuantity: "", applicationStrategy: "cheapest", maximumTotalUses: "", maximumUsesPerUser: "1" });
  }

  function changeScope(scope: string) {
    setForm((current) => ({
      ...current,
      scope,
      maximumDiscountedItemsQuantity: "",
      applicationStrategy: scope === "item" ? current.applicationStrategy : "cheapest",
    }));
  }

  async function load(preferredCouponId = selectedCouponId) {
    const [nextCoupons, nextCategories, nextCollections, nextProducts] = await Promise.all([
      apiRequest<Coupon[]>("/api/coupons?onlyActive=false", { token }),
      apiRequest<Category[]>("/api/categories?onlyActive=true"),
      apiRequest<Collection[]>("/api/collections?onlyActive=true"),
      apiRequest<Product[]>("/api/products?onlyActive=true"),
    ]);
    const nextVariants = (await Promise.all(nextProducts.map((product) => apiRequest<ProductVariant[]>(`/api/product-variants/product/${product.id}?onlyActive=true`).catch(() => [])))).flat();
    setCoupons(nextCoupons);
    setCategories(nextCategories);
    setCollections(nextCollections);
    setProducts(nextProducts);
    setVariants(nextVariants);
    const nextId = nextCoupons.some((coupon) => coupon.id === preferredCouponId) ? preferredCouponId : nextCoupons[0]?.id || "";
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

  const selectedCoupon = coupons.find((coupon) => coupon.id === selectedCouponId);
  useEffect(() => {
    if (!selectedCoupon || couponEditor?.mode !== "edit") return;
    const timeoutId = window.setTimeout(() => setForm({
      code: selectedCoupon.code,
      name: selectedCoupon.name,
      scope: selectedCoupon.scope,
      discountType: selectedCoupon.discountType,
      discountValue: String(selectedCoupon.discountValue),
      startDate: selectedCoupon.startDate.slice(0, 10),
      endDate: selectedCoupon.endDate.slice(0, 10),
      minimumPurchaseAmount: selectedCoupon.minimumPurchaseAmount === null ? "" : String(selectedCoupon.minimumPurchaseAmount),
      minimumItemsQuantity: selectedCoupon.minimumItemsQuantity === null ? "" : String(selectedCoupon.minimumItemsQuantity),
      maximumDiscountedItemsQuantity: selectedCoupon.maximumDiscountedItemsQuantity === null ? "" : String(selectedCoupon.maximumDiscountedItemsQuantity),
      applicationStrategy: selectedCoupon.applicationStrategy ?? "cheapest",
      maximumTotalUses: selectedCoupon.maximumTotalUses === null ? "" : String(selectedCoupon.maximumTotalUses),
      maximumUsesPerUser: selectedCoupon.maximumUsesPerUser === null ? "" : String(selectedCoupon.maximumUsesPerUser),
    }), 0);
    return () => window.clearTimeout(timeoutId);
  }, [couponEditor, selectedCoupon]);

  async function createCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      if (selectedCouponId) {
        await apiRequest<void>("/api/coupons/" + selectedCouponId + "/rules", {
          method: "PUT",
          token,
          body: {
            minimumPurchaseAmount: form.minimumPurchaseAmount ? Number(form.minimumPurchaseAmount) : null,
            minimumItemsQuantity: form.minimumItemsQuantity ? Number(form.minimumItemsQuantity) : null,
            maximumDiscountedItemsQuantity: hasItemQuantityLimit ? Number(form.maximumDiscountedItemsQuantity) : null,
            applicationStrategy: hasItemQuantityLimit ? form.applicationStrategy : null,
            maximumTotalUses: form.maximumTotalUses ? Number(form.maximumTotalUses) : null,
            maximumUsesPerUser: form.maximumUsesPerUser ? Number(form.maximumUsesPerUser) : null,
          },
        });
        onMessage("Reglas del cupon actualizadas.");
        await load(selectedCouponId);
        setCouponEditor(null);
        return;
      }
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
          maximumDiscountedItemsQuantity: hasItemQuantityLimit ? Number(form.maximumDiscountedItemsQuantity) : null,
          applicationStrategy: hasItemQuantityLimit ? form.applicationStrategy : null,
          maximumTotalUses: form.maximumTotalUses ? Number(form.maximumTotalUses) : null,
          maximumUsesPerUser: form.maximumUsesPerUser ? Number(form.maximumUsesPerUser) : null,
        },
      });
      onMessage("Cupon creado y sus reglas guardadas.");
      setSelectedCouponId(created.id);
      await load(created.id);
      setCouponEditor(null);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "No se pudo crear el cupon.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteCoupon(couponId = selectedCouponId) {
    if (!couponId || !window.confirm("Se desactivara este cupon. Continuar?")) return;
    try {
      await apiRequest<void>("/api/coupons/" + couponId, { method: "DELETE", token });
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

  return (
    <>
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4"><PanelTitle title="Cupones" text="Administra descuentos, vigencia y restricciones desde un listado." />{isAdmin ? <button aria-label="Crear cupon" className="icon-button" onClick={() => { resetCouponForm(); setSelectedCouponId(""); setCouponEditor({ mode: "create" }); }} title="Crear cupon" type="button"><PlusIcon /></button> : null}</div>
        <SettingsList items={coupons.map((coupon) => ({ id: coupon.id, name: coupon.code, detail: `${coupon.name} · ${coupon.discountType} ${coupon.discountValue}`, status: coupon.isActive ? "Activo" : "Inactivo" }))} onDelete={isAdmin ? (id) => void deleteCoupon(id) : undefined} onEdit={isAdmin ? (id) => { setSelectedCouponId(id); setCouponEditor({ mode: "edit", id }); } : undefined} />
      </section>
      {couponEditor ? <SettingsModal title={couponEditor.mode === "create" ? "Nuevo cupon" : "Editar reglas del cupon"} onClose={() => setCouponEditor(null)}><form className="grid gap-3 sm:grid-cols-2" onSubmit={createCoupon}><Field label="Codigo"><input className="admin-input" readOnly={couponEditor.mode === "edit"} required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field><Field label="Nombre"><input className="admin-input" readOnly={couponEditor.mode === "edit"} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field label="Alcance"><select className="admin-input" value={form.scope} onChange={(e) => changeScope(e.target.value)}><option value="order">Orden completa</option><option value="item">Una prenda del carrito</option></select></Field><Field label="Tipo de descuento"><select className="admin-input" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}><option value="percentage">Porcentaje</option><option value="amount">Monto fijo</option></select></Field><Field label="Valor"><input className="admin-input" max={form.discountType === "percentage" ? 100 : undefined} min="0.01" required step="0.01" type="number" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} /></Field><Field label="Usos por usuario"><input className="admin-input" min="1" type="number" value={form.maximumUsesPerUser} onChange={(e) => setForm({ ...form, maximumUsesPerUser: e.target.value })} /></Field><Field label="Inicio"><input className="admin-input" required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field><Field label="Fin"><input className="admin-input" required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field><Field label="Compra minima elegible"><input className="admin-input" min="0" step="0.01" type="number" value={form.minimumPurchaseAmount} onChange={(e) => setForm({ ...form, minimumPurchaseAmount: e.target.value })} /></Field><Field label="Unidades minimas elegibles"><input className="admin-input" min="1" type="number" value={form.minimumItemsQuantity} onChange={(e) => setForm({ ...form, minimumItemsQuantity: e.target.value })} /></Field>{form.scope === "item" ? <Field label="Maximo de unidades con descuento"><input className="admin-input" min="1" placeholder="Sin limite" type="number" value={form.maximumDiscountedItemsQuantity} onChange={(e) => setForm({ ...form, maximumDiscountedItemsQuantity: e.target.value })} /></Field> : null}<Field label="Usos totales"><input className="admin-input" min="1" type="number" value={form.maximumTotalUses} onChange={(e) => setForm({ ...form, maximumTotalUses: e.target.value })} /></Field>{hasItemQuantityLimit ? <Field label="Prioridad de descuento"><select className="admin-input" value={form.applicationStrategy} onChange={(e) => setForm({ ...form, applicationStrategy: e.target.value })}><option value="cheapest">Unidades mas baratas primero</option><option value="mostExpensive">Unidades mas caras primero</option><option value="firstAdded">Orden del carrito</option></select></Field> : null}<button className="admin-primary-button sm:col-span-2" disabled={isSubmitting}>{couponEditor.mode === "create" ? "Crear cupon" : "Guardar reglas"}</button></form>{couponEditor.mode === "edit" ? <div className="mt-6 border-t border-zinc-200 pt-5"><h3 className="text-sm font-semibold uppercase tracking-[0.12em]">Restricciones</h3>{restrictions.length === 0 ? <p className="mt-3 text-sm text-zinc-500">Sin restricciones especificas.</p> : <div className="mt-3 space-y-2">{restrictions.map((restriction) => <div className="flex justify-between gap-3 rounded-lg border border-zinc-200 p-3 text-xs" key={restriction.id}><span>{restriction.categoryId ? "Categoria" : restriction.productId ? "Producto" : restriction.productVariantId ? "Variante" : "Coleccion"}</span>{isAdmin ? <button className="font-semibold text-rose-800" onClick={() => void removeRestriction(restriction.id)} type="button">Quitar</button> : null}</div>)}</div>}{isAdmin ? <form className="mt-4 space-y-3" onSubmit={addRestriction}><Field label="Categoria"><select className="admin-input" value={restrictionForm.categoryId} onChange={(e) => setRestrictionForm({ ...restrictionForm, categoryId: e.target.value })}><option value="">Sin categoria</option>{categories.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field><Field label="Producto"><select className="admin-input" value={restrictionForm.productId} onChange={(e) => setRestrictionForm({ ...restrictionForm, productId: e.target.value })}><option value="">Sin producto</option>{products.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field><Field label="Variante"><select className="admin-input" value={restrictionForm.productVariantId} onChange={(e) => setRestrictionForm({ ...restrictionForm, productVariantId: e.target.value })}><option value="">Sin variante</option>{variants.map((entry) => <option key={entry.id} value={entry.id}>{products.find((product) => product.id === entry.productId)?.name ?? "Producto"} - {entry.size} {entry.color} - {entry.sku}</option>)}</select></Field><Field label="Coleccion"><select className="admin-input" value={restrictionForm.collectionId} onChange={(e) => setRestrictionForm({ ...restrictionForm, collectionId: e.target.value })}><option value="">Sin coleccion</option>{collections.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field><button className="admin-secondary-button w-full">Agregar restriccion</button></form> : null}{isAdmin && usages.length > 0 ? <pre className="mt-5 max-h-48 overflow-auto border-t border-zinc-200 pt-4 text-xs text-zinc-600">{JSON.stringify(usages, null, 2)}</pre> : null}</div> : null}</SettingsModal> : null}
    </>
  );
}

function PaymentsPanel({ onMessage, token }: PanelProps) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [editor, setEditor] = useState<SettingsEditorState | null>(null);
  const [form, setForm] = useState({ name: "", type: "manual", requiresManualVerification: true, requiresExternalIntegration: false });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function load() {
    const nextMethods = await apiRequest<PaymentMethod[]>("/api/payment-methods");
    setMethods(nextMethods);
    setSelectedId((current) => nextMethods.some((method) => method.id === current) ? current : nextMethods[0]?.id || "");
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

  async function remove(methodId: string) {
    if (!methodId || !window.confirm("Se desactivara el metodo de pago. Continuar?")) return;
    try { await apiRequest<void>("/api/payment-methods/" + methodId, { method: "DELETE", token }); onMessage("Metodo desactivado."); await load(); }
    catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo desactivar el metodo."); }
  }

  function startNew() {
    setSelectedId("");
    setForm({ name: "", type: "manual", requiresManualVerification: true, requiresExternalIntegration: false });
    setEditor({ mode: "create" });
  }

  return (
    <>
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <PanelTitle title="Metodos de pago" text="Administra las opciones disponibles para el checkout." />
          <button aria-label="Crear metodo de pago" className="icon-button" onClick={startNew} title="Crear metodo de pago" type="button"><PlusIcon /></button>
        </div>
        <SettingsList
          items={methods.map((entry) => ({ id: entry.id, name: entry.name, detail: entry.type + (entry.requiresManualVerification ? " / verificacion manual" : "") }))}
          onDelete={(id) => void remove(id)}
          onEdit={(id) => { setSelectedId(id); setEditor({ mode: "edit", id }); }}
        />
      </section>
      {editor ? (
        <SettingsModal title={editor.mode === "create" ? "Nuevo metodo de pago" : "Editar metodo de pago"} onClose={() => setEditor(null)}>
          <form className="space-y-4" onSubmit={async (event) => { await submit(event); setEditor(null); }}>
            <Field label="Nombre"><input className="admin-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Tipo"><select className="admin-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="manual">Manual</option><option value="gateway">Pasarela</option><option value="cash">Efectivo</option></select></Field>
            <Check label="Requiere verificacion manual" checked={form.requiresManualVerification} onChange={(value) => setForm({ ...form, requiresManualVerification: value })} />
            <Check label="Requiere integracion externa" checked={form.requiresExternalIntegration} onChange={(value) => setForm({ ...form, requiresExternalIntegration: value })} />
            <div className="flex flex-wrap gap-2"><button className="admin-primary-button" disabled={isSubmitting}>{selected ? "Guardar cambios" : "Crear metodo"}</button>{selected ? <button className="admin-secondary-button" onClick={() => void remove(selected.id)} type="button">Desactivar</button> : null}</div>
          </form>
        </SettingsModal>
      ) : null}
    </>
  );
}

function ShippingPanel({ isAdmin, onMessage, token }: PanelProps & { isAdmin: boolean }) {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedCourierId, setSelectedCourierId] = useState("");
  const [selectedRateId, setSelectedRateId] = useState("");
  const [courierEditor, setCourierEditor] = useState<SettingsEditorState | null>(null);
  const [rateEditor, setRateEditor] = useState<SettingsEditorState | null>(null);
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
    if (!isAdmin) {
      onMessage("Solo el administrador modifica couriers.");
      return;
    }
    try {
      if (selectedCourierId) await apiRequest<void>("/api/couriers/" + selectedCourierId, { method: "PUT", token, body: courierForm });
      else await apiRequest<CreatedResponse>("/api/couriers", { method: "POST", token, body: courierForm });
      onMessage("Courier guardado."); await load();
    } catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo guardar el courier."); }
  }
  async function deleteCourier(courierId = selectedCourierId) {
    if (!courierId || !window.confirm("Se desactivara este courier. Continuar?")) return;
    try { await apiRequest<void>("/api/couriers/" + courierId, { method: "DELETE", token }); onMessage("Courier desactivado."); await load(); }
    catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo desactivar el courier."); }
  }
  async function saveRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) {
      onMessage("Solo el administrador modifica tarifas.");
      return;
    }
    try {
      const body = { ...rateForm, provinceId: rateForm.provinceId || null, districtId: rateForm.districtId || null, cost: Number(rateForm.cost), freeShippingMinimumAmount: rateForm.freeShippingMinimumAmount ? Number(rateForm.freeShippingMinimumAmount) : null, estimatedTime: rateForm.estimatedTime || null };
      if (selectedRateId) await apiRequest<void>("/api/shipping-rates/" + selectedRateId, { method: "PUT", token, body });
      else await apiRequest<CreatedResponse>("/api/shipping-rates", { method: "POST", token, body });
      onMessage("Tarifa de envio guardada."); await load();
    } catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo guardar la tarifa."); }
  }
  async function deleteRate(rateId = selectedRateId) {
    if (!rateId || !window.confirm("Se desactivara esta tarifa. Continuar?")) return;
    try { await apiRequest<void>("/api/shipping-rates/" + rateId, { method: "DELETE", token }); onMessage("Tarifa desactivada."); await load(); }
    catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo desactivar la tarifa."); }
  }

  function startNewCourier() {
    setSelectedCourierId("");
    setCourierForm({ name: "", type: "agency", requiresExternalIntegration: true });
    setCourierEditor({ mode: "create" });
  }

  function startNewRate() {
    setSelectedRateId("");
    setRateForm((current) => ({ ...current, cost: "0", provinceId: "", districtId: "", serviceType: "regular", estimatedTime: "" }));
    setRateEditor({ mode: "create" });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4"><PanelTitle title="Couriers" text="Agencia, delivery app o reparto propio." />{isAdmin ? <button aria-label="Crear courier" className="icon-button" onClick={startNewCourier} title="Crear courier" type="button"><PlusIcon /></button> : null}</div>
        <SettingsList items={couriers.map((entry) => ({ id: entry.id, name: entry.name, detail: entry.type }))} onDelete={(id) => void deleteCourier(id)} onEdit={(id) => { setSelectedCourierId(id); setCourierEditor({ mode: "edit", id }); }} />
      </section>
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4"><PanelTitle title="Tarifas por zona" text="El checkout solo acepta tarifas creadas en esta seccion." />{isAdmin ? <button aria-label="Crear tarifa" className="icon-button" onClick={startNewRate} title="Crear tarifa" type="button"><PlusIcon /></button> : null}</div>
        <SettingsList items={rates.map((entry) => ({ id: entry.id, name: formatMoney(entry.cost, entry.currency), detail: entry.serviceType + " / " + entry.destinationType }))} onDelete={(id) => void deleteRate(id)} onEdit={(id) => { setSelectedRateId(id); setRateEditor({ mode: "edit", id }); }} />
      </section>
      {courierEditor ? <SettingsModal title={courierEditor.mode === "create" ? "Nuevo courier" : "Editar courier"} onClose={() => setCourierEditor(null)}><form className="space-y-4" onSubmit={async (event) => { await saveCourier(event); setCourierEditor(null); }}><Field label="Nombre"><input className="admin-input" required value={courierForm.name} onChange={(e) => setCourierForm({ ...courierForm, name: e.target.value })} /></Field><Field label="Tipo"><select className="admin-input" value={courierForm.type} onChange={(e) => setCourierForm({ ...courierForm, type: e.target.value })}><option value="agency">Agencia</option><option value="deliveryApp">Delivery app</option><option value="ownDelivery">Propio</option></select></Field><Check label="Requiere integracion externa" checked={courierForm.requiresExternalIntegration} onChange={(value) => setCourierForm({ ...courierForm, requiresExternalIntegration: value })} /><button className="admin-primary-button">{courierEditor.mode === "edit" ? "Guardar cambios" : "Crear courier"}</button></form></SettingsModal> : null}
      {rateEditor ? <SettingsModal title={rateEditor.mode === "create" ? "Nueva tarifa" : "Editar tarifa"} onClose={() => setRateEditor(null)}><form className="grid gap-3 sm:grid-cols-2" onSubmit={async (event) => { await saveRate(event); setRateEditor(null); }}><Field label="Courier"><select className="admin-input" required value={rateForm.courierId} onChange={(e) => { const courier = couriers.find((entry) => entry.id === e.target.value); setRateForm({ ...rateForm, courierId: e.target.value, courierType: courier?.type || "agency" }); }}><option value="">Seleccionar</option>{couriers.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field><Field label="Departamento"><select className="admin-input" required value={rateForm.departmentId} onChange={(e) => setRateForm({ ...rateForm, departmentId: e.target.value, provinceId: "", districtId: "" })}><option value="">Seleccionar</option>{departments.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field><Field label="Provincia"><select className="admin-input" value={rateForm.provinceId} onChange={(e) => setRateForm({ ...rateForm, provinceId: e.target.value, districtId: "" })}><option value="">Todas</option>{provinces.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field><Field label="Distrito"><select className="admin-input" value={rateForm.districtId} onChange={(e) => setRateForm({ ...rateForm, districtId: e.target.value })}><option value="">Todos</option>{districts.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field><Field label="Destino"><select className="admin-input" value={rateForm.destinationType} onChange={(e) => setRateForm({ ...rateForm, destinationType: e.target.value })}><option value="lima">Lima</option><option value="province">Provincia</option></select></Field><Field label="Servicio"><select className="admin-input" value={rateForm.serviceType} onChange={(e) => setRateForm({ ...rateForm, serviceType: e.target.value })}><option value="regular">Regular</option><option value="express">Express</option><option value="sameDay">Mismo dia</option><option value="agency">Agencia</option><option value="homeDelivery">Domicilio</option></select></Field><Field label="Costo"><input className="admin-input" min="0" required step="0.01" type="number" value={rateForm.cost} onChange={(e) => setRateForm({ ...rateForm, cost: e.target.value })} /></Field><Field label="Tiempo estimado"><input className="admin-input" value={rateForm.estimatedTime} onChange={(e) => setRateForm({ ...rateForm, estimatedTime: e.target.value })} /></Field><button className="admin-primary-button sm:col-span-2">{rateEditor.mode === "edit" ? "Guardar cambios" : "Crear tarifa"}</button></form></SettingsModal> : null}
    </div>
  );
}

function UbigeoPanel({ onMessage, token }: PanelProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districtProvinces, setDistrictProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [provinceId, setProvinceId] = useState("");
  const [selectedDistrictId, setSelectedDistrictId] = useState("");
  const [locationEditor, setLocationEditor] = useState<SettingsEditorState | null>(null);
  const [form, setForm] = useState({ name: "", destinationType: "province", ubigeo: "" });
  const [mode, setMode] = useState<"department" | "province" | "district">("department");
  const [isNew, setIsNew] = useState(true);

  async function loadDepartments() { const next = await apiRequest<Department[]>("/api/departments?onlyActive=false"); setDepartments(next); if (!departmentId && next[0]) setDepartmentId(next[0].id); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const timeoutId = window.setTimeout(() => { void loadDepartments().catch((error: Error) => onMessage(error.message)); }, 0); return () => window.clearTimeout(timeoutId); }, [token]);
  useEffect(() => { if (!departmentId) return; const timeoutId = window.setTimeout(() => { void apiRequest<Province[]>("/api/provinces/department/" + departmentId).then(setProvinces).catch(() => setProvinces([])); }, 0); return () => window.clearTimeout(timeoutId); }, [departmentId]);
  useEffect(() => {
    if (mode !== "district" || departments.length === 0) return;
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const provinceGroups = await Promise.all(departments.map((department) => apiRequest<Province[]>("/api/provinces/department/" + department.id)));
          const allProvinces = provinceGroups.flat();
          const districtGroups = await Promise.all(allProvinces.map((province) => apiRequest<District[]>("/api/districts/province/" + province.id + "?onlyActive=false")));
          if (!cancelled) {
            setDistrictProvinces(allProvinces);
            setDistricts(districtGroups.flat());
          }
        } catch {
          if (!cancelled) {
            setDistrictProvinces([]);
            setDistricts([]);
          }
        }
      })();
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timeoutId); };
  }, [departments, mode]);

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
  }, [departmentId, departments, districts, isNew, mode, provinceId, provinces, selectedDistrictId]);

  function chooseMode(nextMode: "department" | "province" | "district") { setMode(nextMode); setIsNew(true); setForm({ name: "", destinationType: "province", ubigeo: "" }); setSelectedDistrictId(""); }
  async function save(event: FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    try {
      if (mode === "department") await apiRequest<CreatedResponse | void>(isNew ? "/api/departments" : "/api/departments/" + departmentId, { method: isNew ? "POST" : "PUT", token, body: { name: form.name, destinationType: form.destinationType } });
      if (mode === "province") await apiRequest<CreatedResponse | void>(isNew ? "/api/provinces" : "/api/provinces/" + provinceId, { method: isNew ? "POST" : "PUT", token, body: { departmentId, name: form.name } });
      if (mode === "district") await apiRequest<CreatedResponse | void>(isNew ? "/api/districts" : "/api/districts/" + selectedDistrictId, { method: isNew ? "POST" : "PUT", token, body: { provinceId, name: form.name, ubigeo: form.ubigeo || null } });
      onMessage("Ubicacion guardada."); await loadDepartments(); setLocationEditor(null);
    } catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo guardar la ubicacion."); }
  }

  async function removeSelected(locationId?: string) {
    const id = locationId ?? (mode === "department" ? departmentId : mode === "province" ? provinceId : selectedDistrictId);
    if (!id || !window.confirm("Se desactivara esta ubicacion. Continuar?")) return;
    try {
      await apiRequest<void>("/api/" + (mode === "department" ? "departments/" : mode === "province" ? "provinces/" : "districts/") + id, { method: "DELETE", token });
      setIsNew(true);
      setForm({ name: "", destinationType: "province", ubigeo: "" });
      onMessage("Ubicacion desactivada.");
      await loadDepartments();
    } catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo desactivar la ubicacion."); }
  }

  const locationItems = mode === "department"
    ? departments.map((entry) => ({ id: entry.id, name: entry.name, detail: entry.destinationType === "lima" ? "Lima" : "Provincia", status: entry.isActive ? "Activo" : "Inactivo" }))
    : mode === "province"
      ? provinces.map((entry) => ({ id: entry.id, name: entry.name, detail: "Provincia", status: entry.isActive ? "Activo" : "Inactivo" }))
      : districts.map((entry) => ({ id: entry.id, name: entry.name, detail: entry.ubigeo ?? "Sin ubigeo", status: entry.isActive ? "Activo" : "Inactivo" }));
  const locationLabel = mode === "department" ? "Departamento" : mode === "province" ? "Provincia" : "Distrito";

  return (
    <>
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><PanelTitle title="Ubicaciones" text="Administra departamentos, provincias y distritos desde un listado." /><div className="mt-5 flex flex-wrap gap-2">{(["department", "province", "district"] as const).map((entry) => <button className={mode === entry ? "rounded-lg bg-zinc-950 px-3 py-2 text-sm text-white" : "rounded-lg border px-3 py-2 text-sm"} key={entry} onClick={() => chooseMode(entry)} type="button">{entry === "department" ? "Departamentos" : entry === "province" ? "Provincias" : "Distritos"}</button>)}</div></div><button aria-label={`Crear ${locationLabel.toLowerCase()}`} className="icon-button" onClick={() => { setIsNew(true); setForm({ name: "", destinationType: "province", ubigeo: "" }); setLocationEditor({ mode: "create" }); }} title={`Crear ${locationLabel.toLowerCase()}`} type="button"><PlusIcon /></button></div>
        <SettingsList items={locationItems} onDelete={(id) => void removeSelected(id)} onEdit={(id) => {
          if (mode === "department") setDepartmentId(id);
          if (mode === "province") setProvinceId(id);
          if (mode === "district") {
            const district = districts.find((entry) => entry.id === id);
            const parentProvince = districtProvinces.find((entry) => entry.id === district?.provinceId);
            if (parentProvince) {
              setDepartmentId(parentProvince.departmentId);
              setProvinceId(parentProvince.id);
            }
            setSelectedDistrictId(id);
          }
          setIsNew(false); setLocationEditor({ mode: "edit", id });
        }} />
      </section>
      {locationEditor ? <SettingsModal title={`${locationEditor.mode === "create" ? "Nuevo" : "Editar"} ${locationLabel.toLowerCase()}`} onClose={() => setLocationEditor(null)}><form className="grid gap-3 sm:grid-cols-2" onSubmit={save}>{mode !== "department" ? <Field label="Departamento"><select className="admin-input" required value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setProvinceId(""); setSelectedDistrictId(""); }}><option value="">Seleccionar</option>{departments.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field> : null}{mode === "district" ? <Field label="Provincia"><select className="admin-input" required value={provinceId} onChange={(e) => { setProvinceId(e.target.value); setSelectedDistrictId(""); }}><option value="">Seleccionar</option>{districtProvinces.filter((entry) => entry.departmentId === departmentId).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field> : null}<Field label="Nombre"><input className="admin-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>{mode === "department" ? <Field label="Tipo"><select className="admin-input" value={form.destinationType} onChange={(e) => setForm({ ...form, destinationType: e.target.value })}><option value="lima">Lima</option><option value="province">Provincia</option></select></Field> : null}{mode === "district" ? <Field label="Ubigeo"><input className="admin-input" value={form.ubigeo} onChange={(e) => setForm({ ...form, ubigeo: e.target.value })} /></Field> : null}<button className="admin-primary-button sm:col-span-2">{locationEditor.mode === "edit" ? "Guardar cambios" : `Crear ${locationLabel.toLowerCase()}`}</button></form></SettingsModal> : null}
    </>
  );
}

function StockPanel({ initialVariantId, onMessage, token }: PanelProps & { initialVariantId?: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [stockEditor, setStockEditor] = useState(false);
  const [newStock, setNewStock] = useState("");
  const [observation, setObservation] = useState("");
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [productId, setProductId] = useState("");

  async function load() {
    const nextProducts = await apiRequest<Product[]>("/api/products?onlyActive=true", { token });
    const allVariants = (await Promise.all(nextProducts.map((product) => apiRequest<ProductVariant[]>("/api/product-variants/product/" + product.id, { token }).catch(() => [])))).flat();
    const initialVariant = allVariants.find((variant) => variant.id === initialVariantId);
    setProducts(nextProducts); setVariants(allVariants); setProductId((current) => current || initialVariant?.productId || nextProducts[0]?.id || "");
    setSelectedVariantId((current) => current || initialVariant?.id || allVariants[0]?.id || "");
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const timeoutId = window.setTimeout(() => { void load().catch((error: Error) => onMessage(error.message)); }, 0); return () => window.clearTimeout(timeoutId); }, [token]);
  const productVariants = useMemo(() => variants.filter((variant) => variant.productId === productId), [productId, variants]);
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId);
  useEffect(() => {
    if (productVariants.some((variant) => variant.id === selectedVariantId)) return;
    setSelectedVariantId(productVariants[0]?.id || "");
  }, [productVariants, selectedVariantId]);
  useEffect(() => {
    if (!selectedVariantId) {
      setMovements([]);
      return;
    }
    const timeoutId = window.setTimeout(() => { void apiRequest<StockMovement[]>("/api/stock-movements/product-variant/" + selectedVariantId, { token }).then(setMovements).catch(() => setMovements([])); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [selectedVariantId, token]);
  async function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedVariant) return;
    const next = Number(newStock);
    if (!Number.isInteger(next) || next < 0) { onMessage("El stock debe ser un entero mayor o igual a cero."); return; }
    try {
      const difference = next - selectedVariant.physicalStock;
      if (difference === 0) { onMessage("El nuevo stock debe ser diferente al stock actual."); return; }
      await apiRequest<CreatedResponse>("/api/stock-movements/manual-adjustment", { method: "POST", token, body: { productVariantId: selectedVariant.id, orderId: null, quantity: Math.abs(difference), previousStock: selectedVariant.physicalStock, newStock: next, observation: observation.trim() || null } });
      onMessage("Stock actualizado y movimiento auditado."); setObservation(""); setNewStock(""); setStockEditor(false); await load();
    } catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo ajustar el stock."); }
  }
  function openStockEditor(variantId = selectedVariantId || productVariants[0]?.id || "") {
    if (!variantId) return;
    setSelectedVariantId(variantId);
    setNewStock("");
    setObservation("");
    setStockEditor(true);
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4"><PanelTitle title="Inventario" text="Selecciona una variante para editar su stock mediante un movimiento manual." /><button aria-label="Nuevo ajuste de stock" className="icon-button" disabled={productVariants.length === 0} onClick={() => openStockEditor()} title="Nuevo ajuste de stock" type="button"><PlusIcon /></button></div>
        <Field label="Producto"><select className="admin-input mt-4" value={productId} onChange={(e) => setProductId(e.target.value)}>{products.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field>
        <div className="mt-4">
          <SettingsList
            key={productId}
            items={productVariants.map((variant) => ({ id: variant.id, name: `${variant.size} / ${variant.color}`, detail: `SKU ${variant.sku}`, status: `${variant.physicalStock} uds.` }))}
            onEdit={openStockEditor}
            selectedId={selectedVariantId}
          />
        </div>
      </section>
      {selectedVariant ? <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <PanelTitle title="Detalle de inventario" text="Consulta el stock actual y el historial de movimientos." />
        <div className="mt-5 rounded-lg border border-zinc-200 bg-stone-50 p-4 text-sm"><p className="font-semibold">{selectedVariant.size} / {selectedVariant.color}</p><p className="mt-1 text-xs text-zinc-500">SKU {selectedVariant.sku}</p><p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Stock actual</p><p className="mt-1 text-2xl font-semibold">{selectedVariant.physicalStock} uds.</p></div>
        <h3 className="mt-6 border-t border-zinc-200 pt-4 text-sm font-semibold uppercase tracking-[0.12em]">Historial</h3>
        {movements.map((movement) => <p className="mt-3 text-sm text-zinc-600" key={movement.id}>{movement.type}: {movement.previousStock} {"->"} {movement.newStock} ({formatDate(movement.createdAt)})</p>)}
      </section> : null}
      {stockEditor && selectedVariant ? <SettingsModal title={`Editar stock · ${selectedVariant.size} / ${selectedVariant.color}`} onClose={() => setStockEditor(false)}><form className="space-y-4" onSubmit={adjust}><p className="text-sm text-zinc-600">Stock actual: <span className="font-semibold text-zinc-900">{selectedVariant.physicalStock} uds.</span></p><Field label="Nuevo stock"><input className="admin-input" min="0" required type="number" value={newStock} onChange={(e) => setNewStock(e.target.value)} /></Field><Field label="Observacion"><textarea className="admin-input min-h-20" value={observation} onChange={(e) => setObservation(e.target.value)} /></Field><button className="admin-primary-button">Guardar ajuste</button></form></SettingsModal> : null}
    </div>
  );
}

function SecurityPanel({ onMessage, token, section }: PanelProps & { section: "users" | "roles" | "sessions" }) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [userEditor, setUserEditor] = useState<SettingsEditorState | null>(null);
  const [userPreview, setUserPreview] = useState<UserAccount | null>(null);
  const [roleEditor, setRoleEditor] = useState<SettingsEditorState | null>(null);
  const [refreshTokens, setRefreshTokens] = useState<RefreshToken[]>([]);
  const [sessionPage, setSessionPage] = useState(1);
  const [roleName, setRoleName] = useState("");
  async function load() {
    const [nextUsers, nextRoles] = await Promise.all([apiRequest<UserAccount[]>("/api/users", { token }), apiRequest<Role[]>("/api/roles?onlyActive=false", { token })]);
    setUsers(nextUsers); setRoles(nextRoles); setSelectedUserId((current) => current || nextUsers[0]?.id || ""); setSelectedRoleId((current) => current || nextUsers[0]?.roleId || nextRoles[0]?.id || "");
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const timeoutId = window.setTimeout(() => { void load().catch((error: Error) => onMessage(error.message)); }, 0); return () => window.clearTimeout(timeoutId); }, [token]);
  useEffect(() => { if (!selectedUserId) return; setSessionPage(1); const timeoutId = window.setTimeout(() => { void apiRequest<RefreshToken[]>("/api/refresh-tokens/user/" + selectedUserId, { token }).then((tokens) => setRefreshTokens(tokens.filter((entry) => !entry.revokedAt && new Date(entry.expiresAt).getTime() > Date.now()))).catch(() => setRefreshTokens([])); }, 0); return () => window.clearTimeout(timeoutId); }, [selectedUserId, token]);
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
  async function updateRole() {
    if (!selectedRoleId || !roleName.trim()) return;
    try {
      await apiRequest<void>("/api/roles/" + selectedRoleId, { method: "PUT", token, body: { name: roleName.trim() } });
      setRoleName("");
      onMessage("Rol actualizado.");
      await load();
    } catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo actualizar el rol."); }
  }
  async function deleteRole(roleId = selectedRoleId) {
    if (!roleId || !window.confirm("Se desactivara este rol. Continuar?")) return;
    try {
      await apiRequest<void>("/api/roles/" + roleId, { method: "DELETE", token });
      setSelectedRoleId("");
      setRoleName("");
      onMessage("Rol desactivado.");
      await load();
    } catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo desactivar el rol."); }
  }
  const selectedUser = users.find((entry) => entry.id === selectedUserId);
  const sessionPageSize = 8;
  const sessionPageCount = Math.max(1, Math.ceil(refreshTokens.length / sessionPageSize));
  const visibleSessions = refreshTokens.slice((sessionPage - 1) * sessionPageSize, sessionPage * sessionPageSize);
  useEffect(() => { setSessionPage((currentPage) => Math.min(currentPage, sessionPageCount)); }, [sessionPageCount]);
  function selectUser(userId: string) {
    const nextUser = users.find((entry) => entry.id === userId);
    setSelectedUserId(userId);
    if (nextUser) {
      setSelectedRoleId(nextUser.roleId);
      setRoleName(roles.find((entry) => entry.id === nextUser.roleId)?.name ?? "");
    }
  }
  return (
    <>
      <div className="space-y-6">
        {section === "users" ? <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <PanelTitle title="Usuarios" text="Selecciona una cuenta para administrar su rol y acceso." />
          <SettingsList items={users.map((entry) => ({ id: entry.id, name: entry.email, detail: roles.find((role) => role.id === entry.roleId)?.name ?? "Sin rol", status: entry.status }))} onEdit={(id) => { selectUser(id); setUserEditor({ mode: "edit", id }); }} onView={(id) => setUserPreview(users.find((entry) => entry.id === id) ?? null)} />
        </section> : null}
        {section === "roles" ? <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4"><PanelTitle title="Roles" text="Crea, renombra o desactiva roles de acceso." /><button aria-label="Crear rol" className="icon-button" onClick={() => { setSelectedRoleId(""); setRoleName(""); setRoleEditor({ mode: "create" }); }} title="Crear rol" type="button"><PlusIcon /></button></div>
          <SettingsList items={roles.map((entry) => ({ id: entry.id, name: entry.name, detail: "Rol de acceso" }))} onDelete={(id) => void deleteRole(id)} onEdit={(id) => { setSelectedRoleId(id); setRoleName(roles.find((entry) => entry.id === id)?.name ?? ""); setRoleEditor({ mode: "edit", id }); }} />
        </section> : null}
        {section === "sessions" ? <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4"><PanelTitle title="Sesiones activas" text="Revoca refresh tokens de un usuario desde el mismo panel." /><div className="w-full max-w-sm"><Field label="Usuario"><select className="admin-input" value={selectedUserId} onChange={(event) => selectUser(event.target.value)}>{users.map((entry) => <option key={entry.id} value={entry.id}>{entry.email}</option>)}</select></Field></div></div>
          {refreshTokens.length === 0 ? <p className="mt-5 text-sm text-zinc-500">No hay sesiones registradas.</p> : <><div className="mt-4 grid gap-3 md:grid-cols-2">{visibleSessions.map((entry) => <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-stone-50 p-3 text-sm" key={entry.id}><div><p className="font-semibold">{entry.deviceInfo || entry.userAgent || "Dispositivo sin nombre"}</p><p className="mt-1 text-xs text-zinc-500">Creado {formatDate(entry.createdAt)} · expira {formatDate(entry.expiresAt)}</p></div>{entry.revokedAt ? <span className="text-xs text-rose-700">Revocado</span> : <button aria-label="Revocar sesion" className="icon-button icon-button-danger" onClick={() => void revoke(entry.id)} title="Revocar sesion" type="button">×</button>}</div>)}</div><AdminPagination page={sessionPage} pageCount={sessionPageCount} total={refreshTokens.length} onPageChange={setSessionPage} /></>}
        </section> : null}
      </div>
      {userEditor ? <SettingsModal title="Administrar usuario" onClose={() => setUserEditor(null)}><div className="space-y-4"><p className="text-sm text-zinc-600">{selectedUser?.email}</p><Field label="Rol"><select className="admin-input" value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)}>{roles.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field><div className="flex flex-wrap gap-2"><button className="admin-primary-button" onClick={async () => { await changeRole(); setUserEditor(null); }} type="button">Guardar rol</button>{selectedUser?.status === "blocked" ? <button className="admin-secondary-button" onClick={async () => { await changeStatus(selectedUser.id, "unblock"); setUserEditor(null); }} type="button">Desbloquear</button> : <button className="admin-secondary-button" onClick={async () => { if (selectedUser) await changeStatus(selectedUser.id, "block"); setUserEditor(null); }} type="button">Bloquear</button>}</div></div></SettingsModal> : null}
      {userPreview ? <SettingsModal title="Detalle del usuario" onClose={() => setUserPreview(null)}><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Nombre</dt><dd className="mt-1 break-words font-semibold">{userPreview.name || "No registrado"}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Apellidos</dt><dd className="mt-1 break-words">{[userPreview.paternalSurname, userPreview.maternalSurname].filter(Boolean).join(" ") || "No registrado"}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Correo</dt><dd className="mt-1 break-all">{userPreview.email}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Telefono</dt><dd className="mt-1 break-words">{userPreview.phone || "No registrado"}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Rol</dt><dd className="mt-1 break-words">{roles.find((role) => role.id === userPreview.roleId)?.name ?? "Sin rol"}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Estado</dt><dd className="mt-1 break-words">{userPreview.status}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Creado</dt><dd className="mt-1 break-words">{formatDate(userPreview.createdAt)}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Identificador</dt><dd className="mt-1 break-all">{userPreview.id}</dd></div></dl></SettingsModal> : null}
      {roleEditor ? <SettingsModal title={roleEditor.mode === "create" ? "Nuevo rol" : "Editar rol"} onClose={() => setRoleEditor(null)}><form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); if (roleEditor.mode === "create") await createRole(event); else await updateRole(); setRoleEditor(null); }}><Field label="Nombre del rol"><input className="admin-input" required value={roleName} onChange={(e) => setRoleName(e.target.value)} /></Field><button className="admin-primary-button">{roleEditor.mode === "create" ? "Crear rol" : "Guardar cambios"}</button></form></SettingsModal> : null}
    </>
  );
}

function OlvaPanel({ onMessage, token }: PanelProps) {
  const [result, setResult] = useState<unknown>(null);
  const [resultTitle, setResultTitle] = useState("Respuesta de Olva");
  const [quoteLocations, setQuoteLocations] = useState<OlvaQuoteLocation[]>([]);
  const [quote, setQuote] = useState({ origin: "", destination: "", deliveryType: "O", shipmentType: "2", weight: "1", length: "", width: "", height: "", partnerRate: "false" });
  const [track, setTrack] = useState({ orderNumber: "", orderCode: "" });
  useEffect(() => {
    if (!token) return;
    const timeoutId = window.setTimeout(() => {
      void apiRequest<OlvaQuoteLocation[]>("/api/shipping/olva/quote-locations", { token })
        .then((locations) => {
          setQuoteLocations(locations);
          setQuote((current) => ({ ...current, origin: locations.some((location) => location.ubigeo === current.origin) ? current.origin : locations[0]?.ubigeo ?? "", destination: locations.some((location) => location.ubigeo === current.destination) ? current.destination : locations[0]?.ubigeo ?? "" }));
        })
        .catch(() => setQuoteLocations([]));
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [token]);
  async function validate() { try { setResultTitle("Validacion de Olva"); setResult(await apiRequest<unknown>("/api/shipping/olva/validate", { token })); onMessage("La API de Olva respondio correctamente."); } catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo validar Olva."); } }
  async function sync() { try { setResultTitle("Sincronizacion de agencias"); setResult(await apiRequest<unknown>("/api/shipping/olva/agencies/sync", { method: "POST", token, body: {} })); const locations = await apiRequest<OlvaQuoteLocation[]>("/api/shipping/olva/quote-locations", { token }); setQuoteLocations(locations); setQuote((current) => ({ ...current, origin: locations.some((location) => location.ubigeo === current.origin) ? current.origin : locations[0]?.ubigeo ?? "", destination: locations.some((location) => location.ubigeo === current.destination) ? current.destination : locations[0]?.ubigeo ?? "" })); onMessage("Agencias Olva sincronizadas."); } catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo sincronizar Olva."); } }
  async function makeQuote(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setResultTitle("Resultado de cotizacion"); try { setResult(await apiRequest<unknown>("/api/shipping/olva/quote", { method: "POST", token, body: { origin: quote.origin.trim(), destination: quote.destination.trim(), deliveryType: quote.deliveryType, shipmentType: quote.shipmentType ? Number(quote.shipmentType) : null, weight: Number(quote.weight), partnerRate: quote.partnerRate === "true", length: quote.shipmentType === "2" ? Number(quote.length) : null, width: quote.shipmentType === "2" ? Number(quote.width) : null, height: quote.shipmentType === "2" ? Number(quote.height) : null } })); onMessage("Cotizacion Olva consultada."); } catch (error) { setResult({ status: false, message: error instanceof Error ? error.message : "No se pudo cotizar el envio." }); } }
  async function makeTrack(event: FormEvent<HTMLFormElement>) { event.preventDefault(); try { setResultTitle("Resultado de seguimiento"); setResult(await apiRequest<unknown>("/api/shipping/olva/track", { method: "POST", token, body: track })); onMessage("Seguimiento consultado."); } catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo consultar el seguimiento."); } }
  return <div className="grid gap-6 xl:grid-cols-2"><section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"><PanelTitle title="Conexion Olva" text="Valida credenciales y actualiza el catalogo de agencias." /><div className="mt-5 flex flex-wrap gap-2"><button className="admin-primary-button" onClick={() => void validate()} type="button">Validar API</button><button className="admin-secondary-button" onClick={() => void sync()} type="button">Sincronizar agencias</button></div><form className="mt-6 space-y-3 border-t border-zinc-200 pt-5" onSubmit={makeQuote}><Field label="Origen"><select className="admin-input" required value={quote.origin} onChange={(e) => setQuote({ ...quote, origin: e.target.value })}><option value="">Seleccionar agencia de origen</option>{quoteLocations.map((location) => <option key={`origin-${location.ubigeo}`} value={location.ubigeo}>{location.district}, {location.province}, {location.department} · {location.agencyCount} agencia{location.agencyCount === 1 ? "" : "s"}</option>)}</select></Field><Field label="Destino"><select className="admin-input" required value={quote.destination} onChange={(e) => setQuote({ ...quote, destination: e.target.value })}><option value="">Seleccionar agencia de destino</option>{quoteLocations.map((location) => <option key={`destination-${location.ubigeo}`} value={location.ubigeo}>{location.district}, {location.province}, {location.department} · {location.agencyCount} agencia{location.agencyCount === 1 ? "" : "s"}</option>)}</select></Field>{quoteLocations.length === 0 ? <p className="text-sm text-rose-700">Sin ubicaciones disponibles. Sincroniza primero las agencias de Olva.</p> : null}<div className="grid gap-3 sm:grid-cols-2"><Field label="Tipo de entrega"><select className="admin-input" value={quote.deliveryType} onChange={(e) => setQuote({ ...quote, deliveryType: e.target.value })}><option value="O">Agencia</option><option value="D">Domicilio</option></select></Field><Field label="Tipo de envio"><select className="admin-input" value={quote.shipmentType} onChange={(e) => setQuote({ ...quote, shipmentType: e.target.value })}><option value="2">Paquete</option><option value="1">Documento</option></select></Field><Field label="Peso (kg)"><input className="admin-input" min="0.1" required step="0.1" type="number" value={quote.weight} onChange={(e) => setQuote({ ...quote, weight: e.target.value })} /></Field><Field label="Tarifa socio"><select className="admin-input" value={quote.partnerRate} onChange={(e) => setQuote({ ...quote, partnerRate: e.target.value })}><option value="false">No</option><option value="true">Si</option></select></Field></div>{quote.shipmentType === "2" ? <div className="grid gap-3 sm:grid-cols-3"><Field label="Largo (cm)"><input className="admin-input" min="1" required step="0.1" type="number" value={quote.length} onChange={(e) => setQuote({ ...quote, length: e.target.value })} /></Field><Field label="Ancho (cm)"><input className="admin-input" min="1" required step="0.1" type="number" value={quote.width} onChange={(e) => setQuote({ ...quote, width: e.target.value })} /></Field><Field label="Alto (cm)"><input className="admin-input" min="1" required step="0.1" type="number" value={quote.height} onChange={(e) => setQuote({ ...quote, height: e.target.value })} /></Field></div> : null}<button className="admin-secondary-button" disabled={quoteLocations.length === 0}>Cotizar envio</button></form></section><section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"><PanelTitle title="Seguimiento" text="Consulta el estado devuelto por Olva para una orden registrada." /><form className="mt-5 space-y-3" onSubmit={makeTrack}><Field label="Numero de orden"><input className="admin-input" required value={track.orderNumber} onChange={(e) => setTrack({ ...track, orderNumber: e.target.value })} /></Field><Field label="Codigo de orden"><input className="admin-input" value={track.orderCode} onChange={(e) => setTrack({ ...track, orderCode: e.target.value })} /></Field><button className="admin-primary-button">Consultar seguimiento</button></form></section>{result !== null ? <SettingsModal title={resultTitle} onClose={() => setResult(null)}><OlvaResponseContent value={result} /></SettingsModal> : null}</div>;
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

function OlvaResponseContent({ value }: { value: unknown }) {
  const root = isRecord(value) ? value : {};
  const data = isRecord(root.data) ? root.data : root;
  const entries = Object.entries(data).filter(([, entry]) => !Array.isArray(entry) && !isRecord(entry));
  const sections = Object.entries(data).filter(([, entry]) => isRecord(entry));
  const events = Array.isArray(data.events) ? data.events.filter(isRecord) : [];

  return <div className="space-y-5 text-sm">
    {entries.length > 0 ? <dl className="grid gap-4 sm:grid-cols-2">{entries.map(([key, entry]) => <div className="rounded-lg border border-zinc-200 bg-stone-50 p-4" key={key}><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">{formatOlvaKey(key)}</dt><dd className="mt-2 break-words text-base font-semibold text-zinc-900">{formatOlvaValue(key, entry)}</dd></div>)}</dl> : null}
    {sections.filter(([key]) => key !== "data").map(([key, entry]) => <section className="rounded-lg border border-zinc-200 p-4" key={key}><h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">{formatOlvaKey(key)}</h3><dl className="mt-3 grid gap-3 sm:grid-cols-2">{Object.entries(entry as Record<string, unknown>).map(([childKey, childValue]) => <div key={childKey}><dt className="text-xs text-zinc-500">{formatOlvaKey(childKey)}</dt><dd className="mt-1 break-words font-medium">{formatOlvaValue(childKey, childValue)}</dd></div>)}</dl></section>)}
    {events.length > 0 ? <section><h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Historial</h3><div className="mt-3 space-y-2">{events.map((event, index) => <div className="rounded-lg border border-zinc-200 bg-stone-50 p-3" key={String(event.id ?? event.date ?? index)}><p className="font-semibold">{formatOlvaValue("status", event.status ?? "Evento")}</p><p className="mt-1 text-zinc-600">{formatOlvaValue("detail", event.detail ?? "Sin detalle")}</p>{event.location ? <p className="mt-1 text-xs text-zinc-500">{String(event.location)}</p> : null}</div>)}</div></section> : null}
    {entries.length === 0 && sections.length === 0 && events.length === 0 ? <p className="text-zinc-500">Olva no devolvio datos para mostrar.</p> : null}
  </div>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatOlvaKey(key: string) {
  const labels: Record<string, string> = { amount: "Monto", delivery_type: "Tipo de entrega", excess_weight: "Peso excedente", status: "Estado", statusDetail: "Detalle del estado", trackingNumber: "Numero de guia", estimatedDelivery: "Entrega estimada", deliveredAt: "Entregado el", detail: "Detalle", location: "Ubicacion", message: "Mensaje" };
  return labels[key] ?? key.replace(/([A-Z])/g, " $1").replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function formatOlvaValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "No informado";
  if (key === "status" && typeof value === "boolean") return value ? "Disponible" : "No disponible";
  if (key === "delivery_type") return value === "O" ? "Agencia" : value === "D" ? "Domicilio" : String(value);
  if (key === "amount") return `S/ ${value}`;
  if (key === "excess_weight") return `${value} kg`;
  if (typeof value === "boolean") return value ? "Si" : "No";
  return String(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
