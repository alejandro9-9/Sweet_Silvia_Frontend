import type { Product, ProductVariant } from "./types";

const categoryIds = {
  tops: "10000000-0000-0000-0000-000000000001",
  jeans: "10000000-0000-0000-0000-000000000002",
  dresses: "10000000-0000-0000-0000-000000000003",
  accessories: "10000000-0000-0000-0000-000000000004",
};

const collectionIds = {
  summer: "20000000-0000-0000-0000-000000000001",
  oversize: "20000000-0000-0000-0000-000000000002",
  basics: "20000000-0000-0000-0000-000000000003",
};

export const mockProducts: Product[] = [
  mockProduct("mock-blusa-satin-marfil", categoryIds.tops, collectionIds.basics, "Blusa Satin Marfil", "Blusa satinada de caida suave, fresca para oficina o salida.", 119.9),
  mockProduct("mock-falda-midi-negra", categoryIds.dresses, collectionIds.oversize, "Falda Midi Negra", "Falda midi de tela firme con movimiento elegante.", 129.9),
  mockProduct("mock-top-basico-crema", categoryIds.tops, collectionIds.basics, "Top Basico Crema", "Top versatil para combinar todos los dias.", 69.9),
  mockProduct("mock-set-lino-verano", categoryIds.tops, collectionIds.summer, "Set Lino Verano", "Set fresco de lino para temporada calida.", 189.9),
  mockProduct("mock-vestido-negro-midi", categoryIds.dresses, collectionIds.oversize, "Vestido Negro Midi", "Vestido midi elegante para noche.", 169.9),
  mockProduct("mock-chaqueta-denim-clara", categoryIds.jeans, collectionIds.basics, "Chaqueta Denim Clara", "Chaqueta denim liviana de uso diario.", 179.9),
  mockProduct("mock-bolso-mini-rosa", categoryIds.accessories, collectionIds.summer, "Bolso Mini Rosa", "Bolso compacto para completar el look.", 89.9),
  mockProduct("mock-enterizo-verde", categoryIds.dresses, collectionIds.summer, "Enterizo Verde", "Enterizo fluido con corte relajado.", 149.9),
  mockProduct("mock-camisa-rayas-azul", categoryIds.tops, collectionIds.basics, "Camisa Rayas Azul", "Camisa fresca de manga larga.", 109.9),
  mockProduct("mock-body-rib-caramelo", categoryIds.tops, collectionIds.basics, "Body Rib Caramelo", "Body acanalado de fit comodo.", 79.9),
  mockProduct("mock-blazer-lino-arena", categoryIds.tops, collectionIds.summer, "Blazer Lino Arena", "Blazer ligero para elevar el look.", 219.9),
  mockProduct("mock-cardigan-rosa-suave", categoryIds.tops, collectionIds.oversize, "Cardigan Rosa Suave", "Cardigan tejido de tacto suave.", 139.9),
  mockProduct("mock-pantalon-sastre-hueso", categoryIds.jeans, collectionIds.basics, "Pantalon Sastre Hueso", "Pantalon recto para oficina o salida.", 159.9),
  mockProduct("mock-short-denim-celeste", categoryIds.jeans, collectionIds.summer, "Short Denim Celeste", "Short denim de tiro alto para verano.", 99.9),
  mockProduct("mock-vestido-largo-celeste", categoryIds.dresses, collectionIds.summer, "Vestido Largo Celeste", "Vestido largo de movimiento ligero.", 179.9),
  mockProduct("mock-kimono-estampado", categoryIds.dresses, collectionIds.summer, "Kimono Estampado", "Kimono liviano para capas de verano.", 129.9),
  mockProduct("mock-sandalias-tiras-negras", categoryIds.accessories, collectionIds.summer, "Sandalias Tiras Negras", "Sandalias minimalistas de tiras.", 119.9),
  mockProduct("mock-lentes-carey", categoryIds.accessories, collectionIds.basics, "Lentes Carey", "Lentes con montura carey.", 69.9),
  mockProduct("mock-cartera-camel", categoryIds.accessories, collectionIds.oversize, "Cartera Camel", "Cartera estructurada de uso diario.", 149.9),
  mockProduct("mock-vestido-slip-champagne", categoryIds.dresses, collectionIds.oversize, "Vestido Slip Champagne", "Vestido slip satinado para noche.", 189.9),
];

export const mockVariantsByProduct: Record<string, ProductVariant[]> = Object.fromEntries(
  mockProducts.map((product, index) => [
    product.id,
    ["S", "M", "L"].map((size, sizeIndex) => ({
      id: `${product.id}-${size.toLowerCase()}`,
      productId: product.id,
      size,
      color: ["Marfil", "Rosa", "Negro", "Azul"][index % 4],
      sku: `MOCK-${String(index + 1).padStart(2, "0")}-${size}`,
      physicalStock: 4 + sizeIndex * 3,
      price: null,
      currency: "PEN",
      shippingWeightKg: 0.3,
      shippingLengthCm: 30,
      shippingWidthCm: 22,
      shippingHeightCm: 4,
      isActive: true,
    })),
  ]),
);

export function findMockProduct(id: string) {
  return mockProducts.find((product) => product.id === id) ?? null;
}

export function getMockProductImage(productName: string) {
  const normalizedName = productName.toLowerCase();

  if (normalizedName.includes("polo") || normalizedName.includes("oversize")) return "/mock-products/polo-oversize-blanco.jpg";
  if (normalizedName.includes("jean") || normalizedName.includes("wide leg")) return "/mock-products/jean-wide-leg-azul.jpg";
  if (normalizedName.includes("gorra")) return "/mock-products/gorra-sweet-silvia.jpg";
  if (normalizedName.includes("blusa")) return "/mock-products/blusa-satin-marfil.jpg";
  if (normalizedName.includes("falda")) return "/mock-products/falda-midi-negra.jpg";
  if (normalizedName.includes("top")) return "/mock-products/top-basico-crema.jpg";
  if (normalizedName.includes("set")) return "/mock-products/set-lino-verano.jpg";
  if (normalizedName.includes("negro")) return "/mock-products/vestido-negro-midi.jpg";
  if (normalizedName.includes("chaqueta") || normalizedName.includes("denim")) return "/mock-products/chaqueta-denim-clara.jpg";
  if (normalizedName.includes("bolso")) return "/mock-products/bolso-mini-rosa.jpg";
  if (normalizedName.includes("enterizo")) return "/mock-products/enterizo-verde.jpg";
  if (normalizedName.includes("camisa")) return "/mock-products/camisa-rayas-azul.jpg";
  if (normalizedName.includes("body")) return "/mock-products/body-rib-caramelo.jpg";
  if (normalizedName.includes("blazer")) return "/mock-products/blazer-lino-arena.jpg";
  if (normalizedName.includes("cardigan")) return "/mock-products/cardigan-rosa-suave.jpg";
  if (normalizedName.includes("pantalon") || normalizedName.includes("sastre")) return "/mock-products/pantalon-sastre-hueso.jpg";
  if (normalizedName.includes("short")) return "/mock-products/short-denim-celeste.jpg";
  if (normalizedName.includes("largo") || normalizedName.includes("celeste")) return "/mock-products/vestido-largo-celeste.jpg";
  if (normalizedName.includes("kimono")) return "/mock-products/kimono-estampado.jpg";
  if (normalizedName.includes("sandalias")) return "/mock-products/sandalias-tiras-negras.jpg";
  if (normalizedName.includes("lentes")) return "/mock-products/lentes-carey.jpg";
  if (normalizedName.includes("cartera")) return "/mock-products/cartera-camel.jpg";
  if (normalizedName.includes("slip") || normalizedName.includes("champagne")) return "/mock-products/vestido-slip-champagne.jpg";

  return "/mock-products/vestido-floral-rosa.jpg";
}

export function isPlaceholderImage(url: string) {
  return url.includes("placehold.co") || url.includes("placeholder");
}

function mockProduct(
  id: string,
  categoryId: string,
  collectionId: string,
  name: string,
  description: string,
  basePrice: number,
): Product {
  return {
    id,
    categoryId,
    collectionId,
    name,
    description,
    basePrice,
    currency: "PEN",
    isActive: true,
  };
}
