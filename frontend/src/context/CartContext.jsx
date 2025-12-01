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
      // Load guest cart count from sessionStorage
      try {
        const storedGuestCartItems = JSON.parse(sessionStorage.getItem('guestCartItems') || '[]')
        const count = storedGuestCartItems.reduce((sum, item) => sum + (item.quantity || 0), 0)
        const oldCount = cartCount
        setCartCount(count)
        
        // Show badge if cart count increased
        if (count > oldCount) {
          setShowBadge(true)
        }
      } catch (e) {
        console.error('Load guest cart count error:', e)
        setCartCount(0)
      }
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
    
    // For guest users, also listen to storage events (when cart is updated from another tab/window)
    const handleStorageChange = (e) => {
      if (e.key === 'guestCartItems' && !token) {
        loadCartCount()
      }
    }
    window.addEventListener('storage', handleStorageChange)
    
    // Also poll sessionStorage for guest users (in case storage event doesn't fire in same tab)
    let guestPollInterval = null
    if (!token) {
      guestPollInterval = setInterval(() => {
        loadCartCount()
      }, 2000) // Check every 2 seconds for guest users
    }
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', handleStorageChange)
      if (guestPollInterval) clearInterval(guestPollInterval)
    }
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
