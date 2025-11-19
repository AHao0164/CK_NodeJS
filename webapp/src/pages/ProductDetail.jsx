import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getProductById, listProducts } from '../services/catalog'
import { addItemToCart } from '../services/cart'
import Button from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { useToast } from '../ui/Toast'
import ProductCard from '../components/ProductCard'

export default function ProductDetail() {
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const { api, token } = useAuth()
  const toast = useToast()
  const [related, setRelated] = useState([])
  useEffect(() => { 
    getProductById(id).then(p => {
      setProduct(p)
      // load related by brand/category
      listProducts().then(res => {
        const items = Array.isArray(res?.items) ? res.items : []
        const rel = items.filter(x => x.id !== p.id && (x.brand===p.brand || x.category===p.category)).slice(0, 8)
        setRelated(rel)
      })
    })
  }, [id])
  async function add() {
    if (!token) return toast.show('Vui lòng đăng nhập', { type: 'error' })
    await addItemToCart(api, { productId: product.id, quantity: 1, priceCents: product.price_cents })
    toast.show('✓ Đã thêm vào giỏ', { type: 'success' })
  }
  if (!product) return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <Card>
        <CardBody>
          <div className="mb-4 h-4 w-32 rounded bg-slate-200/60 dark:bg-slate-700" />
          <div className="skeleton" style={{ height: 18, width: '40%', marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 14, width: '30%', marginBottom: 20 }} />
          <div className="skeleton" style={{ height: 18, width: '20%', marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 240, width: '100%' }} />
        </CardBody>
      </Card>
    </section>
  )
  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-4 text-sm text-slate-500">
        <Link className="hover:text-brand-600" to="/">Trang chủ</Link>
        <span className="mx-2">/</span>
        <span className="text-slate-600 dark:text-slate-300">{product.category || 'Laptop'}</span>
        <span className="mx-2">/</span>
        <span className="font-medium text-slate-800 dark:text-slate-100">{product.name}</span>
      </nav>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <Card>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl">
            <img
              src={(product.image_url && (/^https?:\/\//.test(product.image_url) ? product.image_url : (import.meta.env.VITE_API_BASE || 'http://localhost:8080') + product.image_url)) || 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=1200&auto=format&fit=crop'}
              alt={product.name}
              className="h-full w-full object-cover"
            />
            <div className="absolute left-3 top-3 inline-flex items-center rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white">
              {product.brand || 'Premium'}
            </div>
          </div>
        </Card>
        <div>
          <Card>
            <CardBody>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{product.name}</h1>
              <div className="mt-1 text-sm text-slate-500">{product.brand || 'Brand'} · {product.category || 'Laptop'}</div>
              <div className="mt-3 flex items-center gap-3">
                <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{(product.price_cents/100).toLocaleString()} ₫</div>
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                  Còn hàng
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button onClick={add} className="px-5 py-2.5">Thêm vào giỏ</Button>
                <Button variant="outline" className="px-5 py-2.5">Yêu thích</Button>
              </div>
              {product.description && (
                <p className="mt-6 text-sm leading-6 text-slate-600 dark:text-slate-300">{product.description}</p>
              )}
              <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800"><span className="text-slate-500">CPU:</span> {product.cpu || 'Intel Core i7'}</div>
                <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800"><span className="text-slate-500">RAM:</span> {product.ram || '16GB'}</div>
                <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800"><span className="text-slate-500">SSD:</span> {product.ssd || '512GB NVMe'}</div>
                <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800"><span className="text-slate-500">Màn hình:</span> {product.display || '15.6" 144Hz'}</div>
              </div>
              <div className="mt-6 text-xs text-slate-500">Giá đã bao gồm VAT · Bảo hành 24 tháng</div>
            </CardBody>
          </Card>
        </div>
      </div>
      {/* Related */}
      {related.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-4 text-xl font-semibold tracking-tight">Sản phẩm liên quan</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {related.map(r => <ProductCard key={r.id} product={r} onAdd={add} />)}
          </div>
        </div>
      )}
    </section>
  )
}


