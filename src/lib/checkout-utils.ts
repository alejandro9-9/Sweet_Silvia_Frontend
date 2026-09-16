import type { GuestCartItem } from "@/lib/cart";
import type { Address, UserAccount } from "@/lib/types";

export function calculateSubtotal(items: GuestCartItem[]) {
  return items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
}

export function formatCheckoutMoney(amount: number, currency = "PEN") {
  const formattedAmount = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  return `S/. ${formattedAmount} ${currency}`;
}

export function formatAgencyName(name: string) {
  return name.replace(/^\w+\s*-\s*/i, "").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function isValidLocationOption(location: { name: string }) {
  const name = location.name.trim().toLowerCase();
  return name.length > 1 && name !== "string";
}

export function isGuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function toIzipayContact(account: UserAccount, address: Address, districtName: string, departmentName: string, document: string, postalCode: string) {
  return {
    firstName: account.name || address.receiverName,
    lastName: `${account.paternalSurname} ${account.maternalSurname ?? ""}`.trim() || address.receiverName,
    email: account.email,
    phoneNumber: address.receiverPhone || account.phone || "",
    street: address.line,
    postalCode,
    city: districtName,
    state: departmentName,
    country: "PE",
    documentType: "DNI",
    document,
  };
}
