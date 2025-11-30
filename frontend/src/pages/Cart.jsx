import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { fetchCart, removeCartItem, updateCartItemQuantity } from '../services/cart'
import { listProducts } from '../services/catalog'
import Button from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { motion } from 'framer-motion'
import VI from '../constants/vi'

export default function Cart() {
  const { api, token } = useAuth()
  const { refreshCart } = useCart()
  const navigate = useNavigate()
  const [cart, setCart] = useState({ id: null, items: [] })
  const [catalog, setCatalog] = useState([])
  const [selectedItems, setSelectedItems] = useState(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [guestCartId, setGuestCartId] = useState(null)
  
  const loadCart = async () => {
    if (token && api) {
      // Logged in user: load from API
      const [c, p] = await Promise.all([
        fetchCart(api),
        listProducts()
      ])
      setCart(c)
      setCatalog(Array.isArray(p?.items) ? p.items : [])
    } else {
      // Guest user: load from sessionStorage
      const storedGuestCartId = sessionStorage.getItem('guestCartId')
      const storedGuestCartItems = JSON.parse(sessionStorage.getItem('guestCartItems') || '[]')
      setGuestCartId(storedGuestCartId)
      // Map guest cart items to match cart structure (with id, product_id, quantity)
      const mappedItems = storedGuestCartItems.map((item, idx) => ({
        id: item.id || idx + 1, // Use item.id if exists, otherwise use index
        product_id: item.product_id || item.productId,
        quantity: item.quantity || 1,
        price_cents: item.price_cents || item.priceCents
      }))
      setCart({ id: storedGuestCartId, items: mappedItems })
      const p = await listProducts()
      setCatalog(Array.isArray(p?.items) ? p.items : [])
    }
  }

  useEffect(() => {
    document.title = 'Giỏ hàng - GearUp';
  }, []);
  
  useEffect(() => { loadCart() }, [api, token])
  
  function detailsOf(id) { return catalog.find(x => x.id === id) }
  
  const subtotal = cart.items
    .filter(it => selectedItems.has(it.id))
    .reduce((s, it) => {
      const p = detailsOf(it.product_id)
      // Use price from catalog if available, otherwise fallback to price stored in cart
      const originalPrice = p?.price_cents || it.price_cents || 0
      const discountPercent = p?.discount_percent || 0
      const finalPrice = Math.round(originalPrice * (100 - discountPercent) / 100)
      return s + finalPrice * it.quantity
    }, 0)
  
  // Calculate tax (VAT 10%)
  const tax = Math.round(subtotal * 0.1)
  const total = subtotal + tax

  const toggleSelectItem = (itemId) => {
    setSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedItems.size === cart.items.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(cart.items.map(it => it.id)))
    }
  }

  const handleRemoveSelected = async () => {
    if (selectedItems.size === 0) return
    setDeleteTarget('selected')
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    try {
      if (token && api) {
        // Logged in user: remove from API
        if (deleteTarget === 'selected') {
          await Promise.all([...selectedItems].map(itemId => removeCartItem(api, { itemId })))
          setSelectedItems(new Set())
        } else if (deleteTarget) {
          await removeCartItem(api, { itemId: deleteTarget })
        }
      } else {
        // Guest user: remove from sessionStorage
        const storedGuestCartItems = JSON.parse(sessionStorage.getItem('guestCartItems') || '[]')
        let updatedItems
        if (deleteTarget === 'selected') {
          updatedItems = storedGuestCartItems.filter(item => {
            const itemId = item.id || storedGuestCartItems.indexOf(item) + 1
            return !selectedItems.has(itemId)
          })
          setSelectedItems(new Set())
        } else if (deleteTarget) {
          updatedItems = storedGuestCartItems.filter(item => {
            const itemId = item.id || storedGuestCartItems.indexOf(item) + 1
            return itemId !== deleteTarget
          })
        } else {
          updatedItems = storedGuestCartItems
        }
        sessionStorage.setItem('guestCartItems', JSON.stringify(updatedItems))
      }
      await loadCart()
      await refreshCart()
    } catch (e) {
      console.error('Remove error:', e)
    } finally {
      setShowDeleteModal(false)
      setDeleteTarget(null)
    }
  }

  const handleRemove = async (itemId) => {
    setDeleteTarget(itemId)
    setShowDeleteModal(true)
  }

  const handleUpdateQuantity = async (itemId, quantity) => {
    if (quantity < 1) return
    try {
      if (token && api) {
        // Logged in user: update via API
        await updateCartItemQuantity(api, { itemId, quantity })
      } else {
        // Guest user: update in sessionStorage
        const storedGuestCartItems = JSON.parse(sessionStorage.getItem('guestCartItems') || '[]')
        const updatedItems = storedGuestCartItems.map(item => {
          const currentItemId = item.id || storedGuestCartItems.indexOf(item) + 1
          if (currentItemId === itemId) {
            return { ...item, quantity }
          }
          return item
        })
        sessionStorage.setItem('guestCartItems', JSON.stringify(updatedItems))
      }
      await loadCart()
      await refreshCart()
    } catch (e) {
      console.error('Update error:', e)
    }
  }
  
  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <motion.h2 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 font-bitcount"
      >
        {VI.cart.title}
      </motion.h2>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardBody>
              {cart.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <svg className="h-14 w-14 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.293 2.586A1 1 0 006.618 17H19m-8 4a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z"/></svg>
                  <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">{VI.cart.emptyCartMessage}</div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectedItems.size === cart.items.length && cart.items.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary"
                      />
                      <span>Chọn tất cả ({cart.items.length})</span>
                    </label>
                    {selectedItems.size > 0 && (
                      <button 
                        onClick={handleRemoveSelected}
                        className="text-sm text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-medium"
                      >
                        Xóa đã chọn ({selectedItems.size})
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {cart.items.map(it => {
                      const p = detailsOf(it.product_id) || {}
                      const img = p.image_url || 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=1200&auto=format&fit=crop'
                      // Use price from catalog if available, otherwise fallback to price stored in cart
                      const originalPrice = p.price_cents || it.price_cents || 0
                      const discountPercent = p.discount_percent || 0
                      const finalPrice = Math.round(originalPrice * (100 - discountPercent) / 100)
                      
                      return (
                        <div className="flex items-center gap-3 py-3" key={it.id}>
                          <input 
                            type="checkbox" 
                            checked={selectedItems.has(it.id)}
                            onChange={() => toggleSelectItem(it.id)}
                            className="rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary"
                          />
                          <div className="flex min-w-0 items-center gap-3 pr-3 flex-1">
                            <div className="relative">
                              <img src={img} alt={p.name} className="h-20 w-24 rounded-md object-cover" />
                              {discountPercent > 0 && (
                                <div className="absolute top-0 left-0 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-br">
                                  -{discountPercent}%
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{p.name || `SP #${it.product_id}`}</div>
                              <div className="mt-1 flex items-center gap-2">
                                <button onClick={() => handleUpdateQuantity(it.id, it.quantity - 1)} className="h-6 w-6 rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">−</button>
                                <span className="text-xs text-slate-700 dark:text-slate-300 min-w-[2rem] text-center">{it.quantity}</span>
                                <button onClick={() => handleUpdateQuantity(it.id, it.quantity + 1)} className="h-6 w-6 rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">+</button>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              {discountPercent > 0 ? (
                                <>
                                  <div className="text-xs text-slate-400 line-through">{(originalPrice * it.quantity).toLocaleString('vi-VN')} ₫</div>
                                  <div className="text-sm font-semibold text-red-500">{(finalPrice * it.quantity).toLocaleString('vi-VN')} ₫</div>
                                </>
                              ) : (
                                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{(finalPrice * it.quantity).toLocaleString('vi-VN')} ₫</div>
                              )}
                            </div>
                            <button onClick={() => handleRemove(it.id)} className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300" title="Xóa">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </div>
        <div>
          <Card>
            <CardBody>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Tóm tắt đơn hàng</h3>
              
              {/* Price Summary */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                  <span>Sản phẩm đã chọn</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{selectedItems.size} sản phẩm</span>
                </div>
                
                <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-2">
                  <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>Tạm tính</span>
                    <span className="text-slate-900 dark:text-slate-100">{subtotal.toLocaleString('vi-VN')} ₫</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>Thuế VAT (10%)</span>
                    <span className="text-slate-900 dark:text-slate-100">{tax.toLocaleString('vi-VN')} ₫</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">Tổng cộng</span>
                    <span className="text-xl font-bold text-slate-900 dark:text-slate-100">{total.toLocaleString('vi-VN')} ₫</span>
                  </div>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                  💡 Phí vận chuyển và mã giảm giá sẽ được tính ở bước tiếp theo
                </div>
              </div>

              {/* Checkout Button */}
              <Button 
                className="mt-4 w-full" 
                disabled={selectedItems.size === 0}
                onClick={() => {
                  if (selectedItems.size === 0) return;
                  const selectedItemsList = cart.items.filter(it => selectedItems.has(it.id));
                  navigate('/checkout', { 
                    state: { 
                      selectedItems: selectedItemsList,
                      selectedItemIds: Array.from(selectedItems)
                    } 
                  });
                }}
              >
                {VI.cart.proceedToCheckout}
              </Button>

              <Link to="/" className="mt-3 inline-flex w-full justify-center text-sm text-primary hover:underline transition-colors">
                {VI.cart.continueShopping}
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/20">
                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-center text-slate-900 dark:text-slate-100 mb-2">
                Xác nhận xóa
              </h3>
              <p className="text-center text-slate-600 dark:text-slate-400 mb-6">
                {deleteTarget === 'selected' 
                  ? `Bạn có chắc muốn xóa ${selectedItems.size} sản phẩm đã chọn?`
                  : 'Bạn có chắc muốn xóa sản phẩm này khỏi giỏ hàng?'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteModal(false); setDeleteTarget(null) }}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
                >
                  Xóa
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </section>
  )
}

