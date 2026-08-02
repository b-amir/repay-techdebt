import { settle } from "./settlement.js";

/** Payment capture entry — unconventional path layout on purpose. */
export function capturePayment(order) {
  if (!order?.id) throw new Error("order required");
  return settle(order.id, order.amount);
}
