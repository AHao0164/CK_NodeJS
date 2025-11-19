import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchCart } from '../services/cart'
import { listProducts } from '../services/catalog'
import Button from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { motion } from 'framer-motion'

export default function Cart() {
  const { api } = useAuth()
  const [cart, setCart] = useState({ id: null, items: [] })
  const [catalog, setCatalog] = useState([])
  
  useEffect(() => { 
    (async () => {
      const [c, p] = await Promise.all([
        fetchCart(api),
        listProducts()
      ])
      setCart(c)
      setCatalog(Array.isArray(p?.items) ? p.items : [])
    })() 
  }, [api])
  
  function detailsOf(id) { return catalog.find(x => x.id === id) }
  const total = cart.items.reduce((s, it) => s + it.price_cents_snapshot * it.quantity, 0)
  
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
                    return (
                      <div className="flex items-center justify-between gap-3 py-3" key={it.id}>
                        <div className="flex min-w-0 items-center gap-3 pr-3">
                          <img src={img} alt={p.name} className="h-14 w-18 rounded-md object-cover" />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{p.name || `SP #${it.product_id}`}</div>
                            <div className="mt-0.5 text-xs text-slate-500">Qty x{it.quantity}</div>
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{(it.price_cents_snapshot/100).toLocaleString()} ₫</div>
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
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{(total/100).toLocaleString()} ₫</span></div>
                <div className="flex justify-between"><span>Shipping</span><span>0 ₫</span></div>
                <div className="flex justify-between font-semibold"><span>Total</span><span>{(total/100).toLocaleString()} ₫</span></div>
              </div>
              <Link to="/checkout"><Button className="mt-4 w-full" disabled={cart.items.length===0}>Checkout</Button></Link>
              <Link to="/" className="mt-2 inline-flex w-full justify-center text-sm text-primary hover:underline transition-colors">Continue Shopping</Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </section>
  )
}

