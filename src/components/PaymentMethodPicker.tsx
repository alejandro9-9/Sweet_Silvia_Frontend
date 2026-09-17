import type { PaymentMethod } from "@/lib/types";

type PaymentMethodPickerProps = {
  methods: PaymentMethod[];
  value: string;
  onChange: (paymentMethodId: string) => void;
  showGatewayPlaceholder?: boolean;
};

type PaymentOptionProps = {
  method?: PaymentMethod;
  value: string;
  onChange: (paymentMethodId: string) => void;
  disabled?: boolean;
};

export function PaymentMethodPicker({ methods, value, onChange, showGatewayPlaceholder = false }: PaymentMethodPickerProps) {
  const hasIzipay = methods.some((method) => method.type === "gateway" && method.requiresExternalIntegration);

  return (
    <div aria-label="Metodo de pago" className="mt-3 grid gap-2" role="radiogroup">
      {methods.map((method) => (
        <PaymentOption key={method.id} method={method} onChange={onChange} value={value} />
      ))}
      {showGatewayPlaceholder && !hasIzipay ? <PaymentOption onChange={onChange} value={value} disabled /> : null}
    </div>
  );
}

function PaymentOption({ method, value, onChange, disabled = false }: PaymentOptionProps) {
  const selected = Boolean(method && method.id === value);
  const displayName = method?.type === "gateway" && method.requiresExternalIntegration
    ? "Tarjetas de credito y debito"
    : method?.name ?? "Tarjetas de credito y debito";
  const description = disabled
    ? "Pago en linea disponible al activar Izipay"
    : getPaymentDescription(method);

  return (
    <button
      aria-checked={selected}
      aria-disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${
        disabled
          ? "cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400"
          : selected
            ? "border-zinc-950 bg-zinc-950 text-white shadow-sm"
            : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400"
      }`}
      disabled={disabled}
      onClick={() => {
        if (method) {
          onChange(method.id);
        }
      }}
      role="radio"
      type="button"
    >
      <PaymentBrand name={method?.name ?? "Izipay"} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{displayName}</span>
        <span className={`mt-0.5 block text-xs ${selected ? "text-zinc-300" : "text-zinc-500"}`}>{description}</span>
      </span>
      <span
        aria-label={selected ? "Metodo seleccionado" : undefined}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-white bg-white" : "border-zinc-300"}`}
      >
        {selected ? <span className="h-2 w-2 rounded-full bg-zinc-950" /> : null}
      </span>
    </button>
  );
}

function getPaymentDescription(method?: PaymentMethod) {
  if (!method) {
    return "Pago en linea disponible al activar Izipay";
  }

  if (method.type === "cash") {
    return "Pago contraentrega solo para Lima";
  }

  if (method.type === "gateway" && method.requiresExternalIntegration) {
    return "Seras redirigido a Izipay para completar el pago";
  }

  return method.requiresManualVerification
    ? "Adjunta tu comprobante despues de crear el pedido"
    : "Pago en linea";
}

export function PaymentBrand({ name }: { name: string }) {
  const normalizedName = name.toLowerCase();
  const brand = normalizedName.includes("yape")
    ? { alt: "Logo Yape", src: "/yape-logo.png" }
    : normalizedName.includes("plin")
      ? { alt: "Logo Plin", src: "/plin-logo.png" }
      : normalizedName.includes("transfer") || normalizedName.includes("bcp")
        ? { alt: "Logo BCP", src: "/bcp-logo.png" }
        : normalizedName.includes("izipay")
          ? { alt: "Logo Izipay", src: "/izipay-logo.png" }
          : null;

  if (brand) {
    return <BrandImage alt={brand.alt} imageClassName={normalizedName.includes("yape") ? "scale-[1.35]" : undefined} src={brand.src} />;
  }

  if (normalizedName.includes("efectivo") || normalizedName.includes("cash")) {
    return <span aria-label="Pago en efectivo" className="flex h-10 w-12 shrink-0 items-center justify-center rounded-md bg-white px-1 text-center text-[9px] font-bold uppercase text-zinc-900 shadow-sm">Efectivo</span>;
  }

  return <span aria-label="Metodo de pago" className="flex h-10 w-12 shrink-0 items-center justify-center rounded-md bg-zinc-100 px-1 text-center text-[10px] font-bold uppercase text-zinc-900">Pago</span>;
}

function BrandImage({ alt, imageClassName, src }: { alt: string; imageClassName?: string; src: string }) {
  return (
    <span className="flex h-10 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white p-1 shadow-sm">
      <img alt={alt} className={`h-full w-full object-contain ${imageClassName ?? ""}`} src={src} />
    </span>
  );
}
