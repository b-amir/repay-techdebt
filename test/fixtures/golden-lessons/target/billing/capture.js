import { settle } from "./settlement.js";

/** Payment capture entry for retrieve/relationship fixtures. */
export function capturePayment(order) {
  if (!order?.id) throw new Error("order required");
  return settle(order.id, order.amount);
}
