import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchCart, updateCartItemQuantity, removeCartItem } from '../services/cart'
import { listProducts } from '../services/catalog'
import Button from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { motion } from 'framer-motion'
import { useToast } from '../ui/Toast'

export default function Cart() {
  const { api } = useAuth()
  const [cart, setCart] = useState({ id: null, items: [] })
  const [catalog, setCatalog] = useState([])
  const [updating, setUpdating] = useState({})
  const toast = useToast()
  
  useEffect(() => { 
    loadCart()
  }, [api])
  
  const loadCart = async () => {
    const [c, p] = await Promise.all([
      fetchCart(api),
      listProducts()
    ])
    setCart(c)
    setCatalog(Array.isArray(p?.items) ? p.items : [])
  }
  
  const handleUpdateQuantity = async (itemId, newQuantity) => {
    if (newQuantity < 1) return
    setUpdating(prev => ({ ...prev, [itemId]: true }))
    try {
      await updateCartItemQuantity(api, { itemId, quantity: newQuantity })
      // Update local state for real-time feedback
      setCart(prev => ({
        ...prev,
        items: prev.items.map(item => 
          item.id === itemId ? { ...item, quantity: newQuantity } : item
        )
      }))
      toast.show('✓ Cập nhật giỏ hàng thành công', { type: 'success' })
    } catch (e) {
      toast.show('Không thể cập nhật số lượng', { type: 'error' })
    } finally {
      setUpdating(prev => ({ ...prev, [itemId]: false }))
    }
  }
  
  const handleRemoveItem = async (itemId) => {
    setUpdating(prev => ({ ...prev, [itemId]: true }))
    try {
      await removeCartItem(api, { itemId })
      // Update local state for real-time feedback
      setCart(prev => ({
        ...prev,
        items: prev.items.filter(item => item.id !== itemId)
      }))
      toast.show('✓ Đã xóa sản phẩm khỏi giỏ hàng', { type: 'success' })
    } catch (e) {
      toast.show('Không thể xóa sản phẩm', { type: 'error' })
    } finally {
      setUpdating(prev => ({ ...prev, [itemId]: false }))
    }
  }
  
  function detailsOf(id) { return catalog.find(x => x.id === id) }
  
  const subtotal = cart.items.reduce((s, it) => s + it.price_cents_snapshot * it.quantity, 0)
  const shippingFee = subtotal > 0 ? 30000 : 0 // 30k VND shipping, free if cart is empty
  const taxRate = 0.1 // 10% VAT
  const tax = Math.floor(subtotal * taxRate)
  const total = subtotal + shippingFee + tax
  
  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <motion.h2 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 font-bitcount"
      >
        Shopping Cart
      </motion.h2>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardBody>
              {cart.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <svg className="h-14 w-14 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.293 2.586A1 1 0 006.618 17H19m-8 4a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z"/></svg>
                  <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">Cart is empty. Explore products to start shopping!</div>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {cart.items.map(it => {
                    const p = detailsOf(it.product_id) || {}
                    const img = p.image_url || 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=1200&auto=format&fit=crop'
                    const itemTotal = it.price_cents_snapshot * it.quantity
                    const isUpdating = updating[it.id]
                    return (
                      <div className="flex items-start gap-4 py-4" key={it.id}>
                        <img src={img} alt={p.name} className="h-20 w-20 rounded-md object-cover flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <Link to={`/product/${it.product_id}`} className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-primary transition-colors line-clamp-2">
                            {p.name || `SP #${it.product_id}`}
                          </Link>
                          <div className="mt-1 text-xs text-slate-500">
                            Đơn giá: {(it.price_cents_snapshot/100).toLocaleString()} ₫
                          </div>
                          <div className="mt-2 flex items-center gap-3">
                            <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-md overflow-hidden">
                              <button 
                                onClick={() => handleUpdateQuantity(it.id, it.quantity - 1)}
                                disabled={it.quantity <= 1 || isUpdating}
                                className="px-3 py-1 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                −
                              </button>
                              <span className="px-3 py-1 text-sm font-medium min-w-[40px] text-center">
                                {it.quantity}
                              </span>
                              <button 
                                onClick={() => handleUpdateQuantity(it.id, it.quantity + 1)}
                                disabled={isUpdating}
                                className="px-3 py-1 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                +
                              </button>
                            </div>
                            <button 
                              onClick={() => handleRemoveItem(it.id)}
                              disabled={isUpdating}
                              className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              Xóa
                            </button>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {(itemTotal/100).toLocaleString()} ₫
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
        <div>
          <Card>
            <CardBody>
              <h3 className="text-base font-semibold mb-4 text-slate-900 dark:text-slate-100">Tóm tắt đơn hàng</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>Tạm tính ({cart.items.length} sản phẩm)</span>
                  <span>{(subtotal/100).toLocaleString()} ₫</span>
                </div>
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>Phí vận chuyển</span>
                  <span>{shippingFee > 0 ? (shippingFee/100).toLocaleString() + ' ₫' : 'Miễn phí'}</span>
                </div>
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>VAT (10%)</span>
                  <span>{(tax/100).toLocaleString()} ₫</span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700"></div>
                <div className="flex justify-between font-semibold text-base text-slate-900 dark:text-slate-100">
                  <span>Tổng cộng</span>
                  <span className="text-primary">{(total/100).toLocaleString()} ₫</span>
                </div>
              </div>
              <Link to="/checkout">
                <Button className="mt-4 w-full" disabled={cart.items.length===0}>
                  Thanh toán
                </Button>
              </Link>
              {cart.items.length > 0 && (
                <div className="mt-3 text-xs text-slate-600 dark:text-slate-400 text-center">
                  * Giá đã bao gồm VAT và phí vận chuyển
                </div>
              )}
              <Link to="/" className="mt-2 inline-flex w-full justify-center text-sm text-primary hover:underline transition-colors">
                Tiếp tục mua sắm
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </section>
  )
}

