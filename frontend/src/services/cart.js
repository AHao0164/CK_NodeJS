// Cart-related endpoints using the authenticated client (passed in)
import { publicApi } from '../api/client'

export async function fetchCart(api) {
  const { data } = await api.get('/cart')
  return data
}

export async function addItemToCart(api, { productId, quantity, priceCents }) {
  const { data } = await api.post('/cart/items', { productId, quantity, priceCents: priceCents })
  return data
}

export async function updateCartItemQuantity(api, { itemId, quantity }) {
	const { data } = await api.patch(`/cart/items/${itemId}`, { quantity })
	return data
}

export async function removeCartItem(api, { itemId }) {
	const { data } = await api.delete(`/cart/items/${itemId}`)
	return data
}

// Guest cart functions (no authentication required)
export async function addGuestItemToCart({ guestCartId, productId, quantity, priceCents }) {
  const { data } = await publicApi.post('/catalog/guest-cart', { 
    guestCartId, 
    productId, 
    quantity, 
    priceCents 
  })
  return data
}

