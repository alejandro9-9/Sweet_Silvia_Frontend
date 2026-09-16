import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { Address, Order, OrderItem, Payment, PaymentReceipt, Shipment, ShipmentEvent, UserAccount } from "@/lib/types";

export function useCustomerProfileData(token: string | null) {
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, OrderItem[]>>({});
  const [paymentsByOrder, setPaymentsByOrder] = useState<Record<string, Payment[]>>({});
  const [receiptsByPayment, setReceiptsByPayment] = useState<Record<string, PaymentReceipt[]>>({});
  const [shipmentsByOrder, setShipmentsByOrder] = useState<Record<string, Shipment[]>>({});
  const [eventsByShipment, setEventsByShipment] = useState<Record<string, ShipmentEvent[]>>({});
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function loadProfileData() {
      const [nextAccount, nextAddresses, nextOrders] = await Promise.all([
        apiRequest<UserAccount>("/api/users/me", { token }),
        apiRequest<Address[]>("/api/addresses/me", { token }).catch(() => []),
        apiRequest<Order[]>("/api/orders/me", { token }),
      ]);

      const orderDetails = await Promise.all(
        nextOrders.map(async (order) => {
          const [items, payments, shipments] = await Promise.all([
            apiRequest<OrderItem[]>(`/api/order-items/order/${order.id}`, { token }).catch(() => []),
            apiRequest<Payment[]>(`/api/payments/order/${order.id}`, { token }).catch(() => []),
            apiRequest<Shipment[]>(`/api/shipments/order/${order.id}`, { token }).catch(() => []),
          ]);

          return { order, items, payments, shipments };
        }),
      );

      const receiptPairs = await Promise.all(
        orderDetails.flatMap((detail) => detail.payments).map(async (payment) => ({
          paymentId: payment.id,
          receipts: await apiRequest<PaymentReceipt[]>(`/api/payment-receipts/payment/${payment.id}`, { token }).catch(() => []),
        })),
      );

      const eventPairs = await Promise.all(
        orderDetails.flatMap((detail) => detail.shipments).map(async (shipment) => ({
          shipmentId: shipment.id,
          events: await apiRequest<ShipmentEvent[]>(`/api/shipment-events/shipment/${shipment.id}`, { token }).catch(() => []),
        })),
      );

      if (!isActive) return;

      setAccount(nextAccount);
      setAddresses(nextAddresses);
      setOrders([...nextOrders].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()));
      setItemsByOrder(Object.fromEntries(orderDetails.map((detail) => [detail.order.id, detail.items])));
      setPaymentsByOrder(Object.fromEntries(orderDetails.map((detail) => [detail.order.id, detail.payments])));
      setShipmentsByOrder(Object.fromEntries(orderDetails.map((detail) => [detail.order.id, detail.shipments])));
      setReceiptsByPayment(Object.fromEntries(receiptPairs.map((entry) => [entry.paymentId, entry.receipts])));
      setEventsByShipment(Object.fromEntries(eventPairs.map((entry) => [entry.shipmentId, entry.events])));
    }

    void loadProfileData()
      .catch((error: Error) => {
        if (isActive) setMessage(error.message);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [refreshVersion, token]);

  return {
    account,
    addresses,
    eventsByShipment,
    isLoading,
    itemsByOrder,
    message,
    orders,
    paymentsByOrder,
    receiptsByPayment,
    refresh: () => setRefreshVersion((version) => version + 1),
    setAccount,
    setAddresses,
    setMessage,
    shipmentsByOrder,
  };
}
