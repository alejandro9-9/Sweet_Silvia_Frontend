import { useNavigate, useSearchParams } from "react-router-dom";
import { Link } from "@/components/RouterLink";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { OrdersPanel, ReceiptsPanel, TrackingPanel } from "@/components/CustomerOrderPanels";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatUserStatus } from "@/lib/order-format";
import { useCustomerProfileData } from "@/components/useCustomerProfileData";
import type { Address, Department, District, Province, UserAccount } from "@/lib/types";

type ProfileSection = "orders" | "tracking" | "receipts" | "profile";

const profileSections: { id: ProfileSection; label: string }[] = [
  { id: "orders", label: "Pedidos" },
  { id: "tracking", label: "Seguimiento" },
  { id: "receipts", label: "Comprobantes" },
  { id: "profile", label: "Datos del perfil" },
];

export function CustomerProfile() {
  const { token, user, refresh } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedSection = searchParams.get("section") as ProfileSection | null;
  const [activeSection, setActiveSection] = useState<ProfileSection>(isProfileSection(requestedSection) ? requestedSection : "orders");
  const currentSection = isProfileSection(requestedSection) ? requestedSection : activeSection;
  const {
    account,
    addresses,
    eventsByShipment,
    isLoading,
    itemsByOrder,
    message: profileMessage,
    orders,
    paymentsByOrder,
    receiptsByPayment,
    refresh: refreshProfileData,
    setAccount,
    setAddresses,
    setMessage: setProfileMessage,
    shipmentsByOrder,
  } = useCustomerProfileData(token);

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
      navigate("/profile", { replace: true });
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-rose-100 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">Mi cuenta</p>
        <div className="mt-3 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full min-w-0 sm:flex-1">
            <h1 className="break-words font-serif text-2xl font-semibold leading-tight tracking-normal sm:text-5xl [overflow-wrap:anywhere]">
              Hola, {account?.name?.trim() || "Sweet Reina"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              Revisa tus pedidos, seguimiento, comprobantes y datos personales desde un solo espacio.
            </p>
          </div>
          <Link className="w-full rounded-full bg-zinc-950 px-5 py-3 text-center text-sm font-semibold uppercase tracking-[0.12em] text-white sm:w-auto" href="/catalog">
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
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
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
      {currentSection === "tracking" ? <TrackingPanel eventsByShipment={eventsByShipment} orders={orders} shipmentsByOrder={shipmentsByOrder} token={token} /> : null}
      {currentSection === "receipts" ? (
        <ReceiptsPanel
          orders={orders}
          paymentsByOrder={paymentsByOrder}
          receiptsByPayment={receiptsByPayment}
          token={token}
          onReceiptUploaded={refreshProfileData}
        />
      ) : null}
      {currentSection === "profile" ? <ProfileDataPanel account={account} addresses={addresses} onAddressesChange={handleAddressesChange} onSubmit={updateProfile} /> : null}
    </div>
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

const deliveryDepartmentNames = new Set(["lima", "callao"]);

function normalizeLocationName(name: string) {
  return name.trim().toLocaleLowerCase("es-PE");
}

function isDeliveryDepartment(department: Department) {
  return deliveryDepartmentNames.has(normalizeLocationName(department.name));
}

function isDeliveryProvince(departmentName: string, provinceName: string) {
  const normalizedDepartment = normalizeLocationName(departmentName);
  return deliveryDepartmentNames.has(normalizedDepartment) && normalizeLocationName(provinceName) === normalizedDepartment;
}

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
            setDepartments(nextDepartments.filter(isDeliveryDepartment));
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
            const selectedDepartment = departments.find((department) => department.id === addressForm.departmentId);
            setProvinces(selectedDepartment ? nextProvinces.filter((province) => isDeliveryProvince(selectedDepartment.name, province.name)) : []);
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
  }, [addressForm.departmentId, departments]);

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
      <aside className="rounded-2xl border border-zinc-200 bg-zinc-950 p-6 text-white shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-300">Direccion principal</p>
            <h2 className="mt-2 text-xl font-semibold">{defaultAddress?.receiverName ?? "Sin direccion"}</h2>
          </div>
          {defaultAddress ? <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-200">Activa</span> : null}
        </div>
        <p className="mt-4 text-sm leading-6 text-zinc-300">{defaultAddress ? `${defaultAddress.line}${defaultAddress.references ? `, ${defaultAddress.references}` : ""}` : "Agrega una direccion para finalizar tus pedidos."}</p>
        {defaultAddress ? <p className="mt-3 text-sm font-semibold text-white">{defaultAddress.receiverPhone}</p> : null}
        <Link className="mt-5 inline-flex text-xs font-semibold uppercase tracking-[0.12em] text-rose-200 hover:text-white" href="#direcciones">
          Administrar direcciones
        </Link>
      </aside>
      <div className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm sm:p-6 xl:col-span-2" id="direcciones">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Direcciones</p>
            <h2 className="mt-2 text-2xl font-semibold">Entrega y contacto</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">Guarda la informacion que usaremos para delivery y para identificarte cuando elijas recojo en una agencia Olva.</p>
          </div>
          <button className="admin-secondary-button shrink-0" type="button" onClick={startAddressCreate}>
            Agregar direccion
          </button>
        </div>
        <div className="mt-6 space-y-6">
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Guardadas ({addresses.length})</p>
              {addresses.length > 0 ? <p className="text-xs text-zinc-400">Usa una como principal para agilizar tu compra.</p> : null}
            </div>
            {addresses.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-200 bg-stone-50 p-5 text-sm leading-6 text-zinc-500">Aun no tienes direcciones guardadas. Agrega la primera para poder finalizar un pedido.</p> : null}
            {addresses.length > 0 ? (
              <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white">
                {addresses.map((address) => (
                  <li className={`grid gap-4 border-l-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center ${address.isDefault ? "border-l-zinc-950 bg-stone-50" : "border-l-transparent"}`} key={address.id}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-zinc-950">{address.receiverName}</p>
                        {address.isDefault ? <span className="rounded-full bg-zinc-950 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white">Principal</span> : null}
                      </div>
                      <p className="mt-1 truncate text-sm text-zinc-700">{address.line}</p>
                      <p className="mt-1 text-xs text-zinc-500">{address.receiverPhone}{address.references ? ` - ${address.references}` : ""}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <button className="rounded-lg bg-zinc-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-white" type="button" onClick={() => startAddressEdit(address)}>
                        Editar
                      </button>
                      <button className="rounded-lg border border-rose-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-rose-800 disabled:opacity-50" disabled={isAddressSubmitting} type="button" onClick={() => void deleteAddress(address.id)}>
                        Eliminar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <form className="rounded-xl border border-zinc-200 bg-stone-50 p-5 sm:p-6" onSubmit={handleAddressSubmit}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">{editingAddressId ? "Editar direccion" : "Nueva direccion"}</p>
            <p className="mt-2 text-sm leading-5 text-zinc-500">Completa los datos del receptor y la ubicacion exacta. El delivery esta disponible solo en Lima/Lima y Callao/Callao.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <EditableField label="Recibe" value={addressForm.receiverName} onChange={(value) => updateAddressField("receiverName", value)} required />
              <EditableField label="Telefono de contacto" value={addressForm.receiverPhone} onChange={(value) => updateAddressField("receiverPhone", value)} required />
              <AddressSelect label="Departamento" value={addressForm.departmentId} onChange={(value) => updateAddressField("departmentId", value)} options={departments.map((department) => ({ id: department.id, name: department.name }))} />
              <AddressSelect label="Provincia" value={addressForm.provinceId} onChange={(value) => updateAddressField("provinceId", value)} options={provinces.map((province) => ({ id: province.id, name: province.name }))} disabled={!addressForm.departmentId} />
              <AddressSelect label="Distrito" value={addressForm.districtId} onChange={(value) => updateAddressField("districtId", value)} options={districts.map((district) => ({ id: district.id, name: district.name }))} disabled={!addressForm.provinceId} />
              <div className="md:col-span-2 xl:col-span-2">
                <EditableField label="Direccion" value={addressForm.line} onChange={(value) => updateAddressField("line", value)} required />
              </div>
              <label className="block text-sm font-semibold md:col-span-2 xl:col-span-2">
                Referencias
                <textarea className="admin-input mt-2 min-h-20" value={addressForm.references ?? ""} onChange={(event) => updateAddressField("references", event.target.value)} />
              </label>
              <label className="flex items-center gap-3 self-end rounded-xl border border-rose-100 bg-white px-4 py-3 text-sm font-semibold">
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

function isProfileSection(value: string | null): value is ProfileSection {
  return value === "orders" || value === "tracking" || value === "receipts" || value === "profile";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
