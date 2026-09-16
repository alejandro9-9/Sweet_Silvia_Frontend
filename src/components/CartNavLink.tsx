import { Link } from "@/components/RouterLink";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Cart } from "@/lib/types";
import { readGuestCart } from "@/lib/cart";

export function CartNavLink() {
  const { token, isReady } = useAuth();
  const [itemCount, setItemCount] = useState(() => readGuestCart().reduce((total, item) => total + item.quantity, 0));

  useEffect(() => {
    const updateItemCount = () => {
      if (!token) {
        setItemCount(readGuestCart().reduce((total, item) => total + item.quantity, 0));
      }
    };

    updateItemCount();
    const timeoutId = window.setTimeout(() => {
      if (isReady && token) {
        void apiRequest<Cart>("/api/cart/me", { token })
          .then((cart) => setItemCount(cart.items.reduce((total, item) => total + item.quantity, 0)))
          .catch(() => setItemCount(0));
      }
    }, 0);
    window.addEventListener("sweet-silvia-cart-updated", updateItemCount);
    window.addEventListener("storage", updateItemCount);

    return () => {
      window.removeEventListener("sweet-silvia-cart-updated", updateItemCount);
      window.removeEventListener("storage", updateItemCount);
      window.clearTimeout(timeoutId);
    };
  }, [isReady, token]);

  return (
    <Link
      aria-label={itemCount > 0 ? `Carrito con ${itemCount} productos` : "Carrito"}
      className="relative inline-grid h-10 w-10 place-items-center rounded-full border border-zinc-200 bg-white/70 text-zinc-950 shadow-sm transition hover:border-zinc-950 hover:bg-white"
      href="/cart"
    >
      <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
        <path
          d="M7.2 8.5h13.1l-1.5 7.9a2.3 2.3 0 0 1-2.25 1.85H9.65a2.3 2.3 0 0 1-2.26-1.88L5.65 5.75H3.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
        <path d="M9.85 21h.01M17.1 21h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
        <path d="M8.75 8.5a3.25 3.25 0 0 1 6.5 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      </svg>
      {itemCount > 0 ? (
        <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-700 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-[#f8f5f0]">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      ) : null}
    </Link>
  );
}
