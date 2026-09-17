import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { Order, Payment } from "@/lib/types";

export type CustomerPaymentStatus = "pendingReceipt" | "inReview" | "approved" | "rejected" | "other";

export type CustomerPaymentOrder = {
  order: Order;
  payment: Payment | null;
  status: CustomerPaymentStatus;
};

export function useCustomerPaymentStatus(token: string | null) {
  const [orders, setOrders] = useState<CustomerPaymentOrder[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(token));

  useEffect(() => {
    let isActive = true;

    if (!token) {
      setOrders([]);
      setIsLoading(false);
      return () => {
        isActive = false;
      };
    }

    setIsLoading(true);
    apiRequest<Order[]>("/api/orders/me", { token })
      .then(async (nextOrders) => {
        const nextOrdersWithPayments = await Promise.all(
          nextOrders.map(async (order) => {
            const payments = await apiRequest<Payment[]>(`/api/payments/order/${order.id}`, { token }).catch(() => []);
            const payment = [...payments].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ?? null;
            return {
              order,
              payment,
              status: getCustomerPaymentStatus(order, payment),
            } satisfies CustomerPaymentOrder;
          }),
        );

        if (isActive) {
          setOrders(nextOrdersWithPayments.sort((left, right) => new Date(right.order.createdAt).getTime() - new Date(left.order.createdAt).getTime()));
        }
      })
      .catch(() => {
        if (isActive) {
          setOrders([]);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [token]);

  return { isLoading, orders };
}

function getCustomerPaymentStatus(order: Order, payment: Payment | null): CustomerPaymentStatus {
  if (payment?.status === "pendingReceipt" || payment?.status === "rejected") {
    return payment.status;
  }

  if (payment?.status === "inReview") {
    return "inReview";
  }

  if (payment?.status === "approved" || order.status === "paid") {
    return "approved";
  }

  if (order.status === "pendingReceipt") {
    return "pendingReceipt";
  }

  if (order.status === "receiptInReview") {
    return "inReview";
  }

  return "other";
}
