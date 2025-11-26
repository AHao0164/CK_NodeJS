import React, { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { fetchCart } from '../services/cart'

const CartContext = createContext()

export function CartProvider({ children }) {
  const { api, token } = useAuth()
  const [cartCount, setCartCount] = useState(0)
  const [showBadge, setShowBadge] = useState(false)

  const loadCartCount = async () => {
    if (!token) {
      setCartCount(0)
      return
    }
    try {
      const cart = await fetchCart(api)
      const count = cart.items?.reduce((sum, item) => sum + item.quantity, 0) || 0
      const oldCount = cartCount
      setCartCount(count)
      
      // Show badge if cart count increased
      if (count > oldCount) {
        setShowBadge(true)
      }
    } catch (e) {
      console.error('Load cart count error:', e)
    }
  }

  useEffect(() => {
    loadCartCount()
    // Auto refresh cart count every 30 seconds
    const interval = setInterval(loadCartCount, 30000)
    return () => clearInterval(interval)
  }, [token])

  const dismissBadge = () => {
    setShowBadge(false)
  }

  return (
    <CartContext.Provider value={{ cartCount, showBadge, dismissBadge, refreshCart: loadCartCount }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}
