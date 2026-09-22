import { describe, expect, it } from "vitest";
import {
  calculatePackageSummary,
  estimatedCartShippingOptions,
  normalizeDestinationType,
  toShippingPackageItem,
} from "@/lib/shipping-estimates";

describe("shipping estimates", () => {
  it("uses the product profile and quantity to calculate chargeable weight", () => {
    const item = toShippingPackageItem({
      id: "item-1",
      productId: "product-1",
      variantId: "variant-1",
      productName: "Jean wide leg",
      size: "M",
      color: "Azul",
      quantity: 2,
      availableStock: 5,
      unitPrice: 40,
      currency: "PEN",
      imageUrl: null,
    });

    const summary = calculatePackageSummary([item]);

    expect(summary.actualWeightKg).toBe(1.3);
    expect(summary.chargeableWeightKg).toBeGreaterThanOrEqual(summary.actualWeightKg);
  });

  it("returns province agency delivery with its surcharge", () => {
    const options = estimatedCartShippingOptions("province", "Amazonas", {
      actualWeightKg: 4,
      volumetricWeightKg: 1,
      chargeableWeightKg: 4,
      limaSurcharge: 2,
      provinceSurcharge: 4,
    });

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({
      label: "Olva Courier agencia",
      cost: 22,
      source: "estimate",
    });
  });

  it("normalizes unknown destination values as province", () => {
    expect(normalizeDestinationType("LIMA")).toBe("lima");
    expect(normalizeDestinationType("Arequipa")).toBe("province");
  });
});
