// Orders-related endpoints using the authenticated client (passed in)

export async function listOrders(api) {
  const { data } = await api.get('/orders')
  return data
}

export async function checkoutOrder(api, { items, shipping, billing }) {
  const { data } = await api.post('/orders/checkout', { items, shipping, billing })
  return data
}

export async function payForOrder(api, { orderId, intentId }) {
  const { data } = await api.post(`/orders/${orderId}/pay`, { intentId })
  return data
}

export async function validateCoupon(api, code) {
  const { data } = await api.get(`/orders/coupons/${encodeURIComponent(code)}`)
  return data
}



