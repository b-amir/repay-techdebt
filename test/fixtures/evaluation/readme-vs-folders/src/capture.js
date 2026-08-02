export function capture(orderId, amount) {
  return { orderId, amount, status: "captured" };
}
