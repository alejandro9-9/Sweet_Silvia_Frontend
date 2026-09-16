export function formatMoney(amount: number, currency = "PEN") {
  return `S/. ${amount.toFixed(2)} ${currency}`;
}

export function shortId(value: string) {
  return value.slice(0, 8).toUpperCase();
}
