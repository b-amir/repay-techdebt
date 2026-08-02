/** Settlement handoff after capture. */
export function settle(orderId, amount) {
  return { orderId, amount, status: "settled" };
}
