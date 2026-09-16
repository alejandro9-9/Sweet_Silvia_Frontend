import { useState } from "react";
import { publicAssetUrl } from "@/lib/api";
import type { GuestCartItem } from "@/lib/cart";
import { getMockProductImage, isPlaceholderImage } from "@/lib/mock-catalog";

export function CartItemImage({ item }: { item: GuestCartItem }) {
  const fallbackImage = getMockProductImage(item.productName);
  const initialImage = item.imageUrl && !isPlaceholderImage(item.imageUrl) ? toDisplayImage(item.imageUrl) : fallbackImage;
  const [imageSrc, setImageSrc] = useState(initialImage);

  return (
    <div className="aspect-[3/4] overflow-hidden bg-[#eee8df]">
      <img alt={item.productName} className="h-full w-full object-cover" onError={() => setImageSrc(fallbackImage)} src={imageSrc} />
    </div>
  );
}

type QuantityStepperProps = {
  label: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
};

export function QuantityStepper({ label, value, onDecrease, onIncrease }: QuantityStepperProps) {
  return (
    <div aria-label={label} className="grid h-11 w-32 grid-cols-3 overflow-hidden rounded-lg border border-zinc-300 bg-[#f8f5f0]" role="group">
      <button aria-label="Disminuir cantidad" className="grid h-full place-items-center text-lg transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-transparent" disabled={value <= 1} onClick={onDecrease} type="button">-</button>
      <span className="grid h-full place-items-center border-x border-zinc-300 bg-white text-sm font-semibold">{value}</span>
      <button aria-label="Aumentar cantidad" className="grid h-full place-items-center text-lg transition hover:bg-zinc-950 hover:text-white" onClick={onIncrease} type="button">+</button>
    </div>
  );
}

function toDisplayImage(imageUrl: string) {
  return imageUrl.startsWith("/mock-products") ? imageUrl : publicAssetUrl(imageUrl);
}
