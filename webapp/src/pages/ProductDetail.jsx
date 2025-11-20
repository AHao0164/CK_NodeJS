import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getProductById, listProducts } from '../services/catalog'
import { addItemToCart } from '../services/cart'
import Button from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { useToast } from '../ui/Toast'
import ProductCard from '../components/ProductCard'
import ImageGallery from '../components/Product/ImageGallery'
import VariantSelector from '../components/Product/VariantSelector'
import ReviewsSection from '../components/Product/ReviewsSection'

export default function ProductDetail() {
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const { api, token } = useAuth()
  const toast = useToast()
  const [related, setRelated] = useState([])
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [quantity, setQuantity] = useState(1)
  
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
    try {
      const finalPrice = product.price_cents + (selectedVariant?.price_adjustment_cents || 0)
      await addItemToCart(api, { productId: product.id, quantity, priceCents: finalPrice })
      toast.show('✓ Đã thêm vào giỏ', { type: 'success' })
    } catch (e) {
      toast.show('Có lỗi xảy ra. Vui lòng thử lại', { type: 'error' })
    }
  }
  
  const handleVariantSelect = (variant, allSelected) => {
    setSelectedVariant(variant)
  }
  
  const finalPrice = product ? product.price_cents + (selectedVariant?.price_adjustment_cents || 0) : 0
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
        <Link className="hover:text-blue-600" to="/">Trang chủ</Link>
        <span className="mx-2">/</span>
        <span className="text-slate-600">{product.category || 'Laptop'}</span>
        <span className="mx-2">/</span>
        <span className="font-medium text-slate-800">{product.name}</span>
      </nav>
      
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Image Gallery */}
        <div>
          <ImageGallery images={product.images} productName={product.name} />
        </div>
        
        {/* Product Info */}
        <div className="space-y-6">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <span>{product.brand}</span>
              <span>•</span>
              <span>{product.category}</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{product.name}</h1>
            
            {/* Rating Display */}
            {product.review_count > 0 && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <div className="flex items-center gap-1 text-yellow-400">
                  {[1, 2, 3, 4, 5].map(star => (
                    <svg
                      key={star}
                      className="h-4 w-4"
                      fill={star <= Math.floor(product.avg_rating) ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  ))}
                </div>
                <span className="font-medium">{product.avg_rating.toFixed(1)}</span>
                <span className="text-slate-500">({product.review_count} đánh giá)</span>
              </div>
            )}
          </div>
          
          {/* Price */}
          <div className="flex items-baseline gap-3">
            <div className="text-3xl font-bold text-blue-600">
              {(finalPrice / 100).toLocaleString()} ₫
            </div>
            {selectedVariant?.price_adjustment_cents !== 0 && (
              <div className="text-sm text-slate-500 line-through">
                {(product.price_cents / 100).toLocaleString()} ₫
              </div>
            )}
          </div>
          
          {/* Description */}
          {product.description && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {product.description}
              </p>
            </div>
          )}
          
          {/* Variants */}
          {product.variants && product.variants.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <VariantSelector variants={product.variants} onSelect={handleVariantSelect} />
            </div>
          )}
          
          {/* Quantity Selector */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-slate-700">Số lượng:</label>
            <div className="flex items-center rounded-lg border border-slate-300">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-4 py-2 text-slate-600 hover:bg-slate-50"
              >
                -
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 border-x border-slate-300 py-2 text-center focus:outline-none"
              />
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-50"
              >
                +
              </button>
            </div>
            <span className="text-sm text-slate-500">
              {selectedVariant ? selectedVariant.stock : product.stock} sản phẩm có sẵn
            </span>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button onClick={add} className="flex-1 px-8 py-3 text-base">
              Thêm vào giỏ hàng
            </Button>
            <Button variant="outline" className="px-8 py-3">
              ❤️
            </Button>
          </div>
          
          {/* Specs */}
          {product.specs && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 font-semibold text-slate-900">Thông số kỹ thuật</h3>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {Object.entries(product.specs).map(([key, value]) => (
                  <div key={key} className="rounded-lg border border-slate-200 p-3">
                    <dt className="text-slate-500">{key}</dt>
                    <dd className="font-medium text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          
          <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
            <div className="flex items-start gap-2">
              <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="font-semibold">Chính sách bán hàng</div>
                <ul className="mt-1 space-y-1 text-blue-700">
                  <li>• Miễn phí vận chuyển toàn quốc</li>
                  <li>• Bảo hành chính hãng 24 tháng</li>
                  <li>• Đổi trả trong 30 ngày</li>
                  <li>• Hỗ trợ trả góp 0% lãi suất</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Reviews Section */}
      <div className="mt-16">
        <ReviewsSection
          productId={product.id}
          initialReviews={product.reviews || []}
          avgRating={product.avg_rating || 0}
          reviewCount={product.review_count || 0}
        />
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


