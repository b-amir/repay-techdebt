/** Settlement side effect for billing-core. */
export function settle(orderId, amount) {
  return { orderId, amount, status: "settled" };
}
