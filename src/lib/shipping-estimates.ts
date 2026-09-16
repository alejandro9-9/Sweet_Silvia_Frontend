import type { GuestCartItem } from "@/lib/cart";
import type { ShippingDestinationType } from "@/lib/types";

export type CartShippingOption = {
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

type PackageItem = {
  quantity: number;
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type PackageSummary = {
  actualWeightKg: number;
  volumetricWeightKg: number;
  chargeableWeightKg: number;
  limaSurcharge: number;
  provinceSurcharge: number;
};

export function toShippingPackageItem(item: GuestCartItem): PackageItem {
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

export function calculatePackageSummary(packageItems: PackageItem[]): PackageSummary {
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

export function normalizeDestinationType(value: ShippingDestinationType | string): ShippingDestinationType {
  return value.toLowerCase() === "lima" ? "lima" : "province";
}

export function estimatedCartShippingOptions(
  destinationType: ShippingDestinationType,
  departmentName: string,
  packageSummary: PackageSummary,
): CartShippingOption[] {
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
