import { useState } from "react";
import { PaymentBrand } from "@/components/PaymentMethodPicker";
import type { PaymentMethod } from "@/lib/types";

const YAPE_PLIN_NUMBER = "967 556 897";
const BCP_ACCOUNT = "19202015326082";
const BCP_CCI = "00219210201532608230";

export function PaymentInstructions({ paymentMethod }: { paymentMethod?: PaymentMethod | null }) {
  const [copiedValue, setCopiedValue] = useState("");
  const kind = getPaymentKind(paymentMethod?.name);

  if (!paymentMethod || kind === "other") {
    return null;
  }

  const isTransfer = kind === "bcp";
  return (
    <section className="rounded-xl border border-rose-100 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <PaymentBrand name={paymentMethod.name} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">Como realizar tu pago</p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-950">{isTransfer ? "Transferencia BCP" : `Paga con ${paymentMethod.name}`}</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600">Realiza el pago por el monto exacto de tu pedido y luego adjunta una foto clara del comprobante.</p>
        </div>
      </div>

      {isTransfer ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <CopyablePaymentData label="Cuenta BCP soles" value={BCP_ACCOUNT} copiedValue={copiedValue} onCopied={setCopiedValue} />
          <CopyablePaymentData label="CCI BCP" value={BCP_CCI} copiedValue={copiedValue} onCopied={setCopiedValue} />
        </div>
      ) : (
        <div className="mt-5">
          <CopyablePaymentData label={`Numero ${paymentMethod.name}`} value={YAPE_PLIN_NUMBER} copiedValue={copiedValue} onCopied={setCopiedValue} />
        </div>
      )}

      <ol className="mt-5 grid gap-2 text-sm text-zinc-600 sm:grid-cols-3">
        <li className="rounded-lg bg-[#f8f5f0] p-3"><strong className="text-zinc-950">1.</strong> Realiza el pago.</li>
        <li className="rounded-lg bg-[#f8f5f0] p-3"><strong className="text-zinc-950">2.</strong> Guarda la constancia.</li>
        <li className="rounded-lg bg-[#f8f5f0] p-3"><strong className="text-zinc-950">3.</strong> Sube la foto abajo.</li>
      </ol>
    </section>
  );
}

function CopyablePaymentData({ label, value, copiedValue, onCopied }: { label: string; value: string; copiedValue: string; onCopied: (value: string) => void }) {
  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value.replaceAll(" ", ""));
      onCopied(value);
    } catch {
      onCopied("");
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-[#f8f5f0] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="break-all text-lg font-semibold tracking-[0.04em] text-zinc-950">{value}</p>
        <button className="shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-700 hover:border-zinc-950" onClick={() => void copyValue()} type="button">
          {copiedValue === value ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

function getPaymentKind(name?: string): "yape" | "plin" | "bcp" | "other" {
  const normalizedName = name?.toLowerCase() ?? "";
  if (normalizedName.includes("yape")) return "yape";
  if (normalizedName.includes("plin")) return "plin";
  if (normalizedName.includes("transfer") || normalizedName.includes("bcp")) return "bcp";
  return "other";
}
