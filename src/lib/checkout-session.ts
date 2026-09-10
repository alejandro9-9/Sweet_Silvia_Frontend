import type { IzipayPaymentLinkResponse } from "./types";

const checkoutSessionPrefix = "sweet-silvia-checkout-session-v1";

export type CheckoutSession = {
  userId: string;
  orderId: string;
  paymentLink: IzipayPaymentLinkResponse | null;
};

function getCheckoutSessionKey(userId: string) {
  return `${checkoutSessionPrefix}:${userId}`;
}

export function readCheckoutSession(userId: string | null): CheckoutSession | null {
  if (typeof window === "undefined" || !userId) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(getCheckoutSessionKey(userId));
    if (!raw) {
      return null;
    }

    const value = JSON.parse(raw) as {
      userId?: unknown;
      orderId?: unknown;
      paymentLink?: unknown;
    };

    return value.userId === userId && typeof value.orderId === "string"
      ? {
          userId,
          orderId: value.orderId,
          paymentLink: value.paymentLink as IzipayPaymentLinkResponse | null,
        }
      : null;
  } catch {
    return null;
  }
}

export function persistCheckoutSession(userId: string | null, orderId: string, paymentLink: IzipayPaymentLinkResponse | null) {
  if (typeof window === "undefined" || !userId) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      getCheckoutSessionKey(userId),
      JSON.stringify({ userId, orderId, paymentLink }),
    );
  } catch {
    // Session storage can be unavailable in private browsing; checkout still works.
  }
}

export function clearCheckoutSessionStorage() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(`${checkoutSessionPrefix}:`)) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Session storage can be unavailable in private browsing.
  }
}
